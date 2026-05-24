/**
 * SEO 相关工具函数
 */

/**
 * 常见搜索引擎爬虫的 User-Agent 列表
 */
const SEARCH_ENGINE_BOTS = [
    // Google
    'Googlebot',
    'Googlebot-Image',
    'Googlebot-News',
    'Googlebot-Video',
    'Mediapartners-Google',
    'AdsBot-Google',
    'AdsBot-Google-Mobile',
    
    // Baidu
    'Baiduspider',
    'Baiduspider-image',
    'Baiduspider-video',
    'Baiduspider-news',
    'Baiduspider-favo',
    'Baiduspider-cpro',
    'Baiduspider-ads',
    
    // Bing
    'Bingbot',
    'bingbot',
    'msnbot',
    'msnbot-media',
    
    // 360
    '360Spider',
    'HaosouSpider',
    
    // Sogou
    'Sogou',
    'Sogou web spider',
    'Sogou inst spider',
    'Sogou spider2',
    'Sogou blog',
    'Sogou News Spider',
    'Sogou Orion spider',
    
    // Yandex
    'Yandex',
    'YandexBot',
    'YandexImages',
    'YandexVideo',
    'YandexMedia',
    
    // 其他
    'Slurp', // Yahoo
    'DuckDuckBot',
    'facebookexternalhit',
    'Twitterbot',
    'LinkedInBot',
    'Applebot',
    'ia_archiver', // Internet Archive
];

/**
 * 检测 User-Agent 是否为搜索引擎爬虫
 * @param userAgent User-Agent 字符串
 * @returns 是否为爬虫
 */
export function isSearchEngineBot(userAgent: string | null | undefined): boolean {
    if (!userAgent) return false;
    
    const ua = userAgent.toLowerCase();
    return SEARCH_ENGINE_BOTS.some(bot => ua.includes(bot.toLowerCase()));
}

/**
 * 从请求事件中获取 User-Agent
 * @param event Nuxt 请求事件
 * @returns User-Agent 字符串
 */
export function getUserAgentFromEvent(event: any): string | null {
    if (!event?.node?.req?.headers) return null;
    const ua = event.node.req.headers['user-agent'];
    return typeof ua === 'string' ? ua : null;
}

/**
 * 生成文章的结构化数据 (JSON-LD)
 * @param article 文章数据
 * @param siteUrl 网站URL
 * @returns JSON-LD 结构化数据对象
 */
