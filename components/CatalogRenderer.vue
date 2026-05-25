<template>
  <!--
    SSR 友好版目录：
    - headings 通过 prop 传入，SSR 阶段就能把 <ul> 直出，首屏一次成型，不闪烁。
    - 客户端 onMounted 只做"滚动联动 active 高亮"和"点击平滑跳转"两件增强工作。
    - PC 端：内联侧栏目录（.ssr-catalog）。
    - 移动端：FAB 浮动按钮 + 底部抽屉（bottom sheet），内联侧栏隐藏。
      移动端的 FAB / drawer 等交互节点不参与 SSR（只在 isClient 之后渲染），
      避免 hydration mismatch；PC 端侧栏仍参与 SSR。
  -->

  <!-- PC 端内联目录：保持原有 SSR 直出 -->
  <nav v-if="headings.length" class="ssr-catalog">
    <ul class="ssr-catalog-list">
      <li
        v-for="h in headings"
        :key="h.id"
        :class="['ssr-catalog-item', `level-${h.level}`, { active: h.id === activeId }]"
      >
        <a :href="`#${h.id}`" @click.prevent="scrollTo(h.id)">{{ h.text }}</a>
      </li>
    </ul>
  </nav>

  <!-- 移动端 FAB + Drawer：仅客户端渲染，避免 SSR/hydration 不一致
       同时 Teleport 到 body —— 因为父组件外层包了 .catalog-wrapper { display: none }
       (PC 端通过覆盖样式启用)，如果不脱离父容器，FAB 在移动端会被父级 display:none 一并隐藏。
       Teleport to body 后，移动端 FAB 完全脱离任何祖先的 display / overflow / transform 影响。 -->
  <ClientOnly>
    <Teleport to="body">
      <template v-if="headings.length">
      <!-- 浮动按钮（FAB），可拖拽吸边 -->
      <button
        ref="fabRef"
        class="ssr-catalog-fab"
        :class="{ 'ssr-catalog-fab--dragging': isDragging }"
        :style="fabStyle"
        type="button"
        aria-label="打开目录"
        @click="onFabClick"
        @touchstart.passive="onFabTouchStart"
        @touchmove="onFabTouchMove"
        @touchend="onFabTouchEnd"
        @touchcancel="onFabTouchEnd"
      >
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path
            d="M3 6h18M3 12h18M3 18h18"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          />
        </svg>
      </button>

      <!-- 抽屉 + 遮罩 -->
      <Transition name="ssr-catalog-drawer">
        <div v-if="drawerOpen" class="ssr-catalog-drawer-root">
          <div class="ssr-catalog-mask" @click="closeDrawer" />
          <div
            class="ssr-catalog-drawer"
            :style="drawerStyle"
            role="dialog"
            aria-label="文章目录"
            @touchstart.passive="onDrawerTouchStart"
            @touchmove="onDrawerTouchMove"
            @touchend="onDrawerTouchEnd"
            @touchcancel="onDrawerTouchEnd"
          >
            <div class="ssr-catalog-drawer-handle" />
            <div class="ssr-catalog-drawer-head">
              <span class="ssr-catalog-drawer-title">目录</span>
              <button
                class="ssr-catalog-drawer-close"
                type="button"
                aria-label="关闭目录"
                @click="closeDrawer"
              >
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                  <path
                    d="M6 6l12 12M18 6L6 18"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                  />
                </svg>
              </button>
            </div>
            <ul class="ssr-catalog-list ssr-catalog-list--drawer">
              <li
                v-for="h in headings"
                :key="h.id"
                :class="[
                  'ssr-catalog-item',
                  `level-${h.level}`,
                  { active: h.id === activeId },
                ]"
              >
                <a :href="`#${h.id}`" @click.prevent="onDrawerItemClick(h.id)">
                  {{ h.text }}
                </a>
              </li>
            </ul>
          </div>
        </div>
      </Transition>
      </template>
    </Teleport>
  </ClientOnly>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from "vue";
import type { CatalogHeading } from "~/utils/markdown";

const props = defineProps<{
  /** SSR 阶段就提取好的 headings 列表，用于直出 <ul>，不再客户端扫描 DOM */
  headings: CatalogHeading[];
  /** 当前文章 id，路由切换时用来重置 active 高亮 */
  articleId: string;
  /** 滚动容器选择器；找不到时回落到 window */
  scrollElement: string;
  /** active 切换的吸顶偏移（避免标题被顶部导航挡住时被算作离开视口） */
  scrollElementOffsetTop: number;
}>();

