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

let onClientsUpdatedCallback: (() => void) | null = null;

contextBridge.exposeInMainWorld('initializeMcpServer', initializeMcpServer);
contextBridge.exposeInMainWorld('deleteMcpServer', deleteMcpServer);
contextBridge.exposeInMainWorld('updateMcpServersAPI', updateMcpServersAPI);
contextBridge.exposeInMainWorld('listClients', listClients);
contextBridge.exposeInMainWorld('getServers', getServers);
contextBridge.exposeInMainWorld('onMcpClientsUpdated', {
  register: (callback: () => void) => { onClientsUpdatedCallback = callback; },
  unregister: () => { onClientsUpdatedCallback = null; }
});
ipcRenderer.on('clients-updated', async () => {
  await updateMcpServersAPI();
  if (onClientsUpdatedCallback) {
    onClientsUpdatedCallback();
  }
});

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

contextBridge.exposeInMainWorld('skillsAPI', {
  listRegistry: () => ipcRenderer.invoke('skills:list-registry'),
  install: (name: string, currentInstalled: any[]) => ipcRenderer.invoke('skills:install', name, currentInstalled),
  uninstall: (name: string, currentInstalled: any[]) => ipcRenderer.invoke('skills:uninstall', name, currentInstalled),
  toggle: (name: string, enabled: boolean, currentInstalled: any[]) => ipcRenderer.invoke('skills:toggle', name, enabled, currentInstalled),
  updateConfig: (name: string, config: any, currentInstalled: any[]) => ipcRenderer.invoke('skills:update-config', name, config, currentInstalled),
  match: (input: string, currentInstalled: any[]) => ipcRenderer.invoke('skills:match', input, currentInstalled),
  getManifest: (name: string) => ipcRenderer.invoke('skills:get-manifest', name),
  getSystemPrompt: (name: string, currentInstalled: any[]) => ipcRenderer.invoke('skills:get-system-prompt', name, currentInstalled),
  recordUsage: (name: string, currentInstalled: any[]) => ipcRenderer.invoke('skills:record-usage', name, currentInstalled),
  importSkill: (manifestJson: string) => ipcRenderer.invoke('skills:import', manifestJson),
  exportSkill: (name: string) => ipcRenderer.invoke('skills:export', name),
  importPack: (fileData: { name: string, data: number[] }) => ipcRenderer.invoke('skills:import-pack-from-data', fileData),
  exportPack: (skillNames: string[]) => ipcRenderer.invoke('skills:export-pack', skillNames),
  readFileForExport: (filePath: string) => ipcRenderer.invoke('skills:read-file-for-export', filePath),
});

// Workflow 编排方案管理 API
contextBridge.exposeInMainWorld('workflowsAPI', {
  list: () => ipcRenderer.invoke('skills:workflow-list'),
  get: (id: string) => ipcRenderer.invoke('skills:workflow-get', id),
  create: (name: string, steps: any[]) => ipcRenderer.invoke('skills:workflow-create', name, steps),
  rename: (id: string, name: string) => ipcRenderer.invoke('skills:workflow-rename', id, name),
  save: (id: string, steps: any[]) => ipcRenderer.invoke('skills:workflow-save', id, steps),
  delete: (id: string) => ipcRenderer.invoke('skills:workflow-delete', id),
  countSkillRefs: (skillName: string) => ipcRenderer.invoke('skills:workflow-count-skill-refs', skillName),
  export: (id: string) => ipcRenderer.invoke('skills:workflow-export', id),
  import: (payload: { name: string; steps: any[] }) => ipcRenderer.invoke('skills:workflow-import', payload),
  versions: (workflowId: string) => ipcRenderer.invoke('skills:workflow-versions', workflowId),
  rollback: (workflowId: string, versionId: number) => ipcRenderer.invoke('skills:workflow-rollback', workflowId, versionId),
  run: (workflowId: string, currentInstalled: any[]) => ipcRenderer.invoke('skills:workflow-run', workflowId, currentInstalled),
  checkCycle: (rootWorkflowId: string, refWorkflowId: string) => ipcRenderer.invoke('skills:workflow-check-cycle', rootWorkflowId, refWorkflowId),
});

