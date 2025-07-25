<template>
    <div class="bg-fff box-shadow radius mb-20">
        <div class="tab-category">
            <a href="#"><strong>博客分类</strong></a>
        </div>
        <div class="tab-category-item">
            <ul class="index_recd">
                <li v-for="tag in tags" :key="tag.name" class="index_recd_item">
                    <a href="#" @click.prevent="handleTagClick(tag.name)">
                        <p>{{ tag.name }}</p>
                        <span class="article_num">(&nbsp;{{ tag.articleNum }}&nbsp;)</span>
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

// 上次点击的标签
const lastClickedTag = ref('');

// 处理标签点击
const handleTagClick = (tagName: string) => {
    // 如果当前在tag页面，并且点击的是当前显示的标签，则不做任何操作
    const isTagPage = route.path === '/tag';
    const currentTagName = route.query.tagName as string || paginationStore.currentTagName;
    
    // 避免重复点击相同标签
    if (isTagPage && currentTagName === tagName) {
        return;
    }
    
    // 避免快速点击相同标签
    if (lastClickedTag.value === tagName) {
        const now = Date.now();
        if (now - lastClickTime < 500) { // 500ms防抖
            return;
        }
    }
    
    // 更新最后点击的标签和时间
    lastClickedTag.value = tagName;
    lastClickTime = Date.now();
    
    // 重置页码，然后设置标签名
    paginationStore.resetPagination();
    paginationStore.setCurrentTagName(tagName);
    
    // 导航到标签页 - 使用replace而不是push以避免历史堆栈积累
    router.replace('/tag?tagName=' + tagName);
};

// 用于防抖的时间标记
let lastClickTime = 0;
</script>

<style scoped>
.index_recd li {
    background-color: #fff;
    line-height: 35px;
    height: 35px;
    overflow: hidden;
    font-style: oblique;
}

.article_num {
    color: #222;
    width: 50px;
}

.index_recd li a {
    color: #f22c00;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 14px;
    vertical-align: top;
    display: flex;
    align-content: center;
    justify-content: space-between;
}

.index_recd li a p {
    max-width: 60%;
    overflow: hidden;
    text-overflow: ellipsis;
    font-style: normal;
}

.index_recd li a span {
    width: 50px;
    font-style: normal;
}

.index_recd li:hover {
    border-radius: 3px;
    cursor: pointer;
    background-color: #efefef;
}

.index_recd .index_recd_item a:hover {
    text-decoration: none;
    color: #fc5531;
}
</style>