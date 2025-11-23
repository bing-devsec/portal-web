<template>
    <div>
        <!-- 添加小屏幕提示组件 -->
        <div class="screen-size-warning">
            <el-icon class="warning-icon">
                <WarningFilled />
            </el-icon>
            <div class="warning-text">
                <p>当前屏幕尺寸过小，无法提供良好的使用体验。</p>
                <p>请使用屏幕宽度大于 900px 的设备访问此工具。</p>
            </div>
        </div>

        <!-- 原有的 JSON 工具容器 -->
        <div class="json-tool-container" :class="{ 'fullscreen': isFullscreen }">
            <!-- 工具栏 -->
            <div class="tool-bar-wrapper">
                <!-- 左侧渐变遮罩和滚动按钮 -->
                <div v-if="canScrollLeft" class="scroll-indicator scroll-indicator-left">
                    <el-button 
                        type="primary" 
                        circle 
                        size="small"
                        class="scroll-btn scroll-btn-left"
                        @click="scrollToolBar('left')"
                        :icon="ArrowLeft"
                    />
                    <div class="gradient-mask gradient-mask-left"></div>
                </div>
                
                <!-- 工具栏容器 -->
                <div class="tool-bar" ref="toolBarRef" @scroll="handleToolBarScroll">
                    <!-- 设置按钮 -->
                    <el-button type="info" @click="openSettingsDialog" circle>
                        <el-icon>
                            <Setting />
                        </el-icon>
                    </el-button>

                <el-button-group>
                    <el-button v-if="buttonVisibility.fetchJson" type="primary" @click="openFetchJsonDialog">获取JSON</el-button>
                    <el-button v-if="buttonVisibility.format" type="primary" @click="formatJSON">格式化</el-button>
                    <el-button v-if="buttonVisibility.compress" type="primary" @click="compressJSON">压缩</el-button>
                    <el-button v-if="buttonVisibility.escape" type="primary" @click="handleEscapeCommand('escape')">转义</el-button>
                    <el-button v-if="buttonVisibility.unescape" type="primary" @click="handleEscapeCommand('unescape')">去除转义</el-button>
                    <el-button v-if="buttonVisibility.compressEscape" type="primary" @click="handleEscapeCommand('compress-escape')">压缩并转义</el-button>
                    <el-button v-if="buttonVisibility.masking" type="primary" @click="openDataMaskingDialog">脱敏</el-button>
                    <el-button v-if="buttonVisibility.sort" type="primary" @click="handleAdvancedCommand('sort')">排序</el-button>
                    <el-button v-if="buttonVisibility.share" type="primary" @click="openShareDialog">分享</el-button>
                </el-button-group>

                <!-- 数据转换下拉按钮（紧挨着功能按钮组） -->
                <el-dropdown v-if="buttonVisibility.dataConvert" trigger="click"
                    @command="handleConvert">
                    <el-button type="primary">
                        数据转换
                        <el-icon class="el-icon--right">
                            <ArrowDown />
                        </el-icon>
                    </el-button>
                    <template #dropdown>
                        <el-dropdown-menu>
                            <el-dropdown-item command="yaml">JSON 转 YAML</el-dropdown-item>
                            <el-dropdown-item command="toml">JSON 转 TOML</el-dropdown-item>
                            <el-dropdown-item command="xml">JSON 转 XML</el-dropdown-item>
                            <el-dropdown-item command="go">JSON 转 Go 结构体</el-dropdown-item>
                            <el-dropdown-item command="cookie">Cookie 转 JSON</el-dropdown-item>
                        </el-dropdown-menu>
                    </template>
                </el-dropdown>

                <!-- 层级控制 -->
                <div v-if="buttonVisibility.collapse" class="collapse-control">
                    <el-select v-model="selectedLevel" placeholder="层级" class="level-select" :disabled="maxLevel === 0">
                        <el-option v-if="maxLevel === 0" label="第0层" :value="0" :disabled="true" />
                        <el-option v-for="n in maxLevel" :key="n" :label="`第${n}层`" :value="n" />
                    </el-select>
                    <el-button type="success" @click="handleLevelAction" :disabled="maxLevel === 0">收缩</el-button>
                </div>

                <!-- 界面控制：全屏 -->
                <el-button v-if="buttonVisibility.fullscreen" type="warning"
                    class="fullscreen-btn" @click="toggleFullscreen">
                    {{ isFullscreen ? '退出' : '全屏' }}
                </el-button>
                </div>
                
                <!-- 右侧渐变遮罩和滚动按钮 -->
                <div v-if="canScrollRight" class="scroll-indicator scroll-indicator-right">
                    <div class="gradient-mask gradient-mask-right"></div>
                    <el-button 
                        type="primary" 
                        circle 
                        size="small"
                        class="scroll-btn scroll-btn-right"
                        @click="scrollToolBar('right')"
                        :icon="ArrowRight"
                    />
                </div>
            </div>

            <!-- 编辑区域 -->
            <div class="editor-container">
                <div class="editor-panel" :style="{ width: `${leftPanelWidth}%` }">
                    <div class="panel-header">
                        <div class="panel-title">
                            <span>输入区域</span>
                        </div>
                        <div class="panel-actions" v-show="showInputActions">
                            <el-button @click="clearInput" size="small" type="danger" plain>
                                <el-icon>
                                    <Delete />
                                </el-icon>
                                <span>清空</span>
                            </el-button>
                            <el-upload class="upload-json" accept=".json" :auto-upload="false" :show-file-list="false"
                                :on-change="handleFileUpload">
                                <el-button size="small" type="primary" plain>
                                    <el-icon>
                                        <Upload />
                                    </el-icon>
                                    <span>上传</span>
                                </el-button>
                            </el-upload>
                        </div>
                    </div>
                    <div class="editor-wrapper">
                        <div class="monaco-editor-container">
                            <div v-if="!editorsInitialized" class="editor-loading">
                                <el-icon class="loading-icon">
                                    <Loading />
                                </el-icon>
                                <span>加载编辑器中...</span>
                            </div>
                            <div ref="inputEditorContainer" class="monaco-editor-instance"></div>
                        </div>
                        <!-- 输入区域状态栏 -->
                        <div class="editor-status-bar" v-if="inputEditorStatus">
                            <span class="status-text">{{ inputEditorStatus }}</span>
                        </div>
                    </div>
                </div>

                <!-- 添加可拖动分隔线 -->
                <div class="resizer" @mousedown="startResize" @touchstart.passive="startResize">
                    <el-button class="transfer-button" type="primary" circle @click.stop="transferToInput">
                        <el-icon>
                            <ArrowLeft />
                        </el-icon>
                    </el-button>
                </div>

                <div class="editor-panel" :style="{ width: `${100 - leftPanelWidth}%` }">
                    <div class="panel-header">
                        <div class="panel-title">
                            <span>预览区域</span>
                        </div>
                        <div class="panel-actions" v-show="showOutputActions">
                            <el-button @click="copyOutput" size="small" type="success" plain>
                                <el-icon>
                                    <CopyDocument />
                                </el-icon>
                                <span>复制</span>
                            </el-button>
                            <el-button @click="downloadOutput" size="small" type="info" plain>
                                <el-icon>
                                    <Download />
                                </el-icon>
                                <span>下载</span>
                            </el-button>
                        </div>
                    </div>
                    <div class="editor-wrapper">
                        <div class="monaco-editor-container">
                            <div v-if="!editorsInitialized" class="editor-loading">
                                <el-icon class="loading-icon">
                                    <Loading />
                                </el-icon>
                                <span>加载编辑器中...</span>
                            </div>
                            <div ref="outputEditorContainer" class="monaco-editor-instance"></div>
                        </div>
                        <!-- 预览区域状态栏 -->
                        <div class="editor-status-bar" v-if="outputEditorStatus">
                            <span class="status-text">{{ outputEditorStatus }}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- 获取JSON数据对话框 -->
        <FetchJsonDialog v-model="fetchJsonDialogVisible" :indent-size="2" :input-editor="inputEditor" />

        <!-- 分享对话框 -->
        <ShareDialog v-model="shareDialogVisible" :json-data="getInputEditorValue()"
            @loadSharedJson="handleLoadSharedJson" />

        <!-- 数据脱敏对话框 -->
        <DataMaskingDialog v-model="dataMaskingDialogVisible" :json-data="getInputEditorValue()"
            @apply="handleDataMaskingApply" />

        <!-- 设置弹窗 -->
        <el-dialog v-model="settingsDialogVisible" class="settings-dialog-wrapper" :close-on-click-modal="false"
            :align-center="false" top="12vh" width="850px">
            <div class="settings-dialog-content">
                <el-collapse v-model="settingsCollapseActiveNames" accordion>
                    <!-- 设置 -->
                    <el-collapse-item name="settings">
                        <template #title>
                            <div class="settings-collapse-title">
                                <el-icon class="column-title-icon">
                                    <Setting />
                                </el-icon>
                                <span>通用设置</span>
                            </div>
                        </template>
                        <div class="settings-collapse-content">
                            <!-- 菜单栏功能设置 -->
                            <div class="settings-subsection">
                                <div class="settings-subsection-title">菜单栏功能设置</div>
                                <div class="button-visibility-list">
                                    <!-- 第一行 -->
                                    <div class="button-visibility-item" style="grid-column: 1; grid-row: 1;">
                                        <el-checkbox v-model="buttonVisibility.compress">压缩</el-checkbox>
                                    </div>
                                    <div class="button-visibility-item" style="grid-column: 2; grid-row: 1;">
                                        <el-checkbox v-model="buttonVisibility.escape">转义</el-checkbox>
                                    </div>
                                    <div class="button-visibility-item" style="grid-column: 3; grid-row: 1;">
                                        <el-checkbox v-model="buttonVisibility.unescape">去除转义</el-checkbox>
                                    </div>
                                    <div class="button-visibility-item" style="grid-column: 4; grid-row: 1;">
                                        <el-checkbox v-model="buttonVisibility.compressEscape">压缩并转义</el-checkbox>
                                    </div>
                                    <!-- 第二行 -->
                                    <div class="button-visibility-item" style="grid-column: 1; grid-row: 2;">
                                        <el-checkbox v-model="buttonVisibility.masking">脱敏</el-checkbox>
                                    </div>
                                    <div class="button-visibility-item" style="grid-column: 2; grid-row: 2;">
                                        <el-checkbox v-model="buttonVisibility.sort">排序</el-checkbox>
                                    </div>
                                    <div class="button-visibility-item" style="grid-column: 3; grid-row: 2;">
                                        <el-checkbox v-model="buttonVisibility.share">分享</el-checkbox>
                                    </div>
                                    <div class="button-visibility-item" style="grid-column: 4; grid-row: 2;">
                                        <el-checkbox v-model="buttonVisibility.fetchJson">获取JSON</el-checkbox>
                                    </div>
                                </div>
                            </div>

                            <!-- 分隔线：字符串换行设置和字体大小设置之间 -->
                            <el-divider class="settings-subsection-divider" />

                            <!-- 字体大小设置 -->
                            <div class="settings-subsection">
                                <div class="settings-subsection-title">字体大小设置</div>
                                <div class="settings-item">
                                    <div class="font-size-control">
                                        <el-slider v-model="fontSize" :min="12" :max="16" :step="1" :show-tooltip="true"
                                            :format-tooltip="(val: number) => `${val}px`" @change="updateFontSize" />
                                    </div>
                                </div>
                            </div>

                            <!-- 分隔线：菜单栏设置和字符串换行设置之间 -->
                            <el-divider class="settings-subsection-divider" />

                            <!-- 字符串换行设置 -->
                            <div class="settings-subsection">
                                <div class="settings-subsection-title">字符串换行设置</div>
                                <div class="settings-item">
                                    <el-switch v-model="wordWrap" active-text="不换行" inactive-text="换行" size="default"
                                        @change="updateWordWrap" />
                                </div>
                            </div>

                            <!-- 分隔线：字体大小设置和缩进指南设置之间 -->
                            <el-divider class="settings-subsection-divider" />

                            <!-- 缩进指南设置 -->
                            <div class="settings-subsection">
                                <div class="settings-subsection-title">缩进指南设置</div>
                                <div class="settings-item">
                                    <el-switch v-model="showIndentGuide" active-text="显示" inactive-text="隐藏"
                                        size="default" @change="updateIndentGuides" />
                                </div>
                            </div>
                        </div>
                    </el-collapse-item>

                    <!-- 格式化设置 -->
                    <el-collapse-item name="format">
                        <template #title>
                            <div class="settings-collapse-title">
                                <el-icon class="column-title-icon">
                                    <Document />
                                </el-icon>
                                <span>格式化设置</span>
                            </div>
                        </template>
                        <div class="settings-collapse-content">
                            <div class="settings-item">
                                <div class="settings-item-header">
                                    <span class="settings-label">缩进空格</span>
                                </div>
                                <el-radio-group v-model="indentSize" class="settings-radio-group">
                                    <el-radio :value="2" border>2</el-radio>
                                    <el-radio :value="4" border>4</el-radio>
                                    <el-radio :value="8" border>8</el-radio>
                                </el-radio-group>
                            </div>

                            <el-divider style="margin: 12px 0;" />

                            <div class="settings-item">
                                <div class="settings-item-header">
                                    <span class="settings-label">编码模式</span>
                                </div>
                                <el-radio-group v-model="encodingMode" class="settings-radio-group">
                                    <el-radio :value="0" border>保持原样</el-radio>
                                    <el-radio :value="1" border>转中文</el-radio>
                                    <el-radio :value="2" border>转Unicode</el-radio>
                                </el-radio-group>
                            </div>

                            <el-divider style="margin: 12px 0;" />

                            <div class="settings-item">
                                <div class="settings-item-header">
                                    <span class="settings-label">数组样式</span>
                                </div>
                                <el-switch v-model="arrayNewLine" active-text="换行" inactive-text="紧凑" size="default" />
                            </div>
                        </div>
                    </el-collapse-item>

                    <!-- 排序设置 -->
                    <el-collapse-item name="sort">
                        <template #title>
                            <div class="settings-collapse-title">
                                <el-icon class="column-title-icon">
                                    <Sort />
                                </el-icon>
                                <span>排序设置</span>
                            </div>
                        </template>
                        <div class="settings-collapse-content">
                            <div class="settings-item">
                                <div class="settings-item-header">
                                    <span class="settings-label">排序方式</span>
                                </div>
                                <el-radio-group v-model="sortMethod" class="settings-radio-group">
                                    <el-radio value="dictionary" border>字典序</el-radio>
                                    <el-radio value="length" border>按Key长度</el-radio>
                                </el-radio-group>
                            </div>

                            <el-divider style="margin: 12px 0;" />

                            <div class="settings-item">
                                <div class="settings-item-header">
                                    <span class="settings-label">排序方向</span>
                                </div>
                                <el-radio-group v-model="sortOrder" class="settings-radio-group">
                                    <el-radio value="asc" border>正序（升序）</el-radio>
                                    <el-radio value="desc" border>倒序（降序）</el-radio>
                                </el-radio-group>
                            </div>
                        </div>
                    </el-collapse-item>
                </el-collapse>
            </div>
            <template #footer>
                <div class="dialog-footer">
                    <el-button @click="settingsDialogVisible = false">关闭</el-button>
                </div>
            </template>
        </el-dialog>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, nextTick, watch, onUnmounted, computed } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import type { UploadFile } from 'element-plus';
import * as monaco from 'monaco-editor';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
import { Loading, ArrowLeft, ArrowRight, ArrowDown, CopyDocument, Download, Upload, Delete, Setting, WarningFilled, DataAnalysis, Location, Collection, Document, Sort, InfoFilled, Refresh, Connection, Share, Lock, FullScreen, Operation } from '@element-plus/icons-vue';
import FetchJsonDialog from './FetchJsonDialog.vue';
import ShareDialog from './ShareDialog.vue';
import DataMaskingDialog from './DataMaskingDialog.vue';
import JSON5 from 'json5';

// ==================== 设置持久化管理 ====================
const SETTINGS_STORAGE_KEY = 'json-tool-settings';

// 默认设置
const defaultSettings = {
    // 菜单栏设置
    buttonVisibility: {
        fetchJson: false,
        format: true,
        compress: true,
        escape: true,
        unescape: true,
        compressEscape: true,
        masking: true,
        sort: true,
        share: false,
        dataConvert: true,
        collapse: true,
        fullscreen: true
    },
    // 字符串换行设置（反转逻辑：false=换行，true=不换行，默认不换行）
    wordWrap: true,
    // 字体大小设置
    fontSize: 14,
    // 缩进指南设置
    showIndentGuide: true,
    // 格式化设置
    indentSize: 2,
    encodingMode: 0,
    arrayNewLine: true,
    // 排序设置
    sortMethod: 'dictionary' as 'dictionary' | 'length',
    sortOrder: 'asc' as 'asc' | 'desc'
};

// 加载设置
const loadSettings = () => {
    if (typeof window === 'undefined') return defaultSettings;

    try {
        const saved = localStorage.getItem(SETTINGS_STORAGE_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);

            // 合并默认设置和保存的设置，确保新添加的设置项有默认值
            return {
                ...defaultSettings,
                ...parsed,
                buttonVisibility: {
                    ...defaultSettings.buttonVisibility,
                    ...(parsed.buttonVisibility || {})
                }
            };
        }
    } catch (error) { }

    return defaultSettings;
};

// 保存设置
let isInitializing = true; // 标记是否正在初始化，避免初始化时触发保存
const saveSettings = () => {
    if (typeof window === 'undefined' || isInitializing) return;

    try {
        const settingsToSave = {
            buttonVisibility: buttonVisibility.value,
            wordWrap: wordWrap.value,
            fontSize: fontSize.value,
            showIndentGuide: showIndentGuide.value,
            indentSize: indentSize.value,
            encodingMode: encodingMode.value,
            arrayNewLine: arrayNewLine.value,
            sortMethod: sortMethod.value,
            sortOrder: sortOrder.value
        };
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settingsToSave));
    } catch (error) { }
};

// ==================== 设置持久化管理结束 ====================

const getMessageOffset = () => {
    return isFullscreen.value ? 10 : 56.5;
};
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 文件大小限制：5MB
const MAX_LINES = 100000; // 最大行数限制

// 从 localStorage 加载设置
const savedSettings = loadSettings();

const indentSize = ref(savedSettings.indentSize); // 缩进大小
const maxLevel = ref(0); // 最大层级
const selectedLevel = ref(0); // 当前选中的层级

const wordWrap = ref(savedSettings.wordWrap); // 字符串换行设置
const fontSize = ref(savedSettings.fontSize || 14); // 字体大小设置
const showIndentGuide = ref(savedSettings.showIndentGuide); // 添加缩进指南状态
const arrayNewLine = ref(savedSettings.arrayNewLine); // 添加数组换行控制开关
const isFullscreen = ref(false); // 添加全屏状态控制（不持久化，每次刷新恢复默认）
const isResizing = ref(false); // 添加是否正在调整宽度控制
const leftPanelWidth = ref(50); // 添加面板宽度控制（实时值，用于布局）
const stableLeftPanelWidth = ref(50); // 稳定宽度值，用于计算按钮显示状态（防抖更新）
const encodingMode = ref(savedSettings.encodingMode); // 添加编码处理模式：0-保持原样，1-转中文，2-转Unicode
const outputType = ref<'json' | 'yaml' | 'toml' | 'xml' | 'go'>('json'); // 添加当前输出类型的状态

// 获取JSON数据对话框相关状态
const fetchJsonDialogVisible = ref(false);

// 分享对话框相关状态
const shareDialogVisible = ref(false);

// 数据脱敏对话框相关状态
const dataMaskingDialogVisible = ref(false);

// 排序相关状态
const sortMethod = ref<'dictionary' | 'length'>(savedSettings.sortMethod);
const sortOrder = ref<'asc' | 'desc'>(savedSettings.sortOrder);

// 菜单栏按钮显示控制状态
const buttonVisibility = ref(savedSettings.buttonVisibility);


// 设置对话框相关状态
const settingsDialogVisible = ref(false);
const settingsCollapseActiveNames = ref<string | number>('settings'); // 手风琴展开项，默认展开"设置"

const editorsInitialized = ref(false); // 在script setup部分添加
const inputEditorContainer = ref<HTMLElement | null>(null); // 输入编辑器容器
const outputEditorContainer = ref<HTMLElement | null>(null); // 输出编辑器容器
const editorContainerWidth = ref(0); // 编辑器容器宽度，用于计算按钮显示状态
const toolBarRef = ref<HTMLElement | null>(null); // 工具栏容器引用
const canScrollLeft = ref(false); // 是否可以向左滚动
const canScrollRight = ref(false); // 是否可以向右滚动
let inputEditor: monaco.editor.IStandaloneCodeEditor | null = null; // 输入编辑器实例
let outputEditor: monaco.editor.IStandaloneCodeEditor | null = null; // 输出编辑器实例
let inputEditorResizeObserver: ResizeObserver | null = null; // 输入编辑器容器大小监听器

// 预先计算的折叠信息：Map<行号, {type: 'object' | 'array', count: number}>
// 在格式化时一次性计算，避免实时计算的高成本
const precomputedFoldingInfo = new Map<number, { type: 'object' | 'array'; count: number }>();

// 用于存储待计算的折叠区域信息（异步计算时使用）
interface PendingFoldingItem {
    startLine: number;
    endLine: number;
    type: 'object' | 'array';
}

// 异步计算任务的状态
let asyncComputeTask: {
    pendingItems: PendingFoldingItem[];
    lines: string[];
    isRunning: boolean;
    cancelToken: boolean;
} | null = null;

/**
 * 预先计算所有可折叠区域的信息（异步版本）
 * 使用分批处理，避免阻塞UI，优先计算可见区域
 * @param formattedText 格式化后的JSON文本
 * @param priorityLines 优先计算的行号范围（可选，用于优先计算可见区域）
 */
const precomputeFoldingInfo = async (
    formattedText: string,
    priorityLines?: { start: number; end: number }
): Promise<void> => {
    // 取消之前的计算任务
    if (asyncComputeTask) {
        asyncComputeTask.cancelToken = true;
        asyncComputeTask = null;
    }

    // 清空之前的计算结果
    precomputedFoldingInfo.clear();

    if (!formattedText || !formattedText.trim()) {
        return;
    }

    const lines = formattedText.split('\n');
    const lineCount = lines.length;

    // 使用栈来跟踪所有未闭合的对象/数组
    interface StackItem {
        startLine: number;  // 起始行号（1-based）
        type: 'object' | 'array';  // 类型
        depth: number;  // 括号深度
        charIndex: number;  // 在当前行中的字符索引
    }

    const stack: StackItem[] = [];
    let currentLine = 1;
    let currentCharIndex = 0;
    let inString = false;
    let escapeNext = false;

    // 第一阶段：快速遍历，找到所有折叠区域的边界（不计算统计信息）
    const pendingItems: PendingFoldingItem[] = [];

    for (let lineIndex = 0; lineIndex < lineCount; lineIndex++) {
        const line = lines[lineIndex];
        currentLine = lineIndex + 1;
        currentCharIndex = 0;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            currentCharIndex = i;

            if (escapeNext) {
                escapeNext = false;
                continue;
            }

            if (char === '\\') {
                escapeNext = true;
                continue;
            }

            if (char === '"') {
                inString = !inString;
                continue;
            }

            if (!inString) {
                if (char === '{' || char === '[') {
                    // 找到新的对象或数组开始
                    stack.push({
                        startLine: currentLine,
                        type: char === '{' ? 'object' : 'array',
                        depth: stack.length,
                        charIndex: currentCharIndex
                    });
                } else if (char === '}' || char === ']') {
                    // 找到匹配的结束括号
                    if (stack.length > 0) {
                        const lastItem = stack[stack.length - 1];
                        const expectedType = char === '}' ? 'object' : 'array';

                        if (lastItem.type === expectedType) {
                            // 匹配成功，记录待计算的区域
                            pendingItems.push({
                                startLine: lastItem.startLine,
                                endLine: currentLine,
                                type: lastItem.type
                            });
                            stack.pop();
                        }
                    }
                }
            }
        }
    }

    // 第二阶段：异步分批计算统计信息
    // 如果有优先区域，先计算优先区域内的项
    const priorityItems: PendingFoldingItem[] = [];
    const normalItems: PendingFoldingItem[] = [];

    if (priorityLines) {
        pendingItems.forEach(item => {
            if (item.startLine >= priorityLines.start && item.startLine <= priorityLines.end) {
                priorityItems.push(item);
            } else {
                normalItems.push(item);
            }
        });
    } else {
        normalItems.push(...pendingItems);
    }

    // 创建异步计算任务
    const task = {
        pendingItems: [...priorityItems, ...normalItems], // 优先项在前
        lines,
        isRunning: true,
        cancelToken: false
    };
    asyncComputeTask = task;

    // 使用 requestIdleCallback 或 setTimeout 进行分批处理
    const useIdleCallback = typeof requestIdleCallback !== 'undefined';
    const BATCH_SIZE = 50; // 每批处理50个区域
    let currentIndex = 0;

    const processBatch = (deadline?: IdleDeadline) => {
        if (task.cancelToken) {
            return;
        }

        let processed = 0;
        while (currentIndex < task.pendingItems.length && processed < BATCH_SIZE) {
            if (useIdleCallback && deadline && deadline.timeRemaining() < 1) {
                break; // 时间用完了，让出控制权
            }

            const item = task.pendingItems[currentIndex];
            currentIndex++;

            // 计算该区域的keys或items数量
            const count = calculateFoldingCount(
                task.lines,
                item.startLine - 1,  // 转换为0-based索引
                item.endLine - 1,
                item.type
            );

            // 只存储非空的折叠区域
            if (count > 0) {
                precomputedFoldingInfo.set(item.startLine, {
                    type: item.type,
                    count: count
                });
            }

            processed++;
        }

        // 如果还有未处理的项，继续处理
        if (currentIndex < task.pendingItems.length && !task.cancelToken) {
            if (useIdleCallback) {
                requestIdleCallback(processBatch);
            } else {
                setTimeout(processBatch, 0);
            }
        } else {
            // 计算完成
            task.isRunning = false;
            if (asyncComputeTask === task) {
                asyncComputeTask = null;
            }
        }
    };

    // 开始处理
    if (useIdleCallback) {
        requestIdleCallback(processBatch);
    } else {
        setTimeout(processBatch, 0);
    }
};

/**
 * 计算折叠区域的统计信息（keys或items数量）
 * @param lines 所有行的数组
 * @param startLineIndex 起始行索引（0-based）
 * @param endLineIndex 结束行索引（0-based）
 * @param type 类型（'object' 或 'array'）
 */
