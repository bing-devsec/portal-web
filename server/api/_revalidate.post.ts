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

interface RevalidateBody {
  paths?: string[];
  all?: boolean;
}

const ROUTE_CACHE_PREFIX = "nitro:routes";

/**
 * 把 URL path 转成需要清理的 cache key 列表
 *
 * 当前只有 /article-detail/<id> 启用了 cache，且 key 由 nuxt.config.ts 中的
 * getKey 显式指定为 <id> 与 <id>_payload 两个，必须一并清理：
 *   - 只清 HTML 不清 payload，会出现"页面看着是新的、客户端 hydrate 后 payload
 *     反水覆盖"的诡异闪回。
 */
function pathToCacheKeys(path: string): string[] {
  const m = path.match(/^\/article-detail\/([^/?#]+)/);
  if (!m) return [];
  const id = m[1];
  return [`${ROUTE_CACHE_PREFIX}:${id}`, `${ROUTE_CACHE_PREFIX}:${id}_payload`];
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
    for (const path of body.paths!) {
      if (typeof path !== "string" || !path.startsWith("/")) {
        cleared[String(path)] = 0;
        continue;
      }
      const targets = pathToCacheKeys(path);
      if (targets.length === 0) {
        cleared[path] = 0;
        continue;
      }
      // 精确删除（HTML + payload 两个 key），不存在的 key removeItem 也是 no-op。
      // hasItem 判断一下只为了准确统计 cleared 数量，便于排查。
      let count = 0;
      await Promise.all(
        targets.map(async (k) => {
          if (await storage.hasItem(k)) count++;
          await storage.removeItem(k);
        })
      );
      cleared[path] = count;
    }
  }

  return { revalidated: true, cleared };
});
