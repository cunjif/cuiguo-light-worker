# 聊天输入区域布局重构 - 编码任务

## 1. 面板头部重构 — 移除缩略图条

- [ ] 从左侧面板 `panel-header` 中移除 `<chat-mcp-chat-thumbnail-strip>` 组件引用（`index.html` 约第80-81行）
- [ ] 从右侧面板 `panel-header` 中移除 `<chat-mcp-chat-thumbnail-strip>` 组件引用（`index.html` 约第312-313行）
- [ ] 确认回形针按钮（`mdi-paperclip`）保持在面板头部左侧，`:disabled="messageStore.isProcessingFiles"` 绑定不变
- [ ] 确认面板交换按钮（`mdi-swap-horizontal`）保持在面板头部右侧，防抖逻辑不变

## 2. 文本输入框独立行 — 清空 prepend-inner 插槽

- [ ] 从左侧面板 `v-textarea` 中删除整个 `<template v-slot:prepend-inner>` 插槽内容（`index.html` 约第120-154行），包括：
  - 移除 `attachment-chip-strip` 附件标签条（`v-chip` 列表 + 清除全部按钮）
  - 移除旧版 `base64` / `documentContent` 图片和文档预览（`v-container` > `v-row` 区域）
- [ ] 从右侧面板 `v-textarea` 中删除整个 `<template v-slot:prepend-inner>` 插槽内容（`index.html` 约第352-386行），同上
- [ ] 将左侧面板 `v-textarea` 的 `label` 属性改为空字符串 `''`，移除附件计数提示（附件计数已在独立附件行中展示，无需在输入框内重复显示）
- [ ] 将右侧面板 `v-textarea` 的 `label` 属性改为空字符串 `''`，同上
- [ ] 确认 `append-inner` 插槽（发送/停止/更多按钮）逻辑完全不变
- [ ] 确认技能提示区（`skillStore.activeSkill` / `skillStore.matchedSkill`）保持在 `v-textarea` 上方不变

## 3. 新增附件独立行

- [ ] 在左侧面板 `input-section` 的 `</div>` 闭合标签之后、`<v-divider>` 之前，新增附件行区域：
  - 外层容器：`<div v-if="messageStore.attachments.length > 0" class="attachment-row d-flex align-center flex-wrap ga-1 px-3 py-2">`
  - 附件标签列表：`<v-chip v-for="attachment in messageStore.attachments" :key="attachment.id" size="x-small" variant="tonal" closable @click:close="messageStore.removeAttachment(attachment.id)">`，内含图标和文件名
  - 附件计数提示：`<span class="text-caption text-grey ml-2">{{ $t('$vuetify.dataIterator.attachment.attachedCount', { count: messageStore.attachments.length }) }}</span>`
  - 清除全部按钮：`<v-btn size="x-small" variant="text" color="grey" class="ml-auto" @click="messageStore.clearAttachments()">`，含 `mdi-close-circle-outline` 图标和 `$t('$vuetify.dataIterator.g.clearAll')` 文本
- [ ] 在右侧面板相同位置新增同样的附件行区域
- [ ] 在附件行下方添加条件分隔线：`<v-divider v-if="messageStore.attachments.length > 0"></v-divider>`，左右面板均需添加
- [ ] 确认附件行空状态（`attachments.length === 0`）时不渲染、不占空间
- [ ] 确认附件行各元素对齐：标签列表左对齐，清除全部按钮右对齐（`ml-auto`）

## 4. 底部工具栏重命名与位置调整

- [ ] 将左侧面板 `nav-section` 的 class 名改为 `bottom-toolbar`（`index.html` 约第193行）
- [ ] 将右侧面板 `nav-section` 的 class 名改为 `bottom-toolbar`（`index.html` 约第425行）
- [ ] 确认5个工具栏按钮（新对话、模型接入、MCP管理、技能管理、语言设置）的 `@click`、`prepend-icon`、`v-tooltip` 逻辑完全保持不变
- [ ] 确认按钮样式保持 `variant="tonal"` 和 `size="small"` 不变
- [ ] 确认按钮居中对齐保持 `d-flex align-center justify-center ga-2` 不变

## 5. CSS 样式更新

- [ ] 在 `styles.css` 中新增 `.attachment-row` 样式类：
  - `max-height: 120px; overflow-y: auto;`（附件行最大高度约束，超出滚动）
  - `flex-shrink: 0; background-color: white;`（与现有布局风格一致）
- [ ] 在 `styles.css` 中将 `.nav-section` 样式规则重命名为 `.bottom-toolbar`，保持原有属性不变
- [ ] 评估 `.attachment-chip-strip` 样式是否仍需保留（该 class 已从模板中移除，如无其他引用则可删除）

## 6. 布局层级与分隔线验证

- [ ] 确认左侧面板最终布局顺序为：`panel-header` → `<v-divider>` → `input-section` → `<v-divider>` → `attachment-row`（条件）→ `<v-divider>`（条件）→ `bottom-toolbar` → `<v-divider>` → `history-section`
- [ ] 确认右侧面板最终布局顺序与左侧完全一致
- [ ] 确认附件行仅在 `messageStore.attachments.length > 0` 时渲染，附件行及其下方分隔线同步条件显示
- [ ] 确认无附件时文本输入框与底部工具栏之间无多余间距

## 7. 功能验证与回归测试

- [ ] 验证附件添加后，附件行在文本输入框下方正确显示（标签 + 计数 + 清除按钮）
- [ ] 验证点击单个附件标签的关闭按钮后，该附件被移除
- [ ] 验证点击"清除全部"按钮后，所有附件被移除，附件行消失
- [ ] 验证附件行空状态不占空间，布局无缝衔接
- [ ] 验证拖拽上传功能正常（`@dragenter` / `@dragover` / `@dragleave` / `@drop` 事件不受影响）
- [ ] 验证键盘快捷键 `Ctrl+Alt+A` 触发文件选择器功能正常
- [ ] 验证面板交换按钮切换后，左右面板输入区域布局结构一致
- [ ] 验证文件处理中（`isProcessingFiles` 为 true）回形针按钮禁用
- [ ] 验证底部工具栏5个按钮功能与重构前完全一致
- [ ] 验证技能匹配提示在文本输入框内正常展示
- [ ] 验证发送/停止/更多操作按钮功能不受影响