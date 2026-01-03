<template>
    <div>
        <!-- 数据脱敏对话框 -->
        <el-dialog
            v-model="dialogVisible"
            class="data-masking-dialog-wrapper"
            title="数据脱敏"
            :close-on-click-modal="false"
            :show-close="true"
            :align-center="false"
            top="12vh"
            width="850px"
            @close="handleDialogClose"
        >
            <div class="data-masking-dialog">
                <!-- 使用说明 -->
                <el-alert type="info" :closable="false" style="margin-bottom: 20px">
                    <template #title>
                        <div style="font-size: 12px; line-height: 1.6">
                            <p style="margin: 0 0 8px 0">
                                <strong>功能说明：</strong>对JSON数据中的敏感字段进行脱敏处理。适用于分享数据前隐藏敏感信息，如密码、手机号、邮箱、身份证号等。
                            </p>
                            <div style="margin-top: 8px">
                                <el-button text type="primary" size="small" @click="togglePathHelp" style="padding: 0; font-size: 12px; height: auto">
                                    <el-icon style="margin-right: 4px; transition: transform 0.3s" :style="{ transform: showPathHelp ? 'rotate(90deg)' : 'rotate(0deg)' }">
                                        <ArrowRight />
                                    </el-icon>
                                    {{ showPathHelp ? '收起' : '展开' }}路径字段匹配规则说明
                                </el-button>
                            </div>
                            <el-collapse-transition>
                                <div v-show="showPathHelp" style="margin-top: 12px; padding: 12px; background-color: #f5f7fa; border-radius: 4px; border-left: 3px solid #409eff">
                                    <div style="font-size: 12px; line-height: 1.8; color: #606266">
                                        <p style="margin: 0 0 10px 0; font-weight: 600; color: #303133">字段路径匹配规则：</p>

                                        <div style="margin-bottom: 12px">
                                            <p style="margin: 0 0 6px 0; font-weight: 600; color: #409eff">1. 精确路径匹配</p>
                                            <p style="margin: 0 0 4px 0; padding-left: 12px">
                                                • 输入完整路径，如：<code style="background: #fff; padding: 2px 6px; border-radius: 2px">user.password</code> 或
                                                <code style="background: #fff; padding: 2px 6px; border-radius: 2px">company.name</code>
                                            </p>
                                            <p style="margin: 0; padding-left: 12px; color: #909399; font-size: 11px">
                                                示例：输入 <code style="background: #fff; padding: 2px 6px; border-radius: 2px">name</code> 只匹配根层级的
                                                <code style="background: #fff; padding: 2px 6px; border-radius: 2px">name</code> 字段；输入
                                                <code style="background: #fff; padding: 2px 6px; border-radius: 2px">company.name</code> 匹配特定路径
                                            </p>
                                        </div>

                                        <div style="margin-bottom: 12px">
                                            <p style="margin: 0 0 6px 0; font-weight: 600; color: #409eff">2. 通配符匹配</p>
                                            <p style="margin: 0 0 4px 0; padding-left: 12px">
                                                • 使用 <code style="background: #fff; padding: 2px 6px; border-radius: 2px">*</code> 匹配任意字段名，如：<code
                                                    style="background: #fff; padding: 2px 6px; border-radius: 2px"
                                                    >*.password</code
                                                >
                                            </p>
                                            <p style="margin: 0; padding-left: 12px; color: #909399; font-size: 11px">
                                                示例：<code style="background: #fff; padding: 2px 6px; border-radius: 2px">*.password</code> 会匹配
                                                <code style="background: #fff; padding: 2px 6px; border-radius: 2px">user.password</code>、<code
                                                    style="background: #fff; padding: 2px 6px; border-radius: 2px"
                                                    >root.admin.password</code
                                                >
                                                等
                                            </p>
                                        </div>

                                        <div style="margin-bottom: 12px">
                                            <p style="margin: 0 0 6px 0; font-weight: 600; color: #409eff">3. 数组通配符匹配</p>
                                            <p style="margin: 0 0 4px 0; padding-left: 12px">
                                                • 使用
                                                <code style="background: #fff; padding: 2px 6px; border-radius: 2px">[*]</code> 匹配数组中的所有元素，如：<code
                                                    style="background: #fff; padding: 2px 6px; border-radius: 2px"
                                                    >users[*].email</code
                                                >
                                            </p>
                                            <p style="margin: 0; padding-left: 12px; color: #909399; font-size: 11px">
                                                示例：<code style="background: #fff; padding: 2px 6px; border-radius: 2px">company.employees[*].personalInfo.phone</code>
                                                会匹配数组中所有员工的手机号
                                            </p>
                                        </div>

                                        <div style="margin-bottom: 0">
                                            <p style="margin: 0 0 6px 0; font-weight: 600; color: #409eff">4. 或运算符（|）</p>
                                            <p style="margin: 0 0 4px 0; padding-left: 12px">
                                                • 使用
                                                <code style="background: #fff; padding: 2px 6px; border-radius: 2px">|</code>
                                                连接多个路径，多个路径的结果去重后取并集
                                            </p>
                                            <p style="margin: 0; padding-left: 12px; color: #909399; font-size: 11px">
                                                示例：<code style="background: #fff; padding: 2px 6px; border-radius: 2px">name | settings[*].name</code> 匹配根层级的
                                                <code style="background: #fff; padding: 2px 6px; border-radius: 2px">name</code> 和数组中的所有
                                                <code style="background: #fff; padding: 2px 6px; border-radius: 2px">name</code>
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </el-collapse-transition>
                        </div>
                    </template>
                </el-alert>

                <!-- 脱敏规则配置 -->
                <div class="masking-rules-section">
                    <div class="section-header">
                        <span class="section-title">脱敏规则</span>
                        <div class="header-actions">
                            <el-button
                                type="success"
                                size="small"
                                @click="saveCurrentRule"
                                :disabled="!canSaveNewRule"
                                :title="savedRulesList.length >= 5 && !canSaveNewRule ? '脱敏规则数量已达上限（5条），无法保存新规则。请先删除旧规则后再保存。' : ''"
                            >
                                <el-icon style="margin-right: 3px"><DocumentAdd /></el-icon>保存规则
                            </el-button>
                            <el-button type="info" size="small" @click="openLoadRuleDialog" :disabled="savedRulesList.length === 0">
                                <el-icon style="margin-right: 3px"><FolderOpened /></el-icon>加载规则
                            </el-button>
                            <el-button type="danger" size="small" @click="openDeleteRuleDialog" :disabled="savedRulesList.length === 0">
                                <el-icon style="margin-right: 3px"><Delete /></el-icon>删除规则
                            </el-button>
                        </div>
                    </div>

                    <div class="rules-list">
                        <div class="rule-item">
                            <div class="rule-header">
                                <div class="rule-name-input-wrapper">
                                    <label class="rule-name-label" for="rule-name">规则名称：</label>
                                    <el-input
                                        id="rule-name"
                                        v-model="currentRule.name"
                                        placeholder="例如：手机号脱敏（保存时必填）"
                                        clearable
                                        maxlength="30"
                                        show-word-limit
                                        style="flex: 1"
                                    />
                                </div>
                            </div>

                            <div class="rule-content">
                                <!-- 优先级提示 -->
                                <div class="priority-hint">
                                    <el-alert type="info" :closable="false" show-icon>
                                        <template #title>
                                            <span style="font-size: 12px">优先级说明：从上到下执行，下面的优先级更高（如果多个字段路径都匹配，将应用最后一个匹配的配置）</span>
                                        </template>
                                    </el-alert>
                                </div>

                                <!-- 字段路径配置列表（最多5个） -->
                                <div class="field-paths-list">
                                    <div v-for="(fieldPathConfig, pathIndex) in currentRule.fieldPaths" :key="pathIndex" class="field-path-item">
                                        <div class="field-path-header">
                                            <span class="field-path-label">字段路径 {{ pathIndex + 1 }}：</span>
                                            <div class="field-path-header-right">
                                                <span class="field-path-priority">优先级：{{ currentRule.fieldPaths.length - pathIndex }}</span>
                                                <el-button
                                                    v-if="currentRule.fieldPaths.length > 1"
                                                    type="danger"
                                                    size="small"
                                                    text
                                                    class="field-path-delete-btn"
                                                    @click="removeFieldPath(pathIndex)"
                                                >
                                                    <el-icon><Delete /></el-icon>
                                                    删除
                                                </el-button>
                                            </div>
                                        </div>

                                        <!-- 字段路径输入（带智能提示） -->
                                        <div class="rule-field">
                                            <el-autocomplete
                                                ref="fieldPathAutocompleteRef"
                                                v-model="fieldPathConfig.fieldPath"
                                                :fetch-suggestions="queryFieldPaths"
                                                :placeholder="`例如: password, *.password, user.email, users[*].phone`"
                                                clearable
                                                maxlength="300"
                                                show-word-limit
                                                :trigger-on-focus="true"
                                                :debounce="100"
                                                popper-class="field-path-autocomplete"
                                                @select="item => handleFieldPathSelect(item, pathIndex)"
                                                @input="value => handleFieldPathInput(String(value), pathIndex)"
                                                @keyup.enter="(event: KeyboardEvent) => handleFieldPathEnter(event, pathIndex)"
                                            >
                                                <template #default="{ item }">
                                                    <div class="autocomplete-item">
                                                        <span class="path-text">{{ item.value }}</span>
                                                        <span v-if="item.type" class="path-type">{{ getTypeLabel(item.type) }}</span>
                                                    </div>
                                                </template>
                                            </el-autocomplete>
                                        </div>

                                        <!-- 脱敏策略 -->
                                        <div class="rule-field">
                                            <!-- 当策略为 fixed 时，策略和固定值并排显示 -->
                                            <div v-if="fieldPathConfig.strategy === 'fixed'" class="strategy-row">
                                                <div class="strategy-item">
                                                    <label class="field-label" :for="'strategy-' + pathIndex">脱敏策略：</label>
                                                    <el-select
                                                        :id="'strategy-' + pathIndex"
                                                        v-model="fieldPathConfig.strategy"
                                                        style="width: 100%"
                                                        @change="handleStrategyChange(fieldPathConfig, pathIndex)"
                                                    >
                                                        <el-option label="完全隐藏（删除字段）" value="remove" />
                                                        <el-option label="替换为 null" value="null" />
                                                        <el-option label="替换为固定值" value="fixed" />
                                                        <el-option label="部分显示（保留前后几位）" value="partial" />
                                                    </el-select>
                                                </div>
                                                <div class="strategy-item">
                                                    <label class="field-label" :for="'fixed-value-' + pathIndex">固定值：</label>
                                                    <el-input
                                                        :id="'fixed-value-' + pathIndex"
                                                        v-model="fieldPathConfig.fixedValue"
                                                        placeholder="例如: ***, <MASKED>"
                                                        clearable
                                                        maxlength="10"
                                                        show-word-limit
                                                    />
                                                </div>
                                            </div>

                                            <!-- 当策略为 partial 时，策略单独一行，参数配置在下一行 -->
                                            <template v-else-if="fieldPathConfig.strategy === 'partial'">
                                                <div class="strategy-single">
                                                    <label class="field-label" :for="'strategy-single-' + pathIndex">脱敏策略：</label>
                                                    <el-select
                                                        :id="'strategy-single-' + pathIndex"
                                                        v-model="fieldPathConfig.strategy"
                                                        style="width: 100%"
                                                        @change="handleStrategyChange(fieldPathConfig, pathIndex)"
                                                    >
                                                        <el-option label="完全隐藏（删除字段）" value="remove" />
                                                        <el-option label="替换为 null" value="null" />
                                                        <el-option label="替换为固定值" value="fixed" />
                                                        <el-option label="部分显示（保留前后几位）" value="partial" />
                                                    </el-select>
                                                </div>
                                                <div class="partial-config">
                                                    <div class="partial-item">
                                                        <label class="field-label" :for="'prefix-length-' + pathIndex">保留前几位：</label>
                                                        <el-input-number
                                                            :id="'prefix-length-' + pathIndex"
                                                            v-model="fieldPathConfig.prefixLength"
                                                            :min="0"
                                                            :max="10"
                                                            :precision="0"
                                                            style="width: 100%"
                                                        />
                                                    </div>
                                                    <div class="partial-item">
                                                        <label class="field-label" :for="'suffix-length-' + pathIndex">保留后几位：</label>
                                                        <el-input-number
                                                            :id="'suffix-length-' + pathIndex"
                                                            v-model="fieldPathConfig.suffixLength"
                                                            :min="0"
                                                            :max="10"
                                                            :precision="0"
                                                            style="width: 100%"
                                                        />
                                                    </div>
                                                    <div class="partial-item">
                                                        <label class="field-label" :for="'mask-char-' + pathIndex">掩码字符：</label>
                                                        <el-input
                                                            :id="'mask-char-' + pathIndex"
                                                            v-model="fieldPathConfig.maskChar"
                                                            placeholder="例如: *"
                                                            maxlength="1"
                                                            style="width: 100%"
                                                        />
                                                    </div>
                                                </div>
                                            </template>

                                            <!-- 其他策略（remove、null）时，只显示策略选择框 -->
                                            <div v-else class="strategy-single">
                                                <label class="field-label" :for="'strategy-else-' + pathIndex">脱敏策略：</label>
                                                <el-select
                                                    :id="'strategy-else-' + pathIndex"
                                                    v-model="fieldPathConfig.strategy"
                                                    style="width: 100%"
                                                    @change="handleStrategyChange(fieldPathConfig, pathIndex)"
                                                >
                                                    <el-option label="完全隐藏（删除字段）" value="remove" />
                                                    <el-option label="替换为 null" value="null" />
                                                    <el-option label="替换为固定值" value="fixed" />
                                                    <el-option label="部分显示（保留前后几位）" value="partial" />
                                                </el-select>
                                            </div>
                                        </div>

                                        <!-- 分隔线（不是最后一个时显示） -->
                                        <div v-if="pathIndex < currentRule.fieldPaths.length - 1" class="field-path-divider"></div>
                                    </div>
                                </div>

                                <!-- 添加字段路径按钮和错误提示 -->
                                <div v-if="currentRule.fieldPaths.length < 5" class="add-field-path-action">
                                    <el-button type="primary" size="small" text :disabled="!canAddFieldPath" @click="addFieldPath">
                                        <el-icon><Plus /></el-icon>
                                        添加字段路径（{{ currentRule.fieldPaths.length }}/5）
                                    </el-button>
                                    <div v-if="getAddFieldPathError" class="add-field-path-error">
                                        {{ getAddFieldPathError }}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <template #footer>
                <div class="dialog-footer">
                    <el-button @click="handleDialogClose">取消</el-button>
                    <el-button type="primary" @click="confirmApply" :loading="applying">
                        {{ applying ? '应用中...' : '应用' }}
                    </el-button>
                </div>
            </template>
        </el-dialog>

        <!-- 加载规则对话框 -->
        <el-dialog v-model="loadRuleDialogVisible" title="选择要加载的规则" width="600px" :close-on-click-modal="false" :align-center="false" top="20vh">
            <div class="select-rule-dialog">
                <div v-if="savedRulesList.length === 0" class="empty-saved-rules">
                    <el-empty description="暂无已保存的规则" :image-size="80" />
                </div>
                <div v-else class="saved-rules-list">
                    <div v-for="(savedRule, index) in savedRulesList" :key="index" class="saved-rule-item" @click="loadRule(index)">
                        <div class="saved-rule-info">
                            <div class="saved-rule-name">{{ savedRule.name }}</div>
                            <div class="saved-rule-meta">保存时间：{{ savedRule.saveTime }}</div>
                            <div class="saved-rule-meta">字段路径：{{ savedRule.fieldPaths?.map((fp, idx) => `${idx + 1}. ${fp.fieldPath || '(空)'}`).join('; ') || '(无)' }}</div>
                        </div>
                        <el-icon class="select-icon"><ArrowRight /></el-icon>
                    </div>
                </div>
            </div>
            <template #footer>
                <div class="dialog-footer">
                    <el-button @click="loadRuleDialogVisible = false">取消</el-button>
                </div>
            </template>
        </el-dialog>

        <!-- 删除规则对话框 -->
        <el-dialog
            v-model="deleteRuleDialogVisible"
            title="选择要删除的规则"
            width="600px"
            :close-on-click-modal="false"
            :align-center="false"
            top="20vh"
            @close="handleDeleteRuleDialogClose"
        >
            <div class="select-rule-dialog">
                <div v-if="savedRulesList.length === 0" class="empty-saved-rules">
                    <el-empty description="暂无已保存的规则" :image-size="80" />
                </div>
                <div v-else class="saved-rules-list">
                    <div v-for="(savedRule, index) in savedRulesList" :key="index" class="saved-rule-item-wrapper">
                        <div class="saved-rule-item">
                            <div class="saved-rule-info">
                                <div class="saved-rule-name">{{ savedRule.name }}</div>
                                <div class="saved-rule-meta">保存时间：{{ savedRule.saveTime }}</div>
                                <div class="saved-rule-meta">
                                    字段路径：{{ savedRule.fieldPaths?.map((fp, idx) => `${idx + 1}. ${fp.fieldPath || '(空)'}`).join('; ') || '(无)' }}
                                </div>
                            </div>
                            <el-button size="small" type="danger" @click="confirmDelete(index)" :disabled="confirmingDeleteIndex === index"> 删除 </el-button>
                        </div>
                        <!-- 内联确认删除提示 -->
                        <div v-if="confirmingDeleteIndex === index" class="delete-confirm">
                            <div class="delete-confirm-content">
                                <el-icon class="delete-warning-icon"><Warning /></el-icon>
                                <span class="delete-confirm-text">确定要删除规则 "{{ savedRule.name }}" 吗？</span>
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
                    <el-button @click="deleteRuleDialogVisible = false">取消</el-button>
                </div>
            </template>
        </el-dialog>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { showMessageSuccess as showSuccess, showMessageError as showError, showMessageWarning as showWarning } from '~/utils/api';
