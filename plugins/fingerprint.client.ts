import { FingerprintDetector } from '../utils/fingerprint';

export default defineNuxtPlugin(async () => {
    const getFingerprint = async () => {
        try {
            const detector = FingerprintDetector.getInstance();
            const result = await detector.getFingerprint();
            return result.fingerprintId;
        } catch (error) {
            return '';
        }
    };

    return {
        provide: {
            fingerprint: getFingerprint,
            recalculateFingerprint: getFingerprint
        }
    };
}); 