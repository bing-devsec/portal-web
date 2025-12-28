import { computed } from 'vue';
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

// （已移除缓存实现，侧边栏数据不再使用 localStorage 缓存）

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
		lazy: true // 延迟加载
	});

	// 获取标签列表
	const { data: tagData } = useApiData<TagResponse>('/user/tag/list', {
		key: TAGS_KEY,
		server: true, // SSR阶段也请求数据，用于SEO
		lazy: true
	});

	// 获取友情链接列表
	const { data: linkData } = useApiData<LinkResponse>('/user/link', {
		key: FRIEND_LINKS_KEY,
		server: true, // SSR阶段也请求数据，用于SEO
		lazy: true
	});

	// 基于ID生成稳定的随机类名
	const getRandomClass = (id: string) => {
		const hash = id.split('').reduce((acc, char) => {
			return ((acc << 5) - acc) + char.charCodeAt(0) | 0;
		}, 0);
		return Math.abs(hash % 9).toString();
	};

	// 不再缓存侧边栏数据，所有数据直接走后端请求并使用 API 返回的结果

	// 计算属性：优先使用 API 数据，如果没有则使用缓存
	const hotArticles = computed(() => hotArticleData.value?.rows || []);

	const tags = computed(() => tagData.value?.rows || []);

	const friendLinks = computed<Link[]>(() => {
		if (linkData.value?.rows) {
			return linkData.value.rows
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

