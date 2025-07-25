<template>
    <div class="bg-fff box-shadow radius mb-20">
        <div class="tab-category">
            <a href="#"><strong>热门推荐</strong></a>
        </div>
        <div class="tab-category-item">
            <ul class="index_recd">
                <li v-for="article in hotArticles" :key="article.id" class="hotTips">
                    <NuxtLink :to="`/article-detail/${article.id}`">
                        <span>{{ article.title }}</span>
                        <p class="hits">
                            <i class="iconfont icon-eye" title="点击量"></i>
                            <span style="font-size: 14px">&nbsp;{{ article.viewNum }}</span>
                        </p>
                    </NuxtLink>
                </li>
            </ul>
        </div>
    </div>
</template>

<script setup lang="ts">
interface HotArticle {
    id: string;
    title: string;
    viewNum: number;
}

defineProps<{hotArticles: HotArticle[]}>();
</script>

<style scoped>
.index_recd .hotTips a:hover {
    text-decoration: none;
    color: #fc5531;
}

.index_recd li:hover {
    border-radius: 3px;
    cursor: pointer;
    background-color: #efefef;
}

.index_recd li {
    background-color: #fff;
    line-height: 35px;
    height: 35px;
    white-space: nowrap;
    overflow: hidden;
    font-style: oblique;
    font-size: 14px;
}

.index_recd li a {
    color: #f22c00;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
}

.index_recd li a span {
    max-width: 67%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 14px;
    vertical-align: top;
    font-style: normal;
}

.index_recd li a .hits {
    color: #666;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    width: 62px;
}

.index_recd li a .hits i {
    font-weight: 500;
}
</style>