// ========================================
// 智能解码函数：自动识别并解码各种编码格式
// ========================================

// Unicode 解码（\uXXXX 格式）- 仅替换命中的转义片段，保留上下文
export const decodeUnicode = (str: string): string | null => {
    try {
        let result = '';
        let i = 0;
        let hasMatch = false;

        while (i < str.length) {
            if (str[i] === '\\' && i + 5 < str.length && str[i + 1] === 'u' && /^[0-9a-fA-F]{4}$/.test(str.substring(i + 2, i + 6))) {
                // 检查前面是否有反斜杠（避免匹配 \\u）
                const prevBackslash = (result.match(/\\+$/) || [''])[0].length;
                if (prevBackslash % 2 === 0) {
                    // 单反斜杠，可以解码
                    const hex = str.substring(i + 2, i + 6);
                    result += String.fromCharCode(parseInt(hex, 16));
                    i += 6;
                    hasMatch = true;
                    continue;
                }
            }
            result += str[i];
            i++;
        }

        return hasMatch ? result : null;
    } catch {
        return null;
    }
};

export const decodeUTF8Bytes = (bytes: number[]): string => {
    let result = '';
    let i = 0;
    while (i < bytes.length) {
        const byte = bytes[i];
        if (byte < 128) {
            result += String.fromCharCode(byte);
            i++;
        } else if (byte >= 192 && byte < 224 && i + 1 < bytes.length) {
            const code = ((byte & 31) << 6) | (bytes[i + 1] & 63);
            result += String.fromCharCode(code);
            i += 2;
        } else if (byte >= 224 && byte < 240 && i + 2 < bytes.length) {
            const code = ((byte & 15) << 12) | ((bytes[i + 1] & 63) << 6) | (bytes[i + 2] & 63);
            result += String.fromCharCode(code);
            i += 3;
        } else if (byte >= 240 && byte < 248 && i + 3 < bytes.length) {
            const code = ((byte & 7) << 18) | ((bytes[i + 1] & 63) << 12) | ((bytes[i + 2] & 63) << 6) | (bytes[i + 3] & 63);
            if (code >= 0x10000) {
                const high = Math.floor((code - 0x10000) / 0x400) + 0xd800;
                const low = ((code - 0x10000) % 0x400) + 0xdc00;
                result += String.fromCharCode(high, low);
            } else {
                result += String.fromCharCode(code);
            }
            i += 4;
        } else {
            result += String.fromCharCode(byte);
            i++;
        }
    }
    return result;
};

export const isReadableHexDecoded = (decoded: string): boolean => {
    if (/[\u4e00-\u9fa5]/.test(decoded)) return true;
    return /^[\x20-\x7E]*$/.test(decoded);
};

// Hex 解码（\xHH 格式）- 仅替换连续命中的片段，保留上下文
export const decodeHex = (str: string): string | null => {
    try {
        let result = '';
        let i = 0;
        let hasMatch = false;

        while (i < str.length) {
            if (
                str[i] === '\\' &&
                i + 3 < str.length &&
                str[i + 1] === 'x' &&
                /^[0-9a-fA-F]{2}$/.test(str.substring(i + 2, i + 4))
            ) {
                const prevBackslash = (result.match(/\\+$/) || [''])[0].length;
                if (prevBackslash % 2 === 0) {
                    const bytes: number[] = [];
                    let j = i;
                    while (
                        j + 3 < str.length &&
                        str[j] === '\\' &&
                        str[j + 1] === 'x' &&
                        /^[0-9a-fA-F]{2}$/.test(str.substring(j + 2, j + 4))
                    ) {
                        bytes.push(parseInt(str.substring(j + 2, j + 4), 16));
                        j += 4;
                    }
                    const decoded = decodeUTF8Bytes(bytes);
                    if (isReadableHexDecoded(decoded)) {
                        result += decoded;
                        hasMatch = true;
                        i = j;
                        continue;
                    }
                }
            }

            result += str[i];
            i++;
        }

        return hasMatch ? result : null;
    } catch {
        return null;
    }
};

// 检查字符串是否可能是某种编码格式
export const isLikelyEncoded = (str: string): boolean => {
    if (str.length === 0) return false;
    // Unicode 检测：包含 \uXXXX
    if (/\\u[0-9a-fA-F]{4}/.test(str)) {
        return true;
    }
    // Hex 检测：包含 \xHH
    if (/\\x[0-9a-fA-F]{2}/i.test(str)) {
        return true;
    }
    return false;
};

// 智能解码：仅做一层、局部替换式解码，避免整串被某一种编码误吞
export const smartDecode = (str: string): string => {
    if (!isLikelyEncoded(str)) {
        return str;
    }

    let result = str;
    const unicodeDecoded = decodeUnicode(result);
    if (unicodeDecoded && unicodeDecoded !== result) {
        result = unicodeDecoded;
    }

    const hexDecoded = decodeHex(result);
    if (hexDecoded && hexDecoded !== result) {
        result = hexDecoded;
    }

    return result;
};
