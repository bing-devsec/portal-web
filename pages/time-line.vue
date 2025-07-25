<template>
    <section class="container pt-20">
        <div class="col-sm-9 col-md-9">
            <el-timeline>
                <el-timeline-item class="my-custom-timeline-item" v-for="(item, index) in articleList" :key="index"
                    :timestamp="item.time" type="success" placement="top" size="large">
                    <el-col :span="24">
                        <el-card shadow="hover">
                            <ArticleCardByYear :articles="item.list" :isExpanded="expandedIndex === index"
                                @toggle="toggleExpand(index)"></ArticleCardByYear>
                        </el-card>
                    </el-col>
                </el-timeline-item>
            </el-timeline>
        </div>

        <div class="col-sm-3 col-md-3">
            <HotListCard :hot-articles="hotArticles" />
            <TagCard :tags="tags" />
            <LinkCard :friend-links="friendLinks" />
        </div>
        <returnTop></returnTop>
    </section>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useApiData } from '~/utils/api';
import ArticleCardByYear from '~/components/ArticleCardByYear.vue';

interface TimelineListItem {
    id: string;
    title: string;
    createTime: string;
}

interface TimelineRowsItem {
    time: string;
    list: TimelineListItem[];
}

interface TimelineData {
    rows: TimelineRowsItem[];
    total: number;
}

const { data: timelineData } = useApiData<TimelineData>('/user/article/timeline');
const articleList = computed(() => timelineData.value?.rows ?? []);
const expandedIndex = ref<number | null>(null);

// 切换展开
const toggleExpand = (index: number) => {
    if (expandedIndex.value === index) {
        expandedIndex.value = -1;
    } else {
        expandedIndex.value = index;
    }
};

// 获取热门文章列表、标签列表和友情链接列表
interface HotArticle {
    id: string;
    title: string;
    viewNum: number;
}

interface HotArticleResponse {
    rows: HotArticle[];
}

interface Tag {
    name: string;
    articleNum: number;
}

interface TagResponse {
    rows: Tag[];
}

interface Link {
    id: string;
    name: string;
    url: string;
}

interface LinkResponse {
    rows: Link[];
}

// 使用 useApiData 获取热门文章列表
const { data: hotArticleData } = useApiData<HotArticleResponse>('/user/article/hot');
const hotArticles = computed(() => hotArticleData.value?.rows || []);

// 使用 useApiData 获取标签列表
const { data: tagData } = useApiData<TagResponse>('/user/tag/list');
const tags = computed(() => tagData.value?.rows || []);

// 使用 useApiData 获取友情链接列表
const { data: linkData } = useApiData<LinkResponse>('/user/link');
// 基于ID生成稳定的随机类名
const getRandomClass = (id: string) => {
    const hash = id.split('').reduce((acc, char) => {
        return ((acc << 5) - acc) + char.charCodeAt(0) | 0;
    }, 0);
    return Math.abs(hash % 9).toString();
};

const friendLinks = computed(() => {
    if (!linkData.value?.rows) return [];
    return linkData.value.rows
        .sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN', { sensitivity: 'variant' }))
        .map(link => ({
            ...link,
            randomClass: getRandomClass(link.id)
        }));
});
</script>

<style>
.my-custom-timeline-item .el-timeline-item__tail {
    left: 4px;
    border-left: 3px solid #fff;
}

.my-custom-timeline-item .el-timeline-item__timestamp.is-top {
    font-size: 18px;
}

.my-custom-timeline-item .el-timeline-item__wrapper {
    top: -5px;
}

@media(max-width: 576px) {
    .my-custom-timeline-item .el-timeline-item__wrapper {
        padding-left: 15px;
        top: -5px;
    }
}
</style>