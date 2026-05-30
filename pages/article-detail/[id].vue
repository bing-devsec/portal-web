<template>
  <section class="l-container l-article pt-20 article-detail-section">
    <div class="l-article-main">
        <div class="panel panel-default mb-20">
          <div class="panel-body pt-10 pb-10">
            <!-- 文章内容区域 - SSR 直出 HTML，确保爬虫和无 JS 用户立即看到正文 -->
            <article v-if="article" :key="articleId" class="article-container">
              <h1 class="c_titile">{{ article.title }}</h1>
              <div class="box_c">
                <span class="info-item">标签：{{ article.tag }}</span>
                <span class="info-item"
                  >首次发布：{{ article.createTime }}</span
                >
                <span class="info-item"
                  >最近修改：{{ article.updateTime }}</span
                >
              </div>

              <div>
                <!--
                  纯 SSR 渲染：服务端用 markdown-it 把 markdown 渲染为 HTML，
                  v-html 直出。无论是否水合、是否有 JS，DOM 永远只此一份，
                  彻底避免"刷新瞬间样式抖动"以及客户端再次替换 DOM 带来的 hydration mismatch。
                  富交互（代码块复制、行号、目录联动）由轻量的 SSR 友好方案单独承担。
                -->
                <div
                  v-if="article.renderedHtml"
                  class="article-body-ssr"
                  v-html="article.renderedHtml"
                ></div>

                <!-- 数据加载前的骨架屏（SSR 没拿到内容时的兜底） -->
                <div v-else class="loading-skeleton">
                  <div class="skeleton-line"></div>
                  <div class="skeleton-line"></div>
                  <div class="skeleton-line"></div>
                </div>
              </div>
            </article>

            <!-- 骨架屏 - 数据加载前显示（包括 SSR 未能取到内容的情况） -->
            <div v-else class="loading-skeleton article-placeholder">
              <div class="skeleton-title"></div>
              <div class="skeleton-info"></div>
              <div class="skeleton-line"></div>
              <div class="skeleton-line"></div>
              <div class="skeleton-line"></div>
              <div v-if="loadingState" class="loading-message">
                {{ loadingState }}
              </div>
            </div>
          </div>
        </div>
    </div>

    <aside class="l-article-aside">
        <!--
          目录区域：headings 已在 SSR 阶段由父组件提取并通过 prop 传入，
          组件本身能够在服务端直出 <ul>，首屏一次成型，零闪烁；
          移动端隐藏交由组件内 @media (max-width:576px) display:none 控制，
          这样 SSR/客户端的输出完全一致，没有水合差异。
        -->
        <div v-if="article && catalogHeadings.length" class="catalog-wrapper">
          <div class="catalog-content">
            <CatalogRenderer
              :headings="catalogHeadings"
              :article-id="articleId"
              :scroll-element="scrollElement"
              :scroll-element-offset-top="12"
              :key="articleId"
            />
          </div>
        </div>
    </aside>
  </section>
</template>

<script setup lang="ts">
import {
  ref,
  computed,
  watch,
  onMounted,
  onBeforeUnmount,
  nextTick,
} from "vue";
import {
  getUserAgentFromEvent,
  generateArticleStructuredData,
  generateArticleBreadcrumb,
} from "~/utils/seo";
import {
  renderMarkdownToHtml,
  extractFirstImageUrl,
  extractPlainTextDescription,
  extractHeadingsFromHtml,
} from "~/utils/markdown";
import { ResponseCode } from "~/utils/api";
// 目录组件改为同步 import：
// - SSR 阶段需要拿到组件实例直出 <ul>，不能再走 defineAsyncComponent 异步加载
// - 组件 + 样式很小（一个 <ul> + 一个 IntersectionObserver），同步引入对首屏 JS 影响可忽略
// - 同步 import 同时去掉了 <Suspense> + 骨架屏 + delay:200 引发的"骨架→列表→active"三段闪烁
import CatalogRenderer from "../../components/CatalogRenderer.vue";
// KaTeX 样式：SSR 阶段已经把 LaTeX 编译成 HTML 标签，
// 此处只需引入官方 CSS 来提供字体/上下标尺寸/对齐的样式表，否则公式只是一团裸 span。
// 全局只引入一次，CSS 体积约 70KB（gzip 后 ~20KB）—— 仅在文章详情页才会加载，可接受。
import "katex/dist/katex.min.css";

interface ArticleDetail {
  id: string;
  title: string;
  tag: string;
  // content 是后端返回的 markdown 原文，仅在 SSR 阶段用于：
  //   1) renderMarkdownToHtml → renderedHtml
  //   2) extractPlainTextDescription → description（meta description / og:description）
  //   3) extractFirstImageUrl → ogImageUrl（og:image）
  // 这三件事在 SSR 阶段就能全部完成，结果会作为下面三个派生字段一起返回。
  // 因此 content 不再写入客户端 payload —— 一篇 markdown 长文动辄 100KB+，
  // 这块体积占了 _payload.json 的一大半，删掉收益极大。
  // 仍标为可选字段是因为 SPA 路由切换时（客户端 fetchArticleContent）
  // 这条降级路径会临时持有 content（用于客户端再渲一次 markdown），但它不会
  // 进入 SSR 序列化产物。
  content?: string;
  createTime: string;
  updateTime: string;
  // SSR 阶段预渲染好的 HTML 字符串，模板中 v-html 直出，确保爬虫立即拿到正文
  renderedHtml?: string;
  // SSR 阶段预提取的纯文本摘要（≤160 字），用于 meta description / og:description / twitter:description
  description?: string;
  // SSR 阶段预提取的首图 URL（无图时为空串），用于 og:image / twitter:image
  ogImageUrl?: string;
}

const route = useRoute();
const runtimeConfig = useRuntimeConfig();
const articleId = computed(() => route.params.id as string);
const scrollElement = ".scrollable-content";
const article = ref<ArticleDetail | null>(null);
const loadingState = ref<string>("正在加载文章...");
const fingerprintReady = ref(false);
const fingerprintValue = ref("");
const pendingRequest = ref<Promise<any> | null>(null); // 请求去重

// ==================== 浏览量打点（view-log）====================
// 设计参考：docs/view-log-backend-spec.md
// - 真实浏览触发：onMounted 后延迟 1500ms（避开预渲染、prefetch、误触）。
// - 仅客户端发出；SPA 路由切换在 watch route.params.id 里再次触发。
// - 使用 navigator.sendBeacon 优先：不阻塞页面、用户立即关页也能送出。
// - 后端只看 token 内的 fingerprintId+articleId+ts+nonce 做风控决策；前端不做任何"是否+1"判断。
// - 同一篇文章在一次"挂载/路由切换会话"内只触发一次，避免 watch 重入或重复定时器。
const VIEW_LOG_DELAY_MS = 1500;
let viewLogTimer: ReturnType<typeof setTimeout> | null = null;
let viewLogReportedFor: string | null = null; // 已经打过点的 articleId，防止重复

const cancelPendingViewLog = () => {
  if (viewLogTimer !== null) {
    clearTimeout(viewLogTimer);
    viewLogTimer = null;
  }
};

const buildViewLogBody = async (
  targetArticleId: string,
  encryptToken: (plaintext: string) => Promise<string>,
  rawFingerprintId: string
): Promise<{
  token: string;
  referer: string;
  tz: string;
  screen: string;
  lang: string;
  perfNav: string;
} | null> => {
  // 1) 组装 token 明文 JSON：fingerprintId + articleId + ts + nonce
  //    后端 §2.2：长度需 < 245 字节（RSA 2048 PKCS#1 v1.5 单块上限），实际约 130 字节，足够。
  const nonce =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : // 回落：极少数老浏览器没有 randomUUID 时手搓一个伪 UUID，仍是 v4 形态
        "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
          const r = (Math.random() * 16) | 0;
          const v = c === "x" ? r : (r & 0x3) | 0x8;
          return v.toString(16);
        });

  const plain = JSON.stringify({
    fingerprintId: rawFingerprintId,
    articleId: targetArticleId,
    ts: Date.now(),
    nonce,
  });

  let token = "";
  try {
    token = await encryptToken(plain);
  } catch {
    // 公钥拿不到 / 加密失败：本次直接放弃打点，不影响页面
    return null;
  }
  if (!token) return null;

  // 2) 组装其他字段（后端 §1.2 所列）
  // 安全防御：在极小概率的非常规环境（无 screen / Intl 等），逐字段 try/catch 给空串
  const safeReferer = (() => {
    try {
      return document.referrer || "";
    } catch {
      return "";
    }
  })();
  const safeTz = (() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    } catch {
      return "";
    }
  })();
  const safeScreen = (() => {
    try {
      return `${window.screen.width}x${window.screen.height}`;
    } catch {
      return "";
    }
  })();
  const safeLang = (() => {
    try {
      return navigator.language || "";
    } catch {
      return "";
    }
  })();
  const safePerfNav = (() => {
    try {
      const entry = performance.getEntriesByType("navigation")[0] as
        | (PerformanceEntry & { type?: string })
        | undefined;
      return entry?.type || "";
    } catch {
      return "";
    }
  })();

  return {
    token,
    referer: safeReferer,
    tz: safeTz,
    screen: safeScreen,
    lang: safeLang,
    perfNav: safePerfNav,
  };
};

const sendViewLog = async (targetArticleId: string) => {
  if (!import.meta.client) return;
  if (!targetArticleId) return;
  // 同一 articleId 不重复打点（即使 watch 重入或多次 nextTick 触发）
  if (viewLogReportedFor === targetArticleId) return;

  // 页面不可见时直接放弃（背景 tab、prerender 等）。
  // 后端虽然也会按 perfNav==="prerender" 拒绝，但前端先省一次请求更合算。
  try {
    if (typeof document !== "undefined" && document.visibilityState === "hidden") {
      return;
    }
  } catch {
    // 忽略
  }

  const nuxtApp = useNuxtApp();
  const $encryptToken = nuxtApp.$encryptToken as
    | ((plaintext: string) => Promise<string>)
    | undefined;
  const $getFingerprintId = nuxtApp.$getFingerprintId as
    | (() => Promise<string>)
    | undefined;

  if (typeof $encryptToken !== "function" || typeof $getFingerprintId !== "function") {
    // 插件未注入：理论上不会发生（plugins/fingerprint.client.ts 是 client plugin）
    return;
  }

  let rawFp = "";
  try {
    rawFp = await $getFingerprintId();
  } catch {
    return;
  }
  if (!rawFp) return;

  // 路由可能已经切换到别的文章，这里再校验一次 articleId 是否还是目标
  if (route.params.id !== targetArticleId) return;

  const body = await buildViewLogBody(targetArticleId, $encryptToken, rawFp);
  if (!body) return;

  // 再次校验路由没变
  if (route.params.id !== targetArticleId) return;

  // 标记已打点（在真正发出前置位，确保即使 sendBeacon 失败也不会反复重试同一篇）
  viewLogReportedFor = targetArticleId;

  const url = `${runtimeConfig.public.baseURL}/user/article/view-log/${targetArticleId}`;
  const payload = JSON.stringify(body);

  // 关键：Content-Type 使用 "text/plain;charset=UTF-8"（CORS-safelisted），不是 "application/json"。
  // 原因：
  //   1) navigator.sendBeacon 要求 simple request：Content-Type 必须是 text/plain /
  //      application/x-www-form-urlencoded / multipart/form-data 三者之一，
  //      其他类型会触发 CORS preflight（OPTIONS），但 sendBeacon 本身不支持 preflight，
  //      因此写 "application/json" 会让 sendBeacon 直接 return false。
  //   2) 在 LOCAL_DEBUG=false 等跨域调试场景下，"application/json" 同样会触发
  //      preflight，而 Go 后端无 OPTIONS 路由 → 浏览器报 CORS 错误。
  //   3) body 仍然是 JSON 字符串，Go 后端用 c.ShouldBindJSON 显式按 JSON 解析即可，
  //      Content-Type 只是建议性提示，不影响实际反序列化。
  const BEACON_CONTENT_TYPE = "text/plain;charset=UTF-8";

  // 优先 sendBeacon：用户即使立刻关闭页面也能送出，浏览器在 unload 时不会取消。
  // 注意 sendBeacon 不支持自定义 Content-Type 选项，但传 Blob 可以指定。
  try {
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const blob = new Blob([payload], { type: BEACON_CONTENT_TYPE });
      const ok = navigator.sendBeacon(url, blob);
      if (ok) return;
    }
  } catch {
    // 回落到 fetch
  }

  // 回落：fetch + keepalive。后端响应 204 / 4xx / 5xx 都不影响页面，静默处理。
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": BEACON_CONTENT_TYPE },
      body: payload,
      keepalive: true,
    });
  } catch {
    // 网络异常：丢弃即可，view_count 少一次不影响业务
  }
};

