<template>
    <div>
        <!-- 获取JSON数据对话框 -->
        <el-dialog
            v-model="dialogVisible"
            class="fetch-json-main-dialog"
            :close-on-click-modal="false"
            :show-close="true"
            :align-center="false"
            top="12vh"
            width="850px"
            @close="handleDialogClose"
        >
            <template #header>
                <div class="dialog-header">
                    <span class="dialog-title">获取JSON数据</span>
                    <el-radio-group v-model="fetchJsonMode" class="fetch-mode-group" size="small">
                        <el-radio-button value="url">表单输入</el-radio-button>
                        <el-radio-button value="curl">命令导入</el-radio-button>
                    </el-radio-group>
                </div>
            </template>
            <div class="fetch-json-dialog">

                <!-- URL方式 -->
                <div v-if="fetchJsonMode === 'url'" class="fetch-mode-content">
                    <div class="form-item">
                        <div style="display: flex; justify-content: flex-end; width: 100%;">
                            <div style="display: flex; gap: 10px;">
                                <el-button size="small" type="success" @click="openSaveConfigDialog">
                                    <el-icon style="margin-right: 3px;"><DocumentAdd /></el-icon>保存配置
                                </el-button>
                                <el-button size="small" type="info" @click="openLoadConfigDialog">
                                    <el-icon style="margin-right: 3px;"><Folder /></el-icon>加载配置
                                </el-button>
                                <el-button size="small" type="danger" @click="openDeleteConfigDialog" :disabled="savedConfigs.length === 0">
                                    <el-icon style="margin-right: 3px;"><Delete /></el-icon>删除配置
                                </el-button>
                            </div>
                        </div>
                    </div>
                    <div class="form-item">
                        <label class="form-label">请求URL</label>
                        <el-input
                            v-model="fetchJsonUrl"
                            placeholder="请输入URL，例如: https://api.example.com/data.json"
                            clearable
                            :maxlength="MAX_URL_LENGTH"
                            show-word-limit
                        />
                        <div v-if="urlError" class="field-error">{{ urlError }}</div>
                    </div>

                    <div class="form-item">
                        <label class="form-label">请求方法</label>
                        <el-select v-model="fetchJsonMethod" style="width: 100%">
                            <el-option label="GET" value="GET" />
                            <el-option label="POST" value="POST" />
                            <el-option label="PUT" value="PUT" />
                            <el-option label="PATCH" value="PATCH" />
                            <el-option label="DELETE" value="DELETE" />
                        </el-select>
                    </div>

                    <div class="form-item" v-if="fetchJsonMethod !== 'GET'">
                        <label class="form-label">请求体</label>
                        <el-input
                            v-model="fetchJsonBody"
                            type="textarea"
                            :autosize="{ minRows: 3, maxRows: requestBodyMaxRows }"
                            placeholder="请输入请求体（支持JSON、XML、Form Data等多种格式，根据Content-Type自动识别）"
                            class="request-body-textarea"
                            :show-word-limit="false"
                        />
                        <div class="textarea-footer">
                            <div v-if="requestBodyError" class="field-error">{{ requestBodyError }}</div>
                            <div class="textarea-counter">
                                字符数：{{ fetchJsonBody.length }} | 字节数：{{ requestBodyByteSize }} / {{ (MAX_REQUEST_BODY_SIZE / 1024 / 1024).toFixed(0) }} MB
                            </div>
                        </div>
                    </div>

                    <div class="form-item">
                        <div class="form-label-row">
                            <label class="form-label">请求头</label>
                            <el-button size="small" type="primary" @click="addHeader">添加</el-button>
                        </div>
                        <div v-if="showEmptyHeaderWarning && hasEmptyHeader && fetchJsonHeaders.length > 0" style="color: #f56c6c; font-size: 12px; margin-top: 5px; margin-bottom: 5px;">
                            请先填写已有的请求头，再添加新的请求头
                        </div>
                        <div v-if="addHeaderError" style="color: #f56c6c; font-size: 12px; margin-top: 5px; margin-bottom: 5px;">
                            {{ addHeaderError }}
                        </div>
                        <div class="headers-list">
                            <div v-for="(header, index) in fetchJsonHeaders" :key="index" class="header-item">
                                <div class="header-input-wrapper">
                                    <el-autocomplete
                                        v-model="header.key"
                                        :fetch-suggestions="fetchHeaderKeySuggestions"
                                        placeholder="Header名称"
                                        class="header-key-input"
                                        :maxlength="MAX_HEADER_KEY_LENGTH"
                                        clearable
                                    />
                                    <div class="header-field-error" :class="{ 'header-field-error-hidden': !headerErrors[index]?.keyError }">
                                        <span v-if="headerErrors[index]?.keyError">{{ headerErrors[index].keyError }}</span>
                                    </div>
                                </div>
                                <div class="header-input-wrapper">
                                    <el-autocomplete
                                        v-model="header.value"
                                        :fetch-suggestions="fetchHeaderValueSuggestions(header.key)"
                                        placeholder="Header值"
                                        class="header-value-input"
                                        :maxlength="MAX_HEADER_VALUE_LENGTH"
                                        clearable
                                    />
                                    <div class="header-field-error" :class="{ 'header-field-error-hidden': !headerErrors[index]?.valueError }">
                                        <span v-if="headerErrors[index]?.valueError">{{ headerErrors[index].valueError }}</span>
                                    </div>
                                </div>
                                <el-button
                                    size="small"
                                    type="danger"
                                    @click="removeHeader(index)"
                                    class="header-delete-btn"
                                >
                                    删除
                                </el-button>
                            </div>
                            <div v-if="fetchJsonHeaders.length === 0" class="empty-hint">
                                暂无请求头，点击"添加"按钮添加
                            </div>
                        </div>
                    </div>

                    <div class="form-item">
                        <div class="form-label-row">
                            <label class="form-label">客户端证书（可选）</label>
                            <el-button
                                size="small"
                                type="primary"
                                plain
                                @click="showCertUpload = !showCertUpload"
                            >
                                {{ showCertUpload ? '隐藏证书配置' : '添加证书配置' }}
                            </el-button>
                        </div>
                        <div v-if="showCertUpload" class="cert-upload">
                            <div class="cert-item">
                                <label class="cert-label">证书文件（.pem）：</label>
                                <el-upload
                                    :auto-upload="false"
                                    :show-file-list="false"
                                    :on-change="handleCertUpload"
                                    accept=".pem,.crt"
                                >
                                    <el-button size="small" type="primary">上传证书</el-button>
                                </el-upload>
                                <span v-if="fetchJsonCert" class="cert-name">{{ certFileName }}</span>
                                <el-button
                                    v-if="fetchJsonCert"
                                    size="small"
                                    type="danger"
                                    @click="clearCert"
                                    class="cert-clear-btn"
                                >
                                    清除
                                </el-button>
                            </div>
                            <div class="cert-item">
                                <label class="cert-label">私钥文件（.pem）：</label>
                                <el-upload
                                    :auto-upload="false"
                                    :show-file-list="false"
                                    :on-change="handleKeyUpload"
                                    accept=".pem,.key"
                                >
                                    <el-button size="small" type="primary">上传私钥</el-button>
                                </el-upload>
                                <span v-if="fetchJsonKey" class="cert-name">{{ keyFileName }}</span>
                                <el-button
                                    v-if="fetchJsonKey"
                                    size="small"
                                    type="danger"
                                    @click="clearKey"
                                    class="cert-clear-btn"
                                >
                                    清除
                                </el-button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- cURL命令方式 -->
                <div v-if="fetchJsonMode === 'curl'" class="fetch-mode-content">
                    <div class="form-item">
                        <label class="form-label">cURL命令</label>
                        <el-input
                            v-model="fetchJsonCurlCommand"
                            type="textarea"
                            :rows="6"
                            placeholder="请输入cURL命令，例如: curl -X GET 'https://api.example.com/data.json' -H 'Authorization: Bearer token'"
                            class="curl-command-textarea"
                            :maxlength="MAX_CURL_COMMAND_LENGTH"
                            show-word-limit
                        />
                        <div v-if="curlCommandError" class="field-error">{{ curlCommandError }}</div>
                    </div>
                </div>
            </div>
            <template #footer>
                <div class="dialog-footer">
                    <el-button @click="handleDialogClose">取消</el-button>
                    <el-button type="primary" @click="fetchJsonData" :loading="fetchJsonLoading">
                        获取数据
                    </el-button>
                </div>
            </template>
        </el-dialog>

        <!-- 保存配置对话框 -->
        <el-dialog
            v-model="showConfigDialog"
            title="保存配置"
            class="config-save-dialog-wrapper"
            :close-on-click-modal="false"
            :align-center="false"
            top="20vh"
        >
            <div class="config-save-dialog">
                <div v-if="saveConfigError" style="color: #f56c6c; font-size: 12px; margin-bottom: 15px; padding: 10px; background-color: #fef0f0; border-radius: 4px;">
                    {{ saveConfigError }}
                </div>
                <div class="form-item">
                    <label class="form-label">配置名称：</label>
                    <el-input
                        v-model="configName"
                        placeholder="请输入配置名称，例如：API测试环境"
                        clearable
                        :maxlength="MAX_CONFIG_NAME_LENGTH"
                        show-word-limit
                    />
                    <div v-if="configNameError" class="field-error">{{ configNameError }}</div>
                </div>
                <div class="form-item">
                    <div class="config-preview">
                        <div class="preview-item">
                            <span class="preview-label">URL：</span>
                            <span class="preview-value">{{ fetchJsonUrl || '未设置' }}</span>
                        </div>
                        <div class="preview-item">
                            <span class="preview-label">方法：</span>
                            <span class="preview-value">{{ fetchJsonMethod }}</span>
                        </div>
                        <div class="preview-item" v-if="fetchJsonMethod !== 'GET'">
                            <span class="preview-label">请求体：</span>
                            <span class="preview-value">{{ fetchJsonBody ? '已设置' : '未设置' }}</span>
                        </div>
                        <div class="preview-item">
                            <span class="preview-label">请求头：</span>
                            <span class="preview-value">{{ fetchJsonHeaders.length }} 个</span>
                        </div>
                    </div>
                </div>
            </div>
            <template #footer>
                <div class="dialog-footer">
                    <el-button @click="showConfigDialog = false">取消</el-button>
                    <el-button type="primary" :disabled="isSaveConfigDisabled" @click="saveConfig">保存</el-button>
                </div>
            </template>
        </el-dialog>

        <!-- 加载配置对话框 -->
        <el-dialog
            v-model="showLoadConfigDialog"
            title="选择要加载的配置"
            class="config-load-dialog-wrapper"
            :close-on-click-modal="false"
            :align-center="false"
            top="20vh"
        >
            <div class="config-load-dialog">
                <div v-if="loadConfigError" style="color: #f56c6c; font-size: 12px; margin-bottom: 15px; padding: 10px; background-color: #fef0f0; border-radius: 4px;">
                    {{ loadConfigError }}
                </div>
                <div v-if="savedConfigs.length === 0" class="empty-configs">
                    <el-empty description="暂无保存的配置" />
                </div>
                <div v-else class="configs-list">
                    <div
                        v-for="(config, index) in savedConfigs"
                        :key="index"
                        class="config-item-wrapper"
                        @click="loadConfig(config)"
                    >
                        <div class="config-item">
                            <div class="config-info">
                                <div class="config-name">{{ config.name }}</div>
                                <div class="config-details">
                                    <el-tag size="small" type="info">{{ config.method }}</el-tag>
                                    <span class="config-url">{{ config.url }}</span>
                                    <span class="config-headers">{{ config.headers.length }} 个请求头</span>
                                </div>
                            </div>
                            <el-icon class="select-icon"><ArrowRight /></el-icon>
                        </div>
                    </div>
                </div>
            </div>
            <template #footer>
                <div class="dialog-footer">
                    <el-button @click="showLoadConfigDialog = false">取消</el-button>
                </div>
            </template>
        </el-dialog>

        <!-- 删除配置对话框 -->
        <el-dialog
            v-model="showDeleteConfigDialog"
            title="选择要删除的配置"
            class="config-delete-dialog-wrapper"
            :close-on-click-modal="false"
            :align-center="false"
            top="20vh"
            @close="handleDeleteConfigDialogClose"
        >
            <div class="config-delete-dialog">
                <div v-if="savedConfigs.length === 0" class="empty-configs">
                    <el-empty description="暂无保存的配置" />
                </div>
                <div v-else class="configs-list">
                    <div
                        v-for="(config, index) in savedConfigs"
                        :key="index"
                        class="config-item-wrapper"
                    >
                        <div class="config-item">
                            <div class="config-info">
                                <div class="config-name">{{ config.name }}</div>
                                <div class="config-details">
                                    <el-tag size="small" type="info">{{ config.method }}</el-tag>
                                    <span class="config-url">{{ config.url }}</span>
                                    <span class="config-headers">{{ config.headers.length }} 个请求头</span>
                                </div>
                            </div>
                            <el-button
                                size="small"
                                type="danger"
                                @click="confirmDelete(index)"
                                :disabled="confirmingDeleteIndex === index"
                            >
                                删除
                            </el-button>
                        </div>
                        <!-- 内联确认删除提示 -->
                        <div v-if="confirmingDeleteIndex === index" class="delete-confirm">
                            <div class="delete-confirm-content">
                                <el-icon class="delete-warning-icon"><Warning /></el-icon>
                                <span class="delete-confirm-text">确定要删除配置 "{{ config.name }}" 吗？</span>
                            </div>
                            <div class="delete-confirm-actions">
                                <el-button size="small" @click="cancelDelete">取消</el-button>
                                <el-button size="small" type="danger" @click="executeDelete(index)">确认删除</el-button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <template #footer>
                <div class="dialog-footer">
                    <el-button @click="showDeleteConfigDialog = false">取消</el-button>
                </div>
            </template>
        </el-dialog>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Warning, ArrowRight, DocumentAdd, Folder, Delete } from '@element-plus/icons-vue';
