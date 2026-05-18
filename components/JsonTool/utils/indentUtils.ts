// 缩进检测与重排

// 从内容中检测缩进大小（以空格数为单位）
// fallback: 当无法识别时返回的默认值
export const detectIndentSize = (content: string, fallback: number = 4): number => {
    const lines = content.split('\n');
    const indentCounts: Record<number, number> = {};
    for (const line of lines) {
        const match = line.match(/^( +)\S/);
        if (match) {
            const len = match[1].length;
            if (len > 0 && len <= 16) {
                indentCounts[len] = (indentCounts[len] || 0) + 1;
            }
        }
    }
    const sizes = Object.keys(indentCounts).map(Number).sort((a, b) => a - b);
    if (sizes.length === 0) return fallback;
    const minIndent = sizes[0];
    if (minIndent >= 1 && minIndent <= 8) return minIndent;
    return fallback;
};

// 重新格式化JSON字符串的缩进，保持内容不变（不解析转义序列）
export const reformatJsonIndentation = (jsonString: string, newIndentSize: number): string => {
    // 目标：仅调整缩进显示，不解析或改变字符串中的转义序列
    const lines = jsonString.split('\n');

    // 收集所有有缩进的行的缩进长度（包括只有单个括号的行）
    const indentLengths: number[] = [];
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const m = line.match(/^(\s*)/);
        const len = m ? m[1].length : 0;
        if (len > 0) indentLengths.push(len);
    }

    // 如果没有可检测的缩进，直接返回原文
    if (indentLengths.length === 0) return jsonString;

    // 使用最小缩进作为当前缩进单位
    const currentIndentSize = Math.min(...indentLengths);
    if (currentIndentSize === newIndentSize) return jsonString;

    // 对每一行按实际缩进长度重新计算层级并应用新缩进
    const resultLines: string[] = [];
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) {
            resultLines.push('');
            continue;
        }

        // 计算该行原始缩进长度
        const m = line.match(/^(\s*)/);
        const originalIndentLen = m ? m[1].length : 0;

        // 计算层级（向下取整以避免增加缩进）
        const level = originalIndentLen > 0 ? Math.floor(originalIndentLen / currentIndentSize) : 0;

        const newIndent = ' '.repeat(level * newIndentSize);
        resultLines.push(newIndent + trimmed);
    }

    return resultLines.join('\n');
};
