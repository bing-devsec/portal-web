import { FingerprintDetector } from '../utils/fingerprint';

/**
 * 全局指纹相关能力，挂在 nuxtApp 上：
 *   $fingerprint()           → Promise<string>   返回**加密后的** fingerprint，用于请求头 x-client-id
 *   $recalculateFingerprint  → 同上（历史命名兼容，行为完全一致）
 *   $getFingerprintId()      → Promise<string>   返回 FingerprintJS 算出的**明文 hash**，仅前端内部使用
 *   $encryptToken(text)      → Promise<string>   用当前公钥加密任意明文（≤ 245 字节）；
 *                                                 用例：view-log 打点接口的 token 字段
 *
 * 实现细节都收敛在 utils/fingerprint.ts 的单例里：FingerprintJS 同一会话只跑一次，
 * 公钥按 1 小时 TTL 缓存，JSEncrypt 实例随公钥复用。
 */
export default defineNuxtPlugin(async () => {
    const detector = FingerprintDetector.getInstance();

    const getEncryptedFingerprint = async (): Promise<string> => {
        try {
            const result = await detector.getFingerprint();
            return result.fingerprintId;
        } catch {
            return '';
        }
    };

    const getRawFingerprintId = async (): Promise<string> => {
        try {
            return await detector.getRawFingerprintId();
        } catch {
            return '';
        }
    };

    const encryptToken = async (plaintext: string): Promise<string> => {
        return await detector.encryptToken(plaintext);
    };

    return {
        provide: {
            fingerprint: getEncryptedFingerprint,
            recalculateFingerprint: getEncryptedFingerprint,
            getFingerprintId: getRawFingerprintId,
            encryptToken,
        },
    };
});
