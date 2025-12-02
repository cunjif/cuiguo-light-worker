# 内部npm仓库模块

这个模块为Electron应用提供了一个内部npm仓库功能，用于在离线环境中管理依赖组件。

## 功能特性

- 解压包含.tgz文件的zip压缩包
- 启动本地npm仓库（基于Verdaccio）
- 将.tgz文件发布到本地npm仓库
- 提供完整的API接口供Electron应用调用

## 文件结构

```
src/lib/repo/
├── index.ts           # 主入口文件，提供InternalNpmRegistry类
├── publish_all.ts     # 发布.tgz文件到npm仓库的功能
├── extract_zip.ts     # 解压zip文件的功能
├── start_verdaccio.ts # 启动Verdaccio服务的功能
└── README.md          # 本文件
```

## 使用方法

### 基本用法

```typescript
import { npmRegistry, setupInternalNpmRegistry } from './src/lib/repo/index.js';

// 方法1：使用便捷函数
// 初始化仓库并处理依赖包zip文件
const success = await setupInternalNpmRegistry('/path/to/dependencies.zip');
if (success) {
    console.log('内部npm仓库设置成功');
}

// 方法2：使用类实例
// 1. 初始化仓库
await npmRegistry.initialize(4873);

// 2. 处理依赖包zip文件
await npmRegistry.processDependenciesZip('/path/to/dependencies.zip');

// 3. 获取仓库状态
const status = await npmRegistry.getStatus();
console.log('仓库状态:', status);

// 4. 配置npm使用内部仓库
await npmRegistry.configureNpm();

// 5. 关闭仓库（可选）
npmRegistry.shutdown();
```

### 在Electron主进程中使用

```typescript
// main.ts
import { npmRegistry } from './src/lib/repo/index.js';
import { ipcMain } from 'electron';

// 注册IPC处理程序
ipcMain.handle('setup-npm-registry', async (event, zipPath) => {
    try {
        const success = await npmRegistry.initialize();
        if (success && zipPath) {
            await npmRegistry.processDependenciesZip(zipPath);
        }
        return { success: true, status: await npmRegistry.getStatus() };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('get-registry-status', async () => {
    return await npmRegistry.getStatus();
});

ipcMain.handle('process-dependencies', async (event, zipPath) => {
    try {
        const success = await npmRegistry.processDependenciesZip(zipPath);
        return { success };
    } catch (error) {
        return { success: false, error: error.message };
    }
});
```

### 在渲染进程中使用

```javascript
// renderer.js
const { ipcRenderer } = require('electron');

// 设置npm仓库
async function setupRegistry(zipPath) {
    const result = await ipcRenderer.invoke('setup-npm-registry', zipPath);
    if (result.success) {
        console.log('npm仓库设置成功:', result.status);
    } else {
        console.error('npm仓库设置失败:', result.error);
    }
}

// 获取仓库状态
async function getRegistryStatus() {
    const status = await ipcRenderer.invoke('get-registry-status');
    console.log('仓库状态:', status);
}

// 处理依赖包
async function processDependencies(zipPath) {
    const result = await ipcRenderer.invoke('process-dependencies', zipPath);
    if (result.success) {
        console.log('依赖包处理成功');
    } else {
        console.error('依赖包处理失败:', result.error);
    }
}
```

## API参考

### InternalNpmRegistry类

#### 构造函数

```typescript
constructor(registryUrl: string = 'http://localhost:4873')
```

创建一个新的内部npm仓库实例。

#### 方法

##### initialize(port?: number): Promise<boolean>

初始化内部npm仓库，启动Verdaccio服务。

- `port`: 端口号，默认为4873
- 返回: 初始化是否成功

##### processDependenciesZip(zipPath: string): Promise<boolean>

处理包含.tgz文件的zip压缩包，解压并发布到本地仓库。

- `zipPath`: zip文件路径
- 返回: 处理是否成功

##### getStatus(): Promise<Object>

获取仓库状态信息。

- 返回: 包含url、running和initialized字段的对象

##### configureNpm(): Promise<boolean>

设置npm配置指向内部仓库。

- 返回: 设置是否成功

##### shutdown(): boolean

关闭内部npm仓库。

- 返回: 关闭是否成功

### 便捷函数

#### setupInternalNpmRegistry(zipPath?: string, port?: number): Promise<boolean>

一站式设置内部npm仓库。

- `zipPath`: 可选，依赖包zip文件路径
- `port`: 可选，端口号，默认为4873
- 返回: 设置是否成功

## 注意事项

1. 使用前需要确保系统已安装Node.js和npm
2. Verdaccio服务需要全局安装：`npm install -g verdaccio`
3. 解压zip文件需要系统支持（Windows使用PowerShell，Linux/Mac使用unzip）
4. 默认端口为4873，确保该端口未被占用
5. 临时文件存储在应用的用户数据目录中

## 错误处理

所有函数都包含错误处理，错误信息会输出到控制台。建议在使用时添加适当的错误处理逻辑。

## 示例项目结构

```
project/
├── src/
│   ├── main/
│   │   ├── main.ts
│   │   └── ...
│   ├── lib/
│   │   └── repo/
│   │       ├── index.ts
│   │       ├── publish_all.ts
│   │       ├── extract_zip.ts
│   │       └── start_verdaccio.ts
│   └── ...
├── package.json
└── ...
```