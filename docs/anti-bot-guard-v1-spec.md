# 综合风控守卫方案（v1）：浏览量+1 / JSON 分享 双场景

> 版本：v1（草案）
> 适用范围：portal-web 前端 + meta-api 后端
> 作用域：文章详情页"浏览量+1"、JSON 工具"分享创建"两个场景
> 文档目标：作为开发者落地实施的 single source of truth，覆盖目标、协议、模块、代码骨架、测试、监控、灰度、回滚

---

## 1. 目标与边界

### 1.1 业务目标

| 场景 | 现状触发点 | 现状识别方式 | 新方案目标 |
|---|---|---|---|
| 浏览量+1 | 文章详情挂载后 1.5s 触发 sendBeacon | RSA(token) + 内存指纹 | 升级为 **WASM 混合加密 + 3 秒行为采样**，提高 bot 拦截率 |
| JSON 分享 | 用户点击"分享"按钮 | Header `x-client-id`（RSA 加密指纹） | 升级为 **WASM 混合加密 + 点击瞬间行为快照**，防止脚本批量创建分享链接 |

### 1.2 与现状对齐的两点设计调整

1. **浏览量打点等待时间**：从 1.5s 改为 **3s**（覆盖更长行为窗口）
2. **行为采集范围**：3s 内全量采集鼠标 / 滚轮 / 键盘 / 焦点事件；分享场景从弹窗打开起持续采集，按下"分享"按钮瞬间快照

### 1.3 不做什么（明确边界）

- ❌ 不引入 PoW（对 1w PV/天规模属于过度工程）
- ❌ 不做机器学习模型（先用规则评分，模型留作 v2）
- ❌ 不重构现有 `useApiData`（仅在两处场景内闭环）
- ❌ 不动 KeyManager 已经实现的 RSA 私钥热轮换（直接复用）
- ❌ 不引入 IP 黑/白名单管理后台（沿用现有 Redis 频控）

---

## 2. 总体架构

```
┌────────────────────────────────────────────────────────────────────────────┐
│                              前端                                            │
│                                                                              │
│   ┌──────────────┐   全量事件流                                              │
│   │ JS 主线程    │─────────┐                                                 │
│   │ - 文章详情页  │         ▼                                                 │
│   │ - 分享按钮    │   ┌──────────────────┐    采集要点                       │
│   └──────┬───────┘   │ BehaviorCollector │    - 节流 50ms / 突变点          │
│          │           │ (TS, RingBuffer)  │    - 鼠标 / 滚轮 / 键盘 / 焦点    │
│          │           └────────┬─────────┘                                   │
│          │ 触发打点/分享        │                                            │
│          ▼                    ▼                                              │
│   ┌──────────────────────────────────┐                                       │
│   │ useClientGuard (composable)      │                                       │
│   │  - schedule(view-log) / sign()    │                                       │
│   │  - 收集元数据 (referer/tz/...)    │                                       │
│   │  - 与 WASM 通信 (Web Worker)      │                                       │
│   └────────────────┬─────────────────┘                                       │
│                    │ postMessage                                              │
│   ┌────────────────▼─────────────────┐                                       │
│   │ guard.worker.ts (Web Worker)     │                                       │
│   │  - import wasm                   │                                       │
│   │  - 调用 sign(payload, behavior)   │                                       │
│   └────────────────┬─────────────────┘                                       │
│                    │                                                          │
│   ┌────────────────▼─────────────────────────────────────┐                  │
│   │ guard_core.wasm (Rust)                               │                  │
│   │  - 自定义二进制布局 + AES-256-GCM + RSA-2048-OAEP     │                  │
│   │  - 行为特征提取 (Fitts' Law / 速度统计 / 抖动)        │                  │
│   │  - 编译加固：LTO + strip + obfstr 字符串加密 + wasm-opt │                  │
│   └─────────────────────────────────────────────────────┘                  │
│                                                                              │
│   产物：blob（不可读字节流）                                                  │
└──────────────────────────────────────┬────────────────────────────────────┘
                                       │ POST blob
                                       │ Content-Type: application/octet-stream
                                       ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                            Go 后端                                           │
│                                                                              │
│   ┌──────────────────────────────────────────────────────────┐              │
│   │ guard.Engine (新建 common/guard 包)                        │              │
│   │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐       │              │
│   │  │ Decode  │→ │ Decrypt │→ │ Verify  │→ │ Score   │       │              │
│   │  │ binary  │  │ AES+RSA │  │ ts/sig  │  │ rules   │       │              │
│   │  │ layout  │  │ keymgr  │  │ nonce   │  │ behavior│       │              │
│   │  └─────────┘  └─────────┘  └─────────┘  └─────────┘       │              │
│   └──────────────────────────────────────────────────────────┘              │
│                              │                                                │
│        ┌─────────────────────┼─────────────────────┐                         │
│        ▼                     ▼                     ▼                         │
│  view-log handler     share-create handler    其它未来场景                    │
│  - 调 Engine          - 调 Engine                                            │
│  - HINCRBY            - INSERT 记录                                          │
│  - ZINCRBY                                                                    │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. 通信协议（"二进制信封" v1）

不再用 JSON。前端 WASM 输出一段**自定义布局的二进制流**，后端按位解析。这样：
- 抓包分析者无法直接看出字段含义
- 字段顺序、长度都可以混淆
- gzip 压缩比比 base64 JSON 高

### 3.1 信封整体格式（Big-Endian）

```
偏移   长度   字段                      说明
0      4     magic = 0x47 0x55 0x41 0x52  ("GUAR" 作为版本探针)
4      1     version                   当前 0x01
5      1     scene                     0x10=view-log, 0x20=share-create
6      2     reserved                  全 0
8      256   rsa_encrypted_key         RSA-2048-OAEP(K + iv + nonce_seed)
264    12    aes_iv                    GCM IV (随机)
276    16    aes_tag                   GCM authTag
292    4     ciphertext_len            payload 密文长度 N (uint32 BE)
296    N     ciphertext                AES-256-GCM(payload)
296+N  32    build_hmac                HMAC-SHA256(全部前缀 || build_hash)
                                       服务端用 build_hash 校验前端版本
