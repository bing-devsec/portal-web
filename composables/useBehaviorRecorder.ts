/**
 * 行为采集器（spec §5.2）
 *
 * 采集策略：
 *   - mousemove：按 50ms 节流，记录相对前一条事件的 dt(ms) 与 dx/dy(像素，clamp 到 i8)
 *   - mousedown / mouseup / click：完整记录（用于评分中的 dwell 与 click_count）
 *   - wheel：按 80ms 节流，meta 编码 deltaY 量级（i8 限幅）
 *   - keydown / keyup：完整记录（不携带 keyCode，避免泄漏密码键）
 *   - focus / blur：记录切换（用于评分时上调"真人"分）
 *   - visibilitychange：记录前后台切换（meta=0x01 hidden / 0x00 visible）
 *
 * 输出：
 *   serialize() 返回与 Rust 端 crypto-wasm 对齐的二进制格式：
 *     每条事件 6B：type(1) | dt(2 BE) | dx(1 i8) | dy(1 i8) | meta(1)
 *
 * 关键点：
 *   - 容量上限 MAX_EVENTS，超出按 FIFO 丢弃（保留最近 N 条），避免内存膨胀
 *   - serialize 不会清空 buf，可重复调用（用于灰度期间双签名调试）
 *   - stop() 后再调 serialize() 仍合法（buf 仍在）
 *
 * 与 Rust 端 behavior.rs 中 EVT_LEN/事件类型常量严格对齐，任何修改需同步双方。
 */

const EVT_LEN = 6;
const MAX_EVENTS = 600; // ~10s 余量（mousemove 50ms 一条 = 200/10s）
const MOUSEMOVE_INTERVAL_MS = 50;
const WHEEL_INTERVAL_MS = 80;

// 事件类型常量（与 crypto-wasm/src/behavior.rs 对齐）
const T_MOUSEMOVE = 0x10;
const T_MOUSEDOWN = 0x11;
const T_MOUSEUP = 0x12;
const T_CLICK = 0x13;
const T_WHEEL = 0x20;
const T_KEYDOWN = 0x30;
const T_KEYUP = 0x31;
const T_FOCUS = 0x40;
const T_BLUR = 0x41;
const T_VISIBILITY = 0x50;
// End-marker：序列化时追加一条"非真实事件"，让 wasm 端 duration_ms 累加到
// 真实墙钟时长（stop 时刻 - start 时刻），而不是"最后一条事件的累计 dt"。
//
// 背景：wasm/behavior.rs 的 duration_ms = 末次事件的 t_cum，对"PC 静读用户
// 3 秒不动键鼠"这类场景会得到 0ms，被后端 MinDwellMs(3000) 误判 DWELL_TOO_SHORT。
// 追加 end-marker 后 t_cum 推进到真实墙钟，根因被消除。
//
// 为什么用 0xFF：
//   - wasm 现有 match 的 `_ => 忽略` 分支会保留 sample_count 但不做任何统计累加，
//     即"安全的未知 type"——前端单边升级即可生效，build_hash 不变，免重建 wasm。
//   - 副作用：sample_count 多 1（5 阈值的 WEAK_SAMPLES 判定不会被打破）。
//   - v1.2 wasm 灰度时再让 0xFF 跳过 sample_count 累加，让语义彻底干净。
const T_END_MARKER = 0xff;

interface RawEvent {
    type: number;
    /** 事件相对 startedAt 的毫秒时间戳，serialize 时换算成 dt */
    t: number;
    /** 鼠标 x 坐标（像素，serialize 时换算成 dx 并 clamp 到 i8） */
    x: number;
    /** 鼠标 y 坐标（像素） */
    y: number;
    meta: number;
}

export interface BehaviorRecorder {
    start(): void;
    stop(): void;
    /** 序列化为 6B/event 二进制，可在 stop 后调用；不会清空内部缓存 */
    serialize(): Uint8Array;
    /** 当前已采集事件数（仅用于本地调试） */
    size(): number;
    /** 是否处于 active 状态（仅用于本地调试） */
    isActive(): boolean;
}

