# 编码任务规划：工作目录功能 + 导航侧边栏

> 来源 PRD：`docs/pr.md`（v1.0，2026-09-02）
> 技术栈：Electron 30 + Vue 3 (UMD/IIFE) + Vuetify + Pinia + better-sqlite3 + TypeScript（主进程）
> 任务编号对齐 PRD 的 T1–T19，按依赖关系细化为可执行子任务
> 开放问题已确认：Monaco 编辑器（代码/md/json/yaml 编辑，pptx/excel/pdf/docx 预览）、系统 git CLI（缺失则提示安装）、重名追加路径缩略、侧边栏折叠为图标条

---

## 任务依赖总览

```
T1(建表) ──┬─→ T2(CRUD IPC) ──→ T4(Store) ──→ T5(首次启动引导)
           └─→ T3(路径校验) ──→ T2
T4 ──→ T6(侧边栏组件) ──→ T7(tab 切换) ──→ T8(文件树) ──→ T9(文件编辑器) ──→ T10(对话面板 tab)
T8 ──→ T13(失效检测) ──→ T14(失效 UI)
T8 ──→ T15(git 检测) ──→ T16(git 操作)
T2 ──→ T11(MCP 重建) ──→ T12(loading 态)
T2 ──→ T17(拖拽接收) ──→ T18(拖拽创建)
T19(i18n) 与所有 UI 任务并行，最后统一补齐
T20(集成验证) 依赖以上全部
```

主进程模块统一放在新建目录 `src/main/workspaces/`；渲染进程为避免单文件膨胀，新增 `src/renderer/js/workspace-store.js`、`src/renderer/js/workspace-components.js`，并在 `index.html` 中按 `stores.js → workspace-store.js → components.js → workspace-components.js → app.js` 顺序加载。

---

## 阶段一：数据层与主进程

### T1 创建 workspaces 表与迁移

- [ ] **T1.1** 新建 workspace-store 模块并初始化 better-sqlite3 连接
  - 文件：`src/main/workspaces/workspace-store.ts`（新建）
  - 步骤：
    1. 参照 `src/main/skills/workflow-store.ts` 的写法，`import Database from 'better-sqlite3'`，db 路径 `path.join(os.homedir(), '.chat-mcp', 'workspaces.db')`，目录不存在则 `mkdirSync({recursive:true})`
    2. `db.pragma('journal_mode = WAL')`，单例 `getDb()` 导出
  - 依赖：无
  - 验收：模块可被 `main.ts` 导入，db 文件在 `~/.chat-mcp/workspaces.db` 创建

- [ ] **T1.2** 建 workspaces 表与幂等迁移
  - 文件：`src/main/workspaces/workspace-store.ts`
  - 步骤：
    1. `db.exec` 执行 `CREATE TABLE IF NOT EXISTS workspaces (id TEXT PRIMARY KEY, name TEXT NOT NULL, path TEXT NOT NULL UNIQUE, created_at INTEGER NOT NULL, last_active INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'active')`
    2. 增加 `CREATE INDEX IF NOT EXISTS idx_workspaces_last_active ON workspaces(last_active DESC)` 用于排序
    3. 导出 `WorkspaceRow` 类型（id/name/path/created_at/last_active/status）
  - 依赖：T1.1
  - 验收：重复启动不报错，表结构含全部 6 列 + 1 索引；`status` 默认 `'active'`

### T2 工作目录 CRUD IPC

