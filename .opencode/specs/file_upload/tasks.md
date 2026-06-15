# 文件附件上传功能 — 编码任务列表

## 1. 数据模型与 Store 扩展

- [ ] **1.1 扩展 messageStore state 字段**
  - 在 `src/renderer/index.html` ~行 3693 的 `state()` 中新增 `attachments: []` 和 `isProcessingFiles: false`
  - 保留现有 `images`/`base64`/`documentContent`/`documentType` 字段不变，确保向后兼容
  - 涉及文件：`src/renderer/index.html` ~行 3693-3703
  - 依赖：无
  - 验收：messageStore 初始化后 `attachments` 为空数组，`isProcessingFiles` 为 `false`

- [ ] **1.2 新增 messageStore getters**
  - 在 `src/renderer/index.html` messageStore 定义中新增 `getters` 块
  - 实现 `allAttachmentsReady`：检查所有附件 status === 'ready'
  - 实现 `totalEncodedSize`：计算附件编码后总大小（图片 base64 按 0.75 系数估算，文档按 Blob 大小）
  - 涉及文件：`src/renderer/index.html` messageStore 定义区域
  - 依赖：1.1
  - 验收：`allAttachmentsReady` 在所有附件 ready 时返回 true；`totalEncodedSize` 返回合理的字节数

- [ ] **1.3 修改 messageStore clear() 方法**
  - 在现有 `clear()` 方法（~行 3732）中追加 `this.attachments = []` 和 `this.isProcessingFiles = false`
  - 涉及文件：`src/renderer/index.html` ~行 3732
  - 依赖：1.1
  - 验收：调用 `clear()` 后 attachments 为空数组，isProcessingFiles 为 false

## 2. 文件校验工具（FileValidator）

- [ ] **2.1 实现 FileValidator 纯函数对象**
  - 在 `src/renderer/index.html` `<script>` 区域（messageStore 定义之前）新增 `FileValidator` 对象
  - 定义 `ACCEPTED_TYPES`：image（jpg/jpeg/png/gif/webp/bmp/svg）、document（doc/docx/ppt/pptx/xls/xlsx/txt/pdf/md/csv）
  - 定义 `BLOCKED_EXTENSIONS`：exe/bat/sh/cmd/ps1/com/vbs/js/wsf
  - 定义 `MAX_FILE_SIZE = 10 * 1024 * 1024`（10MB）
  - 定义 `MAX_ATTACHMENT_COUNT = 10`
  - 实现 `validate(file)` 方法：校验文件类型、大小、安全限制，返回 `{ valid, reason? }`
  - 实现 `isDuplicate(file, attachments)` 方法：检查同名同大小文件
  - 实现 `getCategory(file)` 方法：根据 MIME 类型返回 'image' 或 'document'
  - 涉及文件：`src/renderer/index.html` `<script>` 区域
  - 依赖：无
  - 验收：选择 .exe 文件返回 valid=false + 安全提示；选择 15MB 文件返回 valid=false + 大小提示；选择 .jpg 文件返回 valid=true

## 3. 图片处理工具（ImageProcessor）

- [ ] **3.1 实现 ImageProcessor 纯函数对象**
  - 在 `src/renderer/index.html` `<script>` 区域新增 `ImageProcessor` 对象
  - 定义 `MAX_WIDTH = 2048`、`MAX_HEIGHT = 2048`、`QUALITY = 0.8`、`MAX_COMPRESSED_SIZE = 1024 * 1024`
  - 实现 `compress(file)` 异步方法：使用 FileReader + Canvas 缩放压缩，返回 base64 Data URL
  - 实现 `generateThumbnail(file)` 异步方法：生成最大 200x200 的缩略图 Data URL
  - 压缩后超过 1MB 时降低 quality 重试；Canvas 绘制失败时抛出异常
  - 涉及文件：`src/renderer/index.html` `<script>` 区域
  - 依赖：无
  - 验收：2048x2048 的 PNG 图片压缩后 base64 长度显著减小；缩略图尺寸不超过 200x200

## 4. 文档处理工具（DocProcessor）

