<template>
    <li class="no_pic" @dblclick="navigateToArticle">
        <h4 class="title">
            <NuxtLink :to="articleLink">{{ articleInfo.title }}</NuxtLink>
        </h4>
        <div class="desc">{{ articleInfo.describe }}</div>
        <div class="date_hits">
            <span>
                <i class="iconfont icon-calendar-v2"></i>&nbsp;{{ articleInfo.createTime }}
            </span>
            <span>
                <i class="iconfont icon-eye"></i>
                <p>&nbsp;{{ articleInfo.viewNum }}</p>
            </span>
        </div>
    </li>
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

const props = defineProps<{ articleInfo: ArticleItem}>()
const articleLink = computed(() => `/article-detail/${props.articleInfo.id}`)
const navigateToArticle = () => {navigateTo(articleLink.value)}
</script>

<style scoped>
.no_pic {
    cursor: pointer;
}

li .desc {
    color: #333;
    margin-top: 8px;
    height: 50px;
    line-height: 24px;
    max-height: 48px; 
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    text-overflow: ellipsis;
}

li {
    position: relative;
    height: 110px;
    margin-bottom: 15px;
    list-style: none;
    background-color: #fff;
    border: solid 1px #ddd;
    box-shadow: 0 8px 18px rgba(0, 0, 0, 0.06);
    transition: all .2s ease-out;
}

li .date_hits {
    display: flex;
    align-content: center;
    justify-content: start;
}

li .date_hits {
    float: left;
    position: relative;
    line-height: 20px;
    font-size: 15px;
    color: #666;
    top: 10px;
}

.date_hits {
    width: 100%;
}

li .date_hits span:nth-child(1) {
    width: 120px;
}

li .date_hits span:nth-child(2) {
    width: 75px;
}

li .date_hits span:nth-child(2) p {
    position: relative;
    top: -22px;
    left: 18px;
}

li .date_hits span {
    float: left;
    display: block;
    margin-right: 35px;
    height: 20px;
    line-height: 20px;
}

li .date_hits span a {
    color: skyblue;
}

li .date_hits span a:hover {
    text-decoration-line: none;
}

li .title a {
    color: #4dd0e1;
}

li .title a:hover {
    text-decoration: none;
    color: #fc5531;
}

@media(max-width: 576px) {
    .index_arc .no_pic {
        padding: 12px !important;
    }

    .index_arc .no_pic .title {
        margin-top: 5px;
    }

    .date_hits {
        width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    li .date_hits span:nth-child(1) {
        width: 130px;
    }

    li .date_hits span:nth-child(2) {
        width: 40px
    }
}
</style>