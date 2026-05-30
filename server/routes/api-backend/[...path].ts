import { defineEventHandler, proxyRequest, getRouterParam } from "h3";

/**
 * 同源代理：把浏览器请求 /api-backend/** 透传给 Go 后端。
 *
 * 设计目的（解决本地开发跨域问题）：
 *   - Go 后端已不再下发 CORS 头，浏览器直连 http://127.0.0.1:8080 会被卡 CORS。
 *   - 通过本路由让浏览器始终走 dev/prod 一致的同源路径 `/api-backend/...`，
 *     由 Node 进程内的 fetch 转发，不受同源策略限制。
 *
 * 与 nginx `location /api-backend/ proxy_pass` 行为对齐：
 *   - 路径重写：去掉 `/api-backend` 前缀
 *   - 透传请求/响应头：proxyRequest 默认会原样转发 request headers，
 *     也会把后端的 response headers 透传回浏览器，行为与线上一致
 *
 * 兼容线上：
 *   - 生产环境前置的 nginx 已把 `/api-backend/` 转给后端容器（不会进 Nuxt），
 *     所以本路由生产不会被命中；纯粹为本地 dev / 自托管单容器场景兜底。
 *
 * 备注：之所以放在 server/routes 而不是 server/api，是因为 Nuxt 把 server/api
 * 自动前缀为 `/api/...`，与我们想要的 `/api-backend/...` 不匹配。server/routes
 * 是"原始路径"目录，能精确控制 URL 段。
 */
export default defineEventHandler(async (event) => {
	const config = useRuntimeConfig();
	const target = config.ssrApiBase as string;

	const path = getRouterParam(event, "path") || "";
	const url = event.node.req.url || "";
	// 保留原始 query string —— getRouterParam 只给到 path 段，丢失了 ?xxx
	const qs = url.includes("?") ? url.slice(url.indexOf("?")) : "";

	const targetUrl = `${target.replace(/\/+$/, "")}/${path}${qs}`;
	return proxyRequest(event, targetUrl);
});