```

**总长度**：固定头 296B + ciphertext + 32B HMAC。一般在 2~6KB（含行为数据）。

### 3.2 ciphertext 内的 payload（二进制 TLV）

```
field_id (1B) | length (2B BE) | value (length B)
```

| field_id | 字段名 | value 编码 |
|---|---|---|
| 0x01 | scene | u8（同信封头，双重确认） |
| 0x02 | timestamp_ms | i64 BE |
| 0x03 | nonce | 16B 随机 |
| 0x04 | fingerprint_id | 32B（FingerprintJS hash 二进制形式） |
| 0x05 | target_id | 变长 utf-8（articleId 或 share 草稿 hash） |
| 0x06 | client_meta | 内嵌子 TLV（referer/tz/screen/lang/perfNav/uaBrands） |
| 0x07 | behavior_summary | 内嵌结构（速度统计、抖动指数等聚合后值，~64B） |
| 0x08 | behavior_raw | 鼠标/滚轮/键盘事件序列差分编码后字节流 |
| 0x09 | viewport | u16 width, u16 height |
| 0x0A | session_token | 16B 浏览器存活期会话 ID（sessionStorage） |
| 0x0B | build_hash | 8B（前端 wasm 自己嵌入，用于版本校验） |
| 0x0C~0xEF | 预留 | — |
| 0xFF | end_marker | 0 字节，标记结束 |

**字段顺序混淆**：每次序列化前根据 `(timestamp_ms ^ nonce[0..4])` 算一个排列种子，TLV 不按 0x01..0xFF 顺序写入，而按生成的随机排列写入。后端按 field_id 解析，不依赖顺序。

### 3.3 行为序列编码（field 0x08）

每条事件 6 字节：

```
type (1B) | dt (2B BE, ms 距上一条) | dx (1B signed) | dy (1B signed) | meta (1B)
```

- type：0x10=mousemove, 0x11=mousedown, 0x12=mouseup, 0x13=click, 0x20=wheel, 0x30=keydown, 0x31=keyup, 0x40=focus, 0x41=blur, 0x50=visibilitychange
- dx/dy：相对上一条的偏移（差分编码），±127px 范围内能放进 1B；超过的截断（实际人类移动几乎不会单帧 >127px）
- meta：按 type 不同含义（如 wheel 的 deltaY 量级、keydown 的修饰键 bit）

**典型 3 秒采样**：50ms 一个点 → 60 个 mousemove 事件 → 360B；外加 click/key/scroll 事件 ~50B；合计约 400~600B。

### 3.4 行为聚合摘要（field 0x07，64B）

WASM 在加密前先在 Rust 里算好聚合特征（避免后端重复计算）：

```rust
#[repr(C, packed)]
struct BehaviorSummary {
    sample_count: u16,        // 采样总数
    duration_ms: u32,         // 实际采样时长
    mouse_path_len_px: u32,   // 鼠标移动总像素
    mouse_speed_mean: f32,    // 平均速度 (px/ms)
    mouse_speed_std: f32,     // 速度标准差
    mouse_jerk_mean: f32,     // 平均加速度变化（人类有抖动，bot 极平滑）
    mouse_max_dy: f32,        // 单帧最大垂直跳动
    click_count: u16,
    click_dwell_mean_ms: u32, // 按下到松开的平均时长
    keydown_count: u16,
    key_flight_mean_ms: u32,  // 键间飞行时间均值
    wheel_count: u16,
    wheel_delta_sum: i32,
    focus_changes: u16,
    visibility_hidden_ms: u32,
    flags: u16,               // bit0=曾切到背景, bit1=曾失焦, bit2=有触屏事件...
}
```

后端读到这 64B 后直接按规则评分，不需要再 parse 全量事件流。

---

## 4. Rust / WASM 模块（`crypto-wasm/` 仓库）

### 4.1 仓库结构

```
crypto-wasm/                          # 与 portal-web、meta-api 平级
├── Cargo.toml
├── Cargo.lock
├── README.md
├── src/
│   ├── lib.rs                        # wasm-bindgen 导出
│   ├── envelope.rs                   # 二进制信封编解码
│   ├── crypto.rs                     # AES-GCM + RSA-OAEP + HMAC
│   ├── behavior.rs                   # 行为特征提取
│   ├── obfuscate.rs                  # 字段顺序排列、字符串加密
│   ├── build_info.rs                 # 编译期注入 BUILD_HASH
│   └── error.rs
├── build.rs                          # 编译期生成 BUILD_HASH（git rev-parse HEAD 截 8 字节）
├── tests/
│   ├── roundtrip.rs                  # 与 Go 后端协议互通测试
│   └── behavior_eval.rs              # 行为特征单元测试
└── scripts/
    ├── build.sh                      # wasm-pack + wasm-strip + wasm-opt
    └── verify-obfuscation.sh         # 反汇编 + 关键字检索（assert 找不到 "AES" 等）
```

### 4.2 Cargo.toml

```toml
[package]
name = "guard-core"
version = "0.1.0"
edition = "2021"
publish = false

[lib]
crate-type = ["cdylib", "rlib"]

[dependencies]
wasm-bindgen = "0.2"
js-sys = "0.3"
web-sys = { version = "0.3", features = ["console"] }

