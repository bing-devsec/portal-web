<template>
    <div>
        <!-- 分享对话框 -->
        <el-dialog
            v-model="dialogVisible"
            class="share-dialog-wrapper"
            :close-on-click-modal="false"
            :show-close="false"
            :align-center="false"
            top="12vh"
            width="850px"
            @close="handleDialogClose"
        >
            <template #header>
                <div class="dialog-header">
                    <span class="dialog-title">{{ shareTxt.title }}</span>
                    <button class="dialog-close-btn" @click="dialogVisible = false" :aria-label="shareTxt.closeAria">✕</button>
                </div>
            </template>
            <div class="share-dialog">
                <!-- 分享设置 -->
                <div v-if="!shareResult" class="share-settings">
                    <!-- 免费服务限制提示 -->
                    <el-alert type="info" :closable="false" style="margin-bottom: 20px">
                        <template #title>
                            <span style="font-size: 12px">
                                <strong>{{ shareTxt.freeLimitPrefix }}</strong>{{ shareTxt.freeLimitText }}
                            </span>
                        </template>
                    </el-alert>

                    <!-- 我的分享（可折叠） -->
                    <div class="my-shares">
                        <div class="my-shares-header" @click="toggleMyShares">
                            <span class="my-shares-title">{{ shareTxt.myShares }}</span>
                            <span class="my-shares-toggle">{{ mySharesExpanded ? shareTxt.collapse : shareTxt.expand }}</span>
                        </div>
                        <el-collapse-transition>
                            <div v-show="mySharesExpanded" class="my-shares-body">
                                <el-table
                                    :data="myShares"
                                    size="small"
                                    border
                                    :style="{ width: '100%' }"
                                    :empty-text="shareTxt.emptyShares"
                                    :header-cell-style="{ textAlign: 'center' }"
                                    :cell-style="{ textAlign: 'center' }"
                                    :fit="true"
                                >
                                    <el-table-column prop="shareName" :label="shareTxt.colShareName" width="150" align="center" header-align="center">
                                        <template #default="{ row }">
                                            <span v-if="row.shareName">{{ row.shareName }}</span>
                                            <span v-else style="color: #909399">—</span>
                                        </template>
                                    </el-table-column>
                                    <el-table-column prop="expiresAt" :label="shareTxt.colExpiresAt" width="200" align="center" header-align="center">
                                        <template #default="{ row }">
                                            <span v-if="row.expiresAt">{{ formatDateTime(row.expiresAt) }}</span>
                                            <span v-else>—</span>
                                        </template>
                                    </el-table-column>
                                    <el-table-column prop="hasPassword" :label="shareTxt.colHasPassword" width="110" align="center" header-align="center">
                                        <template #default="{ row }">
                                            <el-tag size="small" :type="row.hasPassword ? 'warning' : 'success'">
                                                {{ row.hasPassword ? shareTxt.yes : shareTxt.no }}
                                            </el-tag>
                                        </template>
                                    </el-table-column>
                                    <el-table-column :label="shareTxt.colActions" :min-width="200" fixed="right" align="center" header-align="center">
                                        <template #default="{ row }">
                                            <el-button type="primary" size="small" @click="loadShareIntoEditor(row)"> {{ shareTxt.btnUse }} </el-button>
                                            <el-button size="small" @click="copyText(row.shareUrl, shareTxt.msgLinkCopied)"> {{ shareTxt.btnCopyLink }} </el-button>
                                        </template>
                                    </el-table-column>
                                </el-table>
                                <div class="my-shares-actions">
                                    <el-button size="small" @click="toggleMyShares">{{ shareTxt.collapse }}</el-button>
                                    <el-button size="small" type="primary" @click="fetchMyShares" :disabled="mySharesLoading" class="no-jitter"> {{ shareTxt.btnRefresh }} </el-button>
                                </div>
                            </div>
                        </el-collapse-transition>
                    </div>

                    <form @submit.prevent="createShare">
                        <div class="form-item">
                            <label class="form-label" for="share-name"> {{ shareTxt.shareNameLabel }} <span style="color: #f56c6c">*</span> </label>
                            <el-input
                                id="share-name"
                                v-model="shareName"
                                :placeholder="shareTxt.shareNamePlaceholder"
                                maxlength="10"
                                show-word-limit
                                clearable
                                @input="handleShareNameInput"
                            />
                            <div class="form-hint">{{ shareTxt.shareNameHint }}</div>
                        </div>

                        <div class="form-item">
                            <label class="form-label" for="expires-amount">{{ shareTxt.expiresLabel }}</label>
                            <div style="margin-top: 0">
                                <div class="custom-exp-row" style="display: flex; gap: 8px">
                                    <el-input-number
                                        id="expires-amount"
                                        v-model="customAmount"
                                        :min="customMin"
                                        :max="customMax"
                                        :step="customStep"
                                        :precision="customPrecision"
                                        :placeholder="shareTxt.amountPlaceholder"
                                        style="width: 60%"
                                        @change="handleCustomExpiresInChange"
                                    />
                                    <el-select id="expires-unit" v-model="customUnit" style="width: 38%" @change="handleCustomUnitChange">
                                        <el-option :label="shareTxt.unitMinutes" value="minutes" />
                                        <el-option :label="shareTxt.unitHours" value="hours" />
                                        <el-option :label="shareTxt.unitDays" value="days" />
                                    </el-select>
                                </div>
                                <div class="form-hint" style="margin-top: 5px">{{ shareTxt.expiresHint(formatCustomExpiresIn()) }}</div>
                            </div>
                        </div>

                        <div class="form-item">
                            <label class="form-label" for="share-password">{{ shareTxt.passwordLabel }}</label>
                            <el-input
                                id="share-password"
                                ref="passwordInputRef"
                                v-model="password"
                                type="password"
                                :placeholder="shareTxt.passwordPlaceholder"
                                clearable
                                show-password
                                autocomplete="new-password"
                                maxlength="30"
                                show-word-limit
                                @input="handlePasswordInput"
                                @focus="handlePasswordInputFocus"
                            />
                            <div class="form-hint">{{ shareTxt.passwordHint }}</div>
                        </div>
                    </form>
                </div>

                <!-- 分享结果 -->
                <div v-if="shareResult" class="share-result">
                    <div class="form-item">
                        <label class="form-label" for="share-url">{{ shareTxt.shareUrlLabel }}</label>
                        <div class="share-url-container">
                            <el-input id="share-url" v-model="shareResult.shareUrl" readonly class="share-url-input" />
                            <el-button type="primary" @click="copyShareUrl" :loading="copyLoading">
                                {{ copyLoading ? shareTxt.copying : shareTxt.btnCopyLink }}
                            </el-button>
                        </div>
                    </div>

                    <div class="form-item" v-if="shareResult.expiresAt">
                        <label class="form-label">{{ shareTxt.expiresAtLabel }}</label>
                        <div class="expires-info">
                            {{ formatExpiresAt(shareResult.expiresAt) }}
                        </div>
                    </div>

                    <div class="form-item" v-if="password">
                        <label class="form-label" for="access-password">{{ shareTxt.accessPasswordLabel }}</label>
                        <div class="password-info">
                            <el-input id="access-password" v-model="password" readonly type="password" class="password-display" />
                            <el-button type="info" @click="copyPassword" size="small"> {{ shareTxt.btnCopyPassword }} </el-button>
                        </div>
                    </div>
                </div>
            </div>

            <template #footer>
                <div class="dialog-footer">
                    <el-button @click="handleDialogClose">{{ shareTxt.btnClose }}</el-button>
                    <el-button v-if="!shareResult" type="primary" @click="createShare" :loading="loading"> {{ shareTxt.btnCreateShare }} </el-button>
                    <el-button v-if="shareResult" type="primary" @click="resetForm"> {{ shareTxt.btnNewShare }} </el-button>
                </div>
            </template>
        </el-dialog>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import { ElMessageBox } from 'element-plus';
