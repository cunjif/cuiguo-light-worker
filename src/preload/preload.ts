const { contextBridge, ipcRenderer } = require('electron');

type AsyncFunction = (...args: any[]) => Promise<any>;

interface MCPAPI {
  [key: string]: {
    tools?: {
      list?: AsyncFunction;
      call?: AsyncFunction;
    };
    prompts?: {
      list?: AsyncFunction;
      get?: AsyncFunction;
    };
    resources?: {
      list?: AsyncFunction;
      read?: AsyncFunction;
    };
  }
}

interface CLIENT {
  name: string;
  tools?: Record<string, string>;
  prompts?: Record<string, string>;
  resources?: Record<string, string>;
}


async function listClients(): Promise<CLIENT[]> {
  return await ipcRenderer.invoke('list-clients');
}

async function initializeMcpServer(serverName: string, serverConfig: any): Promise<any> {
  return await ipcRenderer.invoke('initialize-mcp-server', serverName, serverConfig);
}

async function deleteMcpServer(serverName: string): Promise<any> {
  return await ipcRenderer.invoke('delete-mcp-server', serverName);
}

async function exposeAPIs() {
  const clients = await listClients();
  const api: MCPAPI = {};

  const createAPIMethods = (methods: Record<string, string>) => {
    const result: Record<string, (...args: any) => Promise<any>> = {};
    Object.keys(methods).forEach(key => {
      const methodName = methods[key];
      result[key] = (...args: any) => ipcRenderer.invoke(methodName, ...args);
    });
    return result;
  };

  clients.forEach(client => {
    const { name, tools, prompts, resources } = client;
    api[name] = {};

    if (tools) {
      api[name]['tools'] = createAPIMethods(tools);
    }
    if (prompts) {
      api[name]['prompts'] = createAPIMethods(prompts);
    }
    if (resources) {
      api[name]['resources'] = createAPIMethods(resources);
    }
  });

  contextBridge.exposeInMainWorld('mcpServers', api);
}

async function updateMcpServersAPI(fullRebuild: boolean = true) {
  console.log('Updating MCP Servers API, fullRebuild:', fullRebuild);
  const clients = await listClients();
  const win = window as any;
  console.log(`Get mcp servers: ${win.mcpServers}`)
  if (!win.mcpServers || typeof win.mcpServers !== 'object') {
    win.mcpServers = {};
  }
  
  console.log('Clients from list-clients:', clients);
  
  // 创建API方法的辅助函数
  const createAPIMethods = (methods: Record<string, string>) => {
    const result: Record<string, (...args: any) => Promise<any>> = {};
    Object.keys(methods).forEach(key => {
      const methodName = methods[key];
      result[key] = (...args: any) => ipcRenderer.invoke(methodName, ...args);
    });
    return result;
  };

  // 如果是完整重建，先清空所有现有服务器
  if (fullRebuild) {
    const existingKeys = Object.keys(win.mcpServers || {});
    for (const key of existingKeys) {
      delete win.mcpServers[key];
    }
    console.log('Cleared all existing servers for full rebuild');
  }

  // 添加或更新服务器
  clients.forEach((client: any) => {
    const { name, tools, prompts, resources, type, url } = client;
    
    console.log(`Processing client ${name}:`, {
      type,
      has_tools: !!tools,
      has_url: !!url,
      tools_type: typeof tools,
      tools_value: tools,
      full_client: client
    });
    
    // 如果服务器已存在且不是完整重建，则跳过
    if (!fullRebuild && win.mcpServers[name]) {
      console.log(`Server ${name} already exists, skipping update`);
      return;
    }
    
    if (type === 'http' && url) {
      // For HTTP servers, create wrapper functions that make HTTP requests
      console.log(`Setting up HTTP server ${name}`);
      win.mcpServers[name] = {
        tools: {
          list: async () => {
            try {
              const response = await fetch(`${url}/tools/list`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
              });
              return await response.json();
            } catch (error) {
              console.error(`Error calling tools.list on ${name}:`, error);
              return { tools: [] };
            }
          },
          call: async (params: any) => {
            try {
              const response = await fetch(`${url}/tools/call`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(params)
              });
              return await response.json();
            } catch (error) {
              console.error(`Error calling tools.call on ${name}:`, error);
              throw error;
            }
          }
        }
      };
    } else if (tools && typeof tools === 'object') {
      // For local servers, use IPC methods
      console.log(`Setting up local server ${name} with tools:`, tools);
      if (!win.mcpServers[name]) {
        win.mcpServers[name] = {};
      }
      win.mcpServers[name]['tools'] = createAPIMethods(tools);
      console.log(`Tools setup for ${name} completed`);
    } else {
      console.warn(`No tools found for ${name}. tools=${tools}, type=${type}`);
    }

    if (prompts && type !== 'http' && typeof prompts === 'object') {
      console.log(`Setting up prompts for ${name}`);
      if (!win.mcpServers[name]) {
        win.mcpServers[name] = {};
      }
      win.mcpServers[name]['prompts'] = createAPIMethods(prompts);
    }

    if (resources && type !== 'http' && typeof resources === 'object') {
      console.log(`Setting up resources for ${name}`);
      if (!win.mcpServers[name]) {
        win.mcpServers[name] = {};
      }
      win.mcpServers[name]['resources'] = createAPIMethods(resources);
    }
  });
  
  console.log('MCP Servers API updated, window.mcpServers:', Object.keys(win.mcpServers), win.mcpServers);
}