const activeId = ref<string>("");

let observer: IntersectionObserver | null = null;
let scrollContainer: Element | Window | null = null;

// ============================================================
// 程序滚动期间静音 observer 高亮联动
// ------------------------------------------------------------
// 问题：点击目录 B 触发 smooth scroll，从 A 滚动到 B 期间会经过
// 中间的 A1/A2/A3 等 heading，每个都会短暂进入 viewport，
// 触发 IntersectionObserver 回调 → activeId 跳变 → 高亮像走马灯。
//
// 方案：
// 1) scrollTo() 一开始就把 activeId 锁定到目标 id，并打开"静音开关"；
// 2) 监听容器 scroll 事件，每次滚动都重置 idle 计时器（debounce 思路）；
// 3) 静音期间 observer 回调直接 return，不更新 activeId；
// 4) 滚动停止 ~180ms 后解除静音，并主动 reconcile 一次：
//    把当前 IntersectionObserver 看到的"最靠上 visible heading"重新作为 active，
//    防止"目标 heading 太小、被 rootMargin 卡边界"等极端情况导致最终落点不准。
// ============================================================
let suppressObserver = false;
let scrollIdleTimer: ReturnType<typeof setTimeout> | null = null;
let onScrollHandler: (() => void) | null = null;

const SCROLL_IDLE_MS = 180;

const setupObserver = () => {
  if (typeof window === "undefined" || !("IntersectionObserver" in window)) return;
  if (observer) observer.disconnect();

  // ⚠ 关键：当滚动容器是独立的 overflow 元素（如 layouts/default.vue 里的 .scrollable-content）
  // 而非 document 时，必须把它显式指定为 IntersectionObserver 的 root，
  // 否则 root 默认是 viewport，rootMargin 计算的可见边界与真实滚动容器对不上，
  // 导致 active 高亮总在偏移一段距离的位置切换。
  // 仅 Element 是合法 root；window/null/document 时让 IO 走默认行为（root=viewport）。
  const ioRoot: Element | null =
    scrollContainer instanceof Element ? scrollContainer : null;

  observer = new IntersectionObserver(
    (entries) => {
      // 静音期：不更新 activeId，保留 scrollTo 设置的目标 id 高亮
      if (suppressObserver) return;
      const visible = entries.filter((e) => e.isIntersecting);
      if (visible.length === 0) return;
      // 取最靠上的可见 heading 作为当前 active
      visible.sort(
        (a, b) => a.boundingClientRect.top - b.boundingClientRect.top
      );
      activeId.value = (visible[0].target as HTMLElement).id;
    },
    {
      root: ioRoot,
      rootMargin: `-${props.scrollElementOffsetTop + 10}px 0px -70% 0px`,
      threshold: [0, 1],
    }
  );

  // 直接根据 prop 里已有的 id 去找对应 DOM 节点观察，
  // 不再 querySelectorAll 全文档扫描，避免与文章 DOM 结构耦合。
  for (const h of props.headings) {
    const el = document.getElementById(h.id);
    if (el) observer.observe(el);
  }
};

const resolveScrollContainer = (): Element | Window => {
  if (typeof window === "undefined") return window;
  const el = document.querySelector(props.scrollElement);
  return el || window;
};

const scrollTo = (id: string) => {
  if (typeof document === "undefined") return;
  const target = document.getElementById(id);
  if (!target) return;

  const offset = props.scrollElementOffsetTop;

  // 关键：先把高亮锁定到目标，再开启 observer 静音
  // —— 这样从点击的瞬间到滚动结束，高亮都不会因为中间经过的 heading 而跳变
  activeId.value = id;
  suppressObserver = true;
  // 同时绑一个滚动停止检测的兜底定时器：万一浏览器没派发 scroll 事件
  // （比如目标已经在视口内，scrollTo 不产生位移），也能在 SCROLL_IDLE_MS 后解除静音
  armScrollIdleTimer();

  if (scrollContainer && scrollContainer !== window) {
    const container = scrollContainer as Element;
    const cRect = container.getBoundingClientRect();
    const tRect = target.getBoundingClientRect();
    container.scrollTo({
      top: container.scrollTop + (tRect.top - cRect.top) - offset,
      behavior: "smooth",
    });
  } else {
    const top =
      target.getBoundingClientRect().top + window.pageYOffset - offset;
    window.scrollTo({ top, behavior: "smooth" });
  }
};