const scheduleViewLog = (targetArticleId: string) => {
  if (!import.meta.client) return;
  if (!targetArticleId) return;
  cancelPendingViewLog();
  // 已经为这篇打过点了：路由切回来不再重复
  if (viewLogReportedFor === targetArticleId) return;
  viewLogTimer = setTimeout(() => {
    viewLogTimer = null;
    void sendViewLog(targetArticleId);
  }, VIEW_LOG_DELAY_MS);
};
// ==================== /浏览量打点 ====================


// 目录列表：基于 SSR 渲染好的 HTML 用正则抽 heading（id/level/text），
// SSR 阶段就能算出值并直出到 <ul>，避免客户端再 querySelectorAll 引发的闪烁。
// renderedHtml 在 SSR 阶段（useAsyncData）已经填充，因此 SSR HTML 里就带着完整目录。
const catalogHeadings = computed(() => {
  const html = article.value?.renderedHtml || "";
  return extractHeadingsFromHtml(html, 3);
});

// 服务端预取文章详情，用于 SSR 输出 HTML
// Nuxt 要求 useAsyncData 在 SSR 阶段返回非 null/undefined 的值，否则客户端可能重复请求。
// 在无法获取到有效文章时，返回一个空的占位对象以避免该警告并保持行为可控。
const emptyArticle: ArticleDetail = {
  id: "",
  title: "",
  tag: "",
  createTime: "",
  updateTime: "",
};

const { data: serverArticle } = await useAsyncData<ArticleDetail>(
  // key 必须带上 articleId：
  //   1) 防御性：避免不同文章在同一会话里复用同一 useAsyncData 槽位，
  //      导致 SPA 路由切换时旧文章 payload 被错误复用。
  //   2) 与 Nuxt 3 的 _payload.json 抽取机制配合得更稳：
  //      payloadExtraction 默认开启时，浏览器加载 HTML 后会再 fetch
  //      `/article-detail/<id>/_payload.json` 用以替换 inline payload。
  //      key 携带 id 之后，hydration 阶段 payload 与 ref 的对应关系是 1:1，
  //      不会因 key 复用产生跨文章串台。
  `article-detail-ssr-${articleId.value}`,
  async () => {
    if (!import.meta.server || !articleId.value) {
      return emptyArticle;
    }

    const event = useRequestEvent();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    // 透传 User-Agent 给后端，让后端识别搜索引擎爬虫
    const userAgent = getUserAgentFromEvent(event);
    if (userAgent) {
      headers["user-agent"] = userAgent;
    }

    // SSR 必须用 ssrApiBase 直连后端：
    //   - 生产 public.baseURL="/api-backend" 是给浏览器走 nginx 代理用的相对路径，
    //     在 Node 进程内 $fetch 会请求 http://localhost:3000/api-backend/...（自请自身），
    //     拿不到文章数据，导致 SSR 渲染出来是空标题 + 默认 meta，SEO 完全失效。
    //   - 本地环境两个地址恰好相同（都是 http://127.0.0.1:8080），所以本地无感知。
    // 与 utils/api.ts 中 `import.meta.server ? config.ssrApiBase : config.public.baseURL` 保持一致。
    const ssrBaseURL = runtimeConfig.ssrApiBase as string;
    let result: { code: number; data: ArticleDetail | null } | null = null;
    try {
      result = await $fetch<{ code: number; data: ArticleDetail | null }>(
        `${ssrBaseURL}/user/article/detail`,
        {
          method: "GET",
          query: { id: articleId.value },
          headers,
        }
      );
    } catch {
      // 网络异常：静默降级为客户端再尝试拉取，返回占位对象
      return emptyArticle;
    }

    // 文章不存在：抛真 404，让 Nuxt 渲染 404 页并返回 HTTP 404，
    // 避免 Googlebot 抓到"占位 HTML + 200"被打成软 404，影响整站权重。
    if (result?.code === ResponseCode.NotFound) {
      throw createError({
        statusCode: 404,
        statusMessage: "文章不存在",
        fatal: true,
      });
    }

    if (result?.code === 2000 && result.data) {
      // SSR 阶段一次性把所有"依赖 markdown 原文"的派生数据算好，避免把
      // 完整 content 字段塞进客户端 payload。这是 _payload.json 体积优化的关键步骤。
      //   - renderedHtml：v-html 直出正文（SEO + 首屏）
      //   - description：纯文本摘要，用于 meta description / og / twitter / JSON-LD
      //   - ogImageUrl  ：从正文里抽出第一张图作为 og:image
      const md = result.data.content || "";
      const renderedHtml = await renderMarkdownToHtml(md);
      const description = extractPlainTextDescription(md, 160);
      const firstImage = extractFirstImageUrl(md);
      const ogImageUrl = firstImage || "";

      // 注意：这里**显式剥离 content**，让它不再出现在 useAsyncData 的返回值里，
      // Nuxt payload 序列化时就不会写进 _payload.json。
      const { content: _drop, ...rest } = result.data as ArticleDetail;
      void _drop;
      return {
        ...rest,
        renderedHtml,
        description,
        ogImageUrl,
      };
    }

    // 业务码非 2000 但又不是 NotFound：保守处理，返回占位让客户端重试
    return emptyArticle;
  }
);

// 使用 SSR 数据优先填充文章基础信息
// SSR 阶段已经在 useAsyncData 里把 markdown 渲染为 renderedHtml，
// 客户端直接复用同一份字符串通过模板中的 v-html 输出，无需任何二次渲染。
if (serverArticle.value) {
  article.value = serverArticle.value;
}

// SEO：根据文章内容动态设置页面标题和 meta 信息
// 优化：使用 computed 缓存计算结果，避免重复计算
const SITE_NAME = "冰冰同学的技术博客";
const DEFAULT_OG_IMAGE = "https://liubing.xyz/favicon.ico";

const seoData = computed(() => {
  const current = article.value || serverArticle.value;
  const siteUrl = runtimeConfig.public.siteUrl || "https://liubing.xyz";
  if (!current || !current.id) {
    return {
      title: `博客文章 | ${SITE_NAME}`,
      description: "",
      tags: [],
      canonicalUrl: "",
      structuredData: null,
      breadcrumb: null,
      ogImage: DEFAULT_OG_IMAGE,
      publishedTime: "",
      modifiedTime: "",
      current: null,
    };
  }

  // 描述：优先使用 SSR 阶段已经预提取的 description；
  // 仅在客户端 SPA 路由切换并临时持有 content 的兜底路径下回退到现场抽取。
  const description = current.description
    ? current.description
    : current.content
      ? extractPlainTextDescription(current.content, 160)
      : "";
  const tags = current.tag ? current.tag.split(/[,\s，]+/).filter(Boolean) : [];
  const canonicalUrl = `${siteUrl}/article-detail/${current.id}`;
  // 把 description 透传给结构化数据生成器，让它无需再依赖 content
  const structuredData = generateArticleStructuredData(current, siteUrl, description);
  const breadcrumb = generateArticleBreadcrumb(current, siteUrl);

  // og:image：优先使用 SSR 预提取的 ogImageUrl；客户端兜底再现场扫一次
  const firstImage = current.ogImageUrl
    ? current.ogImageUrl
    : current.content
      ? extractFirstImageUrl(current.content) || ""
      : "";
  const ogImage = firstImage
    ? firstImage.startsWith("http")
      ? firstImage
      : `${siteUrl}${firstImage.startsWith("/") ? "" : "/"}${firstImage}`
    : DEFAULT_OG_IMAGE;

  return {
    // title 追加站点名，利于品牌词收录与 SERP 展示
    title: `${current.title} | ${SITE_NAME}`,
    description,
    tags,
    canonicalUrl,
    structuredData,
    breadcrumb,
    ogImage,
    publishedTime: current.createTime || "",
    modifiedTime: current.updateTime || "",
    current,
  };
});

useHead(() => {
  const data = seoData.value;

  if (!data.current) {
    return {
      title: data.title,
    };
  }

  return {
    title: data.title,
    link: [
      {
        rel: "canonical",
        href: data.canonicalUrl,
      },
    ],
    meta: [
      { name: "description", content: data.description },
      ...(data.tags.length
        ? [{ name: "keywords", content: data.tags.join(",") }]
        : []),
      // Open Graph：Facebook / LinkedIn / 微信外链等通用社交协议
      { property: "og:type", content: "article" },
      { property: "og:title", content: data.current.title },
      { property: "og:description", content: data.description },
      { property: "og:url", content: data.canonicalUrl },
      { property: "og:site_name", content: SITE_NAME },
      { property: "og:image", content: data.ogImage },
      { property: "og:locale", content: "zh_CN" },
      // article:* 是 Open Graph 文章子协议，提供发布/修改时间与作者
      ...(data.publishedTime
        ? [{ property: "article:published_time", content: data.publishedTime }]
        : []),
      ...(data.modifiedTime
        ? [{ property: "article:modified_time", content: data.modifiedTime }]
        : []),
      { property: "article:author", content: "冰冰同学" },
      ...(data.tags.length
        ? data.tags.map((tag) => ({ property: "article:tag", content: tag }))
        : []),
      // Twitter Card：Twitter / X 单独走 twitter: 命名空间，回落顺序优先于 og:
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: data.current.title },
      { name: "twitter:description", content: data.description },
      { name: "twitter:image", content: data.ogImage },
    ],
    script: [
      ...(data.structuredData
        ? [
            {
              type: "application/ld+json",
              children: JSON.stringify(data.structuredData),
            },
          ]
        : []),
      ...(data.breadcrumb
        ? [
            {
              type: "application/ld+json",
              children: JSON.stringify(data.breadcrumb),
            },
          ]
        : []),
    ],
  };
});

