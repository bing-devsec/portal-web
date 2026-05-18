<template>
    <div>
        <!-- 添加小屏幕提示组件 -->
        <div class="screen-size-warning">
            <el-icon class="warning-icon">
                <WarningFilled />
            </el-icon>
            <div class="warning-text">
                <p>{{ settingsTxt.screenWarn1 }}</p>
                <p>{{ settingsTxt.screenWarn2 }}</p>
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

                <!-- Diff 模式工具栏 -->
                <div v-if="isDiffMode" class="tool-bar diff-tool-bar">
                    <el-button type="info" @click="openSettingsDialog" circle>
                        <el-icon><Setting /></el-icon>
                    </el-button>
                    <div class="diff-nav-group">
                        <el-button-group>
                            <el-button type="primary" @click="goToPrevDiff" :disabled="diffCount === 0">
                                <el-icon><ArrowLeft /></el-icon>
                                <span>{{ settingsTxt.diffPrev }}</span>
                            </el-button>
                            <el-button type="primary" @click="goToNextDiff" :disabled="diffCount === 0">
                                <span>{{ settingsTxt.diffNext }}</span>
                                <el-icon><ArrowRight /></el-icon>
                            </el-button>
                        </el-button-group>
                    </div>
                    <el-button type="info" @click="exitDiffMode">{{ settingsTxt.diffExit }}</el-button>
                </div>

                <!-- 普通模式工具栏 -->
                <div v-else class="tool-bar" ref="toolBarRef" @scroll="handleToolBarScroll">
                    <el-button type="info" @click="openSettingsDialog" circle>
                        <el-icon>
                            <Setting />
                        </el-icon>
                    </el-button>

                    <!-- 演示模式下，除"设置"按钮外的所有功能暂时禁用，避免用户误操作打断引导流程 -->
                    <div class="toolbar-actions" :class="{ 'demo-locked-area': isDemoMode }">
                        <el-button-group>
                            <el-button v-if="buttonVisibility.fetchJson" type="primary" @click="openFetchJsonDialog">{{ settingsTxt.toolFetchJson }}</el-button>
                            <el-button v-if="buttonVisibility.format" type="primary" :disabled="!canUseProcessingFeatures" @click="formatJSON">{{ settingsTxt.toolFormat }}</el-button>
                            <el-button v-if="buttonVisibility.compress" type="primary" :disabled="!canUseProcessingFeatures" @click="compressJSON">{{ settingsTxt.toolCompress }}</el-button>
                            <el-button v-if="buttonVisibility.escape" type="primary" :disabled="!canUseProcessingFeatures" @click="compressAndEscapeJSON">{{ settingsTxt.toolEscape }}</el-button>
                            <el-button v-if="buttonVisibility.unescape" type="primary" :disabled="!canUseProcessingFeatures" @click="handleEscapeCommand('unescape')">{{ settingsTxt.toolUnescape }}</el-button>
                            <el-button v-if="buttonVisibility.masking" type="primary" :disabled="!canUseProcessingFeatures" @click="openDataMaskingDialog">{{ settingsTxt.toolMasking }}</el-button>
                            <el-button v-if="buttonVisibility.sort" type="primary" :disabled="!canUseProcessingFeatures" @click="handleAdvancedCommand('sort')">{{ settingsTxt.toolSort }}</el-button>
                            <el-button v-if="buttonVisibility.archive" type="primary" :disabled="!canUseProcessingFeatures" @click="handleSaveArchive">{{ settingsTxt.toolArchive }}</el-button>
                            <el-button v-if="buttonVisibility.diff" type="primary" @click="enterDiffMode">{{ settingsTxt.toolDiff }}</el-button>
                            <el-button v-if="buttonVisibility.share" type="primary" :disabled="!canUseProcessingFeatures" @click="openShareDialog">{{ settingsTxt.toolShare }}</el-button>
                        </el-button-group>

                        <el-dropdown v-if="buttonVisibility.dataConvert" trigger="click" @command="handleConvert">
                            <el-button type="primary" :disabled="!canUseProcessingFeatures">
                                {{ settingsTxt.toolDataConvert }}
                                <el-icon class="el-icon--right">
                                    <ArrowDown />
                                </el-icon>
                            </el-button>
                            <template #dropdown>
                                <el-dropdown-menu>
                                    <el-dropdown-item command="yaml">{{ settingsTxt.convertYaml }}</el-dropdown-item>
                                    <el-dropdown-item command="toml">{{ settingsTxt.convertToml }}</el-dropdown-item>
                                    <el-dropdown-item command="xml">{{ settingsTxt.convertXml }}</el-dropdown-item>
                                    <el-dropdown-item command="go">{{ settingsTxt.convertGo }}</el-dropdown-item>
                                    <el-dropdown-item command="cookie">{{ settingsTxt.convertCookie }}</el-dropdown-item>
                                </el-dropdown-menu>
                            </template>
                        </el-dropdown>

                        <div v-if="buttonVisibility.collapse" class="collapse-control">
                            <el-select
                                v-model="selectedLevel"
                                fit-input-width
                                :placeholder="settingsTxt.levelPlaceholder"
                                class="level-select"
                                popper-class="level-select-dropdown"
                                :disabled="maxLevel === 0 || !canUseCollapseFeature"
                            >
                                <el-option v-if="maxLevel === 0" :label="settingsTxt.levelLabel(0)" :value="0" :disabled="true" />
                                <el-option
                                    v-for="n in maxLevel"
                                    :key="n"
                                    :label="getFoldLevelOptionLabel(n)"
                                    :value="n"
                                    :disabled="isFoldLevelDisabled(n)"
                                />
                            </el-select>
                            <el-button type="success" @click="handleLevelAction" :disabled="maxLevel === 0 || !canUseCollapseFeature || isSelectedFoldLevelDisabled">{{ settingsTxt.collapse }}</el-button>
                        </div>

                        <el-button v-if="buttonVisibility.fullscreen" :type="isFullscreen ? 'info' : 'warning'" class="fullscreen-btn" @click="toggleFullscreen">
                            {{ isFullscreen ? settingsTxt.exitFullscreen : settingsTxt.enterFullscreen }}
                        </el-button>
                    </div>
                </div>

                <!-- 右侧渐变遮罩和滚动按钮 -->
                <div v-if="canScrollRight" class="scroll-indicator scroll-indicator-right">
                    <div class="gradient-mask gradient-mask-right"></div>
                    <el-button type="primary" circle size="small" class="scroll-btn scroll-btn-right" @click="scrollToolBar('right')" :icon="ArrowRight" />
                </div>
            </div>

            <!-- Diff 编辑区域：三列 flex = 左独立 Monaco + 24px 中间面板 + 右独立 Monaco -->
            <div v-if="isDiffMode" class="editor-container diff-editor-container">
                <!-- 顶部 header 行 -->
                <div class="diff-row diff-header-row">
                    <div class="diff-cell diff-cell-left diff-header-cell">
                        <div class="panel-actions diff-panel-actions">
                            <el-button @click="diffFormatJSON('left')" size="small" type="primary" plain>
                                <span>{{ settingsTxt.diffPanelFormat }}</span>
                            </el-button>
                            <el-button @click="diffSortJSON('left')" size="small" type="primary" plain>
                                <span>{{ settingsTxt.diffPanelSort }}</span>
                            </el-button>
                            <el-button @click="diffCopy('left')" size="small" type="success" plain>
                                <span>{{ settingsTxt.diffPanelCopy }}</span>
                            </el-button>
                            <el-button @click="diffClear('left')" size="small" type="danger" plain>
                                <span>{{ settingsTxt.diffPanelClear }}</span>
                            </el-button>
                            <el-upload class="upload-json" accept=".json" :auto-upload="false" :show-file-list="false" :on-change="diffHandleUpload('left')">
                                <el-button size="small" type="info" plain>
                                    <span>{{ settingsTxt.diffPanelUpload }}</span>
                                </el-button>
                            </el-upload>
                            <el-button @click="diffDownload('left')" size="small" type="info" plain>
                                <span>{{ settingsTxt.diffPanelDownload }}</span>
                            </el-button>
                        </div>
                    </div>
                    <div class="diff-cell diff-cell-center diff-header-cell"></div>
                    <div class="diff-cell diff-cell-right diff-header-cell">
                        <div class="panel-actions diff-panel-actions">
                            <el-button @click="diffFormatJSON('right')" size="small" type="primary" plain>
                                <span>{{ settingsTxt.diffPanelFormat }}</span>
                            </el-button>
                            <el-button @click="diffSortJSON('right')" size="small" type="primary" plain>
                                <span>{{ settingsTxt.diffPanelSort }}</span>
                            </el-button>
                            <el-button @click="diffCopy('right')" size="small" type="success" plain>
                                <span>{{ settingsTxt.diffPanelCopy }}</span>
                            </el-button>
                            <el-button @click="diffClear('right')" size="small" type="danger" plain>
                                <span>{{ settingsTxt.diffPanelClear }}</span>
                            </el-button>
                            <el-upload class="upload-json" accept=".json" :auto-upload="false" :show-file-list="false" :on-change="diffHandleUpload('right')">
                                <el-button size="small" type="info" plain>
                                    <span>{{ settingsTxt.diffPanelUpload }}</span>
                                </el-button>
                            </el-upload>
                            <el-button @click="diffDownload('right')" size="small" type="info" plain>
                                <span>{{ settingsTxt.diffPanelDownload }}</span>
                            </el-button>
                        </div>
                    </div>
                </div>

                <!-- 中部编辑器行：三列 flex，左右各挂独立 Monaco，中间是真实的同步面板 -->
                <div class="diff-row diff-editor-row">
                    <div class="diff-cell diff-cell-left diff-editor-host">
                        <div ref="diffLeftEditorContainer" class="diff-editor-instance"></div>
                    </div>
                    <div class="diff-cell diff-cell-center diff-sync-panel">
                        <div
                            v-for="btn in diffSyncButtons"
                            :key="btn.changeIndex"
                            class="diff-sync-btn-group"
                            :class="{ 'is-active': btn.changeIndex === activeDiffIndex }"
                            :style="{ top: btn.top + 'px' }"
                        >
                            <button class="diff-sync-btn diff-sync-btn-left" @click="handleDiffSync(btn.changeIndex, 'left')" :title="settingsTxt.diffSyncTitleLeft">←</button>
                            <button class="diff-sync-btn diff-sync-btn-right" @click="handleDiffSync(btn.changeIndex, 'right')" :title="settingsTxt.diffSyncTitleRight">→</button>
                        </div>
                    </div>
                    <div class="diff-cell diff-cell-right diff-editor-host">
                        <div ref="diffRightEditorContainer" class="diff-editor-instance"></div>
                    </div>
                </div>

                <!-- 底部 status 行 -->
                <div class="diff-row diff-status-row">
                    <div class="diff-cell diff-cell-left editor-status-bar diff-status-bar">
                        <span v-if="diffLeftEditorStatus" class="status-text">{{ diffLeftEditorStatus }}</span>
                    </div>
                    <div class="diff-cell diff-cell-center diff-status-center"></div>
                    <div class="diff-cell diff-cell-right editor-status-bar diff-status-bar">
                        <span v-if="diffRightEditorStatus" class="status-text">{{ diffRightEditorStatus }}</span>
                    </div>
                </div>
            </div>

            <!-- 普通编辑区域 -->
            <div v-else class="editor-container">
                <template v-if="archives.length">
                    <div
                        class="archive-sidebar"
                        :class="{
                            collapsed: archiveSidebarWidth <= calculateArchiveMinWidth(),
                            'archive-dragging': !!draggingArchiveId,
                        }"
                        :style="{ width: archiveSidebarWidth + 'px' }"
                    >
                        <div class="archive-sidebar-header" @dblclick="toggleArchiveSidebar">
                            <span class="archive-sidebar-title">{{ settingsTxt.archiveTitle }}</span>
                        </div>
                        <div class="archive-list" v-if="archives.length" ref="archiveListRef" @dragover="onArchiveListDragOver" @drop="onArchiveListDrop">
                            <template v-for="(item, idx) in archives" :key="item.id">
                                <div v-if="dropIndicatorIndex === idx" class="archive-drop-indicator"></div>
                                <div
                                    class="archive-item"
                                    :draggable="dragEnabledArchiveId === item.id"
                                    @mousedown="onArchivePressStart(item.id, $event)"
                                    @touchstart.passive="onArchivePressStart(item.id, $event)"
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
                                        <el-icon class="archive-action-icon" @click.stop="handleRefreshArchive(item)" :title="settingsTxt.archiveRefreshTip">
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
                        <div v-else-if="archiveSidebarWidth > calculateArchiveMinWidth()" class="archive-empty">{{ settingsTxt.archiveEmpty }}</div>
                    </div>
                    <!-- 分割线 -->
                    <div class="archive-resizer" @mousedown="startArchiveResize" @touchstart.passive="startArchiveResize"></div>
                </template>

                <div class="editor-panel editor-panel-input" :style="{ width: `${leftPanelWidth}%` }">
                    <div class="panel-header" @dblclick="toggleInputMaximize">
                        <div class="panel-title">
                            <span>{{ settingsTxt.panelEditor }}</span>
                        </div>
                        <div
                            class="panel-actions"
                            @dblclick.stop
                            :style="{ '--panel-actions-opacity': showInputActions ? 1 : 0, '--panel-actions-pointer-events': showInputActions ? 'auto' : 'none' }"
                        >
                            <el-button @click="clearInput(true)" size="small" type="danger" plain>
                                <el-icon>
                                    <Delete />
                                </el-icon>
                                <span>{{ settingsTxt.panelClear }}</span>
                            </el-button>
                            <el-upload class="upload-json" accept=".json" :auto-upload="false" :show-file-list="false" :on-change="handleFileUpload">
                                <el-button size="small" type="primary" plain>
                                    <el-icon>
                                        <Upload />
                                    </el-icon>
                                    <span>{{ settingsTxt.panelUpload }}</span>
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
                                <span>{{ settingsTxt.editorLoading }}</span>
                            </div>
                            <div ref="inputEditorContainer" class="monaco-editor-instance"></div>
                        </div>
                        <!-- 编辑区域状态栏 -->
                        <div class="editor-status-bar" v-if="inputEditorStatus || inputEditorErrors.length > 0">
                            <span v-if="inputEditorStatus" class="status-text">{{ inputEditorStatus }}</span>
                            <div v-if="inputEditorErrors.length > 0" class="error-nav-inline" role="group" :aria-label="settingsTxt.errorNavGroup">
                                <el-icon class="error-nav-icon error-warning-icon"><WarningFilled /></el-icon>
                                <span class="error-nav-count">{{ inputEditorErrors.length }}</span>
                                <button type="button" class="error-nav-btn" @click="goToPrevError" :aria-label="settingsTxt.errorNavPrev" :title="settingsTxt.errorNavPrev">
                                    <el-icon class="error-nav-icon error-nav-arrow"><ArrowUp /></el-icon>
                                </button>
                                <button type="button" class="error-nav-btn" @click="goToNextError" :aria-label="settingsTxt.errorNavNext" :title="settingsTxt.errorNavNext">
                                    <el-icon class="error-nav-icon error-nav-arrow"><ArrowDown /></el-icon>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 添加可拖动分隔线 -->
                <div
                    class="resizer"
                    :class="{ 'resizer-locked-during-demo': isDemoMode }"
                    @mousedown="startResize"
                    @touchstart.passive="startResize"
                >
                    <el-button class="transfer-button" type="primary" circle :disabled="isDemoMode" @click.stop="transferToInput" :aria-label="settingsTxt.transferToInput">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-hidden="true" focusable="false">
                            <path d="M10 18L4 12L10 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                            <path d="M4 12H20" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                        </svg>
                    </el-button>
                </div>

                <div class="editor-panel editor-panel-output" :style="{ width: `${100 - leftPanelWidth}%` }">
                    <div class="panel-header" @dblclick="toggleOutputMaximize">
                        <div class="panel-title">
                            <span>{{ settingsTxt.panelPreview }}</span>
                        </div>
                        <div
                            class="panel-actions"
                            @dblclick.stop
                            :style="{ '--panel-actions-opacity': showOutputActions ? 1 : 0, '--panel-actions-pointer-events': showOutputActions ? 'auto' : 'none' }"
                        >
                            <el-button @click="copyOutput" size="small" type="success" plain>
                                <el-icon>
                                    <CopyDocument />
                                </el-icon>
                                <span>{{ settingsTxt.panelCopy }}</span>
                            </el-button>
                            <el-button @click="downloadOutput" size="small" type="info" plain>
                                <el-icon>
                                    <Download />
                                </el-icon>
                                <span>{{ settingsTxt.panelDownload }}</span>
                            </el-button>
                        </div>
                    </div>
                    <div class="editor-wrapper">
                        <div class="monaco-editor-container">
                            <div v-if="!editorsInitialized" class="editor-loading">
                                <el-icon class="loading-icon">
                                    <Loading />
                                </el-icon>
                                <span>{{ settingsTxt.editorLoading }}</span>
                            </div>
                            <div ref="outputEditorContainer" class="monaco-editor-instance"></div>
                        </div>
                        <!-- 预览区域状态栏 -->
                        <div class="editor-status-bar">
                            <template v-if="outputEditorStatus">
                                <span class="status-text">{{ outputEditorStatus }}</span>
                            </template>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- 获取JSON数据对话框 -->
        <FetchJsonDialog v-model="fetchJsonDialogVisible" :indent-size="2" :input-editor="inputEditor" :locale="props.locale" @json-loaded="handleFetchJsonLoaded" />

        <!-- 分享对话框 -->
        <ShareDialog v-model="shareDialogVisible" :json-data="getInputEditorValue()" :locale="props.locale" @loadSharedJson="handleLoadSharedJson" />

        <!-- 数据脱敏对话框 -->
        <DataMaskingDialog v-model="dataMaskingDialogVisible" :json-data="getInputEditorValue()" :locale="props.locale" @apply="handleDataMaskingApply" />

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
        <el-dialog
            v-model="settingsDialogVisible"
            class="settings-dialog-wrapper"
            :close-on-click-modal="false"
            :show-close="false"
            :align-center="false"
            top="12vh"
            width="850px"
        >
            <template #header>
                <div class="dialog-header-with-close">
                    <span class="dialog-title-with-close">{{ settingsTxt.dialogTitle }}</span>
                    <button class="demo-close-btn" @click="settingsDialogVisible = false" :aria-label="settingsTxt.closeAria">✕</button>
                </div>
            </template>
            <div class="settings-dialog-content">
                <el-collapse v-model="settingsCollapseActiveNames" accordion>
                    <!-- 设置 -->
                    <el-collapse-item name="settings">
                        <template #title>
                            <div class="settings-collapse-title">
                                <el-icon class="column-title-icon">
                                    <Setting />
                                </el-icon>
                                <span>{{ settingsTxt.sectionGeneral }}</span>
                            </div>
                        </template>
                        <div class="settings-collapse-content">
                            <template v-if="!isDiffMode">
                                <!-- 菜单栏功能设置 -->
                                <div class="settings-subsection">
                                    <div class="settings-subsection-title">{{ settingsTxt.menuVisibilityTitle }}</div>
                                    <div class="button-visibility-list">
                                        <!-- 第一行：数据获取与基础处理 -->
                                        <div class="button-visibility-item" style="grid-column: 1; grid-row: 1">
                                            <el-checkbox v-model="buttonVisibility.fetchJson">{{ settingsTxt.btnFetchJson }}</el-checkbox>
                                        </div>
                                        <div class="button-visibility-item" style="grid-column: 2; grid-row: 1">
                                            <el-checkbox v-model="buttonVisibility.compress">{{ settingsTxt.btnCompress }}</el-checkbox>
                                        </div>
                                        <div class="button-visibility-item" style="grid-column: 3; grid-row: 1">
                                            <el-checkbox v-model="buttonVisibility.escape">{{ settingsTxt.btnEscape }}</el-checkbox>
                                        </div>
                                        <div class="button-visibility-item" style="grid-column: 4; grid-row: 1">
                                            <el-checkbox v-model="buttonVisibility.unescape">{{ settingsTxt.btnUnescape }}</el-checkbox>
                                        </div>
                                        <div class="button-visibility-item" style="grid-column: 5; grid-row: 1">
                                            <el-checkbox v-model="buttonVisibility.dataConvert">{{ settingsTxt.btnDataConvert }}</el-checkbox>
                                        </div>
                                        <!-- 第二行：数据处理与管理 -->
                                        <div class="button-visibility-item" style="grid-column: 1; grid-row: 2">
                                            <el-checkbox v-model="buttonVisibility.masking">{{ settingsTxt.btnMasking }}</el-checkbox>
                                        </div>
                                        <div class="button-visibility-item" style="grid-column: 2; grid-row: 2">
                                            <el-checkbox v-model="buttonVisibility.sort">{{ settingsTxt.btnSort }}</el-checkbox>
                                        </div>
                                        <div class="button-visibility-item" style="grid-column: 3; grid-row: 2">
                                            <el-checkbox v-model="buttonVisibility.archive">{{ settingsTxt.btnArchive }}</el-checkbox>
                                        </div>
                                        <div class="button-visibility-item" style="grid-column: 4; grid-row: 2">
                                            <el-checkbox v-model="buttonVisibility.diff">{{ settingsTxt.btnDiff }}</el-checkbox>
                                        </div>
                                        <div class="button-visibility-item" style="grid-column: 5; grid-row: 2">
                                            <el-checkbox v-model="buttonVisibility.share">{{ settingsTxt.btnShare }}</el-checkbox>
                                        </div>
                                    </div>
                                </div>

                                <el-divider class="settings-subsection-divider" />

                                <!-- 字体大小设置 -->
                                <div class="settings-subsection">
                                    <div class="settings-subsection-title">{{ settingsTxt.fontSizeTitle }}</div>
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

                                <el-divider class="settings-subsection-divider" />
                            </template>

                            <div class="settings-subsection">
                                <div class="settings-subsection-title">{{ settingsTxt.indentTitle }}</div>
                                <div class="settings-item">
                                    <el-radio-group v-model="indentSize" class="settings-radio-group">
                                        <el-radio :value="2" border>2</el-radio>
                                        <el-radio :value="4" border>4</el-radio>
                                        <el-radio :value="8" border>8</el-radio>
                                    </el-radio-group>
                                </div>
                            </div>


                            <!-- 字符串换行设置 -->
                            <div class="settings-subsection">
                                <div class="settings-subsection-title">
                                    <span class="settings-subsection-title-label">{{ settingsTxt.wordWrapTitle }}</span>
                                    <span class="settings-subsection-title-desc">
                                        {{ wordWrap ? settingsTxt.wordWrapDescOn : settingsTxt.wordWrapDescOff }}
                                    </span>
                                </div>
                                <div class="settings-item">
                                    <el-switch
                                        v-model="wordWrap"
                                        :inactive-value="true"
                                        :active-value="false"
                                        :inactive-text="settingsTxt.wordWrapOff"
                                        :active-text="settingsTxt.wordWrapOn"
                                        size="default"
                                        @change="updateWordWrap"
                                    />
                                </div>
                            </div>

                            <template v-if="!isDiffMode">
                                <el-divider class="settings-subsection-divider" />

                                <!-- 默认全屏设置 -->
                                <div class="settings-subsection">
                                    <div class="settings-subsection-title">
                                        <span class="settings-subsection-title-label">{{ settingsTxt.fullscreenTitle }}</span>
                                        <span class="settings-subsection-title-desc">{{ settingsTxt.fullscreenDesc }}</span>
                                    </div>
                                    <div class="settings-item">
                                        <el-switch
                                            v-model="defaultFullscreen"
                                            :inactive-value="false"
                                            :active-value="true"
                                            :inactive-text="settingsTxt.fullscreenOff"
                                            :active-text="settingsTxt.fullscreenOn"
                                            size="default"
                                        />
                                    </div>
                                </div>
                            </template>

                            <el-divider class="settings-subsection-divider" />
                            
                            <!-- 语法检查设置 -->
                            <div class="settings-subsection">
                                <div class="settings-subsection-title">
                                    <span class="settings-subsection-title-label">{{ settingsTxt.diagnosticsTitle }}</span>
                                    <span class="settings-subsection-title-desc">{{ settingsTxt.diagnosticsDesc }}</span>
                                </div>
                                <div class="settings-item">
                                    <el-switch v-model="enableDiagnostics" :disabled="isDisplayOnlyMode" :active-text="settingsTxt.diagnosticsOn" :inactive-text="settingsTxt.diagnosticsOff" size="default" />
                                </div>
                            </div>

                            <template v-if="!isDiffMode">
                                <el-divider class="settings-subsection-divider" />

                                <!-- 粘性滚动设置 -->
                                <div class="settings-subsection">
                                    <div class="settings-subsection-title">
                                        <span class="settings-subsection-title-label">{{ settingsTxt.stickyScrollTitle }}</span>
                                        <span class="settings-subsection-title-desc">{{ settingsTxt.stickyScrollDesc }}</span>
                                    </div>
                                    <div class="settings-item">
                                        <el-switch v-model="stickyScroll" :disabled="isDisplayOnlyMode" :active-text="settingsTxt.stickyScrollOn" :inactive-text="settingsTxt.stickyScrollOff" size="default" @change="updateStickyScroll" />
                                    </div>
                                </div>
                            </template>

                            <template v-if="!isDiffMode">
                                <el-divider class="settings-subsection-divider" />

                                <!-- 同步滚动设置 -->
                                <div class="settings-subsection">
                                    <div class="settings-subsection-title">
                                        <span class="settings-subsection-title-label">{{ settingsTxt.syncScrollTitle }}</span>
                                        <span class="settings-subsection-title-desc">{{ settingsTxt.syncScrollDesc }}</span>
                                    </div>
                                    <div class="settings-item">
                                        <el-switch v-model="syncScrollEnabled" :active-text="settingsTxt.syncScrollOn" :inactive-text="settingsTxt.syncScrollOff" size="default" />
                                    </div>
                                </div>
                            </template>

                            <template v-if="!isDiffMode">
                                <el-divider class="settings-subsection-divider" />

                                <!-- 缩略图设置 -->
                                <div class="settings-subsection">
                                    <div class="settings-subsection-title">
                                        <span class="settings-subsection-title-label">{{ settingsTxt.minimapTitle }}</span>
                                        <span class="settings-subsection-title-desc">{{ settingsTxt.minimapDesc }}</span>
                                    </div>
                                    <div class="settings-item">
                                        <el-switch v-model="showMinimap" :active-text="settingsTxt.minimapOn" :inactive-text="settingsTxt.minimapOff" size="default" @change="updateMinimap" />
                                    </div>
                                </div>
                            </template>
                            
                            <template v-if="!isDiffMode">
                                <el-divider class="settings-subsection-divider" />

                                <!-- 缩进指南设置 -->
                                <div class="settings-subsection">
                                    <div class="settings-subsection-title">
                                        <span class="settings-subsection-title-label">{{ settingsTxt.indentGuideTitle }}</span>
                                        <span class="settings-subsection-title-desc">{{ settingsTxt.indentGuideDesc }}</span>
                                    </div>
                                    <div class="settings-item">
                                        <el-switch v-model="showIndentGuide" :active-text="settingsTxt.indentGuideOn" :inactive-text="settingsTxt.indentGuideOff" size="default" @change="updateIndentGuides" />
                                    </div>
                                </div>
                            </template>
                        </div>
                    </el-collapse-item>

                    <!-- 格式化设置 -->
                    <el-collapse-item name="format">
                        <template #title>
                            <div class="settings-collapse-title">
                                <el-icon class="column-title-icon">
                                    <Document />
                                </el-icon>
                                <span>{{ settingsTxt.sectionFormat }}</span>
                            </div>
                        </template>
                        <div class="settings-collapse-content">
                            <div class="settings-item">
                                <div class="settings-item-header">
                                    <span class="settings-label">{{ settingsTxt.encodingLabel }}</span>
                                    <span v-if="encodingMode" class="settings-description">{{ settingsTxt.encodingDescOn }}</span>
                                </div>
                                <el-switch v-model="encodingMode" :active-text="settingsTxt.encodingOn" :inactive-text="settingsTxt.encodingOff" size="default" />
                            </div>

                            <el-divider style="margin: 12px 0" />

                            <div class="settings-item">
                                <div class="settings-item-header">
                                    <span class="settings-label">{{ settingsTxt.arrayStyleLabel }}</span>
                                    <span class="settings-description">{{ settingsTxt.arrayStyleDescPrefix }}<strong>{{ settingsTxt.arrayStyleDescSimple }}</strong>{{ settingsTxt.arrayStyleDescMid }}<strong>{{ settingsTxt.arrayStyleDescComplex }}</strong>{{ settingsTxt.arrayStyleDescSuffix }}</span>
                                </div>
                                <el-switch v-model="arrayNewLine" :active-text="settingsTxt.arrayStyleOn" :inactive-text="settingsTxt.arrayStyleOff" size="default" />
                            </div>
                        </div>
                    </el-collapse-item>

                    <!-- 去除转义设置 -->
                    <el-collapse-item v-if="!isDiffMode" name="unescape">
                        <template #title>
                            <div class="settings-collapse-title">
                                <el-icon class="column-title-icon">
                                    <Refresh />
                                </el-icon>
                                <span>{{ settingsTxt.sectionUnescape }}</span>
                            </div>
                        </template>
                        <div class="settings-collapse-content">
                            <div class="settings-item">
                                <div class="settings-item-header">
                                    <span class="settings-label">{{ settingsTxt.unescapeModeLabel }}</span>
                                </div>
                                <el-switch v-model="recursiveUnescape" :active-text="settingsTxt.unescapeRecursive" :inactive-text="settingsTxt.unescapeShallow" size="default" />
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
                                <span>{{ settingsTxt.sectionSort }}</span>
                            </div>
                        </template>
                        <div class="settings-collapse-content">
                            <div class="settings-item">
                                <div class="settings-item-header">
                                    <span class="settings-label">{{ settingsTxt.sortMethodLabel }}</span>
                                </div>
                                <el-radio-group v-model="sortMethod" class="settings-radio-group">
                                    <el-radio value="dictionary" border>{{ settingsTxt.sortMethodDictionary }}</el-radio>
                                    <el-radio value="length" border>{{ settingsTxt.sortMethodLength }}</el-radio>
                                    <el-radio value="field" border>{{ settingsTxt.sortMethodField }}</el-radio>
                                </el-radio-group>
                            </div>

                            <el-divider style="margin: 12px 0" />

                            <div class="settings-item">
                                <div class="settings-item-header">
                                    <span class="settings-label">{{ settingsTxt.sortOrderLabel }}</span>
                                </div>
                                <el-radio-group v-model="sortOrder" class="settings-radio-group">
                                    <el-radio value="asc" border>{{ settingsTxt.sortOrderAsc }}</el-radio>
                                    <el-radio value="desc" border>{{ settingsTxt.sortOrderDesc }}</el-radio>
                                </el-radio-group>
                            </div>
                        </div>
                    </el-collapse-item>

                    <!-- 存档设置（与通用设置同级，位于去除转义之后） -->
                    <el-collapse-item v-if="!isDiffMode" name="archive">
                        <template #title>
                            <div class="settings-collapse-title">
                                <el-icon class="column-title-icon">
                                    <Edit />
                                </el-icon>
                                <span>{{ settingsTxt.sectionArchive }}</span>
                            </div>
                        </template>
                        <div class="settings-collapse-content">
                            <div class="settings-item">
                                <div class="settings-item-header">
                                    <span class="settings-label">{{ settingsTxt.archiveNameLabel }}</span>
                                </div>
                                <el-switch v-model="customArchiveName" :active-text="settingsTxt.archiveNameCustom" :inactive-text="settingsTxt.archiveNameAuto" size="default" />
                            </div>
                        </div>
                    </el-collapse-item>
                </el-collapse>
            </div>
            <template #footer>
                <div class="dialog-footer">
                    <el-button @click="settingsDialogVisible = false">{{ settingsTxt.btnClose }}</el-button>
                </div>
            </template>
        </el-dialog>

        <!-- 字段排序对话框 -->
        <el-dialog v-model="fieldSortDialogVisible" width="600px" :close-on-click-modal="false" :show-close="false">
            <template #header>
                <div class="dialog-header-with-close">
                    <span class="dialog-title-with-close">{{ settingsTxt.fieldSortTitle }}</span>
                    <button class="demo-close-btn" @click="fieldSortDialogVisible = false" :aria-label="settingsTxt.fieldSortCloseAria">✕</button>
                </div>
            </template>
            <div class="form-item">
                <div class="form-item-row">
                    <div class="form-value-quote--compact" style="width: 100%">
                        <span class="form-compact-line"
                            >{{ settingsTxt.demoDirectionLabel }}<span class="form-value-text">{{ sortOrder === 'asc' ? settingsTxt.sortOrderAsc : settingsTxt.sortOrderDesc }}</span></span
                        >
                    </div>
                </div>
            </div>

            <div class="form-item">
                <label class="form-label" for="sort-root-path-input">{{ settingsTxt.fieldSortRootPathLabel }}</label>
                <el-autocomplete
                    id="sort-root-path-input"
                    v-model="sortRootPath"
                    :fetch-suggestions="queryRootPaths"
                    :placeholder="settingsTxt.fieldSortRootPathPlaceholder"
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
                <div class="form-hint">{{ settingsTxt.fieldSortRootPathHint }}</div>
            </div>

            <div class="form-item">
                <label class="form-label" for="sort-field-name-input">{{ settingsTxt.fieldSortFieldLabel }}</label>
                <el-autocomplete
                    id="sort-field-name-input"
                    v-model="sortFieldName"
                    :fetch-suggestions="queryFieldPathsFromScope"
                    :trigger-on-focus="true"
                    :placeholder="settingsTxt.fieldSortFieldPlaceholder"
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
                <div class="form-hint">{{ settingsTxt.fieldSortFieldHint }}</div>
            </div>

            <template #footer>
                <el-button @click="fieldSortDialogVisible = false">{{ settingsTxt.btnCancel }}</el-button>
                <el-button type="warning" @click="showFieldSortDemo">{{ settingsTxt.btnDemoExample }}</el-button>
                <el-button type="primary" @click="executeFieldSort">{{ settingsTxt.btnStartSort }}</el-button>
            </template>
        </el-dialog>

        <!-- 演示模式：Popover 贴边引导，不使用遮罩层 -->
        <el-popover
            v-if="isDemoMode && demoGuideVisible && currentDemoStepData"
            :visible="true"
            :virtual-ref="demoPopoverAnchor"
            virtual-triggering
            :width="420"
            :placement="demoPopoverPlacement"
            :show-arrow="true"
            :teleported="true"
            popper-class="demo-guide-popover"
            :offset="12"
        >
            <div class="demo-guide-inner">
                <div class="demo-guide-header">
                    <h3>{{ currentDemoStepData.title }}</h3>
                    <button class="demo-close-btn" @click="endDemoMode" :aria-label="settingsTxt.demoCloseAria">✕</button>
                </div>
                <div class="demo-guide-content">
                    <p>{{ currentDemoStepData.content }}</p>
                    <div class="demo-current-settings">
                        <strong>{{ settingsTxt.demoCurrentSettings }}</strong>
                        <ul class="demo-settings-list">
                            <li>
                                <span class="demo-settings-label">{{ settingsTxt.demoDirectionLabel }}</span>
                                <code>{{ sortOrder === 'asc' ? settingsTxt.sortOrderAsc : settingsTxt.sortOrderDesc }}</code>
                            </li>
                            <li>
                                <span class="demo-settings-label">{{ settingsTxt.demoRootPathLabel }}</span>
                                <code>{{ sortRootPath || settingsTxt.demoEmptyValue }}</code>
                            </li>
                            <li>
                                <span class="demo-settings-label">{{ settingsTxt.demoFieldLabel }}</span>
                                <code>{{ sortFieldName || settingsTxt.demoUnsetValue }}</code>
                            </li>
                        </ul>
                    </div>
                </div>
                <div class="demo-guide-footer">
                    <el-button
                        v-for="(btn, index) in currentDemoStepData.buttons"
                        :key="index"
                        size="small"
                        :type="btn.action === endDemoMode ? 'primary' : 'default'"
                        @click="btn.action()"
                    >
                        {{ btn.text }}
                    </el-button>
                </div>
                <div class="demo-step-indicator">
                    <span v-for="i in demoStepsCount" :key="i" :class="['step-dot', { active: i === currentDemoStep + 1 }]"></span>
                </div>
            </div>
        </el-popover>
    </div>
