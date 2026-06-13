# 风控守卫 v1.1：view-log 行为分误伤修复方案

> 关联文档：
>
> - [`anti-bot-guard-v1-spec.md`](./anti-bot-guard-v1-spec.md)
> - [`anti-bot-guard-v1-deploy.md`](./anti-bot-guard-v1-deploy.md)
>
> 适用版本：在 v1 基础上演进至 v1.1，不引入信封协议变更（除步骤 4 新增事件类型外，其余均向前兼容）。

***

## 0. TL;DR

线上发现移动端真实用户浏览文章时浏览量不+1，根因为：

> 行为分（L4）被错误地用作 view-log 场景的**硬拒绝阈值**；而被动浏览（PC 静读 / 移动端不滑动 / 用户秒退）天然可能 3 秒内零交互，导致 `SampleCount < 5 && !VisibilityHidden` 命中 `TOO_FEW_SAMPLES` 全量拦截。

**修复策略**：在不削弱 share-create 防御强度的前提下，把 view-log 场景的 L4 从"硬拒"重构为"软扣分"，并补齐采集面 + 正向信号 + pagehide 兜底，使决策由多维证据合议得出。

***

## 1. 问题定义

### 1.1 现象

线上日志：

```json
{"level":"WARN","msg":"guard_eval","scene":"view-log",
 "decision":1,"reject_reason":"L4_BEHAVIOR:TOO_FEW_SAMPLES","score":70,
 "user_agent":"...Android 16...MicroMessenger..."}
```

移动端微信用户访问文章详情页，HTTP 返回 204（业务侧把 reject 静默化），但浏览量未递增。

### 1.2 根因分析

代码路径：[`common/guard/behavior.go`](../../meta-api/common/guard/behavior.go) `Evaluate`

```go
if s.SampleCount < 5 && s.Flags&BehaviorFlagVisibilityHidden == 0 {
    return 25, "TOO_FEW_SAMPLES"
}
```

前端 [`composables/useBehaviorRecorder.ts`](../composables/useBehaviorRecorder.ts) 仅监听 PC 端事件：

```text
mousemove / mousedown / mouseup / click / wheel / keydown / keyup
focus / blur / visibilitychange
```

**两个独立缺陷叠加导致误伤**：

| 缺陷            | 说明                                                            | 影响场景               |
| ------------- | ------------------------------------------------------------- | ------------------ |
| **C1** 采集面缺失  | 不监听 `touch*` / `scroll` / `resize`，移动端正常滑动也产生 0 个 SampleCount | 所有移动端              |
| **C2** 决策模型错位 | 行为分作为 view-log 的硬阈值；但"被动浏览"语义上不要求交互                           | PC 静读 / 移动端静读 / 秒退 |

### 1.3 误伤场景矩阵

| # | 设备       | 行为                     | 当前 3s 窗口内事件                | 当前判决                      | 期望判决  |
| - | -------- | ---------------------- | -------------------------- | ------------------------- | ----- |
| 1 | PC       | 鼠标完全不动，仅阅读封面/标题        | 无                          | ❌ TOO\_FEW\_SAMPLES       | ✅ +1  |
| 2 | PC       | 滚动文章                   | mousemove + wheel          | ✅ +1                      | ✅ +1  |
| 3 | PC       | 立刻 alt-tab 切走          | visibilitychange           | ✅ +1（hidden flag）         | ✅ +1  |
| 4 | 移动端      | 不滑动屏幕                  | 无                          | ❌ TOO\_FEW\_SAMPLES       | ✅ +1  |
| 5 | 移动端      | 滑动文章                   | （应有 touch/scroll，但**未监听**） | ❌ TOO\_FEW\_SAMPLES       | ✅ +1  |
| 6 | 移动端      | 立刻切回聊天                 | visibilitychange           | ✅ +1                      | ✅ +1  |
| 7 | 任意       | 后台 prerender / preload | 无 + Flags=0                | ❌ TOO\_FEW\_SAMPLES（恰好正确） | ❌ 不+1 |
| 8 | headless | 直接 fetch 信封            | 无                          | ❌ 拒绝                      | ❌ 拒绝  |
| 9 | headless | 伪造少量 mousemove         | 假事件                        | ⚠️ 可能放过                   | ❌ 拒绝  |

