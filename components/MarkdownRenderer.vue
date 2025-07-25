<template>
    <MdPreview :key="editorId" :showCodeRowNumber=true :editorId="editorId" :model-value="renderedContent"
        style="word-break: normal;" :previewTheme="previewTheme" :codeTheme="codeTheme">
    </MdPreview>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { MdPreview } from 'md-editor-v3';
import 'md-editor-v3/lib/preview.css';

const props = defineProps<{
    content: string;
    editorId: string;
}>();

// 使用计算属性优化渲染
const previewTheme = 'default';
const codeTheme = 'atom';

// 处理渲染内容的计算属性
const renderedContent = computed(() => {
    if (!props.content) return '';
    return props.content;
});
</script>

<style scoped>
:deep(.mobile-optimized .default-theme h2) {
    border-bottom: 1px solid #4dd0e1;
    padding: 5px 0;
    margin: 0.8em 0 0.4em;
    font-size: 1.4rem !important;
}

:deep(.mobile-optimized .default-theme h3) {
    color: #4dd0e1;
    padding: 2px 0 !important;
    margin: 0.6em 0 0.3em !important;
    font-size: 1.2rem;
    border-bottom: none !important;
    width: auto !important;
}

@media(max-width:576px) {
    :deep(.md-editor-preview-wrapper) {
        position: relative;
        flex: 1;
        box-sizing: border-box;
        overflow: auto;
        padding: 10px 5px;
    }
}

:deep(.default-theme table tr th) {
    color: #4f4f4f;
    word-break: normal !important;
    text-align: center !important;
    font-weight: 700;
    background-color: #eff3f5;
    border: 1px solid #ccc;
}

:deep(.default-theme tbody tr td) {
    text-align: left !important;
    border: 1px solid #ccc;
}

:deep(code) {
    font-size: 16px;
    display: inline;
}

:deep(.default-theme pre code .code-block) {
    display: inline-block;
    vertical-align: bottom;
    overflow-x: auto;
    white-space: pre;
    text-wrap: nowrap;
}

/* 图片样式定义 */
:deep(.default-theme img) {
    border: 0px solid var(--md-theme-border-color);
    display: flex;
    justify-content: center;
    align-items: center;
    max-width: 100%;
    height: auto;
}

:deep(.default-theme figure) {
    display: flex;
    justify-content: center;
    align-items: center;
    margin: 1em 0;
}

/* 开始自定义H2的样式 */
:deep(.default-theme h2),
:deep(.default-theme h3),
:deep(.default-theme h4),
:deep(.default-theme h5),
:deep(.default-theme h6) {
    margin: 1.0em 0 .6em;
    color: #333;
    position: relative;
    cursor: text;
}

:deep(.default-theme h2:after),
:deep(.default-theme h2:before) {
    content: "";
    display: block;
    position: absolute;
    bottom: 0;
}

:deep(.default-theme h2:before) {
    width: 24px;
    height: 24px;
    left: 0;
    top: 0;
    margin: auto;
    background-size: 24px 24px;
    background-image: url(../assets/img/h2_before.png);
}

:deep(.default-theme h2:after) {
    right: 0;
    content: "";
    width: 40%;
    height: 10px;
    margin: auto;
    display: inline-block;
    border-top-right-radius: 24px;
    background: linear-gradient(90deg, #fff, #4dd0e1);
    max-width: 50vw;
}

:deep(h2) {
    display: block;
    border-bottom: 4px solid #4dd0e1;
    font-size: 1.6rem !important;
    padding: 7px 32px;
}

:deep(.on-focus-mode h2.md-end-block.md-heading:not(.md-focus):not(.md-focus-container):after) {
    background-color: var(--blur-text-color) !important;
}

/* 结束自定义H2的样式 */

/* 开始自定义H3的样式 */
:deep(.default-theme h3:before) {
    border-bottom: 2px solid #4dd0e1;
    width: 100%;
    content: "";
    display: block;
    height: 28px;
    position: absolute;
    left: 0;
    top: 8px;
    bottom: -2px;
    margin: auto;
    background-size: 28px 28px;
    background-image: url(../assets/img/h3_before.png);
    background-repeat: no-repeat;
    animation: h3AnimationBefore 2s infinite alternate;
}

/* 动画效果 */
@keyframes h3AnimationBefore {
    0% {
        width: 28px;
    }

    25% {
        width: 100%;
    }

    50% {
        width: 100%;
    }

    100% {
        width: 100%;
    }
}

:deep(.default-theme h3:after) {
    content: "";
    display: block;
    width: 28px;
    height: 28px;
    position: absolute;
    border: 2px solid #4dd0e1;
    border-radius: 50%;
    right: -15px;
    top: 8px;
    bottom: 0;
    margin: auto;
    background-size: 28px 28px;
    background-image: url(../assets/img/h3_after.png);
    animation: h3AnimationAfter 2s infinite alternate;
}

@keyframes h3AnimationAfter {
    0% {
        transform: rotate3d(0, 0, 1, 0);
    }

    10% {
        transform: rotate3d(0, 0, 1, 0);
    }

    50% {
        transform: rotate3d(0, 0, 1, -360deg);
    }

    100% {
        transform: rotate3d(0, 0, 1, -360deg);
    }
}

:deep(.default-theme h3) {
    margin: 8px 0 !important;
    font-size: 1.3rem;
    position: relative !important;
    padding: 4px 32px !important;
    width: max-content !important;
}

:deep(.on-focus-mode h3.md-end-block.md-heading:not(.md-focus):not(.md-focus-container):after) {
    background-color: var(--blur-text-color) !important;
}

:deep(.default-theme h4) {
    font-size: 1.1rem;
    color: #4dd0e1;
}

:deep(.default-theme h5) {
    font-size: 1.0rem;
    color: #4dd0e1;
}

:deep(.default-theme pre) {
    padding: 0;
    border: 0;
}

:deep(.default-theme p) {
    line-height: 1.6;
    margin: 0;
    padding: .3rem 0;
}

:deep(.default-theme ul li p) {
    line-height: 1.6;
    margin: 0;
    padding: 0;
}

:deep(.default-theme ul>li) {
    list-style: disc;
}

:deep(.default-theme ul > li ul > li) {
    list-style-type: circle;
}

:deep(.default-theme ul > li ul > li ul > li) {
    list-style-type: square;
}

:deep(.default-theme ul li) {
    line-height: 1.6;
    margin: .1em 0;
}

:deep(.default-theme ul li p) {
    word-break: normal !important;
}

:deep(.default-theme ul li) {
    word-break: normal !important;
}

:deep(.default-theme ol li) {
    word-break: normal !important;
}

:deep(ul),
:deep(ol) {
    list-style: normal;
}

:deep(.default-theme p) {
    word-break: normal !important;
}

:deep(.default-theme blockquote) {
    padding: .2em .8em;
    background-color: #e4f8fb;
    border-left: 5px solid #4dd0e1;
}
</style>