import MarkdownIt from 'markdown-it';
import katex from 'katex';
import type { Highlighter, ThemedToken } from 'shiki';
import { createHighlighter, bundledLanguages } from 'shiki';

// 单例 MarkdownIt 实例，既可在服务端也可在客户端运行
// 优化：禁用一些耗时的插件，提升渲染速度
const md = new MarkdownIt({
    html: true,
    linkify: true,
    breaks: true,
    typographer: true
});

// ============================================================
// 提示块（Admonition）：支持 !!! tips / info / warning / error / success / thinking / example
// ------------------------------------------------------------
// 语法约定（与常见笔记软件 / 文档站风格对齐）：
//
//   !!! warning 注意
//   这里是提示块正文
//   !!!
//
// 要点：
//   1) 首行必须是 !!! + 类型 + 可选标题
//   2) 结束行必须是单独一个 !!!
//   3) 中间正文不强制缩进，按原样交给 markdown-it 继续解析
//   4) 自定义标题可省略，省略时使用类型默认标题
//   5) 提示块内部继续走当前 markdown-it 管线，因此可嵌套段落、列表、代码块、公式等
// ============================================================
const ADMONITION_TYPES = new Set(['tips', 'info', 'warning', 'error', 'success', 'thinking', 'example']);
const ADMONITION_DEFAULT_TITLES: Record<string, string> = {
    tips: '小技巧',
    info: '说明',
    warning: '注意',
    error: '错误',
    success: '完成',
    thinking: '思考',
    example: '示例',
};
const ADMONITION_EMOJIS: Record<string, string> = {
    tips: '💡',
    info: '📘',
    warning: '⚠️',
    error: '❌',
    success: '🍺',
    thinking: '🤔',
    example: '🌰',
};
const ADMONITION_KIND_ALIASES: Record<string, string> = {
    tips: 'tips',
    tip: 'tips',
    小技巧: 'tips',
    技巧: 'tips',
    提示: 'tips',

    info: 'info',
    note: 'info',
    说明: 'info',
    信息: 'info',

    warning: 'warning',
    warn: 'warning',
    注意: 'warning',
    警告: 'warning',

    error: 'error',
    错误: 'error',
    失败: 'error',

    success: 'success',
    成功: 'success',
    完成: 'success',

    thinking: 'thinking',
    think: 'thinking',
    思考: 'thinking',
    想法: 'thinking',
    问题: 'thinking',

    example: 'example',
    示例: 'example',
    例子: 'example',
    栗子: 'example',
};

interface AdmonitionMeta {
    kind: string;
    title: string;
    content: string;
}