- [ ] **4.1 实现 DocProcessor 纯函数对象**
  - 在 `src/renderer/index.html` `<script>` 区域新增 `DocProcessor` 对象
  - 实现 `extractText(file)` 异步方法：
    - .docx 文件：使用 `mammoth.extractRawText({ arrayBuffer })` 提取文本
    - .txt/.md/.csv 文件：使用 `FileReader.readAsText()` 读取
    - 其他格式（.pdf/.ppt/.pptx/.xls/.xlsx 等）：返回文件名描述 `[Document: filename.ext]`
  - 实现 `getDocTypeName(extension)` 方法：返回文档类型显示名称（Word/Excel/PowerPoint/PDF/Text/Markdown/CSV）
  - 涉及文件：`src/renderer/index.html` `<script>` 区域
  - 依赖：无（mammoth.browser.js 已在行 72 引入）
  - 验收：.docx 文件能正确提取纯文本（非乱码）；.txt 文件读取内容正确；.pdf 返回文件名描述

## 5. messageStore 附件管理 Actions

- [ ] **5.1 实现 addAttachment() action**
  - 在 messageStore actions 中新增 `addAttachment(file)` 方法
  - 调用 `FileValidator.validate(file)` 校验，失败时通过 snackbarStore 显示错误
  - 检查 `attachments.length < MAX_ATTACHMENT_COUNT`，超限时提示
  - 调用 `FileValidator.isDuplicate()` 检查重复，重复时提示用户确认
  - 创建 Attachment 对象（id 使用 `crypto.randomUUID()`，status 初始为 'processing'）
  - push 到 `this.attachments`，设置 `this.isProcessingFiles = true`
  - 异步处理文件：图片调用 ImageProcessor.compress + generateThumbnail；文档调用 DocProcessor.extractText
  - 处理完成后更新对应字段，设置 status = 'ready'；处理失败设置 status = 'error' + errorMessage
  - 所有附件处理完成后设置 `this.isProcessingFiles = false`
  - 涉及文件：`src/renderer/index.html` messageStore actions 区域
  - 依赖：1.1, 2.1, 3.1, 4.1
  - 验收：添加 .jpg 文件后 attachments 有 1 项，status 从 processing 变为 ready，thumbnail 和 base64Data 有值；添加 .docx 文件后 textContent 有值

- [ ] **5.2 实现 removeAttachment() action**
  - 在 messageStore actions 中新增 `removeAttachment(id)` 方法
  - 从 `this.attachments` 中过滤掉 id 匹配的项
  - 更新 `this.isProcessingFiles` 状态
  - 涉及文件：`src/renderer/index.html` messageStore actions 区域
  - 依赖：1.1
  - 验收：移除指定附件后列表长度减 1，其余附件不变

- [ ] **5.3 实现 clearAttachments() action**
  - 在 messageStore actions 中新增 `clearAttachments()` 方法
  - 清空 `this.attachments` 数组，重置 `this.isProcessingFiles = false`
  - 同时清空 `this.images`（兼容旧逻辑）
  - 涉及文件：`src/renderer/index.html` messageStore actions 区域
  - 依赖：1.1
  - 验收：调用后 attachments 为空，images 为空

## 6. 多模态消息适配器（MultimodalAdapter）

- [ ] **6.1 实现 MultimodalAdapter 纯函数对象**
  - 在 `src/renderer/index.html` `<script>` 区域新增 `MultimodalAdapter` 对象
  - 实现 `buildContent(attachments, text, providerType)` 主方法：根据 providerType 分发到对应构建方法
  - 实现 `buildOpenAIContent(attachments, text)`：
    - 图片 → `{ type: "image_url", image_url: { url: base64Data } }`
    - 文档文本 + 用户文本 → `{ type: "text", text: "[DocType Document: filename]\n\ntextContent\n\nuserText" }`
    - 纯附件无文本时自动补充文件描述
  - 实现 `buildAnthropicContent(attachments, text)`：
    - 图片 → `{ type: "image", source: { type: "base64", media_type, data } }`（data 为纯 base64，不含 data: 前缀）
    - 文本项同 OpenAI 格式
  - 实现 `buildFallbackContent(attachments, text)`：
    - 图片转为文本描述 `[图片: filename.jpg]`
    - 文档内容正常嵌入
    - 返回纯文本字符串
  - 涉及文件：`src/renderer/index.html` `<script>` 区域
  - 依赖：无
  - 验收：1 张图片 + 1 个 docx + 文本 → OpenAI 格式 content 数组包含 image_url + text；Anthropic 格式包含 image + text；fallback 格式为纯文本