aes-gcm = "0.10"
rsa = { version = "0.9", default-features = false, features = ["sha2", "pkcs1"] }
rand_core = { version = "0.6", features = ["getrandom"] }
getrandom = { version = "0.2", features = ["js"] }
hmac = "0.12"
sha2 = "0.10"
zeroize = { version = "1.7", features = ["zeroize_derive"] }
obfstr = "0.4"

[profile.release]
opt-level = "z"
lto = "fat"
codegen-units = 1
strip = "symbols"
panic = "abort"
overflow-checks = false
```

### 4.3 lib.rs（对外接口）

```rust
use wasm_bindgen::prelude::*;
use crate::error::GuardError;

#[wasm_bindgen]
pub struct Guard {
    aes_key: [u8; 32],
    rsa_pub_pem_compiled: &'static [u8],  // 编译期嵌入（多个候选公钥）
}

#[wasm_bindgen]
impl Guard {
    /// 由前端 JS 创建实例
    /// 入参：服务端下发的当前 RSA 公钥 PEM（base64）
    #[wasm_bindgen(constructor)]
    pub fn new(public_key_b64: &str) -> Result<Guard, JsError> {
        // 内部对公钥做合法性校验
        crate::crypto::init(public_key_b64).map_err(GuardError::into_js_error)
    }

    /// 主签名入口：拿到 JS 侧采集的所有信息，返回二进制信封
    /// scene:  0x10=view-log, 0x20=share-create
    /// fingerprint_hex: 32 字节明文 hash 的 hex
    /// target_id: articleId 或 share 草稿 hash
    /// meta_json: 元数据 JSON（前端容器化后扁平化）
    /// behavior_buf: 前端 RingBuffer 落地的行为事件二进制流
    /// 返回：Uint8Array（二进制信封）
    #[wasm_bindgen]
    pub fn sign(
        &self,
        scene: u8,
        fingerprint_hex: &str,
        target_id: &str,
        meta_json: &str,
        behavior_buf: &[u8],
    ) -> Result<js_sys::Uint8Array, JsError> {
        crate::envelope::build_envelope(
            self,
            scene,
            fingerprint_hex,
            target_id,
            meta_json,
            behavior_buf,
        )
        .map(|v| js_sys::Uint8Array::from(&v[..]))
        .map_err(GuardError::into_js_error)
    }

    /// 暴露给前端用于诊断（仅在 debug build 中存在）
    #[cfg(debug_assertions)]
    #[wasm_bindgen]
    pub fn version(&self) -> String {
        format!("guard-core {}", env!("CARGO_PKG_VERSION"))
    }
}
```

### 4.4 加密细节（crypto.rs 简化伪码）

```rust
pub fn build_envelope(g: &Guard, scene: u8, fp: &str, tid: &str,
                      meta: &str, beh: &[u8]) -> Result<Vec<u8>, GuardError> {
    // 1. 一次性 AES key & iv & nonce
    let mut aes_key = [0u8; 32];
    let mut iv = [0u8; 12];
    let mut nonce = [0u8; 16];
    fill_random(&mut aes_key)?;
    fill_random(&mut iv)?;
    fill_random(&mut nonce)?;

    // 2. 构造 plaintext payload (TLV，字段顺序按 nonce 排列)
    let payload = serialize_payload(scene, fp, tid, meta, beh, &nonce)?;

    // 3. AES-256-GCM 加密
    let cipher = Aes256Gcm::new(GenericArray::from_slice(&aes_key));
    let mut ct_with_tag = cipher
        .encrypt(GenericArray::from_slice(&iv), payload.as_ref())
        .map_err(|_| GuardError::AesFail)?;
    let tag = ct_with_tag.split_off(ct_with_tag.len() - 16);
    let ciphertext = ct_with_tag;

    // 4. RSA-OAEP 加密 (aes_key || iv || nonce)
    let mut blob = [0u8; 32 + 12 + 16];
    blob[..32].copy_from_slice(&aes_key);
    blob[32..44].copy_from_slice(&iv);
    blob[44..].copy_from_slice(&nonce);
    let rsa_ct = rsa_encrypt_oaep(&g.rsa_pub_key, &blob)?;
    debug_assert_eq!(rsa_ct.len(), 256);

    // 5. 拼装信封
    let mut env = Vec::with_capacity(296 + ciphertext.len() + 32);
    env.extend_from_slice(&[0x47, 0x55, 0x41, 0x52]);   // magic
    env.push(0x01);                                       // version
    env.push(scene);                                      // scene
    env.extend_from_slice(&[0x00, 0x00]);                 // reserved
    env.extend_from_slice(&rsa_ct);                       // 256 B
    env.extend_from_slice(&iv);                           // 12 B
    env.extend_from_slice(&tag);                          // 16 B
    env.extend_from_slice(&(ciphertext.len() as u32).to_be_bytes());
    env.extend_from_slice(&ciphertext);

    // 6. HMAC-SHA256(整个前缀 || BUILD_HASH) → 32B 尾部
    let mut mac = HmacSha256::new_from_slice(&aes_key).unwrap();
    mac.update(&env);
    mac.update(&BUILD_HASH);
    let hmac = mac.finalize().into_bytes();
    env.extend_from_slice(&hmac);

    // 7. 销毁敏感数据
    aes_key.zeroize();
    blob.zeroize();
    Ok(env)
}
```

### 4.5 反逆向加固（编译流程）

`scripts/build.sh`:

```bash
#!/usr/bin/env bash
set -e

# 1. cargo build for wasm
wasm-pack build --target web --release --out-dir pkg

