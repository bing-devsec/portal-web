// JSON 路径解析与读写工具
// 支持点号路径（a.b.c）以及数组语法（a[0]、a[*]）

export interface PathPart {
    key: string;
    isArray?: boolean;
    arrayIndex?: number | string;
}

// 解析路径字符串，支持数组语法（如 settings[*] 或 settings[0]）
export const parsePathToParts = (path: string): PathPart[] => {
    const parts: PathPart[] = [];
    let current = '';
    let inBrackets = false;
    let bracketContent = '';

    for (let i = 0; i < path.length; i++) {
        const char = path[i];

        if (char === '[') {
            if (current) {
                parts.push({ key: current });
                current = '';
            }
            inBrackets = true;
            bracketContent = '';
        } else if (char === ']') {
            if (inBrackets) {
                if (bracketContent === '*' || /^\d+$/.test(bracketContent)) {
                    // 数组通配符或索引
                    if (parts.length > 0) {
                        parts[parts.length - 1].isArray = true;
                        parts[parts.length - 1].arrayIndex = bracketContent === '*' ? '*' : parseInt(bracketContent, 10);
                    } else if (current) {
                        // 如果还没有添加到parts，先添加key，然后标记为数组
                        parts.push({
                            key: current,
                            isArray: true,
                            arrayIndex: bracketContent === '*' ? '*' : parseInt(bracketContent, 10),
                        });
                        current = '';
                    } else {
                        // 根级别的数组访问，如 [1] 或 [*]
                        parts.push({
                            key: '',
                            isArray: true,
                            arrayIndex: bracketContent === '*' ? '*' : parseInt(bracketContent, 10),
                        });
                    }
                }
                inBrackets = false;
                bracketContent = '';
            }
        } else if (inBrackets) {
            bracketContent += char;
        } else if (char === '.') {
            if (current) {
                parts.push({ key: current });
                current = '';
            }
        } else {
            current += char;
        }
    }

    if (current) {
        parts.push({ key: current });
    }

    return parts;
};

// 根据路径获取JSON对象中的值
export const getValueByPathParts = (obj: any, parts: PathPart[]): any => {
    let current = obj;

    for (const part of parts) {
        if (current === null || current === undefined) {
            return null;
        }

        // 处理根级别的数组访问（key为空，isArray为true）
        if (part.isArray && !part.key && Array.isArray(current)) {
            if (part.arrayIndex === '*') {
                // 通配符，返回第一个元素用于获取下一级key
                current = current.length > 0 ? current[0] : null;
            } else if (typeof part.arrayIndex === 'number') {
                // 具体索引
                current = current[part.arrayIndex] || null;
            } else {
                // 默认返回第一个元素
                current = current.length > 0 ? current[0] : null;
            }
            continue;
        }

        if (part.key) {
            if (typeof current === 'object' && part.key in current) {
                current = current[part.key];
            } else {
                return null;
            }
        }

        if (part.isArray && Array.isArray(current)) {
            // 如果是数组，根据arrayIndex返回对应元素
            if (part.arrayIndex === '*') {
                // 通配符，返回第一个元素用于获取下一级key
                current = current.length > 0 ? current[0] : null;
            } else if (typeof part.arrayIndex === 'number') {
                // 具体索引
                current = current[part.arrayIndex] || null;
            } else {
                // 默认返回第一个元素
                current = current.length > 0 ? current[0] : null;
            }
        }
    }

    return current;
};

// 获取对象中指定路径的值（支持数组索引语法）
export const getValueByPath = (obj: any, path: string): any => {
    if (!path || !obj) return obj;

    const parts = parsePathToParts(path);
    return getValueByPathParts(obj, parts);
};

// 设置对象中指定路径的值（支持数组索引语法）
export const setValueByPath = (obj: any, path: string, value: any): boolean => {
    if (!path || !obj) return false;

    const parts = parsePathToParts(path);

    if (parts.length === 0) return false;

    let current = obj;

    // 遍历到倒数第二个路径部分
    for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];

        if (current === null || current === undefined) {
            return false;
        }

        // 处理根级别的数组访问（key为空，isArray为true）
        if (part.isArray && !part.key && Array.isArray(current)) {
            if (part.arrayIndex === '*') {
                // [*] 不应该出现在中间路径，只能用于叶子节点
                return false;
            } else if (typeof part.arrayIndex === 'number') {
                // 具体索引
                if (part.arrayIndex < 0 || part.arrayIndex >= current.length) {
                    return false;
                }
                current = current[part.arrayIndex];
            } else {
                // 默认访问第一个元素
                current = current.length > 0 ? current[0] : null;
            }
            continue;
        }

        if (part.key) {
            if (typeof current === 'object' && part.key in current) {
                current = current[part.key];
            } else {
                return false;
            }
        }

        if (part.isArray && Array.isArray(current)) {
            // 如果是数组，根据arrayIndex返回对应元素
            if (part.arrayIndex === '*') {
                // [*] 不应该出现在中间路径，只能用于叶子节点
                return false;
            } else if (typeof part.arrayIndex === 'number') {
                // 具体索引
                if (part.arrayIndex < 0 || part.arrayIndex >= current.length) {
                    return false;
                }
                current = current[part.arrayIndex];
            } else {
                // 默认访问第一个元素
                current = current.length > 0 ? current[0] : null;
            }
        }
    }

    // 设置最后一个路径部分的值
    const lastPart = parts[parts.length - 1];
    if (current === null || current === undefined || typeof current !== 'object') {
        return false;
    }

    // 处理根级别的数组访问（key为空，isArray为true）
    if (lastPart.isArray && !lastPart.key && Array.isArray(current)) {
        if (lastPart.arrayIndex === '*') {
            // [*] 设置整个数组（不推荐使用）
            return false;
        } else if (typeof lastPart.arrayIndex === 'number') {
            // 具体索引
            if (lastPart.arrayIndex < 0) {
                return false;
            }
            current[lastPart.arrayIndex] = value;
            return true;
        } else {
            // 默认设置第一个元素
            if (current.length > 0) {
                current[0] = value;
                return true;
            }
            return false;
        }
    }

    if (lastPart.key) {
        current[lastPart.key] = value;
        return true;
    }

    if (lastPart.isArray && Array.isArray(current)) {
        // 如果是数组，根据arrayIndex设置对应元素
        if (lastPart.arrayIndex === '*') {
            // [*] 设置整个数组（不推荐使用）
            return false;
        } else if (typeof lastPart.arrayIndex === 'number') {
            // 具体索引
            if (lastPart.arrayIndex < 0) {
                return false;
            }
            current[lastPart.arrayIndex] = value;
            return true;
        } else {
            // 默认设置第一个元素
            if (current.length > 0) {
                current[0] = value;
                return true;
            }
            return false;
        }
    }

    return false;
};
