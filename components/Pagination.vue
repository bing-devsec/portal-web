<template>
    <nav
        v-if="totalPages > 1"
        id="moreArticle"
        class="pagination text-c mb-20"
        role="navigation"
        aria-label="文章列表分页"
    >
        <button
            type="button"
            class="page-btn page-arrow"
            :disabled="currentPage <= 1"
            aria-label="上一页"
            @click="goTo(currentPage - 1)"
        >
            <span class="arrow" aria-hidden="true">‹</span>
        </button>

        <ul class="page-list">
            <li
                v-for="(item, idx) in pageItems"
                :key="`${item.type}-${idx}`"
                class="page-item"
            >
                <button
                    v-if="item.type === 'page'"
                    type="button"
                    class="page-btn"
                    :class="{ active: item.page === currentPage }"
                    :aria-current="item.page === currentPage ? 'page' : undefined"
                    :aria-label="`第 ${item.page} 页`"
                    @click="goTo(item.page)"
                >{{ item.page }}</button>
                <span v-else class="page-ellipsis" aria-hidden="true">…</span>
            </li>
        </ul>

        <button
            type="button"
            class="page-btn page-arrow"
            :disabled="currentPage >= totalPages"
            aria-label="下一页"
            @click="goTo(currentPage + 1)"
        >
            <span class="arrow" aria-hidden="true">›</span>
        </button>
    </nav>
</template>

<script setup lang="ts">
interface Props {
    total?: number
    currentPage?: number
    pageSize?: number
    pagerCount?: number
}

const props = withDefaults(defineProps<Props>(), {
    total: 0,
    currentPage: 1,
    pageSize: 10,
    pagerCount: 5,
})

const emit = defineEmits<{
    (e: 'update:current-page', page: number): void
}>()

// 总页数；total 为 0 或负数时按 0 处理（模板里 v-if 会直接隐藏整个分页）
const totalPages = computed(() =>
    Math.max(0, Math.ceil(props.total / Math.max(1, props.pageSize)))
)

interface PageNumber { type: 'page'; page: number }
interface PageEllipsis { type: 'ellipsis' }
type PageItem = PageNumber | PageEllipsis

/**
 * 生成可见的页码列表：
 *   - 总页数 ≤ pagerCount + 2（首+末）：全量展示，不出现省略号
 *   - 否则：始终显示首页和末页；当前页周围显示一个窗口；窗口与首/末之间用 … 占位
 *
 * 例：pagerCount=5, totalPages=10
 *   current=1  -> [1] 2 3 4 5 … 10
 *   current=5  -> 1 … 3 4 [5] 6 7 … 10
 *   current=10 -> 1 … 6 7 8 9 [10]
 */
const pageItems = computed<PageItem[]>(() => {
    const total = totalPages.value
    if (total <= 0) return []

    const cur = Math.min(Math.max(1, props.currentPage), total)
    const win = Math.max(3, props.pagerCount) // 至少 3 个，否则窗口无法包含 cur±1
    const half = Math.floor(win / 2)

    // 简单情形：全部页都能放下（含首末），直接 1..total
    if (total <= win + 2) {
        return Array.from({ length: total }, (_, i) => ({
            type: 'page' as const,
            page: i + 1,
        }))
    }

    // 计算窗口起止（保证窗口内有 win 个连续数字，且不与首末重叠）
    let start = cur - half
    let end = cur + half
    if (start < 2) {
        start = 2
        end = start + win - 1
    }
    if (end > total - 1) {
        end = total - 1
        start = end - win + 1
    }

    const items: PageItem[] = [{ type: 'page', page: 1 }]
    if (start > 2) items.push({ type: 'ellipsis' })
    for (let p = start; p <= end; p++) items.push({ type: 'page', page: p })
    if (end < total - 1) items.push({ type: 'ellipsis' })
    items.push({ type: 'page', page: total })
    return items
})

const goTo = (page: number) => {
    const total = totalPages.value
    if (total <= 0) return
    const target = Math.min(Math.max(1, page), total)
    if (target === props.currentPage) return
    emit('update:current-page', target)
}
</script>

<style scoped>
.pagination {
    /* 容器铺满主区宽度（与上方文章卡片一致），按钮在内部水平居中 */
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 6px;
    width: 100%;
    /* 关键：与文章卡片一样使用 border-box，让 padding 不撑出额外宽度 */
    box-sizing: border-box;
    padding: 8px 12px;
    background-color: #fff;
    /* 去掉圆角，与文章卡片当前样式保持一致 */
    border-radius: 0;
    box-shadow: 0 4px 14px rgba(15, 23, 42, 0.05);
}

.page-list {
    display: flex;
    align-items: center;
    gap: 4px;
    margin: 0;
    padding: 0;
    list-style: none;
}

.page-item {
    display: inline-flex;
}

.page-btn {
    appearance: none;
    border: 1px solid transparent;
    background: #f4f6f8;
    color: #263238;
    font-size: 13px;
    line-height: 1;
    min-width: 32px;
    height: 32px;
    padding: 0 8px;
    border-radius: 0;
    cursor: pointer;
    user-select: none;
    transition: background-color 0.15s ease, color 0.15s ease, border-color 0.15s ease;
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
}

.page-btn:disabled {
    color: #c0c4cc;
    background: #f4f6f8;
    cursor: not-allowed;
}

.page-btn.active {
    background-color: #00acc1;
    color: #fff;
    cursor: default;
    font-weight: 600;
}

.page-arrow .arrow {
    display: inline-block;
    font-size: 18px;
    line-height: 1;
    /* 视觉微调，让箭头与数字基线对齐 */
    transform: translateY(-1px);
}

.page-ellipsis {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 32px;
    height: 32px;
    color: #8f9aa5;
    font-size: 14px;
    user-select: none;
}

/* hover 仅在鼠标设备启用，避免移动端 sticky hover 残留 */
@media (hover: hover) and (pointer: fine) {
    .page-btn:not(:disabled):not(.active):hover {
        color: #00acc1;
        background-color: rgba(0, 172, 193, 0.1);
    }
}

.page-btn:not(:disabled):not(.active):active {
    background-color: rgba(0, 172, 193, 0.18);
    color: #00acc1;
}

@media (max-width: 576px) {
    .pagination {
        gap: 4px;
        padding: 5px 6px;
    }

    .page-list {
        gap: 3px;
    }

    .page-btn {
        min-width: 28px;
        height: 28px;
        padding: 0 6px;
        font-size: 12px;
    }

    .page-ellipsis {
        min-width: 22px;
        height: 28px;
    }
}
</style>
