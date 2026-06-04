<template>
    <div class="json-tool-page" :style="firstScreenStyle">
        <!-- SSR 渲染的 SEO 头部，爬虫直接可见 -->
        <header ref="heroRef" class="seo-hero">
            <h1 class="seo-h1">JSON 在线格式化工具 - 免费支持 JSON 压缩、Diff 对比、转 YAML / Go 结构体</h1>
            <p class="seo-lead">
                免费在线 JSON 工具，支持
                <strong>JSON 格式化</strong>、<strong>压缩</strong>、<strong>转义 / 去除转义</strong>、<strong>排序</strong>，
                <strong>JSON 转 YAML / TOML / XML / Go 结构体</strong>，
                以及 <strong>Diff 对比</strong>、<strong>脱敏</strong>、<strong>存档</strong>等功能。
                核心处理均在浏览器本地完成（获取 JSON 和分享功能除外）。
            </p>
        </header>

        <!-- 编辑器主体（client-only，不影响 SEO） -->
        <div class="editor-shell">
            <client-only>
                <AsyncJsonTool locale="zh" />
                <template #fallback>
                    <div class="editor-skeleton" aria-label="编辑器加载中">
                        <div class="skeleton-toolbar"></div>
                        <div class="skeleton-body"></div>
                    </div>
                </template>
            </client-only>
        </div>

        <!-- 移动端引导卡：仅在 ≤900px 显示，SSR 渲染（爬虫可见 + 移动端用户立刻获取信息）。
             编辑器在小屏不可用，但用户/爬虫到这块视口位置时不至于看到一片"加载中"骨架。 -->
        <aside class="mobile-guide" aria-label="移动端使用提示与功能概览">
            <div class="mobile-guide-card">
                <h2 class="mobile-guide-title">在手机上也能查看这款 JSON 工具</h2>
                <p class="mobile-guide-lead">
                    在线编辑功能需要在 <strong>宽度 ≥ 900px</strong> 的设备上使用，以便显示
                    双栏编辑器、工具栏与差异对比视图。下方为本工具的能力概览，建议
                    收藏后在 PC / iPad 横屏访问。
                </p>

                <h3 class="mobile-guide-subtitle">主要功能</h3>
                <ul class="mobile-guide-features">
                    <li><strong>JSON 格式化 / 压缩</strong>：一键美化或最小化任意层级 JSON</li>
                    <li><strong>转义 / 去转义</strong>：在转义字符串与可读 JSON 间切换</li>
                    <li><strong>JSON 转 YAML / TOML / XML / Go 结构体</strong>：跨格式快速迁移</li>
                    <li><strong>Diff 对比</strong>：高亮两份 JSON 的字段差异</li>
                    <li><strong>脱敏 / 排序 / 存档</strong>：日常调试常用的高级处理</li>
                    <li><strong>大文件流畅</strong>：实测 58 万行 / 14 层嵌套仍可折叠</li>
                </ul>

                <h3 class="mobile-guide-subtitle">为什么选择本工具</h3>
                <ul class="mobile-guide-features">
                    <li>核心处理 <strong>全部在浏览器本地完成</strong>，数据不离开设备</li>
                    <li>无广告、无登录、永久免费</li>
                    <li>支持中英双语、键盘快捷键、深色风格</li>
                </ul>

                <p class="mobile-guide-foot">
                    继续向下滚动可阅读详细教程、常用快捷键与 FAQ。
                </p>
            </div>
        </aside>

        <!-- SSR 渲染的 SEO 内容（特性、教程、FAQ） -->
        <JsonToolSeoContent locale="zh" />
    </div>
</template>

<script setup lang="ts">
import { defineAsyncComponent, ref, onMounted, onBeforeUnmount, computed } from 'vue';
import JsonToolSeoContent from '~/components/JsonTool/JsonToolSeoContent.vue';
import {
    generateJsonToolStructuredData,
    generateJsonToolFaqStructuredData,
    generateJsonToolBreadcrumb,
} from '~/utils/seo';

const AsyncJsonTool = defineAsyncComponent(
    () => import('~/components/JsonTool/JsonTool.client.vue')
);