import { FingerprintDetector } from '~/utils/fingerprint';
import { showMessageError } from '~/utils/api';

// Props
interface Props {
    modelValue: boolean;
    jsonData: string;
    locale?: 'zh' | 'en';
}

const props = defineProps<Props>();
const MAX_SHARE_SIZE_BYTES = 2 * 1024 * 1024;

const getUtf8ByteLength = (text: string): number => {
    try {
        return new TextEncoder().encode(text).length;
    } catch {
        return text.length;
    }
};

const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
};

const formatDateTime = (timestamp: number) => new Date(timestamp).toLocaleString(props.locale === 'en' ? 'en-US' : 'zh-CN');

// Emits
const emit = defineEmits<{
    'update:modelValue': [value: boolean];
    loadSharedJson: [value: string];
}>();

const SHARE_TXT_ZH = {
    title: '分享JSON数据',
    closeAria: '关闭分享弹窗',
    freeLimitPrefix: '免费服务限制：',
    freeLimitText: '分享编辑区域的JSON数据，单次分享最大2MB数据，每个用户最多5次分享，每分钟最多分享3次。',
    myShares: '我的分享',
    expand: '展开',
    collapse: '收起',
    emptyShares: '暂无分享',
    colShareName: '分享名称',
    colExpiresAt: '过期时间',
    colHasPassword: '需要密码',
    colActions: '操作',
    yes: '是',
    no: '否',
    btnUse: '使用',
    btnCopyLink: '复制链接',
    btnRefresh: '刷新',
    shareNameLabel: '分享名称',
    shareNamePlaceholder: '请输入分享名称（10个字符以内，中英文、数字及常见连字符）',
    shareNameHint: '必填，最多10个字符，只能包含中英文、数字和常见连字符（-、_、.），对同一用户具有唯一性',
    expiresLabel: '过期时间',
    amountPlaceholder: '请输入数值',
    unitMinutes: '分钟',
    unitHours: '小时',
    unitDays: '天',
    expiresHint: (current: string) => `允许范围：3分钟 - 3天（当前：${current}）`,
    passwordLabel: '访问密码（可选）',
    passwordPlaceholder: '设置密码以保护分享链接',
    passwordHint: '最多30位，允许英文、数字及常用符号（不含空格）',
    shareUrlLabel: '分享链接：',
    copying: '复制中...',
    expiresAtLabel: '过期时间：',
    accessPasswordLabel: '访问密码：',
    btnCopyPassword: '复制密码',
    btnClose: '关闭',
    btnCreateShare: '生成分享链接',
    btnNewShare: '创建新分享',
    expired: '已过期',
    day: (n: number) => `${n}天`,
    hour: (n: number) => `${n}小时`,
    minute: (n: number) => `${n}分钟`,
    defaultDuration: '3分钟',
    msgJsonRequired: 'JSON数据不能为空',
    msgJsonTooLarge: (current: string, max: string) => `当前输入区 JSON 数据过大（${current}，最大 ${max}）`,
    msgInvalidJson: 'JSON 数据格式不正确，请先格式化 JSON 数据',
    msgShareNameRequired: '分享名称不能为空',
    msgShareNameTooLong: '分享名称长度不能超过10个字符',
    msgShareNameInvalid: '分享名称只能包含中英文、数字和常见连字符（-、_、.）',
    msgPasswordTooLong: '密码长度不能超过30位',
    msgPasswordInvalid: '密码包含不被允许的字符',
    msgExpiresTooLong: '过期时间不能超过3天',
    msgExpiresTooShort: '过期时间不能少于3分钟',
    msgFingerprintFail: '无法获取浏览器指纹，请刷新页面后重试',
    msgCreateFail: '创建分享链接失败',
    msgCreateFailWithError: (err: string) => `创建分享链接失败: ${err}`,
    msgRequestTimeout: '请求超时，请稍后重试或尝试更小的 JSON 数据',
    msgNetworkError: '网络错误，请检查网络连接后重试',
    msgLinkCopied: '链接已复制',
    msgCopied: '已复制',
    msgCopyFail: '复制失败，请手动复制',
    msgMySharesLoadFail: '获取分享列表失败',
    promptProtectedMessage: '该分享受密码保护，请输入密码',
    promptProtectedTitle: '需要密码',
    promptPasswordPlaceholder: '访问密码',
    btnConfirm: '确定',
    btnCancel: '取消',
    promptPasswordRequired: '请输入密码',
    msgLoadedToEditor: '已加载到编辑区域',
    msgLoadFail: '加载失败',
    unknownError: '未知错误',
};