import type { UploadFile } from 'element-plus';
import type * as monaco from 'monaco-editor';

// Props
interface Props {
    modelValue: boolean;
    indentSize: number;
    inputEditor: monaco.editor.IStandaloneCodeEditor | null;
}

const props = defineProps<Props>();

// Emits
const emit = defineEmits<{
    'update:modelValue': [value: boolean];
}>();

// 安全限制常量
const MAX_URL_LENGTH = 300; // URL最大长度
const MAX_CURL_COMMAND_LENGTH = 3000; // cURL命令最大长度
const MAX_HEADER_COUNT = 100; // 最大请求头数量
const MAX_HEADER_KEY_LENGTH = 100; // 请求头Key最大长度
const MAX_HEADER_VALUE_LENGTH = 300; // 请求头Value最大长度
const MAX_REQUEST_BODY_SIZE = 2 * 1024 * 1024; // 请求体最大大小：2MB
const MAX_CERT_SIZE = 50 * 1024; // 证书最大大小：50KB
const MAX_KEY_SIZE = 50 * 1024; // 私钥最大大小：50KB
const MAX_CONFIG_NAME_LENGTH = 30; // 配置名称最大长度
const MAX_CONFIG_COUNT = 5; // 最大保存的配置数量

// 非法字符正则表达式
const INVALID_HEADER_KEY_CHARS = /[\r\n]/; // 请求头Key不允许换行符
const INVALID_HEADER_VALUE_CHARS = /[\r\n]/; // 请求头Value不允许换行符（某些值可能包含换行，但这里为了安全限制）
const INVALID_CONFIG_NAME_CHARS = /[<>:"/\\|?*\x00-\x1F]/; // 配置名称不允许的字符

// 对话框显示状态
const dialogVisible = computed({
    get: () => props.modelValue,
    set: (value) => emit('update:modelValue', value)
});

// 获取JSON数据对话框相关状态
const fetchJsonMode = ref<'url' | 'curl'>('url');
const fetchJsonUrl = ref('');
const fetchJsonMethod = ref('GET');
const fetchJsonBody = ref('');
const fetchJsonHeaders = ref<Array<{ key: string; value: string }>>([]);
const showEmptyHeaderWarning = ref(false);
const showCertUpload = ref(false);
const fetchJsonCert = ref('');
const fetchJsonKey = ref('');
const certFileName = ref('');
const keyFileName = ref('');
const fetchJsonCurlCommand = ref('');
const fetchJsonLoading = ref(false);

// 配置保存/加载相关
const showConfigDialog = ref(false);
const showLoadConfigDialog = ref(false);
const showDeleteConfigDialog = ref(false);
const configName = ref('');
const savedConfigs = ref<Array<{
    name: string;
    url: string;
    method: string;
    body: string;
    headers: Array<{ key: string; value: string }>;
}>>([]);
const CONFIG_STORAGE_KEY = 'json-tool-saved-configs';

// 错误提示信息
const saveConfigError = ref('');
const loadConfigError = ref('');
const addHeaderError = ref('');

// 实时校验错误信息
const urlError = ref('');
const requestBodyError = ref('');
const curlCommandError = ref('');
const configNameError = ref('');
const headerErrors = ref<Array<{ keyError: string; valueError: string }>>([]);

// 删除确认状态
const confirmingDeleteIndex = ref<number | null>(null);

// 窗口高度和动态计算相关
const windowHeight = ref(typeof window !== 'undefined' ? window.innerHeight : 1080);
const dialogTopOffset = 12; // 弹窗距离顶部的百分比 (12vh)
const dialogHeaderHeight = 60; // 弹窗头部高度（估算）
const dialogFooterHeight = 60; // 弹窗底部按钮高度（估算）
const dialogPadding = 40; // 弹窗内边距（估算）
const formItemSpacing = 24; // 表单项间距
const lineHeight = 22; // textarea 每行高度（估算）

const DEFAULT_HOST = typeof window !== 'undefined'
    ? window.location.host || 'example.com'
    : 'example.com';

const DEFAULT_USER_AGENT = typeof navigator !== 'undefined'
    ? navigator.userAgent
    : 'Mozilla/5.0';

// 计算请求体文本框的最大行数
const requestBodyMaxRows = computed(() => {
    if (typeof window === 'undefined') return 10;
    
    // 计算可用高度
    // 视口高度 - 弹窗顶部偏移 - 弹窗头部 - 弹窗底部 - 内边距 - 其他表单项高度
    const topOffset = windowHeight.value * dialogTopOffset / 100; // 顶部偏移 (12vh)
    const availableHeight = windowHeight.value 
        - topOffset // 顶部偏移
        - dialogHeaderHeight // 头部（标题和按钮）
        - dialogFooterHeight // 底部（取消和获取数据按钮）
        - dialogPadding * 2 // 上下内边距
        - 250; // 其他表单项（URL、方法、请求头等）的估算高度，留一些余量
    
    // 计算最大行数（每行约22px高度）
    const maxRows = Math.floor(availableHeight / lineHeight);
    
    // 限制在合理范围内（最小3行，最大25行）
    return Math.max(3, Math.min(25, maxRows));
});

// 窗口大小变化监听
const handleResize = () => {
    if (typeof window !== 'undefined') {
        windowHeight.value = window.innerHeight;
    }
};

// 常用请求头列表
const commonHeaders = [
    'Content-Type',
    'Authorization',
    'Accept',
    'User-Agent',
    'X-Requested-With',
    'Cache-Control',
    'Cookie',
    'Referer',
    'Origin',
    'Accept-Language',
    'Accept-Encoding',
    'Connection',
    'Host',
    'If-Modified-Since',
    'If-None-Match',
    'X-Forwarded-For',
    'X-API-Key',
    'X-Auth-Token',
    'Bearer'
];

// 请求头值建议
const headerValueSuggestions: Record<string, string[]> = {
    'Content-Type': [
        'application/json',
        'application/xml',
        'application/x-www-form-urlencoded',
        'multipart/form-data',
        'text/plain',
        'text/html',
        'text/xml',
        'application/javascript',
        'application/pdf',
        'image/jpeg',
        'image/png',
        'image/gif'
    ],
    'Accept': [
        'application/json',
        'application/xml',
        'text/html',
        'text/plain',
        '*/*'
    ],
    'Authorization': [
        'Bearer ',
        'Basic ',
        'Digest ',
        'OAuth '
    ],
    'Cache-Control': [
        'no-cache',
        'no-store',
        'must-revalidate',
        'max-age=0',
        'private',
        'public'
    ],
    'Connection': [
        'keep-alive',
        'close'
    ],
    'Accept-Encoding': [
        'gzip',
        'deflate',
        'br',
        'identity'
    ],
    'Accept-Language': [
        'zh-CN,zh;q=0.9,en;q=0.8',
        'en-US,en;q=0.9',
        'zh-CN,zh;q=0.9'
    ],
    'Sec-Fetch-Site': [
        'same-origin',
        'same-site',
        'cross-site',
        'none'
    ],
    'Sec-Fetch-Mode': [
        'cors',
        'no-cors',
        'same-origin',
        'navigate',
        'nested-navigate'
    ],
    'Sec-Fetch-Dest': [
        'document',
        'empty',
        'image',
        'script',
        'style',
        'worker',
        'font',
        'object',
        'embed',
        'audio',
        'video',
        'manifest',
        'websocket'
    ]
};

// 根据输入过滤常用请求头
const filterCommonHeaders = (queryString: string) => {
    if (!queryString) {
        return commonHeaders;
    }
    const query = queryString.toLowerCase();
    return commonHeaders.filter(header => 
        header.toLowerCase().includes(query)
    );
};

// 根据请求头名称和输入值过滤建议值
const filterHeaderValues = (headerName: string, queryString: string) => {
    const normalizedHeaderName = headerName?.trim();
    if (!normalizedHeaderName) {
        return [];
    }
    
    // 检查是否是常用请求头（不区分大小写）
    const matchedHeader = commonHeaders.find(h => 
        h.toLowerCase() === normalizedHeaderName.toLowerCase()
    );
    
    if (!matchedHeader || !headerValueSuggestions[matchedHeader]) {
        return [];
    }
    
    const suggestions = headerValueSuggestions[matchedHeader];
    
    if (!queryString) {
        return suggestions;
    }
    
    const query = queryString.toLowerCase();
    return suggestions.filter(value => 
        value.toLowerCase().includes(query)
    );
};

// 为 el-autocomplete 提供的包装函数
const fetchHeaderKeySuggestions = (queryString: string, cb: (suggestions: Array<{ value: string }>) => void) => {
    const suggestions = filterCommonHeaders(queryString).map(h => ({ value: h }));
    cb(suggestions);
};

// 为 el-autocomplete 提供的包装函数（需要 header key）
const fetchHeaderValueSuggestions = (headerKey: string) => {
    return (queryString: string, cb: (suggestions: Array<{ value: string }>) => void) => {
        const suggestions = filterHeaderValues(headerKey, queryString).map(v => ({ value: v }));
        cb(suggestions);
    };
};

// 计算属性：检查是否有空的请求头
const hasEmptyHeader = computed(() => {
    return fetchJsonHeaders.value.some(
        header => !header.key?.trim() || !header.value?.trim()
    );
});

// 计算属性：请求体字节数
const requestBodyByteSize = computed(() => {
    if (!fetchJsonBody.value) return 0;
    return new Blob([fetchJsonBody.value]).size;
});

// 监听空请求头状态，当没有空请求头时自动隐藏警告
watch(hasEmptyHeader, (isEmpty) => {
    if (!isEmpty) {
        showEmptyHeaderWarning.value = false;
    }
});

// 打开对话框时重置表单
watch(() => props.modelValue, (visible) => {
    if (visible) {
        resetForm();
        // 弹窗打开时重新计算窗口高度，确保计算准确
        if (typeof window !== 'undefined') {
            // 使用 nextTick 确保弹窗已渲染
            setTimeout(() => {
                windowHeight.value = window.innerHeight;
            }, 100);
        }
    }
});

// 打开保存配置弹窗时清除错误信息
watch(showConfigDialog, (visible) => {
    if (visible) {
        saveConfigError.value = '';
    }
});

// 打开加载配置弹窗时清除错误信息
watch(showLoadConfigDialog, (visible) => {
    if (visible) {
        loadConfigError.value = '';
        loadSavedConfigs(); // 重新加载，确保数据最新
    }
});

// 打开删除配置弹窗时清除错误信息
watch(showDeleteConfigDialog, (visible) => {
    if (visible) {
        loadSavedConfigs(); // 重新加载，确保数据最新
    }
});

// 实时校验监听器
watch(fetchJsonUrl, () => {
    validateUrlRealTime();
});

watch([fetchJsonBody, fetchJsonMethod], () => {
    validateRequestBodyRealTime();
});

watch(fetchJsonCurlCommand, () => {
    validateCurlCommandRealTime();
});

watch(configName, () => {
    validateConfigNameRealTime();
});

watch(fetchJsonHeaders, () => {
    validateHeadersRealTime();
}, { deep: true });

// 重置表单
const resetForm = () => {
    fetchJsonMode.value = 'url';
    fetchJsonUrl.value = '';
    fetchJsonMethod.value = 'GET';
    fetchJsonBody.value = '';
    fetchJsonHeaders.value = [
        { key: 'Host', value: DEFAULT_HOST },
        { key: 'User-Agent', value: DEFAULT_USER_AGENT },
        { key: 'Accept', value: 'application/json' }
    ];
    showEmptyHeaderWarning.value = false;
    showCertUpload.value = false;
    fetchJsonCert.value = '';
    fetchJsonKey.value = '';
    certFileName.value = '';
    keyFileName.value = '';
    fetchJsonCurlCommand.value = '';
    // 清除所有校验错误
    urlError.value = '';
    requestBodyError.value = '';
    curlCommandError.value = '';
    configNameError.value = '';
    headerErrors.value = fetchJsonHeaders.value.map(() => ({ keyError: '', valueError: '' }));
};

// 关闭对话框
const handleDialogClose = () => {
    dialogVisible.value = false;
    showCertUpload.value = false;
};

// 添加请求头
const addHeader = () => {
    // 清除之前的错误信息
    addHeaderError.value = '';
    
    // 如果有空的请求头，不允许添加新的，并显示警告
    if (hasEmptyHeader.value) {
        showEmptyHeaderWarning.value = true;
        return;
    }
    
    // 检查请求头数量限制
    const validHeaders = fetchJsonHeaders.value.filter(h => h.key?.trim() && h.value?.trim());
    if (validHeaders.length >= MAX_HEADER_COUNT) {
        addHeaderError.value = `请求头数量已达到上限（${validHeaders.length} 个，最大 ${MAX_HEADER_COUNT} 个）`;
        return;
    }
    
    fetchJsonHeaders.value.push({ key: '', value: '' });
    headerErrors.value.push({ keyError: '', valueError: '' });
    showEmptyHeaderWarning.value = false;
};

// 删除请求头
const removeHeader = (index: number) => {
    fetchJsonHeaders.value.splice(index, 1);
    headerErrors.value.splice(index, 1);
};

// 处理证书上传
const handleCertUpload = (file: UploadFile) => {
    // 文件大小校验
    if (file.size && file.size > MAX_CERT_SIZE) {
        const sizeKB = (file.size / 1024).toFixed(2);
        const maxKB = (MAX_CERT_SIZE / 1024).toFixed(0);
        ElMessage.error(`证书文件大小超过限制（${sizeKB} KB，最大 ${maxKB} KB）`);
        return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
        const content = e.target?.result as string;
        
        // 证书格式和大小校验
        const certValidation = validateCert(content);
        if (!certValidation.isValid) {
            ElMessage.error(certValidation.error || '证书校验失败');
            return;
        }
        
        fetchJsonCert.value = content;
        certFileName.value = file.name;
    };
    reader.onerror = () => {
        ElMessage.error('证书文件读取失败');
    };
    reader.readAsText(file.raw as Blob);
};

// 处理私钥上传
const handleKeyUpload = (file: UploadFile) => {
    // 文件大小校验
    if (file.size && file.size > MAX_KEY_SIZE) {
        const sizeKB = (file.size / 1024).toFixed(2);
        const maxKB = (MAX_KEY_SIZE / 1024).toFixed(0);
        ElMessage.error(`私钥文件大小超过限制（${sizeKB} KB，最大 ${maxKB} KB）`);
        return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
        const content = e.target?.result as string;
        
        // 私钥格式和大小校验
        const keyValidation = validateKey(content);
        if (!keyValidation.isValid) {
            ElMessage.error(keyValidation.error || '私钥校验失败');
            return;
        }
        
        fetchJsonKey.value = content;
        keyFileName.value = file.name;
    };
    reader.onerror = () => {
        ElMessage.error('私钥文件读取失败');
    };
    reader.readAsText(file.raw as Blob);
};

// 清除证书
const clearCert = () => {
    fetchJsonCert.value = '';
    certFileName.value = '';
};

// 清除私钥
const clearKey = () => {
    fetchJsonKey.value = '';
    keyFileName.value = '';
};

// ========== 校验函数 ==========

// URL格式和长度校验
const validateUrl = (url: string): { isValid: boolean; error?: string } => {
    if (!url || !url.trim()) {
        return { isValid: false, error: 'URL不能为空' };
    }
    
    const trimmedUrl = url.trim();
    
    // 长度校验
    if (trimmedUrl.length > MAX_URL_LENGTH) {
        return { 
            isValid: false, 
            error: `URL长度超过限制（${trimmedUrl.length} 字符，最大 ${MAX_URL_LENGTH} 字符）` 
        };
    }
    
    // 基本URL格式校验
    try {
        const urlObj = new URL(trimmedUrl);
        // 只允许 http 和 https 协议
        if (!['http:', 'https:'].includes(urlObj.protocol)) {
            return { 
                isValid: false, 
                error: 'URL协议必须是 http 或 https' 
            };
        }
    } catch (error) {
        return { 
            isValid: false, 
            error: 'URL格式不正确，请输入有效的URL（例如：https://example.com）' 
        };
    }
    
    return { isValid: true };
};

const isSaveConfigDisabled = computed(() => {
    const validation = validateUrl(fetchJsonUrl.value);
    return !validation.isValid;
});

// 请求头数量校验
const validateHeaderCount = (headers: Array<{ key: string; value: string }>): { isValid: boolean; error?: string } => {
    const validHeaders = headers.filter(h => h.key?.trim() && h.value?.trim());
    
    if (validHeaders.length > MAX_HEADER_COUNT) {
        return { 
            isValid: false, 
            error: `请求头数量超过限制（${validHeaders.length} 个，最大 ${MAX_HEADER_COUNT} 个）` 
        };
    }
    
    return { isValid: true };
};

// 请求头KV字段校验
const validateHeaders = (headers: Array<{ key: string; value: string }>): { isValid: boolean; error?: string } => {
    for (let i = 0; i < headers.length; i++) {
        const header = headers[i];
        const key = header.key?.trim() || '';
        const value = header.value?.trim() || '';
        
        // 跳过空的请求头
        if (!key && !value) {
            continue;
        }
        
        // Key不能为空
        if (!key) {
            return { 
                isValid: false, 
                error: `第 ${i + 1} 个请求头的Key不能为空` 
            };
        }
        
        // Value不能为空
        if (!value) {
            return { 
                isValid: false, 
                error: `第 ${i + 1} 个请求头 "${key}" 的Value不能为空` 
            };
        }
        
        // Key长度校验
        if (key.length > MAX_HEADER_KEY_LENGTH) {
            return { 
                isValid: false, 
                error: `第 ${i + 1} 个请求头Key长度超过限制（${key.length} 字符，最大 ${MAX_HEADER_KEY_LENGTH} 字符）` 
            };
        }
        
        // Value长度校验
        if (value.length > MAX_HEADER_VALUE_LENGTH) {
            return { 
                isValid: false, 
                error: `第 ${i + 1} 个请求头 "${key}" 的Value长度超过限制（${value.length} 字符，最大 ${MAX_HEADER_VALUE_LENGTH} 字符）` 
            };
        }
        
        // Key非法字符校验
        if (INVALID_HEADER_KEY_CHARS.test(key)) {
            return { 
                isValid: false, 
                error: `第 ${i + 1} 个请求头Key包含非法字符（不允许换行符）` 
            };
        }
        
        // Value非法字符校验（某些特殊值可能包含换行，但为了安全限制）
        if (INVALID_HEADER_VALUE_CHARS.test(value)) {
            return { 
                isValid: false, 
                error: `第 ${i + 1} 个请求头 "${key}" 的Value包含非法字符（不允许换行符）` 
            };
        }
    }
    
    return { isValid: true };
};

// 请求体大小和格式校验
const validateRequestBody = (body: string, method: string): { isValid: boolean; error?: string } => {
    // GET请求不需要请求体
    if (method === 'GET') {
        return { isValid: true };
    }
    
    if (!body || !body.trim()) {
        return { isValid: true }; // 请求体可以为空
    }
    
    // 大小校验（按字节计算）
    const bodySize = new Blob([body]).size;
    if (bodySize > MAX_REQUEST_BODY_SIZE) {
        const sizeMB = (bodySize / (1024 * 1024)).toFixed(2);
        const maxMB = (MAX_REQUEST_BODY_SIZE / (1024 * 1024)).toFixed(0);
        return { 
            isValid: false, 
            error: `请求体大小超过限制（${sizeMB} MB，最大 ${maxMB} MB）` 
        };
    }
    
    // 如果请求体看起来像JSON格式（以 { 或 [ 开头），则验证JSON有效性
    // 注意：请求体不一定是JSON格式，可以是XML、Form Data、Plain Text等
    // 只有当用户输入看起来像JSON时，才进行JSON格式验证，避免误报
    const trimmedBody = body.trim();
    if (trimmedBody.startsWith('{') || trimmedBody.startsWith('[')) {
        try {
            JSON.parse(body);
        } catch (error) {
            return { 
                isValid: false, 
                error: '请求体看起来像JSON格式，但JSON格式不正确：' + (error instanceof Error ? error.message : '未知错误') 
            };
        }
    }
    
    return { isValid: true };
};

// 证书格式和大小校验
const validateCert = (cert: string): { isValid: boolean; error?: string } => {
    if (!cert || !cert.trim()) {
        return { isValid: true }; // 证书可以为空
    }
    
    // 大小校验
    const certSize = new Blob([cert]).size;
    if (certSize > MAX_CERT_SIZE) {
        const sizeKB = (certSize / 1024).toFixed(2);
        const maxKB = (MAX_CERT_SIZE / 1024).toFixed(0);
        return { 
            isValid: false, 
            error: `证书大小超过限制（${sizeKB} KB，最大 ${maxKB} KB）` 
        };
    }
    
    // 基本格式校验（检查是否包含证书标记）
    const certContent = cert.trim();
    if (!certContent.includes('-----BEGIN') || !certContent.includes('-----END')) {
        return { 
            isValid: false, 
            error: '证书格式不正确，应包含 -----BEGIN----- 和 -----END----- 标记' 
        };
    }
    
    return { isValid: true };
};

// 私钥格式和大小校验
const validateKey = (key: string): { isValid: boolean; error?: string } => {
    if (!key || !key.trim()) {
        return { isValid: true }; // 私钥可以为空
    }
    
    // 大小校验
    const keySize = new Blob([key]).size;
    if (keySize > MAX_KEY_SIZE) {
        const sizeKB = (keySize / 1024).toFixed(2);
        const maxKB = (MAX_KEY_SIZE / 1024).toFixed(0);
        return { 
            isValid: false, 
            error: `私钥大小超过限制（${sizeKB} KB，最大 ${maxKB} KB）` 
        };
    }
    
    // 基本格式校验（检查是否包含私钥标记）
    const keyContent = key.trim();
    if (!keyContent.includes('-----BEGIN') || !keyContent.includes('-----END')) {
        return { 
            isValid: false, 
            error: '私钥格式不正确，应包含 -----BEGIN----- 和 -----END----- 标记' 
        };
    }
    
    return { isValid: true };
};

// 配置名称校验
const validateConfigName = (name: string): { isValid: boolean; error?: string } => {
    if (!name || !name.trim()) {
        return { isValid: false, error: '配置名称不能为空' };
    }
    
    const trimmedName = name.trim();
    
    // 长度校验
    if (trimmedName.length > MAX_CONFIG_NAME_LENGTH) {
        return { 
            isValid: false, 
            error: `配置名称长度超过限制（${trimmedName.length} 字符，最大 ${MAX_CONFIG_NAME_LENGTH} 字符）` 
        };
    }
    
    // 非法字符校验
    if (INVALID_CONFIG_NAME_CHARS.test(trimmedName)) {
        return { 
            isValid: false, 
            error: '配置名称包含非法字符（不允许包含 < > : " / \\ | ? * 和控制字符）' 
        };
    }
    
    return { isValid: true };
};

// 配置数量校验
const validateConfigCount = (): { isValid: boolean; error?: string } => {
    if (savedConfigs.value.length >= MAX_CONFIG_COUNT) {
        return { 
            isValid: false, 
            error: `配置数量已达到上限（${savedConfigs.value.length} 个，最大 ${MAX_CONFIG_COUNT} 个），请先删除一些配置` 
        };
    }
    
    return { isValid: true };
};

// ========== 实时校验函数 ==========

// 实时校验URL
const validateUrlRealTime = () => {
    if (!fetchJsonUrl.value || !fetchJsonUrl.value.trim()) {
        urlError.value = '';
        return;
    }
    const validation = validateUrl(fetchJsonUrl.value);
    urlError.value = validation.isValid ? '' : (validation.error || '');
};

// 实时校验请求体
const validateRequestBodyRealTime = () => {
    if (fetchJsonMethod.value === 'GET' || !fetchJsonBody.value || !fetchJsonBody.value.trim()) {
        requestBodyError.value = '';
        return;
    }
    const validation = validateRequestBody(fetchJsonBody.value, fetchJsonMethod.value);
    requestBodyError.value = validation.isValid ? '' : (validation.error || '');
};

// 实时校验cURL命令
const validateCurlCommandRealTime = () => {
    if (!fetchJsonCurlCommand.value || !fetchJsonCurlCommand.value.trim()) {
        curlCommandError.value = '';
        return;
    }
    if (fetchJsonCurlCommand.value.length > MAX_CURL_COMMAND_LENGTH) {
        curlCommandError.value = `cURL命令长度超过限制（${fetchJsonCurlCommand.value.length} 字符，最大 ${MAX_CURL_COMMAND_LENGTH} 字符）`;
        return;
    }
    curlCommandError.value = '';
};

// 实时校验配置名称
const validateConfigNameRealTime = () => {
    if (!configName.value || !configName.value.trim()) {
        configNameError.value = '';
        return;
    }
    const validation = validateConfigName(configName.value);
    configNameError.value = validation.isValid ? '' : (validation.error || '');
};

// 实时校验请求头
const validateHeadersRealTime = () => {
    // 确保headerErrors数组长度与fetchJsonHeaders一致
    while (headerErrors.value.length < fetchJsonHeaders.value.length) {
        headerErrors.value.push({ keyError: '', valueError: '' });
    }
    while (headerErrors.value.length > fetchJsonHeaders.value.length) {
        headerErrors.value.pop();
    }
    
    // 校验每个请求头
    fetchJsonHeaders.value.forEach((header, index) => {
        const key = header.key?.trim() || '';
        const value = header.value?.trim() || '';
        
        // 跳过空的请求头
        if (!key && !value) {
            headerErrors.value[index] = { keyError: '', valueError: '' };
            return;
        }
        
        // 校验Key
        if (!key) {
            headerErrors.value[index].keyError = 'Key不能为空';
        } else if (key.length > MAX_HEADER_KEY_LENGTH) {
            headerErrors.value[index].keyError = `Key长度超过限制（${key.length} 字符，最大 ${MAX_HEADER_KEY_LENGTH} 字符）`;
        } else if (INVALID_HEADER_KEY_CHARS.test(key)) {
            headerErrors.value[index].keyError = 'Key包含非法字符（不允许换行符）';
        } else {
            headerErrors.value[index].keyError = '';
        }
        
        // 校验Value
        if (!value) {
            headerErrors.value[index].valueError = 'Value不能为空';
        } else if (value.length > MAX_HEADER_VALUE_LENGTH) {
            headerErrors.value[index].valueError = `Value长度超过限制（${value.length} 字符，最大 ${MAX_HEADER_VALUE_LENGTH} 字符）`;
        } else if (INVALID_HEADER_VALUE_CHARS.test(value)) {
            headerErrors.value[index].valueError = 'Value包含非法字符（不允许换行符）';
        } else {
            headerErrors.value[index].valueError = '';
        }
    });
};

// 从localStorage加载保存的配置
const loadSavedConfigs = () => {
    if (typeof window === 'undefined') return;
    try {
        const stored = localStorage.getItem(CONFIG_STORAGE_KEY);
        if (stored) {
            const configs = JSON.parse(stored);
            // 如果配置数量超过限制，只保留前MAX_CONFIG_COUNT个
            if (Array.isArray(configs) && configs.length > MAX_CONFIG_COUNT) {
                savedConfigs.value = configs.slice(0, MAX_CONFIG_COUNT);
                saveConfigsToStorage(); // 保存截断后的配置
                // 这个提示在加载配置时显示，使用 ElMessage 更合适，因为此时弹窗可能还没打开
                ElMessage.warning(`配置数量超过限制，已自动保留前 ${MAX_CONFIG_COUNT} 个配置`);
            } else {
                savedConfigs.value = configs;
            }
        }
    } catch (error) {
        ElMessage.error('加载配置失败，可能是数据格式错误');
    }
};

// 保存配置到localStorage
const saveConfigsToStorage = () => {
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(savedConfigs.value));
    } catch (error) {
        ElMessage.error('保存配置失败，可能是存储空间不足');
    }
};

