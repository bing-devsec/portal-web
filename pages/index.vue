<template>
	<section class="container">
		<div class="col-sm-9 col-md-9">
			<TipCard v-if="currentPage === 1" :tip-msg="'最新发布'" />
			<ArticleList 
				:articles="articles" 
				:total="total"
			/>
		</div>
		<div class="col-sm-3 col-md-3">
			<Search />
			<HotListCard :hot-articles="hotArticles" />
			<TagCard :tags="tags" />
			<LinkCard :friend-links="friendLinks" />
		</div>
	</section>
</template>

<script setup lang="ts">
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

const pageSize = 10;
const paginationStore = usePaginationStore();
const currentPage = computed(() => paginationStore.currentPage);

// 使用 useApiData 获取文章列表
const { data: articleData, refresh: refreshArticles } = useApiData<ArticleListResponse>('/user/article/list', {
	params: {
		page: currentPage.value,
		pageSize
	}
});
const articles = computed(() => articleData.value?.rows || []);
const total = computed(() => articleData.value?.total || 0);

// 监听页码变化刷新数据
watch(currentPage, async () => {
	await refreshArticles({
		params: {
			page: currentPage.value,
			pageSize
		}
	});
});

// 热门文章、标签、友情链接
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

// 使用 useApiData 获取热门文章列表，添加唯一缓存键
const { data: hotArticleData } = useApiData<HotArticleResponse>('/user/article/hot', {
    key: 'hot-articles-list'
});
const hotArticles = computed(() => hotArticleData.value?.rows || []);

// 使用 useApiData 获取标签列表，添加唯一缓存键
const { data: tagData } = useApiData<TagResponse>('/user/tag/list', {
    key: 'tags-list'
});
const tags = computed(() => tagData.value?.rows || []);

// 使用 useApiData 获取友情链接列表，添加唯一缓存键
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
.container {
	margin-top: 20px;
	margin-bottom: 20px;
}
</style>