type ShareTxt = typeof SHARE_TXT_ZH;

const SHARE_TXT_EN: ShareTxt = {
    title: 'Share JSON Data',
    closeAria: 'Close share dialog',
    freeLimitPrefix: 'Free service limits:',
    freeLimitText: 'Share JSON from the editor. Each share can be up to 2MB, each user can create up to 5 shares, and at most 3 shares per minute.',
    myShares: 'My Shares',
    expand: 'Expand',
    collapse: 'Collapse',
    emptyShares: 'No shares yet',
    colShareName: 'Share Name',
    colExpiresAt: 'Expires At',
    colHasPassword: 'Password',
    colActions: 'Actions',
    yes: 'Yes',
    no: 'No',
    btnUse: 'Use',
    btnCopyLink: 'Copy Link',
    btnRefresh: 'Refresh',
    shareNameLabel: 'Share Name',
    shareNamePlaceholder: 'Enter a share name (up to 10 characters; letters, numbers, Chinese, and common separators)',
    shareNameHint: 'Required, up to 10 characters. Only letters, numbers, Chinese characters, and common separators (-, _, .) are allowed. The name must be unique for the same user.',
    expiresLabel: 'Expiration',
    amountPlaceholder: 'Enter a value',
    unitMinutes: 'Minutes',
    unitHours: 'Hours',
    unitDays: 'Days',
    expiresHint: (current: string) => `Allowed range: 3 minutes - 3 days (current: ${current})`,
    passwordLabel: 'Access Password (Optional)',
    passwordPlaceholder: 'Set a password to protect the share link',
    passwordHint: 'Up to 30 characters. Letters, numbers, and common symbols are allowed. Spaces are not allowed.',
    shareUrlLabel: 'Share link:',
    copying: 'Copying...',
    expiresAtLabel: 'Expires at:',
    accessPasswordLabel: 'Access password:',
    btnCopyPassword: 'Copy Password',
    btnClose: 'Close',
    btnCreateShare: 'Generate Share Link',
    btnNewShare: 'Create New Share',
    expired: 'Expired',
    day: (n: number) => `${n} day${n === 1 ? '' : 's'}`,
    hour: (n: number) => `${n} hour${n === 1 ? '' : 's'}`,
    minute: (n: number) => `${n} minute${n === 1 ? '' : 's'}`,
    defaultDuration: '3 minutes',
    msgJsonRequired: 'JSON data cannot be empty',
    msgJsonTooLarge: (current: string, max: string) => `The JSON in the editor is too large (${current}; max ${max})`,
    msgInvalidJson: 'Invalid JSON data. Please format the JSON first',
    msgShareNameRequired: 'Share name cannot be empty',
    msgShareNameTooLong: 'Share name cannot exceed 10 characters',
    msgShareNameInvalid: 'Share name can only contain Chinese/English letters, numbers, and common separators (-, _, .)',
    msgPasswordTooLong: 'Password cannot exceed 30 characters',
    msgPasswordInvalid: 'Password contains unsupported characters',
    msgExpiresTooLong: 'Expiration cannot exceed 3 days',
    msgExpiresTooShort: 'Expiration cannot be shorter than 3 minutes',
    msgFingerprintFail: 'Unable to get browser fingerprint. Please refresh the page and try again',
    msgCreateFail: 'Failed to create share link',
    msgCreateFailWithError: (err: string) => `Failed to create share link: ${err}`,
    msgRequestTimeout: 'Request timed out. Please try again later or use smaller JSON data',
    msgNetworkError: 'Network error. Please check your connection and try again',
    msgLinkCopied: 'Link copied',
    msgCopied: 'Copied',
    msgCopyFail: 'Copy failed. Please copy manually',
    msgMySharesLoadFail: 'Failed to load share list',
    promptProtectedMessage: 'This share is password-protected. Please enter the password',
    promptProtectedTitle: 'Password Required',
    promptPasswordPlaceholder: 'Access password',
    btnConfirm: 'OK',
    btnCancel: 'Cancel',
    promptPasswordRequired: 'Please enter the password',
    msgLoadedToEditor: 'Loaded into editor',
    msgLoadFail: 'Load failed',
    unknownError: 'Unknown error',
};

