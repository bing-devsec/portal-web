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
                        <div class="panel-actions">
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
                        <div class="panel-actions">
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
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, nextTick, watch, onUnmounted } from 'vue';
import { ElMessage } from 'element-plus';
import type { UploadFile } from 'element-plus';
import * as monaco from 'monaco-editor';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
import { Loading, ArrowLeft, CopyDocument, Download, Upload, Delete, Setting, WarningFilled } from '@element-plus/icons-vue';

const MESSAGE_OFFSET = 18; // 配置消息提示显示在离顶部更远的位置
const MAX_FILE_SIZE = 1024 * 1024; // 文件大小限制：1MB
const MAX_LINES = 9999; // 最大行数限制

const indentSize = ref(2); // 缩进大小
const maxLevel = ref(0); // 最大层级
const selectedLevel = ref(1); // 当前选中的层级

const showIndentGuide = ref(true); // 添加缩进指南状态
const arrayNewLine = ref(true); // 添加数组换行控制开关
const isFullscreen = ref(false); // 添加全屏状态控制
const isResizing = ref(false); // 添加是否正在调整宽度控制
const leftPanelWidth = ref(50); // 添加面板宽度控制
const encodingMode = ref(0); // 添加编码处理模式：0-保持原样，1-转中文，2-转Unicode
const outputType = ref<'json' | 'yaml' | 'toml' | 'go'>('json'); // 添加当前输出类型的状态

const editorsInitialized = ref(false); // 在script setup部分添加
const inputEditorContainer = ref<HTMLElement | null>(null); // 输入编辑器容器
const outputEditorContainer = ref<HTMLElement | null>(null); // 输出编辑器容器
let inputEditor: monaco.editor.IStandaloneCodeEditor | null = null; // 输入编辑器实例
let outputEditor: monaco.editor.IStandaloneCodeEditor | null = null; // 输出编辑器实例
let lastMoveEvent: MouseEvent | TouchEvent | PointerEvent | null = null; // 鼠标移动事件
let lastMoveTime: number = 0; // 鼠标移动时间