const calculateFoldingCount = (
    lines: string[],
    startLineIndex: number,
    endLineIndex: number,
    type: 'object' | 'array'
): number => {
    // 提取该区域的内容
    let content = '';
    for (let i = startLineIndex; i <= endLineIndex; i++) {
        if (i < lines.length) {
            content += lines[i];
            if (i < endLineIndex) {
                content += '\n';
            }
        }
    }

    // 找到开始和结束括号的位置
    const startBracket = type === 'object' ? content.indexOf('{') : content.indexOf('[');
    const endBracket = type === 'object' ? content.lastIndexOf('}') : content.lastIndexOf(']');

    if (startBracket === -1 || endBracket === -1 || endBracket <= startBracket) {
        return 0;
    }

    // 提取括号内的内容
    const innerContent = content.substring(startBracket + 1, endBracket).trim();

    if (!innerContent) {
        return 0;
    }

    // 计算keys或items数量
    if (type === 'object') {
        // 对于对象，计算一级key的数量
        // 方法：统计第一层的冒号数量（在JSON中，第一层的冒号一定对应一个key）
        let keyCount = 0;
        let inString = false;
        let escapeNext = false;
        let braceDepth = 0; // 对象括号深度（相对于当前对象，从0开始）
        let bracketDepth = 0; // 数组括号深度
        const keyPositions: number[] = []; // 记录key的位置（用于调试）

        for (let i = 0; i < innerContent.length; i++) {
            const char = innerContent[i];

            if (escapeNext) {
                escapeNext = false;
                continue;
            }

            if (char === '\\') {
                escapeNext = true;
                continue;
            }

            if (char === '"') {
                inString = !inString;
                continue;
            }

            if (!inString) {
                if (char === '{') {
                    braceDepth++;
                } else if (char === '}') {
                    braceDepth--;
                } else if (char === '[') {
                    bracketDepth++;
                } else if (char === ']') {
                    bracketDepth--;
                } else if (char === ':' && braceDepth === 0 && bracketDepth === 0) {
                    // 第一层的冒号（不在嵌套对象或数组中），说明这是一个key
                    keyCount++;
                    keyPositions.push(i);
                }
            }
        }

        return keyCount;
    } else {
        // 对于数组，计算元素数量
        let depth = 0;
        let braceDepth = 0;
        let bracketDepth = 0;
        let inString = false;
        let escapeNext = false;
        let elementCount = 0;
        let hasContent = false;
        let lastCommaPos = -1; // 上一个逗号的位置
        const commaPositions: number[] = []; // 记录第一层逗号的位置（用于调试）

        for (let i = 0; i < innerContent.length; i++) {
            const char = innerContent[i];

            if (escapeNext) {
                escapeNext = false;
                hasContent = true;
                continue;
            }

            if (char === '\\') {
                escapeNext = true;
                hasContent = true;
                continue;
            }

            if (char === '"') {
                inString = !inString;
                hasContent = true;
                continue;
            }

            if (!inString) {
                if (char === '{') {
                    braceDepth++;
                    depth = braceDepth + bracketDepth;
                    hasContent = true;
                } else if (char === '}') {
                    braceDepth--;
                    depth = braceDepth + bracketDepth;
                } else if (char === '[') {
                    bracketDepth++;
                    depth = braceDepth + bracketDepth;
                    hasContent = true;
                } else if (char === ']') {
                    bracketDepth--;
                    depth = braceDepth + bracketDepth;
                } else if (char === ',' && depth === 0) {
                    // 第一层的逗号，表示一个元素结束
                    if (hasContent) {
                        elementCount++;
                    }
                    hasContent = false;
                    lastCommaPos = i;
                    commaPositions.push(i);
                } else if (char.trim() && depth === 0) {
                    hasContent = true;
                }
            } else {
                hasContent = true;
            }
        }

        // 处理最后一个元素（如果存在）
        if (hasContent && depth === 0) {
            elementCount++;
        }

        return elementCount;
    }
};

let outputEditorResizeObserver: ResizeObserver | null = null; // 输出编辑器容器大小监听器
let stableWidthUpdateTimer: ReturnType<typeof setTimeout> | null = null; // 稳定宽度更新定时器

// 编辑器状态栏信息
const inputEditorStatus = ref('');
const outputEditorStatus = ref('');
const isFolding = ref(false); // 是否正在执行折叠操作

// 拖动相关状态（提升到外层作用域，避免每次拖动创建新变量）
let resizeState: {
    initialX: number;
    initialPercentage: number;
    container: HTMLElement | null;
    rect: DOMRect | null;
    minWidthPercent: number;
    maxWidthPercent: number;
    minWidthPx: number;
    // 预览区域滚动位置（用于在拖动过程中保持滚动内容位置不变）
    outputScrollLeft: number; // 拖动开始时的水平滚动位置
    outputScrollTop: number; // 拖动开始时的垂直滚动位置
} | null = null;

// 缓存容器引用，避免每次查询 DOM
let editorContainer: HTMLElement | null = null;

// 防抖更新稳定宽度值，避免极快拖动时按钮状态频繁切换
const updateStableWidth = () => {
    // 清除之前的定时器
    if (stableWidthUpdateTimer) {
        clearTimeout(stableWidthUpdateTimer);
    }
    // 延迟更新稳定宽度值（100ms后），确保拖动稳定后才更新按钮显示状态
    stableWidthUpdateTimer = setTimeout(() => {
        stableLeftPanelWidth.value = leftPanelWidth.value;
    }, 100);
};

// 按钮显示临界宽度（像素）：标题 + 两个按钮 + gap + padding 的总宽度
// 计算："输入区域"(约60px) + "清空"按钮(约70px) + "上传"按钮(约70px) + gap(12px) + padding(30px) ≈ 242px
// 设置为 260px 以确保有足够余量，避免换行
const BUTTON_MIN_WIDTH = 260;

// 计算属性：判断输入区域是否显示按钮
// 非拖动时使用稳定宽度值，避免频繁计算
const showInputActions = computed(() => {
    if (editorContainerWidth.value === 0) return true; // 初始化时显示

    // 拖动时使用实时宽度，确保按钮立即响应（解决标题换行问题）
    // 非拖动时使用稳定宽度，避免不必要的计算
    const widthToUse = isResizing.value ? leftPanelWidth.value : stableLeftPanelWidth.value;
    const leftPanelWidthPx = (widthToUse / 100) * editorContainerWidth.value;

    // 宽度小于临界值时立即隐藏按钮，确保标题不换行
    return leftPanelWidthPx >= BUTTON_MIN_WIDTH;
});

// 计算属性：判断预览区域是否显示按钮
// 非拖动时使用稳定宽度值，避免频繁计算
const showOutputActions = computed(() => {
    if (editorContainerWidth.value === 0) return true; // 初始化时显示

    // 拖动时使用实时宽度，确保按钮立即响应（解决标题换行问题）
    // 非拖动时使用稳定宽度，避免不必要的计算
    const widthToUse = isResizing.value ? leftPanelWidth.value : stableLeftPanelWidth.value;
    const rightPanelWidthPx = ((100 - widthToUse) / 100) * editorContainerWidth.value;

    // 宽度小于临界值时立即隐藏按钮，确保标题不换行
    return rightPanelWidthPx >= BUTTON_MIN_WIDTH;
});


// 添加消息提示函数
const showSuccess = (message: string) => {
    ElMessage({
        message,
        type: 'success'
    })
};

const showError = (message: string) => {
    ElMessage({
        message,
        type: 'error'
    })
};

const showWarning = (message: string) => {
    ElMessage({
        message,
        type: 'warning'
    })
};

const showInfo = (message: string, duration: number = 300) => {
    ElMessage({
        message,
        type: 'info',
        duration
    })
};

// 更新编辑器行号宽度
const updateLineNumberWidth = (editor: monaco.editor.IStandaloneCodeEditor | null) => {
    if (!editor) return;

    const lineCount = editor.getModel()?.getLineCount() || 0;
    // 当行数小于999时，固定为3位数宽度；否则按实际行数计算
    const digitCount = lineCount < 999 ? 3 : String(lineCount).length;
    const minChars = digitCount + 1;

    editor.updateOptions({
        lineNumbers: 'on',
        lineNumbersMinChars: minChars
    });

    // 必须调用 layout() 才能让行号宽度更新生效
    editor.layout();
};

// 更新编辑器高度
const updateEditorHeight = (editor: monaco.editor.IStandaloneCodeEditor | null) => {
    if (!editor) return;

    // 获取 Monaco 编辑器实例的容器（.monaco-editor-instance）
    const editorInstance = editor.getContainerDomNode();

    // 获取父容器（.monaco-editor-container），这是实际控制高度的容器
    const editorContainer = editorInstance.parentElement;
    if (!editorContainer) return;

    // 使用父容器的高度，确保编辑器不会超出容器范围
    const containerHeight = editorContainer.clientHeight;
    const containerWidth = editorContainer.clientWidth;

    // 使用容器高度和宽度
    editor.layout({
        width: containerWidth,
        height: containerHeight
    });
};

// 更新编辑器布局
const updateEditorLayout = () => {
    updateEditorHeight(inputEditor);
    updateEditorHeight(outputEditor);
};

// 获取编辑器配置
const getEditorOptions = (size: number, isReadOnly: boolean = false, language: string = 'json', enableLargeFileFolding: boolean = false) => ({
    // 基础配置
    value: '',
    language,
    theme: 'vs',
    readOnly: isReadOnly,

    // 外观配置
    minimap: { enabled: false }, // 禁用右侧的代码概览图
    lineNumbers: 'on' as const, // 启用行号
    roundedSelection: true, // 启用圆角选择
    renderIndentGuides: true, // 启用缩进指南线
    renderLineHighlight: 'gutter' as const, // 启用所有行高亮
    lineNumbersMinChars: 1, // 设置行号最小字符数为1
    renderWhitespace: 'none' as const, // 禁用空白字符显示

    // 右键菜单配置
    contextmenu: true, // 启用右键菜单

    // 滚动配置
    scrollBeyondLastLine: false, // 禁止滚动超过最后一行
    scrollbar: { // 滚动条配置
        vertical: 'visible' as const, // 垂直滚动条可见
        verticalScrollbarSize: 10, // 垂直滚动条大小
        useShadows: true, // 禁用阴影  
        scrollByPage: false, // 不按页滚动
        alwaysConsumeMouseWheel: true, // 总是响应鼠标滚轮事件
    },
    smoothScrolling: true, // 启用平滑滚动
    fixedOverflowWidgets: true, // 使溢出窗口(如提示、自动完成)固定显示
    stickyScroll: { enabled: false }, // 禁用粘性滚动

    // 折叠配置
    folding: true, // 启用代码折叠功能（这是基础配置，必须开启）
    ...(enableLargeFileFolding ? {
        // 大文件折叠优化配置
        // 注意：这些选项可能不在 TypeScript 类型定义中，但实际运行时有效
        foldingMaximumRegions: 100000, // 增加折叠区域上限（默认约5000），支持超大JSON文件
        largeFileOptimizations: false, // 禁用大文件优化，强制启用完整语法分析和折叠计算
    } : {}),

    // 编辑器配置
    links: false, // 禁用链接检测功能
    tabSize: size, //  使用传入的大小作为Tab宽度
    indentSize: size, // 使用传入的大小作为缩进宽度
    wordWrap: wordWrap.value ? 'off' as const : 'on' as const, // 字符串换行设置（反转逻辑：false=换行，true=不换行）
    fontSize: fontSize.value, // 字体大小设置
    autoClosingBrackets: 'languageDefined' as const, // 根据语言自动闭合括号
    autoClosingQuotes: 'languageDefined' as const, // 根据语言自动闭合引号
    formatOnPaste: true, // 启用粘贴时自动格式化
    maxUndoRedoEntries: 100, // 历史记录可撤销/重做的最大步数为100
    useTabStops: false, // 禁用TabStop
    maxTokenizationLineLength: 100000,
    guides: {
        indentation: true, // 启用缩进引导线
        bracketPairs: true, // 启用括号配对
        highlightActiveIndentation: true // 高亮显示当前缩进
    },

    // 添加可访问性支持配置    
    quickSuggestions: true,
    find: {     // 配置查找组件
        addExtraSpaceOnTop: false, // 查找框顶部不添加额外空间
        autoFindInSelection: 'multiline' as const, // 不自动在选择区域内查找
        seedSearchStringFromSelection: 'always' as const, // 不使用选择内容作为查找初始内容
        globalFindClipboard: false // 禁用全局查找剪贴板
    },

    // Unicode 高亮配置 - 禁用中文等非基本ASCII字符的黄色方框高亮
    unicodeHighlight: {}
});

// 更新字符串换行
const updateWordWrap = () => {
    // 反转逻辑：wordWrap=false 表示换行（'on'），wordWrap=true 表示不换行（'off'）
    const options = {
        wordWrap: wordWrap.value ? 'off' as const : 'on' as const
    };

    inputEditor?.updateOptions(options);
    outputEditor?.updateOptions(options);

    // 换行设置改变后，需要重新布局编辑器以确保正确显示
    nextTick(() => {
        updateEditorLayout();
    });
};

// 更新字体大小
const updateFontSize = () => {
    const options = {
        fontSize: fontSize.value
    };

    inputEditor?.updateOptions(options);
    outputEditor?.updateOptions(options);
};

// 更新缩进指南
const updateIndentGuides = () => {
    const options = {
        renderIndentGuides: showIndentGuide.value,
        guides: {
            indentation: showIndentGuide.value,
            highlightActiveIndentation: showIndentGuide.value,
            bracketPairs: showIndentGuide.value
        }
    };

    inputEditor?.updateOptions(options);
    outputEditor?.updateOptions(options);
};

// 更新输出编辑器配置（包括模型选项，确保缩进指南线正确显示）
const updateOutputEditorConfig = (language: string = 'json', enableLargeFileFolding: boolean = false) => {
    if (!outputEditor) return;

    const model = outputEditor.getModel();
    if (model) {
        monaco.editor.setModelLanguage(model, language);
        // 更新模型选项，确保缩进指南线正确显示
        model.updateOptions({
            tabSize: indentSize.value,
            indentSize: indentSize.value,
            insertSpaces: true
        });
    }

    // 更新编辑器配置
    outputEditor.updateOptions(getEditorOptions(indentSize.value, true, language, enableLargeFileFolding));

    updateLineNumberWidth(outputEditor);
    updateEditorHeight(outputEditor);
};

// 设置折叠信息显示（在折叠区域显示 n keys 或 n items）
const setupFoldingInfoDisplay = (editor: monaco.editor.IStandaloneCodeEditor) => {
    if (!editor) return;

    const model = editor.getModel();
    if (!model) return;

    // 从预先计算的数据中获取折叠区域的信息
    const getFoldingInfo = (startLine: number): { type: 'object' | 'array', count: number } | null => {
        const info = precomputedFoldingInfo.get(startLine) || null;
        return info;
    };

    // 存储已添加的信息元素，用于清理
    // key: lineNumber, value: { element: HTMLElement, foldedElement: Element }
    const infoElements = new Map<number, { element: HTMLElement; foldedElement: Element }>();

    // 控制是否禁用更新（层级收缩时）
    let isUpdateDisabled = false;
    let disableUpdateTimeout: ReturnType<typeof setTimeout> | null = null;

    // 禁用更新（用于层级收缩等批量操作）
    const disableUpdate = (duration: number = 5000) => {
        isUpdateDisabled = true;
        if (disableUpdateTimeout) clearTimeout(disableUpdateTimeout);
        disableUpdateTimeout = setTimeout(() => {
            // 检查 model 是否已被销毁
            if (!model || model.isDisposed()) {
                return;
            }
            isUpdateDisabled = false;
            // 禁用结束后，延迟更新一次
            setTimeout(() => {
                if (!isUpdateDisabled && model && !model.isDisposed()) {
                    updateFoldingInfo();
                }
            }, 300);
        }, duration);
    };

    // 立即启用更新并触发更新（用于折叠操作完成后）
    const enableUpdateAndRefresh = () => {
        // 检查 model 是否已被销毁
        if (!model || model.isDisposed()) {
            return;
        }
        // 清除禁用定时器
        if (disableUpdateTimeout) {
            clearTimeout(disableUpdateTimeout);
            disableUpdateTimeout = null;
        }
        // 立即启用更新
        isUpdateDisabled = false;
        // 清除防抖定时器，立即触发更新
        if (updateTimer) {
            clearTimeout(updateTimer);
            updateTimer = null;
        }
        // 对于小数据量，使用更短的延迟确保DOM已渲染
        const lineCount = model.getLineCount();
        const delay = lineCount < 1000 ? 50 : 150; // 小数据量50ms，大数据量150ms
        setTimeout(() => {
            if (!isUpdateDisabled && model && !model.isDisposed()) {
                updateFoldingInfo();
            }
        }, delay);
    };

    // 防抖函数（小数据量时使用更短的延迟）
    let updateTimer: ReturnType<typeof setTimeout> | null = null;
    const debouncedUpdate = () => {
        // 检查 model 是否已被销毁
        if (!model || model.isDisposed()) {
            return;
        }
        if (isUpdateDisabled) return; // 如果禁用更新，直接返回
        if (updateTimer) clearTimeout(updateTimer);
        // 根据数据量动态调整防抖延迟
        const lineCount = model.getLineCount();
        const delay = lineCount < 1000 ? 50 : 150; // 小数据量50ms，大数据量150ms
        updateTimer = setTimeout(() => {
            if (!isUpdateDisabled && model && !model.isDisposed()) {
                updateFoldingInfo();
            }
        }, delay);
    };

    // 获取可见行号范围（带缓冲区，确保滚动时也能显示）
    // 统计方式：
    // 1. 通过 editor.getVisibleRanges() 获取 Monaco Editor 当前实际可见的行范围
    // 2. 遍历所有可见范围，找到最小行号（minLine）和最大行号（maxLine）
    // 3. 在上下各扩展 50 行作为缓冲区，用于预加载滚动时即将进入视野的内容
    // 4. 最终返回的范围 = [max(1, minLine - 50), min(总行数, maxLine + 50)]
    // 例如：如果实际可见行是 10-20，则返回范围是 1-70（向上扩展到1，向下扩展到70）
    // 这样在控制台显示 "可见范围: 1-78" 时，表示处理的行范围是 1 到 78 行（包括缓冲区）
    const getVisibleLineRange = (): { start: number; end: number } | null => {
        try {
            // 检查 model 是否已被销毁
            if (!model || model.isDisposed()) {
                return null;
            }
            const visibleRanges = editor.getVisibleRanges();
            if (!visibleRanges || visibleRanges.length === 0) return null;

            // 找到最小和最大行号
            let minLine = Infinity;
            let maxLine = 0;

            visibleRanges.forEach(range => {
                if (range.startLineNumber < minLine) minLine = range.startLineNumber;
                if (range.endLineNumber > maxLine) maxLine = range.endLineNumber;
            });

            if (minLine === Infinity || maxLine === 0) return null;

            // 添加缓冲区：上下各扩展50行，确保滚动时也能显示
            const buffer = 50;
            const totalLines = model.getLineCount();
            const start = Math.max(1, minLine - buffer);
            const end = Math.min(totalLines, maxLine + buffer);

            return { start, end };
        } catch (e) {
            return null;
        }
    };

    // 更新折叠信息显示（通过DOM操作）
    const updateFoldingInfo = () => {
        // 检查 model 是否已被销毁
        if (!model || model.isDisposed()) {
            return;
        }
        if (isUpdateDisabled) {
            return; // 如果禁用更新，直接返回
        }

        try {
            // 获取可见行号范围（性能优化：只处理可见区域）
            const visibleRange = getVisibleLineRange();
            if (!visibleRange) {
                return;
            }

            // 获取编辑器的DOM容器
            const editorDom = editor.getDomNode();
            if (!editorDom) {
                return;
            }

            // 查找所有包含 inline-folded 类的元素
            const foldedElements = editorDom.querySelectorAll('.inline-folded');

            // 收集当前存在的折叠元素对应的行号（仅可见区域）
            const currentFoldedLines = new Set<number>();

            // 遍历所有折叠元素，但只处理可见区域内的
            foldedElements.forEach((foldedElement, index) => {
                // 获取包含这个折叠元素的视图行
                const viewLine = foldedElement.closest('.view-line') as HTMLElement;
                if (!viewLine) return;

                // 使用Monaco Editor的getTargetAtClientPoint API，通过DOM元素的坐标来获取准确的行号
                // 这是最可靠的方法，不依赖于可见范围的计算
                let lineNumber: number | null = null;
                let originalLineNumber: number | null = null;

                try {
                    // 获取视图行的位置信息（相对于浏览器窗口的坐标）
                    const rect = viewLine.getBoundingClientRect();

                    // 快速检查：如果元素不在可见区域附近，跳过（性能优化）
                    // 注意：这里只是粗略检查，实际行号还需要通过API获取
                    const editorRect = editorDom.getBoundingClientRect();
                    const elementTop = rect.top - editorRect.top;
                    const elementBottom = rect.bottom - editorRect.top;
                    const editorHeight = editorRect.height;

                    // 如果元素完全在可见区域外（上下各留100px缓冲区），跳过
                    if (elementBottom < -100 || elementTop > editorHeight + 100) {
                        return;
                    }

                    // 方法1：使用行的中间位置
                    const x = rect.left + rect.width / 2;
                    const y = rect.top + rect.height / 2;

                    // 使用Monaco的getTargetAtClientPoint API获取准确的行号
                    let target = editor.getTargetAtClientPoint(x, y);
                    if (target && target.position) {
                        lineNumber = target.position.lineNumber;
                        originalLineNumber = lineNumber;
                    }

                    // 方法2：如果方法1失败，尝试使用折叠元素本身的坐标（适用于单行数组的情况）
                    if (!lineNumber) {
                        const foldedRect = foldedElement.getBoundingClientRect();
                        const foldedX = foldedRect.left + foldedRect.width / 2;
                        const foldedY = foldedRect.top + foldedRect.height / 2;
                        target = editor.getTargetAtClientPoint(foldedX, foldedY);
                        if (target && target.position) {
                            lineNumber = target.position.lineNumber;
                            originalLineNumber = lineNumber;
                        }
                    }

                    // 方法3：如果前两种方法都失败，尝试通过遍历可见行来查找
                    // 这种情况通常发生在单行数组折叠时，折叠元素可能不在标准的view-line中
                    if (!lineNumber && visibleRange) {
                        // 获取编辑器内容区域的DOM元素（.view-lines）
                        const viewLinesContainer = editorDom.querySelector('.view-lines') as HTMLElement;
                        if (viewLinesContainer) {
                            const viewLinesRect = viewLinesContainer.getBoundingClientRect();
                            const foldedRect = foldedElement.getBoundingClientRect();

                            // 计算折叠元素相对于内容区域的Y坐标
                            const elementY = foldedRect.top + foldedRect.height / 2 - viewLinesRect.top;

                            // 遍历可见范围内的所有行，通过Y坐标匹配来查找
                            for (let line = visibleRange.start; line <= visibleRange.end; line++) {
                                try {
                                    // 使用Monaco API获取行的Y坐标范围（相对于内容区域）
                                    const lineTop = editor.getTopForLineNumber(line);
                                    const lineHeight = editor.getOption(monaco.editor.EditorOption.lineHeight);
                                    const lineBottom = lineTop + lineHeight;

                                    // 检查折叠元素的Y坐标是否在这一行的范围内
                                    if (elementY >= lineTop && elementY < lineBottom) {
                                        lineNumber = line;
                                        originalLineNumber = line;
                                        break;
                                    }
                                } catch (e) {
                                    // 继续查找下一行
                                    continue;
                                }
                            }
                        }
                    }
                } catch (e) {
                    return;
                }

                if (!lineNumber) {
                    return;
                }

                // 性能优化：只处理可见区域内的行（带缓冲区）
                if (lineNumber < visibleRange.start || lineNumber > visibleRange.end) {
                    return;
                }

                // 检查这一行是否是折叠起始行（直接检查precomputedFoldingInfo，因为它已经包含了所有折叠起始行）
                // 注意：折叠起始行可能是 "key": { 或 "key": [ 的形式，不一定以 { 或 [ 开头
                // originalLineNumber 已在上面声明
                if (precomputedFoldingInfo.has(lineNumber)) {
                    // 当前行就是折叠起始行
                    currentFoldedLines.add(lineNumber);
                } else {
                    // 如果不是，向上查找最近的折叠起始行（最多向上查找20行）
                    let found = false;
                    for (let i = lineNumber - 1; i >= Math.max(1, lineNumber - 20); i--) {
                        if (precomputedFoldingInfo.has(i)) {
                            // 找到了折叠起始行
                            lineNumber = i;
                            found = true;
                            break;
                        }
                    }

                    if (!found) {
                        // 如果找不到，跳过这个折叠元素
                        return;
                    }

                    currentFoldedLines.add(lineNumber);
                }

                // 检查是否已经添加过信息，并且元素仍然存在
                const existingInfo = infoElements.get(lineNumber);
                if (existingInfo) {
                    // 检查元素是否还在DOM中，并且对应的foldedElement是否还是同一个
                    if (document.body.contains(existingInfo.element) &&
                        existingInfo.foldedElement === foldedElement) {
                        // 元素已存在且有效，跳过
                        return;
                    } else {
                        // 元素已失效，移除它
                        existingInfo.element.remove();
                        infoElements.delete(lineNumber);
                    }
                }

                // 获取折叠信息（直接从预先计算的数据中获取）
                const info = getFoldingInfo(lineNumber);
                if (!info || info.count === 0) {
                    return;
                }

                // 构建显示文本
                const displayText = info.type === 'object'
                    ? `${info.count} keys`
                    : `${info.count} items`;

                // 创建信息元素
                const infoElement = document.createElement('span');
                infoElement.className = 'folding-info-text';
                infoElement.textContent = ` ${displayText}`;

                // 将信息元素直接插入到 inline-folded 元素之后
                // 这样信息就会显示在 "..." 后面
                if (foldedElement.parentNode) {
                    // 在 foldedElement 后面插入信息元素
                    foldedElement.parentNode.insertBefore(infoElement, foldedElement.nextSibling);
                    infoElements.set(lineNumber, { element: infoElement, foldedElement });
                } else {
                    // 如果找不到父节点，尝试添加到视图行
                    (viewLine as HTMLElement).appendChild(infoElement);
                    infoElements.set(lineNumber, { element: infoElement, foldedElement });
                }
            });

            // 清理不再存在的折叠元素对应的信息，以及不可见区域的信息元素
            infoElements.forEach((info, lineNumber) => {
                // 检查是否在可见区域外，或者折叠元素已不存在
                const isOutsideVisibleRange = lineNumber < visibleRange.start || lineNumber > visibleRange.end;
                const isFoldedElementRemoved = !currentFoldedLines.has(lineNumber);

                if (isFoldedElementRemoved) {
                    // 这个行号对应的折叠元素已经不存在了，移除信息元素
                    if (info.element && info.element.parentNode) {
                        info.element.remove();
                    }
                    infoElements.delete(lineNumber);
                } else if (isOutsideVisibleRange) {
                    // 不在可见区域内，清理信息元素（滚动时会重新创建）
                    if (info.element && info.element.parentNode) {
                        info.element.remove();
                    }
                    infoElements.delete(lineNumber);
                }
            });
        } catch (error) {
            // 忽略错误，避免影响编辑器正常使用
        }
    };

    // 监听内容变化
    editor.onDidChangeModelContent(() => {
        debouncedUpdate();
    });

    // 使用定时器定期更新折叠信息（作为备用方案，但频率降低）
    let intervalTimer: ReturnType<typeof setInterval> | null = null;

    // 监听编辑器焦点变化，当获得焦点时开始定时更新
    editor.onDidFocusEditorText(() => {
        if (intervalTimer) clearInterval(intervalTimer);
        // 降低更新频率，避免闪烁
        intervalTimer = setInterval(() => {
            updateFoldingInfo();
        }, 2000);
        debouncedUpdate();
    });

    editor.onDidBlurEditorText(() => {
        if (intervalTimer) {
            clearInterval(intervalTimer);
            intervalTimer = null;
        }
    });

    // 使用MutationObserver监听DOM变化（折叠按钮的显示/隐藏）
    // 但只在折叠相关的类变化时才触发
    const observer = new MutationObserver((mutations) => {
        // 检查是否有折叠相关的变化
        const hasFoldingChange = mutations.some(mutation => {
            if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                const target = mutation.target as Element;
                return target.classList.contains('inline-folded') ||
                    target.querySelector('.inline-folded') !== null;
            }
            if (mutation.type === 'childList') {
                return Array.from(mutation.addedNodes).some(node =>
                    node instanceof Element && (
                        node.classList.contains('inline-folded') ||
                        node.querySelector('.inline-folded') !== null
                    )
                ) || Array.from(mutation.removedNodes).some(node =>
                    node instanceof Element && (
                        node.classList.contains('inline-folded') ||
                        node.querySelector('.inline-folded') !== null
                    )
                );
            }
            return false;
        });

        if (hasFoldingChange) {
            debouncedUpdate();
        }
    });

    // 观察编辑器DOM
    const editorDom = editor.getContainerDomNode();
    if (editorDom) {
        observer.observe(editorDom, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class']
        });
    }

    // 监听鼠标点击事件（用户点击折叠按钮时）
    editorDom?.addEventListener('click', (e) => {
        // 检查 model 是否已被销毁
        if (!model || model.isDisposed()) {
            return;
        }
        const target = e.target as Element;
        const isFoldingClick = target.closest('.folding') || target.closest('.inline-folded');
        // 只在点击折叠相关元素时触发
        if (isFoldingClick) {
            // 对于小数据量，使用更短的延迟确保快速响应
            const lineCount = model.getLineCount();
            if (lineCount < 1000) {
                // 小数据量：清除防抖，使用短延迟立即更新
                if (updateTimer) clearTimeout(updateTimer);
                updateTimer = setTimeout(() => {
                    if (!isUpdateDisabled && model && !model.isDisposed()) {
                        updateFoldingInfo();
                    }
                }, 30); // 小数据量使用30ms延迟
            } else {
                // 大数据量：使用防抖
                debouncedUpdate();
            }
        }
    }, true);

    // 监听滚动事件（性能优化：滚动时更新可见区域的折叠信息）
    // 使用 requestAnimationFrame 进行节流，确保滚动时流畅更新
    // 优化策略：
    // 1. 使用 requestAnimationFrame 确保更新与浏览器重绘同步，更流畅
    // 2. 设置最小更新间隔 50ms（约20fps），避免过度更新影响性能
    // 3. 滚动停止后延迟 150ms 执行最终更新，确保所有内容都已渲染
    let scrollRafId: number | null = null;
    let scrollTimer: ReturnType<typeof setTimeout> | null = null;
    let lastUpdateTime = 0;
    const SCROLL_UPDATE_INTERVAL = 50; // 最小更新间隔50ms（约20fps），平衡性能和流畅度

    editor.onDidScrollChange(() => {
        // 检查 model 是否已被销毁
        if (!model || model.isDisposed()) {
            return;
        }
        if (isUpdateDisabled) return; // 如果禁用更新，直接返回

        const now = Date.now();

        // 如果距离上次更新超过最小间隔，立即安排更新
        if (now - lastUpdateTime >= SCROLL_UPDATE_INTERVAL) {
            if (scrollRafId) cancelAnimationFrame(scrollRafId);
            scrollRafId = requestAnimationFrame(() => {
                if (!isUpdateDisabled && model && !model.isDisposed()) {
                    updateFoldingInfo();
                    lastUpdateTime = Date.now();
                }
                scrollRafId = null;
            });
        } else {
            // 否则，安排在下一次合适的时机更新
            if (!scrollRafId) {
                scrollRafId = requestAnimationFrame(() => {
                    // 再次检查时间，确保间隔足够
                    const checkTime = Date.now();
                    if (checkTime - lastUpdateTime >= SCROLL_UPDATE_INTERVAL) {
                        if (!isUpdateDisabled && model && !model.isDisposed()) {
                            updateFoldingInfo();
                            lastUpdateTime = checkTime;
                        }
                    }
                    scrollRafId = null;
                });
            }
        }

        // 滚动停止后，确保最终更新一次
        if (scrollTimer) clearTimeout(scrollTimer);
        scrollTimer = setTimeout(() => {
            // 检查 model 是否已被销毁
            if (!model || model.isDisposed()) {
                return;
            }
            if (scrollRafId) cancelAnimationFrame(scrollRafId);
            scrollRafId = requestAnimationFrame(() => {
                if (!isUpdateDisabled && model && !model.isDisposed()) {
                    updateFoldingInfo();
                    lastUpdateTime = Date.now();
                }
                scrollRafId = null;
            });
        }, 150); // 滚动停止150ms后执行最终更新
    });

    // 初始更新
    setTimeout(() => {
        updateFoldingInfo();
    }, 1000);

    // 监听Monaco的折叠变化事件（当折叠状态改变时立即更新）
    editor.onDidChangeModelDecorations(() => {
        // 检查是否有折叠相关的装饰变化
        // 使用防抖避免频繁更新
        debouncedUpdate();
    });

    // 导出函数，供外部调用（层级收缩时使用）
    (editor as any).__disableFoldingInfoUpdate = disableUpdate;
    (editor as any).__enableFoldingInfoUpdateAndRefresh = enableUpdateAndRefresh;
};

