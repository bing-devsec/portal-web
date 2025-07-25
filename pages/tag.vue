<template>
    <section class="container pt-20">
        <div class="col-sm-9 col-md-9">
            <TipCard :tip-msg="tagName" class="tipCard"></TipCard>
            <ul class="index_arc">
                <ArticleCard v-for="articleInfo in articleList" :key="articleInfo.id" :article-info="articleInfo">
                </ArticleCard>
            </ul>
            <Pagination :total="total" :current-page="currentPage" :page-size="pageSize"
                @update:current-page="handlePageChange">
            </Pagination>
        </div>

        <div class="col-sm-3 col-md-3">
            <HotListCard :hot-articles="hotArticles" />
            <TagCard :tags="tags" />
            <LinkCard :friend-links="friendLinks" />
        </div>
    </section>
</template>

<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router';

interface ArticleItem {
    id: string;
    title: string;
    tagName: string;
    describe: string;
    createTime: string;
    updateTime: string;
    viewNum: number;
}

interface ArticleListResponse {
    rows: ArticleItem[];
    total: number;
}

// 获取路由和状态
const route = useRoute();
const paginationStore = usePaginationStore();
const pageSize = 10;

// 使用 store 中的状态，添加防抖控制
const tagName = computed(() => paginationStore.currentTagName || route.query.tagName as string || '');
const currentPage = computed(() => paginationStore.currentPage);

// 创建一个用于控制请求的标志
const lastRequestTagName = ref('');
const lastRequestPage = ref(0);

// 创建动态缓存键，确保每次tagName和page变化时都使用新的缓存
const tagCacheKey = computed(() => `tag-articles-${tagName.value}-${currentPage.value}`);

// 当前请求的参数
const requestParams = computed(() => ({
    tagName: tagName.value,
    page: currentPage.value,
    pageSize: pageSize,
}));

// 在组件挂载时从URL获取参数
onMounted(() => {
    const tagNameFromQuery = route.query.tagName as string;
    if (tagNameFromQuery && tagNameFromQuery !== paginationStore.currentTagName) {
        paginationStore.setCurrentTagName(tagNameFromQuery);
    }
    
    // 初始化最后请求的值
    lastRequestTagName.value = tagName.value;
    lastRequestPage.value = currentPage.value;
});

// 使用固定参数初始化useApiData，避免在setup时就发起自动请求
const {
    data: articleData,
    refresh: refreshArticles,
} = useApiData<ArticleListResponse>('/user/tag/article-list', {
    params: requestParams,
    key: tagCacheKey
});

// 计算属性获取文章列表和总数
const articleList = computed(() => articleData.value?.rows || []);
const total = computed(() => articleData.value?.total || 0);

// 使用watchEffect监听参数变化并控制请求
watchEffect(() => {
    // 必须已挂载且参数有效
    if (import.meta.client && tagName.value) {
        const currentTagName = tagName.value;
        const currentPageValue = currentPage.value;
        
        // 避免重复请求相同的数据
        if (lastRequestTagName.value === currentTagName && 
            lastRequestPage.value === currentPageValue) {
            return;
        }
        
        // 更新最后请求的值
        lastRequestTagName.value = currentTagName;
        lastRequestPage.value = currentPageValue;
        
        // 手动调用刷新，传入最新参数
        refreshArticles({
            params: {
                tagName: currentTagName,
                page: currentPageValue,
                pageSize: pageSize
            }
        });
    }
});

// 处理路由参数变化
watch(
    () => route.query.tagName,
    (newTagName, oldTagName) => {
        if (newTagName && newTagName !== oldTagName) {
            paginationStore.setCurrentTagName(newTagName as string);
            paginationStore.setCurrentPage(1);
        }
    }
);

// 分页处理
const handlePageChange = (newPage: number) => {
    paginationStore.setCurrentPage(newPage);
};

// 获取热门文章列表、标签列表和友情链接列表
interface HotArticle {
    id: string;
    title: string;
    viewNum: number;
}

interface HotArticleResponse {
    rows: HotArticle[];
}

interface Tag {
    name: string;
    articleNum: number;
}

interface TagResponse {
    rows: Tag[];
}

interface Link {
    id: string;
    name: string;
    url: string;
}

interface LinkResponse {
    rows: Link[];
}

// 使用 useApiData 获取热门文章列表
const { data: hotArticleData } = useApiData<HotArticleResponse>('/user/article/hot', {
    key: 'hot-articles-list'
});
const hotArticles = computed(() => hotArticleData.value?.rows || []);

// 使用 useApiData 获取标签列表
const { data: tagData } = useApiData<TagResponse>('/user/tag/list', {
    key: 'tags-list'
});
const tags = computed(() => tagData.value?.rows || []);

// 使用 useApiData 获取友情链接列表
const { data: linkData } = useApiData<LinkResponse>('/user/link', {
    key: 'friend-links-list'
});
// 基于ID生成稳定的随机类名
const getRandomClass = (id: string) => {
    const hash = id.split('').reduce((acc, char) => {
        return ((acc << 5) - acc) + char.charCodeAt(0) | 0;
    }, 0);
    return Math.abs(hash % 9).toString();
};

const friendLinks = computed(() => {
    if (!linkData.value?.rows) return [];
    return linkData.value.rows
        .sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN', { sensitivity: 'variant' }))
        .map(link => ({
            ...link,
            randomClass: getRandomClass(link.id)
        }));
});
</script>

<style scoped>
.loading-placeholder,
.pagination-placeholder {
    padding: 15px;
    background: #f8f8f8;
    border-radius: 5px;
    margin-bottom: 20px;
}

.pagination-placeholder {
    padding: 10px;
    text-align: center;
}

.placeholder-item {
    height: 20px;
    background: #e0e0e0;
    margin-bottom: 10px;
    border-radius: 4px;
    animation: pulse 1.5s infinite;
}

.pagination-placeholder .placeholder-item {
    height: 32px;
    width: 200px;
    margin: 0 auto;
}

.placeholder-item:nth-child(1) {
    width: 80%;
}

.placeholder-item:nth-child(2) {
    width: 90%;
}

.placeholder-item:nth-child(3) {
    width: 60%;
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
</style>