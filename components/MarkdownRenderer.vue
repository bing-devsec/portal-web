<template>
  <div class="markdown-preview-wrapper">
    <MdPreview
      :key="renderKey"
      :id="editorId"
      :model-value="renderedContent"
      :showCodeRowNumber="showCodeRowNumber"
      :noMermaid="!hasMermaid"
      :noKatex="!hasKatex"
      :mdHeadingId="mdHeadingId"
      style="word-break: normal"
      :previewTheme="previewTheme"
      :codeTheme="codeTheme"
    >
    </MdPreview>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount, watch, nextTick } from "vue";
import { MdPreview } from "md-editor-v3";
import "md-editor-v3/lib/preview.css";

const props = defineProps<{
  content: string;
  editorId: string;
  isMobile?: boolean; // 是否为移动端
}>();

const previewTheme = "default";
const codeTheme = "atom";

const renderedContent = computed(() => {
  if (!props.content) return "";
  return props.content;
});

// 自定义标题 ID 生成函数，确保每个标题都有唯一 ID
const mdHeadingId = ({ text, level, index }: { text: string; level: number; index: number }) => {
  // 清理文本：移除特殊字符，转换为小写，用连字符连接
  const cleanText = text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '') // 移除特殊字符
    .replace(/\s+/g, '-') // 空格替换为连字符
    .replace(/-+/g, '-') // 多个连字符合并为一个
    .trim();
  
  // 使用索引确保唯一性，格式：h{level}-{index}-{text}
  return `h${level}-${index}-${cleanText}`;
};

// 移动端性能优化：检测内容是否包含 Mermaid 或 Katex
// 如果没有，可以禁用这些功能以减少 JavaScript bundle 大小
const hasMermaid = computed(() => {
  if (!props.content) return false;
  // 检测是否包含 mermaid 代码块
  return /```\s*mermaid[\s\S]*?```/i.test(props.content);
});

const hasKatex = computed(() => {
  if (!props.content) return false;
  // 检测是否包含 LaTeX 数学公式（$...$ 或 $$...$$）
  return /\$\$[\s\S]*?\$\$|\$[^$\n]+\$/.test(props.content);
});

// 响应式控制代码行号显示
const showCodeRowNumber = ref(true);
// 渲染 key，用于强制重新渲染组件
const renderKey = ref(`${props.editorId}-${Date.now()}`);

// 按需动态加载并初始化第三方库（highlight.js, mermaid）
const hljsLoaded = ref(false);
const mermaidLoaded = ref(false);

const initHighlightAndMermaid = async () => {
  if (!import.meta.client) return;

  // highlight.js
  try {
    const hljsMod = await import("highlight.js");
    const hljs = (hljsMod && (hljsMod as any).default) || hljsMod;
    if (hljs) {
      // 配置忽略未转义 HTML 的警告（安全性仍由我们在 markdown 渲染处进行转义）
      if (typeof (hljs as any).configure === "function") {
        try {
          (hljs as any).configure({ ignoreUnescapedHTML: true });
        } catch (e) {
          // 某些版本可能不支持该配置，忽略错误
        }
      }
      if (typeof (hljs as any).highlightAll === "function") {
        (hljs as any).highlightAll();
        hljsLoaded.value = true;
      }
    }
  } catch (e) {
    // 忽略加载失败
  }

  // mermaid
  if (!hasMermaid.value) return;
  try {
    const mermaidMod = await import("mermaid");
    const mermaid = (mermaidMod && (mermaidMod as any).default) || mermaidMod;
    if (mermaid) {
      mermaid.initialize?.({ startOnLoad: false });
      mermaidLoaded.value = true;
      // 等待 DOM 更新后初始化 mermaid 渲染
      await nextTick();
      // md-editor-v3 预览区域常用类 .md-editor-preview
      const containers = Array.from(
        document.querySelectorAll(
          `.md-editor-preview .language-mermaid, .md-editor-preview pre code.language-mermaid, #${props.editorId} .language-mermaid`
        )
      );
      if (containers.length) {
        try {
          mermaid.init?.(undefined, containers as any);
        } catch (e) {
          // mermaid 渲染可能需要不同的 selector，忽略错误
        }
      }
    }
  } catch (e) {
    // 忽略加载失败
  }
};