误伤场景：**#1 #4 #5**；其中 #5 是 C1 直接造成，#1 #4 是 C2 造成（即使加 touch 也救不了）。

***

## 2. 设计原则

1. **不收紧 share-create**：share-create 必有 click 交互，行为分硬阈值合理，保持现状。
2. **view-log 多维证据合议**：行为分降级为软信号，与 L1（IP/UA 黑名单）、L2（综合扣分）、L3（dedup）共同决策。
3. **客户端采集面补齐 PC + 移动**：所有真实用户在合理交互下都应产生 ≥1 个事件。
4. **客户端兜底打点**：用户秒退时通过 `pagehide` / `visibilitychange→hidden` 抢救发送当前 buf。
5. **正向信号**：除"扣分"外引入"加分项"，提高真人下限。
6. **保持向前兼容**：信封协议字段保持原样；新增事件类型 type 编号不冲突即可。

***

## 3. 总体方案

```text
┌─────────────────────────────────────────────────────────────┐
│                       view-log 决策链                        │
└─────────────────────────────────────────────────────────────┘

  请求进入 ─► L1 黑名单（保持） ─► L2 综合分（扩充正向信号）─►
            └─► L3 dedup（保持） ─► L4 行为分（重构为软扣分）─►
            └─► 综合决策：if finalScore < L2ScoreThreshold → reject

┌─────────────────────────────────────────────────────────────┐
│                     share-create 决策链                      │
└─────────────────────────────────────────────────────────────┘

  保持 v1 现状不动。
```

5 个改动点：

| 编号    | 模块                           | 改动                                                  | 部署影响                       |
| ----- | ---------------------------- | --------------------------------------------------- | -------------------------- |
| **A** | meta-api L4                  | view-log 场景 L4 改为软扣分；TOO\_FEW\_SAMPLES 分级           | 仅后端重启                      |
| **B** | meta-api L2                  | 增加正向信号加分项                                           | 仅后端重启                      |
| **C** | portal-web 采集器               | `pagehide` / `visibilitychange→hidden` 兜底打点         | 仅前端发版（不动 wasm）             |
| **D** | portal-web 采集器 + crypto-wasm | 新增 `T_TOUCHSTART/MOVE/END` `T_SCROLL` `T_RESIZE` 事件 | 前端 + wasm + build\_hash 灰度 |
| **E** | meta-api 行为评估                | 新事件类型纳入 SampleCount / 真人评分                          | 后端 + wasm 双端同步             |

执行顺序：**A → B → C → D（含 E）**。前三步独立可部署，每一步都使线上更好；D/E 是闭环长期方案，需走灰度。

***

## 4. 详细方案

### 4.1 改动 A：view-log L4 改为软扣分

#### 4.1.1 现状

[`common/guard/behavior.go`](../../meta-api/common/guard/behavior.go) `Evaluate` 返回 `(score, reason)`，引擎层 [`engine.go`](../../meta-api/common/guard/engine.go) 在 view-log 路径直接对比 `BehaviorScoreThreshold`，低于则 reject。

#### 4.1.2 目标

`Evaluate` 不变（仍返回 score），但**引擎层在 view-log 场景不再单独以 L4 score reject**，改为把 L4 score 作为权重并入 L2 综合分。share-create 路径保持原行为。

#### 4.1.3 代码改动

**1)** **`common/guard/behavior.go`** —— 把 `TOO_FEW_SAMPLES` 改成分级，提供更细的负向信号：

