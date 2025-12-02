<template>
  <section class="container pt-20">
    <div class="row">
      <div class="col-sm-10 col-md-10 col-lg-10">
        <div class="panel panel-default mb-20">
          <div class="panel-body pt-10 pb-10">
            <!-- 文章内容区域 - SSR + 客户端增强 -->
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
                <!-- 统一使用 md-editor-v3 渲染，简化逻辑 -->
                <ClientOnly>
                  <MarkdownRenderer
                    v-if="isContentReady && visibleContent"
                    :content="visibleContent"
                    :editor-id="editorId"
                    :key="articleId"
                  />
                  <template #fallback>
                    <div class="loading-skeleton">
                      <div class="skeleton-line"></div>
                      <div class="skeleton-line"></div>
                      <div class="skeleton-line"></div>
                    </div>
                  </template>
                </ClientOnly>

                <!-- 数据加载前的骨架屏 -->
                <div
                  v-if="!isContentReady || !visibleContent"
                  class="loading-skeleton"
                >
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

      <div class="col-sm-2 col-md-2 col-lg-2">
        <ClientOnly>
          <!-- 优化：目录组件延迟加载，使用 requestIdleCallback -->
          <div
            v-if="!isMobile && isContentReady && article"
            class="catalog-wrapper"
          >
            <div class="catalog-content">
              <Suspense>
                <CatalogRenderer
                  :editor-id="editorId"
                  :scroll-element="scrollElement"
                  :scroll-element-offset-top="45"
                  :key="articleId"
                />
                <template #fallback>
                  <div class="catalog-loading"></div>
                </template>
              </Suspense>
            </div>
          </div>
        </ClientOnly>
      </div>
    </div>
    <ReturnTop></ReturnTop>
  </section>
</template>

<script setup lang="ts">
import {
  ref,
  computed,
  defineAsyncComponent,
  defineComponent,
  watch,
  onMounted,
  onBeforeUnmount,
} from "vue";
import {
  getUserAgentFromEvent,
  generateArticleStructuredData,
} from "~/utils/seo";
import { ResponseCode } from "~/utils/api";

// 优化异步组件加载 - 延迟加载减少TBT，但移动端和桌面端都使用
const MarkdownRenderer = defineAsyncComponent({
  loader: () => import("../../components/MarkdownRenderer.vue"),
  loadingComponent: defineComponent({
    template: '<div class="markdown-loading"></div>',
  }),
  errorComponent: defineComponent({
    template: '<div class="markdown-error">加载失败</div>',
  }),
  delay: 200, // 延迟200ms，让SSR内容先显示，减少TBT
  timeout: 5000,
  suspensible: true,
});

// 目录组件 - 移动端延迟加载，减少初始JS bundle
const CatalogRenderer = defineAsyncComponent({
  loader: () => import("../../components/CatalogRenderer.vue"),
  delay: 200, // 延迟更久，使用 requestIdleCallback 加载
  timeout: 2000,
  suspensible: true,
});

interface ArticleDetail {
  id: string;
  title: string;
  tag: string;
  content: string;
  createTime: string;
  updateTime: string;
}

const route = useRoute();
const runtimeConfig = useRuntimeConfig();
const articleId = computed(() => route.params.id as string);
const editorId = "my-editor";
const scrollElement = ".scrollable-content";
const article = ref<ArticleDetail | null>(null);
const isContentReady = ref(false);
const visibleContent = ref("");
const isMobile = ref(false);
const loadingState = ref<string>("正在加载文章...");
const fingerprintReady = ref(false);
const fingerprintValue = ref("");
const pendingRequest = ref<Promise<any> | null>(null); // 请求去重

// 防抖相关的变量
let resizeTimer: ReturnType<typeof setTimeout> | null = null;
const handleResize = () => {
  if (resizeTimer) clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (import.meta.client) {
      isMobile.value = window.innerWidth < 576;
    }
  }, 150); // 防抖150ms
};

// 从cookie中读取session_id的辅助函数
function getSessionIdFromCookie(): string | null {
  const sessionCookie = useCookie("session_id");
  return sessionCookie.value && typeof sessionCookie.value === "string"
    ? sessionCookie.value.trim() || null
    : null;
}