function normalizeAdmonitionTitle(raw: string | undefined, kind: string): string {
    const trimmed = (raw || '').trim();
    if (!trimmed) return ADMONITION_DEFAULT_TITLES[kind];
    const quoted = trimmed.match(/^(['"])([\s\S]*)\1$/);
    return quoted ? quoted[2].trim() : trimmed;
}

function normalizeAdmonitionKind(raw: string | undefined): string | null {
    if (!raw) return null;
    return ADMONITION_KIND_ALIASES[raw.trim().toLowerCase()] || ADMONITION_KIND_ALIASES[raw.trim()] || null;
}

md.block.ruler.before('blockquote', 'admonition', function (state, startLine, endLine, silent) {
    const start = state.bMarks[startLine] + state.tShift[startLine];
    const max = state.eMarks[startLine];
    if (start + 3 > max) return false;

    const line = state.src.slice(start, max).trim();
    const match = line.match(/^!!!\s+([^\s]+)(?:\s+(.*))?$/);
    if (!match) return false;

    const kind = normalizeAdmonitionKind(match[1]);
    if (!kind || !ADMONITION_TYPES.has(kind)) return false;
    if (silent) return true;

    let nextLine = startLine + 1;
    let foundClose = false;

    while (nextLine < endLine) {
        const lineStart = state.bMarks[nextLine] + state.tShift[nextLine];
        const lineEnd = state.eMarks[nextLine];
        const currentLine = state.src.slice(lineStart, lineEnd).trim();
        if (currentLine === '!!!') {
            foundClose = true;
            break;
        }
        nextLine += 1;
    }

    if (!foundClose) return false;

    const content =
        nextLine > startLine + 1
            ? state.getLines(startLine + 1, nextLine, 0, false)
            : '';

    const token = state.push('admonition', 'div', 0);
    token.block = true;
    token.map = [startLine, nextLine + 1];
    token.meta = {
        kind,
        title: normalizeAdmonitionTitle(match[2], kind),
        content,
    } satisfies AdmonitionMeta;

    state.line = nextLine + 1;
    return true;
});

md.renderer.rules.admonition = function (tokens, idx, _options, env) {
    const meta = tokens[idx].meta as AdmonitionMeta | undefined;
    if (!meta) return '';

    const bodyHtml = meta.content.trim() ? md.render(meta.content, env) : '';
    const safeTitle = md.utils.escapeHtml(meta.title);
    const emoji = md.utils.escapeHtml(ADMONITION_EMOJIS[meta.kind] || '📝');

    return (
        `<div class="md-admonition md-admonition--${meta.kind}">` +
        `<div class="md-admonition__title">` +
        `<span class="md-admonition__emoji" aria-hidden="true">${emoji}</span>` +
        `<span class="md-admonition__title-text">${safeTitle}</span>` +
        `</div>` +
        `<div class="md-admonition__body">${bodyHtml}</div>` +
        `</div>\n`
    );
};

// ============================================================
// 数学公式（KaTeX）：行内 $...$ 与块级 $$...$$ 自定义规则
// ------------------------------------------------------------
// 为什么不用 markdown-it-texmath / @vscode/markdown-it-katex：
//   - 多一层依赖；版本需要与 KaTeX 对齐
//   - 我们的需求很简单（标准 LaTeX 子集），50 行手写规则可控性更高
// 规则要点：
//   - 块级 $$...$$ 优先匹配（必须在独立行/段落，避免与行内 $ 冲突）
//   - 行内 $...$ 要求两侧不是空格，且不与 $ 数字（货币）混淆
//   - KaTeX 用 throwOnError: false，公式错误时降级为带错误信息的红色文本
//   - SSR 阶段就把 LaTeX 编译成 HTML（KaTeX 是同构库，能跑在 Node）
//     爬虫拿到的是已渲染的 mathml + html，SEO 友好；客户端只需 katex.css 让它显示正确
// ============================================================
function renderKatex(src: string, displayMode: boolean): string {
    try {
        return katex.renderToString(src, {
            displayMode,
            throwOnError: false,
            output: 'html',
            strict: 'ignore' as const,
        });
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return `<span class="katex-error" title="${md.utils.escapeHtml(msg)}">${md.utils.escapeHtml(src)}</span>`;
    }
}

/**
 * 块级公式 $$...$$ —— 必须独占一行/段落
 * 不直接处理"$$ 后跟内容同一行"的情况（要求标准 markdown 写法：$$ 单独成段）
 */
md.block.ruler.before('fence', 'math_block', function (state, startLine, endLine, silent) {
    const start = state.bMarks[startLine] + state.tShift[startLine];
    const max = state.eMarks[startLine];
    if (start + 2 > max) return false;
    if (state.src.slice(start, start + 2) !== '$$') return false;

    let nextLine = startLine;
    let firstLine = state.src.slice(start + 2, max).trim();
    let found = false;

    if (firstLine.endsWith('$$') && firstLine.length >= 2) {
        // 单行 $$ a^2 $$
        firstLine = firstLine.slice(0, -2);
        found = true;
    }

    while (!found) {
        nextLine++;
        if (nextLine >= endLine) break;
        const lineStart = state.bMarks[nextLine] + state.tShift[nextLine];
        const lineEnd = state.eMarks[nextLine];
        const line = state.src.slice(lineStart, lineEnd);
        const idx = line.lastIndexOf('$$');
        if (idx !== -1) {
            found = true;
            break;
        }
    }

    if (!found) return false;
    if (silent) return true;

    let content: string;
    if (nextLine === startLine) {
        content = firstLine;
    } else {
        const lastLineStart = state.bMarks[nextLine] + state.tShift[nextLine];
        const lastLineEnd = state.eMarks[nextLine];
        const lastLine = state.src.slice(lastLineStart, lastLineEnd);
        const closingIdx = lastLine.lastIndexOf('$$');
        const middle = state.src.slice(state.eMarks[startLine], lastLineStart);
        content = (firstLine + '\n' + middle + lastLine.slice(0, closingIdx)).trim();
    }

    const token = state.push('math_block', 'div', 0);
    token.block = true;
    token.markup = '$$';
    token.content = content;
    state.line = nextLine + 1;
    return true;
});
md.renderer.rules.math_block = function (tokens, idx) {
    return `<div class="math-block">${renderKatex(tokens[idx].content, true)}</div>\n`;
};

/**
 * 行内公式 $...$
 * 限制：开始 $ 后必须紧跟非空格非 $；结束 $ 前必须是非空格；前后不能是数字（避免 $5 单价被误解析）
 */
md.inline.ruler.after('escape', 'math_inline', function (state, silent) {
    const start = state.pos;
    if (state.src.charCodeAt(start) !== 0x24 /* $ */) return false;

    // 不允许 $$ 在行内（块级规则会处理）
    if (state.src.charCodeAt(start + 1) === 0x24) return false;

    // 前一个字符是数字 → 不当公式（货币 $5）
    const prevChar = start > 0 ? state.src.charCodeAt(start - 1) : -1;
    if (prevChar >= 0x30 && prevChar <= 0x39) return false;

    // 找下一个 $（同一行内）
    let pos = start + 1;
    const max = state.posMax;
    let found = -1;
    while (pos < max) {
        const code = state.src.charCodeAt(pos);
        if (code === 0x5c /* \ */) {
            pos += 2;
            continue;
        }
        if (code === 0x0a /* \n */) break;
        if (code === 0x24 /* $ */) {
            found = pos;
            break;
        }
        pos++;
    }
    if (found === -1) return false;

    const content = state.src.slice(start + 1, found);
    if (content.length === 0) return false;
    // 内容首尾不能是空格
    if (content.charCodeAt(0) === 0x20 || content.charCodeAt(content.length - 1) === 0x20) {
        return false;
    }
    // 后一个字符是数字 → 不当公式
    const nextChar = found + 1 < state.src.length ? state.src.charCodeAt(found + 1) : -1;
    if (nextChar >= 0x30 && nextChar <= 0x39) return false;

    if (!silent) {
        const token = state.push('math_inline', 'span', 0);
        token.markup = '$';
        token.content = content;
    }
    state.pos = found + 1;
    return true;
});
md.renderer.rules.math_inline = function (tokens, idx) {
    return renderKatex(tokens[idx].content, false);
};

// ============================================================
// 代码块渲染：自定义 fence 规则，输出"语言标签 + 复制按钮 + 行号"完整结构
// ------------------------------------------------------------
// 为什么不用 md.set({ highlight }) 的默认路径？
// 默认 highlight 选项只能让我们返回"高亮后的 HTML"，但我们需要的不止于此：
//   1) 代码块顶部多一个 <header>，左边显示语言名，右边放复制按钮
//   2) 高亮文本按 \n 切成"逐行 <span>"，配合 CSS counter 显示行号
//   3) 复制按钮通过事件委托读取 <pre><code> 的 textContent，不需要重复编码代码字符串
// 所以这里直接重写 md.renderer.rules.fence。
// ============================================================
// Shiki 高亮：以"占位符 → 异步高亮 → 字符串替换"两阶段处理同步/异步阻抗
// ------------------------------------------------------------
// 背景：markdown-it 的 fence renderer 是同步的，但 Shiki 的高亮 API
// （包括 createHighlighter / codeToTokens）需要异步加载语法/主题资源。
// 折中方案：
//   阶段一（同步）：fence renderer 把每段代码序列化进一个隐藏的 <script type="application/json">
//                  占位符，包含 lang/code 与一个唯一 token；
//   阶段二（异步）：renderMarkdownToHtml 拿到 markdown-it 的输出后，扫描占位符，
//                  调用 Shiki 完成高亮，再用最终 HTML 替换占位符。
// 这样既不用把 markdown-it 全管线改成异步，也无需在每次渲染时实例化 Shiki。
// ============================================================
// VSCode 同款主题：github-dark（用户已选定）
// ------------------------------------------------------------
// ⚠ 注意 Shiki 里 `github-dark` 与 `github-dark-default` 是两个不同主题：
//   - github-dark：GitHub 早期经典 dark 主题（更克制、注释更暗）
//   - github-dark-default：GitHub 2022 重设计版（色彩更鲜艳）
// 这里选的是经典版。
const SHIKI_THEME = 'github-dark';
let highlighterPromise: Promise<Highlighter> | null = null;
const loadedLanguages = new Set<string>();

function getHighlighter(): Promise<Highlighter> {
    if (!highlighterPromise) {
        // 初始化时仅加载主题；语言按需加载，控制冷启动开销
        highlighterPromise = createHighlighter({
            themes: [SHIKI_THEME],
            langs: [],
        });
    }
    return highlighterPromise;
}

async function ensureLanguageLoaded(highlighter: Highlighter, lang: string): Promise<boolean> {
    if (!lang) return false;
    if (loadedLanguages.has(lang)) return true;
    // bundledLanguages 是 Shiki 提供的"已知语言列表"，对未识别语言直接降级为纯文本
    if (!(lang in bundledLanguages)) return false;
    try {
        await highlighter.loadLanguage(lang as keyof typeof bundledLanguages);
        loadedLanguages.add(lang);
        return true;
    } catch {
        return false;
    }
}

// 占位符格式：用注释 + 唯一 token 让 markdown-it 输出里能稳定定位
// （HTML 注释不会被 markdown-it 的 sanitize 干扰，因为我们开启了 html: true）
const SHIKI_PLACEHOLDER_PREFIX = '<!--shiki-placeholder:';
const SHIKI_PLACEHOLDER_SUFFIX = '-->';

interface PendingHighlight {
    lang: string;
    rawCode: string;
}

/**
 * 单次 renderMarkdownToHtml 调用的渲染上下文，承载：
 *   - pendingHighlights：fence renderer 同步收集占位符 → 高亮阶段异步消费
 *   - pendingCounter：本次渲染内的占位符自增计数（与 placeholderSalt 拼出唯一 token）
 *   - placeholderSalt：本次渲染独立的随机 salt，杜绝跨渲染串号
 *   - headingIndex：heading_open renderer 内的标题序号（用于 id 生成）
 *
 * ⚠ 严禁把这些字段提升到模块级！Node SSR 是单线程事件循环，
 *   md.render() 是同步、resolveShikiPlaceholders() 异步；并发请求各自的
 *   "同步收集 → 异步消费"区间会交错调度，模块级共享会导致 A 请求消费到
 *   B 请求遗留的占位符内容（直接表现为：文章 A 的代码块里渲染出 B 的代码）。
 *
 * markdown-it 的 fence/heading_open 等 rule 第 4 个参数就是 env，会被透传，
 * 这里把它定型成 RenderEnv 后做集中管理。
 */
interface RenderEnv {
    pendingHighlights: Map<string, PendingHighlight>;
    pendingCounter: number;
    placeholderSalt: string;
    headingIndex: number;
}

function createRenderEnv(): RenderEnv {
    return {
        pendingHighlights: new Map<string, PendingHighlight>(),
        pendingCounter: 0,
        // 每次渲染独立 salt：双保险防止占位符在 markdown 正文中误匹配，
        // 也让单元测试 / 并发场景下不同渲染产生的占位符天然互斥。
        placeholderSalt:
            Math.random().toString(36).slice(2, 8) + Date.now().toString(36),
        headingIndex: 0,
    };
}

function nextPlaceholderToken(env: RenderEnv): string {
    env.pendingCounter += 1;
    // 计数器单调递增 + 本次渲染独立 salt，保证 token 在本次渲染内唯一且不依赖时钟分辨率
    return `${env.pendingCounter.toString(36)}-${env.placeholderSalt}`;
}

/**
 * 把 Shiki 返回的 ThemedToken 二维数组转换成
 *   <span class="ssr-code-line">
 *     <span style="color:#xxx">token1</span><span style="color:#xxx">token2</span>
 *   </span>
 * 形式的字符串，与原 hljs 渲染产物的"逐行 span 包裹"保持结构兼容。
 *
 * 这样 base.css 里基于 .ssr-code-line 的所有规则（行号对齐、空行兜底、
 * 全屏复用 innerHTML 等）完全无需改动。
 *
 * ⚠ 关键健壮性兜底（修复 Chrome/Edge/移动端 SPA 路由切换"代码块变空行"的 bug）：
 *   Shiki 在 Chromium 系浏览器客户端首次调用时，oniguruma-to-es 的初始化与
 *   codeToTokens 之间存在一个微任务竞态——某些版本下 codeToTokens 会同步返回
 *   "tokens 数组结构正常但每行 visibleLength=0"的"伪空"结果，且不抛异常。
 *   原实现把每个空行兜底成 \u200B，最终用户看到 5 行代码变 5 行空白。
 *   这里做"全空检测"：当传入的所有行 visibleLength 全为 0 但 lineCount > 0 时，
 *   返回 null 让上层走 rawCode 文本兜底分支，至少保证内容可见。
 */
function tokenizedLinesToHtml(linesTokens: ThemedToken[][]): string | null {
    if (linesTokens.length === 0) {
        return '<span class="ssr-code-line">\u200B</span>';
    }

    // 全空检测：所有行的 visibleLength 都为 0，说明 Shiki 高亮失败但没抛错
    // —— 让调用方拿 rawCode 直接重新生成可见内容（不上色但不会丢内容）
    let totalVisible = 0;
    for (const line of linesTokens) {
        for (const t of line) totalVisible += t.content.length;
        if (totalVisible > 0) break;
    }
    if (totalVisible === 0) {
        return null;
    }

    const out: string[] = [];
    for (const line of linesTokens) {
        // 空行：Shiki 会输出空数组或单个空文本 token；直接给零宽空格撑行高
        const visibleLength = line.reduce((acc, t) => acc + t.content.length, 0);
        if (visibleLength === 0) {
            out.push('<span class="ssr-code-line">\u200B</span>');
            continue;
        }
        let lineHtml = '';
        for (const token of line) {
            const safe = escapeHtml(token.content);
            // Shiki 有时给某些 token 不带 color（继承默认前景色），此时不需要 inline style
            if (token.color) {
                lineHtml += `<span style="color:${token.color}">${safe}</span>`;
            } else {
                lineHtml += safe;
            }
        }
        out.push(`<span class="ssr-code-line">${lineHtml}</span>`);
    }
    return out.join('');
}

/**
 * 把原始 rawCode 直接转换成与 tokenizedLinesToHtml 结构兼容的逐行 HTML
 * （仅转义、无颜色），用于 Shiki 失败时的最终兜底。
 *
 * 用户体验考量：丢颜色 >> 丢内容。即便没有语法高亮，用户至少能看到代码、
 * 能复制走、能阅读；后续刷新页面（走 SSR）就能拿到带颜色的版本。
 */
function rawCodeToLinesHtml(rawCode: string): string {
    const lines = rawCode.replace(/\n$/, '').split('\n');
    if (lines.length === 0) {
        return '<span class="ssr-code-line">\u200B</span>';
    }
    return lines
        .map((l) =>
            l.length === 0
                ? '<span class="ssr-code-line">\u200B</span>'
                : `<span class="ssr-code-line">${escapeHtml(l)}</span>`,
        )
        .join('');
}

function escapeHtml(input: string): string {
    return input
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * 异步消费收集到的 fence，调用 Shiki 高亮并把占位符替换成最终 HTML。
 * 返回一份新的 HTML 字符串，pendingHighlights / pendingCounter 在每次渲染入口处都会重置。
 *
 * ⚠ 客户端兜底策略（保留高亮颜色 + 修复"空行 bug"）：
 *   1) Shiki 在 Chromium 系（Chrome/Edge/移动端）首次客户端调用时，存在
 *      oniguruma-to-es 异步初始化与 codeToTokens 同步调用之间的竞态——
 *      表现为 codeToTokens 返回结构正常但每行 visibleLength=0 的"伪空"结果。
 *   2) 当 tokenizedLinesToHtml 返回 null（全空检测命中）时，先在客户端做一次
 *      微任务级重试（await Promise.resolve），让 oniguruma 内部初始化完成，
 *      绝大多数情况第二次就能拿到正确高亮结果。
 *   3) 仍然失败时（极端场景 / SSR 不应进入这里）再降级到 rawCodeToLinesHtml，
 *      保证用户至少能看到代码内容（用户体验：丢颜色 >> 丢内容）。
 *   4) Safari 不会触发该 race，原本就走正常分支。
 */
