<template>
    <el-empty :image-size="320" description="404">
        <el-button type="info" @click.prevent="returnIndex">返回首页</el-button>
    </el-empty>
</template>

<script setup lang="ts">
const returnIndex = () => {navigateTo('/')}
</script>

<style scoped>
:deep(.el-empty__description p) {
    font-size: 36px;
}
</style>