/**
 * 创建行为采集器。
 *
 * 注意：必须在 client-side 环境调用（依赖 window/document/performance）；
 * 在 SSR 环境下调用会抛错，调用方需用 process.client 守卫。
 */
export function createBehaviorRecorder(): BehaviorRecorder {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
        throw new Error('createBehaviorRecorder must be called in client-side');
    }

    const buf: RawEvent[] = [];
    let startedAt = 0;
    let lastMoveAt = 0;
    let lastWheelAt = 0;
    let lastX = 0;
    let lastY = 0;
    let active = false;

    const push = (e: RawEvent) => {
        if (buf.length >= MAX_EVENTS) buf.shift();
        buf.push(e);
    };

    const onMove = (e: MouseEvent) => {
        if (!active) return;
        const now = performance.now();
        if (now - lastMoveAt < MOUSEMOVE_INTERVAL_MS) return;
        lastMoveAt = now;
        push({ type: T_MOUSEMOVE, t: now - startedAt, x: e.clientX, y: e.clientY, meta: 0 });
    };

    const onMouseDown = (e: MouseEvent) => {
        if (!active) return;
        push({ type: T_MOUSEDOWN, t: performance.now() - startedAt, x: e.clientX, y: e.clientY, meta: 0 });
    };

    const onMouseUp = (e: MouseEvent) => {
        if (!active) return;
        push({ type: T_MOUSEUP, t: performance.now() - startedAt, x: e.clientX, y: e.clientY, meta: 0 });
    };

    const onClick = (e: MouseEvent) => {
        if (!active) return;
        push({ type: T_CLICK, t: performance.now() - startedAt, x: e.clientX, y: e.clientY, meta: 0 });
    };

    const onWheel = (e: WheelEvent) => {
        if (!active) return;
        const now = performance.now();
        if (now - lastWheelAt < WHEEL_INTERVAL_MS) return;
        lastWheelAt = now;
        // deltaY 缩到 i8 范围；保留符号
        const sign = e.deltaY < 0 ? -1 : 1;
        const magnitude = Math.min(127, Math.abs(Math.round(e.deltaY / 10)));
        const meta = sign < 0 ? (256 - magnitude) & 0xff : magnitude;
        push({ type: T_WHEEL, t: now - startedAt, x: 0, y: 0, meta });
    };

    const onKeyDown = (_: KeyboardEvent) => {
        if (!active) return;
        push({ type: T_KEYDOWN, t: performance.now() - startedAt, x: 0, y: 0, meta: 0 });
    };

    const onKeyUp = (_: KeyboardEvent) => {
        if (!active) return;
        push({ type: T_KEYUP, t: performance.now() - startedAt, x: 0, y: 0, meta: 0 });
    };

    const onFocus = () => {
        if (!active) return;
        push({ type: T_FOCUS, t: performance.now() - startedAt, x: 0, y: 0, meta: 0 });
    };

    const onBlur = () => {
        if (!active) return;
        push({ type: T_BLUR, t: performance.now() - startedAt, x: 0, y: 0, meta: 0 });
    };

    const onVisibility = () => {
        if (!active) return;
        const meta = document.visibilityState === 'hidden' ? 0x01 : 0x00;
        push({ type: T_VISIBILITY, t: performance.now() - startedAt, x: 0, y: 0, meta });
    };

    return {
        start() {
            if (active) return; // 防重复 start
            startedAt = performance.now();
            lastMoveAt = 0;
            lastWheelAt = 0;
            lastX = 0;
            lastY = 0;
            buf.length = 0;
            active = true;
            window.addEventListener('mousemove', onMove, { passive: true });
            window.addEventListener('mousedown', onMouseDown, { passive: true });
            window.addEventListener('mouseup', onMouseUp, { passive: true });
            window.addEventListener('click', onClick, { passive: true });
            window.addEventListener('wheel', onWheel, { passive: true });
            window.addEventListener('keydown', onKeyDown, { passive: true });
            window.addEventListener('keyup', onKeyUp, { passive: true });
            window.addEventListener('focus', onFocus, { passive: true });
            window.addEventListener('blur', onBlur, { passive: true });
            document.addEventListener('visibilitychange', onVisibility);
        },
        stop() {
            if (!active) return;
            active = false;
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mousedown', onMouseDown);
            window.removeEventListener('mouseup', onMouseUp);
            window.removeEventListener('click', onClick);
            window.removeEventListener('wheel', onWheel);
            window.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('keyup', onKeyUp);
            window.removeEventListener('focus', onFocus);
            window.removeEventListener('blur', onBlur);
            document.removeEventListener('visibilitychange', onVisibility);
        },
        serialize() {
            // 末尾追加一条 end-marker，让 wasm 端 duration_ms 推进到实际墙钟时长。
            // startedAt==0 视为 start() 未调用，跳过追加，避免给 duration_ms 注入异常值。
            const wallNow = performance.now();
            const wallDurationMs = startedAt > 0 ? Math.max(0, wallNow - startedAt) : 0;
            return encodeBinary(buf, wallDurationMs);
        },
        size() {
            return buf.length;
        },
        isActive() {
            return active;
        },
    };
}

