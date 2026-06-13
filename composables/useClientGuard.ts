/**
 * 客户端风控守卫统一入口（spec §5.4）
 *
 * 职责：
 *   - 拉公钥（复用 utils/fingerprint.ts 的缓存策略，但单独存自己的副本以便走 wasm）
 *   - 复用 $getFingerprintId 拿明文 fingerprint hash（hex 字符串）
 *   - 收集 client_meta（语言/时区/屏幕/性能导航/视口）
 *   - 调用 GuardSigner 完成信封签名（当前用 mock，wasm 接入后切换）
 *
 * 接口稳定性承诺：
 *   `useClientGuard().sign(opts)` 返回值固定为 ArrayBuffer（即最终信封），
 *   wasm 接入只替换内部的 GuardSigner 实现，调用方代码无需变更。
 *
 * 与 spec §5.4 的差异：
 *   - 当前未启用 Web Worker（mock 阶段无密码学开销，主线程足够）
 *   - 拉公钥逻辑直接复用 fetchPublicKey()，wasm 接入后改用 ArrayBuffer 形式的 SPKI DER
 */

import type { BehaviorRecorder } from './useBehaviorRecorder';

export const SCENE_VIEW_LOG = 0x10;
export const SCENE_SHARE_CREATE = 0x20;
export type GuardScene = typeof SCENE_VIEW_LOG | typeof SCENE_SHARE_CREATE;

/** 客户端元数据，作为 TLV.client_meta 字段（field=0x06）通过 wasm 编码 */
export interface ClientMeta {
    /** IANA 时区名，e.g. "Asia/Shanghai"；解析失败时空串 */
    tz: string;
    /** navigator.language */
    lang: string;
    /** "${innerWidth}x${innerHeight}" */
    screen: string;
    /** "navigate" | "reload" | "back_forward" | "prerender" | ""（取自 PerformanceNavigationTiming） */
    perfNav: string;
    /** "${visualViewport.width}x${visualViewport.height}"，无 visualViewport 时退回 innerWidth/Height */
    viewport: string;
    /** 浏览器语言列表 navigator.languages.join(',') */
    langs: string;
}

/** 公开签名接口 */
export interface SignOptions {
    scene: GuardScene;
    targetId: string;
    recorder: BehaviorRecorder;
}

/**
 * GuardSigner 接口：屏蔽底层实现（mock vs wasm）。
 * 上线时换 wasm 实现，无需修改 useClientGuard 调用方。
 */
interface GuardSigner {
    /** 用公钥初始化（mock 实现也接受公钥，便于后续替换 wasm 实现） */
    init(publicKeyPem: string): Promise<void>;
    /** 完成一次信封签名 */
    sign(input: {
        scene: GuardScene;
        fingerprintHex: string;
        targetId: string;
        meta: ClientMeta;
        behaviorBuf: Uint8Array;
    }): Promise<ArrayBuffer>;
}

/* -------------------------------------------------------------------------- */
/*  Mock signer                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Mock 信封签名器（无 wasm 时的占位实现）。
 *
 * 仅在 wasm 加载失败 / 调试时启用：
 *   - 生成与真信封"长度合理 + magic/version/scene 正确"的字节，不做密码学加密
 *   - 后端需打开 SkipHMACWhenEmpty 才能解（仅 dev 环境）
 */
function createMockSigner(): GuardSigner {
    let inited = false;
    return {
        async init(_publicKeyPem: string) {
            if (!_publicKeyPem) throw new Error('publicKey required');
            inited = true;
        },
        async sign(input) {
            if (!inited) throw new Error('signer not initialized');
            const HEADER = 296;
            const HMAC_LEN = 32;
            const buf = new ArrayBuffer(HEADER + HMAC_LEN);
            const view = new DataView(buf);
            view.setUint8(0, 0x47);
            view.setUint8(1, 0x55);
            view.setUint8(2, 0x41);
            view.setUint8(3, 0x52);
            view.setUint8(4, 0x01);
            view.setUint8(5, input.scene);
            view.setUint32(292, 0, false);
            return buf;
        },
    };
}