const heroRef = ref<HTMLElement | null>(null);
const heroHeight = ref(0);
const navHeight = ref(0);
let heroObserver: ResizeObserver | null = null;
let navObserver: ResizeObserver | null = null;

const firstScreenStyle = computed(() => ({
    '--reserved-h': `${heroHeight.value + navHeight.value}px`,
}));

onMounted(() => {
    if (typeof ResizeObserver === 'undefined') return;

    if (heroRef.value) {
        heroObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                heroHeight.value = entry.contentRect.height;
            }
        });
        heroObserver.observe(heroRef.value);
    }

    const navEl = document.querySelector('.navigation') as HTMLElement | null;
    if (navEl) {
        navHeight.value = navEl.offsetHeight;
        navObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                navHeight.value = entry.contentRect.height;
            }
        });
        navObserver.observe(navEl);
    }
});

onBeforeUnmount(() => {
    heroObserver?.disconnect();
    navObserver?.disconnect();
});

const config = useRuntimeConfig();
const siteUrl = config.public.siteUrl || 'https://liubing.xyz';
const pageUrl = `${siteUrl}/tool/json`;
const enUrl = `${siteUrl}/en/tool/json`;

const title = '免费 JSON 在线工具 - 格式化、校验、压缩、转 YAML/XML/Go | 冰冰同学';
const description =
    '免费在线 JSON 工具，支持 JSON 格式化、压缩、校验、排序，JSON 转 YAML/TOML/XML/Go 结构体，以及 Diff 对比、脱敏。核心处理均在浏览器本地完成（分享功能除外）。支持超大文件（58 万行 / 14 层嵌套）流畅折叠。';
const keywords =
    'JSON 格式化,JSON 在线工具,JSON 校验,JSON 美化,JSON 压缩,JSON 排序,JSON 转 YAML,JSON 转 TOML,JSON 转 XML,JSON 转 Go 结构体,JSON Diff,JSON 脱敏,免费 JSON 工具';

useSeoMeta({
    title,
    description,
    keywords,
    ogTitle: title,
    ogDescription: description,
    ogType: 'website',
    ogUrl: pageUrl,
    ogLocale: 'zh_CN',
    ogLocaleAlternate: ['en_US'],
    ogSiteName: '冰冰同学的技术博客',
    twitterCard: 'summary_large_image',
    twitterTitle: title,
    twitterDescription: description,
    robots: 'index,follow,max-image-preview:large,max-snippet:-1',
});

useHead({
    htmlAttrs: { lang: 'zh-CN' },
    link: [
        { rel: 'canonical', href: pageUrl },
        { rel: 'alternate', hreflang: 'zh-CN', href: pageUrl },
        { rel: 'alternate', hreflang: 'en-US', href: enUrl },
        { rel: 'alternate', hreflang: 'x-default', href: pageUrl },
    ],
    meta: [
        { name: 'applicable-device', content: 'pc,mobile' },
        { 'http-equiv': 'Cache-Control', content: 'no-transform' },
    ],
    script: [
        {
            type: 'application/ld+json',
            innerHTML: JSON.stringify(generateJsonToolStructuredData(siteUrl, 'zh')),
        },
        {
            type: 'application/ld+json',
            innerHTML: JSON.stringify(generateJsonToolFaqStructuredData('zh')),
        },
        {
            type: 'application/ld+json',
            innerHTML: JSON.stringify(generateJsonToolBreadcrumb(siteUrl, 'zh')),
        },
    ],
});
</script>

<style scoped>
.json-tool-page {
    width: 100%;
}

.seo-hero {
    max-width: 1200px;
    margin: 0 auto;
    padding: 24px 20px 8px;
    text-align: center;
}