- [ ] **6.2 实现 Provider 类型判断逻辑**
  - 在 `buildContent()` 中根据 `chatbotStore.provider` 值判断使用哪种格式
  - `openai-compatible`/`glm`/`qwen`/`kimi`/`minimax`/`doubao-seed` → OpenAI 格式
  - `anthropic-compatible` → Anthropic 格式
  - 未知 Provider → fallback 格式
  - 涉及文件：`src/renderer/index.html` MultimodalAdapter 对象
  - 依赖：6.1
  - 验收：切换 Provider 后发送消息，content 格式正确对应

## 7. 修改 sendMessage() 方法

- [ ] **7.1 重构 sendMessage() 支持多附件**
  - 修改 `src/renderer/index.html` ~行 3778-3819 的 `sendMessage()` 方法
  - 新增判断：`hasAttachments = this.attachments.length > 0`
  - 检查 `this.isProcessingFiles`，为 true 时通过 snackbarStore 提示"文件处理中"
  - 检查 `this.totalEncodedSize > 20MB`，超限时提示"附件总大小超过限制"
  - 当 `hasAttachments` 为 true 时，调用 `this.buildMultimodalContent()` 构建消息
  - 当 `hasAttachments` 为 false 但有 `base64`/`documentContent` 时，走旧逻辑（向后兼容）
  - 发送成功后调用 `this.clearAttachments()` 清空附件
  - 涉及文件：`src/renderer/index.html` ~行 3778-3819
  - 依赖：1.1, 1.2, 5.1, 5.3, 6.1, 6.2
  - 验收：有附件时发送多模态消息；无附件时发送纯文本；旧的单文件上传仍可正常工作

- [ ] **7.2 实现 buildMultimodalContent() action**
  - 在 messageStore actions 中新增 `buildMultimodalContent(text)` 方法
  - 调用 `MultimodalAdapter.buildContent(this.attachments, text, chatbotStore.provider)`
  - 返回 content 数组或纯文本
  - 涉及文件：`src/renderer/index.html` messageStore actions 区域
  - 依赖：5.1, 6.1
  - 验收：返回的消息格式与 Provider 类型匹配

## 8. 修改 v-file-input 支持多文件

- [ ] **8.1 修改 v-file-input 组件属性**
  - ~~修改 `src/renderer/index.html` ~行 350-353 和 ~行 521-524 的两处 `v-file-input`~~
  - **实施变更**：经过评估，`v-file-input` 的 `@click.stop` + `hide-input` 组合会拦截内部 input 的 click 事件，导致文件选择对话框无法打开。因此放弃 v-file-input 方案，**改用自定义 v-btn + 隐藏原生 `<input type="file">` + @change** 事件的双面板实现（左右面板各一个独立 ref）。详见 §11.4。
  - 添加 `multiple` 属性，支持多文件选择
  - 扩展 `accept` 列表，增加 `.csv` 和 `.svg` 等缺失格式
  - 涉及文件：`src/renderer/index.html` `panel-header` 区域
  - 依赖：无
  - 验收：点击回形针图标能稳定打开系统文件选择器；左右面板可独立选择文件

