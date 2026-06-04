import { copyFileSync, mkdirSync, existsSync, readFileSync } from "fs";
import { resolve } from "path";

// ==================== 环境与运行时地址 ====================
// 生产构建（nuxt build / nuxt generate）时 NODE_ENV 会被自动置为 production
const isProd = process.env.NODE_ENV === "production";

// 线上地址：上线时使用，禁止与本地调试地址混用
const PROD_ENDPOINTS = {
  baseURL: "/api-backend",
  siteUrl: "https://liubing.xyz",
  ssrApiBase: "http://meta-api:8080",
};

// 本地地址：本机开发与调试使用
const LOCAL_ENDPOINTS = {
  baseURL: "/api-backend",
  siteUrl: "http://localhost:3000",
  ssrApiBase: "http://127.0.0.1:8080",
};

// 本地调试开关：仅在非生产环境下读取，确保线上构建产物不会暴露任何本地调试入口与地址
// 用法：
//   - 本地默认即为本地地址，无需任何环境变量
//   - 本地想接生产 API 调试时：LOCAL_DEBUG=false npm run dev
//   - 线上：该变量被强制忽略，始终走 PROD_ENDPOINTS
const useLocal = !isProd && process.env.LOCAL_DEBUG !== "false";
const endpoints = useLocal ? LOCAL_ENDPOINTS : PROD_ENDPOINTS;

/**
 * 站点构建时间（用于 sitemap 静态页的 lastmod）
 *
 * 取值优先级：
 *   1) process.env.BUILD_TIME：CI/CD 在构建时显式注入（推荐，例如发版时间戳）
 *   2) 兜底取当前时间：本地开发或未注入时使用
 *
 * 静态页（首页 / time-line / about-me / 工具页）极少修改，所以 lastmod 与发版时间
 * 绑定即可，比 autoLastmod 自动写当前时间更符合 "真正改了才更新" 的最佳实践，
 * 避免误导搜索引擎频繁回抓。
 */
const BUILD_TIME = process.env.BUILD_TIME || new Date().toISOString();

/**
 * 读取 ISR 主动失效接口的共享密钥
 *
 * 支持两种注入方式（按优先级）：
 *   1) NUXT_REVALIDATE_SECRET_FILE：指向密钥文件的绝对路径
 *      → 用于 docker-compose secrets 注入（生产推荐，与 secrets/ 命名一致）
 *      → 容器内通常是 /run/secrets/nuxt_revalidate_secret
 *   2) NUXT_REVALIDATE_SECRET：直接传值
 *      → 用于本地开发（.env 文件）或简单 docker 部署
 *
 * 两者都没设置时返回空字符串，运行期 server/api/_revalidate.post.ts 会主动 500，
 * 强制提醒部署时必须配置。
 */
function readRevalidateSecret(): string {
  const secretFile = process.env.NUXT_REVALIDATE_SECRET_FILE;
  if (secretFile && existsSync(secretFile)) {
    // trim 处理：手动 echo > file 时容易尾部带换行符，
    // 与后端发送的 header 不一致就会导致 401，所以这里统一去掉首尾空白
    return readFileSync(secretFile, "utf-8").trim();
  }
  return process.env.NUXT_REVALIDATE_SECRET || "";
}

