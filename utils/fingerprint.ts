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
    
    // 公钥内容
    private readonly PUBLIC_KEY: string = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAoSJ8jSSs8+o4a9g5Oaaj
E9k6oFqJAMuvAAtOPgxbSAfEfubdmP0JpT59zoeMkf8G8jXqFkxKzKK4uVi6oRK9
J6JwvVjpD3ouHzERKaOGPOyEb6blM2QmQRDb2ixLeb5t0LRpta+ACyXtfvSsxDb8
rZHNGxCQZqMJNMFvPCxOrSkuEB8UK0zHElf8OZ9EfxlAb1Gm7nE6Veh1BwzZMNhl
B+ukiMEq0b+sRhzksSBSBOyHaffNmdw0U72eM2JCV/Jkqd8fkfQGJiVbtvSvI8oJ
VdvzHilunTYVJJy49YhakDMOGLoPaFiFlDoN0lgmPGeJxkdg1ZO7AS9ByZoDv2G2
qwIDAQAB
-----END PUBLIC KEY-----`;

    private constructor() {}

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
    private encryptWithPublicKey(data: string): string {
        try {
            const encrypt = new JSEncrypt();
            encrypt.setPublicKey(this.PUBLIC_KEY);
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
            this.encryptedFingerprint = this.encryptWithPublicKey(this.fingerprintId);
            
            return {
                fingerprintId: this.encryptedFingerprint,
                components: this.fingerprintComponents
            };
        } catch (error) {
            throw error;
        }
    }
} 