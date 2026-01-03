<template>
    <el-dialog
        v-model="dialogVisible"
        :title="title"
        :close-on-click-modal="false"
        :show-close="true"
        :align-center="false"
        top="30vh"
        width="450px"
        @close="handleClose"
    >
        <div class="archive-name-dialog">
            <div class="form-item">
                <el-input
                    ref="inputRef"
                    v-model="archiveName"
                    :placeholder="placeholder"
                    :maxlength="20"
                    show-word-limit
                    clearable
                    @keyup.enter="handleConfirm"
                    @input="handleInput"
                />
                <div v-if="errorMessage" class="field-error">{{ errorMessage }}</div>
            </div>
        </div>
        <template #footer>
            <div class="dialog-footer">
                <el-button @click="handleCancel">取消</el-button>
                <el-button type="primary" @click="handleConfirm">保存</el-button>
            </div>
        </template>
    </el-dialog>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue';

interface JsonArchive {
    id: string;
    name: string;
    size: number;
    content: string;
}

interface Props {
    modelValue: boolean;
    title?: string;
    inputValue?: string;
    placeholder?: string;
    existingArchives?: JsonArchive[];
    excludeArchiveId?: string; // 编辑时排除的存档ID
}

const props = withDefaults(defineProps<Props>(), {
    title: '保存存档',
    inputValue: '',
    placeholder: '请输入存档名称',
    existingArchives: () => [],
    excludeArchiveId: '',
});

const emit = defineEmits<{
    'update:modelValue': [value: boolean];
    confirm: [value: string];
    cancel: [];
}>();

const dialogVisible = ref(false);
const archiveName = ref('');
const errorMessage = ref('');
const inputRef = ref();

// 合法字符：中英文、数字、常见连字符（- _）和常见的几个数学符号（+ * / = . : @ #）
const allowedCharPattern = /^[A-Za-z0-9\u4e00-\u9fa5\-\_\+\*\/=\.\:\@\#]$/;

// 检测非法字符
const checkInvalidChars = (value: string): string[] => {
    const invalidChars: string[] = [];
    for (let i = 0; i < value.length; i++) {
        const char = value[i];
        if (!allowedCharPattern.test(char)) {
            if (!invalidChars.includes(char)) {
                invalidChars.push(char);
            }
        }
    }
    return invalidChars;
};

// 检查名称是否重复
const checkNameDuplicate = (name: string): boolean => {
    if (!props.existingArchives || props.existingArchives.length === 0) {
        return false;
    }
    return props.existingArchives.some(archive => archive.name === name && archive.id !== props.excludeArchiveId);
};

// 处理输入变化，实时校验
const handleInput = () => {
    errorMessage.value = '';

    if (!archiveName.value) {
        return;
    }

    const invalidChars = checkInvalidChars(archiveName.value);
    if (invalidChars.length > 0) {
        errorMessage.value = '字符限制：中英文、数字和常见字符（- _ + * / = . :）';
        return;
    }

    // 检查名称是否重复
    const trimmedName = archiveName.value.trim();
    if (trimmedName && checkNameDuplicate(trimmedName)) {
        errorMessage.value = '存档名称已存在，请使用其他名称';
    }
};

// 监听 modelValue 变化
watch(
    () => props.modelValue,
    newVal => {
        dialogVisible.value = newVal;
        if (newVal) {
            archiveName.value = props.inputValue || '';
            errorMessage.value = '';
            // 弹窗打开后聚焦输入框
            nextTick(() => {
                inputRef.value?.focus();
                // 如果初始值包含非法字符，也要提示
                if (archiveName.value) {
                    handleInput();
                }
            });
        }
    }
);

// 监听 dialogVisible 变化，同步到父组件
watch(dialogVisible, newVal => {
    if (!newVal) {
        emit('update:modelValue', false);
    }
});

const validateInput = (): boolean => {
    errorMessage.value = '';

    if (!archiveName.value || !archiveName.value.trim()) {
        errorMessage.value = '存档名称不能为空';
        return false;
    }

    // 检查非法字符
    const invalidChars = checkInvalidChars(archiveName.value);
    if (invalidChars.length > 0) {
        errorMessage.value = '合法字符：中英文、数字、连字符（- _）和数学符号（+ * / = . : @ #）';
        return false;
    }

    // 验证字符规则：长度 1-20，仅限中英文、数字、常见连字符和数学符号
    const pattern = /^[A-Za-z0-9\u4e00-\u9fa5\-\_\+\*\/=\.\:\@\#]{1,20}$/;
    if (!pattern.test(archiveName.value)) {
        errorMessage.value = '合法字符：中英文、数字、连字符（- _）和数学符号（+ * / = . : @ #）';
        return false;
    }

    // 检查名称是否重复
    const trimmedName = archiveName.value.trim();
    if (checkNameDuplicate(trimmedName)) {
        errorMessage.value = '存档名称已存在，请使用其他名称';
        return false;
    }

    return true;
};

const handleConfirm = () => {
    if (validateInput()) {
        emit('confirm', archiveName.value.trim());
        dialogVisible.value = false;
    }
};

const handleCancel = () => {
    emit('cancel');
    dialogVisible.value = false;
};

const handleClose = () => {
    emit('cancel');
};
</script>

<style scoped>
.archive-name-dialog {
    padding: 10px 0;
}

.form-item {
    margin-bottom: 0;
}

.field-error {
    margin-top: 5px;
    color: #f56c6c;
    font-size: 12px;
}

.dialog-footer {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
}
</style>