// 提取 JSON 字符串内容（去除引号和转义字符）
const extractStringValue = (text: string): string | null => {
    // 移除首尾的引号
    if ((text.startsWith('"') && text.endsWith('"')) ||
        (text.startsWith("'") && text.endsWith("'"))) {
        const inner = text.slice(1, -1);
        try {
            // 使用 JSON.parse 来处理转义字符
            return JSON.parse(`"${inner}"`);
        } catch {
            // 如果解析失败，直接返回去掉引号的内容
            return inner;
        }
    }
    return null;
};

// 查找字符串的完整范围（包括引号）
const findStringRange = (model: monaco.editor.ITextModel, position: monaco.Position): monaco.Range | null => {
    const lineNumber = position.lineNumber;
    const column = position.column;
    const lineContent = model.getLineContent(lineNumber);

    // Monaco 的 column 是从 1 开始的，转换为数组索引（从 0 开始）
    const currentIndex = column - 1;

    // 检查当前位置是否是引号
    if (currentIndex < lineContent.length && lineContent[currentIndex] === '"') {
        // 如果当前位置是引号，检查它是否是字符串的开始还是结束
        // 先检查是否是字符串开始（向后查找是否有结束引号）
        let escapeNext = false;
        let foundEnd = false;
        let endCol = -1;

        for (let i = currentIndex + 1; i < lineContent.length; i++) {
            const char = lineContent[i];

            if (escapeNext) {
                escapeNext = false;
                continue;
            }

            if (char === '\\') {
                escapeNext = true;
                continue;
            }

            if (char === '"') {
                foundEnd = true;
                endCol = i;
                break;
            }
        }

        if (foundEnd) {
            return new monaco.Range(lineNumber, currentIndex + 1, lineNumber, endCol + 2);
        }

        // 如果不是字符串开始，检查是否是字符串结束（向前查找是否有开始引号）
        escapeNext = false;
        let foundStart = false;
        let startCol = -1;

        for (let i = currentIndex - 1; i >= 0; i--) {
            const char = lineContent[i];

            if (escapeNext) {
                escapeNext = false;
                continue;
            }

            if (char === '\\') {
                escapeNext = true;
                continue;
            }

            if (char === '"') {
                foundStart = true;
                startCol = i;
                break;
            }
        }

        if (foundStart) {
            return new monaco.Range(lineNumber, startCol + 1, lineNumber, currentIndex + 2);
        }
    }

    // 当前位置不是引号，向前查找字符串开始位置
    let startCol = -1;
    let endCol = -1;
    let escapeNext = false;

    // 向前查找字符串开始位置（找到最近的未转义的引号）
    for (let i = currentIndex; i >= 0; i--) {
        const char = lineContent[i];

        if (escapeNext) {
            escapeNext = false;
            continue;
        }

        if (char === '\\') {
            escapeNext = true;
            continue;
        }

        if (char === '"') {
            // 找到字符串开始位置
            startCol = i;
            break;
        }
    }

    // 如果找到开始位置，查找结束位置
    if (startCol !== -1) {
        escapeNext = false;
        for (let i = startCol + 1; i < lineContent.length; i++) {
            const char = lineContent[i];

            if (escapeNext) {
                escapeNext = false;
                continue;
            }

            if (char === '\\') {
                escapeNext = true;
                continue;
            }

            if (char === '"') {
                // 找到字符串结束位置
                endCol = i;
                break;
            }
        }
    }

    // 如果找到了完整的字符串范围，并且当前位置在字符串内（包括引号）
    if (startCol !== -1 && endCol !== -1 && currentIndex >= startCol && currentIndex <= endCol + 1) {
        return new monaco.Range(lineNumber, startCol + 1, lineNumber, endCol + 2);
    }

    return null;
};

// 复制文本到剪贴板
const copyToClipboard = async (text: string) => {
    try {
        // 优先使用现代 Clipboard API
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(text);
        } else {
            // 降级方案：使用传统方法（execCommand 已废弃，但作为兼容性降级方案）
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.readOnly = true; // 防止用户看到选中内容
            textArea.style.position = 'fixed';
            textArea.style.left = '-999999px';
            textArea.style.top = '-999999px';
            textArea.style.opacity = '0';
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            try {
                // document.execCommand 已废弃，但作为降级方案仍可使用
                const success = document.execCommand('copy');
                if (!success) {
                    throw new Error('execCommand failed');
                }
            } catch (err) {
                // 忽略错误
            } finally {
                document.body.removeChild(textArea);
            }
        }
    } catch (err) {
        // 如果复制失败，不显示错误，静默处理
    }
};

// 格式化文件大小（B/KB/MB）
const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) {
        const kb = bytes / 1024;
        // 如果是整数，不显示小数；否则保留两位小数
        return kb % 1 === 0 ? `${kb} KB` : `${kb.toFixed(2)} KB`;
    }
    const mb = bytes / (1024 * 1024);
    // 如果是整数，不显示小数；否则保留两位小数
    return mb % 1 === 0 ? `${mb} MB` : `${mb.toFixed(2)} MB`;
};


// 更新编辑器状态栏信息
const updateEditorStatus = (editor: monaco.editor.IStandaloneCodeEditor | null, statusRef: { value: string }, isInputEditor: boolean = false) => {
    if (!editor) {
        statusRef.value = '';
        return;
    }

    const selection = editor.getSelection();
    if (!selection) {
        statusRef.value = '';
        return;
    }

    const model = editor.getModel();
    if (!model) {
        statusRef.value = '';
        return;
    }

    const startLine = selection.startLineNumber;
    const endLine = selection.endLineNumber;
    const startColumn = selection.startColumn;
    const endColumn = selection.endColumn;
    const totalLines = model.getLineCount();

    // 检查是否有选中内容（不是光标位置）
    const hasSelection = !selection.isEmpty();

    // 检查是否全选（从第1行第1列到最后一行的最后一列）
    const isFullSelection = hasSelection &&
        startLine === 1 &&
        startColumn === 1 &&
        endLine === totalLines &&
        endColumn === model.getLineMaxColumn(totalLines);

    if (hasSelection) {
        // 计算选中的行数
        const selectedLines = endLine - startLine + 1;

        // 使用 Monaco Editor 的 API 获取选中文本，然后计算字符数
        const selectedText = model.getValueInRange(selection);
        const selectedChars = selectedText.length;

        // 如果是全选，显示文件大小
        if (isFullSelection) {
            // 计算文件大小（UTF-8编码，中文字符占3字节，英文字符占1字节）
            const fileSizeBytes = new Blob([selectedText]).size;
            const fileSize = formatFileSize(fileSizeBytes);
            statusRef.value = `已选中全部内容 | ${selectedLines} 行，${selectedChars} 个字符 | ${fileSize}`;
            return;
        }

        // 对于非全选的选中内容，搜索匹配项（两个区域都支持）
        if (selectedText.trim()) {
            try {
                // 转义特殊字符用于正则表达式搜索（完全匹配）
                const escapedText = selectedText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

                // 在整个文档中查找所有完全匹配的位置
                // findMatches(searchString, searchOnlyEditableRange, isRegex, matchCase, wordSeparators, captureMatches, limitResultCount?)
                const matches = model.findMatches(
                    escapedText,
                    false, // 搜索整个文档（不只是可编辑范围）
                    false, // 不是正则表达式（已转义为字面量）
                    true,  // 区分大小写（完全匹配）
                    null,  // 不使用单词分隔符
                    false, // 不捕获组
                    undefined // 不限制结果数量
                );

                const matchCount = matches.length;

                // 格式化显示：行数 字符数 匹配数
                if (selectedLines === 1) {
                    if (matchCount > 1) {
                        statusRef.value = `已选中 ${selectedChars} 个字符 | 共 ${matchCount} 处匹配`;
                    } else {
                        statusRef.value = `已选中 ${selectedChars} 个字符`;
                    }
                } else {
                    if (matchCount > 1) {
                        statusRef.value = `已选中 ${selectedLines} 行，${selectedChars} 个字符 | 共 ${matchCount} 处匹配`;
                    } else {
                        statusRef.value = `已选中 ${selectedLines} 行，${selectedChars} 个字符`;
                    }
                }
            } catch (error) {
                // 如果搜索失败，回退到基本显示
                if (selectedLines === 1) {
                    statusRef.value = `已选中 ${selectedChars} 个字符`;
                } else {
                    statusRef.value = `已选中 ${selectedLines} 行，${selectedChars} 个字符`;
                }
            }
        } else {
            // 选中内容为空或只有空白字符，只显示基本信息
            if (selectedLines === 1) {
                statusRef.value = `已选中 ${selectedChars} 个字符`;
            } else {
                statusRef.value = `已选中 ${selectedLines} 行，${selectedChars} 个字符`;
            }
        }
    } else {
        // 没有选中，显示光标位置
        statusRef.value = `第 ${startLine} 行，第 ${startColumn} 列 | 共 ${totalLines} 行`;
    }
};

// 设置编辑器选择变化监听
const setupSelectionListener = (editor: monaco.editor.IStandaloneCodeEditor | null, statusRef: { value: string }, isInputEditor: boolean = false) => {
    if (!editor) return;

    // 监听选择变化
    editor.onDidChangeCursorSelection((e) => {
        updateEditorStatus(editor, statusRef, isInputEditor);
    });

    // 监听内容变化（更新总行数等信息）
    editor.onDidChangeModelContent(() => {
        updateEditorStatus(editor, statusRef, isInputEditor);
    });

    // 初始化状态
    updateEditorStatus(editor, statusRef, isInputEditor);
};

// 设置双击选中整个字符串并复制功能
const setupDoubleClickSelectString = (editor: monaco.editor.IStandaloneCodeEditor) => {
    let lastClickTime = 0;
    let lastClickPosition: monaco.Position | null = null;

    // 监听鼠标点击事件来记录点击位置
    editor.onMouseDown((e: monaco.editor.IEditorMouseEvent) => {
        const currentTime = Date.now();
        const currentPosition = e.target.position;

        if (!currentPosition) {
            lastClickTime = currentTime;
            lastClickPosition = null;
            return;
        }

        // 检测双击（两次点击间隔小于 300ms 且在同一位置附近）
        const isDoubleClick = currentTime - lastClickTime < 300 &&
            lastClickPosition &&
            lastClickPosition.lineNumber === currentPosition.lineNumber &&
            Math.abs(lastClickPosition.column - currentPosition.column) <= 1;

        if (isDoubleClick) {
            // 这是双击事件
            const model = editor.getModel();
            if (!model) return;

            // 保存当前点击位置（因为延迟执行时 e.target.position 可能已失效）
            const clickPosition = new monaco.Position(currentPosition.lineNumber, currentPosition.column);

            // 延迟处理，让 Monaco 的双击选中先完成
            setTimeout(() => {
                // 查找完整的字符串范围
                const stringRange = findStringRange(model, clickPosition);

                if (stringRange) {
                    // 设置选中范围为整个字符串（包括引号）
                    editor.setSelection(stringRange);

                    // 获取整个字符串文本（包括引号）
                    const fullStringText = model.getValueInRange(stringRange);

                    // 提取字符串值（去除引号和转义）
                    const stringValue = extractStringValue(fullStringText);

                    if (stringValue !== null && stringValue !== undefined) {
                        // 复制字符串值到剪贴板
                        copyToClipboard(stringValue);
                        showSuccess('字符串已复制到剪贴板');
                    }
                }
            }, 10);
        }

        // 更新记录
        lastClickTime = currentTime;
        lastClickPosition = new monaco.Position(currentPosition.lineNumber, currentPosition.column);
    });
};

// 添加窗口大小变化的处理函数
const handleResize = () => {
    // 更新容器宽度
    const container = document.querySelector('.editor-container');
    if (container) {
        editorContainerWidth.value = container.getBoundingClientRect().width;
    }
    updateEditorLayout();
};

// 添加防抖函数
const debounce = (fn: Function, delay: number) => {
    let timer: number | null = null;
    return function (this: any, ...args: any[]) {
        if (timer) {
            clearTimeout(timer);
        }
        timer = window.setTimeout(() => {
            fn.apply(this, args);
            timer = null;
        }, delay);
    };
};

// 使用防抖处理 resize 事件
const debouncedResize = debounce(handleResize, 100);

// 创建防抖版本的行号宽度更新函数，避免频繁调用
const debouncedUpdateLineNumberWidth = debounce(updateLineNumberWidth, 150);

// 监听全屏状态变化
watch(isFullscreen, () => {
    // 更新消息提示位置
    updateMessageOffset();
    // 等待 DOM 更新
    nextTick(() => {
        setTimeout(() => {
            if (inputEditor) {
                const model = inputEditor.getModel();
                if (model) {
                    // 触发编辑器内容变化以强制重新渲染
                    const value = model.getValue();
                    model.setValue(value);
                }
            }
            if (outputEditor) {
                const model = outputEditor.getModel();
                if (model) {
                    const value = model.getValue();
                    model.setValue(value);
                }
            }
            handleResize();
        }, 200);
    });
});

// 监听格式化设置的变化
watch([indentSize, arrayNewLine, showIndentGuide], () => {
    // 如果输入区域为空，不进行任何操作
    if (!inputEditor?.getValue()?.trim()) {
        selectedLevel.value = 1;
        return;
    }
    try {
        const currentValue = inputEditor?.getValue() || '';
        JSON.parse(currentValue);
    } catch {
        // 解析失败不做处理
    }
});

// 确保某些按钮始终为true（格式化、数据转换、收缩、全屏）
watch(() => buttonVisibility.value.format, (newVal) => {
    if (!newVal) {
        buttonVisibility.value.format = true;
    }
}, { immediate: true });

watch(() => buttonVisibility.value.dataConvert, (newVal) => {
    if (!newVal) {
        buttonVisibility.value.dataConvert = true;
    }
}, { immediate: true });

watch(() => buttonVisibility.value.collapse, (newVal) => {
    if (!newVal) {
        buttonVisibility.value.collapse = true;
    }
}, { immediate: true });

watch(() => buttonVisibility.value.fullscreen, (newVal) => {
    if (!newVal) {
        buttonVisibility.value.fullscreen = true;
    }
}, { immediate: true });

// ==================== 自动保存设置到 localStorage ====================
// 监听所有设置的变化并自动保存
watch(
    () => [
        buttonVisibility.value,
        wordWrap.value,
        fontSize.value,
        showIndentGuide.value,
        indentSize.value,
        encodingMode.value,
        arrayNewLine.value,
        sortMethod.value,
        sortOrder.value
    ],
    () => {
        saveSettings();
    },
    { deep: true }
);
// ==================== 自动保存设置结束 ====================

// 监听按钮可见性变化，更新滚动状态
watch(
    () => buttonVisibility.value,
    () => {
        checkToolBarScroll();
    },
    { deep: true }
);

// 保存消息提示样式元素的引用，以便动态更新
let messageStyleElement: HTMLStyleElement | null = null;

// 更新消息提示位置的函数
const updateMessageOffset = () => {
    if (typeof window === 'undefined' || !messageStyleElement) return;
    const offset = getMessageOffset();
    messageStyleElement.textContent = `
        .el-message {
            top: ${offset}px !important;
            z-index: 9999 !important;
            left: auto !important;
            right: 25px !important;
            transform: translateX(0) !important;
        }
    `;
};

// ==================== onMounted 辅助函数 ====================


// 初始化消息样式
const initializeMessageStyles = () => {
    if (typeof window === 'undefined') return;
    messageStyleElement = document.createElement('style');
    updateMessageOffset();
    document.head.appendChild(messageStyleElement);
};

// 初始化Monaco环境
const initializeMonacoEnvironment = () => {
    if (typeof window === 'undefined') return;
    window.MonacoEnvironment = {
        getWorker(_, label): Worker {
            if (label === 'json') {
                return new jsonWorker();
            }
            return new editorWorker();
        }
    };
};

// 创建输入编辑器
const createInputEditor = () => {
    if (!inputEditorContainer.value) return;

    // 对于输入编辑器，也启用大文件折叠优化（因为用户可能输入大量JSON）
    // 输入编辑器始终使用2个空格缩进，不受格式化设置影响
    const inputOptions = getEditorOptions(2, false, 'json', true);
    inputEditor = monaco.editor.create(inputEditorContainer.value, inputOptions);
    nextTick(() => {
        const textarea = inputEditorContainer.value?.querySelector('textarea');
        if (textarea) {
            textarea.setAttribute('id', 'monaco-input-editor');
            textarea.setAttribute('name', 'monaco-input-editor');
        }
    });
};

// 创建输出编辑器
const createOutputEditor = () => {
    if (!outputEditorContainer.value) return;

    // 默认启用大文件折叠优化（因为是输出编辑器，通常会处理较大的JSON）
    const options = getEditorOptions(indentSize.value, true, 'json', true);
    outputEditor = monaco.editor.create(outputEditorContainer.value, options);
    nextTick(() => {
        const textarea = outputEditorContainer.value?.querySelector('textarea');
        if (textarea) {
            textarea.setAttribute('id', 'monaco-output-editor');
            textarea.setAttribute('name', 'monaco-output-editor');
        }
    });
};

// 配置输入编辑器
const configureInputEditor = () => {
    if (!inputEditor) return;

    // 输入编辑器始终使用2个空格缩进，不受格式化设置影响
    inputEditor.getModel()?.updateOptions({ tabSize: 2, indentSize: 2, insertSpaces: true });
    // 同时更新编辑器选项，确保formatOnPaste使用2个空格
    inputEditor.updateOptions({ tabSize: 2, indentSize: 2 } as any);

    // 初始化时不加载数据，保持空白
    inputEditor.setValue('');
    maxLevel.value = 0;
    selectedLevel.value = 0;

    // 设置选择变化监听（输入编辑器启用匹配计数功能）
    setupSelectionListener(inputEditor, inputEditorStatus, true);

    // 监听输入变化
    inputEditor.onDidChangeModelContent(() => {
        // 确保输入编辑器始终使用2个空格缩进
        const model = inputEditor?.getModel();
        if (model) {
            const currentTabSize = model.getOptions().tabSize;
            const currentIndentSize = (model.getOptions() as any).indentSize;
            if (currentTabSize !== 2 || currentIndentSize !== 2) {
                model.updateOptions({ tabSize: 2, indentSize: 2, insertSpaces: true });
                inputEditor?.updateOptions({ tabSize: 2, indentSize: 2 } as any);
            }
        }
        // 使用防抖更新行号宽度，避免频繁调用
        debouncedUpdateLineNumberWidth(inputEditor);

        const value = inputEditor?.getValue() || '';
        if (value.trim()) {
            const cleanedContent = value.replace(/[\u0000-\u0019]+/g, '');

            // 检查行数和深度限制
            const checkResult = checkLinesAndDepth(cleanedContent);
            if (!checkResult.isValid) {
                showError(checkResult.error || '内容不符合要求');
                maxLevel.value = 0;
                selectedLevel.value = 0;
                // 如果深度超过99层，自动清空输入区域内容
                if (checkResult.error && checkResult.error.includes('深度超过99层')) {
                    // 延迟清空，避免在内容变化监听中直接修改编辑器内容导致的问题
                    setTimeout(() => {
                        if (inputEditor) {
                            const model = inputEditor.getModel();
                            if (model) {
                                const fullRange = model.getFullModelRange();
                                if (!fullRange.isEmpty()) {
                                    inputEditor.executeEdits('clear-input-depth-limit', [{
                                        range: fullRange,
                                        text: ''
                                    }]);
                                }
                            }
                        }
                        if (outputEditor) {
                            outputEditor.setValue('');
                            updateEditorHeight(outputEditor);
                            updateLineNumberWidth(outputEditor);
                        }
                    }, 100);
                }
                return;
            }

            try {
                const { data: parsed } = preprocessJSON(cleanedContent);
                maxLevel.value = calculateMaxLevel(parsed);
                if (maxLevel.value > 0 && selectedLevel.value === 0) {
                    selectedLevel.value = 1;
                }
            } catch (error) {
                maxLevel.value = 0;
                selectedLevel.value = 0;
            }
        } else {
            maxLevel.value = 0;
            selectedLevel.value = 0;
            outputEditor?.setValue('');
            updateEditorHeight(outputEditor);
            updateLineNumberWidth(outputEditor);
        }
    });
};

// 配置输出编辑器
const configureOutputEditor = () => {
    if (!outputEditor) return;

    outputEditor.getModel()?.updateOptions({ tabSize: indentSize.value, insertSpaces: true });
    // 设置双击选中整个字符串并复制功能
    setupDoubleClickSelectString(outputEditor);
    // 设置选择变化监听
    setupSelectionListener(outputEditor, outputEditorStatus);
    // 设置折叠信息显示
    setupFoldingInfoDisplay(outputEditor);
};

// 初始化编辑器布局
const initializeEditorLayout = () => {
    updateLineNumberWidth(inputEditor);
    updateLineNumberWidth(outputEditor);
    updateEditorHeight(inputEditor);
    updateEditorHeight(outputEditor);

    // 设置初始化成功标志
    editorsInitialized.value = true;
};

// 设置窗口resize监听器
const setupWindowResizeListener = () => {
    if (typeof window === 'undefined') return;
    window.addEventListener('resize', debouncedResize);
};

// 初始化容器宽度
const initializeContainerWidth = () => {
    setTimeout(() => {
        const container = document.querySelector('.editor-container');
        if (container) {
            editorContainerWidth.value = container.getBoundingClientRect().width;
        }
    }, 300);
};

// 检查工具栏滚动状态（使用nextTick确保DOM更新后再检查）
const checkToolBarScroll = () => {
    nextTick(() => {
        if (!toolBarRef.value) {
            canScrollLeft.value = false;
            canScrollRight.value = false;
            return;
        }
        
        const { scrollLeft, scrollWidth, clientWidth } = toolBarRef.value;
        canScrollLeft.value = scrollLeft > 1; // 大于1是为了处理浮点数精度问题
        canScrollRight.value = scrollLeft < scrollWidth - clientWidth - 1; // 减1是为了处理浮点数精度问题
    });
};

// 处理工具栏滚动事件
const handleToolBarScroll = () => {
    checkToolBarScroll();
};

// 滚动工具栏
const scrollToolBar = (direction: 'left' | 'right') => {
    if (!toolBarRef.value) return;
    
    const scrollAmount = 200; // 每次滚动200px
    const currentScroll = toolBarRef.value.scrollLeft;
    const targetScroll = direction === 'left' 
        ? currentScroll - scrollAmount 
        : currentScroll + scrollAmount;
    
    toolBarRef.value.scrollTo({
        left: targetScroll,
        behavior: 'smooth'
    });
};

// 设置ResizeObserver
const setupResizeObservers = () => {
    if (typeof ResizeObserver === 'undefined') return;

    // 监听输入编辑器容器
    if (inputEditorContainer.value) {
        const inputContainer = inputEditorContainer.value.parentElement; // .monaco-editor-container
        if (inputContainer && !inputEditorResizeObserver) {
            inputEditorResizeObserver = new ResizeObserver(() => {
                // 使用防抖更新编辑器布局
                debouncedResize();
            });
            inputEditorResizeObserver.observe(inputContainer);
        }
    }

    // 监听输出编辑器容器
    if (outputEditorContainer.value) {
        const outputContainer = outputEditorContainer.value.parentElement; // .monaco-editor-container
        if (outputContainer && !outputEditorResizeObserver) {
            outputEditorResizeObserver = new ResizeObserver(() => {
                // 使用防抖更新编辑器布局
                debouncedResize();
            });
            outputEditorResizeObserver.observe(outputContainer);
        }
    }
};

// ==================== onMounted 辅助函数结束 ====================

// 在组件挂载时添加监听器
onMounted(async () => {
    // 确保在客户端环境下运行
    if (typeof window === 'undefined') return;

    // 初始化基础环境
    initializeMessageStyles();
    initializeMonacoEnvironment();

    // 添加延迟确保DOM完全渲染
    await nextTick();
    setTimeout(async () => {
        try {
            // 再次检查DOM元素是否存在
            if (!inputEditorContainer.value || !outputEditorContainer.value) {
                return;
            }

            try {
                // 创建编辑器
                createInputEditor();
                createOutputEditor();

                // 配置编辑器
                configureInputEditor();
                configureOutputEditor();

                // 初始化布局
                initializeEditorLayout();

                // 检查URL参数，加载分享数据
                await loadSharedDataFromUrl();
            } catch (error: any) {
                showError('Monaco编辑器初始化失败: ' + error.message);
            }
        } catch (error: any) {
            showError('Monaco编辑器初始化失败: ' + error.message);
        }
    }, 200);

    // 设置监听器
    setupWindowResizeListener();
    initializeContainerWidth();

    // 延迟设置 ResizeObserver，确保编辑器已初始化
    setTimeout(() => {
        setupResizeObservers();
    }, 500);

    // 初始化工具栏滚动检测
    setTimeout(() => {
        checkToolBarScroll();
        // 监听窗口大小变化，更新滚动状态
        if (typeof ResizeObserver !== 'undefined' && toolBarRef.value) {
            const resizeObserver = new ResizeObserver(() => {
                checkToolBarScroll();
            });
            resizeObserver.observe(toolBarRef.value);
            
            // 监听窗口resize事件
            window.addEventListener('resize', checkToolBarScroll);
        }
    }, 300);

    // 初始化完成，允许自动保存设置
    isInitializing = false;
});

