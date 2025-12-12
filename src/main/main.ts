// main.ts
import { app, BrowserWindow, ipcMain, Menu, MenuItem } from 'electron';
import {
  Client, McpServersConfig, HttpClient,
  ListToolsResultSchema, CallToolResultSchema,
  ListPromptsResultSchema, GetPromptResultSchema,
  ListResourcesResultSchema, ReadResourceResultSchema, ListResourceTemplatesResultSchema
} from './types.js';
import { initializeClient, manageRequests } from './client.js';

import notifier from 'node-notifier';

import { npmRegistry } from '../lib/repo/internal_repo.js';

import path from 'path';
import os from 'os';
import * as fs from 'node:fs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync, writeFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let appPath;

if (app.isPackaged) {
  // Electron Packaged
  appPath = path.dirname(process.execPath);
} else {
  // Dev - config.json is in dist/main/ (same directory as compiled main.js)
  appPath = __dirname;
}

const configPath = path.join(appPath, 'config.json');

console.log('Current Path:', appPath);
console.log('Config Path:', configPath);


const preloadPath = path.resolve(__dirname, '..', 'preload', 'preload.js');
const indexPath = path.resolve(__dirname, '..', 'renderer', 'index.html');

interface ClientObj {
  name: string;
  client: Client | HttpClient;
  capabilities: Record<string, any> | undefined;
}

function readConfig(configPath: string): McpServersConfig | null {
  try {
    const config = readFileSync(configPath, 'utf8');
    return JSON.parse(config);
  } catch (error) {
    console.error('Error reading config file:', error);
    return null;
  }
}

function saveConfig(configPath: string, config: McpServersConfig): boolean {
  try {
    writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
    console.log('Config saved successfully:', configPath);
    return true;
  } catch (error) {
    console.error('Error saving config file:', error);
    return false;
  }
}

function cleanServerConfig(config: any): any {
  // Remove internal fields that shouldn't be persisted to config.json
  const cleaned = { ...config };
  delete cleaned.type;  // Remove type field - it's only for internal use
  return cleaned;
}

async function initClient(): Promise<ClientObj[]> {
  const config = readConfig(configPath);
  if (config && config.mcpServers && Object.keys(config.mcpServers).length > 0) {
    console.log('Config loaded:', config);

    try {
      const results = await Promise.allSettled(
        Object.entries(config.mcpServers).map(([name, serverConfig]) => {
          console.log(`Initializing client for ${name} with config:`, serverConfig);

          const timeoutPromise = new Promise<Client | HttpClient>((resolve, reject) => {
            setTimeout(() => {
              reject(new Error(`Initialization of client for ${name} timed out after 30 seconds`));
            }, 30000);
          });

          return Promise.race([
            initializeClient(name, serverConfig),
            timeoutPromise,
          ])
            .then(client => {
              console.log(`${name} initialized.`);
              const capabilities = client.getServerCapabilities();
              return { name, client, capabilities } as ClientObj;
            })
            .catch(err => {
              console.error(`Client ${name} failed to initialize:`, err?.message);
              throw err;
            });
        })
      );

      const clients = results
        .filter(r => r.status === 'fulfilled')
        .map(r => (r as PromiseFulfilledResult<ClientObj>).value);

      const failed = results.filter(r => r.status === 'rejected').length;

      console.log('All clients attempted. Success:', clients.length, 'Failed:', failed);

      const localServers = clients.filter(c => c.client instanceof Client).length;
      const httpServers = clients.filter(c => c.client instanceof HttpClient).length;

      if (clients.length > 0) {
        notifier.notify({
          appID: 'CUIGUO',
          title: "MCP Servers are ready",
          message: `${localServers} local, ${httpServers} HTTP servers initialized${failed ? `, ${failed} failed` : ''}.`
        });
      } else {
        notifier.notify({
          appID: 'CUIGUO',
          title: 'Client initialization failed',
          message: 'All MCP server initializations failed.'
        });
      }

      return clients;
    } catch (error) {
      console.error('Error during client initialization:', error?.message);
      notifier.notify({
        appID: 'CUIGUO',
        title: 'Client initialization failed',
        message: "Cannot start with current config, " + error?.message,
      });
      return [];
    }
  } else {
    console.log('NO clients configured.');
    notifier.notify({
      appID: 'CUIGUO',
      title: 'NO clients configured',
      message: "NO MCP servers in config.json. You can add them dynamically through the UI.",
    });
    return [];
  }
}

