import type {
  RouteLocationNormalized,
  RouterScrollBehavior,
} from "vue-router";

// ============================================================
// 自定义滚动行为
// ------------------------------------------------------------
// 背景：layouts/default.vue 把整体滚动放在了 .scrollable-content（overflow-y: auto），
// 而不是 <html>/<body>。Vue Router 默认的 scrollBehavior 只会重置 window.scrollY=0，
// 对独立滚动容器的 scrollTop 无效，导致：
//   - 用户在首页向下滚到很远的位置浏览文章列表
//   - 点击文章卡片 SPA 进入详情页（同一容器不会卸载）
//   - .scrollable-content.scrollTop 还停留在原位置
//   - 用户看到的是"文章中段"，必须手动向上滑才看到标题
//
// 解决：在路由切换时同步重置真正的滚动容器 scrollTop。
//
// 兼容点：
// 1) 浏览器前进/后退（savedPosition 非空）：尝试恢复保存的位置；savedPosition.top 是
//    window 级的语义，但因为本应用唯一可滚动元素就是 .scrollable-content，把它套用上
//    去也能近似复原（用户期望的是"回到上次浏览位置"）。
// 2) 路由 hash（如 #heading-3）：定位到对应锚点，等同于点击目录的体验。
// 3) 普通同路径切换（仅 query 变化）：保持当前滚动位置。
// ============================================================

const SCROLL_CONTAINER_SELECTOR = ".scrollable-content";

const getContainer = (): HTMLElement | null => {
  if (typeof document === "undefined") return null;
  return document.querySelector(SCROLL_CONTAINER_SELECTOR);
};

const scrollBehavior: RouterScrollBehavior = (
  to: RouteLocationNormalized,
  from: RouteLocationNormalized,
  savedPosition,
) => {
  // SSR 阶段没有 DOM，直接返回默认值即可（Nuxt 内部会忽略）。
  if (typeof window === "undefined") return { left: 0, top: 0 };

  // 等到 v-html 把新页面正文写入 DOM 后再做滚动，避免容器还没拿到内容就 scrollTop=0
  // 又被后续渲染抬起。用 requestAnimationFrame 双保险等到第二帧。
  return new Promise((resolve) => {
    const apply = () => {
      const container = getContainer();

      // 1) hash 锚点：滚动到对应元素，与目录点击的体验一致
      if (to.hash) {
        const target = document.querySelector(to.hash);
        if (target && container) {
          const cRect = container.getBoundingClientRect();
          const tRect = target.getBoundingClientRect();
          container.scrollTop = container.scrollTop + (tRect.top - cRect.top);
          resolve(false);
          return;
        }
        resolve({ el: to.hash });
        return;
      }

      // 2) 浏览器前进/后退：尽量恢复上次滚动位置
      if (savedPosition && container) {
        container.scrollTop = savedPosition.top || 0;
        resolve(false);
        return;
      }

      // 3) 同路径仅 query 变化：保持当前滚动位置不动
      if (to.path === from.path) {
        resolve(false);
        return;
      }

      // 4) 默认：路由切换 → 把独立滚动容器重置到顶部
      if (container) {
        container.scrollTop = 0;
      }
      // 顺带把 window 也归零，兜底任何回落到 window 滚动的页面
      window.scrollTo({ top: 0, left: 0 });
      resolve(false);
    };

    // 先等两帧让目标页面挂载完成（v-html / 异步组件等），再做滚动
    requestAnimationFrame(() => requestAnimationFrame(apply));
  });
};

export default {
  scrollBehavior,
};