async function resolveShikiPlaceholders(html: string, env: RenderEnv): Promise<string> {
    if (env.pendingHighlights.size === 0) return html;
    const highlighter = await getHighlighter();

    // 在客户端首次进入时，多让出一次微任务，给 Shiki 内部异步资源留时间结算
    // —— 这是修复 Chrome/Edge SPA 路由切换 race 的关键一步，对 SSR 几乎零成本
    if (import.meta.client) {
        await Promise.resolve();
    }

    const tryHighlight = (lang: string, rawCode: string): ThemedToken[][] | null => {
        try {
            const result = highlighter.codeToTokens(rawCode, {
                lang: lang as keyof typeof bundledLanguages,
                theme: SHIKI_THEME,
            });
            return result.tokens;
        } catch {
            return null;
        }
    };

    // 串行 loadLanguage 即可（重复语言走缓存），保持低内存峰值
    const replacements = new Map<string, string>();
    for (const [token, { lang, rawCode }] of env.pendingHighlights) {
        const supported = await ensureLanguageLoaded(highlighter, lang);
        let highlighted: string | null = null;

        if (supported) {
            let linesTokens = tryHighlight(lang, rawCode);
            if (linesTokens) {
                if (linesTokens.length > 0 && linesTokens[linesTokens.length - 1].length === 0) {
                    linesTokens.pop();
                }
                highlighted = tokenizedLinesToHtml(linesTokens);
            }

            // 客户端首次 race：null 说明全空，等一下再来一次（给 oniguruma 收敛时间）
            if (highlighted === null && import.meta.client) {
                await new Promise<void>((resolve) => {
                    if (typeof queueMicrotask === 'function') {
                        queueMicrotask(resolve);
                    } else {
                        Promise.resolve().then(resolve);
                    }
                });
                linesTokens = tryHighlight(lang, rawCode);
                if (linesTokens) {
                    if (linesTokens.length > 0 && linesTokens[linesTokens.length - 1].length === 0) {
                        linesTokens.pop();
                    }
                    highlighted = tokenizedLinesToHtml(linesTokens);
                }
            }
        }

        // 终极兜底：未识别语言 / Shiki 抛错 / 重试后仍全空 → 用 rawCode 直出可见内容
        if (highlighted === null) {
            highlighted = rawCodeToLinesHtml(rawCode);
        }
        replacements.set(token, highlighted);
    }

    // 一次性正则替换：占位符里嵌的 token 都是 [a-z0-9-]，模式简单
    const re = new RegExp(
        `${SHIKI_PLACEHOLDER_PREFIX}([a-z0-9-]+)${SHIKI_PLACEHOLDER_SUFFIX}`,
        'g',
    );
    return html.replace(re, (_, token) => replacements.get(token) ?? '');
}

