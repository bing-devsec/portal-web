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
            <div class="tool-bar">
                <!-- 格式化配置下拉菜单 -->
                <el-dropdown :visible="true">
                    <el-button type="info">
                        <el-icon class="setting-icon">
                            <Setting />
                        </el-icon>
                    </el-button>
                    <template #dropdown>
                        <el-dropdown-menu>
                            <el-dropdown-item class="config-item">
                                <div class="config-row">
                                    <span class="config-label">缩进空格：</span>
                                    <div class="vertical-radio-group indent-radio-group">
                                        <el-radio-group v-model="indentSize" size="small">
                                            <div class="vertical-radio-item">
                                                <el-radio :value="2"></el-radio>
                                                <div class="radio-text">2</div>
                                            </div>
                                            <div class="vertical-radio-item">
                                                <el-radio :value="4"></el-radio>
                                                <div class="radio-text">4</div>
                                            </div>
                                            <div class="vertical-radio-item">
                                                <el-radio :value="8"></el-radio>
                                                <div class="radio-text">8</div>
                                            </div>
                                        </el-radio-group>
                                    </div>
                                </div>
                            </el-dropdown-item>
                            <el-dropdown-item class="config-item">
                                <div class="config-row">
                                    <span class="config-label">编码模式：</span>
                                    <div class="vertical-radio-group encoding-radio-group">
                                        <el-radio-group v-model="encodingMode" size="small">
                                            <div class="vertical-radio-item">
                                                <el-radio :value="0"></el-radio>
                                                <div class="radio-text">保持原样</div>
                                            </div>
                                            <div class="vertical-radio-item">
                                                <el-radio :value="1"></el-radio>
                                                <div class="radio-text">转中文</div>
                                            </div>
                                            <div class="vertical-radio-item">
                                                <el-radio :value="2"></el-radio>
                                                <div class="radio-text">转Unicode</div>
                                            </div>
                                        </el-radio-group>
                                    </div>
                                </div>
                            </el-dropdown-item>
                            <el-dropdown-item class="config-item">
                                <div class="config-row">
                                    <span class="config-label">数组样式：</span>
                                    <el-switch v-model="arrayNewLine" active-text="换行" inactive-text="紧凑" size="small"
                                        class="config-control" />
                                </div>
                            </el-dropdown-item>
                            <el-dropdown-item class="config-item">
                                <div class="config-row">
                                    <span class="config-label">缩进指南：</span>
                                    <el-switch v-model="showIndentGuide" active-text="显示" inactive-text="隐藏"
                                        size="small" class="config-control" @change="updateIndentGuides" />
                                </div>
                            </el-dropdown-item>
                        </el-dropdown-menu>
                    </template>
                </el-dropdown>

                <!-- 主要功能按钮组 -->
                <el-button-group>
                    <el-button type="primary" @click="formatJSON">格式化</el-button>
                    <el-button type="primary" @click="compressJSON">压缩</el-button>
                    <el-button type="primary" @click="escapeJSON">转义</el-button>
                    <el-button type="primary" @click="unescapeJSON">去除转义</el-button>
                    <el-button type="primary" @click="compressAndEscapeJSON">压缩并转义</el-button>
                    <el-button type="primary" @click="countKeys">统计</el-button>
                </el-button-group>

                <!-- 新增层级控制 -->
                <div class="collapse-control">
                    <el-select v-model="selectedLevel" placeholder="选择层级" class="level-select"
                        :disabled="maxLevel === 0">
                        <el-option v-for="n in (maxLevel || 1)" :key="n" :label="`第 ${n} 层`" :value="n"
                            :disabled="maxLevel === 0" />
                    </el-select>
                    <el-button type="primary" @click="handleLevelAction" :disabled="maxLevel === 0">
                        收缩
                    </el-button>
                </div>

                <!-- 转换功能下拉菜单 -->
                <el-dropdown @command="handleConvert">
                    <el-button type="success">
                        格式转换<i class="el-icon-arrow-down el-icon--right"></i>
                    </el-button>
                    <template #dropdown>
                        <el-dropdown-menu>
                            <el-dropdown-item command="yaml">JSON 转 YAML</el-dropdown-item>
                            <el-dropdown-item command="toml">JSON 转 TOML</el-dropdown-item>
                            <el-dropdown-item command="go">JSON 转 Go 结构体</el-dropdown-item>
                            <el-dropdown-item command="cookie">Cookie 转 JSON</el-dropdown-item>
                        </el-dropdown-menu>
                    </template>
                </el-dropdown>

                <el-button type="warning" @click="toggleFullscreen">
                    {{ isFullscreen ? '退出全屏' : '全屏' }}
                </el-button>
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
                    <div class="monaco-editor-container">
                        <div v-if="!editorsInitialized" class="editor-loading">
                            <el-icon class="loading-icon">
                                <Loading />
                            </el-icon>
                            <span>加载编辑器中...</span>
                        </div>
                        <div ref="inputEditorContainer" class="monaco-editor-instance"></div>
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
                    <div class="monaco-editor-container">
                        <div v-if="!editorsInitialized" class="editor-loading">
                            <el-icon class="loading-icon">
                                <Loading />
                            </el-icon>
                            <span>加载编辑器中...</span>
                        </div>
                        <div ref="outputEditorContainer" class="monaco-editor-instance"></div>
                    </div>
                </div>
            </div>
        </div>

        <!-- 路径输入对话框 -->
        <el-dialog
            v-model="pathDialogVisible"
            title="统计元素个数"
            width="600px"
            :close-on-click-modal="false"
            @close="handlePathDialogClose"
        >
            <div class="path-input-dialog">
                <div class="dialog-description">
                    <p>请输入要统计的 key 路径（留空则统计根对象）</p>
                    <p class="tip-text">支持数组索引语法，如: settings[0].values</p>
                </div>
                <el-autocomplete
                    v-model="pathInputValue"
                    :fetch-suggestions="queryPathSuggestions"
                    placeholder="例如: settings 或 settings[0].values"
                    class="path-autocomplete"
                    clearable
                    @select="handlePathSelect"
                    @input="handlePathInput"
                >
                    <template #default="{ item }">
                        <div class="suggestion-item">
                            <span class="suggestion-value">{{ item.value }}</span>
                            <span class="suggestion-type" v-if="item.type">{{ item.type }}</span>
                        </div>
                    </template>
                </el-autocomplete>
                <div v-if="suggestionsHint" class="suggestions-hint">
                    {{ suggestionsHint }}
                </div>
            </div>
            <template #footer>
                <span class="dialog-footer">
                    <el-button @click="handlePathDialogCancel">取消</el-button>
                    <el-button type="primary" @click="handlePathDialogConfirm">统计</el-button>
                </span>
            </template>
        </el-dialog>

        <!-- 统计结果对话框-->
        <el-dialog
            v-model="statisticsDialogVisible"
            title="统计结果"
            width="600px"
            :close-on-click-modal="false"
            align-center
            class="statistics-dialog"
        >
            <div class="statistics-result-dialog">
                <!-- 统计卡片 -->
                <el-card class="statistics-card" shadow="never">
                    <template #header>
                        <div class="statistics-header">
                            <el-icon class="statistics-icon" :size="16">
                                <DataAnalysis />
                            </el-icon>
                            <span class="statistics-title">统计概览</span>
                        </div>
                    </template>
                    <div class="statistics-content">
                        <!-- 路径信息 -->
                        <div class="statistics-item">
                            <div class="item-label">
                                <el-icon><Location /></el-icon>
                                <span>路径</span>
                            </div>
                            <div class="item-value">
                                <el-tag type="info" effect="plain" size="default">
                                    {{ statisticsData.path || '根对象' }}
                                </el-tag>
                            </div>
                        </div>
                        
                        <el-divider class="statistics-divider" />

                        <!-- 类型信息 -->
                        <div class="statistics-item">
                            <div class="item-label">
                                <el-icon><Collection /></el-icon>
                                <span>数据类型</span>
                            </div>
                            <div class="item-value">
                                <el-tag 
                                    :type="statisticsData.type === '数组' ? 'success' : 'primary'" 
                                    effect="plain" 
                                    size="default"
                                >
                                    {{ statisticsData.type }}
                                </el-tag>
                            </div>
                        </div>

                        <el-divider class="statistics-divider" />

                        <!-- 统计数量 -->
                        <div class="statistics-item count-item">
                            <div class="item-label">
                                <el-icon><Document /></el-icon>
                                <span>元素总数</span>
                            </div>
                            <div class="count-value">
                                <span class="count-number">{{ statisticsData.count }}</span>
                                <span class="count-unit">个元素</span>
                            </div>
                        </div>
                    </div>
                </el-card>
            </div>
            <template #footer>
                <div class="dialog-footer">
                    <el-button @click="statisticsDialogVisible = false">确定</el-button>
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
import { Loading, ArrowLeft, CopyDocument, Download, Upload, Delete, Setting, WarningFilled, DataAnalysis, Location, Collection, Document } from '@element-plus/icons-vue';