// 直接获取文章内容的方法（优化：添加请求去重和错误处理）
const fetchArticleContent = async () => {
  if (!articleId.value) return;

  // 请求去重：如果已有相同请求在进行，直接返回
  if (pendingRequest.value) {
    try {
      await pendingRequest.value;
    } catch {
      // 忽略错误，继续执行
    }
    return;
  }

  try {
    // 构建请求头：客户端打文章详情接口时统一带 x-client-id（指纹密文）
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (fingerprintValue.value) {
      headers["x-client-id"] = fingerprintValue.value;
    }

    // 创建请求 Promise 并保存
    const requestPromise = fetch(
      `${useRuntimeConfig().public.baseURL}/user/article/detail?id=${
        articleId.value
      }`,
      {
        method: "GET",
        headers,
      }
    )
      .then(async (response) => {
        // 检查响应状态
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();

        // 检查是否为 404 错误（文章不存在）
        if (result.code === ResponseCode.NotFound) {
          // 客户端：跳转到 404 页面
          if (import.meta.client) {
            const router = useRouter();
            // 使用 setTimeout 避免在 SSR 期间或水合过程中跳转
            setTimeout(() => {
              router.push("/404");
            }, 0);
          }
          // 抛出错误，但不显示错误信息（因为会跳转）
          throw new Error("文章不存在");
        }

        if (result.code === 2000 && result.data) {
          // SPA 路由切换 / 客户端兜底拉取：后端只返回原始 markdown content，
          // 这里在客户端把它渲染成 HTML，统一交给模板的 v-html 输出，
          // 与 SSR 走的是同一份排版规则（.article-body-ssr）。
          const renderedHtml = await renderMarkdownToHtml(result.data.content);
          article.value = {
            ...result.data,
            renderedHtml,
          };
        } else {
          // API 返回其他错误码
          throw new Error(
            result.message || `获取文章失败，错误码: ${result.code}`
          );
        }
        return result;
      })
      .finally(() => {
        // 请求完成后清除
        pendingRequest.value = null;
      });

    pendingRequest.value = requestPromise;
    await requestPromise;
  } catch (error) {
    pendingRequest.value = null;

    // 如果是 404 错误（文章不存在），已经在上面处理了跳转，这里不需要显示错误
    if (error instanceof Error && error.message === "文章不存在") {
      // 404 错误已经处理跳转，不需要显示错误信息
      return;
    }

    // 设置错误状态
    loadingState.value =
      error instanceof Error
        ? error.message
        : "加载文章失败，请检查网络或稍后再试";

    // 如果 SSR 有数据，至少可以显示 SSR 内容作为降级方案
    if (serverArticle.value) {
      article.value = serverArticle.value;
    }

    // 重新抛出错误，让调用方知道失败了
    throw error;
  }
};

// 初始化文章内容
const initArticleContent = async () => {
  if (!articleId.value) return;

  // 优化：如果 SSR 已经有渲染好的 HTML，直接使用，避免重复请求。
  // 历史上这里判断 serverArticle.value.content，但现在 SSR 已经把 content
  // 从 payload 里剥离（替换为 renderedHtml + description + ogImageUrl），
  // 所以改用 renderedHtml 作为"SSR 成功"的信号。
  if (serverArticle.value && serverArticle.value.renderedHtml) {
    article.value = serverArticle.value;
    return;
  }

  try {
    // 客户端兜底拉取文章：直接计算指纹后请求
    const { $recalculateFingerprint } = useNuxtApp();
    if (typeof $recalculateFingerprint === "function") {
      fingerprintValue.value = await $recalculateFingerprint();
      fingerprintReady.value = true;
      await fetchArticleContent();
    } else {
      loadingState.value = "加载失败，请刷新页面";
      // 如果 SSR 有数据，至少可以显示 SSR 内容
      if (serverArticle.value) {
        article.value = serverArticle.value;
      }
    }
  } catch (error) {
    loadingState.value = "加载失败，请刷新页面";

    // 如果 SSR 有数据，至少可以显示 SSR 内容作为降级方案
    if (serverArticle.value) {
      article.value = serverArticle.value;
    }
  }
};

// 代码块全屏（移动端伪横屏）：事件委托统一处理 .ssr-code-fullscreen 点击
// 设计要点：
// 1) 全屏蒙层 DOM 不在 SSR HTML 中——SSR 仅渲染按钮，蒙层运行时动态创建/销毁，避免增加 SSR 体积
// 2) 复用原代码块的 <code> innerHTML（含 hljs 高亮 + .ssr-code-line 行号占位结构），
//    全屏态由 base.css 的 .ssr-code-fs-pre 重设样式，无需重新计算高亮
// 3) "伪横屏"通过 CSS transform: rotate(90deg) 实现：
//    - 蒙层占满 viewport
//    - 内部 stage 宽=100dvh、高=100dvw、rotate 90 度后正好铺满
//    - 用 dvh/dvw 而非 vh/vw，规避 iOS Safari 地址栏弹回带来的视口抖动
// 4) 关闭路径：右上角 × / ESC 键 / 安卓返回键（通过 history.pushState + popstate 拦截）
// 5) 进入时锁 body 滚动；退出时一并还原：overflow、history、键盘监听、按钮焦点
const fullscreenState = {
  overlay: null as HTMLElement | null,
  prevBodyOverflow: "" as string,
  triggerBtn: null as HTMLElement | null,
  escHandler: null as ((e: KeyboardEvent) => void) | null,
  popstateHandler: null as ((e: PopStateEvent) => void) | null,
  pushedHistory: false,
};

const closeCodeFullscreen = () => {
  const s = fullscreenState;
  if (!s.overlay) return;
  s.overlay.remove();
  s.overlay = null;
  document.body.style.overflow = s.prevBodyOverflow;
  if (s.escHandler) {
    document.removeEventListener("keydown", s.escHandler);
    s.escHandler = null;
  }
  if (s.popstateHandler) {
    window.removeEventListener("popstate", s.popstateHandler);
    s.popstateHandler = null;
  }
  // 如果之前 push 了 history 但 popstate 没消费掉（用户点 × 关闭而非按返回键），需 back 一次平账
  if (s.pushedHistory) {
    s.pushedHistory = false;
    try {
      history.back();
    } catch {
      // 忽略
    }
  }
  // 焦点归还触发按钮，无障碍体验
  s.triggerBtn?.focus();
  s.triggerBtn = null;
};

const handleCodeFullscreenClick = (event: Event) => {
  const target = event.target as HTMLElement | null;
  if (!target) return;
  const btn = target.closest(
    ".ssr-code-fullscreen"
  ) as HTMLButtonElement | null;
  if (!btn) return;

  // 仅移动端响应（PC 端 CSS 已隐藏按钮，但 click 事件理论仍可触发——比如开发者工具调用）
  if (window.innerWidth > 576) return;

  const block = btn.closest(".ssr-code-block") as HTMLElement | null;
  if (!block) return;
  const codeEl = block.querySelector("pre code") as HTMLElement | null;
  if (!codeEl) return;

  const lang = block.getAttribute("data-lang") || "text";
  const lineCount = block.getAttribute("data-line-count") || "";
  const codeInnerHtml = codeEl.innerHTML;

  // 构建蒙层 DOM
  const overlay = document.createElement("div");
  overlay.className = "ssr-code-fs-overlay";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", `代码全屏查看 ${lang}`);
  overlay.innerHTML = `
    <div class="ssr-code-fs-stage">
      <div class="ssr-code-fs-head">
        <span class="ssr-code-fs-info">${lang}${
    lineCount ? ` · ${lineCount} 行` : ""
  }</span>
        <div class="ssr-code-fs-actions">
          <button class="ssr-code-fs-copy ssr-code-copy ssr-code-iconbtn" type="button" aria-label="复制代码" title="复制">
            <svg class="ssr-code-copy-icon ssr-code-copy-icon--default" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
              <path fill="currentColor" d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
            </svg>
            <svg class="ssr-code-copy-icon ssr-code-copy-icon--success" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
              <path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
            </svg>
            <svg class="ssr-code-copy-icon ssr-code-copy-icon--error" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
              <path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
          <button class="ssr-code-fs-close ssr-code-iconbtn" type="button" aria-label="退出全屏" title="关闭">
            <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
              <path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
        </div>
      </div>
      <pre class="ssr-code-fs-pre"><code class="hljs language-${lang}">${codeInnerHtml}</code></pre>
    </div>
  `;
  document.body.appendChild(overlay);

  // 锁 body 滚动
  fullscreenState.overlay = overlay;
  fullscreenState.prevBodyOverflow = document.body.style.overflow;
  fullscreenState.triggerBtn = btn;
  document.body.style.overflow = "hidden";

  // 关闭按钮
  overlay
    .querySelector(".ssr-code-fs-close")
    ?.addEventListener("click", closeCodeFullscreen);

  // ESC 关闭
  fullscreenState.escHandler = (e: KeyboardEvent) => {
    if (e.key === "Escape") closeCodeFullscreen();
  };
  document.addEventListener("keydown", fullscreenState.escHandler);

  // 安卓返回键关闭：push 一条 history，监听 popstate
  fullscreenState.popstateHandler = () => {
    fullscreenState.pushedHistory = false; // popstate 已经消费了我们 push 的那条
    closeCodeFullscreen();
  };
  try {
    history.pushState({ ssrCodeFullscreen: true }, "");
    fullscreenState.pushedHistory = true;
    window.addEventListener("popstate", fullscreenState.popstateHandler);
  } catch {
    // 某些环境可能限制 pushState，忽略即可
  }
};

// ============================================================
// 表格全屏（移动端伪横屏）：事件委托统一处理 .ssr-table-fs-btn 点击
// ------------------------------------------------------------
// 设计与代码块全屏完全对齐，差异仅在内容（克隆 <table> 而不是 <pre><code>）：
// 1) SSR 已经把按钮 DOM 直出（utils/markdown.ts 中 table_open 钩子），
//    客户端仅根据 wrap 是否真的横向溢出决定按钮可见性 —— 通过 ResizeObserver
//    给 wrap 加 data-overflow="true"，CSS 据此显示按钮，避免对小表格也暴露入口造成噪音。
// 2) 全屏蒙层 DOM 不在 SSR HTML 中，运行时动态创建/销毁，与代码块一致。
// 3) "伪横屏"复用代码块同款 transform: rotate(90deg) + 100dvh/100dvw 互换方案。
// 4) 关闭路径：右上角 × / ESC 键 / 安卓返回键（pushState + popstate 拦截），与代码块一致。
// 5) 进入时锁 body 滚动；退出还原。
// ============================================================
const tableFsState = {
  overlay: null as HTMLElement | null,
  prevBodyOverflow: "" as string,
  triggerBtn: null as HTMLElement | null,
  escHandler: null as ((e: KeyboardEvent) => void) | null,
  popstateHandler: null as ((e: PopStateEvent) => void) | null,
  pushedHistory: false,
};