- [ ] **8.2 ~~修改 watch(messageStore.images) watcher~~**（**已废弃**）
  - 废弃原因：v-file-input 方案已被替换为自定义按钮 + @change 事件，images 数组不再是选择入口。
  - 当前实现：`onFilePickerChange` 直接遍历 `e.target.files` 数组，对每个 File 调用 `messageStore.addAttachments([file])`；`addAttachments` 内部已包含校验、数量/重复检查、并返回 `{accepted, failures}`，调用方按需 snackbar。
  - 涉及文件：`src/renderer/index.html` setup 区域
  - 依赖：5.1
  - 验收：选择多个文件后，所有文件均尝试添加到 attachments 列表；失败原因（类型/大小/数量/重复）汇总为单条 snackbar 提示

## 9. 新增 UI 组件：ChatAttachmentItem

- [ ] **9.1 创建 ChatAttachmentItem 模板**
  - 在 `src/renderer/index.html` `<template>` 定义区域新增 `#chat-mcp-chat-attachment-item-template`
  - 图片附件：显示缩略图（`v-img`），点击触发 `@preview` 事件
  - 图片加载失败：显示 `mdi-image-broken-variant` 占位图标
  - 文档附件：显示文件类型图标（根据 MIME 类型映射）+ 文件名
  - 底部：文件名（截断显示）+ 移除按钮（`mdi-close`）
  - 处理中状态：底部 `v-progress-linear`（indeterminate）
  - 错误状态：右上角 `mdi-alert-circle` 红色图标
  - 涉及文件：`src/renderer/index.html` `<template>` 区域
  - 依赖：无
  - 验收：图片附件显示缩略图；文档附件显示对应图标；移除按钮可点击

- [ ] **9.2 注册 ChatAttachmentItem 组件**
  - 在 `src/renderer/index.html` `<script>` 区域定义 `ChatAttachmentItem` 组件对象
  - 包含 `template: '#chat-mcp-chat-attachment-item-template'`
  - 定义 props：`attachment`（Object）
  - 定义 emits：`remove`、`preview`
  - 实现 `getDocIcon(type)` 辅助方法：根据 MIME 类型返回 mdi 图标名
  - 实现 `getDocIconColor(type)` 辅助方法：返回图标颜色
  - 涉及文件：`src/renderer/index.html` `<script>` 区域
  - 依赖：9.1
  - 验收：组件可正常渲染，图标映射正确（PDF→mdi-file-pdf-box，Word→mdi-file-word-box 等）

## 10. 新增 UI 组件：ChatAttachmentBar

- [ ] **10.1 创建 ChatAttachmentBar 模板**
  - 在 `src/renderer/index.html` `<template>` 定义区域新增 `#chat-mcp-chat-attachment-bar-template`
  - 当 `attachments.length > 0` 时渲染，否则隐藏
  - 使用 `v-row` + `v-col` 横向排列 `ChatAttachmentItem` 组件
  - 底部右侧"清除全部"按钮（`mdi-close-circle-outline`）
  - 监听子组件 `@remove` 事件调用 `messageStore.removeAttachment(id)`
  - 监听子组件 `@preview` 事件触发大图预览
  - 涉及文件：`src/renderer/index.html` `<template>` 区域
  - 依赖：9.1, 9.2
  - 验收：添加附件后显示预览栏；点击移除按钮可删除单个附件；点击清除全部可清空

- [ ] **10.2 注册 ChatAttachmentBar 组件**
  - 在 `src/renderer/index.html` `<script>` 区域定义 `ChatAttachmentBar` 组件对象
  - 包含 `template: '#chat-mcp-chat-attachment-bar-template'`
  - 定义 props：`attachments`（Array）
  - 引用 `ChatAttachmentItem` 作为子组件
  - 实现 `previewAttachment(attachment)` 方法：图片类型时打开 TuuiImgDialog 大图预览
  - 涉及文件：`src/renderer/index.html` `<script>` 区域
  - 依赖：9.2, 10.1
  - 验收：组件可正常渲染附件列表，预览功能正常

- [ ] **10.3 在 app.components 中注册新组件**
  - 在 `src/renderer/index.html` ~行 3648-3653 的 `app.components` 中添加 `ChatAttachmentBar` 和 `ChatAttachmentItem`
  - 涉及文件：`src/renderer/index.html` ~行 3648-3653
  - 依赖：9.2, 10.2
  - 验收：新组件在模板中可正常使用，无控制台报错