/* -------------------------------------------------------------------------- */
/*  Wasm signer                                                                */
/* -------------------------------------------------------------------------- */

/**
 * wasm 资源路径。可通过 NUXT_PUBLIC_GUARD_WASM_BASE 重写（CDN 部署用）。
 * 默认指向 portal-web/public/guard/，dev / prod 都通过 nuxt 静态托管暴露。
 */
const WASM_BASE = '/guard';
const WASM_GLUE_URL = `${WASM_BASE}/guard_core.js`;
const WASM_BINARY_URL = `${WASM_BASE}/guard_core_bg.wasm`;

/** wasm-bindgen `--target web` 默认导出的 Guard 类型签名（仅 sign 接口） */
type WasmGuardModule = {
    default: (input?: { module_or_path?: string } | string) => Promise<unknown>;
    Guard: new (publicKeyB64: string) => {
        sign(
            scene: number,
            fingerprintHex: string,
            targetId: string,
            metaJson: string,
            behaviorBuf: Uint8Array,
        ): Uint8Array;
        free(): void;
    };
};

let wasmModulePromise: Promise<WasmGuardModule> | null = null;

/**
 * 加载 + 初始化 wasm 模块。多次调用复用同一个 Promise。
 *
 * 失败原因（开发期常见）：
 *   - public/guard/ 下产物缺失 → 提示先跑 scripts/build.sh
 *   - 浏览器不支持 WebAssembly → 极少见，回落 mock
 */
async function loadWasmModule(): Promise<WasmGuardModule> {
    if (!wasmModulePromise) {
        wasmModulePromise = (async () => {
            // @vite-ignore：路径在运行期由 nuxt 静态托管，不参与 vite 编译期解析
            const mod = (await import(/* @vite-ignore */ WASM_GLUE_URL)) as WasmGuardModule;
            // wasm-bindgen 0.2.96+ 对裸字符串路径会发 deprecation 警告，但仍能工作；
            // 用对象形式更稳，并指定绝对 URL（避免 hash 路由 base 影响）。
            await mod.default({ module_or_path: WASM_BINARY_URL });
            return mod;
        })().catch((err) => {
            // 失败要清掉 promise，下次调用允许重试（避免一次网络抖动永久禁用）
            wasmModulePromise = null;
            throw err;
        });
    }
    return wasmModulePromise;
}

/**
 * 把 PEM 公钥剥成裸 base64。
 *
 * Rust 端 `parse_pub_key` 接受不带头尾的 base64（见 crypto-wasm/src/crypto.rs），
 * 这里统一做剥离 + 去换行/空白，保证 wasm 端不踩到 PEM 格式问题。
 */
function pemToBase64(pem: string): string {
    return pem
        .replace(/-----BEGIN [^-]+-----/g, '')
        .replace(/-----END [^-]+-----/g, '')
        .replace(/\s+/g, '');
}

/**
 * 创建真 wasm 签名器。
 *
 * 关键点：
 *   - 一个 Guard 实例对应一个公钥；公钥轮换时必须重建（这里通过 init 阶段一次性 new）
 *   - sign() 同步返回 Uint8Array，但我们用 Promise.resolve 包一层，对外仍然是 async 接口
 *   - 不显式 free()：单例 Guard 生命周期 = 页面生命周期；GC 时 wasm-bindgen 自动释放
 *   - meta_json 要稳定字段顺序（避免 server 反序列化时 hash 变动）：用固定序列化函数
 */