import { Plus, Delete, DocumentAdd, FolderOpened, ArrowRight, Warning } from '@element-plus/icons-vue';

// Props
interface Props {
    modelValue: boolean;
    jsonData: string;
}

const props = defineProps<Props>();

// Emits
const emit = defineEmits<{
    'update:modelValue': [value: boolean];
    apply: [maskedJson: string];
}>();

// 对话框显示状态
const dialogVisible = computed({
    get: () => props.modelValue,
    set: value => emit('update:modelValue', value),
});

// 字段路径配置类型
interface FieldPathConfig {
    fieldPath: string;
    strategy: 'remove' | 'null' | 'partial' | 'fixed';
    prefixLength?: number;
    suffixLength?: number;
    maskChar?: string;
    fixedValue?: string;
}

// 脱敏规则类型
interface MaskingRule {
    name: string; // 规则名称
    fieldPaths: FieldPathConfig[]; // 字段路径配置数组（最多5个）
    isSaved?: boolean; // 标记是否已保存
}

// 当前脱敏规则（只有一个）
const currentRule = ref<MaskingRule>({
    name: '',
    fieldPaths: [
        {
            fieldPath: '',
            strategy: 'fixed',
            fixedValue: '***',
        },
    ],
    isSaved: false,
});

// 处理状态
const applying = ref(false);

// 字段路径自动完成组件的引用
const fieldPathAutocompleteRef = ref<any>(null);

// 路径帮助说明展开/收起状态
const showPathHelp = ref(false);

// 切换路径帮助说明显示状态
const togglePathHelp = () => {
    showPathHelp.value = !showPathHelp.value;
};

// 已保存的规则类型（单个规则，包含保存时间）
interface SavedRule extends MaskingRule {
    saveTime: string;
}

// 已保存的规则列表（单个规则列表）
const savedRulesList = ref<SavedRule[]>([]);

// 加载规则对话框显示状态
const loadRuleDialogVisible = ref(false);

// 删除规则对话框显示状态
const deleteRuleDialogVisible = ref(false);

// 正在确认删除的规则索引
const confirmingDeleteIndex = ref<number | null>(null);

// 计算是否有未保存的规则
const hasUnsavedRule = computed(() => {
    // 检查当前规则是否未保存，且至少有一个有效的字段路径
    return !currentRule.value.isSaved && currentRule.value.fieldPaths.some(fieldPath => fieldPath.fieldPath.trim());
});

// 计算是否可以保存新规则（检查规则数量上限）
const canSaveNewRule = computed(() => {
    if (!hasUnsavedRule.value) {
        return false;
    }

    // 检查是否有未保存的规则在已保存列表中已存在（可以覆盖）
    const hasExistingRule = currentRule.value.name && savedRulesList.value.some(savedRule => savedRule.name === currentRule.value.name);

    // 如果已有5条规则，且没有可覆盖的规则，则不能保存新规则
    if (savedRulesList.value.length >= 5 && !hasExistingRule) {
        return false;
    }

    return true;
});

// localStorage 键名
const STORAGE_KEY = 'json-tool-masking-rules';

// 从 localStorage 加载已保存的规则列表
const loadSavedRulesList = () => {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            const parsed = JSON.parse(stored);

            // 数据迁移：兼容旧格式
            if (Array.isArray(parsed) && parsed.length > 0) {
                // 检查是否是旧的规则集格式（包含 rules 数组）
                if (parsed[0] && typeof parsed[0] === 'object' && 'rules' in parsed[0]) {
                    // 旧格式：规则集数组，需要展开为单个规则
                    const migratedRules: SavedRule[] = [];
                    parsed.forEach((ruleSet: any) => {
                        if (ruleSet.rules && Array.isArray(ruleSet.rules)) {
                            ruleSet.rules.forEach((rule: any) => {
                                // 迁移旧格式：将单个 fieldPath 转换为 fieldPaths 数组
                                const migratedRule: any = {
                                    ...rule,
                                    saveTime: ruleSet.saveTime || new Date().toISOString(),
                                };
                                if (rule.fieldPath && !rule.fieldPaths) {
                                    migratedRule.fieldPaths = [
                                        {
                                            fieldPath: rule.fieldPath,
                                            strategy: rule.strategy || 'fixed',
                                            prefixLength: rule.prefixLength,
                                            suffixLength: rule.suffixLength,
                                            maskChar: rule.maskChar,
                                            fixedValue: rule.fixedValue,
                                        },
                                    ];
                                    delete migratedRule.fieldPath;
                                }
                                migratedRules.push(migratedRule);
                            });
                        }
                    });
                    savedRulesList.value = migratedRules;
                    // 保存迁移后的数据
                    saveRulesListToStorage();
                } else {
                    // 新格式：单个规则数组，但可能还是旧格式（有 fieldPath 没有 fieldPaths）
                    const migratedRules: SavedRule[] = parsed.map((rule: any) => {
                        if (rule.fieldPath && !rule.fieldPaths) {
                            // 迁移旧格式：将单个 fieldPath 转换为 fieldPaths 数组
                            return {
                                ...rule,
                                fieldPaths: [
                                    {
                                        fieldPath: rule.fieldPath,
                                        strategy: rule.strategy || 'fixed',
                                        prefixLength: rule.prefixLength,
                                        suffixLength: rule.suffixLength,
                                        maskChar: rule.maskChar,
                                        fixedValue: rule.fixedValue,
                                    },
                                ],
                            };
                        }
                        return rule;
                    });
                    // 限制规则数量不超过5个（保留最新的5个）
                    savedRulesList.value = migratedRules.slice(-5);
                    // 如果有迁移，保存迁移后的数据
                    if (parsed.some((rule: any) => rule.fieldPath && !rule.fieldPaths)) {
                        saveRulesListToStorage();
                    }
                }
            } else {
                savedRulesList.value = [];
            }
        } else {
            savedRulesList.value = [];
        }
    } catch (error) {
        savedRulesList.value = [];
    }
};

// 保存规则列表到 localStorage
const saveRulesListToStorage = () => {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(savedRulesList.value));
    } catch (error) {
        showMessageError('保存规则列表失败');
    }
};

// 组件挂载时加载已保存的规则
onMounted(() => {
    loadSavedRulesList();
});

