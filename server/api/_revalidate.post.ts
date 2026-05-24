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
 * 设计目标：
 *   - 后端（Go）在文章新增/更新/删除、或前端发版时调用本接口
 *   - Nuxt Nitro 把 ISR 渲染结果存在 useStorage('cache') 下，前缀 nitro:routes
 *   - 我们用 getKeys(prefix) + removeItem 批量清理，避免硬编码 Nitro 内部 key 编码规则
 *
 * 鉴权：
 *   - 通过 x-revalidate-secret 请求头携带共享密钥
 *   - 密钥从 runtimeConfig.revalidateSecret 读取（部署时由 NUXT_REVALIDATE_SECRET 注入）
 *   - 未配置密钥时直接 500，强制要求生产部署必须设置
 *
 * 入参：
 *   { "paths": ["/article-detail/123", "/", "/tag?tagName=Go"] }
 *   或
 *   { "all": true }                              // 清理所有 ISR 缓存（发版用）
 *
 * 出参：
 *   200 { revalidated: true, cleared: { "<path>": <key 数量> } }
 *   400 { error: "paths or all required" }
 *   401 { error: "unauthorized" }
 *   500 { error: "revalidate secret not configured" }
 */

interface RevalidateBody {
  paths?: string[];
  all?: boolean;
}

const ROUTE_CACHE_PREFIX = "nitro:routes";

/**
 * 把一个 URL path 转成 Nitro 的 cache key 前缀
 * Nitro 的 cache key 形如：nitro:routes:article-detail:123.json
 * 把开头的 / 去掉，再把剩余 / 替换成 :
 */
function pathToKeyPrefix(path: string): string {
  const trimmed = path.replace(/^\/+/, "").replace(/\/+$/, "");
  const normalized = trimmed.replace(/\//g, ":");
  return `${ROUTE_CACHE_PREFIX}:${normalized}`;
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
      const prefix = pathToKeyPrefix(path);
      const keys = await storage.getKeys(prefix);
      await Promise.all(keys.map((k: string) => storage.removeItem(k)));
      cleared[path] = keys.length;
    }
  }

  return { revalidated: true, cleared };
});
