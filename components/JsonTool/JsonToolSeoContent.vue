<template>
    <div class="json-seo-content">
        <section class="seo-section compat">
            <h2 class="seo-h2">{{ t.compatTitle }}</h2>
            <p class="section-intro">{{ t.compatIntro }}</p>
            <p v-for="(p, idx) in t.compatLead" :key="`lead-${idx}`" class="tip-line">{{ p }}</p>
            <ul class="compat-list">
                <li v-for="(c, idx) in t.compatList" :key="idx">
                    <strong class="compat-title">{{ c.title }}</strong>
                    <span class="compat-tagline">{{ c.tagline }}</span>
                    <ul v-if="c.bullets && c.bullets.length" class="compat-bullets">
                        <li v-for="(b, bIdx) in c.bullets" :key="bIdx">{{ b }}</li>
                    </ul>
                </li>
            </ul>
        </section>

        <section class="seo-section tips">
            <h2 class="seo-h2">{{ t.tipsTitle }}</h2>
            <p class="section-intro">{{ t.tipsIntro }}</p>

            <article v-for="(tip, idx) in t.tips" :key="idx" class="tip-item">
                <h3 class="tip-h3">{{ tip.title }}</h3>
                <p v-for="(line, lineIdx) in tip.body" :key="lineIdx" class="tip-line">{{ line }}</p>
                <ul v-if="tip.bullets && tip.bullets.length" class="tip-bullets">
                    <li v-for="(b, bIdx) in tip.bullets" :key="bIdx">{{ b }}</li>
                </ul>
            </article>

            <article class="tip-item">
                <h3 class="tip-h3">{{ t.shortcutsTitle }}</h3>
                <p class="tip-line">{{ t.shortcutsIntro }}</p>
                <div class="shortcuts-table-wrapper">
                    <table class="shortcuts-table">
                        <thead>
                            <tr>
                                <th>{{ t.shortcutsHeader.action }}</th>
                                <th>Windows / Linux</th>
                                <th>macOS</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="(row, idx) in t.shortcuts" :key="idx">
                                <td>{{ row.action }}</td>
                                <td v-html="row.win"></td>
                                <td v-html="row.mac"></td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </article>
        </section>

        <section class="seo-section faq">
            <h2 class="seo-h2">{{ t.faqTitle }}</h2>
            <div v-for="(qa, idx) in t.faq" :key="idx" class="faq-item">
                <h3 class="faq-q">{{ qa.q }}</h3>
                <p class="faq-a">{{ qa.a }}</p>
                <table v-if="qa.table" class="faq-table">
                    <thead>
                        <tr>
                            <th v-for="(h, hIdx) in qa.table.headers" :key="hIdx">{{ h }}</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="(row, rIdx) in qa.table.rows" :key="rIdx">
                            <td v-for="(cell, cIdx) in row" :key="cIdx">{{ cell }}</td>
                        </tr>
                    </tbody>
                </table>
                <p v-if="qa.tail" class="faq-a">{{ qa.tail }}</p>
            </div>
        </section>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
    locale?: 'zh' | 'en';
}>();