// 验证规则的有效性
const validateRule = (rule: MaskingRule): { valid: boolean; error?: string } => {
    // 验证规则名称
    if (!rule.name || !rule.name.trim()) {
        return { valid: false, error: '规则名称不能为空' };
    }
    if (rule.name.length > 30) {
        return { valid: false, error: '规则名称不能超过30个字符' };
    }

    // 验证字段路径
    if (!rule.fieldPaths || rule.fieldPaths.length === 0) {
        return { valid: false, error: '至少需要配置一个字段路径' };
    }

    // 检查每个字段路径
    for (let i = 0; i < rule.fieldPaths.length; i++) {
        const fieldPathConfig = rule.fieldPaths[i];

        // 验证字段路径不能为空
        if (!fieldPathConfig.fieldPath || !fieldPathConfig.fieldPath.trim()) {
            return { valid: false, error: `字段路径 ${i + 1} 不能为空` };
        }

        // 验证字段路径长度
        if (fieldPathConfig.fieldPath.length > 300) {
            return { valid: false, error: `字段路径 ${i + 1} 不能超过300个字符` };
        }

        // 验证字段路径格式（检查无效格式，如 .[数字]）
        // 检测数组索引前有点号的无效格式，如 .[0] 或 .[123]
        if (/\.\[\d+\]/.test(fieldPathConfig.fieldPath)) {
            return { valid: false, error: `字段路径 ${i + 1} 格式无效：数组索引前不能有点号` };
        }

        // 根据策略验证相应参数
        if (fieldPathConfig.strategy === 'fixed') {
            // 固定值策略：验证固定值
            if (fieldPathConfig.fixedValue !== undefined && fieldPathConfig.fixedValue !== null) {
                if (fieldPathConfig.fixedValue.length > 10) {
                    return { valid: false, error: `字段路径 ${i + 1} 的固定值不能超过10个字符` };
                }
            }
        } else if (fieldPathConfig.strategy === 'partial') {
            // 部分显示策略：验证前后范围
            if (fieldPathConfig.prefixLength !== undefined && fieldPathConfig.prefixLength !== null) {
                if (fieldPathConfig.prefixLength < 0 || fieldPathConfig.prefixLength > 10) {
                    return { valid: false, error: `字段路径 ${i + 1} 的保留前几位必须在0-10之间` };
                }
            }
            if (fieldPathConfig.suffixLength !== undefined && fieldPathConfig.suffixLength !== null) {
                if (fieldPathConfig.suffixLength < 0 || fieldPathConfig.suffixLength > 10) {
                    return { valid: false, error: `字段路径 ${i + 1} 的保留后几位必须在0-10之间` };
                }
            }
        }
    }

    return { valid: true };
};

// 初始化空白规则
const initBlankRule = () => {
    currentRule.value = {
        name: '',
        fieldPaths: [
            {
                fieldPath: '',
                strategy: 'fixed',
                fixedValue: '***',
            },
        ],
        isSaved: false,
    };
    // 清空字段路径选择前的值缓存
    fieldPathBeforeSelect.value.clear();
    // 清空正在处理选择事件的标志
    isHandlingSelect.value.clear();
};

// 比较两个字段路径配置是否相同
const compareFieldPathConfig = (config1: FieldPathConfig, config2: FieldPathConfig): boolean => {
    // 比较字段路径（去除首尾空格）
    if (config1.fieldPath.trim() !== config2.fieldPath.trim()) {
        return false;
    }

    // 比较脱敏策略
    if (config1.strategy !== config2.strategy) {
        return false;
    }

    // 根据策略类型比较相关参数
    if (config1.strategy === 'partial') {
        // partial 策略需要比较 prefixLength, suffixLength, maskChar
        if (config1.prefixLength !== config2.prefixLength || config1.suffixLength !== config2.suffixLength || (config1.maskChar || '*') !== (config2.maskChar || '*')) {
            return false;
        }
    } else if (config1.strategy === 'fixed') {
        // fixed 策略需要比较 fixedValue
        if ((config1.fixedValue || '***') !== (config2.fixedValue || '***')) {
            return false;
        }
    }
    // remove 和 null 策略不需要比较额外参数

    return true;
};

// 比较两个规则的内容是否相同（忽略名称和保存时间）
const compareRuleContent = (rule1: MaskingRule, rule2: MaskingRule): boolean => {
    // 比较字段路径数组的长度
    const paths1 = rule1.fieldPaths.filter(fp => fp.fieldPath.trim());
    const paths2 = rule2.fieldPaths.filter(fp => fp.fieldPath.trim());

    if (paths1.length !== paths2.length) {
        return false;
    }

    // 按顺序比较每个字段路径配置（顺序不同视为不同规则）
    for (let i = 0; i < paths1.length; i++) {
        if (!compareFieldPathConfig(paths1[i], paths2[i])) {
            return false;
        }
    }

    return true;
};