const shareTxt = computed<ShareTxt>(() => (props.locale === 'en' ? SHARE_TXT_EN : SHARE_TXT_ZH));

const SHARE_API_ERROR_EN: Record<string, string> = {
    '无法验证客户端身份，请刷新页面后重试': 'Unable to verify client identity. Please refresh the page and try again',
    '分享ID不能为空': 'Share ID cannot be empty',
    '分享ID格式不正确': 'Invalid share ID format',
    '分享链接不存在或已过期': 'Share link does not exist or has expired',
    '分享链接已过期': 'Share link has expired',
    '密码不正确': 'Incorrect password',
    '密码长度不能超过30位': 'Password cannot exceed 30 characters',
    '密码包含不被允许的字符': 'Password contains unsupported characters',
    '分享名称不能为空': 'Share name cannot be empty',
    '分享名称长度不能超过10个字符': 'Share name cannot exceed 10 characters',
    '分享名称只能包含中英文、数字和常见连字符（-、_、.）': 'Share name can only contain Chinese/English letters, numbers, and common separators (-, _, .)',
    '分享名称已存在，请使用其他名称': 'Share name already exists. Please use another name',
    '请求过于频繁，请稍后再试（每分钟最多3次）': 'Too many requests. Please try again later (up to 3 shares per minute)',
    'JSON数据不能为空': 'JSON data cannot be empty',
    'JSON格式不正确': 'Invalid JSON format',
    '过期时间必须大于0': 'Expiration must be greater than 0',
    '分享链接不存在': 'Share link does not exist',
    '无权限删除该分享（需创建者身份或正确密码）': 'No permission to delete this share (creator identity or correct password required)',
    '分享链接已删除': 'Share link deleted',
    '不支持的请求方法': 'Unsupported request method',
    '服务器错误': 'Server error',
};

const localizeShareApiError = (message?: string, fallback?: string): string => {
    if (!message) return fallback || shareTxt.value.msgLoadFail;
    if (props.locale !== 'en') return message;

    if (SHARE_API_ERROR_EN[message]) {
        return SHARE_API_ERROR_EN[message];
    }

    let match = message.match(/^JSON数据过大（(.+?) MB，最大 (.+?) MB）$/);
    if (match) {
        return `JSON data is too large (${match[1]} MB; max ${match[2]} MB)`;
    }

    match = message.match(/^系统用户数量已达到上限（(.+?) 个），暂时无法创建新用户，请稍后再试$/);
    if (match) {
        return `The system user limit has been reached (${match[1]} users). New users cannot be created right now. Please try again later`;
    }

    match = message.match(/^您创建的分享数量已达到上限（(.+?) 个，最大 (.+?) 个），请先删除一些分享或等待过期$/);
    if (match) {
        return `You have reached the share limit (${match[1]} of ${match[2]}). Please delete some shares or wait for them to expire`;
    }

    match = message.match(/^您的存储空间不足（已使用 (.+?)，最大 (.+?)），请先删除一些分享或等待过期$/);
    if (match) {
        return `Not enough storage space (used ${match[1]}, max ${match[2]}). Please delete some shares or wait for them to expire`;
    }

    match = message.match(/^过期时间不能超过(.+?)天$/);
    if (match) {
        return `Expiration cannot exceed ${match[1]} days`;
    }

    return message;
};

// 对话框显示状态
const dialogVisible = computed({
    get: () => props.modelValue,
    set: value => emit('update:modelValue', value),
});
const jsonSizeBytes = computed(() => getUtf8ByteLength(props.jsonData || ''));
const isJsonTooLarge = computed(() => jsonSizeBytes.value > MAX_SHARE_SIZE_BYTES);
const formattedJsonSize = computed(() => formatBytes(jsonSizeBytes.value));

