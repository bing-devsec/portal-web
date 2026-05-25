<template>
    <section class="l-container l-main-aside pt-20">
        <div class="l-main">
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

        <aside class="l-aside">
            <HotListCard :hot-articles="hotArticles" />
            <TagCard :tags="tags" />
            <LinkCard :friend-links="friendLinks" />
        </aside>
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

    /* Element Plus 的 .el-timeline.is-start 默认 padding-left: 40px，
       移动端屏幕窄，这 40px 顶距占用了内容横向空间，去掉让时间线贴左排布。
       padding-right 保持 0 不变（Element Plus 默认值）。 */
    .el-timeline.is-start {
        padding-left: 0;
    }
}
</style>