const ZH = {
    tipsTitle: '高效使用技巧',
    tipsIntro:
        '本工具针对 JSON 数据的浏览、编辑、调试场景做了大量隐藏优化，掌握下面这些技巧可以让你的处理效率成倍提升。',
    tips: [
        {
            title: '🚦 JSON 错误精准定位',
            body: [
                '在「设置」中开启「语法校验」后，错误处会显示红色波浪线作为视觉提示。',
                '搭配编辑区域右下角状态栏的「错误定位」按钮，可以一键跳转到错误位置 —— 处理那些"扫一眼也看不出哪里出错"的复杂 JSON、或者动辄上万行无法格式化的脏数据时尤其救命，把"找错误"这个最枯燥的环节压缩到一次点击。',
            ],
        },
        {
            title: '📊 状态栏动态信息',
            body: [
                '编辑区域与预览区域底部各有独立状态栏，随光标和选区状态智能切换：',
            ],
            bullets: [
                '光标 / 选区基础信息：行列号、总行数、选中行数与字符数。',
                '全文匹配统计：选中文本若在文档中有多处副本，自动追加「共 N 处匹配」，无需打开搜索框。',
                '全选时显示文件大小：按 UTF-8 字节计算（中文 3B、emoji 4B），免开外部工具量体积。',
                'Diff 模式左右两侧独立刷新。',
            ],
        },
        {
            title: '🗂️ 折叠摘要预估规模',
            body: [
                '在预览区域中折叠任意 JSON 节点时，折叠行末尾会自动显示当前节点的规模摘要：',
            ],
            bullets: [
                '对象折叠后显示「N keys」，即该对象包含 N 个键',
                '数组折叠后显示「N items」，即该数组包含 N 个元素',
                '完全不需要展开就能看清每个对象 / 数组的规模 —— 在面对几万行的大型嵌套 JSON 时，配合 Monaco 的缩进引导线，可以自顶向下快速建立对整份 JSON 的结构认知，这是浏览大型 JSON 最高效的探索方式。',
            ],
        },
        {
            title: '🎯 AST 智能选中 · 一键 Base64 / URL 编解码',
            body: [
                '编辑区域与预览区域的双击行为均基于 AST 语法树识别，跨引号、跨转义都能精准选中整段字符串边界，与传统的"双词选中"完全不同。',
            ],
            bullets: [
                '编辑区域双击字符串：仅选中，不复制（方便修改）',
                '预览区域双击字符串：选中并自动复制到剪贴板（方便取值）',
                '选中文本后右键菜单：可对选中内容进行 Base64 编码 / 解码、URL 编码 / 解码，原地替换 —— 处理 token、签名、URL 参数等场景无需切换其他工具。',
                '对比（Diff）模式同样支持：左右编辑器都可以双击智能选中字符串、右键菜单一键编解码，排查接口前后差异时无需切回普通模式。',
            ],
        },
        {
            title: '🔄 一键内容转移（保留折叠状态）',
            body: [
                '在编辑区域与预览区域中间的可拖动分割线上方，有一个带箭头图标的方块按钮（指向编辑区域）。点击后，会把预览区域的处理结果一键转移到编辑区域。',
                '不仅数据会被完整转移，预览区域里已折叠的层级状态也会同步保留 —— 方便你在处理大型复杂 JSON 时持续聚焦正在分析的层级关系，避免每次格式化后都被全部展开、打乱思路。',
            ],
        },
        {
            title: '📐 双击面板头：50% / 100% 占比切换',
            body: [
                '双击编辑区域或预览区域上方的标题栏，可在「左右各 50%」与「单边 100% 全宽」之间切换。处理超长行 JSON 或字段密集的 JSON 时尤其顺手。',
            ],
        },
        {
            title: '📋 多格式自动折叠',
            body: [
                '编辑区域不仅识别 JSON，输入 YAML / TOML / XML / CSS / HTML 等结构化文本时，也会按缩进或标签自动提供折叠功能 —— 把它当作通用的结构化文本查看器也很顺手。',
            ],
        },
    ],
    shortcutsTitle: '⌨️ 完整 Monaco 快捷键',
    shortcutsIntro: '全套 VS Code 同款快捷键，老开发者上手零成本。',
    shortcutsHeader: { action: '操作' },
    shortcuts: [
        { action: '撤销', win: 'Ctrl+Z', mac: 'Cmd+Z' },
        { action: '查找', win: 'Ctrl+F', mac: 'Cmd+F' },
        { action: '跳转到指定行号', win: 'Ctrl+G', mac: 'Cmd+G' },
        { action: '行内 / 块注释', win: 'Ctrl+/', mac: 'Cmd+/' },
        { action: '行上移 / 下移', win: 'Alt+<span class="kbd-arrow up">↓</span> / Alt+<span class="kbd-arrow down">↓</span>', mac: 'Option+<span class="kbd-arrow up">↓</span> / Option+<span class="kbd-arrow down">↓</span>' },
        { action: '多行光标编辑', win: 'Ctrl+Alt+<span class="kbd-arrow up">↓</span> / Ctrl+Alt+<span class="kbd-arrow down">↓</span>', mac: 'Cmd+Option+<span class="kbd-arrow up">↓</span> / Cmd+Option+<span class="kbd-arrow down">↓</span>' },
        { action: '跳转到文档开头 / 结尾', win: 'Ctrl+Home / Ctrl+End', mac: 'Cmd+<span class="kbd-arrow up">↓</span> / Cmd+<span class="kbd-arrow down">↓</span>' },
    ],

    compatTitle: '强大的格式化兼容性 —— 比 JSON5 更宽容',
    compatIntro:
        '为什么很多 JSON 在别处报错，在这里却能正常格式化？因为本工具的解析器在 JSON5 基础上做了大量增强，且对数字精度、字符编码、数组排版、缩进风格都有专门处理，把"看上去脏脏的 JSON"变成可读结构化数据。',
    compatLead: [
        'JSON5 是 ES5 之后社区为补足 JSON 易用性提出的扩展规范，允许 key 不加引号、单引号字符串、尾随逗号、Infinity / NaN 等特性，但仍然不被所有解析器接受。本工具在内置 JSON5 解析器之上又叠加了 # 注释、自动数字精度保护、Unicode 全保真等扩展，是当前主流 JSON 工具中最宽容的解析器之一。',
    ],
    compatList: [
        {
            title: '完整支持 JSON5 标准',
            tagline: '吞下常见的"伪 JSON"，一键变合法 JSON。',
            bullets: [
                'key 可不加引号',
                '字符串可用单引号',
                '数组/对象允许尾随逗号',
                '支持 Infinity / NaN 等特殊值',
            ],
        },
        {
            title: '三种注释，比 JSON5 还宽容',
            tagline: '不仅兼容 JSON5，还扩展支持 # 注释。',
            bullets: [
                '// 单行注释',
                '/* 多行注释 */',
                '# 单行注释（JSON5 标准并不支持，本工具扩展）',
            ],
        },
        {
            title: '数字无损保护',
            tagline: '默认强制开启数字字面量保护，永不丢精度。',
            bullets: [
                '超出 Number.MAX_SAFE_INTEGER 的大整数（雪花 ID / 订单号）原样输出',
                '末尾零的浮点数（1.10）不会被吞成 1.1',
                '指数形态（1e10）格式化前后一字不差',
            ],
        },
        {
            title: '数组排版',
            tagline: '设置中可切换「数组样式：换行 / 紧凑」。',
            bullets: [
                '紧凑模式：仅对简单类型数组（string / number / bool / null）生效',
                '复杂对象数组：自动保持换行，避免一行几百字段挤成一团',
            ],
        },
        {
            title: '缩进可控',
            tagline: '不破坏原来代码的缩进风格。',
            bullets: [
                '缩进空格 2 / 4 / 8 三档可选',
                '编辑区域粘贴时自动检测原始 JSON 的缩进风格并智能切换显示',
            ],
        },
        {
            title: '字符编码可解可还原',
            tagline: '排查"前端拿到一堆 \\u4e2d\\u6587"的利器。',
            bullets: [
                '开启解码：自动还原 \\uXXXX、\\xHH',
                '关闭解码：原样保留转义序列，方便对比原始报文',
            ],
        }
    ],

    faqTitle: '常见问题',
    faq: [
        {
            q: '我的 JSON 数据会被上传到服务器吗？',
            a: '默认不会。JSON 的解析、格式化、压缩、转义 / 去除转义、排序、Diff 对比、脱敏，以及 YAML / TOML / XML / Go 结构体的转换，全部在你的浏览器本地完成。只有当你主动使用「分享」或「获取 JSON」功能时，才会与服务器交互。',
        },
        {
            q: '「分享」功能是怎么处理我的数据的？',
            a: '点击「生成分享链接」后，工具会把 JSON 数据上传到服务器以生成可访问的短链接，并设置自动过期时间。请勿分享包含敏感信息的数据，如有需要可先使用「脱敏」功能再分享。',
        },
        {
            q: '「获取 JSON」功能会经过你们的服务器吗？',
            a: '会。由于浏览器同源策略限制，请求会经过本站服务器代理转发到目标 URL，本站不会持久化你的请求或响应内容。',
        },
        {
            q: '这个工具对 JSON 体积有什么限制？',
            a: '本工具针对大文件做了深度优化，并按行数划分四档运行模式，确保浏览器在不同体量下都能保持流畅：',
            table: {
                headers: ['行数范围', '运行模式', '功能说明', '备注'],
                rows: [
                    ['≤ 100 万行', '正常模式', '全部功能可用', '设置按用户选择生效'],
                    ['100 ~ 300 万行', '受限模式', '仅层级收缩不可用', '其他功能正常'],
                    ['300 ~ 500 万行', '仅展示模式', '只可查看和滚动', '语法检测、粘性滚动两项设置被强制关闭'],
                    ['> 500 万行', '超限', '自动清空内容', '编辑区与预览区都会清空'],
                ],
            },
            tail: '实测可在 3 秒内完成 200 万行、15 层嵌套 JSON 的格式化与层级收缩，背后由虚拟滚动、按需折叠、Worker 解析等多项优化保障。',
        },
        {
            q: 'JSON 转 Go 结构体的字段命名规则是什么？',
            a: '遵循 Go 官方 Lint 的 CommonInitialisms 白名单规则：ID、URL、API、HTML 等常见缩写会全大写（如 userID → UserID），其他片段采用标准驼峰式命名。',
        },
        {
            q: '这个工具是免费的吗？',
            a: '完全免费。无需注册、无需登录、无广告弹窗，开箱即用。',
        },
    ],
};

