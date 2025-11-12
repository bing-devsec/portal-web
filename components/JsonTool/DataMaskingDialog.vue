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
                <el-alert
                    type="info"
                    :closable="false"
                    style="margin-bottom: 20px;"
                >
                    <template #title>
                        <div style="font-size: 12px; line-height: 1.6;">
                            <p style="margin: 0 0 8px 0;">
                                <strong>功能说明：</strong>对JSON数据中的敏感字段进行脱敏处理。适用于分享数据前隐藏敏感信息，如密码、手机号、邮箱、身份证号等。
                            </p>
                            <div style="margin-top: 8px;">
                                <el-button
                                    text
                                    type="primary"
                                    size="small"
                                    @click="togglePathHelp"
                                    style="padding: 0; font-size: 12px; height: auto;"
                                >
                                    <el-icon style="margin-right: 4px; transition: transform 0.3s;" :style="{ transform: showPathHelp ? 'rotate(90deg)' : 'rotate(0deg)' }">
                                        <ArrowRight />
                                    </el-icon>
                                    {{ showPathHelp ? '收起' : '展开' }}路径字段匹配规则说明
                                </el-button>
                            </div>
                            <el-collapse-transition>
                                <div v-show="showPathHelp" style="margin-top: 12px; padding: 12px; background-color: #f5f7fa; border-radius: 4px; border-left: 3px solid #409eff;">
                                    <div style="font-size: 12px; line-height: 1.8; color: #606266;">
                                        <p style="margin: 0 0 10px 0; font-weight: 600; color: #303133;">字段路径匹配规则：</p>
                                        
                                        <div style="margin-bottom: 12px;">
                                            <p style="margin: 0 0 6px 0; font-weight: 600; color: #409eff;">1. 精确路径匹配</p>
                                            <p style="margin: 0 0 4px 0; padding-left: 12px;">• 输入完整路径，如：<code style="background: #fff; padding: 2px 6px; border-radius: 2px;">user.password</code></p>
                                            <p style="margin: 0; padding-left: 12px; color: #909399; font-size: 11px;">示例：输入 <code style="background: #fff; padding: 2px 6px; border-radius: 2px;">name</code> 会匹配 <code style="background: #fff; padding: 2px 6px; border-radius: 2px;">company.name</code> 和 <code style="background: #fff; padding: 2px 6px; border-radius: 2px;">employees[0].personalInfo.name</code></p>
                                        </div>

                                        <div style="margin-bottom: 12px;">
                                            <p style="margin: 0 0 6px 0; font-weight: 600; color: #409eff;">2. 通配符匹配</p>
                                            <p style="margin: 0 0 4px 0; padding-left: 12px;">• 使用 <code style="background: #fff; padding: 2px 6px; border-radius: 2px;">*</code> 匹配任意字段名，如：<code style="background: #fff; padding: 2px 6px; border-radius: 2px;">*.password</code></p>
                                            <p style="margin: 0; padding-left: 12px; color: #909399; font-size: 11px;">示例：<code style="background: #fff; padding: 2px 6px; border-radius: 2px;">*.password</code> 会匹配 <code style="background: #fff; padding: 2px 6px; border-radius: 2px;">user.password</code>、<code style="background: #fff; padding: 2px 6px; border-radius: 2px;">admin.password</code> 等</p>
                                        </div>

                                        <div style="margin-bottom: 12px;">
                                            <p style="margin: 0 0 6px 0; font-weight: 600; color: #409eff;">3. 数组通配符匹配</p>
                                            <p style="margin: 0 0 4px 0; padding-left: 12px;">• 使用 <code style="background: #fff; padding: 2px 6px; border-radius: 2px;">[*]</code> 匹配数组中的所有元素，如：<code style="background: #fff; padding: 2px 6px; border-radius: 2px;">users[*].email</code></p>
                                            <p style="margin: 0; padding-left: 12px; color: #909399; font-size: 11px;">示例：<code style="background: #fff; padding: 2px 6px; border-radius: 2px;">company.employees[*].personalInfo.phone</code> 会匹配数组中所有员工的手机号</p>
                                        </div>

                                        <div style="margin-bottom: 0;">
                                            <p style="margin: 0 0 6px 0; font-weight: 600; color: #409eff;">4. 正则表达式匹配</p>
                                            <p style="margin: 0 0 4px 0; padding-left: 12px;">• 使用 <code style="background: #fff; padding: 2px 6px; border-radius: 2px;">/pattern/flags</code> 格式，如：<code style="background: #fff; padding: 2px 6px; border-radius: 2px;">/password|pwd/i</code></p>
                                            <p style="margin: 0; padding-left: 12px; color: #909399; font-size: 11px;">示例：<code style="background: #fff; padding: 2px 6px; border-radius: 2px;">/password|pwd/i</code> 会匹配包含 password 或 pwd 的字段（不区分大小写）</p>
                                        </div>

                                        <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #dcdfe6;">
                                            <p style="margin: 0; font-weight: 600; color: #e6a23c;">💡 提示：</p>
                                            <p style="margin: 4px 0 0 0; padding-left: 12px; color: #909399; font-size: 11px;">• 如果只想匹配特定路径的字段，请使用完整路径，如 <code style="background: #fff; padding: 2px 6px; border-radius: 2px;">company.name</code></p>
                                            <p style="margin: 4px 0 0 0; padding-left: 12px; color: #909399; font-size: 11px;">• 如果想要匹配所有层级的同名字段，直接输入字段名即可，如 <code style="background: #fff; padding: 2px 6px; border-radius: 2px;">name</code></p>
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
                            <el-button type="primary" size="small" @click="addRule" :disabled="rules.length >= 3">
                                <el-icon><Plus /></el-icon>
                                添加规则
                            </el-button>
                            <el-button 
                                type="success" 
                                size="small" 
                                @click="saveCurrentRule" 
                                :disabled="!canSaveNewRule"
                                :title="savedRulesList.length >= 5 && !canSaveNewRule ? '脱敏规则数量已达上限（5条），无法保存新规则。请先删除旧规则后再保存。' : ''"
                            >
                                <el-icon><DocumentAdd /></el-icon>
                                保存规则
                            </el-button>
                            <el-button type="info" size="small" @click="openLoadRuleDialog" :disabled="savedRulesList.length === 0">
                                <el-icon><FolderOpened /></el-icon>
                                加载规则
                            </el-button>
                            <el-button type="danger" size="small" @click="openDeleteRuleDialog" :disabled="savedRulesList.length === 0">
                                <el-icon><Delete /></el-icon>
                                删除规则
                            </el-button>
                        </div>
                    </div>
                    
                    <div v-if="rules.length >= 3" class="rules-limit-hint">
                        <el-alert type="warning" :closable="false" show-icon>
                            <template #title>
                                <span style="font-size: 12px;">最多只能添加3条规则</span>
                            </template>
                        </el-alert>
                    </div>

                    <div v-if="rules.length === 0" class="empty-rules">
                        <el-empty description="暂无脱敏规则，点击上方按钮添加" :image-size="80" />
                    </div>

                    <div v-else class="rules-list">
                        <div
                            v-for="(rule, index) in rules"
                            :key="index"
                            class="rule-item"
                        >
                            <div class="rule-header">
                                <span class="rule-name">{{ rule.name }}</span>
                                <el-button
                                    type="danger"
                                    size="small"
                                    text
                                    @click="removeRule(index)"
                                >
                                    <el-icon><Delete /></el-icon>
                                    删除
                                </el-button>
                            </div>

                            <div class="rule-content">
                                <!-- 优先级提示 -->
                                <div class="priority-hint">
                                    <el-alert type="info" :closable="false" show-icon>
                                        <template #title>
                                            <span style="font-size: 12px;">优先级说明：从上到下执行，下面的优先级更高（如果多个字段路径都匹配，将应用最后一个匹配的配置）</span>
                                        </template>
                                    </el-alert>
                                    </div>

                                <!-- 字段路径配置列表（最多3个） -->
                                <div class="field-paths-list">
                                    <div
                                        v-for="(fieldPathConfig, pathIndex) in rule.fieldPaths"
                                        :key="pathIndex"
                                        class="field-path-item"
                                    >
                                        <div class="field-path-header">
                                            <span class="field-path-label">字段路径 {{ pathIndex + 1 }}：</span>
                                            <div class="field-path-header-right">
                                                <span class="field-path-priority">优先级：{{ rule.fieldPaths.length - pathIndex }}</span>
                                                <el-button
                                                    v-if="rule.fieldPaths.length > 1"
                                                    type="danger"
                                                    size="small"
                                                    text
                                                    @click="removeFieldPath(index, pathIndex)"
                                                >
                                                    <el-icon><Delete /></el-icon>
                                                    删除
                                                </el-button>
                                            </div>
                                        </div>
                                        
                                        <!-- 字段路径输入 -->
                                        <div class="rule-field">
                                    <el-input
                                                v-model="fieldPathConfig.fieldPath"
                                                :placeholder="`例如: password, user.email, users[*].phone, /password|pwd/i`"
                                        clearable
                                        maxlength="300"
                                        show-word-limit
                                    />
                                </div>

                                <!-- 脱敏策略 -->
                                <div class="rule-field">
                                    <label class="field-label">脱敏策略：</label>
                                    <el-select
                                                v-model="fieldPathConfig.strategy"
                                        style="width: 100%"
                                                @change="handleStrategyChange(fieldPathConfig, index, pathIndex)"
                                    >
                                        <el-option label="完全隐藏（删除字段）" value="remove" />
                                        <el-option label="替换为 null" value="null" />
                                        <el-option label="替换为固定值" value="fixed" />
                                        <el-option label="部分显示（保留前后几位）" value="partial" />
                                    </el-select>
                                </div>

                                <!-- 策略参数 -->
                                        <div v-if="fieldPathConfig.strategy === 'fixed'" class="rule-field">
                                    <label class="field-label">固定值：</label>
                                    <el-input
                                                v-model="fieldPathConfig.fixedValue"
                                        placeholder="例如: ***, <MASKED>"
                                        clearable
                                        maxlength="30"
                                        show-word-limit
                                    />
                                </div>

                                        <div v-if="fieldPathConfig.strategy === 'partial'" class="rule-field">
                                    <div class="partial-config">
                                        <div class="partial-item">
                                            <label class="field-label">保留前几位：</label>
                                            <el-input-number
                                                        v-model="fieldPathConfig.prefixLength"
                                                :min="0"
                                                :max="10"
                                                :precision="0"
                                                style="width: 100%"
                                            />
                                        </div>
                                        <div class="partial-item">
                                            <label class="field-label">保留后几位：</label>
                                            <el-input-number
                                                        v-model="fieldPathConfig.suffixLength"
                                                :min="0"
                                                :max="10"
                                                :precision="0"
                                                style="width: 100%"
                                            />
                                        </div>
                                        <div class="partial-item">
                                            <label class="field-label">掩码字符：</label>
                                            <el-input
                                                        v-model="fieldPathConfig.maskChar"
                                                placeholder="例如: *"
                                                maxlength="1"
                                                style="width: 100%"
                                            />
                                        </div>
                                    </div>
                                </div>

                                        <!-- 分隔线（不是最后一个时显示） -->
                                        <div v-if="pathIndex < rule.fieldPaths.length - 1" class="field-path-divider"></div>
                                    </div>
                                </div>

                                <!-- 添加字段路径按钮和错误提示 -->
                                <div v-if="rule.fieldPaths.length < 3" class="add-field-path-action">
                                    <el-button
                                        type="primary"
                                        size="small"
                                        text
                                        :disabled="!canAddFieldPath(index)"
                                        @click="addFieldPath(index)"
                                    >
                                        <el-icon><Plus /></el-icon>
                                        添加字段路径（{{ rule.fieldPaths.length }}/3）
                                    </el-button>
                                    <div v-if="getAddFieldPathError(index)" class="add-field-path-error">
                                        {{ getAddFieldPathError(index) }}
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
                    <el-button
                        type="primary"
                        @click="confirmApply"
                        :loading="applying"
                    >
                        {{ applying ? '应用中...' : '应用' }}
                    </el-button>
                </div>
            </template>
        </el-dialog>

        <!-- 加载规则对话框 -->
        <el-dialog
            v-model="loadRuleDialogVisible"
            title="选择要加载的规则"
            width="600px"
            :close-on-click-modal="false"
            :align-center="false"
            top="20vh"
        >
            <div class="select-rule-dialog">
                <div v-if="savedRulesList.length === 0" class="empty-saved-rules">
                    <el-empty description="暂无已保存的规则" :image-size="80" />
                </div>
                <div v-else class="saved-rules-list">
                    <div
                        v-for="(savedRule, index) in savedRulesList"
                        :key="index"
                        class="saved-rule-item"
                        @click="loadRule(index)"
                    >
                        <div class="saved-rule-info">
                            <div class="saved-rule-name">{{ savedRule.name }}</div>
                            <div class="saved-rule-meta">
                                保存时间：{{ savedRule.saveTime }}
                            </div>
                            <div class="saved-rule-meta">
                                字段路径：{{ savedRule.fieldPaths?.map((fp, idx) => `${idx + 1}. ${fp.fieldPath || '(空)'}`).join('; ') || '(无)' }}
                            </div>
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
                    <div
                        v-for="(savedRule, index) in savedRulesList"
                        :key="index"
                        class="saved-rule-item-wrapper"
                    >
                        <div class="saved-rule-item">
                            <div class="saved-rule-info">
                                <div class="saved-rule-name">{{ savedRule.name }}</div>
                                <div class="saved-rule-meta">
                                    保存时间：{{ savedRule.saveTime }}
                                </div>
                                <div class="saved-rule-meta">
                                    字段路径：{{ savedRule.fieldPaths?.map((fp, idx) => `${idx + 1}. ${fp.fieldPath || '(空)'}`).join('; ') || '(无)' }}
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
import { ref, computed, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
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
    'apply': [maskedJson: string];
}>();