// 静默期 idle 计时：每次滚动事件都重置；停下 SCROLL_IDLE_MS 后解除静音
const armScrollIdleTimer = () => {
  if (scrollIdleTimer) clearTimeout(scrollIdleTimer);
  scrollIdleTimer = setTimeout(() => {
    suppressObserver = false;
    scrollIdleTimer = null;
    // 解除静音后主动 reconcile：用 IntersectionObserver 当前 takeRecords 的可见集合
    // 校准一次最终 active，避免目标 heading 离开视口或被 rootMargin 卡边界时高亮停在错误位置
    reconcileActiveOnce();
  }, SCROLL_IDLE_MS);
};

// 主动用一次 IntersectionObserver 的当前快照刷新 active
// 注：takeRecords() 只能拿"待派发"的记录，真正"当前可见集"需要重建一个一次性 observer 来取
const reconcileActiveOnce = () => {
  if (!observer || typeof window === "undefined") return;
  if (!props.headings.length) return;
  // 与主 observer 保持相同的 root：独立滚动容器场景下必须显式传 root，
  // 否则 root 默认 viewport，校准结果跟主 observer 对不上
  const ioRoot: Element | null =
    scrollContainer instanceof Element ? scrollContainer : null;
  // 用 IntersectionObserver 单次扫一帧的可见 entries
  const probe = new IntersectionObserver(
    (entries) => {
      const visible = entries.filter((e) => e.isIntersecting);
      if (visible.length > 0) {
        visible.sort(
          (a, b) => a.boundingClientRect.top - b.boundingClientRect.top
        );
        activeId.value = (visible[0].target as HTMLElement).id;
      }
      probe.disconnect();
    },
    {
      root: ioRoot,
      rootMargin: `-${props.scrollElementOffsetTop + 10}px 0px -70% 0px`,
      threshold: [0, 1],
    }
  );
  for (const h of props.headings) {
    const el = document.getElementById(h.id);
    if (el) probe.observe(el);
  }
};

onMounted(async () => {
  scrollContainer = resolveScrollContainer();
  await nextTick();
  setupObserver();

  // 监听容器滚动事件：仅用于"在静音期内不断刷新 idle 计时器"
  // —— 滚动持续 → 计时器持续被推迟 → 静音持续；滚动停下 SCROLL_IDLE_MS → 解除静音
  // 用 passive: true 表明我们不会 preventDefault，浏览器可以最大化滚动性能
  onScrollHandler = () => {
    if (suppressObserver) {
      armScrollIdleTimer();
    }
  };
  const scrollTarget = scrollContainer === window ? window : scrollContainer;
  scrollTarget?.addEventListener("scroll", onScrollHandler, { passive: true });

  // 移动端 FAB 初始化
  initFabPos();
  window.addEventListener("resize", onViewportResize);
  window.addEventListener("keydown", onKeydown);
});

onBeforeUnmount(() => {
  if (observer) {
    observer.disconnect();
    observer = null;
  }
  if (onScrollHandler) {
    const scrollTarget = scrollContainer === window ? window : scrollContainer;
    scrollTarget?.removeEventListener("scroll", onScrollHandler);
    onScrollHandler = null;
  }
  if (scrollIdleTimer) {
    clearTimeout(scrollIdleTimer);
    scrollIdleTimer = null;
  }
  suppressObserver = false;

  // 移动端清理
  if (typeof window !== "undefined") {
    window.removeEventListener("resize", onViewportResize);
    window.removeEventListener("keydown", onKeydown);
  }
});

// 路由切换：headings 列表会通过 prop 由父组件刷新，这里只需重建 observer
watch(
  () => [props.articleId, props.headings],
  async () => {
    await nextTick();
    activeId.value = "";
    setupObserver();
    // 路由切换时关闭抽屉，避免新文章首屏就看到上一篇文章打开的目录
    drawerOpen.value = false;
  }
);