// 服务端预取文章详情，用于 SSR 输出 HTML（不改变浏览器端 fingerprint / cookie 请求逻辑）
const { data: serverArticle } = await useAsyncData<ArticleDetail | null>(
  "article-detail-ssr",
  async () => {
    if (!import.meta.server || !articleId.value) {
      return null;
    }

    try {
      const event = useRequestEvent();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      // 透传 User-Agent 给后端，让后端识别搜索引擎爬虫
      const userAgent = getUserAgentFromEvent(event);
      if (userAgent) {
        headers["user-agent"] = userAgent;
      }

      // 将请求中的 Cookie 透传给 Go 后端，让已登录/已有会话的用户 SSR 也能拿到文章内容
      // 注意：搜索引擎爬虫通常没有 Cookie，后端应该识别 User-Agent 后直接返回内容
      const cookie = event?.node.req.headers["cookie"];
      if (cookie && typeof cookie === "string") {
        headers["cookie"] = cookie;
      }

      const result = await $fetch<{ code: number; data: ArticleDetail | null }>(
        `${runtimeConfig.public.baseURL}/user/article/detail`,
        {
          method: "GET",
          query: { id: articleId.value },
          headers,
          credentials: "include",
        }
      );

      // SSR 阶段如果文章不存在，抛出 404 错误触发 Nuxt 404 页面
      if (result.code === ResponseCode.NotFound) {
        throw createError({
          statusCode: 404,
          statusMessage: "文章不存在",
        });
      }

      if (result.code === 2000 && result.data) {
        return result.data;
      }
    } catch {
      // SSR 获取失败时静默降级为客户端渲染
      return null;
    }

    return null;
  }
);

// 使用 SSR 数据优先填充文章基础信息
// 优化：直接使用 SSR 数据，不需要渲染 HTML，客户端直接用 md-editor-v3 渲染
if (serverArticle.value) {
  article.value = serverArticle.value;
  visibleContent.value = serverArticle.value.content || "";
}

