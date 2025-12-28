<template>
    <div>
        <!-- 分享对话框 -->
        <el-dialog
            v-model="dialogVisible"
            class="share-dialog-wrapper"
            title="分享JSON数据"
            :close-on-click-modal="false"
            :show-close="true"
            :align-center="false"
            top="12vh"
            width="850px"
            @close="handleDialogClose"
        >
            <div class="share-dialog">
                <!-- 分享设置 -->
                <div v-if="!shareResult" class="share-settings">
                    <!-- 免费服务限制提示 -->
                    <el-alert
                        type="info"
                        :closable="false"
                        style="margin-bottom: 20px;"
                    >
                        <template #title>
                            <span style="font-size: 12px;">
                                <strong>免费服务限制：</strong>分享输入区域的JSON数据，单次分享最大2MB数据，每个用户最多5次分享，每分钟最多分享3次。
                            </span>
                        </template>
                    </el-alert>

                    <!-- 我的分享（可折叠） -->
                    <div class="my-shares">
                        <div class="my-shares-header" @click="toggleMyShares">
                            <span class="my-shares-title">我的分享</span>
                            <span class="my-shares-toggle">{{ mySharesExpanded ? '收起' : '展开' }}</span>
                        </div>
                        <el-collapse-transition>
                            <div v-show="mySharesExpanded" class="my-shares-body">
                                <el-table
                                    :data="myShares"
                                    size="small"
                                    border
                                    :style="{ width: '100%' }"
                                    empty-text="暂无分享"
                                    :header-cell-style="{ textAlign: 'center' }"
                                    :cell-style="{ textAlign: 'center' }"
                                    :fit="true"
                                >
                                    <el-table-column prop="shareName" label="分享名称" width="150" align="center" header-align="center">
                                        <template #default="{ row }">
                                            <span v-if="row.shareName">{{ row.shareName }}</span>
                                            <span v-else style="color: #909399;">—</span>
                                        </template>
                                    </el-table-column>
                                    <el-table-column prop="expiresAt" label="过期时间" width="200" align="center" header-align="center">
                                        <template #default="{ row }">
                                            <span v-if="row.expiresAt">{{ new Date(row.expiresAt).toLocaleString('zh-CN') }}</span>
                                            <span v-else>—</span>
                                        </template>
                                    </el-table-column>
                                    <el-table-column prop="hasPassword" label="需要密码" width="110" align="center" header-align="center">
                                        <template #default="{ row }">
                                            <el-tag size="small" :type="row.hasPassword ? 'warning' : 'success'">
                                                {{ row.hasPassword ? '是' : '否' }}
                                            </el-tag>
                                        </template>
                                    </el-table-column>
                                    <el-table-column label="操作" :min-width="200" fixed="right" align="center" header-align="center">
                                        <template #default="{ row }">
                                            <el-button
                                                type="primary"
                                                size="small"
                                                @click="loadShareIntoEditor(row)"
                                            >
                                                使用
                                            </el-button>
                                            <el-button
                                                size="small"
                                                @click="copyText(row.shareUrl, '链接已复制')"
                                            >
                                                复制链接
                                            </el-button>
                                        </template>
                                    </el-table-column>
                                </el-table>
                                <div class="my-shares-actions">
                                    <el-button size="small" @click="toggleMyShares">收起</el-button>
                                    <el-button size="small" type="primary" @click="fetchMyShares" :disabled="mySharesLoading" class="no-jitter">
                                        刷新
                                    </el-button>
                                </div>
                            </div>
                        </el-collapse-transition>
                    </div>

                    <form @submit.prevent="createShare">
                        <div class="form-item">
                            <label class="form-label" for="share-name">
                                分享名称 <span style="color: #f56c6c;">*</span>
                            </label>
                            <el-input
                                id="share-name"
                                v-model="shareName"
                                placeholder="请输入分享名称（10个字符以内，中英文、数字及常见连字符）"
                                maxlength="10"
                                show-word-limit
                                clearable
                                @input="handleShareNameInput"
                            />
                            <div class="form-hint">必填，最多10个字符，只能包含中英文、数字和常见连字符（-、_、.），对同一用户具有唯一性</div>
                        </div>

                        <div class="form-item">
                            <label class="form-label" for="expires-amount">过期时间</label>
                            <div style="margin-top: 0;">
                                <div class="custom-exp-row" style="display: flex; gap: 8px;">
                                    <el-input-number
                                        id="expires-amount"
                                        v-model="customAmount"
                                        :min="customMin"
                                        :max="customMax"
                                        :step="customStep"
                                        :precision="customPrecision"
                                        placeholder="请输入数值"
                                        style="width: 60%"
                                        @change="handleCustomExpiresInChange"
                                    />
                                    <el-select id="expires-unit" v-model="customUnit" style="width: 38%" @change="handleCustomUnitChange">
                                        <el-option label="分钟" value="minutes" />
                                        <el-option label="小时" value="hours" />
                                        <el-option label="天" value="days" />
                                    </el-select>
                                </div>
                                <div class="form-hint" style="margin-top: 5px;">
                                    允许范围：3分钟 - 3天（当前：{{ formatCustomExpiresIn() }}）
                                </div>
                            </div>
                        </div>

                        <div class="form-item">
                            <label class="form-label" for="share-password">访问密码（可选）</label>
                            <el-input
                                id="share-password"
                                ref="passwordInputRef"
                                v-model="password"
                                type="password"
                                placeholder="设置密码以保护分享链接"
                                clearable
                                show-password
                                autocomplete="new-password"
                                maxlength="30"
                                show-word-limit
                                @input="handlePasswordInput"
                                @focus="handlePasswordInputFocus"
                            />
                            <div class="form-hint">最多30位，允许英文、数字及常用符号（不含空格）</div>
                        </div>
                    </form>
                </div>

                <!-- 分享结果 -->
                <div v-if="shareResult" class="share-result">
                    <div class="form-item">
                        <label class="form-label" for="share-url">分享链接：</label>
                        <div class="share-url-container">
                            <el-input
                                id="share-url"
                                v-model="shareResult.shareUrl"
                                readonly
                                class="share-url-input"
                            />
                            <el-button
                                type="primary"
                                @click="copyShareUrl"
                                :loading="copyLoading"
                            >
                                {{ copyLoading ? '复制中...' : '复制链接' }}
                            </el-button>
                        </div>
                    </div>

                    <div class="form-item" v-if="shareResult.expiresAt">
                        <label class="form-label">过期时间：</label>
                        <div class="expires-info">
                            {{ formatExpiresAt(shareResult.expiresAt) }}
                        </div>
                    </div>

                    <div class="form-item" v-if="password">
                        <label class="form-label" for="access-password">访问密码：</label>
                        <div class="password-info">
                            <el-input
                                id="access-password"
                                v-model="password"
                                readonly
                                type="password"
                                class="password-display"
                            />
                            <el-button
                                type="info"
                                @click="copyPassword"
                                size="small"
                            >
                                复制密码
                            </el-button>
                        </div>
                    </div>
                </div>

                <!-- 错误提示 -->
                <div v-if="errorMessage" class="error-message">
                    <el-alert
                        type="error"
                        :closable="false"
                        show-icon
                    >
                        <template #title>
                            <span>{{ errorMessage }}</span>
                        </template>
                    </el-alert>
                </div>
            </div>

            <template #footer>
                <div class="dialog-footer">
                    <el-button @click="handleDialogClose">关闭</el-button>
                    <el-button
                        v-if="!shareResult"
                        type="primary"
                        @click="createShare"
                        :loading="loading"
                    >
                        生成分享链接
                    </el-button>
                    <el-button
                        v-if="shareResult"
                        type="primary"
                        @click="resetForm"
                    >
                        创建新分享
                    </el-button>
                </div>
            </template>
        </el-dialog>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { showMessageSuccess as showSuccess, showMessageError as showError } from '~/utils/api';