</template>

<script setup lang="ts">
// Vue
import { ref, computed, watch, onMounted, onBeforeUnmount, onUnmounted, nextTick } from 'vue';

// 第三方库
import JSON5 from 'json5';
import { parseTree, type Node as JsonAstNode } from 'jsonc-parser';
import { Base64 } from 'js-base64';

// Element Plus
import { ElMessage, ElMessageBox } from 'element-plus';
import type { UploadFile } from 'element-plus';
import { Loading, ArrowLeft, ArrowRight, ArrowDown, ArrowUp, CopyDocument, Download, Upload, Delete, Setting, WarningFilled, Document, Sort, Edit, Refresh } from '@element-plus/icons-vue';

// Monaco Editor
// Monaco 按需引入：只引入核心编辑器 + JSON 语言贡献。
// 其他语言（yaml/xml/html/css/toml）下方通过 monaco.languages.register + Monarch 自行注册，
// 不需要 monaco-editor 自带的 basic-languages 全家桶，可显著减少打包体积。
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import 'monaco-editor/esm/vs/language/json/monaco.contribution';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';

// 子组件
import ArchiveNameDialog from './ArchiveNameDialog.vue';
import DataMaskingDialog from './DataMaskingDialog.vue';
import FetchJsonDialog from './FetchJsonDialog.vue';
import ShareDialog from './ShareDialog.vue';

// 组合式函数
import { useDiffEditors } from './composables/useDiffEditors';
import { useTabId } from './composables/useTabId';
import { useTabLifecycle } from './composables/useTabLifecycle';
import { useToolSettings } from './composables/useToolSettings';

// 本地工具
import { calculateByteSize, formatFileSize, calculateHash } from './utils/byteUtils';
import { type EditorContentLanguage, sleep, debounce, detectInputLanguage, normalizeArchiveName, measureTextWidth } from './utils/common';
import { smartDecode } from './utils/decode';
import { replaceEditorValuePreservingUndo } from './utils/diffMonaco';
import { IDB_DB_NAME, IDB_DB_VERSION, IDB_STORE_ARCHIVES, IDB_STORE_TAB_HEARTBEATS, MAX_SINGLE_ARCHIVE_SIZE, idbDelete, idbGet, idbPut } from './utils/idb';
import { SETTINGS_TXT_ZH, SETTINGS_TXT_EN, type SettingsTxt, localizeShareApiError as localizeShareApiErrorRaw } from './utils/i18n';
import { detectIndentSize as detectIndentSizeRaw, reformatJsonIndentation } from './utils/indentUtils';
import { convertToYAML, convertToTOML, convertToXML, convertToGo, cookieToJSON } from './utils/jsonConvert';
import { parsePathToParts, getValueByPathParts, getValueByPath, setValueByPath } from './utils/jsonPath';
import { sortJsonObject, sortJsonByField, sortStringLines } from './utils/jsonSort';
import { getObjectDepth, calculateMaxLevel, detectIllegalEscapes } from './utils/jsonStructure';

const props = defineProps<{locale?: 'zh' | 'en'}>();
const settingsTxt = computed<SettingsTxt>(() => (props.locale === 'en' ? SETTINGS_TXT_EN : SETTINGS_TXT_ZH));
const localizeShareApiError = (message?: string, fallback?: string): string => localizeShareApiErrorRaw(message, props.locale, fallback ?? settingsTxt.value.msgSharedLoadFallback);

// ==================== 常量与全局状态 ====================
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 文件大小限制：5MB
const FULL_FEATURE_MAX_LINES = 1_000_000; // 100 万行以内，所有功能可用
const COLLAPSE_DISABLED_MAX_LINES = 3_000_000; // 100 万到 300 万行，仅禁用层级收缩
const MAX_LINES = 5_000_000; // 300 万到 500 万行为仅展示模式，超过 500 万行直接拒绝
const outputType = ref<'json' | 'yaml' | 'toml' | 'xml' | 'go' | 'text'>('json'); // 当前输出类型的状态
const maxLevel = ref(0); // 最大层级
const inputContentLanguage = ref<EditorContentLanguage>('json');
const maxFoldableLevel = ref<number | null>(null); // 编辑器当前实际可折叠的最大层级
const selectedLevel = ref<number>(0); // 当前选中的层级
const isResizing = ref(false); // 是否正在调整宽度控制
const leftPanelWidth = ref(50); // 面板宽度控制（实时值，用于布局）
const stableLeftPanelWidth = ref(50); // 稳定宽度值，用于计算按钮显示状态（防抖更新）
const fetchJsonDialogVisible = ref(false); // 获取JSON数据对话框相关状态
const shareDialogVisible = ref(false); // 分享对话框相关状态
const dataMaskingDialogVisible = ref(false); // 数据脱敏对话框相关状态
const archiveNameDialogVisible = ref(false); // 是否显示“保存存档”对话框
const archiveNameDialogTitle = ref('保存存档'); // 对话框标题文本
const archiveNameDialogInputValue = ref(''); // 对话框输入的当前值（存档名称）
const archiveNameDialogPlaceholder = ref('例如：测试数据1'); // 对话框输入框的占位符文本示例
const archiveNameDialogExcludeId = ref<string>(''); // 编辑时排除的存档ID（用于避免与自身重复）
const archiveNameDialogCallback = ref<((name: string) => void) | null>(null); // 确认时调用的回调函数
const settingsDialogVisible = ref(false); // 对话框开启/关闭状态
const settingsCollapseActiveNames = ref<string | number>('format'); // 手风琴展开项，默认展开"格式化设置"
const isInputMaximized = ref(false); // 编辑区域是否最大化
const isOutputMaximized = ref(false); // 预览区域是否最大化

// 切换编辑区域最大化状态
const toggleInputMaximize = () => {
    // 演示模式下禁用面板最大化（双击面板头），避免 Popover 锚点突变导致引导错位
    if (isDemoMode.value) return;
    if (isInputMaximized.value) {
        // 从最大化恢复均分
        isInputMaximized.value = false;
        isOutputMaximized.value = false;
        leftPanelWidth.value = 50;
        stableLeftPanelWidth.value = 50;
    } else {
        // 最大化编辑区域
        isInputMaximized.value = true;
        isOutputMaximized.value = false;
        leftPanelWidth.value = 100;
        stableLeftPanelWidth.value = 100;
    }
    nextTick(() => {
        updateEditorLayout();
    });
};

// 切换预览区域最大化状态
const toggleOutputMaximize = () => {
    // 演示模式下禁用面板最大化（双击面板头），避免 Popover 锚点突变导致引导错位
    if (isDemoMode.value) return;
    if (isOutputMaximized.value) {
        // 从最大化恢复均分
        isInputMaximized.value = false;
        isOutputMaximized.value = false;
        leftPanelWidth.value = 50;
        stableLeftPanelWidth.value = 50;
    } else {
        // 最大化预览区域
        isInputMaximized.value = false;
        isOutputMaximized.value = true;
        leftPanelWidth.value = 0;
        stableLeftPanelWidth.value = 0;
    }
    nextTick(() => {
        updateEditorLayout();
    });
};

// ==================== 设置管理（已抽离至 composables/useToolSettings） ====================
// 所有持久化偏好（按钮可见性、字体、缩进、排序、minimap、stickyScroll 等）均由 useToolSettings
// 维护：自动从 localStorage 读取、deep watch 自动保存、提供 markInitialized() 在 onMounted
// 末尾解除初始化抑制。下方解构后的 ref 名称与原代码保持完全一致，模板与下游逻辑不需要修改。
const {
    indentSize,
    recursiveUnescape,
    wordWrap,
    fontSize,
    showIndentGuide,
    arrayNewLine,
    preserveNumberLiterals,
    isFullscreen,
    defaultFullscreen,
    showMinimap,
    enableDiagnostics,
    preferredEnableDiagnostics,
    encodingMode,
    sortMethod,
    sortOrder,
    customArchiveName,
    stickyScroll,
    preferredStickyScroll,
    buttonVisibility,
    syncScrollEnabled,
    markInitialized: markSettingsInitialized,
} = useToolSettings();

const inputEditorErrors = ref<monaco.editor.IMarker[]>([]);
const currentErrorIndex = ref(-1);
const currentInputLineCount = ref(1);

const isCollapseRestrictedMode = computed(
    () => currentInputLineCount.value > FULL_FEATURE_MAX_LINES && currentInputLineCount.value <= COLLAPSE_DISABLED_MAX_LINES
);
const isDisplayOnlyMode = computed(
    () => currentInputLineCount.value > COLLAPSE_DISABLED_MAX_LINES && currentInputLineCount.value <= MAX_LINES
);
const canUseCollapseFeature = computed(() => !isCollapseRestrictedMode.value && !isDisplayOnlyMode.value);
const canUseProcessingFeatures = computed(() => !isDisplayOnlyMode.value);

// ==================== 全屏管理 ====================

// 切换全屏状态
const toggleFullscreen = () => {isFullscreen.value = !isFullscreen.value;};


// 监听 ESC 键退出全屏
const handleEscapeKey = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
        if (isDiffMode.value) {
            exitDiffMode();
            return;
        }
        if (isFullscreen.value) {
            isFullscreen.value = false;
        }
    }
};

// ==================== Diff 模式管理 ====================
// 仅保留页面级状态：是否处于 diff 模式、容器 ref、进入 diff 前的全屏快照、普通模式快照
// editor 实例 / 行级 diff / 装饰 / view zones / 同步滚动 / 草稿 等全部下沉到
// composables/useDiffEditors.ts 内部维护
const isDiffMode = ref(false);
const diffLeftEditorContainer = ref<HTMLElement | null>(null);
const diffRightEditorContainer = ref<HTMLElement | null>(null);
// diff 状态栏：模板和 useDiffEditors 都要用，提前到顶层声明
const diffLeftEditorStatus = ref('');
const diffRightEditorStatus = ref('');
let wasFullscreenBeforeDiff = false;
let normalModeInputSnapshot = '';
let normalModeOutputSnapshot = '';
let normalModeInputViewState: monaco.editor.ICodeEditorViewState | null = null;
let normalModeOutputViewState: monaco.editor.ICodeEditorViewState | null = null;

// ==================== Tab/Storage（IndexedDB + 标签页隔离） ====================
const {
    tabId,
    runtimeInstanceId,
    isTabPageClosing,
    setupTabIdChannel,
    ensureUniqueTabIdForThisPage,
    disposeTabIdChannel,
} = useTabId();

const {
    setupTabGcChannel,
    startTabHeartbeat,
    stopTabHeartbeat,
    garbageCollectClosedTabs,
    disposeTabGcChannel,
} = useTabLifecycle({ tabId, runtimeInstanceId, isTabPageClosing });

const getOutputEditorLanguage = () => {
    switch (outputType.value) {
        case 'yaml':
            return 'yaml';
        case 'toml':
            return 'toml';
        case 'xml':
            return 'xml';
        case 'go':
            return 'go';
        case 'text':
            return 'plaintext';
        default:
            return 'json';
    }
};

const cacheNormalEditorsState = () => {
    normalModeInputSnapshot = inputEditor?.getValue() || '';
    normalModeOutputSnapshot = outputEditor?.getValue() || '';
    normalModeInputViewState = inputEditor?.saveViewState() || null;
    normalModeOutputViewState = outputEditor?.saveViewState() || null;
};

const destroyNormalEditors = () => {
    if (inputEditorResizeObserver) {
        inputEditorResizeObserver.disconnect();
        inputEditorResizeObserver = null;
    }
    if (outputEditorResizeObserver) {
        outputEditorResizeObserver.disconnect();
        outputEditorResizeObserver = null;
    }
    if (inputMarkersListener) {
        inputMarkersListener.dispose();
        inputMarkersListener = null;
    }
    if (inputEditor) {
        inputEditor.dispose();
        inputEditor = null;
    }
    if (outputEditor) {
        outputEditor.dispose();
        outputEditor = null;
    }
    editorsInitialized.value = false;
    inputEditorErrors.value = [];
    currentErrorIndex.value = -1;
    inputEditorStatus.value = '';
    outputEditorStatus.value = '';
};

const restoreNormalEditors = async () => {
    await nextTick();
    if (!inputEditorContainer.value || !outputEditorContainer.value) return;

    createInputEditor();
    createOutputEditor();
    configureInputEditor();
    configureOutputEditor();

    if (inputEditor) {
        inputEditor.setValue(normalModeInputSnapshot);
    }
    if (outputEditor) {
        outputEditor.setValue(normalModeOutputSnapshot);
        updateOutputEditorConfig(
            getOutputEditorLanguage(),
            outputType.value === 'json',
            outputType.value === 'go' ? 4 : undefined
        );
    }

    initializeEditorLayout();
    setupResizeObservers();
    refreshInputEditorErrors();

    nextTick(() => {
        if (normalModeInputViewState) {
            inputEditor?.restoreViewState(normalModeInputViewState);
        }
        if (normalModeOutputViewState) {
            outputEditor?.restoreViewState(normalModeOutputViewState);
        }
        if (inputEditor) {
            updateLineNumberWidth(inputEditor);
            updateEditorHeight(inputEditor);
        }
        if (outputEditor) {
            updateLineNumberWidth(outputEditor);
            updateEditorHeight(outputEditor);
        }
    });
};

// ==================== Diff 编辑器 composable ====================
// 把 Monaco 双编辑器实例 + 行级 diff 可视化 + 草稿持久化全部下沉到 useDiffEditors。
// 主文件只保留：模式切换（enter/exit）、跨模式工具（format / sort / copy / clear / upload / download）、
// 字段排序（field-sort）以及对响应式状态的模板暴露。
//
// 注入 helpers 时使用箭头包装是为了延迟绑定：
// trackEditorFocus / setupDoubleClickSelectString / registerEncodingActions / setupSelectionListener
// / updateLineNumberWidth 这些 const 箭头函数都声明在本文件后面（约 L2436+），TS 在顶层立即引用会
// 报 use-before-define；包一层 lambda 后引用发生在 createDiffEditor 实际被调用时（用户点击进入 diff 模式），
// 那时 setup 已执行完，所有 const 都已就绪，运行时安全。
const {
    diffCount,
    activeDiffIndex,
    diffSyncButtons,
    getDiffLeftEditor,
    getDiffRightEditor,
    getDiffSideEditor,
    createDiffEditor,
    destroyDiffEditor,
    scheduleDiffEditorLayout,
    scheduleDiffRecompute,
    goToNextDiff,
    goToPrevDiff,
    handleDiffSync,
    captureDiffDraftFromEditors,
    saveDiffDraft,
    restoreDiffDraftIntoEditors,
    updateDiffEditorOptions,
    layoutDiffEditors,
} = useDiffEditors({
    leftContainerRef: diffLeftEditorContainer,
    rightContainerRef: diffRightEditorContainer,
    leftStatusRef: diffLeftEditorStatus,
    rightStatusRef: diffRightEditorStatus,
    tabId,
    onError: (msg: string) => showMessageError(msg),
    showMinimap,
    fontSize,
    wordWrap,
    showIndentGuide,
    // 以下 helper 都声明在文件后段，用 lambda 包一层延迟绑定
    trackEditorFocus: editor => trackEditorFocus(editor),
    setupDoubleClickSelectString: (editor, copy) => setupDoubleClickSelectString(editor, copy),
    registerEncodingActions: editor => registerEncodingActions(editor),
    setupSelectionListener: (editor, statusRef) => setupSelectionListener(editor, statusRef),
    updateLineNumberWidth: editor => updateLineNumberWidth(editor),
    detectIndentSize: content => detectIndentSizeWrapper(content),
    onBeforeDisposeEditor: editor => {
        if (lastFocusedEditor === editor) lastFocusedEditor = null;
    },
});

const enterDiffMode = () => {
    wasFullscreenBeforeDiff = isFullscreen.value;
    cacheNormalEditorsState();
    destroyNormalEditors();
    isDiffMode.value = true;
    isFullscreen.value = true;

    nextTick(() => {
        createDiffEditor();
        void restoreDiffDraftIntoEditors();
    });
};

const exitDiffMode = () => {
    captureDiffDraftFromEditors();
    void saveDiffDraft('退出 diff');
    destroyDiffEditor();
    isDiffMode.value = false;
    isFullscreen.value = wasFullscreenBeforeDiff;
    // diffCount 已由 destroyDiffEditor() 清零

    void restoreNormalEditors();
};

const persistDiffDraftOnPageLeave = () => {
    isTabPageClosing.value = true;
    captureDiffDraftFromEditors();
    void saveDiffDraft('页面离开');
    // pagehide / beforeunload 时尽力（best-effort）同步删除自己的心跳，
    // 这样其他正在运行的 tab 启动 GC 时能立即识别本 tab 已关闭。
    // 注意：IndexedDB 的写入是异步的，这里只发起请求，不等待结果。
    if (typeof window !== 'undefined' && tabId.value) {
        try {
            const req = indexedDB.open(IDB_DB_NAME, IDB_DB_VERSION);
            req.onsuccess = () => {
                try {
                    const db = req.result;
                    const tx = db.transaction(IDB_STORE_TAB_HEARTBEATS, 'readwrite');
                    tx.objectStore(IDB_STORE_TAB_HEARTBEATS).delete(tabId.value);
                } catch {
                    // 静默失败：进入此分支说明 tab 已经在关闭，下次 GC 会兜底
                }
            };
        } catch {
            // 忽略
        }
    }
};

onMounted(() => {
    setupTabIdChannel();
    setupTabGcChannel();
    window.addEventListener('pagehide', persistDiffDraftOnPageLeave);
    window.addEventListener('beforeunload', persistDiffDraftOnPageLeave);
    void (async () => {
        await ensureUniqueTabIdForThisPage();
        // 启动心跳，让其他 tab 知道本 tab 还活着
        startTabHeartbeat();
        // 启动后异步执行一次 GC：清理所有已关闭 tab 留下的存档与 diff 草稿
        void garbageCollectClosedTabs();
        await loadArchives();
    })();
});

onBeforeUnmount(() => {
    isTabPageClosing.value = true;
    stopTabHeartbeat();
    // 同步删除自己的 heartbeat，让其他 tab 启动 GC 时能立刻清理本 tab 数据
    if (tabId.value) {
        void idbDelete(IDB_STORE_TAB_HEARTBEATS, tabId.value).catch(() => { /* ignore */ });
    }
    window.removeEventListener('pagehide', persistDiffDraftOnPageLeave);
    window.removeEventListener('beforeunload', persistDiffDraftOnPageLeave);
    disposeTabIdChannel();
    disposeTabGcChannel();
});

const detectIndentSizeWrapper = (content: string): number => detectIndentSizeRaw(content, indentSize.value);

const diffFormatJSON = (side: 'left' | 'right') => {
    const editor = getDiffSideEditor(side);
    if (!editor) return;
    const value = editor.getValue();
    if (!value.trim()) {
        showMessageError('没有可格式化的内容');
        return;
    }
    try {
        const formatter = new JsonPlusFormatter(
            encodingMode.value,
            indentSize.value,
            arrayNewLine.value,
            preserveNumberLiterals.value
        );
        const { data, escapeMap } = formatter.parseJson5(value);
        const formatted = formatter.format(data, escapeMap);
        replaceEditorValuePreservingUndo(editor, formatted, `diff-format-${side}`);
        showMessageSuccess('格式化成功');
    } catch (error: any) {
        showMessageError('格式化失败: ' + error.message);
    }
};

const diffSortJSON = (side: 'left' | 'right') => {
    const editor = getDiffSideEditor(side);
    if (!editor) return;
    const value = editor.getValue();
    if (!value.trim()) {
        showMessageError(settingsTxt.value.msgNoSortableContent);
        return;
    }
    // Diff 模式下的"按字段值排序"需要配合字段排序对话框收集根路径与字段名，
    // 此处与普通模式行为保持一致：弹出对话框，执行阶段根据 fieldSortTarget 回写到对应编辑器。
    if (sortMethod.value === 'field') {
        fieldSortTarget.value = side === 'left' ? 'diff-left' : 'diff-right';
        sortRootPath.value = '';
        sortFieldName.value = '';
        fieldSortDialogVisible.value = true;
        return;
    }
    try {
        const result = preprocessJSON(value, { preserveNumberLiterals: true });
        const sorted = sortJsonObject(result.data, sortMethod.value, sortOrder.value, '');
        const formatter = new JsonPlusFormatter(false, indentSize.value, true, preserveNumberLiterals.value);
        const formatted = formatter.format(sorted, result.escapeMap);
        replaceEditorValuePreservingUndo(editor, formatted, `diff-sort-${side}`);
        showMessageSuccess(settingsTxt.value.msgSortSuccess);
    } catch (error: any) {
        showMessageError(settingsTxt.value.msgSortFail(error.message));
    }
};

const diffCopy = async (side: 'left' | 'right') => {
    const editor = getDiffSideEditor(side);
    if (!editor) return;
    const value = editor.getValue();
    if (!value) {
        showMessageWarning('没有可复制的内容');
        return;
    }
    try {
        await navigator.clipboard.writeText(value);
        showMessageSuccess('复制成功');
    } catch {
        showMessageError('复制失败');
    }
};

const diffClear = (side: 'left' | 'right') => {
    const editor = getDiffSideEditor(side);
    if (!editor) return;
    replaceEditorValuePreservingUndo(editor, '', `diff-clear-${side}`);
    showMessageSuccess('已清空');
};

const diffHandleUpload = (side: 'left' | 'right') => (uploadFile: UploadFile) => {
    const file = uploadFile.raw as File;
    if (!file) { showMessageError('无法获取文件'); return; }
    if (!file.name.toLowerCase().endsWith('.json')) { showMessageError('只能上传 JSON 文件'); return; }
    if (file.size > MAX_FILE_SIZE) { showMessageError('文件大小不能超过 5 MB'); return; }
    const reader = new FileReader();
    reader.onload = e => {
        if (e.target?.result) {
            const editor = getDiffSideEditor(side);
            if (editor) {
                replaceEditorValuePreservingUndo(editor, e.target.result as string, `diff-upload-${side}`);
                showMessageSuccess('文件上传成功');
            }
        }
    };
    reader.onerror = () => showMessageError('文件读取出错');
    reader.readAsText(file, 'utf-8');
};