- [ ] **T2.1** 实现 store 层 CRUD 函数
  - 文件：`src/main/workspaces/workspace-store.ts`
  - 步骤：
    1. `create(name, path)`：`randomUUID()` 生成 id，`Date.now()` 填 created_at/last_active，`INSERT`，返回新行；path 唯一冲突时抛明确错误
    2. `list()`：按 `last_active DESC` 返回全部
    3. `rename(id, name)`：仅改 name（允许重名），`UPDATE`
    4. `setActive(id)`：将该行 `last_active=Date.now()`、`status='active'`（仅当路径仍有效，有效性由 T3 判定，此处不校验）
    5. `getActive()`：返回 `last_active` 最大且 `status='active'` 的行
    6. `markInvalid(id)`：`UPDATE status='invalid'`
    7. `getById(id)`、`findByPath(path)`
  - 依赖：T1.2
  - 验收：各函数返回值/异常符合预期，path 重复插入抛 UNIQUE 错误并被调用方捕获

- [ ] **T2.2** 注册 IPC handler 并接入 main.ts
  - 文件：`src/main/main.ts`、`src/main/workspaces/workspace-store.ts`
  - 步骤：
    1. 在 `main.ts` 顶部 `import * as workspaceStore from './workspaces/workspace-store.js'`
    2. 注册 `ipcMain.handle('workspace:list', ...)`、`workspace:create`、`workspace:rename`、`workspace:set-active`、`workspace:get-active`、`workspace:mark-invalid`、`workspace:get-by-id`，命名风格对齐现有 `skills:workflow-*`
    3. create/setActive 内部先调用 T3 的 `validatePath`，校验失败时返回 `{ok:false, reason}` 而非抛异常
  - 依赖：T2.1、T3
  - 验收：渲染进程通过 preload 可调用全部接口；create/setActive 对非法路径返回 `ok:false`

- [ ] **T2.3** 在 preload 暴露 workspaceAPI
  - 文件：`src/preload/preload.ts`
  - 步骤：
    1. 参照 `workflowsAPI` 写法，`contextBridge.exposeInMainWorld('workspaceAPI', { list, create, rename, setActive, getActive, markInvalid, getById, validatePath, chooseDirectory })`
    2. `chooseDirectory` 映射到新 IPC `workspace:choose-directory`（主进程用 `dialog.showOpenDialog({properties:['openDirectory']})`）
    3. `validatePath` 映射到 `workspace:validate-path`
  - 依赖：T2.2
  - 验收：`window.workspaceAPI.*` 在渲染进程可用；`chooseDirectory` 弹出系统目录选择对话框

### T3 路径校验逻辑

- [ ] **T3.1** 实现平台分支路径校验
  - 文件：`src/main/workspaces/path-validator.ts`（新建）
  - 步骤：
    1. `export function validatePath(p: string): { ok: boolean; reason?: string }`
    2. Windows：解析 `%USERPROFILE%`，允许 `p` 在 USERPROFILE 之下（`path.relative` 不以 `..` 开头且不跨盘）或盘符非 `C:`；拒绝 C 盘下非 USERPROFILE 路径、系统目录（`Windows/System32/Program Files` 等）
    3. Linux/macOS：允许 `p` 在 `os.homedir()` 之下；拒绝 `~` 以外、`/etc /usr /var /root` 等系统目录
    4. 通用：`fs.existsSync(p)` 且 `fs.accessSync(p, fs.constants.R_OK | fs.constants.W_OK)` 不抛；不存在/无权限返回 `ok:false, reason`
    5. 路径标准化：`path.resolve(p)`，拒绝包含 `..` 越界的输入
  - 依赖：无
  - 验收：Windows 下 `C:\Users\xxx\proj` 通过、`C:\Windows` 拒绝；Linux 下 `/home/x/proj` 通过、`/etc` 拒绝；不存在路径返回明确 reason

- [ ] **T3.2** 注册校验 IPC
  - 文件：`src/main/main.ts`
  - 步骤：`ipcMain.handle('workspace:validate-path', (_e, p) => validatePath(p))`；`ipcMain.handle('workspace:choose-directory', async () => { const r = await dialog.showOpenDialog(mainWindow, {properties:['openDirectory']}); return r.canceled ? null : r.filePaths[0]; })`
  - 依赖：T3.1
  - 验收：渲染进程调用 `workspaceAPI.validatePath(p)` 返回 `{ok,reason}`；`chooseDirectory` 返回绝对路径或 null

