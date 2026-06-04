<template>
    <header class="navbar-wrapper">
        <div class="navbar navbar-fixed-top">
            <div class="l-container">
                <!-- ============================================================
                     移动端导航：触发按钮（汉堡图标）
                     - 真正的下拉抽屉通过 <Teleport to="body"> 渲染（见下方 ClientOnly 块），
                       脱离 navbar 自身的 overflow / z-index 上下文，避免被截断
                     - 这里保留按钮原位，仅改变 aria-expanded 状态
                     ============================================================ -->
                <div class="mobile-menu logo navbar-logo-m u-hide-desktop">
                    <button
                        type="button"
                        class="mobile-menu-trigger"
                        :aria-expanded="mobileOpen"
                        aria-haspopup="menu"
                        aria-controls="mobile-nav-drawer"
                        aria-label="导航菜单"
                        @click.stop="toggleMobile"
                    >
                        <i class="iconfont icon-zhiyezigeqingdan"></i>
                    </button>
                </div>

                <!-- 桌面端导航：保持原样 -->
                <nav class="nav navbar-nav" role="navigation">
                    <ul>
                        <li>
                            <NuxtLink to="/" @click="resetPage" :class="{ 'active': $route.path === '/' }"
                                data-hover="首页">首页</NuxtLink>
                        </li>
                        <li>
                            <NuxtLink to="/time-line" :class="{ 'active': $route.path === '/time-line' }"
                                data-hover="归档">归档</NuxtLink>
                        </li>
                        <li class="tool-dropdown" @mouseenter="showToolMenu = true" @mouseleave="showToolMenu = false">
                            <NuxtLink to="/tool/json" :class="{ 'active': $route.path.startsWith('/tool') }"
                                data-hover="工具栏">工具栏
                            </NuxtLink>
                            <transition name="slide">
                                <div class="tool-submenu" v-show="showToolMenu">
                                    <div class="triangle"></div>
                                    <div class="submenu-item" v-for="item in toolMenuItems" :key="item.key"
                                        @click="handleToolClick(item)">
                                        <span>{{ item.label }}</span>
                                    </div>
                                </div>
                            </transition>
                        </li>
                        <li>
                            <NuxtLink to="/about-me" :class="{ 'active': $route.path === '/about-me' }"
                                data-hover="关于我">关于我</NuxtLink>
                        </li>
                    </ul>
                </nav>
            </div>
        </div>

        <!-- ============================================================
             移动端导航抽屉（顶部下拉）
             ------------------------------------------------------------
             设计参考 components/CatalogRenderer.vue 的目录抽屉：
             1) <Teleport to="body"> 把抽屉根节点直接挂到 body，脱离 navbar
                的 overflow/z-index 上下文，全宽铺满屏幕
             2) 全屏遮罩半透明 + backdrop-filter: blur，导航区域以外的内容模糊
             3) 关闭路径多路兜底：
                a. 点击遮罩
                b. 点击任一菜单项（路由跳转后 watch 兜底）
                c. ESC 键
                d. 安卓返回键（pushState + popstate）
                e. 在抽屉/遮罩上"左滑"手势（dx < -60px）
                f. 视口尺寸跨过移动端断点（onResize）
             4) 抽屉本体没有箭头、四角直边，仅底部细分隔线，与移动端阅读体感一致
             ============================================================ -->
        <ClientOnly>
            <Teleport to="body">
                <Transition name="mobile-nav-drawer">
                    <div
                        v-if="mobileOpen"
                        class="mobile-nav-drawer-root"
                        @touchstart.passive="onSwipeStart"
                        @touchmove.passive="onSwipeMove"
                        @touchend="onSwipeEnd"
                        @touchcancel="onSwipeEnd"
                    >
                        <!-- 遮罩：覆盖除导航栏外的整个屏幕，点击即关闭 -->
                        <div class="mobile-nav-drawer-mask" @click="closeMobile()" />
                        <!-- 抽屉本体：顶端贴着 navbar 底部 -->
                        <nav
                            id="mobile-nav-drawer"
                            class="mobile-nav-drawer"
                            role="menu"
                            aria-label="移动端导航"
                        >
                            <NuxtLink
                                to="/"
                                class="mobile-nav-drawer-item"
                                :class="{ active: route.path === '/' }"
                                role="menuitem"
                                style="--stagger: 0"
                                @click="onMobileNavClick(true)"
                            >首页</NuxtLink>
                            <NuxtLink
                                to="/time-line"
                                class="mobile-nav-drawer-item"
                                :class="{ active: route.path === '/time-line' }"
                                role="menuitem"
                                style="--stagger: 1"
                                @click="onMobileNavClick()"
                            >归档</NuxtLink>
                            <NuxtLink
                                to="/about-me"
                                class="mobile-nav-drawer-item"
                                :class="{ active: route.path === '/about-me' }"
                                role="menuitem"
                                style="--stagger: 2"
                                @click="onMobileNavClick()"
                            >关于我</NuxtLink>
                        </nav>
                    </div>
                </Transition>
            </Teleport>
        </ClientOnly>
    </header>