// 保存当前配置
const saveConfig = () => {
    // 清除之前的错误信息
    saveConfigError.value = '';
    
    // 配置名称校验
    const nameValidation = validateConfigName(configName.value);
    if (!nameValidation.isValid) {
        saveConfigError.value = nameValidation.error || '配置名称校验失败';
        return;
    }
    
    const trimmedName = configName.value.trim();
    
    // 检查是否已存在同名配置
    const existingIndex = savedConfigs.value.findIndex(c => c.name === trimmedName);
    
    // 如果是新配置，检查配置数量限制
    if (existingIndex < 0) {
        const countValidation = validateConfigCount();
        if (!countValidation.isValid) {
            saveConfigError.value = countValidation.error || '配置数量已达到上限';
            return;
        }
    }
    
    // 校验配置内容
    // 1. URL校验（必填）
    if (!fetchJsonUrl.value || !fetchJsonUrl.value.trim()) {
        saveConfigError.value = 'URL不能为空，请填写请求URL';
        return;
    }
    
    const urlValidation = validateUrl(fetchJsonUrl.value);
    if (!urlValidation.isValid) {
        saveConfigError.value = '配置中的URL无效：' + (urlValidation.error || '');
        return;
    }
    
    // 2. 请求头校验
    const headerValidation = validateHeaders(fetchJsonHeaders.value);
    if (!headerValidation.isValid) {
        saveConfigError.value = '配置中的请求头无效：' + (headerValidation.error || '');
        return;
    }
    
    const headerCountValidation = validateHeaderCount(fetchJsonHeaders.value);
    if (!headerCountValidation.isValid) {
        saveConfigError.value = '配置中的请求头数量无效：' + (headerCountValidation.error || '');
        return;
    }
    
    // 3. 请求体校验
    if (fetchJsonMethod.value !== 'GET' && fetchJsonBody.value) {
        const bodyValidation = validateRequestBody(fetchJsonBody.value, fetchJsonMethod.value);
        if (!bodyValidation.isValid) {
            saveConfigError.value = '配置中的请求体无效：' + (bodyValidation.error || '');
            return;
        }
    }
    
    // 4. 证书校验
    if (fetchJsonCert.value) {
        const certValidation = validateCert(fetchJsonCert.value);
        if (!certValidation.isValid) {
            saveConfigError.value = '配置中的证书无效：' + (certValidation.error || '');
            return;
        }
    }
    
    // 5. 私钥校验
    if (fetchJsonKey.value) {
        const keyValidation = validateKey(fetchJsonKey.value);
        if (!keyValidation.isValid) {
            saveConfigError.value = '配置中的私钥无效：' + (keyValidation.error || '');
            return;
        }
    }
    
    const config = {
        name: trimmedName,
        url: fetchJsonUrl.value,
        method: fetchJsonMethod.value,
        body: fetchJsonBody.value,
        headers: JSON.parse(JSON.stringify(fetchJsonHeaders.value)) // 深拷贝
    };
    
    if (existingIndex >= 0) {
        // 更新现有配置
        ElMessageBox.confirm(
            `配置 "${trimmedName}" 已存在，是否覆盖？`,
            '提示',
            {
                confirmButtonText: '覆盖',
                cancelButtonText: '取消',
                type: 'warning'
            }
        ).then(() => {
            savedConfigs.value[existingIndex] = config;
            saveConfigsToStorage();
            showConfigDialog.value = false;
            configName.value = '';
            saveConfigError.value = '';
        }).catch(() => {
            // 用户取消
        });
    } else {
        // 添加新配置
        savedConfigs.value.push(config);
        saveConfigsToStorage();
        showConfigDialog.value = false;
        configName.value = '';
        saveConfigError.value = '';
    }
};