---

## 阶段二：状态管理与首次启动

### T4 workspaceStore（Pinia）

- [ ] **T4.1** 新建 useWorkspaceStore
  - 文件：`src/renderer/js/workspace-store.js`（新建，UMD/IIFE 风格，复用 `stores.js` 顶部已声明的 `defineStore`）
  - 步骤：
    1. `useWorkspaceStore = defineStore('workspaceStore', { state, getters, actions })`
    2. state：`workspaces: []`、`activeId: null`、`active: null`（计算自 activeId）、`loading: false`、`switching: false`
    3. actions：`async load()`（`workspaceAPI.list()` 填 workspaces，从 localStorage 读 `workspace_active_id` 并匹配，无匹配则取 last_active 最大者）、`async create(name,path)`、`async rename(id,name)`、`async setActive(id)`（写 localStorage `workspace_active_id`，更新 active）、`async refreshActive()`
    4. getters：`activeWorkspace`（按 activeId 查找）、`invalidList`（status==='invalid'）
    5. activeId 持久化用 localStorage（手动，对齐项目 `write_approval` 风格，不引入 pinia-persist 插件以免影响现有 store）
  - 依赖：T2.3
  - 验收：`useWorkspaceStore().load()` 后 workspaces 与 db 一致；setActive 后 localStorage 更新且 active 指向新工作目录

- [ ] **T4.2** 在 index.html 加载 workspace-store.js
  - 文件：`src/renderer/index.html`
  - 步骤：在 `<script src="js/stores.js"></script>` 之后、`<script src="js/components.js"></script>` 之前插入 `<script src="js/workspace-store.js"></script>`
  - 依赖：T4.1
  - 验收：浏览器控制台无加载错误，`useWorkspaceStore` 全局可用

### T5 首次启动引导对话框

- [ ] **T5.1** 实现首次启动检测与默认值
  - 文件：`src/renderer/js/workspace-components.js`（新建）、`src/renderer/js/app.js`
  - 步骤：
    1. 在 `app.js` 的 `onMounted` 中调用 `workspaceStore.load()`，若 `workspaces.length === 0` 则设置 `showInitDialog = true`
    2. 默认路径：通过新 IPC `workspace:get-default-path`（主进程返回 `path.dirname(app.getAppPath())` 的父目录，对齐 AC-1）获取
  - 依赖：T4.1
  - 验收：清空 workspaces.db 后首次启动触发对话框；非首次不触发

- [ ] **T5.2** 实现 InitWorkspaceDialog 组件
  - 文件：`src/renderer/js/workspace-components.js`
  - 步骤：
    1. `defineComponent({ name:'InitWorkspaceDialog', template, setup })`，用 Vuetify `v-dialog`、`v-text-field`（只读显示路径）+ "浏览"按钮调用 `workspaceAPI.chooseDirectory()`
    2. 默认值来自 T5.1；确认按钮调用 `workspaceStore.create(defaultName, path)`，name 默认取 `path.basename(path)`
    3. 取消按钮：用默认路径静默创建（AC-1）
    4. 创建成功后 `setActive` 并关闭对话框
  - 依赖：T5.1、T4.1
  - 验收：确认/取消均创建并激活工作目录；路径校验失败时显示 reason 且不关闭

---

## 阶段三：导航侧边栏 UI

### T6 侧边栏组件