</template>

<script setup lang="ts">
const showToolMenu = ref(false)
const paginationStore = usePaginationStore()
const route = useRoute()

// ===== 移动端下拉抽屉状态 =====
const mobileOpen = ref(false)

interface ToolMenuItem {
    key: string
    label: string
    component: string
}

const toolMenuItems: ToolMenuItem[] = [
    {
        key: 'json',
        label: 'JSON 数据处理',
        component: 'JsonTool'
    }
]

const resetPage = () => {
    paginationStore.resetPagination()
}

// 锁/解锁 body 滚动：抽屉打开时禁止背景滑动，避免遮罩下页面跟手
let prevBodyOverflow = ''
const lockBodyScroll = () => {
    if (typeof document === 'undefined') return
    prevBodyOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
}
const unlockBodyScroll = () => {
    if (typeof document === 'undefined') return
    document.body.style.overflow = prevBodyOverflow
}

// 安卓返回键拦截：抽屉打开时 pushState 一条占位记录，
// 用户按返回键先消费这条记录而不是真的退出页面
let pushedHistory = false
const onPopState = () => {
    // popstate 已经消费了我们 push 的记录，这里只需收起抽屉，不再 history.back
    pushedHistory = false
    closeMobile()
}

const openMobile = () => {
    if (mobileOpen.value) return
    mobileOpen.value = true
    lockBodyScroll()
    if (typeof window !== 'undefined') {
        try {
            history.pushState({ mobileNavOpen: true }, '')
            pushedHistory = true
            window.addEventListener('popstate', onPopState)
        } catch {
            // 某些环境（如 file://）禁用 pushState，忽略即可
        }
    }
}

const closeMobile = (opts: { skipHistoryBack?: boolean } = {}) => {
    if (!mobileOpen.value) return
    mobileOpen.value = false
    unlockBodyScroll()
    if (typeof window !== 'undefined') {
        window.removeEventListener('popstate', onPopState)
        // 用户主动关闭（点遮罩 / ESC / 滑动）时，
        // 之前 push 的 history 记录还在，需要 back 一次平账，
        // 否则用户再按一次系统返回键会"什么都不发生"。
        // 但若是通过点击菜单项关闭（NuxtLink 自身会 router.push 跳新路由），
        // 我们必须跳过 back，否则会和 NuxtLink 的 push 同步冲突，导致跳转失败。
        if (pushedHistory) {
            pushedHistory = false
            if (!opts.skipHistoryBack) {
                try {
                    history.back()
                } catch {
                    // 忽略
                }
            }
        }
    }
}

const toggleMobile = () => {
    mobileOpen.value ? closeMobile() : openMobile()
}

/**
 * 移动端抽屉里点击任一 NuxtLink 时调用：
 *   1. 可选地重置分页（仅"首页"传 true）；
 *   2. 关闭抽屉；
 *   3. 跳过 history.back —— NuxtLink 默认行为会同步 router.push 新路由，
 *      若我们这里再 history.back() 会和 push 形成竞态，导致跳转失败（停在原页）。
 *      改由路由变更后的 watch(route.fullPath) 触发的 onPopState 链路负责清理占位记录，
 *      或者用户在新页面按返回键时自然消费掉。
 */
const onMobileNavClick = (shouldResetPage = false) => {
    if (shouldResetPage) resetPage()
    closeMobile({ skipHistoryBack: true })
}

const handleToolClick = (item: ToolMenuItem) => {
    showToolMenu.value = false
    navigateTo(`/tool/${item.key}`)
}

// ===== 滑动手势：左滑收起抽屉 =====
// 参考 CatalogRenderer 抽屉的 touchstart/move/end 三段式
// 这里我们对水平左滑响应（dx < -SWIPE_THRESHOLD），同时要求横向位移明显大于纵向，
// 避免列表正常垂直滚动时被误判为关闭手势
const SWIPE_THRESHOLD = 60
const swipeState = {
    startX: 0,
    startY: 0,
    active: false,
}

const onSwipeStart = (e: TouchEvent) => {
    if (e.touches.length !== 1) return
    swipeState.startX = e.touches[0].clientX
    swipeState.startY = e.touches[0].clientY
    swipeState.active = true
}

