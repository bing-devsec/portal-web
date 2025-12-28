import MarkdownIt from 'markdown-it';

// 单例 MarkdownIt 实例，既可在服务端也可在客户端运行
// 优化：禁用一些耗时的插件，提升渲染速度
const md = new MarkdownIt({
    html: true,
    linkify: true,
    breaks: false,
    // 优化：禁用一些可能耗时的功能
    typographer: false, // 禁用排版优化，提升速度
});

// 优化：为图片添加懒加载和异步解码属性（移动端性能优化）
md.renderer.rules.image = function (tokens, idx, options, env, self) {
    const token = tokens[idx];
    const src = token.attrGet('src') || '';
    const title = token.attrGet('title') || '';
    const alt = token.content || '';
    
    // 添加 loading="lazy" 和 decoding="async" 优化移动端性能
    return `<img src="${src}" alt="${alt}"${title ? ` title="${title}"` : ''} loading="lazy" decoding="async" style="width: 100%; height: auto; max-width: 100%; display: block;">`;
};

/**
 * 将 Markdown 文本渲染为 HTML 字符串
 * 该方法可在 Nuxt3 的 SSR 阶段安全调用，用于生成 SEO 友好的文章内容 HTML。
 * 
 * 优化：对于大内容，可以考虑分块渲染或限制长度
 */
export function renderMarkdownToHtml(markdown: string | undefined | null, maxLength?: number): string {
    if (!markdown) return '';
    
    // 如果指定了最大长度，只渲染前部分内容
    const contentToRender = maxLength && markdown.length > maxLength 
        ? markdown.slice(0, maxLength) + '\n\n...'
        : markdown;
    
    try {
        return md.render(contentToRender);
    } catch (error) {
        return `<pre>${contentToRender}</pre>`;
    }
}