function createWasmSigner(mod: WasmGuardModule): GuardSigner {
    let guard: InstanceType<WasmGuardModule['Guard']> | null = null;
    return {
        async init(publicKeyPem: string) {
            if (!publicKeyPem) throw new Error('publicKey required');
            const b64 = pemToBase64(publicKeyPem);
            if (!b64) throw new Error('publicKey malformed');
            guard = new mod.Guard(b64);
        },
        async sign(input) {
            if (!guard) throw new Error('wasm guard not initialized');
            const metaJson = stringifyMeta(input.meta);
            const out = guard.sign(
                input.scene,
                input.fingerprintHex,
                input.targetId,
                metaJson,
                input.behaviorBuf,
            );
            // Uint8Array.buffer 在 lib.dom 类型里可能是 ArrayBuffer | SharedArrayBuffer，
            // 这里 wasm-bindgen 一定走 ArrayBuffer 路径。复制一份独立 ArrayBuffer：
            //   1) 切断与 wasm linear memory 的引用，避免后续 sign 调用导致字节被复用
            //   2) 显式构造 ArrayBuffer 也消除 SharedArrayBuffer 的 TS 联合类型警告
            const ab = new ArrayBuffer(out.byteLength);
            new Uint8Array(ab).set(out);
            return ab;
        },
    };
}

/**
 * 稳定字段顺序的 meta JSON 序列化。
 *
 * 后端会把 meta_json 当字符串塞进 TLV(field=0x06)；为避免不同浏览器/版本下
 * Object.keys 顺序差异导致同语义信封 hash 不一致，这里固定字段顺序。
 */
function stringifyMeta(m: ClientMeta): string {
    return JSON.stringify({
        tz: m.tz,
        lang: m.lang,
        langs: m.langs,
        screen: m.screen,
        viewport: m.viewport,
        perfNav: m.perfNav,
    });
}

/* -------------------------------------------------------------------------- */
/*  Public composable                                                         */
/* -------------------------------------------------------------------------- */

let signerInstance: GuardSigner | null = null;
let signerInitPromise: Promise<GuardSigner> | null = null;

/**
 * 取并初始化签名器（懒加载 + 单例）。
 *
 * 优先 wasm；失败时根据 GUARD_FALLBACK_MOCK 决定是否回落 mock signer。
 *   - dev 默认 fallback=true，方便排查公钥/wasm 加载问题
 *   - prod 默认 fallback=false，wasm 失败直接抛出由业务静默吞掉
 *
 * 多个并发调用共享同一个 init Promise，避免重复拉公钥 / 重复初始化 wasm。
 */
const GUARD_FALLBACK_MOCK = (() => {
    if (typeof process !== 'undefined' && (process as { dev?: boolean }).dev) return true;
    if (typeof window !== 'undefined' && /^localhost(:|$)/.test(window.location.host)) return true;
    return false;
})();

async function getSigner(): Promise<GuardSigner> {
    if (signerInstance) return signerInstance;
    if (!signerInitPromise) {
        signerInitPromise = (async () => {
            const publicKey = await fetchPublicKey();
            try {
                const mod = await loadWasmModule();
                const s = createWasmSigner(mod);
                await s.init(publicKey);
                signerInstance = s;
                return s;
            } catch (err) {
                if (!GUARD_FALLBACK_MOCK) {
                    // 失败回滚，允许下次重试
                    signerInitPromise = null;
                    throw err;
                }
                const s = createMockSigner();
                await s.init(publicKey);
                signerInstance = s;
                return s;
            }
        })();
    }
    return signerInitPromise;
}

/**
 * 取公钥。复用 /api/keys 接口；与 utils/fingerprint.ts 中的缓存独立
 * （那里加密的是 fingerprint 字符串，这里给 wasm 用，未来切 SPKI DER 形式时改这里即可）。
 */
const PUBLIC_KEY_TTL_MS = 60 * 60 * 1000;
let publicKeyCache = '';
let publicKeyCachedAt = 0;

async function fetchPublicKey(): Promise<string> {
    const now = Date.now();
    if (publicKeyCache && now - publicKeyCachedAt < PUBLIC_KEY_TTL_MS) {
        return publicKeyCache;
    }
    const resp = await fetch('/api/keys');
    if (!resp.ok) throw new Error('fetch public key failed');
    const data = (await resp.json()) as { publicKey?: string; error?: string };
    if (data.error) throw new Error(data.error);
    if (!data.publicKey) throw new Error('public key empty');
    publicKeyCache = data.publicKey;
    publicKeyCachedAt = now;
    return publicKeyCache;
}