async function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: preloadPath
    }
  });

  mainWindow.loadFile(indexPath);
  mainWindowRef = mainWindow;

  // 创建应用菜单
  const menu = Menu.buildFromTemplate([
    {
      label: '应用',
      submenu: [
        {
          label: '插件管理',
          click: () => {
            createRegistryWindow();
          }
        },
        { type: 'separator' },
        {
          label: '退出',
          click: () => {
            console.log('应用即将退出，正在停止内部npm仓库...');
            npmRegistry.shutdown().then(() => {
              console.log('✓ 内部npm仓库已停止');
              app.quit();
            });
          }
        }
      ]
    },
    {
      label: '视图',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    }
  ]);

  Menu.setApplicationMenu(menu);

  // You can uncomment the following line to enable DevTools permanently.
  // mainWindow.webContents.openDevTools();
}

// 创建 内部npm仓库管理器 窗口
async function createRegistryWindow() {
  const registryWindow = new BrowserWindow({
    width: 900,
    height: 700,
    title: '插件管理',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: preloadPath
    }
  });

  const registryManagerPath = path.resolve(__dirname, '..', 'renderer', 'registry-manager.html');
  registryWindow.loadFile(registryManagerPath);

  // 可选：打开开发者工具
  // registryWindow.webContents.openDevTools();
}

let features: any[] = [];
let mainWindowRef: BrowserWindow | null = null;

// Register IPC handlers for a MCP server
function registerIpcHandlers(
  name: string,
  client: Client | HttpClient,
  capabilities: Record<string, any> | undefined) {

  const feature: { [key: string]: any } = { name };

  const registerHandler = (method: string, schema: any) => {
    const eventName = `${name}-${method}`;
    console.log(`IPC Main ${eventName}`);
    try {
      ipcMain.removeHandler(eventName);
    } catch {}
    ipcMain.handle(eventName, async (event, params) => {
      return await manageRequests(client, `${method}`, schema, params);
    });
    return eventName;
  };

  const capabilitySchemas = {
    tools: {
      list: ListToolsResultSchema,
      call: CallToolResultSchema,
    },
    prompts: {
      list: ListPromptsResultSchema,
      get: GetPromptResultSchema,
    },
    resources: {
      list: ListResourcesResultSchema,
      read: ReadResourceResultSchema,
      'templates/list': ListResourceTemplatesResultSchema,
    },
  };

  // Register IPC handlers for all capability types regardless of capabilities
  // This ensures the feature object always has the methods, even if the server
  // reports empty capabilities initially
  for (const [type, actions] of Object.entries(capabilitySchemas)) {
    feature[type] = {};
    for (const [action, schema] of Object.entries(actions)) {
      feature[type][action] = registerHandler(`${type}/${action}`, schema);
    }
  }

  // Safely handle capabilities - ensure it's always an object
  const safeCapabilities = capabilities || {};
  console.log(`[DEBUG] registerIpcHandlers for ${name}: capabilities=${JSON.stringify(safeCapabilities)}, feature=${JSON.stringify(Object.keys(feature))}`);

  return feature;
}

async function bootstrapClientsFromConfig() {
  let clients: ClientObj[] = [];
  try {
    clients = await initClient();
  } catch (error) {
    console.error('Failed to initialize clients:', error?.message);
    clients = [];
  }

  features = clients.map(clientObj => {
    const feature = registerIpcHandlers(clientObj.name, clientObj.client, clientObj.capabilities);
    if (clientObj.client instanceof HttpClient) {
      feature.type = 'http';
      feature.url = (clientObj.client as HttpClient).getUrl();
    } else {
      feature.type = 'local';
    }
    return feature;
  });

  console.log('Features initialized:', features.length, features);
  BrowserWindow.getAllWindows().forEach(w => w.webContents.send('clients-updated'));
}

// 初始化特定的服务器
async function bootstrapSpecificClients(serverNames: string[]) {
  const config = readConfig(configPath);
  if (!config || !config.mcpServers) {
    console.error('No config or mcpServers found');
    return;
  }

  // 过滤出需要初始化的服务器
  const serversToInit = serverNames.filter(name => config.mcpServers[name]);
  if (serversToInit.length === 0) {
    console.log('No valid servers to initialize');
    return;
  }

  console.log(`Initializing ${serversToInit.length} specific servers: ${serversToInit.join(', ')}`);

  try {
    // 为每个服务器初始化客户端
    for (const serverName of serversToInit) {
      const serverConfig = config.mcpServers[serverName];
      
      // 检查服务器是否已经存在
      const existingIndex = features.findIndex(f => f.name === serverName);
      if (existingIndex !== -1) {
        console.log(`Server ${serverName} already exists, removing old instance`);
        features.splice(existingIndex, 1);
      }

      try {
        const timeoutPromise = new Promise<Client | HttpClient>((resolve, reject) => {
          setTimeout(() => {
            reject(new Error(`Initialization of client for ${serverName} timed out after 30 seconds`));
          }, 30000);
        });

        const client = await Promise.race([
          initializeClient(serverName, serverConfig),
          timeoutPromise,
        ]);

        console.log(`${serverName} initialized specifically.`);
        const capabilities = client.getServerCapabilities();

        // 注册IPC处理程序
        const feature = registerIpcHandlers(serverName, client, capabilities);
        
        if (client instanceof HttpClient) {
          feature.type = 'http';
          feature.url = (client as HttpClient).getUrl();
        } else {
          feature.type = 'local';
        }

        features.push(feature);
        console.log(`Server ${serverName} registered with IPC handlers`);
      } catch (error) {
        console.error(`Failed to initialize server ${serverName}:`, error?.message);
      }
    }

    console.log('Specific features updated:', features.length, features);
    BrowserWindow.getAllWindows().forEach(w => w.webContents.send('clients-updated'));
  } catch (error) {
    console.error('Error during specific client initialization:', error?.message);
  }
}