// 添加示例数据
const placeholderJSON = {
    "name": "JSON Tool",
    "description": [
        "🌐 本地执行: 一个纯前端的JSON数据处理工具, 所有的功能操作均在本地浏览器中运行, 无服务端依赖, 保障数据隐私安全",
        "🔍 智能解析: 支持很多非标准JSON语法, 自动处理末项逗号; 兼容多种注释格式(//单行注释、#脚本式注释、/* 多行注释 */)",
        "⚠️ 内容限制: 输入内容≤9999行正常处理, 超限后自动截断末尾数据; 嵌套深度≤99层正常解析, 超限后自动清空输入区域内容",
        "🖥️ 屏幕适配: 为获得良好的响应式体验, 需要屏幕宽度大于900px才能正常使用, 小屏设备将自动隐藏工具界面并显示提示信息",
        "🐞 问题反馈: 如遇异常问题或功能建议, 请通过 liubing.xyz@qq.com 邮箱联系开发团队, 并附上【JSON工具】邮件标题"
    ],
    "settings": [
        {
            "name": "缩进空格",
            "values": ["2", "4", "8"],
            "detail": "仅对格式化功能生效, 并且只影响预览区域的缩进效果, 不会改变输入区域的缩进效果"
        },
        {
            "name": "编码模式",
            "values": ["保持原样", "转Unicode", "转中文"],
            "detail": "仅对格式化功能生效, 可以实现中文字符和Unicode字符之间的双向转换, 保持原样将保持编码不变"
        },
        {
            "name": "数组样式",
            "values": ["紧凑", "换行"],
            "detail": "仅对格式化功能生效, 简单数组(字符串/数字/布尔值)可以单行显示; 复杂结构数组自动换行显示"
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
                    "detail": "移除所有空白字符, 生成最小化的JSON数据"
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
                    "detail": "先压缩再转义, 适合需要在代码中嵌入JSON字符串的场景"
                },
                {
                    "name": "层级收缩",
                    "detail": "可以按照JSON的嵌套层级进行折叠, 方便查看大型JSON结构"
                }
            ]
        },
        {
            "category": "格式转换",
            "description": "支持多种数据格式的相互转换",
            "functions": [
                {
                    "name": "JSON 转 YAML",
                    "detail": "将JSON转换为YAML格式, 保持原有的数据结构和类型"
                },
                {
                    "name": "JSON 转 TOML",
                    "detail": "将JSON转换为TOML格式, 适合配置文件场景"
                },
                {
                    "name": "JSON 转 Go 结构体",
                    "detail": "生成与JSON结构匹配的Go语言结构体定义, 包含当前的json标签, 但是递归JSON转换结果不准确"
                },
                {
                    "name": "Cookie 转 JSON",
                    "detail": "将浏览器Cookie字符串解析为JSON对象, 支持分号或换行分隔的多Cookie解析"
                }
            ]
        },
        {
            "category": "编辑器功能",
            "description": "多种辅助功能提升用户使用体验",
            "functions": [
                {
                    "name": "分隔线拖拽",
                    "detail": "可拖动中间的分隔线调整输入区域和预览区域的宽度比例"
                },
                {
                    "name": "内容转移",
                    "detail": "通过分隔线顶部的箭头按钮, 可将预览区域中的处理结果快速转移到输入区域, 方便进行多步操作"
                },
                {
                    "name": "文件操作",
                    "detail": "支持上传本地JSON文件和下载数据处理结果, 上传的文件必须有.json后缀且是UTF-8编码"
                },
                {
                    "name": "全屏模式",
                    "detail": "支持全屏模式, 获得更大的编辑空间和更好的阅读体验"
                }
            ]
        },
        {
            "category": "编辑器快捷键",
            "description": "支持各种快捷键操作, 提升用户办公效率",
            "functions": [
                {
                    "name": "查找/替换",
                    "detail": "Windows/Linux: Ctrl+F查找, Ctrl+H替换; Mac: Command+F查找, Command+Option+F替换"
                },
                {
                    "name": "撤销/重做",
                    "detail": "Windows/Linux: Ctrl+Z撤销, Ctrl+Y重做; Mac: Command+Z撤销, Command+Shift+Z重做"
                },
                {
                    "name": "多光标编辑",
                    "detail": "Windows/Linux: Alt+点击添加光标, Ctrl+Alt+上/下添加光标; Mac: Option+点击添加光标, Command+Option+上/下添加光标"
                },
                {
                    "name": "跳转定位",
                    "detail": "Windows/Linux: Ctrl+G跳转到行, Ctrl+Home/End跳转文档首尾; Mac: Ctrl+G跳转到行, Command+↑/↓跳转文档首尾"
                },
                {
                    "name": "代码折叠",
                    "detail": "Windows/Linux: Ctrl+Shift+[折叠, Ctrl+Shift+]展开; Mac: Command+Option+[折叠, Command+Option+]展开"
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

// 计算行号宽度
const calculateLineNumberWidth = (lineCount: number): number => {
    return Math.max(String(lineCount).length, 1);
};

// 更新编辑器行号宽度
const updateLineNumberWidth = (editor: monaco.editor.IStandaloneCodeEditor | null) => {
    if (!editor) return;

    const lineCount = editor.getModel()?.getLineCount() || 0;
    const width = calculateLineNumberWidth(lineCount);
    const minChars = Math.max(String(lineCount).length, 1) + 1;

    editor.updateOptions({
        lineNumbers: 'on',
        lineNumbersMinChars: minChars,
        lineDecorationsWidth: width
    });
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
const getEditorOptions = (size: number, isReadOnly: boolean = false, language: string = 'json') => ({
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

    // 编辑器配置
    links: false, // 禁用链接检测功能
    tabSize: size, //  使用传入的大小作为Tab宽度
    indentSize: size, // 使用传入的大小作为缩进宽度
    autoClosingBrackets: 'languageDefined' as const, // 根据语言自动闭合括号
    autoClosingQuotes: 'languageDefined' as const, // 根据语言自动闭合引号
    formatOnPaste: true, // 启用粘贴时自动格式化
    maxUndoRedoEntries: 100, // 历史记录可撤销/重做的最大步数为100
    useTabStops: false, // 禁用TabStop
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
    }
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

// 添加窗口大小变化的处理函数
const handleResize = () => {
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
                    inputEditor = monaco.editor.create(inputEditorContainer.value, getEditorOptions(indentSize.value, false));
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
                    outputEditor = monaco.editor.create(outputEditorContainer.value, getEditorOptions(indentSize.value, true));
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
                        const value = inputEditor?.getValue() || '';
                        if (value.trim()) {
                            const cleanedContent = value.replace(/[\u0000-\u0019]+/g, '');
                            const limitedContent = limitLinesAndDeeps(cleanedContent);
                            if (cleanedContent !== limitedContent) {
                                inputEditor?.setValue(limitedContent);
                                maxLevel.value = 0;
                                selectedLevel.value = 1;
                                return;
                            }
                            try {
                                const parsed = preprocessJSON(cleanedContent);
                                maxLevel.value = calculateMaxLevel(parsed);
                            } catch (error) {
                                maxLevel.value = 0;
                            }
                        } else {
                            maxLevel.value = 0;
                            selectedLevel.value = 1;
                            outputEditor?.setValue('');
                            updateEditorHeight(outputEditor);
                        }
                    });
                }
                // outputEditor编辑器配置
                if (outputEditor) {
                    outputEditor.getModel()?.updateOptions({ tabSize: indentSize.value, insertSpaces: true });
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

// 检查行数和深度
const limitLinesAndDeeps = (content: string): string => {
    // 检查行数
    const lines = content.split('\n');
    if (lines.length > MAX_LINES) {
        showWarning('数据超过 9999 行, 已自动截断');
        return lines.slice(0, MAX_LINES).join('\n');
    }

    // 检查JSON深度
    try {
        const jsonData = preprocessJSON(content);
        const depth = getObjectDepth(jsonData);
        if (depth > 99) {
            showError('JSON深度超过 99 层, 请减少嵌套层级');
            return '"JSON深度超过 99 层, 请减少嵌套层级"';
        }
    } catch (e) {
        // 解析失败，可能不是有效的JSON，不进行深度检查
    }
    return content;
};

// 自定义 JSON 字符串化函数
const customStringify = (obj: any, replacer: null, space: number): string => {
    const indent = ' '.repeat(space);

    const isPrimitiveArray = (arr: any[]): boolean => {
        return arr.every(item =>
            typeof item === 'string' ||
            typeof item === 'number' ||
            typeof item === 'boolean' ||
            item === null
        );
    };

    const escapeString = (str: string): string => {
        // 处理特殊字符
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

// 字符串位置查找逻辑
const findStringPositions = (originalInput: string) => {
    const stringValuePositions: { start: number, end: number, value: string }[] = [];

    // 定义所有需要查找的正则表达式
    const patterns = [
        /:\s*"((?:\\.|[^"\\])*)"/g,  // 冒号后的字符串
        /\[\s*"((?:\\.|[^"\\])*)"/g,  // 数组开始的字符串
        /,\s*"((?:\\.|[^"\\])*)"/g    // 逗号后的字符串
    ];

    patterns.forEach(regex => {
        let match;
        while ((match = regex.exec(originalInput)) !== null) {
            const start = match.index + match[0].indexOf('"') + 1;
            const end = match.index + match[0].length - 1;
            const value = match[1];

            try {
                const decodedValue = JSON.parse('"' + value + '"');
                stringValuePositions.push({ start, end, value: decodedValue });
            } catch (e) {
                // 忽略解析错误
            }
        }
    });

    return stringValuePositions;
};