// ============================================================
// 移动端 FAB（floating action button）+ 抽屉交互
// ------------------------------------------------------------
// 设计说明：
//   1) FAB 默认在屏幕右侧、垂直 60% 处（避开顶部导航 / 底部"返回顶部"按钮）
//   2) FAB 可拖拽：拖动距离 < 5px 视为点击；松手时自动吸到最近的左/右边缘
//   3) y 坐标记忆到 localStorage（'catalog-fab-y'），刷新后保持上次位置
//   4) 抽屉从底部弹出，max-height: 65vh
//   5) 抽屉收起 4 路兜底：
//        a. 点击目录项跳转后自动收起（主路径）
//        b. 点击半透明遮罩
//        c. 抽屉顶部 × 关闭按钮
//        d. 在抽屉头部下滑 > 50px（手势）
//      还有第 5 路：onMounted 里挂的 scrollIdleTimer 不影响这里
//   6) 所有 ref / handler 仅在客户端执行有意义；SSR 阶段它们也会被求值，
//      但 ClientOnly 包裹 + 守卫确保不会触碰 window
// ============================================================

const fabRef = ref<HTMLButtonElement | null>(null);
const drawerOpen = ref(false);

// FAB 位置：top 用绝对像素，left 永远是 'auto'（始终贴右边）或 'unset'（贴左边）
// 用 right/left 动态切换实现"吸边"效果
const FAB_SIZE = 38; // 与 CSS 中的 .ssr-catalog-fab 同步
const FAB_MARGIN = 10; // 距离屏幕边缘
const fabSide = ref<"left" | "right">("right");
const fabTop = ref<number>(0); // px，相对 viewport 顶端

// 拖动期间：是否完全交给 inline style 接管位置
// —— 关键修复：上一版同时让 computed fabStyle 和手动 inline style 写 left，
//    Vue :style flush 是异步 microtask，会在每次 touchmove 后把 inline style
//    覆盖回 fabStyle 算出来的值，导致左右闪烁。
//    现在拖动期间 fabStyle 只返回空对象，位置完全由我们写入 inline style 控制。
const dragInline = ref(false);

const fabStyle = computed(() => {
  if (dragInline.value) return {}; // 拖动期间退位，让 inline style 完全接管
  const horizontal =
    fabSide.value === "right"
      ? { right: `${FAB_MARGIN}px`, left: "auto" }
      : { left: `${FAB_MARGIN}px`, right: "auto" };
  return {
    ...horizontal,
    top: `${fabTop.value}px`,
  };
});

// 抽屉滑动收起的辅助状态
const drawerDragOffset = ref(0); // 抽屉被下拉的位移（仅顶部手柄触发时累加）
const drawerStyle = computed(() => ({
  transform:
    drawerDragOffset.value > 0
      ? `translateY(${drawerDragOffset.value}px)`
      : "",
  transition: drawerDragging.value ? "none" : "transform 0.25s ease",
}));

// 拖拽 FAB 的状态机
const isDragging = ref(false);
const dragState = {
  startX: 0,
  startY: 0,
  startTop: 0,
  startLeft: 0, // 当前 FAB 左侧坐标（绝对值，用于拖动期间动态控制 left）
  pointerActive: false,
  moved: false,
};

// 抽屉拖动状态
const drawerDragging = ref(false);
const drawerDragState = {
  startY: 0,
  active: false,
};

// 初始化 FAB 位置：从 localStorage 读 y，否则用屏幕高度 60%
const initFabPos = () => {
  if (typeof window === "undefined") return;
  let y = window.innerHeight * 0.6;
  try {
    const saved = window.localStorage.getItem("catalog-fab-y");
    if (saved) {
      const parsed = parseFloat(saved);
      if (!isNaN(parsed)) y = parsed;
    }
    const savedSide = window.localStorage.getItem("catalog-fab-side");
    if (savedSide === "left" || savedSide === "right") {
      fabSide.value = savedSide;
    }
  } catch {
    /* localStorage 不可用时静默 */
  }
  fabTop.value = clampFabTop(y);
};

const clampFabTop = (y: number): number => {
  if (typeof window === "undefined") return y;
  const min = FAB_MARGIN;
  const max = window.innerHeight - FAB_SIZE - FAB_MARGIN;
  return Math.max(min, Math.min(max, y));
};

const persistFabPos = () => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem("catalog-fab-y", String(fabTop.value));
    window.localStorage.setItem("catalog-fab-side", fabSide.value);
  } catch {
    /* localStorage 不可用时静默 */
  }
};