const closeTableFullscreen = () => {
  const s = tableFsState;
  if (!s.overlay) return;
  s.overlay.remove();
  s.overlay = null;
  document.body.style.overflow = s.prevBodyOverflow;
  if (s.escHandler) {
    document.removeEventListener("keydown", s.escHandler);
    s.escHandler = null;
  }
  if (s.popstateHandler) {
    window.removeEventListener("popstate", s.popstateHandler);
    s.popstateHandler = null;
  }
  if (s.pushedHistory) {
    s.pushedHistory = false;
    try {
      history.back();
    } catch {
      // 忽略
    }
  }
  s.triggerBtn?.focus();
  s.triggerBtn = null;
};

const handleTableFullscreenClick = (event: Event) => {
  const target = event.target as HTMLElement | null;
  if (!target) return;
  const btn = target.closest(
    ".ssr-table-fs-btn"
  ) as HTMLButtonElement | null;
  if (!btn) return;

  // 仅移动端响应：CSS 已经隐藏 PC 按钮，这里再做一次防御
  if (window.innerWidth > 576) return;

  const wrap = btn.closest(".ssr-table-wrap") as HTMLElement | null;
  if (!wrap) return;
  const tableEl = wrap.querySelector("table") as HTMLTableElement | null;
  if (!tableEl) return;

  // 克隆 <table> 进入全屏蒙层；克隆能保留所有 inline style（包括 markdown-it 注入的
  // text-align 列对齐），同时与原 DOM 完全解耦，全屏关闭后不会影响原表格状态。
  const clonedTable = tableEl.cloneNode(true) as HTMLTableElement;

  const overlay = document.createElement("div");
  overlay.className = "ssr-table-fs-overlay";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", "表格全屏查看");
  overlay.innerHTML = `
    <div class="ssr-table-fs-stage">
      <div class="ssr-table-fs-head">
        <span class="ssr-table-fs-info">表格全屏</span>
        <div class="ssr-table-fs-actions">
          <button class="ssr-table-fs-close ssr-code-iconbtn" type="button" aria-label="退出全屏" title="关闭">
            <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
              <path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
        </div>
      </div>
      <div class="ssr-table-fs-body"></div>
    </div>
  `;
  const bodyEl = overlay.querySelector(".ssr-table-fs-body") as HTMLElement;
  bodyEl.appendChild(clonedTable);
  document.body.appendChild(overlay);

  tableFsState.overlay = overlay;
  tableFsState.prevBodyOverflow = document.body.style.overflow;
  tableFsState.triggerBtn = btn;
  document.body.style.overflow = "hidden";

  overlay
    .querySelector(".ssr-table-fs-close")
    ?.addEventListener("click", closeTableFullscreen);

  tableFsState.escHandler = (e: KeyboardEvent) => {
    if (e.key === "Escape") closeTableFullscreen();
  };
  document.addEventListener("keydown", tableFsState.escHandler);

  tableFsState.popstateHandler = () => {
    tableFsState.pushedHistory = false;
    closeTableFullscreen();
  };
  try {
    history.pushState({ ssrTableFullscreen: true }, "");
    tableFsState.pushedHistory = true;
    window.addEventListener("popstate", tableFsState.popstateHandler);
  } catch {
    // 某些环境可能限制 pushState，忽略即可
  }
};

// 表格 overflow 检测：用 ResizeObserver 监听所有 .ssr-table-wrap 的尺寸变化，
// 当 scrollWidth > clientWidth 时（表格自然宽度超过容器，需要横滚），
// 给 wrap 加 data-overflow="true"，CSS 据此显示全屏按钮。
// 这样小表格不会显示按钮，避免视觉噪音。
let tableOverflowObserver: ResizeObserver | null = null;
const observedTableWraps = new WeakSet<HTMLElement>();

const updateTableOverflowFlag = (wrap: HTMLElement) => {
  // 现在 wrap 自身不滚动，需要去内层 .ssr-table-scroll 上测溢出。
  // data-overflow 标记仍写在 wrap 上，因为按钮挂在 wrap，CSS 选择器基于 wrap。
  const scrollEl = wrap.querySelector<HTMLElement>(".ssr-table-scroll");
  if (!scrollEl) return;
  // 1px 容差：避免亚像素差异下来回 toggle
  if (scrollEl.scrollWidth - scrollEl.clientWidth > 1) {
    wrap.setAttribute("data-overflow", "true");
  } else {
    wrap.removeAttribute("data-overflow");
  }
};

const observeAllTableWraps = () => {
  if (typeof ResizeObserver === "undefined") return;
  if (!tableOverflowObserver) {
    tableOverflowObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        // ResizeObserver 监听的是 .ssr-table-scroll（内层滚动层），
        // 但更新 data-overflow 时要回到外层 wrap，按 DOM 关系反查。
        const scrollEl = entry.target as HTMLElement;
        const wrap = scrollEl.closest(".ssr-table-wrap") as HTMLElement | null;
        if (wrap) updateTableOverflowFlag(wrap);
      }
    });
  }
  const wraps = document.querySelectorAll<HTMLElement>(".ssr-table-wrap");
  wraps.forEach((wrap) => {
    if (observedTableWraps.has(wrap)) return;
    const scrollEl = wrap.querySelector<HTMLElement>(".ssr-table-scroll");
    if (!scrollEl) return;
    observedTableWraps.add(wrap);
    tableOverflowObserver?.observe(scrollEl);
    // 观察到时立即测一次，避免等到下一帧才显示按钮
    updateTableOverflowFlag(wrap);
  });
};


// 代码块复制按钮：事件委托统一处理 .ssr-code-block 内的 .ssr-code-copy 点击
// 设计要点：
// 1) 仅在 onMounted 时挂一次到 document，卸载时移除，避免每个代码块单独绑事件
// 2) 视觉状态切换走 [data-copy-state] 属性，CSS 通过属性选择器切显隐三个 SVG 图标
//    （default / success ✓ / error ×），不需要操作子节点文本
// 3) 复制策略：双 MIME（text/plain + text/html）
//    - text/plain：贴到 VSCode / 终端 / 文本框 → 纯代码，零干扰
//    - text/html：贴到飞书 / Notion / Word / Gmail → 完整带颜色的代码块（含背景）
//    目标应用按"语义最贴近的 MIME"自动选择，对老用户场景零影响、对富文本场景大幅改善
// 4) 浏览器降级链：ClipboardItem(双MIME) → writeText(纯文本) → execCommand(老浏览器)
const setCopyState = (
  btn: HTMLElement,
  state: "success" | "error" | null
) => {
  if (state) {
    btn.setAttribute("data-copy-state", state);
  } else {
    btn.removeAttribute("data-copy-state");
  }
};

const fallbackCopy = (text: string): boolean => {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  document.body.removeChild(textarea);
  return ok;
};

/**
 * 构造用于 text/html 写入剪贴板的 HTML 字符串。
 *
 * 设计：
 *  - 复用 codeEl 已经渲染好的 innerHTML（带 Shiki inline `style="color:#xxx"`）
 *  - ⚠ 关键：每行必须包成 <div> 而不是用 \n 分隔。原因：
 *    飞书 / 微信 / Notion / Word 这类富文本引擎在粘贴时会剥掉 <pre> 标签，
 *    随之 white-space: pre 也失效，原本承担换行语义的 \n 被 HTML 默认空白合并规则
 *    压成空格，整段代码就变成一行。
 *    用 <div>（块级元素）每行包一层后，即使外层 <pre> 被剥掉，<div> 仍保持块级换行语义，
 *    所有目标平台都能正确换行。
 *  - 空行兜底：空 <div> 在某些富文本引擎里会被丢弃，必须塞 <br> 或 &nbsp; 撑起来
 *  - 剥离零宽空格 \u200B（仅用于站点内行高兜底，对外部完全无意义）
 *  - 整体仍包一层 `<pre style="...">`：在尊重 <pre> 的目标（VSCode 文档预览、Markdown 编辑器）
 *    里能保留代码块视觉；在不尊重的目标（飞书等）里靠 <div> 兜底
 *  - 不带 `<code>` 内层：飞书会把 <pre><code> 同时存在解析为"行内 code 嵌入块级 pre"，
 *    导致内层颜色样式被外层 monospace 覆盖
 */
const buildHtmlForClipboard = (codeEl: HTMLElement, lang: string): string => {
  // 1) 拿到 Shiki 渲染产物的克隆，避免后续操作影响真实 DOM
  const cloned = codeEl.cloneNode(true) as HTMLElement;

  // 2) 把每行的零宽空格替换为空字符串
  cloned.querySelectorAll(".ssr-code-line").forEach((line) => {
    if (line.textContent === "\u200B") line.textContent = "";
  });

  // 3) 每行包一个 <div>，保证富文本引擎剥掉 <pre> 后仍然保留换行语义。
  //    每行 <div> inline 一份等宽字体声明——某些富文本引擎只保留行级元素的 style，
  //    会丢失外层 <pre> 的 font-family，不重复声明的话粘贴出来会变成默认无衬线字体。
  const lineStyle = [
    "font-family:SFMono-Regular,Consolas,'Liberation Mono',Menlo,monospace",
    "white-space:pre",
    "tab-size:4",
  ].join(";");
  const lineNodes = cloned.querySelectorAll(".ssr-code-line");
  const linesHtml = Array.from(lineNodes)
    .map((line) => {
      const inner = (line as HTMLElement).innerHTML;
      // 空行：飞书 / Notion 会把空 <div> 合并掉，必须塞 <br> 撑起一行
      const safeInner = inner.trim() === "" ? "<br>" : inner;
      return `<div style="${lineStyle}">${safeInner}</div>`;
    })
    .join("");

  // 4) 包一层 <pre>，在尊重 <pre> 的平台保留完整代码块视觉
  //    所有样式必须 inline——飞书/Notion 不会执行外部 CSS
  const preStyle = [
    "background:#24292e",
    "color:#e1e4e8",
    "padding:12px 14px",
    "border-radius:6px",
    "font-family:SFMono-Regular,Consolas,'Liberation Mono',Menlo,monospace",
    "font-size:14px",
    "line-height:1.55",
    "tab-size:4",
    "white-space:pre",
    "overflow-x:auto",
    "margin:0",
  ].join(";");

  // data-lang 留作富文本引擎可选识别（飞书/Notion 都不强求，但留无害）
  return `<pre data-lang="${lang}" style="${preStyle}">${linesHtml}</pre>`;
};

