import { defineEventHandler, type H3Event } from "h3";
import type { SitemapUrlInput } from "@nuxtjs/sitemap";

/**
 * sitemap 标签 URL 数据源
 *
 * 设计要点：
 *   - 后端 `/user/tag/list` 返回所有标签及其文章数（不分页，一次返回）。
 *   - 每个标签生成 path 形态 URL：/tag/<encodedTagName>，与 pages/tag/[name].vue 路由对齐。
 *   - 没有文章的标签（articleNum === 0）会被过滤掉，避免薄内容进入 sitemap。
 *   - 与 articles.ts 一样不单独加缓存层，由 sitemap 模块整体 cacheMaxAgeSeconds 控制。
 *   - 缓存失效统一走 /api/_revalidate（标签变更也会清空 sitemap 缓存）。
 */

interface TagItem {
  name: string;
  articleNum: number;
}

interface TagListResp {
  code: number;
  message: string;
  data: {
    rows: TagItem[];
  };
}

export default defineEventHandler(async (event: H3Event) => {
  const config = useRuntimeConfig(event);
  const ssrBaseURL = config.ssrApiBase as string;

  const resp = await $fetch<TagListResp>(`${ssrBaseURL}/user/tag/list`, {
    method: "GET",
  }).catch(() => null);

  if (!resp || resp.code !== 2000 || !resp.data) {
    return [] as SitemapUrlInput[];
  }

  return resp.data.rows
    // 过滤无文章的"空标签"，避免给搜索引擎喂薄内容
    .filter((t) => t.name && (t.articleNum ?? 0) > 0)
    .map<SitemapUrlInput>((t) => ({
      loc: `/tag/${encodeURIComponent(t.name)}`,
      // 标签页内容随文章增删而变化，但变化频率低于文章本身，按 weekly 即可
      changefreq: "weekly",
      // 标签是聚合页，权重略低于单篇文章（0.8）和工具页（0.9），高于关于我（0.5）
      priority: 0.6,
    }));
});
