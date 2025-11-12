export default defineNuxtPlugin((nuxtApp) => {
    // 获取指纹方法
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
    
    // 从cookie中读取session_id的辅助函数
    const getSessionIdFromCookie = (): string | null => {
        const sessionCookie = useCookie('session_id');
        return sessionCookie.value && typeof sessionCookie.value === 'string' 
            ? sessionCookie.value.trim() || null 
            : null;
    };
    
    // 拦截所有的fetch请求
    nuxtApp.hook('app:created', () => {
        const originalFetch = globalThis.fetch;
        
        globalThis.fetch = async function(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
            init = init || {};
            init.headers = init.headers || {};
            
            // 将Headers对象转换为普通对象
            const headers: Record<string, string> = {};
            if (init.headers instanceof Headers) {
                for (const [key, value] of (init.headers as Headers).entries()) {
                    headers[key] = value;
                }
            } else if (typeof init.headers === 'object') {
                Object.assign(headers, init.headers);
            }
            
            // 检查是否应该注入指纹
            let url = '';
            if (typeof input === 'string') {
                url = input;
            } else if (input instanceof URL) {
                url = input.toString();
            } else if (input instanceof Request) {
                url = input.url;
            }
            
            // 判断是否需要添加指纹
            if (url && url.includes('/user/article/detail')) {
                // 先检查是否有session_id cookie
                const sessionId = getSessionIdFromCookie();
                
                if (!sessionId) {
                    const fingerprint = await getFingerprint();
                    
                    if (fingerprint) {
                        headers['x-client-id'] = fingerprint;
                    }
                } else {
                    // 如果有session_id，确保不发送x-client-id（移除可能已存在的）
                    if (headers['x-client-id']) {
                        delete headers['x-client-id'];
                    }
                }
            }
            
            // 重新创建Headers对象
            init.headers = new Headers(headers);
            
            // 调用原始fetch
            return originalFetch(input, init);
        };
    });
}); 