// 打开加载配置对话框
const openSaveConfigDialog = () => {
    const validation = validateUrl(fetchJsonUrl.value);
    if (!validation.isValid) {
        urlError.value = validation.error || 'URL无效，请检查后再试';
        return;
    }

    urlError.value = '';
    saveConfigError.value = '';
    showConfigDialog.value = true;
};

const openLoadConfigDialog = () => {
    loadSavedConfigs(); // 重新加载，确保数据最新
    showLoadConfigDialog.value = true;
};

// 加载配置到表单
const loadConfig = (config: typeof savedConfigs.value[0]) => {
    // 清除之前的错误信息
    loadConfigError.value = '';
    
    // 收集所有错误信息
    const errors: string[] = [];
    
    // 校验配置内容
    // 1. URL校验
    if (config.url) {
        const urlValidation = validateUrl(config.url);
        if (!urlValidation.isValid) {
            errors.push('配置中的URL无效：' + (urlValidation.error || '') + '，已加载但请检查');
        }
    }
    
    // 2. 请求头校验
    const headerValidation = validateHeaders(config.headers || []);
    if (!headerValidation.isValid) {
        errors.push('配置中的请求头无效：' + (headerValidation.error || '') + '，已加载但请检查');
    }
    
    const headerCountValidation = validateHeaderCount(config.headers || []);
    if (!headerCountValidation.isValid) {
        errors.push('配置中的请求头数量无效：' + (headerCountValidation.error || '') + '，已加载但请检查');
    }
    
    // 3. 请求体校验
    if (config.method !== 'GET' && config.body) {
        const bodyValidation = validateRequestBody(config.body, config.method);
        if (!bodyValidation.isValid) {
            errors.push('配置中的请求体无效：' + (bodyValidation.error || '') + '，已加载但请检查');
        }
    }
    
    // 显示所有错误信息
    if (errors.length > 0) {
        loadConfigError.value = errors.join('；');
    }
    
    // 加载配置
    fetchJsonUrl.value = config.url;
    fetchJsonMethod.value = config.method;
    fetchJsonBody.value = config.body;
    fetchJsonHeaders.value = JSON.parse(JSON.stringify(config.headers || [])); // 深拷贝
    showLoadConfigDialog.value = false;
};

