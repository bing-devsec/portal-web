// 通用工具：语言识别、文本宽度测量、防抖、延时、存档名清理

export type EditorContentLanguage = 'json' | 'yaml' | 'toml' | 'xml' | 'html' | 'css' | 'plaintext';

// 异步延时
export const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// 防抖函数：在 delay 毫秒内多次触发只执行最后一次
export const debounce = <T extends (...args: any[]) => any>(fn: T, delay: number) => {
    let timer: number | null = null;
    return function (this: any, ...args: Parameters<T>) {
        if (timer) {
            clearTimeout(timer);
        }
        timer = window.setTimeout(() => {
            fn.apply(this, args);
            timer = null;
        }, delay);
    };
};

// 根据输入内容识别语言类型
export const detectInputLanguage = (value: string): EditorContentLanguage => {
    const trimmed = value.trim();
    if (!trimmed) return 'json';

    const sample = trimmed.slice(0, 20000);
    const sampleLines = sample.split('\n').slice(0, 80);
    const joinedSample = sampleLines.join('\n');

    if (sample.startsWith('<?xml') || (/^<[^!][^>]*>/.test(sample) && /<\/[\w:-]+>/.test(sample) && !/<html[\s>]/i.test(sample))) {
        return 'xml';
    }

    if (/<!doctype\s+html/i.test(sample) || /<(html|head|body|div|span|script|style|main|section|article|template)[\s>]/i.test(sample)) {
        return 'html';
    }

    if ((/@[a-z-]+\b/i.test(sample) || /[.#]?[a-zA-Z][^{\n]*\{/.test(sample)) && /[a-z-]+\s*:\s*[^;\n{}]+;/.test(sample)) {
        return 'css';
    }

    // JSON 顶层不只是对象/数组，也可以是字符串、数字、布尔值或 null。
    // 例如输入 `"aa"` 时，依然应该走 JSON 语法高亮而不是 plaintext。
    const looksLikeJson = /^[\[{"]/.test(trimmed) || /^(true|false|null|-?\d)/.test(trimmed);
    if (looksLikeJson) {
        return 'json';
    }

    if (sampleLines.some(line => /^\s*(\[\[?[^\]\n]+\]?\]|[A-Za-z0-9_.-]+\s*=\s*.+)$/.test(line.trim()))) {
        return 'toml';
    }

    if (sampleLines.some(line => /^\s*-\s+/.test(line)) || sampleLines.some(line => /^\s*['"]?[A-Za-z0-9_.-]+['"]?\s*:\s*/.test(line))) {
        return 'yaml';
    }

    if (joinedSample.includes('<') && joinedSample.includes('>')) {
        return 'xml';
    }

    return 'plaintext';
};

// 清理存档名称：保留英文/数字/中文及部分常见符号，最长 30 字符
export const normalizeArchiveName = (rawName: string): string => {
    // 允许：英文、数字、中文，以及部分常见符号 - _ + * / = . : @ #
    const allowedCharPattern = /[A-Za-z0-9\u4e00-\u9fa5\-\_\+\*\/=\.\:\@\#]/g;
    const matches = rawName.match(allowedCharPattern);
    if (!matches) return '';
    const normalized = matches.join('');
    return normalized.slice(0, 30);
};

// 测量文本在指定字体下的渲染宽度（带 SSR 降级估算）
export const measureTextWidth = (text: string): number => {
    if (typeof document === 'undefined') {
        // SSR 环境，使用估算
        let width = 0;
        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            if (/[\u4e00-\u9fa5\u3000-\u303f\uff00-\uffef]/.test(char)) {
                width += 12 * 1.2;
            } else {
                width += 12 * 0.6;
            }
        }
        return width;
    }

    // 创建临时元素测量
    const measureEl = document.createElement('span');
    measureEl.style.cssText = `
        position: absolute;
        visibility: hidden;
        white-space: nowrap;
        font-size: 12px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    `;
    measureEl.textContent = text;
    document.body.appendChild(measureEl);
    const width = measureEl.offsetWidth;
    document.body.removeChild(measureEl);
    return width;
};
