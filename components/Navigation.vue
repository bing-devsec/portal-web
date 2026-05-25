<template>
    <header class="navbar-wrapper">
        <div class="navbar navbar-fixed-top">
            <div class="l-container">
                <el-dropdown ref="mobileDropdownRef" class="logo navbar-logo-m u-hide-desktop">
                    <span class="el-dropdown-link">&ensp;&ensp;
                        <i class="iconfont icon-zhiyezigeqingdan"></i>
                    </span>
                    <template #dropdown>
                        <el-dropdown-menu>
                            <el-dropdown-item>
                                <NuxtLink to="/" @click="handleMobileNavClick(true)" data-hover="首页">首页</NuxtLink>
                            </el-dropdown-item>
                            <el-dropdown-item>
                                <NuxtLink to="/time-line" @click="handleMobileNavClick()" data-hover="归档">归档</NuxtLink>
                            </el-dropdown-item>
                            <el-dropdown-item>
                                <NuxtLink to="/about-me" @click="handleMobileNavClick()" data-hover="关于我">关于我</NuxtLink>
                            </el-dropdown-item>
                        </el-dropdown-menu>
                    </template>
                </el-dropdown>
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
    </header>
</template>

<script setup lang="ts">
import type { DropdownInstance } from 'element-plus'

const showToolMenu = ref(false)
const paginationStore = usePaginationStore()
const route = useRoute()

// 移动端 logo 下拉的实例引用，用于在选中导航项后主动收起浮层
const mobileDropdownRef = ref<DropdownInstance | null>(null)

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

/**
 * 移动端 logo 下拉里点击任意 NuxtLink 时调用：
 *   1. 可选地重置分页（仅"首页"传 true）；
 *   2. 主动调用 el-dropdown 的 handleClose，避免路由切换后浮层不消失。
 */
const handleMobileNavClick = (shouldResetPage = false) => {
    if (shouldResetPage) resetPage()
    mobileDropdownRef.value?.handleClose?.()
}

// 兜底：路由变更时强制收起移动端下拉，防止任何遗漏场景导致浮层挂在屏幕上
watch(() => route.fullPath, () => {
    mobileDropdownRef.value?.handleClose?.()
})

const handleToolClick = (item: ToolMenuItem) => {
    showToolMenu.value = false
    navigateTo(`/tool/${item.key}`)
}
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


</style>