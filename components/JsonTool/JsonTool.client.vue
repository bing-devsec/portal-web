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
        <div class="json-tool-container" :class="{ fullscreen: isFullscreen }">
            <!-- 工具栏 -->
            <div class="tool-bar-wrapper">
                <!-- 左侧渐变遮罩和滚动按钮 -->
                <div v-if="canScrollLeft" class="scroll-indicator scroll-indicator-left">
                    <el-button type="primary" circle size="small" class="scroll-btn scroll-btn-left" @click="scrollToolBar('left')" :icon="ArrowLeft" />
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
                        <el-button v-if="buttonVisibility.archive" type="primary" @click="handleSaveArchive">存档</el-button>
                        <el-button v-if="buttonVisibility.share" type="primary" @click="openShareDialog">分享</el-button>
                    </el-button-group>

                    <!-- 数据转换下拉按钮（紧挨着功能按钮组） -->
                    <el-dropdown v-if="buttonVisibility.dataConvert" trigger="click" @command="handleConvert">
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
                    <el-button v-if="buttonVisibility.fullscreen" type="warning" class="fullscreen-btn" @click="toggleFullscreen">
                        {{ isFullscreen ? '退出' : '全屏' }}
                    </el-button>
                </div>

                <!-- 右侧渐变遮罩和滚动按钮 -->
                <div v-if="canScrollRight" class="scroll-indicator scroll-indicator-right">
                    <div class="gradient-mask gradient-mask-right"></div>
                    <el-button type="primary" circle size="small" class="scroll-btn scroll-btn-right" @click="scrollToolBar('right')" :icon="ArrowRight" />
                </div>
            </div>

            <!-- 编辑区域 -->
            <div class="editor-container">
                <!-- 存档侧边栏（有存档时才显示） -->
                <template v-if="archives.length">
                    <div
                        class="archive-sidebar"
                        :class="{
                            collapsed: archiveSidebarWidth <= calculateArchiveMinWidth(),
                            'archive-dragging': !!draggingArchiveId,
                        }"
                        :style="{ width: archiveSidebarWidth + 'px' }"
                    >
                        <div class="archive-sidebar-header">
                            <span class="archive-sidebar-title">存档</span>
                        </div>
                        <div class="archive-list" v-if="archives.length" ref="archiveListRef" @dragover="onArchiveListDragOver" @drop="onArchiveListDrop">
                            <template v-for="(item, idx) in archives" :key="item.id">
                                <div v-if="dropIndicatorIndex === idx" class="archive-drop-indicator"></div>
                                <div
                                    class="archive-item"
                                    :draggable="dragEnabledArchiveId === item.id"
                                    @mousedown="onArchivePressStart(item.id, $event)"
                                    @touchstart.passive="onArchivePressStart(item.id, $event)"
                                    @mouseup="onArchivePressEnd"
                                    @mouseleave="onArchivePressEnd"
                                    @touchend.passive="onArchivePressEnd"
                                    @touchcancel.passive="onArchivePressEnd"
                                    @dragstart="onArchiveDragStart(item, $event)"
                                    @dragenter="onArchiveDragEnter(item.id)"
                                    @dragover="onArchiveDragOver($event, item.id, idx)"
                                    @drop="onArchiveDrop(item.id)"
                                    @dragend="onArchiveDragEnd"
                                    :class="{
                                        dragging: draggingArchiveId === item.id,
                                        'drag-over': dragOverArchiveId === item.id,
                                        'drag-ready': dragEnabledArchiveId === item.id,
                                    }"
                                >
                                    <span class="archive-name" :title="item.name" @click="handleArchiveCommand(item.id)">
                                        {{ archiveSidebarWidth <= calculateArchiveMinWidth() ? (item.name ? item.name.slice(0, 2) : '##') : item.name }}
                                    </span>
                                    <div v-if="archiveSidebarWidth > calculateArchiveMinWidth()" class="archive-actions">
                                        <el-icon class="archive-action-icon" @click.stop="handleRenameArchive(item)">
                                            <Edit />
                                        </el-icon>
                                        <el-icon class="archive-action-icon" @click.stop="handleRefreshArchive(item)" title="更新存档内容">
                                            <Refresh />
                                        </el-icon>
                                        <el-icon class="archive-action-icon" @click.stop="handleDeleteArchive(item)">
                                            <Delete />
                                        </el-icon>
                                    </div>
                                </div>
                            </template>
                            <div v-if="dropIndicatorIndex === archives.length" class="archive-drop-indicator"></div>
                        </div>
                        <div v-else-if="archiveSidebarWidth > calculateArchiveMinWidth()" class="archive-empty">暂无存档</div>
                    </div>
                    <!-- 分割线 -->
                    <div class="archive-resizer" @mousedown="startArchiveResize" @touchstart.passive="startArchiveResize"></div>
                </template>

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
                            <el-upload class="upload-json" accept=".json" :auto-upload="false" :show-file-list="false" :on-change="handleFileUpload">
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
                        <div class="editor-status-bar">
                            <template v-if="foldProgressVisible">
                                <div class="fold-progress">
                                    <div class="fold-progress-bar">
                                        <div class="fold-progress-fill" :style="{ width: foldPercent + '%' }"></div>
                                    </div>
                                    <span class="status-text">折叠进度：{{ foldPercent }}% （{{ foldCurrentLine }} / {{ foldTotalLines }}）</span>
                                </div>
                            </template>
                            <template v-else-if="outputEditorStatus">
                                <span class="status-text">{{ outputEditorStatus }}</span>
                            </template>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- 获取JSON数据对话框 -->
        <FetchJsonDialog v-model="fetchJsonDialogVisible" :indent-size="2" :input-editor="inputEditor" @json-loaded="handleFetchJsonLoaded" />

        <!-- 分享对话框 -->
        <ShareDialog v-model="shareDialogVisible" :json-data="getInputEditorValue()" @loadSharedJson="handleLoadSharedJson" />

        <!-- 数据脱敏对话框 -->
        <DataMaskingDialog v-model="dataMaskingDialogVisible" :json-data="getInputEditorValue()" @apply="handleDataMaskingApply" />

        <!-- 存档名称输入对话框 -->
        <ArchiveNameDialog
            v-model="archiveNameDialogVisible"
            :title="archiveNameDialogTitle"
            :input-value="archiveNameDialogInputValue"
            :placeholder="archiveNameDialogPlaceholder"
            :existing-archives="archives"
            :exclude-archive-id="archiveNameDialogExcludeId"
            @confirm="handleArchiveNameConfirm"
            @cancel="handleArchiveNameCancel"
        />

        <!-- 设置弹窗 -->
        <el-dialog v-model="settingsDialogVisible" class="settings-dialog-wrapper" :close-on-click-modal="false" :align-center="false" top="12vh" width="850px">
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
                                    <!-- 第一行：数据获取与基础处理 -->
                                    <div class="button-visibility-item" style="grid-column: 1; grid-row: 1">
                                        <el-checkbox v-model="buttonVisibility.fetchJson">获取JSON</el-checkbox>
                                    </div>
                                    <div class="button-visibility-item" style="grid-column: 2; grid-row: 1">
                                        <el-checkbox v-model="buttonVisibility.compress">压缩</el-checkbox>
                                    </div>
                                    <div class="button-visibility-item" style="grid-column: 3; grid-row: 1">
                                        <el-checkbox v-model="buttonVisibility.escape">转义</el-checkbox>
                                    </div>
                                    <div class="button-visibility-item" style="grid-column: 4; grid-row: 1">
                                        <el-checkbox v-model="buttonVisibility.unescape">去除转义</el-checkbox>
                                    </div>
                                    <div class="button-visibility-item" style="grid-column: 5; grid-row: 1">
                                        <el-checkbox v-model="buttonVisibility.compressEscape">压缩并转义</el-checkbox>
                                    </div>
                                    <!-- 第二行：数据处理与管理 -->
                                    <div class="button-visibility-item" style="grid-column: 1; grid-row: 2">
                                        <el-checkbox v-model="buttonVisibility.masking">脱敏</el-checkbox>
                                    </div>
                                    <div class="button-visibility-item" style="grid-column: 2; grid-row: 2">
                                        <el-checkbox v-model="buttonVisibility.sort">排序</el-checkbox>
                                    </div>
                                    <div class="button-visibility-item" style="grid-column: 3; grid-row: 2">
                                        <el-checkbox v-model="buttonVisibility.archive">存档</el-checkbox>
                                    </div>
                                    <div class="button-visibility-item" style="grid-column: 4; grid-row: 2">
                                        <el-checkbox v-model="buttonVisibility.dataConvert">数据转换</el-checkbox>
                                    </div>
                                    <div class="button-visibility-item" style="grid-column: 5; grid-row: 2">
                                        <el-checkbox v-model="buttonVisibility.share">分享</el-checkbox>
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
                                        <el-slider
                                            v-model="fontSize"
                                            :min="12"
                                            :max="16"
                                            :step="1"
                                            :show-tooltip="true"
                                            :format-tooltip="(val: number) => `${val}px`"
                                            @change="updateFontSize"
                                        />
                                    </div>
                                </div>
                            </div>

                            <!-- 分隔线：菜单栏设置和字符串换行设置之间 -->
                            <el-divider class="settings-subsection-divider" />

                            <!-- 字符串换行设置 -->
                            <div class="settings-subsection">
                                <div class="settings-subsection-title">字符串换行设置</div>
                                <div class="settings-item">
                                    <el-switch v-model="wordWrap" active-text="不换行" inactive-text="换行" size="default" @change="updateWordWrap" />
                                </div>
                            </div>

                            <!-- 分隔线：缩进指南设置和默认全屏设置之间 -->
                            <el-divider class="settings-subsection-divider" />

                            <!-- 默认全屏设置 -->
                            <div class="settings-subsection">
                                <div class="settings-subsection-title">默认全屏设置</div>
                                <div class="settings-item">
                                    <el-switch
                                        v-model="startInFullscreen"
                                        :inactive-value="true"
                                        :active-value="false"
                                        inactive-text="全屏"
                                        active-text="非全屏"
                                        size="default"
                                        @change="handleInitialFullscreenChange"
                                    />
                                </div>
                            </div>

                            <!-- 分隔线：字体大小设置和缩进指南设置之间 -->
                            <el-divider class="settings-subsection-divider" />

                            <!-- 缩进指南设置 -->
                            <div class="settings-subsection">
                                <div class="settings-subsection-title">缩进指南设置</div>
                                <div class="settings-item">
                                    <el-switch v-model="showIndentGuide" active-text="显示" inactive-text="隐藏" size="default" @change="updateIndentGuides" />
                                </div>
                            </div>

                            <!-- 分隔线：缩进指南设置和同步滚动设置之间 -->
                            <el-divider class="settings-subsection-divider" />

                            <!-- 同步滚动设置 -->
                            <div class="settings-subsection">
                                <div class="settings-subsection-title">同步滚动设置</div>
                                <div class="settings-item">
                                    <el-switch v-model="syncScrollEnabled" active-text="启用" inactive-text="禁用" size="default" />
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

                            <el-divider style="margin: 12px 0" />

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

                            <el-divider style="margin: 12px 0" />

                            <div class="settings-item">
                                <div class="settings-item-header">
                                    <span class="settings-label">数组样式</span>
                                </div>
                                <el-switch v-model="arrayNewLine" active-text="换行" inactive-text="紧凑" size="default" />
                            </div>
                        </div>
                    </el-collapse-item>

                    <!-- 去除转义设置 -->
                    <el-collapse-item name="unescape">
                        <template #title>
                            <div class="settings-collapse-title">
                                <el-icon class="column-title-icon">
                                    <Refresh />
                                </el-icon>
                                <span>去除转义设置</span>
                            </div>
                        </template>
                        <div class="settings-collapse-content">
                            <div class="settings-item">
                                <div class="settings-item-header">
                                    <span class="settings-label">处理模式</span>
                                </div>
                                <el-switch v-model="recursiveUnescape" active-text="递归去除" inactive-text="仅外层" size="default" />
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
                                    <el-radio value="field" border>按字段值</el-radio>
                                </el-radio-group>
                            </div>

                            <el-divider style="margin: 12px 0" />

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

                    <!-- 存档设置（与通用设置同级，位于去除转义之后） -->
                    <el-collapse-item name="archive">
                        <template #title>
                            <div class="settings-collapse-title">
                                <el-icon class="column-title-icon">
                                    <Edit />
                                </el-icon>
                                <span>存档设置</span>
                            </div>
                        </template>
                        <div class="settings-collapse-content">
                            <div class="settings-item">
                                <div class="settings-item-header">
                                    <span class="settings-label">存档名称</span>
                                </div>
                                <el-switch v-model="customArchiveName" active-text="自定义名称" inactive-text="自动编号" size="default" />
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

        <!-- 字段排序对话框 -->
        <el-dialog v-model="fieldSortDialogVisible" title="按字段值排序" width="600px" :close-on-click-modal="false">
            <div class="form-item">
                <div class="form-item-row">
                    <div class="form-value-quote--compact" style="width: 100%">
                        <span class="form-compact-line"
                            >排序方向：<span class="form-value-text">{{ sortOrder === 'asc' ? '正序（升序）' : '倒序（降序）' }}</span></span
                        >
                    </div>
                </div>
            </div>

            <div class="form-item">
                <label class="form-label">排序范围</label>
                <el-autocomplete
                    v-model="sortRootPath"
                    :fetch-suggestions="queryRootPaths"
                    placeholder="留空对整个数据排序，或输入路径如：[*].items"
                    clearable
                    @select="handleRootPathSelect"
                    @input="handleRootPathInput"
                    @keydown="handleRootPathKeydown"
                >
                    <template #default="{ item }">
                        <div class="autocomplete-item">
                            <span class="path-text">{{ item.value }}</span>
                            <span v-if="item.type" class="path-type">{{ getTypeLabel(item.type) }}</span>
                        </div>
                    </template>
                </el-autocomplete>
                <div class="form-hint">指定要排序的数据范围，留空表示对整个数据排序</div>
            </div>

            <div class="form-item">
                <label class="form-label"> 排序字段 </label>
                <el-autocomplete
                    v-model="sortFieldName"
                    :fetch-suggestions="queryFieldPathsDisabled"
                    placeholder="输入字段名，如：score 或 user.name"
                    clearable
                    @select="handleFieldPathSelect"
                    @input="handleFieldPathInput"
                    @keydown="handleFieldPathKeydown"
                >
                    <template #default="{ item }">
                        <div class="autocomplete-item">
                            <span class="path-text">{{ item.value }}</span>
                            <span v-if="item.type" class="path-type">{{ getTypeLabel(item.type) }}</span>
                        </div>
                    </template>
                </el-autocomplete>
                <div class="form-hint">选择用于排序的字段名，支持点号分隔的嵌套字段，如 user.profile.age</div>
            </div>

            <template #footer>
                <el-button @click="fieldSortDialogVisible = false">取消</el-button>
                <el-button type="warning" @click="showFieldSortDemo">演示示例</el-button>
                <el-button type="primary" @click="executeFieldSort"> 开始排序 </el-button>
            </template>
        </el-dialog>

        <!-- 演示模式遮罩层 -->
        <div v-if="isDemoMode" class="demo-overlay" @click="endDemoMode">
            <div class="demo-content">
                <!-- 教学弹窗 -->
                <div
                    v-if="demoGuideVisible && currentDemoStepData"
                    class="demo-guide-popup"
                    :style="{
                        top: popupTop + 'px',
                        left: popupLeft + 'px',
                        position: 'fixed',
                    }"
                    @click.stop
                >
                    <div class="demo-guide-header" @mousedown.stop.prevent="startDrag">
                        <h3>{{ currentDemoStepData.title }}</h3>
                        <button class="demo-close-btn" @click="endDemoMode">×</button>
                    </div>
                    <div class="demo-guide-content">
                        <p>{{ currentDemoStepData.content }}</p>
                        <div v-if="isDemoMode" class="demo-current-settings">
                            <strong>当前设置：</strong>
                            <span style="margin-left: 8px"
                                >排序范围：<code>{{ sortRootPath || '(留空)' }}</code></span
                            >
                            <span style="margin-left: 12px"
                                >排序字段：<code>{{ sortFieldName || '(未设置)' }}</code></span
                            >
                        </div>
                    </div>
                    <div class="demo-guide-footer">
                        <el-button
                            v-for="(btn, index) in currentDemoStepData.buttons"
                            :key="index"
                            :type="btn.action === endDemoMode ? 'primary' : 'default'"
                            @click="btn.action()"
                        >
                            {{ btn.text }}
                        </el-button>
                    </div>
                    <!-- 步骤指示器 -->
                    <div class="demo-step-indicator">
                        <span v-for="i in demoStepsCount" :key="i" :class="['step-dot', { active: i === currentDemoStep + 1 }]"></span>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, onUnmounted, nextTick } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import type { UploadFile } from 'element-plus';
import * as monaco from 'monaco-editor';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
import { Loading, ArrowLeft, ArrowRight, ArrowDown, CopyDocument, Download, Upload, Delete, Setting, WarningFilled, Document, Sort, Edit, Refresh } from '@element-plus/icons-vue';
import FetchJsonDialog from './FetchJsonDialog.vue';
import ShareDialog from './ShareDialog.vue';
import DataMaskingDialog from './DataMaskingDialog.vue';
import ArchiveNameDialog from './ArchiveNameDialog.vue';
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
        archive: true,
        fullscreen: true,
    },
    // 去除转义设置
    recursiveUnescape: true, // 是否递归去除转义，默认开启
    // 字符串换行设置（反转逻辑：false=换行，true=不换行，默认不换行）
    wordWrap: true,
    // 字体大小设置
    fontSize: 14,
    // 缩进指南设置
    showIndentGuide: true,
    // 默认进入页面时是否全屏
    startInFullscreen: false,
    // 同步滚动设置
    syncScrollEnabled: false,
    // 格式化设置
    indentSize: 2,
    encodingMode: 0,
    arrayNewLine: true,
    // 排序设置
    sortMethod: 'dictionary' as 'dictionary' | 'length' | 'field',
    sortOrder: 'asc' as 'asc' | 'desc',
    // 存档设置
    customArchiveName: false,
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
                    ...(parsed.buttonVisibility || {}),
                },
            };
        }
    } catch (error) {}

    return defaultSettings;
};

// 保存设置
let isInitializing = true; // 标记是否正在初始化，避免初始化时触发保存
const saveSettings = () => {
    if (typeof window === 'undefined' || isInitializing) return;

    try {
        const settingsToSave = {
            buttonVisibility: buttonVisibility.value,
            recursiveUnescape: recursiveUnescape.value,
            wordWrap: wordWrap.value,
            fontSize: fontSize.value,
            showIndentGuide: showIndentGuide.value,
            startInFullscreen: startInFullscreen.value,
            syncScrollEnabled: syncScrollEnabled.value,
            indentSize: indentSize.value,
            encodingMode: encodingMode.value,
            arrayNewLine: arrayNewLine.value,
            sortMethod: sortMethod.value,
            sortOrder: sortOrder.value,
            customArchiveName: customArchiveName.value,
        };
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settingsToSave));
    } catch (error) {}
};

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 文件大小限制：5MB
const MAX_LINES = 100000; // 最大行数限制
const savedSettings = loadSettings(); // 从 localStorage 加载设置
const indentSize = ref(savedSettings.indentSize); // 缩进大小
const maxLevel = ref(0); // 最大层级
const selectedLevel = ref(0); // 当前选中的层级
const recursiveUnescape = ref(savedSettings.recursiveUnescape ?? true); // 递归去除转义设置
const wordWrap = ref(savedSettings.wordWrap); // 字符串换行设置
const fontSize = ref(savedSettings.fontSize || 14); // 字体大小设置
const showIndentGuide = ref(savedSettings.showIndentGuide); // 添加缩进指南状态
const arrayNewLine = ref(savedSettings.arrayNewLine); // 添加数组换行控制开关
const startInFullscreen = ref(savedSettings.startInFullscreen ?? false); // 控制是否默认全屏
const isFullscreen = ref(startInFullscreen.value); // 全屏状态控制，初始化遵循设置
const isResizing = ref(false); // 添加是否正在调整宽度控制
const leftPanelWidth = ref(50); // 添加面板宽度控制（实时值，用于布局）
const stableLeftPanelWidth = ref(50); // 稳定宽度值，用于计算按钮显示状态（防抖更新）
const encodingMode = ref(savedSettings.encodingMode); // 添加编码处理模式：0-保持原样，1-转中文，2-转Unicode
const outputType = ref<'json' | 'yaml' | 'toml' | 'xml' | 'go'>('json'); // 添加当前输出类型的状态
const fetchJsonDialogVisible = ref(false); // 获取JSON数据对话框相关状态
const shareDialogVisible = ref(false); // 分享对话框相关状态
const dataMaskingDialogVisible = ref(false); // 数据脱敏对话框相关状态
const archiveNameDialogVisible = ref(false); // 是否显示“保存存档”对话框
const archiveNameDialogTitle = ref('保存存档'); // 对话框标题文本（默认显示 “保存存档”）
const archiveNameDialogInputValue = ref(''); // 对话框输入的当前值（存档名称）
const archiveNameDialogPlaceholder = ref('例如：测试数据1'); // 对话框输入框的占位符文本示例
const archiveNameDialogExcludeId = ref<string>(''); // 编辑时排除的存档ID（用于避免与自身重复）
const archiveNameDialogCallback = ref<((name: string) => void) | null>(null); // 确认时调用的回调函数，接收最终的存档名称；若为 null 则表示未设置
const sortMethod = ref<'dictionary' | 'length' | 'field'>(savedSettings.sortMethod); // 排序方法
const sortOrder = ref<'asc' | 'desc'>(savedSettings.sortOrder); // 排序方向
const customArchiveName = ref<boolean>(savedSettings.customArchiveName ?? false); // 是否自定义存档名称
const buttonVisibility = ref(savedSettings.buttonVisibility); // 菜单栏按钮显示控制状态

// ==================== JSON 存档管理 ====================
interface JsonArchive {
    id: string;
    name: string;
    size: number;
    content: string;
}

const ARCHIVE_STORAGE_KEY = 'json-tool-archives';
// 存档总大小限制：10MB（逻辑限制，实际上限由浏览器决定）
const MAX_ARCHIVE_TOTAL_SIZE = 10 * 1024 * 1024;
// 存档数量上限
const MAX_ARCHIVE_COUNT = 20;

const archives = ref<JsonArchive[]>([]);
const draggingArchiveId = ref<string | null>(null);
const dragOverArchiveId = ref<string | null>(null);
const dragEnabledArchiveId = ref<string | null>(null);
const dropIndicatorIndex = ref<number | null>(null);
let archiveLongPressTimer: number | null = null;
const archiveListRef = ref<HTMLElement | null>(null);

const loadArchives = () => {
    if (typeof window === 'undefined') return;
    try {
        const raw = sessionStorage.getItem(ARCHIVE_STORAGE_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
            archives.value = parsed;
        }
    } catch {
        // 忽略解析错误，视为无存档
        archives.value = [];
    }
};

const saveArchives = () => {
    if (typeof window === 'undefined') return;
    try {
        sessionStorage.setItem(ARCHIVE_STORAGE_KEY, JSON.stringify(archives.value));
    } catch (error) {
        showMessageError('存档保存失败：浏览器存储空间可能已满');
    }
};

// 设置对话框相关状态
const settingsDialogVisible = ref(false);
const settingsCollapseActiveNames = ref<string | number>('settings'); // 手风琴展开项，默认展开"设置"

// 字段排序对话框相关状态
const fieldSortDialogVisible = ref(false);
const sortRootPath = ref<string>('');
const sortFieldName = ref<string>('');

// 字段排序演示相关状态
const isDemoMode = ref(false);
const demoGuideVisible = ref(false);
const currentDemoStepData = ref<any>(null);
const demoData = ref([
    {
        id: 1,
        name: 'Dylan Mullins',
        education: [
            {
                university: 'MIT',
                graduationYear: 2003,
            },
            {
                university: 'Harvard University',
                graduationYear: 1983,
            },
        ],
    },
    {
        id: 2,
        name: 'Logan Boyle',
        education: [
            {
                university: 'Yale University',
                graduationYear: 2000,
            },
            {
                university: 'University of Pennsylvania',
                graduationYear: 2020,
            },
        ],
    },
    {
        id: 3,
        name: 'Emma Davis',
        education: [
            {
                university: 'Stanford University',
                graduationYear: 2010,
            },
            {
                university: 'Columbia University',
                graduationYear: 2015,
            },
        ],
    },
]);
const demoResults = ref<any>({});
const currentDemoStep = ref(0);
const demoStepsCount = ref(0);
// 保存演示开始前的输入编辑器内容，演示结束时恢复
const savedInputContent = ref<string | null>(null);

// 演示用 map 数据（用于展示对 map 的排序）
const demoMapData = ref({
    B: {
        id: 102,
        key: 'task-B',
        value: { score: 100 },
    },
    A: {
        id: 101,
        key: 'task-A',
        value: { score: 70 },
    },
    C: {
        id: 103,
        key: 'task-C',
        value: { score: 80 },
    },
    E: {
        id: 105,
        key: 'task-E',
        value: { score: 60 },
    },
    D: {
        id: 104,
        key: 'task-D',
        value: { score: null },
    },
});

// 拖拽相关状态
const popupLeft = ref(0);
const popupTop = ref(0);
const isDragging = ref(false);
const dragOffsetX = ref(0);
const dragOffsetY = ref(0);
const DEMO_POPUP_WIDTH = 640;

const startDrag = (event: MouseEvent) => {
    isDragging.value = true;
    dragOffsetX.value = event.clientX - popupLeft.value;
    dragOffsetY.value = event.clientY - popupTop.value;
    // prevent text selection
    document.body.style.userSelect = 'none';
};

