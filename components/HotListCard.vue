<template>
    <div class="bg-fff box-shadow radius mb-20">
        <div class="tab-category">
            <a href="#"><strong>热门推荐</strong></a>
        </div>
        <div class="tab-category-item">
            <ul class="hot-list">
                <li v-for="article in hotArticles" :key="article.id" class="hot-item">
                    <NuxtLink
                        class="hot-link"
                        :to="`/article-detail/${article.id}`"
                        :prefetch="canPrefetch(article.id)"
                    >
                        <span class="hot-title">{{ article.title }}</span>
                        <span class="hot-meta">{{ article.viewNum }} 阅读</span>
                    </NuxtLink>
                </li>
            </ul>
        </div>
    </div>
</template>

<script setup lang="ts">
import { shouldPrefetchArticle } from '~/composables/usePrefetchDedup'

interface HotArticle {
    id: string;
    title: string;
    viewNum: number;
}

defineProps<{hotArticles: HotArticle[]}>();

// 文章 _payload.json 预取名额：'hot' 命名空间。
// 若主列表（'main'）已经领走该 id 的预取名额，这里返回 false，避免重复请求。
const canPrefetch = (id: string) => shouldPrefetchArticle(id, 'hot')
</script>

<style scoped>
.hot-list {
    margin: 0;
    padding: 0;
}

.hot-item {
    list-style: none;
}

.hot-link {
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 34px;
    padding: 0 4px;
    color: #263238;
    font-size: 14px;
    text-decoration: none;
    cursor: pointer;
    touch-action: manipulation;
    -webkit-tap-highlight-color: rgba(0, 172, 193, 0.12);
}

.hot-title {
    flex: 1;
    min-width: 0;
    margin-right: 10px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.hot-meta {
    flex-shrink: 0;
    color: #8a6a32;
    font-size: 13px;
    white-space: nowrap;
}

.hot-link:active {
    color: #00acc1;
    background-color: rgba(0, 172, 193, 0.06);
}

@media (hover: hover) and (pointer: fine) {
    .hot-link:hover {
        color: #00acc1;
        background-color: rgba(0, 172, 193, 0.05);
        text-decoration: none;
    }

    .hot-link:hover .hot-meta {
        color: #a05f1c;
    }
}
</style>
