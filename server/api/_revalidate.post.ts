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
 *   - Nuxt Nitro 把 swr 渲染结果存在 useStorage('cache') 下，前缀 nitro:routes
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
 *
 * Nitro cache key 算法说明：
 *   实测 Nitro 2.13 的 swr key 形如 "nitro:routes:_:articledetail457:sF3Pma8D95"
 *   - 路径中的 / 被替换成 :
 *   - 路径段会做长度截断（约前 16~20 个字符）
 *   - 末尾带原始 URL 的短哈希避免冲突
 *   - 落盘文件名进一步把 : 替换成 / 形成目录树（fs driver 行为）
 *
 *   这意味着不能用"精确路径"匹配。我们改用：
 *     1) 把路径标准化（去掉 / 等特殊字符），生成"slug 关键字"
 *     2) 列出全部 nitro:routes 下的 keys
 *     3) 关键字命中（contains）的 key 全部清理
 *
 *   这种"按子串筛选"的方式有少量副作用（不同文章 ID 前缀相同会被一起清），
 *   但对博客场景影响微乎其微：清错最多导致下次访问回源一次，不会造成数据错误。
 */

interface RevalidateBody {
  paths?: string[];
  all?: boolean;
}

const ROUTE_CACHE_PREFIX = "nitro:routes";

/**
 * 把 URL path 转成"用于子串匹配的 slug 片段集合"
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
 *   如果两篇文章 ID 前几位相同（slug 截断后相同），它们会被一起清。
 *   这是 Nitro key 算法的固有限制；博客场景下影响极小（最多多一次回源），
 *   不会造成数据正确性问题。
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
