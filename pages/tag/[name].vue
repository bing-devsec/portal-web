<template>
    <section class="l-container l-main-aside pt-20">
        <div class="l-main">
            <TipCard :tip-msg="tagName" class="tipCard"></TipCard>
            <ul class="index_arc">
                <ArticleCard
                    v-for="articleInfo in articleList"
                    :key="articleInfo.id"
                    :article-info="articleInfo"
                />
            </ul>
            <Pagination
                :total="total"
                :current-page="currentPage"
                :page-size="pageSize"
                @update:current-page="handlePageChange"
            />
        </div>

        <aside class="l-aside">
            <HotListCard :hot-articles="hotArticles" />
            <TagCard :tags="tags" />
            <LinkCard :friend-links="friendLinks" />
        </aside>
    </section>
</template>

<script setup lang="ts">
/**
 * 标签详情页（动态路由）
 *
 * 设计要点：
 *   - 路由：/tag/<encodedTagName>，每个标签具有唯一稳定 URL，可被搜索引擎收录。
 *   - SEO：在服务端渲染时根据 tagName 生成 title / description / canonical / og 等元信息，
 *     并暴露 BreadcrumbList JSON-LD，让搜索引擎正确理解层级。
 *   - 旧的 /tag?tagName= 形态由 hash 查询路径派生而来，外部链接进入时由本页 onMounted
 *     兼容兜底（实际跳转源已统一改为 path 形态，参见 ArticleCard / TagCard）。
 *   - 不再设置 noindex —— Lighthouse SEO 分会从 66 回归 100。
 */
import { useRoute, useRouter } from 'vue-router'

interface ArticleItem {
    id: string
    title: string
    tagName: string
    describe: string
    createTime: string
    updateTime: string
    viewNum: number
}

interface ArticleListResponse {
    rows: ArticleItem[]
    total: number
}

const route = useRoute()
const router = useRouter()
const paginationStore = usePaginationStore()
const pageSize = 10

// 从 URL path 解析 tagName（动态参数 [name]）
const tagName = computed(() => {
    const raw = route.params.name
    return Array.isArray(raw) ? raw[0] : (raw || '')
})

// 同步到 store，让侧栏 TagCard 的 active 高亮能继续工作
watchEffect(() => {
    if (tagName.value && tagName.value !== paginationStore.currentTagName) {
        paginationStore.setCurrentTagName(tagName.value)
    }
})

// 当前页码：可选 ?page= query 参数；默认 1
const currentPage = computed({
    get: () => {
        const q = Number(route.query.page)
        return Number.isFinite(q) && q > 0 ? q : 1
    },
    set: (v: number) => {
        // 同步到 store，保持与历史代码兼容
        paginationStore.setCurrentPage(v)
    }
})

// 文章列表请求
const requestParams = computed(() => ({
    tagName: tagName.value,
    page: currentPage.value,
    pageSize,
}))

const tagCacheKey = computed(
    () => `tag-articles-${tagName.value}-${currentPage.value}`
)

const { data: articleData, refresh: refreshArticles } = useApiData<ArticleListResponse>(
    '/user/tag/article-list',
    {
        params: requestParams,
        key: tagCacheKey,
    }
)

// useApiData 不会自动追踪 params 的响应式变化（其内部使用 useAsyncData 但未透传 watch 选项），
// 因此在 tagName / currentPage 变化时需要手动调用 refresh 触发新请求。
// 与 search-result.vue 中 handlePageChange 主动调用 refreshSearch 的做法保持一致。
watch(requestParams, async (newParams) => {
    await refreshArticles({ params: newParams })
}, { deep: true })

const articleList = computed(() => articleData.value?.rows || [])
const total = computed(() => articleData.value?.total || 0)

// 分页：通过 router.push 让 URL 变化（?page=2 等），便于分享 / 收藏 / 直接搜索引擎抓取分页
// URL 变化后 route.query.page 改变 → currentPage computed 更新 → 上面的 watch 会触发数据刷新
const handlePageChange = (newPage: number) => {
    paginationStore.setCurrentPage(newPage)
    router.push({
        path: route.path,
        query: newPage > 1 ? { page: newPage } : {},
    })
}

// 侧栏数据
const { hotArticles, tags, friendLinks } = useSidebarData()

// ===== SEO =====
const runtimeConfig = useRuntimeConfig()
const siteUrl = (runtimeConfig.public.siteUrl as string) || 'https://liubing.xyz'
const canonicalUrl = computed(() => {
    const base = `${siteUrl}/tag/${encodeURIComponent(tagName.value)}`
    return currentPage.value > 1 ? `${base}?page=${currentPage.value}` : base
})
const pageTitle = computed(() => {
    if (!tagName.value) return '标签 - 冰冰同学的技术博客'
    return `${tagName.value} 相关文章 - 冰冰同学的技术博客`
})
const pageDescription = computed(() => {
    if (!tagName.value) return '按标签浏览冰冰同学技术博客上的技术文章。'
    return `汇总「${tagName.value}」相关的技术文章列表，涵盖该方向的实践笔记、踩坑记录与原理梳理。`
})

useHead(() => ({
    title: pageTitle.value,
    link: [{ rel: 'canonical', href: canonicalUrl.value }],
    meta: [
        { name: 'description', content: pageDescription.value },
        { name: 'keywords', content: `${tagName.value},技术博客,文章列表,冰冰同学` },
        { property: 'og:type', content: 'website' },
        { property: 'og:title', content: pageTitle.value },
        { property: 'og:description', content: pageDescription.value },
        { property: 'og:url', content: canonicalUrl.value },
        { name: 'twitter:card', content: 'summary' },
        { name: 'twitter:title', content: pageTitle.value },
        { name: 'twitter:description', content: pageDescription.value },
    ],
    script: [
        {
            type: 'application/ld+json',
            innerHTML: JSON.stringify({
                '@context': 'https://schema.org',
                '@type': 'BreadcrumbList',
                itemListElement: [
                    {
                        '@type': 'ListItem',
                        position: 1,
                        name: '首页',
                        item: siteUrl,
                    },
                    {
                        '@type': 'ListItem',
                        position: 2,
                        name: tagName.value || '标签',
                        item: canonicalUrl.value,
                    },
                ],
            }),
        },
    ],
}))

// 兼容兜底：若有外部链接还在用旧的 /tag?tagName=xxx 形态，
// 这里在挂载阶段做一次 client-side replace 跳到新路径
onMounted(() => {
    if (route.query.tagName && typeof route.query.tagName === 'string') {
        router.replace({
            path: `/tag/${encodeURIComponent(route.query.tagName)}`,
            query: route.query.page ? { page: route.query.page } : {},
        })
    }
})
</script>

<style scoped>
.tipCard {
    margin-top: 0;
}
</style>
