<template>
    <div class="panel panel-default mb-20">
        <div class="search_session">
            <form id="search" @submit.prevent="handleSearch">
                <input type="text" name="q" maxlength="30" autocomplete="off" placeholder="请输入关键词..."
                    v-model.trim="keyword">
                <button type="submit" class="submit iconfont">&#xeafe;</button>
            </form>
        </div>
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
.search_session {
    padding: 0;
    height: 42px;
}

form {
    display: flex;
    align-content: center;
    justify-content: space-between;
}

.search_session form input {
    border: transparent;
    padding: 0 15px;
    background-color: #fff;
    width: 100%;
    height: 42px;
}

.search_session form button {
    border: transparent;
    font-size: 22px;
    background-color: #f4f4f4;
    height: 42px;
    padding: 0 9px;
}
</style>