const handleCodeCopyClick = (event: Event) => {
  const target = event.target as HTMLElement | null;
  if (!target) return;
  const btn = target.closest(".ssr-code-copy") as HTMLButtonElement | null;
  if (!btn) return;

  // 兼容两种场景：① 普通文章内代码块 ② 全屏蒙层中的复制按钮
  // 优先找 .ssr-code-block（文章内）；找不到再退而求其次找 .ssr-code-fs-stage（全屏内）
  const container =
    btn.closest(".ssr-code-block") || btn.closest(".ssr-code-fs-stage");
  if (!container) return;
  const codeEl = container.querySelector("pre code") as HTMLElement | null;
  if (!codeEl) return;

  // text/plain：直接 textContent，行号在独立的 .ssr-code-gutter 列里、不会被读到。
  // 但 Shiki 空行兜底用了 \u200B 撑行高，要剥离掉避免终端 / 编辑器看到不可见字符。
  const plain = (codeEl.textContent || "").replace(/\u200B/g, "");

  // text/html：保留 Shiki 颜色高亮，包一层带主题背景的 <pre>
  const lang =
    (container as HTMLElement).getAttribute("data-lang") ||
    codeEl.className.match(/language-([\w-]+)/)?.[1] ||
    "text";
  const htmlPayload = buildHtmlForClipboard(codeEl, lang);

  const onSuccess = () => {
    setCopyState(btn, "success");
    window.setTimeout(() => setCopyState(btn, null), 1500);
  };
  const onError = () => {
    setCopyState(btn, "error");
    window.setTimeout(() => setCopyState(btn, null), 1500);
  };

  // 优先：双 MIME 写入（Chrome 76+ / Edge 79+ / Safari 13.1+ / Firefox 127+ 支持）
  // 注意：ClipboardItem 必须放在 user gesture 同步回调中调用——所以这里直接用 await/then，
  // 不要拆成异步函数中再处理（在 then 里再 new ClipboardItem 仍然处于 click 上下文中是允许的）
  if (
    typeof window !== "undefined" &&
    "ClipboardItem" in window &&
    navigator.clipboard &&
    navigator.clipboard.write
  ) {
    try {
      const item = new ClipboardItem({
        "text/plain": new Blob([plain], { type: "text/plain" }),
        "text/html": new Blob([htmlPayload], { type: "text/html" }),
      });
      navigator.clipboard.write([item]).then(onSuccess, () => {
        // 浏览器拒绝或权限失败 → 降级到纯文本写入
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(plain).then(onSuccess, () => {
            if (fallbackCopy(plain)) onSuccess();
            else onError();
          });
        } else if (fallbackCopy(plain)) {
          onSuccess();
        } else {
          onError();
        }
      });
      return;
    } catch {
      // ClipboardItem 构造失败（极少见）→ 降级
    }
  }

  // 不支持 ClipboardItem：退回到纯文本写入路径
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(plain).then(onSuccess, () => {
      if (fallbackCopy(plain)) onSuccess();
      else onError();
    });
  } else if (fallbackCopy(plain)) {
    onSuccess();
  } else {
    onError();
  }
};

// 代码块折叠按钮：事件委托统一处理 .ssr-code-toggle 点击
// 设计要点：
// 1) 折叠/展开仅切换 .ssr-code-block 的 data-collapsed 属性，所有视觉表现走 base.css
// 2) 按钮文案是 SSR 写死的——头部按钮永远是"收起"、浮动按钮永远是"展开全部 (N 行)"，
//    通过 base.css 的 attr selector 控制两枚按钮的显隐，handler 不需要改文案
// 3) 收起时把代码块顶部 scrollIntoView，避免"代码消失但视口位置没动"造成的视觉跳跃
//    （例：用户滚到代码块第 50 行点收起，如果不滚回顶部，视口里就只剩按钮、看起来像内容没了）
const handleCodeToggleClick = (event: Event) => {
  const target = event.target as HTMLElement | null;
  if (!target) return;
  const btn = target.closest(".ssr-code-toggle") as HTMLButtonElement | null;
  if (!btn) return;

  const block = btn.closest(".ssr-code-block") as HTMLElement | null;
  if (!block) return;

  const wasCollapsed = block.getAttribute("data-collapsed") === "true";
  const nextCollapsed = !wasCollapsed;
  block.setAttribute("data-collapsed", String(nextCollapsed));

  // 收起时把代码块顶部对齐视口，避免视觉跳跃
  if (nextCollapsed) {
    window.requestAnimationFrame(() => {
      const rect = block.getBoundingClientRect();
      // 只有当代码块顶部已经被滚出视口（rect.top < 0）才需要对齐
      if (rect.top < 0) {
        block.scrollIntoView({ behavior: "auto", block: "start" });
      }
    });
  }
};

// ============================================================
// Mermaid 全屏查看（带缩放/拖拽）
// ------------------------------------------------------------
// 解决"复杂图表在文章里看不清"的问题。设计要点：
// 1) 蒙层动态创建，不进 SSR HTML，节省体积；
// 2) 内容来源：直接 cloneNode 当前 .mermaid-block 里渲染好的 svg，
//    不重新调用 mermaid.render —— 既快、又能保证全屏内容与文章里一致；
// 3) 缩放：scale 状态变量，组合了三种交互：
//    - 顶部 + / - / 重置 按钮（PC 主用）
//    - 鼠标滚轮（PC 进阶）
//    - 双指 pinch（移动端主用）
// 4) 平移：mousedown / touchstart 起步，记录 startX/Y + 初始 translate，
//    move 时累加偏移，up/end 解除监听；
// 5) 关闭路径：右上角 × / ESC / 安卓返回键（与代码块全屏蒙层共用同一套思路）；
// 6) 缩放原点：通过 transform-origin: 0 0 配合手动计算的 translate 调整，
//    保证以"光标/双指中点"为锚点，不会"放大了又跑偏"。
// ============================================================
const mermaidFsState = {
  overlay: null as HTMLElement | null,
  prevBodyOverflow: "" as string,
  triggerBtn: null as HTMLElement | null,
  escHandler: null as ((e: KeyboardEvent) => void) | null,
  popstateHandler: null as ((e: PopStateEvent) => void) | null,
  pushedHistory: false,
  // 变换状态
  scale: 1,
  tx: 0,
  ty: 0,
  // pinch 起始两指距离与起始 scale
  pinchStartDist: 0,
  pinchStartScale: 1,
};

const closeMermaidFullscreen = () => {
  const s = mermaidFsState;
  if (!s.overlay) return;
  s.overlay.remove();
  s.overlay = null;
  document.body.style.overflow = s.prevBodyOverflow;
  if (s.escHandler) {
    document.removeEventListener("keydown", s.escHandler);
    s.escHandler = null;
  }
  if (s.popstateHandler) {
    window.removeEventListener("popstate", s.popstateHandler);
    s.popstateHandler = null;
  }
  if (s.pushedHistory) {
    s.pushedHistory = false;
    try {
      history.back();
    } catch {
      // 忽略
    }
  }
  s.triggerBtn?.focus();
  s.triggerBtn = null;
};

