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

/**
 * 统一的侧边栏数据 composable
 * 使用 useState 实现跨页面数据共享，避免路由导航时缓存被清理
 */
export function useSidebarData() {
	// 使用 useState 创建全局状态，这些状态在页面导航时会保留
	const hotArticlesState = useState<HotArticle[]>('sidebar-hot-articles', () => []);
	const tagsState = useState<Tag[]>('sidebar-tags', () => []);
	const friendLinksState = useState<Link[]>('sidebar-friend-links', () => []);

	// 使用统一的缓存 key，确保所有页面共享数据
	const HOT_ARTICLES_KEY = 'sidebar-hot-articles-api';
	const TAGS_KEY = 'sidebar-tags-api';
	const FRIEND_LINKS_KEY = 'sidebar-friend-links-api';

	// 只在全局状态为空时才请求 API（使用 getCachedData 检查缓存）
	// 获取热门文章列表（只在客户端请求，避免 SSR 重复请求）
	const { data: hotArticleData } = useApiData<HotArticleResponse>('/user/article/hot', {
		key: HOT_ARTICLES_KEY,
		server: false, // 只在客户端请求
		lazy: true, // 延迟加载
		getCachedData: (key: string) => {
			// 如果全局状态已有数据，返回缓存数据，避免重新请求
			if (hotArticlesState.value.length > 0) {
				return Promise.resolve({
					code: 2000,
					message: '',
					data: { rows: hotArticlesState.value }
				} as any);
			}
			return undefined; // 返回 undefined 表示没有缓存，需要请求
		}
	});

	// 获取标签列表
	const { data: tagData } = useApiData<TagResponse>('/user/tag/list', {
		key: TAGS_KEY,
		server: false,
		lazy: true,
		getCachedData: (key: string) => {
			if (tagsState.value.length > 0) {
				return Promise.resolve({
					code: 2000,
					message: '',
					data: { rows: tagsState.value }
				} as any);
			}
			return undefined;
		}
	});

	// 获取友情链接列表
	const { data: linkData } = useApiData<LinkResponse>('/user/link', {
		key: FRIEND_LINKS_KEY,
		server: false,
		lazy: true,
		getCachedData: (key: string) => {
			if (friendLinksState.value.length > 0) {
				// 需要将 Link 转换回 BaseLink
				return Promise.resolve({
					code: 2000,
					message: '',
					data: { rows: friendLinksState.value.map(l => ({ id: l.id, name: l.name, url: l.url })) }
				} as any);
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

	// 监听 API 数据变化，更新全局状态（只在状态为空时更新，避免覆盖已有数据）
	watch(hotArticleData, (newData) => {
		if (newData?.rows && newData.rows.length > 0 && hotArticlesState.value.length === 0) {
			hotArticlesState.value = newData.rows;
		}
	}, { immediate: true });

	watch(tagData, (newData) => {
		if (newData?.rows && newData.rows.length > 0 && tagsState.value.length === 0) {
			tagsState.value = newData.rows;
		}
	}, { immediate: true });

	watch(linkData, (newData) => {
		if (newData?.rows && newData.rows.length > 0 && friendLinksState.value.length === 0) {
			// 处理友情链接，添加随机类名
			friendLinksState.value = newData.rows
				.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN', { sensitivity: 'variant' }))
				.map(link => ({
					...link,
					randomClass: getRandomClass(link.id)
				}));
		}
	}, { immediate: true });

	// 优先使用全局状态（跨页面共享），如果为空则使用 API 数据
	const hotArticles = computed(() => {
		return hotArticlesState.value.length > 0 
			? hotArticlesState.value 
			: (hotArticleData.value?.rows || []);
	});

	const tags = computed(() => {
		return tagsState.value.length > 0 
			? tagsState.value 
			: (tagData.value?.rows || []);
	});

	const friendLinks = computed<Link[]>(() => {
		if (friendLinksState.value.length > 0) {
			return friendLinksState.value;
		}
		if (!linkData.value?.rows) return [];
		return linkData.value.rows
			.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN', { sensitivity: 'variant' }))
			.map(link => ({
				...link,
				randomClass: getRandomClass(link.id)
			}));
	});

	return {
		hotArticles,
		tags,
		friendLinks,
	};
}