const EN = {
    tipsTitle: 'Power-User Tips',
    tipsIntro:
        'This tool ships with a number of hidden optimizations for browsing, editing, and debugging JSON. Mastering the tips below will multiply your efficiency.',
    tips: [
        {
            title: '🚦 Precise Error Location',
            body: [
                'Enable "Syntax validation" in Settings; errors are highlighted with red squiggly lines as a visual cue.',
                'Combine that with the "Jump to error" button at the bottom-right of the Editor pane status bar to instantly jump to the broken line — a lifesaver when dealing with complex JSON where the bug is not visually obvious, or with thousands of lines of dirty data that simply will not format. The most tedious part of debugging shrinks down to a single click.',
            ],
        },
        {
            title: '📊 Status Bar Live Info',
            body: [
                'Each pane has its own bottom status bar, intelligently switching based on cursor and selection state:',
            ],
            bullets: [
                'Cursor / selection basics: line, column, total lines, selected lines and characters.',
                'Whole-document match counter: if the selection has duplicates elsewhere, "N matches" is appended — no search panel needed.',
                'On Select All, file size shows up — computed in UTF-8 bytes (3B per CJK char, 4B per emoji), no external tool required.',
                'In Diff mode, the two sides refresh independently.',
            ],
        },
        {
            title: '🗂️ Folding Summary at a Glance',
            body: [
                'In the Preview pane, when you fold any JSON node, the trailing label automatically shows the size of that node:',
            ],
            bullets: [
                'Objects show "N keys" once folded — i.e. the object contains N keys',
                'Arrays show "N items" once folded — i.e. the array contains N elements',
                'You can size up every object or array without ever expanding them. When facing a deeply nested JSON of tens of thousands of lines, paired with Monaco\'s indentation guides, you can build a top-down structural understanding of the entire payload extremely fast — the most efficient way to explore large JSON.',
            ],
        },
        {
            title: '🎯 AST-based Smart Selection · One-click Base64 / URL Encode-Decode',
            body: [
                'Double-click in either the Editor pane or the Preview pane is powered by AST tokenization, so it cleanly selects entire string boundaries even across quotes and escape sequences — completely different from the traditional "select word" behavior.',
            ],
            bullets: [
                'Double-click a string in the Editor pane: select only, no copy (handy for editing)',
                'Double-click a string in the Preview pane: select and auto-copy to clipboard (handy for grabbing values)',
                'Right-click on a selection: encode / decode the selected text in place as Base64 or URL — no need to switch to a separate tool when working with tokens, signatures, or URL params.',
                'Available in Diff mode too: both the left and right editors support smart double-click selection plus right-click Base64 / URL encode-decode, so you can debug API request/response differences without leaving the diff view.',
            ],
        },
        {
            title: '🔄 One-click Content Transfer (preserves folding state)',
            body: [
                'Above the draggable splitter between the Editor and Preview panes there is a square button with an arrow icon (pointing toward the Editor pane). Clicking it transfers the processed result from the Preview pane back into the Editor pane.',
                'Not only the data is transferred — the folded state of nodes in the Preview pane is preserved too. So when working with large, complex JSON you can stay focused on the layer you are currently analyzing, without having everything re-expanded after each format pass.',
            ],
        },
        {
            title: '📐 Double-click the pane header: toggle 50% / 100% width',
            body: [
                'Double-clicking the title bar above the Editor or Preview pane toggles between "50/50 split" and "100% full width". This is especially handy when working with very long lines or extremely dense JSON.',
            ],
        },
        {
            title: '📋 Multi-format Auto-folding',
            body: [
                'The Editor pane recognizes more than just JSON — when you paste YAML / TOML / XML / CSS / HTML, it automatically provides folding by indentation or tag structure, making it a fine general-purpose structured-text viewer.',
            ],
        },
    ],
    shortcutsTitle: '⌨️ Full Monaco Shortcuts',
    shortcutsIntro: 'A complete set of VS Code-compatible shortcuts — zero learning curve for veteran developers.',
    shortcutsHeader: { action: 'Action' },
    shortcuts: [
        { action: 'Undo', win: 'Ctrl+Z', mac: 'Cmd+Z' },
        { action: 'Find', win: 'Ctrl+F', mac: 'Cmd+F' },
        { action: 'Go to line number', win: 'Ctrl+G', mac: 'Cmd+G' },
        { action: 'Toggle line / block comment', win: 'Ctrl+/', mac: 'Cmd+/' },
        { action: 'Move line up / down', win: 'Alt+<span class="kbd-arrow up">↓</span> / Alt+<span class="kbd-arrow down">↓</span>', mac: 'Option+<span class="kbd-arrow up">↓</span> / Option+<span class="kbd-arrow down">↓</span>' },
        { action: 'Add multi-cursor above / below', win: 'Ctrl+Alt+<span class="kbd-arrow up">↓</span> / Ctrl+Alt+<span class="kbd-arrow down">↓</span>', mac: 'Cmd+Option+<span class="kbd-arrow up">↓</span> / Cmd+Option+<span class="kbd-arrow down">↓</span>' },
        { action: 'Jump to file start / end', win: 'Ctrl+Home / Ctrl+End', mac: 'Cmd+<span class="kbd-arrow up">↓</span> / Cmd+<span class="kbd-arrow down">↓</span>' },
    ],

    compatTitle: 'Best-in-class Compatibility — More Tolerant than JSON5',
    compatIntro:
        'Why does broken JSON that fails in other tools format perfectly here? Because this parser ships JSON5 plus a stack of additional enhancements — number precision, character encoding, array layout, and indentation — turning "ugly-looking" JSON into readable structured data.',
    compatLead: [
        'JSON5 is the community-driven superset of JSON proposed after ES5, adding unquoted keys, single-quoted strings, trailing commas, and Infinity / NaN — features that most strict parsers still reject. On top of an embedded JSON5 parser, this tool layers # comments, automatic number-precision preservation, and full Unicode fidelity, making it one of the most forgiving JSON parsers among popular online tools.',
    ],
    compatList: [
        {
            title: 'Full JSON5 support',
            tagline: 'Accepts common "pseudo-JSON" and turns it into valid JSON in one click.',
            bullets: [
                'Unquoted keys',
                'Single-quoted strings',
                'Trailing commas allowed in arrays / objects',
                'Infinity / NaN and other special values',
            ],
        },
        {
            title: 'Three comment styles, beyond JSON5',
            tagline: 'JSON5-compatible and extended with # comments.',
            bullets: [
                '// line comments',
                '/* block comments */',
                '# line comments (not in JSON5 spec — this tool extends it)',
            ],
        },
        {
            title: 'Lossless number preservation',
            tagline: 'Numeric-literal preservation is permanently on — zero precision loss.',
            bullets: [
                'Big integers beyond Number.MAX_SAFE_INTEGER (snowflake / order IDs) emitted byte-for-byte',
                'Floats with trailing zeros (1.10) never collapsed to 1.1',
                'Exponential forms (1e10) preserved exactly through formatting',
            ],
        },
        {
            title: 'Array layout',
            tagline: 'Toggle "Array style: newline / compact" in Settings.',
            bullets: [
                'Compact mode applies only to arrays of primitives (string / number / boolean / null)',
                'Arrays of complex objects keep wrapping — no hundreds-of-fields-on-one-line nightmare',
            ],
        },
        {
            title: 'Controllable indent',
            tagline: 'Existing indentation style is preserved.',
            bullets: [
                'Indent at 2 / 4 / 8 spaces, your choice',
                'On paste, the Editor pane auto-detects the source indentation and switches the display intelligently',
            ],
        },
        {
            title: 'Reversible character encoding',
            tagline: 'Perfect for debugging "why is the frontend receiving a wall of \\u4e2d\\u6587".',
            bullets: [
                'Decode on: \\uXXXX and \\xHH escapes are restored automatically',
                'Decode off: escape sequences kept verbatim for raw payload comparison',
            ],
        }
    ],

    faqTitle: 'Frequently Asked Questions',
    faq: [
        {
            q: 'Is my JSON data uploaded to any server?',
            a: 'By default, no. Parsing, formatting, minifying, escape / unescape, sorting, diffing, masking, and converting JSON to YAML / TOML / XML / Go struct all run locally in your browser. Your data is only sent to the server when you explicitly use the "Share" or "Fetch JSON" feature.',
        },
        {
            q: 'How does the Share feature handle my data?',
            a: 'When you click "Generate share link", the tool uploads your JSON to the server in order to produce a short URL, with an automatic expiration policy. Please do not share sensitive data, or use the "Mask" feature first.',
        },
        {
            q: 'Does the "Fetch JSON" feature go through your server?',
            a: 'Yes. Due to browser CORS restrictions, the request is proxied through our server to the target URL. We do not persist your request or response.',
        },
        {
            q: 'What size limits apply to the JSON?',
            a: 'The tool is heavily optimized for large files and runs in one of four modes based on line count, keeping the browser responsive at any scale:',
            table: {
                headers: ['Line range', 'Mode', 'Behavior', 'Notes'],
                rows: [
                    ['≤ 1M lines', 'Normal', 'All features available', 'Settings honor user choices'],
                    ['1M – 3M lines', 'Restricted', 'Only fold-by-level is disabled', 'Everything else works'],
                    ['3M – 5M lines', 'Read-only', 'View and scroll only', 'Syntax check & sticky scroll are force-disabled'],
                    ['> 5M lines', 'Over limit', 'Content is auto-cleared', 'Both editor and preview panes reset'],
                ],
            },
            tail: 'In real-world tests, formatting and fold-by-level on a 2M-line, 15-level deeply nested JSON complete within 3 seconds — powered by virtual scrolling, on-demand folding, and Web Worker parsing.',
        },
        {
            q: 'What naming rules does JSON-to-Go struct conversion follow?',
            a: 'It follows the official Go lint CommonInitialisms whitelist: common acronyms like ID, URL, API, and HTML are fully capitalized (e.g. userID → UserID), while other segments use standard CamelCase.',
        },
        {
            q: 'Is it free?',
            a: 'Completely free. No registration, no login, no ads — just open and use.',
        },
    ],
};