// 清理编辑器实例
onBeforeUnmount(() => {
    // 关闭所有消息提示，避免路由切换时消息提示仍然显示
    ElMessage.closeAll();

    // 移除resize事件监听器
    window.removeEventListener('resize', debouncedResize);
    window.removeEventListener('resize', checkToolBarScroll);

    // 清理消息提示样式元素
    if (messageStyleElement && messageStyleElement.parentNode) {
        messageStyleElement.parentNode.removeChild(messageStyleElement);
        messageStyleElement = null;
    }

    // 清理 ResizeObserver
    if (inputEditorResizeObserver) {
        inputEditorResizeObserver.disconnect();
        inputEditorResizeObserver = null;
    }
    if (outputEditorResizeObserver) {
        outputEditorResizeObserver.disconnect();
        outputEditorResizeObserver = null;
    }

    // 销毁编辑器实例
    if (inputEditor) {
        inputEditor.dispose();
        inputEditor = null;
    }

    if (outputEditor) {
        outputEditor.dispose();
        outputEditor = null;
    }
});

// 添加组件卸载时的资源释放
onUnmounted(() => {
    // 确保所有 worker 都被终止
    if (typeof window !== 'undefined' && window.MonacoEnvironment) {
        // @ts-ignore
        window.MonacoEnvironment = undefined;
    }
});

// 计算JSON对象的深度和层级数
const calculateJsonStructure = (obj: any, mode: 'depth' | 'level' = 'depth', currentValue: number = mode === 'depth' ? 0 : 1): number => {
    if (typeof obj !== 'object' || obj === null) {
        return mode === 'depth' ? currentValue : currentValue - 1;
    }

    // 空对象或空数组处理
    if (Object.keys(obj).length === 0) {
        return currentValue;
    }

    // 深度超过限制直接返回（仅适用于depth模式）
    if (mode === 'depth' && currentValue > 99) {
        return 100;
    }

    // 递归计算最大深度/层级
    let maxValue = currentValue;

    if (Array.isArray(obj)) {
        for (const item of obj) {
            const childValue = calculateJsonStructure(item, mode, currentValue + 1);
            maxValue = Math.max(maxValue, childValue);
            if (mode === 'depth' && maxValue > 99) return 100;
        }
    } else {
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                const childValue = calculateJsonStructure(obj[key], mode, currentValue + 1);
                maxValue = Math.max(maxValue, childValue);
                if (mode === 'depth' && maxValue > 99) return 100;
            }
        }
    }

    return maxValue;
};

// 获取对象深度
const getObjectDepth = (obj: any, depth: number = 0): number => {
    return calculateJsonStructure(obj, 'depth', depth);
};

// 计算 JSON 的最大层级
const calculateMaxLevel = (obj: any, currentLevel: number = 1): number => {
    return calculateJsonStructure(obj, 'level', currentLevel);
};

// 检查行数和深度，返回检查结果
const checkLinesAndDepth = (content: string): { isValid: boolean; error?: string } => {
    // 检查行数
    const lines = content.split('\n');
    if (lines.length > MAX_LINES) {
        return {
            isValid: false,
            error: `内容超过行数限制（共 ${lines.length} 行，限制为 ${MAX_LINES} 行）。请使用较小的文件或使用其他工具处理超大文件。`
        };
    }

    // 检查JSON深度（仅在JSON有效时检查）
    try {
        const { data: jsonData } = preprocessJSON(content);
        const depth = getObjectDepth(jsonData);
        if (depth > 99) {
            return {
                isValid: false,
                error: 'JSON深度超过99层, 拒绝处理此JSON数据'
            };
        }
    } catch (e) {
        // 解析失败，可能不是有效的JSON，不进行深度检查
    }

    return { isValid: true };
};

// 自定义 JSON 字符串化函数
function customStringify(
    obj: any,
    replacer: null,
    space: number,
    originalString?: string,
    encodingModeOverride?: number,
    arrayNewLineOverride?: boolean
): string {
    const indent = ' '.repeat(space);
    // 如果提供了编码模式覆盖值，使用它；否则使用全局设置
    const currentEncodingMode = encodingModeOverride !== undefined ? encodingModeOverride : encodingMode.value;
    // 如果提供了数组样式覆盖值，使用它；否则使用全局设置
    const currentArrayNewLine = arrayNewLineOverride !== undefined ? arrayNewLineOverride : arrayNewLine.value;

    const isPrimitiveArray = (arr: any[]): boolean => {
        return arr.every(item =>
            typeof item === 'string' ||
            typeof item === 'number' ||
            typeof item === 'boolean' ||
            item === null
        );
    };

    // 预构建字符串值到原始转义形式的映射（只扫描一次原始字符串）
    // 支持双引号和单引号字符串（JSON5支持单引号）
    const buildStringEscapeMap = (originalJSON: string): Map<string, string> => {
        const map = new Map<string, string>();
        if (!originalJSON) return map;

        const validEscapes = ['"', "'", '\\', '/', 'b', 'f', 'n', 'r', 't', 'u', '0', 'v'];
        // 匹配双引号和单引号字符串
        const regex = /(["'])((?:\\.|(?!\1)[^\\])*?)\1/g;
        let match;

        while ((match = regex.exec(originalJSON)) !== null) {
            const quote = match[1]; // 引号类型（" 或 '）
            let originalEscaped = match[2]; // 原始转义形式（不含引号）
            let parsedValue: string;
            let finalEscaped = originalEscaped; // 最终使用的转义形式（可能被修正）

            // 尝试解析这个原始字符串（使用对应的引号）
            try {
                parsedValue = JSON5.parse(`${quote}${originalEscaped}${quote}`);
            } catch {
                // 解析失败，说明包含无效转义序列，手动解析
                parsedValue = '';
                let correctedEscaped = ''; // 用于存储修正后的转义形式
                let i = 0;
                let escaped = false;

                while (i < originalEscaped.length) {
                    if (escaped) {
                        const char = originalEscaped[i];
                        if (validEscapes.includes(char)) {
                            // 有效转义序列，按照标准处理
                            if (char === 'u' && i + 4 < originalEscaped.length) {
                                const hex = originalEscaped.substring(i, i + 4);
                                if (/^[0-9a-fA-F]{4}$/i.test(hex)) {
                                    parsedValue += String.fromCharCode(parseInt(hex, 16));
                                    correctedEscaped += '\\u' + hex;
                                    i += 4;
                                    escaped = false;
                                    continue;
                                }
                            } else if (char === 'x' && i + 2 < originalEscaped.length) {
                                // \xXX 序列
                                const hex = originalEscaped.substring(i, i + 2);
                                if (/^[0-9a-fA-F]{2}$/i.test(hex)) {
                                    parsedValue += String.fromCharCode(parseInt(hex, 16));
                                    correctedEscaped += '\\x' + hex;
                                    i += 2;
                                    escaped = false;
                                    continue;
                                }
                            } else if (char === 'n') {
                                parsedValue += '\n';
                                correctedEscaped += '\\n';
                                i++;
                                escaped = false;
                                continue;
                            } else if (char === 'r') {
                                parsedValue += '\r';
                                correctedEscaped += '\\r';
                                i++;
                                escaped = false;
                                continue;
                            } else if (char === 't') {
                                parsedValue += '\t';
                                correctedEscaped += '\\t';
                                i++;
                                escaped = false;
                                continue;
                            } else if (char === 'b') {
                                parsedValue += '\b';
                                correctedEscaped += '\\b';
                                i++;
                                escaped = false;
                                continue;
                            } else if (char === 'f') {
                                parsedValue += '\f';
                                correctedEscaped += '\\f';
                                i++;
                                escaped = false;
                                continue;
                            } else if (char === '\\') {
                                parsedValue += '\\';
                                correctedEscaped += '\\\\';
                                i++;
                                escaped = false;
                                continue;
                            } else if (char === '"' || char === "'") {
                                parsedValue += char;
                                correctedEscaped += '\\' + char;
                                i++;
                                escaped = false;
                                continue;
                            } else if (char === '/') {
                                parsedValue += '/';
                                correctedEscaped += '\\/';
                                i++;
                                escaped = false;
                                continue;
                            } else if (char === '0') {
                                // 检查是否是单独的 \0 还是多位数字序列
                                let digits = '0';
                                let j = i + 1;
                                // 检查后续是否还有数字（最多3位）
                                while (j < originalEscaped.length && /^[0-7]$/.test(originalEscaped[j]) && digits.length < 3) {
                                    digits += originalEscaped[j];
                                    j++;
                                }
                                if (digits === '0' && j === i + 1) {
                                    // \0 单独出现，这是有效的
                                    parsedValue += '\0';
                                    correctedEscaped += '\\0';
                                    i++;
                                    escaped = false;
                                    continue;
                                } else {
                                    // 多位数字序列，需要转义
                                    // 注意：correctedEscaped 已经在第2121行加了一个反斜杠，所以这里只需要再加一个反斜杠
                                    parsedValue += '\\' + digits;
                                    correctedEscaped += '\\' + digits;
                                    i += digits.length;
                                    escaped = false;
                                    continue;
                                }
                            } else if (char === 'v') {
                                parsedValue += '\v';
                                correctedEscaped += '\\v';
                                i++;
                                escaped = false;
                                continue;
                            }
                        }
                        // 无效转义序列（如 \1, \2, ..., \9, \a, \c 等）
                        // 需要检查是否是多位数字序列
                        if (/^[0-9]$/.test(char)) {
                            let digits = char;
                            let j = i + 1;
                            // 无效的数字转义序列，需要转义为 \\1, \\2, ..., \\123 等
                            // 注意：correctedEscaped 已经在第2121行加了一个反斜杠，所以这里只需要再加一个反斜杠
                            parsedValue += '\\' + digits;
                            correctedEscaped += '\\' + digits;
                            i += digits.length;
                            escaped = false;
                            continue;
                        } else {
                            // 其他无效转义序列（如 \a, \c 等），需要转义
                            // 注意：correctedEscaped 已经在第2121行加了一个反斜杠，所以这里只需要再加一个反斜杠
                            parsedValue += '\\' + char;
                            correctedEscaped += '\\' + char;
                            i++;
                            escaped = false;
                            continue;
                        }
                    }

                    if (originalEscaped[i] === '\\') {
                        escaped = true;
                        correctedEscaped += '\\';
                        i++;
                    } else {
                        parsedValue += originalEscaped[i];
                        correctedEscaped += originalEscaped[i];
                        i++;
                    }
                }
                // 使用修正后的转义形式
                finalEscaped = correctedEscaped;
            }

            // 优先保存包含 Unicode 转义序列的形式
            // 如果映射已存在，检查当前原始转义形式是否包含 Unicode 转义序列
            // 如果包含，则更新映射（优先使用 Unicode 转义形式）
            if (!map.has(parsedValue)) {
                map.set(parsedValue, finalEscaped);
            } else {
                // 如果映射已存在，检查当前原始转义形式是否包含 Unicode 转义序列
                const existingEscape = map.get(parsedValue)!;
                const hasUnicodeEscape = /\\u[0-9a-fA-F]{4}/.test(finalEscaped);
                const existingHasUnicodeEscape = /\\u[0-9a-fA-F]{4}/.test(existingEscape);

                // 如果当前形式包含 Unicode 转义，而现有形式不包含，则更新
                if (hasUnicodeEscape && !existingHasUnicodeEscape) {
                    map.set(parsedValue, finalEscaped);
                }
                // 如果两者都包含或都不包含 Unicode 转义，保持第一次遇到的（避免覆盖）
            }
        }

        return map;
    };

    // 预先构建映射（如果提供了原始字符串）
    const stringEscapeMap = originalString ? buildStringEscapeMap(originalString) : null;

    const escapeString = (str: string): string => {
        // 如果有预构建的映射，直接查找
        if (stringEscapeMap) {
            const originalEscape = stringEscapeMap.get(str);
            if (originalEscape !== undefined) {
                // 找到原始转义形式，直接使用（已经是正确的转义形式）
                return originalEscape;
            }
        }

        // 没有原始形式或找不到匹配，使用标准转义
        // 注意：标准转义不会将中文字符转换为 Unicode 转义（除非是控制字符）
        // 所以当 encodingMode === 0 时，如果找不到映射，中文字符会保持为中文
        return str
            .replace(/\\/g, '\\\\')  // 必须首先处理反斜杠
            .replace(/"/g, '\\"')    // 处理双引号
            .replace(/[\b]/g, '\\b') // 处理退格
            .replace(/\f/g, '\\f')   // 处理换页
            .replace(/\n/g, '\\n')   // 处理换行
            .replace(/\r/g, '\\r')   // 处理回车
            .replace(/\t/g, '\\t')   // 处理制表符
            .replace(/[\u0000-\u001F\u007F-\u009F]/g, c => {
                return '\\u' + ('0000' + c.charCodeAt(0).toString(16)).slice(-4);
            });
    };

    // 处理中文到Unicode的转换
    const handleChineseToUnicode = (str: string): string => {
        if (currentEncodingMode !== 2) return str; // 如果不是转Unicode模式，直接返回

        return str.replace(/[\u0080-\uFFFF]/g, char => {
            const codePoint = char.charCodeAt(0);

            // 对于控制字符和特殊字符，一定要转换为Unicode
            if (codePoint < 32 || (codePoint >= 127 && codePoint <= 159) ||
                // 特别处理双向文本控制字符
                (codePoint >= 0x202A && codePoint <= 0x202E) ||
                (codePoint >= 0x2066 && codePoint <= 0x2069) ||
                codePoint === 0x061C) {
                return '\\u' + ('0000' + codePoint.toString(16)).slice(-4);
            }

            // 对于其他非ASCII字符
            return '\\u' + ('0000' + codePoint.toString(16)).slice(-4);
        });
    };

    // 处理Unicode到中文的转换
    const handleUnicodeToChiness = (str: string): string => {
        if (currentEncodingMode !== 1) return str; // 如果不是转中文模式，直接返回

        return str.replace(/\\u([0-9a-fA-F]{4})/g, (match, hex) => {
            const codePoint = parseInt(hex, 16);

            // 检测特殊控制字符，保持它们的转义形式
            if ((codePoint >= 0x202A && codePoint <= 0x202E) ||
                (codePoint >= 0x2066 && codePoint <= 0x2069) ||
                codePoint === 0x061C) {
                return match; // 保持原样
            }

            // 其他Unicode字符正常转换为中文
            return String.fromCharCode(codePoint);
        });
    };

    const processString = (str: string): string => {
        // 根据编码模式处理字符串
        if (currentEncodingMode === 0) {
            // 模式0：保持原样
            // 如果有映射，使用映射中的原始转义形式
            // 如果没有映射，使用标准转义（不会将中文转为Unicode）
            return escapeString(str);
        } else if (currentEncodingMode === 1) {
            // 模式1：转中文
            // 先转义字符串（如果有映射，会使用映射中的Unicode转义形式）
            let processed = escapeString(str);
            // 然后将Unicode转义转换为中文
            processed = handleUnicodeToChiness(processed);
            return processed;
        } else if (currentEncodingMode === 2) {
            // 模式2：转Unicode
            // 如果有映射且映射中包含Unicode转义，直接使用映射
            if (stringEscapeMap) {
                const originalEscape = stringEscapeMap.get(str);
                if (originalEscape !== undefined && /\\u[0-9a-fA-F]{4}/.test(originalEscape)) {
                    // 映射中有Unicode转义，直接使用
                    return originalEscape;
                }
            }
            // 如果没有映射或映射中没有Unicode转义，先转义，然后转换为Unicode
            let processed = escapeString(str);
            processed = handleChineseToUnicode(processed);
            return processed;
        }

        // 默认情况
        return escapeString(str);
    };

    const format = (obj: any, currentIndent: string = ''): string => {
        if (obj === null) return 'null';

        if (Array.isArray(obj)) {
            if (obj.length === 0) return '[]';

            if (!currentArrayNewLine && isPrimitiveArray(obj)) {
                const items = obj.map(item => {
                    if (typeof item === 'string') return `"${processString(item)}"`;
                    return String(item);
                });
                return `[${items.join(', ')}]`;
            }

            const items = obj.map(item => currentIndent + indent + format(item, currentIndent + indent))
            return `[\n${items.join(',\n')}\n${currentIndent}]`;
        }

        if (typeof obj === 'object') {
            const entries = Object.entries(obj);
            if (entries.length === 0) return '{}';

            const items = entries.map(([key, value]) => {
                const formattedValue = format(value, currentIndent + indent);
                return `${currentIndent}${indent}"${processString(key)}": ${formattedValue}`;
            });
            return `{\n${items.join(',\n')}\n${currentIndent}}`;
        }

        if (typeof obj === 'string') return `"${processString(obj)}"`;
        return String(obj);
    };

    return format(obj);
}

// 清理JSON数据，去除undefined, null, NaN, Infinity, -Infinity, Symbol, Function, Date, RegExp等
const sanitizeForJson = (value: any, memo: WeakMap<object, any> = new WeakMap()): any => {
    if (value === undefined) {
        return null;
    }

    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : null;
    }

    if (typeof value === 'bigint') {
        return value.toString();
    }

    if (typeof value === 'symbol' || typeof value === 'function') {
        return null;
    }

    if (value instanceof Date) {
        return value.toISOString();
    }

    if (value instanceof RegExp) {
        return value.toString();
    }

    if (value instanceof Set) {
        return Array.from(value).map(item => sanitizeForJson(item, memo));
    }

    if (value instanceof Map) {
        const result: Record<string, any> = {};
        value.forEach((mapValue, mapKey) => {
            result[String(mapKey)] = sanitizeForJson(mapValue, memo);
        });
        return result;
    }

    if (Array.isArray(value)) {
        if (memo.has(value)) {
            return memo.get(value);
        }
        const result: any[] = [];
        memo.set(value, result);
        value.forEach(item => {
            result.push(sanitizeForJson(item, memo));
        });
        return result;
    }

    if (value && typeof value === 'object') {
        if (memo.has(value)) {
            return memo.get(value);
        }
        const result: Record<string, any> = {};
        memo.set(value, result);
        Object.keys(value).forEach(key => {
            result[key] = sanitizeForJson((value as Record<string, any>)[key], memo);
        });
        return result;
    }

    return value;
};

// JSON预处理函数 - 处理结构层面的问题（注释、尾逗号）和无效转义序列
const preprocessJSON = (jsonString: string): { data: any, originalString: string } => {
    if (!jsonString || typeof jsonString !== 'string') {
        return { data: null, originalString: jsonString };
    }
    let lastError: unknown = null;

    // 第一层：尝试标准JSON解析
    try {
        const data = JSON.parse(jsonString);
        const sanitized = sanitizeForJson(data);
        return { data: sanitized, originalString: jsonString };
    } catch (error) {
        lastError = error;
    }

    // 第二层：自定义清理 + JSON5解析
    // 步骤1：手动去除注释和处理特殊转义
    let cleanedJSON = '';
    let inString = false;      // 是否在字符串内
    let stringQuoteType: '"' | "'" | null = null;  // 当前字符串的引号类型（用于匹配开始和结束引号）
    let escaped = false;       // 上一个字符是否为转义字符
    let inSingleLineComment = false;  // 是否在单行注释内
    let inMultiLineComment = false;   // 是否在多行注释内

    try {
        // 标准JSON有效转义序列
        const standardEscapes = ['"', '\\', '/', 'b', 'f', 'n', 'r', 't', 'u'];
        // JSON5新增的有效转义序列
        const json5Escapes = ["'", '0', 'v'];
        // 所有有效转义序列
        const validEscapes = [...standardEscapes, ...json5Escapes];

        for (let i = 0; i < jsonString.length; i++) {
            const char = jsonString[i];
            const nextChar = jsonString[i + 1] || '';

            // 处理字符串内的转义字符
            if (char === '\\' && !escaped && inString) {
                // 检查是否是续行符（反斜杠后跟换行符，JSON5支持）
                if (nextChar === '\n' || nextChar === '\r') {
                    // 续行符：跳过反斜杠和换行符
                    if (nextChar === '\r' && jsonString[i + 2] === '\n') {
                        i += 2; // 跳过 \r\n
                    } else {
                        i++; // 跳过单个换行符
                    }
                    escaped = false;
                    continue;
                }
                // 检查是否是有效转义序列
                if (nextChar === 'u') {
                    // Unicode转义序列 \uXXXX 或 \u{X...}
                    const unicodeHex = jsonString.substring(i + 2, i + 6);
                    if (/^[0-9a-fA-F]{4}$/i.test(unicodeHex)) {
                        // 有效的4位Unicode转义，保留原样
                        cleanedJSON += jsonString.substring(i, i + 6); // \uXXXX
                        i += 5; // 跳过 \uXXXX (已经处理了 \，所以跳过 uXXXX)
                        escaped = false;
                        continue;
                    } else if (jsonString[i + 2] === '{') {
                        // \u{X...} 格式，保留原样（JSON5支持）
                        // 找到闭合的 }
                        let j = i + 3;
                        while (j < jsonString.length && jsonString[j] !== '}') {
                            j++;
                        }
                        if (j < jsonString.length) {
                            cleanedJSON += jsonString.substring(i, j + 1); // \u{X...}
                            i = j; // 跳过整个序列（循环末尾会 i++）
                            escaped = false;
                            continue;
                        } else {
                            // 没有找到闭合的 }，无效的Unicode转义，将\转义为\\
                            cleanedJSON += '\\\\';
                            escaped = false;
                            continue;
                        }
                    } else {
                        // 无效的Unicode转义，将\转义为\\
                        cleanedJSON += '\\\\';
                        escaped = false;
                        continue;
                    }
                } else if (nextChar === 'x') {
                    // \xXX 序列（JSON5支持），保留原样
                    const hexChars = jsonString.substring(i + 2, i + 4);
                    if (/^[0-9a-fA-F]{2}$/i.test(hexChars)) {
                        cleanedJSON += jsonString.substring(i, i + 4); // \xXX
                        i += 3; // 跳过 \xXX (已经处理了 \，所以跳过 xXX)
                        escaped = false;
                        continue;
                    } else {
                        // 无效的 \x 序列，将\转义为\\
                        cleanedJSON += '\\\\';
                        escaped = false;
                        continue;
                    }
                } else if (/^[0-9]$/.test(nextChar)) {
                    // 特殊处理：\0 到 \9 的数字转义序列
                    // JSON/JSON5中，\0 是有效的（null字符），但 \1 到 \9 都是无效的
                    // 需要检查是否是多位数字序列（如 \123）
                    let digits = nextChar;
                    let j = i + 2;
                    // 检查后续是否还有数字（最多3位，用于八进制序列）
                    // 注意：\8 和 \9 不是八进制数字，但 \123 这样的序列可能是八进制
                    if (/^[0-7]$/.test(nextChar)) {
                        // 如果是 0-7，可能是八进制序列，检查后续数字（最多3位）
                        while (j < jsonString.length && /^[0-7]$/.test(jsonString[j]) && digits.length < 3) {
                            digits += jsonString[j];
                            j++;
                        }
                    } else {
                        // \8 或 \9，不是八进制，只处理单个字符
                        // 但也要检查是否后面还有数字（如 \89）
                        while (j < jsonString.length && /^[0-9]$/.test(jsonString[j]) && digits.length < 3) {
                            digits += jsonString[j];
                            j++;
                        }
                    }
                    // 如果是 \0，且后面没有更多数字，这是有效的（\0 是 null 字符，JSON5支持）
                    if (digits === '0' && j === i + 2) {
                        cleanedJSON += '\\0';
                        i++; // 跳过 0
                        escaped = false;
                        continue;
                    } else {
                        // \1 到 \9 或多位数字序列，需要转义为 \\1, \\2, ..., \\123 等
                        cleanedJSON += '\\\\' + digits;
                        i += digits.length; // 跳过所有数字
                        escaped = false;
                        continue;
                    }
                } else if (validEscapes.includes(nextChar)) {
                    // 有效的转义序列，保留原样
                    cleanedJSON += char + nextChar;
                    i++; // 跳过转义字符
                    escaped = false;
                    continue;
                } else if (nextChar) {
                    // 无效的转义序列（如\a, \c等），将\转义为\\
                    cleanedJSON += '\\\\' + nextChar;
                    i++; // 跳过无效字符
                    escaped = false;
                    continue;
                } else {
                    // 反斜杠在字符串末尾，转义它
                    cleanedJSON += '\\\\';
                    escaped = false;
                    continue;
                }
            } else if (char === '\\' && !escaped) {
                // 不在字符串内的反斜杠，保留原样
                escaped = true;
                if (!inSingleLineComment && !inMultiLineComment) {
                    cleanedJSON += char;
                }
                continue;
            }

            // 处理字符串边界 - 双引号和单引号（JSON5支持单引号）
            // 注意：只有在非注释状态下才处理字符串边界
            if ((char === '"' || char === "'") && !escaped && !inSingleLineComment && !inMultiLineComment) {
                // 如果在字符串内，需要检查：
                // 1. 引号类型是否匹配（只有相同类型的引号才能结束字符串）
                // 2. 前一个字符是否是反斜杠（转义引号）
                let isEscapedQuote = false;
                let backslashCount = 0;
                if (inString) {
                    // 首先检查引号类型是否匹配
                    if (char !== stringQuoteType) {
                        // 引号类型不匹配，这是字符串内容中的引号，不是结束引号
                        cleanedJSON += char;
                        escaped = false;
                        continue;
                    }

                    // 引号类型匹配，检查是否被转义
                    // 重要：必须检查cleanedJSON中实际写入的内容，而不是原始字符串
                    // 因为某些反斜杠可能已经被处理过了（比如续行符被跳过了）
                    // 检查cleanedJSON末尾连续的反斜杠数量
                    if (cleanedJSON.length > 0) {
                        let cleanedBackslashCount = 0;
                        let k = cleanedJSON.length - 1;
                        while (k >= 0 && cleanedJSON[k] === '\\') {
                            cleanedBackslashCount++;
                            k--;
                        }
                        // 如果cleanedJSON中的反斜杠数量是奇数，说明引号被转义了
                        if (cleanedBackslashCount % 2 === 1) {
                            isEscapedQuote = true;
                            backslashCount = cleanedBackslashCount;
                        }
                    }

                    // 如果cleanedJSON中没有反斜杠，再检查原始字符串（作为后备）
                    // 但这种情况应该很少见，因为如果cleanedJSON为空或末尾不是反斜杠，
                    // 说明之前的反斜杠可能已经被处理掉了
                    if (!isEscapedQuote && i > 0) {
                        let j = i - 1;
                        // 检查原始字符串中连续的转义符
                        while (j >= 0 && jsonString[j] === '\\') {
                            backslashCount++;
                            j--;
                        }
                        // 如果反斜杠数量是奇数，说明引号被转义了
                        isEscapedQuote = (backslashCount % 2 === 1);
                    }
                }

                if (!isEscapedQuote) {
                    inString = !inString;
                    // 更新引号类型：如果开始字符串，记录引号类型；如果结束字符串，清除引号类型
                    if (inString) {
                        stringQuoteType = char as '"' | "'";
                    } else {
                        stringQuoteType = null;
                    }
                    cleanedJSON += char;
                } else {
                    // 转义的引号，应该保留在字符串内
                    cleanedJSON += char;
                }
                escaped = false;
                continue;
            }

            // 处理多行注释开始
            if (!inString && !inSingleLineComment && !inMultiLineComment && char === '/' && nextChar === '*') {
                inMultiLineComment = true;
                i++; // 跳过 '*'
                continue;
            }

            // 处理多行注释结束
            if (!inString && inMultiLineComment && char === '*' && nextChar === '/') {
                inMultiLineComment = false;
                i++; // 跳过 '/'
                continue;
            }

            // 处理单行注释开始
            if (!inString && !inMultiLineComment && !inSingleLineComment) {
                if (char === '/' && nextChar === '/') {
                    inSingleLineComment = true;
                    i++; // 跳过第二个 '/'
                    continue;
                }
                if (char === '#') {
                    // 支持脚本级别的井号注释符号
                    inSingleLineComment = true;
                    continue;
                }
            }

            // 处理单行注释结束
            if (inSingleLineComment && (char === '\n' || char === '\r')) {
                inSingleLineComment = false;
            }

            // 只有不在任何注释中时才添加字符
            if (!inSingleLineComment && !inMultiLineComment) {
                cleanedJSON += char;
            }

            // 更新转义状态
            // 如果当前字符是反斜杠且不在转义状态，设置 escaped = true 以便下一次循环处理转义序列
            // 否则重置转义状态
            if (char === '\\' && !escaped) {
                escaped = true;
            } else {
                escaped = false;
            }
        }

        // 移除多余的逗号（尾逗号）
        cleanedJSON = cleanedJSON.replace(/,(\s*[}\]])/g, '$1');

        // 步骤2：将处理好的数据交给JSON5的官方API进行处理
        const data = JSON5.parse(cleanedJSON);
        const sanitized = sanitizeForJson(data);

        // 步骤3：得到标准JSON
        let canonical = jsonString;
        try {
            canonical = JSON.stringify(sanitized);
        } catch {
            // 如果序列化失败，使用清理后的JSON
            canonical = cleanedJSON;
        }

        return { data: sanitized, originalString: canonical };
    } catch (error) {
        lastError = error;
    }

    throw lastError ?? new Error('Unable to parse JSON input');
};

