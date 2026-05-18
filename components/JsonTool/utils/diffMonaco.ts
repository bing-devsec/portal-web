// Monaco 相关的纯操作：view zone 渲染、行块尺寸计算、保留 undo 的全文替换
//
// 这些函数都是「输入 editor + 数据，输出新状态」的纯外部函数，不持有任何 Vue
// 响应式状态。useDiffEditors 组合式函数会调用它们完成视觉对齐与同步操作。

// Monaco 按需引入入口，与 JsonTool.client.vue / useDiffEditors.ts 保持一致，
// 避免触发 basic-languages 全家桶被拉入打包。
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';

import { type DiffLineChange, getDiffLineRangeInfo } from './diffEngine';

export interface DiffViewZoneSpec {
    afterLineNumber: number;
    heightInPx: number;
    side: 'left' | 'right';
}

const clampViewZoneAfterLineNumber = (
    editor: monaco.editor.IStandaloneCodeEditor,
    afterLineNumber: number,
): number => {
    const model = editor.getModel();
    const lineCount = model?.getLineCount() ?? 1;
    return Math.max(0, Math.min(afterLineNumber, lineCount));
};

/**
 * 计算指定行号区间在 editor 中渲染的总像素高度。
 * 优先使用 monaco 内部 getBottomForLineNumber，缺失时回退到 top + lineHeight。
 */
export const getEditorBlockHeight = (
    editor: monaco.editor.IStandaloneCodeEditor,
    startLineNumber: number,
    endLineNumber: number,
): number => {
    if (endLineNumber < startLineNumber) return 0;
    const model = editor.getModel();
    if (!model) return 0;
    const lineCount = model.getLineCount();
    if (lineCount <= 0) return 0;
    const safeStart = Math.max(1, Math.min(startLineNumber, lineCount));
    const safeEnd = Math.max(safeStart, Math.min(endLineNumber, lineCount));
    const top = editor.getTopForLineNumber(safeStart);
    const lineHeight = editor.getOption(monaco.editor.EditorOption.lineHeight);
    const editorWithBottom = editor as monaco.editor.IStandaloneCodeEditor & {
        getBottomForLineNumber?: (lineNumber: number) => number;
    };

    if (typeof editorWithBottom.getBottomForLineNumber === 'function') {
        return Math.max(lineHeight, editorWithBottom.getBottomForLineNumber(safeEnd) - top);
    }
    if (safeEnd < lineCount) {
        return Math.max(lineHeight, editor.getTopForLineNumber(safeEnd + 1) - top);
    }
    return Math.max(lineHeight, editor.getTopForLineNumber(safeEnd) + lineHeight - top);
};

/**
 * 用 specs 替换 editor 上的全部 view zones。返回新创建的 zoneId 列表，
 * 以便调用方下次再次调用时把它当 currentZoneIds 传回来。
 */
export const replaceDiffViewZones = (
    editor: monaco.editor.IStandaloneCodeEditor | null,
    currentZoneIds: string[],
    specs: DiffViewZoneSpec[],
): string[] => {
    if (!editor) return [];
    const nextZoneIds: string[] = [];
    editor.changeViewZones(accessor => {
        for (const zoneId of currentZoneIds) {
            accessor.removeZone(zoneId);
        }
        for (const spec of specs) {
            const heightInPx = Math.max(0, Math.round(spec.heightInPx));
            if (heightInPx <= 0) continue;
            const spacerNode = document.createElement('div');
            spacerNode.className = `diff-view-zone-spacer diff-view-zone-spacer-${spec.side}`;
            spacerNode.setAttribute('aria-hidden', 'true');
            spacerNode.style.height = `${heightInPx}px`;
            spacerNode.style.pointerEvents = 'none';
            nextZoneIds.push(accessor.addZone({
                afterLineNumber: clampViewZoneAfterLineNumber(editor, spec.afterLineNumber),
                heightInPx,
                domNode: spacerNode,
                suppressMouseDown: true,
            }));
        }
    });
    return nextZoneIds;
};

/**
 * 根据 changes 算出左右两侧分别需要插入的 view zone specs：
 * 让左右某一侧"长出来"的差异块在另一侧补上等高的占位空白，
 * 从而在视觉上让两侧 diff 块对齐。
 */