const handleMermaidFullscreenClick = (event: Event) => {
  const target = event.target as HTMLElement | null;
  if (!target) return;
  const btn = target.closest(
    ".mermaid-fullscreen-btn"
  ) as HTMLButtonElement | null;
  if (!btn) return;

  const block = btn.closest(".mermaid-block") as HTMLElement | null;
  if (!block) return;

  // 取出已经渲染好的 svg；如果尚未渲染（极端竞态：用户在首屏 idle 渲染前就点了按钮），
  // 直接 fallback 到展示源码。
  // ⚠ 必须 scope 到 .mermaid-content 内查询，不能直接 block.querySelector("svg")——
  // 因为 block 里同时存在两个 svg：
  //   1) .mermaid-fullscreen-btn 内的"全屏按钮 icon"SVG（DOM 顺序在前）
  //   2) .mermaid-content 内真正的 mermaid 图表 SVG
  // 不限定 scope 会命中第一个（即按钮 icon），导致全屏蒙层里只显示一个被放大的全屏图标。
  const contentEl = block.querySelector(".mermaid-content");
  const svgEl = contentEl
    ? (contentEl.querySelector("svg") as SVGElement | null)
    : null;
  const sourceEl = (contentEl || block).querySelector(".mermaid-source");

  const overlay = document.createElement("div");
  overlay.className = "mermaid-fs-overlay";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", "图表全屏查看");

  // 工具栏：缩小 / 重置 / 放大 / 关闭，全部 icon 按钮，与代码块全屏风格一致
  overlay.innerHTML = `
    <div class="mermaid-fs-toolbar">
      <button class="mermaid-fs-btn" data-action="zoom-out" type="button" aria-label="缩小" title="缩小">
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <path fill="currentColor" d="M19 13H5v-2h14v2z"/>
        </svg>
      </button>
      <span class="mermaid-fs-scale" aria-live="polite">100%</span>
      <button class="mermaid-fs-btn" data-action="reset" type="button" aria-label="重置" title="重置缩放">
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <path fill="currentColor" d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/>
        </svg>
      </button>
      <button class="mermaid-fs-btn" data-action="zoom-in" type="button" aria-label="放大" title="放大">
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
        </svg>
      </button>
      <button class="mermaid-fs-btn mermaid-fs-close" data-action="close" type="button" aria-label="关闭" title="关闭">
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
        </svg>
      </button>
    </div>
    <div class="mermaid-fs-stage">
      <div class="mermaid-fs-canvas"></div>
    </div>
    <div class="mermaid-fs-tip">滚轮 / 双指缩放 · 拖拽平移</div>
  `;

  const canvas = overlay.querySelector(".mermaid-fs-canvas") as HTMLElement;
  const stage = overlay.querySelector(".mermaid-fs-stage") as HTMLElement;
  const scaleLabel = overlay.querySelector(
    ".mermaid-fs-scale"
  ) as HTMLElement;

  // 把图表放进 canvas
  if (svgEl) {
    // 关键：在 clone 之前先读取原 svg 在文章里的实际渲染尺寸。
    // 因为：
    // 1) mermaid 输出的 svg 常带 style="max-width: ...px"，但不一定带显式 width/height attribute；
    // 2) 我们的 .mermaid-fs-canvas 是 position: absolute + top:0/left:0，没有显式尺寸；
    //    absolute 元素在内容没有内禀尺寸时会"shrink-to-fit"塌陷到 0×0；
    // 3) 因此必须把 svg 的实际像素宽高显式写进去，让 canvas 能收缩包裹出正确尺寸，
    //    否则 svg 会显示成 0×0、完全看不见——这就是用户反馈的 bug 现象。
    const origRect = svgEl.getBoundingClientRect();
    const baseW = origRect.width || 600; // 兜底：svg 已经被滚出视口或刚渲染完时 rect 可能为 0
    const baseH = origRect.height || 400;

    const cloned = svgEl.cloneNode(true) as SVGElement;
    // 清掉可能限制 svg 自然展开的 max-* 约束
    cloned.style.maxWidth = "none";
    cloned.style.maxHeight = "none";
    // 显式给出像素尺寸：让 canvas 撑出明确盒模型，缩放体验也从"现在看到的大小"出发
    cloned.style.width = `${baseW}px`;
    cloned.style.height = `${baseH}px`;
    // svg 的 width/height attribute 保留 viewBox 自身的尺寸即可，
    // 不去 removeAttribute 防止 viewBox 缺失时丢掉绘图基准
    cloned.setAttribute("width", String(baseW));
    cloned.setAttribute("height", String(baseH));
    canvas.appendChild(cloned);
  } else if (sourceEl) {
    const pre = document.createElement("pre");
    pre.className = "mermaid-source";
    pre.textContent = sourceEl.textContent || "";
    canvas.appendChild(pre);
  }

  document.body.appendChild(overlay);

  // 初始化变换状态
  const s = mermaidFsState;
  s.scale = 1;
  s.tx = 0;
  s.ty = 0;
  s.overlay = overlay;
  s.prevBodyOverflow = document.body.style.overflow;
  s.triggerBtn = btn;
  document.body.style.overflow = "hidden";

  const MIN_SCALE = 0.2;
  const MAX_SCALE = 6;
  const applyTransform = () => {
    canvas.style.transform = `translate(${s.tx}px, ${s.ty}px) scale(${s.scale})`;
    scaleLabel.textContent = `${Math.round(s.scale * 100)}%`;
  };

  // 以"舞台中某点"为锚点缩放：保证锚点在屏幕坐标不动
  // 推导：屏幕坐标 P = T + S * P_local；要保证缩放前后 P 不变，
  // T_new = P - S_new * P_local = P - (S_new / S_old) * (P - T_old)
  const zoomAtPoint = (
    pointX: number,
    pointY: number,
    nextScale: number
  ) => {
    const clamped = Math.max(MIN_SCALE, Math.min(MAX_SCALE, nextScale));
    const ratio = clamped / s.scale;
    const rect = stage.getBoundingClientRect();
    const localX = pointX - rect.left;
    const localY = pointY - rect.top;
    s.tx = localX - ratio * (localX - s.tx);
    s.ty = localY - ratio * (localY - s.ty);
    s.scale = clamped;
    applyTransform();
  };

  applyTransform();

  // 把 canvas 中心对齐到 stage 中心。
  // 抽成函数是因为：① 初始挂载需要居中；② reset 按钮也需要复用同一套逻辑，
  // 不能简单 tx=0/ty=0——那只是把 canvas 左上角钉在 stage 左上角，svg 会跑到左上角而非正中。
  // 必须在 layout 完成后才能 getBoundingClientRect，所以包一层 rAF。
  const centerCanvas = () => {
    requestAnimationFrame(() => {
      const stageRect = stage.getBoundingClientRect();
      const canvasRect = canvas.getBoundingClientRect();
      // 偏移增量 = stage 中心 − canvas 当前中心
      // 注意是 += 而非 =，因为 canvas 当前已经按 (s.tx, s.ty, s.scale) 变换过，
      // canvasRect 反映的是变换后的位置；只需在此基础上再补一个 delta 即可对齐
      s.tx +=
        stageRect.left +
        stageRect.width / 2 -
        (canvasRect.left + canvasRect.width / 2);
      s.ty +=
        stageRect.top +
        stageRect.height / 2 -
        (canvasRect.top + canvasRect.height / 2);
      applyTransform();
    });
  };

  // 初始居中
  centerCanvas();

  // 工具栏按钮（事件代理在 overlay 内部，关闭时随 overlay 一起销毁，无需手动解绑）
  overlay.addEventListener("click", (e) => {
    const t = (e.target as HTMLElement).closest(
      ".mermaid-fs-btn"
    ) as HTMLButtonElement | null;
    if (!t) return;
    const action = t.getAttribute("data-action");
    const rect = stage.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    if (action === "zoom-in") {
      zoomAtPoint(cx, cy, s.scale * 1.25);
    } else if (action === "zoom-out") {
      zoomAtPoint(cx, cy, s.scale / 1.25);
    } else if (action === "reset") {
      // 重置：scale 回到 1，再走一次居中（不能简单 tx=0/ty=0，
      // 那是 canvas 左上角对齐 stage 左上角，会让 svg 跑到左上角）
      s.scale = 1;
      s.tx = 0;
      s.ty = 0;
      applyTransform();
      centerCanvas();
    } else if (action === "close") {
      closeMermaidFullscreen();
    }
  });

  // 鼠标滚轮缩放（PC）
  // 注意：必须 preventDefault 阻止页面整体滚动；passive: false 才能 preventDefault
  stage.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      // deltaY > 0 → 向下滚 → 缩小；反之放大。比例 1.1 较温和
      const factor = e.deltaY > 0 ? 1 / 1.1 : 1.1;
      zoomAtPoint(e.clientX, e.clientY, s.scale * factor);
    },
    { passive: false }
  );

  // 鼠标拖拽平移（PC）
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  stage.addEventListener("mousedown", (e) => {
    // 只响应左键
    if (e.button !== 0) return;
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    stage.style.cursor = "grabbing";
  });
  const onMouseMove = (e: MouseEvent) => {
    if (!dragging) return;
    s.tx += e.clientX - lastX;
    s.ty += e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    applyTransform();
  };
  const onMouseUp = () => {
    dragging = false;
    stage.style.cursor = "";
  };
  document.addEventListener("mousemove", onMouseMove);
  document.addEventListener("mouseup", onMouseUp);

  // 触屏交互（移动端）：单指拖拽 / 双指 pinch 缩放
  let touchMode: "none" | "drag" | "pinch" = "none";
  let touchStartX = 0;
  let touchStartY = 0;
  stage.addEventListener(
    "touchstart",
    (e) => {
      if (e.touches.length === 1) {
        touchMode = "drag";
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
      } else if (e.touches.length === 2) {
        touchMode = "pinch";
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        s.pinchStartDist = Math.hypot(dx, dy);
        s.pinchStartScale = s.scale;
      }
    },
    { passive: false }
  );
  stage.addEventListener(
    "touchmove",
    (e) => {
      if (touchMode === "drag" && e.touches.length === 1) {
        e.preventDefault();
        const t = e.touches[0];
        s.tx += t.clientX - touchStartX;
        s.ty += t.clientY - touchStartY;
        touchStartX = t.clientX;
        touchStartY = t.clientY;
        applyTransform();
      } else if (touchMode === "pinch" && e.touches.length === 2) {
        e.preventDefault();
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.hypot(dx, dy);
        if (s.pinchStartDist === 0) return;
        const nextScale =
          (s.pinchStartScale * dist) / s.pinchStartDist;
        const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        zoomAtPoint(cx, cy, nextScale);
      }
    },
    { passive: false }
  );
  stage.addEventListener("touchend", (e) => {
    if (e.touches.length === 0) {
      touchMode = "none";
    } else if (e.touches.length === 1) {
      touchMode = "drag";
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    }
  });

  // 在 overlay remove 时统一清理 document 级监听
  // 用 MutationObserver 监控 overlay 是否被移除（closeMermaidFullscreen 会调用 .remove()）
  const cleanup = () => {
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
  };
  const mo = new MutationObserver(() => {
    if (!document.body.contains(overlay)) {
      cleanup();
      mo.disconnect();
    }
  });
  mo.observe(document.body, { childList: true });

  // ESC 关闭
  s.escHandler = (e: KeyboardEvent) => {
    if (e.key === "Escape") closeMermaidFullscreen();
  };
  document.addEventListener("keydown", s.escHandler);

  // 安卓返回键关闭
  s.popstateHandler = () => {
    s.pushedHistory = false;
    closeMermaidFullscreen();
  };
  try {
    history.pushState({ mermaidFullscreen: true }, "");
    s.pushedHistory = true;
    window.addEventListener("popstate", s.popstateHandler);
  } catch {
    // 忽略
  }
};

// ============================================================
// 图片全屏查看（点击文章图片放大、缩放、平移、相册式前后切换）
// ------------------------------------------------------------
// 设计：复用 mermaid 全屏的"舞台 + canvas + 工具栏"骨架，
// 数据源由 cloneNode(svg) 改为新建 <img>，其余缩放/平移/关闭路径一致。
// 触发条件：点击 .article-img-zoomable（仅正文 markdown 图片，避免误伤头像/icon）。
// 初始呈现：contain 适配视口，centerCanvas 居中（小图也能看清）。
//
// 图集模式：进入全屏时一次性收集所有 .article-img-zoomable，
// 记录当前 index，提供左右箭头按钮 + 键盘 ←/→ 在前后图片间切换。
// 切换图片时：
//   1) 重置 transform（scale=1, tx=0, ty=0）→ 否则上一张缩放后的状态会带到新图；
//   2) 通过预创建好的 imgEl.src = newSrc 复用同一个 <img> 节点（减少 DOM 抖动）；
//   3) 等新图 load 后再调用 fitContain（缓存命中时 img.complete 已 true，需走 rAF 兜底）。
// 单张图片时左右按钮 + 计数器自动隐藏，UI 更干净。
// ============================================================
const imageFsState = {
  overlay: null as HTMLElement | null,
  prevBodyOverflow: "" as string,
  triggerImg: null as HTMLImageElement | null,
  escHandler: null as ((e: KeyboardEvent) => void) | null,
  popstateHandler: null as ((e: PopStateEvent) => void) | null,
  pushedHistory: false,
  scale: 1,
  tx: 0,
  ty: 0,
  pinchStartDist: 0,
  pinchStartScale: 1,
};

const closeImageFullscreen = () => {
  const s = imageFsState;
  if (!s.overlay) return;
  s.overlay.remove();
  s.overlay = null;
  document.body.style.overflow = s.prevBodyOverflow;
  if (s.escHandler) {
    document.removeEventListener("keydown", s.escHandler);
    s.escHandler = null;
  }
  if (s.popstateHandler) {
    window.removeEventListener("popstate", s.popstateHandler);
    s.popstateHandler = null;
  }
  if (s.pushedHistory) {
    s.pushedHistory = false;
    try {
      history.back();
    } catch {
      // 忽略
    }
  }
  s.triggerImg?.focus?.();
  s.triggerImg = null;
};