// 层级收缩-使用缩进级别进行折叠的方法
const foldByIndentation = () => {
    if (!outputEditor) return;

    const model = outputEditor.getModel();
    if (!model) {
        selectedLevel.value = 1;
        return;
    }

    try {
        const lineCount = model.getLineCount();

        // 特殊处理第1层：折叠整个JSON对象
        if (selectedLevel.value === 1) {
            const firstLine = model.getLineContent(1).trim();
            if (firstLine === '{' || firstLine === '[') {
                // 找到最后一行（闭合括号）
                let lastLine = lineCount;
                for (let j = lastLine; j > 1; j--) {
                    const lineContent = model.getLineContent(j).trim();
                    if (lineContent === '}' || lineContent === ']') {
                        lastLine = j;
                        break;
                    }
                }

                if (lastLine > 1) {
                    // 禁用折叠信息更新（性能优化）
                    const disableUpdate = (outputEditor as any).__disableFoldingInfoUpdate;
                    if (disableUpdate && typeof disableUpdate === 'function') {
                        disableUpdate(2000); // 第1层折叠通常很快，禁用2秒即可
                    }

                    // 先展开所有
                    outputEditor.trigger('unfold', 'editor.unfoldAll', null);

                    // 延迟执行折叠，确保展开完成
                    setTimeout(() => {
                        if (!outputEditor) return;
                        try {
                            // 设置折叠状态标志
                            isFolding.value = true;

                            outputEditor.setSelection({
                                startLineNumber: 1,
                                startColumn: 1,
                                endLineNumber: lastLine,
                                endColumn: 1
                            });
                            outputEditor.trigger('fold', 'editor.fold', null);

                            // 清除选择
                            setTimeout(() => {
                                if (outputEditor) {
                                    outputEditor.setSelection({
                                        startLineNumber: 1,
                                        startColumn: 1,
                                        endLineNumber: 1,
                                        endColumn: 1
                                    });

                                    // 清除折叠状态标志
                                    isFolding.value = false;
                                    // 更新状态显示（恢复列数显示）
                                    updateEditorStatus(outputEditor, outputEditorStatus, false);

                                    // 立即启用更新并触发displayText更新（折叠操作完成后）
                                    const enableUpdateAndRefresh = (outputEditor as any).__enableFoldingInfoUpdateAndRefresh;
                                    if (enableUpdateAndRefresh && typeof enableUpdateAndRefresh === 'function') {
                                        enableUpdateAndRefresh();
                                    }
                                }
                            }, 50);

                            showSuccess(`收缩到第 ${selectedLevel.value} 层成功`);
                        } catch (e) {
                            // 发生错误时也要清除折叠状态
                            isFolding.value = false;
                            if (outputEditor) {
                                updateEditorStatus(outputEditor, outputEditorStatus, false);
                            }
                            showWarning('折叠操作失败, 请尝试手动折叠');
                        }
                    }, 100);
                }
            }
            return;
        }

        // 对于其他层级，使用基于括号嵌套深度的算法
        const targetLevel = selectedLevel.value; // 目标层级（从1开始）

        let foldingRanges: Array<{ start: number, end: number }> = [];

        // 使用栈来跟踪括号和嵌套深度
        interface StackItem {
            line: number;
            depth: number; // 括号嵌套深度（从1开始，根层为1）
            bracketType: '{' | '[';
        }
        const stack: StackItem[] = [];

        let inString = false;
        let escapeNext = false;
        let currentDepth = 0; // 当前括号嵌套深度

        // 单次遍历所有行，同时处理括号嵌套深度
        for (let lineNum = 1; lineNum <= lineCount; lineNum++) {
            const lineContent = model.getLineContent(lineNum);
            const trimmed = lineContent.trim();

            // 跳过空行（但仍需要处理字符串状态）
            if (!trimmed) {
                continue;
            }

            // 逐字符扫描，正确处理字符串中的括号
            for (let pos = 0; pos < lineContent.length; pos++) {
                const char = lineContent[pos];

                // 处理转义字符
                if (escapeNext) {
                    escapeNext = false;
                    continue;
                }

                if (char === '\\') {
                    escapeNext = true;
                    continue;
                }

                // 处理字符串边界
                if (char === '"') {
                    inString = !inString;
                    continue;
                }

                // 只在非字符串区域处理括号
                if (!inString) {
                    if (char === '{' || char === '[') {
                        // 进入新层级，深度+1
                        currentDepth++;
                        const bracketType = char === '{' ? '{' : '[' as '{' | '[';

                        // 如果当前深度等于目标层级，记录开始位置（这是目标层级本身）
                        if (currentDepth === targetLevel) {
                            stack.push({
                                line: lineNum,
                                depth: currentDepth,
                                bracketType: bracketType
                            });
                        }
                    } else if (char === '}' || char === ']') {
                        const matchingBracket = (char === '}') ? '{' : '[';

                        // 如果当前深度等于目标层级，说明即将退出目标层级，尝试匹配栈中的开始括号
                        if (currentDepth === targetLevel && stack.length > 0) {
                            // 从栈顶向下查找匹配的开始括号（LIFO：后进先出）
                            for (let i = stack.length - 1; i >= 0; i--) {
                                const item = stack[i];
                                if (item.bracketType === matchingBracket) {
                                    // 找到匹配，创建折叠范围
                                    if (item.line < lineNum) {
                                        foldingRanges.push({
                                            start: item.line,
                                            end: lineNum
                                        });
                                    }
                                    // 移除已匹配的项
                                    stack.splice(i, 1);
                                    break;
                                }
                            }
                        }

                        // 退出当前层级，深度-1（必须在匹配之后）
                        currentDepth--;
                    }
                }
            }

            // 注意：inString 和 escapeNext 状态会跨行保持
            // 这样能正确处理跨行的字符串和转义字符
        }

        // 去重：移除被其他更大范围完全包含的折叠范围
        // 按开始行号排序，然后从后向前检查
        foldingRanges.sort((a, b) => {
            if (a.start !== b.start) return a.start - b.start;
            // 如果开始行相同，结束行更大的排在后面（范围更大的）
            return b.end - a.end;
        });

        const filteredRanges: Array<{ start: number, end: number }> = [];
        for (let i = 0; i < foldingRanges.length; i++) {
            const current = foldingRanges[i];
            let isContained = false;

            // 检查当前范围是否被其他范围包含
            for (let j = 0; j < foldingRanges.length; j++) {
                if (i === j) continue;
                const other = foldingRanges[j];
                // 如果other完全包含current（开始更早或相同，结束更晚或相同，且至少有一个更严格）
                if (other.start <= current.start && other.end >= current.end &&
                    (other.start < current.start || other.end > current.end)) {
                    isContained = true;
                    break;
                }
            }

            if (!isContained) {
                filteredRanges.push(current);
            }
        }

        foldingRanges = filteredRanges;

        // 执行折叠操作
        if (foldingRanges.length > 0 && outputEditor) {
            // 先展开所有折叠，确保从干净的状态开始
            outputEditor.trigger('unfold', 'editor.unfoldAll', null);

            // 使用并发优化的批量折叠：使用 Promise.all 同时处理多个折叠操作
            const concurrentBatchFold = async () => {
                if (!outputEditor) {
                    isFolding.value = false;
                    return;
                }

                // 禁用折叠信息更新（性能优化：避免在批量折叠时频繁更新）
                const disableUpdate = (outputEditor as any).__disableFoldingInfoUpdate;
                if (disableUpdate && typeof disableUpdate === 'function') {
                    // 根据折叠范围数量动态调整禁用时间
                    const estimatedDuration = Math.min(10000, Math.max(3000, foldingRanges.length * 2));
                    disableUpdate(estimatedDuration);
                }

                // 设置折叠状态标志
                isFolding.value = true;

                const model = outputEditor.getModel();
                if (!model) {
                    isFolding.value = false;
                    return;
                }

                // 并发配置（可根据性能调整）
                // 注意：由于 Monaco Editor 的状态操作（setPosition/setSelection）需要顺序执行，
                // 我们使用"伪并发"：预处理数据并发，但折叠操作本身仍需要顺序执行以避免状态冲突
                const CONCURRENT_PREPARE = true; // 是否并发预处理数据
                const BATCH_SIZE = 100; // 每批处理的折叠范围数量
                const DELAY_BETWEEN_BATCHES = 5; // 批次之间的延迟（毫秒）
                const DELAY_BETWEEN_FOLDS = 1; // 每个折叠操作之间的最小延迟（毫秒）

                // 预处理：计算所有折叠范围的列位置
                interface PreparedRange {
                    start: number;
                    end: number;
                    startCol: number;
                    endCol: number;
                }

                const preparedRanges: PreparedRange[] = [];

                if (CONCURRENT_PREPARE && foldingRanges.length > 100) {
                    // 对于大量范围，使用并发预处理（只读取数据，不修改编辑器状态）
                    const preparePromises = foldingRanges.map(async (range) => {
                        try {
                            const startLineContent = model.getLineContent(range.start);
                            const endLineContent = model.getLineContent(range.end);

                            let startCol = startLineContent.search(/[\[\{]/);
                            if (startCol === -1) startCol = 1;
                            else startCol = startCol + 1;

                            let endCol = endLineContent.search(/[\]\}]/);
                            if (endCol === -1) {
                                endCol = model.getLineMaxColumn(range.end);
                            } else {
                                endCol = endCol + 1;
                            }

                            return {
                                start: range.start,
                                end: range.end,
                                startCol,
                                endCol
                            } as PreparedRange;
                        } catch (err) {
                            return null;
                        }
                    });

                    const results = await Promise.all(preparePromises);
                    preparedRanges.push(...results.filter(r => r !== null) as PreparedRange[]);
                } else {
                    // 顺序预处理（小数据量或禁用并发时）
                    for (const range of foldingRanges) {
                        try {
                            const startLineContent = model.getLineContent(range.start);
                            const endLineContent = model.getLineContent(range.end);

                            let startCol = startLineContent.search(/[\[\{]/);
                            if (startCol === -1) startCol = 1;
                            else startCol = startCol + 1;

                            let endCol = endLineContent.search(/[\]\}]/);
                            if (endCol === -1) {
                                endCol = model.getLineMaxColumn(range.end);
                            } else {
                                endCol = endCol + 1;
                            }

                            preparedRanges.push({
                                start: range.start,
                                end: range.end,
                                startCol,
                                endCol
                            });
                        } catch (err) {
                            // 忽略预处理错误
                        }
                    }
                }

                let foldedCount = 0;
                let failedCount = 0;

                // 从后向前分批处理（避免行号变化影响）
                // 注意：折叠操作必须顺序执行，因为 Monaco Editor 的状态操作不是线程安全的
                for (let batchStart = preparedRanges.length - 1; batchStart >= 0; batchStart -= BATCH_SIZE) {
                    const batchEnd = Math.max(0, batchStart - BATCH_SIZE + 1);
                    const batchRanges = preparedRanges.slice(batchEnd, batchStart + 1).reverse(); // 反转以保持从后向前的顺序

                    // 顺序执行折叠操作（避免状态冲突）
                    for (const range of batchRanges) {
                        try {
                            // 关键修复：在折叠之前，确保目标位置是可见的
                            // 由于我们已经在开始时执行了 editor.unfoldAll，理论上所有折叠都已展开
                            // 但为了确保，我们在折叠前再次展开目标位置附近的折叠

                            // 定位到目标层级的开始括号位置
                            outputEditor.setPosition({
                                lineNumber: range.start,
                                column: range.startCol
                            });

                            // 展开当前光标位置的折叠（如果存在，可能是之前折叠操作留下的）
                            // 这确保目标位置是可见的，不会被外层折叠影响
                            outputEditor.trigger('unfold', 'editor.unfold', null);

                            // 小延迟，确保展开完成
                            await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_FOLDS));

                            // 关键：Monaco Editor 的 fold 命令会折叠光标所在的最小代码块
                            // 问题：如果光标位置在外层块内，会折叠外层块
                            // 解决方案：我们需要确保光标位置精确在目标层级的开始括号处
                            // 并且该位置不在任何外层块内（通过展开所有外层折叠来保证）

                            // 使用 getAction 获取折叠操作
                            const foldAction = outputEditor.getAction('editor.fold');
                            if (foldAction && foldAction.isSupported()) {
                                // 执行折叠操作
                                // 注意：由于我们已经展开了所有折叠（在开始时执行了 unfoldAll），
                                // 并且目标位置是目标层级的开始括号，这里应该只折叠目标层级
                                await foldAction.run();
                                foldedCount++;
                            } else {
                                // 备用方案：使用 trigger 命令
                                outputEditor.trigger('fold', 'editor.fold', null);
                                foldedCount++;
                            }

                        } catch (err) {
                            failedCount++;
                            // 继续处理下一个范围
                        }

                        // 每处理一定数量后，让浏览器有机会渲染
                        if (foldedCount % 50 === 0) {
                            await new Promise(resolve => setTimeout(resolve, 5));
                        }
                    }

                    // 批次之间的延迟，让浏览器有机会渲染
                    if (batchStart > BATCH_SIZE) {
                        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
                    }
                }

                // 清除选择
                if (outputEditor) {
                    outputEditor.setSelection({
                        startLineNumber: 1,
                        startColumn: 1,
                        endLineNumber: 1,
                        endColumn: 1
                    });

                    const message = failedCount > 0
                        ? `收缩到第 ${selectedLevel.value} 层完成，成功 ${foldedCount} 个元素，失败 ${failedCount} 个元素`
                        : `收缩到第 ${selectedLevel.value} 层成功，共折叠 ${foldedCount} 个元素`;
                    showSuccess(message);

                    // 清除折叠状态标志
                    isFolding.value = false;
                    // 更新状态显示（恢复列数显示）
                    if (outputEditor) {
                        updateEditorStatus(outputEditor, outputEditorStatus, false);
                    }

                    // 立即启用更新并触发displayText更新（折叠操作完成后）
                    const enableUpdateAndRefresh = (outputEditor as any).__enableFoldingInfoUpdateAndRefresh;
                    if (enableUpdateAndRefresh && typeof enableUpdateAndRefresh === 'function') {
                        enableUpdateAndRefresh();
                    }
                }
            };

            // 等待展开完成后再开始折叠
            setTimeout(() => {
                concurrentBatchFold();
            }, 150);
        } else {
            showInfo(`未找到可收缩的第 ${selectedLevel.value} 层内容`);
        }
    } catch (e: any) {
        // 发生错误时清除折叠状态
        isFolding.value = false;
        if (outputEditor) {
            updateEditorStatus(outputEditor, outputEditorStatus, false);
        }
        showWarning('折叠操作失败: ' + (e.message || '未知错误'));
    }
};

// 处理转换
const handleConvert = (command: string) => {
    try {
        const value = inputEditor?.getValue() || '';
        if (!value.trim()) {
            showError('请先输入内容');
            return;
        }

        // 处理 Cookie 转换
        if (command === 'cookie') {
            const jsonStr = cookieToJSON(value);
            outputEditor?.setValue(jsonStr);
            updateLineNumberWidth(outputEditor);
            updateEditorHeight(outputEditor);
            showSuccess('Cookie 转换成功');
            return;
        }

        // 处理其他格式转换
        let parsed
        try {
            const result = preprocessJSON(value);
            parsed = result.data;
        } catch (error) {
            showError('请输入有效的 JSON 数据');
            return;
        }

        let result = '';
        let editorLanguage = 'json';
        switch (command) {
            case 'yaml':
                outputType.value = 'yaml';
                editorLanguage = 'yaml';
                result = convertToYAML(parsed);
                break;
            case 'toml':
                outputType.value = 'toml';
                editorLanguage = 'plaintext';
                result = convertToTOML(parsed);
                break;
            case 'xml':
                outputType.value = 'xml';
                editorLanguage = 'xml';
                result = convertToXML(parsed);
                break;
            case 'go':
                outputType.value = 'go';
                editorLanguage = 'go';
                result = convertToGo(parsed);
                break;
            default:
                throw new Error('不支持的转换类型');
        }

        if (outputEditor) {
            // 更新编辑器内容
            outputEditor.setValue(result);

            // 更新编辑器配置（包括模型选项，确保缩进指南线正确显示）
            updateOutputEditorConfig(editorLanguage);

            showSuccess(`转换为 ${command.toUpperCase()} 成功`);
        }
    } catch (error: any) {
        showError('转换失败: ' + error.message);
    }
};

// 格式化 JSON
const formatJSON = () => {
    try {
        outputType.value = 'json'
        const value = inputEditor?.getValue() || ''

        if (!value.trim()) {
            showError('请先输入 JSON 数据');
            return;
        }

        // 预处理 JSON 字符串
        // 注意：为了正确构建转义映射，我们需要使用原始输入字符串
        // JSON5解析可能会自动将Unicode转换为中文，所以需要在解析前保存原始字符串
        let parsed;
        let originalString = value; // 始终使用原始输入字符串以构建转义映射

        try {
            const result = preprocessJSON(value);
            parsed = result.data;
            // 对于编码模式0（保持原样），使用原始输入字符串
            // 对于其他模式，也使用原始输入字符串，让customStringify根据编码模式处理
            originalString = value;
        } catch (error) {
            showError('请输入有效的 JSON 数据');
            return;
        }

        // 使用标准格式化，传递原始字符串
        const formatted = customStringify(parsed, null, indentSize.value, originalString);

        // 异步计算所有折叠区域的信息（不阻塞，立即返回）
        // 这样可以避免实时计算的高成本，特别是对于大数据量（7-10万行）
        precomputeFoldingInfo(formatted).catch((error) => {
            // 静默处理错误，不影响主流程
        });

        outputEditor?.setValue(formatted);

        // 更新编辑器配置（包括模型选项，确保缩进指南线正确显示）
        // 对于JSON输出，总是启用大文件折叠优化
        updateOutputEditorConfig('json', true);

        showSuccess('格式化成功');
    } catch (error: any) {
        showError('格式化失败: ' + error.message);
    }
};

// 压缩 JSON
const compressJSON = () => {
    try {
        outputType.value = 'json';
        const value = inputEditor?.getValue() || '';
        if (!value.trim()) {
            showError('请先输入 JSON 数据');
            return;
        }

        // 预处理 JSON 字符串
        let parsed;
        try {
            const result = preprocessJSON(value);
            parsed = result.data;
        } catch (error) {
            showError('请输入有效的 JSON 数据');
            return;
        }

        // 使用标准压缩方法
        const compressed = JSON.stringify(parsed);
        outputEditor?.setValue(compressed);

        // 更新编辑器配置（包括模型选项，确保缩进指南线正确显示）
        // 对于JSON输出，总是启用大文件折叠优化
        updateOutputEditorConfig('json', true);

        showSuccess('压缩成功')
    } catch (error: any) {
        showError('压缩失败: ' + error.message)
    }
};

// 转义 JSON
const escapeJSON = () => {
    try {
        outputType.value = 'json';
        const value = inputEditor?.getValue() || '';
        if (!value.trim()) {
            showError('请先输入 JSON 数据');
            return;
        }

        // 预处理 JSON 字符串
        let parsed;
        try {
            const result = preprocessJSON(value);
            parsed = result.data;
        } catch (error) {
            showError('请输入有效的 JSON 数据');
            return;
        }

        // 格式化JSON（缩进为2）
        const formatted = JSON.stringify(parsed, null, 2);

        // 有效的JSON转义序列
        const validEscapes = ['"', '\\', '/', 'b', 'f', 'n', 'r', 't', 'u'];

        // 智能转义：保留原始JSON中的转义序列（包括非法转义序列）
        // 需要特别处理字符串值内部的转义序列，支持任意深度的嵌套
        // 核心思想：在字符串值内部，每个反斜杠都需要被转义（\ -> \\），每个引号都需要被转义（" -> \"）
        let escaped = '';
        let i = 0;
        let inString = false; // 跟踪是否在字符串值内部

        while (i < formatted.length) {
            const char = formatted[i];
            const nextChar = formatted[i + 1] || '';
            const nextNextChar = formatted[i + 2] || '';

            if (char === '\\') {
                // 优先处理反斜杠（避免与引号处理冲突）
                if (inString) {
                    // 在字符串值内部，所有反斜杠都需要被转义
                    if (nextChar === '"') {
                        // 字符串值内部的转义引号 \"，需要转义为 \\\"
                        // 因为我们要转义整个JSON字符串，所以 \" 需要变成 \\\"
                        escaped += '\\\\\\"';
                        i += 2;
                    } else if (nextChar === '\\') {
                        // 连续的反斜杠 \\，需要转义为 \\\\
                        // 检查是否是无效转义序列（如 \\a）
                        if (nextNextChar && !validEscapes.includes(nextNextChar)) {
                            // JSON.stringify 将无效转义序列 \a 转义成了 \\a
                            // 我们需要将其还原为 \a（转义后变成 \\a）
                            escaped += '\\' + nextNextChar;
                            i += 3;
                        } else {
                            // 标准的 \\，转义为 \\\\
                            escaped += '\\\\\\\\';
                            i += 2;
                        }
                    } else if (nextChar === 'u' && /^[0-9a-fA-F]{4}$/i.test(formatted.substring(i + 2, i + 6))) {
                        // Unicode转义序列 \uXXXX，在字符串值内部需要转义反斜杠
                        escaped += '\\\\u' + formatted.substring(i + 2, i + 6);
                        i += 6;
                    } else if (nextChar) {
                        // 标准转义序列（\n, \t等），在字符串值内部需要转义反斜杠
                        escaped += '\\\\' + nextChar;
                        i += 2;
                    } else {
                        // 单独的反斜杠（字符串末尾），转义它
                        escaped += '\\\\';
                        i++;
                    }
                } else {
                    // 不在字符串值内部，保持原样（这些是JSON结构中的转义序列）
                    if (nextChar === 'u' && /^[0-9a-fA-F]{4}$/i.test(formatted.substring(i + 2, i + 6))) {
                        // Unicode转义序列 \uXXXX，保持原样
                        escaped += formatted.substring(i, i + 6);
                        i += 6;
                    } else if (nextChar) {
                        // 标准转义序列（\n, \t等），保持原样
                        escaped += char + nextChar;
                        i += 2;
                    } else {
                        // 单独的反斜杠，转义它
                        escaped += '\\\\';
                        i++;
                    }
                }
            } else if (char === '"') {
                // 处理引号（必须在反斜杠之后处理，避免重复处理）
                // 所有引号都需要被转义
                escaped += '\\"';
                inString = !inString; // 切换字符串状态
                i++;
            } else {
                escaped += char;
                i++;
            }
        }

        outputEditor?.setValue(escaped);

        // 更新编辑器配置（包括模型选项，确保缩进指南线正确显示）
        // 对于JSON输出，总是启用大文件折叠优化
        updateOutputEditorConfig('json', true);

        showSuccess('转义成功');
    } catch (error: any) {
        showError('转义失败: ' + error.message);
    }
};

