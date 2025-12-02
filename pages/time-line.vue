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

// 使用统一的侧边栏数据 composable，实现跨页面数据共享
const { hotArticles, tags, friendLinks } = useSidebarData();
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