```go
// 全静止 3s 且无任何 Flag → 强 bot 信号（仅 headless 可能）
if s.SampleCount == 0 && s.ClickCount == 0 && s.WheelCount == 0 &&
   s.KeydownCount == 0 && s.Flags == 0 && s.DurationMs > 2500 {
    return 30, "ALL_ZERO_LONG"
}

// 早退（用户秒退 / 切走）：不能判 bot，但也不奖励
if s.Flags&(BehaviorFlagVisibilityHidden|BehaviorFlagBlur) != 0 {
    return 70, "EARLY_LEAVE_OK"
}

// 弱采样（< 5 但有 Flag 或非零事件）→ 弱信号
totalEvents := uint32(s.SampleCount) + uint32(s.ClickCount) +
               uint32(s.KeydownCount) + uint32(s.WheelCount)
if s.SampleCount < 5 && totalEvents == 0 {
    return 60, "WEAK_SAMPLES"
}

// 余下走原 SPEED_CONST / JERK_LOW / CLICK_FAST / KEY_FAST 规则集
```

**2)** **`common/guard/engine.go`** —— L4 在 view-log 场景下并入 L2：

```go
behaviorScore, behaviorReason := evaluator.Evaluate(summary, eventsRaw)

if req.Scene == SceneViewLog {
    // 软合议：L4 行为分以加权方式并入 L2 综合分
    // 系数 0.3 表示 L4 占决策的 30% 权重；可后续基于灰度数据调
    finalScore := int(float64(l2Score)*0.7 + float64(behaviorScore)*0.3)
    if finalScore < L2ScoreThreshold {
        return e.rejectWithTS(req, out, DecisionReject,
            fmt.Sprintf("COMBINED:%s", behaviorReason),
            finalScore, clientTSMs, serverNowMs), nil
    }
} else {
    // share-create / 其他需要强交互的场景：保持 L4 硬阈值
    if behaviorScore < BehaviorScoreThreshold {
        return e.rejectWithTS(req, out, DecisionReject,
            "L4_BEHAVIOR:"+behaviorReason,
            behaviorScore, clientTSMs, serverNowMs), nil
    }
}
```

#### 4.1.4 影响评估

| 场景                                 | 改前               | 改后                                       |
| ---------------------------------- | ---------------- | ---------------------------------------- |
| #1 PC 静读，L2 分 95                   | reject（L4=25）    | finalScore = 95×0.7 + 60×0.3 = 84.5 → ✅  |
| #4 移动端不滑，L2 分 90                   | reject（L4=25）    | finalScore = 90×0.7 + 60×0.3 = 81 → ✅    |
| #7 prerender，L2 分 50（sec-fetch 缺失） | 命中 ALL\_ZERO 早就拒 | finalScore = 50×0.7 + 30×0.3 = 44 → ❌ 仍拒 |
| #8 headless 完全 0 事件 + L2 异常分 40    | reject           | finalScore = 40×0.7 + 30×0.3 = 37 → ❌ 仍拒 |

### 4.2 改动 B：L2 增加正向信号加分项

#### 4.2.1 现状

[`common/guard/rules.go`](../../meta-api/common/guard/rules.go) `checkL2Score` 仅有扣分项，起始 100，每项命中扣分。

#### 4.2.2 目标

补充加分项，让真实浏览器用户的"正向特征"被识别，提高 #1 #4 这类弱采集场景的下限分数。

#### 4.2.3 代码改动

**`common/guard/rules.go`** `checkL2Score`：

```go
// 起始改为 80，给加分项留头部空间
score := scoreL2Start  // 新常量 = 80

// 现有扣分项保持

// 新增加分项 ─────────────────────────────────────────────
// + sec-fetch-mode=navigate && site=same-origin 站内跳转 → +5
if req.SecFetch.Mode == "navigate" && req.SecFetch.Site == "same-origin" {
    score += scoreSameOriginNav    // 5
}

// + Referer 来自站内列表/首页 → +5
if isInternalReferer(req.Referer, req.Host) {
    score += scoreInternalRef       // 5
}

// + Accept-Language 与 navigator.language 一致 → +3
if req.Lang != "" && req.SecFetch.AcceptLanguage != "" &&
   langConsistent(req.Lang, req.SecFetch.AcceptLanguage) {
    score += scoreLangMatch         // 3
}

// + UA 是已知主流浏览器（Chrome/Safari/Firefox/Edge/微信内嵌）→ +3
if isKnownRealBrowser(req.UserAgent) {
    score += scoreKnownBrowser      // 3
}

// + perfNav=navigate（非 prerender / preload） → +5
if req.PerfNav == "navigate" {
    score += scorePerfNavigate      // 5
}

// 上限 100
if score > 100 { score = 100 }
return score
```

