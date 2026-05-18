// Tab 心跳 + 关闭后 GC
//
// 浏览器没有可靠的"tab 关闭"事件（beforeunload 在刷新/移动端/崩溃时不一定触发），
// 因此采用「心跳 + 启动时垃圾回收」机制清理已经关闭的 tab 留下的存档与 diff 草稿。
//
//   1) 每个 tab 进入时立即写一条心跳记录到 IDB_STORE_TAB_HEARTBEATS；
//   2) 之后每 TAB_HEARTBEAT_INTERVAL_MS 刷新一次心跳的 updatedAt；
//   3) 任何 tab 启动时扫描所有心跳，若某 tabId 的心跳过期 ≥ TAB_HEARTBEAT_EXPIRE_MS，
//      则发 BroadcastChannel 探活；若 200ms 内没有任何 tab 回应，认定该 tab
//      已经关闭，删除它在 archives / diffDraft / heartbeat 三个 store 里的全部数据；
//   4) 当前 tab 在 pagehide / unmount 时尽力（best-effort）删除自身心跳，
//      让其他 tab 启动时能立刻识别为"已关闭"。

import type { Ref } from 'vue';
import {
    IDB_STORE_ARCHIVES,
    IDB_STORE_DIFF_DRAFTS,
    IDB_STORE_TAB_HEARTBEATS,
    type TabHeartbeatRecord,
    idbDelete,
    idbGetAll,
    idbPut,
} from '../utils/idb';

const TAB_HEARTBEAT_INTERVAL_MS = 30_000; // 30 秒刷一次心跳
const TAB_HEARTBEAT_EXPIRE_MS = 5 * 60_000; // 5 分钟没刷新认为可能已关
const TAB_GC_PROBE_TIMEOUT_MS = 200; // 探活等待时长
const TAB_GC_CHANNEL_NAME = 'json-tool-tab-gc';

type TabAliveProbeMessage =
    | { type: 'tab-alive-probe'; tabId: string; requesterInstanceId: string }
    | { type: 'tab-alive-pong'; tabId: string; responderInstanceId: string; requesterInstanceId: string };

export interface UseTabLifecycleOptions {
    tabId: Ref<string>;
    runtimeInstanceId: string;
    isTabPageClosing: Ref<boolean>;
}

export interface UseTabLifecycleReturn {
    /** 在 onMounted 中调用：建立 GC channel，监听探活消息 */
    setupTabGcChannel: () => void;
    /** 启动心跳（每 30s 写一次 updatedAt） */
    startTabHeartbeat: () => void;
    /** 停止心跳定时器 */
    stopTabHeartbeat: () => void;
    /** 启动后异步执行一次 GC：清理所有已关闭 tab 留下的存档与 diff 草稿 */
    garbageCollectClosedTabs: () => Promise<void>;
    /** 在 onBeforeUnmount 中调用：关闭 channel，移除监听 */
    disposeTabGcChannel: () => void;
}

