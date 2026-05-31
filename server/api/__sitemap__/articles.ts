import { defineEventHandler, type H3Event } from "h3";
import type { SitemapUrlInput } from "@nuxtjs/sitemap";

/**
 * sitemap 文章 URL 数据源
 *
 * 设计要点：
 *   - 由 @nuxtjs/sitemap 在生成 sitemap.xml 时通过 `sources` 主动调用本接口。
 *   - 后端 `/user/article/list` 强制分页，pageSize 上限 10，因此这里通过 total
 *     计算总页数后并发拉取剩余页（首页用于探测 total，其余页并发，避免串行 N 次 RTT）。
 *   - 该接口走 ssrApiBase 直连 Go 后端（与 article-detail 页面保持一致），不经过 nginx。
 *   - sitemap 模块自身的 `cacheMaxAgeSeconds` 已经为 sitemap.xml 输出做了整体缓存，
 *     所以本接口不再单独加缓存层；缓存失效逻辑统一走 /api/_revalidate。
 *   - 对外不暴露：路径放在 /api/__sitemap__/ 下，Disallow 已由 robots.txt 的 /api/ 覆盖。
 *
 * 关于 defineSitemapEventHandler：
 *   sitemap 模块导出的 defineSitemapEventHandler 仅是 defineEventHandler 的别名（见
 *   node_modules/@nuxtjs/sitemap/dist/runtime/server/composables/defineSitemapEventHandler.js）。
 *   引入路径 "#imports" 是 Nuxt 运行时虚拟模块，vue-tsc 在 server/ 下找不到声明，
 *   因此这里直接使用 h3 的 defineEventHandler，与项目其它 server/api 文件保持一致。
 */

interface ArticleListItem {
  id: string;
  title: string;
  updateTime?: string;
  createTime?: string;
}

interface ArticleListResp {
  code: number;
  message: string;
  data: {
    rows: ArticleListItem[];
    total: number;
  };
}

const PAGE_SIZE = 10; // 后端硬上限

export default defineEventHandler(async (event: H3Event) => {
  const config = useRuntimeConfig(event);
  const ssrBaseURL = config.ssrApiBase as string;

  // 1) 拉首页：拿到 total + 第一页 rows
  const first = await $fetch<ArticleListResp>(
    `${ssrBaseURL}/user/article/list`,
    {
      method: "GET",
      query: { page: 1, pageSize: PAGE_SIZE },
    }
  ).catch(() => null);

  if (!first || first.code !== 2000 || !first.data) {
    // 静默降级：拿不到列表时返回空数组，sitemap 仍然能正常生成（只是没有文章页）
    return [] as SitemapUrlInput[];
  }

  const total = first.data.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // 2) 并发拉剩余页（page 2..N）
  const restPages = Array.from({ length: totalPages - 1 }, (_, i) => i + 2);
  const restResults = await Promise.all(
    restPages.map((page) =>
      $fetch<ArticleListResp>(`${ssrBaseURL}/user/article/list`, {
        method: "GET",
        query: { page, pageSize: PAGE_SIZE },
      }).catch(() => null)
    )
  );

  const rows: ArticleListItem[] = [
    ...first.data.rows,
    ...restResults.flatMap((r) =>
      r && r.code === 2000 && r.data ? r.data.rows : []
    ),
  ];

  // 3) 转换为 sitemap 模块约定的对象格式
  //    - loc 用相对路径，模块会自动拼接 site.url（https://liubing.xyz）
  //    - lastmod 优先 updateTime，缺失时回退 createTime
  //      （nuxt.config.ts 已关闭 autoLastmod，所以两者都缺失时该字段干脆不输出，
  //       符合 "真正改了才更新 lastmod" 的最佳实践）
  //    - changefreq: monthly —— 已发布的老文章很少再变，weekly 会让爬虫无谓回抓浪费配额
  //    - priority: 0.8       —— 文章是站点核心内容，仅次于首页(1.0)和工具页(0.9)
  return rows.map<SitemapUrlInput>((a) => ({
    loc: `/article-detail/${a.id}`,
    lastmod: a.updateTime || a.createTime,
    changefreq: "monthly",
    priority: 0.8,
  }));
});
