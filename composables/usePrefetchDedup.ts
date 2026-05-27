/**
 * 文章 _payload.json 预取去重
 *
 * 背景：
 *   首页同时渲染 ArticleCard（主列表）和 HotListCard（侧边栏热门），
 *   两边都用 NuxtLink 指向 /article-detail/<id>。当某篇文章既在主列表
 *   又在热门里时，两个 NuxtLink 会各自触发 preloadPayload，DevTools 中
 *   就能看到同一条 _payload.json 被请求两次。
 *
 * 解法：
 *   按 id + 调用方 ns（'main' / 'hot' / ...）发放预取名额。
 *   - 第一个申请该 id 的 ns 拿到名额，后续渲染期间该 ns 永远返回 true
 *   - 其它 ns 永远返回 false
 *
 * 为什么用 Map 记录"谁拥有名额"，而不是简单地"先来后到，第一次返回 true，
 * 之后都返回 false"？
 *   NuxtLink 的 prefetch 触发依赖 IntersectionObserver，是异步的。如果
 *   主列表组件第一次调用拿到 true，重渲染时第二次调用却拿到 false，
 *   就可能导致它的 :prefetch 在 IO 真正回调前就被翻成 false，预取被
 *   错误地取消。绑定到 ns 后，同一个调用方在整个生命周期里答案稳定。
 *
 * 状态挂在 useNuxtApp() 上而不是模块顶层 —— SSR 阶段模块顶层是全进程
 * 共享的，会把"上一个用户已经预取过 X"错误地传染给下一个用户。
 */
export function shouldPrefetchArticle(id: string, ns: string): boolean {
	const nuxtApp = useNuxtApp() as unknown as {
		_prefetchSlots?: Map<string, string>;
	};
	if (!nuxtApp._prefetchSlots) {
		nuxtApp._prefetchSlots = new Map();
	}
	const slots = nuxtApp._prefetchSlots;
	const owner = slots.get(id);
	if (owner === undefined) {
		slots.set(id, ns);
		return true;
	}
	return owner === ns;
}