// 打开删除配置对话框
const openDeleteConfigDialog = () => {
    loadSavedConfigs(); // 重新加载，确保数据最新
    showDeleteConfigDialog.value = true;
};

// 处理删除配置对话框关闭
const handleDeleteConfigDialogClose = () => {
    confirmingDeleteIndex.value = null; // 关闭对话框时清除删除确认状态
};

// 确认删除（显示内联确认提示）
const confirmDelete = (index: number) => {
    confirmingDeleteIndex.value = index;
};

// 取消删除
const cancelDelete = () => {
    confirmingDeleteIndex.value = null;
};

// 执行删除
const executeDelete = (index: number) => {
    if (index < 0 || index >= savedConfigs.value.length) {
        ElMessage.error('配置索引无效');
        return;
    }
    
    savedConfigs.value.splice(index, 1);
    saveConfigsToStorage();
    confirmingDeleteIndex.value = null;
    
    // 如果删除后列表为空，关闭对话框
    if (savedConfigs.value.length === 0) {
        showDeleteConfigDialog.value = false;
    }
};

// 获取JSON数据
const fetchJsonData = async () => {
    try {
        // 验证输入
        if (fetchJsonMode.value === 'url') {
            // URL校验
            const urlValidation = validateUrl(fetchJsonUrl.value);
            if (!urlValidation.isValid) {
                ElMessage.error(urlValidation.error || 'URL校验失败');
                return;
            }
            
            // 请求头数量校验
            const headerCountValidation = validateHeaderCount(fetchJsonHeaders.value);
            if (!headerCountValidation.isValid) {
                ElMessage.error(headerCountValidation.error || '请求头数量校验失败');
                return;
            }
            
            // 请求头KV字段校验
            const headerValidation = validateHeaders(fetchJsonHeaders.value);
            if (!headerValidation.isValid) {
                ElMessage.error(headerValidation.error || '请求头校验失败');
                return;
            }
            
            // 请求体校验
            const bodyValidation = validateRequestBody(fetchJsonBody.value, fetchJsonMethod.value);
            if (!bodyValidation.isValid) {
                ElMessage.error(bodyValidation.error || '请求体校验失败');
                return;
            }
            
            // 证书校验
            if (fetchJsonCert.value) {
                const certValidation = validateCert(fetchJsonCert.value);
                if (!certValidation.isValid) {
                    ElMessage.error(certValidation.error || '证书校验失败');
                    return;
                }
            }
            
            // 私钥校验
            if (fetchJsonKey.value) {
                const keyValidation = validateKey(fetchJsonKey.value);
                if (!keyValidation.isValid) {
                    ElMessage.error(keyValidation.error || '私钥校验失败');
                    return;
                }
            }
        } else {
            if (!fetchJsonCurlCommand.value.trim()) {
                ElMessage.error('请输入cURL命令');
                return;
            }
            
            // cURL命令长度校验（防止过长命令）
            if (fetchJsonCurlCommand.value.length > MAX_CURL_COMMAND_LENGTH) {
                ElMessage.error(`cURL命令长度超过限制（${fetchJsonCurlCommand.value.length} 字符，最大 ${MAX_CURL_COMMAND_LENGTH} 字符）`);
                return;
            }
        }

        fetchJsonLoading.value = true;

        // 构建请求参数
        const requestData: any = {};
        
        if (fetchJsonMode.value === 'url') {
            requestData.url = fetchJsonUrl.value;
            requestData.method = fetchJsonMethod.value;
            
            // 构建请求头对象
            const headers: Record<string, string> = {};
            fetchJsonHeaders.value.forEach(header => {
                if (header.key && header.value) {
                    headers[header.key] = header.value;
                }
            });
            requestData.headers = headers;
            
            if (fetchJsonMethod.value !== 'GET' && fetchJsonBody.value) {
                requestData.body = fetchJsonBody.value;
            }
            
            if (fetchJsonCert.value) {
                requestData.cert = fetchJsonCert.value;
            }
            
            if (fetchJsonKey.value) {
                requestData.key = fetchJsonKey.value;
            }
        } else {
            requestData.curlCommand = fetchJsonCurlCommand.value;
        }

        // 调用后端API
        const response = await $fetch<{ success: boolean; data?: any; error?: string }>('/api/fetch-json', {
            method: 'POST',
            body: requestData,
        });

        if (response.success) {
            // 将获取到的JSON数据填充到输入编辑器
            const jsonString = JSON.stringify(response.data, null, props.indentSize);
            if (props.inputEditor) {
                props.inputEditor.setValue(jsonString);
                dialogVisible.value = false;
            }
        } else {
            ElMessage.error(response.error || '获取JSON数据失败');
        }
    } catch (error: any) {
        ElMessage.error('获取JSON数据失败: ' + (error.message || '未知错误'));
    } finally {
        fetchJsonLoading.value = false;
    }
};