- [ ] **T6.1** 实现 WorkspaceSidebar 组件
  - 文件：`src/renderer/js/workspace-components.js`、`src/renderer/css/styles.css`
  - 步骤：
    1. `defineComponent({ name:'WorkspaceSidebar' })`，垂直窄栏，含两个 tab 按钮（iconify 图标：tab1=功能面板图标，tab2=文件夹图标）
    2. props：`collapsed`（布尔）、`side`（'left'|'right'，由 `settingStore.activePanel` 计算：activePanel==='chat' 时功能面板在右→side='right'，否则 'left'）
    3. 折叠态：宽度 48px 图标条（AC-6 + 开放问题4）；展开态宽度 56px 仍为图标条（点击 tab 切换视图，非展开为宽栏）
    4. emit `update:activeTab`（'function'|'workspace'）、`update:collapsed`
    5. CSS 类 `.workspace-sidebar`、`.workspace-sidebar--left/--right`，在 `styles.css` 新增
  - 依赖：T4.2
  - 验收：侧边栏随功能面板位置镜像；折叠态为图标条；两个 tab 按钮可点击

- [ ] **T6.2** 将侧边栏嵌入 function-panel
  - 文件：`src/renderer/index.html`、`src/renderer/css/styles.css`
  - 步骤：
    1. 在 `index.html` 两处 `<div class="function-panel">`（line 73、267）内部，根据 `settingStore.activePanel` 决定侧边栏在 panel 的最左还是最右（用 `v-if` + flex order 控制）
    2. function-panel 改为 `display:flex`，主内容区 `flex:1`，侧边栏固定宽度
    3. 在 `app.js` 的 template/data 注册 `<workspace-sidebar>` 组件
  - 依赖：T6.1
  - 验收：功能面板在右时侧边栏在最右；在左时在最左；不破坏现有功能面板内容布局

### T7 tab 切换逻辑

- [ ] **T7.1** 扩展 settingStore 增加 workspaceTab 状态
  - 文件：`src/renderer/js/stores.js`
  - 步骤：
    1. 在 `useSettingStore` state 增加 `functionTab: 'function'`（可选值 `'function'`|`'workspace'`，默认 `'function'`）与 `sidebarCollapsed: false`
    2. 增加 action `setFunctionTab(tab)`、`toggleSidebar()`
    3. 不改动现有 `activePanel`/`switchPanel` 语义（activePanel 仍控制 chat/function 大切换；functionTab 仅在 activePanel==='function' 时细分功能面板内容）
  - 依赖：T4.2
  - 验收：`functionTab` 切换不影响 activePanel；切到 chat 再切回 function 时 functionTab 保持

- [ ] **T7.2** 实现 tab 内容切换
  - 文件：`src/renderer/index.html`、`src/renderer/js/workspace-components.js`
  - 步骤：
    1. function-panel 主内容区用 `v-if="settingStore.functionTab === 'function'"` 包裹现有功能内容（MCP/Agent/Skill 等）
    2. `v-else` 渲染 `<workspace-explorer>`（T8 文件树组件）
    3. 侧边栏 tab 点击调用 `settingStore.setFunctionTab(...)`
  - 依赖：T7.1、T6.2、T8.1
  - 验收：tab1 显示原有功能面板内容；tab2 显示文件树；切换不丢失各自状态

---

## 阶段四：文件树与文件编辑

### T8 文件树组件

- [ ] **T8.1** 实现 WorkspaceExplorer 组件（标题 + 切换按钮 + 文件树）
  - 文件：`src/renderer/js/workspace-components.js`、`src/main/workspaces/file-service.ts`（新建）、`src/preload/preload.ts`、`src/main/main.ts`
  - 步骤：
    1. 主进程 `file-service.ts`：`listDir(dir)` 返回 `[{name, path, isDir, size, mtime}]`（用 `fs.readdirSync` + `fs.statSync`，跳过 `.git` 内部细节但保留 `.git` 项用于 T15）；`readFile(path)`、`writeFile(path, content)`（写入前校验 path 在当前 active workspace 之下，防越权）
    2. 注册 IPC `workspace:list-dir`、`workspace:read-file`、`workspace:write-file`，preload 暴露于 `workspaceAPI`
    3. 组件：顶部标题栏显示 `activeWorkspace.name` + 路径缩略 + "切换工作目录"按钮（调用 T9.1 的切换流程）；下方 `v-treeview` 或自绘树，懒加载子目录
    4. 重名工作目录在列表/标题追加路径缩略（取首尾各 1 段 + `…`，开放问题3）
  - 依赖：T4.1、T2.3
  - 验收：树正确展示工作目录内容；点击目录展开；"切换工作目录"按钮可点

