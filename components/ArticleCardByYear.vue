<template>
    <div class="cd-timeline-content">
        <el-collapse v-model="activeNames" @change="handleChange">
            <el-collapse-item :title="`文章数：${articles.length}`" name="1">
                <ul>
                    <li v-for="(article, index) in articles" :key="index">
                        <NuxtLink :to="`/article-detail/${article.id}`">
                            <span><i class="article-title">{{ article.title }}</i></span>
                            <span><i class="iconfont icon-calendar-v2"></i>&nbsp;{{ article.createTime }}</span>
                        </NuxtLink>
                    </li>
                </ul>
            </el-collapse-item>
        </el-collapse>
    </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import type { CollapseModelValue } from 'element-plus';

interface Article {
    id: string;
    title: string;
    createTime: string;
}

const props = defineProps<{
    articles: Article[];
    isExpanded: boolean;
}>();

const emit = defineEmits(['toggle']);

const activeNames = ref<string[]>([]);

watch(() => props.isExpanded, (newValue) => {
    activeNames.value = newValue ? ['1'] : [];
});

const handleChange = (val: CollapseModelValue) => {
    emit('toggle');
};

onMounted(() => {
    if (props.isExpanded) {
        activeNames.value = ['1'];
    }
});
</script>

<style scoped>
.cd-timeline-content li a {
    line-height: 34px;
    font-size: 14px;
    background-color: #fff;
    height: 34px;
    display: flex;
    justify-content: space-between;

}

.cd-timeline-content li a span {
    display: flex;
    align-items: center;
}

.cd-timeline-content li a span:first-child {
    flex: 1;
    min-width: 0;
    margin-right: 10px;
}

.article-title {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
}

.cd-timeline-content li a span:last-child {
    flex-shrink: 0;
    white-space: nowrap;
}

.cd-timeline-content i {
    font-style: normal;
}

.cd-timeline-content li a:hover {
    background-color: #efefef;
}

.cd-timeline-content a:hover {
    border-radius: 3px;
    cursor: pointer;
    text-decoration: none;
    color: #fc5531;
}

:deep(.el-collapse-item__header) {
    font-size: 18px;
    font-weight: 500;
    color: #222222;
}
</style>
