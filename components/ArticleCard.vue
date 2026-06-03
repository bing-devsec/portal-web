<template>
    <li class="no_pic" @dblclick="navigateToArticle">
        <h2 class="title">
            <NuxtLink :to="articleLink" :prefetch="canPrefetch">{{ articleInfo.title }}</NuxtLink>
        </h2>
        <div class="desc">{{ articleInfo.describe }}</div>
        <div class="date_hits">
            <span class="meta-item">
                {{ articleInfo.createTime }}
            </span>
            <span class="meta-divider">·</span>
            <span class="meta-item">
                {{ articleInfo.viewNum }} 阅读
            </span>
            <template v-if="showArticleTag && articleInfo.tagName">
                <span class="meta-divider">·</span>
                <a
                    href="#"
                    class="article-tag"
                    @click.prevent.stop="handleTagClick(articleInfo.tagName)"
                    @dblclick.stop
                >
                    {{ articleInfo.tagName }}
                </a>
            </template>
        </div>
    </li>
</template>

<script setup lang="ts">
import { useRouter, useRoute } from 'vue-router'
import { shouldPrefetchArticle } from '~/composables/usePrefetchDedup'
import { usePaginationStore } from '~/stores/pagination'

interface ArticleItem {
    id: string
    title: string
    tagName: string
    describe: string
    createTime: string
    updateTime: string
    viewNum: number
}

const props = withDefaults(defineProps<{
    articleInfo: ArticleItem
    showArticleTag?: boolean
}>(), {
    showArticleTag: false
})

const router = useRouter()
const route = useRoute()
const paginationStore = usePaginationStore()
const articleLink = computed(() => `/article-detail/${props.articleInfo.id}`)
// 文章 _payload.json 预取名额：'main' 命名空间，与 HotListCard('hot') 共享去重池
const canPrefetch = computed(() => shouldPrefetchArticle(props.articleInfo.id, 'main'))
const navigateToArticle = () => {navigateTo(articleLink.value)}
const handleTagClick = (tagName: string) => {
    const isTagPage = route.path === '/tag'
    const currentTagName = route.query.tagName as string || paginationStore.currentTagName

    if (isTagPage && currentTagName === tagName) {
        return
    }

    paginationStore.resetPagination()
    paginationStore.setCurrentTagName(tagName)
    router.replace({
        path: '/tag',
        query: { tagName }
    })
}
</script>

<style scoped>
.no_pic {
    box-sizing: border-box;
    cursor: default;
    position: relative;
    display: flex;
    flex-direction: column;
    height: 144px;
    padding: 15px 18px;
    margin-bottom: 14px;
    list-style: none;
    background-color: rgba(255, 255, 255, 0.96);
    border: 1px solid rgba(15, 23, 42, 0.08);
    box-shadow: 0 6px 18px rgba(15, 23, 42, 0.06);
    transition: box-shadow .2s ease-out, border-color .2s ease-out;
}

/* 标题：从 SEO 角度用 h2（h1 留给站点/页面主标题），
   视觉上保持列表卡片的轻量层级。 */
li .title {
    margin: 0 0 7px;
    font-size: 18px;
    font-weight: 600;
    line-height: 1.45;
}

li .title a {
    display: block;
    cursor: pointer;
    color: #263238;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    touch-action: manipulation;
    -webkit-tap-highlight-color: rgba(0, 172, 193, 0.14);
}

li .desc {
    flex: 0 0 calc(14px * 1.65 * 2);
    margin: 0;
    color: #5f6b76;
    font-size: 14px;
    line-height: 1.65;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    text-overflow: ellipsis;
}

.date_hits {
    display: flex;
    flex-wrap: nowrap;
    align-items: center;
    gap: 0 8px;
    width: 100%;
    margin-top: auto;
    padding-top: 10px;
    color: #8f9aa5;
    font-size: 13px;
    line-height: 1.4;
    cursor: default;
    overflow: hidden;
}

.meta-item,
.article-tag {
    display: inline-flex;
    align-items: center;
    min-width: 0;
    height: 20px;
    white-space: nowrap;
}

.meta-divider {
    position: relative;
    top: -1px;
    color: #aeb7c1;
    font-size: 20px;
    font-weight: 500;
    line-height: 20px;
    user-select: none;
}

.article-tag {
    cursor: pointer;
    color: #a3adb8;
    max-width: 120px;
    overflow: hidden;
    text-overflow: ellipsis;
    touch-action: manipulation;
    -webkit-tap-highlight-color: rgba(0, 172, 193, 0.14);
}

.article-tag::before {
    content: "#";
    margin-right: 2px;
    color: #b0bac4;
    font-size: 15px;
    font-weight: 500;
    line-height: 1;
}

li .title a:active,
.article-tag:active {
    color: #00acc1;
}

.article-tag:active::before {
    color: #00acc1;
}

/* hover 样式仅在 PC 鼠标设备启用，避免移动端返回列表时残留 sticky hover 状态。 */
@media (hover: hover) and (pointer: fine) {
    .no_pic:hover {
        border-color: rgba(15, 23, 42, 0.12);
        box-shadow: 0 10px 24px rgba(15, 23, 42, 0.08);
    }

    li .title a:hover {
        text-decoration: none;
        color: #00acc1;
    }

    .article-tag:hover {
        color: #00acc1;
        text-decoration: none;
    }

    .article-tag:hover::before {
        color: #00acc1;
    }
}

@media(max-width: 576px) {
    .index_arc .no_pic {
        height: 130px;
        padding: 12px !important;
        margin-bottom: 12px;
        box-shadow: 0 4px 14px rgba(15, 23, 42, 0.05);
    }

    .index_arc .no_pic .title {
        margin-bottom: 6px;
        font-size: 16px;
        line-height: 1.4;
    }

    li .desc {
        flex-basis: calc(13px * 1.6 * 2);
        font-size: 13px;
        line-height: 1.6;
    }

    .date_hits {
        padding-top: 8px;
        gap: 0 7px;
        font-size: 12px;
    }

    .meta-divider {
        top: -1px;
        font-size: 20px;
    }

    .article-tag {
        max-width: 45%;
    }

    .article-tag::before {
        font-size: 14px;
    }
}
</style>