const MESSAGE_OFFSET = 18; // 配置消息提示显示在离顶部更远的位置
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 文件大小限制：5MB
const MAX_LINES = 100000; // 最大行数限制

const indentSize = ref(2); // 缩进大小
const maxLevel = ref(0); // 最大层级
const selectedLevel = ref(1); // 当前选中的层级

const showIndentGuide = ref(true); // 添加缩进指南状态
const arrayNewLine = ref(true); // 添加数组换行控制开关
const isFullscreen = ref(false); // 添加全屏状态控制
const isResizing = ref(false); // 添加是否正在调整宽度控制
const leftPanelWidth = ref(50); // 添加面板宽度控制（实时值，用于布局）
const stableLeftPanelWidth = ref(50); // 稳定宽度值，用于计算按钮显示状态（防抖更新）
const encodingMode = ref(0); // 添加编码处理模式：0-保持原样，1-转中文，2-转Unicode
const outputType = ref<'json' | 'yaml' | 'toml' | 'go'>('json'); // 添加当前输出类型的状态

// 路径输入对话框相关状态
const pathDialogVisible = ref(false);
const pathInputValue = ref('');
const pathSuggestionsData = ref<any>(null); // 存储解析后的JSON数据
const suggestionsHint = ref('');
let pathDialogResolve: ((value: string) => void) | null = null;
let pathDialogReject: ((reason?: any) => void) | null = null;

// 统计结果对话框相关状态
const statisticsDialogVisible = ref(false);
const statisticsData = ref<{
    path: string;
    type: string;
    count: number;
}>({
    path: '',
    type: '',
    count: 0
});

const editorsInitialized = ref(false); // 在script setup部分添加
const inputEditorContainer = ref<HTMLElement | null>(null); // 输入编辑器容器
const outputEditorContainer = ref<HTMLElement | null>(null); // 输出编辑器容器
const editorContainerWidth = ref(0); // 编辑器容器宽度，用于计算按钮显示状态
let inputEditor: monaco.editor.IStandaloneCodeEditor | null = null; // 输入编辑器实例
let outputEditor: monaco.editor.IStandaloneCodeEditor | null = null; // 输出编辑器实例
let stableWidthUpdateTimer: ReturnType<typeof setTimeout> | null = null; // 稳定宽度更新定时器

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

// 添加示例数据
const placeholderJSON = {
    "name": "JSON Tool",
    "description": [
        "🌐 本地执行: 一个纯前端的JSON数据处理工具，所有的功能操作均在本地浏览器中运行，无服务端依赖，保障数据隐私安全",
        "🔍 智能解析: 支持很多非标准JSON语法，自动处理末项逗号; 兼容多种注释格式(//单行注释、#脚本式注释、/* 多行注释 */)",
        "⚠️ 内容限制: 文件上传功能要求数据内容≤10万行，超限后拒绝上传文件; 嵌套深度≤99层正常解析，超限后自动清空输入区域内容",
        "🖥️ 屏幕适配: 为获得良好的响应式体验，需要屏幕宽度大于900px才能正常使用，小屏设备将自动隐藏工具界面并显示提示信息",
        "🐞 问题反馈: 如遇异常问题或功能建议，请通过 liubing.xyz@qq.com 邮箱联系开发团队，并附上【JSON工具】邮件标题"
    ],
    "helpers": [
        {
            "name": "分隔线拖拽",
            "detail": "可拖动中间的分隔线调整输入区域和预览区域的宽度比例"
        },
        {
            "name": "双击复制",
            "detail": "双击预览区域的字符串会将整个字符串自动复制到剪切板，方便快速复制内容"
        },
        {
            "name": "内容转移",
            "detail": "通过分隔线顶部的左箭头按钮，可将预览区域中的处理结果快速转移到输入区域"
        },
        {
            "name": "文件操作",
            "detail": "支持上传本地JSON文件和下载数据处理结果，上传的文件必须是.json后缀且是UTF-8编码"
        },
        {
            "name": "全屏模式",
            "detail": "支持全屏模式，获得更大的编辑空间和更好的阅读体验"
        },
        {
            "name": "查找/替换",
            "detail": "Windows: Ctrl+F查找，Ctrl+H替换; Mac: Command+F查找，Command+Option+F替换"
        },
        {
            "name": "撤销/重做",
            "detail": "Windows: Ctrl+Z撤销，Ctrl+Y重做; Mac: Command+Z撤销，Command+Shift+Z重做"
        },
        {
            "name": "多光标编辑",
            "detail": "Windows: Alt+点击添加光标，Ctrl+Alt+上/下添加光标; Mac: Option+点击添加光标，Command+Option+上/下添加光标"
        },
        {
            "name": "跳转定位",
            "detail": "Windows: Ctrl+G跳转到行，Ctrl+Home/End跳转文档首尾; Mac: Ctrl+G跳转到行，Command+↑/↓跳转文档首尾"
        }
    ],
    "settings": [
        {
            "name": "缩进空格",
            "values": ["2", "4", "8"],
            "detail": "仅对格式化功能生效，并且只影响预览区域的缩进效果，不会改变输入区域的缩进效果"
        },
        {
            "name": "编码模式",
            "values": ["保持原样", "转Unicode", "转中文"],
            "detail": "仅对格式化功能生效，可以实现中文字符和Unicode字符之间的双向转换，保持原样将保持编码不变"
        },
        {
            "name": "数组样式",
            "values": ["紧凑", "换行"],
            "detail": "仅对格式化功能生效，简单数组(字符串/数字/布尔值)可以单行显示; 复杂结构数组自动换行显示"
        },
        {
            "name": "缩进指南",
            "values": ["隐藏", "显示"],
            "detail": "缩进指南会同时影响输入区域和预览区域的缩进辅助线显示效果"
        }
    ],
    "supportedFunctions": [
        {
            "category": "JSON 数据处理",
            "description": "提供多种 JSON 数据处理功能",
            "functions": [
                {
                    "name": "格式化",
                    "detail": "根据用户设置的格式化配置对JSON数据进行格式化"
                },
                {
                    "name": "压缩",
                    "detail": "移除所有空白字符，生成最小化的JSON数据"
                },
                {
                    "name": "转义",
                    "detail": "将JSON字符串中的特殊字符进行转义处理"
                },
                {
                    "name": "去除转义",
                    "detail": "智能识别并还原转义过的JSON数据"
                },
                {
                    "name": "压缩并转义",
                    "detail": "先压缩再转义，适合需要在代码中嵌入JSON字符串的场景"
                },
                {
                    "name": "层级收缩",
                    "detail": "可以按照JSON的嵌套层级进行折叠，方便查看大型JSON结构"
                },
                {
                    "name": "统计",
                    "detail": "统计指定路径下对象或数组的一级元素个数，显示路径、数据类型和元素总数"
                }
            ]
        },
        {
            "category": "格式转换",
            "description": "支持多种数据格式的相互转换",
            "functions": [
                {
                    "name": "JSON 转 YAML",
                    "detail": "将JSON转换为YAML格式，保持原有的数据结构和类型"
                },
                {
                    "name": "JSON 转 TOML",
                    "detail": "将JSON转换为TOML格式，适合配置文件场景"
                },
                {
                    "name": "JSON 转 Go 结构体",
                    "detail": "生成与JSON结构匹配的Go语言结构体定义，包含当前的json标签，但是递归JSON转换结果不准确"
                },
                {
                    "name": "Cookie 转 JSON",
                    "detail": "将浏览器Cookie字符串解析为JSON对象，支持分号或换行分隔的多Cookie解析"
                }
            ]
        }
    ]
};

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

    // 获取容器高度
    const container = editor.getContainerDomNode();
    const containerHeight = container.clientHeight;

    // 直接使用容器高度
    editor.layout({
        width: container.clientWidth,
        height: containerHeight
    });
};

// 更新编辑器布局
const updateEditorLayout = () => {
    if (inputEditor) {
        // 强制重新计算编辑器尺寸
        const container = inputEditor.getContainerDomNode();
        inputEditor.layout({
            width: container.clientWidth,
            height: container.clientHeight
        });
    }
    if (outputEditor) {
        // 强制重新计算编辑器尺寸
        const container = outputEditor.getContainerDomNode();
        outputEditor.layout({
            width: container.clientWidth,
            height: container.clientHeight
        });
    }
};