md.renderer.rules.fence = function (tokens, idx, _options, env: RenderEnv) {
    const token = tokens[idx];
    const info = (token.info || '').trim();
    const lang = (info.split(/\s+/g)[0] || '').toLowerCase();
    const rawCode = token.content || '';

    // ============================================================
    // mermaid 代码块：直接输出"占位 div + 原始源码"，由客户端 mermaid.render 接管
    // ------------------------------------------------------------
    // 之所以不在 SSR 阶段渲染 mermaid：
    //   - mermaid 强依赖 DOM 测量（getBBox / getBoundingClientRect）渲染 svg，
    //     在 Node 端无法运行（除非 jsdom + canvas，复杂且慢）。
    //   - 客户端首屏渲染：爬虫看到的是原文 mermaid 源码（依然是有效的"代码描述图"），
    //     SEO 上等价于一段普通文字；JS 加载后再替换成 svg。
    // SSR 输出结构（包含右上角全屏按钮 + svg 渲染容器）：
    //   <div class="mermaid-block" data-mermaid-rendered="false">
    //     <button class="mermaid-fullscreen-btn">[icon]</button>
    //     <div class="mermaid-content">
    //       <pre class="mermaid-source">原始 mermaid 源码</pre>  // 渲染后会被 svg 替换
    //     </div>
    //   </div>
    // 客户端找到这些节点 → mermaid.render(id, source) → 替换 .mermaid-content innerHTML 为 svg。
    // 之所以"按钮独立、内容单独包一层"：渲染时只写 .mermaid-content，外层按钮永远保留，
    // 无需重新挂事件，事件委托一次到位。
    // ============================================================
    if (lang === 'mermaid') {
        const escaped = md.utils.escapeHtml(rawCode);
        // 全屏按钮 SVG：与代码块全屏按钮风格保持一致（四角向外的箭头图标）
        const fsIcon =
            '<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true">' +
            '<path fill="currentColor" d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>' +
            '</svg>';
        return (
            `<div class="mermaid-block" data-mermaid-rendered="false">` +
            `<button class="mermaid-fullscreen-btn" type="button" aria-label="全屏查看图表" title="全屏">${fsIcon}</button>` +
            `<div class="mermaid-content">` +
            `<pre class="mermaid-source">${escaped}</pre>` +
            `</div>` +
            `</div>\n`
        );
    }

    // 高亮：插入占位符，把真正的 Shiki 调用推到 renderMarkdownToHtml 末尾的异步阶段
    const placeholderToken = nextPlaceholderToken(env);
    env.pendingHighlights.set(placeholderToken, { lang, rawCode });
    const linesPlaceholder = `${SHIKI_PLACEHOLDER_PREFIX}${placeholderToken}${SHIKI_PLACEHOLDER_SUFFIX}`;
    const linesHtml = linesPlaceholder;
    const langLabel = lang || 'text';
    const safeLang = md.utils.escapeHtml(langLabel);

    // 折叠决策：超过阈值的代码块默认折叠，仅展示前若干行 + 渐变蒙层 + 展开按钮。
    // SSR 阶段就把状态写到 data 属性上，保证：
    // 1) 爬虫看到完整 DOM（max-height 只是视觉裁剪，不影响 SEO）
    // 2) 首屏渲染就是折叠态，不会出现"先展开后折叠"的视觉跳跃
    // 阈值与默认显示行数与 base.css 中的 CSS 变量保持一致（base.css 是表现层、这里是结构层）。
    const COLLAPSE_THRESHOLD = 30;
    const lineCount = rawCode.replace(/\n$/, '').split('\n').length;
    const collapsible = lineCount > COLLAPSE_THRESHOLD;

    // ============================================================
    // 行号槽：独立 DOM 列，与右侧 <pre> 平级
    // ------------------------------------------------------------
    // 之所以"独立成列"而不是用 ::before 绝对定位画在每行：
    //   原方案 .ssr-code-line::before 是 <pre> 内部的伪元素，<pre> 整体 overflow-x: auto，
    //   导致水平滚动条贯穿整个代码块底部（含左侧行号槽），视觉上"滚动条起点错位"。
    //   改成两列后，左列固定不滚动、右列单独 overflow-x: auto，
    //   滚动条天然只出现在代码内容下方，符合 VSCode / GitHub 的常见布局。
    // 行号与代码行通过相同的 line-height/font-size 自然对齐，不需要任何 JS。
    // ============================================================
    let gutterHtml = '';
    for (let n = 1; n <= lineCount; n++) {
        gutterHtml += `<span class="ssr-code-num">${n}</span>`;
    }

    const blockAttrs = [
        `class="ssr-code-block"`,
        `data-lang="${safeLang}"`,
    ];
    if (collapsible) {
        blockAttrs.push('data-collapsible="true"');
        blockAttrs.push('data-collapsed="true"');
        blockAttrs.push(`data-line-count="${lineCount}"`);
    }

    // ============================================================
    // 折叠按钮：分头部「收起」 + 浮动「展开全部」两个 DOM
    // ------------------------------------------------------------
    // 设计取舍：
    // - 折叠态：用户需要一个明显的 CTA 知道"下面还有内容"，所以保留浮在蒙层中央的「展开全部 (43 行)」
    // - 展开态：内容已经全部铺开，CTA 不再重要，按钮缩到头部和「复制」并列即可，节省垂直空间
    // - 之所以渲染两个按钮而不是 JS 移动同一个按钮：
    //   纯 CSS 切显隐，更稳；hydration 不会因为 DOM 顺序变化而触发 mismatch；
    //   两个按钮文案各自固定，handler 也不用回写文本
    // 头部按钮 aria-expanded="true"（只在展开态显示）；浮动按钮 aria-expanded="false"（只在折叠态显示）
    //
    // ⚠ 头部折叠按钮改为「单按钮 + 单图标旋转」：
    //    - SSR 只输出一个 chevron-down 图标按钮
    //    - 折叠态显示向下，展开态通过 CSS rotate(180deg) 旋成向上
    //    - 相比两个按钮 display 切换，这样才能做顺滑旋转过渡动画
    // ============================================================
    const headToggleDom = collapsible
        ? `<button class="ssr-code-toggle ssr-code-toggle--head ssr-code-iconbtn" type="button" aria-expanded="false" aria-label="展开代码" title="展开">` +
          `<span class="ssr-code-toggle-icon-wrap" aria-hidden="true">` +
          `<svg class="ssr-code-toggle-icon" viewBox="0 0 24 24" aria-hidden="true">` +
          `<path fill="currentColor" d="M12 15.41l6.3-6.3-1.4-1.42L12 12.59 7.1 7.7l-1.4 1.4z"/>` +
          `</svg>` +
          `</span>` +
          `</button>`
        : '';
    const floatingToggleDom = collapsible
        ? `<div class="ssr-code-mask" aria-hidden="true"></div>` +
          `<button class="ssr-code-toggle ssr-code-toggle--floating" type="button" aria-expanded="false">` +
          `展开全部 (${lineCount} 行)` +
          `</button>`
        : '';

    return (
        `<div ${blockAttrs.join(' ')}>` +
        `<div class="ssr-code-head">` +
        `<span class="ssr-code-lang">${safeLang}</span>` +
        `<div class="ssr-code-actions">` +
        headToggleDom +
        // 全屏按钮：仅移动端可见（base.css 中通过 @media (max-width: 576px) 控制 display）。
        // 所有代码块都渲染（即便 ≤30 行），保证移动端任何长度代码都能横屏放大查看。
        `<button class="ssr-code-fullscreen ssr-code-iconbtn" type="button" aria-label="全屏查看代码" title="全屏">` +
        `<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true">` +
        `<path fill="currentColor" d="M5 5h6v2H7v4H5V5zm14 0v6h-2V7h-4V5h6zM5 19v-6h2v4h4v2H5zm14 0h-6v-2h4v-4h2v6z"/>` +
        `</svg>` +
        `</button>` +
        // 复制按钮：图标化，成功/失败态由 [data-copy-state] 切换显示哪个 SVG。
        // 三个 SVG 同时存在 DOM 里，由 CSS 根据 data-copy-state 控制 display，
        // 比 JS 直接 innerHTML 替换更稳（不会丢失事件、不需要重新渲染）。
        `<button class="ssr-code-copy ssr-code-iconbtn" type="button" aria-label="复制代码" title="复制">` +
        `<svg class="ssr-code-copy-icon ssr-code-copy-icon--default" viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">` +
        `<path fill="currentColor" d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>` +
        `</svg>` +
        `<svg class="ssr-code-copy-icon ssr-code-copy-icon--success" viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">` +
        `<path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>` +
        `</svg>` +
        `<svg class="ssr-code-copy-icon ssr-code-copy-icon--error" viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">` +
        `<path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>` +
        `</svg>` +
        `</button>` +
        `</div>` +
        `</div>` +
        `<div class="ssr-code-body">` +
        `<div class="ssr-code-pane">` +
        `<div class="ssr-code-gutter" aria-hidden="true">${gutterHtml}</div>` +
        `<pre class="ssr-code-pre"><code class="hljs language-${safeLang}">${linesHtml}</code></pre>` +
        `</div>` +
        floatingToggleDom +
        `</div>` +
        `</div>\n`
    );
};