.seo-h1 {
    font-size: 26px;
    font-weight: 700;
    margin: 0 0 12px;
    color: var(--el-text-color-primary, #2c3e50);
    line-height: 1.4;
}

.seo-lead {
    font-size: 14px;
    color: var(--el-text-color-regular, #606266);
    line-height: 1.7;
    max-width: 900px;
    margin: 0 auto;
}

.seo-lead strong {
    color: var(--el-color-primary, #409eff);
    font-weight: 600;
}

.editor-shell {
    width: 100%;
    /* 首屏 = 视口高 - 顶部导航 - SEO Hero（lead + h1）；min 兜底防止小屏塌陷 */
    height: calc(100dvh - var(--reserved-h, 160px));
    min-height: 480px;
}

/* ============================================================
   移动端引导卡（≤900px 才显示）
   ------------------------------------------------------------
   - PC 端隐藏（编辑器本身可用，无需引导）
   - 移动端：编辑器内部会通过 .screen-size-warning 弹出"屏幕过小"提示，
     用户/爬虫继续往下滚动会先看到这块内容丰富的引导卡，
     再看到详尽的教程/FAQ。避免移动端只看到一段提示文字
     就觉得"工具不能用"的体验崩塌。
   ============================================================ */
.mobile-guide {
    display: none;
}

.editor-skeleton {
    width: 100%;
    height: 100%;
    min-height: 480px;
    padding: 16px;
    background: var(--el-fill-color-light, #f5f7fa);
    border-radius: 6px;
    display: flex;
    flex-direction: column;
    gap: 16px;
}

.skeleton-toolbar {
    height: 40px;
    background: linear-gradient(90deg, #eee 25%, #f5f5f5 50%, #eee 75%);
    background-size: 200% 100%;
    animation: skeleton-loading 1.4s infinite;
    border-radius: 4px;
}

.skeleton-body {
    flex: 1;
    background: linear-gradient(90deg, #eee 25%, #f5f5f5 50%, #eee 75%);
    background-size: 200% 100%;
    animation: skeleton-loading 1.4s infinite;
    border-radius: 4px;
}

@keyframes skeleton-loading {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
}

@media (max-width: 900px) {
    /* 编辑器在小屏完全无法使用，把它从布局中移除，避免占着大片"骨架"空间 */
    .editor-shell {
        display: none;
    }

    .mobile-guide {
        display: block;
        padding: 16px 14px 8px;
    }

    .mobile-guide-card {
        max-width: 720px;
        margin: 0 auto;
        background: #fff;
        border: 1px solid rgba(15, 23, 42, 0.08);
        box-shadow: 0 6px 18px rgba(15, 23, 42, 0.06);
        padding: 18px 18px 14px;
    }

    .mobile-guide-title {
        font-size: 18px;
        font-weight: 600;
        margin: 0 0 10px;
        color: #263238;
        line-height: 1.45;
    }

    .mobile-guide-subtitle {
        font-size: 15px;
        font-weight: 600;
        margin: 16px 0 8px;
        color: #263238;
        position: relative;
        padding-left: 10px;
    }

    .mobile-guide-subtitle::before {
        content: '';
        position: absolute;
        left: 0;
        top: 4px;
        bottom: 4px;
        width: 3px;
        background: #00acc1;
    }

    .mobile-guide-lead,
    .mobile-guide-foot {
        font-size: 13.5px;
        color: #5f6b76;
        line-height: 1.7;
        margin: 0 0 8px;
    }

    .mobile-guide-foot {
        margin-top: 14px;
        padding-top: 12px;
        border-top: 1px dashed rgba(15, 23, 42, 0.08);
        color: #8f9aa5;
        font-size: 13px;
    }

    .mobile-guide-lead strong,
    .mobile-guide-features strong {
        color: #00838f;
        font-weight: 600;
    }

    .mobile-guide-features {
        list-style: none;
        padding: 0;
        margin: 0;
    }

    .mobile-guide-features li {
        position: relative;
        padding: 6px 0 6px 18px;
        font-size: 13.5px;
        line-height: 1.6;
        color: #263238;
        border-bottom: 1px dashed rgba(15, 23, 42, 0.06);
    }

    .mobile-guide-features li:last-child {
        border-bottom: none;
    }

    .mobile-guide-features li::before {
        content: '';
        position: absolute;
        left: 4px;
        top: 13px;
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: #00acc1;
    }
}

@media (max-width: 768px) {
    .seo-h1 {
        font-size: 20px;
    }
    .seo-lead {
        font-size: 13px;
    }
}
</style>