// 去除JSON转义字符
const unescapeJSON = () => {
    try {
        const value = inputEditor?.getValue() || ''
        if (!value.trim()) {
            showError('请先输入内容');
            return;
        }
        outputType.value = 'json';

        // 获取原始输入
        const originalInput = value;

        // 尝试作为JSON处理
        // 但要注意：如果输入包含转义序列（如 \n, \t），JSON.parse 会将它们转换为实际字符
        // 为了避免这种情况，我们先检查是否包含需要保持字面形式的转义序列
        let parsedInput = null;
        let shouldPreserveEscapes = false;

        // 检查输入是否包含需要保持字面形式的转义序列（除了 \" 和 \\）
        // 查找反斜杠后跟 n, t, r, b, f 的模式（这些是会被 JSON.parse 解析的转义序列）
        // 注意：我们不能使用后向断言，所以需要更简单的检测
        // 检测模式：\n, \t, \r, \b, \f（但排除 \\n 这种，因为它表示字面量反斜杠+n）
        // 简单检测：查找单数反斜杠后跟 n/t/r/b/f（前面没有另一个反斜杠）
        let hasEscapeToPreserve = false;
        for (let i = 0; i < value.length - 1; i++) {
            if (value[i] === '\\' && value[i + 1] && ['n', 't', 'r', 'b', 'f'].includes(value[i + 1])) {
                // 检查前面是否还有反斜杠（即是否是 \\n 这种情况）
                if (i === 0 || value[i - 1] !== '\\') {
                    hasEscapeToPreserve = true;
                    break;
                }
            }
        }
        if (hasEscapeToPreserve) {
            shouldPreserveEscapes = true;
        }

        // 如果包含需要保持字面形式的转义序列，不直接使用 JSON.parse
        // 而是先手动处理，只处理 \" 和 \\，然后尝试解析
        if (!shouldPreserveEscapes) {
            try {
                // 先尝试直接解析
                parsedInput = JSON.parse(value);
            } catch {
                // 如果直接解析失败，尝试用宽松模式处理
                try {
                    const result = preprocessJSON(value);
                    parsedInput = result.data;
                } catch {
                    // 不是有效的JSON，将进行基本转义处理
                }
            }
        } else {
            // 包含需要保持字面形式的转义序列，手动处理
            // 只处理 \" 和 \\，不处理其他转义序列
            // 这种情况下，我们只进行简单的替换，不尝试解析为JSON对象
            // 直接进入后面的手动处理逻辑
        }

        // 如果成功解析为对象或数组，进行递归处理
        if (parsedInput !== null && typeof parsedInput === 'object') {
            try {
                // 全局 Unicode 映射收集器（在处理开始前创建，用于收集所有需要保留的 Unicode 转义序列）
                const globalUnicodeMap = new Map<string, string>();

                // 递归处理所有字符串字段，检测并解析转义的JSON字段
                const processObject = (obj: any): any => {
                    if (obj === null || obj === undefined) return obj;

                    // 处理对象
                    if (typeof obj === 'object' && !Array.isArray(obj)) {
                        const result: Record<string, any> = {};
                        for (const key in obj) {
                            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                                // 处理对象的每个值
                                result[key] = processObject(obj[key]);
                            }
                        }
                        return result;
                    }

                    // 处理数组
                    if (Array.isArray(obj)) {
                        return obj.map(item => processObject(item));
                    }

                    // 处理字符串 - 尝试解析可能的JSON字符串
                    if (typeof obj === 'string') {
                        // 检查字符串是否像转义后的JSON
                        // 注意：obj 是已经解析过的 JavaScript 字符串
                        // 如果原始JSON字符串值是 "{\"key\": \"value\"}"，解析后的obj是 {"key": "value"}
                        // 我们需要检查obj中是否包含转义的引号（即字符串中包含反斜杠+引号的序列）
                        if ((obj.includes('\\"') || obj.includes('\\\\')) &&
                            (obj.includes('{') || obj.includes('['))) {
                            try {
                                // 先保存 Unicode 转义序列，避免被 JSON.parse 解码
                                // 使用 Map 来记录字符到 Unicode 转义序列的映射
                                const unicodeMap = new Map<string, string>(); // 字符 -> Unicode转义序列
                                let tempStr = obj;

                                // 查找并替换所有 Unicode 转义序列（\uXXXX）为占位符
                                tempStr = tempStr.replace(/\\u([0-9a-fA-F]{4})/g, (match, hex) => {
                                    const codePoint = parseInt(hex, 16);
                                    const char = String.fromCharCode(codePoint);
                                    const placeholder = `__UNI_HEX_${hex}__`;
                                    // 记录字符到 Unicode 转义序列的映射
                                    unicodeMap.set(char, match);
                                    return placeholder;
                                });

                                // 去除转义：使用逐字符处理，避免替换顺序问题
                                // 这样可以正确处理多层嵌套的情况（如 \\\\\"）
                                let unescaped = '';
                                let j = 0;
                                while (j < tempStr.length) {
                                    if (tempStr[j] === '\\' && j + 1 < tempStr.length) {
                                        const next = tempStr[j + 1];
                                        if (next === '\\') {
                                            // 遇到 \\，还原为一个反斜杠
                                            unescaped += '\\';
                                            j += 2;
                                        } else if (next === '"') {
                                            // 遇到 \"，还原为一个引号
                                            unescaped += '"';
                                            j += 2;
                                        } else {
                                            // 其他转义序列（\n, \t等），保持原样
                                            unescaped += tempStr[j] + next;
                                            j += 2;
                                        }
                                    } else {
                                        unescaped += tempStr[j];
                                        j++;
                                    }
                                }

                                // 检查 unescaped 中是否包含实际的控制字符（已解析的换行符、制表符等）
                                // 如果 unescaped 中包含实际的控制字符（而不是字面上的 \n），
                                // 需要将它们转义回JSON格式，这样才能用 JSON.parse 正确解析
                                // 注意：这里检查的是实际字符（换行符等），不是字面上的反斜杠+n
                                const hasActualControlChars = /[\n\r\t\b\f]/.test(unescaped);

                                if (hasActualControlChars) {
                                    // 将已解析的控制字符转义回JSON转义序列
                                    // 这样 JSON.parse 才能正确解析
                                    unescaped = unescaped
                                        .replace(/\n/g, '\\n')
                                        .replace(/\t/g, '\\t')
                                        .replace(/\r/g, '\\r')
                                        .replace(/\b/g, '\\b')
                                        .replace(/\f/g, '\\f');
                                }

                                // 验证去除转义后的字符串是否是有效的JSON
                                // 此时 unescaped 中：
                                // - 如果原来包含字面上的转义序列（\n），现在仍然是字面上的（\n）
                                // - 如果原来包含实际控制字符（换行符），现在已经被转义为字面上的（\n）
                                // 两种情况都可以用 JSON.parse 正确解析
                                let isValidJson = false;
                                let parsedValue = null;

                                try {
                                    parsedValue = JSON.parse(unescaped);
                                    isValidJson = true;

                                    // 恢复 Unicode 占位符：将占位符替换为对应的字符
                                    // 同时将 unicodeMap 附加到对象上，以便后续 stringify 时使用
                                    const restoreUnicodePlaceholders = (val: any, map: Map<string, string>): any => {
                                        if (typeof val === 'string') {
                                            // 将占位符替换为对应的字符
                                            let restored = val;
                                            map.forEach((unicode, char) => {
                                                const hex = unicode.replace(/\\u/, '');
                                                const placeholder = `__UNI_HEX_${hex}__`;
                                                restored = restored.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), char);
                                            });
                                            return restored;
                                        } else if (Array.isArray(val)) {
                                            return val.map(item => restoreUnicodePlaceholders(item, map));
                                        } else if (val && typeof val === 'object') {
                                            const result: Record<string, any> = {};
                                            for (const key in val) {
                                                if (Object.prototype.hasOwnProperty.call(val, key)) {
                                                    result[key] = restoreUnicodePlaceholders(val[key], map);
                                                }
                                            }
                                            return result;
                                        }
                                        return val;
                                    };

                                    parsedValue = restoreUnicodePlaceholders(parsedValue, unicodeMap);
                                    // 将 unicodeMap 合并到全局映射中
                                    unicodeMap.forEach((unicode, char) => {
                                        globalUnicodeMap.set(char, unicode);
                                    });
                                    // 将 unicodeMap 附加到解析后的对象上，以便后续使用（作为备份）
                                    (parsedValue as any).__unicodeMap__ = unicodeMap;
                                } catch (parseError) {
                                    // 解析失败，可能不是有效的JSON，保持原样
                                    isValidJson = false;
                                }

                                if (isValidJson) {
                                    // 如果是有效的JSON，递归处理它（展开嵌套结构）
                                    // 这样可以处理多层嵌套的情况，包括包含转义字符的情况
                                    if (typeof parsedValue === 'object' && parsedValue !== null) {
                                        // 递归处理嵌套的对象/数组，完全展开嵌套结构
                                        return processObject(parsedValue);
                                    } else {
                                        // 如果是其他类型，返回解析后的值
                                        return parsedValue;
                                    }
                                } else {
                                    // 解析失败，保持原始字符串
                                    return obj;
                                }
                            } catch (e) {
                                // 处理过程出错，返回原始字符串
                                return obj;
                            }
                        }
                    }

                    // 其他类型直接返回
                    return obj;
                }

                // 递归清理所有的临时 __unicodeMap__ 属性
                const cleanUnicodeMaps = (obj: any): void => {
                    if (obj && typeof obj === 'object') {
                        if ((obj as any).__unicodeMap__) {
                            // 删除临时属性（映射已经合并到全局映射中了）
                            delete (obj as any).__unicodeMap__;
                        }
                        if (Array.isArray(obj)) {
                            obj.forEach(item => cleanUnicodeMaps(item));
                        } else {
                            Object.values(obj).forEach(val => cleanUnicodeMaps(val));
                        }
                    }
                };

                // 处理整个JSON对象
                const processedJson = processObject(parsedInput);
                // 清理临时属性
                cleanUnicodeMaps(processedJson);

                // 自定义 stringify，保留 Unicode 转义序列
                const stringifyWithUnicode = (obj: any, indent: string = '', unicodeMap: Map<string, string> = globalUnicodeMap): string => {
                    if (obj === null) return 'null';
                    if (typeof obj === 'boolean') return obj.toString();
                    if (typeof obj === 'number') return obj.toString();

                    if (typeof obj === 'string') {
                        // 处理字符串转义，优先使用 unicodeMap 中的映射（保留原始 Unicode 转义序列）
                        let escaped = '';
                        for (let i = 0; i < obj.length; i++) {
                            const char = obj[i];
                            const code = char.charCodeAt(0);

                            // 如果字符在 unicodeMap 中，使用映射的 Unicode 转义序列（保留原始格式）
                            if (unicodeMap.has(char)) {
                                escaped += unicodeMap.get(char)!;
                            }
                            // 对于控制字符和需要转义的字符，使用标准JSON转义
                            else if (code < 32 || code === 34 || code === 92) {
                                switch (char) {
                                    case '"': escaped += '\\"'; break;
                                    case '\\': escaped += '\\\\'; break;
                                    case '\b': escaped += '\\b'; break;
                                    case '\f': escaped += '\\f'; break;
                                    case '\n': escaped += '\\n'; break;
                                    case '\r': escaped += '\\r'; break;
                                    case '\t': escaped += '\\t'; break;
                                    default:
                                        escaped += '\\u' + ('0000' + code.toString(16)).slice(-4);
                                }
                            } else {
                                // 其他字符（包括中文字符），如果不是在 unicodeMap 中，直接输出
                                // 这样 JSON.parse 可以正常解析，并且不会将原本不是 Unicode 转义的中文转换为转义序列
                                escaped += char;
                            }
                        }
                        return '"' + escaped + '"';
                    }

                    if (Array.isArray(obj)) {
                        if (obj.length === 0) return '[]';
                        const items = obj.map(item => {
                            const itemStr = stringifyWithUnicode(item, indent + '  ', unicodeMap);
                            return indent + '  ' + itemStr;
                        });
                        return '[\n' + items.join(',\n') + '\n' + indent + ']';
                    }

                    if (typeof obj === 'object') {
                        const keys = Object.keys(obj);
                        if (keys.length === 0) return '{}';
                        const pairs = keys.map(key => {
                            const keyStr = stringifyWithUnicode(key, indent + '  ', unicodeMap);
                            const valueStr = stringifyWithUnicode(obj[key], indent + '  ', unicodeMap);
                            return indent + '  ' + keyStr + ': ' + valueStr;
                        });
                        return '{\n' + pairs.join(',\n') + '\n' + indent + '}';
                    }

                    return JSON.stringify(obj);
                };

                // 使用自定义格式化（保留Unicode转义序列）
                const formatted = stringifyWithUnicode(processedJson);
                outputEditor?.setValue(formatted);

                // 更新编辑器配置
                if (outputEditor) {
                    // 更新编辑器语言
                    const model = outputEditor.getModel();
                    if (model) {
                        monaco.editor.setModelLanguage(model, 'json');
                    }

                    // 更新其他配置
                    // 对于JSON输出，总是启用大文件折叠优化
                    outputEditor.updateOptions(getEditorOptions(indentSize.value, true, 'json', true));
                    updateLineNumberWidth(outputEditor);
                    updateEditorHeight(outputEditor);
                }

                showSuccess('去除转义成功');
                return;
            } catch (processError) {
                // 处理过程出错，尝试其他方式
            }
        }

        // 处理双重转义的特殊情况（如压缩并转义的结果）
        if (typeof value === 'string' && value.trim().startsWith('"') && value.trim().endsWith('"')) {
            try {
                // 尝试解析为JSON字符串
                const firstUnescaped = JSON.parse(value.trim());

                if (typeof firstUnescaped === 'string') {
                    // 检查解析出的字符串是否是有效的JSON
                    let isValidJson = false;
                    try {
                        JSON.parse(firstUnescaped);
                        isValidJson = true;
                    } catch {
                        // 不是有效的JSON，应该保持原样
                        isValidJson = false;
                    }

                    if (isValidJson) {
                        try {
                            // 尝试解析第二层
                            const secondUnescaped = JSON.parse(firstUnescaped);
                            if (typeof secondUnescaped === 'object' && secondUnescaped !== null) {
                                const formatted = JSON.stringify(secondUnescaped, null, 2);
                                outputEditor?.setValue(formatted);

                                // 更新编辑器配置
                                if (outputEditor) {
                                    // 更新编辑器语言
                                    const model = outputEditor.getModel();
                                    if (model) {
                                        monaco.editor.setModelLanguage(model, 'json');
                                    }

                                    // 更新其他配置
                                    // 对于JSON输出，总是启用大文件折叠优化
                                    outputEditor.updateOptions(getEditorOptions(indentSize.value, true, 'json', true));
                                    updateLineNumberWidth(outputEditor);
                                    updateEditorHeight(outputEditor);
                                }

                                showSuccess('去除双重转义成功');
                                return;
                            }
                        } catch {
                            // 第二层解析失败，只处理第一层
                            outputEditor?.setValue(firstUnescaped);

                            // 更新编辑器配置
                            if (outputEditor) {
                                // 更新编辑器语言
                                const model = outputEditor.getModel();
                                if (model) {
                                    monaco.editor.setModelLanguage(model, 'json');
                                }

                                // 更新其他配置
                                // 对于JSON输出，总是启用大文件折叠优化
                                outputEditor.updateOptions(getEditorOptions(indentSize.value, true, 'json', true));
                                updateLineNumberWidth(outputEditor);
                                updateEditorHeight(outputEditor);
                            }

                            showSuccess('去除转义成功');
                            return;
                        }
                    } else {
                        // 不是有效的JSON，应该保持原样
                    }
                }
            } catch {
                // 解析JSON字符串失败，继续尝试其他方法
            }
        }

        // 对于无法解析为JSON的内容，进行基本转义字符处理
        // 只处理外层的转义（\" 和 \\），不将转义序列转换为实际字符
        let result = originalInput;

        // 只有当确实有转义字符时才进行处理
        if (originalInput.includes('\\')) {
            // 检查内容是否有明显的JSON转义特征
            const hasJsonEscapes = /\\["\\\/bfnrtu]/.test(originalInput);
            const hasUnicodeEscapes = /\\u[\da-fA-F]{4}/.test(originalInput);

            if (hasJsonEscapes || hasUnicodeEscapes) {
                try {
                    // 只处理最外层的转义：\" -> " 和 \\ -> \
                    // 不处理其他转义序列（\n, \t等），保持它们为字面形式
                    result = originalInput
                        .replace(/\\"/g, '"')
                        .replace(/\\\\/g, '\\');
                    // 注意：移除了将 \n, \t 等转换为实际字符的代码
                    // 这样转义序列会保持为字面形式（\n 而不是换行符）
                } catch (e) {
                    // 转义失败，保持原样
                    result = originalInput;
                }

                outputEditor?.setValue(result);

                // 更新编辑器配置
                if (outputEditor) {
                    // 更新编辑器语言
                    const model = outputEditor.getModel();
                    if (model) {
                        monaco.editor.setModelLanguage(model, 'json');
                    }

                    // 更新其他配置
                    // 对于JSON输出，总是启用大文件折叠优化
                    outputEditor.updateOptions(getEditorOptions(indentSize.value, true, 'json', true));
                    updateLineNumberWidth(outputEditor);
                    updateEditorHeight(outputEditor);
                }

                showSuccess('去除转义成功');
            } else {
                // 没有标准JSON转义特征，提示用户
                outputEditor?.setValue(originalInput);

                // 更新编辑器配置
                if (outputEditor) {
                    // 更新编辑器语言
                    const model = outputEditor.getModel();
                    if (model) {
                        monaco.editor.setModelLanguage(model, 'json');
                    }

                    // 更新其他配置
                    // 对于JSON输出，总是启用大文件折叠优化
                    outputEditor.updateOptions(getEditorOptions(indentSize.value, true, 'json', true));
                    updateLineNumberWidth(outputEditor);
                    updateEditorHeight(outputEditor);
                }

                showWarning('未检测到标准JSON转义, 内容保持不变');
            }
        } else {
            outputEditor?.setValue(originalInput);

            // 更新编辑器配置
            if (outputEditor) {
                // 更新编辑器语言
                const model = outputEditor.getModel();
                if (model) {
                    monaco.editor.setModelLanguage(model, 'json');
                }

                // 更新其他配置
                // 对于JSON输出，总是启用大文件折叠优化
                outputEditor.updateOptions(getEditorOptions(indentSize.value, true, 'json', true));
                updateLineNumberWidth(outputEditor);
                updateEditorHeight(outputEditor);
            }

            showSuccess('去除转义成功');
        }

        return;
    } catch (error: any) {
        showError('去除转义失败: ' + error.message);
    }
};

// 压缩并转义功能
const compressAndEscapeJSON = () => {
    try {
        const value = inputEditor?.getValue() || ''
        if (!value.trim()) {
            showError('请先输入 JSON 数据');
            return;
        }
        outputType.value = 'json';

        // 预处理 JSON 字符串
        let parsed;
        try {
            const result = preprocessJSON(value);
            parsed = result.data;
        } catch (error) {
            showError('请输入有效的 JSON 数据');
            return;
        }

        // 使用标准压缩方法
        const compressed = JSON.stringify(parsed);

        // 转义处理 - 手动转义，只转义双引号，保持所有转义字符（\n, \t, \a等）原样
        // 只转义双引号，不转义反斜杠（保持所有转义序列如 \n, \t, \a 等原样）
        let escaped = compressed.replace(/"/g, '\\"');

        outputEditor?.setValue(escaped);

        // 更新编辑器配置
        if (outputEditor) {
            // 更新编辑器语言
            const model = outputEditor.getModel();
            if (model) {
                monaco.editor.setModelLanguage(model, 'json');
            }

            // 更新其他配置
            // 对于JSON输出，总是启用大文件折叠优化
            outputEditor.updateOptions(getEditorOptions(indentSize.value, true, 'json', true));
            updateLineNumberWidth(outputEditor);
            updateEditorHeight(outputEditor);
        }

        showSuccess('压缩并转义成功');
    } catch (error: any) {
        showError('压缩并转义失败: ' + error.message);
    }
};

// 处理层级收缩
const handleLevelAction = () => {
    try {
        if (!outputEditor) {
            showError('编辑器未初始化');
            return;
        }

        const value = inputEditor?.getValue() || '';
        if (!value.trim()) {
            showError('请先输入 JSON 数据');
            selectedLevel.value = 1;
            return;
        }

        // 解析JSON
        let parsedData;
        try {
            const result = preprocessJSON(value);
            parsedData = result.data; // 提取实际的JSON数据
        } catch (error) {
            showError('请输入有效的 JSON 数据');
            return;
        }

        // 格式化JSON以确保结构正确
        const formatted = JSON.stringify(parsedData, null, 2);

        // 异步计算折叠区域信息（不阻塞，立即返回）
        // 先不计算，等折叠完成后再按需计算可见区域
        precomputeFoldingInfo(formatted).catch((error) => {
            // 静默处理错误，不影响主流程
        });

        // 更新预览区域内容
        outputEditor.setValue(formatted);

        // 更新编辑器配置
        if (outputEditor) {
            // 更新编辑器语言
            const model = outputEditor.getModel();
            if (model) {
                monaco.editor.setModelLanguage(model, 'json');
            }

            // 更新其他配置
            // 对于10万行以内的JSON文件，总是启用大文件折叠优化
            const updateOptions = getEditorOptions(2, true, 'json', true);
            outputEditor.updateOptions(updateOptions);
            updateLineNumberWidth(outputEditor);
            updateEditorHeight(outputEditor);
        }

        // 等待编辑器渲染完成后执行折叠操作
        // 对于大数据量，需要更长的等待时间确保编辑器完全渲染
        // 使用渐进式延迟：根据行数动态调整延迟时间，确保10万行文件也能正常处理
        const currentLineCount = outputEditor?.getModel()?.getLineCount() || 0;
        let delayTime: number;
        let unfoldDelay: number;

        if (currentLineCount > 80000) {
            // 8万行以上：使用较长的延迟（支持10万行）
            delayTime = 1000;
            unfoldDelay = 600;
        } else if (currentLineCount > 50000) {
            // 5-8万行：使用中等延迟
            delayTime = 600;
            unfoldDelay = 400;
        } else {
            // 5万行以下：使用较短延迟
            delayTime = 200;
            unfoldDelay = 100;
        }

        setTimeout(() => {
            if (!outputEditor) return;
            outputEditor.trigger('unfold', 'editor.unfoldAll', null);
            // 等待展开完成后再执行折叠
            setTimeout(() => {
                foldByIndentation();

                // 折叠完成后，获取可见区域并优先计算可见区域的折叠信息
                // 这样用户看到的区域会优先显示统计信息
                setTimeout(() => {
                    if (!outputEditor) return;
                    try {
                        const visibleRanges = outputEditor.getVisibleRanges();
                        if (visibleRanges && visibleRanges.length > 0) {
                            let minLine = Infinity;
                            let maxLine = 0;
                            visibleRanges.forEach(range => {
                                if (range.startLineNumber < minLine) minLine = range.startLineNumber;
                                if (range.endLineNumber > maxLine) maxLine = range.endLineNumber;
                            });
                            if (minLine !== Infinity && maxLine > 0) {
                                // 扩展可见区域范围（上下各扩展100行）
                                const model = outputEditor.getModel();
                                if (model) {
                                    const totalLines = model.getLineCount();
                                    const priorityStart = Math.max(1, minLine - 100);
                                    const priorityEnd = Math.min(totalLines, maxLine + 100);

                                    // 重新触发计算，优先计算可见区域
                                    precomputeFoldingInfo(formatted, {
                                        start: priorityStart,
                                        end: priorityEnd
                                    }).catch(() => {
                                        // 静默处理错误
                                    });
                                }
                            }
                        }
                    } catch (e) {
                        // 如果获取可见区域失败，继续后台计算所有区域
                        precomputeFoldingInfo(formatted).catch((error) => {
                            // 静默处理错误
                        });
                    }
                }, 300); // 等待折叠动画完成
            }, unfoldDelay);
        }, delayTime);
    } catch (error: any) {
        showError('操作失败: ' + error.message);
    }
};

// 打开获取JSON对话框
const openFetchJsonDialog = () => {
    fetchJsonDialogVisible.value = true;
};

// 打开分享对话框
const openShareDialog = () => {
    shareDialogVisible.value = true;
};

// 打开数据脱敏对话框
const openDataMaskingDialog = () => {
    // 检查输入编辑器是否有内容
    if (!inputEditor) {
        showWarning('编辑器未初始化，请稍候再试');
        return;
    }

    const jsonData = inputEditor.getValue();
    if (!jsonData || !jsonData.trim()) {
        showWarning('请先输入JSON数据');
        return;
    }

    // 验证JSON格式
    try {
        JSON.parse(jsonData);
    } catch (error) {
        showError('JSON格式不正确，请先格式化JSON数据');
        return;
    }

    dataMaskingDialogVisible.value = true;
};

// 处理数据脱敏应用
const handleDataMaskingApply = (maskedJson: string) => {
    try {
        // 将脱敏后的JSON应用到输入区域
        if (inputEditor) {
            const model = inputEditor.getModel();
            if (model) {
                // 使用 executeEdits 来应用脱敏结果，这样可以保留撤销历史
                const fullRange = model.getFullModelRange();
                inputEditor.pushUndoStop();
                inputEditor.executeEdits('apply-masking', [{
                    range: fullRange,
                    text: maskedJson
                }]);
                inputEditor.pushUndoStop();

                // 更新编辑器配置
                monaco.editor.setModelLanguage(model, 'json');
                // 确保使用2空格缩进
                model.updateOptions({ tabSize: 2, indentSize: 2, insertSpaces: true });
            }
            // 同时更新编辑器选项
            inputEditor.updateOptions({ tabSize: 2, indentSize: 2 } as any);

            // 更新行号和高度
            updateLineNumberWidth(inputEditor);
            updateEditorHeight(inputEditor);

            // 更新层级信息
            try {
                const parsed = JSON.parse(maskedJson);
                maxLevel.value = calculateMaxLevel(parsed);
                if (maxLevel.value > 0 && selectedLevel.value === 0) {
                    selectedLevel.value = 1;
                }
            } catch {
                maxLevel.value = 0;
                selectedLevel.value = 0;
            }
        }

        // 清空预览区域
        if (outputEditor) {
            outputEditor.setValue('');
            updateLineNumberWidth(outputEditor);
            updateEditorHeight(outputEditor);
        }

        outputType.value = 'json';
    } catch (error: any) {
        showError('应用脱敏结果失败: ' + (error.message || '未知错误'));
    }
};

// 获取输入编辑器内容
const getInputEditorValue = (): string => {
    if (!inputEditor) return '';
    return inputEditor.getValue();
};

// 处理加载分享的JSON数据到输入区域
const handleLoadSharedJson = (jsonData: string) => {
    try {
        if (!inputEditor) {
            showError('编辑器未初始化，请稍候再试');
            return;
        }

        if (!jsonData || !jsonData.trim()) {
            showError('分享数据为空');
            return;
        }

        // 验证并格式化JSON数据
        try {
            const parsed = JSON.parse(jsonData);
            // 使用自定义格式化函数格式化JSON，输入编辑器始终使用2空格缩进
            const formattedJson = customStringify(parsed, null, 2);

            // 将格式化后的JSON设置到输入编辑器
            inputEditor.setValue(formattedJson);

            // 更新编辑器配置
            const model = inputEditor.getModel();
            if (model) {
                monaco.editor.setModelLanguage(model, 'json');
                // 确保使用2空格缩进
                model.updateOptions({ tabSize: 2, indentSize: 2, insertSpaces: true });
            }
            // 同时更新编辑器选项
            inputEditor.updateOptions({ tabSize: 2, indentSize: 2 } as any);

            // 更新行号和高度
            updateLineNumberWidth(inputEditor);
            updateEditorHeight(inputEditor);

            // 更新层级信息
            maxLevel.value = calculateMaxLevel(parsed);
            if (maxLevel.value > 0 && selectedLevel.value === 0) {
                selectedLevel.value = 1;
            }

            // 清空预览区域
            if (outputEditor) {
                outputEditor.setValue('');
                updateLineNumberWidth(outputEditor);
                updateEditorHeight(outputEditor);
            }

            outputType.value = 'json';
        } catch (error: any) {
            showError('JSON格式不正确: ' + (error.message || '解析失败'));
        }
    } catch (error: any) {
        showError('加载分享数据失败: ' + (error.message || '未知错误'));
    }
};

// 从URL参数加载分享数据
const loadSharedDataFromUrl = async () => {
    if (typeof window === 'undefined') return;

    try {
        const urlParams = new URLSearchParams(window.location.search);
        const shareId = urlParams.get('share');

        if (!shareId) return;

        // 检查是否需要密码
        const password = urlParams.get('password');

        // 获取分享数据
        const queryParams: Record<string, string> = { id: shareId };
        if (password) {
            queryParams.password = password;
        }

        const response = await $fetch<{
            success: boolean;
            data?: {
                id: string;
                jsonData: string;
                description?: string;
            };
            error?: string;
            hasPassword?: boolean;
        }>('/api/share-json', {
            method: 'GET',
            query: queryParams,
        });

        if (response.success && response.data) {
            // 成功加载数据，加载JSON数据到编辑器
            if (inputEditor && response.data.jsonData) {
                try {
                    // 验证JSON格式
                    const jsonData = JSON.parse(response.data.jsonData);
                    // 输入编辑器始终使用2个空格缩进，不受格式化设置影响
                    const formattedJson = customStringify(jsonData, null, 2);
                    inputEditor.setValue(formattedJson);

                    // 更新编辑器配置，确保使用2空格缩进
                    const model = inputEditor.getModel();
                    if (model) {
                        monaco.editor.setModelLanguage(model, 'json');
                        model.updateOptions({ tabSize: 2, indentSize: 2, insertSpaces: true });
                    }
                    // 同时更新编辑器选项
                    inputEditor.updateOptions({ tabSize: 2, indentSize: 2 } as any);

                    // 更新行号和高度
                    updateLineNumberWidth(inputEditor);
                    updateEditorHeight(inputEditor);

                    // 更新层级信息
                    maxLevel.value = calculateMaxLevel(jsonData);
                    if (maxLevel.value > 0 && selectedLevel.value === 0) {
                        selectedLevel.value = 1;
                    }

                    // 显示成功消息
                    if (response.data.description) {
                        showSuccess(`已加载分享数据：${response.data.description}`);
                    } else {
                        showSuccess('已加载分享数据');
                    }

                    // 清除URL参数（可选，保持URL干净）
                    const cleanUrl = new URL(window.location.href);
                    cleanUrl.searchParams.delete('share');
                    cleanUrl.searchParams.delete('password');
                    window.history.replaceState({}, '', cleanUrl.toString());
                } catch (error) {
                    showError('分享数据格式不正确');
                }
            }
        } else {
            // 处理错误情况
            if (response.hasPassword) {
                // 需要密码或密码错误，显示密码输入对话框
                const promptMessage = password
                    ? '密码不正确，请重新输入'
                    : '此分享链接需要密码才能访问';

                ElMessageBox.prompt(promptMessage, '输入密码', {
                    confirmButtonText: '确定',
                    cancelButtonText: '取消',
                    inputType: 'password',
                    inputPlaceholder: '请输入访问密码',
                }).then(async ({ value }) => {
                    if (value) {
                        // 重新加载，带上密码
                        const newUrl = new URL(window.location.href);
                        newUrl.searchParams.set('password', value);
                        window.history.replaceState({}, '', newUrl.toString());
                        await loadSharedDataFromUrl();
                    }
                }).catch(() => {
                    // 用户取消
                });
            } else {
                showError(response.error || '加载分享数据失败');
            }
        }
    } catch (error: any) {
        showError('加载分享数据失败: ' + (error.message || '未知错误'));
    }
};


// 处理转义相关命令
const handleEscapeCommand = (command: string) => {
    switch (command) {
        case 'escape':
            escapeJSON();
            break;
        case 'unescape':
            unescapeJSON();
            break;
        case 'compress-escape':
            compressAndEscapeJSON();
            break;
    }
};

// 处理高级功能命令
const handleAdvancedCommand = (command: string) => {
    switch (command) {
        case 'sort':
            applySort();
            break;
        case 'collapse':
            if (maxLevel.value > 0) {
                handleLevelAction();
            }
            break;
    }
};

// 打开设置对话框
const openSettingsDialog = () => {
    settingsDialogVisible.value = true;
};

// 检查Key是否为纯数字
const isNumericKey = (key: string): boolean => {
    // 检查是否为纯数字（包括负数、小数）
    return /^-?\d+(\.\d+)?$/.test(key);
};

// 获取Key的类型（数字或字符串）
const getKeyType = (key: string): 'number' | 'string' => {
    return isNumericKey(key) ? 'number' : 'string';
};

// 比较函数：字典序
const compareDictionary = (a: string, b: string): number => {
    return a.localeCompare(b, undefined, { numeric: false, sensitivity: 'base' });
};

// 比较函数：按Key长度
const compareLength = (a: string, b: string): number => {
    if (a.length !== b.length) {
        return a.length - b.length;
    }
    return compareDictionary(a, b);
};

// 比较函数：按Key数值
const compareNumeric = (a: string, b: string): number => {
    const aIsNumeric = isNumericKey(a);
    const bIsNumeric = isNumericKey(b);

    if (aIsNumeric && bIsNumeric) {
        // 都是数字，按数值比较
        const aNum = parseFloat(a);
        const bNum = parseFloat(b);
        return aNum - bNum;
    } else if (aIsNumeric && !bIsNumeric) {
        // a是数字，b不是，数字在前
        return -1;
    } else if (!aIsNumeric && bIsNumeric) {
        // a不是数字，b是，数字在前
        return 1;
    } else {
        // 都不是数字，按字典序
        return compareDictionary(a, b);
    }
};

// 比较函数：按Key类型分组
const compareType = (a: string, b: string): number => {
    const aType = getKeyType(a);
    const bType = getKeyType(b);

    if (aType !== bType) {
        // 类型不同，数字在前
        return aType === 'number' ? -1 : 1;
    } else {
        // 类型相同，按字典序
        return compareDictionary(a, b);
    }
};

// 获取比较函数
const getCompareFunction = (method: 'dictionary' | 'length'): (a: string, b: string) => number => {
    switch (method) {
        case 'dictionary':
            return compareDictionary;
        case 'length':
            return compareLength;
        default:
            return compareDictionary;
    }
};

// 递归排序JSON对象
const sortJsonObject = (obj: any, method: 'dictionary' | 'length', order: 'asc' | 'desc'): any => {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }

    if (Array.isArray(obj)) {
        // 数组：递归处理每个元素
        return obj.map(item => sortJsonObject(item, method, order));
    }

    // 对象：对Key进行排序
    const compareFn = getCompareFunction(method);
    const sortedKeys = Object.keys(obj).sort((a, b) => {
        const result = compareFn(a, b);
        return order === 'asc' ? result : -result;
    });

    const sortedObj: any = {};
    for (const key of sortedKeys) {
        // 递归处理值
        sortedObj[key] = sortJsonObject(obj[key], method, order);
    }

    return sortedObj;
};