const t = computed(() => (props.locale === 'en' ? EN : ZH));
</script>

<style scoped>
.json-seo-content {
    max-width: 1200px;
    margin: 40px auto 60px;
    padding: 0 20px;
    color: var(--el-text-color-primary, #2c3e50);
    line-height: 1.7;
}

.seo-section {
    margin-bottom: 48px;
}

.seo-h2 {
    font-size: 24px;
    font-weight: 600;
    margin-bottom: 16px;
    padding-bottom: 8px;
    border-bottom: 2px solid var(--el-color-primary, #409eff);
    display: inline-block;
}

.section-intro {
    font-size: 14px;
    color: var(--el-text-color-regular, #606266);
    margin: 0 0 20px;
}

.tip-item {
    margin-bottom: 22px;
    padding: 16px 20px;
    background: var(--el-fill-color-light, #f5f7fa);
    border-radius: 8px;
    border-left: 3px solid var(--el-color-primary, #409eff);
}

.tip-h3 {
    font-size: 17px;
    font-weight: 600;
    margin: 0 0 10px;
    color: var(--el-color-primary, #409eff);
}

.tip-line {
    margin: 0 0 8px;
    font-size: 14px;
    color: var(--el-text-color-regular, #606266);
}

.tip-bullets {
    margin: 8px 0 0;
    padding-left: 22px;
}

.tip-bullets li {
    margin-bottom: 6px;
    font-size: 14px;
    color: var(--el-text-color-regular, #606266);
}

.shortcuts-table-wrapper {
    overflow-x: auto;
    margin-top: 12px;
}

.shortcuts-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
    min-width: 480px;
}

.shortcuts-table th,
.shortcuts-table td {
    padding: 8px 12px;
    text-align: left;
    border-bottom: 1px solid var(--el-border-color-lighter, #ebeef5);
}

.shortcuts-table th {
    background: var(--el-fill-color, #f0f2f5);
    color: var(--el-text-color-primary, #2c3e50);
    font-weight: 600;
}

.shortcuts-table td:first-child {
    color: var(--el-text-color-primary, #2c3e50);
    font-weight: 500;
}

.shortcuts-table td:not(:first-child) {
    font-family: 'SF Mono', Monaco, Consolas, 'Courier New', monospace;
    color: var(--el-text-color-regular, #606266);
}

.shortcuts-table td :deep(.kbd-arrow) {
    display: inline-block;
    font-weight: 700;
    line-height: 1;
    margin: 0 1px;
}

.shortcuts-table td :deep(.kbd-arrow.up) {
    transform: translateY(2px) rotate(180deg);
}

.compat-list {
    list-style: none;
    padding: 0;
    margin: 0 0 16px;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 12px;
}

.compat-list > li {
    padding: 14px 16px;
    background: var(--el-fill-color-light, #f5f7fa);
    border-radius: 8px;
    border-left: 3px solid var(--el-color-primary, #409eff);
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.compat-list .compat-title {
    display: block;
    font-size: 14px;
    font-weight: 600;
    color: var(--el-color-primary, #409eff);
    line-height: 1.5;
}

.compat-list .compat-tagline {
    font-size: 13px;
    color: var(--el-text-color-regular, #606266);
    line-height: 1.6;
}

.compat-list .compat-bullets {
    list-style: none;
    padding: 0;
    margin: 2px 0 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.compat-list .compat-bullets li {
    position: relative;
    padding-left: 14px;
    font-size: 12.5px;
    line-height: 1.65;
    color: var(--el-text-color-secondary, #909399);
}

.compat-list .compat-bullets li::before {
    content: '';
    position: absolute;
    left: 4px;
    top: 9px;
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: var(--el-color-primary, #409eff);
    opacity: 0.6;
}

.faq-item {
    margin-bottom: 20px;
    padding: 16px 18px;
    background: var(--el-fill-color-light, #f5f7fa);
    border-radius: 8px;
}

.faq-q {
    font-size: 16px;
    font-weight: 600;
    margin: 0 0 8px;
    color: var(--el-color-primary, #409eff);
}

.faq-a {
    margin: 0;
    font-size: 14px;
    color: var(--el-text-color-regular, #606266);
}

.faq-a + .faq-a {
    margin-top: 10px;
}

.faq-table {
    width: 100%;
    border-collapse: collapse;
    margin: 12px 0 4px;
    font-size: 13px;
    background: var(--el-bg-color, #fff);
    border-radius: 6px;
    overflow: hidden;
    box-shadow: 0 0 0 1px var(--el-border-color-lighter, #ebeef5);
}

.faq-table thead th {
    padding: 8px 12px;
    text-align: left;
    font-weight: 600;
    background: var(--el-fill-color, #f0f2f5);
    color: var(--el-text-color-primary, #2c3e50);
    border-bottom: 1px solid var(--el-border-color-lighter, #ebeef5);
    white-space: nowrap;
}

.faq-table tbody td {
    padding: 8px 12px;
    border-top: 1px solid var(--el-border-color-lighter, #ebeef5);
    color: var(--el-text-color-regular, #606266);
    line-height: 1.6;
    vertical-align: top;
}

.faq-table tbody tr:first-child td {
    border-top: none;
}

@media (max-width: 640px) {
    .faq-table {
        font-size: 12px;
    }
    .faq-table thead th,
    .faq-table tbody td {
        padding: 6px 8px;
    }
}

@media (max-width: 768px) {
    .compat-list {
        grid-template-columns: 1fr;
    }
    .seo-h2 {
        font-size: 20px;
    }
    .tip-h3 {
        font-size: 15px;
    }
}
</style>