// 字符串原始编码处理逻辑
const processStringWithOriginalEncoding = (
    value: string,
    stringValuePositions: { start: number, end: number, value: string }[],
    originalInput: string
): string => {
    const originalPosition = stringValuePositions.find(pos => pos.value === value);
    if (originalPosition) {
        const originalRawString = originalInput.substring(originalPosition.start, originalPosition.end);
        return `"${originalRawString}"`;
    }
    return JSON.stringify(value);
};

// 格式化 JSON 并保留原始编码形式
const formatJsonWithOriginalFormat = (obj: any, originalInput: string, indentSize: number, useUserArrayStyle: boolean = true): string => {
    const stringValuePositions = findStringPositions(originalInput);

    const formatWithOriginalEncoding = (value: any, space: number, level: number = 0): string => {
        const indent = ' '.repeat(space);
        const padding = indent.repeat(level);

        if (value === null) return 'null';
        if (typeof value === 'string') return processStringWithOriginalEncoding(value, stringValuePositions, originalInput);
        if (typeof value === 'number' || typeof value === 'boolean') return String(value);

        if (Array.isArray(value)) {
            if (value.length === 0) return '[]';

            if (useUserArrayStyle && !arrayNewLine.value && value.every(item =>
                typeof item === 'string' ||
                typeof item === 'number' ||
                typeof item === 'boolean' ||
                item === null)) {
                const items = value.map(item => formatWithOriginalEncoding(item, space, 0));
                return `[${items.join(', ')}]`;
            }

            const items = value.map(item => `${padding}${indent}${formatWithOriginalEncoding(item, space, level + 1)}`);
            return `[\n${items.join(',\n')}\n${padding}]`;
        }

        if (typeof value === 'object') {
            const entries = Object.entries(value);
            if (entries.length === 0) return '{}';

            const items = entries.map(([key, val]) =>
                `${padding}${indent}"${key}": ${formatWithOriginalEncoding(val, space, level + 1)}`
            );
            return `{\n${items.join(',\n')}\n${padding}}`;
        }

        return JSON.stringify(value);
    };

    return formatWithOriginalEncoding(obj, indentSize);
};