// 应用排序
const applySort = () => {
    try {
        outputType.value = 'json';
        const value = inputEditor?.getValue() || '';

        if (!value.trim()) {
            showError('请先输入 JSON 数据');
            return;
        }

        // 预处理 JSON 字符串
        let parsed;
        let originalString = value;
        try {
            const result = preprocessJSON(value);
            parsed = result.data;
            originalString = result.originalString;
        } catch (error) {
            showError('请输入有效的 JSON 数据');
            return;
        }

        // 执行排序
        const sorted = sortJsonObject(parsed, sortMethod.value, sortOrder.value);

        // 格式化输出（排序功能固定使用2个空格缩进，编码模式保持原样，数组样式固定为换行）
        const formatted = customStringify(sorted, null, 2, originalString, 0, true);
        const finalOutput = formatted.replace(/\\u([0-9a-fA-F]{4})/g, '\\u$1');

        outputEditor?.setValue(finalOutput);

        // 更新编辑器配置（排序功能固定使用2个空格缩进）
        if (outputEditor) {
            const model = outputEditor.getModel();
            if (model) {
                monaco.editor.setModelLanguage(model, 'json');
            }

            const lineCount = outputEditor?.getModel()?.getLineCount() || 0;
            outputEditor.updateOptions(getEditorOptions(2, true, 'json', true));
            updateLineNumberWidth(outputEditor);
            updateEditorHeight(outputEditor);
        }

        // 显示成功提示
        const methodNames: Record<string, string> = {
            dictionary: '字典序',
            length: '按Key长度'
        };
        const orderNames: Record<string, string> = {
            asc: '正序',
            desc: '倒序'
        };
        showSuccess(`排序成功`);
    } catch (error: any) {
        showError('排序失败: ' + error.message);
    }
};


// JSON 转 YAML
const convertToYAML = (obj: any, indent: number = 0): string => {
    const spaces = ' '.repeat(indent);

    // 检查字符串是否需要引号的函数
    const needsQuotes = (str: string): boolean => {
        // 1. 包含冒号+空格的情况
        if (str.includes(': ')) return true;

        // 2. 包含井号(#)的情况
        if (str.includes('#')) return true;

        // 3. 包含连字符+空格的情况
        if (str.includes('- ')) return true;

        // 4. 包含方括号或花括号
        if (str.includes('[') || str.includes(']') || str.includes('{') || str.includes('}')) return true;

        // 5. 包含YAML保留字符
        if (/[~!&*|>@`%^]/.test(str)) return true;

        // 6. 包含引号
        if (str.includes("'") || str.includes('"')) return true;

        // 7. 包含控制字符或特殊Unicode
        if (/[\x00-\x1F\x7F-\x9F\u2028\u2029]/.test(str)) return true;

        // 8. 布尔值、Null、纯数字的字符串表示
        if (/^(true|false|null|\d+\.?\d*([eE][+-]?\d+)?)$/.test(str)) return true;

        // 9. 空字符串或仅包含空白字符
        if (!str.trim()) return true;

        // 10. 以特殊字符开头或结尾
        if (/^[- :?[{\]},#&*!|>'"%@`]|[- :?[{\]},#&*!|>'"%@`]$/.test(str)) return true;

        // 11. 包含URL常见字符组合
        if (/https?:\/\//.test(str)) return true;

        return false;
    };

    const formatValue = (value: any): string => {
        if (value === null) return 'null';
        if (typeof value === 'string') {
            // 处理多行字符串
            if (value.includes('\n') || value.includes('\r')) {
                const lines = value.split(/\r?\n/);
                // 使用|保留换行符和末尾换行
                const contentIndent = ' '.repeat(indent + 2);
                return `|\n${lines.map(line => `${contentIndent}${line}`).join('\n')}`;
            }

            // 检查是否需要引号
            if (needsQuotes(value)) {
                // 如果字符串包含单引号，使用双引号
                if (value.includes("'")) {
                    return JSON.stringify(value);
                }
                // 默认使用单引号
                return `'${value.replace(/'/g, "''")}'`;
            }

            return value;
        }

        if (typeof value === 'number') {
            // 处理特殊数字
            if (isNaN(value)) return '.nan';
            if (!isFinite(value)) return value > 0 ? '.inf' : '-.inf';
            return String(value);
        }

        if (typeof value === 'boolean') {
            return String(value);
        }

        return String(value);
    };

    if (Array.isArray(obj)) {
        if (obj.length === 0) return '[]';
        return obj.map(item => {
            if (typeof item === 'object' && item !== null) {
                return `${spaces}- ${convertToYAML(item, indent + 2).trimStart()}`;
            }
            return `${spaces}- ${formatValue(item)}`;
        }).join('\n')
    } else if (typeof obj === 'object' && obj !== null) {
        return Object.entries(obj)
            .map(([key, value]) => {
                // 处理键名中的特殊字符
                const formattedKey = needsQuotes(key) ? `'${key.replace(/'/g, "''")}'` : key;

                if (typeof value === 'object' && value !== null) {
                    return `${spaces}${formattedKey}:\n${convertToYAML(value, indent + 2)}`;
                }
                return `${spaces}${formattedKey}: ${formatValue(value)}`;
            })
            .join('\n');
    }
    return formatValue(obj);
};

// JSON 转 TOML
const convertToTOML = (obj: any, prefix: string = '', processedObjects = new WeakSet()): string => {
    // 处理循环引用
    if (typeof obj === 'object' && obj !== null) {
        if (processedObjects.has(obj)) {
            return ''; // 如果对象已经处理过,返回空字符串避免循环引用
        }
        processedObjects.add(obj);
    }

    let result = '';

    // 判断是否为简单数组（只包含基本类型）
    const isSimpleArray = (arr: any[]): boolean => {
        return arr.every(item =>
            typeof item === 'string' ||
            typeof item === 'number' ||
            typeof item === 'boolean' ||
            item === null ||
            (Array.isArray(item) && isSimpleArray(item))
        );
    };

    // 格式化简单数组
    const formatSimpleArray = (arr: any[]): string => {
        return arr
            .filter(item => item !== null) // 过滤掉 null 值
            .map(item => {
                if (typeof item === 'string') return `"${item}"`;
                if (Array.isArray(item)) return `[${formatSimpleArray(item)}]`;
                return String(item);
            })
            .join(', ');
    };

    // 处理基本属性
    const handleBasicProps = (obj: any): string => {
        let props = '';
        for (const [key, value] of Object.entries(obj)) {
            if (value === null || typeof value === 'object') continue;

            if (typeof value === 'string') {
                props += `${key} = "${value}"\n`;
            } else {
                props += `${key} = ${value}\n`;
            }
        }
        return props;
    };

    // 处理对象或数组
    const processObject = (obj: any, currentPrefix: string): string => {
        let output = '';

        // 如果是数组
        if (Array.isArray(obj)) {
            for (const item of obj) {
                if (typeof item === 'object' && item !== null) {
                    // 生成数组表头
                    output += `\n[[${currentPrefix}]]\n`;
                    // 添加基本属性
                    output += handleBasicProps(item);

                    // 处理嵌套属性
                    for (const [key, value] of Object.entries(item)) {
                        if (value === null || typeof value !== 'object') continue;

                        const newPrefix = `${currentPrefix}.${key}`;
                        output += processObject(value, newPrefix);
                    }
                }
            }
        }
        // 如果是对象但不是数组
        else if (typeof obj === 'object' && obj !== null) {
            // 生成对象表头
            if (currentPrefix) {
                output += `[${currentPrefix}]\n`;
            }

            // 添加基本属性
            output += handleBasicProps(obj);

            // 处理嵌套属性
            for (const [key, value] of Object.entries(obj)) {
                if (value === null || typeof value !== 'object') continue;

                const newPrefix = currentPrefix ? `${currentPrefix}.${key}` : key;
                output += processObject(value, newPrefix);
            }
        }

        return output;
    };

    // 主处理逻辑
    for (const [key, value] of Object.entries(obj)) {
        if (value === null) continue;

        const currentPrefix = prefix ? `${prefix}.${key}` : key;

        if (Array.isArray(value)) {
            result += processObject(value, currentPrefix);
        } else if (typeof value === 'object') {
            result += processObject(value, currentPrefix);
        } else {
            if (typeof value === 'string') {
                result += `${key} = "${value}"\n`;
            } else {
                result += `${key} = ${value}\n`;
            }
        }
    }

    return result;
};

// JSON 转 XML
const convertToXML = (obj: any, rootName: string = 'root', processedObjects = new WeakSet()): string => {
    // 处理循环引用
    if (typeof obj === 'object' && obj !== null) {
        if (processedObjects.has(obj)) {
            return ''; // 避免循环引用
        }
        processedObjects.add(obj);
    }

    // 转义XML特殊字符
    const escapeXML = (str: string): string => {
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    };

    // 验证XML标签名（只允许字母、数字、下划线、连字符）
    const sanitizeTagName = (name: string): string => {
        // 如果以数字开头，添加前缀
        if (/^\d/.test(name)) {
            name = 'item' + name;
        }
        // 替换非法字符为下划线
        return name.replace(/[^a-zA-Z0-9_\-]/g, '_');
    };

    // 生成缩进字符串
    const getIndent = (level: number): string => {
        return '  '.repeat(level);
    };

    // 处理值（带缩进）
    const processValue = (value: any, tagName: string, indent: number = 0): string => {
        const indentStr = getIndent(indent);
        const nextIndent = indent + 1;

        if (value === null || value === undefined) {
            return `${indentStr}<${tagName}></${tagName}>`;
        }

        if (typeof value === 'boolean') {
            return `${indentStr}<${tagName}>${value}</${tagName}>`;
        }

        if (typeof value === 'number') {
            return `${indentStr}<${tagName}>${value}</${tagName}>`;
        }

        if (typeof value === 'string') {
            return `${indentStr}<${tagName}>${escapeXML(value)}</${tagName}>`;
        }

        if (Array.isArray(value)) {
            if (value.length === 0) {
                return `${indentStr}<${tagName}></${tagName}>`;
            }

            let result = `${indentStr}<${tagName}>\n`;
            value.forEach((item, index) => {
                const itemTagName = sanitizeTagName(tagName === 'root' ? 'item' : tagName);
                // 如果是对象数组，使用item标签；如果是简单数组，使用原标签名
                const currentTag = (typeof item === 'object' && item !== null)
                    ? (tagName === 'root' ? 'item' : itemTagName)
                    : itemTagName;
                result += processValue(item, currentTag, nextIndent) + '\n';
            });
            result += `${indentStr}</${tagName}>`;
            return result;
        }

        if (typeof value === 'object') {
            let result = `${indentStr}<${tagName}>\n`;
            for (const [key, val] of Object.entries(value)) {
                const sanitizedKey = sanitizeTagName(key);
                result += processValue(val, sanitizedKey, nextIndent) + '\n';
            }
            result += `${indentStr}</${tagName}>`;
            return result;
        }

        return `${indentStr}<${tagName}>${escapeXML(String(value))}</${tagName}>`;
    };

    // 处理根对象
    if (Array.isArray(obj)) {
        // 数组根：使用root标签包裹所有item
        if (obj.length === 0) {
            return `<?xml version="1.0" encoding="UTF-8"?>\n<${rootName}></${rootName}>`;
        }

        let result = `<?xml version="1.0" encoding="UTF-8"?>\n<${rootName}>\n`;
        obj.forEach((item) => {
            const itemTagName = sanitizeTagName('item');
            result += processValue(item, itemTagName, 1) + '\n';
        });
        result += `</${rootName}>`;
        return result;
    }

    // 对象根
    if (typeof obj === 'object' && obj !== null) {
        let result = `<?xml version="1.0" encoding="UTF-8"?>\n<${rootName}>\n`;
        for (const [key, value] of Object.entries(obj)) {
            const sanitizedKey = sanitizeTagName(key);
            result += processValue(value, sanitizedKey, 1) + '\n';
        }
        result += `</${rootName}>`;
        return result;
    }

    // 基本类型
    return `<?xml version="1.0" encoding="UTF-8"?>\n<${rootName}>${escapeXML(String(obj))}</${rootName}>`;
};

// JSON 转 Go 结构体
const convertToGo = (obj: any): string => {
    const processedTypes = new Set<string>();
    let result = '';

    // 转换为驼峰命名并首字母大写
    const toCamelCase = (str: string): string => {
        // 处理已经是驼峰的情况
        if (!/[_-]/.test(str)) {
            return str.charAt(0).toUpperCase() + str.slice(1);
        }
        // 处理下划线或横线分隔的情况
        return str
            .toLowerCase()
            .replace(/[_-]([a-z])/g, (_, letter) => letter.toUpperCase())
            .replace(/^[a-z]/, letter => letter.toUpperCase());
    };

    // 生成结构体名称
    const getStructName = (key: string, parentKey: string = ''): string => {
        return toCamelCase(key);
    };

    // 获取 Go 类型
    const getGoType = (value: any, key: string, parentKey: string = ''): string => {
        if (Array.isArray(value)) {
            if (value.length === 0) return '[]interface{}';
            if (typeof value[0] === 'string') return '[]string';
            if (typeof value[0] === 'number') return Number.isInteger(value[0]) ? '[]int' : '[]float64';
            if (typeof value[0] === 'object' && value[0] !== null) {
                const itemType = getStructName(key);
                return `[]${itemType}`;
            }
            return '[]interface{}';
        }

        if (typeof value === 'object' && value !== null) {
            return getStructName(key, parentKey);
        }

        if (typeof value === 'string') return 'string';
        if (typeof value === 'number') return Number.isInteger(value) ? 'int' : 'float64';
        if (typeof value === 'boolean') return 'bool';
        return 'interface{}';
    };

    // 处理结构体
    const processStruct = (obj: any, structName: string, parentKey: string = ''): string => {
        // 处理数组特殊情况 - 数组本身不需要添加到 processedTypes，直接处理元素
        if (Array.isArray(obj)) {
            if (obj.length > 0 && typeof obj[0] === 'object') {
                // 如果 parentKey 为空（顶层数组），使用默认名称
                const itemType = parentKey ? getStructName(parentKey, parentKey) : structName || 'Item';
                return processStruct(obj[0], itemType, parentKey);
            }
            return '';
        }

        // 对于非数组对象，检查是否已处理过
        if (processedTypes.has(structName)) return '';
        processedTypes.add(structName);

        let structDef = '';

        // 先处理所有嵌套的结构体
        for (const [key, value] of Object.entries(obj)) {
            if (typeof value === 'object' && value !== null) {
                if (Array.isArray(value)) {
                    if (value.length > 0 && typeof value[0] === 'object') {
                        const itemType = getStructName(key);
                        structDef += processStruct(value[0], itemType, key);
                    }
                } else {
                    const subType = getStructName(key);
                    structDef += processStruct(value, subType, key);
                }
            }
        }

        // 然后添加当前结构体的定义
        structDef += `type ${structName} struct {\n`;

        // 使用固定的 4 个空格作为 Go 结构体的缩进
        const indent = '    ';
        for (const [key, value] of Object.entries(obj)) {
            const fieldName = toCamelCase(key);
            const goType = getGoType(value, key, parentKey);
            structDef += `${indent}${fieldName} ${goType} \`json:"${key}"\`\n`;
        }

        structDef += '}\n\n';
        return structDef;
    };

    // 更新预览区域
    outputEditor?.getModel()?.updateOptions({
        tabSize: 4,
        indentSize: 4,
    });

    try {
        // 如果顶层是数组，使用 'Item' 作为默认名称；否则使用 'Root'
        if (Array.isArray(obj)) {
            if (obj.length > 0 && typeof obj[0] === 'object') {
                result = processStruct(obj, 'Item');
            } else {
                result = processStruct(obj, 'Root');
            }
        } else {
            result = processStruct(obj, 'Root');
        }
        return result.trim();
    } catch (error: any) {
        throw new Error('转换 Go 结构体失败: ' + error.message);
    }
};

// Cookie 转 JSON
const cookieToJSON = (cookieStr: string): string => {
    try {
        // 处理常见的 Cookie 格式问题
        const cookies = cookieStr
            .split(/[;\n]/)  // 分割多个 cookie（支持分号或换行分隔）
            .map(pair => pair.trim())
            .filter(pair => pair)  // 过滤空值
            .reduce((acc: Record<string, any>, pair) => {
                // 处理键值对
                const [key, ...values] = pair.split('=');
                const value = values.join('=');  // 处理值中包含等号的情况

                if (key && value) {
                    try {
                        // 尝试解码 URI 编码的值
                        acc[key.trim()] = decodeURIComponent(value.trim());
                    } catch {
                        // 如果解码失败，使用原始值
                        acc[key.trim()] = value.trim();
                    }
                }
                return acc;
            }, {});

        return JSON.stringify(cookies, null, indentSize.value);
    } catch (error: any) {
        throw new Error('Cookie 格式无效: ' + error.message);
    }
};

// 文件上传
const handleFileUpload = async (uploadFile: UploadFile) => {
    const file = uploadFile.raw as File;
    if (!file) {
        showError('无法获取文件');
        return;
    }

    try {
        // 检查文件名长度
        if (file.name.length > 255) {
            showError('文件名过长');
            return;
        }

        // 检查文件扩展名
        if (!file.name.toLowerCase().endsWith('.json')) {
            showError('只能上传 JSON 文件');
            return;
        }

        // 检查文件大小
        if (file.size > MAX_FILE_SIZE) {
            showError('文件大小不能超过 5 MB');
            return;
        }

        // 检查 MIME 类型
        if (file.type && !['application/json', 'text/plain'].includes(file.type)) {
            showError('文件类型不正确');
            return;
        }

        // 读取文件内容
        const content = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                if (e.target?.result) {
                    // 检查文件编码
                    try {
                        const text = e.target.result as string;
                        if (text.includes('\uFFFD')) {
                            reject(new Error('文件编码不是有效的UTF-8'));
                            return;
                        }
                        resolve(text);
                    } catch (error) {
                        reject(new Error('文件编码不正确'));
                    }
                } else {
                    reject(new Error('文件读取失败'));
                }
            };
            reader.onerror = () => reject(new Error('文件读取出错'));
            reader.readAsText(file, 'utf-8');
        });

        // 检查行数限制
        const lines = content.split('\n');
        if (lines.length > MAX_LINES) {
            showError(`文件内容超过行数限制（共 ${lines.length} 行）`);
            return;
        }

        // JSON格式检查和格式化处理
        // 使用与 formatJSON 相同的格式化逻辑
        let preprocessedValue = content;

        // 预处理 JSON 字符串
        let parsed;
        let originalString = preprocessedValue;
        try {
            const result = preprocessJSON(preprocessedValue);
            parsed = result.data;
            // 如果是保持原样模式，使用原始输入字符串以保留Unicode转义等原始格式
            // 否则使用预处理后的字符串
            originalString = encodingMode.value === 0 ? content : result.originalString;
        } catch (error: any) {
            showError('无效的 JSON 格式: ' + (error.message || 'JSON 解析失败'));
            return; // 格式化失败，拒绝上传
        }

        // 检查深度
        const depth = getObjectDepth(parsed);
        if (depth > 99) {
            showError('JSON深度超过99层, 不允许上传');
            return; // 格式化失败，拒绝上传
        }

        // 使用自定义格式化函数格式化JSON，保持原始转义字符
        let formattedJson: string;
        try {
            formattedJson = customStringify(parsed, null, 2, originalString);
        } catch (error: any) {
            showError('格式化失败: ' + (error.message || '未知错误'));
            return; // 格式化失败，拒绝上传
        }

        // 更新编辑器 - 将格式化结果展示到输入区域
        if (inputEditor) {
            inputEditor.setValue(formattedJson);
            updateLineNumberWidth(inputEditor);
            updateEditorHeight(inputEditor);
            // 确保使用2空格缩进
            inputEditor.getModel()?.updateOptions({ tabSize: 2, indentSize: 2, insertSpaces: true });
            // 同时更新编辑器选项
            inputEditor.updateOptions({ tabSize: 2, indentSize: 2 } as any);
        }

        // 清空outputEditor的内容
        outputEditor?.setValue('');
        updateLineNumberWidth(outputEditor);
        updateEditorHeight(outputEditor);

        // 显示成功提示
        showSuccess('文件上传成功，已格式化并加载到输入区域');
    } catch (error: any) {
        showError('文件处理失败: ' + error.message);
    }
};

// 清空输入
const clearInput = () => {
    try {
        // 移除重置缩进空格的代码，保留用户设置
        maxLevel.value = 0;
        selectedLevel.value = 0;

        // 禁用编辑器的语言服务，防止worker错误
        if (inputEditor) {
            const model = inputEditor.getModel();
            if (model) {
                // 先将模型的语言设置为纯文本，避免JSON验证
                monaco.editor.setModelLanguage(model, 'plaintext');

                // 使用 executeEdits 来清空内容，这样可以保留撤销历史
                const fullRange = model.getFullModelRange();
                if (!fullRange.isEmpty()) {
                    inputEditor.executeEdits('clear-input', [{
                        range: fullRange,
                        text: ''
                    }]);
                }

                // 延迟后再设置回JSON语言
                setTimeout(() => {
                    if (model && !model.isDisposed()) {
                        monaco.editor.setModelLanguage(model, 'json');
                    }
                }, 100);
            }
        }

        if (outputEditor) {
            const model = outputEditor.getModel();
            if (model) {
                // 先将模型的语言设置为纯文本
                monaco.editor.setModelLanguage(model, 'plaintext');

                // 使用 executeEdits 来清空内容，这样可以保留撤销历史
                const fullRange = model.getFullModelRange();
                if (!fullRange.isEmpty()) {
                    outputEditor.executeEdits('clear-output', [{
                        range: fullRange,
                        text: ''
                    }]);
                }

                // 延迟后再设置回JSON语言
                setTimeout(() => {
                    if (model && !model.isDisposed()) {
                        monaco.editor.setModelLanguage(model, 'json');
                    }
                }, 100);
            }

            updateEditorHeight(outputEditor);
        }

        // 重置输出类型
        outputType.value = 'json';

        showSuccess('已清空内容');
    } catch (error: any) {
        showError('清空内容失败');
    }
};

// 复制输出
const copyOutput = async () => {
    try {
        const value = outputEditor?.getValue() || '';
        if (!value) {
            showWarning('没有可复制的内容');
            return;
        }

        try {
            await navigator.clipboard.writeText(value);
            showSuccess('复制成功');
        } catch (err) {
            showError('复制失败, 请尝试手动复制');

            // 自动选择内容以方便用户复制
            outputEditor?.focus();
            outputEditor?.getModel()?.getFullModelRange();
            outputEditor?.setSelection(outputEditor.getModel()?.getFullModelRange() || new monaco.Range(0, 0, 0, 0));
        }
    } catch (error: any) {
        showError('复制失败, 请尝试手动复制');
    }
};

// 计算字符串的 SHA-256 哈希值
const calculateHash = async (content: string): Promise<string> => {
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
};

// 下载内容
const downloadOutput = async () => {
    const content = outputEditor?.getValue();
    if (!content) {
        showWarning('没有可下载的内容');
        return;
    }

    try {
        // 计算内容的哈希值，使用前32个字符（128位，冲突概率极低）
        const fullHash = await calculateHash(content);
        const hash = fullHash.substring(0, 32);

        // 根据输出类型决定文件扩展名和 MIME 类型
        const fileExtensionMap: Record<'json' | 'yaml' | 'toml' | 'xml' | 'go', string> = {
            json: '.json',
            yaml: '.yaml',
            toml: '.toml',
            xml: '.xml',
            go: '.go'
        };
        const fileExtension = fileExtensionMap[outputType.value];

        const mimeTypeMap: Record<'json' | 'yaml' | 'toml' | 'xml' | 'go', string> = {
            json: 'application/json',
            yaml: 'text/yaml',
            toml: 'text/plain',
            xml: 'application/xml',
            go: 'text/plain'
        };
        const mimeType = mimeTypeMap[outputType.value];

        // 创建 Blob 对象
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);

        // 创建下载链接
        const link = document.createElement('a');
        link.href = url;
        // 生成文件名：哈希值（32字符）.扩展名
        link.download = `${hash}${fileExtension}`;
        document.body.appendChild(link);
        link.click();

        // 清理
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        showSuccess('下载成功');
    } catch (error: any) {
        showError('下载失败：' + (error?.message || '未知错误'));
    }
};

// 切换全屏状态
const toggleFullscreen = () => {
    isFullscreen.value = !isFullscreen.value
};

// 拖动时也要更新预览区域布局，让滚动条紧贴右边界，但需要恢复滚动内容位置
const updateEditorLayouts = (updateOutputEditor: boolean = true, forceWidth?: { inputWidth?: number; outputWidth?: number }) => {
    if (inputEditor) {
        const container = inputEditor.getContainerDomNode();
        // 输入区域的滚动条需要实时紧贴分割线，所以拖动时也要更新
        const width = forceWidth?.inputWidth ?? container.clientWidth;
        inputEditor.layout({
            width: width,
            height: container.clientHeight
        });
    }
    if (outputEditor && updateOutputEditor) {
        const container = outputEditor.getContainerDomNode();
        // 预览区域的滚动条应该始终紧贴右边，拖动时也要更新让滚动条紧贴右边界
        const width = forceWidth?.outputWidth ?? container.clientWidth;
        outputEditor.layout({
            width: width,
            height: container.clientHeight
        });
    }
};

// 获取事件中的 clientX（统一处理不同事件类型）
const getClientX = (e: MouseEvent | TouchEvent | PointerEvent): number | null => {
    if ('touches' in e && e.touches.length > 0) {
        return e.touches[0].clientX;
    } else if ('clientX' in e) {
        return e.clientX;
    }
    return null;
};