const handleImageClick = (event: Event) => {
  const target = event.target as HTMLElement | null;
  if (!target) return;
  // 严格匹配：必须命中 .article-img-zoomable，避免误中头像、icon
  if (!(target instanceof HTMLImageElement)) return;
  if (!target.classList.contains("article-img-zoomable")) return;
  // 已在全屏态时忽略二次点击
  if (imageFsState.overlay) return;

  const triggerImg = target;

  // 收集文章里所有可放大图片，组成图集；DOM 顺序就是文章里的展示顺序，符合阅读直觉。
  // 用 currentSrc 解析 srcset 后的真实资源地址，alt 用于无障碍。
  const allImgs = Array.from(
    document.querySelectorAll<HTMLImageElement>(
      ".article-body-ssr .article-img-zoomable"
    )
  );
  const gallery = allImgs.map((el) => ({
    src: el.currentSrc || el.src,
    alt: el.alt || "",
  }));
  let index = allImgs.indexOf(triggerImg);
  if (index < 0) index = 0;
  const total = gallery.length;
  if (total === 0) return;

  const overlay = document.createElement("div");
  overlay.className = "image-fs-overlay";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", "图片全屏查看");

  // 工具栏：左右箭头 + 计数器集中放左侧，缩放/关闭放右侧。
  // 单张时左右按钮和计数器加 .is-single 隐藏，避免空 UI。
  const isSingle = total <= 1;
  overlay.innerHTML = `
    <div class="image-fs-toolbar${isSingle ? ' is-single' : ''}">
      <button class="image-fs-btn image-fs-prev" data-action="prev" type="button" aria-label="上一张" title="上一张 (←)">
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <path fill="currentColor" d="M15.41 16.59L10.83 12l4.58-4.59L14 6l-6 6 6 6 1.41-1.41z"/>
        </svg>
      </button>
      <span class="image-fs-counter" aria-live="polite">${index + 1} / ${total}</span>
      <button class="image-fs-btn image-fs-next" data-action="next" type="button" aria-label="下一张" title="下一张 (→)">
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <path fill="currentColor" d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/>
        </svg>
      </button>
      <span class="image-fs-spacer"></span>
      <button class="image-fs-btn" data-action="zoom-out" type="button" aria-label="缩小" title="缩小">
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <path fill="currentColor" d="M19 13H5v-2h14v2z"/>
        </svg>
      </button>
      <span class="image-fs-scale" aria-live="polite">100%</span>
      <button class="image-fs-btn" data-action="reset" type="button" aria-label="重置" title="重置缩放">
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <path fill="currentColor" d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/>
        </svg>
      </button>
      <button class="image-fs-btn" data-action="zoom-in" type="button" aria-label="放大" title="放大">
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
        </svg>
      </button>
      <button class="image-fs-btn image-fs-close" data-action="close" type="button" aria-label="关闭" title="关闭">
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
        </svg>
      </button>
    </div>
    <div class="image-fs-stage">
      <button class="image-fs-edge image-fs-edge--prev${isSingle ? ' is-hidden' : ''}" data-action="prev" type="button" aria-label="上一张">
        <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
          <path fill="currentColor" d="M15.41 16.59L10.83 12l4.58-4.59L14 6l-6 6 6 6 1.41-1.41z"/>
        </svg>
      </button>
      <div class="image-fs-canvas"></div>
      <button class="image-fs-edge image-fs-edge--next${isSingle ? ' is-hidden' : ''}" data-action="next" type="button" aria-label="下一张">
        <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
          <path fill="currentColor" d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/>
        </svg>
      </button>
    </div>
    <div class="image-fs-tip">滚轮 / 双指缩放 · 拖拽平移${isSingle ? '' : ' · ←/→ 切换'}</div>
  `;

  const canvas = overlay.querySelector(".image-fs-canvas") as HTMLElement;
  const stage = overlay.querySelector(".image-fs-stage") as HTMLElement;
  const scaleLabel = overlay.querySelector(".image-fs-scale") as HTMLElement;
  const counterEl = overlay.querySelector(
    ".image-fs-counter"
  ) as HTMLElement | null;
  const prevBtns = overlay.querySelectorAll<HTMLButtonElement>(
    "[data-action='prev']"
  );
  const nextBtns = overlay.querySelectorAll<HTMLButtonElement>(
    "[data-action='next']"
  );

  // 复用同一个 <img> 节点：切换图片时只换 src，DOM 节点不重建——
  // 这样 transform 状态 reset 与 load 监听都更可控。
  const img = new Image();
  img.draggable = false;
  img.className = "image-fs-img";
  canvas.appendChild(img);

  document.body.appendChild(overlay);

  const s = imageFsState;
  s.scale = 1;
  s.tx = 0;
  s.ty = 0;
  s.overlay = overlay;
  s.prevBodyOverflow = document.body.style.overflow;
  s.triggerImg = triggerImg;
  document.body.style.overflow = "hidden";

  const MIN_SCALE = 0.2;
  const MAX_SCALE = 8;
  const applyTransform = () => {
    canvas.style.transform = `translate(${s.tx}px, ${s.ty}px) scale(${s.scale})`;
    scaleLabel.textContent = `${Math.round(s.scale * 100)}%`;
  };
  const zoomAtPoint = (
    pointX: number,
    pointY: number,
    nextScale: number
  ) => {
    const clamped = Math.max(MIN_SCALE, Math.min(MAX_SCALE, nextScale));
    const ratio = clamped / s.scale;
    const rect = stage.getBoundingClientRect();
    const localX = pointX - rect.left;
    const localY = pointY - rect.top;
    s.tx = localX - ratio * (localX - s.tx);
    s.ty = localY - ratio * (localY - s.ty);
    s.scale = clamped;
    applyTransform();
  };

  // 适配视口：根据图片自然宽高与 stage 尺寸算 contain 比例。
  // 必须等图片 decode 完成才有 naturalWidth/Height；如果是缓存图片可能已 complete。
  // ⚠ 关键：tx/ty 居中量必须和 scale 一起一次性算出，不能"先 applyTransform 再 rAF 补 delta"——
  // 那种两步法会让图片先在 stage 左上角显示一帧再跳到中央，
  // 在快速切换图片时表现为"左上角闪一下"。
  // 几何推导：canvas 用 transform-origin: 0 0 + translate(tx, ty) scale(s)，
  // 所以渲染盒子 = [tx, ty, tx + naturalW*s, ty + naturalH*s]。
  // 要让 canvas 中心对齐 stage 中心：
  //   tx = (stageW - naturalW * s) / 2
  //   ty = (stageH - naturalH * s) / 2
  const fitContain = () => {
    const stageRect = stage.getBoundingClientRect();
    const naturalW = img.naturalWidth || img.width || 0;
    const naturalH = img.naturalHeight || img.height || 0;
    if (!naturalW || !naturalH) return;
    img.style.width = `${naturalW}px`;
    img.style.height = `${naturalH}px`;
    const fitRatio = Math.min(
      (stageRect.width * 0.95) / naturalW,
      (stageRect.height * 0.95) / naturalH,
      1 // 不上采样，小图保持原始 1:1，避免糊
    );
    s.scale = fitRatio;
    s.tx = (stageRect.width - naturalW * fitRatio) / 2;
    s.ty = (stageRect.height - naturalH * fitRatio) / 2;
    applyTransform();
  };

  // 加载第 i 张：用 once load 监听确保切图后才 fitContain；
  // 缓存图片可能瞬间 complete，需走 rAF 兜底（监听不会触发）。
  const loadIndex = (i: number) => {
    if (i < 0 || i >= total) return;
    index = i;
    const item = gallery[i];
    img.alt = item.alt;
    if (counterEl) counterEl.textContent = `${i + 1} / ${total}`;
    // 重置变换：上一张如果被缩放过，不能带状态进新图
    s.scale = 1;
    s.tx = 0;
    s.ty = 0;
    img.style.width = "0px";
    img.style.height = "0px";
    applyTransform();
    overlay.classList.add("is-loading");

    const onLoaded = () => {
      overlay.classList.remove("is-loading");
      fitContain();
    };
    if (img.src === item.src && img.complete && img.naturalWidth) {
      // 同一张图片重新触发（理论上不会发生，做个兜底）
      requestAnimationFrame(onLoaded);
      return;
    }
    img.onload = onLoaded;
    img.onerror = () => {
      overlay.classList.remove("is-loading");
    };
    img.src = item.src;
    // 缓存图片：设置 src 后 complete 立刻为 true，此时 onload 不会再触发，
    // 用 rAF 兜底保证仍能跑 fitContain。
    if (img.complete && img.naturalWidth) {
      requestAnimationFrame(onLoaded);
    }
  };

  const goPrev = () => {
    if (total <= 1) return;
    loadIndex((index - 1 + total) % total);
  };
  const goNext = () => {
    if (total <= 1) return;
    loadIndex((index + 1) % total);
  };

  // 首次加载当前图
  loadIndex(index);

  overlay.addEventListener("click", (e) => {
    const t = (e.target as HTMLElement).closest(
      "[data-action]"
    ) as HTMLButtonElement | null;
    if (t) {
      const action = t.getAttribute("data-action");
      const rect = stage.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      if (action === "zoom-in") {
        zoomAtPoint(cx, cy, s.scale * 1.25);
      } else if (action === "zoom-out") {
        zoomAtPoint(cx, cy, s.scale / 1.25);
      } else if (action === "reset") {
        fitContain();
      } else if (action === "prev") {
        goPrev();
      } else if (action === "next") {
        goNext();
      } else if (action === "close") {
        closeImageFullscreen();
      }
      e.stopPropagation();
      return;
    }
    // 点击蒙层空白处（不是 stage 内的图片或工具栏）也关闭
    if (e.target === overlay) {
      closeImageFullscreen();
    }
  });

  // 鼠标滚轮缩放
  stage.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 1 / 1.1 : 1.1;
      zoomAtPoint(e.clientX, e.clientY, s.scale * factor);
    },
    { passive: false }
  );

  // 鼠标拖拽
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  stage.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    // 边缘按钮上 mousedown 不进入拖拽（避免点箭头误触拖拽）
    if ((e.target as HTMLElement).closest(".image-fs-edge")) return;
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    stage.style.cursor = "grabbing";
  });
  const onMouseMove = (e: MouseEvent) => {
    if (!dragging) return;
    s.tx += e.clientX - lastX;
    s.ty += e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    applyTransform();
  };
  const onMouseUp = () => {
    dragging = false;
    stage.style.cursor = "";
  };
  document.addEventListener("mousemove", onMouseMove);
  document.addEventListener("mouseup", onMouseUp);

  // 触屏：单指拖拽 / 双指 pinch
  let touchMode: "none" | "drag" | "pinch" = "none";
  let touchStartX = 0;
  let touchStartY = 0;
  stage.addEventListener(
    "touchstart",
    (e) => {
      if (e.touches.length === 1) {
        touchMode = "drag";
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
      } else if (e.touches.length === 2) {
        touchMode = "pinch";
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        s.pinchStartDist = Math.hypot(dx, dy);
        s.pinchStartScale = s.scale;
      }
    },
    { passive: false }
  );
  stage.addEventListener(
    "touchmove",
    (e) => {
      if (touchMode === "drag" && e.touches.length === 1) {
        e.preventDefault();
        const t = e.touches[0];
        s.tx += t.clientX - touchStartX;
        s.ty += t.clientY - touchStartY;
        touchStartX = t.clientX;
        touchStartY = t.clientY;
        applyTransform();
      } else if (touchMode === "pinch" && e.touches.length === 2) {
        e.preventDefault();
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.hypot(dx, dy);
        if (s.pinchStartDist === 0) return;
        const nextScale =
          (s.pinchStartScale * dist) / s.pinchStartDist;
        const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        zoomAtPoint(cx, cy, nextScale);
      }
    },
    { passive: false }
  );
  stage.addEventListener("touchend", (e) => {
    if (e.touches.length === 0) {
      touchMode = "none";
    } else if (e.touches.length === 1) {
      touchMode = "drag";
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    }
  });

  const cleanup = () => {
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
  };
  const mo = new MutationObserver(() => {
    if (!document.body.contains(overlay)) {
      cleanup();
      mo.disconnect();
    }
  });
  mo.observe(document.body, { childList: true });

  // 键盘：ESC 关闭，←/→ 切换图片
  s.escHandler = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      closeImageFullscreen();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      goPrev();
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      goNext();
    }
  };
  document.addEventListener("keydown", s.escHandler);

  s.popstateHandler = () => {
    s.pushedHistory = false;
    closeImageFullscreen();
  };
  try {
    history.pushState({ imageFullscreen: true }, "");
    s.pushedHistory = true;
    window.addEventListener("popstate", s.popstateHandler);
  } catch {
    // 忽略
  }
  // 标记 prev/next 引用使用，避免编译器报"未使用"警告（实际通过 data-action 委托触发）
  void prevBtns;
  void nextBtns;
};

