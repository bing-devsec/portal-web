import FingerprintJS from '@fingerprintjs/fingerprintjs';
import JSEncrypt from 'jsencrypt';

declare global {
    interface Window {
        RequestFileSystem?: any;
        webkitRequestFileSystem?: any;
        TEMPORARY?: any;
    }
}

interface FingerprintComponents {
    applePay: any;
    architecture: any;
    audio: any;
    audioBaseLatency: any;
    canvas: any;
    contrast: any;
    cpuClass: any;
    domBlockers: any;
    fonts: any;
    forcedColors: any;
    hardwareConcurrency: any;
    indexedDB: any;
    invertedColors: any;
    monochrome: any;
    openDatabase: any;
    osCpu: any;
    pdfViewerEnabled: any;
    platform: any;
    privateClickMeasurement: any;
    reducedMotion: any;
    reducedTransparency: any;
    touchSupport: any;
    vendor: any;
    vendorFlavors: any;
    webGlBasics: any;
    webGlExtensions: any;
    uaBrands: any;
}

const PUBLIC_KEY_TTL_MS = 60 * 60 * 1000;

export class FingerprintDetector {
    private static instance: FingerprintDetector;
    private fingerprintComponents: Partial<FingerprintComponents> = {};
    /** FingerprintJS 算出的明文 hash（不加密的原值），同一会话内浏览不同文章会反复用到 */
    private fingerprintId: string = '';
    /** 上面 fingerprintId 经 RSA 加密后的密文，给请求头 x-client-id 用 */
    private encryptedFingerprint: string = '';

    /** 公钥 PEM 文本缓存 */
    private publicKeyCache: string = '';
    /** 公钥缓存写入时刻（ms） */
    private publicKeyCachedAt: number = 0;

    /** JSEncrypt 实例缓存：避免每次 setPublicKey 重复解析 PEM */
    private encryptCache: { key: string; encryptor: JSEncrypt } | null = null;

    /**
     * 取公钥：命中缓存且未过期则直接返回；否则请求 /api/keys 并刷新缓存。
     * 缓存 TTL 见 PUBLIC_KEY_TTL_MS 注释。
     */
    private async fetchPublicKey(): Promise<string> {
        const now = Date.now();
        if (this.publicKeyCache && now - this.publicKeyCachedAt < PUBLIC_KEY_TTL_MS) {
            return this.publicKeyCache;
        }

        const response = await fetch('/api/keys');
        if (!response.ok) {
            throw new Error('Failed to fetch public key');
        }
        const data = await response.json();
        if (data.error) {
            throw new Error(data.error);
        }
        if (!data.publicKey) {
            throw new Error('Public key is empty');
        }
        this.publicKeyCache = data.publicKey;
        this.publicKeyCachedAt = now;
        this.encryptCache = null;
        return this.publicKeyCache;
    }

    public static getInstance(): FingerprintDetector {
        if (!FingerprintDetector.instance) {
            FingerprintDetector.instance = new FingerprintDetector();
        }
        return FingerprintDetector.instance;
    }

    private async encryptWithPublicKey(data: string): Promise<string> {
        const publicKey = await this.fetchPublicKey();

        if (!publicKey) {
            throw new Error('公钥未设置');
        }

        // 复用同一公钥下的 JSEncrypt 实例，避免重复解析 PEM
        if (!this.encryptCache || this.encryptCache.key !== publicKey) {
            const encryptor = new JSEncrypt();
            encryptor.setPublicKey(publicKey);
            this.encryptCache = { key: publicKey, encryptor };
        }

        const encrypted = this.encryptCache.encryptor.encrypt(data);
        if (!encrypted) {
            throw new Error('加密失败');
        }
        return encrypted;
    }

    private async ensureFingerprintId(): Promise<string> {
        if (this.fingerprintId) return this.fingerprintId;

        const fp = await FingerprintJS.load();
        const result = await fp.get();
        const {
            applePay,
            architecture,
            audio,
            audioBaseLatency,
            canvas,
            contrast,
            cpuClass,
            domBlockers,
            fonts,
            forcedColors,
            hardwareConcurrency,
            indexedDB,
            invertedColors,
            monochrome,
            openDatabase,
            osCpu,
            pdfViewerEnabled,
            platform,
            privateClickMeasurement,
            reducedMotion,
            reducedTransparency,
            touchSupport,
            vendor,
            vendorFlavors,
            webGlBasics,
            webGlExtensions,
        } = result.components;

        const uaBrandsValue = (() => {
            try {
                const brands = (navigator as any).userAgentData?.brands ?? [];
                return brands
                    .map((b: { brand: string }) => b.brand)
                    .filter((s: string) => !/Not.?A.?Brand/i.test(s)) // 过滤反指纹噪声
                    .sort()
                    .join('|');
            } catch {
                return '';
            }
        })();

        const extendedComponents = {
            applePay,
            architecture,
            audio,
            audioBaseLatency,
            canvas,
            contrast,
            cpuClass,
            domBlockers,
            fonts,
            forcedColors,
            hardwareConcurrency,
            indexedDB,
            invertedColors,
            monochrome,
            openDatabase,
            osCpu,
            pdfViewerEnabled,
            platform,
            privateClickMeasurement,
            reducedMotion,
            reducedTransparency,
            touchSupport,
            vendor,
            vendorFlavors,
            webGlBasics,
            webGlExtensions,
            uaBrands: { value: uaBrandsValue, duration: 0 },
        };

        this.fingerprintComponents = extendedComponents;
        this.fingerprintId = FingerprintJS.hashComponents(extendedComponents);
        return this.fingerprintId;
    }

    public async getFingerprint(): Promise<{fingerprintId: string; components: Partial<FingerprintComponents>}> {
        await this.ensureFingerprintId();
        // 如果当前公钥下的密文还没算，或者公钥已经被刷新，需要重新加密
        if (!this.encryptedFingerprint || !this.encryptCache) {
            this.encryptedFingerprint = await this.encryptWithPublicKey(this.fingerprintId);
        }
        return {
            fingerprintId: this.encryptedFingerprint,
            components: this.fingerprintComponents,
        };
    }

    public async getRawFingerprintId(): Promise<string> {
        return await this.ensureFingerprintId();
    }

    public async encryptToken(plaintext: string): Promise<string> {
        return await this.encryptWithPublicKey(plaintext);
    }
}
