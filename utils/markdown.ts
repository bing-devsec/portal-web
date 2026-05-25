import MarkdownIt from 'markdown-it';
import katex from 'katex';
import type { Highlighter, ThemedToken } from 'shiki';
import { createHighlighter, bundledLanguages } from 'shiki';

// 单例 MarkdownIt 实例，既可在服务端也可在客户端运行
// 优化：禁用一些耗时的插件，提升渲染速度
const md = new MarkdownIt({
    html: true,
    linkify: true,
    breaks: false,
    // 优化：禁用一些可能耗时的功能
    typographer: true, // 启用排版优化，提升速度
});

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
// ⚠ 注意 Shiki 里 `github-dark` 与 `github-dark-default` 是两个不同主题：
//   - github-dark：GitHub 早期经典 dark 主题（更克制、注释更暗）
//   - github-dark-default：GitHub 2022 重设计版（色彩更鲜艳）
// 这里选的是经典版。
const SHIKI_THEME = 'github-dark';

// Shiki 实例采用懒加载：首次调用时才初始化、后续复用。
// 在 SSR (Node) 与 CSR 都能跑——Shiki 内部基于 oniguruma-to-es 做 wasm-free 正则匹配。
let highlighterPromise: Promise<Highlighter> | null = null;

// 已加载语言缓存：同一语言不重复 loadLanguage，避免重复 IO/解析成本
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
    /** 是否需要 ssr-code-line 包裹结构（普通代码块都要；mermaid 等不要） */
}

// 待高亮 fence 收集器：fence renderer 同步阶段往里塞，渲染入口异步阶段消费
let pendingHighlights = new Map<string, PendingHighlight>();
let pendingCounter = 0;

function nextPlaceholderToken(): string {
    pendingCounter += 1;
    // 用零宽字符 + 计数器构造唯一 token，避免与正文 markdown 内容碰撞
    return `${pendingCounter.toString(36)}-${Date.now().toString(36)}`;
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
 */
function tokenizedLinesToHtml(linesTokens: ThemedToken[][]): string {
    if (linesTokens.length === 0) {
        return '<span class="ssr-code-line">\u200B</span>';
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
 */
async function resolveShikiPlaceholders(html: string): Promise<string> {
    if (pendingHighlights.size === 0) return html;
    const highlighter = await getHighlighter();

    // 串行 loadLanguage 即可（重复语言走缓存），保持低内存峰值
    const replacements = new Map<string, string>();
    for (const [token, { lang, rawCode }] of pendingHighlights) {
        const supported = await ensureLanguageLoaded(highlighter, lang);
        let linesTokens: ThemedToken[][];
        if (supported) {
            try {
                const result = highlighter.codeToTokens(rawCode, {
                    lang: lang as keyof typeof bundledLanguages,
                    theme: SHIKI_THEME,
                });
                linesTokens = result.tokens;
            } catch {
                linesTokens = rawCode.split('\n').map((l) => [{ content: l, offset: 0 } as ThemedToken]);
            }
        } else {
            // 未识别语言：保留行结构但不上色（与原 hljs 行为一致）
            linesTokens = rawCode.split('\n').map((l) => [{ content: l, offset: 0 } as ThemedToken]);
        }
        // 与原行为对齐：去掉末尾空行，避免多一个"空行号"
        if (linesTokens.length > 0 && linesTokens[linesTokens.length - 1].length === 0) {
            linesTokens.pop();
        }
        replacements.set(token, tokenizedLinesToHtml(linesTokens));
    }

    // 一次性正则替换：占位符里嵌的 token 都是 [a-z0-9-]，模式简单
    const re = new RegExp(
        `${SHIKI_PLACEHOLDER_PREFIX}([a-z0-9-]+)${SHIKI_PLACEHOLDER_SUFFIX}`,
        'g',
    );
    return html.replace(re, (_, token) => replacements.get(token) ?? '');
}

md.renderer.rules.fence = function (tokens, idx) {
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
    const placeholderToken = nextPlaceholderToken();
    pendingHighlights.set(placeholderToken, { lang, rawCode });
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
    // ⚠ 头部按钮统一图标化：与「全屏」「复制」三按钮风格保持一致，
    //    用 SVG (chevron-up) 表示「收起」，title 属性提供原生 tooltip 学习成本最低。
    // ============================================================
    const headToggleDom = collapsible
        ? // 收起按钮（chevron-up）：仅展开态可见
          `<button class="ssr-code-toggle ssr-code-toggle--head ssr-code-iconbtn" type="button" aria-expanded="true" aria-label="收起代码" title="收起">` +
          `<svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true">` +
          `<path fill="currentColor" d="M12 8.59l-6.3 6.3 1.4 1.42L12 11.4l4.9 4.9 1.4-1.4z"/>` +
          `</svg>` +
          `</button>` +
          // 展开按钮（chevron-down）：仅折叠态可见，与浮动「展开全部」按钮并存，
          // 提供"在头部一键展开"的快捷入口（不用滚到底部按浮动按钮）
          `<button class="ssr-code-toggle ssr-code-toggle--head-expand ssr-code-iconbtn" type="button" aria-expanded="false" aria-label="展开代码" title="展开">` +
          `<svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true">` +
          `<path fill="currentColor" d="M12 15.41l6.3-6.3-1.4-1.42L12 12.59 7.1 7.7l-1.4 1.4z"/>` +
          `</svg>` +
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

let headingIndexCounter = 0;

const defaultHeadingOpen = md.renderer.rules.heading_open || function (tokens, idx, options, env, self) {
    return self.renderToken(tokens, idx, options);
};

md.renderer.rules.heading_open = function (tokens, idx, options, env, self) {
    const token = tokens[idx];
    const inlineToken = tokens[idx + 1];
    const text = inlineToken && inlineToken.type === 'inline' ? inlineToken.content : '';
    const level = Number(token.tag.slice(1));
    const id = `h${level}-${headingIndexCounter}-${cleanHeadingText(text)}`;
    headingIndexCounter += 1;
    token.attrSet('id', id);
    return defaultHeadingOpen(tokens, idx, options, env, self);
};

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
        // 每次渲染前重置 heading 计数与 Shiki 占位符收集器，
        // 保证多文章渲染时 id 不漂移、占位符 token 不串号
        headingIndexCounter = 0;
        pendingHighlights = new Map();
        pendingCounter = 0;
        const html = md.render(contentToRender);
        return await resolveShikiPlaceholders(html);
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