# 2. 进一步优化与 strip
wasm-strip pkg/guard_core_bg.wasm
wasm-opt -Oz \
  --strip-debug \
  --strip-producers \
  --vacuum \
  --reorder-locals \
  --reorder-functions \
  pkg/guard_core_bg.wasm \
  -o pkg/guard_core_bg.wasm

# 3. 关键字检测：确保关键字符串已被加密
if wasm-objdump -s pkg/guard_core_bg.wasm | grep -iE "AES|RSA|fingerprint|behavior"; then
  echo "WARN: 仍有敏感字符串未混淆" >&2
  exit 1
fi

# 4. 生成 BUILD_HASH 文件供后端校验
sha256sum pkg/guard_core_bg.wasm | awk '{print $1}' > pkg/build_hash.txt
```

**编译期注入 BUILD_HASH（build.rs）**：

```rust
fn main() {
    // git rev-parse HEAD 截前 8 字节作为 build_hash
    let hash = std::process::Command::new("git")
        .args(["rev-parse", "HEAD"])
        .output()
        .unwrap();
    let hex = String::from_utf8(hash.stdout).unwrap();
    let bytes = hex::decode(&hex.trim()[..16]).unwrap();
    println!("cargo:rustc-env=GUARD_BUILD_HASH={}", &hex.trim()[..16]);
    // 在 lib.rs 通过 const BUILD_HASH: [u8;8] = ... 引用
}
```

---

## 5. 前端集成（Nuxt）

### 5.1 资源放置

```
portal-web/
├── public/
│   └── guard/
│       ├── guard_core_bg.wasm        # 来自 crypto-wasm/pkg/
│       ├── guard_core.js             # wasm-bindgen 胶水
│       └── version.json              # { build_hash, generated_at }
├── composables/
│   ├── useClientFingerprint.ts       # (已存在，仅小幅封装)
│   ├── useClientGuard.ts             # 新增（核心）
│   └── useBehaviorRecorder.ts        # 新增
├── workers/
│   └── guard.worker.ts               # 新增 Web Worker
└── plugins/
    └── fingerprint.client.ts         # (已存在，复用)
```

### 5.2 BehaviorRecorder（采集器）

`composables/useBehaviorRecorder.ts`：

```ts
export interface BehaviorEvent {
    type: number;         // 见 3.3 节
    t: number;            // 距 startedAt 的相对时间 ms
    x: number;            // 绝对坐标，由 collector 转差分
    y: number;
    meta: number;         // 按类型不同
}

export interface BehaviorRecorder {
    start(): void;
    stop(): void;
    serialize(): Uint8Array;
    summary(): BehaviorSummary;  // 可选，仅用于本地调试
}

const MAX_EVENTS = 600;        // 约 10s 的余量
const SAMPLE_INTERVAL = 50;    // mousemove 节流

export function createBehaviorRecorder(): BehaviorRecorder {
    const buf: BehaviorEvent[] = [];
    let startedAt = 0;
    let lastMoveAt = 0;
    let active = false;

    const onMove = (e: MouseEvent) => {
        if (!active) return;
        const now = performance.now();
        if (now - lastMoveAt < SAMPLE_INTERVAL) return;
        lastMoveAt = now;
        if (buf.length >= MAX_EVENTS) buf.shift();
        buf.push({ type: 0x10, t: now - startedAt, x: e.clientX, y: e.clientY, meta: 0 });
    };
    const onClick = (e: MouseEvent) => { /* 0x13 */ };
    const onWheel = (e: WheelEvent) => { /* 0x20，meta 编码 deltaY 量级 */ };
    const onKey = (e: KeyboardEvent) => { /* 0x30/0x31，meta 编码修饰键 */ };
    const onVis = () => { /* 0x50 */ };

    return {
        start() {
            startedAt = performance.now();
            buf.length = 0;
            active = true;
            window.addEventListener('mousemove', onMove, { passive: true });
            window.addEventListener('click', onClick, { passive: true });
            window.addEventListener('wheel', onWheel, { passive: true });
            window.addEventListener('keydown', onKey, { passive: true });
            window.addEventListener('keyup', onKey, { passive: true });
            document.addEventListener('visibilitychange', onVis);
        },
        stop() {
            active = false;
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('click', onClick);
            window.removeEventListener('wheel', onWheel);
            window.removeEventListener('keydown', onKey);
            window.removeEventListener('keyup', onKey);
            document.removeEventListener('visibilitychange', onVis);
        },
        serialize() {
            // 转成 6B/event 的差分编码二进制
            return encodeBehaviorBinary(buf);
        },
        summary() {
            return computeBehaviorSummary(buf);
        },
    };
}
```

### 5.3 Web Worker 封装

`workers/guard.worker.ts`：

```ts
import init, { Guard } from '~/public/guard/guard_core.js';

let guard: Guard | null = null;

self.onmessage = async (e) => {
    const { id, type, payload } = e.data;
    try {
        if (type === 'init') {
            await init(new URL('/guard/guard_core_bg.wasm', self.location.origin));
            guard = new Guard(payload.publicKey);
            self.postMessage({ id, ok: true });
        } else if (type === 'sign') {
            if (!guard) throw new Error('not initialized');
            const env = guard.sign(
                payload.scene,
                payload.fingerprintHex,
                payload.targetId,
                payload.metaJson,
                payload.behaviorBuf,
            );
            // 注意：要把 ArrayBuffer 通过 transferable 传回，避免拷贝
            self.postMessage({ id, ok: true, env: env.buffer }, { transfer: [env.buffer] });
        }
    } catch (err: any) {
        self.postMessage({ id, ok: false, error: String(err?.message || err) });
    }
};
```

### 5.4 useClientGuard composable（统一入口）

`composables/useClientGuard.ts`：

```ts
const SCENE_VIEW_LOG = 0x10;
const SCENE_SHARE_CREATE = 0x20;