## 11. 集成附件栏到输入区域

- [ ] **11.1 修改 v-textarea 的 prepend-inner slot**
  - 修改 `src/renderer/index.html` ~行 383-396 的 `v-textarea` prepend-inner slot
  - 在现有内容之前插入 `<chat-mcp-chat-attachment-bar :attachments="messageStore.attachments" />`
  - 涉及文件：`src/renderer/index.html` ~行 383-396
  - 依赖：10.2, 10.3
  - 验收：输入框上方显示附件预览栏；无附件时隐藏

- [ ] **11.2 对右侧面板输入区域做相同修改**
  - 修改 `src/renderer/index.html` 中右侧面板的 `v-textarea` prepend-inner slot（与左侧对称）
  - 插入相同的 `<chat-mcp-chat-attachment-bar>` 组件
  - 涉及文件：`src/renderer/index.html` 右侧面板 v-textarea 区域
  - 依赖：10.2, 10.3
  - 验收：右侧面板输入框上方同样显示附件预览栏

## 12. 拖拽上传功能

- [ ] **12.1 添加拖拽事件处理**
  - 在 `src/renderer/index.html` 输入区域外层容器（~行 362）添加 `@dragover.prevent`、`@dragleave.prevent`、`@drop.prevent` 事件
  - 在 `setup()` 中新增 `isDragging` ref
  - 实现 `onDragOver(e)` 方法：设置 `isDragging = true`
  - 实现 `onDragLeave(e)` 方法：设置 `isDragging = false`
  - 实现 `onDrop(e)` 方法：从 `e.dataTransfer.files` 遍历文件，调用 `messageStore.addAttachment(file)`
  - 对右侧面板输入区域做相同修改
  - 涉及文件：`src/renderer/index.html` ~行 362 及 setup() 区域
  - 依赖：5.1
  - 验收：拖拽文件到输入区域后文件添加到附件列表；拖拽离开时视觉反馈消失

- [ ] **12.2 添加拖拽视觉反馈**
  - 在输入区域容器上绑定 `:class="{ 'drag-over': isDragging }"`
  - 添加 `.drag-over` CSS 样式：`border: 2px dashed rgb(var(--v-theme-primary))` + 背景色变化 + `border-radius: 8px`
  - 涉及文件：`src/renderer/index.html` `<style>` 区域
  - 依赖：12.1
  - 验收：拖拽文件进入输入区域时边框高亮、背景变化；离开后恢复

## 13. 历史消息附件渲染

- [ ] **13.1 修改 TuuiChatBox 支持多附件渲染**
  - 修改 `src/renderer/index.html` ~行 1601-1608 的用户消息渲染区域
  - 当 `content` 为数组时，遍历渲染各内容项：
    - `type === 'image_url'`：使用 `TuuiImgDialog` 展示图片缩略图（可点击放大）
    - `type === 'image'`（Anthropic 格式）：构造 `data:${media_type};base64,${data}` URL，使用 `TuuiImgDialog` 展示
    - `type === 'text'`：使用现有文本渲染逻辑
  - 多个图片横向排列（flex wrap），文档附件以 `v-chip` 标签展示
  - 涉及文件：`src/renderer/index.html` ~行 1601-1608
  - 依赖：无
  - 验收：历史消息中的图片可点击放大；文档显示为标签；Anthropic 格式图片正常渲染

- [ ] **13.2 添加文档附件标签样式**
  - 在历史消息中为文档附件添加 `v-chip` 标签渲染
  - 显示文件类型图标 + 文件名，如 `[📄 report.docx]`
  - 涉及文件：`src/renderer/index.html` TuuiChatBox 模板区域
  - 依赖：13.1
  - 验收：历史消息中的文档附件以标签形式展示，包含图标和文件名

## 14. CSS 样式

