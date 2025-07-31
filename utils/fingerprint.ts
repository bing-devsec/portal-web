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
}

export class FingerprintDetector {
    private static instance: FingerprintDetector;
    private fingerprintComponents: Partial<FingerprintComponents> = {};
    private fingerprintId: string = '';
    private encryptedFingerprint: string = '';
    private publicKeyCache: string = '';

    private async fetchPublicKey(): Promise<string> {
        if (this.publicKeyCache) {
            return this.publicKeyCache;
        }

        try {
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
            return this.publicKeyCache;
        } catch (error) {
            throw error;
        }
    }

    public static getInstance(): FingerprintDetector {
        if (!FingerprintDetector.instance) {
            FingerprintDetector.instance = new FingerprintDetector();
        }
        return FingerprintDetector.instance;
    }

    /**
     * 使用RSA公钥加密数据
     * @param data 要加密的数据
     * @returns 加密后的数据
     */
    private async encryptWithPublicKey(data: string): Promise<string> {
        const publicKey = await this.fetchPublicKey();
        
        if (!publicKey) {
            throw new Error('公钥未设置');
        }
        
        try {
            const encrypt = new JSEncrypt();
            encrypt.setPublicKey(publicKey);
            const encrypted = encrypt.encrypt(data);
            
            if (!encrypted) {
                throw new Error('加密失败');
            }
            
            return encrypted;
        } catch (error) {
            throw error;
        }
    }

    public async getFingerprint(): Promise<{
        fingerprintId: string;
        components: Partial<FingerprintComponents>;
    }> {
        try {
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
                webGlExtensions
            } = result.components;

            // 创建与示例代码完全相同的组件对象
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
                webGlExtensions
            };

            this.fingerprintComponents = extendedComponents;
            this.fingerprintId = FingerprintJS.hashComponents(extendedComponents);
            this.encryptedFingerprint = await this.encryptWithPublicKey(this.fingerprintId);

            return {
                fingerprintId: this.encryptedFingerprint,
                components: this.fingerprintComponents
            };
        } catch (error) {
            throw error;
        }
    }
} 