// 分享设置（仅自定义：数值 + 单位）
const MIN_EXPIRES_IN_MS = 3 * 60 * 1000; // 3分钟
const MAX_EXPIRES_IN_MS = 3 * 24 * 60 * 60 * 1000; // 3天
const customAmount = ref<number>(1);
const customUnit = ref<'minutes' | 'hours' | 'days'>('hours');
const customMin = computed(() => {
    if (customUnit.value === 'minutes') return 3;
    if (customUnit.value === 'hours') return 0.05;
    return 0.01;
});
const customMax = computed(() => {
    if (customUnit.value === 'minutes') return MAX_EXPIRES_IN_MS / (60 * 1000);
    if (customUnit.value === 'hours') return MAX_EXPIRES_IN_MS / (60 * 60 * 1000);
    return MAX_EXPIRES_IN_MS / (24 * 60 * 60 * 1000);
});
const customStep = computed(() => {
    if (customUnit.value === 'minutes') return 1;
    if (customUnit.value === 'hours') return 0.25;
    return 0.05;
});
const customPrecision = computed(() => {
    if (customUnit.value === 'minutes') return 0;
    if (customUnit.value === 'hours') return 2;
    return 2;
});
const expiresIn = computed(() => {
    let ms = 0;
    if (customUnit.value === 'minutes') {
        ms = Math.floor(customAmount.value * 60 * 1000);
    } else if (customUnit.value === 'hours') {
        ms = Math.floor(customAmount.value * 60 * 60 * 1000);
    } else {
        ms = Math.floor(customAmount.value * 24 * 60 * 60 * 1000);
    }
    if (ms < MIN_EXPIRES_IN_MS) ms = MIN_EXPIRES_IN_MS;
    if (ms > MAX_EXPIRES_IN_MS) ms = MAX_EXPIRES_IN_MS;
    return ms;
});
const password = ref('');
const shareName = ref('');

// 分享结果
const shareResult = ref<{
    id: string;
    shareUrl: string;
    expiresAt?: number;
} | null>(null);

// 状态
const loading = ref(false);
const copyLoading = ref(false);
const passwordInputRef = ref<any>(null); // 密码输入框引用

// 我的分享（内嵌折叠）
const mySharesExpanded = ref(false);
const mySharesLoading = ref(false);
const myShares = ref<
    Array<{
        id: string;
        createdAt: number;
        expiresAt?: number;
        size: number;
        shareUrl: string;
        hasPassword: boolean;
        shareName: string;
    }>
>([]);

// 关闭对话框
const handleDialogClose = () => {
    dialogVisible.value = false;
    // 延迟重置，避免关闭动画时闪烁
    setTimeout(() => {
        if (!dialogVisible.value) {
            resetForm();
        }
    }, 300);
};

// 切换单位
const handleCustomUnitChange = () => {
    handleCustomExpiresInChange(customAmount.value);
};

// 处理自定义过期时间变化
const handleCustomExpiresInChange = (value: number | undefined) => {
    if (value !== undefined && value !== null) {
        const min = customMin.value;
        const max = customMax.value;
        if (value < min) value = min;
        if (value > max) value = max;
        customAmount.value = value;
    }
};

