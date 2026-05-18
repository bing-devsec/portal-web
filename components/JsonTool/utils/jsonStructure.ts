// JSON 结构分析与转义检查（纯函数）

// 计算 JSON 对象的最大深度或最大层级
export const calculateJsonStructure = (
    obj: any,
    mode: 'depth' | 'level' = 'depth',
    currentValue: number = mode === 'depth' ? 0 : 1,
): number => {
    if (typeof obj !== 'object' || obj === null) {
        return mode === 'depth' ? currentValue : currentValue - 1;
    }

    // 空对象或空数组处理
    if (Object.keys(obj).length === 0) {
        return currentValue;
    }

    // 深度超过限制直接返回（仅适用于depth模式）
    if (mode === 'depth' && currentValue > 99) {
        return 100;
    }

    // 递归计算最大深度/层级
    let maxValue = currentValue;

    if (Array.isArray(obj)) {
        for (const item of obj) {
            const childValue = calculateJsonStructure(item, mode, currentValue + 1);
            maxValue = Math.max(maxValue, childValue);
            if (mode === 'depth' && maxValue > 99) return 100;
        }
    } else {
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                const childValue = calculateJsonStructure(obj[key], mode, currentValue + 1);
                maxValue = Math.max(maxValue, childValue);
                if (mode === 'depth' && maxValue > 99) return 100;
            }
        }
    }

    return maxValue;
};

// 获取对象深度
export const getObjectDepth = (obj: any, depth: number = 0): number => {
    return calculateJsonStructure(obj, 'depth', depth);
};

// 计算 JSON 的最大层级
export const calculateMaxLevel = (obj: any, currentLevel: number = 1): number => {
    return calculateJsonStructure(obj, 'level', currentLevel);
};

// 检查 JSON 字符串中是否存在非法转义序列
export const detectIllegalEscapes = (str: string): { hasIllegal: boolean; details: string[] } => {
    const details: string[] = [];

    // 使用正则表达式查找所有转义序列
    const escapeRegex = /\\./g;
    let match;

    while ((match = escapeRegex.exec(str)) !== null) {
        const escapeSeq = match[0];
        const char = escapeSeq[1];

        // 检查非法 Unicode 转义
        if (char === 'u') {
            const remaining = str.substr(match.index + 2, 4);
            if (remaining.length < 4 || !/^[0-9a-fA-F]{4}$/.test(remaining)) {
                details.push(`非法Unicode转义: ${escapeSeq}${remaining.substring(0, 4)}`);
            }
        }
        // 检查非法十六进制转义
        else if (char === 'x') {
            const remaining = str.substr(match.index + 2, 2);
            if (remaining.length < 2 || !/^[0-9a-fA-F]{2}$/.test(remaining)) {
                details.push(`非法十六进制转义: ${escapeSeq}${remaining.substring(0, 2)}`);
            }
        }
        // 检查其他非法转义序列
        else if (!['"', '\\', '/', 'b', 'f', 'n', 'r', 't'].includes(char)) {
            details.push(`非法转义序列: ${escapeSeq}`);
        }
    }

    return { hasIllegal: details.length > 0, details };
};