const updateCodeRowNumber = () => {
  if (typeof window === "undefined") return;
  const isLargeScreen = window.innerWidth > 576;
  const newShowCodeRowNumber = isLargeScreen;
  
  // 如果值发生变化，需要重新渲染
  if (showCodeRowNumber.value !== newShowCodeRowNumber) {
    showCodeRowNumber.value = newShowCodeRowNumber;
    // 改变 key 值强制重新渲染组件，确保行号显示/隐藏生效
    renderKey.value = `${props.editorId}-${Date.now()}`;
  }
};

let resizeTimer: ReturnType<typeof setTimeout> | null = null;
const handleResize = () => {
  if (resizeTimer) clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    updateCodeRowNumber();
  }, 150);
};

onMounted(() => {
  if (typeof window === "undefined") return;
  updateCodeRowNumber();
  window.addEventListener("resize", handleResize, { passive: true });
  // 初次挂载后按需初始化 highlight.js / mermaid（如果有）
  initHighlightAndMermaid();
});

onBeforeUnmount(() => {
  if (typeof window === "undefined") return;
  window.removeEventListener("resize", handleResize);
  if (resizeTimer) {
    clearTimeout(resizeTimer);
    resizeTimer = null;
  }
});

// 当 renderKey 或内容/mermaid 检测变化时，重新初始化第三方渲染
watch([() => renderKey.value, () => props.content, hasMermaid], async () => {
  if (import.meta.client) {
    await nextTick();
    initHighlightAndMermaid();
  }
});
</script>

<style scoped>
.markdown-preview-wrapper {
  box-sizing: border-box;
  flex: 1;
  overflow: auto;
  position: relative;
  /* 移动端性能优化：使用 GPU 加速 */
  transform: translateZ(0);
  backface-visibility: hidden;
  /* 优化渲染性能 */
  contain: layout style paint;
}

/* 大屏时设置 padding */
@media (min-width: 577px) {
  .markdown-preview-wrapper {
    padding: 10px 20px;
  }
}

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

@media (max-width: 576px) {
  /* 移动端减小列表的 padding-left */
  :deep(.md-editor-preview ol),
  :deep(.md-editor-preview ul) {
    padding-left: 1em !important;
  }

  :deep(.default-theme ol),
  :deep(.default-theme ul) {
    padding-left: 1em !important;
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
  margin: 1em 0 0.6em;
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

:deep(
    .on-focus-mode
      h2.md-end-block.md-heading:not(.md-focus):not(.md-focus-container):after
  ) {
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

/* 动画效果 - 移动端禁用动画以提升性能 */
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

/* 移动端禁用动画以提升性能 */
@media (max-width:576px) {
  :deep(.default-theme h3:before),
  :deep(.default-theme h3:after) {
    animation: none !important;
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

:deep(.default-theme h4) {
  font-size: 1.1rem;
  color: #4dd0e1;
}

:deep(.default-theme h5) {
  font-size: 1rem;
  color: #4dd0e1;
}

:deep(.default-theme pre) {
  padding: 0;
  border: 0;
}

:deep(.default-theme p) {
  line-height: 1.6;
  margin: 0;
}

:deep(.default-theme ul li p) {
  line-height: 1.6;
  margin: 0;
  padding: 0;
}

:deep(.default-theme ul > li) {
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
  margin: 0.1em 0;
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

/* PC端列表的默认 padding-left */
:deep(.md-editor-preview ol),
:deep(.md-editor-preview ul) {
  padding-left: 2.35em;
}

:deep(.default-theme ol),
:deep(.default-theme ul) {
  padding-left: 2.35em;
}

:deep(.default-theme p) {
  word-break: normal !important;
}

:deep(.default-theme blockquote) {
  padding: 0.2em 0.8em;
  background-color: #e4f8fb;
  border-left: 5px solid #4dd0e1;
}
</style>