// 格式化自定义过期时间显示
const formatCustomExpiresIn = () => {
    let totalMs = 0;
    if (customUnit.value === 'minutes') {
        totalMs = Math.floor(customAmount.value * 60 * 1000);
    } else if (customUnit.value === 'hours') {
        totalMs = Math.floor(customAmount.value * 60 * 60 * 1000);
    } else {
        totalMs = Math.floor(customAmount.value * 24 * 60 * 60 * 1000);
    }
    if (totalMs < MIN_EXPIRES_IN_MS) totalMs = MIN_EXPIRES_IN_MS;
    if (totalMs > MAX_EXPIRES_IN_MS) totalMs = MAX_EXPIRES_IN_MS;
    const days = Math.floor(totalMs / (24 * 60 * 60 * 1000));
    const hours = Math.floor((totalMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    const minutes = Math.floor((totalMs % (60 * 60 * 1000)) / (60 * 1000));
    const parts: string[] = [];
    if (days > 0) parts.push(shareTxt.value.day(days));
    if (hours > 0) parts.push(shareTxt.value.hour(hours));
    if (minutes > 0 && days === 0) parts.push(shareTxt.value.minute(minutes));
    return parts.join(props.locale === 'en' ? ' ' : '') || shareTxt.value.defaultDuration;
};

// 重置表单
const resetForm = () => {
    shareResult.value = null;
    customAmount.value = 1;
    customUnit.value = 'hours';
    password.value = '';
    shareName.value = '';
};

// 处理密码输入框聚焦事件，移除 readonly 属性以阻止密码自动填充
const handlePasswordInputFocus = () => {
    nextTick(() => {
        if (passwordInputRef.value) {
            // 获取 input 组件内部的 input 元素
            const inputEl = passwordInputRef.value.$el?.querySelector('input');
            if (inputEl) {
                // 移除 readonly 属性（如果存在）
                inputEl.removeAttribute('readonly');
                // 确保 autocomplete 属性设置正确
                inputEl.setAttribute('autocomplete', 'new-password');
            }
        }
    });
};

// 输入时约束：分享名称与密码
const handleShareNameInput = () => {
    // 只允许中英文、数字和常见连字符（-、_、.），限制长度到10
    // 中文字符范围：\u4e00-\u9fa5
    // 英文字母和数字：A-Za-z0-9
    // 常见连字符：-、_、.
    const allowed = /[\u4e00-\u9fa5A-Za-z0-9\-_.]/g;
    const chars = (shareName.value || '').match(allowed) || [];
    shareName.value = chars.join('').slice(0, 10);
};

const handlePasswordInput = () => {
    // 允许的密码字符（不含空格），并限制长度到30
    const allowed = /[A-Za-z0-9!@#\$%\^&\*\-_\.\+=:;,\?\(\)\[\]\{\}~]/g;
    const chars = (password.value || '').match(allowed) || [];
    password.value = chars.join('').slice(0, 30);
};

// 监听对话框打开，重置表单
watch(
    () => props.modelValue,
    visible => {
        if (visible) {
            resetForm();
            // 设置密码输入框为 readonly，聚焦时会自动移除
            nextTick(() => {
                if (passwordInputRef.value) {
                    const inputEl = passwordInputRef.value.$el?.querySelector('input');
                    if (inputEl) {
                        inputEl.setAttribute('readonly', 'readonly');
                        inputEl.setAttribute('autocomplete', 'new-password');
                    }
                }
            });
        }
    }
);

// 创建分享
const createShare = async () => {
    // 验证JSON数据
    if (!props.jsonData || !props.jsonData.trim()) {
        showMessageError(shareTxt.value.msgJsonRequired);
        return;
    }

    if (isJsonTooLarge.value) {
        showMessageError(shareTxt.value.msgJsonTooLarge(formattedJsonSize.value, formatBytes(MAX_SHARE_SIZE_BYTES)));
        return;
    }

    // 验证JSON格式
    try {
        JSON.parse(props.jsonData);
    } catch (error) {
        showMessageError(shareTxt.value.msgInvalidJson);
        return;
    }

    // 验证分享名称（必填，最多10字符）
    const name = shareName.value?.trim() || '';
    if (!name || name.length === 0) {
        showMessageError(shareTxt.value.msgShareNameRequired);
        return;
    }
    if (name.length > 10) {
        showMessageError(shareTxt.value.msgShareNameTooLong);
        return;
    }
    // 验证字符：只允许中英文、数字和常见连字符（-、_、.）
    const shareNamePattern = /^[\u4e00-\u9fa5A-Za-z0-9\-_.]+$/;
    if (!shareNamePattern.test(name)) {
        showMessageError(shareTxt.value.msgShareNameInvalid);
        return;
    }

    // 验证密码（最多30位 + 字符集限制）
    if (password.value) {
        if (password.value.length > 30) {
            showMessageError(shareTxt.value.msgPasswordTooLong);
            return;
        }
        const passwordAllowed = /^[A-Za-z0-9!@#\$%\^&\*\-_\.\+=:;,\?\(\)\[\]\{\}~]+$/;
        if (!passwordAllowed.test(password.value)) {
            showMessageError(shareTxt.value.msgPasswordInvalid);
            return;
        }
    }

    // 验证过期时间（3分钟 - 3天）
    const MAX_EXPIRES_IN = MAX_EXPIRES_IN_MS; // 3天
    const MIN_EXPIRES_IN = MIN_EXPIRES_IN_MS; // 3分钟
    if (expiresIn.value && expiresIn.value > MAX_EXPIRES_IN) {
        showMessageError(shareTxt.value.msgExpiresTooLong);
        return;
    }
    if (expiresIn.value && expiresIn.value < MIN_EXPIRES_IN) {
        showMessageError(shareTxt.value.msgExpiresTooShort);
        return;
    }

    loading.value = true;

    // 创建 AbortController 用于超时控制
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60秒超时

    try {
        // 获取加密的浏览器指纹
        let encryptedFingerprint = '';
        try {
            const fingerprintDetector = FingerprintDetector.getInstance();
            const fingerprintResult = await fingerprintDetector.getFingerprint();
            encryptedFingerprint = fingerprintResult.fingerprintId;
        } catch (error: any) {
            showMessageError(shareTxt.value.msgFingerprintFail);
            loading.value = false;
            return;
        }

        const response = await $fetch<{
            success: boolean;
            data?: {
                id: string;
                shareUrl: string;
                expiresAt?: number;
            };
            error?: string;
        }>('/api/share-json', {
            method: 'POST',
            headers: {
                'x-client-id': encryptedFingerprint,
            },
            body: {
                jsonData: props.jsonData,
                password: password.value || undefined,
                expiresIn: expiresIn.value || undefined,
                shareName: name,
            },
            signal: controller.signal,
        });

        if (response.success && response.data) {
            shareResult.value = response.data;
        } else {
            showMessageError(localizeShareApiError(response.error, shareTxt.value.msgCreateFail));
        }
    } catch (error: any) {
        // 判断是否为超时错误
        if (error.name === 'AbortError' || error.message?.includes('aborted')) {
            showMessageError(shareTxt.value.msgRequestTimeout);
        } else if (error.message?.includes('fetch') || error.message?.includes('network')) {
            showMessageError(shareTxt.value.msgNetworkError);
        } else {
            showMessageError(shareTxt.value.msgCreateFailWithError(error.message || shareTxt.value.unknownError));
        }
    } finally {
        clearTimeout(timeoutId);
        loading.value = false;
    }
};

// 复制分享链接
const copyShareUrl = async () => {
    if (!shareResult.value) return;

    copyLoading.value = true;
    try {
        // 优先使用现代 Clipboard API
        await navigator.clipboard.writeText(shareResult.value.shareUrl);
        showMessageSuccess(shareTxt.value.msgLinkCopied);
    } catch (error) {
        // 降级方案：使用传统方法（execCommand 已废弃，但作为兼容性降级方案）
        const textarea = document.createElement('textarea');
        textarea.value = shareResult.value.shareUrl;
        textarea.readOnly = true; // 防止用户看到选中内容
        textarea.style.position = 'fixed';
        textarea.style.left = '-999999px';
        textarea.style.top = '-999999px';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        try {
            // document.execCommand 已废弃，但作为降级方案仍可使用
            const success = document.execCommand('copy');
            if (!success) {
                throw new Error('execCommand failed');
            }
        } catch (err) {
            showMessageError(shareTxt.value.msgCopyFail);
        } finally {
            document.body.removeChild(textarea);
        }
    } finally {
        copyLoading.value = false;
    }
};

// 通用复制
const copyText = async (text: string, successTip = shareTxt.value.msgCopied) => {
    try {
        await navigator.clipboard.writeText(text);
        showMessageSuccess(successTip);
    } catch (error) {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.readOnly = true;
        textarea.style.position = 'fixed';
        textarea.style.left = '-999999px';
        textarea.style.top = '-999999px';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        try {
            const success = document.execCommand('copy');
            if (success) {
                showMessageSuccess(successTip);
            } else {
                throw new Error('execCommand failed');
            }
        } catch {
            showMessageError(shareTxt.value.msgCopyFail);
        } finally {
            document.body.removeChild(textarea);
        }
    }
};

// 复制密码
const copyPassword = async () => {
    if (!password.value) return;

    try {
        // 优先使用现代 Clipboard API
        await navigator.clipboard.writeText(password.value);
    } catch (error) {
        // 降级方案：使用传统方法（execCommand 已废弃，但作为兼容性降级方案）
        const textarea = document.createElement('textarea');
        textarea.value = password.value;
        textarea.readOnly = true; // 防止用户看到选中内容
        textarea.style.position = 'fixed';
        textarea.style.left = '-999999px';
        textarea.style.top = '-999999px';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        try {
            // document.execCommand 已废弃，但作为降级方案仍可使用
            const success = document.execCommand('copy');
            if (!success) {
                throw new Error('execCommand failed');
            }
        } catch (err) {
            showMessageError(shareTxt.value.msgCopyFail);
        } finally {
            document.body.removeChild(textarea);
        }
    }
};

// 格式化过期时间
const formatExpiresAt = (timestamp: number) => {
    const now = new Date();
    const diff = timestamp - now.getTime();

    if (diff < 0) {
        return shareTxt.value.expired;
    }

    const days = Math.floor(diff / (24 * 60 * 60 * 1000));
    const hours = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));

    if (days > 0) {
        return `${formatDateTime(timestamp)}`;
    } else if (hours > 0) {
        return `${formatDateTime(timestamp)}`;
    } else {
        return `${formatDateTime(timestamp)}`;
    }
};

// 折叠开关
const toggleMyShares = async () => {
    mySharesExpanded.value = !mySharesExpanded.value;
    if (mySharesExpanded.value && myShares.value.length === 0) {
        await fetchMyShares();
    }
};

// 加载“我的分享”
const fetchMyShares = async () => {
    mySharesLoading.value = true;
    try {
        // 获取加密的浏览器指纹
        const fingerprintDetector = FingerprintDetector.getInstance();
        const fingerprintResult = await fingerprintDetector.getFingerprint();
        const encryptedFingerprint = fingerprintResult.fingerprintId;

        const response = await $fetch<{
            success: boolean;
            data?: any[];
            error?: string;
        }>('/api/share-json?mine=1', {
            method: 'GET',
            headers: {
                'x-client-id': encryptedFingerprint,
            },
        });
        if (response.success && Array.isArray(response.data)) {
            myShares.value = response.data.map(item => ({
                id: item.id,
                createdAt: item.createdAt,
                expiresAt: item.expiresAt,
                size: item.size,
                shareUrl: item.shareUrl,
                hasPassword: !!item.hasPassword,
                shareName: item.shareName,
            }));
        } else {
            showMessageError(localizeShareApiError(response.error, shareTxt.value.msgMySharesLoadFail));
        }
    } catch (e: any) {
        showMessageError(localizeShareApiError(e?.message, shareTxt.value.msgMySharesLoadFail));
    } finally {
        mySharesLoading.value = false;
    }
};

// 加载分享到编辑区域
const loadShareIntoEditor = async (row: any) => {
    try {
        let passwordInput: string | undefined = undefined;
        if (row.hasPassword) {
            const { value }: any = await ElMessageBox.prompt(shareTxt.value.promptProtectedMessage, shareTxt.value.promptProtectedTitle, {
                inputType: 'password',
                inputPlaceholder: shareTxt.value.promptPasswordPlaceholder,
                confirmButtonText: shareTxt.value.btnConfirm,
                cancelButtonText: shareTxt.value.btnCancel,
                inputValidator: (val: string) => !!val || shareTxt.value.promptPasswordRequired,
            });
            passwordInput = value;
        }
        const res = await $fetch<{
            success: boolean;
            data?: { jsonData: string };
            error?: string;
            hasPassword?: boolean;
        }>(`/api/share-json?id=${encodeURIComponent(row.id)}${passwordInput ? `&password=${encodeURIComponent(passwordInput)}` : ''}`, {
            method: 'GET',
        });
        if (res.success && res.data?.jsonData) {
            // 将内容发射给父组件处理注入到编辑区域
            emit('loadSharedJson', res.data.jsonData);
            showMessageSuccess(shareTxt.value.msgLoadedToEditor);
        } else {
            showMessageError(localizeShareApiError(res.error, shareTxt.value.msgLoadFail));
        }
    } catch {
        // 用户取消等不提示错误
    }
};

// 产品定位：禁止手动删除分享链接，相关逻辑已移除
</script>

<style scoped>
.share-dialog-wrapper {
    max-width: 90vw;
}

/* 内嵌“我的分享”区域样式优化 */
.my-shares {
    margin-bottom: 16px;
    background: #fafafa;
    border-radius: 4px;
    overflow: hidden;
}
.my-shares-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 12px;
    background: #f5f7fa;
    cursor: pointer;
    user-select: none;
}
.my-shares-header:hover {
    background: #eef1f6;
}
.my-shares-title {
    font-weight: 600;
    color: #303133;
}
.my-shares-toggle {
    color: #909399;
    font-size: 12px;
}
.my-shares-body {
    padding: 12px;
}
.my-shares-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 10px;
}

