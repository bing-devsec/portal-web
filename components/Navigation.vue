<template>
    <header class="navbar-wrapper">
        <div class="navbar navbar-fixed-top">
            <div class="container">
                <el-dropdown class="logo navbar-logo-m visible-xs">
                    <span class="el-dropdown-link">&ensp;&ensp;
                        <i class="iconfont icon-zhiyezigeqingdan"></i>
                    </span>
                    <template #dropdown>
                        <el-dropdown-menu>
                            <el-dropdown-item>
                                <NuxtLink to="/" @click="resetPage" data-hover="首页">首页</NuxtLink>
                            </el-dropdown-item>
                            <el-dropdown-item>
                                <NuxtLink to="/time-line" data-hover="归档">归档</NuxtLink>
                            </el-dropdown-item>
                            <el-dropdown-item>
                                <NuxtLink to="/about-me" data-hover="关于我">关于我</NuxtLink>
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
const showToolMenu = ref(false)
const paginationStore = usePaginationStore()

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