// 优化：为图片添加懒加载和异步解码属性（移动端性能优化）
// 同时打上 .article-img / .article-img-zoomable 标记，
// 方便文章详情页通过事件委托做"点击全屏放大"，避免误伤头像、icon 等非正文图片。
md.renderer.rules.image = function (tokens, idx, options, env, self) {
    const token = tokens[idx];
    const src = token.attrGet('src') || '';
    const title = token.attrGet('title') || '';
    const alt = token.content || '';

    // 添加 loading="lazy" 和 decoding="async" 优化移动端性能
    return `<img class="article-img article-img-zoomable" src="${src}" alt="${alt}"${title ? ` title="${title}"` : ''} loading="lazy" decoding="async" style="width: 100%; height: auto; max-width: 100%; display: block;">`;
};

// ============================================================
// 表格外包一层横向滚动容器（移动端核心可读性修复）
// ------------------------------------------------------------
// 背景：base.css 中 .article-body-ssr table { width: 100% } 让表格被强制贴齐父级宽度，
// 当列数 ≥4 或某列内容较长时，移动端窄屏会把每个 cell 的文本压成"一字一行"甚至溢出，
// 用户也无法横向滚动查看完整内容。
// 解决方案：在表格外包一层 .ssr-table-wrap，由它承担 overflow-x: auto，
// 让表格可以保留"自然宽度"水平滚动；CSS 层会在移动端把 width 100% 改成 max-content，
// 配合 wrap 滚动，列再多也能完整看到。
// 仅作用于 markdown 渲染管线生成的 <table>，不影响其他位置（比如代码块里的 <table> 文本）。
// ============================================================
const defaultTableOpen = md.renderer.rules.table_open || function (tokens, idx, options, _env, self) {
    return self.renderToken(tokens, idx, options);
};
const defaultTableClose = md.renderer.rules.table_close || function (tokens, idx, options, _env, self) {
    return self.renderToken(tokens, idx, options);
};
md.renderer.rules.table_open = function (tokens, idx, options, env, self) {
    // 全屏按钮 SVG：与代码块全屏按钮风格一致（四角向外的箭头图标）。
    // SSR 阶段把按钮 DOM 直接写好，CSS 控制可见性：
    //   - PC 端：始终隐藏（PC 屏宽充足，无需全屏）
    //   - 移动端：仅在 wrap 拥有 [data-overflow="true"] 时显示，
    //     overflow 标记由 [id].vue 的 ResizeObserver 在客户端检测后注入。
    // 这样首屏 SSR HTML 含静态按钮，但视觉上只对真正需要的表格暴露入口，零误导。
    const fsBtn =
        '<button class="ssr-table-fs-btn" type="button" aria-label="全屏查看表格" title="全屏">' +
        '<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true">' +
        '<path fill="currentColor" d="M5 5h6v2H7v4H5V5zm14 0v6h-2V7h-4V5h6zM5 19v-6h2v4h4v2H5zm14 0h-6v-2h4v-4h2v6z"/>' +
        '</svg>' +
        '</button>';
    // 双层 DOM：
    //   外层 .ssr-table-wrap —— 仅承担 position: relative 作为按钮的定位参照系，
    //                          自身不滚动，确保按钮在 wrap 右上角"钉死"，
    //                          不会随表格横向滚动而漂移。
    //   内层 .ssr-table-scroll —— 真正承担 overflow-x: auto，包裹表格本体；
    //                            横向滚动只发生在这一层，与按钮位置解耦。
    return `<div class="ssr-table-wrap">${fsBtn}<div class="ssr-table-scroll">${defaultTableOpen(tokens, idx, options, env, self)}`;
};
md.renderer.rules.table_close = function (tokens, idx, options, env, self) {
    return `${defaultTableClose(tokens, idx, options, env, self)}</div></div>`;
};

