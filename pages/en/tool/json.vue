<template>
    <div class="json-tool-page" :style="firstScreenStyle">
        <header ref="heroRef" class="seo-hero">
            <h1 class="seo-h1">JSON Formatter Online - Free JSON Minifier, Diff &amp; Converter to YAML / Go</h1>
            <p class="seo-lead">
                Free online JSON tool that supports
                <strong>format</strong>, <strong>minify</strong>, <strong>escape / unescape</strong>, <strong>sort</strong>,
                conversion to <strong>YAML / TOML / XML / Go struct</strong>,
                plus <strong>diff</strong>, <strong>masking</strong>, and <strong>archive</strong>.
                Core processing runs entirely in your browser (except for Fetch and Share).
            </p>
        </header>

        <div class="editor-shell">
            <client-only>
                <AsyncJsonTool locale="en" />
                <template #fallback>
                    <div class="editor-skeleton" aria-label="Loading editor">
                        <div class="skeleton-toolbar"></div>
                        <div class="skeleton-body"></div>
                    </div>
                </template>
            </client-only>
        </div>

        <!-- Mobile guide card: shown only on screens ≤900px, SSR-rendered for crawlers + users.
             The interactive editor cannot fit on small screens, so we surface a content-rich
             intro here instead of leaving a blank skeleton. -->
        <aside class="mobile-guide" aria-label="Mobile usage tips and feature overview">
            <div class="mobile-guide-card">
                <h2 class="mobile-guide-title">Preview this JSON tool on mobile</h2>
                <p class="mobile-guide-lead">
                    The interactive editor requires a viewport of <strong>≥ 900px</strong>
                    to host the dual-pane editor, toolbar and diff viewer. Below is an
                    overview of the tool's capabilities — bookmark this page and revisit
                    on a desktop or iPad in landscape mode.
                </p>

                <h3 class="mobile-guide-subtitle">Key features</h3>
                <ul class="mobile-guide-features">
                    <li><strong>Format / Minify</strong>: beautify or compact JSON of any depth</li>
                    <li><strong>Escape / Unescape</strong>: convert between escaped strings and readable JSON</li>
                    <li><strong>JSON to YAML / TOML / XML / Go struct</strong>: instant cross-format conversion</li>
                    <li><strong>Diff</strong>: highlight field-level differences between two JSONs</li>
                    <li><strong>Masking / Sort / Archive</strong>: advanced operations for daily debugging</li>
                    <li><strong>Huge files supported</strong>: 580K+ lines, 14-level nesting still fold smoothly</li>
                </ul>

                <h3 class="mobile-guide-subtitle">Why choose this tool</h3>
                <ul class="mobile-guide-features">
                    <li>Core processing runs <strong>entirely in your browser</strong> — your data never leaves the device</li>
                    <li>No ads, no login, free forever</li>
                    <li>Bilingual UI (English / 中文), keyboard shortcuts, polished theme</li>
                </ul>

                <p class="mobile-guide-foot">
                    Scroll down for the full tutorial, keyboard shortcuts and FAQ.
                </p>
            </div>
        </aside>

        <JsonToolSeoContent locale="en" />
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
const zhUrl = `${siteUrl}/tool/json`;
const pageUrl = `${siteUrl}/en/tool/json`;

const title = 'Free JSON Tool Online - Format, Validate, Convert to YAML/XML/Go | liubing.xyz';
const description =
    'Free online JSON formatter, validator, beautifier, minifier. Convert JSON to YAML, TOML, XML, Go struct, plus diff and masking. Core processing runs entirely in your browser (except for the Share feature). Handles huge JSON files (580K+ lines, 14 levels nesting).';
const keywords =
    'json formatter, json validator, json beautifier, json minifier, json sort, json to yaml, json to toml, json to xml, json to go struct, json diff, free online json tool';

useSeoMeta({
    title,
    description,
    keywords,
    ogTitle: title,
    ogDescription: description,
    ogType: 'website',
    ogUrl: pageUrl,
    ogLocale: 'en_US',
    ogLocaleAlternate: ['zh_CN'],
    ogSiteName: 'liubing.xyz',
    twitterCard: 'summary_large_image',
    twitterTitle: title,
    twitterDescription: description,
    robots: 'index,follow,max-image-preview:large,max-snippet:-1',
});

useHead({
    htmlAttrs: { lang: 'en-US' },
    link: [
        { rel: 'canonical', href: pageUrl },
        { rel: 'alternate', hreflang: 'zh-CN', href: zhUrl },
        { rel: 'alternate', hreflang: 'en-US', href: pageUrl },
        { rel: 'alternate', hreflang: 'x-default', href: zhUrl },
    ],
    meta: [
        { name: 'applicable-device', content: 'pc,mobile' },
    ],
    script: [
        {
            type: 'application/ld+json',
            innerHTML: JSON.stringify(generateJsonToolStructuredData(siteUrl, 'en')),
        },
        {
            type: 'application/ld+json',
            innerHTML: JSON.stringify(generateJsonToolFaqStructuredData('en')),
        },
        {
            type: 'application/ld+json',
            innerHTML: JSON.stringify(generateJsonToolBreadcrumb(siteUrl, 'en')),
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
    height: calc(100dvh - var(--reserved-h, 160px));
    min-height: 480px;
}

/* ============================================================
   Mobile guide card (≤900px only)
   ------------------------------------------------------------
   - Hidden on desktop (the editor itself is fully usable there)
   - On mobile: replaces the unusable editor skeleton with a
     content-rich SSR-rendered intro for crawlers and users.
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
    /* Editor is unusable on small screens — remove it from the layout
       so the page doesn't show a blank 480px skeleton block. */
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