export const useTabLifecycle = (opts: UseTabLifecycleOptions): UseTabLifecycleReturn => {
    const { tabId, runtimeInstanceId, isTabPageClosing } = opts;

    let tabHeartbeatTimer: ReturnType<typeof setInterval> | null = null;
    let tabGcChannel: BroadcastChannel | null = null;
    let tabGcProbeResponses: Set<string> = new Set();
    let tabGcCurrentRequesterId: string | null = null;

    const writeTabHeartbeat = async () => {
        if (typeof window === 'undefined') return;
        if (!tabId.value) return;
        try {
            await idbPut(IDB_STORE_TAB_HEARTBEATS, {
                tabId: tabId.value,
                updatedAt: Date.now(),
            } satisfies TabHeartbeatRecord);
        } catch {
            // 心跳写失败属于非关键路径，静默忽略
        }
    };

    const startTabHeartbeat = () => {
        if (typeof window === 'undefined') return;
        if (tabHeartbeatTimer) return;
        void writeTabHeartbeat();
        tabHeartbeatTimer = setInterval(() => {
            void writeTabHeartbeat();
        }, TAB_HEARTBEAT_INTERVAL_MS);
    };

    const stopTabHeartbeat = () => {
        if (tabHeartbeatTimer) {
            clearInterval(tabHeartbeatTimer);
            tabHeartbeatTimer = null;
        }
    };

    const handleTabGcChannelMessage = (event: MessageEvent<TabAliveProbeMessage>) => {
        const data = event.data;
        if (!data) return;
        if (data.type === 'tab-alive-probe') {
            // 仅当探活的 tabId 等于自己，且不是自己发的，才回 pong
            if (data.requesterInstanceId === runtimeInstanceId) return;
            if (data.tabId !== tabId.value) return;
            if (isTabPageClosing.value) return;
            const channel = tabGcChannel;
            if (!channel) return;
            channel.postMessage({
                type: 'tab-alive-pong',
                tabId: tabId.value,
                responderInstanceId: runtimeInstanceId,
                requesterInstanceId: data.requesterInstanceId,
            } satisfies TabAliveProbeMessage);
            return;
        }
        if (data.type === 'tab-alive-pong') {
            // 只接受自己发起的本轮 GC 的回包
            if (tabGcCurrentRequesterId !== runtimeInstanceId) return;
            if (data.requesterInstanceId !== runtimeInstanceId) return;
            if (data.responderInstanceId === runtimeInstanceId) return;
            tabGcProbeResponses.add(data.tabId);
        }
    };

    const probeTabAlive = async (targetTabId: string): Promise<boolean> => {
        if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') {
            // 没有 BroadcastChannel 时保守：不做远程探活，仅靠时间戳
            return false;
        }
        if (targetTabId === tabId.value) return true;
        const channel = tabGcChannel;
        if (!channel) return false;
        tabGcCurrentRequesterId = runtimeInstanceId;
        tabGcProbeResponses = new Set();
        channel.postMessage({
            type: 'tab-alive-probe',
            tabId: targetTabId,
            requesterInstanceId: runtimeInstanceId,
        } satisfies TabAliveProbeMessage);
        await new Promise(resolve => setTimeout(resolve, TAB_GC_PROBE_TIMEOUT_MS));
        const alive = tabGcProbeResponses.has(targetTabId);
        tabGcCurrentRequesterId = null;
        return alive;
    };

    /**
     * 删除指定 tabId 在 archives / diffDraft / heartbeat 三个 store 里的全部数据。
     * 用于「确认 tab 已关闭」的最终清理，以及当前 tab 卸载时的自清理（自清理只删 heartbeat）。
     */
    const purgeTabData = async (targetTabId: string) => {
        try {
            await Promise.all([
                idbDelete(IDB_STORE_ARCHIVES, targetTabId),
                idbDelete(IDB_STORE_DIFF_DRAFTS, targetTabId),
                idbDelete(IDB_STORE_TAB_HEARTBEATS, targetTabId),
            ]);
        } catch {
            // 删除失败属于尽力路径，静默忽略，下次启动 GC 还会重试
        }
    };

    /**
     * 启动时执行一次 GC：
     *   1) 拉取所有心跳；
     *   2) 找到 updatedAt 已经过期 ≥ 5 分钟、且不是自己的 tabId；
     *   3) 反向扫描 archives / diffDraft 两个 store，找到那些「数据存在但完全没有
     *      心跳记录」的 tabId（典型场景：旧版本代码留下的存档，或心跳已被自清理但
     *      数据写盘失败的边角情况）—— 这些孤儿 tabId 同样加入候选；
     *   4) 对每个候选 tab 发广播探活；
     *   5) 200ms 内没回应 → 认定关闭 → 清空它的 archives / diffDraft / heartbeat。
     */
    const garbageCollectClosedTabs = async () => {
        if (typeof window === 'undefined') return;
        try {
            const [heartbeats, archives, diffDrafts] = await Promise.all([
                idbGetAll<TabHeartbeatRecord>(IDB_STORE_TAB_HEARTBEATS),
                idbGetAll<{ tabId?: string }>(IDB_STORE_ARCHIVES),
                idbGetAll<{ tabId?: string }>(IDB_STORE_DIFF_DRAFTS),
            ]);
            const now = Date.now();

            // 1) 心跳过期的候选
            const candidateMap = new Map<string, TabHeartbeatRecord | null>();
            heartbeats.forEach(h => {
                if (!h || !h.tabId || h.tabId === tabId.value) return;
                if (typeof h.updatedAt !== 'number' || now - h.updatedAt > TAB_HEARTBEAT_EXPIRE_MS) {
                    candidateMap.set(h.tabId, h);
                }
            });

            // 2) 反向扫描：archives / diffDraft 中存在但心跳表里没有任何记录的孤儿 tabId
            const heartbeatTabIds = new Set(heartbeats.map(h => h?.tabId).filter(Boolean) as string[]);
            const orphanCollect = (rec?: { tabId?: string }) => {
                const tid = rec?.tabId;
                if (!tid || tid === tabId.value) return;
                if (heartbeatTabIds.has(tid)) return; // 已在 heartbeat 表里，由上一步处理
                candidateMap.set(tid, null);
            };
            archives.forEach(orphanCollect);
            diffDrafts.forEach(orphanCollect);

            // 3) 逐个探活并处理
            for (const [candidateTabId] of candidateMap) {
                const alive = await probeTabAlive(candidateTabId);
                if (!alive) {
                    await purgeTabData(candidateTabId);
                } else {
                    // 还活着但心跳过期 / 缺失：补一个最新 updatedAt，避免下次重复探活
                    await idbPut(IDB_STORE_TAB_HEARTBEATS, {
                        tabId: candidateTabId,
                        updatedAt: now,
                    } satisfies TabHeartbeatRecord);
                }
            }
        } catch {
            // GC 不应阻塞主流程
        }
    };

    const setupTabGcChannel = () => {
        if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return;
        if (tabGcChannel) return;
        tabGcChannel = new BroadcastChannel(TAB_GC_CHANNEL_NAME);
        tabGcChannel.addEventListener('message', handleTabGcChannelMessage as EventListener);
    };

    const disposeTabGcChannel = () => {
        if (tabGcChannel) {
            tabGcChannel.removeEventListener('message', handleTabGcChannelMessage as EventListener);
            tabGcChannel.close();
            tabGcChannel = null;
        }
    };

    return {
        setupTabGcChannel,
        startTabHeartbeat,
        stopTabHeartbeat,
        garbageCollectClosedTabs,
        disposeTabGcChannel,
    };
};