// 获取编辑器配置
const getEditorOptions = (size: number, isReadOnly: boolean = false, language: string = 'json', enableLargeFileFolding: boolean = false) => ({
    // 基础配置
    value: '',
    language,
    theme: 'vs',
    readOnly: isReadOnly,

    // 外观配置
    fontSize: 14, // 设置字体大小为14px
    minimap: { enabled: false }, // 禁用右侧的代码概览图
    lineNumbers: 'on' as const, // 启用行号
    roundedSelection: true, // 启用圆角选择
    renderIndentGuides: true, // 启用缩进指南线
    renderLineHighlight: 'gutter' as const, // 启用所有行高亮
    lineNumbersMinChars: 1, // 设置行号最小字符数为1
    renderWhitespace: 'none' as const, // 禁用空白字符显示

    // 右键菜单配置
    contextmenu: false, // 禁用右键菜单

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
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(text);
            } else {
            // 降级方案：使用传统方法
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.position = 'fixed';
            textArea.style.left = '-999999px';
            textArea.style.top = '-999999px';
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            try {
                document.execCommand('copy');
            } catch (err) {
                // 忽略错误
            }
            document.body.removeChild(textArea);
        }
    } catch (err) {
        // 如果复制失败，不显示错误，静默处理
    }
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

// 在组件挂载时添加监听器
onMounted(async () => {
    // 确保在客户端环境下运行
    if (typeof window === 'undefined') return;

    // 添加消息提示位置的自定义样式
    const styleElement = document.createElement('style');
    styleElement.textContent = `
        .el-message {
            top: ${MESSAGE_OFFSET}px !important;
            z-index: 9999 !important;
            left: auto !important;
            right: 25px !important;
            transform: translateX(0) !important;
        }
    `;
    document.head.appendChild(styleElement);

    // 重新配置Monaco环境，确保Worker正确加载
    window.MonacoEnvironment = {
        getWorker(_, label) {
            if (label === 'json') {
                return new jsonWorker();
            }
            return new editorWorker();
        }
    };

    // 添加延迟确保DOM完全渲染
    await nextTick();
    setTimeout(async () => {
        try {
            // 再次检查DOM元素是否存在
            if (!inputEditorContainer.value || !outputEditorContainer.value) {
                return;
            }
            try {
                // 创建inputEditor编辑器
                if (inputEditorContainer.value) {
                    // 对于输入编辑器，也启用大文件折叠优化（因为用户可能输入大量JSON）
                    const inputOptions = getEditorOptions(indentSize.value, false, 'json', true);
                    inputEditor = monaco.editor.create(inputEditorContainer.value, inputOptions);
                    nextTick(() => {
                        const textarea = inputEditorContainer.value?.querySelector('textarea');
                        if (textarea) {
                            textarea.setAttribute('id', 'monaco-input-editor');
                            textarea.setAttribute('name', 'monaco-input-editor');
                        }
                    });
                }
                // 创建outputEditor编辑器
                if (outputEditorContainer.value) {
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
                }

                // inputEditor编辑器配置
                if (inputEditor) {
                    inputEditor.getModel()?.updateOptions({ tabSize: indentSize.value, insertSpaces: true });
                    const formattedExample = customStringify(placeholderJSON, null, indentSize.value);
                    inputEditor.setValue(formattedExample);
                    maxLevel.value = calculateMaxLevel(placeholderJSON);

                    // 监听输入变化
                    inputEditor.onDidChangeModelContent(() => {
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
                                selectedLevel.value = 1;
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
                            } catch (error) {
                                maxLevel.value = 0;
                            }
                        } else {
                            maxLevel.value = 0;
                            selectedLevel.value = 1;
                            outputEditor?.setValue('');
                            updateEditorHeight(outputEditor);
                            updateLineNumberWidth(outputEditor);
                        }
                    });
                }
                // outputEditor编辑器配置
                if (outputEditor) {
                    outputEditor.getModel()?.updateOptions({ tabSize: indentSize.value, insertSpaces: true });
                    // 设置双击选中整个字符串并复制功能
                    setupDoubleClickSelectString(outputEditor);
                }
            } catch (error: any) {
                showError('Monaco编辑器初始化失败: ' + error.message);
            }

            updateLineNumberWidth(inputEditor);
            updateLineNumberWidth(outputEditor);
            updateEditorHeight(inputEditor);
            updateEditorHeight(outputEditor);

            // 设置初始化成功标志
            editorsInitialized.value = true;
        } catch (error: any) {
            showError('Monaco编辑器初始化失败: ' + error.message);
        }
    }, 200);

    // 使用防抖处理的 resize 事件监听器
    window.addEventListener('resize', debouncedResize);

    // 初始化容器宽度
    setTimeout(() => {
        const container = document.querySelector('.editor-container');
        if (container) {
            editorContainerWidth.value = container.getBoundingClientRect().width;
        }
    }, 300);
});