// ============================================================
// 与 CatalogRenderer 完全一致的 heading id 生成规则
// 历史背景：早期客户端用 md-editor-v3 接管 DOM 渲染，本函数对齐 md-editor-v3
// 内部的 heading id 算法以保证 SSR 直出与客户端二次渲染锚点一致。
// 当前架构已切换为纯 SSR（参见 pages/article-detail/[id].vue 的 v-html 直出），
// md-editor-v3 已从依赖中移除；规则保留是因为：
//   1) CatalogRenderer 仍依据相同规则把目录链接指向各 heading 的 id
//   2) 同一规则也保证了历史文章里的锚点 url 不会因迁移而失效
// ------------------------------------------------------------
// 同时把"根据出现顺序生成 index"的副作用做成"每次渲染前重置计数"，
// 避免多篇文章共享同一计数器导致 id 漂移。
// ============================================================

const cleanHeadingText = (text: string): string =>
    text
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim();

const defaultHeadingOpen = md.renderer.rules.heading_open || function (tokens, idx, options, env, self) {
    return self.renderToken(tokens, idx, options);
};

md.renderer.rules.heading_open = function (tokens, idx, options, env: RenderEnv, self) {
    const token = tokens[idx];
    const inlineToken = tokens[idx + 1];
    const text = inlineToken && inlineToken.type === 'inline' ? inlineToken.content : '';
    const level = Number(token.tag.slice(1));
    // 标题序号从 env 取，保证多次并发渲染各自独立、id 不串号
    const id = `h${level}-${env.headingIndex}-${cleanHeadingText(text)}`;
    env.headingIndex += 1;
    token.attrSet('id', id);
    return defaultHeadingOpen(tokens, idx, options, env, self);
};