const onFabClick = () => {
  // moved=true 时不触发点击（拖动结束的 click 抑制）
  if (dragState.moved) {
    dragState.moved = false;
    return;
  }
  drawerOpen.value = true;
};

const onFabTouchStart = (e: TouchEvent) => {
  if (e.touches.length !== 1) return;
  const t = e.touches[0];
  const fab = fabRef.value;
  if (!fab) return;
  const rect = fab.getBoundingClientRect();
  dragState.startX = t.clientX;
  dragState.startY = t.clientY;
  dragState.startTop = fabTop.value;
  dragState.startLeft = rect.left;
  dragState.pointerActive = true;
  dragState.moved = false;
  isDragging.value = false;
};

const onFabTouchMove = (e: TouchEvent) => {
  if (!dragState.pointerActive || e.touches.length !== 1) return;
  const t = e.touches[0];
  const dx = t.clientX - dragState.startX;
  const dy = t.clientY - dragState.startY;
  // 5px 内视为静止
  if (!dragState.moved && Math.hypot(dx, dy) < 5) return;

  // 一旦判定为拖动就要 preventDefault，避免页面跟着滚
  e.preventDefault();
  dragState.moved = true;
  isDragging.value = true;

  if (typeof window === "undefined" || !fabRef.value) return;

  // 关键：进入拖动模式后，让 computed fabStyle 退位（返回空对象），
  // 整个位置交由下面的 inline style 完全控制 —— 避免 :style 异步 flush 把 left 覆盖回 FAB_MARGIN 导致闪烁
  dragInline.value = true;

  const minX = FAB_MARGIN;
  const maxX = window.innerWidth - FAB_SIZE - FAB_MARGIN;
  const newLeft = Math.max(
    minX,
    Math.min(maxX, dragState.startLeft + dx)
  );
  const newTop = clampFabTop(dragState.startTop + dy);

  // 用 setProperty 一次性写入；同时把 right 显式置为 'auto'
  // 防止之前残留的 right 值跟新 left 同时生效
  fabRef.value.style.left = `${newLeft}px`;
  fabRef.value.style.right = "auto";
  fabRef.value.style.top = `${newTop}px`;

  // 同步 ref（供松手吸边判断中心点用，但不参与位置渲染）
  fabTop.value = newTop;
};

const onFabTouchEnd = () => {
  if (!dragState.pointerActive) return;
  dragState.pointerActive = false;

  if (dragState.moved && fabRef.value && typeof window !== "undefined") {
    // 计算当前中心点决定吸到左边还是右边
    const rect = fabRef.value.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    fabSide.value = centerX < window.innerWidth / 2 ? "left" : "right";
    // 清掉临时 inline style，让 computed fabStyle 接管最终位置
    fabRef.value.style.left = "";
    fabRef.value.style.right = "";
    fabRef.value.style.top = "";
    dragInline.value = false; // 退出拖动模式，让 fabStyle 重新生效
    isDragging.value = false;
    persistFabPos();
  } else {
    // 没有真正拖动，只是普通 tap，无需处理 inline style
    isDragging.value = false;
  }
  // moved 标记保留到 click 事件之后由 onFabClick 自己消费，
  // 避免拖完一松手又触发了 click 打开抽屉
};

const closeDrawer = () => {
  drawerOpen.value = false;
  drawerDragOffset.value = 0;
};

const onDrawerItemClick = (id: string) => {
  scrollTo(id);
  // 主路径：点完目录项就把抽屉收起，让用户立刻看到内容
  closeDrawer();
};

// 抽屉本身只在拖手柄区域允许滑动收起；
// 这里整体监听是为了"在抽屉顶部下拉"时收起，而不是列表内容滚动时收起
const onDrawerTouchStart = (e: TouchEvent) => {
  if (e.touches.length !== 1) return;
  // 只有点在抽屉顶部空白条 / 标题栏区域时才允许下滑收起
  // 实现方式：判断 target 是 drawer 本体或 handle/head 而非列表项
  const target = e.target as HTMLElement;
  if (
    !target.closest(".ssr-catalog-drawer-head") &&
    !target.classList.contains("ssr-catalog-drawer-handle")
  ) {
    return;
  }
  drawerDragState.startY = e.touches[0].clientY;
  drawerDragState.active = true;
  drawerDragging.value = true;
};

