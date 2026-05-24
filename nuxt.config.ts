import { copyFileSync, mkdirSync, existsSync } from "fs";
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
  baseURL: "http://127.0.0.1:8080",
  siteUrl: "http://127.0.0.1:8080",
  ssrApiBase: "http://127.0.0.1:8080",
};

// 本地调试开关：仅在非生产环境下读取，确保线上构建产物不会暴露任何本地调试入口与地址
// 用法：
//   - 本地默认即为本地地址，无需任何环境变量
//   - 本地想接生产 API 调试时：LOCAL_DEBUG=false npm run dev
//   - 线上：该变量被强制忽略，始终走 PROD_ENDPOINTS
const useLocal = !isProd && process.env.LOCAL_DEBUG !== "false";
const endpoints = useLocal ? LOCAL_ENDPOINTS : PROD_ENDPOINTS;

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
        "width=device-width, initial-scale=1.0, maximum-scale=2.0, user-scalable=yes",
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
    // 部署时通过环境变量 NUXT_REVALIDATE_SECRET 注入
    // 后端（Go）调用 /api/_revalidate 时必须在 x-revalidate-secret 头里带相同值
    revalidateSecret: process.env.NUXT_REVALIDATE_SECRET || "",
  },

  // ==================== 路由规则（ISR + 主动失效）====================
  // 设计：
  //   - 文章详情：ISR 7 天，依赖 Go 后端在文章变更时调用 /api/_revalidate 主动失效
  //   - 列表/工具页等保持默认 SSR（内容相对动态、变更频繁，靠主动失效成本高）
  //   - /api/_revalidate 自身不允许被搜索引擎索引
  routeRules: {
    "/article-detail/**": {
      isr: 60 * 60 * 24 * 7,
      headers: {
        "Cache-Control":
          "public, s-maxage=86400, stale-while-revalidate=604800",
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
    // highlight.js 主题样式，本地引入避免 CDN 存储访问被浏览器追踪防护阻止
    "highlight.js/styles/atom-one-dark.css",
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
        autoLastmod: true,
        xsl: '/__sitemap__/style.xsl',
        // 显式注册工具页的双语 URL + hreflang 交叉引用，利于 Google 多语言收录
        urls: [
          {
            loc: '/tool/json',
            changefreq: 'weekly',
            priority: 0.9,
            alternatives: [
              { hreflang: 'zh-CN', href: 'https://liubing.xyz/tool/json' },
              { hreflang: 'en-US', href: 'https://liubing.xyz/en/tool/json' },
              { hreflang: 'x-default', href: 'https://liubing.xyz/tool/json' },
            ],
          },
          {
            loc: '/en/tool/json',
            changefreq: 'weekly',
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
    transpile: ["md-editor-v3", "lodash-es"],
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
        output: {
          manualChunks: {'md-editor': ['md-editor-v3']},
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
  },

  // ==================== Vue配置 ====================
  vue: {
    compilerOptions: {
      comments: false,
    },
  },

  // ==================== 功能配置 ====================
  features: {
    inlineStyles: false,
  },

  compatibilityDate: "2025-05-19",
});
