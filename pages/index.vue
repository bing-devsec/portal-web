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

// 使用统一的侧边栏数据 composable，实现跨页面数据共享
const { hotArticles, tags, friendLinks } = useSidebarData();
</script>

<style scoped>
.container {
	margin-top: 20px;
	margin-bottom: 20px;
}
</style>