/**
 * 为腾讯云 COS 图片 URL 生成 srcset 候选列表（响应式图片改造的核心工具函数）。
 *
 * 背景与原理：
 *   1) 当前文章正文里的 <img> 是单尺寸交付：一张 1920 宽的原图同时给 PC 和手机。
 *      iPhone 屏宽只有 ~390 CSS px（DPR=3 时 1170 物理像素就够），下载 1920 宽的原图
 *      会浪费 60%~80% 的字节，直接拉高移动端 LCP。
 *   2) srcset 是浏览器原生能力：列出多个候选尺寸，浏览器结合 sizes + DPR 自己挑最合适的下载，
 *      纯静态 HTML 即可生效，无需 JS、无需服务端 UA 嗅探。
 *   3) 腾讯云 COS 数据万象（imageMogr2）支持通过 URL 参数实时缩图 + 转 WebP + 压缩质量，
 *      原图存一份，N 个尺寸由 COS 实时生成并由 CDN 缓存，业务侧零存储成本。
 *
 * 设计决策：
 *   1) 仅对 *.myqcloud.com / *.tencentcos.com 域名（自有 COS 图床）注入 srcset，
 *      避免对掘金/知乎等外链图拼参数导致 404
 *   2) 原 URL 已带 ? 查询参数则放弃注入，避免和作者手写的处理参数冲突（作者优先）
 *   3) 候选尺寸覆盖 400 / 800 / 1200 / 1920，匹配从低端机到 4K 屏的 DPR×CSS 宽度
 *   4) 叠加 format/webp + quality/85：视觉无损，体积比 PNG 原图再省 30%~60%
 *   5) 失败时返回 null，调用方走原 src 兜底，不影响渲染正确性
 */
const COS_HOSTS = /\.(myqcloud|tencentcos)\.com$/i;
const COS_SRCSET_WIDTHS = [400, 800, 1200, 1920];

function buildCosSrcset(rawUrl: string): string | null {
    let parsed: URL;
    try {
        // 用占位 base 兼容协议相对 URL（//xxx.com/...）和绝对 URL
        parsed = new URL(rawUrl, 'https://placeholder.local');
    } catch {
        return null;
    }
    if (!COS_HOSTS.test(parsed.hostname)) return null;
    // 已有处理参数则让位给作者手写
    if (parsed.search) return null;

    return COS_SRCSET_WIDTHS
        .map(w => `${rawUrl}?imageMogr2/thumbnail/${w}x/format/webp/quality/85 ${w}w`)
        .join(', ');
}

/**
 * 对最终 HTML 做一次后处理：给所有 <img> 补上文章图片应有的 class、懒加载与响应式 srcset。
 *
 * 为什么必须做：
 *   md 实例开了 html: true，markdown 正文里直接写的原生 <img>（比如 Typora 导出的
 *   `<img src="..." style="zoom:67%" />`）会作为 raw HTML 整段透传，
 *   不经过 md.renderer.rules.image，导致没有 .article-img-zoomable class，
 *   而 [id].vue 里的 handleImageClick 严格按 class 匹配，于是这类图片点击无法全屏。
 *
 * 实现要点：
 *   1) 仅对 <img ...> 起始标签做正则改写，不动 src/alt/title 等已有属性，避免破坏用户 HTML
 *   2) 已有 article-img-zoomable class 的不重复添加（幂等）
 *   3) 同时补 loading="lazy" / decoding="async"，与 md.renderer.rules.image 的输出对齐
 *   4) 不动 fence 占位符（占位符是 HTML 注释 <!--shiki-placeholder:xxx-->，正则只匹配 <img>）
 *   5) 故意不替换内联 style：保留作者通过 style="zoom:67%" 等手段控制的尺寸意图
 *   6) 自有 COS 图床的图片自动注入 srcset + sizes，让浏览器按设备挑最合适的尺寸下载，
 *      移动端 LCP 直降；作者已手写 srcset 的不覆盖
 */