let workerInstance: Worker | null = null;
let initPromise: Promise<void> | null = null;
let nextMsgId = 1;

async function ensureWorker(publicKey: string): Promise<Worker> {
    if (workerInstance) return workerInstance;
    if (!initPromise) {
        initPromise = (async () => {
            const w = new Worker(
                new URL('~/workers/guard.worker.ts', import.meta.url),
                { type: 'module' }
            );
            await new Promise<void>((res, rej) => {
                const id = nextMsgId++;
                const handler = (e: MessageEvent) => {
                    if (e.data?.id !== id) return;
                    w.removeEventListener('message', handler);
                    e.data.ok ? res() : rej(new Error(e.data.error));
                };
                w.addEventListener('message', handler);
                w.postMessage({ id, type: 'init', payload: { publicKey } });
            });
            workerInstance = w;
        })();
    }
    await initPromise;
    return workerInstance!;
}

export function useClientGuard() {
    const nuxtApp = useNuxtApp();

    /** 采集行为 + 调用 WASM 加密签名 */
    async function sign(opts: {
        scene: 0x10 | 0x20;
        targetId: string;
        recorder: BehaviorRecorder;
    }): Promise<ArrayBuffer> {
        // 1. 拿公钥（复用现有 fetchPublicKey 缓存）
        const publicKey = await getPublicKeyB64();
        const w = await ensureWorker(publicKey);

        // 2. 拿 fingerprintId（复用现有插件）
        const fpHex = await nuxtApp.$getFingerprintId();

        // 3. 拿元数据
        const meta = collectClientMeta();

        // 4. 行为序列化
        const behaviorBuf = opts.recorder.serialize();

        // 5. 通过 worker 调 wasm
        return new Promise<ArrayBuffer>((resolve, reject) => {
            const id = nextMsgId++;
            const handler = (e: MessageEvent) => {
                if (e.data?.id !== id) return;
                w.removeEventListener('message', handler);
                e.data.ok ? resolve(e.data.env) : reject(new Error(e.data.error));
            };
            w.addEventListener('message', handler);
            w.postMessage({
                id,
                type: 'sign',
                payload: {
                    scene: opts.scene,
                    fingerprintHex: fpHex,
                    targetId: opts.targetId,
                    metaJson: JSON.stringify(meta),
                    behaviorBuf,
                },
            });
        });
    }

    return { SCENE_VIEW_LOG, SCENE_SHARE_CREATE, sign };
}
```

### 5.5 接入两个业务

**view-log（文章详情页）**：原 1.5s 改 3s，并行采集行为。

```ts
// pages/article-detail/[id].vue
import { createBehaviorRecorder } from '~/composables/useBehaviorRecorder';
import { useClientGuard } from '~/composables/useClientGuard';

const VIEW_LOG_DELAY_MS = 3000;
const recorder = createBehaviorRecorder();
const { sign, SCENE_VIEW_LOG } = useClientGuard();

onMounted(() => {
    recorder.start();   // 进页就开采，不浪费 3s 前的事件
    setTimeout(async () => {
        if (document.visibilityState === 'hidden') return;
        recorder.stop();
        try {
            const env = await sign({
                scene: SCENE_VIEW_LOG,
                targetId: articleId.value,
                recorder,
            });
            const blob = new Blob([env], { type: 'application/octet-stream' });
            // sendBeacon 不允许 octet-stream 的 simple request，只能 fetch keepalive
            await fetch(`${baseURL}/user/article/view-log/${articleId.value}`, {
                method: 'POST',
                body: blob,
                headers: { 'Content-Type': 'application/octet-stream' },
                keepalive: true,
            });
        } catch (e) { /* 静默 */ }
    }, VIEW_LOG_DELAY_MS);
});

onBeforeUnmount(() => recorder.stop());
```

**JSON 分享**：监听用户在 ShareDialog 中操作的整个生命周期，点击"分享"瞬间生成签名。

```ts
// components/JsonTool/ShareDialog.vue
const recorder = createBehaviorRecorder();
recorder.start();   // 弹窗打开即采集

async function onClickShare() {
    recorder.stop();
    const env = await sign({
        scene: SCENE_SHARE_CREATE,
        targetId: draftHash,    // 把待分享的 JSON 内容做一次 sha256 截 16B 当 targetId
        recorder,
    });
    const blob = new Blob([env], { type: 'application/octet-stream' });
    const res = await fetch(`${baseURL}/user/json/share`, {
        method: 'POST',
        body: blob,
        headers: { 'Content-Type': 'application/octet-stream' },
    });
    // ...
}
```

---

## 6. 后端实现（Go）

### 6.1 包结构

```
meta-api/common/guard/                # 新建通用风控引擎
├── engine.go                         # Engine 主流程
├── envelope.go                       # 二进制信封解码
├── decrypt.go                        # AES + RSA + HMAC
├── rules.go                          # 规则集（L1/L2/L3/L4）
├── behavior.go                       # 行为摘要解析与评分
├── types.go                          # RiskRequest / Decision / Outcome
├── store.go                          # Redis 抽象（nonce / rate / dedup）
├── audit.go                          # zap 审计日志
└── builds.go                         # 期望的 build_hash 列表（支持灰度多版本）

meta-api/app/handler/viewlog/          # 改造
└── viewlog.go                        # 改为调 guard.Engine.Evaluate

meta-api/app/handler/share/            # 新增（如已存在则改造）
└── share.go
```

### 6.2 核心接口

```go
package guard

type Scene uint8
const (
    SceneViewLog     Scene = 0x10
    SceneShareCreate Scene = 0x20
)

