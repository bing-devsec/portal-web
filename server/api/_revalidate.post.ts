import {
  defineEventHandler,
  getHeader,
  readBody,
  createError,
  setResponseStatus,
  type H3Event,
} from "h3";

/**
 * ISR 主动失效接口
 *
 * 触发时机（后端调用方）：
 *   - 文章新增 / 更新 / 删除后，调用本接口让前端缓存失效
 *
 * 接口规范：
 *   Method:  POST
 *   URL:     /api/_revalidate
 *   Headers: Content-Type: application/json
 *            x-revalidate-secret: <NUXT_REVALIDATE_SECRET>
 *
 * 请求体（二选一，字段互斥）：
 *   1) 失效单篇或多篇文章：
 *        { "paths": ["/article-detail/<articleId>"] }
 *      - paths 是字符串数组，每一项必须是形如 /article-detail/<articleId> 的路径
 *      - articleId 即文章主键，全局唯一，无需附带任何其它字段
 *      - 不要传 query string、不要传额外字段
 *
 *   2) 清空所有缓存（仅前端发版时使用，后端业务不要传）：
 *        { "all": true }
 *
 * 响应：
 *   200 { "revalidated": true, "cleared": { "<path>": <被清理的 key 数量> } }
 *   400 { "error": "paths or all required" }   // body 缺失或 paths 为空
 *   401 { "error": "unauthorized" }            // secret 未传或不匹配
 *   500 { "error": "revalidate secret not configured" }  // 部署未配置 secret
 */

const ROUTE_CACHE_PREFIX = "nitro:routes";
// @nuxtjs/sitemap 通过 defineCachedFunction({ base: "sitemap" }) 把生成结果落到
// useStorage("sitemap") 里（key 形如 sitemap:xml:default-https-host.cache.json）。
// 文章 CRUD 必然改变 sitemap 的 URL 集合，所以在清理 /article-detail/* 时同步清空它。
const SITEMAP_STORAGE_BASE = "sitemap";

interface RevalidateBody {
  paths?: string[];
  all?: boolean;
}

/**
 * 把 URL path 转成"用于子串匹配的 slug 片段集合"
 *
 * 背景：之前尝试在 nuxt.config.ts 的 routeRules 里写 cache.getKey 自定义 key，
 * 但 routeRules 会被 Nuxt 序列化进运行时配置，函数无法 JSON 化，build 时被
 * 静默剥离（只留一行 "may not be able to be serialized" 警告）。所以缓存 key
 * 仍由 Nitro 默认 sluggify 算法决定。
 *
 */
function pathToSlugMatchers(path: string): string[] {
  const trimmed = path.replace(/^\/+/, "").replace(/\/+$/, "");
  // 移除所有非字母数字字符（与 Nitro 内部 slug 化规则对齐）
  const slug = trimmed.replace(/[^a-zA-Z0-9]/g, "").slice(0, 16);
  if (!slug) return [];
  return [`:${slug}.`, `:${slug}:`];
}

export default defineEventHandler(async (event: H3Event) => {
  const config = useRuntimeConfig(event);
  const expected = config.revalidateSecret as string;

  if (!expected) {
    setResponseStatus(event, 500);
    return { error: "revalidate secret not configured" };
  }

  const provided = getHeader(event, "x-revalidate-secret");
  if (!provided || provided !== expected) {
    throw createError({ statusCode: 401, statusMessage: "unauthorized" });
  }

  const body = await readBody<RevalidateBody>(event);
  if (!body || (!body.all && (!body.paths || body.paths.length === 0))) {
    throw createError({
      statusCode: 400,
      statusMessage: "paths or all required",
    });
  }

  const storage = useStorage("cache");
  const sitemapStorage = useStorage(SITEMAP_STORAGE_BASE);
  const cleared: Record<string, number> = {};

  /**
   * 清空 sitemap 模块的内部缓存。
   * 任意一篇文章变更（新增/更新/删除）都会改变 sitemap.xml 的 URL 集合，
   * 因此只要本次失效请求触达了 /article-detail/* 或 all=true，就把 sitemap 缓存一并清掉，
   * 让下一次爬虫请求重新调用 /api/__sitemap__/articles 拉取最新文章列表。
   */
  async function purgeSitemapCache(): Promise<number> {
    const sitemapKeys = await sitemapStorage.getKeys();
    if (sitemapKeys.length === 0) return 0;
    await Promise.all(
      sitemapKeys.map((k: string) => sitemapStorage.removeItem(k))
    );
    return sitemapKeys.length;
  }

  if (body.all) {
    const keys = await storage.getKeys(ROUTE_CACHE_PREFIX);
    await Promise.all(keys.map((k: string) => storage.removeItem(k)));
    cleared["*"] = keys.length;
    cleared["__sitemap__"] = await purgeSitemapCache();
  } else {
    // 一次性列出所有 route cache keys，避免在每个 path 循环里重复扫描
    const allKeys = await storage.getKeys(ROUTE_CACHE_PREFIX);
    let shouldPurgeSitemap = false;

    for (const path of body.paths!) {
      if (typeof path !== "string" || !path.startsWith("/")) {
        cleared[String(path)] = 0;
        continue;
      }
      // 只要命中了文章详情路径，就标记需要刷新 sitemap
      // （文章列表/标签等聚合页本身不进 sitemap，无需关心）
      if (path.startsWith("/article-detail/")) {
        shouldPurgeSitemap = true;
      }
      const slugs = pathToSlugMatchers(path);
      if (slugs.length === 0) {
        cleared[path] = 0;
        continue;
      }
      const matched = allKeys.filter((k: string) =>
        slugs.some((s) => k.includes(s))
      );
      await Promise.all(matched.map((k: string) => storage.removeItem(k)));
      cleared[path] = matched.length;
    }

    if (shouldPurgeSitemap) {
      cleared["__sitemap__"] = await purgeSitemapCache();
    }
  }

  return { revalidated: true, cleared };
});