- [ ] **T8.2** 实现切换工作目录流程
  - 文件：`src/renderer/js/workspace-store.js`、`src/renderer/js/workspace-components.js`
  - 步骤：
    1. `useWorkspaceStore.switchTo(path)`：先 `validatePath`，失败提示 reason 并中止；成功则置 `switching=true`，等待在途 LLM 流式/MCP 调用完成（通过 `chatStore.isStreaming` / `mcpStore` 调用计数，T11 提供 `awaitDrain()`），再 `create` 或 `setActive`，再触发 T11 重建 filesystem MCP，最后 `switching=false` 并刷新文件树
    2. "切换工作目录"按钮调用 `chooseDirectory` → `switchTo`
    3. 切换全程 `switching=true` 时 UI 显示 loading 遮罩（T12）
  - 依赖：T8.1、T11.1、T12.1
  - 验收：切换后文件树刷新为新工作目录；流式生成中切换会等待完成；校验失败不切换

### T9 文件编辑器

- [ ] **T9.1** 引入 Monaco 编辑器资源
  - 文件：`src/renderer/lib/monaco/`（新建，放入 `monaco-editor` 包的 `min/vs` 目录）、`src/renderer/index.html`、`package.json`
  - 步骤：
    1. `npm i -D monaco-editor`，将 `node_modules/monaco-editor/min/vs` 拷贝/软链到 `src/renderer/lib/monaco/vs`（构建脚本同步处理）
    2. `index.html` 在 app 脚本之前加载 `<script src="lib/monaco/vs/loader.js"></script>`，并设置 `window.require.config({ paths: { vs: 'lib/monaco/vs' } })`
    3. 用 `window.require(['vs/editor/editor.main'], cb)` 懒加载，避免首屏负担
  - 依赖：无
  - 验收：控制台无加载错误；`monaco.editor.create` 可用

- [ ] **T9.2** 实现 FileEditor 组件（Monaco + 预览）
  - 文件：`src/renderer/js/workspace-components.js`、`src/renderer/css/styles.css`
  - 步骤：
    1. `defineComponent({ name:'FileEditor' })`，props `filePath`；挂载时 `workspaceAPI.readFile(filePath)` 取内容
    2. 按扩展名分流：代码/md/json/yaml/yml/js/ts/py/html/css → Monaco（按扩展名 `monaco.languages.getLanguages` 映射 model language）；md 用现有 `md-editor-v3` 预览
    3. pptx/xlsx → 调用 markitdown MCP（`window.mcpServers.markitdown.tools.call`）转 markdown 后用 md-editor 预览；pdf → 复用现有 `pdf.min.js`；docx → 复用 `mammoth.browser.js`
    4. 顶部工具栏：保存按钮（调用 `workspaceAPI.writeFile`，写入前检查 `localStorage.getItem('write_approval')==='true'`，未开启则弹确认对话框，对齐 `stores.js` line 3345 的现有 write_approval 逻辑）、关闭按钮
    5. Monaco 容器 div 高度撑满，CSS `.file-editor-monaco`
  - 依赖：T9.1、T8.1
  - 验收：代码文件可编辑可保存；md/pdf/docx/pptx/xlsx 可预览；write_approval=false 时保存弹确认

### T10 对话面板 tab 机制