// Workspace 工作目录管理 API
contextBridge.exposeInMainWorld('workspaceAPI', {
  list: () => ipcRenderer.invoke('workspace:list'),
  getById: (id: string) => ipcRenderer.invoke('workspace:get-by-id', id),
  create: (name: string, path: string) => ipcRenderer.invoke('workspace:create', name, path),
  rename: (id: string, name: string) => ipcRenderer.invoke('workspace:rename', id, name),
  setActive: (id: string) => ipcRenderer.invoke('workspace:set-active', id),
  getActive: () => ipcRenderer.invoke('workspace:get-active'),
  markInvalid: (id: string) => ipcRenderer.invoke('workspace:mark-invalid', id),
  updatePath: (id: string, newPath: string) => ipcRenderer.invoke('workspace:update-path', id, newPath),
  validatePath: (p: string) => ipcRenderer.invoke('workspace:validate-path', p),
  getDefaultPath: () => ipcRenderer.invoke('workspace:get-default-path'),
  chooseDirectory: () => ipcRenderer.invoke('workspace:choose-directory'),
  validateOnStartup: () => ipcRenderer.invoke('workspace:validate-on-startup'),
  listDir: (dir: string) => ipcRenderer.invoke('workspace:list-dir', dir).then((r: any) => r.success ? r.entries : []),
  readFile: (filePath: string) => ipcRenderer.invoke('workspace:read-file', filePath),
  readFileBinary: (filePath: string) => ipcRenderer.invoke('workspace:read-file-binary', filePath),
  writeFile: (filePath: string, content: string) => ipcRenderer.invoke('workspace:write-file', filePath, content),
  previewFile: (filePath: string) => ipcRenderer.invoke('workspace:preview-file', filePath),
  rebuildFilesystem: (rootPath: string) => ipcRenderer.invoke('workspace:rebuild-filesystem', rootPath),
  awaitDrain: () => ipcRenderer.invoke('workspace:await-drain'),
  git: {
    check: (dir: string) => ipcRenderer.invoke('workspace:git-check', dir),
    status: (dir: string) => ipcRenderer.invoke('workspace:git-status', dir),
    stage: (dir: string, files: string[]) => ipcRenderer.invoke('workspace:git-stage', dir, files),
    unstage: (dir: string, files: string[]) => ipcRenderer.invoke('workspace:git-unstage', dir, files),
    commit: (dir: string, message: string) => ipcRenderer.invoke('workspace:git-commit', dir, message),
    diff: (dir: string, file?: string, staged?: boolean) => ipcRenderer.invoke('workspace:git-diff', dir, file, staged),
    log: (dir: string, opts?: { skip?: number; limit?: number }) => ipcRenderer.invoke('workspace:git-log', dir, opts),
    show: (dir: string, hash: string) => ipcRenderer.invoke('workspace:git-show', dir, hash),
    pull: (dir: string) => ipcRenderer.invoke('workspace:git-pull', dir),
    push: (dir: string) => ipcRenderer.invoke('workspace:git-push', dir),
  },
});

// MCP Server 管理 API
contextBridge.exposeInMainWorld('mcpAPI', {
  listInstalled: () => ipcRenderer.invoke('mcp:list-installed'),
  install: (packageName: string) => ipcRenderer.invoke('mcp:install', packageName),
  uninstall: (packageName: string) => ipcRenderer.invoke('mcp:uninstall', packageName),
  getServersDir: () => ipcRenderer.invoke('mcp:get-servers-dir'),
  getBuiltinServers: () => ipcRenderer.invoke('mcp:get-builtin-servers'),
});

// 文档转 Markdown：供附件上传场景使用，主进程通过 markitdown-ts 实现
contextBridge.exposeInMainWorld('documentAPI', {
  convertToMarkdown: (payload: { fileName: string; data: number[] | Uint8Array; mimeType?: string }) =>
    ipcRenderer.invoke('document:convert-markdown', payload)
});

// Self-Evolution API
contextBridge.exposeInMainWorld('selfEvolutionAPI', {
  memoryRead: () => ipcRenderer.invoke('memory:read'),
  memoryWrite: (params: { action: string; target: string; content?: string; old_text?: string }) =>
    ipcRenderer.invoke('memory:write', params),
  memorySearch: (query: string, limit?: number) => ipcRenderer.invoke('memory:search', query, limit),
  memoryList: (target?: string) => ipcRenderer.invoke('memory:list', target),
  sessionSave: (sessionId: string, messages: any[], model?: string, provider?: string) =>
    ipcRenderer.invoke('session:save', sessionId, messages, model, provider),
  sessionSearch: (query: string, limit?: number) => ipcRenderer.invoke('session:search', query, limit),
  sessionList: (limit?: number) => ipcRenderer.invoke('session:list', limit),
  skillCreate: (manifest: any) => ipcRenderer.invoke('skill:create', manifest),
  skillPatch: (name: string, patches: any) => ipcRenderer.invoke('skill:patch', name, patches),
  skillDelete: (name: string) => ipcRenderer.invoke('skill:delete', name),
  skillListAgent: () => ipcRenderer.invoke('skill:list-agent'),
  pendingAdd: (type: string, action: string, payload: any, source?: string) => ipcRenderer.invoke('pending:add', type, action, payload, source),
  pendingList: (status?: string) => ipcRenderer.invoke('pending:list', status),
  pendingApprove: (id: number) => ipcRenderer.invoke('pending:approve', id),
  pendingReject: (id: number) => ipcRenderer.invoke('pending:reject', id),
});

exposeAPIs();