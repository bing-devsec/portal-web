<template>
    <div class="text-c mb-20" id="moreArticle">
        <el-pagination background layout="prev, pager, next" :total="total" :current-page="currentPage"
            :page-size="pageSize" :pager-count="5" @current-change="handlePageChange" class="radius" />
    </div>
</template>

<script setup lang="ts">
interface Props {
    total?: number
    currentPage?: number
    pageSize?: number
}

// 使用 withDefaults 设置默认值
const props = withDefaults(defineProps<Props>(), {
    total: 0,
    currentPage: 1,
    pageSize: 10
})

const emit = defineEmits<{
    (e: 'update:current-page', page: number): void
}>()

// 处理页码变化
const handlePageChange = (newPage: number) => {
    emit('update:current-page', newPage)
}
</script>

<style scoped>
.radius {
    padding: 6px;
    background-color: white;
    display: flex;
    justify-content: center;
}

:deep(.el-pagination.is-background .el-pager li) {
    margin: 0 3px !important;
}
</style>