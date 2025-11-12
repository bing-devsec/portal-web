<template>
    <section class="container pt-20">
        <div class="row">
            <div class="col-sm-10 col-md-10 col-lg-10">
                <div class="panel panel-default mb-20">
                    <div class="panel-body pt-10 pb-10">
                        <ClientOnly>
                            <!-- 文章内容区域 - 先显示加载状态，等数据获取后再显示实际内容 -->
                            <article v-if="article" :key="articleId" class="article-container">
                                <h1 class="c_titile">{{ article.title }}</h1>
                                <div class="box_c">
                                    <span class="info-item">标签：{{ article.tag }}</span>
                                    <span class="info-item">首次发布：{{ article.createTime }}</span>
                                    <span class="info-item">最近修改：{{ article.updateTime }}</span>
                                </div>

                                <div class="article-body">
                                    <MarkdownRenderer v-if="isContentReady" :content="visibleContent"
                                        :editor-id="editorId" :key="articleId" />
                                    <div v-else class="loading-skeleton">
                                        <div class="skeleton-line"></div>
                                        <div class="skeleton-line"></div>
                                        <div class="skeleton-line"></div>
                                    </div>
                                </div>
                            </article>
                            <!-- 骨架屏 - 数据加载前显示 -->
                            <div v-else class="loading-skeleton article-placeholder">
                                <div class="skeleton-title"></div>
                                <div class="skeleton-info"></div>
                                <div class="skeleton-line"></div>
                                <div class="skeleton-line"></div>
                                <div class="skeleton-line"></div>
                                <div v-if="loadingState" class="loading-message">{{ loadingState }}</div>
                            </div>
                        </ClientOnly>
                    </div>
                </div>
            </div>

            <div class="col-sm-2 col-md-2 col-lg-2">
                <ClientOnly>
                    <div v-if="!isMobile && isContentReady && article" class="catalog-wrapper">
                        <div class="catalog-content">
                            <Suspense>
                                <CatalogRenderer :editor-id="editorId" :scroll-element="scrollElement"
                                    :scroll-element-offset-top="45" :key="articleId" />
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
import { ref, computed, defineAsyncComponent, defineComponent, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';

// 优化异步组件加载
const MarkdownRenderer = defineAsyncComponent({
    loader: () => import('../../components/MarkdownRenderer.vue'),
    loadingComponent: defineComponent({
        template: '<div class="markdown-loading"></div>'
    }),
    errorComponent: defineComponent({
        template: '<div class="markdown-error">加载失败</div>'
    }),
    delay: 0,
    timeout: 3000,
    suspensible: true,
});

// 目录组件
const CatalogRenderer = defineAsyncComponent({
    loader: () => import('../../components/CatalogRenderer.vue'),
    delay: 200,
    timeout: 2000,
    suspensible: true,  // 启用Suspense支持
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
const articleId = computed(() => route.params.id as string);
const editorId = 'my-editor';
const scrollElement = '.scrollable-content';
const article = ref<ArticleDetail | null>(null);
const isContentReady = ref(false);
const visibleContent = ref('');
const isMobile = ref(false);
const loadingState = ref<string>('正在加载文章...');
const fingerprintReady = ref(false);
const fingerprintValue = ref('');

// 从cookie中读取session_id的辅助函数
function getSessionIdFromCookie(): string | null {
    const sessionCookie = useCookie('session_id');
    return sessionCookie.value && typeof sessionCookie.value === 'string' 
        ? sessionCookie.value.trim() || null 
        : null;
}

// 检测设备类型
onMounted(() => {
    if (import.meta.client) {
        isMobile.value = window.innerWidth < 620;

        // 使用passive: true优化事件监听
        window.addEventListener('resize', () => {
            isMobile.value = window.innerWidth < 620;
        }, { passive: true });

        // 如果是小屏幕设备，尝试移除不必要的脚本
        if (isMobile.value) {
            optimizeForMobile();
        }
    }
});

// 针对移动设备的特别优化
function optimizeForMobile() {
    // 延迟加载非关键资源
    if (typeof window !== 'undefined') {
        // 找到并延迟加载任何非关键脚本
        const lowPriorityScripts = document.querySelectorAll('script[data-priority="low"]');
        lowPriorityScripts.forEach(script => {
            script.setAttribute('defer', '');
        });

        // 延迟加载非关键样式
        const lowPriorityStyles = document.querySelectorAll('link[data-priority="low"]');
        lowPriorityStyles.forEach(link => {
            link.setAttribute('media', 'print');
            link.setAttribute('onload', "this.media='all'");
        });
    }
}

// 直接获取文章内容的方法
const fetchArticleContent = async () => {
    if (!articleId.value) return;

    try {
        const sessionId = import.meta.client ? getSessionIdFromCookie() : null;
        
        // 构建请求头
        const headers: Record<string, string> = {
            'Content-Type': 'application/json'
        };

        if (!sessionId && fingerprintValue.value) {
            headers['x-client-id'] = fingerprintValue.value;
        }
        
        // 使用fetch API直接请求
        const response = await fetch(`${useRuntimeConfig().public.baseURL}/user/article/detail?id=${articleId.value}`, {
            method: 'GET',
            headers,
            credentials: 'include'
        });
        const result = await response.json();

        if (result.code === 2000 && result.data) {
            article.value = result.data;
            visibleContent.value = result.data.content || '';
            isContentReady.value = true;
        }
    } catch (error) {
        throw error;
    }
};

// 初始化文章内容
const initArticleContent = async () => {
    if (!articleId.value) return;

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
            if (typeof $recalculateFingerprint === 'function') {
                fingerprintValue.value = await $recalculateFingerprint();
                fingerprintReady.value = true;
                await fetchArticleContent();
            }
        }
    } catch (error) {
        throw error;
    }
};

// 确保客户端激活时初始化数据
onMounted(() => {
    if (import.meta.client) {
        initArticleContent();
    }
});

// 组件卸载时清理数据
onBeforeUnmount(() => {
    if (import.meta.client) {
        window.removeEventListener('resize', () => {
            isMobile.value = window.innerWidth < 576;
        });
    }
});

// 监听路由变化，处理路由参数变化
watch(() => route.params.id, (newId, oldId) => {
    if (newId && newId !== oldId) {
        // 仅在客户端且指纹已准备好时获取新文章
        if (import.meta.client && fingerprintReady.value) {
            fetchArticleContent();
        }
    }
});
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
@media(max-width: 576px) {
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

    .box_c {
        margin: 0 5px 0.5em;
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        padding: 3px 5px;
    }

    .box_c span {
        margin: 2px 0;
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
    color: #756F71;
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
    margin: 1em 0;
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

.article-body {
    margin-top: 2em;
}

@media (max-width: 768px) {
    .box_c {
        flex-direction: column;
        align-items: flex-start;
        gap: 8px;
        padding: 10px 20px;
    }

    .info-item {
        font-size: 13px;
    }
}
</style>