const onMouseMove = (event: MouseEvent) => {
    if (!isDragging.value) return;
    popupLeft.value = event.clientX - dragOffsetX.value;
    popupTop.value = event.clientY - dragOffsetY.value;
    // clamp to viewport
    const maxLeft = window.innerWidth - DEMO_POPUP_WIDTH - 16;
    const maxTop = window.innerHeight - 120;
    if (popupLeft.value < 8) popupLeft.value = 8;
    if (popupTop.value < 8) popupTop.value = 8;
    if (popupLeft.value > maxLeft) popupLeft.value = maxLeft;
    if (popupTop.value > maxTop) popupTop.value = maxTop;
};

const endDrag = () => {
    if (isDragging.value) {
        isDragging.value = false;
        document.body.style.userSelect = '';
    }
};

onMounted(() => {
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', endDrag);
});

onBeforeUnmount(() => {
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', endDrag);
});

// 字段路径建议类型
interface PathSuggestion {
    value: string;
    type?: string;
}

const editorsInitialized = ref(false); // 在script setup部分添加
const inputEditorContainer = ref<HTMLElement | null>(null); // 输入编辑器容器
const outputEditorContainer = ref<HTMLElement | null>(null); // 输出编辑器容器
const editorContainerWidth = ref(0); // 编辑器容器宽度，用于计算按钮显示状态
const toolBarRef = ref<HTMLElement | null>(null); // 工具栏容器引用
const canScrollLeft = ref(false); // 是否可以向左滚动
const canScrollRight = ref(false); // 是否可以向右滚动
const syncScrollEnabled = ref(savedSettings.syncScrollEnabled ?? false); // 是否启用输入和预览区域的同步滚动
let inputEditor: monaco.editor.IStandaloneCodeEditor | null = null; // 输入编辑器实例
let outputEditor: monaco.editor.IStandaloneCodeEditor | null = null; // 输出编辑器实例
let inputEditorResizeObserver: ResizeObserver | null = null; // 输入编辑器容器大小监听器

// 预先计算的折叠信息：Map<行号, {type: 'object' | 'array', count: number}>
// 在格式化时一次性计算，避免实时计算的高成本
const precomputedFoldingInfo = new Map<number, { type: 'object' | 'array'; count: number }>();
// 预先计算的折叠区域范围（用于在展示时进行同步补偿计算）：Map<startLine, { endLine, type }>
const precomputedFoldingRanges = new Map<number, { endLine: number; type: 'object' | 'array' }>();

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

