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

