import FingerprintJS from '@fingerprintjs/fingerprintjs';

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

export class FingerprintDetector {
    private static instance: FingerprintDetector;
    private fingerprintComponents: Partial<FingerprintComponents> = {};
    /** FingerprintJS 算出的明文 hash，同一会话内反复复用 */
    private fingerprintId: string = '';

    public static getInstance(): FingerprintDetector {
        if (!FingerprintDetector.instance) {
            FingerprintDetector.instance = new FingerprintDetector();
        }
        return FingerprintDetector.instance;
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

    public async getRawFingerprintId(): Promise<string> {
        return await this.ensureFingerprintId();
    }
}