import { FingerprintDetector } from '~/utils/fingerprint';

// Props
interface Props {
    modelValue: boolean;
    jsonData: string;
}

const props = defineProps<Props>();

// Emits
const emit = defineEmits<{
    'update:modelValue': [value: boolean];
    'loadSharedJson': [value: string];
}>();

// 对话框显示状态
const dialogVisible = computed({
    get: () => props.modelValue,
    set: (value) => emit('update:modelValue', value)
});

// 分享设置（仅自定义：数值 + 单位）
const MIN_EXPIRES_IN_MS = 3 * 60 * 1000; // 3分钟
const MAX_EXPIRES_IN_MS = 3 * 24 * 60 * 60 * 1000; // 3天
const customAmount = ref<number>(1);
const customUnit = ref<'minutes' | 'hours' | 'days'>('hours');
const customMin = computed(() => {
    if (customUnit.value === 'minutes') return 3;
    if (customUnit.value === 'hours') return 0.1;
    return 0.01;
});
const customMax = computed(() => {
    if (customUnit.value === 'minutes') return (MAX_EXPIRES_IN_MS / (60 * 1000));
    if (customUnit.value === 'hours') return (MAX_EXPIRES_IN_MS / (60 * 60 * 1000));
    return (MAX_EXPIRES_IN_MS / (24 * 60 * 60 * 1000));
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
const errorMessage = ref('');
const passwordInputRef = ref<any>(null); // 密码输入框引用

// 我的分享（内嵌折叠）
const mySharesExpanded = ref(false);
const mySharesLoading = ref(false);
const myShares = ref<Array<{
    id: string;
    createdAt: number;
    expiresAt?: number;
    size: number;
    shareUrl: string;
    hasPassword: boolean;
    shareName: string;
}>>([]);

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
    if (days > 0) parts.push(`${days}天`);
    if (hours > 0) parts.push(`${hours}小时`);
    if (minutes > 0 && days === 0) parts.push(`${minutes}分钟`);
    return parts.join('') || '3分钟';
};

// 重置表单
const resetForm = () => {
    shareResult.value = null;
    customAmount.value = 1;
    customUnit.value = 'hours';
    password.value = '';
    shareName.value = '';
    errorMessage.value = '';
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
watch(() => props.modelValue, (visible) => {
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
});

// 创建分享
const createShare = async () => {
    // 验证JSON数据
    if (!props.jsonData || !props.jsonData.trim()) {
        errorMessage.value = 'JSON数据不能为空';
        return;
    }

    // 验证JSON格式
    try {
        JSON.parse(props.jsonData);
    } catch (error) {
        errorMessage.value = 'JSON 数据格式不正确，请先格式化 JSON 数据';
        return;
    }

    // 验证分享名称（必填，最多10字符）
    const name = shareName.value?.trim() || '';
    if (!name || name.length === 0) {
        errorMessage.value = '分享名称不能为空';
        return;
    }
    if (name.length > 10) {
        errorMessage.value = '分享名称长度不能超过10个字符';
        return;
    }
    // 验证字符：只允许中英文、数字和常见连字符（-、_、.）
    const shareNamePattern = /^[\u4e00-\u9fa5A-Za-z0-9\-_.]+$/;
    if (!shareNamePattern.test(name)) {
        errorMessage.value = '分享名称只能包含中英文、数字和常见连字符（-、_、.）';
        return;
    }

    // 验证密码（最多30位 + 字符集限制）
    if (password.value) {
        if (password.value.length > 30) {
            errorMessage.value = '密码长度不能超过30位';
            return;
        }
        const passwordAllowed = /^[A-Za-z0-9!@#\$%\^&\*\-_\.\+=:;,\?\(\)\[\]\{\}~]+$/;
        if (!passwordAllowed.test(password.value)) {
            errorMessage.value = '密码包含不被允许的字符';
            return;
        }
    }

    // 验证过期时间（3分钟 - 3天）
    const MAX_EXPIRES_IN = MAX_EXPIRES_IN_MS; // 3天
    const MIN_EXPIRES_IN = MIN_EXPIRES_IN_MS; // 3分钟
    if (expiresIn.value && expiresIn.value > MAX_EXPIRES_IN) {
        errorMessage.value = '过期时间不能超过3天';
        return;
    }
    if (expiresIn.value && expiresIn.value < MIN_EXPIRES_IN) {
        errorMessage.value = '过期时间不能少于3分钟';
        return;
    }

    loading.value = true;
    errorMessage.value = '';

    try {
        // 获取加密的浏览器指纹
        let encryptedFingerprint = '';
        try {
            const fingerprintDetector = FingerprintDetector.getInstance();
            const fingerprintResult = await fingerprintDetector.getFingerprint();
            encryptedFingerprint = fingerprintResult.fingerprintId;
        } catch (error: any) {
            errorMessage.value = '无法获取浏览器指纹，请刷新页面后重试';
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
        });

        if (response.success && response.data) {
            shareResult.value = response.data;
        } else {
            errorMessage.value = response.error || '创建分享链接失败';
        }
    } catch (error: any) {
        errorMessage.value = '创建分享链接失败: ' + (error.message || '未知错误');
    } finally {
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
        showMessageSuccess('链接已复制');
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
            showMessageError('复制失败，请手动复制');
        } finally {
            document.body.removeChild(textarea);
        }
    } finally {
        copyLoading.value = false;
    }
};

// 通用复制
const copyText = async (text: string, successTip = '已复制') => {
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
            showMessageError('复制失败，请手动复制');
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
            showMessageError('复制失败，请手动复制');
        } finally {
            document.body.removeChild(textarea);
        }
    }
};

