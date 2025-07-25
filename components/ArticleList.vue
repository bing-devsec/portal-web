<template>
    <div>
        <ul class="index_arc">
            <ArticleCard v-for="article in articles" :key="article.id" :article-info="article" />
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

defineProps<{
    articles: ArticleItem[]
    total: number
}>();

const pageSize = 10;
const paginationStore = usePaginationStore();
const currentPage = computed(() => paginationStore.currentPage);
const handlePageChange = (newPage: number) => {
    paginationStore.setCurrentPage(newPage);
}
</script>

<style scoped>
.index_arc li {
    position: relative;
    height: 115px;
    margin-bottom: 15px;
    list-style: none;
    background-color: #fff;
    border: solid 1px #ddd;
    box-shadow: 0 8px 18px rgba(0, 0, 0, 0.06);
    transition: all .2s ease-out;
}

.index_arc li .desc {
    height: 48px;
    line-height: 24px;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    margin-top: 8px;
    color: #333;
}

.index_arc li:hover {
    box-shadow: 0 9px 18px rgba(0, 0, 0, 0.18);
    transition: all .3s ease-out;
    border-bottom: 1px solid #ccc;
}
</style>