新常量集中加在 `common/guard/types.go`：

```go
const (
    scoreL2Start          = 80
    scoreSameOriginNav    = 5
    scoreInternalRef      = 5
    scoreLangMatch        = 3
    scoreKnownBrowser     = 3
    scorePerfNavigate     = 5
)
```

`isInternalReferer` / `isKnownRealBrowser` 实现细节：

```go
func isInternalReferer(referer, host string) bool {
    if referer == "" { return false }
    u, err := url.Parse(referer)
    if err != nil { return false }
    return u.Host == host
}

func isKnownRealBrowser(ua string) bool {
    ua = strings.ToLower(ua)
    keywords := []string{"chrome/", "safari/", "firefox/", "edg/",
                          "micromessenger", "mqqbrowser", "ucbrowser"}
    for _, k := range keywords {
        if strings.Contains(ua, k) { return true }
    }
    return false
}
```

#### 4.2.4 影响评估

PC 静读用户典型分数：

- 起始 80
- 站内跳转 +5、内站 referer +5、lang match +3、知名 UA +3、perfNav=navigate +5
- 最终 L2 ≈ 101 截至 100；finalScore = 100×0.7 + 60×0.3 = 88 → ✅

headless 默认无 sec-fetch、Referer 为空、UA 异常：

- 起始 80
- 加分项全不命中；扣分项 sec-fetch 缺失 -5、UA 黑名单可能 -10、lang 缺失 -3
- 最终 L2 ≈ 62；finalScore = 62×0.7 + 30×0.3 = 52.4 → ❌ 拒绝（阈值 60）

### 4.3 改动 C：前端 pagehide / visibilitychange 兜底打点

#### 4.3.1 现状

[`pages/article-detail/[id].vue`](../pages/article-detail/\[id].vue) 仅在 onMounted + 3000ms 后发送 view-log。用户在 3 秒内离开（极常见）→ 永远不发，浏览量丢失。

#### 4.3.2 目标

引入"双触发"：3 秒到 / 用户离开（先到先发），且只发一次。

#### 4.3.3 代码改动

```ts
// 与原 viewLogTimer 同层
let viewLogSent = false;

const sendViewLogOnce = async (reason: 'timer' | 'pagehide' | 'visibility') => {
    if (viewLogSent) return;
    viewLogSent = true;

    // 取消未触发的定时器（避免重复发送）
    cancelPendingViewLog();

    // 标记 EARLY_LEAVE flag 让后端识别（仅 pagehide / visibility 触发时）
    if (reason !== 'timer' && behaviorRecorder) {
        // 在 buf 末尾追加一条 visibilitychange→hidden 事件
        // 这样 wasm summarize 时会命中 BehaviorFlagVisibilityHidden
        // 注意：直接 dispatch 一次模拟事件，让 recorder 自然记录
    }

    await reportViewLog(/* existing logic */);
};

onMounted(() => {
    viewLogTimer = setTimeout(() => sendViewLogOnce('timer'), VIEW_LOG_DELAY_MS);

    // 兜底 1：标签页切到隐藏
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
            sendViewLogOnce('visibility');
        }
    }, { passive: true });

    // 兜底 2：页面卸载（pagehide 比 unload 在移动端更可靠）
    window.addEventListener('pagehide', () => {
        sendViewLogOnce('pagehide');
    }, { passive: true });
});
```

#### 4.3.4 注意事项

- `pagehide` 路径必须用 `fetch + keepalive: true`（已有），保证页面卸载也能送达。
- SPA 路由切换不触发 `pagehide`，但 watch route.params.id 已处理（保持现状）。
- iOS Safari 在页面冻结前可能不触发 `visibilitychange`，**`pagehide`** **是必需的兜底**。
- 重复触发由 `viewLogSent` 单次标志兜底。

### 4.4 改动 D：补齐采集面（前端 + crypto-wasm）