app.whenReady().then(async () => {

  // 启动内部npm仓库
  console.log('正在启动内部npm仓库...');
  const registryInitialized = await npmRegistry.initialize(4873);
  if (registryInitialized) {
    console.log('✓ 内部npm仓库启动成功');
    notifier.notify({
      appID: 'CUIGUO',
      title: '插件管理已启动',
      message: '私有 npm 仓库运行在 http://localhost:4873'
    });
  } else {
    console.error('✗ 内部npm仓库启动失败');
    notifier.notify({
      appID: 'AIQL',
      title: '内部npm仓库启动失败',
      message: '私有 npm 仓库无法启动'
    });
  }

  createWindow();

  bootstrapClientsFromConfig().catch(err => {
    console.error('Deferred MCP client initialization failed:', err?.message);
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });

  ipcMain.handle('list-clients', () => {
    return features;
  });

  // Handle getting MCP configuration
  ipcMain.handle('get-mcp-config', () => {
    const config = readConfig(configPath);
    return config ? config.mcpServers : {};
  });

  ipcMain.handle('initialize-mcp-clients', async (event, serverNames?: string[]) => {
    // 如果提供了服务器名称列表，则只初始化这些服务器
    if (serverNames && serverNames.length > 0) {
      console.log(`Initializing specific MCP servers: ${serverNames.join(', ')}`);
      await bootstrapSpecificClients(serverNames);
    } else {
      // 否则初始化所有服务器（默认行为）
      await bootstrapClientsFromConfig();
    }
    return features;
  });

  // Handle dynamic MCP server initialization
  ipcMain.handle('initialize-mcp-server', async (event, serverName, serverConfig) => {
    try {
      console.log(`Dynamically initializing MCP server: ${serverName}`, serverConfig);

      // Check if server already exists
      const existingServerIndex = features.findIndex(f => f.name === serverName);
      if (existingServerIndex !== -1) {
        console.log(`Server ${serverName} already exists, skipping initialization`);
        return { success: false, message: 'Server already exists' };
      }

      // Initialize both local and HTTP servers using the unified initializeClient function
      try {
        const timeoutPromise = new Promise<Client | HttpClient>((resolve, reject) => {
          setTimeout(() => {
            reject(new Error(`Initialization of client for ${serverName} timed out after 30 seconds`));
          }, 30000);
        });

        const client = await Promise.race([
          initializeClient(serverName, serverConfig),
          timeoutPromise,
        ]);

        console.log(`${serverName} initialized dynamically.`);
        const capabilities = client.getServerCapabilities();
        console.log(`[DEBUG] Capabilities for ${serverName}:`, capabilities);

        // Register IPC handlers for the new server
        const newServerFeature = registerIpcHandlers(serverName, client, capabilities);
        console.log(`[DEBUG] Feature object for ${serverName}:`, newServerFeature);

        // Add config information to feature based on client type
        if (client instanceof HttpClient) {
          newServerFeature.type = 'http';
          newServerFeature.url = (client as HttpClient).getUrl();
        } else {
          newServerFeature.type = 'local';
          newServerFeature.command = serverConfig.command;
          newServerFeature.args = serverConfig.args;
        }

        newServerFeature.config = serverConfig;

        features.push(newServerFeature);
        console.log(`[DEBUG] Features array now contains:`, features.map(f => ({ name: f.name, type: f.type, has_tools: !!f.tools })));

        console.log(`New server ${serverName} registered with IPC handlers`);
        BrowserWindow.getAllWindows().forEach(w => w.webContents.send('clients-updated'));

        // Save the server config (without the type field)
        const config = readConfig(configPath);
        if (config) {
          config.mcpServers[serverName] = cleanServerConfig(serverConfig);
          const saved = saveConfig(configPath, config);
          if (saved) {
            console.log(`Server ${serverName} configuration saved to config.json`);
          } else {
            console.warn(`Failed to save server ${serverName} configuration`);
          }
        }

        return {
          success: true,
          message: `Server ${serverName} initialized successfully`,
          feature: newServerFeature
        };
      } catch (error) {
        console.error(`Error initializing server ${serverName}:`, error?.message);
        return {
          success: false,
          message: `Failed to initialize server: ${error?.message}`
        };
      }
    } catch (error) {
      console.error(`Error initializing MCP server ${serverName}:`, error?.message);
      return {
        success: false,
        message: `Failed to initialize server: ${error?.message}`
      };
    }
  });

  // Handle MCP server deletion
  ipcMain.handle('delete-mcp-server', async (event, serverName) => {
    try {
      console.log(`Deleting MCP server: ${serverName}`);

      // Remove from features array
      const serverIndex = features.findIndex(f => f.name === serverName);
      if (serverIndex === -1) {
        console.log(`Server ${serverName} not found in features`);
        return { success: false, message: 'Server not found' };
      }

      features.splice(serverIndex, 1);

      // Remove from config file
      const config = readConfig(configPath);
      if (config && config.mcpServers[serverName]) {
        delete config.mcpServers[serverName];
        const saved = saveConfig(configPath, config);
        if (saved) {
          console.log(`Server ${serverName} removed from config.json`);
        } else {
          console.warn(`Failed to remove server ${serverName} from config.json`);
        }
      }

      BrowserWindow.getAllWindows().forEach(w => w.webContents.send('clients-updated'));
      return {
        success: true,
        message: `Server ${serverName} deleted successfully`
      };
    } catch (error) {
      console.error(`Error deleting MCP server ${serverName}:`, error?.message);
      return {
        success: false,
        message: `Failed to delete server: ${error?.message}`
      };
    }
  });

  // 内部npm仓库管理 IPC 接口
  ipcMain.handle('registry-status', async () => {
    return await npmRegistry.getStatus();
  });

  ipcMain.handle('registry-start', async () => {
    const result = await npmRegistry.initialize();
    return {
      success: result,
      message: result ? '内部npm仓库启动成功' : '内部npm仓库启动失败',
      url: result ? 'http://localhost:4873' : null
    };
  });

  ipcMain.handle('registry-stop', async () => {
    const result = await npmRegistry.shutdown();
    return {
      success: result,
      message: !!result ? '内部npm仓库已停止' : '内部npm仓库停止失败'
    };
  });

  // 处理依赖包zip文件
  ipcMain.handle('registry-process-dependencies', async (event, fileData) => {
    try {
      // 创建进度回调函数
      const progressCallback = (percent: number, message: string) => {
        // 发送进度更新到渲染进程
        event.sender.send('registry-process-progress', { percent, message });
      };

      // 如果传入的是字符串，则认为是文件路径
      if (typeof fileData === 'string') {
        const result = await npmRegistry.processDependenciesZip(fileData, progressCallback);
        return {
          success: result,
          message: result ? '依赖包处理成功' : '依赖包处理失败'
        };
      }

      // 如果传入的是对象，则包含文件名和数据
      if (typeof fileData === 'object' && fileData.name && fileData.data) {
        // 创建临时文件
        const tempDir = os.tmpdir();
        const tempFilePath = path.join(tempDir, fileData.name);

        // 将数据写入临时文件
        const buffer = Buffer.from(fileData.data);
        writeFileSync(tempFilePath, buffer);

        // 处理依赖包
        const result = await npmRegistry.processDependenciesZip(tempFilePath, progressCallback);

        // 清理临时文件
        try {
          fs.unlinkSync(tempFilePath);
        } catch (err) {
          console.warn('清理临时文件失败:', err.message);
        }

        return {
          success: result,
          message: result ? '依赖包处理成功' : '依赖包处理失败'
        };
      }

      return {
        success: false,
        message: '无效的文件数据'
      };
    } catch (error) {
      return {
        success: false,
        message: `依赖包处理失败: ${error.message}`
      };
    }
  });

  // 配置npm使用内部仓库
  ipcMain.handle('registry-configure-npm', async () => {
    try {
      const result = await npmRegistry.configureNpm();
      return {
        success: result,
        message: result ? 'npm配置成功' : 'npm配置失败'
      };
    } catch (error) {
      return {
        success: false,
        message: `npm配置失败: ${error.message}`
      };
    }
  });



  // Features are already initialized above, no need to re-register handlers
  console.log('Final features:', features);

});

app.on('window-all-closed', async () => {
  // 停止内部npm仓库
  console.log('正在停止内部npm仓库...');
  await npmRegistry.shutdown();
  console.log('✓ 内部npm仓库已停止');

  if (process.platform !== 'darwin') app.quit();
});

// 确保在应用退出前停止内部npm仓库
app.on('before-quit', async () => {
  // 停止内部npm仓库
  console.log('应用即将退出，正在停止内部npm仓库...');
  await npmRegistry.shutdown();
  console.log('✓ 内部npm仓库已停止');
});