const onSwipeMove = (e: TouchEvent) => {
    if (!swipeState.active || e.touches.length !== 1) return
    // 仅记录起点，是否触发关闭交给 touchend 判断；
    // 这里不 preventDefault，让用户在抽屉内仍能正常滚动列表（虽然项数少，留好行为）
    const dx = e.touches[0].clientX - swipeState.startX
    const dy = e.touches[0].clientY - swipeState.startY
    // 立即响应：横向位移已超过阈值且明显大于纵向 → 提前结束并关闭
    if (dx < -SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy) * 1.5) {
        swipeState.active = false
        closeMobile()
    }
}

const onSwipeEnd = (e: TouchEvent) => {
    if (!swipeState.active) return
    swipeState.active = false
    const t = e.changedTouches[0]
    if (!t) return
    const dx = t.clientX - swipeState.startX
    const dy = t.clientY - swipeState.startY
    if (dx < -SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy) * 1.5) {
        closeMobile()
    }
}

// ESC 键关闭
const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && mobileOpen.value) closeMobile()
}

// 视口断点切换（如旋转屏 / 进入 PC 宽度）：抽屉自动收起，避免 PC 上残留
const onResize = () => {
    if (typeof window === 'undefined') return
    if (mobileOpen.value && window.innerWidth >= 992) {
        closeMobile()
    }
}

onMounted(() => {
    document.addEventListener('keydown', onKeyDown)
    window.addEventListener('resize', onResize)
})

onBeforeUnmount(() => {
    document.removeEventListener('keydown', onKeyDown)
    window.removeEventListener('resize', onResize)
    // 兜底：组件卸载时若抽屉仍打开，确保 body 滚动 / popstate 监听被清理
    if (mobileOpen.value) {
        unlockBodyScroll()
        window.removeEventListener('popstate', onPopState)
    }
})

// 兜底：路由变更时强制收起抽屉
watch(() => route.fullPath, () => {
    closeMobile()
})
</script>

<style scoped>
.tool-dropdown {
    position: relative;
}

.tool-submenu {
    position: absolute;
    top: calc(100% + 10px);
    left: 50%;
    transform: translateX(-50%);
    background: #fff;
    border-radius: 4px;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
    padding: 8px 0;
    min-width: 130px;
    z-index: 1000;
    animation: slideDown 0.3s ease-out;
    transform-origin: top center;
}

.triangle {
    position: absolute;
    top: -6px;
    left: 50%;
    transform: translateX(-50%);
    width: 12px;
    height: 12px;
    background: #fff;
    transform: translateX(-50%) rotate(45deg);
    box-shadow: -2px -2px 5px rgba(0, 0, 0, 0.05);
}

.submenu-item {
    position: relative;
    display: flex;
    align-items: center;
    padding: 2px 10px;
    gap: 2px;
    cursor: pointer;
    transition: background-color 0.3s;
    z-index: 1;
}

.submenu-item:hover {
    background-color: #f5f5f5;
}

@keyframes slideDown {
    from {
        opacity: 0;
        transform: translateX(-50%) translateY(-10px);
    }

    to {
        opacity: 1;
        transform: translateX(-50%) translateY(0);
    }
}

/* ============================================================
   移动端汉堡触发按钮
   ============================================================ */
.mobile-menu {
    position: relative;
    display: inline-flex;
    align-items: center;
}

.mobile-menu-trigger {
    appearance: none;
    border: 0;
    background: transparent;
    padding: 0 14px;
    height: 44px;
    cursor: pointer;
    color: #4a5568;
    line-height: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
    transition: background-color 0.15s ease, color 0.15s ease;
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
}

.mobile-menu-trigger:hover {
    color: #263238;
}

.mobile-menu-trigger:active,
.mobile-menu-trigger[aria-expanded="true"] {
    color: #263238;
}

.mobile-menu-trigger .iconfont {
    font-size: 24px;
    line-height: 1;
}
</style>

<!--
  下面这块 <style> 故意 *不加* scoped：
  ----------------------------------------------------------------
  原因：移动端导航抽屉通过 <Teleport to="body"> 移出了组件 DOM 子树，
  Vue 的 scoped 样式靠组件根节点上的 data-v-xxx 属性选择器生效，
  Teleport 之后这些节点不再持有该属性 → scoped 选择器永远匹配不上。
  与 CatalogRenderer.vue 的处理思路完全一致。
  类名统一加 .mobile-nav-drawer-* 前缀避免污染其他组件。
-->
<style>
/* ============================================================
   移动端导航抽屉
   ------------------------------------------------------------
   断点策略与 CatalogRenderer 保持一致：≤991px 启用，
   ≥992px 桌面端即使触发也会被 onResize 兜底关闭，并通过 display:none 强制隐藏
   ============================================================ */
.mobile-nav-drawer-root {
    display: none;
}