// 清理编辑器实例
onBeforeUnmount(() => {
    // 移除resize事件监听器
    window.removeEventListener('resize', debouncedResize);

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
const customStringify = (obj: any, replacer: null, space: number, originalString?: string): string => {
    const indent = ' '.repeat(space);

    const isPrimitiveArray = (arr: any[]): boolean => {
        return arr.every(item =>
            typeof item === 'string' ||
            typeof item === 'number' ||
            typeof item === 'boolean' ||
            item === null
        );
    };

    // 预构建字符串值到原始转义形式的映射（只扫描一次原始字符串）
    const buildStringEscapeMap = (originalJSON: string): Map<string, string> => {
        const map = new Map<string, string>();
        if (!originalJSON) return map;

        const validEscapes = ['"', '\\', '/', 'b', 'f', 'n', 'r', 't', 'u'];
        const regex = /"((?:\\.|[^"\\])*)"/g;
        let match;

        while ((match = regex.exec(originalJSON)) !== null) {
            const originalEscaped = match[1]; // 原始转义形式（不含引号）
            let parsedValue: string;

            // 尝试解析这个原始字符串
            try {
                parsedValue = JSON.parse(`"${originalEscaped}"`);
            } catch {
                // 解析失败，说明包含无效转义序列，手动解析
                parsedValue = '';
                let i = 0;
                while (i < originalEscaped.length) {
                    if (originalEscaped[i] === '\\' && i + 1 < originalEscaped.length) {
                        const nextChar = originalEscaped[i + 1];
                        if (validEscapes.includes(nextChar)) {
                            // 有效转义序列，按照标准处理
                            if (nextChar === 'u' && i + 5 < originalEscaped.length) {
                                const hex = originalEscaped.substring(i + 2, i + 6);
                                if (/^[0-9a-fA-F]{4}$/i.test(hex)) {
                                    parsedValue += String.fromCharCode(parseInt(hex, 16));
                                    i += 6;
                                    continue;
                                }
                            } else if (nextChar === 'n') {
                                parsedValue += '\n';
                                i += 2;
                                continue;
                            } else if (nextChar === 'r') {
                                parsedValue += '\r';
                                i += 2;
                                continue;
                            } else if (nextChar === 't') {
                                parsedValue += '\t';
                                i += 2;
                                continue;
                            } else if (nextChar === 'b') {
                                parsedValue += '\b';
                                i += 2;
                                continue;
                            } else if (nextChar === 'f') {
                                parsedValue += '\f';
                                i += 2;
                                continue;
                            } else if (nextChar === '\\') {
                                parsedValue += '\\';
                                i += 2;
                                continue;
                            } else if (nextChar === '"') {
                                parsedValue += '"';
                                i += 2;
                                continue;
                            } else if (nextChar === '/') {
                                parsedValue += '/';
                                i += 2;
                                continue;
                            }
                        }
                        // 无效转义序列或\x序列，保持原样
                        parsedValue += originalEscaped[i] + nextChar;
                        i += 2;
                        continue;
                    }
                    parsedValue += originalEscaped[i];
                    i++;
                }
            }

            // 只保存第一次遇到的转义形式（避免覆盖）
            if (!map.has(parsedValue)) {
                map.set(parsedValue, originalEscaped);
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
        if (encodingMode.value !== 2) return str; // 如果不是转Unicode模式，直接返回

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
        if (encodingMode.value !== 1) return str; // 如果不是转中文模式，直接返回

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
        let processed = escapeString(str);

        // 根据编码处理模式进行转换
        if (encodingMode.value === 2) {
            processed = handleChineseToUnicode(processed);
        } else if (encodingMode.value === 1) {
            processed = handleUnicodeToChiness(processed);
        }

        return processed;
    };

    const format = (obj: any, currentIndent: string = ''): string => {
        if (obj === null) return 'null';

        if (Array.isArray(obj)) {
            if (obj.length === 0) return '[]';

            if (!arrayNewLine.value && isPrimitiveArray(obj)) {
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
};


// JSON预处理函数 - 处理结构层面的问题（注释、尾逗号）和无效转义序列
const preprocessJSON = (jsonString: string): { data: any, originalString: string } => {
    if (!jsonString || typeof jsonString !== 'string') {
        return { data: null, originalString: jsonString };
    }
    try {
        // 尝试直接解析
        const data = JSON.parse(jsonString);
        return { data, originalString: jsonString };
    } catch (e) {
        // 处理注释、尾逗号和无效转义序列
        let cleanedJSON = '';
        let inString = false;      // 是否在字符串内
        let escaped = false;       // 上一个字符是否为转义字符
        let inSingleLineComment = false;  // 是否在单行注释内
        let inMultiLineComment = false;   // 是否在多行注释内

        // 有效的JSON转义序列
        const validEscapes = ['"', '\\', '/', 'b', 'f', 'n', 'r', 't', 'u'];

        for (let i = 0; i < jsonString.length; i++) {
            const char = jsonString[i];
            const nextChar = jsonString[i + 1] || '';
            const nextNextChar = jsonString[i + 2] || '';

            // 处理字符串内的转义字符
            if (char === '\\' && !escaped && inString) {
                // 检查是否是有效转义序列
                if (nextChar === 'u') {
                    // Unicode转义序列 \uXXXX
                    const unicodeHex = jsonString.substring(i + 2, i + 6);
                    if (/^[0-9a-fA-F]{4}$/i.test(unicodeHex)) {
                        // 有效的Unicode转义，保留原样
                escaped = true;
                if (!inSingleLineComment && !inMultiLineComment) {
                    cleanedJSON += char;
                }
                continue;
                    } else {
                        // 无效的Unicode转义（如\u202），将\转义为\\
                        if (!inSingleLineComment && !inMultiLineComment) {
                            cleanedJSON += '\\\\';
                        }
                        escaped = false;
                        continue;
                    }
                } else if (nextChar === 'x') {
                    // \xXX 序列（不是标准JSON），将\x转义为\\x
                    if (!inSingleLineComment && !inMultiLineComment) {
                        cleanedJSON += '\\\\x';
                    }
                    i++; // 跳过 'x'
                    escaped = false;
                    continue;
                } else if (validEscapes.includes(nextChar)) {
                    // 有效的转义序列，保留原样
                    escaped = true;
                if (!inSingleLineComment && !inMultiLineComment) {
                    cleanedJSON += char;
                }
                    continue;
                } else if (nextChar) {
                    // 无效的转义序列（如\a, \c等），将\转义为\\
                    if (!inSingleLineComment && !inMultiLineComment) {
                        cleanedJSON += '\\\\';
                }
                escaped = false;
                    continue;
                } else {
                    // 反斜杠在字符串末尾，转义它
                    if (!inSingleLineComment && !inMultiLineComment) {
                        cleanedJSON += '\\\\';
                    }
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

            // 处理字符串边界 - 双引号
            if (char === '"' && !escaped) {
                inString = !inString;
                if (!inSingleLineComment && !inMultiLineComment) {
                    cleanedJSON += char;
                }
                escaped = false;
                continue;
            }

            // 处理多行注释开始
            if (!inString && !inSingleLineComment && char === '/' && nextChar === '*') {
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

            escaped = false;
        }

        // 移除多余的逗号
        cleanedJSON = cleanedJSON.replace(/,(\s*[}\]])/g, '$1');

        // 再次尝试解析
        try {
            const data = JSON.parse(cleanedJSON);
            return { data, originalString: jsonString };
        } catch (finalError) {
            // 如果仍然失败，抛出原始错误
            throw e;
        }
    }
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
                    // 先展开所有
                    outputEditor.trigger('unfold', 'editor.unfoldAll', null);
                    
                    // 根据文件大小动态调整延迟时间，确保10万行文件也能正常处理
                    let delay: number;
                    if (lineCount > 80000) {
                        delay = 800;
                    } else if (lineCount > 50000) {
                        delay = 400;
                    } else {
                        delay = 100;
                    }
                    
                    // 延迟执行折叠，确保展开完成
                    setTimeout(() => {
                        if (!outputEditor) return;
                        try {
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
                                }
                            }, 50);
                            
                            showSuccess(`收缩到第 ${selectedLevel.value} 层成功`);
                        } catch (e) {
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

            // 使用批量折叠优化：分批处理，避免阻塞UI
            const batchFold = async () => {
                if (!outputEditor) return;

                const model = outputEditor.getModel();
                if (!model) return;

                const BATCH_SIZE = 100; // 每批处理100个折叠范围
                const DELAY_BETWEEN_BATCHES = 10; // 批次之间的延迟（毫秒）

                // 从后向前折叠，避免折叠操作影响行号
                for (let batchStart = foldingRanges.length - 1; batchStart >= 0; batchStart -= BATCH_SIZE) {
                    const batchEnd = Math.max(0, batchStart - BATCH_SIZE + 1);

                    // 处理当前批次
                    for (let i = batchStart; i >= batchEnd; i--) {
                    const range = foldingRanges[i];
                    try {
                        // 获取开始行和结束行的内容
                        const startLineContent = model.getLineContent(range.start);
                        const endLineContent = model.getLineContent(range.end);
                        
                        // 找到开始行的开始括号位置（{ 或 [）
                        let startCol = startLineContent.search(/[\[\{]/);
                        if (startCol === -1) startCol = 1;
                        else startCol = startCol + 1; // Monaco 列号从1开始
                        
                        // 找到结束行的结束括号位置（} 或 ]）
                        let endCol = endLineContent.search(/[\]\}]/);
                        if (endCol === -1) {
                            endCol = model.getLineMaxColumn(range.end);
                        } else {
                            endCol = endCol + 1; // Monaco 列号从1开始
                        }
                        
                        // 方法1：尝试使用 Monaco 的 executeCommand 来精确折叠
                        // 先尝试从开始行的开始括号位置选择到结束行的结束括号位置
                        try {
                            // 将光标定位到开始括号之后，然后选择到结束括号之前
                            outputEditor.setPosition({
                                lineNumber: range.start,
                                column: startCol + 1
                            });
                            
                            // 展开当前位置的折叠（确保不会折叠到外层）
                            outputEditor.trigger('unfold', 'editor.unfold', null);
                            
                            // 小延迟
                            await new Promise(resolve => setTimeout(resolve, 5));
                            
                            // 选择从开始括号之后到结束括号之前的范围
                        outputEditor.setSelection({
                            startLineNumber: range.start,
                                startColumn: startCol + 1,
                            endLineNumber: range.end,
                                endColumn: endCol - 1 // 结束括号之前
                        });

                            // 尝试折叠选择的范围
                            // 使用 'editor.fold' 命令
                        outputEditor.trigger('fold', 'editor.fold', null);
                        } catch (foldErr) {
                            // 方法2：使用 executeEdits 配合折叠命令
                            try {
                                // 定位到开始行
                                outputEditor.setPosition({
                                    lineNumber: range.start,
                                    column: startCol
                                });
                                
                                // 使用折叠命令，但只折叠当前块（不折叠外层）
                                const foldAction = outputEditor.getAction('editor.fold');
                                if (foldAction && foldAction.isSupported()) {
                                    await foldAction.run();
                                } else {
                                    throw new Error('fold action not supported');
                                }
                            } catch (foldErr2) {
                                // 如果都失败，忽略错误继续处理下一个范围
                            }
                        }
                        
                        // 小延迟，确保折叠完成
                        await new Promise(resolve => setTimeout(resolve, 5));
                        
                    } catch (err) {
                            // 忽略单个折叠错误，继续处理其他范围
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

                    showSuccess(`收缩到第 ${selectedLevel.value} 层成功`);
                }
            };

            // 等待展开完成后再开始折叠
            setTimeout(() => {
                batchFold();
            }, 150);
        } else {
            showInfo(`未找到可收缩的第 ${selectedLevel.value} 层内容`);
        }
    } catch (e: any) {
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

            // 更新编辑器语言
            const model = outputEditor.getModel();
            if (model) {
                monaco.editor.setModelLanguage(model, editorLanguage);
            }

            // 更新编辑器配置
            outputEditor.updateOptions(getEditorOptions(indentSize.value, true, editorLanguage));

            updateLineNumberWidth(outputEditor);
            updateEditorHeight(outputEditor);
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

        // 预处理 JSON 字符串，如果是转中文模式，先处理Unicode
        let preprocessedValue = value;
        if (encodingMode.value === 1) {
            // 先将Unicode转为中文，再解析
            preprocessedValue = value.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => {
                return String.fromCharCode(parseInt(hex, 16));
            });
        }

        // 预处理 JSON 字符串
        let parsed;
        let originalString = preprocessedValue;
        try {
            const result = preprocessJSON(preprocessedValue);
            parsed = result.data;
            originalString = result.originalString;
        } catch (error) {
            showError('请输入有效的 JSON 数据');
            return;
        }

        // 使用标准格式化，传递原始字符串
        const formatted = customStringify(parsed, null, indentSize.value, originalString);
            const finalOutput = formatted.replace(/\\u([0-9a-fA-F]{4})/g, '\\u$1');

            outputEditor?.setValue(finalOutput);

        // 更新编辑器配置
        if (outputEditor) {
            // 更新编辑器语言
            const model = outputEditor.getModel();
            if (model) {
                monaco.editor.setModelLanguage(model, 'json');
            }

            // 更新其他配置
            // 对于JSON输出，总是启用大文件折叠优化
            const lineCount = outputEditor?.getModel()?.getLineCount() || 0;
            outputEditor.updateOptions(getEditorOptions(indentSize.value, true, 'json', true));

            updateLineNumberWidth(outputEditor);
            updateEditorHeight(outputEditor);
        }

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
        // 需要特别处理字符串值内部的转义序列
        let escaped = '';
        let i = 0;
        let inString = false; // 跟踪是否在字符串值内部

        while (i < formatted.length) {
            const char = formatted[i];
            const nextChar = formatted[i + 1] || '';
            const nextNextChar = formatted[i + 2] || '';

            if (char === '"') {
                // 检查是否是转义的双引号（字符串值内部的 \"）
                if (i > 0 && formatted[i - 1] === '\\') {
                    // 这是字符串值内部的转义引号 \"
                    // 需要转义反斜杠本身：\" -> \\\"
                    // 注意：前面的反斜杠已经被处理，这里只需要添加转义的引号
                    // 但实际情况是，我们需要将整个 \" 转义为 \\\"
                    // 由于我们已经跳过了反斜杠，这里需要回退
                    // 更好的方案：在遇到反斜杠时，如果下一个是引号，特殊处理
                    escaped += '\\"';
                    i++;
                } else {
                    // 普通的引号（字符串的开始或结束）
                    // 转义双引号
                    escaped += '\\"';
                    inString = !inString; // 切换字符串状态
                    i++;
                }
            } else if (char === '\\') {
                // 遇到反斜杠
                if (nextChar === '"' && inString) {
                    // 字符串值内部的 \"，需要转义为 \\\"
                    escaped += '\\\\\\"';
                    i += 2;
                } else if (nextChar === 'u' && /^[0-9a-fA-F]{4}$/i.test(formatted.substring(i + 2, i + 6))) {
                    // Unicode转义序列 \uXXXX
                    if (inString) {
                        // 在字符串值内部，保持原样
                        escaped += formatted.substring(i, i + 6);
                    } else {
                        // 不在字符串值内部，保持原样
                        escaped += formatted.substring(i, i + 6);
                    }
                    i += 6;
                } else if (nextChar === '\\' && nextNextChar && !validEscapes.includes(nextNextChar)) {
                    // JSON.stringify 将无效转义序列 \a 转义成了 \\a
                    // 我们需要将其还原为 \a
                    // 例如：\\a -> \a, \\c -> \c
                    escaped += '\\' + nextNextChar;
                    i += 3;
                } else if (nextChar) {
                    // 标准转义序列（\n, \t等）
                    if (inString) {
                        // 在字符串值内部，保持原样
                        escaped += char + nextChar;
                    } else {
                        // 不在字符串值内部，保持原样
                        escaped += char + nextChar;
                    }
                    i += 2;
                } else {
                    // 单独的反斜杠（字符串末尾），转义它
                    escaped += '\\\\';
                    i++;
                }
            } else {
                escaped += char;
                i++;
            }
        }

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

                                // 先替换 \" 和 \\，得到去除转义的字符串
                                let unescaped = tempStr.replace(/\\"/g, '"').replace(/\\\\/g, '\\');

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

// 解析路径，支持数组索引和对象属性访问
// 例如: settings[0].values 或 settings[0] 或 settings.name
const parsePath = (pathStr: string): Array<{ key: string; index?: number }> => {
            const parts: Array<{ key: string; index?: number }> = [];
            let current = '';
            let inBrackets = false;
            let bracketContent = '';
            
            for (let i = 0; i < pathStr.length; i++) {
                const char = pathStr[i];
                
                if (char === '[') {
                    if (current) {
                        parts.push({ key: current });
                        current = '';
                    }
                    inBrackets = true;
                    bracketContent = '';
                } else if (char === ']') {
                    if (inBrackets) {
                        const index = parseInt(bracketContent);
                        if (!isNaN(index)) {
                            // 如果有前面的key（当前有未处理的key，或者最后一个part有key但没有index），添加到最后一个part
                            if (current) {
                                // 先保存当前的key
                                parts.push({ key: current, index: index });
                                current = '';
                            } else if (parts.length > 0 && parts[parts.length - 1].index === undefined) {
                                // 最后一个part有key但没有index，添加index
                                parts[parts.length - 1].index = index;
                            } else {
                                // 路径以 [0] 开头，创建只有index的part（key为空）
                                parts.push({ key: '', index: index });
                            }
                        } else {
                            // 非数字索引，作为字符串键
                            if (current) {
                                parts.push({ key: current, index: undefined });
                                current = '';
                            }
                            parts.push({ key: bracketContent });
                        }
                        inBrackets = false;
                        bracketContent = '';
                    }
                } else if (char === '.' || char === '/') {
                    if (!inBrackets) {
                        if (current) {
                            parts.push({ key: current });
                            current = '';
                        }
                    } else {
                        bracketContent += char;
                    }
                } else {
                    if (inBrackets) {
                        bracketContent += char;
                    } else {
                        current += char;
                    }
                }
            }
            
            // 处理最后一个部分
            if (inBrackets) {
                const index = parseInt(bracketContent);
                if (!isNaN(index)) {
                    if (current) {
                        // 先保存当前的key
                        parts.push({ key: current, index: index });
                        current = '';
                    } else if (parts.length > 0 && parts[parts.length - 1].index === undefined) {
                        parts[parts.length - 1].index = index;
                    } else {
                        // 路径以 [0] 结尾，创建只有index的part
                        parts.push({ key: '', index: index });
                    }
                } else {
                    if (current) {
                        parts.push({ key: current });
                        current = '';
                    }
                    parts.push({ key: bracketContent });
                }
            } else if (current) {
                parts.push({ key: current });
            }
            
            return parts;
};

// 根据路径获取目标值（用于访问和验证）
const getValueByPath = (data: any, path: string): { value: any; error?: string } => {
    const pathParts = parsePath(path.trim());
    let targetValue = data;
    
    for (const part of pathParts) {
        if (targetValue === null || targetValue === undefined) {
            return { 
                value: null, 
                error: `路径 "${path}" 不存在或无法访问（在 "${part.key || `[${part.index}]`}" 处值为 null/undefined）`
            };
        }
        
        // 如果有key，先访问属性
        if (part.key) {
            if (typeof targetValue === 'object' && part.key in targetValue) {
                targetValue = targetValue[part.key];
            } else {
                return { 
                    value: null, 
                    error: `路径 "${path}" 不存在或无法访问（无法访问属性 "${part.key}"）`
                };
            }
        }
        
        // 如果有索引，访问数组元素或对象的数字键
        if (part.index !== undefined) {
            if (Array.isArray(targetValue)) {
                if (part.index >= 0 && part.index < targetValue.length) {
                    targetValue = targetValue[part.index];
                } else {
                    return { 
                        value: null, 
                        error: `路径 "${path}" 不存在或无法访问（数组索引 ${part.index} 超出范围，数组长度为 ${targetValue.length}）`
                    };
                }
            } else if (typeof targetValue === 'object' && targetValue !== null) {
                const strKey = String(part.index);
                if (strKey in targetValue) {
                    targetValue = targetValue[strKey];
                } else {
                    return { 
                        value: null, 
                        error: `路径 "${path}" 不存在或无法访问（对象中不存在键 "${strKey}"）`
                    };
                }
            } else {
                return { 
                    value: null, 
                    error: `路径 "${path}" 不存在或无法访问（无法对类型 "${typeof targetValue}" 使用索引访问）`
                };
            }
        }
    }
    
    return { value: targetValue };
};

// 判断值是否是基础类型（字符串、数字、布尔值）
const isPrimitiveType = (value: any): boolean => {
    return value === null || value === undefined || 
           typeof value === 'string' || 
           typeof value === 'number' || 
           typeof value === 'boolean';
};

// 判断数组的元素是否都是基础类型
const isArrayOfPrimitives = (arr: any[]): boolean => {
    if (arr.length === 0) return false; // 空数组不判断
    // 检查前几个元素，如果都是基础类型，则认为数组是基础类型数组
    // 检查前5个元素或全部元素（取较小值）
    const checkCount = Math.min(5, arr.length);
    for (let i = 0; i < checkCount; i++) {
        if (!isPrimitiveType(arr[i])) {
            return false; // 只要有一个不是基础类型，就不是基础类型数组
        }
    }
    return true; // 所有检查的元素都是基础类型
};

// 获取路径建议
const queryPathSuggestions = (queryString: string, cb: (suggestions: any[]) => void) => {
    if (!pathSuggestionsData.value) {
        cb([]);
        return;
    }

    const suggestions: Array<{ value: string; type: string }> = [];
    const path = queryString.trim();
    
    // 如果路径为空，提供根对象的键
    if (!path) {
        const data = pathSuggestionsData.value;
        if (Array.isArray(data)) {
            // 如果数组元素是基础类型，不显示索引建议
            if (isArrayOfPrimitives(data)) {
                suggestionsHint.value = `根对象是基础类型数组（字符串/数字/布尔值），包含 ${data.length} 个元素，无法继续访问`;
            } else {
                suggestionsHint.value = `根对象是数组，包含 ${data.length} 个元素，可使用 [0] 到 [${data.length - 1}]`;
                // 提供前几个索引作为建议
                const maxSuggestions = Math.min(10, data.length);
                for (let i = 0; i < maxSuggestions; i++) {
                    suggestions.push({
                        value: `[${i}]`,
                        type: `索引 ${i}`
                    });
                }
                if (data.length > 10) {
                    suggestions.push({
                        value: `[${data.length - 1}]`,
                        type: `索引 ${data.length - 1}`
                    });
                }
            }
        } else if (data && typeof data === 'object') {
            const keys = Object.keys(data);
            suggestionsHint.value = `根对象包含 ${keys.length} 个键`;
            keys.forEach(key => {
                const val = data[key];
                // 只推荐对象和数组类型，过滤基础数据类型
                if (isPrimitiveType(val)) {
                    return; // 跳过基础类型
                }
                let type = '';
                if (Array.isArray(val)) {
                    type = `数组(${val.length})`;
                } else if (val && typeof val === 'object') {
                    type = `对象(${Object.keys(val).length})`;
                } else {
                    type = typeof val;
                }
                suggestions.push({
                    value: key,
                    type: type
                });
            });
        }
        cb(suggestions);
        return;
    }

    // 解析当前路径，获取当前位置的值
    const result = getValueByPath(pathSuggestionsData.value, path);
    
    if (result.error) {
        suggestionsHint.value = result.error;
        cb([]);
        return;
    }

    const currentValue = result.value;
    
    // 获取路径的最后部分（可能未完成）
    const pathParts = parsePath(path);
    const lastPart = pathParts[pathParts.length - 1];
    const isInBrackets = path.endsWith('[') || (path.match(/\[[^\]]*$/) !== null);
    const endsWithDot = path.endsWith('.') || path.endsWith('/');
    
    // 如果路径已完整且指向有效值，提供下一步的建议
    if (currentValue !== null && currentValue !== undefined && !endsWithDot && !isInBrackets) {
        if (Array.isArray(currentValue)) {
            // 如果数组元素是基础类型，不显示索引建议
            if (isArrayOfPrimitives(currentValue)) {
                suggestionsHint.value = `当前位置是基础类型数组（字符串/数字/布尔值），包含 ${currentValue.length} 个元素，无法继续访问`;
            } else {
                suggestionsHint.value = `当前位置是数组，包含 ${currentValue.length} 个元素`;
                const maxSuggestions = Math.min(10, currentValue.length);
                const prefix = path + '[';
                for (let i = 0; i < maxSuggestions; i++) {
                    suggestions.push({
                        value: `${prefix}${i}]`,
                        type: `索引 ${i}`
                    });
                }
                if (currentValue.length > 10) {
                    suggestions.push({
                        value: `${prefix}${currentValue.length - 1}]`,
                        type: `索引 ${currentValue.length - 1}`
                    });
                }
            }
        } else if (currentValue && typeof currentValue === 'object') {
            const keys = Object.keys(currentValue);
            suggestionsHint.value = `当前位置是对象，包含 ${keys.length} 个键`;
            const prefix = path + '.';
            keys.forEach(key => {
                const val = currentValue[key];
                // 只推荐对象和数组类型，过滤基础数据类型
                if (isPrimitiveType(val)) {
                    return; // 跳过基础类型
                }
                let type = '';
                if (Array.isArray(val)) {
                    type = `数组(${val.length})`;
                } else if (val && typeof val === 'object') {
                    type = `对象(${Object.keys(val).length})`;
                } else {
                    type = typeof val;
                }
                suggestions.push({
                    value: `${prefix}${key}`,
                    type: type
                });
            });
        } else {
            suggestionsHint.value = `当前位置是 ${typeof currentValue}，无法继续访问`;
        }
    } else if (endsWithDot || isInBrackets) {
        // 路径以 . 或 [ 结尾，提供下一步建议
        if (currentValue !== null && currentValue !== undefined) {
            if (Array.isArray(currentValue) && isInBrackets) {
                // 如果数组元素是基础类型，不显示索引建议
                if (isArrayOfPrimitives(currentValue)) {
                    suggestionsHint.value = `当前位置是基础类型数组（字符串/数字/布尔值），包含 ${currentValue.length} 个元素，无法继续访问`;
                } else {
                    const maxSuggestions = Math.min(10, currentValue.length);
                    const bracketContent = path.match(/\[([^\]]*)$/)?.[1] || '';
                    const prefix = path.substring(0, path.lastIndexOf('[') + 1);
                    
                    if (bracketContent === '') {
                        // 刚输入 [，提供所有索引
                        for (let i = 0; i < maxSuggestions; i++) {
                            suggestions.push({
                                value: `${prefix}${i}]`,
                                type: `索引 ${i}`
                            });
                        }
                        if (currentValue.length > 10) {
                            suggestions.push({
                                value: `${prefix}${currentValue.length - 1}]`,
                                type: `索引 ${currentValue.length - 1}`
                            });
                        }
                    }
                    suggestionsHint.value = `当前位置是数组，包含 ${currentValue.length} 个元素`;
                }
            } else if (currentValue && typeof currentValue === 'object' && endsWithDot) {
                // 如果是基础类型数组，不能使用 . 访问
                if (Array.isArray(currentValue) && isArrayOfPrimitives(currentValue)) {
                    suggestionsHint.value = `当前位置是基础类型数组（字符串/数字/布尔值），包含 ${currentValue.length} 个元素，无法继续访问`;
                } else if (Array.isArray(currentValue)) {
                    // 数组应该使用 [索引] 语法，而不是 . 语法
                    suggestionsHint.value = `当前位置是数组，包含 ${currentValue.length} 个元素，应使用 [索引] 语法访问`;
                } else {
                    const keys = Object.keys(currentValue);
                    const prefix = path;
                    suggestionsHint.value = `当前位置是对象，包含 ${keys.length} 个键`;
                    keys.forEach(key => {
                        const val = currentValue[key];
                        // 只推荐对象和数组类型，过滤基础数据类型
                        if (isPrimitiveType(val)) {
                            return; // 跳过基础类型
                        }
                        let type = '';
                        if (Array.isArray(val)) {
                            type = `数组(${val.length})`;
                        } else if (val && typeof val === 'object') {
                            type = `对象(${Object.keys(val).length})`;
                        } else {
                            type = typeof val;
                        }
                        suggestions.push({
                            value: `${prefix}${key}`,
                            type: type
                        });
                    });
                }
            }
        }
    } else {
        // 路径不完整，尝试匹配部分键名
        if (lastPart && pathParts.length > 0) {
            const parentPath = pathParts.slice(0, -1);
            let parentValue = pathSuggestionsData.value;
            for (const part of parentPath) {
                if (parentValue === null || parentValue === undefined) break;
                if (part.key && typeof parentValue === 'object' && part.key in parentValue) {
                    parentValue = parentValue[part.key];
                }
                if (part.index !== undefined) {
                    if (Array.isArray(parentValue) && part.index >= 0 && part.index < parentValue.length) {
                        parentValue = parentValue[part.index];
                    } else if (typeof parentValue === 'object' && parentValue !== null) {
                        parentValue = parentValue[String(part.index)];
                    }
                }
            }
            
            if (parentValue && typeof parentValue === 'object') {
                // 如果是基础类型数组，不显示索引建议
                if (Array.isArray(parentValue) && isArrayOfPrimitives(parentValue)) {
                    suggestionsHint.value = '基础类型数组（字符串/数字/布尔值），无法继续访问';
                } else {
                    const keys = Object.keys(parentValue);
                    // 计算前缀：找到最后一个分隔符的位置
                    let prefixEnd = path.length;
                    for (let i = path.length - 1; i >= 0; i--) {
                        if (path[i] === '.' || path[i] === '/' || path[i] === ']') {
                            prefixEnd = i + 1;
                            break;
                        }
                    }
                    const prefix = path.substring(0, prefixEnd);
                    const query = path.substring(prefixEnd).toLowerCase();
                    
                    keys.filter(key => key.toLowerCase().includes(query)).forEach(key => {
                        const val = parentValue[key];
                        // 只推荐对象和数组类型，过滤基础数据类型
                        if (isPrimitiveType(val)) {
                            return; // 跳过基础类型
                        }
                        let type = '';
                        if (Array.isArray(val)) {
                            type = `数组(${val.length})`;
                        } else if (val && typeof val === 'object') {
                            type = `对象(${Object.keys(val).length})`;
                        } else {
                            type = typeof val;
                        }
                        suggestions.push({
                            value: `${prefix}${key}`,
                            type: type
                        });
                    });
                }
            }
        }
    }
    
    cb(suggestions);
};

// 处理路径输入变化
const handlePathInput = () => {
    suggestionsHint.value = '';
};

// 处理路径选择
const handlePathSelect = (item: Record<string, any>) => {
    if (item && item.value) {
        pathInputValue.value = item.value;
    }
};

// 对话框关闭处理
const handlePathDialogClose = () => {
    if (pathDialogReject) {
        pathDialogReject('cancel');
        pathDialogReject = null;
        pathDialogResolve = null;
    }
};

// 对话框取消
const handlePathDialogCancel = () => {
    pathDialogVisible.value = false;
    if (pathDialogReject) {
        pathDialogReject('cancel');
        pathDialogReject = null;
        pathDialogResolve = null;
    }
};

// 对话框确认
const handlePathDialogConfirm = () => {
    const path = pathInputValue.value.trim();
    pathDialogVisible.value = false;
    if (pathDialogResolve) {
        pathDialogResolve(path);
        pathDialogResolve = null;
        pathDialogReject = null;
    }
};

// 统计功能：统计指定路径下的一级元素个数
const countKeys = async () => {
    try {
        const value = inputEditor?.getValue() || '';
        if (!value.trim()) {
            showError('请先输入 JSON 数据');
            return;
        }

        // 解析JSON
        let parsedData;
        try {
            const result = preprocessJSON(value);
            parsedData = result.data;
        } catch (error) {
            showError('请输入有效的 JSON 数据');
            return;
        }

        // 保存数据供智能提示使用
        pathSuggestionsData.value = parsedData;
        pathInputValue.value = '';
        suggestionsHint.value = '';

        // 显示自定义对话框并等待用户输入
        pathDialogVisible.value = true;
        
        const path = await new Promise<string>((resolve, reject) => {
            pathDialogResolve = resolve;
            pathDialogReject = reject;
        });

        // 根据路径获取目标值
        let targetValue: any = parsedData;
        if (path && path.trim()) {
            const result = getValueByPath(parsedData, path);
            if (result.error) {
                ElMessageBox.alert(result.error, '路径错误');
                return;
            }
            targetValue = result.value;
        }

        // 统计元素个数
        let count = 0;
        let type = '';

        if (Array.isArray(targetValue)) {
            count = targetValue.length;
            type = '数组';
        } else if (targetValue && typeof targetValue === 'object') {
            count = Object.keys(targetValue).length;
            type = '对象';
        } else {
            ElMessageBox.alert(
                `路径 "${path || '根'}" 指向的值不是对象或数组，无法统计元素个数`,
                '类型错误'
            );
            return;
        }

        // 更新统计数据
        statisticsData.value = {
            path: path || '根对象',
            type: type,
            count: count
        };

        // 显示统计结果弹窗
        statisticsDialogVisible.value = true;
    } catch (error: any) {
        // 用户取消输入时不显示错误
        if (error !== 'cancel') {
            showError('统计失败: ' + error.message);
        }
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
        const formatted = JSON.stringify(parsedData, null, indentSize.value);

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
            const updateOptions = getEditorOptions(indentSize.value, true, 'json', true);
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
            }, unfoldDelay);
        }, delayTime);
    } catch (error: any) {
        showError('操作失败: ' + error.message);
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

        // JSON格式检查和处理
        try {
            // 解析JSON并检查深度
            const { data: jsonData, originalString } = preprocessJSON(content);

            // 检查深度
            const depth = getObjectDepth(jsonData);
            if (depth > 99) {
                showError('JSON深度超过99层, 不允许上传');
                return;
            }

            // 使用自定义格式化函数格式化JSON，保持原始转义字符
            const formattedJson = customStringify(jsonData, null, indentSize.value, originalString);

            // 更新编辑器
            if (inputEditor) {
                inputEditor.setValue(formattedJson);
                updateLineNumberWidth(inputEditor);
                updateEditorHeight(inputEditor);
                // 确保使用2空格缩进
                inputEditor.getModel()?.updateOptions({
                    tabSize: 2,
                    indentSize: 2
                });
            }
            // 清空outputEditor的内容
            outputEditor?.setValue('');
            updateLineNumberWidth(outputEditor);
            updateEditorHeight(outputEditor);

            // 显示成功提示
                showSuccess('文件上传成功');
        } catch (error: any) {
            showError('无效的 JSON 格式: ' + error.message);
            return;
        }
    } catch (error: any) {
        showError('文件处理失败: ' + error.message);
    }
};

// 清空输入
const clearInput = () => {
    try {
        // 移除重置缩进空格的代码，保留用户设置
        maxLevel.value = 0;
        selectedLevel.value = 1;

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

// 下载内容
const downloadOutput = () => {
    const content = outputEditor?.getValue();
    if (!content) {
        showWarning('没有可下载的内容');
        return;
    }

    // 根据输出类型决定文件扩展名和 MIME 类型
    const fileExtension = {
        json: '.json',
        yaml: '.yaml',
        toml: '.toml',
        go: '.go'
    }[outputType.value];

    const mimeType = {
        json: 'application/json',
        yaml: 'text/yaml',
        toml: 'text/plain',
        go: 'text/plain'
    }[outputType.value];

    // 创建 Blob 对象
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);

    // 创建下载链接
    const link = document.createElement('a');
    link.href = url;
    // 生成文件名：example_时间戳.扩展名
    link.download = `example_${Math.floor(Date.now() / 1000)}${fileExtension}`;
    document.body.appendChild(link);
    link.click();

    // 清理
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showSuccess('下载成功');
};

// 切换全屏状态
const toggleFullscreen = () => {
    isFullscreen.value = !isFullscreen.value
};

// 布局更新函数（精确版，传递实际计算的容器尺寸，确保滚动条实时紧贴）
// updateOutputEditor: 是否更新预览区域布局
// 拖动时也要更新预览区域布局，让滚动条紧贴右边界，但需要恢复滚动内容位置
const updateEditorLayouts = (updateOutputEditor: boolean = true, forceWidth?: { inputWidth?: number; outputWidth?: number }) => {
    if (inputEditor) {
        const container = inputEditor.getContainerDomNode();
        // 如果提供了强制宽度，使用强制宽度；否则使用容器实际宽度
        // 传递精确的容器尺寸，确保布局计算准确
        // 输入区域的滚动条需要实时紧贴分割线，所以拖动时也要更新
        const width = forceWidth?.inputWidth ?? container.clientWidth;
        inputEditor.layout({
            width: width,
            height: container.clientHeight
        });
    }
    if (outputEditor && updateOutputEditor) {
        const container = outputEditor.getContainerDomNode();
        // 如果提供了强制宽度，使用强制宽度；否则使用容器实际宽度
        // 传递精确的容器尺寸，确保布局计算准确
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

    // 立即同步更新布局，确保滚动条实时紧贴边界（即使极快来回拖动也能响应）
    // 关键：直接根据百分比和容器宽度计算实际宽度，而不是依赖可能未更新的 DOM
    // 这样可以确保 Monaco Editor 接收到准确的宽度，从而正确计算滚动条位置
    const containerWidth = resizeState.rect.width;
    const resizerWidth = 24; // 分割线宽度（固定值）
    const availableWidth = containerWidth - resizerWidth;
    
    // 计算面板的实际宽度（考虑分割线）
    // 由于 Monaco Editor 容器使用 flex: 1，它的宽度应该等于面板宽度
    // 直接使用计算值，确保 Monaco Editor 接收到准确的宽度
    const inputWidth = Math.round((newWidth / 100) * availableWidth);
    const outputWidth = Math.round(((100 - newWidth) / 100) * availableWidth);
    
    // 使用计算出的宽度强制更新布局，确保滚动条实时紧贴边界
    // 输入区域：滚动条紧贴分割线（Monaco 自动处理）
    // 预览区域：滚动条紧贴右边界（Monaco 自动处理，与输入区域一致）
    // 注意：拖动过程中不恢复滚动位置，让滚动条自然紧贴右边界，只在拖动结束后恢复
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

    // 拖动开始时不再锁定预览区域容器宽度，所以这里也不需要解除锁定
    // 预览区域的宽度应该正常跟随面板宽度变化

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
        // 保存拖动开始时的滚动位置（通过 Monaco Editor 的滚动容器 DOM 元素获取）
        // Monaco Editor 的滚动位置存储在内部的 scrollable element 中
        // 拖动过程中，预览区域的滚动条会紧贴右边界，但滚动内容位置需要保持不变
        const scrollableElement = outputEditor.getContainerDomNode().querySelector('.monaco-scrollable-element') as HTMLElement;
        if (scrollableElement) {
            outputScrollLeft = scrollableElement.scrollLeft;
            outputScrollTop = scrollableElement.scrollTop;
        }

        // 不锁定预览区域容器宽度，让它正常跟随面板宽度变化
        // 这样滚动条可以实时紧贴右边界
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
        // 无论预览区域使用什么缩进，输入区域始终使用2个空格
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
            inputEditor.setValue(formattedContent);
            updateLineNumberWidth(inputEditor);
            updateEditorHeight(inputEditor);

            // 确保输入编辑器使用2空格缩进
            inputEditor.getModel()?.updateOptions({
                tabSize: 2,
                indentSize: 2
            });
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
.json-tool-container {
    padding: 10px;
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
    width: calc(100% - 20px);
    height: calc(100% - 20px);
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

.tool-bar {
    padding: 10px 15px;
    display: flex;
    gap: 18px;
    flex-wrap: wrap;
    flex-shrink: 0;
    background-color: #ffffff;
    border-radius: 6px;
    box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.03);
    border: 1px solid #ebeef5;
    position: relative;
}

.tolerance-mode-tip {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    background-color: #f0f9ff;
    border: 1px solid #bae6fd;
    border-radius: 4px;
    color: #0369a1;
    font-size: 12px;
}

.tip-icon {
    font-size: 14px;
}

.setting-icon {
    font-size: 16px;
}

.editor-container {
    display: flex;
    flex: 1;
    min-height: 0;
    overflow: hidden;
    position: relative;
    padding: 10px 0;
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

/* 面板头部样式调整 */
.editor-panel:last-child .panel-header {
    border-top-left-radius: 0;
    border-top-right-radius: 6px;
}

/* 编辑器容器圆角调整 */
.editor-panel:first-child .monaco-editor-container {
    border-bottom-left-radius: 6px;
    border-bottom-right-radius: 0;
}

.editor-panel:last-child .monaco-editor-container {
    border-bottom-left-radius: 0;
    border-bottom-right-radius: 6px;
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

.monaco-editor-container {
    flex: 1;
    min-height: 400px;
    background-color: white;
    border: 1px solid #e4e7ed;
    border-top: none;
    border-bottom-left-radius: 6px;
    border-bottom-right-radius: 6px;
    overflow: hidden;
    position: relative;
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

:deep(.monaco-editor .line-numbers) {
    color: #909399;
    font-size: 14px;
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
    min-width: 100px;
    width: auto;
}

:deep(.level-select .el-input__wrapper) {
    width: auto;
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

.config-row {
    display: flex;
    align-items: center;
    width: 100%;
}

.config-label {
    font-weight: 500;
    white-space: nowrap;
    width: 60px;
    display: flex;
    align-items: center;
    height: 100%;
}

.config-control {
    display: flex;
    justify-content: center;
    flex: 1;
}

.vertical-radio-group {
    display: flex;
    justify-content: space-between;
    width: 195px;
}

.vertical-radio-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    width: 65px;
}

.radio-text {
    font-size: 12px;
    font-weight: 500;
    margin-top: 4px;
    color: #666;
    white-space: nowrap;
}

:deep(.el-radio) {
    margin: 0;
    padding: 0;
}

:deep(.el-radio__label) {
    display: none;
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

/* 编辑器容器样式优化 */
.monaco-editor-container {
    flex: 1;
    min-height: 400px;
    background-color: white;
    border: 1px solid #e4e7ed;
    border-top: none;
    border-bottom-left-radius: 6px;
    border-bottom-right-radius: 6px;
    overflow: hidden;
    position: relative;
}

/* 路径输入对话框样式 */
.path-input-dialog {
    padding: 10px 0;
}

.dialog-description {
    margin-bottom: 20px;
    color: #606266;
    line-height: 1.6;
}

.dialog-description p {
    margin: 5px 0;
}

.dialog-description .tip-text {
    font-size: 12px;
    color: #909399;
}

.path-autocomplete {
    width: 100%;
    margin-bottom: 10px;
}

.suggestions-hint {
    margin-top: 10px;
    padding: 8px 12px;
    background-color: #f5f7fa;
    border-left: 3px solid #409eff;
    border-radius: 4px;
    font-size: 13px;
    color: #606266;
    line-height: 1.5;
}

.suggestion-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 0;
}

.suggestion-value {
    flex: 1;
    font-weight: 500;
    color: #303133;
}

.suggestion-type {
    margin-left: 10px;
    padding: 2px 8px;
    background-color: #ecf5ff;
    color: #409eff;
    border-radius: 3px;
    font-size: 12px;
}

/* 统计结果对话框样式 */
.statistics-dialog {
    max-height: 90vh;
}

.statistics-dialog :deep(.el-dialog) {
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    margin-top: 5vh !important;
    margin-bottom: 5vh !important;
}

.statistics-dialog :deep(.el-dialog__body) {
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    padding: 16px;
    min-height: 0;
}

/* 在小屏幕上进一步优化 */
@media (max-height: 800px) {
    .statistics-dialog :deep(.el-dialog) {
        max-height: 85vh;
        margin-top: 7.5vh !important;
        margin-bottom: 7.5vh !important;
    }
    
    .statistics-dialog :deep(.el-dialog__body) {
        padding: 16px;
    }
    
    .keys-scrollbar {
        max-height: 200px;
    }
}

@media (max-height: 600px) {
    .statistics-dialog :deep(.el-dialog) {
        max-height: 80vh;
        margin-top: 10vh !important;
        margin-bottom: 10vh !important;
    }
    
    .statistics-dialog :deep(.el-dialog__body) {
        padding: 12px;
    }
    
    .keys-scrollbar {
        max-height: 150px;
    }
    
    .statistics-item {
        padding: 10px 0;
    }
    
    .count-item {
        padding: 12px !important;
    }
}

.statistics-result-dialog {
    padding: 0;
    flex: 1;
    overflow-y: auto;
    min-height: 0;
}

.statistics-card {
    margin-bottom: 12px;
    border-radius: 4px;
    border: 1px solid #e4e7ed;
}

.statistics-card:last-child {
    margin-bottom: 0;
}

.statistics-card :deep(.el-card__body) {
    padding: 12px 16px;
}

.statistics-header {
    display: flex;
    align-items: center;
    gap: 6px;
    font-weight: 500;
    color: #303133;
}

.statistics-header .el-tag {
    font-size: 11px;
    padding: 2px 6px;
    height: 20px;
    line-height: 16px;
}

.statistics-icon {
    color: #606266;
}

.statistics-title {
    flex: 1;
    font-size: 13px;
}

.statistics-content {
    padding: 0;
}

.statistics-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 0;
    min-height: 32px;
}

.statistics-item.count-item {
    padding: 10px 12px;
    background-color: #f5f7fa;
    margin: 0 -16px;
    padding-left: 16px;
    padding-right: 16px;
    border-radius: 4px;
    border-top: 1px solid #e4e7ed;
    border-bottom: 1px solid #e4e7ed;
}

.item-label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: #606266;
    font-weight: 400;
}

.count-item .item-label {
    color: #606266;
}

.item-label .el-icon {
    font-size: 14px;
    color: #909399;
}

.count-item .item-label .el-icon {
    color: #909399;
}

.item-value {
    display: flex;
    align-items: center;
}

.statistics-item :deep(.el-tag) {
    font-size: 12px;
    padding: 2px 8px;
    height: 22px;
    line-height: 18px;
}

.count-value {
    display: flex;
    align-items: baseline;
    gap: 4px;
}

.count-number {
    font-size: 24px;
    font-weight: 600;
    color: #303133;
    line-height: 1;
}

.count-unit {
    font-size: 12px;
    color: #909399;
    font-weight: 400;
}


.dialog-footer {
    display: flex;
    justify-content: flex-end;
    padding-top: 10px;
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

:deep(.el-card__header) {
    padding: 12px 16px;
    background-color: #fafafa;
    border-bottom: 1px solid #e4e7ed;
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
</style>