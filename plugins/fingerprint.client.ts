import { FingerprintDetector } from '../utils/fingerprint';

/**
 * 全局指纹能力，挂在 nuxtApp 上：
 *   $getFingerprintId()      → Promise<string>   返回 FingerprintJS 算出的**明文 hash**，仅前端内部使用
 *
 * 实现细节收敛在 utils/fingerprint.ts 的单例里：FingerprintJS 同一会话只跑一次。
 */
export default defineNuxtPlugin(async () => {
    const detector = FingerprintDetector.getInstance();

    const getRawFingerprintId = async (): Promise<string> => {
        try {
            return await detector.getRawFingerprintId();
        } catch {
            return '';
        }
    };

    return {
        provide: {
            getFingerprintId: getRawFingerprintId,
        },
    };
});
