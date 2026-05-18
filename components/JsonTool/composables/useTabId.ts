// Tab ID 管理与多标签页冲突探测
//
// 浏览器复制标签页时 sessionStorage 也会被一并复制，因此两个 tab 启动时可能拿到
// 同一个 tabId。本 composable 在挂载时通过 BroadcastChannel 探活：若有其他 tab
// 持有相同 tabId，则当前 tab 重新生成一个新的 tabId。
//
// 同时维护 isTabPageClosing 标志，由调用方在 pagehide / beforeunload / unmount
// 时置为 true，避免在关闭过程中响应探活请求或参与 GC。

import { ref, type Ref } from 'vue';

const TAB_ID_STORAGE_KEY = 'json-tool:tab-id';
const TAB_ID_CHANNEL_NAME = 'json-tool-tab-id';

type TabProbeMessage =
    | { type: 'probe'; tabId: string; requesterInstanceId: string }
    | { type: 'alive'; tabId: string; responderInstanceId: string; requesterInstanceId: string };

const createRuntimeInstanceId = (): string => {
    return typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const getOrCreateTabId = (): string => {
    if (typeof window === 'undefined') return 'ssr';
    try {
        const existing = sessionStorage.getItem(TAB_ID_STORAGE_KEY);
        if (existing) return existing;
        const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
        sessionStorage.setItem(TAB_ID_STORAGE_KEY, id);
        return id;
    } catch {
        // sessionStorage 不可用时降级：仍生成一个 id，但刷新后不保证稳定
        return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    }
};

const generateFreshTabId = (): string => {
    return typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export interface UseTabIdReturn {
    tabId: Ref<string>;
    runtimeInstanceId: string;
    isTabPageClosing: Ref<boolean>;
    /** 在 onMounted 中调用：建立 BroadcastChannel，监听冲突探测消息 */
    setupTabIdChannel: () => void;
    /** 探测当前 tabId 是否被其他标签页占用，若是则重新生成 */
    ensureUniqueTabIdForThisPage: () => Promise<void>;
    /** 在 onBeforeUnmount 中调用：关闭 channel，移除监听 */
    disposeTabIdChannel: () => void;
}

export const useTabId = (): UseTabIdReturn => {
    const tabId = ref(getOrCreateTabId());
    const runtimeInstanceId = createRuntimeInstanceId();
    const isTabPageClosing = ref(false);

    let tabIdChannel: BroadcastChannel | null = null;
    let tabIdConflictResponseCount = 0;

    const setCurrentTabId = (nextTabId: string) => {
        tabId.value = nextTabId;
        try {
            sessionStorage.setItem(TAB_ID_STORAGE_KEY, nextTabId);
        } catch {
            // 忽略 sessionStorage 写失败：这种情况下只能退化为本次运行时有效
        }
    };

    const handleTabIdChannelMessage = (event: MessageEvent<TabProbeMessage>) => {
        const data = event.data;
        if (!data) return;
        if (data.type === 'probe') {
            if (isTabPageClosing.value) return;
            if (data.requesterInstanceId === runtimeInstanceId) return;
            if (data.tabId !== tabId.value) return;
            const channel = tabIdChannel;
            if (!channel) return;
            channel.postMessage({
                type: 'alive',
                tabId: tabId.value,
                responderInstanceId: runtimeInstanceId,
                requesterInstanceId: data.requesterInstanceId,
            } satisfies TabProbeMessage);
            return;
        }
        if (data.type === 'alive') {
            if (data.requesterInstanceId !== runtimeInstanceId) return;
            if (data.responderInstanceId === runtimeInstanceId) return;
            if (data.tabId !== tabId.value) return;
            tabIdConflictResponseCount++;
        }
    };

    const probeExistingTabIdConflict = async (): Promise<boolean> => {
        if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return false;
        const channel = tabIdChannel;
        if (!channel) return false;
        tabIdConflictResponseCount = 0;
        channel.postMessage({
            type: 'probe',
            tabId: tabId.value,
            requesterInstanceId: runtimeInstanceId,
        } satisfies TabProbeMessage);
        await new Promise(resolve => setTimeout(resolve, 120));
        return tabIdConflictResponseCount > 0;
    };

    const ensureUniqueTabIdForThisPage = async () => {
        if (typeof window === 'undefined') return;
        const hasExistingTabId = (() => {
            try {
                return !!sessionStorage.getItem(TAB_ID_STORAGE_KEY);
            } catch {
                return false;
            }
        })();
        if (!hasExistingTabId) return;
        const hasConflict = await probeExistingTabIdConflict();
        if (!hasConflict) return;
        setCurrentTabId(generateFreshTabId());
    };

    const setupTabIdChannel = () => {
        if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return;
        if (tabIdChannel) return;
        tabIdChannel = new BroadcastChannel(TAB_ID_CHANNEL_NAME);
        tabIdChannel.addEventListener('message', handleTabIdChannelMessage as EventListener);
    };

    const disposeTabIdChannel = () => {
        if (tabIdChannel) {
            tabIdChannel.removeEventListener('message', handleTabIdChannelMessage as EventListener);
            tabIdChannel.close();
            tabIdChannel = null;
        }
    };

    return {
        tabId,
        runtimeInstanceId,
        isTabPageClosing,
        setupTabIdChannel,
        ensureUniqueTabIdForThisPage,
        disposeTabIdChannel,
    };
};
