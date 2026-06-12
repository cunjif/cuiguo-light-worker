# 附件缩略图条（Thumbnail Strip）- 编码任务规划

## 1. 缩略图项组件实现

- [ ] 创建 `chat-mcp-chat-thumbnail-item` 模板：在 `src/renderer/index.html` 中添加 `<template id="chat-mcp-chat-thumbnail-item-template">`，包含图片缩略图（v-img）、文档图标、处理中状态（v-progress-circular）、错误状态（mdi-alert-circle）、悬浮移除按钮（v-btn + v-hover）、tooltip（v-tooltip）
- [ ] 创建 `chat-mcp-chat-thumbnail-item` JS 组件定义：在 `src/renderer/index.html` 的 `<script>` 中定义 `ChatThumbnailItem` 对象，包含 props（attachment）、emits（remove）、methods（getDocIcon、getDocIconColor、formatSize）
- [ ] 复用 `ChatAttachmentItem` 中已有的 `getDocIcon`、`getDocIconColor` 方法逻辑，确保图标映射一致

**涉及文件**: `src/renderer/index.html`（模板区 + JS 组件定义区）

**依赖**: 无

---

## 2. 缩略图条容器组件实现

- [ ] 创建 `chat-mcp-chat-thumbnail-strip` 模板：在 `src/renderer/index.html` 中添加 `<template id="chat-mcp-chat-thumbnail-strip-template">`，包含 v-if 空状态判断、滚动容器、thumbnail-item 循环渲染、溢出数量指示（+N badge）
- [ ] 创建 `chat-mcp-chat-thumbnail-strip` JS 组件定义：在 `src/renderer/index.html` 的 `<script>` 中定义 `ChatThumbnailStrip` 对象，包含 props（attachments）、emits（remove）、data（overflowCount、resizeObserver）、watch（attachments 深度监听）、生命周期（mounted/beforeUnmount）、methods（onWheel、updateOverflowCount、scrollToEnd）
- [ ] 局部注册 `chat-mcp-chat-thumbnail-item` 子组件到 `ChatThumbnailStrip` 的 components 中

**涉及文件**: `src/renderer/index.html`（模板区 + JS 组件定义区）

**依赖**: 任务 1

---

## 3. CSS 样式实现

- [ ] 在 `src/renderer/index.html` 的 `<style>` 块中添加缩略图条相关样式：
  - `.thumbnail-strip`：max-width 60%、height 32px、margin-left 8px、overflow hidden、flex-shrink 1
  - `.thumbnail-scroll-container`：overflow-x auto、隐藏滚动条（scrollbar-width: none、-webkit-scrollbar）
  - `.thumbnail-item`：width/height 32px、flex-shrink 0、cursor default
  - `.thumbnail-item.on-hover`：opacity 0.9
  - `.thumbnail-remove-btn`：absolute 定位、16×16px 尺寸
  - `.thumbnail-overflow-badge`：24×24px、flex-shrink 0、font-size 11px

**涉及文件**: `src/renderer/index.html`（样式区）

**依赖**: 无（可与任务 1、2 并行）

---

## 4. 集成到面板布局

- [ ] 在左侧面板 `panel-header` 区域（约行 375）的 `v-file-input` 后插入 `<chat-mcp-chat-thumbnail-strip>` 组件，绑定 `:attachments="messageStore.attachments"` 和 `@remove="messageStore.removeAttachment($event)"`
- [ ] 在右侧面板 `panel-header` 区域（约行 555）做相同修改
- [ ] 在根 app 的 `components` 注册中（约行 3789-3796）添加 `'chat-mcp-chat-thumbnail-strip': ChatThumbnailStrip` 和 `'chat-mcp-chat-thumbnail-item': ChatThumbnailItem`

**涉及文件**: `src/renderer/index.html`（HTML 布局区 + 组件注册区）

**依赖**: 任务 1、2、3

---

## 5. 验证与测试

- [ ] 验证空状态：无附件时缩略图条不占空间，附件按钮紧邻切换按钮
- [ ] 验证图片缩略图：添加 jpg/png/gif/webp 图片后，缩略图条在附件按钮右侧显示图片缩小预览
- [ ] 验证文档图标：添加 docx/pdf/xlsx 等文档后，缩略图条显示对应文件类型图标和颜色
- [ ] 验证添加顺序：依次添加多个附件，缩略图从左到右按添加顺序排列
- [ ] 验证悬浮交互：鼠标悬浮缩略图项时显示移除按钮和 tooltip（文件名+大小）
- [ ] 验证移除操作：点击移除按钮后附件从列表移除，缩略图项消失
- [ ] 验证溢出处理：添加多个附件超出可视区域时，出现水平滚动和 +N 数量指示
- [ ] 验证自动滚动：溢出状态下添加新附件，缩略图条自动滚动到最右侧
- [ ] 验证鼠标滚轮：在缩略图条上滚动鼠标滚轮可水平滚动
- [ ] 验证处理中状态：附件 status 为 processing 时显示加载动画
- [ ] 验证错误状态：附件 status 为 error 时显示错误图标，tooltip 显示错误原因
- [ ] 验证现有附件栏不受影响：`chat-mcp-chat-attachment-bar` 在 v-textarea prepend-inner 中仍正常工作
- [ ] 验证双面板一致性：左右面板的缩略图条功能一致