#### 4.4.1 新事件类型

| 名称             | type   | 节流                   | meta 字段含义               |
| -------------- | ------ | -------------------- | ----------------------- |
| `T_TOUCHSTART` | `0x60` | 无                    | 0                       |
| `T_TOUCHMOVE`  | `0x61` | 50ms（与 mousemove 一致） | 0                       |
| `T_TOUCHEND`   | `0x62` | 无                    | 0                       |
| `T_SCROLL`     | `0x70` | 100ms                | scrollY 增量绝对值（clamp i8） |
| `T_RESIZE`     | `0x80` | 无                    | 0（极少触发，每次 push）         |

每条仍是 6B 编码，buf 上限不变（600 条）。

#### 4.4.2 前端改动

`composables/useBehaviorRecorder.ts` 新增事件常量与监听器：

```ts
const T_TOUCHSTART = 0x60;
const T_TOUCHMOVE  = 0x61;
const T_TOUCHEND   = 0x62;
const T_SCROLL     = 0x70;
const T_RESIZE     = 0x80;

const SCROLL_INTERVAL_MS = 100;
let lastScrollAt = 0;
let lastScrollY = 0;

const onTouchStart = (e: TouchEvent) => {
    if (!active || e.touches.length === 0) return;
    const t = e.touches[0];
    push({ type: T_TOUCHSTART, t: performance.now() - startedAt,
           x: t.clientX, y: t.clientY, meta: 0 });
};

const onTouchMove = (e: TouchEvent) => {
    if (!active || e.touches.length === 0) return;
    const now = performance.now();
    if (now - lastMoveAt < MOUSEMOVE_INTERVAL_MS) return;
    lastMoveAt = now;
    const t = e.touches[0];
    push({ type: T_TOUCHMOVE, t: now - startedAt,
           x: t.clientX, y: t.clientY, meta: 0 });
};

const onTouchEnd = (e: TouchEvent) => {
    if (!active) return;
    const t = e.changedTouches[0];
    push({ type: T_TOUCHEND, t: performance.now() - startedAt,
           x: t?.clientX ?? 0, y: t?.clientY ?? 0, meta: 0 });
};

const onScroll = () => {
    if (!active) return;
    const now = performance.now();
    if (now - lastScrollAt < SCROLL_INTERVAL_MS) return;
    lastScrollAt = now;
    const y = window.scrollY || window.pageYOffset || 0;
    const delta = Math.min(127, Math.abs(Math.round((y - lastScrollY) / 10)));
    lastScrollY = y;
    push({ type: T_SCROLL, t: now - startedAt, x: 0, y: 0, meta: delta });
};

const onResize = () => {
    if (!active) return;
    push({ type: T_RESIZE, t: performance.now() - startedAt, x: 0, y: 0, meta: 0 });
};

// start() 中追加
window.addEventListener('touchstart', onTouchStart, { passive: true });
window.addEventListener('touchmove',  onTouchMove,  { passive: true });
window.addEventListener('touchend',   onTouchEnd,   { passive: true });
window.addEventListener('scroll',     onScroll,     { passive: true });
window.addEventListener('resize',     onResize,     { passive: true });
// stop() 中对称 removeEventListener
```

#### 4.4.3 wasm 改动

`crypto-wasm/src/behavior.rs`：

1. 新增 5 个 `EVT_*` 常量，编号与前端对齐。
2. `summarize()` 中：
   - `SampleCount` 改为对 `mousemove + touchmove + scroll` 总和计数（这三类都代表"被动浏览运动"）
   - 新增 `TouchCount`、`ScrollCount`、`ResizeCount` 字段并入 `BehaviorSummary`
3. 同步更新 `behavior.go` 的 `BehaviorSummary` 结构与 `parseSummary`（注意 padding 调整，仍 64B 对齐）。

> 此处 `BehaviorSummary` 结构变更属于**协议演进**，必须走 build\_hash 灰度：
>
> - 新 wasm 发布后，前端 `public/guard/build_hashes.txt` 同时保留新旧两份
> - 后端 `guard.build_hashes` yaml 同时配新旧两个 16-hex
> - 灰度窗口建议 ≥ 7 天，确保浏览器缓存全部刷新
> - 灰度结束后再下线旧 build\_hash

