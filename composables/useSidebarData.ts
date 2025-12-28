import { computed, watch } from 'vue';
import { useApiData } from '~/utils/api';

// 热门文章接口
interface HotArticle {
	id: string;
	title: string;
	viewNum: number;
}

interface HotArticleResponse {
	rows: HotArticle[];
}

// 标签接口
interface Tag {
	name: string;
	articleNum: number;
}

interface TagResponse {
	rows: Tag[];
}

// 友情链接接口
interface BaseLink {
	id: string;
	name: string;
	url: string;
}

interface Link extends BaseLink {
	randomClass: string;
}

interface LinkResponse {
	rows: BaseLink[];
}

// localStorage 缓存键
const HOT_ARTICLES_CACHE_KEY = 'sidebar-hot-articles-cache';
const TAGS_CACHE_KEY = 'sidebar-tags-cache';
const FRIEND_LINKS_CACHE_KEY = 'sidebar-friend-links-cache';

// 缓存过期时间（24小时）
const CACHE_EXPIRY = 24 * 60 * 60 * 1000;

// localStorage 工具函数
const getCache = <T>(key: string): T | null => {
	if (import.meta.client) {
		try {
			const cached = localStorage.getItem(key);
			if (cached) {
				const parsed = JSON.parse(cached);
				const now = Date.now();
				if (now - parsed.timestamp < CACHE_EXPIRY) {
					return parsed.data;
				} else {
					localStorage.removeItem(key);
				}
			}
		} catch (e) {
			localStorage.removeItem(key);
		}
	}
	return null;
};

const setCache = <T>(key: string, data: T): void => {
	if (import.meta.client) {
		try {
			localStorage.setItem(key, JSON.stringify({
				data,
				timestamp: Date.now()
			}));
		} catch (e) {
			// localStorage 满了或出错，忽略
		}
	}
};

/**
 * 统一的侧边栏数据 composable
 * 使用 localStorage 实现缓存，强制刷新时重新请求，页面跳转时使用缓存
 */
export function useSidebarData() {
	// 使用统一的缓存 key，确保所有页面共享数据
	const HOT_ARTICLES_KEY = 'sidebar-hot-articles-api';
	const TAGS_KEY = 'sidebar-tags-api';
	const FRIEND_LINKS_KEY = 'sidebar-friend-links-api';

	// 获取热门文章列表
	const { data: hotArticleData } = useApiData<HotArticleResponse>('/user/article/hot', {
		key: HOT_ARTICLES_KEY,
		server: true, // SSR阶段也请求数据，用于SEO
		lazy: true, // 延迟加载
		getCachedData: (key: string) => {
			// 只在客户端检查缓存，在SSR阶段总是请求最新数据
			if (import.meta.client) {
				const cached = getCache<HotArticle[]>(HOT_ARTICLES_CACHE_KEY);
				if (cached && cached.length > 0) {
					return Promise.resolve({
						code: 2000,
						message: '',
						data: { rows: cached }
					} as any);
				}
			}
			return undefined; // SSR阶段或没有缓存时，需要请求
		}
	});

	// 获取标签列表
	const { data: tagData } = useApiData<TagResponse>('/user/tag/list', {
		key: TAGS_KEY,
		server: true, // SSR阶段也请求数据，用于SEO
		lazy: true,
		getCachedData: (key: string) => {
			if (import.meta.client) {
				const cached = getCache<Tag[]>(TAGS_CACHE_KEY);
				if (cached && cached.length > 0) {
					return Promise.resolve({
						code: 2000,
						message: '',
						data: { rows: cached }
					} as any);
				}
			}
			return undefined;
		}
	});

	// 获取友情链接列表
	const { data: linkData } = useApiData<LinkResponse>('/user/link', {
		key: FRIEND_LINKS_KEY,
		server: true, // SSR阶段也请求数据，用于SEO
		lazy: true,
		getCachedData: (key: string) => {
			if (import.meta.client) {
				const cached = getCache<BaseLink[]>(FRIEND_LINKS_CACHE_KEY);
				if (cached && cached.length > 0) {
					return Promise.resolve({
						code: 2000,
						message: '',
						data: { rows: cached }
					} as any);
				}
			}
			return undefined;
		}
	});

	// 基于ID生成稳定的随机类名
	const getRandomClass = (id: string) => {
		const hash = id.split('').reduce((acc, char) => {
			return ((acc << 5) - acc) + char.charCodeAt(0) | 0;
		}, 0);
		return Math.abs(hash % 9).toString();
	};

	// 监听 API 数据变化，更新缓存
	watch(hotArticleData, (newData) => {
		if (newData?.rows && newData.rows.length > 0) {
			setCache(HOT_ARTICLES_CACHE_KEY, newData.rows);
		}
	}, { immediate: true });

	watch(tagData, (newData) => {
		if (newData?.rows && newData.rows.length > 0) {
			setCache(TAGS_CACHE_KEY, newData.rows);
		}
	}, { immediate: true });

	watch(linkData, (newData) => {
		if (newData?.rows && newData.rows.length > 0) {
			setCache(FRIEND_LINKS_CACHE_KEY, newData.rows);
		}
	}, { immediate: true });

	// 计算属性：优先使用 API 数据，如果没有则使用缓存
	const hotArticles = computed(() => {
		return hotArticleData.value?.rows || getCache<HotArticle[]>(HOT_ARTICLES_CACHE_KEY) || [];
	});

	const tags = computed(() => {
		return tagData.value?.rows || getCache<Tag[]>(TAGS_CACHE_KEY) || [];
	});

	const friendLinks = computed<Link[]>(() => {
		// 优先使用 API 数据
		if (linkData.value?.rows) {
			return linkData.value.rows
				.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN', { sensitivity: 'variant' }))
				.map(link => ({
					...link,
					randomClass: getRandomClass(link.id)
				}));
		}

		// 如果没有 API 数据，使用缓存
		const cached = getCache<BaseLink[]>(FRIEND_LINKS_CACHE_KEY);
		if (cached) {
			return cached
				.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN', { sensitivity: 'variant' }))
				.map(link => ({
					...link,
					randomClass: getRandomClass(link.id)
				}));
		}

		return [];
	});

	return {
		hotArticles,
		tags,
		friendLinks,
	};
}

