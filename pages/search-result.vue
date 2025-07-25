<template>
    <section class="container pt-20">
        <div class="col-sm-9 col-md-9">
            <TipCard :tip-msg="searchMsg" class="tipCard" />
            <ul class="index_arc">
                <ArticleCard v-for="article in searchResults" :key="article.id" :article-info="article" />
            </ul>
            <Pagination :total="total" :current-page="currentPage" :page-size="pageSize"
                @update:current-page="handleCurrentChange" />
        </div>

        <div class="col-sm-3 col-md-3">
			<HotListCard :hot-articles="hotArticles" />
			<TagCard :tags="tags" />
			<LinkCard :friend-links="friendLinks" />
        </div>
    </section>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useSearchStore } from '~/stores/search';
import { usePaginationStore } from '~/stores/pagination';

const router = useRouter();
const route = useRoute();
const searchStore = useSearchStore();
const paginationStore = usePaginationStore();
const pageSize = 10;

// 从URL获取关键词和页码
const keyword = computed(() => route.query.name as string);
const currentPage = ref(parseInt(route.query.page as string || '1') || 1);

// 监听路由变化，更新页码
watch(
    () => route.query,
    (query) => {
        const page = parseInt(query.page as string || '1') || 1;
        currentPage.value = page;
        
        // 同步到store
        searchStore.setCurrentPage(page);
        searchStore.setPage(page);
        paginationStore.setCurrentPage(page);
    },
    { immediate: true }
);

// 定义文章类型
interface ArticleItem {
    id: string;
    title: string;
    tagName: string;
    describe: string;
    createTime: string;
    updateTime: string;
    viewNum: number;
}

// 获取搜索结果
const fetchSearchResults = async () => {
    if (!keyword.value) return;
    
    return useApiData<{
        rows: ArticleItem[];
        total: number;
    }>('/user/article/search', {
        params: {
            word: keyword.value,
            page: currentPage.value,
            pageSize
        }
    });
};

// 使用响应式引用存储API调用结果
const { data: searchData, refresh: refreshSearch } = await fetchSearchResults() || { data: ref(null), refresh: () => {} };

// 计算属性获取搜索结果
const searchResults = computed(() => {
    if (searchData.value?.rows) {
        searchStore.setSearchResults({ rows: searchData.value.rows });
        searchStore.setTotal(searchData.value.total);
        return searchData.value.rows;
    }
    return [];
});

// 计算属性获取总数
const total = computed(() => searchData.value?.total || 0);

// 计算属性获取搜索提示信息
const searchMsg = computed(() => {
    if (!keyword.value) return '请输入搜索关键词';
    if (searchResults.value.length === 0) return '没有找到相关内容';
    return `关于 ${keyword.value} 的搜索结果`;
});

// 分页处理
const handleCurrentChange = async (page: number) => {
    // 更新URL中的页码
    await router.push({
        path: route.path,
        query: {
            ...route.query,
            page: page.toString()
        }
    });
    
    // 手动刷新数据
    await refreshSearch({
        params: {
            word: keyword.value,
            page,
            pageSize
        }
    });
};

// 监听关键词变化，重置页码
watch(keyword, async (newKeyword, oldKeyword) => {
    if (newKeyword && newKeyword !== oldKeyword) {
        await router.push({
            path: route.path,
            query: {
                name: newKeyword,
                page: '1'
            }
        });
    }
}, { immediate: false });

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

interface BaseLink {
	id: string;
	name: string;
	url: string;
}

interface Link extends BaseLink {
	randomClass: string;
}

interface LinkResponse {
	rows: BaseLink[];
}

// 使用 useApiData 获取热门文章列表
const { data: hotArticleData } = useApiData<HotArticleResponse>('/user/article/hot')
const hotArticles = computed(() => hotArticleData.value?.rows || [])

// 使用 useApiData 获取标签列表
const { data: tagData } = useApiData<TagResponse>('/user/tag/list')
const tags = computed(() => tagData.value?.rows || [])

// 使用 useApiData 获取友情链接列表
const { data: linkData } = useApiData<LinkResponse>('/user/link')

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