// 压缩 JSON 并保留原始编码形式
const compressJsonWithOriginalEncoding = (obj: any, originalInput: string): string => {
    const stringValuePositions = findStringPositions(originalInput);

    const compressWithOriginalEncoding = (value: any): string => {
        if (value === null) return 'null';
        if (typeof value === 'string') return processStringWithOriginalEncoding(value, stringValuePositions, originalInput);
        if (typeof value === 'number' || typeof value === 'boolean') return String(value);

        if (Array.isArray(value)) {
            if (value.length === 0) return '[]';
            const items = value.map(item => compressWithOriginalEncoding(item));
            return `[${items.join(',')}]`;
        }

        if (typeof value === 'object') {
            const entries = Object.entries(value);
            if (entries.length === 0) return '{}';
            const items = entries.map(([key, val]) => `"${key}":${compressWithOriginalEncoding(val)}`);
            return `{${items.join(',')}}`;
        }

        return JSON.stringify(value);
    };

    return compressWithOriginalEncoding(obj);
};

// 添加JSON预处理函数
const preprocessJSON = (jsonString: string): any => {
    if (!jsonString || typeof jsonString !== 'string') {
        return null;
    }
    try {
        // 尝试直接解析
        return JSON.parse(jsonString);
    } catch (e) {
        // 第一步：预处理Python风格的UTF-8字节序列 \xXX
        try {
            const processUtf8ByteSequence = (str: string): string => {
                // 正则表达式匹配连续的\xXX序列
                return str.replace(/(?:\\x[0-9a-fA-F]{2})+/g, (match) => {
                    try {
                        // 提取所有十六进制值
                        const hexValues = match.match(/\\x([0-9a-fA-F]{2})/g)?.map(x =>
                            parseInt(x.substring(2), 16)) || [];

                        // 创建一个Uint8Array来存储这些字节
                        const bytes = new Uint8Array(hexValues);

                        // 使用TextDecoder将UTF-8字节数组解码为字符串
                        const decoder = new TextDecoder('utf-8');
                        const decodedText = decoder.decode(bytes);

                        return decodedText;
                    } catch (e) {
                        return match;
                    }
                });
            };

            // 处理整个JSON字符串
            const utf8Fixed = processUtf8ByteSequence(jsonString);

            // 尝试解析修复后的JSON
            try {
                return JSON.parse(utf8Fixed);
            } catch {
                // 继续下一步处理
            }
        } catch {
            // 转换失败，继续正常流程
        }

        // 第二步：使用逐字符解析的方式处理所有类型的注释，避免影响字符串内容
        let cleanedJSON = '';
        let inString = false;      // 是否在字符串内
        let inBacktickString = false; // 是否在反引号字符串内
        let escaped = false;       // 上一个字符是否为转义字符
        let inSingleLineComment = false;  // 是否在单行注释内
        let inMultiLineComment = false;   // 是否在多行注释内

        for (let i = 0; i < jsonString.length; i++) {
            const char = jsonString[i];
            const nextChar = jsonString[i + 1] || '';

            // 处理转义字符
            if (char === '\\' && !escaped) {
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

            // 处理字符串边界 - 反引号
            if (char === '`' && !escaped && !inString) {
                inBacktickString = !inBacktickString;
                if (!inSingleLineComment && !inMultiLineComment) {
                    // 将反引号转换为双引号
                    cleanedJSON += '"';
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

        // 移除空行和首尾空白
        cleanedJSON = cleanedJSON.split('\n')
            .map(line => line.trim())
            .filter(line => line)
            .join('\n')
            .trim();

        // 再次尝试处理UTF-8字节序列，但只针对字符串内的内容
        try {
            const processUtf8ByteSequence = (str: string): string => {
                return str.replace(/(?:\\x[0-9a-fA-F]{2})+/g, (match) => {
                    try {
                        const hexValues = match.match(/\\x([0-9a-fA-F]{2})/g)?.map(x =>
                            parseInt(x.substring(2), 16)) || [];
                        const bytes = new Uint8Array(hexValues);
                        const decoder = new TextDecoder('utf-8');
                        return decoder.decode(bytes);
                    } catch (e) {
                        return match;
                    }
                });
            };

            // 只处理字符串内的UTF-8序列
            cleanedJSON = cleanedJSON.replace(/"((?:\\.|[^"\\])*)"/g, (match, content) => {
                const processed = processUtf8ByteSequence(content);
                return `"${processed}"`;
            });
        } catch {
            // 忽略处理错误
        }

        try {
            return JSON.parse(cleanedJSON); // 如果仍然失败，会抛出异常
        } catch (finalError) {
            // 最后抛出原始错误
            throw finalError;
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
        // 根据缩进级别折叠
        const foldingRanges: Array<{ start: number, end: number }> = [];

        // 遍历所有行
        for (let i = 1; i <= model.getLineCount(); i++) {
            const lineContent = model.getLineContent(i);

            // 计算缩进级别 - 使用更精确的方法
            const indentMatch = lineContent.match(/^(\s+)/);
            const indentLevel = indentMatch
                ? Math.floor(indentMatch[1].length / indentSize.value)
                : 0;

            // 修复：特殊处理第1层
            if (selectedLevel.value === 1) {
                // 第1层是整个JSON对象，找到第一行和最后一行
                if (i === 1 && lineContent.trim() === '{') {
                    // 找到最后一行（闭合的大括号）
                    let lastLine = model.getLineCount();
                    for (let j = lastLine; j > i; j--) {
                        if (model.getLineContent(j).trim() === '}') {
                            lastLine = j;
                            break;
                        }
                    }

                    if (lastLine > i) {
                        foldingRanges.push({
                            start: i,
                            end: lastLine
                        });
                    }
                    break; // 找到第1层后退出循环
                }
                continue; // 如果不是第一行，继续查找
            }
            // 对于第N层，我们需要找到缩进级别为N-1的行
            const targetIndentLevel = selectedLevel.value - 1;

            // 检查是否包含对象或数组的开始
            let containsObjectOrArray = false;

            // 针对不同层级使用不同的检测方法
            if (selectedLevel.value === 2) {
                containsObjectOrArray = lineContent.includes('": {') || lineContent.includes('": [');
            } else if (selectedLevel.value === 3) {
                containsObjectOrArray = lineContent.trim().startsWith('{') ||
                    lineContent.includes('": {') ||
                    lineContent.includes('": [');
            } else {
                // 其他层级
                containsObjectOrArray = lineContent.includes('": {') || lineContent.includes('": [') ||
                    lineContent.trim().startsWith('{') || lineContent.trim().startsWith('[');
            }

            if (indentLevel === targetIndentLevel && containsObjectOrArray) {
                // 找到对应的结束行
                let depth = 0;
                let endLine = i;

                // 计算括号的深度
                for (const char of lineContent) {
                    if (char === '{' || char === '[') depth++;
                    if (char === '}' || char === ']') depth--;
                }

                // 如果当前行的括号没有闭合，查找闭合的行
                if (depth > 0) {
                    for (let j = i + 1; j <= model.getLineCount(); j++) {
                        const currentLine = model.getLineContent(j);

                        // 计算括号深度
                        for (const char of currentLine) {
                            if (char === '{' || char === '[') depth++;
                            if (char === '}' || char === ']') depth--;
                        }

                        // 如果括号已闭合，记录结束行
                        if (depth <= 0) {
                            endLine = j;
                            break;
                        }
                    }
                }

                // 如果找到了有效的折叠区域
                if (endLine > i) {
                    foldingRanges.push({
                        start: i,
                        end: endLine
                    });
                }
            }
        }

        // 执行折叠操作
        if (foldingRanges.length > 0 && outputEditor) {
            // 先展开所有折叠，确保从干净的状态开始
            outputEditor.trigger('unfold', 'editor.unfoldAll', null);

            // 使用异步函数逐个折叠区域
            const foldRangesSequentially = async () => {
                if (!outputEditor) return;

                // 从后向前折叠，避免折叠操作影响行号
                for (let i = foldingRanges.length - 1; i >= 0; i--) {
                    const range = foldingRanges[i];

                    try {
                        // 选择要折叠的区域
                        outputEditor.setSelection({
                            startLineNumber: range.start,
                            startColumn: 1,
                            endLineNumber: range.end,
                            endColumn: 1
                        });

                        // 执行折叠命令
                        outputEditor.trigger('fold', 'editor.fold', null);

                        // 等待一小段时间，确保折叠操作完成
                        await new Promise(resolve => setTimeout(resolve, 100));
                    } catch (err) {
                        throw err
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

            // 等待一小段时间确保展开操作完成，然后开始折叠
            setTimeout(() => {
                foldRangesSequentially();
            }, 100);
        } else {
            showInfo(`未找到可收缩的第 ${selectedLevel.value} 层内容`);
        }
    } catch (e) {
        showWarning('折叠操作部分失败, 请尝试手动折叠');
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
            parsed = preprocessJSON(value);
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

        // 保存原始输入以检测Unicode编码的字符
        const originalInput = value;

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
        try {
            parsed = preprocessJSON(preprocessedValue);
        } catch (error) {
            showError('请输入有效的 JSON 数据');
            return;
        }

        // 当选择保持原样时，我们需要确保Unicode编码保持原样
        if (encodingMode.value === 0) {
            const formattedWithOriginalFormat = formatJsonWithOriginalFormat(parsed, originalInput, indentSize.value, true);
            outputEditor?.setValue(formattedWithOriginalFormat);
        } else {
            const formatted = customStringify(parsed, null, indentSize.value);
            outputEditor?.setValue(formatted);
        }

        // 更新编辑器配置
        if (outputEditor) {
            // 更新编辑器语言
            const model = outputEditor.getModel();
            if (model) {
                monaco.editor.setModelLanguage(model, 'json');
            }

            // 更新其他配置
            outputEditor.updateOptions(getEditorOptions(indentSize.value, true, 'json'));
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

        // 保存原始输入以检测Unicode编码的字符
        const originalInput = value;

        // 预处理 JSON 字符串
        let parsed;
        try {
            parsed = preprocessJSON(value);
        } catch (error) {
            showError('请输入有效的 JSON 数据');
            return;
        }

        // 使用保持原始编码的压缩方法
        const compressed = compressJsonWithOriginalEncoding(parsed, originalInput);
        outputEditor?.setValue(compressed);

        // 更新编辑器配置
        if (outputEditor) {
            // 更新编辑器语言
            const model = outputEditor.getModel();
            if (model) {
                monaco.editor.setModelLanguage(model, 'json');
            }

            // 更新其他配置
            outputEditor.updateOptions(getEditorOptions(indentSize.value, true, 'json'));
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

        // 保存原始输入以检测Unicode编码的字符
        const originalInput = value;

        // 预处理 JSON 字符串
        let parsed;
        try {
            parsed = preprocessJSON(value);
        } catch (error) {
            showError('请输入有效的 JSON 数据');
            return;
        }

        // 转义的时候的数据缩进只能为2，并且强制使用换行格式处理数组
        const formattedWithOriginalEncoding = formatJsonWithOriginalFormat(parsed, originalInput, 2, false);

        // 直接对格式化后的字符串进行转义处理
        let escaped = formattedWithOriginalEncoding
            .replace(/\\/g, '\\\\')  // 所有反斜杠先变成双反斜杠
            .replace(/"/g, '\\"');   // 所有双引号转义为\"

        outputEditor?.setValue(escaped);

        // 更新编辑器配置
        if (outputEditor) {
            // 更新编辑器语言
            const model = outputEditor.getModel();
            if (model) {
                monaco.editor.setModelLanguage(model, 'json');
            }

            // 更新其他配置
            outputEditor.updateOptions(getEditorOptions(indentSize.value, true, 'json'));
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
        let parsedInput = null;
        try {
            // 先尝试直接解析
            parsedInput = JSON.parse(value);
        } catch {
            // 如果直接解析失败，尝试用宽松模式处理
            try {
                parsedInput = preprocessJSON(value);
            } catch {
                // 不是有效的JSON，将进行基本转义处理
            }
        }

        // 如果成功解析为对象或数组，进行递归处理
        if (parsedInput !== null && typeof parsedInput === 'object') {
            try {
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
                        if ((obj.includes('\\"') || obj.includes('\\\\')) &&
                            (obj.includes('{') || obj.includes('['))) {
                            try {
                                // 尝试解析转义JSON字符串
                                // 替换转义字符，但要确保不直接产生无效JSON
                                const unescaped = obj.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
                                JSON.parse(unescaped) // 尝试解析确认是合法JSON
                                return unescaped;
                            } catch (e) {
                                // 解析失败，返回原始字符串
                                return obj;
                            }
                        }
                    }

                    // 其他类型直接返回
                    return obj;
                }

                // 处理整个JSON对象
                const processedJson = processObject(parsedInput);

                // 使用formatJsonWithOriginalFormat保持原始编码，强制使用换行格式处理数组
                try {
                    const formattedResult = formatJsonWithOriginalFormat(processedJson, originalInput, 2, false);
                    outputEditor?.setValue(formattedResult);
                } catch (formatError) {
                    // 格式化失败，尝试标准格式化
                    const formatted = JSON.stringify(processedJson, null, 2);
                    outputEditor?.setValue(formatted);
                }

                // 更新编辑器配置
                if (outputEditor) {
                    // 更新编辑器语言
                    const model = outputEditor.getModel();
                    if (model) {
                        monaco.editor.setModelLanguage(model, 'json');
                    }

                    // 更新其他配置
                    outputEditor.updateOptions(getEditorOptions(indentSize.value, true, 'json'));
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
                                    outputEditor.updateOptions(getEditorOptions(indentSize.value, true, 'json'));
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
                                outputEditor.updateOptions(getEditorOptions(indentSize.value, true, 'json'));
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
        // 但要注意，只处理明显的转义模式，避免过度处理
        let result = originalInput;

        // 只有当确实有转义字符时才进行处理
        if (originalInput.includes('\\')) {
            // 检查内容是否有明显的JSON转义特征
            const hasJsonEscapes = /\\["\\\/bfnrt]/.test(originalInput);
            const hasUnicodeEscapes = /\\u[\da-fA-F]{4}/.test(originalInput);

            if (hasJsonEscapes || hasUnicodeEscapes) {
                try {
                    // 使用最保守的替换规则
                    result = originalInput
                        .replace(/\\"/g, '"')
                        .replace(/\\\\/g, '\\')
                        .replace(/\\n/g, '\n')
                        .replace(/\\t/g, '\t')
                        .replace(/\\r/g, '\r')
                        .replace(/\\b/g, '\b')
                        .replace(/\\f/g, '\f');

                    // 处理Unicode转义序列
                    if (hasUnicodeEscapes) {
                        result = result.replace(/\\u([\da-fA-F]{4})/g, (_, hex) => {
                            return String.fromCharCode(parseInt(hex, 16));
                        });
                    }
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
                    outputEditor.updateOptions(getEditorOptions(indentSize.value, true, 'json'));
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
                    outputEditor.updateOptions(getEditorOptions(indentSize.value, true, 'json'));
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
                outputEditor.updateOptions(getEditorOptions(indentSize.value, true, 'json'));
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

        // 保存原始输入以检测Unicode编码的字符
        const originalInput = value;

        // 预处理 JSON 字符串
        let parsed;
        try {
            parsed = preprocessJSON(value);
        } catch (error) {
            showError('请输入有效的 JSON 数据');
            return;
        }

        // 使用保持原始编码的压缩方法
        const compressed = compressJsonWithOriginalEncoding(parsed, originalInput);

        // 转义处理 - 对压缩后的JSON字符串进行JSON转义
        let escaped = JSON.stringify(compressed);
        if (escaped.startsWith('\"') && escaped.endsWith('\"')) {
            escaped = escaped.slice(1, -1);
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
            outputEditor.updateOptions(getEditorOptions(indentSize.value, true, 'json'));
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
        let parsed;
        try {
            parsed = preprocessJSON(value);
        } catch (error) {
            showError('请输入有效的 JSON 数据');
            return;
        }

        // 格式化JSON以确保结构正确
        const formatted = JSON.stringify(parsed, null, indentSize.value);

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
            outputEditor.updateOptions(getEditorOptions(indentSize.value, true, 'json'));
            updateLineNumberWidth(outputEditor);
            updateEditorHeight(outputEditor);
        }

        // 等待编辑器渲染完成后执行折叠操作
        setTimeout(() => {
            if (!outputEditor) return;
            outputEditor.trigger('unfold', 'editor.unfoldAll', null);
            foldByIndentation();
        }, 100);
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
        if (processedTypes.has(structName)) return '';
        processedTypes.add(structName);

        let structDef = '';

        // 处理数组特殊情况
        if (Array.isArray(obj)) {
            if (obj.length > 0 && typeof obj[0] === 'object') {
                const itemType = getStructName(parentKey, parentKey);
                structDef = processStruct(obj[0], itemType, parentKey);
                return structDef;
            }
            return '';
        }

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
        result = processStruct(obj, 'Root');
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
            showError('文件大小不能超过 1MB');
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

        // 3. 内容安全检查
        if (content.length > MAX_FILE_SIZE) {
            showError('文件内容超过限制');
            return;
        }

        // 检查行数
        const lines = content.split('\n');
        const isContentTruncated = lines.length > MAX_LINES;
        const limitedContent = isContentTruncated ? lines.slice(0, MAX_LINES).join('\n') : content;

        // JSON格式检查和处理
        try {
            // 解析JSON并检查深度
            const jsonData = preprocessJSON(limitedContent);
            const depth = getObjectDepth(jsonData);

            if (depth > 99) {
                showError('JSON深度超过99层, 不允许上传');
                return;
            }

            // 格式化JSON
            const formattedJson = JSON.stringify(jsonData, null, 2);

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

            // 显示适当的提示信息
            if (isContentTruncated) {
                showWarning('文件内容超过 9999 行, 已自动截断');
            } else {
                showSuccess('文件上传成功');
            }
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

                // 清空内容
                inputEditor.setValue('');

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

                // 清空内容
                outputEditor.setValue('');

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

// 分割线拖动实现
const startResize = (e: MouseEvent | TouchEvent) => {
    isResizing.value = true;

    // 禁用选择和默认事件
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';

    // 记录初始位置
    const initialX = e instanceof MouseEvent ? e.clientX : e.touches[0].clientX;
    const container = document.querySelector('.editor-container');
    if (!container) return; // 添加空检查

    // 捕获指针，确保即使鼠标移出元素也能接收事件
    if (e instanceof PointerEvent && e.target instanceof HTMLElement) {
        e.target.setPointerCapture(e.pointerId);
    }

    const rect = container.getBoundingClientRect();
    const initialPercentage = leftPanelWidth.value;

    // 最小宽度设置
    const minWidthPercent = (250 / rect.width) * 100;

    // 使用 pointermove 事件替代 mousemove，更好地处理快速移动
    const handlePointerMove = (moveEvent: MouseEvent | TouchEvent | PointerEvent) => {
        if (!isResizing.value) return;

        // 使用变量记录上一次的位置变化速度，检测"甩动"行为
        const now = Date.now();
        let moveSpeed = 0;

        if (lastMoveEvent) {
            const timeDiff = now - lastMoveTime;
            const posDiff = 'clientX' in moveEvent && 'clientX' in lastMoveEvent ?
                Math.abs(moveEvent.clientX - lastMoveEvent.clientX) : 0;

            // 计算移动速度(像素/毫秒)
            moveSpeed = timeDiff > 0 ? posDiff / timeDiff : 0;
        }

        lastMoveEvent = moveEvent;
        lastMoveTime = now;

        // 判断是否为快速拖动
        const isQuickMove = moveSpeed > 0.0001;

        // 防止频繁计算，使用 requestAnimationFrame
        requestAnimationFrame(() => {
            let clientX: number;

            // 处理不同事件类型
            if ('touches' in moveEvent && moveEvent.touches.length > 0) {
                clientX = moveEvent.touches[0].clientX;
            } else if ('clientX' in moveEvent) {
                clientX = moveEvent.clientX;
            } else {
                return // 无法获取位置，退出
            }

            // 限制鼠标位置在容器内
            clientX = Math.max(rect.left + 250, Math.min(clientX, rect.right - 250));

            // 计算鼠标移动距离对应的百分比变化
            const deltaX = clientX - initialX;
            const deltaPercentage = (deltaX / rect.width) * 100;

            // 计算新的百分比宽度，并限制在合理范围内
            let newWidth = Math.min(Math.max(initialPercentage + deltaPercentage, minWidthPercent), 100 - minWidthPercent);

            // 边界处理 - 接近边界时自动对齐
            if (newWidth < minWidthPercent + 2 || newWidth > 100 - minWidthPercent - 2) {
                setTimeout(() => {
                    requestAnimationFrame(() => {
                        if (inputEditor) inputEditor.layout();
                        if (outputEditor) outputEditor.layout();
                    });
                }, 0);
            }

            // 更新面板宽度
            if (newWidth !== leftPanelWidth.value) {
                leftPanelWidth.value = newWidth;

                // 如果是快速移动，增加多次强制布局更新
                if (isQuickMove) {
                    setTimeout(() => {
                        requestAnimationFrame(() => {
                            if (inputEditor) inputEditor.layout();
                            if (outputEditor) outputEditor.layout();
                        });
                    }, 0);
                }
            }
        });
    };

    const stopResize = (upEvent?: Event) => {
        if (!isResizing.value) return;

        isResizing.value = false;
        document.body.style.userSelect = '';
        document.body.style.cursor = '';

        // 释放指针捕获
        if (upEvent instanceof PointerEvent && e instanceof PointerEvent && e.target instanceof HTMLElement) {
            try {
                e.target.releasePointerCapture(upEvent.pointerId);
            } catch (err) {
                // 忽略错误
            }
        }

        // 移除所有事件监听
        document.removeEventListener('pointermove', handlePointerMove);
        document.removeEventListener('pointerup', stopResize);
        document.removeEventListener('mousemove', handlePointerMove);
        document.removeEventListener('touchmove', handlePointerMove);
        document.removeEventListener('mouseup', stopResize);
        document.removeEventListener('touchend', stopResize);

        const updateCount = 1000;
        const updateLayout = (count: number) => {
            if (count <= 0) return;

            setTimeout(() => {
                if (inputEditor) inputEditor.layout();
                if (outputEditor) outputEditor.layout();
                updateLayout(count - 1);
            }, 10) // 约一帧的时间
        }

        updateLayout(updateCount);
    };

    // 使用 pointer 事件，它同时适用于鼠标和触摸
    document.addEventListener('pointermove', handlePointerMove as EventListener, { passive: true });
    document.addEventListener('pointerup', stopResize as EventListener);

    // 兼容性支持
    document.addEventListener('mousemove', handlePointerMove as EventListener);
    document.addEventListener('touchmove', handlePointerMove as EventListener, { passive: true });
    document.addEventListener('mouseup', stopResize);
    document.addEventListener('touchend', stopResize, { passive: true });

    // 阻止默认行为
    if (e instanceof MouseEvent) {
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

        let contentToTransfer = outputContent;
        try {
            const parsed = preprocessJSON(outputContent);
            contentToTransfer = JSON.stringify(parsed, null, 2);
        } catch {
            // 不是有效JSON，保持原样
        }

        // 转移内容到输入区域
        if (inputEditor) {
            inputEditor.setValue(contentToTransfer);
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
    min-width: 250px;
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
}

.panel-title {
    display: flex;
    align-items: center;
    font-size: 15px;
    font-weight: 600;
    color: #303133;
}

.panel-title i {
    margin-right: 6px;
    color: #409EFF;
}

.panel-actions {
    display: flex;
    gap: 12px;
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
</style>