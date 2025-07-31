import { FingerprintDetector } from '../utils/fingerprint';

// 全局变量保存指纹
let globalFingerprintId = '';

export default defineNuxtPlugin(async (nuxtApp) => {
    // 定义一个函数获取或重新计算指纹
    const recalculateFingerprint = async () => {
        try {
            if (globalFingerprintId) {
                return globalFingerprintId;
            }
            
            // 需要重新计算指纹
            const fingerprint = FingerprintDetector.getInstance();
            const result = await fingerprint.getFingerprint();
            globalFingerprintId = result.fingerprintId;
            
            return globalFingerprintId;
        } catch (error) {
            return '';
        }
    };

    return {
        provide: {
            fingerprint: globalFingerprintId,
            recalculateFingerprint
        }
    };
}); 