const onDrawerTouchMove = (e: TouchEvent) => {
  if (!drawerDragState.active || e.touches.length !== 1) return;
  const dy = e.touches[0].clientY - drawerDragState.startY;
  if (dy > 0) {
    e.preventDefault();
    drawerDragOffset.value = dy;
  } else {
    drawerDragOffset.value = 0;
  }
};

const onDrawerTouchEnd = () => {
  if (!drawerDragState.active) return;
  drawerDragState.active = false;
  drawerDragging.value = false;
  if (drawerDragOffset.value > 50) {
    closeDrawer();
  } else {
    drawerDragOffset.value = 0;
  }
};

// 安卓返回键 / ESC 键关闭抽屉的兜底
const onKeydown = (e: KeyboardEvent) => {
  if (e.key === "Escape" && drawerOpen.value) {
    closeDrawer();
  }
};

// 视口尺寸变化时重新 clamp FAB 的 top（旋转屏 / 浏览器栏弹出收起等）
const onViewportResize = () => {
  fabTop.value = clampFabTop(fabTop.value);
};
</script>

<style scoped>
.ssr-catalog {
  /* PC 端字号偏小问题修复：13px → 流式 14~15px，更适合长时间阅读 */
  font-size: clamp(14px, 13px + 0.2vw, 15px);
  line-height: 1.6;
}

.ssr-catalog-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.ssr-catalog-item {
  margin: 4px 0;
  padding: 2px 6px;
  border-left: 2px solid transparent;
  transition: color 0.15s ease, background-color 0.15s ease,
    border-color 0.15s ease;
}

.ssr-catalog-item a {
  color: #555;
  text-decoration: none;
  display: block;
  word-break: break-word;
  line-height: 1.4;
}

.ssr-catalog-item:hover a {
  color: #4dd0e1;
}

.ssr-catalog-item.active {
  border-left-color: #4dd0e1;
  background-color: #f0fbfc;
}

.ssr-catalog-item.active a {
  color: #4dd0e1;
  font-weight: 600;
}

.ssr-catalog-item.level-1 {
  font-weight: 600;
}

.ssr-catalog-item.level-2 {
  padding-left: 10px;
}

.ssr-catalog-item.level-3 {
  padding-left: 22px;
  /* 与父级 ssr-catalog 字号对齐：略小于父级（13~14px），避免视觉太密 */
  font-size: clamp(13px, 12px + 0.2vw, 14px);
}

@media (max-width: 767px) {
  .ssr-catalog {
    display: none;
  }
}
</style>

<!--
  下面这段 <style> 故意 *不加* scoped：
  -----------------------------------------------------
  原因：移动端 FAB / 抽屉 / 遮罩通过 <Teleport to="body"> 移出了组件 DOM 子树，
  Vue 的 scoped 样式靠组件根节点上的 data-v-xxx 属性选择器生效，
  Teleport 之后这些节点不再持有该属性 → scoped 选择器永远匹配不上，
  最终结果就是 FAB 被渲染到 body 但 *样式完全失效* —— 这正是"看不到目录按钮"的另一个潜在陷阱。
  解决方式：把跟 Teleport 出去的节点相关的所有样式独立到非 scoped 块。
  我们用了 .ssr-catalog-* 前缀，全局唯一，不会污染其它组件。
-->
<style>
/* ==========================================================
   移动端 / 平板 FAB + 抽屉
   ----------------------------------------------------------
   策略：在 max-width: 991px 下显示 FAB / 抽屉相关节点，与文章详情页 Grid
   布局（.l-article）双列切换边界（min-width: 992px）严格对齐。
   ≥992px：PC 内联目录直出在右侧 .l-article-aside 槽位
   ≤991px：Grid 塌成单列，PC 目录会出现在文章正文下方（视觉割裂），
           改走 FAB + 抽屉，平板和手机体验一致。
   PC 端即使 v-if 渲染了 ClientOnly 内部 DOM，也用 display:none 隐藏，
   避免双端共存造成的视觉冲突。
   ========================================================== */
.ssr-catalog-fab,
.ssr-catalog-drawer-root {
  display: none;
}

