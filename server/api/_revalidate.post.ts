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
 * Nitro 2.13 + unstorage fs driver 实测的 key 有两类形态：
 *   1) 文章页 HTML 缓存：
 *        nitro:routes:_:articledetail504.2c1G7yFDYW.json
 *      —— slug 后直接跟 `.` 哈希分隔符
 *   2) 文章页 payload 缓存（experimental.payloadExtraction 默认 true 时由 Nuxt 生成）：
 *        nitro:routes:_:articledetail504:_payloadjson.HASH.json
 *      —— slug 后是 `:_payload`，再后面才是哈希
 *
 * 关键观察：
 *   - 路径片段会被截断到 **16 个字母数字字符**，再加 10 字节的 base32 哈希
 *   - slug 前以 `:` 分隔（来自 nitro 内部 key），后以 `.` 或 `:` 分隔
 *   - getKeys() 返回的 key 直接带 `.json` 后缀（fs driver 不剥离扩展名）
 *
 * 之前只清形态 1 导致线上 bug：
 *   更新文章后，HTML 是新的（被清了重新渲染），但 payload.json 还是旧的，
 *   浏览器加载 HTML 后再 fetch _payload.json，旧 payload 反水覆盖客户端
 *   ref，最终目录、updateTime 等依赖 payload 的字段视觉上又变回旧值。
 *
 * 因此匹配策略改为返回**模式数组**，HTML 与 payload 一并清理：
 *   - `:slug.` 命中 HTML 缓存
 *   - `:slug:` 命中 payload（以及未来可能出现的其它子路径变体）
 *
 * 副作用提示：
 *   slug 截断到 16 字符后，"articledetail" 前缀就占了 13 位，留给 ID 的只有
 *   3 位。这意味着 ID 前 3 位相同的文章（如 504 vs 5041 vs 50499）会共用
 *   slug，被一起清。博客场景下影响极小（最多多一次回源），不会造成数据
 *   正确性问题。
 */
function pathToSlugMatchers(path: string): string[] {
  const trimmed = path.replace(/^\/+/, "").replace(/\/+$/, "");
  // 移除所有非字母数字字符（与 Nitro 内部 slug 化规则对齐）
  const slug = trimmed.replace(/[^a-zA-Z0-9]/g, "").slice(0, 16);
  if (!slug) return [];
  // 同时覆盖 HTML 缓存（slug.HASH）与 payload 缓存（slug:_payloadjson.HASH）
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
  const cleared: Record<string, number> = {};

  if (body.all) {
    const keys = await storage.getKeys(ROUTE_CACHE_PREFIX);
    await Promise.all(keys.map((k: string) => storage.removeItem(k)));
    cleared["*"] = keys.length;
  } else {
    // 一次性列出所有 route cache keys，避免在每个 path 循环里重复扫描
    const allKeys = await storage.getKeys(ROUTE_CACHE_PREFIX);

    for (const path of body.paths!) {
      if (typeof path !== "string" || !path.startsWith("/")) {
        cleared[String(path)] = 0;
        continue;
      }
      const slugs = pathToSlugMatchers(path);
      if (slugs.length === 0) {
        cleared[path] = 0;
        continue;
      }
      // 子串匹配：key 命中任一模式即视为该路径相关的缓存（HTML / payload 一起清）
      const matched = allKeys.filter((k: string) =>
        slugs.some((s) => k.includes(s))
      );
      await Promise.all(matched.map((k: string) => storage.removeItem(k)));
      cleared[path] = matched.length;
    }
  }

  return { revalidated: true, cleared };
});
