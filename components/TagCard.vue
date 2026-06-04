<template>
    <div class="bg-fff box-shadow radius mb-20">
        <div class="tab-category">
            <a href="#"><strong>博客分类</strong></a>
        </div>
        <div class="tab-category-item">
            <ul class="category-list">
                <li v-for="tag in tags" :key="tag.name" class="category-item">
                    <a
                        href="#"
                        class="category-link"
                        :class="{ active: currentTagName === tag.name }"
                        @click.prevent="handleTagClick(tag.name)"
                    >
                        <span class="category-name">{{ tag.name }}</span>
                        <span class="article-num">{{ tag.articleNum }} 篇</span>
                    </a>
                </li>
            </ul>
        </div>
    </div>
</template>

<script setup lang="ts">
import { useRouter, useRoute } from 'vue-router';
import { usePaginationStore } from '~/stores/pagination';

interface Tag {
    name: string;
    articleNum: number;
}

defineProps<{
    tags: Tag[];
}>();

const router = useRouter();
const route = useRoute();
const paginationStore = usePaginationStore();
const currentTagName = computed(() => {
    if (!route.path.startsWith('/tag/')) return '';
    const raw = route.params.name as string | undefined;
    return raw ? decodeURIComponent(raw) : paginationStore.currentTagName;
});

// 上次点击的标签
const lastClickedTag = ref('');

// 处理标签点击
const handleTagClick = (tagName: string) => {
    const isTagPage = route.path.startsWith('/tag/');
    // 已在该标签页则不重复跳转
    if (isTagPage && currentTagName.value === tagName) {
        return;
    }

    // 避免快速点击相同标签
    if (lastClickedTag.value === tagName) {
        const now = Date.now();
        if (now - lastClickTime < 500) { // 500ms防抖
            return;
        }
    }

    lastClickedTag.value = tagName;
    lastClickTime = Date.now();

    // 重置页码，然后设置标签名
    paginationStore.resetPagination();
    paginationStore.setCurrentTagName(tagName);

    // 路由策略：
    //   - 当前已在 /tag/* 路径：用 replace 仅替换路径，避免历史栈累积同类记录
    //   - 来自其他页面：用 push 保留来源页，便于移动端左滑返回手势使用
    const target = '/tag/' + encodeURIComponent(tagName);
    if (isTagPage) {
        router.replace(target);
    } else {
        router.push(target);
    }
};

// 用于防抖的时间标记
let lastClickTime = 0;
</script>

<style scoped>
.category-list {
    margin: 0;
    padding: 0;
}

.category-item {
    list-style: none;
}

.category-link {
    font-size: 14px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 34px;
    padding: 0 4px;
    color: #263238;
    text-decoration: none;
    cursor: pointer;
    touch-action: manipulation;
    -webkit-tap-highlight-color: rgba(0, 172, 193, 0.12);
}

.category-name {
    flex: 1;
    min-width: 0;
    margin-right: 10px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.article-num {
    flex-shrink: 0;
    color: #586a8a;
    font-size: 13px;
    white-space: nowrap;
}

.category-link.active {
    color: #00acc1;
}

.category-link.active .article-num {
    color: #00acc1;
}

.category-link:active {
    color: #00acc1;
    background-color: rgba(0, 172, 193, 0.06);
}

@media (hover: hover) and (pointer: fine) {
    .category-link:hover {
        color: #00acc1;
        background-color: rgba(0, 172, 193, 0.05);
    }

    .category-link:hover .article-num {
        color: #00acc1;
    }
}
</style>