// 保存当前规则
const saveCurrentRule = async () => {
    // 检查是否有有效的字段路径
    if (!currentRule.value.fieldPaths.some(fieldPath => fieldPath.fieldPath.trim())) {
        showMessageWarning('请至少配置一个有效的字段路径');
        return;
    }

    // 如果规则名称为空，提示用户输入
    let ruleName = currentRule.value.name?.trim() || '';
    if (!ruleName) {
        try {
            const { value: inputName } = await ElMessageBox.prompt('请输入规则名称', '保存规则', {
                confirmButtonText: '确定',
                cancelButtonText: '取消',
                inputPlaceholder: '例如：手机号脱敏',
                inputValidator: value => {
                    if (!value || !value.trim()) {
                        return '规则名称不能为空';
                    }
                    if (value.length > 30) {
                        return '规则名称不能超过30个字符';
                    }
                    return true;
                },
            });
            if (inputName && inputName.trim()) {
                ruleName = inputName.trim();
                currentRule.value.name = ruleName;
            } else {
                return;
            }
        } catch {
            // 用户取消
            return;
        }
    }

    // 验证规则的有效性
    const validation = validateRule(currentRule.value);
    if (!validation.valid) {
        showMessageError(validation.error || '规则验证失败');
        return;
    }

    // 准备新规则对象（用于比较）
    const newRuleContent: MaskingRule = {
        ...JSON.parse(JSON.stringify(currentRule.value)), // 深拷贝
        name: ruleName,
    };

    // 检查是否已存在同名规则
    const existingSameNameIndex = savedRulesList.value.findIndex(r => r.name === ruleName);

    // 检查是否已存在相同内容的规则（忽略名称）
    const existingSameContentIndex = savedRulesList.value.findIndex(r => compareRuleContent(r, newRuleContent));
    const existingSameContentRule = existingSameContentIndex !== -1 ? savedRulesList.value[existingSameContentIndex] : null;

    // 情况1：存在同名规则
    if (existingSameNameIndex !== -1) {
        const existingRule = savedRulesList.value[existingSameNameIndex];

        // 情况1.1：同名且内容相同，直接提示保存成功
        if (compareRuleContent(existingRule, newRuleContent)) {
            showMessageSuccess(`规则"${ruleName}"已保存（与现有规则完全相同）`);
            // 标记规则为已保存
            currentRule.value.isSaved = true;
            currentRule.value.name = ruleName;
            return;
        }

        // 情况1.2：同名但内容不同，提示规则覆盖
        try {
            await ElMessageBox.confirm(`规则"${ruleName}"已存在，但内容不同。是否覆盖现有规则？`, '确认覆盖', {
                confirmButtonText: '覆盖',
                cancelButtonText: '取消',
                type: 'warning',
            });

            const now = new Date();
            const saveTime = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(
                2,
                '0'
            )}:${String(now.getMinutes()).padStart(2, '0')}`;

            const newRule: SavedRule = {
                ...newRuleContent,
                saveTime,
            };

            savedRulesList.value[existingSameNameIndex] = newRule;
            saveRulesListToStorage();
            showMessageSuccess(`规则"${ruleName}"已覆盖保存`);

            // 标记规则为已保存
            currentRule.value.isSaved = true;
            currentRule.value.name = ruleName;
        } catch {
            // 用户取消
            return;
        }
        return;
    }

    // 情况2：不存在同名规则，但存在相同内容的规则
    if (existingSameContentIndex !== -1 && existingSameContentRule) {
        // 询问用户是否要删除旧规则，因为两个内容完全相同的规则没有意义
        try {
            await ElMessageBox.confirm(
                `已存在相同内容的规则"${existingSameContentRule.name}"。\n\n保存当前规则后，旧规则将被删除。\n\n是否继续保存并删除旧规则？`,
                '检测到重复规则',
                {
                    confirmButtonText: '保存并删除旧规则',
                    cancelButtonText: '取消',
                    type: 'warning',
                }
            );

            // 用户确认：删除旧规则，保存新规则
            const now = new Date();
            const saveTime = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(
                2,
                '0'
            )}:${String(now.getMinutes()).padStart(2, '0')}`;

            const newRule: SavedRule = {
                ...newRuleContent,
                saveTime,
            };

            // 删除旧规则
            savedRulesList.value.splice(existingSameContentIndex, 1);
            // 保存新规则
            savedRulesList.value.push(newRule);
            saveRulesListToStorage();
            showMessageSuccess(`规则"${ruleName}"已保存，旧规则"${existingSameContentRule.name}"已删除`);

            // 标记规则为已保存
            currentRule.value.isSaved = true;
            currentRule.value.name = ruleName;
        } catch {
            // 用户取消
            return;
        }
        return;
    }

    // 情况3：不存在同名规则，也不存在相同内容的规则，检查规则数量上限
    if (savedRulesList.value.length >= 5) {
        showMessageWarning('脱敏规则数量已达上限（5条），无法保存新规则。请先删除旧规则后再保存。');
        return;
    }

    // 正常保存新规则
    const now = new Date();
    const saveTime = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(
        2,
        '0'
    )}:${String(now.getMinutes()).padStart(2, '0')}`;

    const newRule: SavedRule = {
        ...newRuleContent,
        saveTime,
    };

    savedRulesList.value.push(newRule);
    saveRulesListToStorage();
    showMessageSuccess(`规则"${ruleName}"已保存`);

    // 标记规则为已保存
    currentRule.value.isSaved = true;
    currentRule.value.name = ruleName;
};

// 打开加载规则对话框
const openLoadRuleDialog = () => {
    loadSavedRulesList(); // 重新加载，确保数据最新
    loadRuleDialogVisible.value = true;
};

// 加载规则（替换当前规则）
const loadRule = (index: number) => {
    if (index < 0 || index >= savedRulesList.value.length) {
        showMessageError('规则索引无效');
        return;
    }

    const savedRule = savedRulesList.value[index];

    // 深拷贝规则，并标记为未保存
    const loadedRule: MaskingRule = {
        ...JSON.parse(JSON.stringify(savedRule)),
        isSaved: false, // 加载的规则标记为未保存
    };

    // 确保 fieldPaths 存在（兼容旧数据）
    if (!loadedRule.fieldPaths || !Array.isArray(loadedRule.fieldPaths)) {
        loadedRule.fieldPaths = [
            {
                fieldPath: (savedRule as any).fieldPath || '',
                strategy: (savedRule as any).strategy || 'fixed',
                prefixLength: (savedRule as any).prefixLength,
                suffixLength: (savedRule as any).suffixLength,
                maskChar: (savedRule as any).maskChar,
                fixedValue: (savedRule as any).fixedValue,
            },
        ];
    }

    // 替换当前规则
    currentRule.value = loadedRule;

    loadRuleDialogVisible.value = false;
};

// 打开删除规则对话框
const openDeleteRuleDialog = () => {
    loadSavedRulesList(); // 重新加载，确保数据最新
    deleteRuleDialogVisible.value = true;
};

// 处理删除规则对话框关闭
const handleDeleteRuleDialogClose = () => {
    confirmingDeleteIndex.value = null; // 关闭对话框时清除删除确认状态
};

// 确认删除（显示内联确认提示框）
const confirmDelete = (index: number) => {
    confirmingDeleteIndex.value = index;
};

// 取消删除
const cancelDelete = () => {
    confirmingDeleteIndex.value = null;
};

// 执行删除
const executeDelete = (index: number) => {
    if (index < 0 || index >= savedRulesList.value.length) {
        showMessageError('规则索引无效');
        return;
    }

    savedRulesList.value.splice(index, 1);
    saveRulesListToStorage();
    confirmingDeleteIndex.value = null;

    // 如果删除后列表为空，关闭对话框
    if (savedRulesList.value.length === 0) {
        deleteRuleDialogVisible.value = false;
    }
};

// 检查是否可以添加字段路径
const canAddFieldPath = computed(() => {
    if (currentRule.value.fieldPaths.length >= 5) {
        return false;
    }
    // 检查前面的字段路径是否都填写了
    return currentRule.value.fieldPaths.every(fieldPathConfig => fieldPathConfig.fieldPath.trim() !== '');
});

// 获取添加字段路径的错误提示
const getAddFieldPathError = computed(() => {
    if (currentRule.value.fieldPaths.length >= 5) {
        return '';
    }
    // 检查是否有未填写的字段路径
    const emptyIndex = currentRule.value.fieldPaths.findIndex(fieldPathConfig => fieldPathConfig.fieldPath.trim() === '');
    if (emptyIndex !== -1) {
        return `请先填写字段路径 ${emptyIndex + 1}，才能添加新的字段路径`;
    }
    return '';
});

// 添加字段路径
const addFieldPath = () => {
    if (currentRule.value.fieldPaths.length < 5) {
        // 检查前面的字段路径是否都填写了
        if (!canAddFieldPath.value) {
            return; // 如果前面的字段路径未填写，不允许添加
        }
        currentRule.value.fieldPaths.push({
            fieldPath: '',
            strategy: 'fixed',
            fixedValue: '***',
        });
    }
};

// 删除字段路径
const removeFieldPath = (pathIndex: number) => {
    if (currentRule.value.fieldPaths.length > 1) {
        currentRule.value.fieldPaths.splice(pathIndex, 1);
    }
};

// 处理策略变化
const handleStrategyChange = (fieldPathConfig: FieldPathConfig, pathIndex: number) => {
    // 根据策略设置默认值
    if (fieldPathConfig.strategy === 'partial') {
        if (fieldPathConfig.prefixLength === undefined) fieldPathConfig.prefixLength = 3;
        if (fieldPathConfig.suffixLength === undefined) fieldPathConfig.suffixLength = 4;
        if (!fieldPathConfig.maskChar) fieldPathConfig.maskChar = '*';
    } else if (fieldPathConfig.strategy === 'fixed' && !fieldPathConfig.fixedValue) {
        fieldPathConfig.fixedValue = '[已脱敏]';
    }
};

// 从JSON对象中提取所有字段路径（已废弃，改用上下文感知提示）
interface PathSuggestion {
    value: string;
    type?: string; // 'exact' | 'wildcard' | 'array-wildcard'
}

// 解析路径字符串，支持数组语法（如 settings[*] 或 settings[0]）
const parsePathToParts = (path: string): Array<{ key: string; isArray?: boolean; arrayIndex?: number | string }> => {
    const parts: Array<{ key: string; isArray?: boolean; arrayIndex?: number | string }> = [];
    let current = '';
    let inBrackets = false;
    let bracketContent = '';

    for (let i = 0; i < path.length; i++) {
        const char = path[i];

        if (char === '[') {
            if (current) {
                parts.push({ key: current });
                current = '';
            }
            inBrackets = true;
            bracketContent = '';
        } else if (char === ']') {
            if (inBrackets) {
                if (bracketContent === '*' || /^\d+$/.test(bracketContent)) {
                    // 数组通配符或索引
                    if (parts.length > 0) {
                        parts[parts.length - 1].isArray = true;
                        parts[parts.length - 1].arrayIndex = bracketContent === '*' ? '*' : parseInt(bracketContent, 10);
                    } else if (current) {
                        // 如果还没有添加到parts，先添加key，然后标记为数组
                        parts.push({ key: current, isArray: true, arrayIndex: bracketContent === '*' ? '*' : parseInt(bracketContent, 10) });
                        current = '';
                    } else {
                        // 根级别的数组访问，如 [1] 或 [*]
                        parts.push({ key: '', isArray: true, arrayIndex: bracketContent === '*' ? '*' : parseInt(bracketContent, 10) });
                    }
                }
                inBrackets = false;
                bracketContent = '';
            }
        } else if (inBrackets) {
            bracketContent += char;
        } else if (char === '.') {
            if (current) {
                parts.push({ key: current });
                current = '';
            }
        } else {
            current += char;
        }
    }

    if (current) {
        parts.push({ key: current });
    }

    return parts;
};

// 根据路径获取JSON对象中的值
const getValueByPathParts = (obj: any, parts: Array<{ key: string; isArray?: boolean; arrayIndex?: number | string }>): any => {
    let current = obj;

    for (const part of parts) {
        if (current === null || current === undefined) {
            return null;
        }

        // 处理根级别的数组访问（key为空，isArray为true）
        if (part.isArray && !part.key && Array.isArray(current)) {
            if (part.arrayIndex === '*') {
                // 通配符，返回第一个元素用于获取下一级key
                current = current.length > 0 ? current[0] : null;
            } else if (typeof part.arrayIndex === 'number') {
                // 具体索引
                current = current[part.arrayIndex] || null;
            } else {
                // 默认返回第一个元素
                current = current.length > 0 ? current[0] : null;
            }
            continue;
        }

        if (part.key) {
            if (typeof current === 'object' && part.key in current) {
                current = current[part.key];
            } else {
                return null;
            }
        }

        if (part.isArray && Array.isArray(current)) {
            // 如果是数组，根据arrayIndex返回对应元素
            if (part.arrayIndex === '*') {
                // 通配符，返回第一个元素用于获取下一级key
                current = current.length > 0 ? current[0] : null;
            } else if (typeof part.arrayIndex === 'number') {
                // 具体索引
                current = current[part.arrayIndex] || null;
            } else {
                // 默认返回第一个元素
                current = current.length > 0 ? current[0] : null;
            }
        }
    }

    return current;
};

// 获取下一级的key建议（基于当前输入内容）
const getNextLevelKeys = (jsonObj: any, currentPath: string): PathSuggestion[] => {
    const suggestions: PathSuggestion[] = [];

    // 如果输入为空，返回一级key
    if (!currentPath || !currentPath.trim()) {
        // 如果数据本身是数组，直接提示 [*]
        if (Array.isArray(jsonObj)) {
            suggestions.push({ value: '[*]', type: 'array-wildcard' });
            return suggestions;
        }

        if (jsonObj && typeof jsonObj === 'object' && !Array.isArray(jsonObj)) {
            for (const [key, value] of Object.entries(jsonObj)) {
                // 如果值是数组，添加两个建议：带[*]和不带[*]的
                if (Array.isArray(value)) {
                    suggestions.push({ value: key, type: 'exact' });
                    suggestions.push({ value: `${key}[*]`, type: 'array-wildcard' });
                } else {
                    suggestions.push({ value: key, type: 'exact' });
                }
            }
        }
        return suggestions.sort((a, b) => a.value.localeCompare(b.value));
    }

    // 解析当前路径
    const trimmedPath = currentPath.trim();

    // 检查是否以点结尾，如果是，去掉点
    const pathToParse = trimmedPath.endsWith('.') ? trimmedPath.slice(0, -1) : trimmedPath;

    // 如果路径为空（去掉点后），返回一级key
    if (!pathToParse) {
        return getNextLevelKeys(jsonObj, '');
    }

    // 解析路径
    const parts = parsePathToParts(pathToParse);
    const targetValue = getValueByPathParts(jsonObj, parts);

    if (targetValue === null || targetValue === undefined) {
        return [];
    }

    // 检查路径是否以数组访问结尾（如 [1] 或 [*]）
    const endsWithArrayAccess = /\[(\*|\d+)\]$/.test(pathToParse);

    // 如果目标是数组，且路径以 "." 结尾
    if (Array.isArray(targetValue)) {
        // 如果路径以 "." 结尾，且前面不是数组访问（如 "数组名."），这是无效的语法
        // 不应该提示数组元素的key，应该返回空数组
        if (trimmedPath.endsWith('.') && !endsWithArrayAccess) {
            return [];
        }

        // 如果路径以数组访问结尾（如 "数组名[*]" 或 "[*]"），或者路径以 "." 结尾且前面是数组访问（如 "[*]." 或 "[1]."）
        // 这种情况下，应该返回数组元素的key
        if (targetValue.length > 0) {
            const firstElement = targetValue[0];
            if (firstElement && typeof firstElement === 'object' && !Array.isArray(firstElement)) {
                for (const [key, value] of Object.entries(firstElement)) {
                    if (Array.isArray(value)) {
                        suggestions.push({ value: key, type: 'exact' });
                        suggestions.push({ value: `${key}[*]`, type: 'array-wildcard' });
                    } else {
                        suggestions.push({ value: key, type: 'exact' });
                    }
                }
            }
        }
    }
    // 如果目标是对象，返回对象的key
    else if (typeof targetValue === 'object') {
        for (const [key, value] of Object.entries(targetValue)) {
            if (Array.isArray(value)) {
                suggestions.push({ value: key, type: 'exact' });
                suggestions.push({ value: `${key}[*]`, type: 'array-wildcard' });
            } else {
                suggestions.push({ value: key, type: 'exact' });
            }
        }
    }

    return suggestions.sort((a, b) => a.value.localeCompare(b.value));
};

// 获取类型标签的中文显示
const getTypeLabel = (type: string): string => {
    const typeMap: Record<string, string> = {
        exact: '精确匹配',
        'array-wildcard': '数组通配符',
        wildcard: '通配符',
        or: '或运算符',
    };
    return typeMap[type] || type;
};

// 查询字段路径建议（基于上下文）
const queryFieldPaths = (queryString: string, cb: (suggestions: PathSuggestion[]) => void) => {
    if (!props.jsonData || !props.jsonData.trim()) {
        cb([]);
        return;
    }

    try {
        const jsonObj = JSON.parse(props.jsonData);

        // 获取当前路径
        let currentPath = queryString || '';

        // 如果输入为空，返回一级key（如果数组，提示两个：带[*]和不带[*]的）
        if (!currentPath.trim()) {
            const suggestions = getNextLevelKeys(jsonObj, '');
            cb(suggestions);
            return;
        }

        // 检查是否包含 | 运算符（或运算符）
        if (currentPath.includes('|')) {
            // 找到最后一个 | 运算符的位置（考虑前后可能有空格）
            // 使用正则表达式匹配最后一个 | 运算符（包括前后空格）
            const orOperatorMatch = currentPath.match(/(.+?)(\s*\|\s*)$/);

            if (orOperatorMatch) {
                // 如果以 | 结尾（可能前后有空格），说明用户刚输入了 |，应该显示根key提示
                const suggestions = getNextLevelKeys(jsonObj, '');
                cb(suggestions);
                return;
            } else {
                // 查找最后一个 | 运算符（不在末尾）
                const orOperatorRegex = /(\s*\|\s*)/g;
                let lastOrIndex = -1;
                let lastOrMatchResult: RegExpMatchArray | null = null;
                let match: RegExpMatchArray | null;

                // 找到所有 | 运算符的位置
                while ((match = orOperatorRegex.exec(currentPath)) !== null) {
                    if (match.index !== undefined) {
                        lastOrIndex = match.index;
                        lastOrMatchResult = match;
                    }
                }

                if (lastOrIndex !== -1 && lastOrMatchResult) {
                    // 找到最后一个 | 运算符，提取 | 后的路径部分
                    const pathAfterOr = currentPath.substring(lastOrIndex + lastOrMatchResult[1].length);
                    // 使用 | 后的路径部分进行自动补全
                    currentPath = pathAfterOr;
                }
            }
        }

        // 如果输入以点结尾，说明用户输入了"."，应该解析当前路径并提示下一级key
        if (currentPath.endsWith('.')) {
            const suggestions = getNextLevelKeys(jsonObj, currentPath);
            cb(suggestions);
            return;
        }

        // 解析当前输入，找到最后一个点或数组括号的位置
        let lastDotIndex = currentPath.lastIndexOf('.');
        let lastBracketIndex = currentPath.lastIndexOf(']');

        // 确定当前路径的结束位置（取较大的索引）
        let pathEndIndex = Math.max(lastDotIndex, lastBracketIndex);

        if (pathEndIndex === -1) {
            // 没有点或括号，说明是第一个key，过滤一级key
            // 如果数组，提示两个：带[*]和不带[*]的
            const allFirstLevelKeys = getNextLevelKeys(jsonObj, '');
            const currentInput = currentPath.toLowerCase();

            // 检查当前输入是否完全匹配某个一级key（不区分大小写）
            // 如果完全匹配，说明用户已经输入了完整的字段名，不应该显示提示
            const exactMatch = allFirstLevelKeys.some(item => item.value.toLowerCase() === currentInput);

            if (exactMatch) {
                // 完全匹配，不显示提示
                cb([]);
                return;
            }

            // 不完全匹配，返回过滤后的建议（用于部分输入时的过滤）
            const filtered = allFirstLevelKeys.filter(item => item.value.toLowerCase().startsWith(currentInput));
            cb(filtered);
            return;
        }

        // 提取已完成的路径部分和当前输入的key部分
        const completedPath = currentPath.substring(0, pathEndIndex + 1);
        const currentKeyInput = currentPath.substring(pathEndIndex + 1);

        // 如果 currentKeyInput 为空，说明输入以 . 或 ] 结尾
        // 只有以 . 结尾时才应该获取下一级key（因为用户输入了"."）
        // 如果以 ] 结尾（比如 settings[*]），不应该提示下一级key，应该提示当前路径本身
        if (!currentKeyInput.trim()) {
            if (currentPath.endsWith('.')) {
                // 输入以 . 结尾，获取下一级key
                const suggestions = getNextLevelKeys(jsonObj, completedPath);
                cb(suggestions);
            } else if (currentPath.endsWith(']')) {
                // 输入以 ] 结尾（比如 settings[*]），不提示下一级key
                // 只提示当前路径本身（如果匹配的话）
                const pathWithoutBracket = currentPath.slice(0, -1); // 去掉 ]
                const bracketStart = pathWithoutBracket.lastIndexOf('[');
                if (bracketStart !== -1) {
                    const keyBeforeBracket = pathWithoutBracket.substring(0, bracketStart);
                    const allKeys = getNextLevelKeys(jsonObj, keyBeforeBracket ? keyBeforeBracket + '.' : '');
                    const filtered = allKeys.filter(item => item.value === currentPath);
                    cb(filtered.length > 0 ? filtered : []);
                } else {
                    cb([]);
                }
            } else {
                cb([]);
            }
            return;
        }

        // 有当前输入的key部分，需要根据已完成的路径获取下一级key并过滤
        // 但是只有 completedPath 以 . 结尾时，才应该获取下一级key（因为用户输入了"."）
        if (completedPath.endsWith('.')) {
            // 获取下一级的所有key
            const nextLevelKeys = getNextLevelKeys(jsonObj, completedPath);

            // 根据当前输入的key部分进行过滤（不区分大小写）
            const currentInputLower = currentKeyInput.toLowerCase();
            const filtered = nextLevelKeys.filter(item => item.value.toLowerCase().startsWith(currentInputLower));

            cb(filtered);
        } else {
            // completedPath 以 ] 结尾，说明用户正在输入类似 settings[*]name 的内容
            // 这种情况下，应该提示 settings[*] 本身（如果匹配）
            const pathWithoutBracket = completedPath.slice(0, -1); // 去掉 ]
            const bracketStart = pathWithoutBracket.lastIndexOf('[');
            if (bracketStart !== -1) {
                const keyBeforeBracket = pathWithoutBracket.substring(0, bracketStart);
                const allKeys = getNextLevelKeys(jsonObj, keyBeforeBracket ? keyBeforeBracket + '.' : '');
                const fullPath = completedPath + currentKeyInput;
                const filtered = allKeys.filter(item => {
                    const itemLower = item.value.toLowerCase();
                    const fullPathLower = fullPath.toLowerCase();
                    return itemLower.startsWith(fullPathLower);
                });
                cb(filtered);
            } else {
                cb([]);
            }
        }
    } catch (error) {
        cb([]);
    }
};

// 处理字段路径输入变化
const handleFieldPathInput = (value: string, pathIndex?: number) => {
    // 如果正在处理选择事件，忽略这次 input 事件（这是 el-autocomplete 的自动更新）
    if (pathIndex !== undefined && isHandlingSelect.value.get(pathIndex)) {
        return;
    }

    // 保存当前值，用于选择时拼接路径
    if (pathIndex !== undefined) {
        // 如果用户清空了输入框，清除保存的值
        if (!value || !value.trim()) {
            fieldPathBeforeSelect.value.delete(pathIndex);
            return;
        }

        // 检查 | 运算符的数量，最多支持4个（即5个路径）
        // 如果输入值不包含 | 运算符，且与之前保存的值不匹配
        // 说明用户开始输入新的路径，应该清除旧值
        const previousValue = fieldPathBeforeSelect.value.get(pathIndex);
        if (!value.includes('|')) {
            // 如果之前保存的值包含 | 运算符，说明是多个路径的组合，不应该清除
            const prevHasOr = previousValue && previousValue.includes('|');

            if (!prevHasOr) {
                // 如果之前保存的值以 "."、"]" 或 "|" 结尾，说明用户已经输入了路径前缀
                // 这可能是 autocomplete 在选择时自动更新的值，不应该删除
                // 例如：用户输入 users[*] 后选择 email，autocomplete 会将值更新为 email
                // 但 users[*] 是路径前缀，应该保留
                const prevEndsWithPathSeparator = previousValue && (previousValue.endsWith('.') || previousValue.endsWith(']') || /\|\s*$/.test(previousValue));

                // 如果当前值不以之前保存的值开头，说明用户开始输入新的路径，清除旧值
                // 但是，如果之前的值以路径分隔符结尾，说明这是路径前缀，不应该删除
                if (previousValue && !value.startsWith(previousValue) && !prevEndsWithPathSeparator) {
                    fieldPathBeforeSelect.value.delete(pathIndex);
                }
            }
        }

        if (value.includes('|')) {
            // 检查 | 运算符的数量，最多支持4个（即5个路径）
            // 如果以 | 结尾，说明最后一个路径还在输入中，不算作完整的路径
            const orMatches = value.match(/\s*\|\s*/g) || [];
            const orCount = orMatches.length;
            const endsWithOr = /\s*\|\s*$/.test(value);

            // 如果 | 运算符数量 >= 4，且不是以 | 结尾（说明已经有5个完整路径），则不允许
            // 或者如果 | 运算符数量 > 4（说明已经有超过5个路径），则不允许
            if (orCount >= 4 && !endsWithOr) {
                // 已经达到最大限制（5个路径），不允许再添加
                // 恢复到之前的值
                const previousValue = fieldPathBeforeSelect.value.get(pathIndex);
                if (previousValue) {
                    // 通过更新输入框的值来阻止超过限制的输入
                    nextTick(() => {
                        const fieldPathConfig = currentRule.value.fieldPaths[pathIndex];
                        if (fieldPathConfig && fieldPathConfig.fieldPath !== previousValue) {
                            fieldPathConfig.fieldPath = previousValue;
                        }
                    });
                }
                return;
            }

            // 如果 | 运算符数量 > 4，绝对不允许
            if (orCount > 4) {
                // 恢复到之前的值
                const previousValue = fieldPathBeforeSelect.value.get(pathIndex);
                if (previousValue) {
                    nextTick(() => {
                        const fieldPathConfig = currentRule.value.fieldPaths[pathIndex];
                        if (fieldPathConfig && fieldPathConfig.fieldPath !== previousValue) {
                            fieldPathConfig.fieldPath = previousValue;
                        }
                    });
                }
                return;
            }
        }

        // 如果之前保存的值以 "."、"]" 或 "|" 结尾，说明用户已经输入了路径前缀
        // 如果当前输入值不等于之前保存的值，且当前值不以之前保存的值开头
        // 说明这可能是 el-autocomplete 在选择提示项时自动更新的值，不应该覆盖保存的值
        // 但是，如果当前值以 | 结尾，说明用户正在输入新的路径，应该允许更新
        if (previousValue && (previousValue.endsWith('.') || previousValue.endsWith(']') || /\|\s*$/.test(previousValue))) {
            // 检查是否是用户手动删除末尾字符的情况
            // 例如：users. -> users（删除了 .），users[*] -> users[（删除了 *]）
            let isManualDeletion = false;
            if (previousValue.endsWith('.')) {
                // 如果当前值等于之前保存的值去掉末尾的 .，说明用户手动删除了 .
                isManualDeletion = value === previousValue.slice(0, -1);
            } else if (previousValue.endsWith(']')) {
                // 如果当前值等于之前保存的值去掉末尾的 ]，说明用户手动删除了 ]
                // 或者当前值等于之前保存的值去掉末尾的 *]，说明用户手动删除了 *]
                isManualDeletion = value === previousValue.slice(0, -1) || value === previousValue.replace(/\*?\]$/, '');
            } else if (/\|\s*$/.test(previousValue)) {
                // 如果当前值等于之前保存的值去掉末尾的 | 及其前后空格，说明用户手动删除了 |
                const trimmedPrevious = previousValue.replace(/\s*\|\s*$/, '');
                isManualDeletion = value === trimmedPrevious;
            }

            // 如果是手动删除，应该更新 fieldPathBeforeSelect
            if (isManualDeletion) {
                fieldPathBeforeSelect.value.set(pathIndex, value);
                return;
            }

            // 如果当前值不等于之前保存的值，且当前值不以之前保存的值开头
            // 说明这是从下拉选项中选择的值（如 employees 或 employees[*]），不应该覆盖保存的前缀值
            // 但是如果当前值以 | 结尾，说明用户正在输入新的路径，应该允许更新
            if (value !== previousValue && !value.startsWith(previousValue) && !/\|\s*$/.test(value)) {
                // 不更新 fieldPathBeforeSelect，保持之前保存的值
                return;
            }
        }

        // 额外检查：如果之前保存的值包含 | 运算符（但不以 | 结尾，比如 name|na）
        // 且当前值不包含 | 运算符，且当前值不以之前保存的值开头
        // 说明这是 autocomplete 在选择时自动更新的值，不应该覆盖保存的值
        if (previousValue && previousValue.includes('|')) {
            // 如果当前值不包含 | 运算符，且当前值不等于之前保存的值，且当前值不以之前保存的值开头
            // 说明这是 autocomplete 在选择时自动更新的值（比如从 name|na 变成 name），不应该覆盖
            if (!value.includes('|') && value !== previousValue && !value.startsWith(previousValue)) {
                // 不更新 fieldPathBeforeSelect，保持之前保存的值
                return;
            }
        }

        fieldPathBeforeSelect.value.set(pathIndex, value);
    }

    // 当输入以 "." 结尾时，手动触发查询以确保提示显示
    // 这样可以确保每次输入 "." 时都能显示提示，即使之前已经输入过
    if (value && value.endsWith('.')) {
        nextTick(() => {
            // 直接调用 queryFieldPaths 来获取建议
            queryFieldPaths(value, (suggestions: PathSuggestion[]) => {
                // 找到对应的 autocomplete 组件并更新建议列表
                if (fieldPathAutocompleteRef.value) {
                    const refs = Array.isArray(fieldPathAutocompleteRef.value) ? fieldPathAutocompleteRef.value : [fieldPathAutocompleteRef.value];

                    refs.forEach((autocompleteInstance: any) => {
                        if (autocompleteInstance) {
                            // 安全地访问输入元素：检查 $el 是否是 DOM 元素
                            let inputEl: HTMLInputElement | null = null;
                            if (autocompleteInstance.$el) {
                                // 如果 $el 是 DOM 元素，直接使用 querySelector
                                if (autocompleteInstance.$el instanceof HTMLElement && autocompleteInstance.$el.querySelector) {
                                    inputEl = autocompleteInstance.$el.querySelector('input');
                                } else if (autocompleteInstance.$el.querySelector) {
                                    // 某些情况下 $el 可能是其他类型的元素
                                    inputEl = autocompleteInstance.$el.querySelector('input');
                                }
                            }

                            if (inputEl && inputEl.value === value) {
                                // 更新建议列表并显示
                                if (autocompleteInstance.suggestions !== undefined) {
                                    autocompleteInstance.suggestions = suggestions;
                                    autocompleteInstance.activated = true;
                                    autocompleteInstance.loading = false;
                                }
                                // 确保输入框获得焦点
                                inputEl.focus();
                            }
                        }
                    });
                }
            });
        });
    }

    // 当输入包含 | 运算符时（可能前后有空格），手动触发查询以确保提示显示
    // 这样可以确保每次输入 | 后都能显示提示，就像输入第一个路径时那样
    if (value && /\s*\|\s*$/.test(value)) {
        nextTick(() => {
            // 直接调用 queryFieldPaths 来获取建议
            queryFieldPaths(value, (suggestions: PathSuggestion[]) => {
                // 找到对应的 autocomplete 组件并更新建议列表
                if (fieldPathAutocompleteRef.value && pathIndex !== undefined) {
                    const refs = Array.isArray(fieldPathAutocompleteRef.value) ? fieldPathAutocompleteRef.value : [fieldPathAutocompleteRef.value];

                    const targetInstance = refs[pathIndex];
                    if (targetInstance) {
                        // 安全地访问输入元素：检查 $el 是否是 DOM 元素
                        let inputEl: HTMLInputElement | null = null;
                        if (targetInstance.$el) {
                            // 如果 $el 是 DOM 元素，直接使用 querySelector
                            if (targetInstance.$el instanceof HTMLElement && targetInstance.$el.querySelector) {
                                inputEl = targetInstance.$el.querySelector('input');
                            } else if (targetInstance.$el.querySelector) {
                                // 某些情况下 $el 可能是其他类型的元素
                                inputEl = targetInstance.$el.querySelector('input');
                            }
                        }

                        if (inputEl && inputEl.value === value) {
                            // 更新建议列表并显示
                            if (targetInstance.suggestions !== undefined) {
                                targetInstance.suggestions = suggestions;
                                targetInstance.activated = true;
                                targetInstance.loading = false;
                            }
                            // 确保输入框获得焦点
                            inputEl.focus();
                        }
                    }
                }
            });
        });
    }
};

// 保存每个字段路径输入框选择前的值，用于拼接路径
const fieldPathBeforeSelect = ref<Map<number, string>>(new Map());
// 标志：正在处理选择事件，忽略后续的 input 事件
const isHandlingSelect = ref<Map<number, boolean>>(new Map());

// 处理字段路径选择
const handleFieldPathSelect = (item: Record<string, any>, pathIndex?: number) => {
    if (!item || !item.value) {
        return;
    }

    if (pathIndex === undefined || pathIndex < 0 || pathIndex >= currentRule.value.fieldPaths.length) {
        return;
    }

    // 设置标志，表示正在处理选择
    isHandlingSelect.value.set(pathIndex, true);

    const fieldPathConfig = currentRule.value.fieldPaths[pathIndex];
    const savedValue = fieldPathBeforeSelect.value.get(pathIndex);
    const currentValue = fieldPathConfig.fieldPath || '';

    // 获取选择前的值
    // 优先使用保存的值（如果存在），因为保存的值包含了用户输入时的完整路径（包括 | 前的部分）
    // 如果保存的值包含 | 运算符，说明用户已经输入了 | 前的路径，必须使用保存的值
    // 如果当前输入框的值是空的，使用空字符串（说明用户清空了输入框，应该从头开始）
    // 如果保存的值不存在，使用当前值
    const beforeSelectValue = savedValue ? savedValue : !currentValue || !currentValue.trim() ? '' : currentValue;

    // 检查是否包含 | 运算符，支持多个 | 运算符
    // 找到最后一个 | 运算符的位置（考虑前后可能有空格）
    let pathBeforeOr = '';
    let pathAfterOr = '';
    let orOperator = '';

    if (beforeSelectValue.includes('|')) {
        // 使用正则表达式找到最后一个 | 运算符（包括前后空格）
        const lastOrMatch = beforeSelectValue.match(/(.+?)(\s*\|\s*)$/);

        if (lastOrMatch) {
            // 如果以 | 结尾，说明用户正在输入新的路径
            pathBeforeOr = lastOrMatch[1];
            orOperator = lastOrMatch[2]; // 保存原始的 | 格式（包括前后空格）
            pathAfterOr = '';
        } else {
            // 查找最后一个 | 运算符（不在末尾）
            const orOperatorRegex = /(\s*\|\s*)/g;
            let lastOrIndex = -1;
            let lastOrMatchResult: RegExpMatchArray | null = null;
            let match: RegExpMatchArray | null;

            // 找到所有 | 运算符的位置
            while ((match = orOperatorRegex.exec(beforeSelectValue)) !== null) {
                if (match.index !== undefined) {
                    lastOrIndex = match.index;
                    lastOrMatchResult = match;
                }
            }

            if (lastOrIndex !== -1 && lastOrMatchResult) {
                // 找到最后一个 | 运算符，分离前后两部分
                pathBeforeOr = beforeSelectValue.substring(0, lastOrIndex);
                orOperator = lastOrMatchResult[1]; // 保存原始的 | 格式（包括前后空格）
                pathAfterOr = beforeSelectValue.substring(lastOrIndex + lastOrMatchResult[1].length);
            } else {
                // 不包含 | 运算符，使用原来的逻辑
                pathAfterOr = beforeSelectValue;
            }
        }
    } else {
        // 不包含 | 运算符，使用原来的逻辑
        pathAfterOr = beforeSelectValue;
    }

    // 检查 | 运算符的数量，最多支持4个（即5个路径）
    if (pathBeforeOr) {
        const orCount = (pathBeforeOr.match(/\s*\|\s*/g) || []).length;
        if (orCount >= 4) {
            // 已经达到最大限制，不允许再添加
            isHandlingSelect.value.delete(pathIndex);
            return;
        }
    }

    // 计算拼接后的路径（只处理 | 后的部分）
    let newPathAfterOr: string;

    if (pathAfterOr === item.value) {
        newPathAfterOr = item.value;
    }
    // 如果 | 后的值以 "." 结尾，说明需要拼接下一级，直接拼接
    else if (pathAfterOr.endsWith('.')) {
        newPathAfterOr = pathAfterOr + item.value;
    }
    // 如果 | 后的值以 "]" 结尾，需要判断拼接的内容类型
    else if (pathAfterOr.endsWith(']')) {
        // 如果选中的值以 "[" 开头（如 "[*]" 或 "[0]"），说明是数组索引，直接拼接
        if (item.value.startsWith('[')) {
            newPathAfterOr = pathAfterOr + item.value;
        } else {
            // 如果选中的值是 key（如 "email"），需要在 "]" 和 key 之间添加 "."
            newPathAfterOr = pathAfterOr + '.' + item.value;
        }
    }
    // 如果 | 后的值以选中的值开头，说明用户已经输入了完整路径，直接使用 | 后的值
    else if (pathAfterOr.startsWith(item.value)) {
        newPathAfterOr = pathAfterOr;
    }
    // 如果选中的值以 | 后的值开头，说明 | 后的值是选中值的前缀，直接使用选中的值
    else if (item.value.startsWith(pathAfterOr)) {
        newPathAfterOr = item.value;
    }
    // 否则，按照原来的逻辑拼接
    else {
        // 解析路径，找到最后一个 "." 或 "]" 的位置
        let lastDotIndex = pathAfterOr.lastIndexOf('.');
        let lastBracketIndex = pathAfterOr.lastIndexOf(']');
        let pathEndIndex = Math.max(lastDotIndex, lastBracketIndex);

        if (pathEndIndex !== -1) {
            // 提取已完成的路径部分（包含 "." 或 "]"）
            const completedPath = pathAfterOr.substring(0, pathEndIndex + 1);

            // 如果路径以 "]" 结尾，且选中的值不是数组索引，需要添加 "."
            if (pathAfterOr[pathEndIndex] === ']' && !item.value.startsWith('[')) {
                newPathAfterOr = completedPath + '.' + item.value;
            } else {
                // 其他情况直接拼接
                newPathAfterOr = completedPath + item.value;
            }
        } else {
            // 没有 "." 或 "]"，说明是第一个 key，直接使用选中的值
            newPathAfterOr = item.value;
        }
    }

    // 组合最终路径，保持用户原有的 | 格式（包括前后空格）
    const newPath = pathBeforeOr ? `${pathBeforeOr}${orOperator}${newPathAfterOr}` : newPathAfterOr;

    // 立即设置正确的值，这样会覆盖 el-autocomplete 的自动更新
    // el-autocomplete 的 select 事件在值更新之前触发，所以我们可以立即设置
    fieldPathConfig.fieldPath = newPath;

    // 使用 nextTick 确保值被正确设置（防止 el-autocomplete 的后续更新覆盖我们的值）
    nextTick(() => {
        // 再次检查并设置值，确保我们的值不会被 el-autocomplete 的自动更新覆盖
        if (fieldPathConfig.fieldPath !== newPath) {
            fieldPathConfig.fieldPath = newPath;
        }
        // 清除标志
        isHandlingSelect.value.delete(pathIndex);
    });

    // 清除保存的值
    fieldPathBeforeSelect.value.delete(pathIndex);
};

// 处理字段路径输入框的回车键事件
const handleFieldPathEnter = (event: KeyboardEvent, pathIndex?: number) => {
    if (pathIndex === undefined || pathIndex < 0 || pathIndex >= currentRule.value.fieldPaths.length) {
        return;
    }

    // 获取对应的 autocomplete 组件实例
    if (!fieldPathAutocompleteRef.value) {
        return;
    }

    const refs = Array.isArray(fieldPathAutocompleteRef.value) ? fieldPathAutocompleteRef.value : [fieldPathAutocompleteRef.value];

    const autocompleteInstance = refs[pathIndex];
    if (!autocompleteInstance) {
        return;
    }

    // 获取当前的建议列表和高亮索引
    // Element Plus autocomplete 组件内部使用 highlightedIndex 来跟踪当前高亮的选项
    const suggestions = autocompleteInstance.suggestions || [];
    const highlightedIndex = autocompleteInstance.highlightedIndex !== undefined ? autocompleteInstance.highlightedIndex : -1;

    // 如果有建议项且下拉框是打开的
    if (suggestions.length > 0 && autocompleteInstance.activated) {
        let selectedItem: Record<string, any> | null = null;

        // 如果有高亮的选项，使用高亮的选项
        if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
            selectedItem = suggestions[highlightedIndex];
        }
        // 如果没有高亮的选项，使用第一个选项（默认行为）
        else if (suggestions.length > 0) {
            selectedItem = suggestions[0];
        }

        // 如果找到了选项，调用 handleFieldPathSelect 处理（和鼠标点击一样）
        if (selectedItem) {
            // 阻止默认行为（防止 autocomplete 的默认回车处理）
            event.preventDefault();
            event.stopPropagation();

            // 重要：在调用 handleFieldPathSelect 之前，确保 fieldPathBeforeSelect 有正确的值
            // 优先使用已经保存的 fieldPathBeforeSelect，因为它保存了用户输入时的完整路径
            // 如果 fieldPathBeforeSelect 不存在，才从输入框获取值
            // 这是因为 autocomplete 可能会在回车时先触发 input 事件，将值更新为选中的项（如 email），
            // 这会覆盖之前保存的完整路径（如 users[*]）
            const savedValue = fieldPathBeforeSelect.value.get(pathIndex);
            if (!savedValue) {
                // 如果 fieldPathBeforeSelect 不存在，才从输入框获取值
                let inputEl: HTMLInputElement | null = null;
                if (autocompleteInstance.$el) {
                    // 安全地访问输入元素：检查 $el 是否是 DOM 元素
                    if (autocompleteInstance.$el instanceof HTMLElement && autocompleteInstance.$el.querySelector) {
                        inputEl = autocompleteInstance.$el.querySelector('input');
                    } else if (autocompleteInstance.$el.querySelector) {
                        // 某些情况下 $el 可能是其他类型的元素
                        inputEl = autocompleteInstance.$el.querySelector('input');
                    }
                }

                let currentInputValue = '';
                if (inputEl) {
                    currentInputValue = inputEl.value || '';
                } else {
                    // 如果无法从输入元素获取，则从配置对象获取
                    const fieldPathConfig = currentRule.value.fieldPaths[pathIndex];
                    currentInputValue = fieldPathConfig?.fieldPath || '';
                }

                // 保存当前输入值，确保 handleFieldPathSelect 能正确拼接路径
                // 这对于所有情况都很重要，不仅仅是包含 | 运算符的情况
                // 例如：用户输入 users[*] 后选择 email，需要保存 users[*] 才能正确拼接为 users[*].email
                if (currentInputValue) {
                    // 保存当前值，确保 handleFieldPathSelect 能获取到正确的路径前缀
                    fieldPathBeforeSelect.value.set(pathIndex, currentInputValue);
                }
            }

            // 在调用 handleFieldPathSelect 之前，先设置 isHandlingSelect 标志
            // 这样可以防止 handleFieldPathInput 在处理选择时覆盖 fieldPathBeforeSelect
            isHandlingSelect.value.set(pathIndex, true);

            // 调用相同的选择处理函数，确保行为一致
            handleFieldPathSelect(selectedItem, pathIndex);
        }
    }
};

// 解析字段路径
// 验证路径格式，检测无效格式（如 .[数字]）
const isValidFieldPath = (path: string): boolean => {
    // 检测数组索引前有点号的无效格式，如 .[0] 或 .[123]
    // 但允许 [0] 或 [*] 这种正确格式
    if (/\.\[\d+\]/.test(path)) {
        return false; // 无效：数组索引前有点号
    }
    return true;
};

const parseFieldPath = (
    path: string
): {
    type: 'exact' | 'wildcard' | 'array-wildcard' | 'or' | 'invalid';
    pattern: string | string[];
    parts: string[];
} => {
    const trimmed = path.trim();

    // 检查是否包含 | 运算符（或运算符）
    if (trimmed.includes('|')) {
        const paths = trimmed
            .split('|')
            .map(p => p.trim())
            .filter(p => p);
        // 验证每个路径
        for (const p of paths) {
            if (!isValidFieldPath(p)) {
                return { type: 'invalid', pattern: trimmed, parts: [] };
            }
        }
        return {
            type: 'or',
            pattern: paths,
            parts: [],
        };
    }

    // 验证路径格式
    if (!isValidFieldPath(trimmed)) {
        return { type: 'invalid', pattern: trimmed, parts: [] };
    }

    // 检查是否包含数组通配符
    if (trimmed.includes('[*]')) {
        return {
            type: 'array-wildcard',
            pattern: trimmed,
            parts: trimmed.split(/\[.*?\]/).filter(p => p),
        };
    }

    // 检查是否包含通配符
    if (trimmed.includes('*')) {
        return {
            type: 'wildcard',
            pattern: trimmed,
            parts: trimmed.split('.').filter(p => p),
        };
    }

    // 精确路径
    // 如果是不包含点的单个字段名，默认只匹配根层级
    return {
        type: 'exact',
        pattern: trimmed,
        parts: trimmed.split('.').filter(p => p),
    };
};

// 正确连接字段路径，处理数组索引
const joinFieldPath = (fieldPath: string[]): string => {
    if (fieldPath.length === 0) return '';
    if (fieldPath.length === 1) return fieldPath[0];

    let result = fieldPath[0];
    for (let i = 1; i < fieldPath.length; i++) {
        const current = fieldPath[i];
        // 如果当前元素以 [ 开头（数组索引），直接附加，不加点号
        if (current.startsWith('[')) {
            result += current;
        } else {
            // 否则用点号连接
            result += '.' + current;
        }
    }
    return result;
};

// 检查字段是否匹配字段路径配置
const isFieldMatched = (fieldPath: string[], fieldName: string, fieldPathConfig: FieldPathConfig): boolean => {
    const parsed = parseFieldPath(fieldPathConfig.fieldPath);

    // 如果路径无效，直接返回 false
    if (parsed.type === 'invalid') {
        return false;
    }

    // 处理或运算符（|）
    if (parsed.type === 'or' && Array.isArray(parsed.pattern)) {
        return parsed.pattern.some(path => {
            const subConfig = { ...fieldPathConfig, fieldPath: path };
            return isFieldMatched(fieldPath, fieldName, subConfig);
        });
    }

    switch (parsed.type) {
        case 'exact':
            // 精确匹配：检查完整路径
            if (typeof parsed.pattern === 'string') {
                const fullPath = joinFieldPath(fieldPath);
                const patternParts = parsed.pattern.split('.').filter(p => p);

                // 检查是否包含数组索引（如 name[0]）
                const hasArrayIndex = /\[\d+\]/.test(parsed.pattern);

                if (hasArrayIndex) {
                    // 如果模式包含数组索引，直接比较完整路径
                    return fullPath === parsed.pattern;
                }

                // 默认行为：单个字段名只匹配根层级
                if (patternParts.length === 1 && !parsed.pattern.includes('.')) {
                    // 单个字段名，只匹配根层级（fieldPath.length === 1）
                    return fieldPath.length === 1 && fieldName === parsed.pattern;
                }

                // 完整路径，精确匹配（不再标准化，无效路径已被拒绝）
                return fullPath === parsed.pattern;
            }
            return false;

        case 'wildcard':
            // 通配符匹配：检查字段名是否匹配模式
            if (typeof parsed.pattern === 'string') {
                const fullPath = joinFieldPath(fieldPath);
                const wildcardPattern = parsed.pattern.replace(/\*/g, '.*');
                const regex = new RegExp(`^${wildcardPattern}$`);

                // 检查字段名和完整路径
                return regex.test(fieldName) || regex.test(fullPath);
            }
            return false;

        case 'array-wildcard':
            // 数组通配符：匹配数组中的字段
            // 例如: users[*].email 应该匹配 users[0].email, users[1].email 等
            // 例如: name[*] 应该匹配 name 字段（当值是数组时）
            if (typeof parsed.pattern === 'string') {
                // 使用正确的路径连接方式（数组索引前不加点号）
                const pathStr = joinFieldPath(fieldPath);

                // 将模式转换为正则表达式
                // helpers[*].name -> helpers\[\d+\]\.name
                const normalizedPattern = parsed.pattern
                    .replace(/\[\*\]/g, '\\[\\d+\\]') // [*] -> \[\d+\]
                    .replace(/\*/g, '.*'); // * -> .*
                const regex = new RegExp(`^${normalizedPattern}$`);

                // 检查完整路径是否匹配
                if (regex.test(pathStr)) {
                    return true;
                }

                // 特殊处理：如果模式是 name[*] 这样的形式（以 [*] 结尾，没有后续路径）
                // 应该能够匹配到 name 字段本身（当值是数组时）
                if (parsed.pattern.endsWith('[*]')) {
                    const patternWithoutBrackets = parsed.pattern.replace(/\[\*\]$/, '');
                    // 检查是否是直接匹配字段名（例如：name[*] 匹配 name）
                    if (patternWithoutBrackets === fieldName && fieldPath.length === 1) {
                        return true;
                    }
                    // 检查是否是匹配完整路径（例如：users.name[*] 匹配 users.name）
                    const patternPath = patternWithoutBrackets.split('.').filter(p => p);
                    if (patternPath.length === fieldPath.length && patternPath.every((part, idx) => part === fieldPath[idx])) {
                        return true;
                    }
                }

                // 检查字段名是否匹配模式中的最后一部分
                // 例如: helpers[*].name 应该匹配 name 字段（在 helpers[0] 等路径下）
                const patternParts = parsed.pattern.split(/\[.*?\]|\./).filter(p => p);
                if (patternParts.length > 0) {
                    const lastPart = patternParts[patternParts.length - 1];
                    if (lastPart.includes('*')) {
                        const lastPattern = lastPart.replace(/\*/g, '.*');
                        const lastRegex = new RegExp(`^${lastPattern}$`);
                        if (lastRegex.test(fieldName)) {
                            // 检查当前路径是否在数组元素中
                            const pathStrForCheck = joinFieldPath(fieldPath.slice(0, -1));
                            const arrayPattern = parsed.pattern.replace(/\[\*\]/g, '\\[\\d+\\]');
                            const beforeLastPart = arrayPattern.substring(0, arrayPattern.lastIndexOf('.'));
                            if (beforeLastPart) {
                                const beforeRegex = new RegExp(`^${beforeLastPart.replace(/\*/g, '.*')}$`);
                                if (beforeRegex.test(pathStrForCheck)) {
                                    return true;
                                }
                            }
                        }
                    } else if (lastPart === fieldName) {
                        // 精确匹配最后一部分
                        const pathStrForCheck = joinFieldPath(fieldPath.slice(0, -1));
                        const arrayPattern = parsed.pattern.replace(/\[\*\]/g, '\\[\\d+\\]');
                        const beforeLastPart = arrayPattern.substring(0, arrayPattern.lastIndexOf('.'));
                        if (beforeLastPart) {
                            const beforeRegex = new RegExp(`^${beforeLastPart.replace(/\*/g, '.*')}$`);
                            if (beforeRegex.test(pathStrForCheck)) {
                                return true;
                            }
                        }
                    }
                }
            }
            return false;

        default:
            return false;
    }
};

// 应用脱敏策略（根据数据类型智能处理）
const applyMaskingStrategy = (value: any, fieldPathConfig: FieldPathConfig): any => {
    if (value === null || value === undefined) {
        return value;
    }

    // 根据数据类型采用不同的脱敏策略
    const valueType = typeof value;
    const isArray = Array.isArray(value);
    const isObject = valueType === 'object' && !isArray && value !== null;

    switch (fieldPathConfig.strategy) {
        case 'remove':
            return undefined; // 返回 undefined 表示删除字段

        case 'null':
            return null;

        case 'partial':
            // 部分显示策略：根据数据类型处理
            const prefixLen = fieldPathConfig.prefixLength || 0;
            const suffixLen = fieldPathConfig.suffixLength || 0;
            const maskChar = fieldPathConfig.maskChar || '*';

            if (valueType === 'string') {
                // 字符串类型：保持原有逻辑
                const strValue = value;
                if (strValue.length <= prefixLen + suffixLen) {
                    // 如果长度不足以部分显示，全部用掩码字符替换
                    return maskChar.repeat(strValue.length);
                }
                const prefix = strValue.substring(0, prefixLen);
                const suffix = strValue.substring(strValue.length - suffixLen);
                const mask = maskChar.repeat(Math.max(0, strValue.length - prefixLen - suffixLen));
                return prefix + mask + suffix;
            } else if (valueType === 'number') {
                // 数字类型：支持部分显示数字
                const numStr = String(Math.abs(value)); // 转为字符串，去掉负号
                const isNegative = value < 0;
                const sign = isNegative ? '-' : '';

                if (numStr.length <= prefixLen + suffixLen) {
                    // 如果长度不足以部分显示，全部用掩码字符替换
                    return sign + maskChar.repeat(numStr.length);
                }

                const prefix = numStr.substring(0, prefixLen);
                const suffix = numStr.substring(numStr.length - suffixLen);
                const mask = maskChar.repeat(Math.max(0, numStr.length - prefixLen - suffixLen));
                const maskedNumStr = sign + prefix + mask + suffix;

                // 尝试转换为数字，如果失败则返回字符串（例如包含小数点的情况）
                const maskedNum = Number(maskedNumStr);
                return isNaN(maskedNum) ? maskedNumStr : maskedNum;
            } else if (valueType === 'boolean') {
                // 布尔类型：partial 策略对布尔值没有意义，使用 fixed 策略
                return fieldPathConfig.fixedValue || '[已脱敏]';
            } else if (isArray || isObject) {
                // 对象/数组类型：partial 策略对对象/数组没有意义，使用 fixed 策略
                return fieldPathConfig.fixedValue || '[已脱敏]';
            } else {
                // 其他类型（如 symbol、function 等）：转为字符串处理
                const strValue = String(value);
                if (strValue.length <= prefixLen + suffixLen) {
                    return maskChar.repeat(strValue.length);
                }
                const prefix = strValue.substring(0, prefixLen);
                const suffix = strValue.substring(strValue.length - suffixLen);
                const mask = maskChar.repeat(Math.max(0, strValue.length - prefixLen - suffixLen));
                return prefix + mask + suffix;
            }

        case 'fixed':
            // 固定值策略：根据原始数据类型决定返回类型
            const fixedValue = fieldPathConfig.fixedValue || '[已脱敏]';

            if (valueType === 'number') {
                // 如果原始值是数字，尝试将固定值转换为数字
                const numValue = Number(fixedValue);
                // 如果转换成功且不是 NaN，返回数字；否则返回字符串
                return !isNaN(numValue) && isFinite(numValue) ? numValue : fixedValue;
            } else if (valueType === 'boolean') {
                // 如果原始值是布尔值，尝试将固定值转换为布尔值
                const lowerFixed = fixedValue.toLowerCase().trim();
                if (lowerFixed === 'true' || lowerFixed === '1') {
                    return true;
                } else if (lowerFixed === 'false' || lowerFixed === '0') {
                    return false;
                }
                // 如果无法转换，返回字符串
                return fixedValue;
            } else {
                // 字符串、对象、数组等其他类型，直接返回固定值字符串
                return fixedValue;
            }

        default:
            return value;
    }
};

// 递归处理对象脱敏
const maskObject = (obj: any, rules: MaskingRule[], currentPath: string[] = []): { result: any; count: number } => {
    if (obj === null || obj === undefined) {
        return { result: obj, count: 0 };
    }

    let maskedCount = 0;

    // 处理数组
    if (Array.isArray(obj)) {
        const maskedArray = obj.map((item, index) => {
            const itemPath = [...currentPath, `[${index}]`];
            const fullItemPath = joinFieldPath(itemPath);

            // 检查当前数组元素是否匹配任何规则
            let matchedConfig: FieldPathConfig | null = null;

            // 按照优先级顺序遍历：先按规则索引从大到小，再按字段路径配置索引从大到小
            for (let ruleIndex = rules.length - 1; ruleIndex >= 0; ruleIndex--) {
                const rule = rules[ruleIndex];
                // 从后往前遍历字段路径配置（优先级从高到低）
                for (let pathIndex = rule.fieldPaths.length - 1; pathIndex >= 0; pathIndex--) {
                    const fieldPathConfig = rule.fieldPaths[pathIndex];
                    if (fieldPathConfig.fieldPath.trim()) {
                        // 检查完整路径是否匹配（对于数组元素，需要检查完整路径）
                        const parsed = parseFieldPath(fieldPathConfig.fieldPath);
                        if (parsed.type === 'exact' && typeof parsed.pattern === 'string') {
                            // 精确匹配：直接比较完整路径
                            if (fullItemPath === parsed.pattern) {
                                matchedConfig = fieldPathConfig;
                                break;
                            }
                        } else if (parsed.type === 'array-wildcard' && typeof parsed.pattern === 'string') {
                            // 数组通配符匹配：使用正则表达式
                            const normalizedPattern = parsed.pattern.replace(/\[\*\]/g, '\\[\\d+\\]').replace(/\*/g, '.*');
                            const regex = new RegExp(`^${normalizedPattern}$`);
                            if (regex.test(fullItemPath)) {
                                matchedConfig = fieldPathConfig;
                                break;
                            }
                        } else if (parsed.type === 'wildcard' && typeof parsed.pattern === 'string') {
                            // 通配符匹配
                            const wildcardPattern = parsed.pattern.replace(/\*/g, '.*');
                            const regex = new RegExp(`^${wildcardPattern}$`);
                            if (regex.test(fullItemPath)) {
                                matchedConfig = fieldPathConfig;
                                break;
                            }
                        }
                    }
                }
                if (matchedConfig) {
                    break; // 找到匹配的配置，停止搜索规则
                }
            }

            // 如果匹配到规则，应用脱敏策略
            if (matchedConfig) {
                const itemType = typeof item;
                const isItemArray = Array.isArray(item);
                const isItemObject = itemType === 'object' && !isItemArray && item !== null;

                // 只对基本类型进行脱敏
                if (itemType === 'string' || itemType === 'number' || itemType === 'boolean') {
                    const maskedItem = applyMaskingStrategy(item, matchedConfig);
                    maskedCount++;
                    return maskedItem;
                } else if (isItemObject || isItemArray) {
                    // 复杂类型（对象、数组）先应用脱敏策略，然后递归处理
                    const maskedValue = applyMaskingStrategy(item, matchedConfig);
                    if (typeof maskedValue === 'object' && maskedValue !== null) {
                        const { result, count } = maskObject(maskedValue, rules, itemPath);
                        maskedCount += count;
                        return result;
                    } else {
                        maskedCount++;
                        return maskedValue;
                    }
                } else {
                    // 其他类型（null、undefined等）应用脱敏策略
                    const maskedItem = applyMaskingStrategy(item, matchedConfig);
                    maskedCount++;
                    return maskedItem;
                }
            } else {
                // 没有匹配的规则，递归处理
                const { result, count } = maskObject(item, rules, itemPath);
                maskedCount += count;
                return result;
            }
        });
        return { result: maskedArray, count: maskedCount };
    }

    // 处理对象
    if (typeof obj === 'object') {
        const maskedObj: any = {};

        for (const [key, value] of Object.entries(obj)) {
            const fieldPath = [...currentPath, key];

            // 检查是否匹配任何规则的任何字段路径配置
            // 优先级：从下到上（即从最后一个字段路径开始匹配，如果匹配到就应用）
            // 优先级规则：先按字段路径配置索引（从大到小，即数组最后一个优先级最高），再按规则索引（从大到小）
            let matchedConfig: FieldPathConfig | null = null;

            // 按照优先级顺序遍历：先按规则索引从大到小，再按字段路径配置索引从大到小
            for (let ruleIndex = rules.length - 1; ruleIndex >= 0; ruleIndex--) {
                const rule = rules[ruleIndex];
                // 从后往前遍历字段路径配置（优先级从高到低）
                for (let pathIndex = rule.fieldPaths.length - 1; pathIndex >= 0; pathIndex--) {
                    const fieldPathConfig = rule.fieldPaths[pathIndex];
                    if (fieldPathConfig.fieldPath.trim() && isFieldMatched(fieldPath, key, fieldPathConfig)) {
                        matchedConfig = fieldPathConfig;
                        break; // 找到匹配的配置，停止搜索
                    }
                }
                if (matchedConfig) {
                    break; // 找到匹配的配置，停止搜索规则
                }
            }

            if (matchedConfig) {
                // 检查是否是数组通配符规则且值是数组
                const isArrayWildcardRule = matchedConfig.fieldPath.includes('[*]') && matchedConfig.fieldPath.endsWith('[*]') && Array.isArray(value);

                if (isArrayWildcardRule) {
                    // 对数组中的每个元素进行脱敏处理
                    // 只对基本类型（字符串、数字、布尔）进行脱敏，复杂类型（对象、数组）保持原样，不进行任何处理
                    const maskedArray = value.map((item: any) => {
                        const itemType = typeof item;
                        const isItemArray = Array.isArray(item);
                        const isItemObject = itemType === 'object' && !isItemArray && item !== null;

                        // 只对基本类型进行脱敏
                        if (itemType === 'string' || itemType === 'number' || itemType === 'boolean') {
                            const maskedItem = applyMaskingStrategy(item, matchedConfig);
                            maskedCount++;
                            return maskedItem;
                        } else if (isItemObject || isItemArray) {
                            // 复杂类型（对象、数组）保持原样，不脱敏，也不递归处理
                            // 如果需要对对象数组中的字段脱敏，应该使用 users[*].email 这样的路径
                            return item;
                        } else {
                            // 其他类型（null、undefined等）保持原样
                            return item;
                        }
                    });
                    maskedObj[key] = maskedArray;
                } else {
                    // 应用匹配的脱敏策略
                    const maskedValue = applyMaskingStrategy(value, matchedConfig);

                    // 无论策略是什么，只要匹配到规则就应该计数（删除字段也是一种脱敏操作）
                    if (maskedValue !== undefined) {
                        // 如果策略是 'remove'，返回 undefined，不添加字段
                        maskedObj[key] = maskedValue;

                        // 如果值是对象或数组，需要递归处理
                        if (typeof maskedValue === 'object' && maskedValue !== null) {
                            const { result, count } = maskObject(maskedValue, rules, fieldPath);
                            maskedObj[key] = result;
                            maskedCount += count;
                        } else {
                            // 基本类型，直接计数
                            maskedCount++;
                        }
                    } else {
                        // 策略是 'remove'，字段被删除，但也要计数
                        maskedCount++;
                    }
                }
            } else {
                // 没有匹配的规则，递归处理子对象
                if (typeof value === 'object' && value !== null) {
                    const { result, count } = maskObject(value, rules, fieldPath);
                    maskedObj[key] = result;
                    maskedCount += count;
                } else {
                    maskedObj[key] = value;
                }
            }
        }

        return { result: maskedObj, count: maskedCount };
    }

    // 基本类型直接返回
    return { result: obj, count: 0 };
};

// 确认应用
const confirmApply = () => {
    if (!props.jsonData || !props.jsonData.trim()) {
        showMessageWarning('JSON 数据不能为空');
        return;
    }

    // 验证规则：至少有一个有效的字段路径
    const hasValidFieldPath = currentRule.value.fieldPaths.some(fieldPath => fieldPath.fieldPath.trim());
    if (!hasValidFieldPath) {
        showMessageWarning('请至少配置一个有效的字段路径');
        return;
    }

    applying.value = true;

    try {
        // 解析JSON
        let jsonObj;
        try {
            jsonObj = JSON.parse(props.jsonData);
        } catch (error) {
            showMessageError('JSON 数据格式不正确，请先格式化 JSON 数据');
            applying.value = false;
            return;
        }

        // 应用脱敏（只使用当前规则）
        const { result, count } = maskObject(jsonObj, [currentRule.value]);

        // 格式化输出
        const maskedJson = JSON.stringify(result, null, 2);

        // 直接应用到输入区域
        emit('apply', maskedJson);
        handleDialogClose();

        // 显示脱敏结果弹窗
        showMessageSuccess(`已成功脱敏 ${count} 个字段`);
    } catch (error: any) {
        showMessageError('脱敏处理失败: ' + (error.message || '未知错误'));
    } finally {
        applying.value = false;
    }
};

// 关闭对话框
const handleDialogClose = () => {
    dialogVisible.value = false;
    // 关闭时重置为空白规则
    initBlankRule();
};

// 使用 watch 监听对话框打开，初始化空白规则
watch(
    () => dialogVisible.value,
    newVal => {
        if (newVal) {
            initBlankRule();
        }
    }
);
</script>

<style scoped>
.data-masking-dialog-wrapper {
    max-width: 95vw;
}

.data-masking-dialog-wrapper :deep(.el-dialog) {
    max-height: calc(100vh - 12vh);
    display: flex;
    flex-direction: column;
    margin-top: 0 !important;
    margin-bottom: 0 !important;
}

.data-masking-dialog {
    padding: 0;
}

.section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
    flex-wrap: wrap;
    gap: 10px;
}

.section-title {
    font-size: 16px;
    font-weight: 600;
    color: #303133;
}

.header-actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
}

.rules-limit-hint {
    margin-bottom: 16px;
}

.masking-rules-section {
    margin-bottom: 24px;
}

.empty-rules {
    padding: 40px 0;
}

.rules-list {
    display: flex;
    flex-direction: column;
    gap: 16px;
}

.rule-item {
    border: 1px solid #e4e7ed;
    border-radius: 6px;
    padding: 16px;
    background-color: #fafafa;
}

.rule-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
}

.rule-name-input-wrapper {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
}

.rule-name-label {
    font-size: 13px;
    color: #606266;
    font-weight: 500;
    white-space: nowrap;
    flex-shrink: 0;
}

.rule-name {
    font-size: 14px;
    font-weight: 600;
    color: #409eff;
}

.rule-content {
    display: flex;
    flex-direction: column;
    gap: 16px;
}

.priority-hint {
    margin-bottom: 4px;
}

.field-paths-list {
    display: flex;
    flex-direction: column;
    gap: 16px;
}

.field-path-item {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
    background-color: #ffffff;
    border: 1px solid #e4e7ed;
    border-radius: 6px;
    position: relative;
}

.field-path-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 4px;
}

.field-path-label {
    font-size: 13px;
    font-weight: 600;
    color: #303133;
}

.field-path-header-right {
    display: flex;
    align-items: center;
    gap: 8px;
}

.field-path-priority {
    font-size: 12px;
    color: #409eff;
    font-weight: 500;
    padding: 2px 8px;
    background-color: #ecf5ff;
    border-radius: 4px;
}

.field-path-delete-btn {
    padding: 2px 8px !important;
    background-color: #fef0f0 !important;
    border-radius: 4px;
    color: #f56c6c !important;
    font-weight: 500;
    transition: background-color 0.2s;
    border: none;
}

.field-path-delete-btn:hover {
    background-color: #fde2e2 !important;
    color: #f56c6c !important;
}

.field-path-delete-btn:active {
    background-color: #fcdddd !important;
}

.field-path-divider {
    height: 1px;
    background: linear-gradient(to right, transparent, #e4e7ed 20%, #e4e7ed 80%, transparent);
    margin: 16px 0 0 0;
}

.add-field-path-action {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 8px 0;
    margin-top: 4px;
}

.add-field-path-error {
    font-size: 12px;
    color: #f56c6c;
    text-align: center;
}

.rule-field {
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.field-label-row {
    display: flex;
    align-items: baseline;
    gap: 8px;
    margin-bottom: 6px;
    flex-wrap: wrap;
}

.field-label {
    font-size: 13px;
    color: #606266;
    font-weight: 500;
    white-space: nowrap;
    flex-shrink: 0;
}

.field-hint-inline {
    font-size: 12px;
    color: #909399;
    line-height: 1.5;
    flex: 1;
    min-width: 0;
    word-break: keep-all;
    white-space: normal;
}

.field-hint {
    font-size: 12px;
    color: #909399;
    line-height: 1.4;
}

/* 策略行布局（并排显示策略和固定值） */
.strategy-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    align-items: start;
}

.strategy-item {
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.strategy-single {
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.partial-config {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
    margin-top: 8px;
}

.dialog-footer {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
}

/* 选择规则对话框样式（子弹窗） */
.data-masking-dialog-wrapper :deep(.el-dialog__wrapper) .el-dialog {
    max-height: calc(100vh - 20vh);
    display: flex;
    flex-direction: column;
    margin-top: 0 !important;
    margin-bottom: 0 !important;
}

.select-rule-dialog {
    padding: 0;
}

.empty-saved-rules {
    padding: 40px 0;
}

.saved-rules-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
    max-height: 400px;
    overflow-y: auto;
}

.saved-rule-item-wrapper {
    display: flex;
    flex-direction: column;
}

.saved-rule-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    border: 1px solid #e4e7ed;
    border-radius: 6px;
    background-color: #fafafa;
    transition: all 0.2s;
}

.saved-rule-item:hover {
    background-color: #f5f7fa;
    border-color: #c0c4cc;
}

.select-icon {
    font-size: 18px;
    color: #409eff;
}

.delete-icon {
    font-size: 18px;
    color: #f56c6c;
}

.saved-rule-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.saved-rule-name {
    font-size: 14px;
    font-weight: 600;
    color: #303133;
}

.saved-rule-meta {
    font-size: 12px;
    color: #909399;
}

/* 删除确认框样式 */
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

/* 响应式设计 */
@media (max-width: 768px) {
    .partial-config {
        grid-template-columns: 1fr;
    }

    .strategy-row {
        grid-template-columns: 1fr;
        gap: 12px;
    }

    .header-actions {
        width: 100%;
    }

    .section-header {
        flex-direction: column;
        align-items: flex-start;
    }

    .field-label-row {
        flex-direction: column;
        align-items: flex-start;
        gap: 4px;
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

    .field-hint-inline {
        font-size: 11px;
        line-height: 1.4;
    }
}

.field-hint-inline {
    font-size: 11px;
    line-height: 1.4;
}

/* 路径帮助说明样式 */
:deep(.el-alert__title) {
    width: 100%;
}

:deep(.el-alert__title) code {
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', 'source-code-pro', monospace;
    font-size: 11px;
    background-color: #fff;
    padding: 2px 6px;
    border-radius: 2px;
    border: 1px solid #e4e7ed;
    color: #409eff;
}

/* 字段路径自动补全样式 */
.autocomplete-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
}

.path-text {
    flex: 1;
    font-size: 13px;
    color: #303133;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.path-type {
    font-size: 11px;
    color: #909399;
    padding: 2px 6px;
    margin-left: 8px;
    white-space: nowrap;
}
</style>