// 格式化过期时间
const formatExpiresAt = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = timestamp - now.getTime();
    
    if (diff < 0) {
        return '已过期';
    }

    const days = Math.floor(diff / (24 * 60 * 60 * 1000));
    const hours = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    const minutes = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));

    if (days > 0) {
        return `${date.toLocaleString('zh-CN')}`;
    } else if (hours > 0) {
        return `${date.toLocaleString('zh-CN')}`;
    } else {
        return `${date.toLocaleString('zh-CN')}`;
    }
};

// 工具函数：截断字符串到指定长度，超出加…
const truncate = (text: string, max = 30) => {
    if (!text) return '';
    return text.length > max ? (text.slice(0, max) + '…') : text;
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
            showMessageError(response.error || '获取分享列表失败');
        }
    } catch (e: any) {
        showMessageError(e?.message || '获取分享列表失败');
    } finally {
        mySharesLoading.value = false;
    }
};

// 加载分享到输入区域
const loadShareIntoEditor = async (row: any) => {
    try {
        let passwordInput: string | undefined = undefined;
        if (row.hasPassword) {
            const { value } = await ElMessageBox.prompt('该分享受密码保护，请输入密码', '需要密码', {
                inputType: 'password',
                inputPlaceholder: '访问密码',
                confirmButtonText: '确定',
                cancelButtonText: '取消',
                inputValidator: (val: string) => !!val || '请输入密码',
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
            // 将内容发射给父组件处理注入到输入区域
            emit('loadSharedJson', res.data.jsonData);
            showMessageSuccess('已加载到输入区域');
        } else {
            showMessageError(res.error || '加载失败');
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
    border: 1px solid #ebeef5;
    border-radius: 6px;
    overflow: hidden;
}
.my-shares-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 12px;
    background: #f5f7fa;
    border-bottom: 1px solid #ebeef5;
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
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    cursor: pointer;
    transition: background-color .15s ease, color .15s ease;
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

.error-message {
    margin-top: 20px;
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

