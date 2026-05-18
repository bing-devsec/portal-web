// 行级 / 行内 diff 算法（纯函数，无 Vue / 无 monaco / 无 DOM 依赖）
//
// - DiffLineChange / InlineDiffSegment / InlineDiffResult：行级与行内片段的结构定义
// - computeLineDiff：基于 histogram-diff 主路径 + LCS 兜底，先线性裁公共前后缀
// - computeInlineDiff：基于 jsdiff 的字符级 diff，超长行 / 大窗口走整段标记降级

import { diffChars, type Change as DiffChange } from 'diff';
import { histogramDiff, type Region as HistogramRegion } from 'histogram-diff';

// 与旧 Monaco IDiffEditor.getLineChanges 结构兼容
export interface DiffLineChange {
    originalStartLineNumber: number;
    originalEndLineNumber: number;   // < start 表示纯插入（左侧在此处插入空）
    modifiedStartLineNumber: number;
    modifiedEndLineNumber: number;   // < start 表示纯删除（右侧在此处插入空）
}

/**
 * 行内差异片段。startCol / endCol 采用 Monaco 的 1-based 列号约定
 * （等同于 UTF-16 code unit 序号 + 1），可以直接构造 monaco.Range。
 */
export interface InlineDiffSegment {
    startCol: number;
    endCol: number;
}

export interface InlineDiffResult {
    leftSegments: InlineDiffSegment[];
    rightSegments: InlineDiffSegment[];
    /** 差异窗口过大、放弃精细化时为 true（此时整段被标为一个大片段） */
    tooLarge: boolean;
}

/** 单行长度超过这个阈值直接跳过行内 diff（避免 UI 卡顿） */
const INLINE_DIFF_MAX_LINE_LEN = 200_000;
/** 前后缀裁剪后中间差异窗口超过这个阈值，放弃 diffChars，整段标记 */
const INLINE_DIFF_WINDOW_LIMIT = 20_000;

/**
 * 把一行代码归一化为"结构内容"：去掉首尾空白、把 tab 视作等同于空格压缩、
 * 最终只保留内部非空白串的序列（用单个空格分隔）。这样 `  "a":1` 和 `\t"a": 1`
 * 以及 `"a": 1  ` 会被视作同一行，不会误报成 diff——这符合 JSON diff 的语义。
 *
 * 注意：归一化仅用于行级匹配，返回的 change 行号仍使用原始行号，
 * 高亮显示、同步按钮位置等用户可见内容不会受影响。
 */
const normalizeLineForDiff = (line: string): string => {
    return line.replace(/\s+/g, ' ').trim();
};

const trimHistogramRegion = (
    leftNorm: string[],
    rightNorm: string[],
    region: HistogramRegion,
): HistogramRegion | null => {
    let [aLo, aHi, bLo, bHi] = region;

    while (aLo < aHi && bLo < bHi && leftNorm[aLo] === rightNorm[bLo]) {
        aLo++;
        bLo++;
    }

    while (aLo < aHi && bLo < bHi && leftNorm[aHi - 1] === rightNorm[bHi - 1]) {
        aHi--;
        bHi--;
    }

    if (aLo === aHi && bLo === bHi) return null;
    return [aLo, aHi, bLo, bHi];
};

const mapHistogramRegionsToLineChanges = (
    leftNorm: string[],
    rightNorm: string[],
    regions: HistogramRegion[],
    lineOffset: number,
): DiffLineChange[] => {
    return regions
        .map(region => trimHistogramRegion(leftNorm, rightNorm, region))
        .filter((region): region is HistogramRegion => region !== null)
        .map(([aLo, aHi, bLo, bHi]) => ({
            originalStartLineNumber: lineOffset + aLo + 1,
            originalEndLineNumber: lineOffset + aHi,
            modifiedStartLineNumber: lineOffset + bLo + 1,
            modifiedEndLineNumber: lineOffset + bHi,
        }));
};

const offsetLineChanges = (changes: DiffLineChange[], lineOffset: number): DiffLineChange[] => {
    if (lineOffset === 0) return changes;
    return changes.map(change => ({
        originalStartLineNumber: change.originalStartLineNumber + lineOffset,
        originalEndLineNumber: change.originalEndLineNumber + lineOffset,
        modifiedStartLineNumber: change.modifiedStartLineNumber + lineOffset,
        modifiedEndLineNumber: change.modifiedEndLineNumber + lineOffset,
    }));
};