// 初始化时加载保存的配置
if (typeof window !== 'undefined') {
    loadSavedConfigs();
}

// 生命周期钩子：监听窗口大小变化
onMounted(() => {
    if (typeof window !== 'undefined') {
        windowHeight.value = window.innerHeight;
        window.addEventListener('resize', handleResize);
    }
});

onUnmounted(() => {
    if (typeof window !== 'undefined') {
        window.removeEventListener('resize', handleResize);
    }
});
</script>

<style scoped>
/* 响应式弹窗宽度 */
:deep(.fetch-json-main-dialog) {
    width: min(850px, 95vw);
}

:deep(.fetch-json-main-dialog .el-dialog) {
    max-height: calc(100vh - 12vh);
    display: flex;
    flex-direction: column;
    margin-top: 0 !important;
    margin-bottom: 0 !important;
}

:deep(.fetch-json-main-dialog .el-dialog__body) {
    overflow-y: auto;
    flex: 1;
    min-height: 0; /* 允许 flex 子元素收缩 */
    padding-right: 20px; /* 为滚动条留出空间，避免压住内容 */
}

:deep(.config-save-dialog-wrapper .el-dialog) {
    max-height: calc(100vh - 20vh);
    display: flex;
    flex-direction: column;
    margin-top: 0 !important;
    margin-bottom: 0 !important;
}