function ensureImgAttributes(html: string): string {
    return html.replace(/<img\b([^>]*)>/gi, (_full, attrs: string) => {
        let next = attrs;

        // 1) 处理 class：已有则确保包含 article-img / article-img-zoomable，没有则新增
        if (/\bclass\s*=\s*("|')/i.test(next)) {
            next = next.replace(/\bclass\s*=\s*("|')([^"']*)\1/i, (_m, quote: string, value: string) => {
                const classes = new Set(value.split(/\s+/).filter(Boolean));
                classes.add('article-img');
                classes.add('article-img-zoomable');
                return `class=${quote}${Array.from(classes).join(' ')}${quote}`;
            });
        } else {
            next = ` class="article-img article-img-zoomable"` + next;
        }

        // 2) loading="lazy" 与 decoding="async"：缺则补，不覆盖作者已有声明
        if (!/\bloading\s*=/i.test(next)) {
            next += ' loading="lazy"';
        }
        if (!/\bdecoding\s*=/i.test(next)) {
            next += ' decoding="async"';
        }

        // 3) 响应式 srcset：仅对自有 COS 图床注入，作者已写 srcset 的不覆盖
        //    sizes 提示：移动端（≤576px）满视口、平板（≤992px）90vw、PC 端文章正文约 720px
        if (!/\bsrcset\s*=/i.test(next)) {
            const srcMatch = next.match(/\bsrc\s*=\s*("|')([^"']+)\1/i);
            if (srcMatch) {
                const srcset = buildCosSrcset(srcMatch[2]);
                if (srcset) {
                    next += ` srcset="${srcset}"`;
                    if (!/\bsizes\s*=/i.test(next)) {
                        next += ` sizes="(max-width: 576px) 100vw, (max-width: 992px) 90vw, 720px"`;
                    }
                }
            }
        }

        return `<img${next}>`;
    });
}

/**
 * 将 Markdown 文本渲染为 HTML 字符串
 * 该方法可在 Nuxt3 的 SSR 阶段安全调用，用于生成 SEO 友好的文章内容 HTML。
 *
 * ⚠ 现在是 async：因为代码块高亮交给了 Shiki（VSCode 同款 TextMate Grammar 引擎），
 *   Shiki 的 createHighlighter / loadLanguage 是异步 API。
 *
 * 调用方都已在 async 函数内（pages/article-detail/[id].vue 的两处 await 路径），
 * 直接 await 即可，无需特殊改造。
 */
export async function renderMarkdownToHtml(markdown: string | undefined | null, maxLength?: number): Promise<string> {
    if (!markdown) return '';

    // 如果指定了最大长度，只渲染前部分内容
    const contentToRender = maxLength && markdown.length > maxLength
        ? markdown.slice(0, maxLength) + '\n\n...'
        : markdown;

    try {
        // 每次渲染创建独立的 RenderEnv：承载 heading 序号、Shiki 占位符 Map 与计数器、
        // placeholderSalt。markdown-it 会把它透传给所有 rule（fence / heading_open 等），
        // 确保并发请求各自持有独立状态，杜绝跨渲染串号 / 串台。
        const env = createRenderEnv();
        const html = md.render(contentToRender, env);
        const resolved = await resolveShikiPlaceholders(html, env);
        // 后处理：原生 <img> 透传写法（如 Typora 的 <img style="zoom:67%">）
        // 在这里统一补 class，让点击全屏功能对所有图片一视同仁
        return ensureImgAttributes(resolved);
    } catch (error) {
        return `<pre>${md.utils.escapeHtml(contentToRender)}</pre>`;
    }
}

/**
 * 从 Markdown 中提取第一张图片的 URL，用于 og:image / twitter:image。
 * 如果文章没有图片，返回 null，调用方应回落到默认站点封面。
 */
export function extractFirstImageUrl(markdown: string | undefined | null): string | null {
    if (!markdown) return null;

    // Markdown 图片语法：![alt](url) 或 ![alt](url "title")
    const mdMatch = markdown.match(/!\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/);
    if (mdMatch && mdMatch[1]) return mdMatch[1];

    // 兜底：直接出现 <img src="..."> 的 HTML 形式
    const htmlMatch = markdown.match(/<img[^>]+src=["']([^"']+)["']/i);
    if (htmlMatch && htmlMatch[1]) return htmlMatch[1];

    return null;
}

/**
 * 从 Markdown 中提取干净的纯文本，用于 meta description。
 * 跳过代码块、图片标记、链接 URL，只保留有阅读价值的正文。
 */
export function extractPlainTextDescription(
    markdown: string | undefined | null,
    maxLength = 160
): string {
    if (!markdown) return '';

    const cleaned = markdown
        // 整段移除围栏代码块（```...```）
        .replace(/```[\s\S]*?```/g, ' ')
        // 移除行内代码（`xxx`）
        .replace(/`[^`]*`/g, ' ')
        // 移除图片标记（![alt](url)）
        .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
        // 链接保留文字部分：[text](url) -> text
        .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
        // 移除 HTML 标签
        .replace(/<[^>]*>/g, ' ')
        // 移除 markdown 语法符号
        .replace(/[#>*_~`\-]+/g, ' ')
        // 折叠空白
        .replace(/\s+/g, ' ')
        .trim();

    return cleaned.slice(0, maxLength);
}

export interface CatalogHeading {
    id: string;
    text: string;
    level: number;
}

/**
 * 从 markdown-it 渲染好的 HTML 字符串里抽取目录用的标题列表。
 *
 * 目的：让目录组件可以在 SSR 阶段就拿到 headings 数据并把 <ul> 直出，
 * 避免客户端再去 querySelectorAll 扫描 DOM 引发的"骨架屏 → 列表突现 → active 着色"闪烁。
 *
 * 实现说明：
 * - 这里有意不引入 happy-dom / cheerio，避免给 SSR bundle 增加依赖；
 *   渲染好的 HTML 来自 markdown-it 我们自己的 heading_open 钩子，结构非常规范，
 *   一段简单的正则就能把 id / level / 文本稳定取出来。
 * - 文本里如果有内联 HTML 标签（<code> 等），统一脱敏成纯文本，目录显示更干净。
 */
export function extractHeadingsFromHtml(
    html: string | undefined | null,
    maxLevel = 3
): CatalogHeading[] {
    if (!html) return [];

    const headings: CatalogHeading[] = [];
    // <h2 id="xxx">内容</h2> —— level/id/inner 三段稳定可得
    const regex = /<h([1-6])\b[^>]*\bid="([^"]+)"[^>]*>([\s\S]*?)<\/h\1>/gi;

    let match: RegExpExecArray | null;
    while ((match = regex.exec(html)) !== null) {
        const level = Number(match[1]);
        if (level > maxLevel) continue;

        const id = match[2];
        const innerHtml = match[3] || '';
        // 去掉所有内联标签 + 折叠空白
        const text = innerHtml
            .replace(/<[^>]+>/g, '')
            .replace(/\s+/g, ' ')
            .trim();

        if (!id || !text) continue;
        headings.push({ id, text, level });
    }

    return headings;
}