export function generateArticleStructuredData(
    article: {
        id: string;
        title: string;
        content: string;
        tag?: string;
        createTime: string;
        updateTime: string;
    },
    siteUrl: string
) {
    const articleUrl = `${siteUrl}/article-detail/${article.id}`;
    
    // 从内容中提取纯文本作为描述
    const plainText = (article.content || '')
        .replace(/[`*_>#\-]+/g, ' ')
        .replace(/\[(.*?)\]\(.*?\)/g, '$1')
        .replace(/<[^>]*>/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    const description = plainText.slice(0, 200);
    
    // 提取标签
    const tags = article.tag ? article.tag.split(/[,\s，]+/).filter(Boolean) : [];
    
    return {
        '@context': 'https://schema.org',
        '@type': 'BlogPosting',
        '@id': articleUrl,
        'headline': article.title,
        'description': description,
        'datePublished': article.createTime,
        'dateModified': article.updateTime,
        'author': {
            '@type': 'Person',
            'name': '冰冰同学'
        },
        'publisher': {
            '@type': 'Organization',
            'name': '冰冰同学的技术博客',
            'url': siteUrl
        },
        'mainEntityOfPage': {
            '@type': 'WebPage',
            '@id': articleUrl
        },
        ...(tags.length > 0 ? {
            'keywords': tags.join(', ')
        } : {})
    };
}

/**
 * 生成网站的结构化数据 (JSON-LD)
 * @param siteUrl 网站URL
 * @returns JSON-LD 结构化数据对象
 */
export function generateWebsiteStructuredData(siteUrl: string) {
    return {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        'name': '冰冰同学的技术博客',
        'url': siteUrl,
        'description': '专注于C语言和Go语言编程，主要涵盖计算机系统、数据库设计与优化、后端开发、网络安全和运维等领域。',
        'author': {
            '@type': 'Person',
            'name': '冰冰同学'
        },
        'potentialAction': {
            '@type': 'SearchAction',
            'target': {
                '@type': 'EntryPoint',
                'urlTemplate': `${siteUrl}/search-result?keyword={search_term_string}`
            },
            'query-input': 'required name=search_term_string'
        }
    };
}

/**
 * 生成 JSON 工具页面的 WebApplication 结构化数据
 * @param siteUrl 网站根 URL
 * @param locale  'zh' | 'en'
 */
export function generateJsonToolStructuredData(siteUrl: string, locale: 'zh' | 'en' = 'zh') {
    const isZh = locale === 'zh';
    const pageUrl = `${siteUrl}${isZh ? '/tool/json' : '/en/tool/json'}`;

    return {
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        'name': isZh ? 'JSON 在线格式化工具 - 冰冰同学' : 'JSON Formatter Online - liubing.xyz',
        'description': isZh
            ? '免费在线 JSON 工具，支持 JSON 格式化、压缩、校验、排序、Diff 对比、脱敏，以及 JSON 转 YAML/TOML/XML/Go 结构体。核心处理均在浏览器本地完成（分享功能除外）。'
            : 'Free online JSON tool: format, minify, validate, sort, diff, mask, and convert JSON to YAML/TOML/XML/Go struct. Core processing runs entirely in your browser (except for the Share feature).',
        'url': pageUrl,
        'applicationCategory': 'DeveloperApplication',
        'operatingSystem': 'Any',
        'browserRequirements': 'Requires JavaScript. Requires HTML5.',
        'inLanguage': isZh ? 'zh-CN' : 'en-US',
        'isAccessibleForFree': true,
        'offers': {
            '@type': 'Offer',
            'price': '0',
            'priceCurrency': 'USD'
        },
        'featureList': isZh
            ? [
                'JSON 格式化',
                'JSON 压缩',
                'JSON 校验',
                'JSON 排序',
                'JSON 转 YAML',
                'JSON 转 TOML',
                'JSON 转 XML',
                'JSON 转 Go 结构体',
                'JSON Diff 对比',
                'JSON 脱敏'
            ]
            : [
                'JSON Format / Beautify',
                'JSON Minify',
                'JSON Validate',
                'JSON Sort',
                'JSON to YAML',
                'JSON to TOML',
                'JSON to XML',
                'JSON to Go Struct',
                'JSON Diff',
                'JSON Masking'
            ],
        'author': {
            '@type': 'Person',
            'name': isZh ? '冰冰同学' : 'liubing'
        }
    };
}

/**
 * 生成 JSON 工具页面的 FAQPage 结构化数据
 * @param locale 'zh' | 'en'
 */
export function generateJsonToolFaqStructuredData(locale: 'zh' | 'en' = 'zh') {
    const isZh = locale === 'zh';

    const faq = isZh
        ? [
            {
                q: '我的 JSON 数据会被上传到服务器吗？',
                a: '默认不会。JSON 的解析、格式化、压缩、转义 / 去除转义、排序、Diff 对比、脱敏，以及 YAML / TOML / XML / Go 结构体的转换，全部在你的浏览器本地完成。只有当你主动使用「分享」或「获取 JSON」功能时，才会与服务器交互。'
            },
            {
                q: '「分享」功能是怎么处理我的数据的？',
                a: '点击「生成分享链接」后，工具会把 JSON 数据上传到服务器以生成可访问的短链接，并设置自动过期时间。请勿分享包含敏感信息的数据，如有需要可先使用「脱敏」功能再分享。'
            },
            {
                q: '「获取 JSON」功能会经过你们的服务器吗？',
                a: '会。由于浏览器同源策略限制，请求会经过本站服务器代理转发到目标 URL，本站不会持久化你的请求或响应内容。'
            },
            {
                q: '这个工具对 JSON 体积有什么限制？',
                a: '本工具按行数划分四档运行模式：≤ 100 万行为正常模式（全部功能可用）；100 ~ 300 万行为受限模式（仅层级收缩不可用）；300 ~ 500 万行为仅展示模式（语法检测、粘性滚动会被强制关闭，仅可查看与滚动）；超过 500 万行将自动清空内容。实测可在 3 秒内完成 200 万行、15 层嵌套 JSON 的格式化与层级收缩。'
            },
            {
                q: 'JSON 转 Go 结构体的字段命名规则是什么？',
                a: '遵循 Go 官方 Lint 的 CommonInitialisms 白名单规则：ID、URL、API、HTML 等常见缩写会全大写，其他片段采用标准驼峰式命名。'
            },
            {
                q: '这个工具是免费的吗？',
                a: '完全免费。无需注册、无需登录、无广告弹窗，开箱即用。'
            }
        ]
        : [
            {
                q: 'Is my JSON data uploaded to any server?',
                a: 'By default, no. Parsing, formatting, minifying, escape / unescape, sorting, diffing, masking, and converting JSON to YAML / TOML / XML / Go struct all run locally in your browser. Your data is only sent to the server when you explicitly use the "Share" or "Fetch JSON" feature.'
            },
            {
                q: 'How does the Share feature handle my data?',
                a: 'When you click "Generate share link", the tool uploads your JSON to the server in order to produce a short URL, with an automatic expiration policy. Please do not share sensitive data, or use the "Mask" feature first.'
            },
            {
                q: 'Does the "Fetch JSON" feature go through your server?',
                a: 'Yes. Due to browser CORS restrictions, the request is proxied through our server to the target URL. We do not persist your request or response.'
            },
            {
                q: 'What size limits apply to the JSON?',
                a: 'The tool runs in one of four modes based on line count: ≤ 1M lines is Normal mode (all features available); 1M – 3M lines is Restricted mode (only fold-by-level is disabled); 3M – 5M lines is Read-only mode (syntax check and sticky scroll are force-disabled, view and scroll only); > 5M lines is over-limit and content is auto-cleared. In real-world tests, formatting and fold-by-level on a 2M-line, 15-level deeply nested JSON complete within 3 seconds.'
            },
            {
                q: 'How does JSON-to-Go naming work?',
                a: 'Field names follow the golint CommonInitialisms whitelist: common abbreviations like ID, URL, API, HTML are fully capitalized. Other segments use standard CamelCase.'
            },
            {
                q: 'Is this tool free?',
                a: 'Completely free. No signup, no login, no ads. Just open and use.'
            }
        ];

    return {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        'inLanguage': isZh ? 'zh-CN' : 'en-US',
        'mainEntity': faq.map(item => ({
            '@type': 'Question',
            'name': item.q,
            'acceptedAnswer': {
                '@type': 'Answer',
                'text': item.a
            }
        }))
    };
}

/**
 * 生成文章详情页的 BreadcrumbList JSON-LD 结构化数据。
 * Google 在 SERP 中会用这个数据展示"首页 → 标签 → 文章标题"路径，CTR 更高。
 */
export function generateArticleBreadcrumb(
    article: { id: string; title: string; tag?: string },
    siteUrl: string
) {
    const items: Array<{ '@type': 'ListItem'; position: number; name: string; item: string }> = [
        {
            '@type': 'ListItem',
            position: 1,
            name: '首页',
            item: siteUrl,
        },
    ];

    // 标签层（如果文章有标签则取第一个作为主分类）
    const firstTag = article.tag ? article.tag.split(/[,\s，]+/).filter(Boolean)[0] : '';
    if (firstTag) {
        items.push({
            '@type': 'ListItem',
            position: items.length + 1,
            name: firstTag,
            item: `${siteUrl}/tag?tag=${encodeURIComponent(firstTag)}`,
        });
    }

    items.push({
        '@type': 'ListItem',
        position: items.length + 1,
        name: article.title,
        item: `${siteUrl}/article-detail/${article.id}`,
    });

    return {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: items,
    };
}

/**
 * 生成 JSON 工具页面的 BreadcrumbList 结构化数据
 */
export function generateJsonToolBreadcrumb(siteUrl: string, locale: 'zh' | 'en' = 'zh') {
    const isZh = locale === 'zh';
    const home = `${siteUrl}${isZh ? '' : '/en'}`;
    const toolHome = `${siteUrl}${isZh ? '/tool/json' : '/en/tool/json'}`;
    return {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        'itemListElement': [
            {
                '@type': 'ListItem',
                'position': 1,
                'name': isZh ? '首页' : 'Home',
                'item': home
            },
            {
                '@type': 'ListItem',
                'position': 2,
                'name': isZh ? 'JSON 在线工具' : 'JSON Online Tool',
                'item': toolHome
            }
        ]
    };
}