// SEO：根据文章内容动态设置页面标题和 meta 信息
// 优化：使用 computed 缓存计算结果，避免重复计算
const seoData = computed(() => {
  const current = article.value || serverArticle.value;
  if (!current) {
    return {
      title: "博客文章",
      description: "",
      tags: [],
      canonicalUrl: "",
      structuredData: null,
    };
  }

  // 优化：只处理前5000字符用于生成描述，避免处理整个大内容
  const contentForDesc = (current.content || "").slice(0, 5000);
  const plainText = contentForDesc
    .replace(/[`*_>#\-]+/g, " ")
    .replace(/\[(.*?)\]\(.*?\)/g, "$1")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const description = plainText.slice(0, 160);
  const tags = current.tag ? current.tag.split(/[,\s，]+/).filter(Boolean) : [];
  const siteUrl = runtimeConfig.public.siteUrl || "https://liubing.xyz";
  const canonicalUrl = `${siteUrl}/article-detail/${current.id}`;
  const structuredData = generateArticleStructuredData(current, siteUrl);

  return {
    title: `${current.title}`,
    description,
    tags,
    canonicalUrl,
    structuredData,
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
      {
        name: "description",
        content: data.description,
      },
      ...(data.tags.length
        ? [
            {
              name: "keywords",
              content: data.tags.join(","),
            },
          ]
        : []),
      {
        property: "og:type",
        content: "article",
      },
      {
        property: "og:title",
        content: data.current.title,
      },
      {
        property: "og:description",
        content: data.description,
      },
      {
        property: "og:url",
        content: data.canonicalUrl,
      },
      ...(data.tags.length
        ? data.tags.map((tag) => ({
            property: "article:tag",
            content: tag,
          }))
        : []),
    ],
    script: data.structuredData
      ? [
          {
            type: "application/ld+json",
            children: JSON.stringify(data.structuredData),
          },
        ]
      : [],
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
    const sessionId = import.meta.client ? getSessionIdFromCookie() : null;

    // 构建请求头
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (!sessionId && fingerprintValue.value) {
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
        credentials: "include",
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
          article.value = result.data;
          visibleContent.value = result.data.content || "";

          // 使用 requestIdleCallback 延迟切换到客户端渲染，减少TBT
          if (import.meta.client) {
            // 使用 requestIdleCallback 延迟切换，不阻塞主线程
            if ("requestIdleCallback" in window) {
              requestIdleCallback(
                () => {
                  isContentReady.value = true;
                },
                { timeout: 500 }
              );
            } else {
              // 降级方案：延迟执行，让SSR内容先显示
              setTimeout(() => {
                isContentReady.value = true;
              }, 200);
            }
          } else {
            isContentReady.value = true;
          }
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
      visibleContent.value = serverArticle.value.content || "";
      isContentReady.value = true;
    }

    // 重新抛出错误，让调用方知道失败了
    throw error;
  }
};

// 初始化文章内容
const initArticleContent = async () => {
  if (!articleId.value) return;

  // 优化：如果 SSR 已经有数据，直接使用，避免重复请求
  if (serverArticle.value && serverArticle.value.content) {
    article.value = serverArticle.value;
    visibleContent.value = serverArticle.value.content;

    if (import.meta.client) {
      if ("requestIdleCallback" in window) {
        requestIdleCallback(
          () => {
            isContentReady.value = true;
          },
          { timeout: 1000 }
        );
      } else {
        setTimeout(() => {
          isContentReady.value = true;
        }, 200);
      }
    } else {
      isContentReady.value = true;
    }
    return;
  }

  try {
    // 先检查是否有session_id
    const sessionId = getSessionIdFromCookie();

    if (sessionId) {
      // 如果有session_id，直接获取文章内容，不需要计算指纹
      fingerprintReady.value = true;
      await fetchArticleContent();
    } else {
      // 如果没有session_id，需要计算指纹
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
          visibleContent.value = serverArticle.value.content || "";
          isContentReady.value = true;
        }
      }
    }
  } catch (error) {
    loadingState.value = "加载失败，请刷新页面";

    // 如果 SSR 有数据，至少可以显示 SSR 内容作为降级方案
    if (serverArticle.value) {
      article.value = serverArticle.value;
      visibleContent.value = serverArticle.value.content || "";
      isContentReady.value = true;
    }
  }
};

// 确保客户端激活时初始化数据
// 优化：使用 requestIdleCallback 延迟非关键操作，减少TBT
onMounted(() => {
  if (import.meta.client) {
    // 立即检测设备类型
    isMobile.value = window.innerWidth < 576;

    // 使用 requestIdleCallback 延迟初始化，减少阻塞
    // 但设置较短的timeout，确保内容能及时加载
    if ("requestIdleCallback" in window) {
      requestIdleCallback(
        () => {
          initArticleContent();
        },
        { timeout: 1000 }
      );
    } else {
      // 降级方案：延迟执行，但不要太久
      setTimeout(() => {
        initArticleContent();
      }, 100);
    }
  }
});

// 组件卸载时清理数据
onBeforeUnmount(() => {
  if (import.meta.client) {
    window.removeEventListener("resize", handleResize);
    if (resizeTimer) {
      clearTimeout(resizeTimer);
      resizeTimer = null;
    }
    // 取消待处理的请求
    pendingRequest.value = null;
  }
});

// 监听路由变化，处理路由参数变化
watch(
  () => route.params.id,
  async (newId, oldId) => {
    if (newId && newId !== oldId) {
      // 重置状态
      article.value = null;
      isContentReady.value = false;
      visibleContent.value = "";
      pendingRequest.value = null;
      loadingState.value = "正在加载文章...";

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
  .col-sm-10 {
    padding-left: 0px;
    padding-right: 0px;
  }

  .panel-body {
    padding: 5px 8px !important;
  }

  .c_titile {
    margin-top: 0.5em;
    margin-bottom: 0.5em;
  }
}

.catalog-wrapper {
  position: fixed;
  background-color: #fff;
  border-radius: 5px;
  max-height: 80vh;
  min-width: 100px;
  width: fit-content;
  overflow-y: auto;
  padding: 10px;
  display: none;
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

.catalog-wrapper {
  display: block;
  border: none;
  max-width: 200px;
  min-width: 100px;
  width: clamp(100px, 12vw, 200px);
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
  border-radius: 8px;
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

/* 优化：移动端SSR HTML样式，确保与客户端渲染一致 */
@media (max-width: 576px) {
  .article-body-ssr {
    /* 确保移动端SSR内容立即可见，优化LCP */
    min-height: 0;
    /* 优化字体渲染 */
    text-rendering: optimizeLegibility;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  /* 移动端隐藏目录区域，减少布局计算 */
  .col-sm-2 {
    display: none;
  }

  .col-sm-10 {
    width: 100%;
    max-width: 100%;
  }
}

@media (max-width: 576px) {
  .box_c {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }

  .info-item {
    font-size: 13px;
  }
}
</style>