type RiskRequest struct {
    Scene      Scene
    TargetID   string
    RawBody    []byte           // 二进制信封
    ClientIP   string
    UserAgent  string
    AcceptLang string
    SecFetch   SecFetchHeaders
}

type Decision int
const (
    DecisionAccept Decision = iota
    DecisionSilent          // 静默 204（黑名单/dedup）
    DecisionRateLimited     // 429
    DecisionBadRequest      // 400
    DecisionInternal        // 500
)

type Outcome struct {
    Decision      Decision
    Reason        string         // L1_UA_BLACKLIST / BEH_BOT_LIKE / ...
    Score         int
    Fingerprint   string         // 解出的 fpHex
    PayloadFields map[uint8][]byte
    HTTPStatus    int            // 直接返回的 HTTP 状态码
}

type Engine interface {
    Evaluate(ctx context.Context, req *RiskRequest) (*Outcome, error)
}
```

### 6.3 主流程

```go
func (e *engine) Evaluate(ctx context.Context, req *RiskRequest) (*Outcome, error) {
    // 1. 解码信封头部 → 拿到 RSA(aes_key+iv+nonce)、ciphertext、tag
    env, err := decodeEnvelope(req.RawBody)
    if err != nil {
        return badRequest("ENV_DECODE_FAIL"), nil
    }

    // 2. 校验 magic + version + scene 与 URL 一致
    if env.Scene != uint8(req.Scene) {
        return badRequest("SCENE_MISMATCH"), nil
    }

    // 3. RSA-OAEP 解出 K + iv + nonce
    keyMaterial, err := e.km.Decrypt(env.RsaCiphertext)
    if err != nil {
        return badRequest("RSA_FAIL"), nil
    }
    aesKey, iv, nonceSeed := parseKeyMaterial(keyMaterial)

    // 4. AES-256-GCM 解出 payload
    plaintext, err := aesGcmOpen(aesKey, iv, env.Tag, env.Ciphertext)
    if err != nil {
        return badRequest("AES_FAIL"), nil
    }

    // 5. HMAC 校验信封完整性 + build_hash 校验
    if !verifyHmac(req.RawBody, aesKey, e.expectedBuildHashes) {
        return badRequest("HMAC_FAIL"), nil
    }

    // 6. 解析 TLV
    fields, err := parseTLV(plaintext)
    if err != nil {
        return badRequest("TLV_FAIL"), nil
    }

    fpHex := string(fields[0x04])
    targetID := string(fields[0x05])
    nonce := fields[0x03]
    tsMs := int64(binary.BigEndian.Uint64(fields[0x02]))
    summary := parseSummary(fields[0x07])

    // 7. 校验 targetId 与 URL 一致
    if targetID != req.TargetID {
        return badRequest("TARGET_MISMATCH"), nil
    }

    // 8. ts ±2min
    if abs64(time.Now().UnixMilli()-tsMs) > 120_000 {
        return badRequest("TS_SKEW"), nil
    }

    // 9. nonce SETNX
    if !e.store.NonceTrySet(ctx, req.Scene, nonce, 60*time.Second) {
        return badRequest("NONCE_REPLAY"), nil
    }

    // 10. L1 黑名单
    if hit, reason := e.rules.checkL1(req); hit {
        return silent(reason), nil
    }

    // 11. L2 评分
    score := e.rules.checkL2(req, fields)
    if score < 60 {
        return silent("L2_SCORE_LOW"), nil
    }

    // 12. L3 频控 + 主去重
    if hit, reason := e.store.RateAndDedup(ctx, req.Scene, fpHex, req.ClientIP, targetID); hit {
        if reason == "DEDUP" {
            return silent("L3_DEDUP"), nil
        }
        return rateLimited(reason), nil
    }

    // 13. L4 行为评分
    if score, reason := e.behavior.Evaluate(summary, fields[0x08]); score < 50 {
        return silent("L4_BEHAVIOR_BOT_" + reason), nil
    }

    return &Outcome{
        Decision:    DecisionAccept,
        Score:       score,
        Fingerprint: fpHex,
        HTTPStatus:  204,
    }, nil
}
```

### 6.4 行为评分（behavior.go）

```go
// 输入：摘要 + 原始事件流
// 输出：score(0-100) + reason
func (b *behaviorEvaluator) Evaluate(s *Summary, raw []byte) (int, string) {
    if s.SampleCount < 5 {
        return 0, "TOO_FEW_SAMPLES"
    }
    score := 100

    // 规则1：速度全 0 或近常数
    if s.MouseSpeedStd < 0.05 && s.SampleCount > 20 {
        score -= 40   // 几乎绝对匀速 → 强 bot 信号
    }
    // 规则2：抖动指数过低
    if s.MouseJerkMean < 0.001 {
        score -= 30
    }
    // 规则3：极端短的点击 dwell
    if s.ClickCount > 0 && s.ClickDwellMeanMs < 30 {
        score -= 25
    }
    // 规则4：键间飞行时间方差为 0
    if s.KeydownCount > 5 && s.KeyFlightMeanMs > 0 && /* keystrokes 太规律 */ {
        score -= 30
    }
    // 规则5：完全无任何事件（headless 默认）
    if s.SampleCount == 0 && (s.ClickCount + s.KeydownCount + s.WheelCount) == 0 {
        score -= 60
    }
    // 规则6：曾切到背景 / 失焦反而是真人特征
    if s.Flags&0x01 != 0 || s.Flags&0x02 != 0 {
        score += 10
    }

    if score < 0 { score = 0 }
    if score > 100 { score = 100 }
    return score, fmt.Sprintf("score=%d", score)
}
```

阈值需要根据上线后真实样本调整，初版**保守**（score < 50 才拒），降低误杀。

### 6.5 Handler 改造

view-log：

```go
// handler/viewlog/viewlog.go
func (h *handler) PostViewLog(c *gin.Context) {
    c.Header("Cache-Control", "no-store, private")
    articleID := c.Param("id")
    if articleID == "" { c.JSON(400, ...); return }

    body, err := io.ReadAll(io.LimitReader(c.Request.Body, 16*1024)) // 上限 16KB
    if err != nil { c.JSON(400, ...); return }

    out, err := h.guard.Evaluate(c.Request.Context(), &guard.RiskRequest{
        Scene:      guard.SceneViewLog,
        TargetID:   articleID,
        RawBody:    body,
        ClientIP:   c.ClientIP(),
        UserAgent:  c.Request.UserAgent(),
        AcceptLang: c.GetHeader("Accept-Language"),
        SecFetch:   parseSecFetch(c),
    })
    if err != nil { c.JSON(500, ...); return }

    if out.Decision == guard.DecisionAccept {
        if err := h.counter.Increment(c, articleID); err != nil { c.JSON(500, ...); return }
    }
    h.audit.Log(c, guard.SceneViewLog, out)

    if out.HTTPStatus == 204 { c.Status(204); return }
    c.JSON(out.HTTPStatus, gin.H{"code": ..., "message": out.Reason})
}
```

share：类似，accept 时 INSERT 一条分享记录。

### 6.6 BUILD_HASH 校验

```go
type buildHashRegistry struct {
    accepted map[[8]byte]struct{}    // 当前接受的多个版本（灰度期间多版本共存）
    expire   map[[8]byte]time.Time
    mu       sync.RWMutex
}
```

由后台运维通过 admin 接口 / config reload 维护；旧版本在新版本上线 7 天后自动下线。

---

## 7. 安全与合规

### 7.1 隐私合规

| 数据 | 存储位置 | 存储时长 | 是否脱敏 |
|---|---|---|---|
| fingerprintId | Redis 频控 key（不持久化） | 60s~1h | 已是 hash |
| 行为原始事件 | **不入库** | 仅在请求路径上短暂存在 | — |
| 行为摘要 | zap 审计日志 | 30 天后归档/删除 | 仅聚合值，无坐标 |
| IP | zap 审计日志 | 30 天 | **必须脱敏**（去末段） |
| UserAgent | zap 审计日志 | 30 天 | 截断到 256B |

**行动项：**
- 隐私政策文档新增"行为分析" 段落
- 提供 cookie banner 中 opt-out 选项（拒绝时退化为现有 RSA 简版方案）
- 已登录用户可豁免（信任度更高）

### 7.2 抗逆向（持续维护）

- **每月轮换 RSA 密钥**（KeyManager 已支持，加 cron）
- **每发版重生成 build_hash**，老版本后端宽限期 7 天
- **关键字检测**纳入 CI（见 4.5 节脚本）
- 线上不发 sourcemap

### 7.3 防回放

- 信封中的 nonce 已 SETNX 60s
- ts ±2min 校验
- 同一 fingerprint+target 60s 内只 accept 一次（dedup）

### 7.4 防 DoS

- 16KB body 上限
- WASM 解码失败的请求纳入 IP 频控（避免攻击者用乱码请求把后端拖慢）
- 后端 Engine 每步都有超时（ctx 由 gin 全局 3s 控制）

---

## 8. 监控与告警

### 8.1 指标埋点

| 指标 | 上报方式 | 告警阈值 |
|---|---|---|
| 各 reason 计数（L1/L2/L3/L4） | Prometheus counter | 单 reason 5 分钟突增 5x → 告警 |
| 真人误杀率（accept_rate） | Prometheus gauge | < 90% → P1 告警 |
| WASM 加载失败次数 | sentry / 自建 | > 1% PV → P2 告警 |
| 行为评分分布 | histogram | 中位数突变 → 通知 |
| nonce 重放命中数 | counter | 持续高位 → 排查 |
| 每个 build_hash 的占比 | counter | 老版本不下降 → 推动用户刷新 |

### 8.2 灰度

- 上线时：先按 5% IP hash 启用新链路；有问题立即回滚到老 RSA 链路
- 后端**双链路同存**：兼容老 token JSON 与新二进制信封（按 magic 字节判别）
- 前端**功能开关**：`runtimeConfig.public.guardV1Enabled`，可远程关闭

---

## 9. 测试与验证

### 9.1 自动化测试

| 类型 | 工具 | 覆盖 |
|---|---|---|
| Rust 单元测试 | `cargo test` | 加密往返、TLV 编解码、行为特征算法 |
| Rust ↔ Go 协议测试 | 共享测试向量（fixtures/*.bin） | 双方按同一组明文/密文对运行 |
| 前端集成测试 | Vitest + jsdom + happy-dom | useClientGuard 在伪环境下能产出合法 envelope |
| E2E | Playwright | 真实浏览器跑文章详情/分享流程，断言 200 |
| **对抗性测试** | 自写 Puppeteer / Playwright 脚本 | 模拟 bot 请求，断言被拒 |
| 回归测试 | curl 脚本 | 常见错误信封（空 body、错 magic、错 build_hash）能正确返回 400 |

### 9.2 验收标准

| 维度 | 期望 |
|---|---|
| 真人 PV +1 成功率 | ≥ 99% |
| Puppeteer 默认 PV +1 成功率 | ≤ 5% |
| view-log 端到端延迟（含 WASM） | P95 < 50ms |
| WASM 包体积 | gzip 后 < 200KB |
| 后端单请求 CPU | < 5ms（含 RSA + AES + 行为评分） |
| 后端 QPS 容量（单实例） | ≥ 200 QPS（受 RSA 限制） |
| 关键字检测脚本 | 0 命中 |

---

## 10. 迁移与回滚策略

### 10.1 阶段计划

| 阶段 | 时间 | 内容 | 流量比例 |
|---|---|---|---|
| Phase 0 | T-2 周 | crypto-wasm 仓库立项；产出 Rust 加解密 + 协议固件；与 Go 后端跑通 fixtures 互通 | — |
| Phase 1 | T-1 周 | 后端 guard 包上线（双链路兼容老 RSA token） | 0% |
| Phase 2 | T 日 | 前端 view-log 接入新链路，灰度 5% | 5% |
| Phase 3 | T+3 日 | 灰度 25% → 50% → 100% | 100% |
| Phase 4 | T+1 周 | JSON 分享接入新链路 | 100% |
| Phase 5 | T+2 周 | 老 RSA token 链路标记 deprecated；T+4 周删除 | — |

### 10.2 回滚

- 任意时刻可关 `runtimeConfig.public.guardV1Enabled`
- 后端老链路保留 4 周，发现问题立刻把流量打回老链路
- WASM 资源用 immutable cache + version 路径（`/guard/v1/guard_core_bg.wasm`），新版本走新路径，避免缓存污染

---

## 11. 工作量评估

| 模块 | 工作量 | 说明 |
|---|---|---|
| crypto-wasm Rust 工程 | 4 人日 | 含编码、单测、构建脚本、CI |
| 协议 fixtures 与互通 | 1 人日 | 双向用例 |
| 前端 BehaviorRecorder | 2 人日 | |
| 前端 useClientGuard + Worker | 2 人日 | |
| 文章详情页接入 | 0.5 人日 | |
| ShareDialog 接入 | 1 人日 | |
| 后端 guard.Engine | 4 人日 | |
| 后端 view-log handler 改造 | 0.5 人日 | |
| 后端 share handler 改造 | 1 人日 | |
| 监控埋点 + 灰度开关 | 1 人日 | |
| 自动化 + 对抗测试 | 2 人日 | |
| 文档 / 隐私合规 | 1 人日 | |
| 灰度上线 + 调阈值 | 持续 1~2 周 | |

**合计：核心开发约 20 人日**，加上灰度调优合计 4~5 周可以收口 v1。

---

## 12. 文件清单（最终落地视图）

### 新建
- `crypto-wasm/`（整个仓库）
- `portal-web/composables/useClientGuard.ts`
- `portal-web/composables/useBehaviorRecorder.ts`
- `portal-web/workers/guard.worker.ts`
- `portal-web/public/guard/{guard_core_bg.wasm, guard_core.js, version.json}`
- `meta-api/common/guard/{engine.go, envelope.go, decrypt.go, rules.go, behavior.go, store.go, audit.go, types.go, builds.go}`

### 改造
- `portal-web/pages/article-detail/[id].vue`：替换打点逻辑
- `portal-web/components/JsonTool/ShareDialog.vue`：替换签名逻辑
- `portal-web/utils/fingerprint.ts`：去掉自己的 jsencrypt（仅保留指纹采集），加密委托给 WASM
- `portal-web/server/api/keys.ts`：保留（公钥下发渠道不变）
- `meta-api/app/handler/viewlog/viewlog.go`：调 `guard.Engine`
- `meta-api/app/handler/share/share.go`：调 `guard.Engine`
- `meta-api/app/router/router.go`：DI 注入 guard.Engine
- `meta-api/app/di/di.go`：声明 Engine、Store、KeyManager 依赖
- `meta-api/common/middlewares/`：保留现有，不改

### 删除（最终下线）

- `meta-api/app/service/viewlog/`：全部 → 拆分到 `common/guard` 与 `app/service/viewlog/counter`（仅保留 counter+audit）
- `portal-web/utils/fingerprint.ts` 中的 jsencrypt 相关代码
- `portal-web/components/JsonTool/ShareDialog.vue` 中手工拼 `x-client-id` Header 的逻辑

---

## 13. 风险与对策

| 风险 | 概率 | 影响 | 对策 |
|---|---|---|---|
| WASM 加载在 iOS Safari 旧版本失败 | 中 | 中 | 检测 `WebAssembly` 不存在则降级到现有 RSA token |
| 真人误杀率超出预期 | 中 | 高 | 灰度逐步放量；评分阈值偏保守开始 |
| 隐私监管投诉 | 低 | 高 | 隐私政策落地、提供 opt-out、内部法务过审 |
| 攻击者快速逆向 WASM | 中 | 中 | 月度 RSA 轮换 + 季度 WASM 算法小改 |
| 行为评分算法不稳定 | 中 | 中 | 后端规则可热更（独立配置文件 + 信号 reload） |
| Worker 加载失败导致页面卡 | 低 | 中 | 主线程兜底（同步加载 WASM）+ 总超时 5s |
| 前后端 build_hash 不一致 | 中 | 高 | builds.go 维护多版本白名单；CI 自动 PR 更新 |

---

## 14. 一句话总结

这套方案在你现有的"FingerprintJS + RSA token + 黑名单/评分/频控/dedup"骨架上做的是**协议升级与加固**，而不是推倒重来：
- 加密：单 RSA → AES+RSA 混合 + WASM 封装 + 二进制信封
- 输入：纯指纹 → 指纹 + 元数据 + **3 秒/全程行为流**
- 风控：硬编码 4 层 → 通用 Engine（**复用到分享场景**）+ 可热更阈值
- 安全：明文 JS 调 jsencrypt → WASM 二进制 + 字符串加密 + build_hash 校验 + 月度密钥轮换

整套方案与你现有的 KeyManager / cachekey / counter / cron 持久化能力完全兼容，是"可以小步上线、随时回滚"的工程方案。