/* 刷新按钮固定宽度，避免文字/图标切换抖动 */
.no-jitter {
    min-width: 64px;
}

/* URL 片样式（可点击复制） */
.url-chip {
    display: inline-block;
    max-width: 420px;
    padding: 4px 8px;
    border-radius: 4px;
    background: #f5f7fa;
    color: var(--el-color-primary);
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    cursor: pointer;
    transition: background-color 0.15s ease, color 0.15s ease;
}
.url-chip:hover {
    background: #eef1f6;
    color: var(--el-color-primary-dark-2);
}

/* 限制对话框最大高度，防止超出视口 */
.share-dialog-wrapper :deep(.el-dialog) {
    max-height: calc(100vh - 12vh);
    display: flex;
    flex-direction: column;
    margin-top: 0 !important;
    margin-bottom: 0 !important;
}

.dialog-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    gap: 16px;
}

.dialog-title {
    font-size: 18px;
    font-weight: 600;
    color: #303133;
    line-height: 1.5;
}

.dialog-close-btn {
    background: none;
    border: none;
    font-family: system-ui, -apple-system, 'Segoe UI', Arial, sans-serif;
    font-size: 14px;
    font-weight: 600;
    line-height: 1;
    color: #909399;
    cursor: pointer;
    padding: 0;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background-color 0.2s, color 0.2s, transform 0.15s;
    text-align: center;
    vertical-align: middle;
}

