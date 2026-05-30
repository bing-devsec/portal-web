export default defineNuxtPlugin((nuxtApp) => {
    // 获取指纹方法（加密后的 x-client-id 头）
    const getFingerprint = async () => {
        if (typeof nuxtApp.$fingerprint === 'function') {
            try {
                const fingerprint = await nuxtApp.$fingerprint();
                if (fingerprint) return fingerprint;
            } catch (e) {
                throw e;
            }
        }
        return '';
    };

    // 拦截所有的 fetch 请求：在指定接口上自动注入 x-client-id 指纹头。
    nuxtApp.hook('app:created', () => {
        const originalFetch = globalThis.fetch;

        globalThis.fetch = async function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
            init = init || {};
            init.headers = init.headers || {};

            // 将 Headers 对象转换为普通对象
            const headers: Record<string, string> = {};
            if (init.headers instanceof Headers) {
                for (const [key, value] of (init.headers as Headers).entries()) {
                    headers[key] = value;
                }
            } else if (typeof init.headers === 'object') {
                Object.assign(headers, init.headers);
            }

            // 取出 URL
            let url = '';
            if (typeof input === 'string') {
                url = input;
            } else if (input instanceof URL) {
                url = input.toString();
            } else if (input instanceof Request) {
                url = input.url;
            }

            // 仅文章详情接口需要注入指纹（其他接口不需要）
            if (url && url.includes('/user/article/detail')) {
                const fingerprint = await getFingerprint();
                if (fingerprint) {
                    headers['x-client-id'] = fingerprint;
                }
            }

            // 重新组装 Headers
            init.headers = new Headers(headers);

            return originalFetch(input, init);
        };
    });
});