详见 [`anti-bot-guard-v1-deploy.md`](./anti-bot-guard-v1-deploy.md#5-上线步骤) [§5](./anti-bot-guard-v1-deploy.md#5-上线步骤)。

### 4.5 改动 E：后端把新事件纳入 SampleCount 与评分

#### 4.5.1 SampleCount 语义扩展

L4 评分器 [`common/guard/behavior.go`](../../meta-api/common/guard/behavior.go) `Evaluate` 中所有引用 `s.SampleCount` 的地方，语义改为"被动浏览运动事件总数"，即 `mousemove + touchmove + scroll`。

#### 4.5.2 触摸事件特征评估

复用 mouse 系列规则即可（dx/dy 序列形态判断），但常量略有不同（人指滑动 jerk 比鼠标更高，初版可不区分，后续基于真实数据微调）。

***

### 4.6 改动 F：补强 view-log 最小停留时长硬门槛

#### 4.6.1 背景

改动 A + C 落地后，发现一个产品口径问题：用户进文章 1s 内关 tab，前端 `pagehide` 兜底打点会把 `DurationMs ≈ 1000` 的信封送到后端。此时：

* `DurationMs < 2500` → 不会判 `ALL_ZERO_LONG`
* `BehaviorFlag` 不一定带 `VisibilityHidden`（pagehide 与 visibilitychange 时序不稳定）
* 大概率落到 `NO_INTERACTION(50)` 或 `WEAK_SAMPLES(60)`
* 软合议 `(80*70 + 50*30)/100 = 71` → **过 60 阈值 → +1 通过**

但产品层面：**< 3s 即使是真人也算误触/秒退，不应计入 view\_count。** 改动 A 的"软合议"对反爬足够，对产品口径不够。

#### 4.6.2 目标

引入与"软合议"并行的**产品硬门槛**：`DurationMs < MinDwellMs(=3000)` 一律拒，独立拒因码 `VIEWLOG_DWELL_TOO_SHORT`，不参与软合议。

#### 4.6.3 代码改动

**[`common/guard/types.go`](../../meta-api/common/guard/types.go)**：

```go
// MinDwellMs view-log 场景"最小有效停留时长"。低于此值视为无效浏览，
// 直接判 DWELL_TOO_SHORT，不参与软合议（产品口径硬门槛）。
// 与前端 VIEW_LOG_DELAY_MS=3000 对齐。
MinDwellMs uint32 = 3000

// ReasonViewLogDwellTooShort view-log 场景停留时长不足。
// 走独立拒因码（不挂在 VIEWLOG_COMBINED 后），方便监控/审计区分
// "无效浏览（停留过短）" vs "可疑请求（合议不达标）"。
ReasonViewLogDwellTooShort = "VIEWLOG_DWELL_TOO_SHORT"
```

**[`common/guard/behavior.go`](../../meta-api/common/guard/behavior.go)** `Evaluate` 在所有起始分级之前插入最高优先级判断：

```go
// 起始分级 0（最高优先级）：停留时长不足 MinDwellMs 一律视为无效浏览。
if s.DurationMs < MinDwellMs {
    return 0, "DWELL_TOO_SHORT"
}
```

**[`common/guard/engine.go`](../../meta-api/common/guard/engine.go)** `SceneViewLog` 分支首行短路：

```go
case SceneViewLog:
    if behaviorReason == "DWELL_TOO_SHORT" {
        return e.rejectWithTS(req, out, DecisionSilent,
            ReasonViewLogDwellTooShort,
            behaviorScore, clientTSMs, serverNowMs), nil
    }
    // …继续走软合议
```

**[`common/guard/audit.go`](../../meta-api/common/guard/audit.go)** 把 `VIEWLOG_DWELL_TOO_SHORT` 划入 INFO 级（预期拦截，不打 WARN 告警）。

#### 4.6.4 影响评估

| 场景            | DurationMs | 改动前       | 改动后                       |
| ------------- | ---------- | --------- | ------------------------- |
| 用户 1s 关 tab   | ~1000      | +1 通过     | `VIEWLOG_DWELL_TOO_SHORT` 拒 |
| 用户 3s+ 后切走    | ≥3000      | 走 `EARLY_LEAVE_OK` | 不变（≥MinDwellMs 跳过门槛）       |
| 定时器 3s 到点正常发  | ≥3000      | 软合议       | 不变                        |
| Headless 直接 fetch | 0     | 软合议（多被拒） | `VIEWLOG_DWELL_TOO_SHORT` 拒 |

***

## 5. 灰度与部署计划

| 步骤      | 改动    | 部署对象                                | 灰度策略                   | 回滚方式                                        |
| ------- | ----- | ----------------------------------- | ---------------------- | ------------------------------------------- |
| **5.1** | A + B | meta-api                            | 直接发布；线下回归 + 线上观察 30 分钟 | docker compose down meta-api && 切回上版本 image |
| **5.2** | C     | portal-web                          | 直接发布；CDN 缓存 30 分钟内全量生效 | git revert + 重新发布                           |
| **5.3** | D + E | crypto-wasm + portal-web + meta-api | 双 build\_hash 并存灰度 7 天 | 后端 yaml 移除新 hash；前端继续提供新旧 wasm              |

每步独立可上线、独立可回滚。**5.1 上线即可立即解决线上误伤主体**；5.2 收敛秒退用户漏打点；5.3 是长期完善。

***

## 6. 验证清单

### 6.1 真人场景（应 +1）

| # | 设备  | 操作          | 期望日志关键字                                    |
| - | --- | ----------- | ------------------------------------------ |
| 1 | PC  | 进文章 3s 不动   | `WEAK_SAMPLES` 但不 reject；`HTTP 204` 后浏览量+1 |
| 2 | PC  | 进来后空格滚动     | `score≥80`，正常通过                            |
| 3 | PC  | 进来后 alt-tab | `EARLY_LEAVE_OK`；浏览量+1                     |
| 4 | 移动端 | 微信打开不滑动     | `WEAK_SAMPLES`；浏览量+1                       |
| 5 | 移动端 | 上滑文章        | （5.3 后）`SampleCount > 0`；正常通过              |
| 6 | 移动端 | 立刻切回聊天      | `EARLY_LEAVE_OK`；浏览量+1                     |
| 7 | 移动端 | 3 秒内秒退      | `pagehide` 抢救发送；`EARLY_LEAVE_OK`；浏览量+1     |

### 6.2 攻击场景（应拒绝）

| #  | 攻击者                 | 操作               | 期望日志关键字                                        |
| -- | ------------------- | ---------------- | ---------------------------------------------- |
| 8  | headless puppeteer  | 直接 fetch 信封      | `ALL_ZERO_LONG`；reject                         |
| 9  | 伪造少量 mousemove      | 信封带假事件           | L2 综合分被 sec-fetch 缺失等扣分；finalScore < 60；reject |
| 10 | prerender / preload | 浏览器提前预取          | `Flags=0` + perfNav=prerender；L2 扣分；reject     |
| 11 | 同 fp 60s 内重复        | 同一 articleId 短间隔 | `L3_DEDUP`；reject                              |

### 6.3 数据观察指标

部署后 24h 内观察以下指标变化（建议看每小时打点）：

```text
view-log 总请求数         应不变
view-log reject 占比       应从 X% 下降到 X-Y%
view-log 浏览量+1 数        应增加（接近请求数）
share-create 各阶段成功率   应不变（保持 v1 行为）
TOO_FEW_SAMPLES 计数        应趋近 0
```

异常预警：

- `ALL_ZERO_LONG` 占比若 > 5%，怀疑爬虫攻击量增加，关注但不动 → 反正它被拒。
- `WEAK_SAMPLES` 占比若 > 30%，怀疑采集器 bug 或 wasm 没被加载，需排查。

***

## 7. 长期演进方向

1. **行为分模型替换为机器学习模型**：当前规则集是固定阈值，后续可基于真实流量训练 GBDT / 简易 NN，输入 BehaviorSummary 64B + L2 特征，输出 0\~1 分。
2. **设备级风险分**：把 fp + UA + 行为模式聚合到设备维度，构造设备风险分缓存，跨场景复用。
3. **多端建模**：iOS Safari / Android Chrome / 微信内嵌 / 桌面浏览器分桶建模阈值。
4. **客户端 challenge**：发现可疑请求时不直接 reject，下发轻量 PoW / 滑动 challenge，真人通过即可补打点。

***

## 8. 风险与缓解

| 风险                       | 级别  | 缓解                                        |
| ------------------------ | --- | ----------------------------------------- |
| 软扣分阈值调得不当导致放过 bot        | 中   | 依靠 L1+L3 兜底；上线后 24h 跟踪 ALL\_ZERO\_LONG 占比 |
| pagehide 在某些 webview 不触发 | 低   | 同时监听 visibilitychange→hidden；双兜底          |
| 灰度期间双 build\_hash 内存占用   | 极低  | registry 仅存 8B 哈希集合，可忽略                   |
| 新事件类型导致 wasm 体积变大        | 低   | 实测 < 1KB；UPX 后基本无差                        |
| 真实用户 fp 计算失败             | 已存在 | 保持 v1 行为：fp 失败 → 直接拒（与本文档无关）              |

***

## 9. 工作清单（可直接派发）

- [ ] **A1** `common/guard/behavior.go` 重写 `Evaluate` 起始判定为分级（ALL\_ZERO\_LONG / EARLY\_LEAVE\_OK / WEAK\_SAMPLES）
- [ ] **A2** `common/guard/engine.go` view-log 路径改为 `finalScore = L2*0.7 + L4*0.3`，与 `L2ScoreThreshold` 比较
- [ ] **A3** 单元测试：`common/guard/engine_test.go` 增加 #1/#4/#5/#7/#8/#9 用例
- [ ] **B1** `common/guard/types.go` 增加 5 个加分常量
- [ ] **B2** `common/guard/rules.go` `checkL2Score` 起始改 80 + 5 个加分项
- [ ] **B3** 增加 `isInternalReferer` / `isKnownRealBrowser` 工具函数及测试
- [ ] **C1** `pages/article-detail/[id].vue` 增加 `viewLogSent` 单次标志 + pagehide / visibilitychange 监听
- [ ] **C2** `sendViewLogOnce` 触发器去重逻辑
- [ ] **D1** `crypto-wasm/src/behavior.rs` 新增 5 个事件类型常量与 summarize 累加
- [ ] **D2** `crypto-wasm/src/behavior.rs` `BehaviorSummary` 结构扩充 TouchCount/ScrollCount/ResizeCount，保持 64B 对齐
- [ ] **D3** `composables/useBehaviorRecorder.ts` 新增 5 类事件监听 + start/stop 对称 + encode 兼容
- [ ] **E1** `common/guard/behavior.go` `parseSummary` 同步新结构
- [ ] **E2** `common/guard/behavior.go` `Evaluate` 中 SampleCount 替换为新口径
- [ ] **E3** crypto-wasm 重建 + verify-obfuscation + 双 build\_hash 灰度上线（参考 `anti-bot-guard-v1-deploy.md` §5）
- [ ] **F1** 上线 24h 观察 reject 占比 / TOO\_FEW\_SAMPLES 趋零 / 浏览量增长曲线
- [ ] **F2** 灰度结束后从 yaml 移除旧 build\_hash

***

## 10. 变更记录

| 日期         | 版本     | 作者 | 变更                          |
| ---------- | ------ | -- | --------------------------- |
| 2026-06-12 | v1.1.0 | —  | 初稿。针对线上移动端浏览量 0 增长问题给出系统性方案 |
| 2026-06-13 | v1.1.1 | —  | 增加 §4.6 改动 F：view-log 最小停留时长硬门槛 `MinDwellMs=3000`，独立拒因 `VIEWLOG_DWELL_TOO_SHORT`，堵住"1s 关 tab 也 +1"产品口径漏洞 |