const diffDownload = async (side: 'left' | 'right') => {
    const editor = getDiffSideEditor(side);
    if (!editor) return;
    const content = editor.getValue();
    if (!content) {
        showMessageWarning('没有可下载的内容');
        return;
    }
    try {
        const fullHash = await calculateHash(content);
        const hash = fullHash.substring(0, 32);
        const blob = new Blob([content], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${hash}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        showMessageSuccess('下载成功');
    } catch (error: any) {
        showMessageError('下载失败');
    }
};

// ==================== JSON 存档管理 ====================
interface JsonArchive {
    id: string;
    name: string;
    size: number;
    content: string;
}

const MAX_ARCHIVE_COUNT = 20; // 存档数量上限
const archives = ref<JsonArchive[]>([]);
const draggingArchiveId = ref<string | null>(null);
const dragOverArchiveId = ref<string | null>(null);
const dragEnabledArchiveId = ref<string | null>(null);
const dropIndicatorIndex = ref<number | null>(null);
const archiveListRef = ref<HTMLElement | null>(null);

interface ArchiveBucketRecord {
    tabId: string;
    archives: JsonArchive[];
    updatedAt: number;
    version: number;
}

// 加载存档（IndexedDB + 标签页隔离）
const loadArchives = async () => {
    if (typeof window === 'undefined') return;
    try {
        const record = await idbGet<ArchiveBucketRecord>(IDB_STORE_ARCHIVES, tabId.value);
        archives.value = Array.isArray(record?.archives) ? record!.archives : [];
    } catch (e: any) {
        archives.value = [];
        showMessageError(settingsTxt.value.msgArchiveLoadFail(e?.message ?? String(e)));
    }
};

// 保存存档（IndexedDB + 标签页隔离）
const saveArchives = async (): Promise<boolean> => {
    if (typeof window === 'undefined') return true;
    try {
        // IndexedDB 不能直接存 Vue 的响应式 Proxy，这里显式转成普通对象数组。
        const plainArchives: JsonArchive[] = archives.value.map(item => ({
            id: item.id,
            name: item.name,
            size: item.size,
            content: item.content,
        }));
        const record: ArchiveBucketRecord = {
            tabId: tabId.value,
            archives: plainArchives,
            updatedAt: Date.now(),
            version: 1,
        };
        await idbPut(IDB_STORE_ARCHIVES, record);
        return true;
    } catch (error: any) {
        showMessageError(settingsTxt.value.msgArchiveSaveFail(error?.message ?? settingsTxt.value.msgArchiveStorageError));
        return false;
    }
};


// 字段排序对话框相关状态
const fieldSortDialogVisible = ref(false);
const sortRootPath = ref<string>('');
const sortFieldName = ref<string>('');
// 字段排序目标：'input'=普通模式，'diff-left'/'diff-right'=Diff 模式的左右编辑器
const fieldSortTarget = ref<'input' | 'diff-left' | 'diff-right'>('input');

// 字段排序演示相关状态
const isDemoMode = ref(false);
const demoGuideVisible = ref(false);
const currentDemoStepData = ref<any>(null);
const savedInputContent = ref<string | null>(null);
const demoResults = ref<any>({});
const currentDemoStep = ref(0);
const demoStepsCount = ref(0);
const demoData = ref(JSON.parse('[{"id":3,"name":"Emma Davis","education":[{"university":"Stanford University","graduationYear":2010},{"university":"Columbia University","graduationYear":2015}]},{"id":1,"name":"Dylan Mullins","education":[{"university":"MIT","graduationYear":2003},{"university":"Harvard University","graduationYear":1983}]},{"id":2,"name":"Logan Boyle","education":[{"university":"Yale University","graduationYear":2000},{"university":"University of Pennsylvania","graduationYear":2020}]}]'));
const demoMapData = ref(JSON.parse('{"B":{"id":102,"key":"task-B","value":{"score":100}},"A":{"id":101,"key":"task-A","value":{"score":70}},"C":{"id":103,"key":"task-C","value":{"score":80}},"E":{"id":105,"key":"task-E","value":{"score":60}},"D":{"id":104,"key":"task-D","value":{"score":null}}}'));

// 演示 Popover 锚点与定位相关状态
const demoPopoverAnchor = ref<HTMLElement | null>(null);
const demoPopoverPlacement = ref<'right-start' | 'left-start' | 'bottom-start' | 'top-start'>('right-start');
// 演示模式下当前被蓝色脉冲高亮的元素（非演示场景下不会启用高亮）
const demoHighlightedEl = ref<HTMLElement | null>(null);

// 演示模式切换时，同步把所有 Monaco 编辑器（输入 / 输出 / Diff 左右）切到 readOnly，
// 防止用户在演示期间手改数据打乱引导流程。演示结束自动恢复可写。
watch(isDemoMode, (on) => {
    const readOnly = !!on;
    try {
        inputEditor?.updateOptions({ readOnly });
        outputEditor?.updateOptions({ readOnly });
        updateDiffEditorOptions({ readOnly });
    } catch (e) {
        /* 编辑器尚未初始化也无妨，静默忽略 */
    }
});

// 根据步骤的 highlight 选择器解析 DOM 锚点；highlight 为空时锚到输出编辑器作为 fallback
const resolveDemoAnchor = (selector: string | null): HTMLElement | null => {
    if (typeof window === 'undefined') return null;
    const fallback = '.editor-panel-output';
    const sel = selector || fallback;
    try {
        const el = document.querySelector<HTMLElement>(sel);
        if (el) return el;
    } catch (e) {
        // ignore invalid selector
    }
    // 最后兜底：锚到工具容器
    return document.querySelector<HTMLElement>('.json-tool-container') || document.body;
};

// 根据元素在视口中的位置选择一个不容易被遮挡的 placement
const pickPlacementForEl = (el: HTMLElement): 'right-start' | 'left-start' | 'bottom-start' | 'top-start' => {
    if (typeof window === 'undefined') return 'right-start';
    const rect = el.getBoundingClientRect();
    const POPOVER_WIDTH = 420;
    const POPOVER_HEIGHT_EST = 260;
    const rightSpace = window.innerWidth - rect.right;
    const leftSpace = rect.left;
    if (rightSpace >= POPOVER_WIDTH + 24) return 'right-start';
    if (leftSpace >= POPOVER_WIDTH + 24) return 'left-start';
    const bottomSpace = window.innerHeight - rect.bottom;
    if (bottomSpace >= POPOVER_HEIGHT_EST + 24) return 'bottom-start';
    return 'top-start';
};

// 为演示模式下的引导元素添加脉冲高亮；切换/结束时清理上一个
const applyDemoHighlight = (el: HTMLElement | null) => {
    if (demoHighlightedEl.value && demoHighlightedEl.value !== el) {
        demoHighlightedEl.value.classList.remove('demo-highlight-target');
    }
    if (el) {
        el.classList.add('demo-highlight-target');
        demoHighlightedEl.value = el;
        try {
            el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
        } catch (e) {
            /* ignore */
        }
    } else {
        demoHighlightedEl.value = null;
    }
};

// 更新 Popover 的锚点与 placement（演示模式下同时应用蓝色脉冲高亮）
const updateDemoPopoverAnchor = (selector: string | null) => {
    const el = resolveDemoAnchor(selector);
    demoPopoverAnchor.value = el;
    if (el) {
        demoPopoverPlacement.value = pickPlacementForEl(el);
    }
    // 仅在演示模式下启用高亮描边，普通 Popover 使用场景保持简洁
    if (isDemoMode.value) {
        applyDemoHighlight(el);
    }
};

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
// syncScrollEnabled 已由 useToolSettings 管理（在文件顶部解构）
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

const resetPrecomputedFoldingInfo = () => {
    if (asyncComputeTask) {
        asyncComputeTask.cancelToken = true;
        asyncComputeTask = null;
    }
    precomputedFoldingInfo.clear();
    precomputedFoldingRanges.clear();
};

const clearOutputFoldingInfo = () => {
    resetPrecomputedFoldingInfo();
    const clearFunc = (outputEditor as any)?.__clearFoldingInfoElements;
    if (clearFunc) {
        clearFunc();
    }
};

// @param formattedText 格式化后的JSON文本
const precomputeFoldingInfo = async (formattedText: string): Promise<void> => {
    resetPrecomputedFoldingInfo();

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

    // 将所有待处理区域的范围先记录下来，便于展示时进行同步补偿（可见区域即时计算）
    pendingItems.forEach(item => {
        precomputedFoldingRanges.set(item.startLine, { endLine: item.endLine, type: item.type });
    });

    // 创建异步计算任务
    const task = {
        pendingItems: pendingItems,
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
// 注意：diffLeftEditorStatus / diffRightEditorStatus 已在 Diff 模式管理一节顶部声明（约 L1144），
// 因为 useDiffEditors 在那一节就需要使用它们；这里不要重复声明。

// 折叠操作锁定状态（防止并发折叠）
let isFoldOperationLocked = false;

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
// 计算："编辑区域"(约60px) + "清空"按钮(约70px) + "上传"按钮(约70px) + gap(12px) + padding(30px) ≈ 242px
// 设置为 260px 以确保有足够余量，避免换行
const BUTTON_MIN_WIDTH = 260;

// 计算属性：判断编辑区域是否显示按钮
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

const LARGE_FILE_OPTIMIZATION_LINE_THRESHOLD = COLLAPSE_DISABLED_MAX_LINES;

const getEditorLineCount = (editor: monaco.editor.IStandaloneCodeEditor | null) => editor?.getModel()?.getLineCount() || 1;

const getLargeFileOptions = (enableLargeFileFolding: boolean, lineCount: number) =>
    enableLargeFileFolding
        ? {
              foldingMaximumRegions: 10000000, // 增加折叠区域上限（默认约5000），支持超大JSON文件
              largeFileOptimizations: lineCount > LARGE_FILE_OPTIMIZATION_LINE_THRESHOLD, // 超过 200 万行时启用大文件优化，优先保证可用性
          }
        : {};

const showProcessingRestrictedMessage = () => {
    showMessageWarning(settingsTxt.value.msgProcessingDisplayOnly);
};

const showCollapseRestrictedMessage = () => {
    showMessageWarning(settingsTxt.value.msgCollapseRestricted);
};

const ensureProcessingFeatureAvailable = () => {
    if (!canUseProcessingFeatures.value) {
        showProcessingRestrictedMessage();
        return false;
    }
    return true;
};

const ensureCollapseFeatureAvailable = () => {
    if (!canUseCollapseFeature.value) {
        if (isDisplayOnlyMode.value) {
            showProcessingRestrictedMessage();
        } else {
            showCollapseRestrictedMessage();
        }
        return false;
    }
    return true;
};

const shouldPrecomputeFoldingInfo = () => canUseCollapseFeature.value;

const nonJsonIndentationFoldingLanguages = new Set<EditorContentLanguage>(['yaml', 'toml', 'xml', 'html', 'css', 'plaintext']);

const getFoldingStrategyForLanguage = (language: string) => {
    return nonJsonIndentationFoldingLanguages.has(language as EditorContentLanguage) ? ('indentation' as const) : ('auto' as const);
};

// 获取编辑器配置
const getEditorOptions = (
    size: number,
    isReadOnly: boolean = false,
    language: string = 'json',
    enableLargeFileFolding: boolean = false,
    lineCount: number = 1
) => ({
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
    minimap: { enabled: showMinimap.value }, // 根据设置控制是否显示右侧的代码概览图
    lineNumbers: 'on' as const, // 启用行号
    roundedSelection: true, // 启用圆角选择
    renderIndentGuides: showIndentGuide.value, // 根据设置显示缩进指南线
    lineNumbersMinChars: 1, // 设置行号最小字符数为1
    renderWhitespace: 'none' as const, // 禁用空白字符显示

    // 右键菜单配置
    contextmenu: true, // 启用右键菜单

    // 滚动配置
    scrollBeyondLastLine: false, // 禁止滚动超过最后一行
    smoothScrolling: true, // 启用平滑滚动
    fixedOverflowWidgets: true, // 使溢出窗口(如提示、自动完成)固定显示
    stickyScroll: { enabled: stickyScroll.value }, // 根据设置控制粘性滚动

    // 滚动条尺寸：让纵向/横向滚动条更纤细一些
    scrollbar: {
        verticalScrollbarSize: 12,
        horizontalScrollbarSize: 12,
        verticalSliderSize: 12,
        horizontalSliderSize: 12,
        useShadows: false,
    },

    // 折叠配置
    folding: true, // 启用代码折叠功能（这是基础配置，必须开启）
    foldingStrategy: getFoldingStrategyForLanguage(language),
    ...getLargeFileOptions(enableLargeFileFolding, lineCount),

    // 编辑器配置
    links: true, // 启用链接检测功能，支持URL点击跳转
    tabSize: size, //  使用传入的大小作为Tab宽度
    indentSize: size, // 使用传入的大小作为缩进宽度
    wordWrap: wordWrap.value ? ('off' as const) : ('on' as const), 
    fontSize: fontSize.value, // 字体大小设置
    lineHeight: 16, // 设置行高为16px，与光标高度保持一致
    autoClosingBrackets: 'languageDefined' as const, // 根据语言自动闭合括号
    autoClosingQuotes: 'languageDefined' as const, // 根据语言自动闭合引号
    formatOnPaste: false, // 启用粘贴时自动格式化
    maxUndoRedoEntries: 100, // 历史记录可撤销/重做的最大步数为100
    useTabStops: false, // 禁用TabStop
    maxTokenizationLineLength: 500000,
    guides: {
        indentation: showIndentGuide.value, // 根据设置显示缩进引导线
        bracketPairs: showIndentGuide.value, // 根据设置显示括号配对引导线
        highlightActiveIndentation: showIndentGuide.value, // 根据设置显示当前缩进高亮
    },

    // 添加可访问性支持配置
    quickSuggestions: false,
    find: {
        // 配置查找组件
        addExtraSpaceOnTop: false, // 查找框顶部不添加额外空间
        autoFindInSelection: 'multiline' as const, // 不自动在选择区域内查找
        seedSearchStringFromSelection: 'always' as const, // 不使用选择内容作为查找初始内容
        globalFindClipboard: false, // 禁用全局查找剪贴板
    },

    // Unicode 高亮配置 - 禁用中文等非基本ASCII字符的黄色方框高亮
    unicodeHighlight: {ambiguousCharacters: false},
});

// 更新字符串换行
const updateWordWrap = () => {
    const options = {
        wordWrap: wordWrap.value ? ('off' as const) : ('on' as const),
    };

    inputEditor?.updateOptions(options);
    outputEditor?.updateOptions(options);
    // Diff 模式下左右是独立的 Monaco 编辑器，统一通过 composable 暴露的方法批量更新
    updateDiffEditorOptions(options);

    // 换行设置改变后，需要重新布局编辑器以确保正确显示
    nextTick(() => {
        updateEditorLayout();
        scheduleDiffEditorLayout();
        scheduleDiffRecompute();
    });
};

// 更新字体大小
const updateFontSize = () => {
    const options = {
        fontSize: fontSize.value,
    };

    inputEditor?.updateOptions(options);
    outputEditor?.updateOptions(options);
    updateDiffEditorOptions(options);

    nextTick(() => {
        scheduleDiffEditorLayout();
        scheduleDiffRecompute();
    });
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

// 更新缩略图显示
const updateMinimap = () => {
    const options = {
        minimap: { enabled: showMinimap.value },
    };

    inputEditor?.updateOptions(options);
    outputEditor?.updateOptions(options);
    updateDiffEditorOptions(options);
};

const updateStickyScroll = () => {
    const options = {
        stickyScroll: { enabled: stickyScroll.value },
    };

    inputEditor?.updateOptions(options);
    outputEditor?.updateOptions(options);
};

const syncEditorLargeFileOptions = (editor: monaco.editor.IStandaloneCodeEditor | null, enableLargeFileFolding: boolean = false) => {
    if (!editor) return;
    editor.updateOptions(getLargeFileOptions(enableLargeFileFolding, getEditorLineCount(editor)));
};

const isFoldLevelDisabled = (level: number): boolean => {
    return maxFoldableLevel.value !== null && maxFoldableLevel.value > 0 && level > maxFoldableLevel.value;
};

const getFoldLevelOptionLabel = (level: number): string => {
    if (isFoldLevelDisabled(level)) {
        return settingsTxt.value.levelLabel(level);
    }
    return settingsTxt.value.levelLabel(level);
};

const isSelectedFoldLevelDisabled = computed(() => {
    return selectedLevel.value > 0 && isFoldLevelDisabled(selectedLevel.value);
});

const analyzeFoldingRegionLevels = (regions: any) => {
    const allRegions: Array<{ index: number; level: number }> = [];
    const parentStack: number[] = [];
    const levelCounts = new Map<number, number>();
    let maxComputedLevel = 0;

    for (let i = 0; i < regions.length; i++) {
        const startLine = regions.getStartLineNumber(i);
        while (parentStack.length > 0) {
            const parentIdx = parentStack[parentStack.length - 1];
            if (regions.getEndLineNumber(parentIdx) >= startLine) break;
            parentStack.pop();
        }
        const level = parentStack.length + 1;
        parentStack.push(i);
        allRegions.push({ index: i, level });
        levelCounts.set(level, (levelCounts.get(level) || 0) + 1);
        maxComputedLevel = Math.max(maxComputedLevel, level);
    }

    return { allRegions, levelCounts, maxComputedLevel };
};

const resolveMaxFoldableLevel = async (editor: monaco.editor.IStandaloneCodeEditor | null): Promise<number | null> => {
    if (!editor) return null;
    const model = editor.getModel();
    if (!model || model.getLanguageId() !== 'json') return null;

    for (let attempt = 0; attempt < 4; attempt++) {
        const foldingModel = await getFoldingModelAsync(editor);
        const regions = foldingModel?.regions;
        if (regions && regions.length > 0) {
            return analyzeFoldingRegionLevels(regions).maxComputedLevel;
        }
        await sleep(150 * (attempt + 1));
    }

    return 0;
};

const refreshMaxFoldableLevel = async (language: string = 'json') => {
    if (!outputEditor || language !== 'json') {
        maxFoldableLevel.value = null;
        return;
    }
    const resolvedLevel = await resolveMaxFoldableLevel(outputEditor);
    if (!outputEditor) return;
    maxFoldableLevel.value = resolvedLevel;
};


const updateInputEditorConfig = (language?: EditorContentLanguage) => {
    if (!inputEditor) return;

    const resolvedLanguage = language ?? detectInputLanguage(inputEditor.getValue() || '');
    inputContentLanguage.value = resolvedLanguage;

    const model = inputEditor.getModel();
    if (model) {
        monaco.editor.setModelLanguage(model, resolvedLanguage);
        monaco.editor.setTheme(resolvedLanguage === 'toml' ? 'toml-theme' : 'vs');
        model.updateOptions({
            tabSize: indentSize.value,
            indentSize: indentSize.value,
            insertSpaces: true,
        });

        if (resolvedLanguage !== 'json') {
            monaco.editor.setModelMarkers(model, 'json', []);
            inputEditorErrors.value = [];
            currentErrorIndex.value = -1;
        } else {
            configureJsonSchemaSupport();
        }
    }

    inputEditor.updateOptions(getEditorOptions(indentSize.value, false, resolvedLanguage, true, getEditorLineCount(inputEditor)));
    refreshInputEditorErrors();
    updateLineNumberWidth(inputEditor);
    updateEditorHeight(inputEditor);
};

// 更新输出编辑器配置（包括模型选项，确保缩进指南线正确显示）
const updateOutputEditorConfig = (language: string = 'json', enableLargeFileFolding: boolean = false, customIndentSize?: number) => {
    if (!outputEditor) return;

    const size = customIndentSize ?? indentSize.value;
    const model = outputEditor.getModel();
    if (model) {
        monaco.editor.setModelLanguage(model, language);
        monaco.editor.setTheme(language === 'toml' ? 'toml-theme' : 'vs');
        // 更新模型选项，确保缩进指南线正确显示
        model.updateOptions({
            tabSize: size,
            indentSize: size,
            insertSpaces: true,
        });
    }

    // 更新编辑器配置
    outputEditor.updateOptions(getEditorOptions(size, true, language, enableLargeFileFolding, getEditorLineCount(outputEditor)));

    updateLineNumberWidth(outputEditor);
    updateEditorHeight(outputEditor);
    refreshMaxFoldableLevel(language).catch(() => {});
};

let lastFocusedEditor: monaco.editor.IStandaloneCodeEditor | null = null;

const trackEditorFocus = (editor: monaco.editor.IStandaloneCodeEditor) => {
    editor.onDidFocusEditorWidget(() => {
        lastFocusedEditor = editor;
    });
};

const openFindWidgetWithFocus = (editor: monaco.editor.IStandaloneCodeEditor) => {
    editor.focus();
    setTimeout(() => {
        const findController = editor.getContribution('editor.contrib.findController') as any;
        if (findController) {
            findController.start({
                forceRevealReplace: false,
                seedSearchStringFromSelection: 'always',
                shouldFocus: 1,
            });
        } else {
            editor.getAction('actions.find')?.run();
        }
        setTimeout(() => {
            const containers = [editor.getDomNode(), editor.getContainerDomNode()];
            for (const container of containers) {
                if (!container) continue;
                const findInput = container.querySelector<HTMLTextAreaElement>('.find-widget .monaco-inputbox textarea')
                    || container.querySelector<HTMLInputElement>('.find-widget .monaco-inputbox input');
                if (findInput) {
                    findInput.focus();
                    return;
                }
            }
        }, 50);
    }, 0);
};

const handleGlobalFind = (event: KeyboardEvent) => {
    if (!((event.metaKey || event.ctrlKey) && event.key === 'f')) return;

    const target = event.target as HTMLElement | null;
    if (!target) return;

    const isInsideJsonTool = target.closest('.json-tool-container');
    if (!isInsideJsonTool) return;

    event.preventDefault();
    event.stopPropagation();

    const inputPanel = inputEditorContainer.value?.closest('.editor-panel');
    const outputPanel = outputEditorContainer.value?.closest('.editor-panel');
    const diffLeftHost = diffLeftEditorContainer.value?.closest('.diff-cell-left');
    const diffRightHost = diffRightEditorContainer.value?.closest('.diff-cell-right');

    let targetEditor: monaco.editor.IStandaloneCodeEditor | null = null;

    if (isDiffMode.value) {
        // Diff 模式：根据点击/聚焦位置定位到左右 diff 编辑器，
        // 兜底使用 lastFocusedEditor（已记录最近聚焦的 diff 编辑器），
        // 再不行则默认使用左侧 diff 编辑器。
        const dLeft = getDiffLeftEditor();
        const dRight = getDiffRightEditor();
        if (diffLeftHost && diffLeftHost.contains(target)) {
            targetEditor = dLeft;
        } else if (diffRightHost && diffRightHost.contains(target)) {
            targetEditor = dRight;
        } else if (lastFocusedEditor && (lastFocusedEditor === dLeft || lastFocusedEditor === dRight)) {
            targetEditor = lastFocusedEditor;
        } else {
            targetEditor = dLeft || dRight;
        }
    } else if (inputPanel && inputPanel.contains(target)) {
        targetEditor = inputEditor;
    } else if (outputPanel && outputPanel.contains(target)) {
        targetEditor = outputEditor;
    } else if (lastFocusedEditor) {
        targetEditor = lastFocusedEditor;
    } else {
        targetEditor = inputEditor;
    }

    if (targetEditor) {
        openFindWidgetWithFocus(targetEditor);
    }
};

// 设置折叠信息显示（在折叠区域显示 n keys 或 n items）
const setupFoldingInfoDisplay = (editor: monaco.editor.IStandaloneCodeEditor) => {
    if (!editor) return;

    const model = editor.getModel();
    if (!model) return;

    // 从预先计算的数据中获取折叠区域的信息
    const getFoldingInfo = (startLine: number): { type: 'object' | 'array'; count: number } | null => {
        const info = precomputedFoldingInfo.get(startLine) || null;
        // 确保返回的数据有有效的 type 和 count
        if (info && (info.type === 'object' || info.type === 'array') && info.count > 0) {
            return info;
        }
        return null;
    };

    // 存储已添加的信息元素，用于清理和复用
    // key: lineNumber, value: { element: HTMLElement, foldedElement: Element, lastSeenAt: number }
    const infoElements = new Map<number, { element: HTMLElement; foldedElement: Element; lastSeenAt: number }>();

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
    let immediateUpdateRafId: number | null = null;
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

    // 折叠/展开会先触发 Monaco 的 DOM 重排，再稳定到最终状态。
    // 使用双 requestAnimationFrame 等待视图稳定后立即复用/更新统计节点，避免先消失再出现。
    const scheduleImmediateUpdate = () => {
        if (!model || model.isDisposed()) {
            return;
        }
        if (isUpdateDisabled) return;
        if (updateTimer) {
            clearTimeout(updateTimer);
            updateTimer = null;
        }
        if (immediateUpdateRafId) {
            cancelAnimationFrame(immediateUpdateRafId);
        }
        immediateUpdateRafId = requestAnimationFrame(() => {
            immediateUpdateRafId = requestAnimationFrame(() => {
                if (!isUpdateDisabled && model && !model.isDisposed()) {
                    updateFoldingInfo();
                }
                immediateUpdateRafId = null;
            });
        });
    };

    const clearInfoElements = () => {
        infoElements.forEach(info => {
            if (info.element && info.element.parentNode) {
                info.element.remove();
            }
        });
        infoElements.clear();
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
        if (outputType.value !== 'json') {
            clearInfoElements();
            return;
        }

        const visibleRange = getVisibleLineRange();
        if (!visibleRange) return;

        const editorDom = editor.getDomNode();
        if (!editorDom) return;

        const editorRect = editorDom.getBoundingClientRect();
        const editorHeight = editorRect.height;
        const viewLinesContainer = editorDom.querySelector('.view-lines') as HTMLElement | null;
        const viewLinesRect = viewLinesContainer?.getBoundingClientRect();
        const lineHeight = editor.getOption(monaco.editor.EditorOption.lineHeight);

        const now = Date.now();
        const foldedElements = editorDom.querySelectorAll('.inline-folded');
        const currentFoldedLines = new Set<number>();

        foldedElements.forEach((foldedElement) => {
            const viewLine = foldedElement.closest('.view-line') as HTMLElement | null;
            if (!viewLine) return;

            let lineNumber: number | null = null;
            let originalLineNumber: number | null = null;

            try {
                const rect = viewLine.getBoundingClientRect();
                const elementTop = rect.top - editorRect.top;
                const elementBottom = rect.bottom - editorRect.top;

                if (elementBottom < -100 || elementTop > editorHeight + 100) return;

                let target = editor.getTargetAtClientPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
                if (target?.position) {
                    lineNumber = target.position.lineNumber;
                    originalLineNumber = lineNumber;
                }

                if (!lineNumber) {
                    const foldedRect = foldedElement.getBoundingClientRect();
                    target = editor.getTargetAtClientPoint(foldedRect.left + foldedRect.width / 2, foldedRect.top + foldedRect.height / 2);
                    if (target?.position) {
                        lineNumber = target.position.lineNumber;
                        originalLineNumber = lineNumber;
                    }
                }

                if (!lineNumber && viewLinesRect) {
                    const foldedRect = foldedElement.getBoundingClientRect();
                    const elementY = foldedRect.top + foldedRect.height / 2 - viewLinesRect.top;
                    for (let line = visibleRange.start; line <= visibleRange.end; line++) {
                        try {
                            const lineTop = editor.getTopForLineNumber(line);
                            if (elementY >= lineTop && elementY < lineTop + lineHeight) {
                                lineNumber = line;
                                originalLineNumber = line;
                                break;
                            }
                        } catch (_) {
                            continue;
                        }
                    }
                }
            } catch (_) {
                return;
            }

            if (!lineNumber) return;
            if (lineNumber < visibleRange.start || lineNumber > visibleRange.end) return;

            if (!precomputedFoldingRanges.has(lineNumber)) {
                let found = false;
                for (let i = lineNumber - 1; i >= Math.max(1, lineNumber - 20); i--) {
                    if (precomputedFoldingRanges.has(i)) {
                        lineNumber = i;
                        found = true;
                        break;
                    }
                }

                if (!found) {
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

                if (!found) return;
            }

            currentFoldedLines.add(lineNumber);

            let info = getFoldingInfo(lineNumber);
            // 如果没有统计信息或统计数量为0，尝试重新计算
            if (!info || info.count === 0) {
                const range = precomputedFoldingRanges.get(lineNumber);
                if (range) {
                    try {
                        const m = editor.getModel();
                        if (m && !m.isDisposed()) {
                            const lines = m.getValue().split('\n');
                            const count = calculateFoldingCount(lines, lineNumber - 1, range.endLine - 1, range.type);
                            if (count > 0) {
                                precomputedFoldingInfo.set(lineNumber, { type: range.type, count });
                                info = getFoldingInfo(lineNumber);
                            }
                        }
                    } catch (_) {}
                }
            }
            // 确保 info 存在且有有效的 type 和 count，避免显示 undefined
            if (!info || !info.type || info.count === 0) return;

            const existingInfo = infoElements.get(lineNumber);
            const infoText = ` ${info.type === 'object' ? `${info.count} keys` : `${info.count} items`}`;
            if (existingInfo) {
                existingInfo.lastSeenAt = now;
                existingInfo.element.textContent = infoText;

                if (existingInfo.foldedElement === foldedElement && existingInfo.element.isConnected) {
                    return;
                }

                const nextParent = foldedElement.parentNode;
                if (nextParent) {
                    nextParent.insertBefore(existingInfo.element, foldedElement.nextSibling);
                    existingInfo.foldedElement = foldedElement;
                }
                return;
            }

            const infoElement = document.createElement('span');
            infoElement.className = 'folding-info-text';
            infoElement.textContent = ` ${info.type === 'object' ? `${info.count} keys` : `${info.count} items`}`;

            const parent = foldedElement.parentNode;
            if (parent) {
                parent.insertBefore(infoElement, foldedElement.nextSibling);
            } else {
                viewLine.appendChild(infoElement);
            }
            infoElements.set(lineNumber, { element: infoElement, foldedElement, lastSeenAt: now });
        });

        infoElements.forEach((info, lineNumber) => {
            const isOutsideVisibleRange = lineNumber < visibleRange.start || lineNumber > visibleRange.end;
            const isFoldedElementRemoved = !currentFoldedLines.has(lineNumber);

            // 折叠区域重排时，Monaco 会短暂移除旧 DOM。
            // 给一个很短的宽限期，避免统计文本因为瞬时丢失而闪烁。
            if (isOutsideVisibleRange || (isFoldedElementRemoved && now - info.lastSeenAt > 100)) {
                if (info.element.parentNode) info.element.remove();
                infoElements.delete(lineNumber);
            }
        });
    };

    // 监听内容变化
    editor.onDidChangeModelContent(() => {
        clearInfoElements();
        debouncedUpdate();
    });

    // 使用定时器定期更新折叠信息（作为备用方案，但频率降低）
    let intervalTimer: ReturnType<typeof setInterval> | null = null;

    // 监听编辑器焦点变化，当获得焦点时开始定时更新
    editor.onDidFocusEditorText(() => {
        if (intervalTimer) clearInterval(intervalTimer);
        intervalTimer = setInterval(() => {
            updateFoldingInfo();
        }, 1000);
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
            scheduleImmediateUpdate();
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
                scheduleImmediateUpdate();
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
    setTimeout(() => {updateFoldingInfo()}, 500);

    // 监听Monaco的折叠变化事件（当折叠状态改变时立即更新）
    editor.onDidChangeModelDecorations(() => {scheduleImmediateUpdate()});

    // 导出函数，供外部调用（层级收缩时使用）
    (editor as any).__disableFoldingInfoUpdate = disableUpdate;
    (editor as any).__enableFoldingInfoUpdateAndRefresh = enableUpdateAndRefresh;
    (editor as any).__clearFoldingInfoElements = clearInfoElements;
};

const findStringRangeByAst = (model: monaco.editor.ITextModel, position: monaco.Position): monaco.Range | null => {
    const languageId = model.getLanguageId();
    if (languageId !== 'json') {
        return null;
    }

    const content = model.getValue();
    const root = parseTree(content, [], {
        allowTrailingComma: true,
        disallowComments: false,
        allowEmptyContent: true,
    });

    if (!root) {
        return null;
    }

    const maxOffset = content.length;
    const rawOffset = model.getOffsetAt(position);
    const candidateOffsets = Array.from(new Set([
        Math.min(rawOffset, maxOffset),
        Math.min(Math.max(rawOffset - 1, 0), maxOffset),
    ]));

    const findInnermostStringNode = (node: JsonAstNode, targetOffset: number): JsonAstNode | null => {
        const nodeEnd = node.offset + node.length;
        const isWithinNode = targetOffset >= node.offset && targetOffset < nodeEnd;
        const isAtRightBoundary = targetOffset === nodeEnd;

        if (!isWithinNode && !isAtRightBoundary) {
            return null;
        }

        if (node.children) {
            for (const child of node.children) {
                const matched = findInnermostStringNode(child, targetOffset);
                if (matched) {
                    return matched;
                }
            }
        }

        if (node.type === 'string' && node.length >= 2) {
            return node;
        }

        return null;
    };

    for (const candidateOffset of candidateOffsets) {
        const matchedNode = findInnermostStringNode(root, candidateOffset);
        if (!matchedNode || matchedNode.length < 2) {
            continue;
        }

        const start = model.getPositionAt(matchedNode.offset);
        const end = model.getPositionAt(matchedNode.offset + matchedNode.length);
        return new monaco.Range(start.lineNumber, start.column, end.lineNumber, end.column);
    }

    return null;
};

// 兜底：按当前行扫描，查找字符串的完整范围（包括引号）
const findStringRangeByScan = (model: monaco.editor.ITextModel, position: monaco.Position): monaco.Range | null => {
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

// 查找字符串的完整范围（包括引号）
const findStringRange = (model: monaco.editor.ITextModel, position: monaco.Position): monaco.Range | null => {
    return findStringRangeByAst(model, position) ?? findStringRangeByScan(model, position);
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

// 获取存档总大小信息
const getArchivesTotalSizeInfo = (): string => {
    const totalSize = archives.value.reduce((sum, archive) => sum + archive.size, 0);
    const formattedUsedSize = formatFileSize(totalSize);
    return settingsTxt.value.archiveUsedSize(formattedUsedSize);
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
                // 在整个文档中查找所有完全匹配的位置
                // findMatches 的 isRegex 为 false 时，searchString 为纯字面量，无需转义
                const matches = model.findMatches(
                    selectedText,
                    false,
                    false,
                    true,
                    null,
                    false,
                    1073741824
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
    if (!editor) return [];

    // 监听选择变化
    const selectionDisposable = editor.onDidChangeCursorSelection(e => {
        updateEditorStatus(editor, statusRef, isInputEditor);
    });

    // 监听内容变化（更新总行数等信息）
    const contentDisposable = editor.onDidChangeModelContent(() => {
        updateEditorStatus(editor, statusRef, isInputEditor);
    });

    // 初始化状态
    updateEditorStatus(editor, statusRef, isInputEditor);
    return [selectionDisposable, contentDisposable];
};

// 设置双击选中整个字符串并复制功能
const setupDoubleClickSelectString = (editor: monaco.editor.IStandaloneCodeEditor, enableCopy: boolean = true) => {
    editor.onMouseDown((e: monaco.editor.IEditorMouseEvent) => {
        const currentPosition = e.target.position;

        if (!currentPosition) {
            return;
        }

        if (e.event.detail === 2) {
            const model = editor.getModel();
            if (!model) return;

            const clickPosition = new monaco.Position(currentPosition.lineNumber, currentPosition.column);

            setTimeout(() => {
                const stringRange = findStringRange(model, clickPosition);

                if (stringRange) {
                    const stringValueRange = new monaco.Range(
                        stringRange.startLineNumber,
                        stringRange.startColumn + 1, // 跳过开始引号
                        stringRange.endLineNumber,
                        stringRange.endColumn - 1 // 跳过结束引号
                    );

                    editor.setSelection(stringValueRange);

                    if (enableCopy) {
                        const stringValueText = model.getValueInRange(stringValueRange);
                        copyToClipboard(stringValueText);
                        showMessageSuccess('字符串已复制到剪贴板');
                    }
                }
            }, 10);
        }
    });
};

/**
 * 给编辑器注册「Base64 编解码 / URL 编解码」四个右键菜单 action。
 * 普通模式与 Diff 模式（左右两个 Monaco）共用此函数，
 * 文案使用 settingsTxt 计算属性，自动根据 props.locale 切换中英文。
 */
const registerEncodingActions = (editor: monaco.editor.IStandaloneCodeEditor) => {
    editor.addAction({
        id: 'base64-encode',
        label: settingsTxt.value.ctxBase64Encode,
        contextMenuGroupId: '9_base64',
        contextMenuOrder: 1,
        precondition: 'editorHasSelection',
        run: (ed) => {
            const selection = ed.getSelection();
            if (!selection) return;
            const model = ed.getModel();
            if (!model) return;
            const selectedText = model.getValueInRange(selection);
            if (!selectedText) return;
            try {
                const encoded = Base64.encode(selectedText);
                ed.executeEdits('base64-encode', [{ range: selection, text: encoded }]);
                showMessageSuccess(settingsTxt.value.msgBase64EncodeOk);
            } catch {
                showMessageError(settingsTxt.value.msgBase64EncodeFail);
            }
        },
    });

    editor.addAction({
        id: 'base64-decode',
        label: settingsTxt.value.ctxBase64Decode,
        contextMenuGroupId: '9_base64',
        contextMenuOrder: 2,
        precondition: 'editorHasSelection',
        run: (ed) => {
            const selection = ed.getSelection();
            if (!selection) return;
            const model = ed.getModel();
            if (!model) return;
            const selectedText = model.getValueInRange(selection);
            if (!selectedText) return;
            try {
                const decoded = Base64.decode(selectedText);
                ed.executeEdits('base64-decode', [{ range: selection, text: decoded }]);
                showMessageSuccess(settingsTxt.value.msgBase64DecodeOk);
            } catch {
                showMessageError(settingsTxt.value.msgBase64DecodeFail);
            }
        },
    });

    editor.addAction({
        id: 'url-encode',
        label: settingsTxt.value.ctxUrlEncode,
        contextMenuGroupId: '9_base64',
        contextMenuOrder: 3,
        precondition: 'editorHasSelection',
        run: (ed) => {
            const selection = ed.getSelection();
            if (!selection) return;
            const model = ed.getModel();
            if (!model) return;
            const selectedText = model.getValueInRange(selection);
            if (!selectedText) return;
            try {
                const encoded = encodeURIComponent(selectedText);
                ed.executeEdits('url-encode', [{ range: selection, text: encoded }]);
                showMessageSuccess(settingsTxt.value.msgUrlEncodeOk);
            } catch {
                showMessageError(settingsTxt.value.msgUrlEncodeFail);
            }
        },
    });

    editor.addAction({
        id: 'url-decode',
        label: settingsTxt.value.ctxUrlDecode,
        contextMenuGroupId: '9_base64',
        contextMenuOrder: 4,
        precondition: 'editorHasSelection',
        run: (ed) => {
            const selection = ed.getSelection();
            if (!selection) return;
            const model = ed.getModel();
            if (!model) return;
            const selectedText = model.getValueInRange(selection);
            if (!selectedText) return;
            try {
                const decoded = decodeURIComponent(selectedText);
                ed.executeEdits('url-decode', [{ range: selection, text: decoded }]);
                showMessageSuccess(settingsTxt.value.msgUrlDecodeOk);
            } catch {
                showMessageError(settingsTxt.value.msgUrlDecodeFail);
            }
        },
    });
};

// 添加窗口大小变化的处理函数
const handleResize = () => {
    const container = document.querySelector('.editor-container');
    if (container) {
        editorContainerWidth.value = container.getBoundingClientRect().width;
    }
    updateEditorLayout();
    scheduleDiffEditorLayout();
};

// 添加防抖函数

// 使用防抖处理 resize 事件
const debouncedResize = debounce(handleResize, 100);

// 创建防抖版本的行号宽度更新函数，避免频繁调用
const debouncedUpdateLineNumberWidth = debounce(updateLineNumberWidth, 150);

// 监听全屏状态变化
watch(isFullscreen, () => {
    nextTick(() => {
        setTimeout(() => {
            if (inputEditor) inputEditor.layout();
            if (outputEditor) outputEditor.layout();
            layoutDiffEditors();
            handleResize();
        }, 80);
    });
});

// 监听缩略图设置的变化
watch(showMinimap, () => {
    updateMinimap();
});

// 监听粘性滚动设置的变化
watch(stickyScroll, () => {
    updateStickyScroll();
});

watch(stickyScroll, value => {
    if (!isDisplayOnlyMode.value) {
        preferredStickyScroll.value = value;
    }
});

// 监听是否启用语法检查
watch(enableDiagnostics, () => {
    configureJsonSchemaSupport();
    refreshInputEditorErrors();
});

watch(enableDiagnostics, value => {
    if (!isDisplayOnlyMode.value) {
        preferredEnableDiagnostics.value = value;
    }
});

watch(
    isDisplayOnlyMode,
    displayOnly => {
        if (displayOnly) {
            enableDiagnostics.value = false;
            stickyScroll.value = false;
        } else {
            enableDiagnostics.value = preferredEnableDiagnostics.value;
            stickyScroll.value = preferredStickyScroll.value;
        }
    },
    { immediate: true }
);

let inputMarkersListener: monaco.IDisposable | null = null;

const refreshInputEditorErrors = () => {
    const model = inputEditor?.getModel();
    if (!model || !enableDiagnostics.value || model.getLanguageId() !== 'json') {
        inputEditorErrors.value = [];
        currentErrorIndex.value = -1;
        return;
    }

    const markers = monaco.editor.getModelMarkers({ resource: model.uri });
    const errors = markers
        .filter(m => m.severity === monaco.MarkerSeverity.Error)
        .sort((a, b) => a.startLineNumber - b.startLineNumber || a.startColumn - b.startColumn);

    inputEditorErrors.value = errors;
    if (errors.length === 0) {
        currentErrorIndex.value = -1;
        return;
    }
    if (currentErrorIndex.value < 0 || currentErrorIndex.value >= errors.length) {
        currentErrorIndex.value = 0;
    }
};

const goToPrevError = () => {
    const errors = inputEditorErrors.value;
    if (!errors.length || !inputEditor) return;
    currentErrorIndex.value = currentErrorIndex.value <= 0 ? errors.length - 1 : currentErrorIndex.value - 1;
    jumpToError(errors[currentErrorIndex.value]);
};

const goToNextError = () => {
    const errors = inputEditorErrors.value;
    if (!errors.length || !inputEditor) return;
    currentErrorIndex.value = currentErrorIndex.value >= errors.length - 1 ? 0 : currentErrorIndex.value + 1;
    jumpToError(errors[currentErrorIndex.value]);
};

const jumpToError = (error: monaco.editor.IMarker) => {
    if (!inputEditor) return;
    const range = new monaco.Range(error.startLineNumber, error.startColumn, error.endLineNumber, error.endColumn);
    inputEditor.setSelection(range);
    inputEditor.revealRangeInCenter(range);
    inputEditor.focus();
};

// 监听格式化设置的变化
watch([indentSize, arrayNewLine, showIndentGuide], () => {
    // 如果编辑区域为空，不进行任何操作
    if (!inputEditor?.getValue()?.trim()) {
        selectedLevel.value = 0;
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

// ==================== 自动保存设置到 localStorage（已抽离至 useToolSettings） ====================
// useToolSettings 内部已建立 deep watch 自动保存，这里不再重复声明。

// 监听按钮可见性变化，更新滚动状态
watch(
    () => buttonVisibility.value,
    () => {checkToolBarScroll()},
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

    // 注册 YAML 语言高亮（Monarch tokenizer）
    monaco.languages.register({ id: 'yaml' });
    monaco.languages.setMonarchTokensProvider('yaml', {
        tokenizer: {
            root: [
                [/\s+/, 'white'],
                [/#.*$/, 'comment'],
                [/^(\s*)(-\s)/, ['', 'keyword']],
                [/^(\s*)([A-Za-z0-9_\-."'\[\]]+)(\s*:\s*)/, ['', 'type', 'delimiter']],
                [/\b(true|false|yes|no|on|off|null|~)\b/i, 'keyword'],
                [/[|>](?=\s|$)/, 'string'],
                [/"([^"\\]|\\.)*"/, 'string'],
                [/'([^'\\]|\\.)*'/, 'string'],
                [/\b-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?\b/, 'number'],
                [/[:{}\[\],&*?]/, 'delimiter'],
            ],
        },
    });

    // 注册 XML 语言高亮（Monarch tokenizer）
    monaco.languages.register({ id: 'xml' });
    monaco.languages.setMonarchTokensProvider('xml', {
        tokenizer: {
            root: [
                [/<!--/, 'comment', '@comment'],
                [/<\?xml/, 'metatag', '@processing'],
                [/<\/?[\w:\-\.]+/, 'tag', '@tag'],
                [/[^<]+/, ''],
            ],
            comment: [
                [/-->/, 'comment', '@pop'],
                [/[^-]+/, 'comment'],
                [/-/, 'comment'],
            ],
            processing: [
                [/\?>/, 'metatag', '@pop'],
                [/[^\?]+/, 'metatag'],
                [/\?/, 'metatag'],
            ],
            tag: [
                [/\s+/, 'white'],
                [/[\w:\-\.]+(?=\s*=)/, 'attribute.name'],
                [/=/, 'delimiter'],
                [/"[^"]*"/, 'attribute.value'],
                [/'[^']*'/, 'attribute.value'],
                [/\/?>/, 'tag', '@pop'],
            ],
        },
    });

    // 注册 HTML 语言高亮（复用标签/属性规则）
    monaco.languages.register({ id: 'html' });
    monaco.languages.setMonarchTokensProvider('html', {
        tokenizer: {
            root: [
                [/<!--/, 'comment', '@comment'],
                [/<\!DOCTYPE/, 'metatag', '@doctype'],
                [/<\/?[\w:-]+/, 'tag', '@tag'],
                [/[^<]+/, ''],
            ],
            comment: [
                [/-->/, 'comment', '@pop'],
                [/[^-]+/, 'comment'],
                [/-/, 'comment'],
            ],
            doctype: [
                [/>/, 'metatag', '@pop'],
                [/[^>]+/, 'metatag'],
            ],
            tag: [
                [/\s+/, 'white'],
                [/[\w:-]+(?=\s*=)/, 'attribute.name'],
                [/=/, 'delimiter'],
                [/"[^"]*"/, 'attribute.value'],
                [/'[^']*'/, 'attribute.value'],
                [/\/?>/, 'tag', '@pop'],
            ],
        },
    });

    // 注册 CSS 语言高亮（Monarch tokenizer）
    monaco.languages.register({ id: 'css' });
    monaco.languages.setMonarchTokensProvider('css', {
        tokenizer: {
            root: [
                [/\s+/, 'white'],
                [/\/\*/, 'comment', '@comment'],
                [/@[a-z-]+/i, 'keyword'],
                [/[.#]?[a-zA-Z_][\w-]*(?=\s*[\{,])/, 'tag'],
                [/\{/, 'delimiter.bracket', '@rulebody'],
            ],
            comment: [
                [/\*\//, 'comment', '@pop'],
                [/[^*]+/, 'comment'],
                [/\*/, 'comment'],
            ],
            rulebody: [
                [/\s+/, 'white'],
                [/\/\*/, 'comment', '@comment'],
                [/[a-z-]+(?=\s*:)/i, 'attribute.name'],
                [/:/, 'delimiter'],
                [/"[^"]*"/, 'string'],
                [/'[^']*'/, 'string'],
                [/#{0,1}[0-9a-fA-F]{3,8}\b/, 'number.hex'],
                [/-?\d+(\.\d+)?(px|em|rem|%|vh|vw|s|ms|deg)?\b/, 'number'],
                [/[a-z-]+\(/i, 'keyword'],
                [/;/, 'delimiter'],
                [/\}/, 'delimiter.bracket', '@pop'],
            ],
        },
    });

    // 注册 TOML 语言高亮（Monarch tokenizer）
    monaco.languages.register({ id: 'toml' });
    monaco.languages.setMonarchTokensProvider('toml', {
        tokenizer: {
            root: [
                // 注释
                [/#.*$/, 'comment'],
                // 表头 [...]
                [/^\s*\[.+?\]\s*$/, 'type.identifier'],
                // 数组表头 [[...]]
                [/^\s*\[\[.+?\]\]\s*$/, 'type.identifier'],
                // 布尔值
                [/\b(true|false)\b/, 'keyword'],
                // 日期时间
                [/\b\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?)?\b/, 'string.date'],
                // 内联数组 [...] 中的内容（不匹配嵌套括号）
                [/\[/, { token: 'delimiter.bracket', next: '@inline_array' }],
                // 键名
                [/^[a-zA-Z_][a-zA-Z0-9_\-]*/, 'variable'],
                // 等号
                [/=/, 'delimiter'],
                // 字符串（双引号）
                [/"[^"\\]*(?:\\.[^"\\]*)*"/, 'string'],
                // 数字
                [/-?\d+\.?\d*([eE][+-]?\d+)?/, 'number'],
            ],
            inline_array: [
                [/\]/, { token: 'delimiter.bracket', next: '@pop' }],
                [/,/, 'delimiter'],
                [/"[^"\\]*(?:\\.[^"\\]*)*"/, 'string'],
                [/-?\d+\.?\d*([eE][+-]?\d+)?/, 'number'],
                [/\b(true|false)\b/, 'keyword'],
                [/\s+/, 'white'],
            ],
        },
    });
    // TOML 主题样式（使用 vs theme 的基本样式）
    monaco.editor.defineTheme('toml-theme', {
        base: 'vs',
        inherit: true,
        rules: [
            { token: 'comment', foreground: '6A9955' },
            { token: 'variable', foreground: '0011FF' },
            { token: 'type.identifier', foreground: 'AF00DB' },
            { token: 'string', foreground: 'A31515' },
            { token: 'string.date', foreground: '098658' },
            { token: 'number', foreground: '098658' },
            { token: 'keyword', foreground: '0000FF' },
        ],
        colors: {},
    });
};

// 创建输入编辑器
const createInputEditor = () => {
    if (!inputEditorContainer.value) return;

    const inputOptions = getEditorOptions(indentSize.value, false, inputContentLanguage.value, true, 1);
    inputEditor = monaco.editor.create(inputEditorContainer.value, inputOptions);
    currentInputLineCount.value = getEditorLineCount(inputEditor);

    const container = inputEditorContainer.value;
    nextTick(() => {
        const textarea = container.querySelector('textarea');
        if (textarea) {
            textarea.setAttribute('id', 'monaco-input-editor');
            textarea.setAttribute('name', 'monaco-input-editor');
        }

        // 监听粘贴事件，自动检测并调整缩进
        if (inputEditor) {
            const editor = inputEditor!;
            inputEditor.onDidPaste(() => {
                const model = editor.getModel();
                if (!model) return;

                // 使用 Monaco Editor 内置的缩进检测 API
                const detected = (model as any).detectIndentation ? (model as any).detectIndentation(true, 2) : null;

                // 如果检测到使用了空格缩进，且缩进大小与当前设置不同
                if (detected && detected.insertSpaces && detected.tabSize !== indentSize.value) {
                    // 只要检测到有效的正整数缩进（通常是2, 4, 8等），就自动调整编辑器的显示配置
                    model.updateOptions({ tabSize: detected.tabSize, indentSize: detected.tabSize, insertSpaces: true });
                    editor.updateOptions({ tabSize: detected.tabSize, indentSize: detected.tabSize } as any);
                }
            });
        }
    });

    const inputModel = inputEditor?.getModel();
    if (inputModel) {
        inputMarkersListener?.dispose();
        inputMarkersListener = monaco.editor.onDidChangeMarkers((uris) => {
            const hit = uris.some(u => u.toString() === inputModel.uri.toString());
            if (!hit) return;
            refreshInputEditorErrors();
        });
        // 首次创建后主动同步一次，避免必须等到 markers 变化才显示按钮
        refreshInputEditorErrors();
    }
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

// 配置JSON Schema支持
const configureJsonSchemaSupport = () => {
    const model = inputEditor?.getModel();
    const isJsonModel = model?.getLanguageId() === 'json';

    // 关闭语法检查时，需要手动清除已有的 markers，否则红色波浪线不会消失
    if ((!enableDiagnostics.value || !isJsonModel) && model) {
        monaco.editor.setModelMarkers(model, 'json', []);
        inputEditorErrors.value = [];
        currentErrorIndex.value = -1;
    }

    // 配置JSON语言服务，提供更好的自动补全
    monaco.languages.json.jsonDefaults.setModeConfiguration({
        documentFormattingEdits: false,
        documentRangeFormattingEdits: false,
        completionItems: true, // 保留自动补全功能
        hovers: true,
        documentSymbols: true,
        tokens: true,
        colors: true,
        foldingRanges: true,
        diagnostics: enableDiagnostics.value, // 启用/关闭JSON语法检查和错误提示
        selectionRanges: true,
    });

    // 开启语法检查时，强制语言服务重新验证，清除之前关闭时遗留的 markers
    if (enableDiagnostics.value && model && isJsonModel) {
        const currentValue = model.getValue();
        model.setValue(''); // 强制触发重新验证
        model.setValue(currentValue);
    }
};

// 配置输入编辑器
const configureInputEditor: () => void = () => {
    if (!inputEditor) return;

    // 配置JSON Schema支持
    configureJsonSchemaSupport();

    // 输入编辑器使用用户设置的缩进大小
    const indentSizeValue = indentSize.value;
    inputEditor.getModel()?.updateOptions({ tabSize: indentSizeValue, indentSize: indentSizeValue, insertSpaces: true });
    // 同时更新编辑器选项，确保formatOnPaste使用用户设置的缩进
    inputEditor.updateOptions({ tabSize: indentSizeValue, indentSize: indentSizeValue } as any);

    // 初始化时不加载数据，保持空白
    inputEditor.setValue('');
    updateInputEditorConfig('json');
    maxLevel.value = 0;
    selectedLevel.value = 0;

    // 设置双击选中整个字符串（不复制到剪贴板）
    setupDoubleClickSelectString(inputEditor, false);

    trackEditorFocus(inputEditor);

    // 注册 Base64 / URL 编解码右键菜单（与 Diff 模式共用同一份注册逻辑）
    registerEncodingActions(inputEditor);

    // 设置选择变化监听（输入编辑器启用匹配计数功能）
    setupSelectionListener(inputEditor, inputEditorStatus, true);

    // 监听输入变化
    let prevInputLineCount = getEditorLineCount(inputEditor);
    inputEditor.onDidChangeModelContent((e) => {
        const lineCount = getEditorLineCount(inputEditor);
        const oldLineCount = prevInputLineCount;
        currentInputLineCount.value = lineCount;
        const value = inputEditor?.getValue() || '';
        const detectedLanguage = detectInputLanguage(value);
        if (detectedLanguage !== inputContentLanguage.value) {
            updateInputEditorConfig(detectedLanguage);
        }

        const isFullReplace = e.changes.some(change => {
            const replacedLines = change.range.endLineNumber - change.range.startLineNumber + 1;
            return replacedLines >= oldLineCount && change.text.includes('\n');
        });
        if (isFullReplace) {
            inputEditor?.updateOptions({ folding: false });
            nextTick(() => {
                inputEditor?.updateOptions({ folding: true });
            });
        }
        prevInputLineCount = lineCount;
        syncEditorLargeFileOptions(inputEditor, true);

        // 使用防抖更新行号宽度，避免频繁调用
        debouncedUpdateLineNumberWidth(inputEditor);
        if (value.trim()) {
            const cleanedContent = value.replace(/[\u0000-\u0008\u000B-\u000C\u000E-\u0019]+/g, '');

            if (detectedLanguage !== 'json') {
                maxLevel.value = 0;
                selectedLevel.value = 0;
                return;
            }

            // 优先使用 Monaco model 的行数统计，避免重复扫描超大字符串
            if (lineCount > MAX_LINES) {
                showMessageError(`内容超过${MAX_LINES}行限制，请使用较小的文件或使用其他工具处理超大文件`);
                maxLevel.value = 0;
                selectedLevel.value = 0;
                setTimeout(() => {
                    clearInput(false);
                }, 100);
                return;
            }

            if (lineCount > FULL_FEATURE_MAX_LINES) {
                if (oldLineCount <= COLLAPSE_DISABLED_MAX_LINES && lineCount > COLLAPSE_DISABLED_MAX_LINES) {
                    showProcessingRestrictedMessage();
                } else if (oldLineCount <= FULL_FEATURE_MAX_LINES && lineCount > FULL_FEATURE_MAX_LINES) {
                    showCollapseRestrictedMessage();
                }
                maxLevel.value = 0;
                selectedLevel.value = 0;
                return;
            }

            try {
                const { data: parsed } = preprocessJSON(cleanedContent);
                const level = calculateMaxLevel(parsed);
                if (level > 99) {
                    showMessageError(settingsTxt.value.msgJsonLevelTooDeep);
                    maxLevel.value = 0;
                    selectedLevel.value = 0;
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
                            clearOutputFoldingInfo();
                            outputEditor.setValue('');
                            updateEditorHeight(outputEditor);
                            updateLineNumberWidth(outputEditor);
                        }
                    }, 100);
                    return;
                }
                maxLevel.value = level;
                if (maxLevel.value > 0 && selectedLevel.value === 0) {
                    selectedLevel.value = getDefaultFoldLevel(maxLevel.value);
                }
            } catch (error) {
                maxLevel.value = 0;
                selectedLevel.value = 0;
            }
        } else {
            maxLevel.value = 0;
            selectedLevel.value = 0;
            resetPrecomputedFoldingInfo();
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
    trackEditorFocus(outputEditor);
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
    } catch (error) {}
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
            inputEditorResizeObserver = new ResizeObserver((entries) => {
                // 立即同步 Monaco 布局，保证滚动条在拖动浏览器边界时紧贴容器边缘
                if (inputEditor) {
                    const entry = entries[0];
                    const contentRect = entry?.contentRect;
                    const width = contentRect ? contentRect.width : inputContainer.clientWidth;
                    const height = contentRect ? contentRect.height : inputContainer.clientHeight;
                    inputEditor.layout({ width, height });
                }
                // 继续触发其它与 resize 相关的防抖副作用（如尺寸状态、diff 布局等）
                debouncedResize();
            });
            inputEditorResizeObserver.observe(inputContainer);
        }
    }

    // 监听输出编辑器容器
    if (outputEditorContainer.value) {
        const outputContainer = outputEditorContainer.value.parentElement; // .monaco-editor-container
        if (outputContainer && !outputEditorResizeObserver) {
            outputEditorResizeObserver = new ResizeObserver((entries) => {
                // 立即同步 Monaco 布局，保证滚动条在拖动浏览器边界时紧贴容器边缘
                if (outputEditor) {
                    const entry = entries[0];
                    const contentRect = entry?.contentRect;
                    const width = contentRect ? contentRect.width : outputContainer.clientWidth;
                    const height = contentRect ? contentRect.height : outputContainer.clientHeight;
                    outputEditor.layout({ width, height });
                }
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
    window.addEventListener('keydown', handleGlobalFind, true);

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
    markSettingsInitialized();
});

// 清理编辑器实例
onBeforeUnmount(() => {
    // 关闭所有消息提示，避免路由切换时消息提示仍然显示
    ElMessage.closeAll();

    // 移除resize事件监听器
    window.removeEventListener('resize', debouncedResize);
    window.removeEventListener('resize', checkToolBarScroll);
    window.removeEventListener('keydown', handleEscapeKey);
    window.removeEventListener('keydown', handleGlobalFind, true);

    // 清理 ResizeObserver
    if (inputEditorResizeObserver) {
        inputEditorResizeObserver.disconnect();
        inputEditorResizeObserver = null;
    }
    if (outputEditorResizeObserver) {
        outputEditorResizeObserver.disconnect();
        outputEditorResizeObserver = null;
    }

    destroyDiffEditor();

    if (inputEditor) {
        inputEditor.dispose();
        inputEditor = null;
    }

    if (outputEditor) {
        outputEditor.dispose();
        outputEditor = null;
    }

    if (inputMarkersListener) {
        inputMarkersListener.dispose();
        inputMarkersListener = null;
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

const getFoldingModelAsync = async (editor: monaco.editor.IStandaloneCodeEditor): Promise<any> => {
    const controller = (editor as any).getContribution?.('editor.contrib.folding');
    return controller?.getFoldingModel?.() ?? null;
};

// 层级收缩
const foldByIndentation = async (): Promise<{ firstCollapsedLine: number | null; collapsedCount: number }> => {
    if (!outputEditor) return { firstCollapsedLine: null, collapsedCount: 0 };

    const model = outputEditor.getModel();
    if (!model) return { firstCollapsedLine: null, collapsedCount: 0 };

    const targetLevel = selectedLevel.value;

    const foldingModel = await getFoldingModelAsync(outputEditor);
    if (!foldingModel) return { firstCollapsedLine: null, collapsedCount: 0 };

    const regions = foldingModel.regions;
    if (!regions || regions.length === 0) return { firstCollapsedLine: null, collapsedCount: 0 };

    const toExpand: any[] = [];
    const toCollapse: any[] = [];
    const toCollapseStartLines: number[] = [];

    const { allRegions } = analyzeFoldingRegionLevels(regions);

    for (const { index, level } of allRegions) {
        const region = regions.toRegion(index);
        const isCollapsed = regions.isCollapsed(index);
        if (level >= targetLevel) {
            if (!isCollapsed) {
                toCollapse.push(region);
                toCollapseStartLines.push(regions.getStartLineNumber(index));
            }
        } else {
            if (isCollapsed) toExpand.push(region);
        }
    }

    if (toExpand.length > 0) {
        foldingModel.toggleCollapseState(toExpand);
    }
    if (toCollapse.length > 0) {
        foldingModel.toggleCollapseState(toCollapse);
    }

    const firstCollapsedLine = toCollapseStartLines.length > 0 ? Math.min(...toCollapseStartLines) : null;
    return { firstCollapsedLine, collapsedCount: toCollapseStartLines.length };
};

const getDefaultFoldLevel = (level: number) => {
    if (level >= 2) return 2;
    if (level > 0) return 1;
    return 0;
};

// 数据转换专用哨兵前缀/后缀：用于在 YAML/TOML/XML/Go 输出中标记"应当以无引号原字面量形式出现的数字"
const HPN_SENTINEL_PREFIX = '__HPN_START_7f3a9c__';
const HPN_SENTINEL_SUFFIX = '__HPN_END_7f3a9c__';

// 将 parseJson5 产出的 __highPrecisionNumber 包装对象递归还原：
// - 数字字面量在 JS 安全表达范围内 → 还原为真实的 Number
// - 超出安全整数范围或需要保留形态（如 1.10、1e3） → 用哨兵字符串占位
const unwrapHighPrecisionForConvert = (data: any): any => {
    const tryParseWrapper = (str: string): string | null => {
        // 轻量检查，避免对无关字符串执行 JSON.parse
        if (typeof str !== 'string' || str.length < 10 || str.indexOf('__highPrecisionNumber') === -1) {
            return null;
        }
        try {
            const parsed = JSON.parse(str);
            if (parsed && typeof parsed === 'object' && parsed.__highPrecisionNumber && typeof parsed.originalString === 'string') {
                return parsed.originalString;
            }
        } catch {
            // 忽略
        }
        return null;
    };

    const walk = (node: any): any => {
        if (node === null || node === undefined) return node;
        if (typeof node === 'string') {
            const literal = tryParseWrapper(node);
            if (literal !== null) {
                const num = Number(literal);
                // 安全整数/有限浮点 且 字面量 toString 后能精确还原 → 直接用真实 Number
                if (Number.isFinite(num)) {
                    const isInteger = !/[.eE]/.test(literal);
                    if (isInteger && Number.isSafeInteger(num) && String(num) === literal.replace(/^\+/, '')) {
                        return num;
                    }
                    if (!isInteger && String(num) === literal) {
                        return num;
                    }
                }
                // 精度敏感（超大整数 / 需要保留末尾零或指数形态）→ 用哨兵占位
                return HPN_SENTINEL_PREFIX + literal + HPN_SENTINEL_SUFFIX;
            }
            return node;
        }
        if (Array.isArray(node)) {
            return node.map(walk);
        }
        if (typeof node === 'object') {
            const result: Record<string, any> = {};
            for (const key of Object.keys(node)) {
                result[key] = walk(node[key]);
            }
            return result;
        }
        return node;
    };
    return walk(data);
};

// 将转换后的输出字符串里的哨兵（及其可能被库加的引号）统一还原为无引号的原始数字字面量
const restoreHighPrecisionInOutput = (output: string): string => {
    // 先匹配"被引号包裹的哨兵"：双引号 / 单引号 两种常见情况
    const quotedPattern = new RegExp(
        `([\"\'])${HPN_SENTINEL_PREFIX}([^\"\']*?)${HPN_SENTINEL_SUFFIX}\\1`,
        'g'
    );
    let restored = output.replace(quotedPattern, (_m, _q, literal) => literal);
    // 再匹配"未被引号包裹的哨兵"（例如 XML 文本节点内）
    const rawPattern = new RegExp(`${HPN_SENTINEL_PREFIX}([^]*?)${HPN_SENTINEL_SUFFIX}`, 'g');
    restored = restored.replace(rawPattern, (_m, literal) => literal);
    return restored;
};

// 处理转换
const handleConvert = (command: string) => {
    try {
        const value = inputEditor?.getValue() || '';
        if (!value.trim()) {
            showMessageError(settingsTxt.value.msgInputContentRequired);
            return;
        }

        // 处理 Cookie 转换
        if (command === 'cookie') {
            const jsonStr = cookieToJSON(value);
            outputEditor?.setValue(jsonStr);
            updateLineNumberWidth(outputEditor);
            updateEditorHeight(outputEditor);
            showMessageSuccess(settingsTxt.value.msgConvertCookieSuccess);
            return;
        }

        // 处理其他格式转换（不启用高精度浮点数，即使用户开启了设置）
        // 注意：转换到 YAML/TOML/XML/Go 是“语义转换”，需要按 JSON 规范解码字符串中的 \uXXXX。
        // 否则 preprocessJSON 会用私有区占位符保护 \uXXXX，导致结果里出现 ... 这类占位符字符。
        let parsed;
        try {
            const result = preprocessJSON(value, { preserveNumberLiterals: true, encodingMode: true });
            parsed = unwrapHighPrecisionForConvert(result.data);
        } catch (error) {
            showMessageError(settingsTxt.value.msgInvalidJson);
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
                editorLanguage = 'toml';
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
                outputEditor?.getModel()?.updateOptions({ tabSize: 4, indentSize: 4 });
                result = convertToGo(parsed);
                break;
            default:
                throw new Error(settingsTxt.value.msgConvertUnsupported);
        }

        // 还原数字精度哨兵：把 __HPN_START_xxx__...__HPN_END_xxx__ 以及可能被库加上的引号替换为原始数字字面量
        result = restoreHighPrecisionInOutput(result);

        if (outputEditor) {
            // 更新编辑器内容
            outputEditor.setValue(result);

            // 更新编辑器配置（包括模型选项，确保缩进指南线正确显示）
            // Go 结构体使用 4 空格缩进，保持指南线间距一致
            const goIndentSize = command === 'go' ? 4 : undefined;
            const enableLargeFile = editorLanguage === 'json';
            updateOutputEditorConfig(editorLanguage, enableLargeFile, goIndentSize);

            showMessageSuccess(settingsTxt.value.msgConvertSuccess(command.toUpperCase()));
        }
    } catch (error: any) {
        showMessageError(settingsTxt.value.msgConvertFail(error.message));
    }
};


// JSON Plus Formatter 类
class JsonPlusFormatter {
    private encodingMode: boolean;
    private indentSize: number;
    private arrayNewLine: boolean;
    private preserveNumberLiterals: boolean;
    private escapePlaceholderCounter: number;

    constructor(encodingMode: boolean, indentSize: number, arrayNewLine: boolean, preserveNumberLiterals: boolean = false) {
        this.encodingMode = encodingMode;
        this.indentSize = indentSize;
        this.arrayNewLine = arrayNewLine;
        this.preserveNumberLiterals = preserveNumberLiterals;
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
                    const high = Math.floor((code - 0x10000) / 0x400) + 0xd800;
                    const low = ((code - 0x10000) % 0x400) + 0xdc00;
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
            if (this.encodingMode) {
                // 解码模式：保留 \uXXXX 交给 JSON 解析器自然解码为对应字符
                return { consumed: 6, append: unicodeSeq };
            } else {
                // 不解码模式：用占位符保护 \uXXXX，防止被 JSON 解析器解码
                const placeholder = this.createEscapePlaceholder();
                escapeMap.set(placeholder, unicodeSeq);
                return { consumed: 6, append: placeholder };
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
            if (this.encodingMode) {
                // 收集字节用于 UTF-8 解码，暂不 append
                pendingBytes.push(byte);
                return { consumed: 4, append: '' };
            } else {
                // 不解码模式：占位以保持原始 \xHH
                const placeholder = this.createEscapePlaceholder();
                escapeMap.set(placeholder, hexSeq);
                return { consumed: 4, append: placeholder };
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
        if (this.preserveNumberLiterals) {
            processedInput = this.preprocessHighPrecisionNumbers(processedInput);
        }
        processedInput = this.preprocessString(processedInput, escapeMap);

        try {
            let data: any;
            try {
                data = JSON.parse(processedInput);
            } catch {
                data = JSON5.parse(processedInput);
            }
            if (this.encodingMode) {
                data = this.decodeParsedData(data);
            }
            return { data, escapeMap };
        } catch (error) {
            throw new Error('JSON5 解析失败: ' + (error as Error).message);
        }
    }

    private decodeParsedData(value: any): any {
        if (typeof value === 'string') {
            return smartDecode(value);
        }
        if (Array.isArray(value)) {
            return value.map(item => this.decodeParsedData(item));
        }
        if (value && typeof value === 'object') {
            const result: Record<string, any> = {};
            for (const key of Object.keys(value)) {
                result[key] = this.decodeParsedData(value[key]);
            }
            return result;
        }
        return value;
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

    private preprocessHighPrecisionNumbers(input: string): string {
        let result = '';
        let i = 0;
        let inString = false;
        let stringChar = '';
        let inLineComment = false;
        let inBlockComment = false;

        const isIdentifierChar = (ch: string) => /[A-Za-z0-9_$]/.test(ch);

        while (i < input.length) {
            const char = input[i];
            const next = input[i + 1] || '';

            if (inLineComment) {
                result += char;
                if (char === '\n') {
                    inLineComment = false;
                }
                i++;
                continue;
            }

            if (inBlockComment) {
                result += char;
                if (char === '*' && next === '/') {
                    result += next;
                    i += 2;
                    inBlockComment = false;
                    continue;
                }
                i++;
                continue;
            }

            if (inString) {
                result += char;
                if (char === '\\' && next) {
                    result += next;
                    i += 2;
                    continue;
                }
                if (char === stringChar) {
                    inString = false;
                    stringChar = '';
                }
                i++;
                continue;
            }

            if (char === '/' && next === '/') {
                result += char + next;
                i += 2;
                inLineComment = true;
                continue;
            }

            if (char === '/' && next === '*') {
                result += char + next;
                i += 2;
                inBlockComment = true;
                continue;
            }

            if (char === '"' || char === "'") {
                inString = true;
                stringChar = char;
                result += char;
                i++;
                continue;
            }

            const prevChar = i > 0 ? input[i - 1] : '';
            if (
                (char === '+' || char === '-' || char === '.' || (char >= '0' && char <= '9')) &&
                !isIdentifierChar(prevChar)
            ) {
                const slice = input.slice(i);
                const match = slice.match(/^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/);
                if (match && match[0]) {
                    const token = match[0];
                    const nextChar = input[i + token.length] || '';
                    if (!isIdentifierChar(nextChar)) {
                        const isFloat = token.includes('.') || token.includes('e') || token.includes('E');
                        let needsProtection = isFloat;
                        if (!needsProtection) {
                            // 纯整数：若超出 JS 安全整数范围则同样需要保护，避免精度丢失
                            // 例如 7634073368949850917 这类 64-bit ID 会被 JSON.parse 四舍五入
                            const numValue = Number(token);
                            if (!Number.isFinite(numValue) || !Number.isSafeInteger(numValue)) {
                                needsProtection = true;
                            }
                        }
                        if (needsProtection) {
                            const payload = `{"__highPrecisionNumber":true,"originalString":"${token}"}`;
                            const wrapped = `"${payload.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
                            result += wrapped;
                            i += token.length;
                            continue;
                        }
                    }
                }
            }

            result += char;
            i++;
        }

        return result;
    }

    // 替换函数定义为null，支持嵌套和大括号匹配，但不处理字符串内部的内容
    private replaceFunctionsWithNull(input: string): string {
        let result = '';
        let i = 0;

        while (i < input.length) {
            const funcIndex = input.indexOf('function', i);
            if (funcIndex === -1) {
                result += input.substring(i);
                break;
            }

            // 检查function是否在字符串内部
            let inString = false;
            let stringChar = '';
            let k = 0;
            while (k < funcIndex) {
                const char = input[k];
                if (!inString && (char === '"' || char === "'")) {
                    inString = true;
                    stringChar = char;
                } else if (inString && char === stringChar && input[k - 1] !== '\\') {
                    inString = false;
                    stringChar = '';
                }
                k++;
            }

            // 如果在字符串内部，跳过这个function
            if (inString) {
                result += input.substring(i, funcIndex + 8); // 'function'.length = 8
                i = funcIndex + 8;
                continue;
            }

            // 添加function之前的部分
            result += input.substring(i, funcIndex);

            // 找到函数的结束位置
            let parenCount = 0;
            let braceCount = 0;
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
        const id = this.escapePlaceholderCounter++;
        const hi = 0xE001 + ((id >>> 10) & 0x7FF);
        const lo = 0xE001 + (id & 0x3FF);
        return '\uE000' + String.fromCharCode(hi) + String.fromCharCode(lo);
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

                            if (nextChar === '\r' || nextChar === '\n' || nextChar === '\u2028' || nextChar === '\u2029' || nextChar === ' ' || nextChar === '\t') {
                                let j = i + 1;
                                while (j < input.length && (input[j] === ' ' || input[j] === '\t')) {
                                    j++;
                                }
                                const ch = input[j] || '';
                                if (ch === '\r' || ch === '\n' || ch === '\u2028' || ch === '\u2029') {
                                    if (pendingBytes.length > 0) {
                                        stringContent += this.escapeDecodedString(this.decodeUTF8(pendingBytes));
                                        pendingBytes.length = 0;
                                    }

                                    if (ch === '\r' && input[j + 1] === '\n') {
                                        i = j + 2;
                                    } else {
                                        i = j + 1;
                                    }
                                    continue;
                                }
                            }

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

                                // 标准转义序列直接保留，不需要占位符
                                // JSON5 能正确解析这些标准转义序列（如 \n \t \r 等）
                                // 这样可以避免占位符恢复时产生实际的控制字符破坏 JSON 结构
                                stringContent += '\\' + nextChar;
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

    // 压缩模式 - 生成紧凑的JSON字符串，不带缩进和换行
    compress(data: any, escapeMap: Map<string, string>): string {
        return this.customStringify(data, escapeMap, 0, true);
    }

    // 格式化数字
    private formatNumber(num: number): string {
        return num.toString();
    }

    // 格式化高精度数字对象
    private formatHighPrecisionNumberObject(data: any): string {
        if (!data || !data.__highPrecisionNumber || !data.originalString) {
            return 'null';
        }

        return data.originalString;
    }

    // 自定义字符串化函数
    private customStringify(data: any, escapeMap: Map<string, string>, indent: number = 0, compressed: boolean = false): string {
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
            return this.formatNumber(data);
        }

        // 高精度数字对象现在在字符串处理中处理，这里不再需要特殊处理

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
            return this.formatArray(data, escapeMap, indent, compressed);
        }

        if (typeof data === 'object') {
            return this.formatObject(data, escapeMap, indent, compressed);
        }

        return 'null'; // 其他未知类型转为null
    }

    // 格式化字符串
    private formatString(str: string, escapeMap: Map<string, string>): string {
        const processedStr = str;

        // 检查是否是高精度数字对象的JSON字符串，如果是则直接返回数字字符串
        try {
            const parsed = JSON.parse(processedStr);
            if (typeof parsed === 'object' && parsed && parsed.__highPrecisionNumber && parsed.originalString) {
                return this.formatHighPrecisionNumberObject(parsed);
            }
        } catch (e) {
            // 不是有效的JSON，正常处理
        }

        let result = '"';

        const isValidJsonEscape = (escape: string): boolean => {
            if (escape.length === 2) {
                return ['\\"', '\\\\', '\\/', '\\b', '\\f', '\\n', '\\r', '\\t'].includes(escape);
            }
            return /^\\u[0-9a-fA-F]{4}$/.test(escape);
        };
        const formatEscapePlaceholder = (escape: string): string => {
            if (isValidJsonEscape(escape)) {
                return escape;
            }
            return '\\\\' + escape.slice(1);
        };

        for (let i = 0; i < processedStr.length; i++) {
            const char = processedStr[i];
            if (char === '\uE000' && i + 2 < processedStr.length) {
                const placeholder = processedStr.slice(i, i + 3);
                const originalEscape = escapeMap.get(placeholder);
                if (originalEscape) {
                    result += formatEscapePlaceholder(originalEscape);
                    i += 2;
                    continue;
                }
            }
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
                result += '\\\\';
            } else if (code < 32 || code === 127) {
                // 其他控制字符
                result += '\\u' + code.toString(16).padStart(4, '0');
            } else {
                // 解码模式下，解码后的字符可能包含特殊字符，需要处理
                result += char;
            }
        }

        result += '"';
        return result;
    }

    // 格式化数组
    private formatArray(arr: any[], escapeMap: Map<string, string>, indent: number, compressed: boolean = false): string {
        if (arr.length === 0) {
            return '[]';
        }

        if (compressed) {
            // 压缩模式：始终生成紧凑格式
            const items = arr.map(item => this.customStringify(item, escapeMap, 0, true));
            return '[' + items.join(',') + ']';
        }

        // 检查是否为简单类型数组
        const isSimpleArray = arr.every(item => typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean' || item === null);

        if (isSimpleArray && !this.arrayNewLine) {
            // 紧凑模式
            const items = arr.map(item => this.customStringify(item, escapeMap, 0, compressed));
            return '[' + items.join(', ') + ']';
        } else {
            // 换行模式（复杂数组或强制换行）
            const indentStr = ' '.repeat((indent + 1) * this.indentSize);
            const nextIndentStr = ' '.repeat(indent * this.indentSize);
            const items = arr.map(item => indentStr + this.customStringify(item, escapeMap, indent + 1, compressed));
            return '[\n' + items.join(',\n') + '\n' + nextIndentStr + ']';
        }
    }

    // 格式化对象
    private formatObject(obj: any, escapeMap: Map<string, string>, indent: number, compressed: boolean = false): string {
        const keys = Object.keys(obj);
        if (keys.length === 0) {
            return '{}';
        }

        if (compressed) {
            // 压缩模式：生成紧凑格式
            const items = keys.map(key => {
                const keyStr = this.formatKey(key, escapeMap); // 处理对象键，key 不进行 smartDecode
                const valueStr = this.customStringify(obj[key], escapeMap, 0, true);
                return keyStr + ':' + valueStr;
            });
            return '{' + items.join(',') + '}';
        }

        const indentStr = ' '.repeat((indent + 1) * this.indentSize);
        const nextIndentStr = ' '.repeat(indent * this.indentSize);

        const items = keys.map(key => {
            const keyStr = this.formatKey(key, escapeMap); // 处理对象键，key 不进行 smartDecode
            const valueStr = this.customStringify(obj[key], escapeMap, indent + 1, compressed);
            return indentStr + keyStr + ': ' + valueStr;
        });

        return '{\n' + items.join(',\n') + '\n' + nextIndentStr + '}';
    }

    // 格式化对象 key（不进行 smartDecode，保持原始格式）
    private formatKey(key: string, escapeMap: Map<string, string>): string {
        let result = '"';

        const isValidJsonEscape = (escape: string): boolean => {
            if (escape.length === 2) {
                return ['\\"', '\\\\', '\\/', '\\b', '\\f', '\\n', '\\r', '\\t'].includes(escape);
            }
            return /^\\u[0-9a-fA-F]{4}$/.test(escape);
        };
        const formatEscapePlaceholder = (escape: string): string => {
            if (isValidJsonEscape(escape)) {
                return escape;
            }
            return '\\\\' + escape.slice(1);
        };

        for (let i = 0; i < key.length; i++) {
            const char = key[i];
            if (char === '\uE000' && i + 2 < key.length) {
                const placeholder = key.slice(i, i + 3);
                const originalEscape = escapeMap.get(placeholder);
                if (originalEscape) {
                    result += formatEscapePlaceholder(originalEscape);
                    i += 2;
                    continue;
                }
            }
            const code = key.charCodeAt(i);

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
                result += '\\\\';
            } else if (code < 32 || code === 127) {
                // 其他控制字符
                result += '\\u' + code.toString(16).padStart(4, '0');
            } else {
                result += char;
            }
        }

        result += '"';
        return result;
    }
}

// 兼容性函数 - 用于其他地方的JSON解析
const preprocessJSON = (input: string, options?: { preserveNumberLiterals?: boolean; encodingMode?: boolean }) => {
    const preserveNumbers = options?.preserveNumberLiterals ?? preserveNumberLiterals.value;
    const mode = options?.encodingMode ?? false;
    const formatter = new JsonPlusFormatter(mode, indentSize.value, arrayNewLine.value, preserveNumbers);
    const result = formatter.parseJson5(input);
    return {
        ...result,
        originalString: input, // 保持向后兼容
    };
};

// 重新格式化JSON字符串的缩进，保持内容不变（不解析转义序列）

// 兼容性函数 - 用于其他地方的JSON格式化
const CompatibleCustomStringify = (data: any, indentSize: number, ...args: any[]) => {
    const optionsArg = args.length > 0 ? args[args.length - 1] : undefined;
    const hasOptions = optionsArg && typeof optionsArg === 'object' && !Array.isArray(optionsArg) && ('preserveNumberLiterals' in optionsArg || 'encodingMode' in optionsArg);
    const preserveNumbers = hasOptions ? optionsArg.preserveNumberLiterals === true : preserveNumberLiterals.value;
    const mode = hasOptions && typeof optionsArg.encodingMode === 'boolean' ? optionsArg.encodingMode : false;
    const formatter = new JsonPlusFormatter(mode, indentSize, arrayNewLine.value, preserveNumbers);
    const escapeMap = new Map<string, string>();
    return formatter.format(data, escapeMap);
};

// 格式化 JSON
const formatJSON = () => {
    if (!ensureProcessingFeatureAvailable()) return;
    const startTime = performance.now();
    const startLineCount = (inputEditor?.getValue() || '').split('\n').length;

    try {
        outputType.value = 'json';
        const value = inputEditor?.getValue() || '';

        if (!value.trim()) {
            showMessageError(settingsTxt.value.msgInputJsonRequired);
            return;
        }

        const effectiveEncodingMode = encodingMode.value;
        const effectivePreserveNumberLiterals = preserveNumberLiterals.value;

        // 创建格式化器
        const formatter = new JsonPlusFormatter(
            effectiveEncodingMode,
            indentSize.value,
            arrayNewLine.value,
            effectivePreserveNumberLiterals
        );

        // 解析 JSON5
        const { data, escapeMap } = formatter.parseJson5(value);

        // 格式化输出
        const formatted = formatter.format(data, escapeMap);

        // 异步计算所有折叠区域的信息（不阻塞，立即返回）
        if (shouldPrecomputeFoldingInfo()) {
            precomputeFoldingInfo(formatted).catch(() => {});
        }

        outputEditor?.setValue(formatted);

        // 更新编辑器配置（包括模型选项，确保缩进指南线正确显示）
        // 对于JSON输出，总是启用大文件折叠优化
        updateOutputEditorConfig('json', true);

        const elapsed = performance.now() - startTime;
        if (startLineCount > 300000) {
            showMessageSuccess(settingsTxt.value.msgFormatSuccessWithTime(elapsed.toFixed(0)));
        } else {
            showMessageSuccess(settingsTxt.value.msgFormatSuccess);
        }
    } catch (error: any) {
        showMessageError(settingsTxt.value.msgFormatFail(error.message));
    }
};

// 压缩 JSON
const compressJSON = () => {
    if (!ensureProcessingFeatureAvailable()) return;
    try {
        outputType.value = 'json';
        const value = inputEditor?.getValue() || '';
        if (!value.trim()) {
            showMessageError(settingsTxt.value.msgInputJsonRequired);
            return;
        }

        // 预处理 JSON 字符串
        let result;
        try {
            result = preprocessJSON(value, { preserveNumberLiterals: preserveNumberLiterals.value });
        } catch (error) {
            showMessageError(settingsTxt.value.msgInvalidJson);
            return;
        }

        // 使用 JsonPlusFormatter 进行压缩，确保转义序列正确恢复
        const formatter = new JsonPlusFormatter(false, indentSize.value, arrayNewLine.value, preserveNumberLiterals.value);
        const compressed = formatter.compress(result.data, result.escapeMap);
        outputEditor?.setValue(compressed);

        // 更新编辑器配置（包括模型选项，确保缩进指南线正确显示）
        // 对于JSON输出，总是启用大文件折叠优化
        updateOutputEditorConfig('json', true);

        showMessageSuccess(settingsTxt.value.msgCompressSuccess);
    } catch (error: any) {
        showMessageError(settingsTxt.value.msgCompressFail(error.message));
    }
};

// 去除JSON转义字符
// 检测字符串中是否存在非法转义序列

const unescapeJSON = (recursive: boolean = true) => {
    try {
        const value = inputEditor?.getValue() || '';
        if (!value.trim()) {
            showMessageError(settingsTxt.value.msgInputContentRequired);
            return;
        }
        outputType.value = 'json';

        // 获取原始输入
        const originalInput = value;
        let parsedInput = null;
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

        // 检测非法转义序列
        const illegalCheck = detectIllegalEscapes(value);
        if (illegalCheck.hasIllegal) {
            // 对于包含非法编码的情况，直接拒绝处理，预览区域不显示内容
            showMessageError(settingsTxt.value.msgUnescapeIllegalRejected);
            return;
        }

        const globalUnicodeMap = new Map<string, string>();
        const unicodePlaceholderByHex = new Map<string, string>();
        let nextUnicodePlaceholderCodePoint = 0xe000;
        const replaceUnicodeEscapes = (str: string) => {
            let out = '';
            let i = 0;
            while (i < str.length) {
                const ch = str[i];
                if (ch === '\\' && i + 5 < str.length && str[i + 1] === 'u') {
                    const hex = str.slice(i + 2, i + 6);
                    if (/^[0-9a-fA-F]{4}$/.test(hex)) {
                        let backslashCount = 0;
                        let k = i - 1;
                        while (k >= 0 && str[k] === '\\') {
                            backslashCount++;
                            k--;
                        }
                        const isEscapedBackslash = backslashCount % 2 === 1;
                        if (!isEscapedBackslash) {
                            let placeholder = unicodePlaceholderByHex.get(hex);
                            if (!placeholder) {
                                placeholder = String.fromCharCode(nextUnicodePlaceholderCodePoint++);
                                unicodePlaceholderByHex.set(hex, placeholder);
                            }
                            globalUnicodeMap.set(placeholder, `\\u${hex}`);
                            out += placeholder;
                            i += 6;
                            continue;
                        }
                    }
                }
                out += ch;
                i++;
            }
            return out;
        };

        const indentUnitForUnicode = ' '.repeat(indentSize.value);
        const stringifyWithUnicodeForUnescape = (obj: any, indent: string = ''): string => {
            if (obj === null) return 'null';
            if (typeof obj === 'boolean') return obj.toString();
            if (typeof obj === 'number') return obj.toString();

            if (typeof obj === 'string') {
                try {
                    const parsed = JSON.parse(obj);
                    if (typeof parsed === 'object' && parsed && parsed.__highPrecisionNumber && parsed.originalString) {
                        return parsed.originalString;
                    }
                } catch {}
                let escaped = '';
                for (let i = 0; i < obj.length; i++) {
                    const char = obj[i];
                    const code = char.charCodeAt(0);
                    if (globalUnicodeMap.has(char)) {
                        escaped += globalUnicodeMap.get(char)!;
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
                    const itemStr = stringifyWithUnicodeForUnescape(item, indent + indentUnitForUnicode);
                    return indent + indentUnitForUnicode + itemStr;
                });
                return '[\n' + items.join(',\n') + '\n' + indent + ']';
            }

            if (typeof obj === 'object') {
                const keys = Object.keys(obj);
                if (keys.length === 0) return '{}';
                const pairs = keys.map(key => {
                    const keyStr = stringifyWithUnicodeForUnescape(key, indent + indentUnitForUnicode);
                    const valueStr = stringifyWithUnicodeForUnescape(obj[key], indent + indentUnitForUnicode);
                    return indent + indentUnitForUnicode + keyStr + ': ' + valueStr;
                });
                return '{\n' + pairs.join(',\n') + '\n' + indent + '}';
            }

            return JSON.stringify(obj);
        };

        // 简化解析流程：优先直接解析 -> 宽松解析 -> 迭代去除外层转义后再尝试解析
        const tryParseJSON = (str: string) => {
            try {
                const result = preprocessJSON(replaceUnicodeEscapes(str), { preserveNumberLiterals: true, encodingMode: false });
                return { ok: true, value: result.data } as const;
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
        let isDirectParse = false;
        const direct = tryParseJSON(value);
        if (direct.ok) {
            parsedInput = direct.value;
            isDirectParse = true;
        } else {
            // 如果检测到非法编码，使用保守的字符串处理方式
            if (illegalCheck.hasIllegal) {
                // 对于包含非法编码的情况，进行保守的字符串级别转义去除
                const conservativeUnescape = (str: string): string => {
                    // 只处理最安全的转义：\\ -> \, \" -> "
                    // 对于其他转义序列（包括非法 ones），保持原样
                    let result = str;
                    let changed = true;
                    let iterations = 0;
                    const maxIterations = 10; // 防止无限循环

                    while (changed && iterations < maxIterations) {
                        changed = false;
                        const newResult = result.replace(/\\\\/g, '\\').replace(/\\"/g, '"');
                        if (newResult !== result) {
                            changed = true;
                            result = newResult;
                        }
                        iterations++;
                    }

                    return result;
                };

                // 直接返回保守处理的字符串，不尝试JSON解析
                const processed = conservativeUnescape(value);
                outputEditor?.setValue(processed);

                // 更新编辑器配置
                if (outputEditor) {
                    const model = outputEditor.getModel();
                    if (model) {
                        monaco.editor.setModelLanguage(model, 'json');
                    }
                    outputEditor.updateOptions(getEditorOptions(indentSize.value, true, 'json', true, getEditorLineCount(outputEditor)));
                    updateLineNumberWidth(outputEditor);
                    updateEditorHeight(outputEditor);
                }

                showMessageSuccess(settingsTxt.value.msgUnescapeConservative);
                return;
            } else {
                // 2. 宽松解析器（仅对合法编码使用）
                const res = tryParseJSON(value);
                if (res.ok) {
                    parsedInput = res.value;
                } else {
                    // 3. 迭代去除外层转义再尝试解析
                    parsedInput = iterativeParse(value);
                }
            }
        }

        // 递归模式下，如果顶层解析结果是 string（例如输入本身是 JSON string），
        // 尝试将该字符串继续按 JSON 解析，直到变成 object/array 或无法继续解析。
        // 这能覆盖形如 "\"{...}\"" 的场景，确保“递归去除转义”真正向下展开。
        if (recursive && typeof parsedInput === 'string') {
            let current: any = parsedInput;
            for (let i = 0; i < 5; i++) {
                if (typeof current !== 'string') break;
                const cand = current.trim();
                if (!cand) break;
                const res = tryParseJSON(cand);
                if (res.ok) {
                    // 防止极端情况下出现无意义的自循环
                    if (res.value === current) break;
                    current = res.value;
                    continue;
                }
                const relaxed = iterativeParse(cand, 5);
                if (relaxed !== null) {
                    current = relaxed;
                    continue;
                }
                break;
            }
            parsedInput = current;
        }

        // 如果成功解析为对象或数组，进行递归处理
        if (parsedInput !== null && typeof parsedInput === 'object' && recursive) {
            try {
                // 检查对象深度，防止过深的递归
                const objectDepth = getObjectDepth(parsedInput);
                // 如果对象深度在可接受范围内，进行递归解析；深度过大时跳过以防止栈溢出或性能问题
                if (objectDepth <= 50) {
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
                    const indentUnit = ' '.repeat(indentSize.value);
                    const stringifyWithUnicode = (obj: any, indent: string = '', unicodeMap: Map<string, string> = globalUnicodeMap): string => {
                        if (obj === null) return 'null';
                        if (typeof obj === 'boolean') return obj.toString();
                        if (typeof obj === 'number') return obj.toString();

                        if (typeof obj === 'string') {
                            try {
                                const parsed = JSON.parse(obj);
                                if (typeof parsed === 'object' && parsed && parsed.__highPrecisionNumber && parsed.originalString) {
                                    return parsed.originalString;
                                }
                            } catch (e) {}
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
                                const itemStr = stringifyWithUnicode(item, indent + indentUnit, unicodeMap);
                                return indent + indentUnit + itemStr;
                            });
                            return '[\n' + items.join(',\n') + '\n' + indent + ']';
                        }

                        if (typeof obj === 'object') {
                            const keys = Object.keys(obj);
                            if (keys.length === 0) return '{}';
                            const pairs = keys.map(key => {
                                const keyStr = stringifyWithUnicode(key, indent + indentUnit, unicodeMap);
                                const valueStr = stringifyWithUnicode(obj[key], indent + indentUnit, unicodeMap);
                                return indent + indentUnit + keyStr + ': ' + valueStr;
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
                            if ((obj as any).__highPrecisionNumber && (obj as any).originalString) {
                                return JSON.stringify(obj);
                            }
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
                                        const parseResult = preprocessJSON(replaceUnicodeEscapes(obj), { preserveNumberLiterals: true, encodingMode: false });
                                        parsedValue = parseResult.data;
                                        isValidJson = true;
                                    } catch (e: any) {
                                        // 直接解析失败，可能是包含转义的JSON，需要先去除转义
                                        let tempStr = obj;

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
                                            const parseResult = preprocessJSON(replaceUnicodeEscapes(unescaped), { preserveNumberLiterals: true, encodingMode: false });
                                            parsedValue = parseResult.data;
                                            isValidJson = true;
                                        } catch (parseError) {
                                            isValidJson = false;
                                        }
                                    }

                                    if (isValidJson) {
                                        if (parsedValue && typeof parsedValue === 'object' && (parsedValue as any).__highPrecisionNumber && (parsedValue as any).originalString) {
                                            return JSON.stringify(parsedValue);
                                        }
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
                        outputEditor.updateOptions(getEditorOptions(indentSize.value, true, 'json', true, getEditorLineCount(outputEditor)));
                        updateLineNumberWidth(outputEditor);
                        updateEditorHeight(outputEditor);
                    }

                    showMessageSuccess(settingsTxt.value.msgUnescapeSuccess);
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
                                if ((t.startsWith('{') && t.endsWith('}')) || (t.startsWith('[') && t.endsWith(']')) || t.includes('\\"') || t.includes('\\\\')) {
                                    try {
                                        const result = preprocessJSON(replaceUnicodeEscapes(item), { preserveNumberLiterals: true, encodingMode: false });
                                        if (result.data && typeof result.data === 'object' && result.data.__highPrecisionNumber && result.data.originalString) {
                                            return JSON.stringify(result.data);
                                        }
                                        return result.data;
                                    } catch {
                                        try {
                                            const unescaped = item.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
                                            const result = preprocessJSON(replaceUnicodeEscapes(unescaped), { preserveNumberLiterals: true, encodingMode: false });
                                            if (result.data && typeof result.data === 'object' && result.data.__highPrecisionNumber && result.data.originalString) {
                                                return JSON.stringify(result.data);
                                            }
                                            return result.data;
                                        } catch {
                                            return item;
                                        }
                                    }
                                }
                            }
                            return tryParseTopLevelOnce(item);
                        });
                    }

                    if (typeof target === 'object') {
                        if (target.__highPrecisionNumber && target.originalString) {
                            return JSON.stringify(target);
                        }
                        const result: Record<string, any> = {};
                        for (const key in target) {
                            if (!Object.prototype.hasOwnProperty.call(target, key)) continue;
                            const val = target[key];
                            if (typeof val === 'string') {
                                const t = val.trim();
                                if ((t.startsWith('{') && t.endsWith('}')) || (t.startsWith('[') && t.endsWith(']')) || t.includes('\\"') || t.includes('\\\\')) {
                                    try {
                                        const parseResult = preprocessJSON(replaceUnicodeEscapes(val), { preserveNumberLiterals: true, encodingMode: false });
                                        if (parseResult.data && typeof parseResult.data === 'object' && parseResult.data.__highPrecisionNumber && parseResult.data.originalString) {
                                            result[key] = JSON.stringify(parseResult.data);
                                            continue;
                                        }
                                        result[key] = parseResult.data;
                                        continue;
                                    } catch {
                                        try {
                                            const unescaped = val.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
                                            const parseResult = preprocessJSON(replaceUnicodeEscapes(unescaped), { preserveNumberLiterals: true, encodingMode: false });
                                            if (parseResult.data && typeof parseResult.data === 'object' && parseResult.data.__highPrecisionNumber && parseResult.data.originalString) {
                                                result[key] = JSON.stringify(parseResult.data);
                                                continue;
                                            }
                                            result[key] = parseResult.data;
                                            continue;
                                        } catch {
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

                const topLevelProcessed = isDirectParse ? tryParseTopLevelOnce(parsedInput) : parsedInput;
                const formatted = stringifyWithUnicodeForUnescape(topLevelProcessed);
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
                    outputEditor.updateOptions(getEditorOptions(indentSize.value, true, 'json', true, getEditorLineCount(outputEditor)));
                    updateLineNumberWidth(outputEditor);
                    updateEditorHeight(outputEditor);
                }

                showMessageSuccess(settingsTxt.value.msgUnescapeShallowSuccess);
                return;
            } catch (formatError) {
                // 格式化失败，继续尝试其他方式
            }
        }

        // 处理双重转义的特殊情况（如压缩并转义的结果）
        if (typeof value === 'string' && value.trim().startsWith('"') && value.trim().endsWith('"')) {
            try {
                // 尝试解析为JSON字符串
                const firstUnescapedResult = preprocessJSON(replaceUnicodeEscapes(value.trim()), { preserveNumberLiterals: true, encodingMode: false });
                const firstUnescaped = firstUnescapedResult.data;

                if (typeof firstUnescaped === 'string') {
                    // 检查解析出的字符串是否是有效的JSON
                    let isValidJson = false;
                    try {
                        preprocessJSON(replaceUnicodeEscapes(firstUnescaped), { preserveNumberLiterals: true, encodingMode: false });
                        isValidJson = true;
                    } catch {
                        // 不是有效的JSON，应该保持原样
                        isValidJson = false;
                    }

                    if (isValidJson) {
                        try {
                            // 尝试解析第二层
                            const secondUnescapedResult = preprocessJSON(replaceUnicodeEscapes(firstUnescaped), { preserveNumberLiterals: true, encodingMode: false });
                            const secondUnescaped = secondUnescapedResult.data;
                            if (typeof secondUnescaped === 'object' && secondUnescaped !== null) {
                                const formatted = stringifyWithUnicodeForUnescape(secondUnescaped);
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
                                    outputEditor.updateOptions(getEditorOptions(indentSize.value, true, 'json', true, getEditorLineCount(outputEditor)));
                                    updateLineNumberWidth(outputEditor);
                                    updateEditorHeight(outputEditor);
                                }

                                showMessageSuccess(settingsTxt.value.msgUnescapeDoubleSuccess);
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
                                outputEditor.updateOptions(getEditorOptions(indentSize.value, true, 'json', true, getEditorLineCount(outputEditor)));
                                updateLineNumberWidth(outputEditor);
                                updateEditorHeight(outputEditor);
                            }

                            showMessageSuccess(settingsTxt.value.msgUnescapeSuccess);
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
                    outputEditor.updateOptions(getEditorOptions(indentSize.value, true, 'json', true, getEditorLineCount(outputEditor)));
                    updateLineNumberWidth(outputEditor);
                    updateEditorHeight(outputEditor);
                }

                showMessageSuccess(settingsTxt.value.msgUnescapeSuccess);
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
                    outputEditor.updateOptions(getEditorOptions(indentSize.value, true, 'json', true, getEditorLineCount(outputEditor)));
                    updateLineNumberWidth(outputEditor);
                    updateEditorHeight(outputEditor);
                }

                showMessageWarning(settingsTxt.value.msgUnescapeNotDetected);
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
                outputEditor.updateOptions(getEditorOptions(indentSize.value, true, 'json', true, getEditorLineCount(outputEditor)));
                updateLineNumberWidth(outputEditor);
                updateEditorHeight(outputEditor);
            }

            showMessageSuccess(settingsTxt.value.msgUnescapeSuccess);
        }

        return;
    } catch (error: any) {
        showMessageError(settingsTxt.value.msgUnescapeFail(error.message));
    }
};

// 压缩并转义功能
const compressAndEscapeJSON = () => {
    if (!ensureProcessingFeatureAvailable()) return;
    try {
        const value = inputEditor?.getValue() || '';
        if (!value.trim()) {
            showMessageError(settingsTxt.value.msgInputJsonRequired);
            return;
        }
        outputType.value = 'json';

        // 检测非法转义序列
        const illegalCheck = detectIllegalEscapes(value);
        if (illegalCheck.hasIllegal) {
            // 对于包含非法编码的情况，直接拒绝处理
            showMessageError(settingsTxt.value.msgEscapeIllegalRejected);
            return;
        }

        // 预处理 JSON 字符串
        let result;
        try {
            result = preprocessJSON(value, { preserveNumberLiterals: true });
        } catch (error) {
            showMessageError(settingsTxt.value.msgInvalidJson);
            return;
        }

        // 使用 JsonPlusFormatter 进行压缩，确保转义序列正确恢复
        const formatter = new JsonPlusFormatter(false, indentSize.value, arrayNewLine.value, true);
        const compressed = formatter.compress(result.data, result.escapeMap);

        // 直接用 JSON.stringify 包裹成字符串
        const escapedString = JSON.stringify(compressed);
        outputEditor?.setValue(escapedString);

        // 更新编辑器配置
        if (outputEditor) {
            // 更新编辑器语言
            const model = outputEditor.getModel();
            if (model) {
                monaco.editor.setModelLanguage(model, 'json');
            }

            // 更新其他配置
            // 对于JSON输出，总是启用大文件折叠优化
            outputEditor.updateOptions(getEditorOptions(indentSize.value, true, 'json', true, getEditorLineCount(outputEditor)));
            updateLineNumberWidth(outputEditor);
            updateEditorHeight(outputEditor);
        }

        showMessageSuccess(settingsTxt.value.msgEscapeSuccess);
    } catch (error: any) {
        showMessageError(settingsTxt.value.msgEscapeFail(error.message));
    }
};

// 处理层级收缩
const handleLevelAction = () => {
    if (!ensureCollapseFeatureAvailable()) return;
    // 检查是否有正在进行的折叠操作，如果有则直接拒绝新请求
    if (isFoldOperationLocked) {
        showMessageWarning(settingsTxt.value.msgCollapseBusy);
        return;
    }

    try {
        if (!outputEditor) {
            showMessageError(settingsTxt.value.msgEditorNotInit);
            return;
        }

        // 层级收缩始终以编辑区域为准，并强制使用数组换行格式，
        // 这样即使用户平时选择“简单数组同一行显示”，收缩时也能为内层数组生成稳定的折叠区域。
        let value = inputEditor?.getValue() || '';
        if (!value.trim()) {
            showMessageError(settingsTxt.value.msgInputJsonRequired);
            selectedLevel.value = 1;
            return;
        }

        // 解析JSON
        let parsedData;
        let escapeMap;
        try {
            const result = preprocessJSON(value, { preserveNumberLiterals: preserveNumberLiterals.value });
            parsedData = result.data; // 提取实际的JSON数据
            escapeMap = result.escapeMap; // 获取转义映射
        } catch (error) {
            showMessageError(settingsTxt.value.msgInvalidJson);
            return;
        }

        // 收缩前统一强制数组换行，确保每个数组节点都有独立折叠区域。
        const formatter = new JsonPlusFormatter(false, indentSize.value, true, preserveNumberLiterals.value);
        const formatted = formatter.format(parsedData, escapeMap);

        // 更新预览区域内容
        clearOutputFoldingInfo();
        outputEditor.setValue(formatted);

        // 更新编辑器配置
        if (outputEditor) {
            // 更新编辑器语言
            const model = outputEditor.getModel();
            if (model) {
                monaco.editor.setModelLanguage(model, 'json');
            }

            // 更新其他配置
            // JSON 输出默认保留大文件折叠能力，超过 200 万行时自动切换为大文件优化模式
            const updateOptions = getEditorOptions(indentSize.value, true, 'json', true, getEditorLineCount(outputEditor));
            outputEditor.updateOptions(updateOptions);
            updateLineNumberWidth(outputEditor);
            updateEditorHeight(outputEditor);
        }

        const performFold = async () => {
            if (!outputEditor) return;

            isFoldOperationLocked = true;
            try {
                const resolvedMaxFoldableLevel = await resolveMaxFoldableLevel(outputEditor);
                maxFoldableLevel.value = resolvedMaxFoldableLevel;
                if (
                    resolvedMaxFoldableLevel !== null &&
                    resolvedMaxFoldableLevel > 0 &&
                    selectedLevel.value > resolvedMaxFoldableLevel
                ) {
                    showMessageWarning(settingsTxt.value.msgCollapseMaxLevel(resolvedMaxFoldableLevel));
                    return;
                }

                // 仅当“本次实际发生折叠的位置”不在当前可视区时，自动滚动过去，
                // 避免出现“折叠发生在很靠后位置但视图仍停留在顶部”的体验问题。
                const getVisibleLineRange = (): { start: number; end: number } | null => {
                    try {
                        if (!outputEditor) return null;
                        const visibleRanges = outputEditor.getVisibleRanges();
                        if (!visibleRanges || visibleRanges.length === 0) return null;
                        let minLine = Infinity;
                        let maxLine = 0;
                        visibleRanges.forEach(r => {
                            minLine = Math.min(minLine, r.startLineNumber);
                            maxLine = Math.max(maxLine, r.endLineNumber);
                        });
                        if (minLine === Infinity || maxLine === 0) return null;
                        return { start: minLine, end: maxLine };
                    } catch {
                        return null;
                    }
                };

                const beforeFoldVisible = getVisibleLineRange();
                const foldResult = await foldByIndentation();
                if (foldResult.collapsedCount === 0) {
                    const fallbackMaxLevel = maxFoldableLevel.value && maxFoldableLevel.value > 0 ? maxFoldableLevel.value : null;
                    showMessageWarning(settingsTxt.value.msgCollapseNoRegion(selectedLevel.value, fallbackMaxLevel));
                    return;
                }
                showMessageSuccess(settingsTxt.value.msgCollapseSuccess(selectedLevel.value));

                // 折叠完成后，启用折叠信息更新并立即刷新，然后重新计算
                setTimeout(() => {
                    if (!outputEditor) return;
                    try {
                        if (foldResult.firstCollapsedLine && beforeFoldVisible) {
                            const line = foldResult.firstCollapsedLine;
                            const isOutside = line < beforeFoldVisible.start || line > beforeFoldVisible.end;
                            if (isOutside) {
                                // Monaco 新版本支持 revealLineInCenterIfOutsideViewport，这里做兼容兜底
                                const editorAny = outputEditor as any;
                                if (typeof editorAny.revealLineInCenterIfOutsideViewport === 'function') {
                                    editorAny.revealLineInCenterIfOutsideViewport(line);
                                } else {
                                    outputEditor.revealLineInCenter(line);
                                }
                            }
                        }

                        // 启用折叠信息更新并立即刷新（使用现有数据）
                        const refreshFunc = (outputEditor as any).__enableFoldingInfoUpdateAndRefresh;
                        if (refreshFunc) {
                            refreshFunc();
                        }

                        // 重新全量计算所有折叠区域的 n keys / n items
                        precomputeFoldingInfo(formatted).catch(() => {});
                    } catch (e) {}
                }, 300); // 等待折叠动画完成
            } finally {
                // 无论成功还是失败，都要释放锁定
                isFoldOperationLocked = false;
            }
        };

        setTimeout(() => {
            performFold();
        }, 100);
    } catch (error: any) {
        showMessageError(settingsTxt.value.msgCollapseFail(error.message));
    }
};

// 打开获取JSON对话框
const openFetchJsonDialog = () => {
    fetchJsonDialogVisible.value = true;
};

// 打开分享对话框
const openShareDialog = () => {
    if (!ensureProcessingFeatureAvailable()) return;
    shareDialogVisible.value = true;
};

// 打开数据脱敏对话框
const openDataMaskingDialog = () => {
    if (!ensureProcessingFeatureAvailable()) return;
    // 检查输入编辑器是否有内容
    if (!inputEditor) {
        showMessageWarning(settingsTxt.value.msgEditorNotInit);
        return;
    }

    const jsonData = inputEditor.getValue();
    if (!jsonData || !jsonData.trim()) {
        showMessageError(settingsTxt.value.msgInputJsonRequired);
        return;
    }

    // 验证JSON格式
    try {
        JSON.parse(jsonData);
    } catch (error) {
        showMessageError(settingsTxt.value.msgMaskingInvalidJson);
        return;
    }

    dataMaskingDialogVisible.value = true;
};

// 处理数据脱敏应用
const handleDataMaskingApply = (maskedJson: string) => {
    if (!ensureProcessingFeatureAvailable()) return;
    try {
        // 将脱敏后的JSON应用到编辑区域
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
                // 使用用户设置的缩进大小
                model.updateOptions({ tabSize: indentSize.value, indentSize: indentSize.value, insertSpaces: true });
            }
            // 同时更新编辑器选项
            inputEditor.updateOptions({ tabSize: indentSize.value, indentSize: indentSize.value } as any);
            updateInputEditorConfig('json');

            // 更新行号和高度
            updateLineNumberWidth(inputEditor);
            updateEditorHeight(inputEditor);

            // 更新层级信息
            try {
                const parsed = JSON.parse(maskedJson);
                maxLevel.value = calculateMaxLevel(parsed);
                if (maxLevel.value > 0 && selectedLevel.value === 0) {
                    selectedLevel.value = getDefaultFoldLevel(maxLevel.value);
                }
            } catch {
                maxLevel.value = 0;
                selectedLevel.value = 0;
            }
        }

        // 清空预览区域
        if (outputEditor) {
            clearOutputFoldingInfo();
            outputEditor.setValue('');
            updateLineNumberWidth(outputEditor);
            updateEditorHeight(outputEditor);
        }

        outputType.value = 'json';
    } catch (error: any) {
        showMessageError(settingsTxt.value.msgMaskingApplyFail(error.message || settingsTxt.value.msgUnknownError));
    }
};

// 获取 JSON 数据后清空预览区域
const handleFetchJsonLoaded = () => {
    if (outputEditor) {
        clearOutputFoldingInfo();
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
    return calculateByteSize(content);
};

const handleSaveArchive = () => {
    if (!ensureProcessingFeatureAvailable()) return;
    if (!inputEditor) {
        showMessageError(settingsTxt.value.msgEditorNotInit);
        return;
    }

    const content = inputEditor.getValue() || '';
    if (!content.trim()) {
        showMessageError(settingsTxt.value.msgArchiveNoContent);
        return;
    }

    // 检查存档数量上限
    if (archives.value.length >= MAX_ARCHIVE_COUNT) {
        showMessageError(settingsTxt.value.msgArchiveCountReached(MAX_ARCHIVE_COUNT));
        return;
    }

    const size = calculateArchiveSize(content);
    if (size > MAX_SINGLE_ARCHIVE_SIZE) {
        showMessageError(settingsTxt.value.msgArchiveTooLarge(Math.round(size / (1024 * 1024))));
        return;
    }

    if (customArchiveName.value) {
        // 使用自定义弹窗
        archiveNameDialogTitle.value = settingsTxt.value.dialogSaveArchive;
        // 使用最小的未使用数字作为默认值
        archiveNameDialogInputValue.value = `${findNextAvailableNumber()}`;
        archiveNameDialogPlaceholder.value = settingsTxt.value.placeholderArchiveName;
        archiveNameDialogExcludeId.value = ''; // 新增时不需要排除
        archiveNameDialogCallback.value = (name: string) => {
            void (async () => {
            // 再次检查存档数量上限（防止在弹窗打开期间存档数量达到上限）
            if (archives.value.length >= MAX_ARCHIVE_COUNT) {
                showMessageError(settingsTxt.value.msgArchiveCountReached(MAX_ARCHIVE_COUNT));
                return;
            }

            const normalizedName = normalizeArchiveName(name);
            if (!normalizedName) {
                showMessageError(settingsTxt.value.msgArchiveNameEmpty);
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
            const saveSuccess = await saveArchives();

            if (saveSuccess) {
                showMessageSuccess(settingsTxt.value.msgArchiveSavedWithSize(getArchivesTotalSizeInfo()));
            } else {
                // 保存失败时，从内存数组中移除刚刚添加的存档
                archives.value.shift();
            }
            })();
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
        void (async () => {
            const saveSuccess = await saveArchives();
            if (saveSuccess) {
                showMessageSuccess(settingsTxt.value.msgArchiveSavedWithSize(getArchivesTotalSizeInfo()));
            } else {
                // 保存失败时，从内存数组中移除刚刚添加的存档
                archives.value.shift();
            }
        })();
    }
};

const handleArchiveCommand = async (command: string) => {
    const archive = archives.value.find(item => item.id === command);
    if (!archive) {
        showMessageError(settingsTxt.value.msgArchiveNotFound);
        return;
    }

    if (!inputEditor) {
        showMessageError(settingsTxt.value.msgEditorNotInit);
        return;
    }

    // 先清空编辑区域
    clearInput(false);

    // 直接加载存档内容，保持原有格式（不重新格式化以避免缩进不一致）
    const inputModel = inputEditor.getModel();
    if (inputModel) {
        inputEditor.pushUndoStop();
        inputEditor.executeEdits('load-archive', [
            {
                range: inputModel.getFullModelRange(),
                text: archive.content,
            },
        ]);
        inputEditor.pushUndoStop();
    }

    // 检测存档内容的缩进设置，并更新编辑器以匹配
    const detectIndentSize = (text: string): { size: number; insertSpaces: boolean } => {
        const lines = text.split('\n');
        for (const line of lines) {
            const match = line.match(/^[ \t]+(?=\S)/);
            if (match) {
                const indentStr = match[0];
                if (indentStr.includes('\t')) {
                    return { size: 4, insertSpaces: false }; // Tab键缩进
                }
                return { size: indentStr.length || 2, insertSpaces: true }; // 空格缩进
            }
        }
        return { size: 2, insertSpaces: true }; // 默认2格空格
    };

    const detectedIndent = detectIndentSize(archive.content);
    const model = inputEditor.getModel();
    if (model) {
        model.updateOptions({
            tabSize: detectedIndent.size,
            indentSize: detectedIndent.size,
            insertSpaces: detectedIndent.insertSpaces,
        });
    }
    inputEditor.updateOptions({
        tabSize: detectedIndent.size,
        indentSize: detectedIndent.size,
    } as any);

    // 清空outputEditor的内容
    if (outputEditor) {
        clearOutputFoldingInfo();
        outputEditor.setValue('');
    }
    updateLineNumberWidth(outputEditor);
    updateEditorHeight(outputEditor);

    // 重置层级选择状态
    selectedLevel.value = 0;

    // 更新层级信息
    try {
        const parsed = JSON.parse(archive.content);
        maxLevel.value = calculateMaxLevel(parsed);
        selectedLevel.value = getDefaultFoldLevel(maxLevel.value);
    } catch (e) {
        // 解析失败，重置为0
        maxLevel.value = 0;
    }

    showMessageSuccess(settingsTxt.value.msgArchiveLoaded(archive.name));
};

// 处理加载分享的JSON数据到编辑区域
const handleLoadSharedJson = (jsonData: string) => {
    try {
        if (!inputEditor) {
            showMessageError(settingsTxt.value.msgEditorNotInit);
            return;
        }

        if (!jsonData || !jsonData.trim()) {
            showMessageError(settingsTxt.value.msgSharedDataEmpty);
            return;
        }

        // 验证JSON数据并计算层级，但不重新格式化，保持分享者原样
        try {
            let parsed;
            try {
                // 使用 true 强制保留数字字面量，避免解析超长浮点数时丢失精度导致的问题
                const formatter = new JsonPlusFormatter(false, 2, false, true);
                const result = formatter.parseJson5(jsonData);
                parsed = result.data;
            } catch (e) {
                // 回退到原生解析
                parsed = JSON.parse(jsonData);
            }

            // 直接将分享的原始JSON字符串设置到输入编辑器，百分百保持精度和原样
            inputEditor.setValue(jsonData);

            // 更新编辑器配置
            const model = inputEditor.getModel();
            if (model) {
                // 使用用户设置的缩进大小
                model.updateOptions({ tabSize: indentSize.value, indentSize: indentSize.value, insertSpaces: true });
            }
            // 同时更新编辑器选项
            inputEditor.updateOptions({ tabSize: indentSize.value, indentSize: indentSize.value } as any);
            updateInputEditorConfig('json');

            // 更新行号和高度
            updateLineNumberWidth(inputEditor);
            updateEditorHeight(inputEditor);

            // 更新层级信息
            maxLevel.value = calculateMaxLevel(parsed);
            if (maxLevel.value > 0 && selectedLevel.value === 0) {
                selectedLevel.value = getDefaultFoldLevel(maxLevel.value);
            }

            // 清空预览区域
            if (outputEditor) {
                clearOutputFoldingInfo();
                outputEditor.setValue('');
                updateLineNumberWidth(outputEditor);
                updateEditorHeight(outputEditor);
            }

            outputType.value = 'json';
        } catch (error: any) {
            showMessageError(settingsTxt.value.msgSharedJsonInvalid(error.message || settingsTxt.value.msgUnknownError));
        }
    } catch (error: any) {
        showMessageError(settingsTxt.value.msgSharedLoadFail(error.message || settingsTxt.value.msgUnknownError));
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

const toggleArchiveSidebar = () => {
    const minWidth = calculateArchiveMinWidth();
    const isCollapsed = archiveSidebarWidth.value <= minWidth;
    archiveSidebarWidth.value = isCollapsed ? calculateArchiveMaxWidth() : minWidth;
    nextTick(() => {
        updateEditorLayout();
    });
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

// 更新存档内容（将当前编辑区域的内容保存到指定存档）
const handleRefreshArchive = async (item: JsonArchive) => {
    if (!inputEditor) {
        showMessageError(settingsTxt.value.msgEditorNotInit);
        return;
    }

    const newContent = inputEditor.getValue() || '';
    if (!newContent.trim()) {
        showMessageError(settingsTxt.value.msgArchiveRefreshNoContent);
        return;
    }

    const newSize = calculateArchiveSize(newContent);
    if (newSize > MAX_SINGLE_ARCHIVE_SIZE) {
        showMessageError(settingsTxt.value.msgArchiveRefreshTooLarge(Math.round(newSize / (1024 * 1024))));
        return;
    }

    try {
        // 更新存档内容
        const index = archives.value.findIndex(a => a.id === item.id);
        if (index !== -1) {
            // 保存旧的存档数据，用于回滚
            const oldContent = archives.value[index].content;
            const oldSize = archives.value[index].size;

            archives.value[index].content = newContent;
            archives.value[index].size = newSize;

            const saveSuccess = await saveArchives();
            if (saveSuccess) {
                showMessageSuccess(settingsTxt.value.msgArchiveRefreshSuccess(getArchivesTotalSizeInfo()));
            } else {
                // 保存失败时，回滚内存中的更改
                const currentIndex = archives.value.findIndex(a => a.id === item.id);
                if (currentIndex !== -1) {
                    archives.value[currentIndex].content = oldContent;
                    archives.value[currentIndex].size = oldSize;
                }
            }
        } else {
            showMessageError(settingsTxt.value.msgArchiveNotFound);
        }
    } catch (error: any) {
        showMessageError(settingsTxt.value.msgArchiveUpdateFail(error.message));
    }
};

// 删除单个存档
const handleDeleteArchive = async (item: JsonArchive) => {
    try {
        await ElMessageBox.confirm(`确定要删除存档「${item.name}」吗？此操作不可恢复`, '删除存档', {
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
        const deletedArchive = archives.value.splice(index, 1)[0];
        const saveSuccess = await saveArchives();
        if (saveSuccess) {
            showMessageSuccess(settingsTxt.value.msgArchiveDeletedWithSize(getArchivesTotalSizeInfo()));
        } else {
            // 保存失败时，将删除的存档重新添加回去
            archives.value.splice(index, 0, deletedArchive);
        }
    }
};

// 重命名单个存档
const handleRenameArchive = (item: JsonArchive) => {
    archiveNameDialogTitle.value = settingsTxt.value.dialogRenameArchive;
    archiveNameDialogInputValue.value = item.name;
    archiveNameDialogPlaceholder.value = settingsTxt.value.placeholderArchiveName;
    archiveNameDialogExcludeId.value = item.id; // 编辑时排除当前存档
    archiveNameDialogCallback.value = (name: string) => {
        void (async () => {
        const normalizedName = normalizeArchiveName(name);
        if (!normalizedName) {
            showMessageError(settingsTxt.value.msgArchiveNameEmpty);
            return;
        }

        // 名称重复检查已在弹窗组件内完成，这里不再检查

        const oldName = item.name;
        item.name = normalizedName;
        const saveSuccess = await saveArchives();
        if (saveSuccess) {
            showMessageSuccess(settingsTxt.value.msgArchiveRenameSuccess);
        } else {
            // 保存失败时，回滚名称更改
            item.name = oldName;
        }
        })();
    };
    archiveNameDialogVisible.value = true;
};

const onArchivePressStart = (id: string, event: MouseEvent | TouchEvent) => {
    if ('button' in event && event.button !== 0) return;
    dragEnabledArchiveId.value = id;
};

// 拖动排序存档列表
const resetArchiveDragState = () => {
    draggingArchiveId.value = null;
    dragOverArchiveId.value = null;
    dragEnabledArchiveId.value = null;
    dropIndicatorIndex.value = null;
    // 清理输入编辑器的拖拽视觉状态
    if (inputEditorContainer.value) {
        inputEditorContainer.value.classList.remove('drag-over-archive');
    }
};

const onArchiveDragStart = (item: JsonArchive, event: DragEvent) => {
    if (dragEnabledArchiveId.value !== item.id) {
        event.preventDefault();
        return;
    }
    draggingArchiveId.value = item.id;
    dragOverArchiveId.value = null;
    // 设置自定义数据类型，避免被当作普通文本处理
    event.dataTransfer?.setData('application/json-archive', JSON.stringify({ id: item.id, type: 'archive' }));
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

    // 检查鼠标下方是否有存档项元素
    const elementBelow = document.elementFromPoint(event.clientX, event.clientY);
    const listEl = archiveListRef.value;
    // 只有当鼠标确实在某一行存档项上方时才显示指示线
    if (!elementBelow || !listEl || !elementBelow.closest('.archive-item')) {
        dropIndicatorIndex.value = null;
        return;
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
    // 检查鼠标下方是否有存档项元素
    const elementBelow = document.elementFromPoint(event.clientX, event.clientY);
    // 只有当鼠标确实在某一行存档项上方时才显示指示线
    if (!elementBelow || !elementBelow.closest('.archive-item')) {
        dropIndicatorIndex.value = null;
        return;
    }
    dropIndicatorIndex.value = computeDropIndex(event.clientY);
};

const onArchiveListDrop = async (event: DragEvent) => {
    if (!draggingArchiveId.value) {
        resetArchiveDragState();
        return;
    }
    // 检查鼠标下方是否有存档项元素
    const elementBelow = document.elementFromPoint(event.clientX, event.clientY);
    if (!elementBelow || !elementBelow.closest('.archive-item')) {
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

            const saveSuccess = await saveArchives();
            if (!saveSuccess) {
                // 保存失败时，回滚拖拽排序
                archives.value.splice(insertIndex, 1);
                if (sourceIndex < insertIndex) {
                    archives.value.splice(sourceIndex, 0, moved);
                } else {
                    archives.value.splice(sourceIndex, 0, moved);
                }
            }
        }
    }
    resetArchiveDragState();
};

const onArchiveDrop = async (targetId: string, event?: DragEvent) => {
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

    const saveSuccess = await saveArchives();
    if (!saveSuccess) {
        // 保存失败时，回滚拖拽排序
        archives.value.splice(insertIndex, 1);
        if (sourceIndex < insertIndex) {
            archives.value.splice(sourceIndex, 0, moved);
        } else {
            archives.value.splice(sourceIndex, 0, moved);
        }
    }
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
                    // 验证JSON格式并计算层级，但不重新格式化，保持分享者原样
                    let parsedData;
                    try {
                        const formatter = new JsonPlusFormatter(false, 2, false, true);
                        const result = formatter.parseJson5(response.data.jsonData);
                        parsedData = result.data;
                    } catch (e) {
                        // 回退到原生解析
                        parsedData = JSON.parse(response.data.jsonData);
                    }
                    
                    // 直接将分享的原始JSON字符串设置到输入编辑器，百分百保持精度和原样
                    inputEditor.setValue(response.data.jsonData);

                    // 更新编辑器配置，确保使用2空格缩进
                    const model = inputEditor.getModel();
                    if (model) {
                        model.updateOptions({
                            tabSize: indentSize.value,
                            indentSize: indentSize.value,
                            insertSpaces: true,
                        });
                    }
                    // 同时更新编辑器选项
                    inputEditor.updateOptions({ tabSize: indentSize.value, indentSize: indentSize.value } as any);
                    updateInputEditorConfig('json');

                    // 更新行号和高度
                    updateLineNumberWidth(inputEditor);
                    updateEditorHeight(inputEditor);

                    // 更新层级信息
                    maxLevel.value = calculateMaxLevel(parsedData);
                    if (maxLevel.value > 0 && selectedLevel.value === 0) {
                        selectedLevel.value = getDefaultFoldLevel(maxLevel.value);
                    }

                    // 显示成功消息
                    if (response.data.description) {
                        showMessageSuccess(settingsTxt.value.msgSharedLoadedWithDesc(response.data.description));
                    } else {
                        showMessageSuccess(settingsTxt.value.msgSharedLoaded);
                    }

                    // 清除URL参数（可选，保持URL干净）
                    const cleanUrl = new URL(window.location.href);
                    cleanUrl.searchParams.delete('share');
                    cleanUrl.searchParams.delete('password');
                    window.history.replaceState({}, '', cleanUrl.toString());
                } catch (error) {
                    showMessageError(settingsTxt.value.msgSharedDataFormatInvalid);
                }
            }
        } else {
            // 处理错误情况
            if (response.hasPassword) {
                // 需要密码或密码错误，显示密码输入对话框
                const promptMessage = password ? settingsTxt.value.promptSharePasswordIncorrect : settingsTxt.value.promptSharePasswordRequired;

                ElMessageBox.prompt(promptMessage, settingsTxt.value.promptSharePasswordTitle, {
                    confirmButtonText: settingsTxt.value.btnConfirm,
                    cancelButtonText: settingsTxt.value.btnCancel,
                    inputType: 'password',
                    inputPlaceholder: settingsTxt.value.promptSharePasswordPlaceholder,
                })
                    .then(async ({ value }: any) => {
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
                showMessageError(localizeShareApiError(response.error, settingsTxt.value.msgSharedLoadFallback));
            }
        }
    } catch (error: any) {
        showMessageError(settingsTxt.value.msgSharedLoadFail(error.message || settingsTxt.value.msgUnknownError));
    }
};

// 处理转义相关命令
const handleEscapeCommand = (command: string) => {
    if (!ensureProcessingFeatureAvailable()) return;
    switch (command) {
        case 'unescape':
            unescapeJSON(recursiveUnescape.value);
            break;
    }
};

// 处理高级功能命令
const handleAdvancedCommand = (command: string) => {
    if (command === 'sort' && !ensureProcessingFeatureAvailable()) return;
    if (command === 'collapse' && !ensureCollapseFeatureAvailable()) return;
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
    if (isDiffMode.value && ['unescape', 'archive'].includes(String(settingsCollapseActiveNames.value))) {
        settingsCollapseActiveNames.value = 'format';
        return;
    }
    settingsCollapseActiveNames.value = 'format';
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

// 根据"排序范围"从输入 JSON 中收集可用于排序的字段名（作为 el-autocomplete 的建议列表）
// 支持：
//   1. 空范围：用整个输入 JSON 当作数据源
//   2. 无 [*] 范围：直接 getValueByPath 取数组
//   3. 含 [*] 范围（支持多层）：和 performFieldSort 同款分段递归，收集所有叶子数组元素的 key 并集
const collectKeysFromScope = (data: any, scopePath: string): string[] => {
    const keySet = new Set<string>();

    // 工具函数：从一个数组里收集"元素一层 key"
    //   - 元素是对象：把它的直接 key 全部加入集合
    //   - 元素是数组/原始值：跳过（没有字段概念）
    const harvestKeysFromArray = (arr: any[]) => {
        for (const el of arr) {
            if (el && typeof el === 'object' && !Array.isArray(el)) {
                for (const k of Object.keys(el)) {
                    keySet.add(k);
                }
            }
        }
    };

    const path = (scopePath || '').trim();

    if (!path) {
        // 无范围：输入数据如果本身就是数组就直接收集；否则兜底对根对象收集一层 key
        if (Array.isArray(data)) {
            harvestKeysFromArray(data);
        } else if (data && typeof data === 'object') {
            for (const k of Object.keys(data)) keySet.add(k);
        }
    } else if (path.includes('[*]')) {
        // 含 [*] 的路径：和 performFieldSort 一样按 [*] 切成多段后递归
        const segments = path.split('[*]').map(s => s.replace(/^\./, ''));

        const walk = (currentNode: any, segIndex: number): void => {
            const seg = segments[segIndex];
            const arr = seg === '' ? currentNode : getValueByPath(currentNode, seg);
            if (!Array.isArray(arr)) return;

            if (segIndex === segments.length - 1) {
                // 叶子层：此数组就是"将被排序的数组"，收集它元素的 keys
                harvestKeysFromArray(arr);
                return;
            }
            for (const el of arr) {
                if (el && typeof el === 'object') walk(el, segIndex + 1);
            }
        };

        walk(data, 0);
    } else {
        // 无 [*] 但有路径：按路径取到数据
        const target = getValueByPath(data, path);
        if (Array.isArray(target)) {
            harvestKeysFromArray(target);
        } else if (target && typeof target === 'object') {
            // 不是数组但是对象：退而求其次，列出它的一层 key 供参考
            for (const k of Object.keys(target)) keySet.add(k);
        }
    }

    return Array.from(keySet).sort((a, b) => a.localeCompare(b));
};

// 字段名智能提示：根据"排序范围"推断当前数据源能提供哪些字段
const queryFieldPathsFromScope = (queryString: string, cb: (suggestions: PathSuggestion[]) => void) => {
    try {
        // 依据当前操作目标选择数据源：
        //   - 普通模式：输入编辑器
        //   - Diff 模式：按 fieldSortTarget 指向的那一侧
        let sourceEditor: monaco.editor.IStandaloneCodeEditor | null | undefined = null;
        const target = fieldSortTarget.value;
        if (target === 'diff-left') sourceEditor = getDiffSideEditor('left');
        else if (target === 'diff-right') sourceEditor = getDiffSideEditor('right');
        else sourceEditor = inputEditor;

        const raw = sourceEditor?.getValue?.() || '';
        if (!raw.trim()) {
            cb([]);
            return;
        }

        let jsonObj: any;
        try {
            // 优先用 preprocessJSON 以兼容高精度数字等保护机制；失败退化到原生 JSON.parse
            const result = preprocessJSON(raw, { preserveNumberLiterals: true });
            jsonObj = result.data;
        } catch {
            try {
                jsonObj = JSON.parse(raw);
            } catch {
                cb([]);
                return;
            }
        }

        const keys = collectKeysFromScope(jsonObj, sortRootPath.value);
        if (keys.length === 0) {
            cb([]);
            return;
        }

        // 根据用户已输入的前缀过滤（不区分大小写）
        const q = (queryString || '').toLowerCase();
        const filtered = (q ? keys.filter(k => k.toLowerCase().includes(q)) : keys).map<PathSuggestion>(k => ({
            value: k,
            type: 'key',
        }));
        cb(filtered);
    } catch {
        cb([]);
    }
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

// 获取类型标签的本地化显示
const getTypeLabel = (type: string): string => {
    const typeMap: Record<string, string> = {
        exact: settingsTxt.value.sortTypeExact,
        'array-wildcard': settingsTxt.value.sortTypeArrayWildcard,
        'array-index': settingsTxt.value.sortTypeArrayIndex,
        wildcard: settingsTxt.value.sortTypeWildcard,
        key: settingsTxt.value.sortTypeKey,
    };
    return typeMap[type] || type;
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

    // 重置输入编辑器为 Array 示例数据（兼容"再试一次"场景：
    // 上一轮演示可能已切到 Map 数据，这里必须强制恢复为初始 Array 示例）
    if (inputEditor) {
        try {
            const demoJson = JSON.stringify(demoData.value, null, 2);
            inputEditor.setValue(demoJson);
            updateEditorHeight(inputEditor);
        } catch (e) {
            /* ignore */
        }
    }

    // 同步清空上一轮残留的排序参数与结果预览，避免误导
    sortRootPath.value = '';
    sortFieldName.value = '';
    if (outputEditor) {
        try {
            clearOutputFoldingInfo();
            outputEditor.setValue('');
            updateLineNumberWidth(outputEditor);
            updateEditorHeight(outputEditor);
        } catch (e) {
            /* ignore */
        }
    }

    // 预先计算演示结果
    demoResults.value['id'] = performFieldSort(JSON.parse(JSON.stringify(demoData.value)), '', 'id');
    demoResults.value['education'] = performFieldSort(JSON.parse(JSON.stringify(demoData.value)), '[*].education', 'graduationYear');
    // map 演示结果
    demoResults.value['map_id'] = performFieldSort(JSON.parse(JSON.stringify(demoMapData.value)), '', 'id');
    demoResults.value['map_value_score'] = performFieldSort(JSON.parse(JSON.stringify(demoMapData.value)), '', 'value.score');

    // 显示第一个教学弹窗
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
    const formatted = CompatibleCustomStringify(result, 2, JSON.stringify(dataToUse), 0, true, { preserveNumberLiterals: true });
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
    const formatted = CompatibleCustomStringify(result, 2, JSON.stringify(dataToUse), 0, true, { preserveNumberLiterals: true });
    const finalOutput = formatted.replace(/\\u([0-9a-fA-F]{4})/g, '\\\\u$1');
    if (outputEditor) {
        outputEditor.setValue(finalOutput);
        updateEditorHeight(outputEditor);
    }
    showDemoStep(nextStep);
};

// 将 demoMapData 加载到输入编辑器并设置参数（不跳转）
const loadDemoMapNoAdvance = () => {
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
            title: settingsTxt.value.demoStartTitle,
            content: settingsTxt.value.demoStartContent,
            highlight: '.editor-panel-input',
            buttons: [{ text: settingsTxt.value.demoStartButton, action: () => showDemoStep(1) }],
        },
        {
            title: settingsTxt.value.demoArrayIdTitle,
            content: settingsTxt.value.demoArrayIdContent,
            highlight: '.editor-panel-input',
            buttons: [
                { text: settingsTxt.value.demoPrev, action: () => showDemoStep(0) },
                { text: settingsTxt.value.demoSetParams, action: () => setAndNext('', 'id', 2) },
            ],
        },
        {
            title: settingsTxt.value.demoExecuteTitle,
            content: settingsTxt.value.demoExecuteContent,
            highlight: '.editor-panel-input',
            buttons: [
                { text: settingsTxt.value.demoPrev, action: () => showDemoStep(1) },
                { text: settingsTxt.value.demoExecuteSort, action: () => execAndNext('', 'id', 3) },
            ],
        },
        {
            title: settingsTxt.value.demoSortDoneTitle,
            content: settingsTxt.value.demoSortDoneContent,
            highlight: null,
            buttons: [
                { text: settingsTxt.value.demoPrev, action: () => showDemoStep(2) },
                { text: settingsTxt.value.demoNextExample, action: () => showDemoStep(4) },
            ],
        },
        {
            title: settingsTxt.value.demoArrayEducationTitle,
            content: settingsTxt.value.demoArrayEducationContent,
            highlight: '.editor-panel-input',
            buttons: [
                { text: settingsTxt.value.demoPrev, action: () => showDemoStep(3) },
                {
                    text: settingsTxt.value.demoSetParams,
                    action: () => setAndNext('[*].education', 'graduationYear', 5),
                },
            ],
        },
        {
            title: settingsTxt.value.demoExecuteTitle,
            content: settingsTxt.value.demoExecuteContent,
            highlight: '.editor-panel-input',
            buttons: [
                { text: settingsTxt.value.demoPrev, action: () => showDemoStep(4) },
                {
                    text: settingsTxt.value.demoExecuteSort,
                    action: () => execAndNext('[*].education', 'graduationYear', 6),
                },
            ],
        },
        {
            title: settingsTxt.value.demoSortDoneEducationTitle,
            content: settingsTxt.value.demoSortDoneEducationContent,
            highlight: null,
            buttons: [
                { text: settingsTxt.value.demoPrev, action: () => showDemoStep(5) },
                { text: settingsTxt.value.demoNextExample, action: () => showDemoStep(7) },
            ],
        },
        {
            title: settingsTxt.value.demoMapIdTitle,
            content: settingsTxt.value.demoMapIdContent,
            highlight: '.editor-panel-input',
            buttons: [
                { text: settingsTxt.value.demoPrev, action: () => showDemoStep(6) },
                { text: settingsTxt.value.demoSetParams, action: () => setAndNext('', 'id', 8) },
            ],
        },
        {
            title: settingsTxt.value.demoExecuteTitle,
            content: settingsTxt.value.demoMapExecuteContent,
            highlight: '.editor-panel-input',
            buttons: [
                { text: settingsTxt.value.demoPrev, action: () => showDemoStep(7) },
                { text: settingsTxt.value.demoExecuteSort, action: () => execAndNextMap('', 'id', 9) },
            ],
        },
        {
            title: settingsTxt.value.demoMapIdDoneTitle,
            content: settingsTxt.value.demoMapIdDoneContent,
            highlight: null,
            buttons: [
                { text: settingsTxt.value.demoPrev, action: () => showDemoStep(8) },
                { text: settingsTxt.value.demoNextExample, action: () => showDemoStep(10) },
            ],
        },
        {
            title: settingsTxt.value.demoMapScoreTitle,
            content: settingsTxt.value.demoMapScoreContent,
            highlight: '.editor-panel-input',
            buttons: [
                { text: settingsTxt.value.demoPrev, action: () => showDemoStep(9) },
                { text: settingsTxt.value.demoSetParams, action: () => setAndNext('', 'value.score', 11) },
            ],
        },
        {
            title: settingsTxt.value.demoExecuteTitle,
            content: settingsTxt.value.demoMapScoreExecuteContent,
            highlight: '.editor-panel-input',
            buttons: [
                { text: settingsTxt.value.demoPrev, action: () => showDemoStep(10) },
                {
                    text: settingsTxt.value.demoExecuteSort,
                    action: () => execAndNextMap('', 'value.score', 12),
                },
            ],
        },
        {
            title: settingsTxt.value.demoMapScoreDoneTitle,
            content: settingsTxt.value.demoMapScoreDoneContent,
            highlight: null,
            buttons: [
                { text: settingsTxt.value.demoTryAgain, action: () => startDemoMode() },
                { text: settingsTxt.value.demoEnd, action: () => endDemoMode() },
            ],
        },
    ];
    // 更新步骤数量（用于指示器渲染）
    demoStepsCount.value = steps.length;

    if (step < steps.length) {
        currentDemoStepData.value = steps[step];
        demoGuideVisible.value = true;
        // 等 DOM/数据变化（如 loadDemoMapNoAdvance）就位后再解析锚点
        nextTick(() => {
            updateDemoPopoverAnchor(steps[step].highlight);
        });
    }
    // 自动切换 demo 数据：当进入 Map 示例步时，加载 map 示例到输入编辑器并设置默认字段（不跳转）
    // 每个示例开始时清空当前参数（范围留空，字段未设置）
    if ([1, 4, 7, 10].includes(step)) {
        sortRootPath.value = '';
        sortFieldName.value = '';
        // 每个示例开始时清空预览区域
        if (outputEditor) {
            clearOutputFoldingInfo();
            outputEditor.setValue('');
            updateLineNumberWidth(outputEditor);
            updateEditorHeight(outputEditor);
        }
    }
    if (step === 7 || step === 10) {
        loadDemoMapNoAdvance();
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
    demoPopoverAnchor.value = null;
    // 清理演示期间附加在 DOM 上的脉冲高亮类
    applyDemoHighlight(null);

    // 清空演示数据
    if (inputEditor) {
        // 恢复开始演示前的输入内容（如果有保存），否则清空
        const restored = savedInputContent.value !== null ? savedInputContent.value : '';
        inputEditor.setValue(restored);
        updateEditorHeight(inputEditor);
    }
    if (outputEditor) {
        clearOutputFoldingInfo();
        outputEditor.setValue('');
        updateEditorHeight(outputEditor);
    }
    // 清除缓存的原始内容
    savedInputContent.value = null;
};

// 执行字段排序的核心逻辑（提取为独立函数）
// 支持：
// 1) 根为数组或对象
// 2) 任意层数的 [*]（如 CIS[*].items[*].items[*].items）
// 3) [*] 之间可以有普通属性前缀（如 CIS、items），也可以直接以 [*] 开头
const performFieldSort = (data: any, rootPath: string, fieldName: string) => {
    const result = JSON.parse(JSON.stringify(data));
    const path = (rootPath || '').trim();

    if (path && path.includes('[*]')) {
        // 把路径按 [*] 拆成段：例如
        //   "CIS[*].items[*].items[*].items" -> ["CIS", "items", "items", "items"]
        //   "[*].items"                      -> ["",    "items"]
        //   "a.b[*].c[*].d"                  -> ["a.b", "c", "d"]
        // 约定：第一段是第一层 [*] 之前的前缀；后续每一段是下一层 [*] 之后的子路径；
        //       最后一段指向"被排序的数组本身"的路径（相对上一层元素）。
        const rawSegments = path.split('[*]');
        // [*] 后的 "." 是可选的，这里清理每段开头的 "."
        const segments = rawSegments.map(s => s.replace(/^\./, ''));

        // 递归下钻：
        //   currentNode：当前节点
        //   segIndex：   当前要应用的 segment 下标
        // 语义：
        //   - 最后一段（segIndex === segments.length - 1）：从 currentNode 取到该段指向的"数组"，就地排序
        //   - 其它段：从 currentNode 取到该段指向的"数组"，对数组内每个元素递归处理下一段
        const walk = (currentNode: any, segIndex: number): void => {
            const seg = segments[segIndex];
            // 解析出"当前层要操作的数组"
            const arr = seg === '' ? currentNode : getValueByPath(currentNode, seg);
            if (!Array.isArray(arr)) {
                // 路径无效或该层不是数组，就静默跳过（不阻塞其它分支）
                return;
            }

            if (segIndex === segments.length - 1) {
                // 到达叶子层：对当前数组按字段排序，并写回
                const sorted = sortJsonByField(arr, fieldName, sortOrder.value);
                if (seg === '') {
                    // 叶子就是 currentNode 本身（[*] 处于末尾且前无前缀），
                    // 此时只能通过覆盖 currentNode 的 length + 重新赋值元素来就地改写
                    arr.length = 0;
                    arr.push(...sorted);
                } else {
                    setValueByPath(currentNode, seg, sorted);
                }
                return;
            }

            // 非叶子层：对数组每个元素继续向下走一层
            for (const el of arr) {
                if (el && typeof el === 'object') {
                    walk(el, segIndex + 1);
                }
            }
        };

        // 从根开始执行。根可以是数组或对象，由 segments[0] 决定入口位置。
        walk(result, 0);
        return result;
    }

    // 无 [*]：对整个 result（或按 rootPath 取子数据）做普通排序
    if (path) {
        const target = getValueByPath(result, path);
        if (!Array.isArray(target)) {
            throw new Error(settingsTxt.value.msgFieldSortPathNotArray(path));
        }
        const sorted = sortJsonByField(target, fieldName, sortOrder.value);
        setValueByPath(result, path, sorted);
        return result;
    }
    return sortJsonByField(result, fieldName, sortOrder.value);
};

// 执行字段排序
const executeFieldSort = () => {
    if (!ensureProcessingFeatureAvailable()) return;
    fieldSortDialogVisible.value = false;

    // 根据目标解析"源编辑器"与"写回策略"
    // - 'input'：普通模式，读 inputEditor，写 outputEditor
    // - 'diff-left' / 'diff-right'：Diff 模式，源与目标为同一侧编辑器（就地替换）
    const target = fieldSortTarget.value;
    const sourceEditor = target === 'diff-left'
        ? getDiffSideEditor('left')
        : target === 'diff-right'
            ? getDiffSideEditor('right')
            : inputEditor;

    if (!sourceEditor) {
        showMessageError(settingsTxt.value.msgNoAvailableEditor);
        return;
    }

    // 统一的"写结果"函数：普通模式写到 outputEditor，Diff 模式就地写回源编辑器
    const writeResult = (finalOutput: string) => {
        if (target === 'input') {
            if (shouldPrecomputeFoldingInfo()) {
                precomputeFoldingInfo(finalOutput).catch(() => { /* 静默处理 */ });
            }
            outputEditor?.setValue(finalOutput);
            if (outputEditor) {
                const model = outputEditor.getModel();
                if (model) {
                    monaco.editor.setModelLanguage(model, 'json');
                }
                outputEditor.updateOptions(getEditorOptions(indentSize.value, true, 'json', true, getEditorLineCount(outputEditor)));
                updateLineNumberWidth(outputEditor);
                updateEditorHeight(outputEditor);
            }
        } else {
            // Diff 模式：保留 undo 栈的方式写回对应侧
            const side = target === 'diff-left' ? 'left' : 'right';
            replaceEditorValuePreservingUndo(sourceEditor, finalOutput, `diff-field-sort-${side}`);
        }
    };

    try {
        const value = sourceEditor.getValue() || '';
        let parsed;
        let originalString = value;

        const result = preprocessJSON(value, { preserveNumberLiterals: true });
        parsed = result.data;
        originalString = result.originalString;
        const escapeMap = result.escapeMap;

        // 统一通过 performFieldSort 处理所有场景（无 [*] / 单层 [*] / 多层 [*]，根为数组或对象）
        const rootPathTrim = sortRootPath.value.trim();
        const fieldTrim = sortFieldName.value.trim();

        let finalResult;
        try {
            finalResult = performFieldSort(parsed, rootPathTrim, fieldTrim);
        } catch (e: any) {
            showMessageError(settingsTxt.value.msgSortFail(e.message));
            return;
        }

        // 格式化输出
        const formatter = new JsonPlusFormatter(false, indentSize.value, true, preserveNumberLiterals.value);
        const formatted = formatter.format(finalResult, escapeMap);
        const finalOutput = formatted.replace(/\\u([0-9a-fA-F]{4})/g, '\\u$1');

        writeResult(finalOutput);

        const rootDesc = rootPathTrim ? settingsTxt.value.fieldSortPathData(rootPathTrim) : settingsTxt.value.fieldSortRootData;
        showMessageSuccess(settingsTxt.value.msgFieldSortSuccess(fieldTrim, rootDesc));
    } catch (error: any) {
        showMessageError(settingsTxt.value.msgSortFail(error.message));
    }
};

// 应用排序
const applySort = () => {
    if (!ensureProcessingFeatureAvailable()) return;
    try {
        const value = inputEditor?.getValue() || '';

        if (!value.trim()) {
            showMessageError(settingsTxt.value.msgSortDataRequired);
            return;
        }

        // 检查字段排序的参数
        if (sortMethod.value === 'field') {
            // 显示字段排序对话框
            fieldSortTarget.value = 'input';
            sortRootPath.value = '';
            sortFieldName.value = '';
            fieldSortDialogVisible.value = true;
            return;
        }

        let outputResult: string;
        let isJsonFormat = true;

        // 对于字典序和按Key长度，优先尝试JSON解析，如果失败则按字符串行处理
        if (sortMethod.value === 'dictionary' || sortMethod.value === 'length') {
            try {
                // 先尝试JSON解析
                const result = preprocessJSON(value, { preserveNumberLiterals: true });
                const parsed = result.data;
                const escapeMap = result.escapeMap;

                // 执行JSON对象排序
                const sorted = sortJsonObject(parsed, sortMethod.value, sortOrder.value, '');

                // 格式化输出
                const formatter = new JsonPlusFormatter(false, indentSize.value, true, preserveNumberLiterals.value);
                const formatted = formatter.format(sorted, escapeMap);
                outputResult = formatted.replace(/\\u([0-9a-fA-F]{4})/g, '\\u$1');
            } catch (jsonError) {
                // JSON解析失败，按字符串行处理
                isJsonFormat = false;
                outputResult = sortStringLines(value, sortMethod.value, sortOrder.value);
                outputType.value = 'text';
            }
        } else {
            // 其他排序方式保持原有逻辑
            outputType.value = 'json';
            const result = preprocessJSON(value, { preserveNumberLiterals: true });
            const parsed = result.data;
            const escapeMap = result.escapeMap;

            const sorted = sortJsonObject(parsed, sortMethod.value, sortOrder.value, '');
            const formatter = new JsonPlusFormatter(false, indentSize.value, true, preserveNumberLiterals.value);
            const formatted = formatter.format(sorted, escapeMap);
            outputResult = formatted.replace(/\\u([0-9a-fA-F]{4})/g, '\\u$1');
        }

        // 异步计算所有折叠区域的信息（不阻塞，立即返回）
        // 这样可以避免实时计算的高成本，特别是对于大数据量
        if (isJsonFormat && shouldPrecomputeFoldingInfo()) {
            precomputeFoldingInfo(outputResult).catch();
        }

        outputEditor?.setValue(outputResult);

        // 更新编辑器配置
        if (outputEditor) {
            const model = outputEditor.getModel();
            if (model) {
                // 根据输出格式设置语言
                monaco.editor.setModelLanguage(model, isJsonFormat ? 'json' : 'plaintext');
            }
            outputEditor.updateOptions(
                getEditorOptions(indentSize.value, true, isJsonFormat ? 'json' : 'text', true, getEditorLineCount(outputEditor))
            );
            updateLineNumberWidth(outputEditor);
            updateEditorHeight(outputEditor);
        }

        const formatType = isJsonFormat ? settingsTxt.value.sortFormatJson : settingsTxt.value.sortFormatTextLines;
        showMessageSuccess(settingsTxt.value.msgSortFormatSuccess(formatType));
    } catch (error: any) {
        showMessageError(settingsTxt.value.msgSortFail(error.message));
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
                    // 直接使用读取的文本，不再检查替换字符
                    // 因为某些二进制数据可能被序列化为 \uFFFD，但这不影响 JSON 处理
                    resolve(e.target.result as string);
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

        // 更新编辑器 - 将格式化后的内容展示到编辑区域
        if (inputEditor) {
            inputEditor.setValue(formattedContent);

            // 根据内容类型设置缩进配置
            // 使用 Monaco Editor 内置的缩进检测 API
            const model = inputEditor.getModel();
            if (model) {
                // 某些情况下 detectIndentation 可能不存在或返回 undefined，需要进行空值检查
                const detected = (model as any).detectIndentation ? (model as any).detectIndentation(true, 2) : null;

                // 如果检测到使用了空格缩进，且缩进大小与当前设置不同
                if (detected && detected.insertSpaces && detected.tabSize !== indentSize.value) {
                    // 只要检测到有效的正整数缩进（通常是2, 4, 8等），就自动调整编辑器的显示配置
                    // 但不修改全局的缩进设置（indentSize），因为用户希望保留手动设置的值
                    model.updateOptions({ tabSize: detected.tabSize, indentSize: detected.tabSize, insertSpaces: true });
                    inputEditor.updateOptions({ tabSize: detected.tabSize, indentSize: detected.tabSize } as any);
                    
                    // 提示用户已临时调整显示
                    showMessageSuccess(`已检测到 ${detected.tabSize} 格缩进，仅临时调整编辑器显示，全局设置保持不变`);
                }
            }

            updateLineNumberWidth(inputEditor);
            updateEditorHeight(inputEditor);
        }

        // 清空outputEditor的内容
        if (outputEditor) {
            clearOutputFoldingInfo();
            outputEditor.setValue('');
        }
        updateLineNumberWidth(outputEditor);
        updateEditorHeight(outputEditor);

        showMessageSuccess('文件上传成功，已加载到编辑区域');
    } catch (error: any) {
        showMessageError('文件处理失败: ' + error.message);
    }
};

// 清空输入
const clearInput = (showToast: boolean = true) => {
    try {
        maxLevel.value = 0;
        selectedLevel.value = 0;

        if (inputEditor) {
            const model = inputEditor.getModel();
            if (model) {
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
                        updateInputEditorConfig('json');
                    }
                }, 100);
            }
        }

        if (outputEditor) {
            clearOutputFoldingInfo();
            const model = outputEditor.getModel();
            if (model) {
                const fullRange = model.getFullModelRange();
                if (!fullRange.isEmpty()) {
                    outputEditor.executeEdits('clear-output', [
                        {
                            range: fullRange,
                            text: '',
                        },
                    ]);
                }
            }
            updateEditorHeight(outputEditor);
        }

        outputType.value = 'json';
        if (showToast) {
            showMessageSuccess('已清空内容');
        }
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
        const fileExtensionMap: Record<'json' | 'yaml' | 'toml' | 'xml' | 'go' | 'text', string> = {
            json: '.json',
            yaml: '.yaml',
            toml: '.toml',
            xml: '.xml',
            go: '.go',
            text: '.txt',
        };
        const fileExtension = fileExtensionMap[outputType.value];

        const mimeTypeMap: Record<'json' | 'yaml' | 'toml' | 'xml' | 'go' | 'text', string> = {
            json: 'application/json',
            yaml: 'text/yaml',
            toml: 'text/plain',
            xml: 'application/xml',
            go: 'text/plain',
            text: 'text/plain',
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

// 分割线拖动实现
const startResize = (e: MouseEvent | TouchEvent | PointerEvent) => {
    // 演示模式下锁定分割线，防止 Popover 锚点抖动导致引导卡片位置乱跳
    if (isDemoMode.value) {
        e.preventDefault?.();
        return;
    }
    // 初始化容器引用
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

    // 计算最小/最大宽度限制（允许折叠到0）
    const minWidthPx = 0;
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

// 添加将预览区域内容转移到编辑区域的方法
const transferToInput = (e: MouseEvent) => {
    // 阻止事件冒泡，防止触发分割线的拖动
    e.stopPropagation();
    if (outputType.value !== 'json') {
        showMessageWarning(settingsTxt.value.msgTransferUnsupportedType);
        return;
    }

    try {
        const outputContent = outputEditor?.getValue() || '';
        if (!outputContent.trim()) {
            showMessageWarning(settingsTxt.value.msgTransferOutputEmpty);
            return;
        }

        // 保存预览区域的视图状态（包含折叠状态、滚动位置等）
        const viewState = outputEditor?.saveViewState();

        const targetIndentSize = indentSize.value; // 使用用户设置的缩进大小
        let formattedContent: string;

        try {
            // 直接重新格式化缩进，保持原始字符串表示不变
            formattedContent = reformatJsonIndentation(outputContent, targetIndentSize);
        } catch (parseError) {
            // 如果解析失败，使用原始内容
            formattedContent = outputContent;
        }

        // 转移内容到编辑区域
        if (inputEditor) {
            const inputModel = inputEditor.getModel();
            if (inputModel) {
                inputEditor.pushUndoStop();
                inputEditor.executeEdits('transfer-to-input', [
                    {
                        range: inputModel.getFullModelRange(),
                        text: formattedContent,
                    },
                ]);
                inputEditor.pushUndoStop();
                updateLineNumberWidth(inputEditor);
                updateEditorHeight(inputEditor);

                // 确保输入编辑器使用用户设置的缩进大小
                inputModel.updateOptions({
                    tabSize: indentSize.value,
                    indentSize: indentSize.value,
                    insertSpaces: true,
                });
                // 同时更新编辑器选项
                inputEditor.updateOptions({ tabSize: indentSize.value, indentSize: indentSize.value } as any);

                // 恢复视图状态（折叠状态、滚动位置等）
                if (viewState) {
                    // 使用 nextTick 确保内容更新后再恢复状态
                    nextTick(() => {
                        // 先强制展开所有折叠，确保与预览区域状态一致（特别是预览区域全展开的情况）
                        // 使用 run() 方法确保执行完成
                        const unfoldAction = inputEditor?.getAction('editor.unfoldAll');
                        if (unfoldAction) {
                            unfoldAction.run().then(() => {
                                // 展开完成后，再恢复预览区域的视图状态（如果有折叠，会再次应用）
                                inputEditor?.restoreViewState(viewState);
                            });
                        } else {
                            // 如果找不到 unfoldAll 动作，直接恢复
                            inputEditor?.restoreViewState(viewState);
                        }
                    });
                }
            }
        }

        // 清空预览区域
        if (outputEditor) {
            clearOutputFoldingInfo();
            outputEditor.setValue('');
            updateLineNumberWidth(outputEditor);
            updateEditorHeight(outputEditor);
        }

        showMessageSuccess(settingsTxt.value.msgTransferSuccess);
    } catch (error: any) {
        showMessageError(settingsTxt.value.msgTransferFail(error.message));
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
    height: calc(100vh - 174px);
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
    inset: 0;
    z-index: 1500;
    width: 100%;
    height: 100%;
    background-color: #f0f2f5;
}

/* 全屏过渡动画 */
.json-tool-container {
    transition: background-color 0.25s ease, box-shadow 0.25s ease;
}

.json-tool-container.fullscreen {
    animation: fullscreenSlideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

@keyframes fullscreenSlideIn {
    from {
        opacity: 0.6;
        transform: translateY(-12px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

.json-tool-container:not(.fullscreen) {
    animation: fullscreenSlideOut 0.25s cubic-bezier(0.4, 0, 1, 1) forwards;
}

@keyframes fullscreenSlideOut {
    from {
        opacity: 0.6;
        transform: translateY(8px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

/* 工具栏包装器 */
.tool-bar-wrapper {
    position: relative;
    display: flex;
    align-items: center;
}

.tool-bar {
    border-bottom: 1px solid rgba(160, 170, 180, 0.18);
    box-shadow: 0 2px 6px rgba(16, 24, 40, 0.03);
    padding: 5px 10px;
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
    width: 102px;
}

:deep(.el-select-dropdown__item) {
    padding: 0 20px !important;
}

:global(.level-select-dropdown) {
    min-width: 100px !important;
}

:global(.level-select-dropdown .el-select-dropdown__item) {
    overflow: visible;
    padding: 0 20px !important;
    text-overflow: clip;
    white-space: nowrap;
}

:global(.level-select-dropdown .el-select-dropdown__item span) {
    overflow: visible;
    text-overflow: clip;
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

/* 退出全屏状态下按钮显示为灰色（与 type="info" 的设置按钮保持一致） */
.fullscreen-btn.el-button--info {
    background-color: #909399 !important;
    border-color: #909399 !important;
    color: #fff !important;
}

.fullscreen-btn.el-button--info:hover {
    background-color: #a6a9ad !important;
    border-color: #a6a9ad !important;
}

.fullscreen-btn.el-button--info:active {
    background-color: #82848a !important;
    border-color: #82848a !important;
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
    box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.05);
    margin: 0;
    min-width: 0; /* 允许面板宽度为0以实现折叠效果 */
    position: relative;
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

/* 演示模式下锁定分割线：
   - 改为 not-allowed 光标，暗示"此刻不可拖动"
   - hover/active 不再变色（避免误导用户以为还能拖）
   - 核心的拖动拦截在 startResize 函数里做，这里只做视觉反馈 */
.resizer.resizer-locked-during-demo {
    cursor: not-allowed;
}
.resizer.resizer-locked-during-demo:hover,
.resizer.resizer-locked-during-demo:active {
    background-color: #eef0f6;
}
.resizer.resizer-locked-during-demo::after {
    background-color: #dcdfe6;
}

/* 演示模式下的通用锁定遮罩层：
   - 阻断所有鼠标/触摸事件（按钮不可点、下拉不展开）
   - 视觉上降亮度并移除交互反馈色
   - 当前用于工具栏（除"设置"按钮外），将来如需锁定其它区域直接加该类即可 */
.demo-locked-area {
    pointer-events: none;
    opacity: 0.55;
    filter: grayscale(0.2);
    user-select: none;
    transition: opacity 0.2s, filter 0.2s;
}

/* 工具栏内部的"功能按钮分组"容器：
   仅作为"演示期间整体禁用"的挂载点，必须对布局保持透明——
   继承 .tool-bar 的 flex 方向/对齐，让内部按钮依然像原来一样单行排列。
   注意：作为 .tool-bar 的直接子元素，它本身也需要和前面的"设置"按钮保持 10px 间距，
   这正是原样式靠 `.tool-bar > .el-button-group` 的 margin-left 自然获得的效果。 */
.tool-bar > .toolbar-actions {
    display: flex;
    align-items: center;
    flex-wrap: nowrap;
    gap: 0;
    flex: 1 1 auto;
    min-width: 0;
    margin-left: 10px;
}

/* 由于在 .tool-bar 里新增了 .toolbar-actions 包裹层，
   原本依赖 `.tool-bar > .el-button-group` 直接子选择器的间距规则失效，
   这里对 .toolbar-actions 的直接子元素复刻同一套 margin，保持视觉一致。 */
.tool-bar > .toolbar-actions > .el-button,
.tool-bar > .toolbar-actions > .el-button-group,
.tool-bar > .toolbar-actions > .el-dropdown,
.tool-bar > .toolbar-actions > .collapse-control {
    margin-left: 10px;
    flex-shrink: 0;
    white-space: nowrap;
}

.tool-bar > .toolbar-actions > .el-button:first-child,
.tool-bar > .toolbar-actions > .el-button-group:first-child,
.tool-bar > .toolbar-actions > .el-dropdown:first-child,
.tool-bar > .toolbar-actions > .collapse-control:first-child {
    margin-left: 0;
}

.panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-shrink: 0;
    height: 35px;
    padding: 5px 15px;
    background: linear-gradient(to bottom, #fafbfc, #f6f8fa);
    border-bottom: 1px solid #e4e7ed;
    box-sizing: border-box;
    cursor: pointer;
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
    user-select: none;
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
    /* 当按钮应该隐藏时，使用透明度和禁用事件而不是display none，保持空间占用 */
    opacity: var(--panel-actions-opacity, 1);
    pointer-events: var(--panel-actions-pointer-events, auto);
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
    position: relative;
}

.monaco-editor-instance {
    flex: 1;
    min-height: 0;
    position: relative;
}

/* 错误导航：内联于编辑区域底部状态栏 */
.error-nav-inline {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    margin-left: auto;
    padding-left: 8px;
    user-select: none;
    line-height: 1;
}

.error-nav-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
}

.error-warning-icon {
    color: #f56c6c;
    font-size: 13px;
}

.error-nav-count {
    font-size: 12px;
    font-weight: 600;
    color: #f56c6c;
    min-width: 14px;
    text-align: left;
}

.error-nav-btn {
    width: 18px;
    height: 18px;
    padding: 0;
    border: 1px solid transparent;
    border-radius: 4px;
    background: transparent;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: background-color 120ms ease, border-color 120ms ease, transform 60ms ease;
}

.error-nav-btn:hover {
    background: rgba(0, 0, 0, 0.05);
    border-color: rgba(0, 0, 0, 0.08);
}

.error-nav-btn:active {
    background: rgba(0, 0, 0, 0.1);
    border-color: rgba(0, 0, 0, 0.12);
    transform: translateY(0.5px);
}

.error-nav-btn:focus-visible {
    outline: 2px solid rgba(245, 108, 108, 0.35);
    outline-offset: 1px;
}

.error-nav-arrow {
    color: #606266;
    font-size: 12px;
}

.error-nav-btn:hover .error-nav-arrow {
    color: #303133;
}

.error-nav-arrow :deep(svg) {
    width: 12px;
    height: 12px;
}
.error-nav-arrow :deep(svg path),
.error-nav-arrow :deep(svg polyline),
.error-nav-arrow :deep(svg line) {
    stroke-width: 2.6;
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
    background-color: #e4e7ed;
    border-radius: 3px;
    cursor: pointer;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
}

.transfer-button svg {
    width: 18px;
    height: 18px;
    color: #409eff;
    display: block;
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
.dialog-header-with-close {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    gap: 16px;
}

.dialog-title-with-close {
    font-size: 18px;
    font-weight: 600;
    color: #303133;
    line-height: 1.5;
}

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

.settings-description {
    font-size: 12px;
    font-weight: 400;
    color: #909399;
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

/* 移除单选项标签左侧为圆圈预留的间距（当圆圈被隐藏时） */
.settings-radio-group :deep(.el-radio__label) {
    padding-left: 0 !important;
}

/* 隐藏设置弹窗中单选按钮的小圆圈，仅保留文字标签 */
.settings-radio-group :deep(.el-radio__inner) {
    display: none !important;
}

.settings-radio-group :deep(.el-radio__input) {
    width: 0 !important;
    margin-right: 0 !important;
    padding: 0 !important;
    visibility: hidden !important;
}

/* 保持带边框的单选项的内边距，只是移除圆圈留白 */
.settings-radio-group :deep(.el-radio.is-bordered) {
    padding: 6px 12px;
    border-radius: 4px;
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

.settings-subsection-title-label {
    color: #606266;
}

.settings-subsection-title-desc {
    margin-left: 8px;
    font-size: 12px;
    font-weight: 400;
    color: #909399;
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
    padding: 6.5px;
    box-sizing: border-box;
    transition: width 0.1s ease;
    flex-shrink: 0;
}

.archive-sidebar.collapsed .archive-item {
    justify-content: center;
    padding: 5px 0;
}

.archive-sidebar.collapsed .archive-name {
    text-align: center;
    background-color: #edf5ff;
    color: #409eff;
    min-width: 20px;
    padding: 2px;
    display: inline-block;
}

.archive-sidebar-header {
    display: flex;
    align-items: center;
    justify-content: center;
    padding-bottom: 6.5px;
    margin-bottom: 4px;
    border-bottom: 1px solid #e4e7ed;
    cursor: pointer;
    user-select: none;
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
    flex: 1 0 auto;
    white-space: nowrap;
    text-overflow: ellipsis;
    overflow: hidden;
    user-select: none;
}

.archive-actions {
    display: flex;
    align-items: center;
    overflow: hidden;
    flex-shrink: 1000;
    min-width: 0;
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
    flex-shrink: 0;
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
    border-radius: 4px;
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

/* 演示模式样式 - Popover 贴边版本 */
/* el-popover 会被 teleport 到 body，使用 popper-class 定位 */
:global(.demo-guide-popover.el-popover) {
    padding: 0 !important;
    border-radius: 6px !important;
    box-shadow: 0 6px 28px rgba(0, 0, 0, 0.18) !important;
    border: 1px solid #dcdfe6 !important;
}

.demo-guide-inner {
    animation: demoPopup 0.25s ease-out;
}

@keyframes demoPopup {
    from {
        opacity: 0;
        transform: scale(0.96);
    }

    to {
        opacity: 1;
        transform: scale(1);
    }
}

.demo-guide-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 14px;
    border-bottom: 1px solid #f0f0f0;
}

.demo-guide-header h3 {
    margin: 0;
    color: #303133;
    font-size: 14px;
    font-weight: 600;
}

.demo-close-btn {
    background: none;
    border: none;
    /* 使用固定字号 + line-height:1 消除字符垂直基线偏移；
       字体栈强制走系统无衬线，避免某些中文字体中 '✕' 被渲染得偏大偏斜 */
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
    /* 消除按钮默认可能存在的 text-indent / vertical-align 偏移 */
    text-align: center;
    vertical-align: middle;
}

.demo-close-btn:hover {
    background: #f2f3f5;
    color: #303133;
    transform: scale(1.08);
}

.demo-close-btn:active {
    transform: scale(0.96);
}

.demo-guide-content {
    padding: 10px 14px 4px;
}

.demo-guide-content p {
    margin: 0 0 10px 0;
    color: #606266;
    font-size: 13px;
    line-height: 1.6;
}

.demo-current-settings {
    background: #f5f7fa;
    border: 1px solid #ebeef5;
    border-radius: 4px;
    padding: 6px 10px;
    font-size: 12px;
    color: #606266;
}

.demo-current-settings strong {
    display: block;
    margin-bottom: 4px;
    color: #303133;
    font-weight: 600;
}

.demo-settings-list {
    list-style: none;
    margin: 0;
    padding: 0;
}

.demo-settings-list li {
    display: flex;
    align-items: center;
    padding: 2px 0;
    line-height: 1.7;
}

.demo-settings-label {
    flex-shrink: 0;
    color: #909399;
    min-width: 68px;
}

.demo-current-settings code {
    padding: 1px 5px;
    border-radius: 3px;
    font-family: 'Monaco', 'Menlo', monospace;
    font-size: 12px;
    color: #d73a49;
}

.demo-guide-footer {
    padding: 8px 14px;
    text-align: right;
    border-top: 1px solid #f5f7fa;
}

.demo-guide-footer .el-button + .el-button {
    margin-left: 6px;
}

.demo-step-indicator {
    display: flex;
    justify-content: center;
    padding: 0 14px 10px;
    gap: 6px;
}

.step-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #e4e7ed;
    transition: background-color 0.3s;
}

.step-dot.active {
    background: #409eff;
}

/* 演示模式下当前引导元素的脉冲高亮描边 */
/* 通过 transform: scale 让元素主动从贴边位置微微缩进，留出 box-shadow 绘制空间，
   避免在浏览器窗口边缘（编辑区左侧、预览区右侧）被视口裁切看不到 */
.demo-highlight-target {
    position: relative;
    z-index: 2000;
    border-radius: 4px;
    transform: scale(0.994);
    transform-origin: center center;
    animation: demoPulse 1.8s ease-in-out infinite;
    transition: box-shadow 0.2s, transform 0.2s;
}

@keyframes demoPulse {
    0%,
    100% {
        box-shadow:
            0 0 0 2px #409eff,
            0 0 0 5px rgba(64, 158, 255, 0.3);
    }
    50% {
        box-shadow:
            0 0 0 2px #409eff,
            0 0 0 8px rgba(64, 158, 255, 0.12);
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

/* ==================== Diff 模式样式 ==================== */
.diff-tool-bar {
    justify-content: flex-start;
    gap: 12px;
}

.diff-nav-group {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-left: 12px;
}

.diff-editor-container {
    display: flex;
    flex-direction: column;
    position: relative;
    overflow: hidden;
    background: #fff;
    border: 1px solid #e4e7ed;
    border-radius: 4px;
}

.diff-row {
    display: flex;
    min-width: 0;
}

.diff-cell {
    box-sizing: border-box;
    min-width: 0;
    display: flex;
    flex-direction: column;
}

.diff-cell-left,
.diff-cell-right {
    flex: 1 1 0;
    min-width: 0;
}

.diff-cell-center {
    flex: 0 0 35px;
    width: 35px;
    background: linear-gradient(to bottom, #fafbfc, #f5f7fa);
    border-left: 1px solid #e4e7ed;
    border-right: 1px solid #e4e7ed;
    position: relative;
}

/* ---------------- 顶部 header 行 ---------------- */
.diff-header-row {
    flex: 0 0 35px;
    height: 35px;
    border-bottom: 1px solid #e4e7ed;
    background: linear-gradient(to bottom, #fafbfc, #f6f8fa);
}

.diff-header-cell {
    flex-direction: row;
    align-items: center;
    justify-content: center;
    padding: 5px 15px;
}

.diff-header-cell.diff-cell-center {
    padding: 0;
}

.diff-panel-actions {
    display: flex;
    gap: 8px;
    opacity: 1;
    pointer-events: auto;
}

.diff-panel-actions :deep(.el-button) {
    transition: none !important;
    animation: none !important;
}

.diff-panel-actions :deep(.el-button + .el-button) {
    margin-left: 0 !important;
}

/* ---------------- 中部编辑器行 ---------------- */
.diff-editor-row {
    flex: 1;
    min-height: 0;
    overflow: hidden;
}

.diff-editor-host {
    position: relative;
    overflow: hidden;
}

.diff-editor-instance {
    width: 100%;
    height: 100%;
}

.diff-editor-row .diff-cell-center {
    pointer-events: none;
}

.diff-editor-row .diff-sync-btn-group {
    position: absolute;
    left: 50%;
    transform: translate(-50%, -50%);
    display: flex;
    flex-direction: row;
    gap: 0;
    pointer-events: auto;
    z-index: 1;
}

.diff-sync-btn {
    width: 16px;
    height: 18px;
    border: none;
    background: transparent;
    color: #409eff;
    font-size: 14px;
    font-weight: bold;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    line-height: 1;
    transition: color 0.15s, opacity 0.15s;
}

.diff-sync-btn-left,
.diff-sync-btn-right {
    border-radius: 0;
}

.diff-sync-btn:hover {
    color: #1f78d1;
}

.diff-sync-btn-group.is-active .diff-sync-btn {
    color: #f59e0b;
}

.diff-sync-btn:active {
    opacity: 0.7;
}

/* ---------------- 差异行高亮装饰 ---------------- */
.diff-editor-row :deep(.diff-line-delete) {
    background: rgba(255, 0, 0, 0.12);
}

.diff-editor-row :deep(.diff-line-insert) {
    background: rgba(0, 200, 0, 0.12);
}

.diff-editor-row :deep(.diff-line-delete-margin) {
    background: rgba(255, 0, 0, 0.4);
    width: 3px !important;
    margin-left: 2px;
}

.diff-editor-row :deep(.diff-line-insert-margin) {
    background: rgba(0, 200, 0, 0.5);
    width: 3px !important;
    margin-left: 2px;
}

/* ---------------- 行内字符级差异高亮 ---------------- */
/* 背景色加深一档，使其在整行底色之上仍清晰可见；不用下划线/删除线，
   避免 JSON 中本身包含的转义字符或路径出现视觉干扰。 */
.diff-editor-row :deep(.diff-inline-delete) {
    background: rgba(255, 0, 0, 0.35);
    border-radius: 2px;
}

.diff-editor-row :deep(.diff-inline-insert) {
    background: rgba(0, 200, 0, 0.35);
    border-radius: 2px;
}

/* ---------------- 缺失行占位区 ---------------- */
.diff-editor-row :deep(.diff-view-zone-spacer) {
    width: 100%;
    box-sizing: border-box;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.75);
}

.diff-editor-row :deep(.diff-view-zone-spacer-left) {
    background-color: rgba(255, 243, 243, 0.92);
    background-image: repeating-linear-gradient(
        -45deg,
        rgba(204, 102, 102, 0.2) 0,
        rgba(204, 102, 102, 0.2) 2px,
        transparent 2px,
        transparent 9px
    );
}

.diff-editor-row :deep(.diff-view-zone-spacer-right) {
    background-color: rgba(243, 251, 243, 0.92);
    background-image: repeating-linear-gradient(
        -45deg,
        rgba(92, 184, 92, 0.2) 0,
        rgba(92, 184, 92, 0.2) 2px,
        transparent 2px,
        transparent 9px
    );
}

/* ---------------- 底部 status 行 ---------------- */
.diff-status-row {
    flex: 0 0 22px;
    min-height: 22px;
}

.diff-status-bar {
    box-sizing: border-box;
    min-width: 0;
    overflow: hidden;
    flex-direction: row;
    align-items: center;
}
</style>
