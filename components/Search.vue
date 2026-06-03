<template>
    <div class="search-card">
        <form id="search" class="search-form" @submit.prevent="handleSearch">
            <input
                v-model.trim="keyword"
                class="search-input"
                type="text"
                name="q"
                maxlength="30"
                autocomplete="off"
                placeholder="搜索文章关键词..."
            >
            <button type="submit" class="search-button iconfont" aria-label="搜索">&#xeafe;</button>
        </form>
    </div>
</template>

<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router';
import { ElNotification } from 'element-plus';
import { useSearchStore } from '~/stores/search';

const route = useRoute();
const router = useRouter();
const searchStore = useSearchStore();
const keyword = ref<string>((route.query.name as string) || '');

// 处理搜索提交
const handleSearch = async () => {
    if (!isValidKeyword(keyword.value)) return

    try {
        // 重置搜索状态
        searchStore.setCurrentPage(1);
        searchStore.setPage(1);
        searchStore.clearResults();

        // 导航到搜索结果页
        await router.push({
            path: '/search-result',
            query: { name: keyword.value }
        })
    } catch (error) {
        showErrorNotification("失败", error instanceof Error ? error.message : '加载数据失败')
    }
}

// 关键词验证
const isValidKeyword = (value: string) => {
    if (!value.trim()) {
        if (import.meta.client) {
            ElNotification({
                title: '提示',
                message: '请输入有效的搜索关键词',
                type: 'warning'
            })
        }
        return false
    }
    return true
}

// 显示错误通知
const showErrorNotification = (title: string, message: string) => {
    if (import.meta.client) {
        ElNotification({
            title: title,
            message: message,
            type: 'error',
        })
    }
}
</script>

<style scoped>
.search-card {
    margin-bottom: 20px;
    background-color: #fff;
}

.search-form {
    display: flex;
    align-items: center;
    height: 42px;
}

.search-input {
    flex: 1;
    min-width: 0;
    height: 42px;
    padding: 0 14px;
    color: #45515c;
    background-color: transparent;
    border: 0;
    font-size: 14px;
    outline: none;
    touch-action: manipulation;
}

.search-input::placeholder {
    color: #a3adb8;
}

.search-button {
    flex-shrink: 0;
    width: 44px;
    height: 42px;
    color: #00acc1;
    background-color: rgba(77, 208, 225, 0.08);
    border: 0;
    font-size: 19px;
    line-height: 42px;
    cursor: pointer;
    touch-action: manipulation;
    -webkit-tap-highlight-color: rgba(0, 172, 193, 0.14);
    transition: color .2s ease, background-color .2s ease;
}

.search-button:active {
    color: #00838f;
    background-color: rgba(77, 208, 225, 0.16);
}

@media (hover: hover) and (pointer: fine) {
    .search-button:hover {
        color: #00838f;
        background-color: rgba(77, 208, 225, 0.14);
    }
}
</style>
