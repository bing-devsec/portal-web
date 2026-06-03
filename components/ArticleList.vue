<template>
    <div>
        <ul class="index_arc">
            <ArticleCard
                v-for="article in articles"
                :key="article.id"
                :article-info="article"
                :show-article-tag="showArticleTag"
            />
        </ul>
        <Pagination 
            :total="total" 
            :current-page="currentPage" 
            :page-size="pageSize"
            @update:current-page="handlePageChange" 
        />
    </div>
</template>

<script setup lang="ts">
interface ArticleItem {
    id: string
    title: string
    tagName: string
    describe: string
    createTime: string
    updateTime: string
    viewNum: number
}

withDefaults(defineProps<{
    articles: ArticleItem[]
    total: number
    showArticleTag?: boolean
}>(), {
    showArticleTag: false
});

const pageSize = 10;
const paginationStore = usePaginationStore();
const currentPage = computed(() => paginationStore.currentPage);
const handlePageChange = (newPage: number) => {
    paginationStore.setCurrentPage(newPage);
}
</script>

<style scoped>
.index_arc {
    margin: 0;
    padding: 0;
}
</style>
