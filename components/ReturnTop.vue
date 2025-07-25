<template>
    <ClientOnly>
        <el-backtop target=".scrollable-content" :right="rightPosition" :visibility-height="visibilityHeight">
            <div class="backtop-content">
                <i class="iconfont icon-fanhuidingbu"></i>
            </div>
        </el-backtop>
    </ClientOnly>
</template>

<script setup lang="ts">
const visibilityHeight = 2000
const rightPosition = ref(30)

// 响应窗口尺寸变化
const updateRightPosition = () => {
    if (import.meta.client) {
        rightPosition.value = window.innerWidth <= 576 ? 5 : 30
    }
}

// 客户端生命周期钩子
onMounted(() => {
    if (import.meta.client) {
        updateRightPosition()
        window.addEventListener('resize', updateRightPosition)
    }
})

onBeforeUnmount(() => {
    if (import.meta.client) {
        window.removeEventListener('resize', updateRightPosition)
    }
})
</script>

<style scoped>
.backtop-content {
    height: 100%;
    width: 100%;
    background-color: #fff;
    box-shadow: var(--el-box-shadow-lighter);
    text-align: center;
    line-height: 40px;
}

.el-backtop {
    right: 30px;
}

.icon-fanhuidingbu {
    font-size: 30px;
}

@media (max-width: 576px) {
    .el-backtop {
        right: 5px;
    }

    .backtop-content {
        box-shadow: var(--el-box-shadow-lighter);
        text-align: center;
        line-height: 30px;
    }

    .el-backtop {
        width: 30px;
        height: 30px;
    }

    .icon-fanhuidingbu {
        font-size: 25px;
    }
}
</style>