export default defineNuxtConfig({
  // ==================== 核心配置 ====================
  devtools: { enabled: false },
  site: {
    url: "https://liubing.xyz",
  },
  app: {
    head: {
      // 基础元信息
      charset: "utf-8",
      htmlAttrs: { lang: "zh-Hans" },
      viewport:
        "width=device-width, initial-scale=1.0",
      title: "冰冰同学的技术博客 | C语言、Go语言、后端开发、网络安全",
      // SEO配置
      meta: [
        {
          name: "description",
          content:
            "专注于C语言和Go语言编程，主要涵盖计算机系统、数据库设计与优化、后端开发、网络安全和运维等领域。分享技术教程、实战项目经验以及最新的行业动态。",
        },
        {
          name: "keywords",
          content:
            "C语言编程,Go语言教程,后端开发实战,网络安全,数据库设计与优化,微服务,系统架构设计,运维",
        },
        { name: "robots", content: "index,follow,max-image-preview:large,max-snippet:-1" },
        // 百度站长平台验证（在 https://ziyuan.baidu.com 验证站点后填入对应 code）
        { name: "baidu-site-verification", content: "" },
        // Google Search Console 验证（在 https://search.google.com/search-console 验证站点后填入对应 code）
        { name: "google-site-verification", content: "" },
        // 360 / 神马 / 必应（如需要可填）
        { name: "360-site-verification", content: "" },
        { name: "msvalidate.01", content: "" },
        // 百度禁止转码，保持原样显示
        { "http-equiv": "Cache-Control", content: "no-transform" },
        { name: "applicable-device", content: "pc,mobile" },
        {
          name: "mobile-agent",
          content: "format=html5; url=https://www.liubing.xyz",
        },
        { name: "author", content: "冰冰同学" },
        { name: "location", content: "北京市" },
        { name: "original", content: "冰冰同学个人技术博客" },
        { property: "og:type", content: "website" },
        { property: "og:url", content: "https://www.liubing.xyz" },
        { property: "og:locale", content: "zh_CN" },
      ],
      // 资源链接
      link: [
        { rel: "icon", type: "image/x-icon", href: "/favicon.ico" },
        { rel: "canonical", href: "https://liubing.xyz" },
        {
          rel: "alternate",
          type: "application/rss+xml",
          href: "/rss.xml",
          title: "冰冰同学博客更新",
        },
        // DNS 预解析
        { rel: "dns-prefetch", href: "https://liubing.xyz" },
      ],
    },
  },

  // ==================== 运行时配置 ====================
  runtimeConfig: {
    public: {
      baseURL: endpoints.baseURL,
      siteUrl: endpoints.siteUrl,
    },
    ssrApiBase: endpoints.ssrApiBase,
    // ISR 主动失效接口的鉴权密钥
    // 部署时支持两种注入：
    //   - 推荐：NUXT_REVALIDATE_SECRET_FILE=/run/secrets/nuxt_revalidate_secret（docker-compose secrets）
    //   - 兼容：NUXT_REVALIDATE_SECRET=xxx（环境变量直传，本地或简单部署）
    // 后端（Go）调用 /api/_revalidate 时必须在 x-revalidate-secret 头里带相同值
    revalidateSecret: readRevalidateSecret(),
  },

  // ==================== 路由规则（ISR + 主动失效）====================
  // 设计：
  //   - 文章详情：缓存 7 天，依赖 Go 后端在文章变更时调用 /api/_revalidate 主动失效
  //   - 列表/工具页等保持默认 SSR（内容相对动态、变更频繁，靠主动失效成本高）
  //   - /api/_revalidate 自身不允许被搜索引擎索引
  routeRules: {
    "/article-detail/**": isProd
      ? {
          swr: 60 * 60 * 24 * 7,
          headers: {
            "Cache-Control":
              "public, s-maxage=86400, stale-while-revalidate=604800",
          },
        }
      : {
          // 本地开发关闭文章详情页路由缓存，避免调样式/渲染结构时持续命中旧 HTML。
          headers: {
            "Cache-Control": "no-store",
          },
        },
    "/api/_revalidate": {
      headers: {
        "Cache-Control": "no-store",
        "X-Robots-Tag": "noindex, nofollow",
      },
    },
  },

  // ==================== 样式配置 ====================
  css: [
    "~/assets/iconfont/iconfont.css",
    "~/assets/base.css",
    // 代码块高亮颜色由 Shiki 在 SSR 阶段直接 inline 到 token 上，
    // 不再依赖外部高亮 CSS 主题（之前 highlight.js 的 atom-one-dark.css 已移除）。
  ],

  // ==================== 模块配置 ====================
  modules: [
    "@pinia/nuxt",
    "@element-plus/nuxt",
    [
      "@nuxtjs/sitemap",
      {
        siteUrl: 'https://liubing.xyz',
        cacheMaxAgeSeconds: 6 * 60 * 60,
        // 关闭自动 lastmod：autoLastmod 会给所有未显式声明的 URL 写当前时间，
        // 导致静态页（首页/time-line/about-me）每次缓存重建都得到 "刚刚被修改"，
        // 这违反了 Google 对 sitemap 的最佳实践（"真正改了才更新 lastmod"），
        // 长期会被搜索引擎降低对 lastmod 字段的信任度。
        // 静态页改用 BUILD_TIME 与发版时间绑定；文章页 lastmod 来自后端 updateTime。
        autoLastmod: false,
        xsl: '/__sitemap__/style.xsl',
        // 自定义 XSL 调试视图的列：仅给开发者在浏览器直接访问 sitemap.xml 时看，
        // 不影响真实的 sitemap 协议输出。这里去掉默认的 "Images" 列
        // （我们没有给 URL 注入 image 元数据，全 0 没有阅读价值）。
        xslColumns: [
          { label: 'URL', width: '50%' },
          { label: 'Last Modified', width: '25%', select: 'sitemap:lastmod' },
          { label: 'Change Frequency', width: '12.5%', select: 'sitemap:changefreq' },
          { label: 'Priority', width: '12.5%', select: 'sitemap:priority' },
        ],
        // 动态数据源：
        //   - 文章详情 URL 由后端 /user/article/list 全量拉取后注入（articles.ts）
        //   - 标签 URL 由后端 /user/tag/list 全量拉取后注入（tags.ts）
        // 缓存失效逻辑见 server/api/_revalidate.post.ts
        sources: [
          '/api/__sitemap__/articles',
          '/api/__sitemap__/tags',
        ],
        // 从 sitemap 中排除掉以下"参数化路由"的裸路径：
        //   - /search-result 必须配 ?keyword=xxx 才有真实内容，没参数等同空页
        // 该路径页面侧也已经打了 noindex，sitemap + meta 双重排除。
        // 注：/tag 现已改为 /tag/<name> 动态路由，标签 URL 由 sources 中的 tags.ts 动态注入。
        exclude: [
          '/search-result',
        ],
        // 显式注册各路由的 priority / changefreq / lastmod。
        //
        // priority / changefreq 在 Google 已基本不参考，但百度/Bing/神马等国内引擎
        // 仍会读取，因此按 "首页 > 工具页 > 文章页 > 边缘页" 分层赋权：
        //   - 首页：信息聚合中心，权重最高，每天可能更新文章列表 → priority 1.0 / daily
        //   - 工具页：稳定的工具入口，但偶尔会迭代功能 → priority 0.9 / monthly
        //   - 文章页（在 articles.ts 里设置）：已发布老文章很少变 → priority 0.8 / monthly
        //   - 时间线 / 关于我：内容几乎不变 → priority 0.5 / yearly
        //
        // lastmod 全部使用 BUILD_TIME（与发版时间绑定），符合 "真正改了才更新" 原则。
        urls: [
          {
            loc: '/',
            lastmod: BUILD_TIME,
            changefreq: 'daily',
            priority: 1.0,
          },
          {
            loc: '/time-line',
            lastmod: BUILD_TIME,
            changefreq: 'yearly',
            priority: 0.5,
          },
          {
            loc: '/about-me',
            lastmod: BUILD_TIME,
            changefreq: 'yearly',
            priority: 0.5,
          },
          {
            loc: '/tool/json',
            lastmod: BUILD_TIME,
            changefreq: 'monthly',
            priority: 0.9,
            alternatives: [
              { hreflang: 'zh-CN', href: 'https://liubing.xyz/tool/json' },
              { hreflang: 'en-US', href: 'https://liubing.xyz/en/tool/json' },
              { hreflang: 'x-default', href: 'https://liubing.xyz/tool/json' },
            ],
          },
          {
            loc: '/en/tool/json',
            lastmod: BUILD_TIME,
            changefreq: 'monthly',
            priority: 0.9,
            alternatives: [
              { hreflang: 'zh-CN', href: 'https://liubing.xyz/tool/json' },
              { hreflang: 'en-US', href: 'https://liubing.xyz/en/tool/json' },
              { hreflang: 'x-default', href: 'https://liubing.xyz/tool/json' },
            ],
          },
        ],
        robots: [
          {
            UserAgent: "*",
            Allow: "/",
            Sitemap: 'https://liubing.xyz/sitemap.xml'
          },
        ],
      },
    ],
  ],

  // ==================== 构建配置 ====================
  build: {
    transpile: ["lodash-es"],
    analyze: { filename: "stats.html" },
  },

  hooks: {
    "nitro:build:public-assets": () => {
      const src = resolve(process.cwd(), "keys/public_key.pem");
      const destDir = resolve(process.cwd(), ".output/keys");
      if (!existsSync(destDir)) mkdirSync(destDir, { recursive: true });
      copyFileSync(src, resolve(destDir, "public_key.pem"));
    },
  },

  // ==================== Vite配置 ====================
  vite: {
    optimizeDeps: {
      // 预构建优化
      esbuildOptions: {
        target: "es2015",
      },
    },
    build: {
      cssCodeSplit: true,
      cssMinify: true,
      minify: "terser",
      // 优化代码分割
      rollupOptions: {
        // 抑制无害的第三方包警告：
        // - @iarna/toml/lib/toml-parser.js 内部用 eval('require("util").inspect")') 主动避免
        //   bundler 把 Node 的 util 模块拉进浏览器产物，浏览器侧落入 try/catch 静默失败，无功能影响。
        onwarn(warning, defaultHandler) {
          if (warning.code === 'EVAL' && warning.id?.includes('@iarna/toml')) {
            return;
          }
          defaultHandler(warning);
        },
      },
      terserOptions: {
        format: {
          comments: false,
        },
        compress: {
          drop_console: true,
          drop_debugger: true,
        },
      },
      // 提高 chunk 大小限制
      chunkSizeWarningLimit: 1000,
    },
  },

  // ==================== Webpack配置 ====================
  webpack: {
    optimization: {
      minimize: true,
      minimizer: [
        {
          terserOptions: {
            mangle: true,
            compress: {
              drop_console: true,
            },
            format: {
              comments: false,
            },
          },
        },
      ],
      splitChunks: {
        cacheGroups: {
          styles: {
            name: "styles",
            test: /\.(css|vue)$/,
            chunks: "all",
            enforce: true,
          },
        },
      },
    },
    plugins: [],
  },

  // ==================== TypeScript配置 ====================
  typescript: {
    shim: false,
    typeCheck: true,
  },

  // ==================== Nitro配置 ====================
  nitro: {
    prerender: {
      crawlLinks: false,
    },
    // 注册 server plugin：在 SSR 渲染完成后清理 <head> 内的 Vue fragment 锚点注释。
    // 见 server/plugins/strip-head-comments.ts 的实现与安全说明。
    plugins: ["~/server/plugins/strip-head-comments.ts"],
    ...(isProd
      ? {
          // ISR 缓存目录显式锚定，避免依赖 Nitro 默认行为（不同版本可能不一致）。
          // 生产部署时 docker volume 挂载到此路径即可实现重启不丢缓存：
          //   volumes:
          //     - ./portal-web/cache:/home/node/portal-web/cache
          storage: {
            cache: {
              driver: "fs",
              base: process.env.NITRO_CACHE_DIR || "./cache",
            },
          },
        }
      : {}),
  },

  // ==================== Vue配置 ====================
  vue: {
    compilerOptions: {
      comments: false,
    },
  },

  // ==================== 功能配置 ====================
  features: {
    // 保持 Nuxt 默认值 true：SSR 会把当前页面用到的 <style scoped> 内联进首屏 HTML 的 <style> 标签，
    // 避免 scoped 样式必须等 page chunk JS 下载并 import 才生效导致的 FOUC。
    //
    // 历史教训：之前这里被显式置为 false，文章详情页表现为：
    //   - 全局样式（.article-body-ssr 等）走 entry.css 同步加载，正文不闪
    //   - 标题/信息行（.c_titile / .box_c / .info-item）写在 <style scoped> 里，
    //     被拆成异步 CSS chunk，必须等 hydration 时 JS 动态 import 才注入
    //   - 用户看到 H1 从"浏览器默认大字号左对齐"突变到"居中大标题"，肉眼可见闪烁
    inlineStyles: true,
  },

  compatibilityDate: "2025-05-19",
});
