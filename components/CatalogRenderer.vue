<template>
  <div v-if="shouldRender" :class="{ 'mobile-catalog': isMobile }">
    <MdCatalog
      :scrollElementOffsetTop="scrollElementOffsetTop"
      :editorId="editorId"
      :scrollElement="scrollElement"
      :theme="theme"
      :maxLevel="maxLevel"
      :mdHeadingId="mdHeadingId"
    />
  </div>
</template>

<script setup lang="ts">
import { MdCatalog } from "md-editor-v3";
import { ref, onMounted, onBeforeUnmount, computed } from "vue";

defineProps<{
  editorId: string;
  scrollElement: string;
  scrollElementOffsetTop: number;
}>();

const theme = "light";
const isMobile = ref(false);
const shouldRender = ref(true);

// 自定义标题 ID 生成函数，与 MarkdownRenderer 保持一致
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

// 计算最大目录级别 - 移动设备显示更少层级
const maxLevel = computed(() => (isMobile.value ? 2 : 3));

// 检测设备类型并优化目录显示
onMounted(() => {
  if (import.meta.client) {
    // 检测移动设备
    checkMobileDevice();

    // 监听窗口大小变化 - 使用passive提高性能
    window.addEventListener("resize", checkMobileDevice, { passive: true });
  }
});

onBeforeUnmount(() => {
  if (import.meta.client) {
    window.removeEventListener("resize", checkMobileDevice);
  }
});

// 检测设备并设置渲染策略
function checkMobileDevice() {
  isMobile.value = window.innerWidth < 576;

  // 移动设备不渲染目录
  shouldRender.value = !isMobile.value;
}
</script>

<style scoped>
.mobile-catalog {
  font-size: 12px;
  max-height: 40vh;
}

.mobile-catalog :deep(.md-editor-catalog-link) {
  padding: 2px 4px;
  line-height: 1.2;
}
</style>