:deep(.config-save-dialog-wrapper .el-dialog__body) {
    overflow-y: auto;
    flex: 1;
    min-height: 0;
    padding-right: 20px;
}

:deep(.config-load-dialog-wrapper .el-dialog) {
    max-height: calc(100vh - 20vh);
    display: flex;
    flex-direction: column;
    margin-top: 0 !important;
    margin-bottom: 0 !important;
}

:deep(.config-load-dialog-wrapper .el-dialog__body) {
    overflow-y: auto;
    flex: 1;
    min-height: 0;
    padding-right: 20px;
}

:deep(.config-delete-dialog-wrapper .el-dialog) {
    max-height: calc(100vh - 20vh);
    display: flex;
    flex-direction: column;
    margin-top: 0 !important;
    margin-bottom: 0 !important;
}

:deep(.config-delete-dialog-wrapper .el-dialog__body) {
    overflow-y: auto;
    flex: 1;
    min-height: 0;
    padding-right: 20px;
}

/* 响应式设计 */
@media (max-width: 1200px) {
    :deep(.config-save-dialog-wrapper) {
        width: 600px;
    }
    
    :deep(.config-load-dialog-wrapper),
    :deep(.config-delete-dialog-wrapper) {
        width: 750px;
    }
}

@media (max-width: 768px) {
    :deep(.fetch-json-main-dialog),
    :deep(.config-save-dialog-wrapper),
    :deep(.config-load-dialog-wrapper),
    :deep(.config-delete-dialog-wrapper) {
        width: 95vw;
        max-width: none;
    }
    
    .dialog-header {
        flex-direction: column;
        align-items: flex-start;
        gap: 12px;
        padding-right: 0;
    }
    
    .fetch-mode-group {
        margin-left: 0;
        width: 100%;
    }
    
    .form-label-row {
        flex-direction: column;
        align-items: flex-start;
        gap: 12px;
    }
    
    .header-item {
        flex-direction: column;
        align-items: stretch;
        gap: 8px;
    }
    
    .header-input-wrapper {
        width: 100% !important;
        min-width: 0 !important;
        flex: 1 1 100% !important;
    }
    
    .header-item :deep(.el-autocomplete) {
        width: 100% !important;
        margin-left: 0 !important;
    }
    
    .header-item :deep(.el-button) {
        width: 100%;
        margin-left: 0 !important;
    }
    
    .config-item {
        flex-direction: column;
        align-items: stretch;
        gap: 12px;
    }
    
    .config-actions {
        margin-left: 0;
        width: 100%;
        justify-content: stretch;
    }
    
    .config-actions :deep(.el-button) {
        flex: 1;
    }
    
    .delete-confirm {
        flex-direction: column;
        align-items: stretch;
        gap: 12px;
    }
    
    .delete-confirm-actions {
        margin-left: 0;
        width: 100%;
    }
    
    .delete-confirm-actions :deep(.el-button) {
        flex: 1;
    }
}