@media (max-width: 991px) {
    /* navbar 高度在 base.css 中固定为 45px，抽屉/遮罩从 45px 起向下铺开，
       这样视觉上：导航栏始终清晰可见、其它区域被遮罩模糊 */
    .mobile-nav-drawer-root {
        display: block;
        position: fixed;
        left: 0;
        right: 0;
        top: 45px;
        bottom: 0;
        z-index: 1000;
    }

    .mobile-nav-drawer-mask {
        position: absolute;
        inset: 0;
        background: rgba(15, 23, 42, 0.22);
        /* 模糊遮罩下方的页面内容；强度由 6px 降至 2px，背景仍可辨识、不喧宾夺主
           做 -webkit- 兼容 iOS Safari */
        backdrop-filter: blur(2px);
        -webkit-backdrop-filter: blur(2px);
    }

    .mobile-nav-drawer {
        position: absolute;
        left: 0;
        right: 0;
        top: 0;
        background: #fff;
        padding: 8px 0;
        box-shadow: 0 8px 20px rgba(15, 23, 42, 0.12);
        border-bottom: 1px solid rgba(15, 23, 42, 0.06);
        /* 抽屉本体允许垂直滚动以应对极端情况（菜单项过多 / 视口很矮） */
        max-height: calc(100vh - 45px);
        overflow-y: auto;
        -webkit-overflow-scrolling: touch;
    }

    .mobile-nav-drawer-item {
        display: block;
        padding: 14px 20px;
        font-size: 16px;
        line-height: 1.4;
        color: #263238;
        text-decoration: none;
        cursor: pointer;
        position: relative;
        transition: background-color 0.15s ease, color 0.15s ease;
        -webkit-tap-highlight-color: transparent;
        touch-action: manipulation;
    }

    .mobile-nav-drawer-item + .mobile-nav-drawer-item {
        border-top: 1px solid rgba(15, 23, 42, 0.05);
    }

    .mobile-nav-drawer-item:active {
        background-color: rgba(0, 172, 193, 0.08);
        color: #00acc1;
    }

    .mobile-nav-drawer-item.active {
        color: #00acc1;
        font-weight: 600;
    }

    /* 进入 / 离开过渡：
       - 抽屉本体：自上而下滑入 + 轻微淡入；进入用 spring-like 缓动让滑出更"弹"；离开用更快的 ease-in 让收起更利落
       - 遮罩：淡入淡出
       - 菜单项：进入时按 --stagger 顺序错峰下滑 + 淡入，营造"层层展开"质感 */
    .mobile-nav-drawer-enter-active .mobile-nav-drawer {
        transition:
            transform 0.32s cubic-bezier(0.22, 1, 0.36, 1),
            opacity 0.22s ease-out;
    }
    .mobile-nav-drawer-leave-active .mobile-nav-drawer {
        transition:
            transform 0.22s cubic-bezier(0.4, 0, 1, 1),
            opacity 0.18s ease-in;
    }
    .mobile-nav-drawer-enter-from .mobile-nav-drawer,
    .mobile-nav-drawer-leave-to .mobile-nav-drawer {
        transform: translateY(-100%);
        opacity: 0.6;
    }

    .mobile-nav-drawer-enter-active .mobile-nav-drawer-mask {
        transition: opacity 0.32s ease-out;
    }
    .mobile-nav-drawer-leave-active .mobile-nav-drawer-mask {
        transition: opacity 0.2s ease-in;
    }
    .mobile-nav-drawer-enter-from .mobile-nav-drawer-mask,
    .mobile-nav-drawer-leave-to .mobile-nav-drawer-mask {
        opacity: 0;
    }

    /* 菜单项进场动画：每一项延迟 60ms 错峰滑入 */
    .mobile-nav-drawer-enter-active .mobile-nav-drawer-item {
        opacity: 0;
        transform: translateY(-6px);
        animation: mobileNavItemIn 0.32s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        animation-delay: calc(0.08s + var(--stagger, 0) * 0.06s);
    }
    @keyframes mobileNavItemIn {
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
    /* 关闭时统一淡出，不再做错峰，保证收起干脆 */
    .mobile-nav-drawer-leave-active .mobile-nav-drawer-item {
        transition: opacity 0.16s ease-in;
        opacity: 1;
    }
    .mobile-nav-drawer-leave-to .mobile-nav-drawer-item {
        opacity: 0;
    }

    /* 尊重用户系统偏好：减少动效 */
    @media (prefers-reduced-motion: reduce) {
        .mobile-nav-drawer-enter-active .mobile-nav-drawer,
        .mobile-nav-drawer-leave-active .mobile-nav-drawer,
        .mobile-nav-drawer-enter-active .mobile-nav-drawer-mask,
        .mobile-nav-drawer-leave-active .mobile-nav-drawer-mask {
            transition-duration: 0.12s;
        }
        .mobile-nav-drawer-enter-active .mobile-nav-drawer-item {
            animation: none;
            opacity: 1;
            transform: none;
        }
    }
}
</style>