- [ ] **T10.1** 实现对话面板 tab 内容页
  - 文件：`src/renderer/index.html`、`src/renderer/js/stores.js`、`src/renderer/js/workspace-components.js`
  - 步骤：
    1. `useSettingStore` 增加 `chatTabs: [{id, type:'chat'|'file', fileId?, title}]`、`activeChatTabId`；初始一个 `{type:'chat'}` tab
    2. 在对话面板区域（`index.html` 中 chat 内容容器）用 `v-tabs`/自绘 tab 条，`v-window` 切换：type==='chat' 渲染现有聊天组件，type==='file' 渲染 `<file-editor :file-path="tab.fileId">`
    3. 文件树点击文件 → `chatStore.openFileTab(filePath)` 新增/激活 file tab（AC-7：聊天内容不丢失，切回 chat tab 恢复）
    4. 关闭 file tab 不影响 chat tab 状态
  - 依赖：T9.2、T8.1
  - 验收：点击文件后对话面板切到编辑页；切回 chat tab 聊天历史与输入状态保留；多个文件可多 tab 共存

---

## 阶段五：MCP 联动与并发处理

### T11 filesystem MCP 重建

- [ ] **T11.1** 实现按工作目录重建 filesystem server
  - 文件：`src/main/mcp-manager.ts`、`src/main/main.ts`、`src/main/workspaces/workspace-store.ts`
  - 步骤：
    1. 在 `mcp-manager.ts` 导出 `rebuildFilesystemServer(rootPath: string)`：找到 `BUILTIN_SERVERS` 中 `name==='filesystem'` 项，更新其 `args=[rootPath]`（替换现有 `['./','C:\\','/','*/**']`），终止旧 server 子进程（若有句柄），重新 `initializeMcpServers(['filesystem'])`
    2. 在 `main.ts` 注册 `ipcMain.handle('workspace:rebuild-filesystem', (_e, rootPath) => rebuildFilesystemServer(rootPath))`，preload 暴露 `workspaceAPI.rebuildFilesystem`
    3. 提供 `awaitDrain()`：等待在途 LLM 流式与 MCP 工具调用完成（通过 `client.ts` 的 `manageRequests` 计数或新增全局 `pendingCalls` 计数器，归零后 resolve；带 30s 超时保护）
  - 依赖：T2.2
  - 验收：切换工作目录后 filesystem MCP 的可访问根目录变更（用 `list_directory` 验证）；在途调用完成后再重建

- [ ] **T11.2** 接入切换流程
  - 文件：`src/renderer/js/workspace-store.js`
  - 步骤：`switchTo`（T8.2）中 `await workspaceAPI.awaitDrain()` → `await workspaceAPI.rebuildFilesystem(newPath)` → `await mcpStore.updateServers()`（刷新渲染进程 MCP 工具列表）
  - 依赖：T11.1、T8.2
  - 验收：切换后 MCP 工具列表刷新；filesystem 工具调用作用于新根目录

### T12 切换 loading 态

- [ ] **T12.1** 实现 loading UI 与重复触发保护
  - 文件：`src/renderer/js/workspace-components.js`、`src/renderer/css/styles.css`
  - 步骤：
    1. `WorkspaceExplorer` 顶部覆盖 `v-overlay` 绑定 `workspaceStore.switching`，显示 `v-progress-circular` + 文案
    2. `switchTo` 入口若 `switching===true` 直接 return（禁止重复触发）
    3. CSS `.workspace-switching-overlay`
  - 依赖：T8.2
  - 验收：切换期间显示 loading；连续点击只触发一次；切换完成 loading 消失

---

## 阶段六：路径失效处理

### T13 路径失效检测

- [ ] **T13.1** 激活时与启动时检测路径可用性
  - 文件：`src/main/workspaces/workspace-store.ts`、`src/main/workspaces/path-validator.ts`、`src/main/main.ts`
  - 步骤：
    1. `setActive(id)` 内部调用 `validatePath(row.path)`，若 `ok:false` 则 `markInvalid(id)` 并返回失败信号
    2. 启动时（`main.ts` app.whenReady）遍历所有 `status='active'` 的工作目录，对每个跑 `validatePath`，不可用则 `markInvalid`
    3. 渲染进程 `workspaceStore.load()` 后自动尝试 `getActive`，若 active 为 invalid 则触发 T14 引导
  - 依赖：T3.1、T2.1
  - 验收：删除工作目录路径后重启，该工作目录 status 变 invalid；激活 invalid 工作目录被拒绝