// 对话框显示状态
const dialogVisible = computed({
    get: () => props.modelValue,
    set: (value) => emit('update:modelValue', value)
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
    fieldPaths: FieldPathConfig[]; // 字段路径配置数组（最多3个）
    isSaved?: boolean; // 标记是否已保存
}

// 脱敏规则列表
const rules = ref<MaskingRule[]>([]);

// 处理状态
const applying = ref(false);

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

// 计算是否有未保存的规则（只检查当前选中的规则）
const hasUnsavedRule = computed(() => {
    // 检查当前是否有规则且未保存，且至少有一个有效的字段路径
    return rules.value.some(rule => 
        !rule.isSaved && 
        rule.fieldPaths.some(fieldPath => fieldPath.fieldPath.trim())
    );
});

// 计算是否可以保存新规则（检查规则数量上限）
const canSaveNewRule = computed(() => {
    if (!hasUnsavedRule.value) {
        return false;
    }
    
    // 获取未保存的规则
    const unsavedRules = rules.value.filter(rule => 
        !rule.isSaved && 
        rule.fieldPaths.some(fieldPath => fieldPath.fieldPath.trim())
    );
    
    if (unsavedRules.length === 0) {
        return false;
    }
    
    // 检查是否有未保存的规则在已保存列表中已存在（可以覆盖）
    const hasExistingRule = unsavedRules.some(rule => 
        savedRulesList.value.some(savedRule => savedRule.name === rule.name)
    );
    
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
                                    saveTime: ruleSet.saveTime || new Date().toISOString()
                                };
                                if (rule.fieldPath && !rule.fieldPaths) {
                                    migratedRule.fieldPaths = [{
                                        fieldPath: rule.fieldPath,
                                        strategy: rule.strategy || 'fixed',
                                        prefixLength: rule.prefixLength,
                                        suffixLength: rule.suffixLength,
                                        maskChar: rule.maskChar,
                                        fixedValue: rule.fixedValue
                                    }];
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
                                fieldPaths: [{
                                    fieldPath: rule.fieldPath,
                                    strategy: rule.strategy || 'fixed',
                                    prefixLength: rule.prefixLength,
                                    suffixLength: rule.suffixLength,
                                    maskChar: rule.maskChar,
                                    fixedValue: rule.fixedValue
                                }]
                            };
                        }
                        return rule;
                    });
                    savedRulesList.value = migratedRules;
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
        ElMessage.error('保存规则列表失败');
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
        
        // 根据策略验证相应参数
        if (fieldPathConfig.strategy === 'fixed') {
            // 固定值策略：验证固定值
            if (fieldPathConfig.fixedValue !== undefined && fieldPathConfig.fixedValue !== null) {
                if (fieldPathConfig.fixedValue.length > 30) {
                    return { valid: false, error: `字段路径 ${i + 1} 的固定值不能超过30个字符` };
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

// 添加规则
const addRule = async () => {
    if (rules.value.length >= 3) {
        ElMessage.warning('最多只能添加3条规则');
        return;
    }
    
    try {
        const { value: ruleName } = await ElMessageBox.prompt(
            '请输入规则名称',
            '添加规则',
            {
                confirmButtonText: '确定',
                cancelButtonText: '取消',
                inputPlaceholder: '例如：手机号脱敏',
                inputValidator: (value) => {
                    if (!value || !value.trim()) {
                        return '规则名称不能为空';
                    }
                    if (value.length > 30) {
                        return '规则名称不能超过30个字符';
                    }
                    // 检查名称是否重复
                    if (rules.value.some(rule => rule.name === value.trim())) {
                        return '规则名称已存在，请使用其他名称';
                    }
                    return true;
                }
            }
        );
        
        if (ruleName && ruleName.trim()) {
            rules.value.push({
                name: ruleName.trim(),
                fieldPaths: [{
                fieldPath: '',
                strategy: 'fixed',
                    fixedValue: '***'
                }],
                isSaved: false
            });
        }
    } catch (error) {
        // 用户取消
    }
};

// 删除规则
const removeRule = (index: number) => {
    rules.value.splice(index, 1);
};

// 保存当前规则（单个规则）
const saveCurrentRule = async () => {
    // 获取未保存的规则，且至少有一个有效的字段路径
    const unsavedRules = rules.value.filter(rule => 
        !rule.isSaved && 
        rule.fieldPaths.some(fieldPath => fieldPath.fieldPath.trim())
    );
    
    if (unsavedRules.length === 0) {
        ElMessage.warning('没有可保存的规则（所有规则都已保存或无效）');
        return;
    }
    
    // 如果有多条未保存的规则，提示用户只能保存一条
    if (unsavedRules.length > 1) {
        ElMessage.warning('请先保存其他规则，一次只能保存一条规则');
        return;
    }
    
    // 保存单条规则
    const rule = unsavedRules[0];
    
    // 验证规则的有效性
    const validation = validateRule(rule);
    if (!validation.valid) {
        ElMessage.error(validation.error || '规则验证失败');
        return;
    }
    
    // 检查是否已存在同名规则
    const existingIndex = savedRulesList.value.findIndex(r => r.name === rule.name);
    
    // 如果是新规则（不是覆盖已存在的规则），检查规则数量上限
    if (existingIndex === -1 && savedRulesList.value.length >= 5) {
        ElMessage.warning('脱敏规则数量已达上限（5条），无法保存新规则。请先删除旧规则后再保存。');
        return;
    }
    
    const now = new Date();
    const saveTime = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    
    const newRule: SavedRule = {
        ...JSON.parse(JSON.stringify(rule)), // 深拷贝
        saveTime
    };
    
    if (existingIndex !== -1) {
        // 如果已存在同名规则，询问是否覆盖
        try {
            await ElMessageBox.confirm(
                `规则"${rule.name}"已存在，是否覆盖？`,
                '确认覆盖',
                {
                    confirmButtonText: '覆盖',
                    cancelButtonText: '取消',
                    type: 'warning'
                }
            );
            savedRulesList.value[existingIndex] = newRule;
            saveRulesListToStorage();
            ElMessage.success(`规则"${rule.name}"已覆盖保存`);
        } catch {
            // 用户取消
            return;
        }
    } else {
        savedRulesList.value.push(newRule);
        saveRulesListToStorage();
        ElMessage.success(`规则"${rule.name}"已保存`);
    }
    
    // 标记规则为已保存
    const ruleIndex = rules.value.findIndex(r => r === rule);
    if (ruleIndex !== -1) {
        rules.value[ruleIndex].isSaved = true;
    }
};

// 打开加载规则对话框
const openLoadRuleDialog = () => {
    loadSavedRulesList(); // 重新加载，确保数据最新
    loadRuleDialogVisible.value = true;
};

// 加载规则（单个规则）
const loadRule = (index: number) => {
    if (index < 0 || index >= savedRulesList.value.length) {
        ElMessage.error('规则索引无效');
        return;
    }
    
    const savedRule = savedRulesList.value[index];
    
    // 检查当前规则数量
    if (rules.value.length >= 3) {
        ElMessage.warning('最多只能添加3条规则，请先删除现有规则');
        return;
    }
    
    // 深拷贝规则，并标记为未保存
    const loadedRule: MaskingRule = {
        ...JSON.parse(JSON.stringify(savedRule)),
        isSaved: false // 加载的规则标记为未保存
    };
    
    // 确保 fieldPaths 存在（兼容旧数据）
    if (!loadedRule.fieldPaths || !Array.isArray(loadedRule.fieldPaths)) {
        loadedRule.fieldPaths = [{
            fieldPath: (savedRule as any).fieldPath || '',
            strategy: (savedRule as any).strategy || 'fixed',
            prefixLength: (savedRule as any).prefixLength,
            suffixLength: (savedRule as any).suffixLength,
            maskChar: (savedRule as any).maskChar,
            fixedValue: (savedRule as any).fixedValue
        }];
    }
    
    // 检查是否已存在同名规则
    const existingIndex = rules.value.findIndex(r => r.name === loadedRule.name);
    if (existingIndex !== -1) {
        // 如果已存在同名规则，替换它
        rules.value[existingIndex] = loadedRule;
    } else {
        // 添加新规则
        rules.value.push(loadedRule);
    }
    
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
        ElMessage.error('规则索引无效');
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
const canAddFieldPath = (ruleIndex: number): boolean => {
    const rule = rules.value[ruleIndex];
    if (!rule || rule.fieldPaths.length >= 3) {
        return false;
    }
    // 检查前面的字段路径是否都填写了
    return rule.fieldPaths.every(fieldPathConfig => fieldPathConfig.fieldPath.trim() !== '');
};

// 获取添加字段路径的错误提示
const getAddFieldPathError = (ruleIndex: number): string => {
    const rule = rules.value[ruleIndex];
    if (!rule || rule.fieldPaths.length >= 3) {
        return '';
    }
    // 检查是否有未填写的字段路径
    const emptyIndex = rule.fieldPaths.findIndex(fieldPathConfig => fieldPathConfig.fieldPath.trim() === '');
    if (emptyIndex !== -1) {
        return `请先填写字段路径 ${emptyIndex + 1}，才能添加新的字段路径`;
    }
    return '';
};

// 添加字段路径
const addFieldPath = (ruleIndex: number) => {
    const rule = rules.value[ruleIndex];
    if (rule && rule.fieldPaths.length < 3) {
        // 检查前面的字段路径是否都填写了
        if (!canAddFieldPath(ruleIndex)) {
            return; // 如果前面的字段路径未填写，不允许添加
        }
        rule.fieldPaths.push({
            fieldPath: '',
            strategy: 'fixed',
            fixedValue: '***'
        });
    }
};

// 删除字段路径
const removeFieldPath = (ruleIndex: number, pathIndex: number) => {
    const rule = rules.value[ruleIndex];
    if (rule && rule.fieldPaths.length > 1) {
        rule.fieldPaths.splice(pathIndex, 1);
    }
};

// 处理策略变化
const handleStrategyChange = (fieldPathConfig: FieldPathConfig, ruleIndex: number, pathIndex: number) => {
    // 根据策略设置默认值
    if (fieldPathConfig.strategy === 'partial') {
        if (fieldPathConfig.prefixLength === undefined) fieldPathConfig.prefixLength = 3;
        if (fieldPathConfig.suffixLength === undefined) fieldPathConfig.suffixLength = 4;
        if (!fieldPathConfig.maskChar) fieldPathConfig.maskChar = '*';
    } else if (fieldPathConfig.strategy === 'fixed' && !fieldPathConfig.fixedValue) {
        fieldPathConfig.fixedValue = '[已脱敏]';
    }
};

// 解析字段路径
const parseFieldPath = (path: string): {
    type: 'exact' | 'wildcard' | 'array-wildcard' | 'regex';
    pattern: string | RegExp;
    parts: string[];
} => {
    const trimmed = path.trim();
    
    // 检查是否是正则表达式
    if (trimmed.startsWith('/') && trimmed.endsWith('/')) {
        const regexStr = trimmed.slice(1, -1);
        const flags = trimmed.match(/\/([gimsuy]*)$/)?.[1] || '';
        try {
            const regex = new RegExp(regexStr, flags);
            return { type: 'regex', pattern: regex, parts: [] };
        } catch {
            // 正则表达式无效，当作普通路径处理
        }
    }
    
    // 检查是否包含数组通配符
    if (trimmed.includes('[*]')) {
        return {
            type: 'array-wildcard',
            pattern: trimmed,
            parts: trimmed.split(/\[.*?\]/).filter(p => p)
        };
    }
    
    // 检查是否包含通配符
    if (trimmed.includes('*')) {
        return {
            type: 'wildcard',
            pattern: trimmed,
            parts: trimmed.split('.').filter(p => p)
        };
    }
    
    // 精确路径
    return {
        type: 'exact',
        pattern: trimmed,
        parts: trimmed.split('.').filter(p => p)
    };
};

// 检查字段是否匹配字段路径配置
const isFieldMatched = (fieldPath: string[], fieldName: string, fieldPathConfig: FieldPathConfig): boolean => {
    const parsed = parseFieldPath(fieldPathConfig.fieldPath);
    
    switch (parsed.type) {
        case 'exact':
            // 精确匹配：检查完整路径
            if (typeof parsed.pattern === 'string') {
                const fullPath = fieldPath.join('.');
                return fullPath === parsed.pattern || fieldName === parsed.pattern;
            }
            return false;
        
        case 'wildcard':
            // 通配符匹配：检查字段名是否匹配模式
            if (typeof parsed.pattern === 'string') {
                const wildcardPattern = parsed.pattern.replace(/\*/g, '.*');
                const regex = new RegExp(`^${wildcardPattern}$`);
                return regex.test(fieldName) || regex.test(fieldPath.join('.'));
            }
            return false;
        
        case 'array-wildcard':
            // 数组通配符：匹配数组中的字段
            // 例如: users[*].email 应该匹配 users[0].email, users[1].email 等
            if (typeof parsed.pattern === 'string') {
                // 将路径转换为正则表达式
                // users[*].email -> users\[\d+\]\.email
                const pathStr = fieldPath.join('.');
                const normalizedPattern = parsed.pattern
                    .replace(/\[\*\]/g, '\\[\\d+\\]')  // [*] -> \[\d+\]
                    .replace(/\*/g, '.*');              // * -> .*
                const regex = new RegExp(`^${normalizedPattern}$`);
                
                // 检查完整路径是否匹配
                if (regex.test(pathStr)) {
                    return true;
                }
                
                // 检查字段名是否匹配模式中的最后一部分
                // 例如: users[*].email 应该匹配 email 字段（在 users[0] 等路径下）
                const patternParts = parsed.pattern.split(/\[.*?\]|\./).filter(p => p);
                if (patternParts.length > 0) {
                    const lastPart = patternParts[patternParts.length - 1];
                    if (lastPart.includes('*')) {
                        const lastPattern = lastPart.replace(/\*/g, '.*');
                        const lastRegex = new RegExp(`^${lastPattern}$`);
                        if (lastRegex.test(fieldName)) {
                            // 检查当前路径是否在数组元素中
                            const pathStrForCheck = fieldPath.slice(0, -1).join('.');
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
                        const pathStrForCheck = fieldPath.slice(0, -1).join('.');
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
        
        case 'regex':
            // 正则表达式匹配
            if (parsed.pattern instanceof RegExp) {
                return parsed.pattern.test(fieldName) || parsed.pattern.test(fieldPath.join('.'));
            }
            return false;
        
        default:
            return false;
    }
};

// 应用脱敏策略
const applyMaskingStrategy = (value: any, fieldPathConfig: FieldPathConfig): any => {
    if (value === null || value === undefined) {
        return value;
    }
    
    const strValue = String(value);
    
    switch (fieldPathConfig.strategy) {
        case 'remove':
            return undefined; // 返回 undefined 表示删除字段
        
        case 'null':
            return null;
        
        case 'partial':
            const prefixLen = fieldPathConfig.prefixLength || 0;
            const suffixLen = fieldPathConfig.suffixLength || 0;
            const maskChar = fieldPathConfig.maskChar || '*';
            
            if (strValue.length <= prefixLen + suffixLen) {
                // 如果长度不足以部分显示，全部用掩码字符替换
                return maskChar.repeat(strValue.length);
            }
            
            const prefix = strValue.substring(0, prefixLen);
            const suffix = strValue.substring(strValue.length - suffixLen);
            const mask = maskChar.repeat(Math.max(0, strValue.length - prefixLen - suffixLen));
            return prefix + mask + suffix;
        
        case 'fixed':
            return fieldPathConfig.fixedValue || '[已脱敏]';
        
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
            const { result, count } = maskObject(item, rules, itemPath);
            maskedCount += count;
            return result;
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
                // 应用匹配的脱敏策略
                const maskedValue = applyMaskingStrategy(value, matchedConfig);
                    if (maskedValue !== undefined) {
                        // 如果策略是 'remove'，返回 undefined，不添加字段
                        maskedObj[key] = maskedValue;
                    }
                    // 如果值是对象或数组，需要递归处理（但策略是 remove 时跳过）
                    if (maskedValue !== undefined && (typeof maskedValue === 'object' && maskedValue !== null)) {
                        const { result, count } = maskObject(maskedValue, rules, fieldPath);
                        maskedObj[key] = result;
                        maskedCount += count;
                    } else if (maskedValue !== undefined) {
                        maskedCount++;
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
        ElMessage.warning('JSON数据不能为空');
        return;
    }
    
    // 验证规则：至少有一个规则且至少有一个有效的字段路径
    const validRules = rules.value.filter(rule => 
        rule.fieldPaths.some(fieldPath => fieldPath.fieldPath.trim())
    );
    if (validRules.length === 0) {
        ElMessage.warning('请至少添加一个有效的脱敏规则');
        return;
    }
    
    applying.value = true;
    
    try {
        // 解析JSON
        let jsonObj;
        try {
            jsonObj = JSON.parse(props.jsonData);
        } catch (error) {
            ElMessage.error('JSON格式不正确，请先格式化JSON数据');
            applying.value = false;
            return;
        }
        
        // 应用脱敏
        const { result, count } = maskObject(jsonObj, validRules);
        
        // 格式化输出
        const maskedJson = JSON.stringify(result, null, 2);
        
        // 直接应用到输入区域
        emit('apply', maskedJson);
        handleDialogClose();
    } catch (error: any) {
        ElMessage.error('脱敏处理失败: ' + (error.message || '未知错误'));
    } finally {
        applying.value = false;
    }
};

// 关闭对话框
const handleDialogClose = () => {
    dialogVisible.value = false;
};
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

.data-masking-dialog-wrapper :deep(.el-dialog__body) {
    overflow-y: auto;
    flex: 1;
    min-height: 0;
    padding-right: 20px;
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

.partial-config {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
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

.data-masking-dialog-wrapper :deep(.el-dialog__wrapper) .el-dialog__body {
    overflow-y: auto;
    flex: 1;
    min-height: 0;
    padding-right: 20px;
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
</style>