.dialog-close-btn:hover {
    background: #f2f3f5;
    color: #303133;
    transform: scale(1.08);
}

.dialog-close-btn:active {
    transform: scale(0.96);
}

.form-item {
    margin-bottom: 20px;
}

.form-item:last-child {
    margin-bottom: 0;
}

.form-label {
    display: block;
    margin-bottom: 8px;
    font-size: 14px;
    color: #606266;
    font-weight: 500;
}

.form-hint {
    margin-top: 5px;
    font-size: 12px;
    color: #909399;
}

/* 限制分享说明文本框的最大高度 */
.share-dialog :deep(.el-textarea__inner) {
    max-height: 200px;
    overflow-y: auto !important;
    resize: vertical;
}

.share-dialog :deep(.el-textarea__inner)::-webkit-scrollbar-track {
    background: #f1f1f1;
    border-radius: 4px;
}

.share-dialog :deep(.el-textarea__inner)::-webkit-scrollbar-thumb {
    background: #c1c1c1;
    border-radius: 4px;
}

.share-dialog :deep(.el-textarea__inner)::-webkit-scrollbar-thumb:hover {
    background: #a8a8a8;
}

.share-url-container {
    display: flex;
    gap: 10px;
    align-items: center;
}

.share-url-input {
    flex: 1;
}

.expires-info {
    font-size: 14px;
    color: #606266;
    padding: 8px 12px;
    background-color: #f5f7fa;
    border-radius: 4px;
}

.password-info {
    display: flex;
    gap: 10px;
    align-items: center;
}

.password-display {
    flex: 1;
}

.share-result {
    margin-top: 10px;
}

.dialog-footer {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
}

/* 响应式设计 */
@media (max-width: 768px) {
    .share-url-container {
        flex-direction: column;
        align-items: stretch;
    }

    .share-url-container .el-button {
        width: 100%;
    }

    .password-info {
        flex-direction: column;
        align-items: stretch;
    }

    .password-info .el-button {
        width: 100%;
    }
}
</style>