@media (max-width: 991px) {
  .ssr-catalog-fab {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    position: fixed;
    width: 38px;
    height: 38px;
    border: none;
    border-radius: 50%;
    background: #4dd0e1;
    color: #fff;
    box-shadow: 0 3px 10px rgba(77, 208, 225, 0.38),
      0 1px 3px rgba(0, 0, 0, 0.1);
    cursor: pointer;
    z-index: 999;
    /* 只过渡阴影，不过渡 transform —— 避免拖动期间 scale 变化产生抖动 */
    transition: box-shadow 0.2s ease;
    -webkit-tap-highlight-color: transparent;
    user-select: none;
    touch-action: none;
  }

  .ssr-catalog-fab:active:not(.ssr-catalog-fab--dragging) {
    /* 仅在非拖动状态下用 active 反馈做按压效果，避免和拖动 scale 互相覆盖 */
    transform: scale(0.95);
    transition: transform 0.1s ease, box-shadow 0.2s ease;
  }

  .ssr-catalog-fab--dragging {
    box-shadow: 0 6px 18px rgba(77, 208, 225, 0.55),
      0 3px 8px rgba(0, 0, 0, 0.15);
  }

  .ssr-catalog-drawer-root {
    display: block;
    position: fixed;
    inset: 0;
    z-index: 1000;
  }

  .ssr-catalog-mask {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(2px);
  }

  .ssr-catalog-drawer {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    background: #fff;
    border-top-left-radius: 6px;
    border-top-right-radius: 6px;
    max-height: 65vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 -8px 24px rgba(0, 0, 0, 0.15);
    overflow: hidden;
    /* 防止拖动手柄时整个抽屉被浏览器原生手势接管 */
    touch-action: none;
  }

  .ssr-catalog-drawer-handle {
    width: 36px;
    height: 4px;
    background: #d0d0d0;
    border-radius: 2px;
    margin: 8px auto 4px;
    flex-shrink: 0;
  }

  .ssr-catalog-drawer-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 3px 10px;
    border-bottom: 1px solid #f0f0f0;
    flex-shrink: 0;
  }

  .ssr-catalog-drawer-title {
    font-size: 15px;
    font-weight: 600;
    color: #333;
  }

  .ssr-catalog-drawer-close {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: none;
    background: transparent;
    color: #666;
    border-radius: 6px;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }

  .ssr-catalog-drawer-close:active {
    background: #f0f0f0;
  }

  /* 抽屉里的列表样式：因为不在组件 scope 下，需要重新定义基础样式 */
  .ssr-catalog-list--drawer {
    list-style: none;
    margin: 0;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    padding: 8px 16px 24px;
    /* 抽屉里的列表才允许内部滚动手势 */
    touch-action: pan-y;
  }

  .ssr-catalog-list--drawer .ssr-catalog-item {
    margin: 2px 0;
    padding: 8px 8px;
    border-left: 3px solid transparent;
    transition: color 0.15s ease, background-color 0.15s ease,
      border-color 0.15s ease;
  }

  .ssr-catalog-list--drawer .ssr-catalog-item a {
    color: #555;
    text-decoration: none;
    display: block;
    word-break: break-word;
    font-size: 14px;
    line-height: 1.5;
  }

  .ssr-catalog-list--drawer .ssr-catalog-item.active {
    background-color: #e0f7fa;
    border-left-color: #4dd0e1;
  }

  .ssr-catalog-list--drawer .ssr-catalog-item.active a {
    color: #4dd0e1;
    font-weight: 600;
  }

  .ssr-catalog-list--drawer .ssr-catalog-item.level-2 {
    padding-left: 20px;
  }

  .ssr-catalog-list--drawer .ssr-catalog-item.level-3 {
    padding-left: 32px;
  }
}

/* 抽屉进出动画 */
.ssr-catalog-drawer-enter-active .ssr-catalog-drawer,
.ssr-catalog-drawer-leave-active .ssr-catalog-drawer {
  transition: transform 0.28s cubic-bezier(0.32, 0.72, 0, 1);
}
.ssr-catalog-drawer-enter-from .ssr-catalog-drawer,
.ssr-catalog-drawer-leave-to .ssr-catalog-drawer {
  transform: translateY(100%);
}
.ssr-catalog-drawer-enter-active .ssr-catalog-mask,
.ssr-catalog-drawer-leave-active .ssr-catalog-mask {
  transition: opacity 0.28s ease;
}
.ssr-catalog-drawer-enter-from .ssr-catalog-mask,
.ssr-catalog-drawer-leave-to .ssr-catalog-mask {
  opacity: 0;
}
</style>