const computeLineDiffWithLcsFallback = (leftNorm: string[], rightNorm: string[]): DiffLineChange[] => {
    const m = leftNorm.length;
    const n = rightNorm.length;
    const dp: number[][] = [];
    for (let i = 0; i <= m; i++) dp.push(new Array(n + 1).fill(0));
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            if (leftNorm[i - 1] === rightNorm[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1] + 1;
            } else {
                dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
            }
        }
    }

    // 回溯得到编辑脚本：sequence of 'eq' | 'del' | 'ins'
    const ops: Array<{ type: 'eq' | 'del' | 'ins'; left?: number; right?: number }> = [];
    let i = m, j = n;
    while (i > 0 && j > 0) {
        if (leftNorm[i - 1] === rightNorm[j - 1]) {
            ops.push({ type: 'eq', left: i, right: j });
            i--; j--;
        } else if (dp[i - 1][j] >= dp[i][j - 1]) {
            ops.push({ type: 'del', left: i });
            i--;
        } else {
            ops.push({ type: 'ins', right: j });
            j--;
        }
    }
    while (i > 0) { ops.push({ type: 'del', left: i-- }); }
    while (j > 0) { ops.push({ type: 'ins', right: j-- }); }
    ops.reverse();

    // 将连续的 del/ins 合并成一个 change 块，严格按行号升序
    const changes: DiffLineChange[] = [];
    let curOrigStart = -1, curOrigEnd = -1, curModStart = -1, curModEnd = -1;
    let lastLeft = 0, lastRight = 0;
    const flush = () => {
        if (curOrigStart === -1 && curModStart === -1) return;
        const origS = curOrigStart === -1 ? lastLeft : curOrigStart;
        const origE = curOrigEnd === -1 ? origS - 1 : curOrigEnd;
        const modS = curModStart === -1 ? lastRight : curModStart;
        const modE = curModEnd === -1 ? modS - 1 : curModEnd;
        changes.push({
            originalStartLineNumber: origS,
            originalEndLineNumber: origE,
            modifiedStartLineNumber: modS,
            modifiedEndLineNumber: modE,
        });
        curOrigStart = curOrigEnd = curModStart = curModEnd = -1;
    };

    for (const op of ops) {
        if (op.type === 'eq') {
            flush();
            lastLeft = op.left!;
            lastRight = op.right!;
        } else if (op.type === 'del') {
            if (curOrigStart === -1) {
                curOrigStart = op.left!;
                if (curModStart === -1) curModStart = lastRight + 1;
            }
            curOrigEnd = op.left!;
        } else {
            if (curModStart === -1) {
                curModStart = op.right!;
                if (curOrigStart === -1) curOrigStart = lastLeft + 1;
            }
            curModEnd = op.right!;
        }
    }
    flush();
    return changes;
};

/**
 * 计算两组字符串数组之间的行级差异，返回与 Monaco IDiffEditor.getLineChanges()
 * 结构兼容的 DiffLineChange 数组。
 *
 * 主路径使用 histogram diff（更适合重复行较多的大 JSON / 数组场景），
 * 并先线性裁掉公共前后缀以避免超大相同文件误报成整段 diff。
 */
export const computeLineDiff = (leftLines: string[], rightLines: string[]): DiffLineChange[] => {
    const m = leftLines.length;
    const n = rightLines.length;

    const leftNorm = leftLines.map(normalizeLineForDiff);
    const rightNorm = rightLines.map(normalizeLineForDiff);

    if (m === 0 && n === 0) return [];

    let prefixLen = 0;
    const minLen = Math.min(m, n);
    while (prefixLen < minLen && leftNorm[prefixLen] === rightNorm[prefixLen]) {
        prefixLen++;
    }

    if (prefixLen === m && prefixLen === n) return [];

    let leftTrimEnd = m;
    let rightTrimEnd = n;
    while (
        leftTrimEnd > prefixLen &&
        rightTrimEnd > prefixLen &&
        leftNorm[leftTrimEnd - 1] === rightNorm[rightTrimEnd - 1]
    ) {
        leftTrimEnd--;
        rightTrimEnd--;
    }

    const leftWindow = leftNorm.slice(prefixLen, leftTrimEnd);
    const rightWindow = rightNorm.slice(prefixLen, rightTrimEnd);
    if (leftWindow.length === 0 && rightWindow.length === 0) return [];

    try {
        return mapHistogramRegionsToLineChanges(
            leftWindow,
            rightWindow,
            histogramDiff(leftWindow, rightWindow),
            prefixLen,
        );
    } catch {
        return offsetLineChanges(computeLineDiffWithLcsFallback(leftWindow, rightWindow), prefixLen);
    }
};

