import { useRuntimeConfig } from 'nuxt/app';
import { ElNotification } from 'element-plus';

// 添加防抖函数
const pendingRequests = new Map();

// 响应码枚举
export enum ResponseCode {
	Success = 2000, // 成功

	BadRequest = 4000, // 参数错误（参数校验失败）
	Unauthorized = 4010, // 未授权（缺少Token）
	AuthFailed = 4011, // 认证失败（错误的token）
	TokenExpired = 4012, // Token过期
	RequestTimeout = 4020, // 请求超时
	Forbidden = 4030, // 禁止访问（请求IP被封禁、限流等原因）
	NotFound = 4040, // 资源不存在

	InternalServerError = 5000 // 内部错误
}

// 通用响应接口
export interface ApiResponse<T = any> {
	code: number;
	message: string;
	data: T;
}

// showErrorNotification 业务错误弹窗封装
export const showErrorNotification = (message: string) => {
	if (import.meta.client) {
		ElNotification({
			title: '错误',
			message: message,
			type: 'error',
		});
	}
};

// showExceptionNotification 网络异常弹窗封装
export const showExceptionNotification = (err: string) => {
	if (import.meta.client) {
		ElNotification({
			title: '失败',
			message: err,
			type: 'error',
		});
	}
};

// 创建全局请求拦截器 - 确保所有API请求添加指纹头
export default defineNuxtPlugin((nuxtApp) => {
	// 拦截所有客户端请求
	nuxtApp.hook('app:mounted', () => {
		if (import.meta.client) {
			// 确保指纹已计算
			if (typeof nuxtApp.$recalculateFingerprint === 'function') {
				nuxtApp.$recalculateFingerprint().catch((e: Error) => {
					throw e;
				});
			}
		}
	});
});

// 使用 useAsyncData 的自定义 API 请求函数
export function useApiData<T>(url: string, options: any = {}) {
	const config = useRuntimeConfig();
	const nuxtApp = useNuxtApp();
	const router = useRouter();

	// 提取选项
	const { params: initialParams, key, debounceTime = 300, ...restOptions } = options;

	// 存储当前参数
	const currentParams = ref(initialParams);
	// 强制所有请求都使用include模式，确保cookie能够被发送
	const credentials = 'include';

	// 生成缓存键
	const cacheKey = typeof key === 'function' ? key() :
		isRef(key) ? key.value :
			key || url;

	// 添加请求状态标志
	const isLoading = ref(false);
	const isError = ref(false);
	const errorMessage = ref('');
	const responseCode = ref<number | null>(null);

	// 客户端挂载标志
	const isMounted = ref(false);

	// 在客户端挂载后设置标志
	if (import.meta.client) {
		onMounted(() => {
			isMounted.value = true;
		});
	}

	const { data, error, refresh: originalRefresh } = useAsyncData<ApiResponse<T>>(
		cacheKey,
		async () => {
			// 重置错误状态
			isError.value = false;
			errorMessage.value = '';
			responseCode.value = null;

			// 处理params选项
			let queryParams = currentParams.value;
			if (isRef(queryParams)) {
				queryParams = queryParams.value;
			} else if (typeof queryParams === 'function') {
				queryParams = queryParams();
			}

			// 生成请求唯一标识
			const requestId = `${url}?${JSON.stringify(queryParams)}`;

			// 如果相同请求正在进行中，取消之前的请求
			if (pendingRequests.has(requestId)) {
				return pendingRequests.get(requestId);
			}

			isLoading.value = true;

			try {
				// 构建请求头
				const headers: Record<string, string> = {
					'Content-Type': 'application/json',
					...(options.headers || {}),
				};

				// 添加cookie（服务器端）
				if (import.meta.server && nuxtApp.ssrContext?.event.node.req.headers.cookie) {
					headers.cookie = nuxtApp.ssrContext.event.node.req.headers.cookie;
				}

				// 获取指纹
				if (import.meta.client && url.includes('/user/')) {
					if (typeof nuxtApp.$fingerprint === 'function') {
						try {
							// 确保等待Promise执行完成
							const fingerprint = await nuxtApp.$fingerprint();
							if (fingerprint) {
								headers['x-client-id'] = fingerprint;
							}
						} catch (e) {
							throw e;
						}
					}
				}

				// 创建请求Promise
				const requestPromise = $fetch<ApiResponse<T>>(url, {
					baseURL: import.meta.server ? config.ssrApiBase : config.public.baseURL,
					credentials,
					headers,
					params: queryParams,
					withCredentials: true,
					...restOptions,
				});

				// 存储请求Promise
				pendingRequests.set(requestId, requestPromise);

				// 等待请求完成
				const response = await requestPromise;

				// 请求完成后从Map中移除
				setTimeout(() => {
					pendingRequests.delete(requestId);
				}, debounceTime);

				return response;
			} catch (error) {
				return {
					code: ResponseCode.InternalServerError,
					message: error instanceof Error ? error.message : '请求失败',
					data: null as unknown as T
				};
			} finally {
				isLoading.value = false;
			}
		},
		{
			// 提供默认数据，确保服务器端和客户端使用相同的初始数据结构
			default: () => ({
				code: ResponseCode.Success,
				message: '',
				data: null as unknown as T
			}),
			// 如果设置了server: false，则禁用服务器端请求
			server: options.server !== false,
			// 支持 lazy 选项
			lazy: options.lazy ?? false,
			// 支持 getCachedData 来保留缓存（用于跨页面共享数据）
			getCachedData: options.getCachedData
		}
	);

	// 自定义刷新函数，支持更新参数
	const refresh = async (newOptions?: any) => {
		if (newOptions && newOptions.params) {
			currentParams.value = newOptions.params;
		}
		// 重置状态
		isError.value = false;
		errorMessage.value = '';
		responseCode.value = null;

		return originalRefresh();
	};

	// 统一错误处理 - 仅在客户端挂载后执行
	watch([error, data], ([newError, newData]) => {
		// 只在客户端挂载后处理错误
		if (import.meta.client && isMounted.value) {
			if (newError) {
				isError.value = true;
				errorMessage.value = newError.message;
				showExceptionNotification(newError.message);
			} else if (newData) {
				// 保存响应码
				responseCode.value = newData.code;

				// 处理业务错误码
				if (newData.code !== ResponseCode.Success) {
					isError.value = true;
					errorMessage.value = newData.message;

					// 显示错误消息（如果有）
					if (newData.message) {
						showErrorNotification(newData.message);
					}

					// 处理特定错误码
					if (newData.code === ResponseCode.NotFound) {
						// 使用setTimeout避免在SSR期间或水合过程中跳转
						setTimeout(() => {
							router.push('/404');
						}, 0);
					}
				}
			}
		}
	});

	// 返回处理后的数据和更多状态信息
	return {
		data: computed(() => data.value?.code === ResponseCode.Success ? data.value.data : null),
		rawData: data,
		error,
		isLoading,
		isError,
		errorMessage,
		responseCode,
		refresh,
		// 添加响应码判断辅助函数
		isSuccess: computed(() => data.value?.code === ResponseCode.Success),
		isNotFound: computed(() => responseCode.value === ResponseCode.NotFound),
		isUnauthorized: computed(() => {
			const code = responseCode.value;
			return code === ResponseCode.Unauthorized ||
				code === ResponseCode.AuthFailed ||
				code === ResponseCode.TokenExpired;
		})
	};
}