// 预先计算所有可折叠区域的信息（异步版本）。使用分批处理，避免阻塞UI，优先计算可见区域
// @param formattedText 格式化后的JSON文本
// @param priorityLines 优先计算的行号范围（可选，用于优先计算可见区域）
const precomputeFoldingInfo = async (formattedText: string, priorityLines?: { start: number; end: number }): Promise<void> => {
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
        startLine: number; // 起始行号（1-based）
        type: 'object' | 'array'; // 类型
        depth: number; // 括号深度
        charIndex: number; // 在当前行中的字符索引
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
                        charIndex: currentCharIndex,
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
                                type: lastItem.type,
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

    // 将所有待处理区域的范围先记录下来，便于展示时进行同步补偿（可见区域即时计算）
    pendingItems.forEach(item => {
        precomputedFoldingRanges.set(item.startLine, { endLine: item.endLine, type: item.type });
    });

    // 创建异步计算任务
    const task = {
        pendingItems: [...priorityItems, ...normalItems], // 优先项在前
        lines,
        isRunning: true,
        cancelToken: false,
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
            const count = calculateFoldingCount(task.lines, item.startLine - 1, item.endLine - 1, item.type);

            // 记录范围（再次确保）
            precomputedFoldingRanges.set(item.startLine, { endLine: item.endLine, type: item.type });

            // 只存储非空的折叠区域
            if (count > 0) {
                precomputedFoldingInfo.set(item.startLine, {
                    type: item.type,
                    count: count,
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
const calculateFoldingCount = (lines: string[], startLineIndex: number, endLineIndex: number, type: 'object' | 'array'): number => {
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

// 折叠进度显示
const foldProgress = ref(0); // 0..1
const foldProgressVisible = ref(false);
const foldTotalLines = ref(0);
const foldPercent = computed(() => Math.round(foldProgress.value * 100));
const foldCurrentLine = computed(() => Math.min(foldTotalLines.value, Math.round(foldProgress.value * foldTotalLines.value)));
// 平滑耗时估算（EMA）
let avgMsPerRange = 2; // 初始每个 range 估算耗时（毫秒）
let avgMsPerLine = 0.02; // 初始每行估算耗时（毫秒）
const EMA_ALPHA = 0.12;

// 初始化存档数据（该组件为 .client，确保只在客户端执行）
loadArchives();
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

// 更新编辑器行号宽度
const updateLineNumberWidth = (editor: monaco.editor.IStandaloneCodeEditor | null) => {
    if (!editor) return;

    const lineCount = editor.getModel()?.getLineCount() || 0;
    // 当行数小于999，固定为2位宽度；否则按实际行数计算
    const digitCount = lineCount < 99 ? 2 : String(lineCount).length;
    const minChars = digitCount + 1;

    editor.updateOptions({
        lineNumbers: 'on',
        lineNumbersMinChars: minChars,
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
        height: containerHeight,
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
    cursorBlinking: 'blink' as const, // 确保光标闪烁
    cursorStyle: 'line' as const, // 细线光标
    renderLineHighlightOnlyWhenFocus: false, // 保持行高亮，辅助定位

    // 外观配置
    renderLineHighlight: 'line' as const, // 仅高亮内容行，不高亮行号区域
    minimap: { enabled: false }, // 禁用右侧的代码概览图
    lineNumbers: 'on' as const, // 启用行号
    roundedSelection: true, // 启用圆角选择
    renderIndentGuides: showIndentGuide.value, // 根据设置显示缩进指南线
    lineNumbersMinChars: 1, // 设置行号最小字符数为1
    renderWhitespace: 'none' as const, // 禁用空白字符显示

    // 右键菜单配置
    contextmenu: true, // 启用右键菜单

    // 滚动配置
    scrollBeyondLastLine: false, // 禁止滚动超过最后一行
    scrollbar: {
        // 滚动条配置
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
    ...(enableLargeFileFolding
        ? {
              // 大文件折叠优化配置
              // 注意：这些选项可能不在 TypeScript 类型定义中，但实际运行时有效
              foldingMaximumRegions: 100000, // 增加折叠区域上限（默认约5000），支持超大JSON文件
              largeFileOptimizations: false, // 禁用大文件优化，强制启用完整语法分析和折叠计算
          }
        : {}),

    // 编辑器配置
    links: false, // 禁用链接检测功能
    tabSize: size, //  使用传入的大小作为Tab宽度
    indentSize: size, // 使用传入的大小作为缩进宽度
    wordWrap: wordWrap.value ? ('off' as const) : ('on' as const), // 字符串换行设置（反转逻辑：false=换行，true=不换行）
    fontSize: fontSize.value, // 字体大小设置
    lineHeight: 16, // 设置行高为16px，与光标高度保持一致
    autoClosingBrackets: 'languageDefined' as const, // 根据语言自动闭合括号
    autoClosingQuotes: 'languageDefined' as const, // 根据语言自动闭合引号
    formatOnPaste: false, // 启用粘贴时自动格式化
    maxUndoRedoEntries: 100, // 历史记录可撤销/重做的最大步数为100
    useTabStops: false, // 禁用TabStop
    maxTokenizationLineLength: 100000,
    guides: {
        indentation: showIndentGuide.value, // 根据设置显示缩进引导线
        bracketPairs: showIndentGuide.value, // 根据设置显示括号配对引导线
        highlightActiveIndentation: showIndentGuide.value, // 根据设置显示当前缩进高亮
    },

    // 添加可访问性支持配置
    quickSuggestions: true,
    find: {
        // 配置查找组件
        addExtraSpaceOnTop: false, // 查找框顶部不添加额外空间
        autoFindInSelection: 'multiline' as const, // 不自动在选择区域内查找
        seedSearchStringFromSelection: 'always' as const, // 不使用选择内容作为查找初始内容
        globalFindClipboard: false, // 禁用全局查找剪贴板
    },

    // Unicode 高亮配置 - 禁用中文等非基本ASCII字符的黄色方框高亮
    unicodeHighlight: {},
});

// 更新字符串换行
const updateWordWrap = () => {
    // 反转逻辑：wordWrap=false 表示换行（'on'），wordWrap=true 表示不换行（'off'）
    const options = {
        wordWrap: wordWrap.value ? ('off' as const) : ('on' as const),
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
        fontSize: fontSize.value,
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
            bracketPairs: showIndentGuide.value,
        },
    };

    inputEditor?.updateOptions(options);
    outputEditor?.updateOptions(options);
};

// 更新输出编辑器配置（包括模型选项，确保缩进指南线正确显示）
const updateOutputEditorConfig = (language: string = 'json', enableLargeFileFolding: boolean = false, customIndentSize?: number) => {
    if (!outputEditor) return;

    const size = customIndentSize ?? indentSize.value;
    const model = outputEditor.getModel();
    if (model) {
        monaco.editor.setModelLanguage(model, language);
        // 更新模型选项，确保缩进指南线正确显示
        model.updateOptions({
            tabSize: size,
            indentSize: size,
            insertSpaces: true,
        });
    }

    // 更新编辑器配置
    outputEditor.updateOptions(getEditorOptions(size, true, language, enableLargeFileFolding));

    updateLineNumberWidth(outputEditor);
    updateEditorHeight(outputEditor);
};

// 设置折叠信息显示（在折叠区域显示 n keys 或 n items）
const setupFoldingInfoDisplay = (editor: monaco.editor.IStandaloneCodeEditor) => {
    if (!editor) return;

    const model = editor.getModel();
    if (!model) return;

    // 从预先计算的数据中获取折叠区域的信息
    const getFoldingInfo = (startLine: number): { type: 'object' | 'array'; count: number } | null => {
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

                // 检查这一行是否是折叠起始行（优先使用预计算的范围，因为范围已在第一阶段记录）
                // 注意：折叠起始行可能是 "key": { 或 "key": [ 的形式，不一定以 { 或 [ 开头
                // originalLineNumber 已在上面声明
                if (precomputedFoldingRanges.has(lineNumber)) {
                    // 当前行就是折叠起始行（范围信息已存在）
                    currentFoldedLines.add(lineNumber);
                } else {
                    // 如果不是，向上查找最近的折叠起始行（最多向上查找20行），使用范围信息进行匹配
                    let found = false;
                    for (let i = lineNumber - 1; i >= Math.max(1, lineNumber - 20); i--) {
                        if (precomputedFoldingRanges.has(i)) {
                            // 找到了折叠起始行范围
                            lineNumber = i;
                            found = true;
                            break;
                        }
                    }

                    if (!found) {
                        // 如果向上近邻查找不到，尝试在所有预计算范围中查找一个包裹 originalLineNumber 的范围（更稳健）
                        let enclosingStart: number | null = null;
                        for (const [start, range] of precomputedFoldingRanges.entries()) {
                            if (range.endLine >= originalLineNumber! && start <= originalLineNumber!) {
                                if (enclosingStart === null || start > enclosingStart) {
                                    enclosingStart = start;
                                }
                            }
                        }
                        if (enclosingStart !== null) {
                            lineNumber = enclosingStart;
                            found = true;
                        }
                    }

                    if (!found) {
                        // 如果仍然找不到，跳过这个折叠元素
                        return;
                    }

                    currentFoldedLines.add(lineNumber);
                }

                // 检查是否已经添加过信息，并且元素仍然存在
                const existingInfo = infoElements.get(lineNumber);
                if (existingInfo) {
                    // 检查元素是否还在DOM中，并且对应的foldedElement是否还是同一个
                    if (document.body.contains(existingInfo.element) && existingInfo.foldedElement === foldedElement) {
                        // 元素已存在且有效，跳过
                        return;
                    } else {
                        // 元素已失效，移除它
                        existingInfo.element.remove();
                        infoElements.delete(lineNumber);
                    }
                }

                // 获取折叠信息（直接从预先计算的数据中获取）
                let info = getFoldingInfo(lineNumber);
                // 如果没有预计算结果或计数为0，尝试使用已记录的范围进行同步计算（只在可见区域执行）
                if (!info || info.count === 0) {
                    const range = precomputedFoldingRanges.get(lineNumber) || null;
                    if (range) {
                        try {
                            const model = editor.getModel();
                            if (model && !model.isDisposed()) {
                                const lines = model.getValue().split('\n');
                                const count = calculateFoldingCount(lines, lineNumber - 1, range.endLine - 1, range.type);
                                if (count > 0) {
                                    precomputedFoldingInfo.set(lineNumber, { type: range.type, count });
                                    info = getFoldingInfo(lineNumber);
                                }
                            }
                        } catch (e) {
                            // ignore and fallthrough to skip display
                        }
                    }
                    if (!info || info.count === 0) {
                        return;
                    }
                }

                // 构建显示文本
                const displayText = info.type === 'object' ? `${info.count} keys` : `${info.count} items`;

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
    const observer = new MutationObserver(mutations => {
        // 检查是否有折叠相关的变化
        const hasFoldingChange = mutations.some(mutation => {
            if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                const target = mutation.target as Element;
                return target.classList.contains('inline-folded') || target.querySelector('.inline-folded') !== null;
            }
            if (mutation.type === 'childList') {
                return (
                    Array.from(mutation.addedNodes).some(
                        node => node instanceof Element && (node.classList.contains('inline-folded') || node.querySelector('.inline-folded') !== null)
                    ) ||
                    Array.from(mutation.removedNodes).some(
                        node => node instanceof Element && (node.classList.contains('inline-folded') || node.querySelector('.inline-folded') !== null)
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
            attributeFilter: ['class'],
        });
    }

    // 监听鼠标点击事件（用户点击折叠按钮时）
    editorDom?.addEventListener(
        'click',
        e => {
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
        },
        true
    );

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

// 查找字符串的完整范围（包括引号）
const findStringRange = (model: monaco.editor.ITextModel, position: monaco.Position): monaco.Range | null => {
    const lineNumber = position.lineNumber;
    const column = position.column;
    const lineContent = model.getLineContent(lineNumber);

    // Monaco 的 column 是从 1 开始的，转换为数组索引（从 0 开始）
    const currentIndex = column - 1;

    // 辅助函数：检查指定位置是否是转义的引号
    const isEscapedQuote = (index: number, content: string): boolean => {
        if (index <= 0) return false;
        let backslashCount = 0;
        let i = index - 1;
        // 向前查找连续的反斜杠
        while (i >= 0 && content[i] === '\\') {
            backslashCount++;
            i--;
        }
        // 如果反斜杠数量是奇数，说明引号被转义了
        return backslashCount % 2 === 1;
    };

    // 辅助函数：从指定位置向前查找最近的未转义的引号
    const findStartQuote = (startIndex: number, content: string): number | null => {
        for (let i = startIndex; i >= 0; i--) {
            if (content[i] === '"' && !isEscapedQuote(i, content)) {
                return i;
            }
        }
        return null;
    };

    // 辅助函数：从指定位置向后查找最近的未转义的引号
    const findEndQuote = (startIndex: number, content: string): number | null => {
        for (let i = startIndex; i < content.length; i++) {
            if (content[i] === '"' && !isEscapedQuote(i, content)) {
                return i;
            }
        }
        return null;
    };

    // 策略1: 如果当前位置是引号，判断它是开始还是结束
    if (currentIndex < lineContent.length && lineContent[currentIndex] === '"' && !isEscapedQuote(currentIndex, lineContent)) {
        // 尝试向后查找结束引号（假设这是开始引号）
        const endQuote = findEndQuote(currentIndex + 1, lineContent);
        if (endQuote !== null) {
            // 验证：检查这个范围是否包含当前位置
            if (currentIndex <= endQuote) {
                return new monaco.Range(lineNumber, currentIndex + 1, lineNumber, endQuote + 2);
            }
        }

        // 尝试向前查找开始引号（假设这是结束引号）
        const startQuote = findStartQuote(currentIndex - 1, lineContent);
        if (startQuote !== null) {
            // 验证：检查这个范围是否包含当前位置
            if (startQuote <= currentIndex) {
                return new monaco.Range(lineNumber, startQuote + 1, lineNumber, currentIndex + 2);
            }
        }
    }

    // 策略2: 当前位置不是引号，或者引号匹配失败，从当前位置向前查找字符串开始
    // 首先找到最近的未转义引号（可能是开始或结束）
    let nearestQuote = findStartQuote(currentIndex, lineContent);

    if (nearestQuote === null) {
        return null;
    }

    // 尝试将这个引号作为开始引号，向后查找结束引号
    const endQuote = findEndQuote(nearestQuote + 1, lineContent);
    if (endQuote !== null) {
        // 验证：当前位置是否在这个字符串范围内（包括引号）
        if (currentIndex >= nearestQuote && currentIndex <= endQuote + 1) {
            return new monaco.Range(lineNumber, nearestQuote + 1, lineNumber, endQuote + 2);
        }
    }

    // 策略3: 如果上面的策略失败，尝试将最近的引号作为结束引号，向前查找开始引号
    const startQuote = findStartQuote(nearestQuote - 1, lineContent);
    if (startQuote !== null) {
        // 验证：当前位置是否在这个字符串范围内（包括引号）
        if (currentIndex >= startQuote && currentIndex <= nearestQuote + 1) {
            return new monaco.Range(lineNumber, startQuote + 1, lineNumber, nearestQuote + 2);
        }
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
    const isFullSelection = hasSelection && startLine === 1 && startColumn === 1 && endLine === totalLines && endColumn === model.getLineMaxColumn(totalLines);

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
                    true, // 区分大小写（完全匹配）
                    null, // 不使用单词分隔符
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
    editor.onDidChangeCursorSelection(e => {
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
        const isDoubleClick =
            currentTime - lastClickTime < 300 &&
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
                // 查找完整的字符串范围（包括引号）
                const stringRange = findStringRange(model, clickPosition);

                if (stringRange) {
                    // 创建不包含引号的范围（排除两端的引号）
                    const stringValueRange = new monaco.Range(
                        stringRange.startLineNumber,
                        stringRange.startColumn + 1, // 跳过开始引号
                        stringRange.endLineNumber,
                        stringRange.endColumn - 1 // 跳过结束引号
                    );

                    // 获取字符串值文本（不包含引号，保持转义字符的字面形式）
                    const stringValueText = model.getValueInRange(stringValueRange);

                    // 设置选中范围为字符串值（不包含引号）
                    editor.setSelection(stringValueRange);

                    // 复制字符串值到剪贴板（不包含引号，保持原始转义字符形式）
                    copyToClipboard(stringValueText);
                    showMessageSuccess('字符串已复制到剪贴板');
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

// 确保某些按钮始终为true（格式化、收缩、全屏）
watch(
    () => buttonVisibility.value.format,
    newVal => {
        if (!newVal) {
            buttonVisibility.value.format = true;
        }
    },
    { immediate: true }
);

watch(
    () => buttonVisibility.value.collapse,
    newVal => {
        if (!newVal) {
            buttonVisibility.value.collapse = true;
        }
    },
    { immediate: true }
);

watch(
    () => buttonVisibility.value.fullscreen,
    newVal => {
        if (!newVal) {
            buttonVisibility.value.fullscreen = true;
        }
    },
    { immediate: true }
);

// ==================== 自动保存设置到 localStorage ====================
// 监听所有设置的变化并自动保存
watch(
    () => [
        buttonVisibility.value,
        recursiveUnescape.value,
        wordWrap.value,
        fontSize.value,
        showIndentGuide.value,
        startInFullscreen.value,
        syncScrollEnabled.value,
        indentSize.value,
        encodingMode.value,
        arrayNewLine.value,
        sortMethod.value,
        sortOrder.value,
        customArchiveName.value,
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

// 初始化Monaco环境
const initializeMonacoEnvironment = () => {
    if (typeof window === 'undefined') return;
    window.MonacoEnvironment = {
        getWorker(_, label): Worker {
            if (label === 'json') {
                return new jsonWorker();
            }
            return new editorWorker();
        },
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
const configureInputEditor: () => void = () => {
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
                showMessageError(checkResult.error || '内容不符合要求');
                maxLevel.value = 0;
                selectedLevel.value = 0;
                // 如果层级超过99层，自动清空输入区域内容
                if (checkResult.error && checkResult.error.includes('层级超过99层')) {
                    // 延迟清空，避免在内容变化监听中直接修改编辑器内容导致的问题
                    setTimeout(() => {
                        if (inputEditor) {
                            const model = inputEditor.getModel();
                            if (model) {
                                const fullRange = model.getFullModelRange();
                                if (!fullRange.isEmpty()) {
                                    inputEditor.executeEdits('clear-input-depth-limit', [
                                        {
                                            range: fullRange,
                                            text: '',
                                        },
                                    ]);
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
const configureOutputEditor: () => void = () => {
    if (!outputEditor) return;

    outputEditor.getModel()?.updateOptions({ tabSize: indentSize.value, insertSpaces: true });
    // 设置双击选中整个字符串并复制功能
    setupDoubleClickSelectString(outputEditor);
    // 设置选择变化监听
    setupSelectionListener(outputEditor, outputEditorStatus);
    // 设置折叠信息显示
    setupFoldingInfoDisplay(outputEditor);
};

// 使用Monaco Editor原生API的简单同步滚动
const syncScrollByNativeAPI = (sourceEditor: monaco.editor.IStandaloneCodeEditor, targetEditor: monaco.editor.IStandaloneCodeEditor) => {
    if (!sourceEditor || !targetEditor) return;

    try {
        // 获取源编辑器的滚动信息
        const sourceScrollTop = sourceEditor.getScrollTop();
        const sourceScrollLeft = sourceEditor.getScrollLeft();
        const sourceScrollHeight = sourceEditor.getScrollHeight();
        const targetScrollHeight = targetEditor.getScrollHeight();

        // 计算比例并同步滚动位置
        if (sourceScrollHeight > 0 && targetScrollHeight > 0) {
            const scrollRatio = sourceScrollTop / sourceScrollHeight;
            const targetScrollTop = Math.min(scrollRatio * targetScrollHeight, targetScrollHeight - (targetEditor.getDomNode()?.clientHeight || 0));

            // 使用Monaco Editor的原生API直接设置滚动位置
            targetEditor.setScrollTop(targetScrollTop);
            targetEditor.setScrollLeft(sourceScrollLeft);
        }
    } catch (error) {
        console.warn('同步滚动失败:', error);
    }
};

// 设置同步滚动功能
const setupSyncScroll = () => {
    if (!inputEditor || !outputEditor) return;

    let isSyncing = false; // 防止递归同步
    let scrollThrottleTimer: ReturnType<typeof setTimeout> | null = null; // 节流定时器

    // 输入编辑器滚动监听
    inputEditor.onDidScrollChange(() => {
        if (!syncScrollEnabled.value || isSyncing) return;
        if (!outputEditor) return;

        // 使用节流控制同步频率，避免快速滚动时的性能问题
        if (scrollThrottleTimer) return;

        isSyncing = true;

        // 使用Monaco Editor原生API进行简单同步
        if (inputEditor && outputEditor) {
            syncScrollByNativeAPI(inputEditor, outputEditor);
        }

        // 设置节流定时器（4ms ≈ 240fps）
        scrollThrottleTimer = setTimeout(() => {
            scrollThrottleTimer = null;
        }, 4);

        // 延迟重置同步标志，避免递归
        setTimeout(() => {
            isSyncing = false;
        }, 10);
    });

    // 输出编辑器滚动监听
    outputEditor.onDidScrollChange(() => {
        if (!syncScrollEnabled.value || isSyncing) return;
        if (!inputEditor) return;

        // 使用节流控制同步频率
        if (scrollThrottleTimer) return;

        isSyncing = true;

        // 使用Monaco Editor原生API进行简单同步
        if (inputEditor && outputEditor) {
            syncScrollByNativeAPI(outputEditor, inputEditor);
        }

        // 设置节流定时器（4ms ≈ 240fps）
        scrollThrottleTimer = setTimeout(() => {
            scrollThrottleTimer = null;
        }, 4);

        // 延迟重置同步标志，避免递归
        setTimeout(() => {
            isSyncing = false;
        }, 10);
    });
};

// 初始化编辑器布局
const initializeEditorLayout = () => {
    updateLineNumberWidth(inputEditor);
    updateLineNumberWidth(outputEditor);
    updateEditorHeight(inputEditor);
    updateEditorHeight(outputEditor);

    // 设置同步滚动
    setupSyncScroll();

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
    const targetScroll = direction === 'left' ? currentScroll - scrollAmount : currentScroll + scrollAmount;

    toolBarRef.value.scrollTo({
        left: targetScroll,
        behavior: 'smooth',
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

    window.addEventListener('keydown', handleEscapeKey);

    // 初始化基础环境
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
                showMessageError('Monaco编辑器初始化失败: ' + error.message);
            }
        } catch (error: any) {
            showMessageError('Monaco编辑器初始化失败: ' + error.message);
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
    window.removeEventListener('keydown', handleEscapeKey);

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
            error: `内容超过行数限制（共 ${lines.length} 行，限制为 ${MAX_LINES} 行）。请使用较小的文件或使用其他工具处理超大文件。`,
        };
    }

    // 检查JSON层级（仅在JSON有效时检查）
    try {
        const { data: jsonData } = preprocessJSON(content);
        const level = calculateMaxLevel(jsonData);
        if (level > 99) {
            return {
                isValid: false,
                error: 'JSON层级超过99层, 拒绝处理此JSON数据',
            };
        }
    } catch (e) {
        // 解析失败，可能不是有效的JSON，不进行层级检查
    }

    return { isValid: true };
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
                                endColumn: 1,
                            });
                            outputEditor.trigger('fold', 'editor.fold', null);

                            // 清除选择
                            setTimeout(() => {
                                if (outputEditor) {
                                    outputEditor.setSelection({
                                        startLineNumber: 1,
                                        startColumn: 1,
                                        endLineNumber: 1,
                                        endColumn: 1,
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

                            showMessageSuccess(`收缩到第 ${selectedLevel.value} 层成功`);
                        } catch (e) {
                            // 发生错误时也要清除折叠状态
                            isFolding.value = false;
                            if (outputEditor) {
                                updateEditorStatus(outputEditor, outputEditorStatus, false);
                            }
                            showMessageWarning('折叠操作失败, 请尝试手动折叠');
                        }
                    }, 100);
                }
            }
            return;
        }

        // 对于其他层级，使用基于括号嵌套深度的算法
        const targetLevel = selectedLevel.value; // 目标层级（从1开始）

        let foldingRanges: Array<{ start: number; end: number }> = [];

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
                        const bracketType = char === '{' ? '{' : ('[' as '{' | '[');

                        // 如果当前深度等于目标层级，记录开始位置（这是目标层级本身）
                        if (currentDepth === targetLevel) {
                            stack.push({
                                line: lineNum,
                                depth: currentDepth,
                                bracketType: bracketType,
                            });
                        }
                    } else if (char === '}' || char === ']') {
                        const matchingBracket = char === '}' ? '{' : '[';

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
                                            end: lineNum,
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

        const filteredRanges: Array<{ start: number; end: number }> = [];
        for (let i = 0; i < foldingRanges.length; i++) {
            const current = foldingRanges[i];
            let isContained = false;

            // 检查当前范围是否被其他范围包含
            for (let j = 0; j < foldingRanges.length; j++) {
                if (i === j) continue;
                const other = foldingRanges[j];
                // 如果other完全包含current（开始更早或相同，结束更晚或相同，且至少有一个更严格）
                if (other.start <= current.start && other.end >= current.end && (other.start < current.start || other.end > current.end)) {
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
                // 如果文件行数较大，显示折叠进度条（按当前处理位置 / 总行数）
                // foldProgressVisible will be decided after preparedRanges and estimatedMs are computed

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
                    const preparePromises = foldingRanges.map(async range => {
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
                                endCol,
                            } as PreparedRange;
                        } catch (err) {
                            return null;
                        }
                    });

                    const results = await Promise.all(preparePromises);
                    preparedRanges.push(...(results.filter(r => r !== null) as PreparedRange[]));
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
                                endCol,
                            });
                        } catch (err) {
                            // 忽略预处理错误
                        }
                    }
                }

                let foldedCount = 0;
                let failedCount = 0;
                // 估算与进度控制（基于预计耗时）
                const totalRanges = preparedRanges.length;
                const totalWeightedLines = preparedRanges.reduce((s, r) => s + Math.max(0, r.end - r.start), 0);
                const estimatedMs = totalRanges * avgMsPerRange + totalWeightedLines * avgMsPerLine;
                const SHOW_PROGRESS_MS = 1500; // 1.5秒阈值
                let processedRanges = 0;
                let processedLines = 0;
                if (estimatedMs > SHOW_PROGRESS_MS) {
                    foldTotalLines.value = totalRanges;
                    foldProgress.value = 0;
                    foldProgressVisible.value = true;
                } else {
                    foldProgressVisible.value = false;
                }

                // 从后向前分批处理（避免行号变化影响）
                // 注意：折叠操作必须顺序执行，因为 Monaco Editor 的状态操作不是线程安全的
                for (let batchStart = preparedRanges.length - 1; batchStart >= 0; batchStart -= BATCH_SIZE) {
                    const batchEnd = Math.max(0, batchStart - BATCH_SIZE + 1);
                    const batchRanges = preparedRanges.slice(batchEnd, batchStart + 1).reverse(); // 反转以保持从后向前的顺序
                    // 顺序执行折叠操作（避免状态冲突）
                    // 批次计时用于更新平均耗时（EMA）
                    const batchStartTime = performance.now();
                    let batchProcessedRanges = 0;
                    let batchProcessedLines = 0;
                    for (const range of batchRanges) {
                        try {
                            // 更新进度（基于已处理的 ranges / 总 ranges）
                            if (foldProgressVisible.value && foldTotalLines.value > 0) {
                                foldProgress.value = Math.min(1, processedRanges / Math.max(1, totalRanges));
                            }
                            // 定位到目标层级的开始括号位置，确保可见
                            outputEditor.setPosition({
                                lineNumber: range.start,
                                column: range.startCol,
                            });
                            outputEditor.trigger('unfold', 'editor.unfold', null);
                            // 小延迟，确保展开完成
                            await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_FOLDS));

                            // 使用 getAction 获取折叠操作
                            const foldAction = outputEditor.getAction('editor.fold');
                            if (foldAction && foldAction.isSupported()) {
                                const t0 = performance.now();
                                await foldAction.run();
                                const t1 = performance.now();
                                const elapsed = t1 - t0;
                                // 更新统计
                                foldedCount++;
                                processedRanges++;
                                const rangeLines = Math.max(0, range.end - range.start);
                                processedLines += rangeLines;
                                batchProcessedRanges++;
                                batchProcessedLines += rangeLines;
                            } else {
                                const t0 = performance.now();
                                outputEditor.trigger('fold', 'editor.fold', null);
                                const t1 = performance.now();
                                const elapsed = t1 - t0;
                                foldedCount++;
                                processedRanges++;
                                const rangeLines = Math.max(0, range.end - range.start);
                                processedLines += rangeLines;
                                batchProcessedRanges++;
                                batchProcessedLines += rangeLines;
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
                    // 批次结束，更新 EMA 估时
                    const batchElapsed = performance.now() - batchStartTime;
                    if (batchProcessedRanges > 0) {
                        const perRangeMs = batchElapsed / batchProcessedRanges;
                        avgMsPerRange = EMA_ALPHA * perRangeMs + (1 - EMA_ALPHA) * avgMsPerRange;
                    }
                    if (batchProcessedLines > 0) {
                        const perLineMs = batchElapsed / batchProcessedLines;
                        avgMsPerLine = EMA_ALPHA * perLineMs + (1 - EMA_ALPHA) * avgMsPerLine;
                    }

                    // 批次之间的延迟，让浏览器有机会渲染
                    if (batchStart > BATCH_SIZE) {
                        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
                    }
                }

                // 清除选择
                if (outputEditor) {
                    // 折叠完成后隐藏进度
                    foldProgressVisible.value = false;
                    foldProgress.value = 0;
                    outputEditor.setSelection({
                        startLineNumber: 1,
                        startColumn: 1,
                        endLineNumber: 1,
                        endColumn: 1,
                    });

                    const message =
                        failedCount > 0
                            ? `收缩到第 ${selectedLevel.value} 层完成，成功 ${foldedCount} 个元素，失败 ${failedCount} 个元素`
                            : `收缩到第 ${selectedLevel.value} 层成功，共折叠 ${foldedCount} 个元素`;
                    showMessageSuccess(message);

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
                try {
                    // 在开始批量折叠前，将视图定位到最后一行，确保滚动条和光标初始位于文档末尾
                    const model = outputEditor?.getModel();
                    if (outputEditor && model) {
                        const totalLines = model.getLineCount();
                        // 将光标移动到最后一行末尾并滚动到该行（确保可见）
                        outputEditor.setPosition({
                            lineNumber: totalLines,
                            column: model.getLineMaxColumn(totalLines),
                        });
                        // revealLine 保证滚动到指定行（使用居中显示）
                        try {
                            // @ts-ignore - 使用Monaco的revealLine API
                            outputEditor.revealLine(totalLines, 1);
                        } catch (e) {
                            // 回退：直接设置 scrollTop 到底部
                            const scrollHeight = outputEditor.getScrollHeight();
                            outputEditor.setScrollTop(Math.max(0, scrollHeight - (outputEditor.getDomNode()?.clientHeight || 0)));
                        }
                    }
                } catch (err) {
                    // 忽略定位错误，继续折叠流程
                }
                concurrentBatchFold();
            }, 150);
        } else {
            showMessageInfo(`未找到可收缩的第 ${selectedLevel.value} 层内容`);
        }
    } catch (e: any) {
        // 发生错误时清除折叠状态
        isFolding.value = false;
        if (outputEditor) {
            updateEditorStatus(outputEditor, outputEditorStatus, false);
        }
        showMessageWarning('折叠操作失败: ' + (e.message || '未知错误'));
    }
};

// 处理转换
const handleConvert = (command: string) => {
    try {
        const value = inputEditor?.getValue() || '';
        if (!value.trim()) {
            showMessageError('请先输入内容');
            return;
        }

        // 处理 Cookie 转换
        if (command === 'cookie') {
            const jsonStr = cookieToJSON(value);
            outputEditor?.setValue(jsonStr);
            updateLineNumberWidth(outputEditor);
            updateEditorHeight(outputEditor);
            showMessageSuccess('Cookie 转换成功');
            return;
        }

        // 处理其他格式转换
        let parsed;
        try {
            const result = preprocessJSON(value);
            parsed = result.data;
        } catch (error) {
            showMessageError('请输入有效的 JSON 数据');
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
            // Go 结构体使用 4 空格缩进，保持指南线间距一致
            const goIndentSize = command === 'go' ? 4 : undefined;
            const enableLargeFile = editorLanguage === 'json';
            updateOutputEditorConfig(editorLanguage, enableLargeFile, goIndentSize);

            showMessageSuccess(`转换为 ${command.toUpperCase()} 语言结构体成功`);
        }
    } catch (error: any) {
        showMessageError('转换失败: ' + error.message);
    }
};

// JSON Plus Formatter 类
class JsonPlusFormatter {
    private encodingMode: number;
    private indentSize: number;
    private arrayNewLine: boolean;
    private escapePlaceholderCounter: number;

    constructor(encodingMode: number, indentSize: number, arrayNewLine: boolean) {
        this.encodingMode = encodingMode;
        this.indentSize = indentSize;
        this.arrayNewLine = arrayNewLine;
        this.escapePlaceholderCounter = 0;
    }

    // UTF-8 解码字节数组
    private decodeUTF8(bytes: number[]): string {
        let result = '';
        let i = 0;

        while (i < bytes.length) {
            const byte = bytes[i];

            if (byte < 128) {
                // 1字节 UTF-8
                result += String.fromCharCode(byte);
                i++;
            } else if (byte >= 192 && byte < 224 && i + 1 < bytes.length) {
                // 2字节 UTF-8
                const code = ((byte & 31) << 6) | (bytes[i + 1] & 63);
                result += String.fromCharCode(code);
                i += 2;
            } else if (byte >= 224 && byte < 240 && i + 2 < bytes.length) {
                // 3字节 UTF-8
                const code = ((byte & 15) << 12) | ((bytes[i + 1] & 63) << 6) | (bytes[i + 2] & 63);
                result += String.fromCharCode(code);
                i += 3;
            } else if (byte >= 240 && byte < 248 && i + 3 < bytes.length) {
                // 4字节 UTF-8
                const code = ((byte & 7) << 18) | ((bytes[i + 1] & 63) << 12) | ((bytes[i + 2] & 63) << 6) | (bytes[i + 3] & 63);
                if (code >= 0x10000) {
                    // 转换为代理对
                    const high = Math.floor((code - 0x10000) / 0x400) + 0xD800;
                    const low = ((code - 0x10000) % 0x400) + 0xDC00;
                    result += String.fromCharCode(high, low);
                } else {
                    result += String.fromCharCode(code);
                }
                i += 4;
            } else {
                // 非法 UTF-8 字节，替换为 �
                result += '\uFFFD';
                i++;
            }
        }

        return result;
    }

    // 对 decodeUTF8 返回的字符串进行适配，确保放入 JSON 字符串字面中是合法的（控制字符需要转义）
    private escapeDecodedString(str: string): string {
        let out = '';
        for (let j = 0; j < str.length; j++) {
            const ch = str[j];
            const code = str.charCodeAt(j);
            if (ch === '\\') {
                out += '\\\\';
            } else if (ch === '"') {
                out += '\\"';
            } else if (ch === '\n') {
                out += '\\n';
            } else if (ch === '\r') {
                out += '\\r';
            } else if (ch === '\t') {
                out += '\\t';
            } else if (ch === '\b') {
                out += '\\b';
            } else if (ch === '\f') {
                out += '\\f';
            } else if (code < 32 || code === 127) {
                out += '\\u' + code.toString(16).padStart(4, '0');
            } else {
                out += ch;
            }
        }
        return out;
    }

    // 处理 \uXXXX 转义，返回 { consumed, append }
    private handleUnicodeEscape(input: string, startIndex: number, quote: string, escapeMap: Map<string, string>): { consumed: number; append: string } {
        // startIndex 指向反斜杠位置 '\\'
        const i = startIndex;
        if (i + 5 < input.length && /^[0-9a-fA-F]{4}$/.test(input.substr(i + 2, 4))) {
            const unicodeSeq = input.substr(i, 6); // \uXXXX
            if (this.encodingMode === 0) {
                const placeholder = this.createEscapePlaceholder();
                escapeMap.set(placeholder, unicodeSeq);
                return { consumed: 6, append: placeholder };
            } else {
                // 其他模式：保留 \uXXXX 交给 JSON5/后续处理
                escapeMap.set(unicodeSeq, unicodeSeq);
                return { consumed: 6, append: unicodeSeq };
            }
        } else {
            // 非法 \u 转义，收集最多4个十六进制字符作为非法序列
            let invalidUSeq = '\\u';
            let idx = i + 2;
            let count = 0;
            while (idx < input.length && input[idx] !== quote && count < 4) {
                if (/^[0-9a-fA-F]$/.test(input[idx])) {
                    invalidUSeq += input[idx];
                    count++;
                    idx++;
                } else {
                    break;
                }
            }
            const placeholder = this.createEscapePlaceholder();
            escapeMap.set(placeholder, invalidUSeq);
            return { consumed: 2 + count, append: placeholder };
        }
    }

    // 处理 \xHH 转义，支持收集字节用于后续 UTF-8 解码
    private handleHexEscape(input: string, startIndex: number, quote: string, escapeMap: Map<string, string>, pendingBytes: number[]): { consumed: number; append: string } {
        const i = startIndex;
        if (i + 3 < input.length && /^[0-9a-fA-F]{2}$/.test(input.substr(i + 2, 2))) {
            const hexSeq = input.substr(i, 4); // \xHH
            const byte = parseInt(input.substr(i + 2, 2), 16);
            if (this.encodingMode === 1) {
                // 收集字节用于 UTF-8 解码，暂不 append
                pendingBytes.push(byte);
                return { consumed: 4, append: '' };
            } else if (this.encodingMode === 0) {
                // raw 模式：占位以保持原始 \xHH
                const placeholder = this.createEscapePlaceholder();
                escapeMap.set(placeholder, hexSeq);
                return { consumed: 4, append: placeholder };
            } else {
                // 其他模式：保留原样 \xHH（交给后续处理）
                escapeMap.set(hexSeq, hexSeq);
                return { consumed: 4, append: hexSeq };
            }
        } else {
            // 非法 \x 转义，收集连续十六进制字符（最多2个）
            let invalidXSeq = '\\x';
            let idx = i + 2;
            while (idx < input.length && input[idx] !== quote && /^[0-9a-fA-F]$/.test(input[idx])) {
                invalidXSeq += input[idx];
                idx++;
            }
            const placeholder = this.createEscapePlaceholder();
            escapeMap.set(placeholder, invalidXSeq);
            return { consumed: idx - i, append: placeholder };
        }
    }

    // 解析 JSON5 字符串，支持非法转义和特殊值
    parseJson5(input: string): { data: any; escapeMap: Map<string, string> } {
        const escapeMap = new Map<string, string>();

        // 预处理字符串，处理特殊值、转义等
        let processedInput = this.preprocessSpecialValues(input);
        processedInput = this.preprocessString(processedInput, escapeMap);

        try {
            // 使用 JSON5 解析
            const data = JSON5.parse(processedInput);
            return { data, escapeMap };
        } catch (error) {
            throw new Error('JSON5 解析失败: ' + (error as Error).message);
        }
    }

    // 预处理特殊值，将JavaScript特殊值转换为JSON兼容格式
    private preprocessSpecialValues(input: string): string {
        let result = input;

        // 替换简单特殊值
        result = result.replace(/\bundefined\b/g, 'null');

        // 处理Symbol - 替换 Symbol(...) 为 null
        result = result.replace(/Symbol\s*\([^)]*\)/g, 'null');

        // 处理函数定义 - 使用更复杂的逻辑处理嵌套函数
        result = this.replaceFunctionsWithNull(result);

        return result;
    }

    // 替换函数定义为null，支持嵌套和大括号匹配
    private replaceFunctionsWithNull(input: string): string {
        let result = '';
        let i = 0;

        while (i < input.length) {
            const funcIndex = input.indexOf('function', i);
            if (funcIndex === -1) {
                result += input.substring(i);
                break;
            }

            // 添加function之前的部分
            result += input.substring(i, funcIndex);

            // 找到函数的结束位置
            let parenCount = 0;
            let braceCount = 0;
            let inString = false;
            let stringChar = '';
            let j = funcIndex;

            // 跳过function关键字
            while (j < input.length && !/\s/.test(input[j])) j++;
            while (j < input.length && /\s/.test(input[j])) j++;

            // 查找参数列表
            if (input[j] === '(') {
                parenCount = 1;
                j++;
                while (j < input.length && parenCount > 0) {
                    const char = input[j];
                    if (!inString && (char === '"' || char === "'")) {
                        inString = true;
                        stringChar = char;
                    } else if (inString && char === stringChar && input[j - 1] !== '\\') {
                        inString = false;
                        stringChar = '';
                    } else if (!inString) {
                        if (char === '(') parenCount++;
                        else if (char === ')') parenCount--;
                    }
                    j++;
                }
            }

            // 跳过空白字符
            while (j < input.length && /\s/.test(input[j])) j++;

            // 查找函数体
            if (input[j] === '{') {
                braceCount = 1;
                j++;
                while (j < input.length && braceCount > 0) {
                    const char = input[j];
                    if (!inString && (char === '"' || char === "'")) {
                        inString = true;
                        stringChar = char;
                    } else if (inString && char === stringChar && input[j - 1] !== '\\') {
                        inString = false;
                        stringChar = '';
                    } else if (!inString) {
                        if (char === '{') braceCount++;
                        else if (char === '}') braceCount--;
                    }
                    j++;
                }
            }

            // 替换为null
            result += 'null';
            i = j;
        }

        return result;
    }

    // 生成转义占位符
    private createEscapePlaceholder(): string {
        return '\uE000' + String.fromCharCode(0xF000 + this.escapePlaceholderCounter++); // 私人使用区字符
    }

    // 预处理字符串，处理非法转义和注释
    private preprocessString(input: string, escapeMap: Map<string, string>): string {
        let result = '';
        let i = 0;

        while (i < input.length) {
            const char = input[i];
            const nextChar = input[i + 1] || '';

            // 处理注释
            if (char === '/' && nextChar === '/') {
                // 单行注释 //
                i += 2;
                while (i < input.length && input[i] !== '\n') {
                    i++;
                }
                        continue;
            } else if (char === '/' && nextChar === '*') {
                // 多行注释 /* */
                i += 2;
                while (i < input.length - 1) {
                    if (input[i] === '*' && input[i + 1] === '/') {
                        i += 2;
                                break;
                        }
                    i++;
                }
                        continue;
            } else if (char === '#') {
                // # 单行注释（扩展支持）
                i++;
                while (i < input.length && input[i] !== '\n') {
                    i++;
                }
                        continue;
                    }

            if (char === '"' || char === "'") {
                // 处理字符串
                const quote = char;
                result += quote;
                i++;

                let stringContent = '';
                const pendingBytes: number[] = []; // 用于收集连续的\xHH字节

                while (i < input.length && input[i] !== quote) {
                    if (input[i] === '\\') {
                        // 处理转义
                        if (i + 1 < input.length) {
                            const nextChar = input[i + 1];

                            // 对于非标准转义
                            if (!['"', '\\', '/', 'b', 'f', 'n', 'r', 't'].includes(nextChar)) {
                                // 特殊处理 \u转义（包括非法格式）
                                if (nextChar === 'u') {
                                    const res = this.handleUnicodeEscape(input, i, quote, escapeMap);
                                    stringContent += res.append;
                                    i += res.consumed;
                                    continue;
                                }
                                // 特殊处理 \xHH（包括非法格式）
                                if (nextChar === 'x') {
                                    const res = this.handleHexEscape(input, i, quote, escapeMap, pendingBytes);
                                    stringContent += res.append;
                                    i += res.consumed;
                                    continue;
                                } else {
                                    // 处理累积的字节（如果有）
                                    if (pendingBytes.length > 0) {
                                        stringContent += this.escapeDecodedString(this.decodeUTF8(pendingBytes));
                                        pendingBytes.length = 0; // 清空
                                    }

                                    // 其他非法转义
                                    const escapeSeq = '\\' + nextChar;
                                    const placeholder = this.createEscapePlaceholder();
                                    escapeMap.set(placeholder, escapeSeq);
                                    stringContent += placeholder;
                                    i += 2; // 跳过转义序列
                                }
                            } else {
                                // 处理累积的字节（如果有）
                                if (pendingBytes.length > 0) {
                                    stringContent += this.escapeDecodedString(this.decodeUTF8(pendingBytes));
                                    pendingBytes.length = 0; // 清空
                                }

                                // 标准转义：统一使用占位符保存原始转义序列，
                                // 这样在 JSON5.parse 后能通过 escapeMap 恢复为原始的转义表示（例如 "\/"）,
                                // 避免在后续不同编码模式下丢失反斜杠。
                                const escapeSeq = '\\' + nextChar;
                                const placeholder = this.createEscapePlaceholder();
                                escapeMap.set(placeholder, escapeSeq);
                                stringContent += placeholder;
                                i += 2; // 跳过转义序列
                            }
                        } else {
                            // 处理累积的字节（如果有）
                                if (pendingBytes.length > 0) {
                                    stringContent += this.escapeDecodedString(this.decodeUTF8(pendingBytes));
                                    pendingBytes.length = 0; // 清空
                                }

                            stringContent += '\\';
                            i++;
                        }
                    } else {
                        // 处理累积的字节（如果有）
                        if (pendingBytes.length > 0) {
                            stringContent += this.escapeDecodedString(this.decodeUTF8(pendingBytes));
                            pendingBytes.length = 0; // 清空
                        }

                        stringContent += input[i];
                        i++;
                    }
                }

                // 处理字符串结束时的累积字节
                if (pendingBytes.length > 0) {
                    stringContent += this.escapeDecodedString(this.decodeUTF8(pendingBytes));
                }

                result += stringContent;

                if (i < input.length) {
                    result += quote;
                }
            } else {
                result += char;
            }
            i++;
        }

        return result;
    }

    // 格式化输出
    format(data: any, escapeMap: Map<string, string>): string {
        return this.customStringify(data, escapeMap);
    }

    // 自定义字符串化函数
    private customStringify(data: any, escapeMap: Map<string, string>, indent: number = 0): string {
        const indentStr = ' '.repeat(indent * this.indentSize);

        if (data === null) {
            return 'null';
        }

        if (data === undefined) {
            return 'null'; // JSON标准中undefined转为null
        }

        if (typeof data === 'boolean') {
            return data ? 'true' : 'false';
        }

        if (typeof data === 'number') {
            if (isNaN(data) || !isFinite(data)) {
                return 'null';
            }
            return data.toString();
        }

        if (typeof data === 'string') {
            return this.formatString(data, escapeMap);
        }

        if (typeof data === 'function') {
            return 'null'; // JSON标准中function转为null
        }

        if (typeof data === 'symbol') {
            return 'null'; // JSON标准中symbol转为null
        }

        if (Array.isArray(data)) {
            return this.formatArray(data, escapeMap, indent);
        }

        if (typeof data === 'object') {
            return this.formatObject(data, escapeMap, indent);
        }

        return 'null'; // 其他未知类型转为null
    }

    // 格式化字符串
    private formatString(str: string, escapeMap: Map<string, string>): string {
        // 首先检查是否有占位符需要替换
        let processedStr = str;
        for (const [placeholder, originalEscape] of escapeMap.entries()) {
            if (processedStr.includes(placeholder)) {
                processedStr = processedStr.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), originalEscape);
            }
        }

        let result = '"';

        for (let i = 0; i < processedStr.length; i++) {
            const char = processedStr[i];
            const code = processedStr.charCodeAt(i);

            // 控制字符必须保持转义
            if (char === '\n') {
                result += '\\n';
            } else if (char === '\t') {
                result += '\\t';
            } else if (char === '\r') {
                result += '\\r';
            } else if (char === '\b') {
                result += '\\b';
            } else if (char === '\f') {
                result += '\\f';
            } else if (char === '"') {
                result += '\\"';
            } else if (char === '\\') {
                // 智能处理转义：对于合法的单字符转义（如 \n \t \r \b \f \" \\ \/）保持单斜杠；
                // 对于 \uXXXX 和 \xHH 以及未知/非法转义则输出双反斜杠以保证原样显示（或变为合法的 JSON 字符串）
                const nextChar = processedStr[i + 1] || '';
                const nextCode = processedStr.charCodeAt(i + 1) || 0;
                // 如果反斜杠后是实际的控制字符（例如真实换行），不要把它作为换行插入字符串中
                // 而是把它当作字面量的转义序列保留为 \\uXXXX 格式，避免字符串换行
                if (nextCode < 32 || nextCode === 127) {
                    const hex = nextCode.toString(16).padStart(4, '0');
                    result += '\\\\u' + hex;
                    i = i + 1; // 跳过实际的控制字符
                    continue;
                }

                if (nextChar === 'u' && i + 5 < processedStr.length && /^[0-9a-fA-F]{4}$/.test(processedStr.substr(i + 2, 4))) {
                    // \uXXXX - 合法的 Unicode 转义，保持单反斜杠形式（合法 JSON）
                    result += '\\u' + processedStr.substr(i + 2, 4);
                    i = i + 5; // 跳到最后一个已消费字符
                    continue;
                } else if (nextChar === 'x' && i + 2 < processedStr.length && /^[0-9a-fA-F]{2}$/.test(processedStr.substr(i + 2, 2))) {
                    // \xHH - 非标准 JSON 转义，需要变为 \\xHH（保留字面）
                    result += '\\\\x' + processedStr.substr(i + 2, 2);
                    i = i + 3; // 跳到最后一个已消费字符
                    continue;
                } else if (['n', 'r', 't', 'b', 'f', '"', '\\', '/'].includes(nextChar)) {
                    // 合法的单字符转义，保持单斜杠形式
                    result += '\\' + nextChar;
                    i = i + 1; // 跳到最后一个已消费字符
                    continue;
                } else {
                    // 其他未知或非法转义：用双反斜杠加上后续字符（如果有）
                    if (nextChar) {
                        result += '\\\\' + nextChar;
                        i = i + 1;
                        continue;
                    } else {
                        // 仅单个反斜杠，保留它
                        result += '\\\\';
                        continue;
                    }
                }
            } else if (code < 32 || code === 127) {
                // 其他控制字符
                result += '\\u' + code.toString(16).padStart(4, '0');
            } else {
                // 根据编码模式处理字符
                switch (this.encodingMode) {
                    case 0: // 保持原样
                        result += this.formatRaw(char, code, escapeMap);
                        break;
                    case 1: // 转中文
                        result += this.formatChinese(char, code, escapeMap);
                        break;
                    case 2: // 转Unicode
                        result += this.formatUnicode(char, code, escapeMap);
                        break;
                    default:
                        result += char;
                        break;
                }
            }
        }

        result += '"';
        return result;
    }

    // 保持原样模式编码
    private formatRaw(char: string, code: number, escapeMap: Map<string, string>): string {
        // 检查是否有原始转义需要保持为双反斜杠形式
        for (const [processed, original] of escapeMap.entries()) {
            if (processed.includes(char)) {
                // 非标准转义转为双反斜杠
                if (original.startsWith('\\x') || !['"', '\\', '/', 'b', 'f', 'n', 'r', 't', 'u'].includes(original[1])) {
                    return '\\' + original;
                }
            }
        }
        // 普通字符保持原样
        return char;
    }

    // 转中文模式编码
    private formatChinese(char: string, code: number, escapeMap: Map<string, string>): string {
        // 对于\xHH序列，JSON5解析器已经将其转换为实际字符
        // 我们保持这些字符的原样显示
        return char;
    }

    // 转Unicode模式编码
    private formatUnicode(char: string, code: number, escapeMap: Map<string, string>): string {
        if (code > 127 || code < 32 || code === 127) {
            if (code <= 0xFFFF) {
                return '\\u' + code.toString(16).padStart(4, '0');
            } else {
                // 代理对处理
                const high = Math.floor((code - 0x10000) / 0x400) + 0xD800;
                const low = ((code - 0x10000) % 0x400) + 0xDC00;
                return '\\u' + high.toString(16).padStart(4, '0') + '\\u' + low.toString(16).padStart(4, '0');
            }
        }
        return char;
    }


    // 格式化数组
    private formatArray(arr: any[], escapeMap: Map<string, string>, indent: number): string {
        if (arr.length === 0) {
            return '[]';
        }

        // 检查是否为简单类型数组
        const isSimpleArray = arr.every(item =>
            typeof item === 'string' ||
            typeof item === 'number' ||
            typeof item === 'boolean' ||
            item === null
        );

        if (isSimpleArray && !this.arrayNewLine) {
            // 紧凑模式
            const items = arr.map(item => this.customStringify(item, escapeMap, 0));
            return '[' + items.join(', ') + ']';
            } else {
            // 换行模式（复杂数组或强制换行）
            const indentStr = ' '.repeat((indent + 1) * this.indentSize);
            const nextIndentStr = ' '.repeat(indent * this.indentSize);
            const items = arr.map(item => indentStr + this.customStringify(item, escapeMap, indent + 1));
            return '[\n' + items.join(',\n') + '\n' + nextIndentStr + ']';
        }
    }

    // 格式化对象
    private formatObject(obj: any, escapeMap: Map<string, string>, indent: number): string {
        const keys = Object.keys(obj);
        if (keys.length === 0) {
            return '{}';
        }

        const indentStr = ' '.repeat((indent + 1) * this.indentSize);
        const nextIndentStr = ' '.repeat(indent * this.indentSize);

        const items = keys.map(key => {
            const keyStr = JSON.stringify(key); // JSON标准要求key必须用双引号包围
            const valueStr = this.customStringify(obj[key], escapeMap, indent + 1);
            return indentStr + keyStr + ': ' + valueStr;
        });

        return '{\n' + items.join(',\n') + '\n' + nextIndentStr + '}';
    }
}

// 兼容性函数 - 用于其他地方的JSON解析
const preprocessJSON = (input: string) => {
    const formatter = new JsonPlusFormatter(encodingMode.value, indentSize.value, arrayNewLine.value);
    const result = formatter.parseJson5(input);
    return {
        ...result,
        originalString: input // 保持向后兼容
    };
};

// 重新格式化JSON字符串的缩进，保持内容不变（不解析转义序列）
const reformatJsonIndentation = (jsonString: string, newIndentSize: number): string => {
    // 目标：仅调整缩进显示，不解析或改变字符串中的转义序列
    const lines = jsonString.split('\n');

    // 收集所有有缩进的行的缩进长度（包括只有单个括号的行）
    const indentLengths: number[] = [];
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const m = line.match(/^(\s*)/);
        const len = m ? m[1].length : 0;
        if (len > 0) indentLengths.push(len);
    }

    // 如果没有可检测的缩进，直接返回原文
    if (indentLengths.length === 0) return jsonString;

    // 使用最小缩进作为当前缩进单位
    const currentIndentSize = Math.min(...indentLengths);
    if (currentIndentSize === newIndentSize) return jsonString;

    // 对每一行按实际缩进长度重新计算层级并应用新缩进
    const resultLines: string[] = [];
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) {
            resultLines.push('');
            continue;
        }

        // 计算该行原始缩进长度
        const m = line.match(/^(\s*)/);
        const originalIndentLen = m ? m[1].length : 0;

        // 计算层级（向下取整以避免增加缩进）
        const level = originalIndentLen > 0 ? Math.floor(originalIndentLen / currentIndentSize) : 0;

        const newIndent = ' '.repeat(level * newIndentSize);
        resultLines.push(newIndent + trimmed);
    }

    return resultLines.join('\n');
};

// 兼容性函数 - 用于其他地方的JSON格式化
const customStringify = (data: any, replacer: any, indentSize: number, originalString?: string, ...args: any[]) => {
    const formatter = new JsonPlusFormatter(encodingMode.value, indentSize, arrayNewLine.value);
    const escapeMap = new Map<string, string>();
    return formatter.format(data, escapeMap);
};

// 格式化 JSON
const formatJSON = () => {
    try {
        outputType.value = 'json';
        const value = inputEditor?.getValue() || '';

        if (!value.trim()) {
            showMessageError('请先输入 JSON 数据');
            return;
        }

        // 创建格式化器
        const formatter = new JsonPlusFormatter(
            encodingMode.value,
            indentSize.value,
            arrayNewLine.value
        );

        // 解析 JSON5
        const { data, escapeMap } = formatter.parseJson5(value);

        // 格式化输出
        const formatted = formatter.format(data, escapeMap);

        // 异步计算所有折叠区域的信息（不阻塞，立即返回）
        // 这样可以避免实时计算的高成本，特别是对于大数据量（7-10万行）
        precomputeFoldingInfo(formatted).catch(error => {
            // 静默处理错误，不影响主流程
        });

        outputEditor?.setValue(formatted);

        // 更新编辑器配置（包括模型选项，确保缩进指南线正确显示）
        // 对于JSON输出，总是启用大文件折叠优化
        updateOutputEditorConfig('json', true);

        showMessageSuccess('格式化成功');
    } catch (error: any) {
        showMessageError('格式化失败: ' + error.message);
    }
};

// 压缩 JSON
const compressJSON = () => {
    try {
        outputType.value = 'json';
        const value = inputEditor?.getValue() || '';
        if (!value.trim()) {
            showMessageError('请先输入 JSON 数据');
            return;
        }

        // 预处理 JSON 字符串
        let parsed;
        try {
            const result = preprocessJSON(value);
            parsed = result.data;
        } catch (error) {
            showMessageError('请输入有效的 JSON 数据');
            return;
        }

        // 使用标准压缩方法
        const compressed = JSON.stringify(parsed);
        outputEditor?.setValue(compressed);

        // 更新编辑器配置（包括模型选项，确保缩进指南线正确显示）
        // 对于JSON输出，总是启用大文件折叠优化
        updateOutputEditorConfig('json', true);

        showMessageSuccess('压缩成功');
    } catch (error: any) {
        showMessageError('压缩失败: ' + error.message);
    }
};

// 转义 JSON
const escapeJSON = () => {
    try {
        outputType.value = 'json';
        const value = inputEditor?.getValue() || '';
        if (!value.trim()) {
            showMessageError('请先输入 JSON 数据');
            return;
        }

        // 预处理 JSON 字符串
        let parsed;
        try {
            const result = preprocessJSON(value);
            parsed = result.data;
        } catch (error) {
            showMessageError('请输入有效的 JSON 数据');
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

        showMessageSuccess('转义成功');
    } catch (error: any) {
        showMessageError('转义失败: ' + error.message);
    }
};

// 去除JSON转义字符
const unescapeJSON = (recursive: boolean = true) => {
    try {
        const value = inputEditor?.getValue() || '';
        if (!value.trim()) {
            showMessageError('请先输入内容');
            return;
        }
        outputType.value = 'json';

        // 获取原始输入
        const originalInput = value;
        let parsedInput = null;
        let shouldPreserveEscapes = false;
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

        // 简化解析流程：优先直接解析 -> 宽松解析 -> 迭代去除外层转义后再尝试解析
        const tryParseJSON = (str: string) => {
            try {
                return { ok: true, value: JSON.parse(str) } as const;
            } catch {
                return { ok: false } as const;
            }
        };

        const iterativeParse = (str: string, maxIter = 10) => {
            let cand = str;
            for (let i = 0; i < maxIter; i++) {
                const res = tryParseJSON(cand);
                if (res.ok) return res.value;
                // 逐步还原常见的外层转义（\\ -> \, \" -> "）
                const unescaped = cand.replace(/\\\\/g, '\\').replace(/\\"/g, '"');
                if (unescaped === cand) break;
                cand = unescaped;
            }
            // 如果最后仍是被引号包裹的字符串，尝试解析内部一次
            if (typeof cand === 'string' && cand.startsWith('"') && cand.endsWith('"')) {
                try {
                    const inner = JSON.parse(cand);
                    const res2 = tryParseJSON(inner);
                    if (res2.ok) return res2.value;
                } catch {
                    // ignore
                }
            }
            return null;
        };

        // 1. 先尝试直接解析
        let parseAttempted = false;
        const direct = tryParseJSON(value);
        if (direct.ok) {
            parsedInput = direct.value;
            parseAttempted = true;
        } else {
            // 2. 宽松解析器
            try {
                const result = preprocessJSON(value);
                parsedInput = result.data;
                parseAttempted = true;
            } catch {
                // 3. 迭代去除外层转义再尝试解析
                parsedInput = iterativeParse(value);
            }
        }

        // 如果成功解析为对象或数组，进行递归处理
        if (parsedInput !== null && typeof parsedInput === 'object' && recursive) {
            try {
                // 检查对象深度，防止过深的递归
                const objectDepth = getObjectDepth(parsedInput);
                // 如果对象深度在可接受范围内，进行递归解析；深度过大时跳过以防止栈溢出或性能问题
                if (objectDepth <= 50) {
                    // 全局 Unicode 映射收集器（在处理开始前创建，用于收集所有需要保留的 Unicode 转义序列）
                    const globalUnicodeMap = new Map<string, string>();

                    // 恢复 Unicode 占位符（从 map 中恢复 \uXXXX）
                    const restoreUnicodePlaceholders = (val: any, map: Map<string, string>): any => {
                        if (typeof val === 'string') {
                            let restored = val;
                            map.forEach((unicode, char) => {
                                const hex = unicode.replace(/\\u/, '');
                                const placeholder = `__UNI_HEX_${hex}__`;
                                restored = restored.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&'), 'g'), char);
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

                    // 递归清理所有的临时 __unicodeMap__ 属性
                    const cleanUnicodeMaps = (obj: any, depth: number = 0): void => {
                        if (depth > 100) return;
                        if (obj && typeof obj === 'object') {
                            if ((obj as any).__unicodeMap__) {
                                delete (obj as any).__unicodeMap__;
                            }
                            if (Array.isArray(obj)) {
                                obj.forEach(item => cleanUnicodeMaps(item, depth + 1));
                            } else {
                                Object.values(obj).forEach(val => cleanUnicodeMaps(val, depth + 1));
                            }
                        }
                    };

                    // 自定义 stringify：保留 Unicode 转义序列
                    const stringifyWithUnicode = (obj: any, indent: string = '', unicodeMap: Map<string, string> = globalUnicodeMap): string => {
                        if (obj === null) return 'null';
                        if (typeof obj === 'boolean') return obj.toString();
                        if (typeof obj === 'number') return obj.toString();

                        if (typeof obj === 'string') {
                            let escaped = '';
                            for (let i = 0; i < obj.length; i++) {
                                const char = obj[i];
                                const code = char.charCodeAt(0);
                                if (unicodeMap.has(char)) {
                                    escaped += unicodeMap.get(char)!;
                                } else if (code < 32 || code === 34 || code === 92) {
                                    switch (char) {
                                        case '"':
                                            escaped += '\\"';
                                            break;
                                        case '\\':
                                            escaped += '\\\\';
                                            break;
                                        case '\b':
                                            escaped += '\\b';
                                            break;
                                        case '\f':
                                            escaped += '\\f';
                                            break;
                                        case '\n':
                                            escaped += '\\n';
                                            break;
                                        case '\r':
                                            escaped += '\\r';
                                            break;
                                        case '\t':
                                            escaped += '\\t';
                                            break;
                                        default:
                                            escaped += '\\u' + ('0000' + code.toString(16)).slice(-4);
                                    }
                                } else {
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

                    // 递归处理所有字符串字段，检测并解析转义的JSON字段
                    const processObject = (obj: any, depth: number = 0): any => {
                        // 防止递归深度过大（最大深度100）
                        if (depth > 100) {
                            return obj;
                        }

                        if (obj === null || obj === undefined) return obj;

                        // 处理对象
                        if (typeof obj === 'object' && !Array.isArray(obj)) {
                            const result: Record<string, any> = {};
                            for (const key in obj) {
                                if (Object.prototype.hasOwnProperty.call(obj, key)) {
                                    // 处理对象的每个值
                                    result[key] = processObject(obj[key], depth + 1);
                                }
                            }
                            return result;
                        }

                        // 处理数组
                        if (Array.isArray(obj)) {
                            return obj.map(item => processObject(item, depth + 1));
                        }

                        // 处理字符串 - 尝试解析可能的JSON字符串
                        if (typeof obj === 'string') {
                            // 检查字符串是否可能包含JSON结构
                            // 检测条件：
                            // 1. 包含转义字符（可能是转义的JSON）
                            // 2. 或者看起来像JSON结构（以{或[开始，可能以}或]结束）
                            const hasEscapes = obj.includes('\\"') || obj.includes('\\\\');
                            const looksLikeJson = (obj.trim().startsWith('{') || obj.trim().startsWith('[')) && (obj.trim().endsWith('}') || obj.trim().endsWith(']'));

                            if (hasEscapes || looksLikeJson) {
                                try {
                                    // 防止处理过长的字符串（可能导致性能问题或栈溢出）
                                    if (obj.length > 1000000) {
                                        // 1MB 限制
                                        return obj;
                                    }

                                    // 首先尝试直接解析字符串（如果是类似JSON的结构）
                                    let parsedValue = null;
                                    let isValidJson = false;

                                    try {
                                        // 先尝试直接解析，可能已经是有效的JSON
                                        parsedValue = JSON.parse(obj);
                                        isValidJson = true;
                                    } catch (e: any) {
                                        // 直接解析失败，可能是包含转义的JSON，需要先去除转义
                                        // 先保存 Unicode 转义序列，避免被 JSON.parse 解码
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

                                        // 检查 unescaped 中是否包含实际的控制字符
                                        const hasActualControlChars = /[\n\r\t\b\f]/.test(unescaped);
                                        if (hasActualControlChars) {
                                            unescaped = unescaped.replace(/\n/g, '\\n').replace(/\t/g, '\\t').replace(/\r/g, '\\r').replace(/\b/g, '\\b').replace(/\f/g, '\\f');
                                        }

                                        // 尝试解析去除转义后的字符串
                                        try {
                                            parsedValue = JSON.parse(unescaped);
                                            isValidJson = true;

                                            parsedValue = restoreUnicodePlaceholders(parsedValue, unicodeMap);
                                            // 将 unicodeMap 合并到全局映射中
                                            unicodeMap.forEach((unicode, char) => {
                                                globalUnicodeMap.set(char, unicode);
                                            });
                                            (parsedValue as any).__unicodeMap__ = unicodeMap;
                                        } catch (parseError) {
                                            isValidJson = false;
                                        }
                                    }

                                    if (isValidJson) {
                                        // 如果解析成功，递归处理解析后的对象
                                        if (typeof parsedValue === 'object' && parsedValue !== null) {
                                            return processObject(parsedValue, depth + 1);
                                        } else {
                                            return parsedValue;
                                        }
                                    } else {
                                        // 解析失败，保持原始字符串
                                        return obj;
                                    }
                                } catch (processError: any) {
                                    return obj;
                                }
                            }
                        }

                        // 其他类型直接返回
                        return obj;
                    };

                    // 处理整个JSON对象
                    const processedJson = processObject(parsedInput, 0);
                    // 清理临时属性
                    cleanUnicodeMaps(processedJson);

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

                    showMessageSuccess('去除转义成功');
                    return;
                }
            } catch (processError: any) {}
        } else if (parsedInput !== null && typeof parsedInput === 'object' && !recursive) {
            // 非递归模式：对顶层的字符串字段尝试一次解析（仅一层），然后格式化输出
            try {
                const tryParseTopLevelOnce = (target: any): any => {
                    if (target === null || target === undefined) return target;
                    if (Array.isArray(target)) {
                        return target.map(item => {
                            if (typeof item === 'string') {
                                const t = item.trim();
                                // 检查是否包含转义字符或看起来像JSON结构
                                if ((t.startsWith('{') && t.endsWith('}')) || (t.startsWith('[') && t.endsWith(']')) || t.includes('\\"') || t.includes('\\\\')) {
                                    // 先尝试直接解析
                                    try {
                                        return JSON.parse(item);
                                    } catch {
                                        // 如果直接解析失败，尝试去除转义后再解析
                                        try {
                                            const unescaped = item.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
                                            return JSON.parse(unescaped);
                                        } catch {
                                            // 解析失败则保留原字符串
                                            return item;
                                        }
                                    }
                                }
                            }
                            return tryParseTopLevelOnce(item);
                        });
                    }

                    if (typeof target === 'object') {
                        const result: Record<string, any> = {};
                        for (const key in target) {
                            if (!Object.prototype.hasOwnProperty.call(target, key)) continue;
                            const val = target[key];
                            if (typeof val === 'string') {
                                const t = val.trim();
                                // 检查是否包含转义字符或看起来像JSON结构
                                if ((t.startsWith('{') && t.endsWith('}')) || (t.startsWith('[') && t.endsWith(']')) || t.includes('\\"') || t.includes('\\\\')) {
                                    // 先尝试直接解析
                                    try {
                                        result[key] = JSON.parse(val);
                                        continue;
                                    } catch {
                                        // 如果直接解析失败，尝试去除转义后再解析
                                        try {
                                            const unescaped = val.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
                                            result[key] = JSON.parse(unescaped);
                                            continue;
                                        } catch {
                                            // 解析失败则保留原字符串
                                        }
                                    }
                                }
                            }
                            result[key] = tryParseTopLevelOnce(val);
                        }
                        return result;
                    }
                    return target;
                };

                const topLevelProcessed = tryParseTopLevelOnce(parsedInput);
                const formatted = JSON.stringify(topLevelProcessed, null, 2);
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

                showMessageSuccess('去除转义成功（仅外层）');
                return;
            } catch (formatError) {
                // 格式化失败，继续尝试其他方式
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

                                showMessageSuccess('去除双重转义成功');
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

                            showMessageSuccess('去除转义成功');
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
                    result = originalInput.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
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

                showMessageSuccess('去除转义成功');
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

                showMessageWarning('未检测到标准JSON转义, 内容保持不变');
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

            showMessageSuccess('去除转义成功');
        }

        return;
    } catch (error: any) {
        showMessageError('去除转义失败: ' + error.message);
    }
};

// 压缩并转义功能
const compressAndEscapeJSON = () => {
    try {
        const value = inputEditor?.getValue() || '';
        if (!value.trim()) {
            showMessageError('请先输入 JSON 数据');
            return;
        }
        outputType.value = 'json';

        // 预处理 JSON 字符串
        let parsed;
        try {
            const result = preprocessJSON(value);
            parsed = result.data;
        } catch (error) {
            showMessageError('请输入有效的 JSON 数据');
            return;
        }

        // 使用标准压缩方法（不格式化）
        const compressed = JSON.stringify(parsed);

        // 有效的JSON转义序列
        const validEscapes = ['"', '\\', '/', 'b', 'f', 'n', 'r', 't', 'u'];
        let escaped = '';
        let i = 0;
        let inString = false; // 跟踪是否在字符串值内部

        while (i < compressed.length) {
            const char = compressed[i];
            const nextChar = compressed[i + 1] || '';
            const nextNextChar = compressed[i + 2] || '';

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
                    } else if (nextChar === 'u' && /^[0-9a-fA-F]{4}$/i.test(compressed.substring(i + 2, i + 6))) {
                        // Unicode转义序列 \uXXXX，在字符串值内部需要转义反斜杠
                        escaped += '\\\\u' + compressed.substring(i + 2, i + 6);
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
                    if (nextChar === 'u' && /^[0-9a-fA-F]{4}$/i.test(compressed.substring(i + 2, i + 6))) {
                        // Unicode转义序列 \uXXXX，保持原样
                        escaped += compressed.substring(i, i + 6);
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

        showMessageSuccess('压缩并转义成功');
    } catch (error: any) {
        showMessageError('压缩并转义失败: ' + error.message);
    }
};

// 处理层级收缩
const handleLevelAction = () => {
    try {
        if (!outputEditor) {
            showMessageError('编辑器未初始化');
            return;
        }

        const value = inputEditor?.getValue() || '';
        if (!value.trim()) {
            showMessageError('请先输入 JSON 数据');
            selectedLevel.value = 1;
            return;
        }

        // 解析JSON
        let parsedData;
        try {
            const result = preprocessJSON(value);
            parsedData = result.data; // 提取实际的JSON数据
        } catch (error) {
            showMessageError('请输入有效的 JSON 数据');
            return;
        }

        // 格式化JSON以确保结构正确
        const formatted = JSON.stringify(parsedData, null, 2);

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

        // 根据行数动态调整延迟时间
        const currentLineCount = outputEditor?.getModel()?.getLineCount() || 0;
        let delayTime: number;
        let unfoldDelay: number;

        if (currentLineCount > 80000) {
            delayTime = 1000; // 1秒
            unfoldDelay = 600; // 0.6秒
        } else if (currentLineCount > 50000) {
            delayTime = 600; // 0.6秒
            unfoldDelay = 400; // 0.4秒
        } else {
            delayTime = 200; // 0.2秒
            unfoldDelay = 100; // 0.1秒
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
                                // 扩展可见区域范围（上下各扩展200行，提高滚动体验）
                                const model = outputEditor.getModel();
                                if (model) {
                                    const totalLines = model.getLineCount();
                                    const priorityStart = Math.max(1, minLine - 200);
                                    const priorityEnd = Math.min(totalLines, maxLine + 200);

                                    // 重新触发计算，优先计算可见区域
                                    precomputeFoldingInfo(formatted, { start: priorityStart, end: priorityEnd }).catch(() => {});
                                }
                            }
                        }
                    } catch (e) {}
                }, 300); // 等待折叠动画完成
            }, unfoldDelay);
        }, delayTime);
    } catch (error: any) {
        showMessageError('操作失败: ' + error.message);
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
        showMessageWarning('编辑器未初始化，请稍候再试');
        return;
    }

    const jsonData = inputEditor.getValue();
    if (!jsonData || !jsonData.trim()) {
        showMessageError('请先输入 JSON 数据');
        return;
    }

    // 验证JSON格式
    try {
        JSON.parse(jsonData);
    } catch (error) {
        showMessageError('JSON 数据格式不正确，请先格式化 JSON 数据');
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
                inputEditor.executeEdits('apply-masking', [
                    {
                        range: fullRange,
                        text: maskedJson,
                    },
                ]);
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
        showMessageError('应用脱敏结果失败: ' + (error.message || '未知错误'));
    }
};

// 获取 JSON 数据后清空预览区域
const handleFetchJsonLoaded = () => {
    if (outputEditor) {
        outputEditor.setValue('');
        updateLineNumberWidth(outputEditor);
        updateEditorHeight(outputEditor);
    }
    outputType.value = 'json';
    outputEditorStatus.value = '';
};

// 获取输入编辑器内容
const getInputEditorValue = (): string => {
    if (!inputEditor) return '';
    return inputEditor.getValue();
};

// ==================== 存档相关逻辑 ====================

// 归一化存档名称：只保留允许字符，并限制为最多 30 个字符
const normalizeArchiveName = (rawName: string): string => {
    // 允许：英文、数字、中文，以及部分常见符号 - _ + * / = . : @ #
    const allowedCharPattern = /[A-Za-z0-9\u4e00-\u9fa5\-\_\+\*\/=\.\:\@\#]/g;
    const matches = rawName.match(allowedCharPattern);
    if (!matches) return '';
    const normalized = matches.join('');
    return normalized.slice(0, 30);
};

// 找到最小的未使用的数字（用于自动命名）
const findNextAvailableNumber = (): number => {
    // 获取所有已使用的数字
    const usedNumbers = new Set<number>();
    archives.value.forEach(archive => {
        const name = archive.name.trim();
        // 检查是否是纯数字
        if (/^\d+$/.test(name)) {
            const num = parseInt(name, 10);
            if (!isNaN(num)) {
                usedNumbers.add(num);
            }
        }
    });

    // 从1开始找到第一个未使用的数字
    let nextNum = 1;
    while (usedNumbers.has(nextNum) && nextNum <= MAX_ARCHIVE_COUNT) {
        nextNum++;
    }

    return nextNum;
};

// 处理存档名称确认
const handleArchiveNameConfirm = (name: string) => {
    if (archiveNameDialogCallback.value) {
        archiveNameDialogCallback.value(name);
        archiveNameDialogCallback.value = null;
    }
};

// 处理存档名称取消
const handleArchiveNameCancel = () => {
    archiveNameDialogCallback.value = null;
};

const calculateArchiveSize = (content: string): number => {
    try {
        // 使用 TextEncoder 更精确计算字节数
        const encoder = new TextEncoder();
        return encoder.encode(content).length;
    } catch {
        // 兼容性降级：使用字符串长度近似
        return content.length;
    }
};

const handleSaveArchive = () => {
    if (!inputEditor) {
        showMessageError('编辑器未初始化，请稍候再试');
        return;
    }

    const content = inputEditor.getValue() || '';
    if (!content.trim()) {
        showMessageError('当前没有可存档的内容');
        return;
    }

    // 检查存档数量上限
    if (archives.value.length >= MAX_ARCHIVE_COUNT) {
        showMessageError(`存档数量已达到上限（${MAX_ARCHIVE_COUNT}个），请先删除部分存档`);
        return;
    }

    const size = calculateArchiveSize(content);
    const totalSize = archives.value.reduce((sum, item) => sum + item.size, 0);

    if (totalSize + size > MAX_ARCHIVE_TOTAL_SIZE) {
        showMessageError('存档失败：所有存档总大小超过限制，请先清理部分存档');
        return;
    }

    if (customArchiveName.value) {
        // 使用自定义弹窗
        archiveNameDialogTitle.value = '保存存档';
        // 使用最小的未使用数字作为默认值
        archiveNameDialogInputValue.value = `${findNextAvailableNumber()}`;
        archiveNameDialogPlaceholder.value = '请输入存档名称';
        archiveNameDialogExcludeId.value = ''; // 新增时不需要排除
        archiveNameDialogCallback.value = (name: string) => {
            // 再次检查存档数量上限（防止在弹窗打开期间存档数量达到上限）
            if (archives.value.length >= MAX_ARCHIVE_COUNT) {
                showMessageError(`存档数量已达到上限（${MAX_ARCHIVE_COUNT}个），请先删除部分存档`);
                return;
            }

            const normalizedName = normalizeArchiveName(name);
            if (!normalizedName) {
                showMessageError('存档名称不能为空');
                return;
            }

            // 名称重复检查已在弹窗组件内完成，这里不再检查

            const id = `${Date.now()}-${archives.value.length + 1}`;
            const archive: JsonArchive = {
                id,
                name: normalizedName,
                size,
                content,
            };

            // 新存档放在最前面
            archives.value.unshift(archive);
            saveArchives();

            showMessageSuccess('已保存到本地存档（当前会话有效）');
        };
        archiveNameDialogVisible.value = true;
    } else {
        // 自动命名：使用最小的未使用数字
        const nextNum = findNextAvailableNumber();
        let name = normalizeArchiveName(`${nextNum}`);
        if (!name) {
            name = '1';
        }

        const id = `${Date.now()}-${archives.value.length + 1}`;
        const archive: JsonArchive = {
            id,
            name,
            size,
            content,
        };

        // 新存档放在最前面
        archives.value.unshift(archive);
        saveArchives();

        showMessageSuccess('已保存到本地存档（当前会话有效）');
    }
};

const handleArchiveCommand = async (command: string) => {
    if (command === '__clear_all') {
        try {
            await ElMessageBox.confirm('确定要清空所有存档吗？此操作不可恢复。', '清空存档', {
                confirmButtonText: '清空',
                cancelButtonText: '取消',
                dangerouslyUseHTMLString: false,
                customClass: 'clear-archive-dialog',
            });
        } catch {
            // 用户取消
            return;
        }

        archives.value = [];
        saveArchives();
        showMessageSuccess('已清空所有存档');
        return;
    }

    const archive = archives.value.find(item => item.id === command);
    if (!archive) {
        showMessageError('未找到对应的存档');
        return;
    }

    if (!inputEditor) {
        showMessageError('编辑器未初始化，请稍候再试');
        return;
    }

    inputEditor.setValue(archive.content);

    // 清空outputEditor的内容
    outputEditor?.setValue('');
    updateLineNumberWidth(outputEditor);
    updateEditorHeight(outputEditor);

    showMessageSuccess(`已加载存档：${archive.name}`);
};

// 处理加载分享的JSON数据到输入区域
const handleLoadSharedJson = (jsonData: string) => {
    try {
        if (!inputEditor) {
            showMessageError('编辑器未初始化，请稍候再试');
            return;
        }

        if (!jsonData || !jsonData.trim()) {
            showMessageError('分享数据为空');
            return;
        }

        // 验证并格式化JSON数据
        try {
            const parsed = JSON.parse(jsonData);
            // 使用自定义格式化函数格式化JSON，输入编辑器始终使用2空格缩进
            const formattedJson = customStringify(parsed, null, 2, jsonData);

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
            showMessageError('JSON格式不正确: ' + (error.message || '解析失败'));
        }
    } catch (error: any) {
        showMessageError('加载分享数据失败: ' + (error.message || '未知错误'));
    }
};

// 侧边栏展开/收起状态
// 存档侧边栏宽度（可拖动调整）
const archiveSidebarWidth = ref(150);
const isArchiveResizing = ref(false);
let archiveResizeState: {
    initialX: number;
    initialWidth: number;
    minWidth: number;
    maxWidth: number;
} | null = null;
// 用于在拖动过程中节流编辑器布局更新
let archiveLayoutRaf: number | null = null;

// 使用 DOM 实际测量文本宽度（更准确）
function measureTextWidth(text: string): number {
    if (typeof document === 'undefined') {
        // SSR 环境，使用估算
        let width = 0;
        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            if (/[\u4e00-\u9fa5\u3000-\u303f\uff00-\uffef]/.test(char)) {
                width += 12 * 1.2;
            } else {
                width += 12 * 0.6;
            }
        }
        return width;
    }

    // 创建临时元素测量
    const measureEl = document.createElement('span');
    measureEl.style.cssText = `
        position: absolute;
        visibility: hidden;
        white-space: nowrap;
        font-size: 12px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    `;
    measureEl.textContent = text;
    document.body.appendChild(measureEl);
    const width = measureEl.offsetWidth;
    document.body.removeChild(measureEl);
    return width;
}

// 动态计算存档侧边栏的最大宽度（使用 DOM 实际测量）
const calculateArchiveMaxWidth = (): number => {
    if (archives.value.length === 0) {
        return 100;
    }

    // 侧边栏内边距：左右各 6px = 12px
    const padding = 12;
    // 存档项内边距：左右各 4px = 8px
    const itemPadding = 8;
    // 刷新、编辑和删除按钮宽度：每个图标约 10px，三个图标 + 间距 = 约 42px
    const actionsWidth = 42;
    // 存档项之间的间距和额外空间：约 4px
    const itemMargin = 4;

    // 遍历所有存档，找到最长的
    let maxWidth = 0;
    archives.value.forEach(item => {
        const name = item.name || '';
        // 使用 DOM 实际测量文本宽度
        const textWidth = measureTextWidth(name);
        // 总宽度 = 内边距 + 项内边距 + 文本宽度 + 按钮宽度 + 间距
        const totalWidth = padding + itemPadding + textWidth + actionsWidth + itemMargin;
        maxWidth = Math.max(maxWidth, totalWidth);
    });

    // 加上一些缓冲，确保不会截断
    return Math.ceil(maxWidth) + 8;
};

// 计算最小宽度（收缩状态，只显示前面两个字符）
const calculateArchiveMinWidth = (): number => {
    return 48;
};

// 初始化存档侧边栏宽度（根据存档名称计算）
const initArchiveSidebarWidth = () => {
    if (archives.value.length === 0) {
        archiveSidebarWidth.value = 100;
        return;
    }
    const maxWidth = calculateArchiveMaxWidth();
    // 初始宽度设为最大宽度的 80%，但不少于最小宽度
    archiveSidebarWidth.value = Math.max(Math.floor(maxWidth * 0.8), calculateArchiveMinWidth());
};

// 监听存档列表变化，更新初始宽度和最大宽度限制
watch(
    () => archives.value.length,
    () => {
        if (archives.value.length > 0) {
            const currentMax = calculateArchiveMaxWidth();
            // 如果当前宽度小于最小宽度，则设置为初始宽度
            if (archiveSidebarWidth.value < calculateArchiveMinWidth()) {
                initArchiveSidebarWidth();
            }
            // 如果当前宽度超过新的最大宽度，则限制为最大宽度
            if (archiveSidebarWidth.value > currentMax) {
                archiveSidebarWidth.value = currentMax;
            }
        }
    },
    { immediate: true }
);

// 监听存档名称变化，重新计算最大宽度
watch(
    () => archives.value.map(a => a.name),
    () => {
        if (archives.value.length > 0) {
            const currentMax = calculateArchiveMaxWidth();
            // 如果当前宽度超过新的最大宽度，则限制为最大宽度
            if (archiveSidebarWidth.value > currentMax) {
                archiveSidebarWidth.value = currentMax;
            }
        }
    },
    { deep: true }
);

// 开始拖动存档侧边栏分割线
const startArchiveResize = (e: MouseEvent | TouchEvent) => {
    // 触摸场景通过 touch-action:none 阻止滚动，鼠标场景保持 preventDefault
    if (!('touches' in e)) {
        e.preventDefault();
    }
    e.stopPropagation();

    isArchiveResizing.value = true;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';

    // 禁用 transition，确保拖动时实时响应
    const sidebar = document.querySelector('.archive-sidebar') as HTMLElement;
    if (sidebar) {
        sidebar.style.transition = 'none';
    }

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;

    // 动态计算最小和最大宽度
    const minWidth = calculateArchiveMinWidth();
    const maxWidth = calculateArchiveMaxWidth();

    archiveResizeState = {
        initialX: clientX,
        initialWidth: archiveSidebarWidth.value,
        minWidth: minWidth,
        maxWidth: maxWidth,
    };

    document.addEventListener('mousemove', handleArchiveResizeMove);
    document.addEventListener('mouseup', stopArchiveResize);
    document.addEventListener('touchmove', handleArchiveResizeMove);
    document.addEventListener('touchend', stopArchiveResize);
};

// 处理存档侧边栏拖动移动
const handleArchiveResizeMove = (e: MouseEvent | TouchEvent) => {
    if (!isArchiveResizing.value || !archiveResizeState) return;

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const deltaX = clientX - archiveResizeState.initialX;
    const newWidth = archiveResizeState.initialWidth + deltaX;

    // 限制在最小和最大宽度之间
    archiveSidebarWidth.value = Math.max(archiveResizeState.minWidth, Math.min(newWidth, archiveResizeState.maxWidth));

    // 存档侧边栏拖动时同步更新编辑器布局，避免滚动条与容器脱离
    if (!archiveLayoutRaf) {
        archiveLayoutRaf = requestAnimationFrame(() => {
            archiveLayoutRaf = null;
            updateEditorLayouts(true);
        });
    }
};

// 停止拖动存档侧边栏
const stopArchiveResize = () => {
    if (!isArchiveResizing.value) return;

    isArchiveResizing.value = false;
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
    archiveResizeState = null;

    // 恢复 transition
    const sidebar = document.querySelector('.archive-sidebar') as HTMLElement;
    if (sidebar) {
        sidebar.style.transition = '';
    }

    // 清理动画帧并补一次布局，防止滚动条残留偏移
    if (archiveLayoutRaf) {
        cancelAnimationFrame(archiveLayoutRaf);
        archiveLayoutRaf = null;
    }
    nextTick(() => updateEditorLayouts(true));

    document.removeEventListener('mousemove', handleArchiveResizeMove);
    document.removeEventListener('mouseup', stopArchiveResize);
    document.removeEventListener('touchmove', handleArchiveResizeMove);
    document.removeEventListener('touchend', stopArchiveResize);
};

// 更新存档内容（将当前输入区域的内容保存到指定存档）
const handleRefreshArchive = (item: JsonArchive) => {
    if (!inputEditor) {
        showMessageError('编辑器未初始化，请稍候再试');
        return;
    }

    const newContent = inputEditor.getValue() || '';
    if (!newContent.trim()) {
        showMessageError('当前输入区域内容为空，无法更新存档');
        return;
    }

    // 检查内容大小是否超过限制
    if (newContent.length > MAX_FILE_SIZE) {
        showMessageError(`内容过大（${formatFileSize(newContent.length)}），超过最大限制（${formatFileSize(MAX_FILE_SIZE)}）`);
        return;
    }

    // 检查是否超出存档总大小限制
    const currentTotalSize = archives.value.reduce((sum, archive) => sum + archive.size, 0);
    const oldSize = item.size;
    const newSize = calculateArchiveSize(newContent);
    const newTotalSize = currentTotalSize - oldSize + newSize;

    if (newTotalSize > MAX_ARCHIVE_TOTAL_SIZE) {
        showMessageError('更新存档失败：所有存档总大小超过限制，请先清理部分存档');
        return;
    }

    try {
        // 更新存档内容
        const index = archives.value.findIndex(a => a.id === item.id);
        if (index !== -1) {
            archives.value[index].content = newContent;
            archives.value[index].size = newSize;

            // 将更新后的存档移到最前面
            const updatedArchive = archives.value.splice(index, 1)[0];
            archives.value.unshift(updatedArchive);

            saveArchives();
            showMessageSuccess(`已更新存档「${item.name}」的内容`);
        } else {
            showMessageError('未找到对应的存档');
        }
    } catch (error: any) {
        showMessageError('更新存档失败: ' + error.message);
    }
};

// 删除单个存档
const handleDeleteArchive = async (item: JsonArchive) => {
    try {
        await ElMessageBox.confirm(`确定要删除存档「${item.name}」吗？此操作不可恢复。`, '删除存档', {
            confirmButtonText: '删除',
            cancelButtonText: '取消',
            dangerouslyUseHTMLString: false,
        });
    } catch {
        // 用户取消
        return;
    }

    const index = archives.value.findIndex(a => a.id === item.id);
    if (index !== -1) {
        archives.value.splice(index, 1);
        saveArchives();
        showMessageSuccess('已删除存档');
    }
};

// 重命名单个存档
const handleRenameArchive = (item: JsonArchive) => {
    archiveNameDialogTitle.value = '重命名存档';
    archiveNameDialogInputValue.value = item.name;
    archiveNameDialogPlaceholder.value = '请输入存档名称';
    archiveNameDialogExcludeId.value = item.id; // 编辑时排除当前存档
    archiveNameDialogCallback.value = (name: string) => {
        const normalizedName = normalizeArchiveName(name);
        if (!normalizedName) {
            showMessageError('存档名称不能为空');
            return;
        }

        // 名称重复检查已在弹窗组件内完成，这里不再检查

        item.name = normalizedName;
        saveArchives();

        showMessageSuccess('已更新存档名称');
    };
    archiveNameDialogVisible.value = true;
};

// 长按启用拖拽
const clearArchivePressTimer = () => {
    if (archiveLongPressTimer !== null) {
        window.clearTimeout(archiveLongPressTimer);
        archiveLongPressTimer = null;
    }
};

const onArchivePressStart = (id: string, event: MouseEvent | TouchEvent) => {
    // 仅响应左键或单指触摸
    if ('button' in event && event.button !== 0) return;
    clearArchivePressTimer();
    archiveLongPressTimer = window.setTimeout(() => {
        dragEnabledArchiveId.value = id;
    }, 120); // 缩短长按延时，提升响应
};

const onArchivePressEnd = () => {
    clearArchivePressTimer();
};

// 拖动排序存档列表
const resetArchiveDragState = () => {
    draggingArchiveId.value = null;
    dragOverArchiveId.value = null;
    dragEnabledArchiveId.value = null;
    dropIndicatorIndex.value = null;
    clearArchivePressTimer();
};

const onArchiveDragStart = (item: JsonArchive, event: DragEvent) => {
    if (dragEnabledArchiveId.value !== item.id) {
        event.preventDefault();
        return;
    }
    draggingArchiveId.value = item.id;
    dragOverArchiveId.value = null;
    event.dataTransfer?.setData('text/plain', item.id);
    if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = 'move';
    }
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'grabbing';
};

const onArchiveDragEnter = (targetId: string) => {
    if (!draggingArchiveId.value || draggingArchiveId.value === targetId) return;
    dragOverArchiveId.value = targetId;
};

const computeDropIndex = (clientY: number): number => {
    const listEl = archiveListRef.value;
    if (!listEl) return archives.value.length;
    const items = Array.from(listEl.querySelectorAll('.archive-item')) as HTMLElement[];
    if (!items.length) return 0;
    for (let i = 0; i < items.length; i++) {
        const rect = items[i].getBoundingClientRect();
        const mid = rect.top + rect.height / 2;
        if (clientY < mid) {
            return i;
        }
    }
    return items.length;
};

const onArchiveDragOver = (event: DragEvent, targetId: string, targetIndex: number) => {
    if (!draggingArchiveId.value) return;
    event.preventDefault();
    if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'move';
    }

    // 计算指示线位置（基于列表整体，避免命中偏差）
    dropIndicatorIndex.value = computeDropIndex(event.clientY);
    dragOverArchiveId.value = targetId;
};

// 处理在列表空白区域或指示线处的拖拽
const onArchiveListDragOver = (event: DragEvent) => {
    if (!draggingArchiveId.value) return;
    event.preventDefault();
    if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'move';
    }
    dropIndicatorIndex.value = computeDropIndex(event.clientY);
};

const onArchiveListDrop = (event: DragEvent) => {
    if (!draggingArchiveId.value) {
        resetArchiveDragState();
        return;
    }
    dropIndicatorIndex.value = computeDropIndex(event.clientY);
    // 如果已计算指示位置，走统一的 drop 流程
    if (dropIndicatorIndex.value !== null) {
        const sourceId = draggingArchiveId.value;
        const sourceIndex = archives.value.findIndex(a => a.id === sourceId);
        const targetIndex = dropIndicatorIndex.value;
        if (sourceIndex !== -1) {
            const [moved] = archives.value.splice(sourceIndex, 1);
            let insertIndex = targetIndex;
            if (sourceIndex < targetIndex) {
                insertIndex = targetIndex - 1;
            }
            insertIndex = Math.max(0, Math.min(insertIndex, archives.value.length));
            archives.value.splice(insertIndex, 0, moved);
            saveArchives();
        }
    }
    resetArchiveDragState();
};

const onArchiveDrop = (targetId: string, event?: DragEvent) => {
    const sourceId = draggingArchiveId.value;
    if (!sourceId || sourceId === targetId) {
        resetArchiveDragState();
        return;
    }

    const sourceIndex = archives.value.findIndex(a => a.id === sourceId);
    const targetIndex = dropIndicatorIndex.value ?? (event ? computeDropIndex(event.clientY) : archives.value.findIndex(a => a.id === targetId));

    if (sourceIndex === -1 || targetIndex === -1) {
        resetArchiveDragState();
        return;
    }

    const [moved] = archives.value.splice(sourceIndex, 1);
    let insertIndex = targetIndex;
    // 如果原位置在目标之前，删除后目标索引需要前移一位
    if (sourceIndex < targetIndex) {
        insertIndex = targetIndex - 1;
    }
    // 防御：确保在范围内
    insertIndex = Math.max(0, Math.min(insertIndex, archives.value.length));
    archives.value.splice(insertIndex, 0, moved);
    saveArchives();
    resetArchiveDragState();
};

const onArchiveDragEnd = () => {
    resetArchiveDragState();
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
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
                    const formattedJson = customStringify(jsonData, null, 2, response.data.jsonData);
                    inputEditor.setValue(formattedJson);

                    // 更新编辑器配置，确保使用2空格缩进
                    const model = inputEditor.getModel();
                    if (model) {
                        monaco.editor.setModelLanguage(model, 'json');
                        model.updateOptions({
                            tabSize: 2,
                            indentSize: 2,
                            insertSpaces: true,
                        });
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
                        showMessageSuccess(`已加载分享数据：${response.data.description}`);
                    } else {
                        showMessageSuccess('已加载分享数据');
                    }

                    // 清除URL参数（可选，保持URL干净）
                    const cleanUrl = new URL(window.location.href);
                    cleanUrl.searchParams.delete('share');
                    cleanUrl.searchParams.delete('password');
                    window.history.replaceState({}, '', cleanUrl.toString());
                } catch (error) {
                    showMessageError('分享数据格式不正确');
                }
            }
        } else {
            // 处理错误情况
            if (response.hasPassword) {
                // 需要密码或密码错误，显示密码输入对话框
                const promptMessage = password ? '密码不正确，请重新输入' : '此分享链接需要密码才能访问';

                ElMessageBox.prompt(promptMessage, '输入密码', {
                    confirmButtonText: '确定',
                    cancelButtonText: '取消',
                    inputType: 'password',
                    inputPlaceholder: '请输入访问密码',
                })
                    .then(async ({ value }) => {
                        if (value) {
                            // 重新加载，带上密码
                            const newUrl = new URL(window.location.href);
                            newUrl.searchParams.set('password', value);
                            window.history.replaceState({}, '', newUrl.toString());
                            await loadSharedDataFromUrl();
                        }
                    })
                    .catch(() => {
                        // 用户取消
                    });
            } else {
                showMessageError(response.error || '加载分享数据失败');
            }
        }
    } catch (error: any) {
        showMessageError('加载分享数据失败: ' + (error.message || '未知错误'));
    }
};

// 处理转义相关命令
const handleEscapeCommand = (command: string) => {
    switch (command) {
        case 'escape':
            escapeJSON();
            break;
        case 'unescape':
            unescapeJSON(recursiveUnescape.value);
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

// 解析路径字符串，支持数组语法（如 settings[*] 或 settings[0]）
const parsePathToParts = (path: string): Array<{ key: string; isArray?: boolean; arrayIndex?: number | string }> => {
    const parts: Array<{
        key: string;
        isArray?: boolean;
        arrayIndex?: number | string;
    }> = [];
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
                        parts.push({
                            key: current,
                            isArray: true,
                            arrayIndex: bracketContent === '*' ? '*' : parseInt(bracketContent, 10),
                        });
                        current = '';
                    } else {
                        // 根级别的数组访问，如 [1] 或 [*]
                        parts.push({
                            key: '',
                            isArray: true,
                            arrayIndex: bracketContent === '*' ? '*' : parseInt(bracketContent, 10),
                        });
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

// 获取对象中指定路径的值（支持数组索引语法）
const getValueByPath = (obj: any, path: string): any => {
    if (!path || !obj) return obj;

    const parts = parsePathToParts(path);
    return getValueByPathParts(obj, parts);
};

// 设置对象中指定路径的值（支持数组索引语法）
const setValueByPath = (obj: any, path: string, value: any): boolean => {
    if (!path || !obj) return false;

    const parts = parsePathToParts(path);

    if (parts.length === 0) return false;

    let current = obj;

    // 遍历到倒数第二个路径部分
    for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];

        if (current === null || current === undefined) {
            return false;
        }

        // 处理根级别的数组访问（key为空，isArray为true）
        if (part.isArray && !part.key && Array.isArray(current)) {
            if (part.arrayIndex === '*') {
                // [*] 不应该出现在中间路径，只能用于叶子节点
                return false;
            } else if (typeof part.arrayIndex === 'number') {
                // 具体索引
                if (part.arrayIndex < 0 || part.arrayIndex >= current.length) {
                    return false;
                }
                current = current[part.arrayIndex];
            } else {
                // 默认访问第一个元素
                current = current.length > 0 ? current[0] : null;
            }
            continue;
        }

        if (part.key) {
            if (typeof current === 'object' && part.key in current) {
                current = current[part.key];
            } else {
                return false;
            }
        }

        if (part.isArray && Array.isArray(current)) {
            // 如果是数组，根据arrayIndex返回对应元素
            if (part.arrayIndex === '*') {
                // [*] 不应该出现在中间路径，只能用于叶子节点
                return false;
            } else if (typeof part.arrayIndex === 'number') {
                // 具体索引
                if (part.arrayIndex < 0 || part.arrayIndex >= current.length) {
                    return false;
                }
                current = current[part.arrayIndex];
            } else {
                // 默认访问第一个元素
                current = current.length > 0 ? current[0] : null;
            }
        }
    }

    // 设置最后一个路径部分的值
    const lastPart = parts[parts.length - 1];
    if (current === null || current === undefined || typeof current !== 'object') {
        return false;
    }

    // 处理根级别的数组访问（key为空，isArray为true）
    if (lastPart.isArray && !lastPart.key && Array.isArray(current)) {
        if (lastPart.arrayIndex === '*') {
            // [*] 设置整个数组（不推荐使用）
            return false;
        } else if (typeof lastPart.arrayIndex === 'number') {
            // 具体索引
            if (lastPart.arrayIndex < 0) {
                return false;
            }
            current[lastPart.arrayIndex] = value;
            return true;
        } else {
            // 默认设置第一个元素
            if (current.length > 0) {
                current[0] = value;
                return true;
            }
            return false;
        }
    }

    if (lastPart.key) {
        current[lastPart.key] = value;
        return true;
    }

    if (lastPart.isArray && Array.isArray(current)) {
        // 如果是数组，根据arrayIndex设置对应元素
        if (lastPart.arrayIndex === '*') {
            // [*] 设置整个数组（不推荐使用）
            return false;
        } else if (typeof lastPart.arrayIndex === 'number') {
            // 具体索引
            if (lastPart.arrayIndex < 0) {
                return false;
            }
            current[lastPart.arrayIndex] = value;
            return true;
        } else {
            // 默认设置第一个元素
            if (current.length > 0) {
                current[0] = value;
                return true;
            }
            return false;
        }
    }

    return false;
};

// 按字段值排序数据
const sortJsonByField = (data: any, fieldPath: string, order: 'asc' | 'desc' = 'asc'): any => {
    if (!data) return data;

    // 如果是数组，检查数组元素是否也是数组（处理[*].path的情况）
    if (Array.isArray(data)) {
        // 检查第一个元素是否是数组
        if (data.length > 0 && Array.isArray(data[0])) {
            // 这是一个数组的数组，对每个子数组进行排序
            return data.map(subArray => {
                if (Array.isArray(subArray)) {
                    return [...subArray].sort((a, b) => {
                        const valueA = getValueByPath(a, fieldPath);
                        const valueB = getValueByPath(b, fieldPath);
                        const result = compareFieldValues(valueA, valueB);
                        return order === 'asc' ? result : -result;
                    });
                }
                return subArray;
            });
        } else {
            // 普通数组，按字段排序数组元素
            return [...data].sort((a, b) => {
                const valueA = getValueByPath(a, fieldPath);
                const valueB = getValueByPath(b, fieldPath);
                const result = compareFieldValues(valueA, valueB);
                return order === 'asc' ? result : -result;
            });
        }
    }

    // 如果是对象，检查对象的值是否是数组
    if (typeof data === 'object') {
        const result: any = {};
        for (const [key, value] of Object.entries(data)) {
            if (Array.isArray(value)) {
                // 对数组值进行排序
                result[key] = [...value].sort((a, b) => {
                    const valueA = getValueByPath(a, fieldPath);
                    const valueB = getValueByPath(b, fieldPath);
                    const result = compareFieldValues(valueA, valueB);
                    return order === 'asc' ? result : -result;
                });
            } else {
                // 保持其他值不变
                result[key] = value;
            }
        }
        // 如果顶层是对象且其值不是数组（比如 map），支持按 value 的子字段对键进行排序
        const allValuesAreObjects = Object.values(data).every(v => typeof v === 'object' && v !== null && !Array.isArray(v));
        const allValuesArePrimitive = Object.values(data).every(v => (typeof v !== 'object' || v === null) && !Array.isArray(v));

        // 情况A：每个 value 是对象（例如 { id: 1 }），且用户填写了 fieldPath 或者可以自动回退到 value.<field>
        if (allValuesAreObjects && fieldPath) {
            const entries = Object.entries(data);
            entries.sort((a, b) => {
                // 支持直接写 value.id，也支持简写 id（尝试回退）
                const extractValue = (obj: any) => {
                    let v = getValueByPath(obj, fieldPath);
                    if (v === undefined || v === null) {
                        // 如果 fieldPath 本身没有 value. 前缀，尝试加上
                        if (!fieldPath.startsWith('value.')) {
                            v = getValueByPath(obj, 'value.' + fieldPath);
                        }
                    }
                    return v;
                };

                const valueA = extractValue(a[1]);
                const valueB = extractValue(b[1]);
                const cmp = compareFieldValues(valueA, valueB);
                return order === 'asc' ? cmp : -cmp;
            });
            const sortedObj: any = {};
            for (const [k, v] of entries) {
                sortedObj[k] = v;
            }
            return sortedObj;
        }
        // 情况B：每个 value 是原始类型（number/string/boolean/null），用户无需填写字段，直接按 value 排序
        if (allValuesArePrimitive) {
            const entries = Object.entries(data);
            entries.sort((a, b) => {
                const valueA = a[1];
                const valueB = b[1];
                const cmp = compareFieldValues(valueA, valueB);
                return order === 'asc' ? cmp : -cmp;
            });
            const sortedObj: any = {};
            for (const [k, v] of entries) {
                sortedObj[k] = v;
            }
            return sortedObj;
        }
        return result;
    }

    return data;
};

// 智能路径建议生成器
const getSmartPathSuggestions = (jsonObj: any, input: string): PathSuggestion[] => {
    // 如果输入为空，返回根级别的key
    if (!input.trim()) {
        return getNextLevelKeys(jsonObj, '');
    }

    // 处理数组语法输入
    if (input.endsWith('[')) {
        // 用户正在输入数组语法
        const pathBeforeBracket = input.slice(0, -1);
        const targetValue = pathBeforeBracket ? getValueByPath(jsonObj, pathBeforeBracket) : jsonObj;

        if (Array.isArray(targetValue)) {
            // 提供数组通配符建议
            return [{ value: `${pathBeforeBracket}[*]`, type: 'array-wildcard' }];
        }
        return [];
    }

    // 检查是否正在输入数组索引
    const arrayMatch = input.match(/^(.+)\[(\d*|\*?)$/);
    if (arrayMatch) {
        const pathBeforeBracket = arrayMatch[1];
        const indexPart = arrayMatch[2];

        const targetValue = getValueByPath(jsonObj, pathBeforeBracket);
        if (Array.isArray(targetValue)) {
            // 如果还没有输入索引内容，提供通配符建议
            if (indexPart === '') {
                return [{ value: `${pathBeforeBracket}[*]`, type: 'array-wildcard' }];
            }
            // 如果输入的内容能匹配通配符，提供通配符建议
            if ('*'.startsWith(indexPart)) {
                return [{ value: `${pathBeforeBracket}[*]`, type: 'array-wildcard' }];
            }
            // 如果输入了数字，检查数组长度，提供有效的索引建议
            if (/^\d+$/.test(indexPart)) {
                const numIndex = parseInt(indexPart, 10);
                const suggestions = [];

                // 如果输入的数字小于数组长度，提供通配符作为备选
                if (numIndex < targetValue.length) {
                    suggestions.push({
                        value: `${pathBeforeBracket}[${indexPart}]`,
                        type: 'array-index',
                    });
                }

                // 总是提供通配符选项
                if (!suggestions.some(s => s.value === `${pathBeforeBracket}[*]`)) {
                    suggestions.push({
                        value: `${pathBeforeBracket}[*]`,
                        type: 'array-wildcard',
                    });
                }

                return suggestions;
            }
        }
        return [];
    }

    // 检查是否以点结尾（表示要进入下一级）
    if (input.endsWith('.')) {
        const pathWithoutDot = input.slice(0, -1);
        if (pathWithoutDot) {
            // 有前缀路径，解析并返回下一级
            return getNextLevelKeys(jsonObj, input);
        } else {
            // 根级别，直接返回根级key
            return getNextLevelKeys(jsonObj, '');
        }
    }

    // 解析输入，找到最后一个分隔符
    const lastDotIndex = input.lastIndexOf('.');
    const lastBracketIndex = input.lastIndexOf(']');

    let basePath = '';
    let contextInput = input;

    // 优先处理数组访问（因为数组访问可能包含点号，如 [*].age）
    if (lastBracketIndex !== -1) {
        // 检查数组访问之前是否有内容
        const bracketStart = input.lastIndexOf('[', lastBracketIndex);
        if (bracketStart !== -1) {
            const beforeBracket = input.substring(0, bracketStart);
            const afterBracket = input.substring(lastBracketIndex + 1);

            // 如果数组访问后有内容（如 [*].age），则basePath是 [*].，contextInput是age
            if (afterBracket.startsWith('.')) {
                basePath = input.substring(0, lastBracketIndex + 1) + '.';
                contextInput = afterBracket.substring(1);
            } else if (afterBracket) {
                // 如果数组访问后直接有内容（如 [*]age），这通常是无效的，但我们还是处理
                basePath = input.substring(0, lastBracketIndex + 1);
                contextInput = afterBracket;
            } else {
                // 数组访问后没有内容，检查之前是否有内容
                if (beforeBracket) {
                    basePath = '';
                    contextInput = input;
                } else {
                    basePath = '';
                    contextInput = input;
                }
            }
        }
    } else if (lastDotIndex !== -1) {
        // 没有数组访问，只有点号
        basePath = input.substring(0, lastDotIndex + 1);
        contextInput = input.substring(lastDotIndex + 1);
    }

    // 获取basePath对应的下一级key
    const allSuggestions = getNextLevelKeys(jsonObj, basePath);

    // 如果没有当前输入，返回所有建议
    if (!contextInput) {
        return allSuggestions;
    }

    // 过滤以当前输入开头的建议（不区分大小写）
    const filteredSuggestions = allSuggestions.filter(suggestion => suggestion.value.toLowerCase().startsWith(contextInput.toLowerCase()));

    return filteredSuggestions;
};

// 获取根路径建议
const queryRootPaths = (queryString: string, cb: (suggestions: PathSuggestion[]) => void) => {
    // 记录当前的查询上下文，用于路径拼接
    rootPathQueryContext = queryString || '';

    if (!inputEditor?.getValue()?.trim()) {
        cb([]);
        return;
    }

    try {
        const jsonData = inputEditor.getValue();
        const jsonObj = JSON.parse(jsonData);

        const suggestions = getSmartPathSuggestions(jsonObj, queryString || '');
        cb(suggestions);
    } catch (error) {
        cb([]);
    }
};

// 禁用字段智能提示的占位函数（始终不返回建议）
const queryFieldPathsDisabled = (queryString: string, cb: (suggestions: PathSuggestion[]) => void) => {
    cb([]);
};

// 获取下一级的key建议（基于当前输入内容）
const getNextLevelKeys = (jsonObj: any, contextPath: string): PathSuggestion[] => {
    const suggestions: PathSuggestion[] = [];

    // 如果输入为空，返回一级key
    if (!contextPath || !contextPath.trim()) {
        // 如果数据本身是数组，直接提示 [*]
        if (Array.isArray(jsonObj)) {
            suggestions.push({ value: '[*]', type: 'array-wildcard' });
            return suggestions;
        }

        if (jsonObj && typeof jsonObj === 'object' && !Array.isArray(jsonObj)) {
            for (const [key, value] of Object.entries(jsonObj)) {
                // 只为数组和对象类型的字段提供智能提示，过滤掉基础类型（string, number, boolean, null）
                if (Array.isArray(value)) {
                    suggestions.push({ value: key, type: 'exact' });
                    suggestions.push({ value: `${key}[*]`, type: 'array-wildcard' });
                } else if (value && typeof value === 'object') {
                    suggestions.push({ value: key, type: 'exact' });
                }
                // 基础类型字段（string, number, boolean, null）不提供智能提示
            }
        }
        return suggestions.sort((a, b) => a.value.localeCompare(b.value));
    }

    // 解析当前路径
    const trimmedPath = contextPath.trim();

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
                    // 只为数组和对象类型的字段提供智能提示，过滤掉基础类型（string, number, boolean, null）
                    if (Array.isArray(value)) {
                        suggestions.push({ value: key, type: 'exact' });
                        suggestions.push({ value: `${key}[*]`, type: 'array-wildcard' });
                    } else if (value && typeof value === 'object') {
                        suggestions.push({ value: key, type: 'exact' });
                    }
                    // 基础类型字段（string, number, boolean, null）不提供智能提示
                }
            }
        }
    }
    // 如果目标是对象，返回对象的key
    else if (typeof targetValue === 'object') {
        for (const [key, value] of Object.entries(targetValue)) {
            // 只为数组和对象类型的字段提供智能提示，过滤掉基础类型（string, number, boolean, null）
            if (Array.isArray(value)) {
                suggestions.push({ value: key, type: 'exact' });
                suggestions.push({ value: `${key}[*]`, type: 'array-wildcard' });
            } else if (value && typeof value === 'object') {
                suggestions.push({ value: key, type: 'exact' });
            }
            // 基础类型字段（string, number, boolean, null）不提供智能提示
        }
    }

    return suggestions.sort((a, b) => a.value.localeCompare(b.value));
};

// 获取类型标签的中文显示
const getTypeLabel = (type: string): string => {
    const typeMap: Record<string, string> = {
        exact: '精确匹配',
        'array-wildcard': '数组通配符',
        'array-index': '数组索引',
        wildcard: '通配符',
    };
    return typeMap[type] || type;
};

// 比较两个值（用于字段排序）
const compareFieldValues = (a: any, b: any): number => {
    // 处理null和undefined
    if (a == null && b == null) return 0;
    if (a == null) return -1;
    if (b == null) return 1;

    // 数字比较
    if (typeof a === 'number' && typeof b === 'number') {
        return a - b;
    }

    // 字符串比较
    if (typeof a === 'string' && typeof b === 'string') {
        return a.localeCompare(b);
    }

    // 布尔值比较
    if (typeof a === 'boolean' && typeof b === 'boolean') {
        return a === b ? 0 : a ? 1 : -1;
    }

    // 不同类型转换为字符串比较
    const strA = String(a);
    const strB = String(b);
    return strA.localeCompare(strB);
};

// 获取比较函数
const getCompareFunction = (method: 'dictionary' | 'length' | 'field', fieldPath?: string): ((a: any, b: any) => number) => {
    switch (method) {
        case 'dictionary':
            return (a: any, b: any) => compareDictionary(String(a), String(b));
        case 'length':
            return (a: any, b: any) => compareLength(String(a), String(b));
        case 'field':
            return (a: any, b: any) => {
                if (!fieldPath) return 0;

                // 对于字段排序，a和b应该是对象或数组元素
                const valueA = getValueByPath(a, fieldPath);
                const valueB = getValueByPath(b, fieldPath);

                return compareFieldValues(valueA, valueB);
            };
        default:
            return (a: any, b: any) => compareDictionary(String(a), String(b));
    }
};

// 递归排序JSON对象
const sortJsonObject = (obj: any, method: 'dictionary' | 'length' | 'field', order: 'asc' | 'desc', fieldPath?: string): any => {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }

    if (Array.isArray(obj)) {
        if (method === 'field' && fieldPath) {
            // 数组元素按字段值排序
            const compareFn = getCompareFunction(method, fieldPath);
            return [...obj]
                .sort((a, b) => {
                    const result = compareFn(a, b);
                    return order === 'asc' ? result : -result;
                })
                .map(item => sortJsonObject(item, method, order, fieldPath));
        } else {
            // 普通数组：递归处理每个元素
            return obj.map(item => sortJsonObject(item, method, order, fieldPath));
        }
    }

    // 对象处理
    if (method === 'field' && fieldPath) {
        // 检查对象的值是否是数组，如果是则对数组进行排序
        const values = Object.values(obj);
        const hasArrayValues = values.some(val => Array.isArray(val));

        if (hasArrayValues) {
            // 对象的值包含数组，对每个数组值进行排序
            const sortedObj: any = {};
            for (const [key, value] of Object.entries(obj)) {
                if (Array.isArray(value)) {
                    // 对数组进行字段排序
                    const compareFn = getCompareFunction(method, fieldPath);
                    sortedObj[key] = [...value]
                        .sort((a, b) => {
                            const result = compareFn(a, b);
                            return order === 'asc' ? result : -result;
                        })
                        .map(item => sortJsonObject(item, method, order, fieldPath));
                } else {
                    // 非数组值递归处理
                    sortedObj[key] = sortJsonObject(value, method, order, fieldPath);
                }
            }
            return sortedObj;
        } else {
            // 对象的值不是数组，尝试对对象本身按字段排序
            // 这通常用于类似 {"1": {...}, "2": {...}} 的结构
            const entries = Object.entries(obj);
            const compareFn = getCompareFunction(method, fieldPath);

            const sortedEntries = entries.sort(([keyA, valA], [keyB, valB]) => {
                const result = compareFn(valA, valB);
                return order === 'asc' ? result : -result;
            });

            const sortedObj: any = {};
            for (const [key, value] of sortedEntries) {
                sortedObj[key] = sortJsonObject(value, method, order, fieldPath);
            }
            return sortedObj;
        }
    } else {
        // 普通对象：对Key进行排序
        const compareFn = getCompareFunction(method, fieldPath);
        const sortedKeys = Object.keys(obj).sort((a, b) => {
            const result = compareFn(a, b);
            return order === 'asc' ? result : -result;
        });

        const sortedObj: any = {};
        for (const key of sortedKeys) {
            // 递归处理值
            sortedObj[key] = sortJsonObject(obj[key], method, order, fieldPath);
        }

        return sortedObj;
    }
};

// 处理根路径选择
const handleRootPathSelect = (item: Record<string, any>) => {
    const contextInput = rootPathQueryContext || '';
    const selectedValue = item.value;

    // 如果上下文输入已经是选择的项目，直接使用（避免重复拼接）
    if (contextInput === selectedValue) {
        sortRootPath.value = selectedValue;
        lastRootPathInput = selectedValue;
        return;
    }

    // 智能路径拼接：基于上下文输入和选择的项目构建完整路径
    let newPath = selectedValue;

    // 如果上下文输入不为空，需要智能拼接
    if (contextInput && contextInput !== selectedValue) {
        // 检查当前输入的状态来决定如何拼接
        if (contextInput.endsWith('.') || contextInput.endsWith('[')) {
            // 直接追加选择的项目
            newPath = contextInput + selectedValue;
        } else if (contextInput.match(/\[\d*\]$/) || contextInput.endsWith(']')) {
            // 以数组访问结尾，追加点号和选择的项目
            newPath = contextInput + '.' + selectedValue;
        } else {
            // 找到最后一个完整路径部分，替换当前输入的部分
            const lastDotIndex = contextInput.lastIndexOf('.');
            const lastBracketIndex = contextInput.lastIndexOf('[');

            if (lastDotIndex !== -1 && (lastBracketIndex === -1 || lastDotIndex > lastBracketIndex)) {
                // 以点分隔，取点之前的内容加上选择的项目
                const basePath = contextInput.substring(0, lastDotIndex + 1);
                newPath = basePath + selectedValue;
            } else if (lastBracketIndex !== -1) {
                // 处理数组相关的路径
                const bracketEndIndex = contextInput.indexOf(']', lastBracketIndex);
                if (bracketEndIndex !== -1) {
                    const basePath = contextInput.substring(0, bracketEndIndex + 1);
                    newPath = basePath + '.' + selectedValue;
                } else {
                    // 不完整的数组语法，直接替换
                    newPath = selectedValue;
                }
            } else {
                // 没有分隔符，直接替换
                newPath = selectedValue;
            }
        }
    }

    sortRootPath.value = newPath;
    lastRootPathInput = newPath;
};

// 用于保存上一次的输入路径，用于路径补全
let lastRootPathInput = '';
let lastFieldPathInput = '';

// 用于跟踪根路径输入的上下文（autocomplete查询时的字符串）
let rootPathQueryContext = '';
let fieldPathQueryContext = '';

// 处理根路径输入
const handleRootPathInput = (value: string | number) => {
    const stringValue = typeof value === 'string' ? value : String(value);
    lastRootPathInput = stringValue;
    sortRootPath.value = stringValue;
};

// 处理字段路径选择
const handleFieldPathSelect = (item: Record<string, any>) => {
    const contextInput = fieldPathQueryContext || '';
    const selectedValue = item.value;

    // 如果上下文输入已经是选择的项目，直接使用（避免重复拼接）
    if (contextInput === selectedValue) {
        sortFieldName.value = selectedValue;
        lastFieldPathInput = selectedValue;
        return;
    }

    // 智能路径拼接：基于上下文输入和选择的项目构建完整路径
    let newPath = selectedValue;

    // 如果上下文输入不为空，需要智能拼接
    if (contextInput && contextInput !== selectedValue) {
        // 检查当前输入的状态来决定如何拼接
        if (contextInput.endsWith('.') || contextInput.endsWith('[')) {
            // 直接追加选择的项目
            newPath = contextInput + selectedValue;
        } else if (contextInput.match(/\[\d*\]$/) || contextInput.endsWith(']')) {
            // 以数组访问结尾，追加点号和选择的项目
            newPath = contextInput + '.' + selectedValue;
        } else {
            // 找到最后一个完整路径部分，替换当前输入的部分
            const lastDotIndex = contextInput.lastIndexOf('.');
            const lastBracketIndex = contextInput.lastIndexOf('[');

            if (lastDotIndex !== -1 && (lastBracketIndex === -1 || lastDotIndex > lastBracketIndex)) {
                // 以点分隔，取点之前的内容加上选择的项目
                const basePath = contextInput.substring(0, lastDotIndex + 1);
                newPath = basePath + selectedValue;
            } else if (lastBracketIndex !== -1) {
                // 处理数组相关的路径
                const bracketEndIndex = contextInput.indexOf(']', lastBracketIndex);
                if (bracketEndIndex !== -1) {
                    const basePath = contextInput.substring(0, bracketEndIndex + 1);
                    newPath = basePath + '.' + selectedValue;
                } else {
                    // 不完整的数组语法，直接替换
                    newPath = selectedValue;
                }
            } else {
                // 没有分隔符，直接替换
                newPath = selectedValue;
            }
        }
    }

    sortFieldName.value = newPath;
    lastFieldPathInput = newPath;
};

// 处理字段路径输入
const handleFieldPathInput = (value: string | number) => {
    const stringValue = typeof value === 'string' ? value : String(value);
    lastFieldPathInput = stringValue;
    sortFieldName.value = stringValue;
};

// 处理根路径键盘事件
const handleRootPathKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Enter') {
        // 回车键处理：只有当有建议且输入框内容不完整时才自动完成
        event.preventDefault();

        if (!inputEditor?.getValue()?.trim()) {
            return;
        }

        try {
            const jsonData = inputEditor.getValue();
            const jsonObj = JSON.parse(jsonData);
            const suggestions = getSmartPathSuggestions(jsonObj, lastRootPathInput);

            // 如果当前输入已经是一个完整的有效路径，不进行自动完成
            if (lastRootPathInput && suggestions.some((s: PathSuggestion) => s.value === lastRootPathInput)) {
                // 当前输入已经是有效路径，不做处理
                return;
            }

            if (suggestions.length === 1) {
                // 只有一个建议，直接选择
                handleRootPathSelect(suggestions[0]);
            } else if (suggestions.length > 1) {
                // 多个建议，选择最匹配的（如果当前输入完全匹配）
                const exactMatch = suggestions.find((s: PathSuggestion) => s.value.toLowerCase() === lastRootPathInput.toLowerCase());
                if (exactMatch) {
                    handleRootPathSelect(exactMatch);
                } else {
                    // 选择第一个建议
                    handleRootPathSelect(suggestions[0]);
                }
            }
        } catch (error) {}
    }
};

// 处理字段路径键盘事件
const handleFieldPathKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Enter') {
        // 回车键处理：只有当有建议且输入框内容不完整时才自动完成
        event.preventDefault();

        if (!inputEditor?.getValue()?.trim()) {
            return;
        }

        try {
            const jsonData = inputEditor.getValue();
            const jsonObj = JSON.parse(jsonData);

            // 获取数据根路径指向的数据
            let dataToAnalyze = jsonObj;
            if (sortRootPath.value.trim()) {
                dataToAnalyze = getValueByPath(jsonObj, sortRootPath.value.trim());
                if (dataToAnalyze === undefined) {
                    return;
                }
            }

            const suggestions = getSmartPathSuggestions(dataToAnalyze, lastFieldPathInput);

            // 如果当前输入已经是一个完整的有效路径，不进行自动完成
            if (lastFieldPathInput && suggestions.some((s: PathSuggestion) => s.value === lastFieldPathInput)) {
                // 当前输入已经是有效路径，不做处理
                return;
            }

            if (suggestions.length === 1) {
                // 只有一个建议，直接选择
                handleFieldPathSelect(suggestions[0]);
            } else if (suggestions.length > 1) {
                // 多个建议，选择最匹配的（如果当前输入完全匹配）
                const exactMatch = suggestions.find((s: PathSuggestion) => s.value.toLowerCase() === lastFieldPathInput.toLowerCase());
                if (exactMatch) {
                    handleFieldPathSelect(exactMatch);
                } else {
                    // 选择第一个建议
                    handleFieldPathSelect(suggestions[0]);
                }
            }
        } catch (error) {}
    }
};

// 显示字段排序演示
const showFieldSortDemo = () => {
    fieldSortDialogVisible.value = false;

    // 自动填入演示数据到输入框
    const demoJson = JSON.stringify(demoData.value, null, 2);
    // 保存原始输入内容（如果尚未保存）
    if (inputEditor && savedInputContent.value === null) {
        try {
            savedInputContent.value = inputEditor.getValue() || '';
        } catch (e) {
            savedInputContent.value = '';
        }
    }
    if (inputEditor) {
        inputEditor.setValue(demoJson);
        updateEditorHeight(inputEditor);
    }

    // 启动演示模式
    startDemoMode();
};

// 启动演示模式
const startDemoMode = () => {
    isDemoMode.value = true;
    currentDemoStep.value = 0;
    demoResults.value = {};

    // 记录演示开始前的输入内容（如果尚未记录）
    if (inputEditor && savedInputContent.value === null) {
        try {
            savedInputContent.value = inputEditor.getValue() || '';
        } catch (e) {
            savedInputContent.value = '';
        }
    }

    // 预先计算演示结果
    demoResults.value['id'] = performFieldSort(JSON.parse(JSON.stringify(demoData.value)), '', 'id');
    demoResults.value['education'] = performFieldSort(JSON.parse(JSON.stringify(demoData.value)), '[*].education', 'graduationYear');
    // map 演示结果
    demoResults.value['map_id'] = performFieldSort(JSON.parse(JSON.stringify(demoMapData.value)), '', 'id');
    demoResults.value['map_value_score'] = performFieldSort(JSON.parse(JSON.stringify(demoMapData.value)), '', 'value.score');

    // 显示第一个教学弹窗
    // 初始化弹窗位置（居中偏上）
    if (typeof window !== 'undefined') {
        popupLeft.value = Math.max(8, (window.innerWidth - DEMO_POPUP_WIDTH) / 2);
        popupTop.value = 100;
    }
    showDemoStep(0);
};

// 辅助函数：设置参数并跳转到指定步骤
const setAndNext = (rootPath: string, fieldName: string, nextStep: number) => {
    setDemoParams(rootPath, fieldName);
    showDemoStep(nextStep);
};

// 辅助函数：执行排序并跳转到指定步骤（用于演示）
const execAndNext = (rootPath: string, fieldName: string, nextStep: number) => {
    // 在演示中直接使用预计算/即时计算结果并写入输出编辑器（默认使用 demoData）
    const dataToUse = demoData.value;
    const result = performFieldSort(JSON.parse(JSON.stringify(dataToUse)), rootPath, fieldName);
    const formatted = customStringify(result, null, 2, JSON.stringify(dataToUse), 0, true);
    const finalOutput = formatted.replace(/\\u([0-9a-fA-F]{4})/g, '\\\\u$1');
    if (outputEditor) {
        outputEditor.setValue(finalOutput);
        updateEditorHeight(outputEditor);
    }
    showDemoStep(nextStep);
};

// 针对 demoMapData 的执行函数
const execAndNextMap = (rootPath: string, fieldName: string, nextStep: number) => {
    const dataToUse = demoMapData.value;
    const result = performFieldSort(JSON.parse(JSON.stringify(dataToUse)), rootPath, fieldName);
    const formatted = customStringify(result, null, 2, JSON.stringify(dataToUse), 0, true);
    const finalOutput = formatted.replace(/\\u([0-9a-fA-F]{4})/g, '\\\\u$1');
    if (outputEditor) {
        outputEditor.setValue(finalOutput);
        updateEditorHeight(outputEditor);
    }
    showDemoStep(nextStep);
};

// 将 demoMapData 加载到输入编辑器并设置参数（不跳转）
const loadDemoMapNoAdvance = (rootPath: string, fieldName: string) => {
    if (inputEditor) {
        const demoJson = JSON.stringify(demoMapData.value, null, 2);
        inputEditor.setValue(demoJson);
        updateEditorHeight(inputEditor);
    }
    // 重新计算预览结果
    demoResults.value['map_id'] = performFieldSort(JSON.parse(JSON.stringify(demoMapData.value)), '', 'id');
    demoResults.value['map_value_score'] = performFieldSort(JSON.parse(JSON.stringify(demoMapData.value)), '', 'value.score');
    // 不自动设置参数，保持示例初始为未设置状态
};

// 显示演示步骤
const showDemoStep: (step: number) => void = (step: number) => {
    currentDemoStep.value = step;

    const steps = [
        {
            title: '📊 演示开始',
            content: '已自动填入演示数据，现在可以拖动演示弹窗的位置，让我们学习如何使用字段排序功能。',
            highlight: '.json-input-container',
            buttons: [{ text: '开始学习', action: () => showDemoStep(1) }],
        },
        {
            title: '🔢 示例1：Array - 按 id 排序',
            content: '由于按照 id 字段排序的对象就是最外层数组的元素，所以排序范围就是整个 JSON 数据，因此排序范围可以留空，排序字段参数填入 id 即可。',
            highlight: '.sort-fields-button',
            buttons: [
                { text: '上一步', action: () => showDemoStep(0) },
                { text: '设置参数', action: () => setAndNext('', 'id', 2) },
            ],
        },
        {
            title: '🎯 执行排序',
            content: '参数设置完成，点击“执行排序”将会应用排序并进入结果查看步骤。',
            highlight: '.sort-fields-button',
            buttons: [
                { text: '上一步', action: () => showDemoStep(1) },
                { text: '执行排序', action: () => execAndNext('', 'id', 3) },
            ],
        },
        {
            title: '✅ 排序完成',
            content: '排序已完成，结果已写入预览区域。你可以返回上一步重新查看，或者进入下一个示例。',
            highlight: null,
            buttons: [
                { text: '上一步', action: () => showDemoStep(2) },
                { text: '下一个示例', action: () => showDemoStep(4) },
            ],
        },
        {
            title: '🔢 示例2：Array - 按毕业年份排序每个人的教育经历',
            content: '当我们要对嵌套内部的数组排序时，需要指定排序范围：[*].education，表示每个人的教育经历，那么排序字段就是毕业年份： graduationYear。',
            highlight: '.sort-fields-button',
            buttons: [
                { text: '上一步', action: () => showDemoStep(3) },
                {
                    text: '设置参数',
                    action: () => setAndNext('[*].education', 'graduationYear', 5),
                },
            ],
        },
        {
            title: '🎯 执行排序',
            content: '参数设置完成，点击“执行排序”将会应用排序并进入结果查看步骤。',
            highlight: '.sort-fields-button',
            buttons: [
                { text: '上一步', action: () => showDemoStep(4) },
                {
                    text: '执行排序',
                    action: () => execAndNext('[*].education', 'graduationYear', 6),
                },
            ],
        },
        {
            title: '✅ 排序完成（Array - education）',
            content: '排序已完成，结果已写入预览区域。你可以返回上一步重新设置，或者进入 Map 示例。',
            highlight: null,
            buttons: [
                { text: '上一步', action: () => showDemoStep(5) },
                { text: '下一个示例', action: () => showDemoStep(7) },
            ],
        },
        {
            title: '🔢 示例3：Map — 按 id 排序',
            content: '下面我们切换到 map 示例数据，示范如何对 map 按 id 排序。需要注意的是排序字段不需要输入 map 的 Key，直接输入 Value 内部的排序字段就行',
            highlight: '.sort-fields-button',
            buttons: [
                { text: '上一步', action: () => showDemoStep(6) },
                { text: '设置参数', action: () => setAndNext('', 'id', 8) },
            ],
        },
        {
            title: '🎯 执行排序',
            content: '参数设置完成，点击“执行排序”将对 map 进行排序并进入结果查看步骤。',
            highlight: '.sort-fields-button',
            buttons: [
                { text: '上一步', action: () => showDemoStep(7) },
                { text: '执行排序', action: () => execAndNextMap('', 'id', 9) },
            ],
        },
        {
            title: '✅ 排序完成（Map - id）',
            content: 'Map 排序已完成，结果已写入预览区域。你可以返回上一步重新设置，或者进入下一个示例。',
            highlight: null,
            buttons: [
                { text: '上一步', action: () => showDemoStep(8) },
                { text: '下一个示例', action: () => showDemoStep(10) },
            ],
        },
        {
            title: '🔢 示例4：Map — 按 value.score 排序',
            content: '同样可以按 map 内部字段排序，例如填写 value.score 来按 score 排序。',
            highlight: '.sort-fields-button',
            buttons: [
                { text: '上一步', action: () => showDemoStep(9) },
                { text: '设置参数', action: () => setAndNext('', 'value.score', 11) },
            ],
        },
        {
            title: '🎯 执行排序',
            content: '参数设置完成，点击“执行排序”将应用 map 内部字段排序并进入结果查看步骤。',
            highlight: '.sort-fields-button',
            buttons: [
                { text: '上一步', action: () => showDemoStep(10) },
                {
                    text: '执行排序',
                    action: () => execAndNextMap('', 'value.score', 12),
                },
            ],
        },
        {
            title: '✅ 排序完成（Map - value.score）',
            content: '排序已完成，结果已写入预览区域。你已完成所有示例。',
            highlight: null,
            buttons: [
                { text: '再试一次', action: () => startDemoMode() },
                { text: '结束演示', action: () => endDemoMode() },
            ],
        },
    ];
    // 更新步骤数量（用于指示器渲染）
    demoStepsCount.value = steps.length;

    if (step < steps.length) {
        currentDemoStepData.value = steps[step];
        demoGuideVisible.value = true;
    }
    // 自动切换 demo 数据：当进入 Map 示例步时，加载 map 示例到输入编辑器并设置默认字段（不跳转）
    // 每个示例开始时清空当前参数（范围留空，字段未设置）
    if ([1, 4, 7, 10].includes(step)) {
        sortRootPath.value = '';
        sortFieldName.value = '';
        // 每个示例开始时清空预览区域
        if (outputEditor) {
            outputEditor.setValue('');
            updateLineNumberWidth(outputEditor);
            updateEditorHeight(outputEditor);
        }
    }
    if (step === 7) {
        // Map — 按 id 排序示例（加载 demo 数据，但保持字段未设置）
        loadDemoMapNoAdvance('', '');
    } else if (step === 10) {
        // Map — 按 value.score 排序示例（加载 demo 数据，但保持字段未设置）
        loadDemoMapNoAdvance('', '');
    }
};

// 设置演示参数
const setDemoParams = (rootPath: string, fieldName: string) => {
    sortRootPath.value = rootPath;
    sortFieldName.value = fieldName;
};

// 结束演示模式
const endDemoMode = () => {
    isDemoMode.value = false;
    demoGuideVisible.value = false;
    currentDemoStepData.value = null;

    // 清空演示数据
    if (inputEditor) {
        // 恢复开始演示前的输入内容（如果有保存），否则清空
        const restored = savedInputContent.value !== null ? savedInputContent.value : '';
        inputEditor.setValue(restored);
        updateEditorHeight(inputEditor);
    }
    if (outputEditor) {
        outputEditor.setValue('');
        updateEditorHeight(outputEditor);
    }
    // 清除缓存的原始内容
    savedInputContent.value = null;
};

// 执行字段排序的核心逻辑（提取为独立函数）
const performFieldSort = (data: any, rootPath: string, fieldName: string) => {
    let result = JSON.parse(JSON.stringify(data));

    // 处理嵌套数组排序的情况
    if (rootPath && rootPath.includes('[*]')) {
        if (!Array.isArray(result)) {
            throw new Error('根数据必须是数组才能使用 [*] 路径');
        }

        // 对每个数组元素进行排序
        result.forEach(item => {
            if (item && typeof item === 'object') {
                // 提取 [*].path 中的 path 部分
                const pathParts = rootPath.split('[*].');
                if (pathParts.length === 2) {
                    const subPath = pathParts[1];
                    const subData = getValueByPath(item, subPath);
                    if (Array.isArray(subData)) {
                        // 对子数组进行排序
                        const sortedSubData = sortJsonByField(subData, fieldName, sortOrder.value);
                        // 设置排序后的数据回去
                        setValueByPath(item, subPath, sortedSubData);
                    }
                }
            }
        });

        return result;
    }

    // 简单排序
    return sortJsonByField(result, fieldName, sortOrder.value);
};

// 执行字段排序
const executeFieldSort = () => {
    fieldSortDialogVisible.value = false;

    try {
        const value = inputEditor?.getValue() || '';
        let parsed;
        let originalString = value;

        const result = preprocessJSON(value);
        parsed = result.data;
        originalString = result.originalString;

        // 处理嵌套数组排序的情况
        if (sortRootPath.value.trim() && sortRootPath.value.trim().includes('[*]')) {
            // 对于 [*].path 这样的路径，需要直接修改原始数据
            const rootPath = sortRootPath.value.trim();
            if (!Array.isArray(parsed)) {
                showMessageError('根数据必须是数组才能使用 [*] 路径');
                return;
            }

            // 对每个数组元素进行排序
            parsed.forEach(item => {
                if (item && typeof item === 'object') {
                    // 提取 [*].path 中的 path 部分
                    const pathParts = rootPath.split('[*].');
                    if (pathParts.length === 2) {
                        const subPath = pathParts[1];
                        const subData = getValueByPath(item, subPath);
                        if (Array.isArray(subData)) {
                            // 对子数组进行排序
                            const sortedSubData = sortJsonByField(subData, sortFieldName.value.trim(), sortOrder.value);
                            // 设置排序后的数据回去
                            setValueByPath(item, subPath, sortedSubData);
                        }
                    }
                }
            });

            // 格式化输出
            const formatted = customStringify(parsed, null, 2, originalString, 0, true);
            const finalOutput = formatted.replace(/\\u([0-9a-fA-F]{4})/g, '\\u$1');
            outputEditor?.setValue(finalOutput);
            updateEditorHeight(outputEditor);

            showMessageSuccess(`按字段 "${sortFieldName.value}" 对路径 "${rootPath}" 下的数组排序成功`);
            return;
        }

        // 获取要排序的数据
        let dataToSort = parsed;
        if (sortRootPath.value.trim()) {
            dataToSort = getValueByPath(parsed, sortRootPath.value.trim());
            if (dataToSort === undefined) {
                showMessageError(`找不到路径 "${sortRootPath.value}" 对应的数据`);
                return;
            }
        }

        // 执行排序
        const sortedData = sortJsonByField(dataToSort, sortFieldName.value.trim(), sortOrder.value);

        // 如果有根路径，需要将排序结果放回原位置
        let finalResult = sortedData;
        if (sortRootPath.value.trim()) {
            finalResult = { ...parsed };
            setValueByPath(finalResult, sortRootPath.value.trim(), sortedData);
        }

        // 格式化输出
        const formatted = customStringify(finalResult, null, 2, originalString, 0, true);
        const finalOutput = formatted.replace(/\\u([0-9a-fA-F]{4})/g, '\\u$1');

        outputEditor?.setValue(finalOutput);

        // 更新编辑器配置
        if (outputEditor) {
            const model = outputEditor.getModel();
            if (model) {
                monaco.editor.setModelLanguage(model, 'json');
            }

            outputEditor.updateOptions(getEditorOptions(indentSize.value, true, 'json', true));
            updateLineNumberWidth(outputEditor);
            updateEditorHeight(outputEditor);
        }

        const rootDesc = sortRootPath.value.trim() ? `路径 "${sortRootPath.value}" 下的数据` : '根级数据';
        showMessageSuccess(`按字段 "${sortFieldName.value}" 对${rootDesc}排序成功`);
    } catch (error: any) {
        showMessageError('排序失败: ' + error.message);
    }
};

// 应用排序
const applySort = () => {
    try {
        outputType.value = 'json';
        const value = inputEditor?.getValue() || '';

        if (!value.trim()) {
            showMessageError('请先输入 JSON 数据');
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
            showMessageError('请输入有效的 JSON 数据');
            return;
        }

        // 检查字段排序的参数
        if (sortMethod.value === 'field') {
            // 显示字段排序对话框
            sortRootPath.value = '';
            sortFieldName.value = '';
            fieldSortDialogVisible.value = true;
            return;
        }

        // 执行排序
        const sorted = sortJsonObject(parsed, sortMethod.value, sortOrder.value, '');

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
            length: '按Key长度',
        };
        const orderNames: Record<string, string> = {
            asc: '正序',
            desc: '倒序',
        };
        showMessageSuccess(`排序成功`);
    } catch (error: any) {
        showMessageError('排序失败: ' + error.message);
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
        return obj
            .map(item => {
                if (typeof item === 'object' && item !== null) {
                    return `${spaces}- ${convertToYAML(item, indent + 2).trimStart()}`;
                }
                return `${spaces}- ${formatValue(item)}`;
            })
            .join('\n');
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
        return arr.every(
            item => typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean' || item === null || (Array.isArray(item) && isSimpleArray(item))
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
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
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
                const currentTag = typeof item === 'object' && item !== null ? (tagName === 'root' ? 'item' : itemTagName) : itemTagName;
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
        obj.forEach(item => {
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

// JSON 转 Go 结构体（智能识别 struct vs map）
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

    // 获取值的类型标识（用于形状比较）
    const getValueType = (value: any): string => {
        if (Array.isArray(value)) {
            if (value.length === 0) return '[]';
            return `[]${getValueType(value[0])}`;
        }
        if (typeof value === 'object' && value !== null) {
            return 'object';
        }
        return typeof value;
    };

    // 规则4：判断两个对象是否具有相同的形状（80% 相似度阈值）
    const isSameShape = (a: any, b: any): boolean => {
        if (typeof a !== typeof b) return false;
        if (typeof a !== 'object' || a === null || b === null) {
            return a === b;
        }
        if (Array.isArray(a) !== Array.isArray(b)) return false;

        const keysA = Object.keys(a);
        const keysB = Object.keys(b);
        if (keysA.length === 0 && keysB.length === 0) return true;

        // 计算交集
        const commonKeys = keysA.filter(k => keysB.includes(k));
        const allKeys = new Set([...keysA, ...keysB]);
        const similarity = commonKeys.length / allKeys.size;

        // 相似度需要 >= 80%
        if (similarity < 0.8) return false;

        // 检查共同字段的类型是否一致
        for (const key of commonKeys) {
            const typeA = getValueType(a[key]);
            const typeB = getValueType(b[key]);
            if (typeA !== typeB) {
                // 如果都是对象，递归检查
                if (typeA === 'object' && typeB === 'object') {
                    if (!isSameShape(a[key], b[key])) return false;
                } else {
                    return false;
                }
            }
        }

        return true;
    };

    // 规则2：判断 key 是否"不可作为 Go 字段名"
    const isInvalidGoFieldName = (key: string): boolean => {
        // 数字开头
        if (/^\d/.test(key)) return true;

        // 含有大量数字（超过 key 长度的 30%）
        const digitCount = (key.match(/\d/g) || []).length;
        if (digitCount / key.length > 0.3) return true;

        // 看起来像业务 ID（uuid、hash、code 等模式）
        const idPatterns = [
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, // UUID
            /^[0-9a-f]{32,}$/i, // Hash
            /^[a-z0-9]{16,}$/i, // 长 ID
            /_\d{4,}/, // 下划线+年份等
            /-\d{4,}/, // 横线+年份等
        ];
        if (idPatterns.some(pattern => pattern.test(key))) return true;

        return false;
    };

    // 规则1：分析 key 形态一致性（提取正则特征）
    const analyzeKeyPattern = (keys: string[]): { pattern: string | null; similarity: number } => {
        if (keys.length < 2) return { pattern: null, similarity: 0 };

        // 尝试提取共同前缀
        let commonPrefix = '';
        const minLength = Math.min(...keys.map(k => k.length));
        for (let i = 0; i < minLength; i++) {
            const char = keys[0][i];
            if (keys.every(k => k[i] === char)) {
                commonPrefix += char;
            } else {
                break;
            }
        }

        // 尝试提取共同后缀
        let commonSuffix = '';
        for (let i = 1; i <= minLength; i++) {
            const char = keys[0][keys[0].length - i];
            if (keys.every(k => k[k.length - i] === char)) {
                commonSuffix = char + commonSuffix;
            } else {
                break;
            }
        }

        // 如果前缀或后缀足够长，认为有模式
        if (commonPrefix.length >= 3 || commonSuffix.length >= 3) {
            // 构建正则模式（简化版：前缀+可变部分+后缀）
            const pattern = commonPrefix.length >= 3 ? `^${commonPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}.*` : `.*${commonSuffix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`;
            return { pattern, similarity: 0.7 };
        }

        // 检查是否有相似的分隔符模式（如 model_xxx, user_xxx）
        const separatorPatterns = [
            /^[a-z]+_[a-z0-9_]+$/i, // 下划线分隔
            /^[a-z]+-[a-z0-9-]+$/i, // 横线分隔
        ];

        const matchingPattern = separatorPatterns.find(pattern => keys.every(k => pattern.test(k)));

        if (matchingPattern) {
            // 提取基础部分（如 model_ 或 user-）
            const baseParts = keys.map(k => {
                const match = k.match(/^([a-z]+)[_-]/i);
                return match ? match[1] : '';
            });
            if (baseParts.every(p => p && p === baseParts[0])) {
                return { pattern: `^${baseParts[0]}[_-].*`, similarity: 0.8 };
            }
        }

        return { pattern: null, similarity: 0 };
    };

    // 智能判断：应该使用 map 还是 struct
    const shouldUseMap = (obj: Record<string, any>): boolean => {
        const keys = Object.keys(obj);
        const values = Object.values(obj);

        // 规则2：检查是否有无效的 Go 字段名（优先级最高）
        // 如果 key 是数字开头或完全由数字组成，必须使用 map（Go 语法要求）
        const invalidKeyCount = keys.filter(isInvalidGoFieldName).length;
        if (invalidKeyCount > 0) {
            // 只要有无效的 key，就使用 map（因为无法生成合法的 struct）
            // 特别是数字开头的 key，Go 语法不允许作为字段名
            if (keys.some(k => /^\d/.test(k))) {
                return true; // 数字开头的 key 必须用 map
            }
            // 其他无效 key，如果超过 50% 也使用 map
            if (invalidKeyCount / keys.length >= 0.5) {
                return true;
            }
        }

        // 规则3：Key 数量阈值（>= 5 个开始考虑 map）
        if (keys.length >= 5) {
            // 继续检查其他规则
        } else if (keys.length < 3) {
            // 少于 3 个 key，倾向于 struct（但前提是 key 都是有效的）
            return false;
        }

        // 规则1：Key 形态一致性 + Value 结构一致性
        const keyAnalysis = analyzeKeyPattern(keys);
        if (keyAnalysis.pattern && keyAnalysis.similarity >= 0.7) {
            // Key 有相似模式，检查 value 结构一致性
            if (values.length >= 2) {
                // 检查所有 value 是否具有相同形状
                let sameShapeCount = 0;
                for (let i = 1; i < values.length; i++) {
                    if (
                        typeof values[i] === 'object' &&
                        values[i] !== null &&
                        !Array.isArray(values[i]) &&
                        typeof values[0] === 'object' &&
                        values[0] !== null &&
                        !Array.isArray(values[0])
                    ) {
                        if (isSameShape(values[0], values[i])) {
                            sameShapeCount++;
                        }
                    }
                }
                const shapeSimilarity = sameShapeCount / (values.length - 1);
                // 如果 80% 以上的 value 形状相同，使用 map
                if (shapeSimilarity >= 0.8) {
                    return true;
                }
            }
        }

        // 默认使用 struct
        return false;
    };

    // 获取 Go 类型
    const getGoType = (value: any, key: string, parentKey: string = '', isMapValue: boolean = false): string => {
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

    // 处理结构体或 map
    const processStruct = (obj: any, structName: string, parentKey: string = '', isRoot: boolean = false): string => {
        // 处理数组特殊情况
        if (Array.isArray(obj)) {
            if (obj.length === 0) return '';

            // 过滤出所有对象类型的元素
            const objectElements = obj.filter(item => typeof item === 'object' && item !== null && !Array.isArray(item));

            if (objectElements.length === 0) return '';

            // 确定数组元素的类型名
            // 如果 isRoot，使用 "Item" 作为元素类型名；否则使用 parentKey 或 structName
            const elementTypeName = isRoot ? 'Item' : parentKey ? getStructName(parentKey, parentKey) : structName || 'Item';

            // 检查数组元素是否应该使用 map
            // 如果所有元素的 key 集合不同，应该使用 map
            if (objectElements.length > 1) {
                const allKeys = new Set<string>();
                objectElements.forEach(elem => {
                    Object.keys(elem).forEach(k => allKeys.add(k));
                });

                // 检查每个元素的 key 集合是否相同
                const firstKeys = new Set(Object.keys(objectElements[0]));
                const allSameKeys = objectElements.every(elem => {
                    const elemKeys = new Set(Object.keys(elem));
                    if (elemKeys.size !== firstKeys.size) return false;
                    return Array.from(elemKeys).every(k => firstKeys.has(k));
                });

                // 如果 key 集合不同，检查是否应该用 map
                if (!allSameKeys) {
                    // 收集所有元素的 value（用于检查 value 结构是否一致）
                    const allValues: any[] = [];
                    objectElements.forEach(elem => {
                        Object.values(elem).forEach(val => {
                            if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
                                allValues.push(val);
                            }
                        });
                    });

                    // 检查所有 value 的结构是否一致
                    let valuesSameShape = true;
                    if (allValues.length >= 2) {
                        const firstValue = allValues[0];
                        for (let i = 1; i < allValues.length; i++) {
                            if (!isSameShape(firstValue, allValues[i])) {
                                valuesSameShape = false;
                                break;
                            }
                        }
                    }

                    // 如果 value 结构一致，使用 map[string]ValueType
                    if (valuesSameShape && allValues.length > 0) {
                        const valueTypeName = elementTypeName + 'Value';
                        const valueStructDef = processStruct(allValues[0], valueTypeName, parentKey, false);

                        // 生成数组类型：[]map[string]ValueType
                        // 如果 isRoot，使用 structName 作为最终类型名；否则使用 elementTypeName
                        const finalTypeName = isRoot ? structName : elementTypeName;
                        const mapTypeName = elementTypeName;
                        return valueStructDef + `type ${mapTypeName} map[string]${valueTypeName}\n\n` + (isRoot ? `type ${finalTypeName} []${mapTypeName}\n\n` : '');
                    } else {
                        // Value 结构不一致，使用 map[string]interface{}
                        const finalTypeName = isRoot ? structName : elementTypeName;
                        const mapTypeName = elementTypeName;
                        return `type ${mapTypeName} map[string]interface{}\n\n` + (isRoot ? `type ${finalTypeName} []${mapTypeName}\n\n` : '');
                    }
                }
            }

            // Key 集合相同，使用第一个元素作为模板
            const elementDef = processStruct(objectElements[0], elementTypeName, parentKey, false);
            if (isRoot) {
                return elementDef + `type ${structName} []${elementTypeName}\n\n`;
            }
            return elementDef;
        }

        // 如果不是对象，直接返回
        if (typeof obj !== 'object' || obj === null) {
            return '';
        }

        const keys = Object.keys(obj);
        if (keys.length === 0) {
            return '';
        }

        // 智能判断：应该使用 map 还是 struct
        const useMap = shouldUseMap(obj);

        if (useMap) {
            // 处理 map 情况
            // 找到第一个非空对象 value 作为模板
            let templateValue: any = null;
            for (const value of Object.values(obj)) {
                if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                    templateValue = value;
                    break;
                }
            }

            if (templateValue) {
                // 生成 value 类型对应的结构体
                const valueTypeName = structName.endsWith('Map') ? structName.replace(/Map$/, 'Value') : structName + 'Value';

                // 递归处理 value 类型（可能是 struct 或 map）
                const valueStructDef = processStruct(templateValue, valueTypeName, parentKey, false);

                // 生成 map 类型定义
                let mapDef = valueStructDef || '';

                // 如果当前是根对象，生成 map 类型别名
                if (isRoot) {
                    mapDef += `type ${structName} map[string]${valueTypeName}\n\n`;
                } else {
                    // 非根对象，需要返回一个特殊标记，让调用方知道这是 map
                    // 但我们仍然需要生成 value 类型定义
                    // 使用一个特殊的前缀来标记这是 map 类型
                    return `__MAP_TYPE__:${valueTypeName}:${mapDef}`;
                }

                return mapDef;
            } else {
                // 所有 value 都是基本类型，使用 map[string]interface{}
                if (isRoot) {
                    return `type ${structName} map[string]interface{}\n\n`;
                }
                // 非根对象返回特殊标记
                return `__MAP_TYPE__:interface{}:`;
            }
        }

        // 使用 struct（原有逻辑）
        // 对于非数组对象，检查是否已处理过
        if (processedTypes.has(structName)) return '';
        processedTypes.add(structName);

        let structDef = '';

        // 存储字段类型映射（用于处理 map 类型）
        const fieldTypeMap = new Map<string, string>();

        // 先处理所有嵌套的结构体
        for (const [key, value] of Object.entries(obj)) {
            if (typeof value === 'object' && value !== null) {
                if (Array.isArray(value)) {
                    if (value.length > 0 && typeof value[0] === 'object') {
                        const itemType = getStructName(key);
                        structDef += processStruct(value[0], itemType, key, false);
                    }
                } else {
                    const subType = getStructName(key);
                    const nestedResult = processStruct(value, subType, key, false);

                    // 检查返回的是 map 类型标记
                    if (nestedResult && nestedResult.startsWith('__MAP_TYPE__:')) {
                        // 解析 map 类型标记：__MAP_TYPE__:ValueTypeName:ValueDef
                        const parts = nestedResult.split(':');
                        if (parts.length >= 2) {
                            const valueTypeName = parts[1];
                            const valueDef = parts.slice(2).join(':');
                            // 添加 value 类型定义
                            if (valueDef) {
                                structDef += valueDef;
                            }
                            // 记录字段类型为 map
                            fieldTypeMap.set(key, `map[string]${valueTypeName}`);
                        }
                    } else {
                        // 正常的结构体定义
                        structDef += nestedResult;
                    }
                }
            }
        }

        // 然后添加当前结构体的定义
        structDef += `type ${structName} struct {\n`;

        // 使用固定的 4 个空格作为 Go 结构体的缩进
        const indent = '    ';
        for (const [key, value] of Object.entries(obj)) {
            const fieldName = toCamelCase(key);
            let goType = fieldTypeMap.get(key);

            // 如果没有在 map 类型映射中找到，使用常规类型
            if (!goType) {
                goType = getGoType(value, key, parentKey, false);
            }

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
        // 如果顶层是数组，使用 'Root' 作为最终类型名，'Item' 作为元素类型名
        if (Array.isArray(obj)) {
            if (obj.length > 0 && typeof obj[0] === 'object') {
                // 对于数组，structName 是最终类型名（Root），元素类型名在 processStruct 内部处理
                result = processStruct(obj, 'Root', '', true);
            } else {
                result = processStruct(obj, 'Root', '', true);
            }
        } else {
            result = processStruct(obj, 'Root', '', true);
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
            .split(/[;\n]/) // 分割多个 cookie（支持分号或换行分隔）
            .map(pair => pair.trim())
            .filter(pair => pair) // 过滤空值
            .reduce((acc: Record<string, any>, pair) => {
                // 处理键值对
                const [key, ...values] = pair.split('=');
                const value = values.join('='); // 处理值中包含等号的情况

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
        showMessageError('无法获取文件');
        return;
    }

    try {
        // 检查文件名长度
        if (file.name.length > 255) {
            showMessageError('文件名过长');
            return;
        }

        // 检查文件扩展名
        if (!file.name.toLowerCase().endsWith('.json')) {
            showMessageError('只能上传 JSON 文件');
            return;
        }

        // 检查文件大小
        if (file.size > MAX_FILE_SIZE) {
            showMessageError('文件大小不能超过 5 MB');
            return;
        }

        // 检查 MIME 类型
        if (file.type && !['application/json', 'text/plain'].includes(file.type)) {
            showMessageError('文件类型不正确');
            return;
        }

        // 读取文件内容
        const content = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = e => {
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
            showMessageError(`文件内容超过行数限制（共 ${lines.length} 行）`);
            return;
        }

        // 格式化JSON内容为2个空格缩进
        let formattedContent = content;
        let isValidJson = false;

        try {
            // 尝试解析并重新格式化为2个空格缩进
            const parsed = JSON.parse(content);
            formattedContent = JSON.stringify(parsed, null, 2);
            isValidJson = true;
        } catch (error) {
            // 如果不是有效的JSON，保持原始内容
            formattedContent = content;
        }

        // 更新编辑器 - 将格式化后的内容展示到输入区域
        if (inputEditor) {
            inputEditor.setValue(formattedContent);

            // 根据内容类型设置缩进配置
            let size: number;
            let insertSpaces: boolean;

            if (isValidJson) {
                // 对于有效的JSON，统一使用2个空格缩进
                size = 2;
                insertSpaces = true;
            } else {
                // 对于无效JSON或纯文本，根据内容自动检测缩进
                const detectIndentSize = (text: string): { size: number; insertSpaces: boolean } => {
                    const lines = text.split('\n');
                    for (const line of lines) {
                        const match = line.match(/^[ \t]+(?=\S)/);
                        if (match) {
                            const indentStr = match[0];
                            if (indentStr.includes('\t')) {
                                return { size: 4, insertSpaces: false };
                            }
                            return { size: indentStr.length || 2, insertSpaces: true };
                        }
                    }
                    return { size: 2, insertSpaces: true };
                };

                const detected = detectIndentSize(formattedContent);
                size = detected.size;
                insertSpaces = detected.insertSpaces;
            }

            updateLineNumberWidth(inputEditor);
            updateEditorHeight(inputEditor);

            const model = inputEditor.getModel();
            model?.updateOptions({
                tabSize: size,
                indentSize: size,
                insertSpaces,
            });
            // 同时更新编辑器选项
            inputEditor.updateOptions({
                tabSize: size,
                indentSize: size,
                insertSpaces,
            } as any);
        }

        // 清空outputEditor的内容
        outputEditor?.setValue('');
        updateLineNumberWidth(outputEditor);
        updateEditorHeight(outputEditor);

        // 显示成功提示
        showMessageSuccess('文件上传成功，已加载到输入区域');
    } catch (error: any) {
        showMessageError('文件处理失败: ' + error.message);
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
                    inputEditor.executeEdits('clear-input', [
                        {
                            range: fullRange,
                            text: '',
                        },
                    ]);
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
                    outputEditor.executeEdits('clear-output', [
                        {
                            range: fullRange,
                            text: '',
                        },
                    ]);
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

        showMessageSuccess('已清空内容');
    } catch (error: any) {
        showMessageError('清空内容失败');
    }
};

// 复制输出
const copyOutput = async () => {
    try {
        const value = outputEditor?.getValue() || '';
        if (!value) {
            showMessageWarning('没有可复制的内容');
            return;
        }

        try {
            await navigator.clipboard.writeText(value);
            showMessageSuccess('复制成功');
        } catch (err) {
            showMessageError('复制失败, 请尝试手动复制');

            // 自动选择内容以方便用户复制
            outputEditor?.focus();
            outputEditor?.getModel()?.getFullModelRange();
            outputEditor?.setSelection(outputEditor.getModel()?.getFullModelRange() || new monaco.Range(0, 0, 0, 0));
        }
    } catch (error: any) {
        showMessageError('复制失败, 请尝试手动复制');
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
        showMessageWarning('没有可下载的内容');
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
            go: '.go',
        };
        const fileExtension = fileExtensionMap[outputType.value];

        const mimeTypeMap: Record<'json' | 'yaml' | 'toml' | 'xml' | 'go', string> = {
            json: 'application/json',
            yaml: 'text/yaml',
            toml: 'text/plain',
            xml: 'application/xml',
            go: 'text/plain',
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

        showMessageSuccess('下载成功');
    } catch (error: any) {
        showMessageError('下载失败：' + (error?.message || '未知错误'));
    }
};

// 切换全屏状态
const toggleFullscreen = () => {
    isFullscreen.value = !isFullscreen.value;
};

// 处理默认全屏设置切换，同时同步当前全屏状态
const handleInitialFullscreenChange = (value: boolean | string | number) => {
    const normalizedValue = value === true || value === 'true' || value === 1;
    startInFullscreen.value = normalizedValue;
    if (normalizedValue) {
        isFullscreen.value = true;
    } else if (isFullscreen.value) {
        isFullscreen.value = false;
    }
};

// 监听 ESC 键退出全屏
const handleEscapeKey = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && isFullscreen.value) {
        isFullscreen.value = false;
    }
};

// 拖动时也要更新预览区域布局，让滚动条紧贴右边界，但需要恢复滚动内容位置
const updateEditorLayouts = (updateOutputEditor: boolean = true, forceWidth?: { inputWidth?: number; outputWidth?: number }) => {
    // 如果没有传入强制宽度，使用面板的实际宽度，避免受到存档侧边栏宽度的影响
    let inputWidth = forceWidth?.inputWidth;
    let outputWidth = forceWidth?.outputWidth;

    if (inputWidth === undefined || outputWidth === undefined) {
        const panels = document.querySelectorAll('.editor-container .editor-panel') as NodeListOf<HTMLElement>;
        if (panels.length >= 2) {
            const [leftPanel, rightPanel] = panels;
            inputWidth = inputWidth ?? leftPanel.clientWidth;
            outputWidth = outputWidth ?? rightPanel.clientWidth;
        }
    }

    if (inputEditor && inputWidth !== undefined) {
        const container = inputEditor.getContainerDomNode();
        inputEditor.layout({
            width: inputWidth,
            height: container.clientHeight,
        });
    }
    if (outputEditor && updateOutputEditor && outputWidth !== undefined) {
        const container = outputEditor.getContainerDomNode();
        outputEditor.layout({
            width: outputWidth,
            height: container.clientHeight,
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
    const clampedX = Math.max(resizeState.rect.left + resizeState.minWidthPx, Math.min(clientX, resizeState.rect.right - resizeState.minWidthPx));

    // 计算新的百分比宽度
    const deltaX = clampedX - resizeState.initialX;
    const deltaPercentage = (deltaX / resizeState.rect.width) * 100;
    const newWidth = Math.min(Math.max(resizeState.initialPercentage + deltaPercentage, resizeState.minWidthPercent), resizeState.maxWidthPercent);

    // 立即更新宽度值（不检查阈值，确保每次移动都响应）
    leftPanelWidth.value = newWidth;

    // 触发防抖更新稳定宽度值
    updateStableWidth();

    // 这样可以确保 Monaco Editor 接收到准确的宽度，从而正确计算滚动条位置
    const containerWidth = resizeState.rect.width;
    const archiveWidth = archives.value.length ? archiveSidebarWidth.value : 0;
    const archiveResizerWidth = archives.value.length ? 3 : 0;
    const resizerWidth = 24; // 中间分割线宽度（固定值）
    const availableWidth = containerWidth - archiveWidth - archiveResizerWidth - resizerWidth;

    // 计算面板的实际宽度（考虑存档侧边栏和分割线）
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
    document.addEventListener('pointermove', handlePointerMove as EventListener, {
        passive: true,
    });
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
        showMessageWarning('当前内容类型不支持转移到输入区域');
        return;
    }

    try {
        const outputContent = outputEditor?.getValue() || '';
        if (!outputContent.trim()) {
            showMessageWarning('预览区域内容为空, 无需转移');
            return;
        }


        const targetIndentSize = 2; // 输入区域固定使用2个空格缩进
        let formattedContent: string;

        try {
            // 直接重新格式化缩进，保持原始字符串表示不变
            formattedContent = reformatJsonIndentation(outputContent, targetIndentSize);
        } catch (parseError) {
            // 如果解析失败，使用原始内容
            formattedContent = outputContent;
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
                        text: formattedContent,
                    },
                ]);
                inputEditor.pushUndoStop();
                updateLineNumberWidth(inputEditor);
                updateEditorHeight(inputEditor);

                // 确保输入编辑器使用固定的2个空格缩进
                inputModel.updateOptions({
                    tabSize: 2,
                    indentSize: 2,
                    insertSpaces: true,
                });
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

        showMessageSuccess('内容已成功转移到输入区域');
    } catch (error: any) {
        showMessageError('转移内容失败: ' + error.message);
    }
};
</script>

<style scoped>
/* 折叠信息文本样式 */
:deep(.folding-info-text) {
    color: #909399;
}

.json-tool-container {
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
    color: #e6a23c;
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
    left: 0;
    right: 0;
    width: 100vw;
    height: 100vh;
    background-color: #f0f2f5;
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
    display: flex;
    align-items: center;
    min-height: 48px;
}

.tool-bar {
    padding: 6px;
    display: flex;
    align-items: center;
    gap: 0;
    flex-wrap: nowrap;
    flex-shrink: 0;
    overflow-x: auto;
    overflow-y: hidden;
    background-color: #ffffff;
    position: relative;
    flex: 1;
    scroll-behavior: smooth;
    scrollbar-width: none;
    /* Firefox 隐藏滚动条 */
    -ms-overflow-style: none;
    /* IE/Edge 隐藏滚动条 */
}

/* 工具栏滚动条隐藏 */
.tool-bar::-webkit-scrollbar {
    display: none;
    /* Chrome/Safari 隐藏滚动条 */
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
.tool-bar > .el-button,
.tool-bar > .el-button-group,
.tool-bar > .el-dropdown,
.tool-bar > .collapse-control {
    margin-left: 10px;
    flex-shrink: 0;
    white-space: nowrap;
}

.tool-bar > .el-button:first-child,
.tool-bar > .el-button-group:first-child,
.tool-bar > .el-dropdown:first-child,
.tool-bar > .collapse-control:first-child {
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
    .tool-bar > .el-button,
    .tool-bar > .el-button-group,
    .tool-bar > .el-dropdown,
    .tool-bar > .collapse-control {
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

/* 同步滚动按钮自定义为蓝色 */
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

/* 添加分隔线样式 */
.resizer {
    width: 20px;
    background-color: #eef0f6;
    cursor: col-resize;
    touch-action: none;
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
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 4px;
    height: 40px;
    background-color: #c0c4cc;
}

.panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-shrink: 0;
    padding: 5px 15px;
    background: linear-gradient(to bottom, #fafbfc, #f6f8fa);
    border-bottom: 1px solid #e4e7ed;
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
    color: #409eff;
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
    border-top: none;
    display: flex;
    align-items: center;
    padding: 0 10px;
    flex-shrink: 0;
    font-size: 12px;
    color: #606266;
    box-shadow: 0 -1px 2px rgba(0, 0, 0, 0.02);
}

.editor-status-bar .status-text {
    user-select: none;
    white-space: nowrap;
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', 'source-code-pro', monospace;
}

/* 折叠进度条样式 */
.fold-progress {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
}
.fold-progress-bar {
    flex: 1;
    height: 8px;
    background: #eef2ff;
    border-radius: 4px;
    overflow: hidden;
    box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.04);
}
.fold-progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #1e3a8a, #06b6d4);
    width: 0%;
    transition: width 120ms linear;
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

/* 自定义当前行高亮样式 */
:deep(.monaco-editor .current-line) {
    background-color: rgba(64, 158, 255, 0.06) !important;
    border: none !important;
    height: 16px !important;
    /* 设置与行高一致的高度 */
}

/* 禁用行号区域的高亮 */
:deep(.monaco-editor .current-line-margin) {
    background-color: transparent !important;
}

:deep(.monaco-editor .margin .current-line) {
    background-color: transparent !important;
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

/* 当设置弹窗打开时，隐藏其遮罩层的滚动条 */
:deep(.el-overlay-dialog) {
    /* 隐藏滚动条但保持滚动功能 */
    scrollbar-width: none;
    /* Firefox */
    -ms-overflow-style: none;
    /* IE 和 Edge */
}

:deep(.el-overlay-dialog)::-webkit-scrollbar {
    display: none;
    /* Chrome, Safari, Opera */
    width: 0;
    height: 0;
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
    top: 7px;
    left: 50%;
    transform: translate(-50%, 0);
    background-color: #ffffff;
    border-radius: 3px;
    cursor: pointer;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
}

.transfer-button:hover {
    background-color: #f5f7fa;
    border-color: #bbb;
}

.transfer-button .el-icon {
    font-size: 16px;
    color: #409eff;
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
    &[aria-hidden='true'] {
        visibility: hidden !important;
        height: 0 !important;
        overflow: hidden !important;
        opacity: 0 !important;
    }

    &[aria-hidden='false'] {
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

/* 排序弹窗：只读值样式 */
.form-value-text {
    color: #2f3b45;
    font-weight: 600;
    font-size: 15px;
    display: inline-block;
    margin-top: 0;
    line-height: 1;
    letter-spacing: 0.2px;
}

.form-item .form-label {
    font-weight: 500;
    color: #606266;
    margin-bottom: 6px;
}

.form-item-row {
    display: flex;
    align-items: center;
}

/* 极简单行展示：紧凑无间距，像 '排序方向：正序（升序）' */
.form-value-quote--compact {
    padding: 12px 16px;
    border-radius: 8px;
    background: #f6f7f9;
    border: 1px solid rgba(20, 30, 40, 0.04);
    box-sizing: border-box;
}
.form-compact-line {
    font-weight: 600;
    color: #394149;
    font-size: 15px;
    display: inline-block;
    white-space: nowrap;
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

/* 确保弹窗内容区域可以滚动 */
.settings-dialog-wrapper :deep(.el-dialog__body) {
    overflow-y: auto;
    flex: 1;
    min-height: 0;
    /* 重要：允许 flex 子元素缩小 */
    max-height: 100%;
    /* 确保不超过父容器高度 */
}

.settings-dialog-content {
    padding: 0;
}

/* 手风琴样式 */
.settings-dialog-content :deep(.el-collapse) {
    border: none;
}

.settings-dialog-content :deep(.el-collapse-item) {
    border-radius: 4px;
    margin-bottom: 8px;
}

.settings-dialog-content :deep(.el-collapse-item:last-child) {
    margin-bottom: 0;
}

.settings-dialog-content :deep(.el-collapse-item__header) {
    box-sizing: border-box;
    /* 避免 padding 改变元素总宽度 */
    display: flex;
    /* 使用 flex 布局，标题在左，箭头在右 */
    align-items: center;
    justify-content: space-between;
    padding: 0;
    /* 内边距交给内部容器 .settings-collapse-title 控制 */

    background-color: #f5f7fa;
    border-radius: 4px;
    font-size: 15px;
    font-weight: 600;
    color: #303133;
    height: auto;
    line-height: 1.4;
}

/* 覆盖 Element Plus 的右侧额外 padding，使左右间距由内部容器控制 */
.settings-dialog-content :deep(.el-collapse-icon-position-right .el-collapse-item__header) {
    padding-right: 24px;
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
    width: auto;
    /* 不再占满整行，避免把箭头推远 */
    flex: 0 1 auto;
    /* 保持自适应且允许换行收缩 */
    padding: 12px 24px;
    /* 与折叠项的内部间距一致，保证左右对称视觉 */
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
    grid-template-columns: repeat(5, 1fr);
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

/* 存档侧边栏样式 */
.archive-sidebar {
    display: flex;
    flex-direction: column;
    background-color: #f8fafc;
    padding: 10px 5px;
    box-sizing: border-box;
    transition: width 0.1s ease;
    flex-shrink: 0;
}

.archive-sidebar.collapsed {
    padding: 10px 5px;
}

.archive-sidebar.collapsed .archive-item {
    justify-content: center;
    padding: 5px 0;
}

.archive-sidebar.collapsed .archive-name {
    text-align: center;
    background-color: #edf5ff;
    color: #409eff;
    border-radius: 2px;
    min-width: 20px;
    padding: 2px 4px;
    display: inline-block;
}

.archive-sidebar-header {
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 8px;
}

.archive-sidebar-title {
    font-size: 13px;
    font-weight: 600;
    color: #606266;
}

/* 存档侧边栏分割线 */
.archive-resizer {
    width: 3px;
    background-color: #e4e7ed;
    cursor: col-resize;
    touch-action: none;
    flex-shrink: 0;
    position: relative;
    transition: background-color 0.2s;
}

.archive-resizer:hover {
    background-color: #409eff;
}

.archive-resizer:active {
    background-color: #409eff;
}

.archive-list {
    flex: 1;
    overflow-y: auto;
}

.archive-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 4px 4px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
    color: #606266;
    transition: background-color 0.12s ease, box-shadow 0.12s ease, opacity 0.12s ease;
}

.archive-item.drag-ready {
    background-color: #f7faff;
}

.archive-name {
    flex: 1;
    white-space: nowrap;
    text-overflow: ellipsis;
    overflow: hidden;
    user-select: none;
}

.archive-actions {
    display: flex;
    align-items: center;
}

.archive-item.dragging {
    opacity: 0.7;
    background-color: #eef5ff;
}

.archive-item.drag-over {
    background-color: #f7faff;
}

.archive-drop-indicator {
    height: 2px;
    background: #409eff;
    margin: 2px 0;
    border-radius: 1px;
    pointer-events: none;
}

.archive-action-icon {
    font-size: 14px;
    color: #909399;
    cursor: pointer;
}

.archive-action-icon:not(:first-child) {
    margin-left: 4px;
}

.archive-action-icon:hover {
    color: #409eff;
}

.archive-empty {
    font-size: 12px;
    color: #c0c4cc;
}

/* 字段排序演示样式 */
.demo-container {
    max-height: 600px;
    overflow-y: auto;
}

.demo-section {
    margin-bottom: 24px;
    padding: 16px;
    border: 1px solid #e4e7ed;
    border-radius: 6px;
    background: #fafbfc;
}

.demo-section h3 {
    margin: 0 0 12px 0;
    color: #303133;
    font-size: 16px;
    font-weight: 600;
}

.demo-data pre,
.demo-result pre {
    background: #f6f8fa;
    border: 1px solid #e1e4e7;
    border-radius: 4px;
    padding: 12px;
    margin: 8px 0 0 0;
    font-size: 12px;
    line-height: 1.4;
    overflow-x: auto;
    max-height: 300px;
    overflow-y: auto;
}

.demo-config {
    background: #fff;
    border: 1px solid #d1d5db;
    border-radius: 4px;
    padding: 12px;
    margin-bottom: 12px;
    font-size: 14px;
    line-height: 1.5;
}

.demo-config code {
    background: #f1f3f4;
    padding: 2px 6px;
    border-radius: 3px;
    font-family: 'Monaco', 'Menlo', monospace;
    font-size: 13px;
    color: #d73a49;
}

.demo-result {
    font-size: 14px;
}

/* 演示模式样式 */
.demo-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.3);
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
}

.demo-content {
    position: relative;
    max-width: 90vw;
    max-height: 90vh;
}

.demo-guide-popup {
    background: white;
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
    width: 640px;
    animation: demoPopup 0.3s ease-out;
}

@keyframes demoPopup {
    from {
        opacity: 0;
        transform: scale(0.9) translateY(-20px);
    }

    to {
        opacity: 1;
        transform: scale(1) translateY(0);
    }
}

.demo-guide-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 24px;
    border-bottom: 1px solid #f0f0f0;
    margin-bottom: 12px;
}

.demo-guide-header h3 {
    margin: 0;
    color: #303133;
    font-size: 18px;
    font-weight: 600;
}

.demo-close-btn {
    background: none;
    border: none;
    font-size: 24px;
    color: #909399;
    cursor: pointer;
    padding: 0;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
}


.demo-guide-header {
    cursor: move;
    user-select: none;
}

.demo-guide-content {
    padding: 0 24px;
}

.demo-guide-content p {
    margin: 0 0 20px 0;
    color: #606266;
    font-size: 14px;
    line-height: 1.6;
}

.demo-guide-footer {
    padding: 0 24px 24px;
    text-align: right;
}

.demo-guide-footer .el-button {
    margin-left: 8px;
}

.demo-step-indicator {
    display: flex;
    justify-content: center;
    padding: 0 24px 20px;
    gap: 8px;
}

.step-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #e4e7ed;
    transition: background-color 0.3s;
}

.step-dot.active {
    background: #409eff;
}

/* 演示模式下的高亮效果 */
.demo-highlight {
    position: relative;
    z-index: 10000;
}

.demo-highlight::before {
    content: '';
    position: absolute;
    top: -4px;
    left: -4px;
    right: -4px;
    bottom: -4px;
    background: #409eff;
    border-radius: 6px;
    z-index: -1;
    animation: highlightPulse 2s infinite;
}

@keyframes highlightPulse {
    0%,
    100% {
        opacity: 0.3;
    }

    50% {
        opacity: 0.8;
    }
}

/* 当前设置区域样式，增加与按钮的间距 */
.demo-current-settings {
    margin-top: 12px;
    margin-bottom: 18px;
    color: #606266;
    font-size: 14px;
    line-height: 1.6;
    word-break: break-word;
}
</style>