// 全局变量，用于跟踪配置文件和服务器状态
let lastConfigHash: string = '';
let initializedServers: Set<string> = new Set();
let isInitializing: boolean = false;

// 计算配置文件的哈希值
function calculateConfigHash(config: any): string {
  // 简单的哈希函数，用于检测配置变化
  return JSON.stringify(config).split('').reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0);
    return a & a;
  }, 0).toString();
}

  // 获取服务器列表，仅初始化变动的服务器
async function getServers(): Promise<any> {
  const win = window as any;
  if (!win.mcpServers || typeof win.mcpServers !== 'object') {
    win.mcpServers = {};
  }

  // 避免并发初始化
  if (isInitializing) {
    console.log('getServers: Already initializing, skipping');
    return win.mcpServers;
  }

  try {
    isInitializing = true;
    console.log('getServers: Starting initialization');

    // 获取当前配置
    const currentConfig = await ipcRenderer.invoke('get-mcp-config');
    const currentConfigStr = JSON.stringify(currentConfig, null, 2);
    const currentConfigHash = calculateConfigHash(currentConfigStr);

    // 获取已初始化的服务器列表
    const existingClients = await listClients();
    const existingServerNames = existingClients.map(client => client.name);

    // 检测配置变化
    const configChanged = currentConfigHash !== lastConfigHash;
    
    if (!configChanged) {
      console.log('getServers: Config unchanged, returning existing servers');
      return win.mcpServers;
    }

    console.log('getServers: Config changed, detecting which servers need initialization');

    // 检测新增或配置变化的服务器
    const changedServers: string[] = [];
    const serverNames = Object.keys(currentConfig || {});

    for (const serverName of serverNames) {
      const existingClient = existingClients.find(client => client.name === serverName);
      const currentServerConfig = currentConfig[serverName];
      
      // 如果服务器不存在或者是新配置与之前不同
      if (!existingClient || JSON.stringify(existingClient) !== JSON.stringify(currentServerConfig)) {
        changedServers.push(serverName);
      }
    }

    // 检测已删除的服务器
    const deletedServers = existingServerNames.filter(name => !serverNames.includes(name));

    console.log(`getServers: ${changedServers.length} servers changed, ${deletedServers.length} servers deleted`);

    // 清理已删除的服务器
    if (deletedServers.length > 0) {
      console.log('getServers: Cleaning up deleted servers:', deletedServers);
      for (const serverName of deletedServers) {
        if (win.mcpServers[serverName]) {
          delete win.mcpServers[serverName];
        }
        initializedServers.delete(serverName);
      }
    }

    // 如果有变化的服务器，只初始化这些服务器
    if (changedServers.length > 0) {
      console.log('getServers: Initializing changed servers:', changedServers);
      
      // 保存当前配置作为备份
      localStorage.setItem('mcp_config_backup', currentConfigStr);
      
      // 初始化新服务器或更新现有服务器
      await ipcRenderer.invoke('initialize-mcp-clients', changedServers);
      
      // 只更新变化的服务器
      await updateMcpServersAPI(false);
      
      // 更新配置哈希
      lastConfigHash = currentConfigHash;
    } else {
      console.log('getServers: No servers need initialization, just updating hash');
      // 即使没有服务器需要初始化，也要更新哈希值
      lastConfigHash = currentConfigHash;
    }

    // 更新状态
    initializedServers = new Set(Object.keys(win.mcpServers));
    
    return win.mcpServers;
  } catch (error) {
    console.error('getServers: Error during initialization', error);
    
    // 尝试恢复之前的配置
    const backupConfig = localStorage.getItem('mcp_config_backup');
    if (backupConfig) {
      console.log('getServers: Attempting to restore from backup');
      try {
        const config = JSON.parse(backupConfig);
        await updateMcpServersAPI(true);
      } catch (backupError) {
        console.error('getServers: Failed to restore from backup', backupError);
      }
    }
    
    return win.mcpServers;
  } finally {
    isInitializing = false;
  }
}

contextBridge.exposeInMainWorld('initializeMcpServer', initializeMcpServer);
contextBridge.exposeInMainWorld('deleteMcpServer', deleteMcpServer);
contextBridge.exposeInMainWorld('updateMcpServersAPI', updateMcpServersAPI);
contextBridge.exposeInMainWorld('listClients', listClients);
contextBridge.exposeInMainWorld('getServers', getServers);
ipcRenderer.on('clients-updated', async () => { await updateMcpServersAPI(); });

// 暴露内部npm仓库管理器需要的API
contextBridge.exposeInMainWorld('registryAPI', {
  status: () => ipcRenderer.invoke('registry-status'),
  start: () => ipcRenderer.invoke('registry-start'),
  stop: () => ipcRenderer.invoke('registry-stop'),
  processDependencies: (fileData: { name: string, data: number[] }) => ipcRenderer.invoke('registry-process-dependencies', fileData),
  configureNpm: () => ipcRenderer.invoke('registry-configure-npm'),
  onRegistryProcessProgress: (callback: (progress: { percent: number, message: string }) => void) => {
    ipcRenderer.on('registry-process-progress', (event: Electron.IpcRendererEvent, progress: { percent: number, message: string }) => callback(progress));
  },
  removeRegistryProcessProgressListener: () => {
    ipcRenderer.removeAllListeners('registry-process-progress');
  }
});

exposeAPIs();