// 工具设置（settings）持久化与自动保存 composable
//
// 集中管理 JsonTool 中所有写入 localStorage 的用户偏好：
// - 字段默认值集中在 defaultSettings；
// - loadSettings 在创建时读取 localStorage 并与默认值合并；
// - saveSettings 在初始化阶段（isInitializing）抑制写入，避免 watch 触发的早期噪声；
// - 一个 deep watch 监听所有字段，发生变化时自动调用 saveSettings；
// - 暴露 markInitialized() 给 onMounted 末尾调用，正式开启持久化。
//
// 注意：isFullscreen 不会被持久化，它在挂载时通过 watch(defaultFullscreen, immediate)
// 同步一次默认值，之后由用户操作驱动。

import { ref, watch, type Ref } from 'vue';

const SETTINGS_STORAGE_KEY = 'json-tool-settings';

export type SortMethod = 'dictionary' | 'length' | 'field';
export type SortOrder = 'asc' | 'desc';

export interface ButtonVisibility {
    fetchJson: boolean;
    compress: boolean;
    escape: boolean;
    unescape: boolean;
    dataConvert: boolean;
    masking: boolean;
    sort: boolean;
    archive: boolean;
    diff: boolean;
    share: boolean;
    // 模板里历史上还会读 format / collapse / fullscreen 等可选键（默认不存在，渲染为 undefined → 不显示）
    [key: string]: boolean | undefined;
}

export interface PersistedSettings {
    buttonVisibility: ButtonVisibility;
    recursiveUnescape: boolean;
    wordWrap: boolean;
    fontSize: number;
    showIndentGuide: boolean;
    isFullscreen: boolean;
    syncScrollEnabled: boolean;
    showMinimap: boolean;
    enableDiagnostics: boolean;
    indentSize: number;
    encodingMode: boolean;
    arrayNewLine: boolean;
    sortMethod: SortMethod;
    sortOrder: SortOrder;
    customArchiveName: boolean;
    stickyScroll: boolean;
    defaultFullscreen?: boolean;
}

const defaultSettings: PersistedSettings = {
    buttonVisibility: {
        fetchJson: false,
        compress: true,
        escape: true,
        unescape: true,
        dataConvert: true,
        masking: true,
        sort: true,
        archive: true,
        diff: true,
        share: false,
    },
    recursiveUnescape: true,
    wordWrap: false,
    fontSize: 12,
    showIndentGuide: true,
    isFullscreen: false,
    syncScrollEnabled: false,
    showMinimap: false,
    enableDiagnostics: true,
    indentSize: 2,
    encodingMode: false,
    arrayNewLine: true,
    sortMethod: 'dictionary',
    sortOrder: 'asc',
    customArchiveName: false,
    stickyScroll: false,
};

const loadSettingsFromStorage = (): PersistedSettings => {
    if (typeof window === 'undefined') return defaultSettings;
    try {
        const parsed = JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) || 'null');
        if (parsed) {
            return {
                ...defaultSettings,
                ...parsed,
                buttonVisibility: {
                    ...defaultSettings.buttonVisibility,
                    ...parsed.buttonVisibility,
                },
            };
        }
    } catch {
        // 解析失败时使用默认设置
    }
    return defaultSettings;
};

export interface UseToolSettingsReturn {
    // 持久化设置 ref
    indentSize: Ref<number>;
    recursiveUnescape: Ref<boolean>;
    wordWrap: Ref<boolean>;
    fontSize: Ref<number>;
    showIndentGuide: Ref<boolean>;
    arrayNewLine: Ref<boolean>;
    defaultFullscreen: Ref<boolean>;
    isFullscreen: Ref<boolean>;
    showMinimap: Ref<boolean>;
    enableDiagnostics: Ref<boolean>;
    preferredEnableDiagnostics: Ref<boolean>;
    encodingMode: Ref<boolean>;
    sortMethod: Ref<SortMethod>;
    sortOrder: Ref<SortOrder>;
    customArchiveName: Ref<boolean>;
    stickyScroll: Ref<boolean>;
    preferredStickyScroll: Ref<boolean>;
    buttonVisibility: Ref<ButtonVisibility>;
    syncScrollEnabled: Ref<boolean>;
    /** 始终保持数字字面量，保证无损格式化（禁止用户关闭） */
    preserveNumberLiterals: { readonly value: true };

