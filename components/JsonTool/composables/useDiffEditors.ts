// Diff 编辑器：Monaco 双编辑器实例 + 行级 diff 可视化 + 草稿持久化
//
// 这个组合式函数承担「diff 模式下的全部 editor 生命周期」：
//   1) 创建 / 销毁 左右两个 Monaco editor 实例（基础选项）
//   2) 行级 / 行内 diff 计算、同步按钮渲染、view zones 对齐
//   3) 跳转上 / 下一个 diff、左右一键同步
//   4) 同步滚动（带重入锁）
//   5) IndexedDB diff 草稿的保存 / 恢复
//   6) 布局调度（rAF debounce）
//
// 不包含：
//   - 进入 / 退出 diff 模式的页面状态机（留在主文件，因为涉及 normal editor 的销毁/恢复）
//   - 格式化 / 排序 / 复制 / 清空 / 上传 / 下载（这些跨普通模式 + diff 模式，留在主文件，
//     主文件通过 getDiffLeftEditor / getDiffRightEditor 拿到实例后调用 utils 中的
//     replaceEditorValuePreservingUndo 完成内容替换）
//
// 主文件的 helper（trackEditorFocus / setupDoubleClickSelectString / ...）通过 options
// 注入，避免反向 import 主文件。

// Monaco 按需引入：仅引核心编辑器 API + JSON 语言贡献，避免拉入 basic-languages 全家桶。
// 与主文件 JsonTool.client.vue 保持同一入口，确保 Vite 不会因为另一个 'monaco-editor'
// 入口而合并出完整产物 chunk。
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import { type Ref, ref } from 'vue';

import { calculateByteSize } from '../utils/byteUtils';
import {
    type DiffLineChange,
    computeInlineDiff,
    computeLineDiff,
    getDiffLineRangeInfo,
} from '../utils/diffEngine';
import {
    IDB_STORE_DIFF_DRAFTS,
    MAX_DIFF_SIDE_SIZE,
    MAX_DIFF_TAB_COUNT,
    idbCount,
    idbGet,
    idbPut,
} from '../utils/idb';
import {
    buildDiffViewZoneSpecs,
    getDiffChangeTop,
    layoutOneDiffEditor,
    replaceDiffViewZones,
} from '../utils/diffMonaco';

interface DiffSyncButton {
    top: number;
    changeIndex: number;
}

interface DiffDraftRecord {
    tabId: string;
    leftText: string;
    rightText: string;
    updatedAt: number;
    version: number;
}

export interface UseDiffEditorsOptions {
    // DOM 容器与状态条
    leftContainerRef: Ref<HTMLElement | null>;
    rightContainerRef: Ref<HTMLElement | null>;
    leftStatusRef: Ref<string>;
    rightStatusRef: Ref<string>;

    // 标签页隔离 & 通知
    tabId: Ref<string>;
    onError: (msg: string) => void;

    // 与普通模式共享的设置项（响应式 ref）
    showMinimap: Ref<boolean>;
    fontSize: Ref<number>;
    /** wordWrap.value === true 表示用户要"不换行"，与设置开关取反语义 */
    wordWrap: Ref<boolean>;
    showIndentGuide: Ref<boolean>;

    // 主文件提供的 editor 通用工具（注入，避免反向 import 主文件）
    trackEditorFocus: (editor: monaco.editor.IStandaloneCodeEditor) => void;
    setupDoubleClickSelectString: (editor: monaco.editor.IStandaloneCodeEditor, copy: boolean) => void;
    registerClipboardActions: (editor: monaco.editor.IStandaloneCodeEditor) => void;
    registerEncodingActions: (editor: monaco.editor.IStandaloneCodeEditor) => void;
    filterBuiltinContextMenuActions: (editor: monaco.editor.IStandaloneCodeEditor, hiddenIds: string[]) => void;
    setupSelectionListener: (
        editor: monaco.editor.IStandaloneCodeEditor,
        statusRef: Ref<string>,
    ) => monaco.IDisposable[];
    updateLineNumberWidth: (editor: monaco.editor.IStandaloneCodeEditor) => void;
    /** 内容变化时计算缩进，返回 tab 大小 */
    detectIndentSize: (content: string) => number;
    /** 销毁 editor 前的钩子，让主文件清理诸如 lastFocusedEditor 的引用 */
    onBeforeDisposeEditor?: (editor: monaco.editor.IStandaloneCodeEditor) => void;
}