/**
 * 计算两行字符串的行内字符级差异，返回可直接用于 Monaco inlineClassName
 * 装饰的列号片段。内部做了前后缀公共串裁剪 + 差异窗口兜底，
 * 能安全处理 ~1MB 长字符串的常见 case（差异集中在一小段）。
 */
export const computeInlineDiff = (left: string, right: string): InlineDiffResult | null => {
    if (left === right) return null;

    // 防御：超长单行直接放弃行内细化
    if (left.length > INLINE_DIFF_MAX_LINE_LEN || right.length > INLINE_DIFF_MAX_LINE_LEN) {
        return null;
    }

    // 1. 最长公共前缀
    const minLen = Math.min(left.length, right.length);
    let prefixLen = 0;
    while (prefixLen < minLen && left.charCodeAt(prefixLen) === right.charCodeAt(prefixLen)) {
        prefixLen++;
    }
    // 2. 最长公共后缀（不能和前缀重叠）
    let suffixLen = 0;
    const maxSuffix = minLen - prefixLen;
    while (
        suffixLen < maxSuffix &&
        left.charCodeAt(left.length - 1 - suffixLen) === right.charCodeAt(right.length - 1 - suffixLen)
    ) {
        suffixLen++;
    }

    const leftMidLen = left.length - prefixLen - suffixLen;
    const rightMidLen = right.length - prefixLen - suffixLen;

    // 裁剪后完全一致（理论上不该走到，留作防御）
    if (leftMidLen === 0 && rightMidLen === 0) return null;

    // 差异窗口过大，直接整段标记，不再跑 diffChars
    if (leftMidLen + rightMidLen > INLINE_DIFF_WINDOW_LIMIT) {
        return {
            leftSegments: leftMidLen > 0
                ? [{ startCol: prefixLen + 1, endCol: prefixLen + leftMidLen + 1 }]
                : [],
            rightSegments: rightMidLen > 0
                ? [{ startCol: prefixLen + 1, endCol: prefixLen + rightMidLen + 1 }]
                : [],
            tooLarge: true,
        };
    }

    const leftMid = left.slice(prefixLen, left.length - suffixLen);
    const rightMid = right.slice(prefixLen, right.length - suffixLen);

    let changes: DiffChange[];
    try {
        changes = diffChars(leftMid, rightMid);
    } catch {
        // jsdiff 在极端输入下可能抛错，安全降级
        return {
            leftSegments: leftMidLen > 0
                ? [{ startCol: prefixLen + 1, endCol: prefixLen + leftMidLen + 1 }]
                : [],
            rightSegments: rightMidLen > 0
                ? [{ startCol: prefixLen + 1, endCol: prefixLen + rightMidLen + 1 }]
                : [],
            tooLarge: true,
        };
    }

    const leftSegments: InlineDiffSegment[] = [];
    const rightSegments: InlineDiffSegment[] = [];
    let leftPos = prefixLen;
    let rightPos = prefixLen;

    for (const change of changes) {
        const len = change.value.length;
        if (change.added) {
            if (len > 0) {
                rightSegments.push({
                    startCol: rightPos + 1,
                    endCol: rightPos + len + 1,
                });
            }
            rightPos += len;
        } else if (change.removed) {
            if (len > 0) {
                leftSegments.push({
                    startCol: leftPos + 1,
                    endCol: leftPos + len + 1,
                });
            }
            leftPos += len;
        } else {
            leftPos += len;
            rightPos += len;
        }
    }

    return { leftSegments, rightSegments, tooLarge: false };
};

/**
 * 给定一个 DiffLineChange，返回左右是否有内容、各自行数。
 * （endLineNumber < startLineNumber 表示该侧为空，对应"纯插入"或"纯删除"）
 */
export const getDiffLineRangeInfo = (change: DiffLineChange) => {
    const hasLeft = change.originalEndLineNumber >= change.originalStartLineNumber;
    const hasRight = change.modifiedEndLineNumber >= change.modifiedStartLineNumber;
    const leftLineCount = hasLeft
        ? change.originalEndLineNumber - change.originalStartLineNumber + 1
        : 0;
    const rightLineCount = hasRight
        ? change.modifiedEndLineNumber - change.modifiedStartLineNumber + 1
        : 0;
    return { hasLeft, hasRight, leftLineCount, rightLineCount };
};