// ===========================
// 全局消息提示工具
// ===========================
import { ElMessage } from 'element-plus';

const MESSAGE_CUSTOM_CLASS = "json-tool-message";
type MessageType = "success" | "error" | "warning" | "info";

// 获取消息偏移量
const getGlobalMessageOffset = () => {
    // 检查是否在JsonTool组件中，如果是则使用其特殊的偏移逻辑
    if (typeof window !== "undefined" && window.location.pathname.includes('/tool/json')) {
        // 检查JsonTool是否处于全屏状态
        // 通过检查DOM中是否有fullscreen类来判断
        const jsonToolContainer = document.querySelector('.json-tool-container');
        if (jsonToolContainer && jsonToolContainer.classList.contains('fullscreen')) {
            return 2; // 全屏状态下的偏移量
        }
        return 48.5; // 非全屏状态下的偏移量
    }
    return 20; // 其他页面的默认偏移量
};

// 全局消息提示函数
export const globalNotify = (type: MessageType, message: string, duration?: number) => {
    // 使用 CSS 变量让自定义类覆盖全局 .el-message 的 top:7px!important
    if (typeof document !== "undefined") {
        document.documentElement.style.setProperty(
            "--json-message-offset",
            `${getGlobalMessageOffset()}px`
        );
    }
    ElMessage({
        message,
        type,
        duration,
        offset: getGlobalMessageOffset(),
        customClass: MESSAGE_CUSTOM_CLASS,
    });
};

// 便捷方法 - 使用不同的命名避免与Nuxt内置函数冲突
export const showMessageSuccess = (message: string, duration?: number) => globalNotify("success", message, duration);
export const showMessageError = (message: string, duration?: number) => globalNotify("error", message, duration);
export const showMessageWarning = (message: string, duration?: number) => globalNotify("warning", message, duration);
export const showMessageInfo = (message: string, duration?: number) => globalNotify("info", message, duration);