/**
 * 把任意长度的 fingerprint hex 拉伸成 64 hex（32 字节）。
 *
 * 背景：
 *   FingerprintJS.hashComponents 返回 32 hex（128-bit murmur128），
 *   而 wasm signer envelope::parse_fingerprint 要求 64 hex（256-bit）。
 *   直接拼接 / padEnd 都会破坏熵分布，因此用 SHA-256 做一次确定性扩展：
 *   同一浏览器输入 → 同一 64 hex 输出，跨页面跨 tab 完全稳定。
 *
 * 注意：
 *   - 输入空字符串会抛错（上层已校验，这里 defensive）
 *   - SubtleCrypto.digest 在 https / localhost 都可用；ssr 期间不会调到这里（sign 仅在客户端）
 */
async function stretchFingerprintTo64Hex(input: string): Promise<string> {
    if (!input) throw new Error('fingerprint empty');
    const enc = new TextEncoder().encode(input);
    const hashBuf = await crypto.subtle.digest('SHA-256', enc);
    const bytes = new Uint8Array(hashBuf);
    let out = '';
    for (let i = 0; i < bytes.length; i++) {
        out += bytes[i].toString(16).padStart(2, '0');
    }
    return out;
}

/**
 * 收集客户端 meta 信息。
 *
 * 所有字段在采集失败时都用空串/默认值兜底，保证不抛错；
 * 后端 L2 评分对缺失字段会"软扣分"而不是直接拒。
 */
export function collectClientMeta(): ClientMeta {
    if (typeof window === 'undefined') {
        return { tz: '', lang: '', screen: '', perfNav: '', viewport: '', langs: '' };
    }
    let tz = '';
    try {
        tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    } catch {
        tz = '';
    }
    const lang = navigator.language || '';
    const langs = Array.isArray(navigator.languages) ? navigator.languages.join(',') : '';
    const screen = `${window.innerWidth}x${window.innerHeight}`;
    let viewport = screen;
    if (window.visualViewport) {
        viewport = `${Math.round(window.visualViewport.width)}x${Math.round(window.visualViewport.height)}`;
    }
    let perfNav = '';
    try {
        const entries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
        if (entries && entries.length > 0) {
            perfNav = entries[0].type || '';
        }
    } catch {
        perfNav = '';
    }
    return { tz, lang, screen, perfNav, viewport, langs };
}

/**
 * 提供给业务调用的 composable。
 */
export function useClientGuard() {
    const nuxtApp = useNuxtApp();

    /**
     * 完成一次信封签名。
     *
     * 异常处理：
     *   - 公钥拉取失败 / signer 初始化失败 → 抛出，业务层应静默吞掉，避免影响主流程
     *   - sign 内部异常 → 抛出
     *
     * 并发安全：
     *   多个 sign 并发调用共享同一 signer 实例（mock/wasm 都是无状态 sign）。
     */
    async function sign(opts: SignOptions): Promise<ArrayBuffer> {
        if (!opts || !opts.targetId || !opts.recorder) {
            throw new Error('invalid sign options');
        }
        const signer = await getSigner();
        // $getFingerprintId 来自 plugins/fingerprint.client.ts，返回 FingerprintJS.hashComponents
        // 的输出（32 hex / 128-bit murmur128）。wasm signer 的 envelope::parse_fingerprint
        // 要求 64 hex（32 字节），所以这里再做一次 SHA-256 拉伸成 64 hex。
        // 这样同一浏览器仍然得到稳定的 64 hex 指纹，且与 wasm 接口对齐。
        const rawFp: string = await (nuxtApp as any).$getFingerprintId();
        if (!rawFp) throw new Error('fingerprint unavailable');
        const fingerprintHex = await stretchFingerprintTo64Hex(rawFp);

        const meta = collectClientMeta();
        const behaviorBuf = opts.recorder.serialize();

        return signer.sign({
            scene: opts.scene,
            fingerprintHex,
            targetId: opts.targetId,
            meta,
            behaviorBuf,
        });
    }

    return { SCENE_VIEW_LOG, SCENE_SHARE_CREATE, sign };
}