export const buildDiffViewZoneSpecs = (
    leftEditor: monaco.editor.IStandaloneCodeEditor,
    rightEditor: monaco.editor.IStandaloneCodeEditor,
    changes: DiffLineChange[],
): { leftSpecs: DiffViewZoneSpec[]; rightSpecs: DiffViewZoneSpec[] } => {
    const leftSpecs: DiffViewZoneSpec[] = [];
    const rightSpecs: DiffViewZoneSpec[] = [];

    for (const change of changes) {
        const { hasLeft, hasRight } = getDiffLineRangeInfo(change);
        const leftHeight = hasLeft
            ? getEditorBlockHeight(leftEditor, change.originalStartLineNumber, change.originalEndLineNumber)
            : 0;
        const rightHeight = hasRight
            ? getEditorBlockHeight(rightEditor, change.modifiedStartLineNumber, change.modifiedEndLineNumber)
            : 0;

        if (leftHeight === rightHeight) continue;

        if (leftHeight > rightHeight) {
            rightSpecs.push({
                afterLineNumber: hasRight
                    ? change.modifiedEndLineNumber
                    : change.modifiedStartLineNumber - 1,
                heightInPx: leftHeight - rightHeight,
                side: 'right',
            });
        } else {
            leftSpecs.push({
                afterLineNumber: hasLeft
                    ? change.originalEndLineNumber
                    : change.originalStartLineNumber - 1,
                heightInPx: rightHeight - leftHeight,
                side: 'left',
            });
        }
    }

    return { leftSpecs, rightSpecs };
};

/**
 * 计算某个 change 在两侧编辑器视觉中心的 Y 像素位置（用于跳转 / 同步按钮定位）。
 * 当两侧都有内容时取两侧中心的平均值；只有一侧时取该侧中心。
 */
export const getDiffChangeTop = (
    leftEditor: monaco.editor.IStandaloneCodeEditor,
    rightEditor: monaco.editor.IStandaloneCodeEditor,
    change: DiffLineChange,
): number => {
    const leftLineHeight = leftEditor.getOption(monaco.editor.EditorOption.lineHeight);
    const rightLineHeight = rightEditor.getOption(monaco.editor.EditorOption.lineHeight);
    const { hasLeft, hasRight, leftLineCount, rightLineCount } = getDiffLineRangeInfo(change);

    const getSideCenter = (
        editor: monaco.editor.IStandaloneCodeEditor,
        startLineNumber: number,
        endLineNumber: number,
        lineCount: number,
        lineHeight: number,
    ) => {
        if (lineCount <= 1) {
            return editor.getTopForLineNumber(startLineNumber) + lineHeight / 2;
        }
        return getEditorBlockHeight(editor, startLineNumber, endLineNumber) / 2
            + editor.getTopForLineNumber(startLineNumber);
    };

    if (hasLeft && hasRight) {
        const leftCenter = getSideCenter(
            leftEditor,
            change.originalStartLineNumber,
            change.originalEndLineNumber,
            leftLineCount,
            leftLineHeight,
        );
        const rightCenter = getSideCenter(
            rightEditor,
            change.modifiedStartLineNumber,
            change.modifiedEndLineNumber,
            rightLineCount,
            rightLineHeight,
        );
        return (leftCenter + rightCenter) / 2;
    }
    if (hasRight) {
        return getSideCenter(
            rightEditor,
            change.modifiedStartLineNumber,
            change.modifiedEndLineNumber,
            rightLineCount,
            rightLineHeight,
        );
    }
    if (hasLeft) {
        return getSideCenter(
            leftEditor,
            change.originalStartLineNumber,
            change.originalEndLineNumber,
            leftLineCount,
            leftLineHeight,
        );
    }
    return 0;
};

/**
 * 用 executeEdits 做全文替换，保留 undo/redo 栈。
 * 关键点：
 *   1. 通过 pushStackElement 把本次替换强制切成独立的 undo step，
 *      避免和用户此前的手动输入合并在一起、一次 Ctrl+Z 撤销过多；
 *   2. source 参数会挂到 undo step 上，便于未来排查到底是哪个操作产生的变更。
 *
 * 绝对不要直接 editor.setValue(...) —— setValue 会把整个 undo/redo 栈清空，
 * 导致用户感觉"撤销/取消撤销失灵"。
 */
export const replaceEditorValuePreservingUndo = (
    editor: monaco.editor.IStandaloneCodeEditor,
    newValue: string,
    source: string,
) => {
    const model = editor.getModel();
    if (!model) {
        editor.setValue(newValue);
        return;
    }
    const currentValue = model.getValue();
    if (currentValue === newValue) return;

    const lastLine = model.getLineCount();
    const lastCol = model.getLineMaxColumn(lastLine);
    const fullRange = new monaco.Range(1, 1, lastLine, lastCol);

    // 关键：编辑前后各切一次 undo step，保证本次替换独占一个 undo group
    model.pushStackElement();
    editor.executeEdits(source, [{ range: fullRange, text: newValue }]);
    model.pushStackElement();
};

/**
 * 自动布局某个 diff editor：优先按容器 rect 大小 layout，rect 不可用时回退默认 layout。
 */
export const layoutOneDiffEditor = (
    editor: monaco.editor.IStandaloneCodeEditor | null,
    container: HTMLElement | null,
) => {
    if (!editor || !container) return;
    const rect = container.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
        editor.layout({ width: rect.width, height: rect.height });
    } else {
        editor.layout();
    }
};