### T14 失效 UI 与恢复引导

- [ ] **T14.1** 失效标记与恢复对话框
  - 文件：`src/renderer/js/workspace-components.js`、`src/renderer/css/styles.css`
  - 步骤：
    1. 工作目录列表项（在 WorkspaceExplorer 顶部下拉或侧边栏列表）对 `status==='invalid'` 项灰显 + "失效"标签（CSS `.workspace-item--invalid` opacity .5）
    2. 点击失效项弹 `v-dialog`：提示路径不可用，提供"重新选择路径"（`chooseDirectory` → `workspaceAPI.updatePath(id, newPath)`，需新增 IPC `workspace:update-path` 校验后更新 path 与 status='active'）与"取消"
  - 依赖：T13.1、T8.1
  - 验收：失效项灰显带标记；点击弹恢复对话框；重新选择有效路径后恢复 active

---

## 阶段七：Git 集成

### T15 Git 状态检测

- [ ] **T15.1** 检测 git CLI 与 .git 存在性
  - 文件：`src/main/workspaces/git-service.ts`（新建）、`src/main/main.ts`、`src/preload/preload.ts`
  - 步骤：
    1. `git-service.ts`：`checkGitInstalled()` 用 `child_process.execFile('git', ['--version'])` 包装为 Promise，超时 5s
    2. `hasGitRepo(dir)`：`fs.existsSync(path.join(dir, '.git'))`
    3. 注册 IPC `workspace:git-check`（返回 `{installed, hasRepo}`），preload 暴露 `workspaceAPI.gitCheck`
    4. 渲染进程在 WorkspaceExplorer 挂载时调用，`installed=false` 则在 Git 入口处显示"未检测到系统 git，请安装"提示（开放问题2）
  - 依赖：T8.1
  - 验收：无 git 时提示安装；无 .git 时隐藏 Git 入口；有 .git 时显示

### T16 Git 操作 UI 与逻辑

- [ ] **T16.1** 实现 git stage/unstage/commit/diff
  - 文件：`src/main/workspaces/git-service.ts`、`src/main/main.ts`、`src/preload/preload.ts`、`src/renderer/js/workspace-components.js`
  - 步骤：
    1. `git-service.ts`：`status(dir)`→`git status --porcelain=v1 -z`、`stage(dir, files)`→`git add`、`unstage`→`git reset`、`commit(dir, msg)`→`git commit -m`、`diff(dir, file?)`→`git diff --patch`；统一 `execFile` + cwd=dir，捕获 stderr 返回结构化结果
    2. 注册 IPC `workspace:git-status/stage/unstage/commit/diff`，preload 暴露 `workspaceAPI.git.*`
    3. 组件 `GitPanel`：在 WorkspaceExplorer 工具栏右侧（仅 hasRepo 时显示）打开抽屉/对话框，展示变更列表（已暂存/未暂存），行内 stage/unstage 按钮，底部 commit 输入 + 提交，diff 用 Monaco diff editor 或 `<pre>` 展示
  - 依赖：T15.1、T9.1
  - 验收：可 stage/unstage/commit；diff 正确展示；commit 无 message 时禁用提交

---

## 阶段八：拖拽创建

### T17 窗口拖拽接收