export interface UseDiffEditorsReturn {
    // 视图层使用的响应式状态
    diffCount: Ref<number>;
    activeDiffIndex: Ref<number>;
    diffSyncButtons: Ref<DiffSyncButton[]>;
    diffDraftLeftText: Ref<string>;
    diffDraftRightText: Ref<string>;

    // editor 实例的访问器
    getDiffLeftEditor: () => monaco.editor.IStandaloneCodeEditor | null;
    getDiffRightEditor: () => monaco.editor.IStandaloneCodeEditor | null;
    getDiffSideEditor: (side: 'left' | 'right') => monaco.editor.IStandaloneCodeEditor | null;
    isDiffEditorReady: () => boolean;

    // 生命周期
    createDiffEditor: () => void;
    destroyDiffEditor: () => void;

    // 调度
    scheduleDiffEditorLayout: () => void;
    scheduleDiffRecompute: () => void;

    // 计算 / 跳转 / 同步
    recomputeDiff: () => void;
    updateDiffSyncButtons: () => void;
    goToNextDiff: () => void;
    goToPrevDiff: () => void;
    revealDiffChange: (index: number) => void;
    handleDiffSync: (changeIndex: number, direction: 'left' | 'right') => void;

    // 草稿
    captureDiffDraftFromEditors: () => void;
    saveDiffDraft: (reason: string) => Promise<void>;
    restoreDiffDraftIntoEditors: () => Promise<void>;

    // 选项透传 / 布局
    updateDiffEditorOptions: (options: monaco.editor.IEditorOptions) => void;
    layoutDiffEditors: () => void;
}

