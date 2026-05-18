// 字节大小、文件大小格式化、内容哈希工具
export const calculateByteSize = (content: string): number => {
    try {
        const encoder = new TextEncoder();
        return encoder.encode(content).length;
    } catch {
        // 兼容性降级：使用字符串长度近似
        return content.length;
    }
};

export const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) {
        const kb = bytes / 1024;
        // 如果是整数，不显示小数；否则保留两位小数
        return kb % 1 === 0 ? `${kb} KB` : `${kb.toFixed(2)} KB`;
    }
    const mb = bytes / (1024 * 1024);
    // 如果是整数，不显示小数；否则保留两位小数
    return mb % 1 === 0 ? `${mb} MB` : `${mb.toFixed(2)} MB`;
};

export const calculateHash = async (content: string): Promise<string> => {
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
};
