# MCP 开箱即用方案使用指南

## 概述

本方案实现了 MCP Server 的开箱即用打包发布，用户无需安装 Node.js 或手动配置即可使用内置的 MCP 服务。

## 架构设计

### 混合方案
1. **内置常用 MCP Server**: 将常用的 MCP server 作为 npm 依赖打包到 Electron 应用中
2. **内置 npm 仓库预装**: 首次启动时自动将内置 MCP server 发布到内置 Verdaccio 仓库
3. **动态安装支持**: 用户可通过 UI 安装新的 MCP server

### 目录结构

```
src/
├── mcp-builtin/                    # 内置 MCP 资源目录
│   ├── packages/                   # 预打包的 .tgz 文件
│   │   ├── playwright-mcp-0.0.10.tgz
│   │   └── ...
│   └── launcher/                   # 跨平台启动器
│       └── mcp-launcher.js
├── main/
│   ├── mcp-manager.ts              # MCP 管理器核心模块
│   └── main.ts                     # 已集成 MCP 初始化
└── lib/repo/
    └── internal_repo.ts            # 内置 npm 仓库
```

## 使用方式

### 1. 打包 MCP Server 依赖

在构建应用前，先打包 MCP server 依赖：

```bash
npm run pack:mcp
```

这会将以下包打包为 .tgz 文件到 `src/mcp-builtin/packages/`：
- playwright-mcp
- @modelcontextprotocol/server-filesystem
- aigroup-mdtoword-mcp
- bazi-mcp

### 2. 构建应用

使用以下命令构建包含 MCP 的应用：

```bash
npm run build:with-mcp
```

或分步执行：

```bash
npm run pack:mcp    # 打包 MCP 依赖
npm run build-app   # 构建 Electron 应用
```

### 3. 首次启动

应用首次启动时会自动：
1. 启动内置 Verdaccio npm 仓库 (端口 4873)
2. 将 `mcp-builtin/packages/` 中的 .tgz 文件发布到内置仓库
3. 将 MCP server 安装到用户数据目录 (`%APPDATA%/mcp-servers` 或 `~/.config/mcp-servers`)
4. 生成 `config.json` 使用本地 Node.js 路径

### 4. 后续启动

后续启动时：
- 跳过初始化（通过 `.initialized` 标记文件检测）
- 直接使用已安装的 MCP server
- 使用 `config.json` 中的配置启动

## 动态管理 MCP Server

### 通过 IPC 接口

渲染进程可通过以下 IPC 接口管理 MCP server：

```javascript
// 列出已安装的 MCP server
const installed = await window.electronAPI.invoke('mcp:list-installed');

// 安装新的 MCP server
const result = await window.electronAPI.invoke('mcp:install', 'some-mcp-package');

// 卸载 MCP server
const result = await window.electronAPI.invoke('mcp:uninstall', 'some-mcp-package');

// 获取 MCP server 安装目录
const dir = await window.electronAPI.invoke('mcp:get-servers-dir');

// 获取内置 MCP server 列表
const builtins = await window.electronAPI.invoke('mcp:get-builtin-servers');
```

## 配置说明

### 生成的 config.json 格式

```json
{
  "mcpServers": {
    "playwright": {
      "command": "/path/to/electron/node",
      "args": [
        "/path/to/user-data/mcp-servers/node_modules/playwright-mcp"
      ],
      "env": {
        "NODE_ENV": "production"
      }
    }
  }
}
```

### 优势

1. **不依赖系统 Node.js**: 使用 Electron 内置的 Node.js
2. **不依赖网络**: 首次安装后无需联网
3. **跨平台**: 支持 Windows/Linux/macOS
4. **可动态扩展**: 用户可自行安装新的 MCP server

## 添加新的内置 MCP Server

1. 在 `scripts/pack-mcp-servers.js` 中添加包名：

```javascript
const MCP_SERVERS = [
  'playwright-mcp@0.0.10',
  '@modelcontextprotocol/server-filesystem@latest',
  'aigroup-mdtoword-mcp@latest',
  'bazi-mcp@latest',
  'your-new-mcp@latest',  // 添加这里
];
```

2. 在 `src/main/mcp-manager.ts` 中添加定义：

```typescript
const BUILTIN_SERVERS: BuiltinMcpServer[] = [
  {
    name: 'your-new-mcp',
    package: 'your-new-mcp',
    args: ['--some-arg'],
    enabled: true,
  },
];
```

3. 重新打包并构建：

```bash
npm run build:with-mcp
```

## 故障排除

### MCP Server 初始化失败

1. 检查内置 Verdaccio 是否启动成功（端口 4873）
2. 查看用户数据目录下的日志
3. 删除 `.initialized` 标记文件可强制重新初始化

### 手动安装 MCP Server

如果自动安装失败，可手动安装：

```bash
cd %APPDATA%/mcp-servers  # Windows
cd ~/.config/mcp-servers  # Linux/macOS

npm install playwright-mcp --registry http://localhost:4873
```