// 处理指针移动（提升到外层作用域，避免每次拖动创建新函数）
const handlePointerMove = (moveEvent: MouseEvent | TouchEvent | PointerEvent) => {
    if (!isResizing.value || !resizeState) return;

    const clientX = getClientX(moveEvent);
    if (clientX === null || !resizeState.rect) return;

    // 实时更新容器尺寸（来回拖动时容器可能变化）
    if (resizeState.container) {
        const currentRect = resizeState.container.getBoundingClientRect();
        resizeState.rect = currentRect;
        resizeState.minWidthPercent = (resizeState.minWidthPx / currentRect.width) * 100;
        resizeState.maxWidthPercent = 100 - resizeState.minWidthPercent;
    }

    // 立即计算新宽度（不使用 rAF 节流，确保极快拖动时也能实时响应）
    const clampedX = Math.max(
        resizeState.rect.left + resizeState.minWidthPx,
        Math.min(clientX, resizeState.rect.right - resizeState.minWidthPx)
    );

    // 计算新的百分比宽度
    const deltaX = clampedX - resizeState.initialX;
    const deltaPercentage = (deltaX / resizeState.rect.width) * 100;
    const newWidth = Math.min(
        Math.max(resizeState.initialPercentage + deltaPercentage, resizeState.minWidthPercent),
        resizeState.maxWidthPercent
    );

    // 立即更新宽度值（不检查阈值，确保每次移动都响应）
    leftPanelWidth.value = newWidth;

    // 触发防抖更新稳定宽度值
    updateStableWidth();

    // 这样可以确保 Monaco Editor 接收到准确的宽度，从而正确计算滚动条位置
    const containerWidth = resizeState.rect.width;
    const resizerWidth = 24; // 分割线宽度（固定值）
    const availableWidth = containerWidth - resizerWidth;

    // 计算面板的实际宽度（考虑分割线）
    const inputWidth = Math.round((newWidth / 100) * availableWidth);
    const outputWidth = Math.round(((100 - newWidth) / 100) * availableWidth);

    // 使用计算出的宽度强制更新布局，确保滚动条实时紧贴边界
    updateEditorLayouts(true, { inputWidth, outputWidth });
};

// 停止拖动（提升到外层作用域）
const stopResize = (upEvent?: Event) => {
    if (!isResizing.value) return;

    isResizing.value = false;
    document.body.style.userSelect = '';
    document.body.style.cursor = '';

    // 恢复 CSS transition（拖动结束后恢复平滑动画）
    if (resizeState && resizeState.container) {
        const panels = resizeState.container.querySelectorAll('.editor-panel');
        panels.forEach((panel: Element) => {
            (panel as HTMLElement).style.transition = '';
        });
    }

    // 清除防抖定时器，立即同步稳定宽度值
    if (stableWidthUpdateTimer) {
        clearTimeout(stableWidthUpdateTimer);
        stableWidthUpdateTimer = null;
    }
    stableLeftPanelWidth.value = leftPanelWidth.value;

    // 释放指针捕获
    if (upEvent instanceof PointerEvent && upEvent.target instanceof HTMLElement) {
        try {
            upEvent.target.releasePointerCapture(upEvent.pointerId);
        } catch (err) {
            // 忽略错误
        }
    }

    // 移除事件监听（只使用 pointer 事件，现代浏览器已足够）
    document.removeEventListener('pointermove', handlePointerMove as EventListener);
    document.removeEventListener('pointerup', stopResize as EventListener);

    // 保存滚动位置（在布局更新前保存，因为布局更新可能会改变滚动位置）
    const savedScrollLeft = resizeState?.outputScrollLeft || 0;
    const savedScrollTop = resizeState?.outputScrollTop || 0;

    // 立即执行一次布局更新，确保最终状态正确（不再执行1000次！）
    // 拖动结束后，同时更新两个编辑器的布局，确保最终状态正确
    nextTick(() => {
        updateEditorLayouts(true);

        // 布局更新后，恢复之前保存的滚动位置（确保预览区域的滚动条位置不变）
        if (outputEditor) {
            // 使用 requestAnimationFrame 确保在布局完全更新后再恢复滚动位置
            requestAnimationFrame(() => {
                if (outputEditor) {
                    // 通过 Monaco Editor 的滚动容器 DOM 元素恢复滚动位置
                    const scrollableElement = outputEditor.getContainerDomNode().querySelector('.monaco-scrollable-element') as HTMLElement;
                    if (scrollableElement) {
                        // 总是恢复滚动位置，即使为 0 也可能是有效的顶部位置
                        scrollableElement.scrollLeft = savedScrollLeft;
                        scrollableElement.scrollTop = savedScrollTop;
                    }
                }
            });
        }
    });

    // 清理状态
    resizeState = null;
};

// 分割线拖动实现（优化版）
const startResize = (e: MouseEvent | TouchEvent | PointerEvent) => {
    // 初始化容器引用（如果还没有）
    if (!editorContainer) {
        editorContainer = document.querySelector('.editor-container') as HTMLElement;
    }
    if (!editorContainer) return;

    isResizing.value = true;

    // 清除之前的防抖定时器，立即同步稳定宽度值
    if (stableWidthUpdateTimer) {
        clearTimeout(stableWidthUpdateTimer);
        stableWidthUpdateTimer = null;
    }
    stableLeftPanelWidth.value = leftPanelWidth.value;

    // 禁用选择和默认事件
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';

    // 禁用 CSS transition，避免拖动时的动画延迟（确保实时响应）
    const panels = editorContainer.querySelectorAll('.editor-panel');
    panels.forEach((panel: Element) => {
        (panel as HTMLElement).style.transition = 'none';
    });

    // 获取初始位置
    const initialX = getClientX(e);
    if (initialX === null) return;

    // 捕获指针（如果是指针事件）
    if (e instanceof PointerEvent && e.target instanceof HTMLElement) {
        try {
            e.target.setPointerCapture(e.pointerId);
        } catch (err) {
            // 忽略错误
        }
    }

    // 获取容器尺寸
    const rect = editorContainer.getBoundingClientRect();
    editorContainerWidth.value = rect.width;

    // 计算最小/最大宽度限制
    const minWidthPx = 150; // 最小宽度（像素）
    const minWidthPercent = (minWidthPx / rect.width) * 100;
    const maxWidthPercent = 100 - minWidthPercent;

    // 获取预览区域容器并保存初始状态（用于恢复滚动内容位置）
    const outputPanel = editorContainer.querySelector('.output-panel') as HTMLElement;
    let outputScrollLeft = 0;
    let outputScrollTop = 0;

    if (outputPanel && outputEditor) {
        const scrollableElement = outputEditor.getContainerDomNode().querySelector('.monaco-scrollable-element') as HTMLElement;
        if (scrollableElement) {
            outputScrollLeft = scrollableElement.scrollLeft;
            outputScrollTop = scrollableElement.scrollTop;
        }
    }

    // 保存拖动状态
    resizeState = {
        initialX,
        initialPercentage: leftPanelWidth.value,
        container: editorContainer,
        rect: rect,
        minWidthPercent,
        maxWidthPercent,
        minWidthPx,
        // 预览区域滚动位置（用于在拖动过程中保持滚动内容位置不变）
        outputScrollLeft,
        outputScrollTop,
    };

    // 添加事件监听（只使用 pointer 事件，已覆盖鼠标和触摸）
    document.addEventListener('pointermove', handlePointerMove as EventListener, { passive: true });
    document.addEventListener('pointerup', stopResize as EventListener);

    // 阻止默认行为
    if (e instanceof MouseEvent || e instanceof PointerEvent) {
        e.preventDefault();
    }
};

// 添加将预览区域内容转移到输入区域的方法
const transferToInput = (e: MouseEvent) => {
    // 阻止事件冒泡，防止触发分割线的拖动
    e.stopPropagation();
    if (outputType.value !== 'json') {
        showWarning('当前内容类型不支持转移到输入区域');
        return;
    }

    try {
        const outputContent = outputEditor?.getValue() || '';
        if (!outputContent.trim()) {
            showWarning('预览区域内容为空, 无需转移');
            return;
        }

        // 解析 JSON 数据并重新格式化为2个空格缩进
        let formattedContent: string;
        try {
            // 先预处理 JSON（处理注释、尾逗号等）
            const preprocessed = preprocessJSON(outputContent);
            // 重新格式化为2个空格缩进
            formattedContent = customStringify(preprocessed.data, null, 2, preprocessed.originalString);
        } catch (parseError) {
            // 如果解析失败，尝试直接使用 JSON.stringify 格式化
            try {
                const parsed = JSON.parse(outputContent);
                formattedContent = JSON.stringify(parsed, null, 2);
            } catch (jsonError) {
                // 如果还是失败，使用原始内容（可能是无效 JSON）
                formattedContent = outputContent;
            }
        }

        // 转移内容到输入区域
        if (inputEditor) {
            const inputModel = inputEditor.getModel();
            if (inputModel) {
                const fullRange = inputModel.getFullModelRange();
                inputEditor.pushUndoStop();
                inputEditor.executeEdits('transfer-to-input', [
                    {
                        range: fullRange,
                        text: formattedContent
                    }
                ]);
                inputEditor.pushUndoStop();
                updateLineNumberWidth(inputEditor);
                updateEditorHeight(inputEditor);

                // 确保输入编辑器使用2空格缩进
                inputModel.updateOptions({ tabSize: 2, indentSize: 2, insertSpaces: true });
                // 同时更新编辑器选项
                inputEditor.updateOptions({ tabSize: 2, indentSize: 2 } as any);
            }
        }

        // 清空预览区域
        if (outputEditor) {
            outputEditor.setValue('');
            updateLineNumberWidth(outputEditor);
            updateEditorHeight(outputEditor);
        }

        showSuccess('内容已成功转移到输入区域');
    } catch (error: any) {
        showError('转移内容失败: ' + error.message);
    }
};
</script>

<style scoped>
/* 折叠信息文本样式 */
:deep(.folding-info-text) {
    color: #909399;
}

.json-tool-container {
    padding: 5px;
    display: flex;
    flex-direction: column;
    height: calc(100vh - 165px);
    overflow: hidden;
}

/* 添加小屏幕提示样式 */
.screen-size-warning {
    display: none;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: #f5f7fa;
    z-index: 2000;
    padding: 20px;
    text-align: center;
    align-items: center;
    justify-content: center;
    flex-direction: column;
}

.warning-icon {
    font-size: 48px;
    color: #E6A23C;
    margin-bottom: 20px;
}

.warning-text {
    font-size: 16px;
    color: #606266;
    line-height: 1.6;
    max-width: 80%;
    margin: 0 auto;
}

@media screen and (max-width: 900px) {
    .json-tool-container {
        display: none;
    }

    .screen-size-warning {
        display: flex;
    }
}

/* 全屏样式 */
.json-tool-container.fullscreen {
    position: fixed;
    top: 0;
    bottom: 0;
    z-index: 1500;
    width: calc(100% - 10px);
    height: calc(100% - 10px);
    background-color: #f0f2f5;
    box-shadow: 0 0 20px rgba(0, 0, 0, 0.1);
    animation: fullscreenEnter 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

/* 添加进入全屏的动画 */
@keyframes fullscreenEnter {
    from {
        opacity: 0.8;
        transform: scale(0.98);
    }

    to {
        opacity: 1;
        transform: scale(1);
    }
}

/* 添加退出全屏的动画 */
.json-tool-container:not(.fullscreen) {
    animation: fullscreenExit 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

@keyframes fullscreenExit {
    from {
        opacity: 0.8;
        transform: scale(1.02);
    }

    to {
        opacity: 1;
        transform: scale(1);
    }
}

/* 工具栏包装器 */
.tool-bar-wrapper {
    position: relative;
    margin-bottom: 4px;
    display: flex;
    align-items: center;
    min-height: 48px;
}

.tool-bar {
    padding: 8px 16px 6px 16px;
    display: flex;
    align-items: center;
    gap: 0;
    flex-wrap: nowrap;
    flex-shrink: 0;
    overflow-x: auto;
    overflow-y: hidden;
    background-color: #ffffff;
    border-radius: 6px;
    box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.03);
    border: 1px solid #ebeef5;
    position: relative;
    flex: 1;
    scroll-behavior: smooth;
    -webkit-overflow-scrolling: touch; /* iOS 平滑滚动 */
    scrollbar-width: thin; /* Firefox 细滚动条 */
}

/* 工具栏滚动条样式优化 */
.tool-bar::-webkit-scrollbar {
    height: 6px;
}

.tool-bar::-webkit-scrollbar-track {
    background: #f5f5f5;
    border-radius: 3px;
}

.tool-bar::-webkit-scrollbar-thumb {
    background: #c0c4cc;
    border-radius: 3px;
}

.tool-bar::-webkit-scrollbar-thumb:hover {
    background: #a0a4a8;
}

/* 滚动指示器 */
.scroll-indicator {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    z-index: 10;
    display: flex;
    align-items: center;
    pointer-events: none;
    height: 100%;
}

.scroll-indicator-left {
    left: 0;
    padding-left: 4px;
}

.scroll-indicator-right {
    right: 0;
    padding-right: 4px;
}

/* 滚动按钮 */
.scroll-btn {
    pointer-events: auto;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    transition: all 0.2s ease;
    z-index: 11;
    position: relative;
}

.scroll-btn:hover {
    transform: scale(1.1);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
}

.scroll-btn:active {
    transform: scale(0.95);
}

/* 渐变遮罩 */
.gradient-mask {
    width: 50px;
    height: 100%;
    pointer-events: none;
    position: absolute;
    top: 0;
    z-index: 9;
}

.gradient-mask-left {
    left: 0;
    background: linear-gradient(to right, rgba(255, 255, 255, 1) 0%, rgba(255, 255, 255, 0.85) 40%, rgba(255, 255, 255, 0) 100%);
}

.gradient-mask-right {
    right: 0;
    background: linear-gradient(to left, rgba(255, 255, 255, 1) 0%, rgba(255, 255, 255, 0.85) 40%, rgba(255, 255, 255, 0) 100%);
}

/* 按钮组之间紧挨着，但单个按钮和按钮组之间要有间距 */
.tool-bar>.el-button,
.tool-bar>.el-button-group,
.tool-bar>.el-dropdown,
.tool-bar>.collapse-control {
    margin-left: 10px;
    flex-shrink: 0;
    white-space: nowrap;
}

.tool-bar>.el-button:first-child,
.tool-bar>.el-button-group:first-child,
.tool-bar>.el-dropdown:first-child,
.tool-bar>.collapse-control:first-child {
    margin-left: 0;
}


/* 层级控制优化 */
.collapse-control {
    display: flex;
    align-items: center;
    gap: 6px;
}

.collapse-control .level-select {
    width: 90px;
}


/* 响应式：小屏幕时调整布局 */
@media screen and (max-width: 1200px) {

    .tool-bar>.el-button,
    .tool-bar>.el-button-group,
    .tool-bar>.el-dropdown,
    .tool-bar>.collapse-control {
        margin-left: 8px;
    }
}

/* 全屏按钮自定义为黄色 */
.fullscreen-btn {
    background-color: #eab308 !important;
    border-color: #eab308 !important;
    color: #fff !important;
}

.fullscreen-btn:hover {
    background-color: #ca8a04 !important;
    border-color: #ca8a04 !important;
}

.fullscreen-btn:active {
    background-color: #a16207 !important;
    border-color: #a16207 !important;
}

.editor-container {
    display: flex;
    flex: 1;
    min-height: 0;
    overflow: hidden;
    position: relative;
    padding: 0;
}

.editor-panel {
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
    transition: width 0.1s ease;
    box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.05);
    margin: 0;
    min-width: 150px;
    /* 减小最小宽度，因为按钮可以隐藏 */
    position: relative;
    /* 添加相对定位 */
}

/* 左侧面板样式 - 只有左侧圆角 */
.editor-panel:first-child {
    border-top-left-radius: 6px;
    border-bottom-left-radius: 6px;
}

/* 右侧面板样式 - 只有右侧圆角 */
.editor-panel:last-child {
    border-top-right-radius: 6px;
    border-bottom-right-radius: 6px;
}

/* 左侧面板头部 - 只有左上角圆角（右边是分割线） */
.editor-panel:first-child .panel-header {
    border-top-left-radius: 6px;
    border-top-right-radius: 0;
}

/* 右侧面板头部 - 只有右上角圆角 */
.editor-panel:last-child .panel-header {
    border-top-left-radius: 0;
    border-top-right-radius: 6px;
}

/* 编辑器容器圆角调整 - 移除底部圆角，让状态栏处理底部圆角 */
.editor-panel:first-child .monaco-editor-container {
    border-bottom-left-radius: 0;
    border-bottom-right-radius: 0;
}

.editor-panel:last-child .monaco-editor-container {
    border-bottom-left-radius: 0;
    border-bottom-right-radius: 0;
}

/* 添加分隔线样式 */
.resizer {
    width: 24px;
    background-color: #eef0f6;
    cursor: col-resize;
    position: relative;
    z-index: 10;
    transition: background-color 0.2s;
    border-left: 1px solid #e4e7ed;
    border-right: 1px solid #e4e7ed;
    display: flex;
    align-items: center;
    justify-content: center;
}

.resizer:hover,
.resizer:active {
    background-color: #e6e9f0;
}

.resizer::after {
    content: "";
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 4px;
    height: 40px;
    background-color: #c0c4cc;
    border-radius: 2px;
}

.panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-shrink: 0;
    padding: 10px 15px;
    background: linear-gradient(to bottom, #fafbfc, #f6f8fa);
    border-bottom: 1px solid #e4e7ed;
    border-top-left-radius: 6px;
    border-top-right-radius: 6px;
    /* 确保头部布局变化是瞬时的，无过渡动画，避免拖动时标题换行 */
    transition: none !important;
}

.panel-title {
    display: flex;
    align-items: center;
    font-size: 15px;
    font-weight: 600;
    color: #303133;
    /* 防止标题换行，当宽度不足时按钮会立即隐藏 */
    white-space: nowrap;
    flex-shrink: 0;
}

.panel-title i {
    margin-right: 6px;
    color: #409EFF;
}

.panel-actions {
    display: flex;
    gap: 12px;
    /* 确保按钮显示/隐藏是瞬时的，无过渡动画，避免拖动时标题换行 */
    transition: none !important;
}

/* 确保按钮元素本身也没有过渡效果（包括 Element Plus 的过渡） */
.panel-actions :deep(.el-button) {
    transition: none !important;
    animation: none !important;
}

/* 确保按钮的图标和文字也没有过渡效果 */
.panel-actions :deep(.el-button *),
.panel-actions :deep(.el-button span) {
    transition: none !important;
}

.panel-actions :deep(.el-button + .el-button) {
    margin-left: 0 !important;
}

.editor-wrapper {
    flex: 1;
    min-height: 400px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

.monaco-editor-container {
    flex: 1;
    min-height: 0;
    background-color: white;
    border: 1px solid #e4e7ed;
    border-top: none;
    border-bottom: none;
    overflow: hidden;
    display: flex;
    flex-direction: column;
}

.monaco-editor-instance {
    flex: 1;
    min-height: 0;
    position: relative;
}

/* 编辑器状态栏样式 */
.editor-status-bar {
    height: 22px;
    background: linear-gradient(to bottom, #fafbfc, #f5f7fa);
    border: 1px solid #e4e7ed;
    border-top: none;
    border-bottom-left-radius: 0;
    border-bottom-right-radius: 0;
    display: flex;
    align-items: center;
    padding: 0 10px;
    flex-shrink: 0;
    font-size: 12px;
    color: #606266;
    box-shadow: 0 -1px 2px rgba(0, 0, 0, 0.02);
}

/* 左侧面板状态栏 - 只有左下角圆角 */
.editor-panel:first-child .editor-status-bar {
    border-bottom-left-radius: 6px;
    border-bottom-right-radius: 0;
}

/* 右侧面板状态栏 - 只有右下角圆角 */
.editor-panel:last-child .editor-status-bar {
    border-bottom-left-radius: 0;
    border-bottom-right-radius: 6px;
}

.editor-status-bar .status-text {
    user-select: none;
    white-space: nowrap;
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', 'source-code-pro', monospace;
}

/* 确保Monaco编辑器内部元素也有正确的背景色 */
:deep(.monaco-editor .monaco-editor-background) {
    background-color: white;
}

:deep(.monaco-editor .margin) {
    background-color: white;
}

:deep(.errorLine) {
    background: #ff000020;
    border-left: 3px solid #ff0000;
}

:deep(.errorGlyph) {
    background: #ff0000;
    width: 4px !important;
    margin-left: 3px;
}

:deep(.monaco-editor .margin) {
    background-color: #f5f7fa;
}

/* 调整光标样式 */
:deep(.monaco-editor .cursor) {
    height: 16px !important;
    margin-top: 2px;
}

:deep(.monaco-editor .indent-guide) {
    box-shadow: 1px 0 0 0 rgba(0, 0, 0, 0.1) inset;
}

:deep(.monaco-editor .indent-guide.active) {
    box-shadow: 1px 0 0 0 rgba(0, 0, 0, 0.2) inset;
}

:deep(.monaco-editor .bracket-highlighting-0) {
    border: none !important;
    color: inherit !important;
}

:deep(.monaco-editor .bracket-highlighting-1) {
    border: none !important;
    color: inherit !important;
}

:deep(.monaco-editor .bracket-highlighting-2) {
    border: none !important;
    color: inherit !important;
}

:deep(.monaco-editor .bracket-match) {
    border: none !important;
    background: transparent !important;
}

.collapse-control {
    display: flex;
    gap: 8px;
    align-items: center;
}

:deep(.el-switch) {
    margin-left: auto;
}

:deep(.el-switch__label) {
    font-size: 14px;
}

/* 确保 Element Plus 的弹出层在全屏模式下正常显示 */
:deep(.el-popper) {
    z-index: 2000 !important;
}

:deep(.el-overlay) {
    z-index: 1800 !important;
}

:deep(.level-select) {
    width: 65px;
}

:deep(.level-select .el-input__wrapper) {
    height: 32px;
}

:deep(.level-select .el-input__inner) {
    height: 32px;
    line-height: 32px;
}

.editor-loading {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background-color: white;
    z-index: 1;
}

.loading-icon {
    font-size: 24px;
    margin-bottom: 8px;
    animation: rotate 1.5s linear infinite;
}

@keyframes rotate {
    from {
        transform: rotate(0deg);
    }

    to {
        transform: rotate(360deg);
    }
}

.monaco-editor-instance {
    width: 100%;
    height: 100%;
    position: relative;
    /* 添加相对定位 */
}

:deep(.el-dropdown-menu__item) {
    padding: 5px 12px;
}

.transfer-button {
    position: absolute;
    top: 10px;
    left: 50%;
    transform: translate(-50%, 0);
    background-color: #ffffff;
    border-radius: 3px;
    cursor: pointer;
    z-index: 20;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);
}

.transfer-button:hover {
    background-color: #f5f7fa;
    border-color: #bbb;
}

.transfer-button .el-icon {
    font-size: 16px;
    color: #409EFF;
}

/* 调整单选按钮的大小和样式 */
:deep(.el-radio__inner) {
    width: 18px !important;
    height: 18px !important;
}

:deep(.el-radio__inner::after) {
    width: 8px !important;
    height: 8px !important;
    transform: translate(-50%, -50%) scale(0) !important;
}

:deep(.el-radio__input.is-checked .el-radio__inner::after) {
    transform: translate(-50%, -50%) scale(1) !important;
}

/* 修复 Monaco Editor 查找/替换功能的可访问性问题 */
:deep(.monaco-editor .editor-widget) {
    &[aria-hidden="true"] {
        visibility: hidden !important;
        height: 0 !important;
        overflow: hidden !important;
        opacity: 0 !important;
    }

    &[aria-hidden="false"] {
        visibility: visible !important;
        opacity: 1 !important;
    }
}

.dialog-footer {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
}

.dialog-footer .el-button:first-child {
    margin-left: 20px;
}

:deep(.el-dialog__header) {
    padding: 16px 20px 12px;
    border-bottom: 1px solid #e4e7ed;
}

:deep(.el-dialog__title) {
    font-size: 16px;
    font-weight: 500;
    color: #303133;
}

:deep(.el-dialog__body) {
    padding: 20px;
}

:deep(.el-dialog__footer) {
    padding: 12px 20px 16px;
    border-top: 1px solid #e4e7ed;
}



:deep(.el-card__body) {
    padding: 16px 20px;
}

:deep(.el-divider) {
    margin: 12px 0;
}

:deep(.el-divider--horizontal) {
    border-top-color: #e4e7ed;
}

:deep(.el-tag) {
    border-radius: 4px;
}

:deep(.el-scrollbar__bar) {
    opacity: 0.6;
}

/* 设置对话框样式 */
.settings-dialog-wrapper :deep(.el-dialog) {
    max-height: calc(100vh - 12vh);
    display: flex;
    flex-direction: column;
    margin-top: 0 !important;
    margin-bottom: 0 !important;
}

.settings-dialog-content {
    padding: 0;
}

/* 手风琴样式 */
.settings-dialog-content :deep(.el-collapse) {
    border: none;
}

.settings-dialog-content :deep(.el-collapse-item) {
    border: 1px solid #e4e7ed;
    border-radius: 4px;
    margin-bottom: 8px;
}

.settings-dialog-content :deep(.el-collapse-item:last-child) {
    margin-bottom: 0;
}

.settings-dialog-content :deep(.el-collapse-item__header) {
    padding: 12px 16px;
    background-color: #f5f7fa;
    border-radius: 4px;
    font-size: 15px;
    font-weight: 600;
    color: #303133;
    height: auto;
    line-height: 1.4;
}

.settings-dialog-content :deep(.el-collapse-item__header:hover) {
    background-color: #ecf5ff;
}

.settings-dialog-content :deep(.el-collapse-item__header.is-active) {
    background-color: #ecf5ff;
    border-bottom: 1px solid #e4e7ed;
    border-radius: 4px 4px 0 0;
}

.settings-dialog-content :deep(.el-collapse-item__wrap) {
    border: none;
}

.settings-dialog-content :deep(.el-collapse-item__content) {
    padding: 0;
    border-radius: 0 0 4px 4px;
}

.settings-collapse-title {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
}

.settings-collapse-content {
    padding: 16px;
}

.column-title-icon {
    font-size: 18px;
    color: #409eff;
}

.settings-item {
    margin-bottom: 16px;
}

.settings-item:last-child {
    margin-bottom: 0;
}

.settings-item-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 10px;
}

.settings-icon {
    font-size: 16px;
    color: #409eff;
}

.settings-label {
    font-size: 14px;
    font-weight: 500;
    color: #303133;
}

.settings-radio-group {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
}

.settings-radio-group :deep(.el-radio) {
    margin-right: 0;
    margin-bottom: 0;
}

.settings-radio-group :deep(.el-radio.is-bordered) {
    padding: 6px 12px;
    border-radius: 4px;
}

/* 缩小设置弹窗中单选按钮的圆圈大小 */
.settings-radio-group :deep(.el-radio__inner) {
    width: 14px !important;
    height: 14px !important;
}

.settings-radio-group :deep(.el-radio__inner::after) {
    width: 6px !important;
    height: 6px !important;
}

.settings-item :deep(.el-switch) {
    margin-top: 4px;
}

.font-size-control {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
}

.font-size-control :deep(.el-slider) {
    flex: 1;
}

.font-size-value {
    min-width: 45px;
    text-align: right;
    font-size: 14px;
    color: var(--el-text-color-regular);
}


.settings-subsection {
    margin-bottom: 16px;
}

.settings-subsection:last-child {
    margin-bottom: 0;
}

.settings-subsection-title {
    font-size: 14px;
    font-weight: 600;
    color: #606266;
    margin-bottom: 12px;
}

.settings-subsection-divider {
    margin: 12px 0;
}

.button-visibility-list {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    grid-auto-rows: min-content;
    gap: 6px 24px;
    align-items: start;
}

@media (max-width: 900px) {
    .button-visibility-list {
        grid-template-columns: repeat(2, 1fr);
    }
}

.button-visibility-item {
    display: flex;
    align-items: center;
}

.button-visibility-item :deep(.el-checkbox) {
    width: 100%;
}

.button-visibility-item :deep(.el-checkbox__label) {
    font-size: 14px;
    color: #606266;
}

/* 响应式设计 */
@media (max-width: 768px) {
    .settings-dialog-wrapper {
        width: 95vw;
        max-width: none;
    }

    .button-visibility-list {
        grid-template-columns: 1fr;
    }

    .settings-radio-group {
        flex-direction: column;
        gap: 8px;
    }

    .settings-radio-group :deep(.el-radio) {
        width: 100%;
        margin-right: 0;
    }
}
</style>