- [ ] **T17.1** 启用窗口文件拖拽并获取文件夹路径
  - 文件：`src/main/main.ts`、`src/renderer/index.html`、`src/renderer/js/app.js`
  - 步骤：
    1. 主进程 `mainWindow.webContents` 无需特殊配置（Electron 30 默认允许拖入），但需阻止默认导航：`mainWindow.webContents.on('will-navigate', e => e.preventDefault())`
    2. 渲染进程在 `app.js` `onMounted` 给 `document` 监听 `dragover`（`e.preventDefault()`）与 `drop`：遍历 `e.dataTransfer.files`，用 Electron 30 的 `window.electronAPI` 或 `webUtils.getPathForFile(file)` 获取绝对路径（在 preload 暴露 `webUtils` 或新增 IPC）
    3. 仅取 `file.isDirectory`/路径是目录的项（渲染进程可用 `e.dataTransfer.items[i].webkitGetAsEntry().isDirectory` 判断）
  - 依赖：无
  - 验收：拖入文件夹时控制台拿到绝对路径；拖入文件被忽略；不触发浏览器默认打开

### T18 拖拽创建工作目录

- [ ] **T18.1** 拖拽 → 校验 → 创建 → 激活
  - 文件：`src/renderer/js/app.js`、`src/renderer/js/workspace-store.js`
  - 步骤：
    1. drop 拿到目录路径后调用 `workspaceStore.switchTo(path)`（复用 T8.2，含校验/重建/刷新）；若 path 已存在工作目录记录则直接 `setActive`
    2. 校验失败时用 Vuetify `v-snackbar` 显示 reason（不创建）
  - 依赖：T17.1、T8.2
  - 验收：拖入合法文件夹后立即切换为该工作目录；拖入非法路径提示原因且不切换

---

## 阶段九：i18n

### T19 新增文案中英双语

- [ ] **T19.1** 汇总并写入 i18n 资源
  - 文件：`src/renderer/js/i18n.js`
  - 步骤：
    1. 在 `messages.en` 与 `messages.zhHans` 各自新增 `workspace` 命名空间，覆盖全部新增文案：首次启动对话框标题/说明/确认/取消、切换工作目录按钮、切换中 loading、路径校验失败各 reason、失效标记/恢复对话框、重命名、文件树空态、保存/未开启 write_approval 确认、Git 面板各按钮/未安装提示、拖拽提示、tab1/tab2 title
    2. 所有组件模板用 `$t('workspace.xxx')` 引用，不硬编码文案
  - 依赖：与各 UI 任务并行，最后统一补齐
  - 验收：切换中/英语言，所有新增 UI 文案正确切换；无硬编码中文/英文残留

---

## 阶段十：集成验证

### T20 集成与回归验证

- [ ] **T20.1** 端到端路径验证
  - 步骤：手动跑通：首次启动引导 → 切换工作目录 → 文件树浏览 → 点击文件编辑保存 → tab 切换不丢聊天 → Git stage/commit/diff → 拖拽创建 → 失效恢复 → 折叠侧边栏 → 中英切换
  - 依赖：T1–T19 全部
  - 验收：AC-1 ~ AC-11 全部满足

- [ ] **T20.2** 数据隔离回归
  - 步骤：切换工作目录后确认会话历史、附件、MCP 列表与启用状态、API Key/模型、技能/工作流、语言、write_approval、面板列宽均不变
  - 依赖：T20.1
  - 验收：AC-11 满足，无现有功能回归

- [ ] **T20.3** 构建与打包验证
  - 步骤：`npm run build`（或现有 `build-win.ps1`）通过；打包后启动验证 workspaces.db 在 `~/.chat-mcp/` 创建、Monaco 资源随包、filesystem MCP 根目录正确
  - 依赖：T20.1
  - 验收：打包产物可正常使用全部新功能

- [ ] **T20.4** 代码审查与设计核对
  - 步骤：核对实现与 PRD/本 tasks.md 一致；检查 IPC 命名、preload 暴露面、SQL 注入风险（均用参数化）、路径越权写入防护
  - 依赖：T20.1
  - 验收：无越权写入、无 SQL 拼接、preload 暴露面最小化