/* 获取JSON对话框样式 */
.dialog-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding-right: 80px;
}

.dialog-title {
    font-size: 18px;
    font-weight: 600;
    color: #303133;
    line-height: 1.5;
}

.fetch-json-dialog {
    padding: 0;
    /* 移除 max-height 和 overflow-y，让父容器 .el-dialog__body 处理滚动 */
    /* 这样可以避免双重滚动条，并且滚动条位置更合理 */
}

.fetch-mode-group {
    margin-left: auto;
}

.fetch-mode-content {
    margin-top: 0;
}

.form-item {
    margin-bottom: 24px;
}

.form-item:last-child {
    margin-bottom: 0;
}

.form-label {
    display: block;
    margin-bottom: 10px;
    font-size: 14px;
    color: #606266;
    font-weight: 500;
    line-height: 1.5;
}

.form-label-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
}

/* 字段错误提示样式 */
.field-error {
    color: #f56c6c;
    font-size: 12px;
    margin-top: 5px;
    line-height: 1.5;
}

/* 请求体文本域底部样式 */
.textarea-footer {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-top: 5px;
    gap: 10px;
}

.textarea-counter {
    font-size: 12px;
    color: #909399;
    white-space: nowrap;
}

/* 请求头输入框包装器 */
.header-input-wrapper {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0;
}

.header-item .header-input-wrapper:first-child {
    flex: 0 0 35%;
    min-width: 200px;
}

.header-item .header-input-wrapper:nth-child(2) {
    flex: 1;
    min-width: 250px;
}

.header-item .header-input-wrapper .header-key-input,
.header-item .header-input-wrapper .header-value-input {
    width: 100%;
}

/* 请求头字段错误提示样式 */
.header-field-error {
    color: #f56c6c;
    font-size: 11px;
    line-height: 1.4;
    min-height: 18px; /* 固定最小高度，确保即使没有错误也占用相同空间 (font-size 11px * line-height 1.4 + margin-top 3px ≈ 18px) */
    box-sizing: border-box;
    display: block; /* 确保是块级元素 */
}

/* 当没有错误时，使用伪元素保持高度 */
.header-field-error-hidden::before {
    content: '\00a0'; /* 不可断空格，确保容器有内容以保持高度 */
    visibility: hidden;
}

.header-field-error-hidden {
    color: transparent; /* 隐藏可见的错误文字颜色 */
}

.form-label-row .form-label {
    margin-bottom: 0;
}

/* 请求体文本框样式 */
.request-body-textarea {
    width: 100%;
}

.request-body-textarea :deep(.el-textarea__inner) {
    resize: vertical;
    min-height: 66px; /* 最小3行的高度 */
    max-height: calc(88vh - 450px); /* 动态限制最大高度，确保不超出视口（88vh是弹窗最大高度，450px是其他内容高度） */
    overflow-y: auto;
}

/* cURL命令文本框样式 */
.curl-command-textarea {
    width: 100%;
}

.curl-command-textarea :deep(.el-textarea__inner) {
    resize: vertical;
    overflow-y: auto;
}

/* 统一所有textarea的滚动条样式，确保宽度一致 */
.request-body-textarea :deep(.el-textarea__inner)::-webkit-scrollbar,
.curl-command-textarea :deep(.el-textarea__inner)::-webkit-scrollbar {
    width: 8px; /* 统一滚动条宽度为8px */
}

.request-body-textarea :deep(.el-textarea__inner)::-webkit-scrollbar-track,
.curl-command-textarea :deep(.el-textarea__inner)::-webkit-scrollbar-track {
    background: #f1f1f1;
    border-radius: 4px;
}

.request-body-textarea :deep(.el-textarea__inner)::-webkit-scrollbar-thumb,
.curl-command-textarea :deep(.el-textarea__inner)::-webkit-scrollbar-thumb {
    background: #c1c1c1;
    border-radius: 4px;
}

.request-body-textarea :deep(.el-textarea__inner)::-webkit-scrollbar-thumb:hover,
.curl-command-textarea :deep(.el-textarea__inner)::-webkit-scrollbar-thumb:hover {
    background: #a8a8a8;
}

.headers-list {
    margin-top: 12px;
}

.header-item {
    display: flex;
    align-items: flex-start;
    gap: 10px;
}

.header-item:last-child {
    margin-bottom: 0;
}

.header-key-input {
    flex: 0 0 35%;
    min-width: 200px;
}

.header-value-input {
    flex: 1;
    min-width: 250px;
}

.header-delete-btn {
    flex: 0 0 auto;
    margin-top: 4px;
}

.cert-clear-btn {
    flex-shrink: 0;
}

.empty-hint {
    padding: 16px;
    text-align: center;
    color: #909399;
    font-size: 13px;
    background-color: #f5f7fa;
    border-radius: 6px;
    border: 1px dashed #dcdfe6;
}

.cert-upload {
    margin-top: 12px;
    padding: 16px;
    background-color: #fafafa;
    border-radius: 6px;
    border: 1px solid #e4e7ed;
}

.cert-item {
    display: flex;
    align-items: center;
    margin-bottom: 12px;
    gap: 10px;
    flex-wrap: wrap;
}

.cert-item:last-child {
    margin-bottom: 0;
}

.cert-label {
    display: inline-block;
    min-width: 130px;
    font-size: 14px;
    color: #606266;
    font-weight: 500;
    flex-shrink: 0;
}

.cert-name {
    font-size: 13px;
    color: #909399;
    flex: 1;
    min-width: 150px;
    max-width: 400px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

/* 配置保存对话框样式 */
.config-save-dialog .form-item {
    margin-bottom: 20px;
}

.config-preview {
    padding: 16px;
    background-color: #f5f7fa;
    border-radius: 6px;
    border: 1px solid #e4e7ed;
}

.preview-item {
    display: flex;
    align-items: center;
    margin-bottom: 12px;
    font-size: 14px;
}

.preview-item:last-child {
    margin-bottom: 0;
}

.preview-label {
    min-width: 80px;
    color: #606266;
    font-weight: 500;
    margin-right: 12px;
}

.preview-value {
    color: #303133;
    flex: 1;
    word-break: break-all;
}

/* 配置加载对话框样式 */
.config-load-dialog,
.config-delete-dialog {
    max-height: 500px;
    overflow-y: auto;
    padding-right: 8px; /* 为滚动条留出空间，避免压住内容 */
}

.empty-configs {
    padding: 40px 0;
}

.configs-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.config-item-wrapper {
    margin-bottom: 12px;
}

.config-item-wrapper:last-child {
    margin-bottom: 0;
}

.config-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px;
    background-color: #f5f7fa;
    border-radius: 6px;
    border: 1px solid #e4e7ed;
    transition: all 0.3s;
}

.config-item:hover {
    background-color: #ecf5ff;
    border-color: #b3d8ff;
}

.config-load-dialog-wrapper .config-item {
    cursor: pointer;
}

.config-load-dialog-wrapper .config-item:hover {
    background-color: #ecf5ff;
    border-color: #b3d8ff;
}

.config-info {
    flex: 1;
    min-width: 0;
}

.config-name {
    font-size: 16px;
    font-weight: 500;
    color: #303133;
    margin-bottom: 8px;
}

.config-details {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
    font-size: 13px;
    color: #909399;
}

.config-url {
    flex: 1;
    min-width: 200px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.config-headers {
    white-space: nowrap;
}

.config-actions {
    display: flex;
    gap: 8px;
    margin-left: 16px;
}

.select-icon {
    font-size: 18px;
    color: #409eff;
}

/* 删除确认提示样式 */
.delete-confirm {
    margin-top: 12px;
    padding: 12px 16px;
    background-color: #fef0f0;
    border: 1px solid #fbc4c4;
    border-radius: 6px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    animation: slideDown 0.2s ease-out;
}

@keyframes slideDown {
    from {
        opacity: 0;
        transform: translateY(-10px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

.delete-confirm-content {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
}

.delete-warning-icon {
    color: #f56c6c;
    font-size: 18px;
}

.delete-confirm-text {
    font-size: 14px;
    color: #606266;
}

.delete-confirm-actions {
    display: flex;
    gap: 8px;
    margin-left: 16px;
}
</style>

