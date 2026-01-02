import { copyFileSync, mkdirSync, existsSync } from "fs";
import { resolve } from "path";

export default defineNuxtConfig({
  // ==================== 核心配置 ====================
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
        { name: "robots", content: "index,follow" },
        { name: "baidu-site-verification", content: "" },
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
      baseURL: '/api-backend',
      // baseURL: "http://127.0.0.1:8080",
      siteUrl: "https://liubing.xyz",
    },
    ssrApiBase: 'http://meta-api:8080'
    // ssrApiBase: "http://127.0.0.1:8080",
  },

  // ==================== 样式配置 ====================
  css: ["~/assets/iconfont/iconfont.css", "~/assets/base.css"],

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
        xsl: true,
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
        output: {
          manualChunks: {
            // 将 md-editor-v3 单独打包
            'md-editor': ['md-editor-v3'],
          },
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