// ============================================================
// Mermaid 客户端渲染
// ------------------------------------------------------------
// SSR 阶段把 ```mermaid``` 代码块输出为：
//   <div class="mermaid-block" data-mermaid-rendered="false">
//     <pre class="mermaid-source">原始源码</pre>
//   </div>
// 客户端要做的：
// 1) 动态 import('mermaid')，避免给非数学/图表页面也加载这个 ~700KB 的库
// 2) 找到所有未渲染的 .mermaid-block，调用 mermaid.render(id, source) 拿到 svg
// 3) 把 .mermaid-source 替换为 svg，并打 data-mermaid-rendered="true" 防止重复渲染
// 路由切换时（同一组件实例），watch route 后会重新调用一次，覆盖新文章里的 mermaid 块。
// ============================================================
let mermaidLib: typeof import("mermaid").default | null = null;
let mermaidIdCounter = 0;
const renderMermaidBlocks = async () => {
  if (typeof document === "undefined") return;
  const blocks = document.querySelectorAll<HTMLDivElement>(
    '.mermaid-block[data-mermaid-rendered="false"]'
  );
  if (blocks.length === 0) return;

  if (!mermaidLib) {
    try {
      const mod = await import("mermaid");
      mermaidLib = mod.default;
      mermaidLib.initialize({
        startOnLoad: false,
        theme: "default",
        // 一些常用图表的安全开关
        securityLevel: "loose",
        flowchart: { htmlLabels: true, curve: "basis" },
      });
    } catch (err) {
      console.error("[mermaid] 加载失败", err);
      return;
    }
  }

  for (const block of Array.from(blocks)) {
    // 渲染目标：内层 .mermaid-content；写到内层而不是 block 自身，
    // 是为了保留外层右上角的"全屏按钮"——SSR 已经把它渲染好了，
    // 客户端只负责把 svg 填进容器，按钮永远在原位，事件委托一次挂载即可。
    const content = block.querySelector(".mermaid-content") as HTMLElement | null;
    const target = content || block;
    const source = target.querySelector(".mermaid-source")?.textContent || "";
    if (!source.trim()) {
      block.setAttribute("data-mermaid-rendered", "true");
      continue;
    }
    const id = `mermaid-${Date.now()}-${mermaidIdCounter++}`;
    try {
      const { svg } = await mermaidLib.render(id, source);
      target.innerHTML = svg;
      block.setAttribute("data-mermaid-rendered", "true");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      target.innerHTML = `<pre class="mermaid-error">[Mermaid 渲染失败] ${msg}\n\n${source.replace(/[<&]/g, (c) => (c === "<" ? "&lt;" : "&amp;"))}</pre>`;
      block.setAttribute("data-mermaid-rendered", "true");
    }
  }
};

// 确保客户端激活时初始化数据
// 优化：使用 requestIdleCallback 延迟非关键操作，减少TBT
onMounted(() => {
  if (import.meta.client) {
    // SSR 已经把正文直出到页面，客户端只在"SSR 没有拿到内容"时兜底拉取，
    // 不会再做任何客户端二次渲染来替换 DOM，避免样式抖动与 hydration mismatch。
    if (!article.value || !article.value.renderedHtml) {
      initArticleContent();
    }

    // 代码块复制按钮：通过事件委托一次性挂载到 document.body，
    // 避免每个 .ssr-code-block 单独绑事件；点击后从对应 <pre><code> 读 textContent，
    // 再写入剪贴板。优先用 navigator.clipboard，回落到 execCommand。
    document.addEventListener("click", handleCodeCopyClick);
    // 代码块折叠按钮：同样事件委托
    document.addEventListener("click", handleCodeToggleClick);
    // 代码块全屏按钮：同样事件委托（仅移动端响应）
    document.addEventListener("click", handleCodeFullscreenClick);
    // 表格全屏按钮：同样事件委托（仅移动端响应）
    document.addEventListener("click", handleTableFullscreenClick);
    // Mermaid 图表全屏按钮：事件委托，PC + 移动端都响应
    document.addEventListener("click", handleMermaidFullscreenClick);
    // 文章图片点击全屏：事件委托
    document.addEventListener("click", handleImageClick);

    // 首屏激活：把 SSR 输出的 .mermaid-block 占位 div 渲染成 svg。
    // 放到 nextTick 之后等水合完成，避免与 Vue 的水合写 DOM 抢同一帧。
    // requestIdleCallback 兜底降级 setTimeout，确保非关键路径不阻塞 LCP。
    const triggerMermaid = () => {
      void renderMermaidBlocks();
    };
    if (typeof window.requestIdleCallback === "function") {
      window.requestIdleCallback(triggerMermaid, { timeout: 1500 });
    } else {
      setTimeout(triggerMermaid, 0);
    }

    // 表格 overflow 检测：首屏挂上 ResizeObserver，仅在表格自然宽度超过容器时
    // 给 wrap 加 data-overflow="true"，从而显示全屏按钮。
    // 等 nextTick 确保 v-html 已把 SSR HTML 注入 DOM。
    void nextTick().then(() => observeAllTableWraps());

    // 浏览量打点：onMounted 后延迟 1500ms 触发（避开 prerender / 误触）。
    // 详细设计见上方 ==================== 浏览量打点 ==================== 段。
    if (articleId.value) {
      scheduleViewLog(articleId.value);
    }
  }
});

// 组件卸载时清理数据
onBeforeUnmount(() => {
  if (import.meta.client) {
    document.removeEventListener("click", handleCodeCopyClick);
    document.removeEventListener("click", handleCodeToggleClick);
    document.removeEventListener("click", handleCodeFullscreenClick);
    document.removeEventListener("click", handleTableFullscreenClick);
    document.removeEventListener("click", handleMermaidFullscreenClick);
    document.removeEventListener("click", handleImageClick);
    // 如果用户路由切走时全屏蒙层还在，需要主动清理
    closeCodeFullscreen();
    closeTableFullscreen();
    closeMermaidFullscreen();
    closeImageFullscreen();
    // 释放表格 overflow 监听
    tableOverflowObserver?.disconnect();
    tableOverflowObserver = null;
    // 取消待处理的请求
    pendingRequest.value = null;
    // 取消尚未触发的浏览量打点定时器
    cancelPendingViewLog();
  }
});

// 监听路由变化，处理路由参数变化
watch(
  () => route.params.id,
  async (newId, oldId) => {
    if (newId && newId !== oldId) {
      // 重置状态：路由切换时把内容相关字段清空，等新文章加载完毕再渲染
      article.value = null;

      pendingRequest.value = null;
      loadingState.value = "正在加载文章...";

      // 重置浏览量打点会话：路由切到新文章时，旧的定时器作废、新文章允许再次打点
      cancelPendingViewLog();
      viewLogReportedFor = null;

      // 客户端：重新初始化文章内容
      if (import.meta.client) {
        if (fingerprintReady.value) {
          try {
            await fetchArticleContent();
          } catch (error) {}
        } else {
          try {
            await initArticleContent();
          } catch (error) {}
        }

        // 新文章 HTML 替换完毕后，重新跑一次 mermaid 渲染。
        // SPA 路由切换不会重新 mount 组件，onMounted 不会再触发，
        // 因此必须在 watch 里手动 trigger 一次。
        // 用 nextTick 确保 v-html 已经把新 DOM 写入页面。
        await nextTick();
        void renderMermaidBlocks();
        // 同样原因：新文章里的表格也要重新挂 overflow 检测。
        // observeAllTableWraps 内部用 WeakSet 去重，不会对老 wrap 重复 observe。
        observeAllTableWraps();

        // 浏览量打点：SPA 路由切换 onMounted 不会再触发，这里手动安排。
        // 上方已经 cancelPendingViewLog + 重置 viewLogReportedFor=null，可以直接调度。
        scheduleViewLog(newId as string);
      }
    }
  }
);
</script>

<style scoped>
/* 目录加载状态 */
.catalog-loading {
  width: 100%;
  height: 150px;
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: loading-pulse 1.5s infinite;
}

/* 新增加载状态信息样式 */
.loading-message {
  text-align: center;
  color: #666;
  padding: 15px;
  font-size: 14px;
  margin-top: 20px;
}

@keyframes loading-pulse {
  0% {
    background-position: 0% 0;
  }

  100% {
    background-position: -200% 0;
  }
}

/* 移动端特别优化 */
@media (max-width: 576px) {
  .article-detail-section.l-container {
    width: 100%;
  }

  .l-article-main {
    padding-left: 0px;
    padding-right: 0px;
  }

  .panel-body {
    padding: 0px !important;
  }

  .c_titile {
    margin-top: 0.5em;
    margin-bottom: 0.5em;
  }
}

.catalog-wrapper {
  position: sticky;
  top: 12px;
  background-color: #fff;
  max-height: calc(100vh - 80px);
  overflow-y: auto;
  padding: 10px;
  display: none;
}

@media (min-width: 768px) {
  .catalog-wrapper {
    display: block;
  }
}

.catalog-content {
  overflow-y: auto;
}

/* 骨架屏样式 */
.loading-skeleton {
  padding: 10px;
  animation: pulse 1.5s infinite;
}

.skeleton-title {
  height: 32px;
  background: #f0f0f0;
  margin-bottom: 15px;
  border-radius: 4px;
  width: 80%;
  margin: 0 auto 15px;
}

.skeleton-info {
  height: 20px;
  background: #f0f0f0;
  margin-bottom: 20px;
  border-radius: 4px;
  width: 60%;
  margin: 0 auto 20px;
}

.skeleton-line {
  height: 16px;
  background: #f0f0f0;
  margin-bottom: 10px;
  border-radius: 4px;
}

.skeleton-line:nth-child(odd) {
  width: 100%;
}

.skeleton-line:nth-child(even) {
  width: 90%;
}

@keyframes pulse {
  0% {
    opacity: 0.6;
  }

  50% {
    opacity: 1;
  }

  100% {
    opacity: 0.6;
  }
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }

  100% {
    transform: rotate(360deg);
  }
}

.w_main_left {
  font: 12px Microsoft YaHei, STKaiti, STXihei;
  color: #756f71;
}

.c_titile {
  font-weight: 700;
  font-size: 2.5rem;
  text-align: center;
  color: #2c3e50;
  margin-bottom: 0.6em;
  line-height: 1.3;
}

@media (max-width: 576px) {
  .c_titile {
    font-size: 1.8rem;
    margin-bottom: 0.5em;
  }
}

.box_c {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  padding: 12px 16px;
  color: #555;
  font-size: 14px;
  gap: 12px 20px;
  border-radius: 4px;
  background-color: #f8f9fa;
  border: 1px solid #e9ecef;
}

.info-item {
  color: #555;
  font-weight: 500;
}

/* 优化：大内容预览提示样式 */
.content-preview-note {
  padding: 15px;
  text-align: center;
  color: #666;
  font-size: 14px;
  background-color: #f8f9fa;
  border-radius: 4px;
  margin-top: 20px;
}

/* 优化：SSR HTML 内容样式，确保与客户端渲染一致 */
.article-body-ssr {
  word-break: normal;
  line-height: 1.6;
}

/* 优化：减少重绘和重排 */
.article-container {
  contain: layout style paint;
  will-change: auto;
}

/* 移动端（≤576px）样式集中区：SSR 正文、信息条、标题等的小屏专项调整 */
@media (max-width: 576px) {
  .article-body-ssr {
    min-height: 0;
    text-rendering: optimizeLegibility;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    line-height: 1.6;
    padding-left: 8px;
    padding-right: 8px;
  }

  .article-body-ssr :deep(p),
  .article-body-ssr :deep(li),
  .article-body-ssr :deep(li p) {
    line-height: 1.6;
  }

  .box_c {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
    margin-left: 8px;
    margin-right: 8px;
  }

  .c_titile {
    padding-left: 8px;
    padding-right: 8px;
  }

  .info-item {
    font-size: 13px;
  }
}
</style>