- [ ] **14.1 添加附件相关 CSS 样式**
  - 在 `src/renderer/index.html` `<style>` 区域新增以下样式：
    - `.attachment-bar`：`max-height: 200px; overflow-x: auto; overflow-y: hidden;`
    - `.attachment-item`：`position: relative; border-radius: 8px; overflow: hidden; transition: box-shadow 0.2s;`
    - `.attachment-item:hover`：`box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);`
    - `.drag-over`：`border: 2px dashed rgb(var(--v-theme-primary)); background-color: rgba(var(--v-theme-primary), 0.05); border-radius: 8px;`
    - `.cursor-pointer`：`cursor: pointer;`
  - 涉及文件：`src/renderer/index.html` `<style>` 区域
  - 依赖：无
  - 验收：附件卡片有圆角和悬停阴影效果；拖拽高亮样式正确显示

## 15. 发送按钮状态控制

- [ ] **15.1 文件处理中禁用发送按钮**
  - 在发送按钮上绑定 `:disabled` 属性，条件包含 `messageStore.isProcessingFiles`
  - 处理中时显示 tooltip 提示"文件处理中"
  - 涉及文件：`src/renderer/index.html` 发送按钮区域
  - 依赖：1.1, 5.1
  - 验收：文件处理中时发送按钮禁用；处理完成后恢复可用

## 16. 集成测试与验证

- [ ] **16.1 附件添加全流程验证**
  - 验证：点击回形针选择单个图片 → 附件列表显示缩略图 → status 变为 ready
  - 验证：选择多个文件 → 所有文件均添加到列表
  - 验证：选择 .exe 文件 → 显示安全提示，文件不被添加
  - 验证：选择超过 10MB 文件 → 显示大小限制提示
  - 验证：附件数量达到 10 个后 → 显示数量上限提示
  - 验证：添加同名同大小文件 → 显示重复提示
  - 依赖：1-8, 14
  - 验收：所有场景均符合 spec.md 5.1 节的验收条件

- [ ] **16.2 附件预览与管理验证**
  - 验证：点击图片缩略图 → 弹出大图预览对话框
  - 验证：点击移除按钮 → 附件从列表移除
  - 验证：点击清除全部 → 所有附件清空
  - 验证：附件按添加顺序排列
  - 验证：缩略图生成失败时显示占位图标
  - 依赖：9, 10, 11, 14
  - 验收：所有场景均符合 spec.md 5.2 节的验收条件

- [ ] **16.3 附件消息发送验证**
  - 验证：1 张图片 + 文本 → 发送 OpenAI 格式 content 数组
  - 验证：1 个 docx + 文本 → 文档内容嵌入文本
  - 验证：1 张图片 + 1 个 docx + 文本 → 混合格式消息
  - 验证：仅附件无文本 → 消息正常发送
  - 验证：发送后附件列表清空
  - 验证：切换到 Anthropic Provider → 图片格式为 Anthropic 格式
  - 验证：文件处理中点击发送 → 按钮禁用
  - 验证：附件总大小超限 → 阻止发送并提示
  - 验证：发送失败 → 附件和文本保留
  - 依赖：6, 7, 15
  - 验收：所有场景均符合 spec.md 5.3 节的验收条件

- [ ] **16.4 历史消息附件展示验证**
  - 验证：历史消息中的图片以缩略图显示，点击可放大
  - 验证：历史消息中的文档以文件类型图标 + 文件名展示
  - 验证：多个附件横向排列展示
  - 验证：Anthropic 格式图片正常渲染
  - 验证：损坏的 base64 图片显示占位图标
  - 依赖：13
  - 验收：所有场景均符合 spec.md 5.4 节的验收条件

- [ ] **16.5 拖拽上传验证**
  - 验证：拖拽图片到输入区域 → 文件添加到附件列表
  - 验证：拖拽多个文件 → 所有文件添加
  - 验证：拖拽进入时边框高亮，离开时恢复
  - 依赖：12
  - 验收：拖拽上传功能正常，视觉反馈正确

- [ ] **16.6 向后兼容性验证**
  - 验证：旧的单文件上传路径仍可正常工作
  - 验证：已有的对话历史消息正常显示
  - 验证：旧消息中的单图片 content 数组格式正常渲染
  - 依赖：全部
  - 验收：现有功能不受影响，无回归问题