    /** onMounted 末尾调用，结束初始化抑制并允许持久化 */
    markInitialized: () => void;
    /** 手动触发保存（一般无需调用，watch 会自动保存） */
    saveSettings: () => void;
}

export const useToolSettings = (): UseToolSettingsReturn => {
    const savedSettings = loadSettingsFromStorage();
    let isInitializing = true;

    const indentSize = ref(savedSettings.indentSize);
    const recursiveUnescape = ref(savedSettings.recursiveUnescape ?? true);
    const wordWrap = ref(savedSettings.wordWrap);
    const fontSize = ref(savedSettings.fontSize || 12);
    const showIndentGuide = ref(savedSettings.showIndentGuide);
    const arrayNewLine = ref(savedSettings.arrayNewLine);
    const preserveNumberLiterals = { value: true } as const;
    const isFullscreen = ref(false);
    const defaultFullscreen = ref(savedSettings.defaultFullscreen ?? savedSettings.isFullscreen ?? false);

    // 页面加载时，isFullscreen 跟随 defaultFullscreen 设置
    watch(defaultFullscreen, (val) => { isFullscreen.value = val; }, { immediate: true });

    const showMinimap = ref(savedSettings.showMinimap ?? false);
    const enableDiagnostics = ref(savedSettings.enableDiagnostics ?? true);
    const preferredEnableDiagnostics = ref(enableDiagnostics.value);
    const encodingMode = ref(savedSettings.encodingMode ?? false);
    const sortMethod = ref<SortMethod>(savedSettings.sortMethod);
    const sortOrder = ref<SortOrder>(savedSettings.sortOrder);
    const customArchiveName = ref<boolean>(savedSettings.customArchiveName ?? false);
    const stickyScroll = ref(savedSettings.stickyScroll ?? true);
    const preferredStickyScroll = ref(stickyScroll.value);
    const buttonVisibility = ref<ButtonVisibility>(savedSettings.buttonVisibility);
    const syncScrollEnabled = ref(savedSettings.syncScrollEnabled ?? false);

    const saveSettings = () => {
        if (typeof window === 'undefined' || isInitializing) return;
        const settingsToSave: PersistedSettings = {
            buttonVisibility: buttonVisibility.value,
            recursiveUnescape: recursiveUnescape.value,
            wordWrap: wordWrap.value,
            fontSize: fontSize.value,
            showIndentGuide: showIndentGuide.value,
            isFullscreen: isFullscreen.value,
            defaultFullscreen: defaultFullscreen.value,
            syncScrollEnabled: syncScrollEnabled.value,
            showMinimap: showMinimap.value,
            enableDiagnostics: preferredEnableDiagnostics.value,
            indentSize: indentSize.value,
            encodingMode: encodingMode.value,
            arrayNewLine: arrayNewLine.value,
            sortMethod: sortMethod.value,
            sortOrder: sortOrder.value,
            customArchiveName: customArchiveName.value,
            stickyScroll: preferredStickyScroll.value,
        };
        try {
            localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settingsToSave));
        } catch {
            // localStorage 写入失败时静默忽略（如隐私模式 / 容量超限）
        }
    };

    // 监听所有设置变化并自动保存
    watch(
        () => [
            buttonVisibility.value,
            recursiveUnescape.value,
            wordWrap.value,
            fontSize.value,
            showIndentGuide.value,
            isFullscreen.value,
            syncScrollEnabled.value,
            showMinimap.value,
            enableDiagnostics.value,
            indentSize.value,
            encodingMode.value,
            arrayNewLine.value,
            preserveNumberLiterals.value,
            sortMethod.value,
            sortOrder.value,
            customArchiveName.value,
            stickyScroll.value,
        ],
        () => {
            saveSettings();
        },
        { deep: true }
    );

    const markInitialized = () => {
        isInitializing = false;
    };

    return {
        indentSize,
        recursiveUnescape,
        wordWrap,
        fontSize,
        showIndentGuide,
        arrayNewLine,
        defaultFullscreen,
        isFullscreen,
        showMinimap,
        enableDiagnostics,
        preferredEnableDiagnostics,
        encodingMode,
        sortMethod,
        sortOrder,
        customArchiveName,
        stickyScroll,
        preferredStickyScroll,
        buttonVisibility,
        syncScrollEnabled,
        preserveNumberLiterals,
        markInitialized,
        saveSettings,
    };
};