/**
 * 把事件序列化为 6B/event 紧凑二进制：
 *   type(1) | dt(2 BE) | dx(1 i8) | dy(1 i8) | meta(1)
 *
 * dt   = 当前事件 t - 上一条事件 t（首条相对 0），clamp 到 [0, 65535]
 * dx/dy = 相对上一条事件的位移，clamp 到 [-127, 127]
 *
 * 末尾追加 end-marker 事件（type=T_END_MARKER, dt=wallDurationMs - 末次事件 t）：
 *   - 让 wasm/behavior.rs 的 t_cum 推进到真实墙钟时长，duration_ms 不再为 0。
 *   - wasm 现有 match 的 `_ => 忽略` 分支会跳过 end-marker 的统计累加，安全。
 *   - wallDurationMs <= 末次事件 t 时跳过 end-marker（避免 dt=0 噪声）。
 */
function encodeBinary(events: RawEvent[], wallDurationMs: number): Uint8Array {
    let lastT = 0;
    if (events.length > 0) lastT = events[events.length - 1].t;
    const appendEnd = wallDurationMs > lastT;
    const total = events.length + (appendEnd ? 1 : 0);
    const out = new Uint8Array(total * EVT_LEN);
    const view = new DataView(out.buffer);
    let prevT = 0;
    let prevX = 0;
    let prevY = 0;
    for (let i = 0; i < events.length; i++) {
        const e = events[i];
        const off = i * EVT_LEN;
        const dt = clampU16(Math.max(0, Math.round(e.t - prevT)));
        const dx = clampI8(Math.round(e.x - prevX));
        const dy = clampI8(Math.round(e.y - prevY));
        view.setUint8(off, e.type);
        view.setUint16(off + 1, dt, false); // big-endian
        view.setInt8(off + 3, dx);
        view.setInt8(off + 4, dy);
        view.setUint8(off + 5, e.meta & 0xff);
        prevT = e.t;
        prevX = e.x;
        prevY = e.y;
    }
    if (appendEnd) {
        const off = events.length * EVT_LEN;
        const dt = clampU16(Math.round(wallDurationMs - prevT));
        view.setUint8(off, T_END_MARKER);
        view.setUint16(off + 1, dt, false);
        view.setInt8(off + 3, 0);
        view.setInt8(off + 4, 0);
        view.setUint8(off + 5, 0);
    }
    return out;
}

function clampU16(v: number): number {
    if (!Number.isFinite(v)) return 0;
    if (v < 0) return 0;
    if (v > 0xffff) return 0xffff;
    return v;
}

function clampI8(v: number): number {
    if (!Number.isFinite(v)) return 0;
    if (v > 127) return 127;
    if (v < -128) return -128;
    return v;
}