export const useDiffEditors = (opts: UseDiffEditorsOptions): UseDiffEditorsReturn => {
    const {
        leftContainerRef,
        rightContainerRef,
        leftStatusRef,
        rightStatusRef,
        tabId,
        onError,
        showMinimap,
        fontSize,
        wordWrap,
        showIndentGuide,
        trackEditorFocus,
        setupDoubleClickSelectString,
        registerClipboardActions,
        registerEncodingActions,
        filterBuiltinContextMenuActions,
        setupSelectionListener,
        updateLineNumberWidth,
        detectIndentSize,
        onBeforeDisposeEditor,
    } = opts;

    // ==================== 内部状态 ====================
    let diffLeftEditor: monaco.editor.IStandaloneCodeEditor | null = null;
    let diffRightEditor: monaco.editor.IStandaloneCodeEditor | null = null;

    let diffLineChanges: DiffLineChange[] = [];
    let diffLeftDecorations: string[] = [];
    let diffRightDecorations: string[] = [];
    let diffLeftViewZoneIds: string[] = [];
    let diffRightViewZoneIds: string[] = [];

    let diffSyncingScroll = false;
    let diffContentDisposables: monaco.IDisposable[] = [];
    let diffLeftResizeObserver: ResizeObserver | null = null;
    let diffRightResizeObserver: ResizeObserver | null = null;
    let diffEditorLayoutRaf: number | null = null;
    let diffRecomputeRaf: number | null = null;

    const diffCount = ref(0);
    const activeDiffIndex = ref(-1);
    const diffSyncButtons = ref<DiffSyncButton[]>([]);
    const diffDraftLeftText = ref('');
    const diffDraftRightText = ref('');

    // ==================== view zones / decoration ====================
    const clearDiffViewZones = () => {
        diffLeftViewZoneIds = replaceDiffViewZones(diffLeftEditor, diffLeftViewZoneIds, []);
        diffRightViewZoneIds = replaceDiffViewZones(diffRightEditor, diffRightViewZoneIds, []);
    };

    const rebuildDiffViewZones = (changes: DiffLineChange[]) => {
        if (!diffLeftEditor || !diffRightEditor) {
            diffLeftViewZoneIds = [];
            diffRightViewZoneIds = [];
            return;
        }
        const { leftSpecs, rightSpecs } = buildDiffViewZoneSpecs(diffLeftEditor, diffRightEditor, changes);
        diffLeftViewZoneIds = replaceDiffViewZones(diffLeftEditor, diffLeftViewZoneIds, leftSpecs);
        diffRightViewZoneIds = replaceDiffViewZones(diffRightEditor, diffRightViewZoneIds, rightSpecs);
    };

    // ==================== 布局调度 ====================
    const layoutDiffEditors = () => {
        layoutOneDiffEditor(diffLeftEditor, leftContainerRef.value);
        layoutOneDiffEditor(diffRightEditor, rightContainerRef.value);
    };

    const scheduleDiffEditorLayout = () => {
        if (diffEditorLayoutRaf != null) return;
        diffEditorLayoutRaf = requestAnimationFrame(() => {
            diffEditorLayoutRaf = null;
            layoutDiffEditors();
            // 下一帧再 layout 一次，确保容器在尺寸恢复后 Monaco 内容正确渲染
            requestAnimationFrame(() => {
                layoutDiffEditors();
            });
            updateDiffSyncButtons();
        });
    };

    // ==================== diff 重算 ====================
    const scheduleDiffRecompute = () => {
        if (diffRecomputeRaf != null) return;
        diffRecomputeRaf = requestAnimationFrame(() => {
            diffRecomputeRaf = null;
            recomputeDiff();
        });
    };

    const updateDiffEditorTabSize = (
        editor: monaco.editor.IStandaloneCodeEditor,
        content: string,
    ) => {
        const detected = detectIndentSize(content);
        const model = editor.getModel();
        if (model) {
            model.updateOptions({ tabSize: detected, indentSize: detected });
        }
    };

    function recomputeDiff() {
        if (!diffLeftEditor || !diffRightEditor) {
            diffLineChanges = [];
            diffCount.value = 0;
            diffSyncButtons.value = [];
            clearDiffViewZones();
            return;
        }
        const leftModel = diffLeftEditor.getModel();
        const rightModel = diffRightEditor.getModel();
        if (!leftModel || !rightModel) return;

        const leftLines = leftModel.getLinesContent();
        const rightLines = rightModel.getLinesContent();
        const changes = computeLineDiff(leftLines, rightLines);
        diffLineChanges = changes;
        diffCount.value = changes.length;
        clearDiffViewZones();
        rebuildDiffViewZones(changes);

        // 分别在左右编辑器上打差异行高亮
        const leftDecos: monaco.editor.IModelDeltaDecoration[] = [];
        const rightDecos: monaco.editor.IModelDeltaDecoration[] = [];
        for (const c of changes) {
            const { leftLineCount, rightLineCount, hasLeft, hasRight } = getDiffLineRangeInfo(c);

            if (hasLeft) {
                leftDecos.push({
                    range: new monaco.Range(c.originalStartLineNumber, 1, c.originalEndLineNumber, 1),
                    options: {
                        isWholeLine: true,
                        className: 'diff-line-delete',
                        linesDecorationsClassName: 'diff-line-delete-margin',
                    },
                });
            }
            if (hasRight) {
                rightDecos.push({
                    range: new monaco.Range(c.modifiedStartLineNumber, 1, c.modifiedEndLineNumber, 1),
                    options: {
                        isWholeLine: true,
                        className: 'diff-line-insert',
                        linesDecorationsClassName: 'diff-line-insert-margin',
                    },
                });
            }

            // 行内字符级 diff：
            // - "1 删 1 增" 的孤立替换：直接比对这两行；
            // - "N 删 N 增" 的等长替换块：按位置强配对 left[i] ↔ right[i]，
            //   因为等行数的连续替换块基本就是"逐行修改"场景，按位置配对正确率高；
            // - 行数不等（N 删 M 增且 N≠M）：跳过行内 diff，避免位置错位产生误导。
            if (hasLeft && hasRight && leftLineCount === rightLineCount) {
                for (let k = 0; k < leftLineCount; k++) {
                    const leftLineNo = c.originalStartLineNumber + k;
                    const rightLineNo = c.modifiedStartLineNumber + k;
                    const leftLine = leftLines[leftLineNo - 1] ?? '';
                    const rightLine = rightLines[rightLineNo - 1] ?? '';
                    const inline = computeInlineDiff(leftLine, rightLine);
                    if (!inline) continue;
                    for (const seg of inline.leftSegments) {
                        leftDecos.push({
                            range: new monaco.Range(leftLineNo, seg.startCol, leftLineNo, seg.endCol),
                            options: { inlineClassName: 'diff-inline-delete' },
                        });
                    }
                    for (const seg of inline.rightSegments) {
                        rightDecos.push({
                            range: new monaco.Range(rightLineNo, seg.startCol, rightLineNo, seg.endCol),
                            options: { inlineClassName: 'diff-inline-insert' },
                        });
                    }
                }
            }
        }
        diffLeftDecorations = diffLeftEditor.deltaDecorations(diffLeftDecorations, leftDecos);
        diffRightDecorations = diffRightEditor.deltaDecorations(diffRightDecorations, rightDecos);

        if (activeDiffIndex.value >= changes.length) activeDiffIndex.value = changes.length - 1;
        updateDiffSyncButtons();
    }

    function updateDiffSyncButtons() {
        if (!diffLeftEditor || !diffRightEditor || diffLineChanges.length === 0) {
            diffSyncButtons.value = [];
            if (diffLineChanges.length === 0) activeDiffIndex.value = -1;
            return;
        }

        const scrollTop = diffRightEditor.getScrollTop();
        const viewportHeight = diffRightEditor.getLayoutInfo().height;
        const buttons: DiffSyncButton[] = [];

        for (let i = 0; i < diffLineChanges.length; i++) {
            const buttonTop = getDiffChangeTop(diffLeftEditor, diffRightEditor, diffLineChanges[i]) - scrollTop;
            if (buttonTop < -30 || buttonTop > viewportHeight + 30) continue;
            buttons.push({ top: buttonTop, changeIndex: i });
        }
        diffSyncButtons.value = buttons;
    }

    // ==================== 跳转 / 同步 ====================
    const handleDiffSync = (changeIndex: number, direction: 'left' | 'right') => {
        if (!diffLeftEditor || !diffRightEditor) return;
        if (changeIndex < 0 || changeIndex >= diffLineChanges.length) return;
        activeDiffIndex.value = changeIndex;

        const origModel = diffLeftEditor.getModel();
        const modModel = diffRightEditor.getModel();
        if (!origModel || !modModel) return;

        const change = diffLineChanges[changeIndex];
        const origStart = change.originalStartLineNumber;
        const origEnd = change.originalEndLineNumber;
        const modStart = change.modifiedStartLineNumber;
        const modEnd = change.modifiedEndLineNumber;

        // 关键：把"同步箭头"整个操作包成一个独立的 undo step，
        // 这样 Ctrl+Z 能精准撤销这一次同步，而不会和用户之前/之后的手动输入合并。
        // 只对实际被修改的一侧模型切 undo step。
        const targetModel = direction === 'left' ? origModel : modModel;
        targetModel.pushStackElement();

        if (direction === 'left') {
            // 右 → 左：用 modified 的内容覆盖 original 的差异块
            const modContent = modEnd >= modStart
                ? modModel.getValueInRange(new monaco.Range(modStart, 1, modEnd, modModel.getLineMaxColumn(modEnd)))
                : '';
            if (origEnd < origStart) {
                // 左侧是纯插入点（没有对应行）→ 在 origStart 所指行之后插入
                if (modContent) {
                    const insertLine = Math.max(1, origStart);
                    const totalLines = origModel.getLineCount();
                    const range = insertLine > totalLines
                        ? new monaco.Range(totalLines, origModel.getLineMaxColumn(totalLines), totalLines, origModel.getLineMaxColumn(totalLines))
                        : new monaco.Range(insertLine, 1, insertLine, 1);
                    const text = insertLine > totalLines ? '\n' + modContent : modContent + '\n';
                    diffLeftEditor.executeEdits('diff-sync-right-to-left', [{ range, text }]);
                }
            } else if (modContent) {
                diffLeftEditor.executeEdits('diff-sync-right-to-left', [{
                    range: new monaco.Range(origStart, 1, origEnd, origModel.getLineMaxColumn(origEnd)),
                    text: modContent,
                }]);
            } else {
                const totalLines = origModel.getLineCount();
                const delEnd = origEnd + 1;
                const delRange = delEnd <= totalLines
                    ? new monaco.Range(origStart, 1, delEnd, 1)
                    : new monaco.Range(Math.max(1, origStart - 1), origStart > 1 ? origModel.getLineMaxColumn(origStart - 1) : 1, origEnd, origModel.getLineMaxColumn(origEnd));
                diffLeftEditor.executeEdits('diff-sync-right-to-left', [{ range: delRange, text: '' }]);
            }
        } else {
            // 左 → 右：用 original 的内容覆盖 modified 的差异块
            const origContent = origEnd >= origStart
                ? origModel.getValueInRange(new monaco.Range(origStart, 1, origEnd, origModel.getLineMaxColumn(origEnd)))
                : '';
            if (modEnd < modStart) {
                if (origContent) {
                    const insertLine = Math.max(1, modStart);
                    const totalLines = modModel.getLineCount();
                    const range = insertLine > totalLines
                        ? new monaco.Range(totalLines, modModel.getLineMaxColumn(totalLines), totalLines, modModel.getLineMaxColumn(totalLines))
                        : new monaco.Range(insertLine, 1, insertLine, 1);
                    const text = insertLine > totalLines ? '\n' + origContent : origContent + '\n';
                    diffRightEditor.executeEdits('diff-sync-left-to-right', [{ range, text }]);
                }
            } else if (origContent) {
                diffRightEditor.executeEdits('diff-sync-left-to-right', [{
                    range: new monaco.Range(modStart, 1, modEnd, modModel.getLineMaxColumn(modEnd)),
                    text: origContent,
                }]);
            } else {
                const totalLines = modModel.getLineCount();
                const delEnd = modEnd + 1;
                const delRange = delEnd <= totalLines
                    ? new monaco.Range(modStart, 1, delEnd, 1)
                    : new monaco.Range(Math.max(1, modStart - 1), modStart > 1 ? modModel.getLineMaxColumn(modStart - 1) : 1, modEnd, modModel.getLineMaxColumn(modEnd));
                diffRightEditor.executeEdits('diff-sync-left-to-right', [{ range: delRange, text: '' }]);
            }
        }

        // 同步后再切一次，确保后续的手动输入不会被合并进来
        targetModel.pushStackElement();
    };

    const revealDiffChange = (index: number) => {
        if (!diffLeftEditor || !diffRightEditor) return;
        if (index < 0 || index >= diffLineChanges.length) return;
        const change = diffLineChanges[index];
        const viewportHeight = diffRightEditor.getLayoutInfo().height;
        const rightLineHeight = diffRightEditor.getOption(monaco.editor.EditorOption.lineHeight);
        const targetScrollTop = Math.max(
            0,
            getDiffChangeTop(diffLeftEditor, diffRightEditor, change) - (viewportHeight - rightLineHeight) / 2,
        );

        diffSyncingScroll = true;
        try {
            diffLeftEditor.setScrollTop(targetScrollTop);
            diffRightEditor.setScrollTop(targetScrollTop);
        } finally {
            diffSyncingScroll = false;
        }
    };

    const goToNextDiff = () => {
        if (diffLineChanges.length === 0) return;
        activeDiffIndex.value = activeDiffIndex.value < 0
            ? 0
            : (activeDiffIndex.value + 1) % diffLineChanges.length;
        revealDiffChange(activeDiffIndex.value);
        updateDiffSyncButtons();
    };

    const goToPrevDiff = () => {
        if (diffLineChanges.length === 0) return;
        activeDiffIndex.value = activeDiffIndex.value < 0
            ? diffLineChanges.length - 1
            : (activeDiffIndex.value - 1 + diffLineChanges.length) % diffLineChanges.length;
        revealDiffChange(activeDiffIndex.value);
        updateDiffSyncButtons();
    };

    // ==================== 草稿持久化 ====================
    const captureDiffDraftFromEditors = () => {
        if (!diffLeftEditor || !diffRightEditor) return;
        diffDraftLeftText.value = diffLeftEditor.getValue() ?? '';
        diffDraftRightText.value = diffRightEditor.getValue() ?? '';
    };

    const saveDiffDraft = async (reason: string) => {
        if (typeof window === 'undefined') return;
        if (!tabId.value) return;

        // 优先从 editor 读取；如果当前不在 diff 模式，则保存上次 exit 时缓存的内容
        if (diffLeftEditor && diffRightEditor) {
            captureDiffDraftFromEditors();
        }

        const left = diffDraftLeftText.value ?? '';
        const right = diffDraftRightText.value ?? '';

        const leftSize = calculateByteSize(left);
        const rightSize = calculateByteSize(right);
        if (leftSize > MAX_DIFF_SIDE_SIZE || rightSize > MAX_DIFF_SIDE_SIZE) {
            onError(`diff 草稿保存失败：左右任一侧内容大小不能超过 30MB（当前左 ${Math.round(leftSize / (1024 * 1024))}MB，右 ${Math.round(rightSize / (1024 * 1024))}MB）`);
            return;
        }

        try {
            const existing = await idbGet<DiffDraftRecord>(IDB_STORE_DIFF_DRAFTS, tabId.value);
            if (!existing) {
                const count = await idbCount(IDB_STORE_DIFF_DRAFTS);
                if (count >= MAX_DIFF_TAB_COUNT) {
                    onError(`diff 草稿保存失败：已达到标签页数量上限（${MAX_DIFF_TAB_COUNT}个）`);
                    return;
                }
            }
            const record: DiffDraftRecord = {
                tabId: tabId.value,
                leftText: left,
                rightText: right,
                updatedAt: Date.now(),
                version: 1,
            };
            await idbPut(IDB_STORE_DIFF_DRAFTS, record);
        } catch (e: any) {
            onError(`diff 草稿保存失败（${reason}）：${e?.message ?? String(e)}`);
        }
    };

    const restoreDiffDraftIntoEditors = async () => {
        if (typeof window === 'undefined') return;
        if (!tabId.value) return;
        if (!diffLeftEditor || !diffRightEditor) return;

        try {
            const record = await idbGet<DiffDraftRecord>(IDB_STORE_DIFF_DRAFTS, tabId.value);
            if (!record) return;
            diffDraftLeftText.value = record.leftText ?? '';
            diffDraftRightText.value = record.rightText ?? '';

            const leftModel = diffLeftEditor.getModel();
            const rightModel = diffRightEditor.getModel();
            if (leftModel) leftModel.setValue(diffDraftLeftText.value);
            if (rightModel) rightModel.setValue(diffDraftRightText.value);
        } catch (e: any) {
            onError(`diff 草稿恢复失败：${e?.message ?? String(e)}`);
        }
    };

    // ==================== 创建 / 销毁 ====================
    const createDiffEditor = () => {
        if (!leftContainerRef.value || !rightContainerRef.value) return;

        const baseOptions: monaco.editor.IStandaloneEditorConstructionOptions = {
            language: 'json',
            folding: false,
            readOnly: false,
            minimap: { enabled: showMinimap.value },
            lineNumbers: 'on',
            lineNumbersMinChars: 3,
            roundedSelection: true,
            scrollBeyondLastLine: false,
            smoothScrolling: true,
            scrollbar: {
                verticalScrollbarSize: 12,
                horizontalScrollbarSize: 12,
                verticalSliderSize: 12,
                horizontalSliderSize: 12,
                useShadows: false,
            },
            fontSize: fontSize.value,
            lineHeight: 16,
            // 注意：设置对话框里的 switch 做了值反转（active=false, inactive=true），
            // 所以 wordWrap.value === true 代表"用户要不换行"。
            // 此处必须与 getEditorOptions / updateWordWrap 保持同一语义约定，
            wordWrap: wordWrap.value ? ('off' as const) : ('on' as const),
            unicodeHighlight: {
                ambiguousCharacters: true,
                invisibleCharacters: true,
                nonBasicASCII: false,
            },
            stickyScroll: { enabled: false },
            automaticLayout: false,
            renderLineHighlight: 'all',
            // 与普通模式保持一致：禁用查找框打开时顶部预留的空行，
            // 否则 Cmd/Ctrl+F 弹出查找框时第一行上方会出现一段无行号的空白。
            find: {
                addExtraSpaceOnTop: false,
                autoFindInSelection: 'multiline' as const,
                seedSearchStringFromSelection: 'always' as const,
            },
            guides: {
                indentation: showIndentGuide.value,
                bracketPairs: showIndentGuide.value,
                highlightActiveIndentation: showIndentGuide.value,
            },
            bracketPairColorization: {
                enabled: true,
                independentColorPoolPerBracketType: true,
            },
        };

        const leftModel = monaco.editor.createModel('', 'json');
        const rightModel = monaco.editor.createModel('', 'json');

        diffLeftEditor = monaco.editor.create(leftContainerRef.value, {
            ...baseOptions,
            model: leftModel,
        });
        diffRightEditor = monaco.editor.create(rightContainerRef.value, {
            ...baseOptions,
            model: rightModel,
        });

        // Monaco 会为每个编辑器生成一个隐藏 textarea 作为真实输入控件。
        // 给它补上稳定的 id/name，避免浏览器/DevTools 报“form field 缺少 id/name”警告。
        const leftTextarea = leftContainerRef.value.querySelector<HTMLTextAreaElement>('textarea.inputarea');
        if (leftTextarea) {
            leftTextarea.setAttribute('id', 'monaco-diff-left-editor');
            leftTextarea.setAttribute('name', 'monaco-diff-left-editor');
        }
        const rightTextarea = rightContainerRef.value.querySelector<HTMLTextAreaElement>('textarea.inputarea');
        if (rightTextarea) {
            rightTextarea.setAttribute('id', 'monaco-diff-right-editor');
            rightTextarea.setAttribute('name', 'monaco-diff-right-editor');
        }

        updateLineNumberWidth(diffLeftEditor);
        updateLineNumberWidth(diffRightEditor);

        // 跟踪左右 diff 编辑器的聚焦，让 Cmd/Ctrl+F 全局快捷键能正确定位到当前激活的一侧
        trackEditorFocus(diffLeftEditor);
        trackEditorFocus(diffRightEditor);

        // 双击选中整段字符串（与普通模式 input 一致，仅选中不复制，方便就地修改）
        setupDoubleClickSelectString(diffLeftEditor, false);
        setupDoubleClickSelectString(diffRightEditor, false);

        // 右键菜单：Base64 / URL 编解码（与普通模式 input 一致，使用同一份 i18n 文案）
        registerClipboardActions(diffLeftEditor);
        registerClipboardActions(diffRightEditor);
        registerEncodingActions(diffLeftEditor);
        registerEncodingActions(diffRightEditor);
        filterBuiltinContextMenuActions(diffLeftEditor, [
            'editor.action.changeAll',
            'editor.action.clipboardCutAction',
            'editor.action.clipboardCopyAction',
            'editor.action.clipboardPasteAction',
        ]);
        filterBuiltinContextMenuActions(diffRightEditor, [
            'editor.action.changeAll',
            'editor.action.clipboardCutAction',
            'editor.action.clipboardCopyAction',
            'editor.action.clipboardPasteAction',
        ]);

        diffContentDisposables.push(
            ...setupSelectionListener(diffLeftEditor, leftStatusRef),
            ...setupSelectionListener(diffRightEditor, rightStatusRef),
            leftModel.onDidChangeContent(() => {
                if (diffLeftEditor) updateDiffEditorTabSize(diffLeftEditor, leftModel.getValue());
                if (diffLeftEditor) updateLineNumberWidth(diffLeftEditor);
                scheduleDiffRecompute();
            }),
            rightModel.onDidChangeContent(() => {
                if (diffRightEditor) updateDiffEditorTabSize(diffRightEditor, rightModel.getValue());
                if (diffRightEditor) updateLineNumberWidth(diffRightEditor);
                scheduleDiffRecompute();
            }),
            diffLeftEditor.onDidScrollChange(e => {
                if (diffSyncingScroll || !diffRightEditor) return;
                diffSyncingScroll = true;
                try {
                    diffRightEditor.setScrollTop(e.scrollTop);
                    diffRightEditor.setScrollLeft(e.scrollLeft);
                } finally {
                    diffSyncingScroll = false;
                }
                updateDiffSyncButtons();
            }),
            diffRightEditor.onDidScrollChange(e => {
                if (diffSyncingScroll || !diffLeftEditor) return;
                diffSyncingScroll = true;
                try {
                    diffLeftEditor.setScrollTop(e.scrollTop);
                    diffLeftEditor.setScrollLeft(e.scrollLeft);
                } finally {
                    diffSyncingScroll = false;
                }
                updateDiffSyncButtons();
            }),
            diffLeftEditor.onDidLayoutChange(() => updateDiffSyncButtons()),
            diffRightEditor.onDidLayoutChange(() => updateDiffSyncButtons()),
        );

        // ResizeObserver 分别监听两个容器
        if (typeof ResizeObserver !== 'undefined') {
            diffLeftResizeObserver?.disconnect();
            diffRightResizeObserver?.disconnect();
            diffLeftResizeObserver = new ResizeObserver(() => scheduleDiffEditorLayout());
            diffRightResizeObserver = new ResizeObserver(() => scheduleDiffEditorLayout());
            diffLeftResizeObserver.observe(leftContainerRef.value);
            diffRightResizeObserver.observe(rightContainerRef.value);
        }

        scheduleDiffEditorLayout();
        scheduleDiffRecompute();
    };

    const destroyDiffEditor = () => {
        diffContentDisposables.forEach(d => d.dispose());
        diffContentDisposables = [];
        diffSyncButtons.value = [];
        activeDiffIndex.value = -1;
        leftStatusRef.value = '';
        rightStatusRef.value = '';
        clearDiffViewZones();

        if (diffLeftResizeObserver) { diffLeftResizeObserver.disconnect(); diffLeftResizeObserver = null; }
        if (diffRightResizeObserver) { diffRightResizeObserver.disconnect(); diffRightResizeObserver = null; }
        if (diffEditorLayoutRaf != null) { cancelAnimationFrame(diffEditorLayoutRaf); diffEditorLayoutRaf = null; }
        if (diffRecomputeRaf != null) { cancelAnimationFrame(diffRecomputeRaf); diffRecomputeRaf = null; }

        if (diffLeftEditor) {
            const m = diffLeftEditor.getModel();
            onBeforeDisposeEditor?.(diffLeftEditor);
            diffLeftEditor.dispose();
            m?.dispose();
            diffLeftEditor = null;
        }
        if (diffRightEditor) {
            const m = diffRightEditor.getModel();
            onBeforeDisposeEditor?.(diffRightEditor);
            diffRightEditor.dispose();
            m?.dispose();
            diffRightEditor = null;
        }
        diffLineChanges = [];
        diffLeftDecorations = [];
        diffRightDecorations = [];
        diffLeftViewZoneIds = [];
        diffRightViewZoneIds = [];
        diffCount.value = 0;
    };

    // ==================== 选项透传 ====================
    const updateDiffEditorOptions = (options: monaco.editor.IEditorOptions) => {
        diffLeftEditor?.updateOptions(options);
        diffRightEditor?.updateOptions(options);
    };

    return {
        diffCount,
        activeDiffIndex,
        diffSyncButtons,
        diffDraftLeftText,
        diffDraftRightText,

        getDiffLeftEditor: () => diffLeftEditor,
        getDiffRightEditor: () => diffRightEditor,
        getDiffSideEditor: (side) => (side === 'left' ? diffLeftEditor : diffRightEditor),
        isDiffEditorReady: () => diffLeftEditor != null && diffRightEditor != null,

        createDiffEditor,
        destroyDiffEditor,

        scheduleDiffEditorLayout,
        scheduleDiffRecompute,

        recomputeDiff,
        updateDiffSyncButtons,
        goToNextDiff,
        goToPrevDiff,
        revealDiffChange,
        handleDiffSync,

        captureDiffDraftFromEditors,
        saveDiffDraft,
        restoreDiffDraftIntoEditors,

        updateDiffEditorOptions,
        layoutDiffEditors,
    };
};
