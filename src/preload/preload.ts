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

async function updateMcpServersAPI() {
  console.log('Updating MCP Servers API...');
  const clients = await listClients();
  const win = window as any;
  console.log(`Get mcp servers: ${win.mcpServers}`)
  if (!win.mcpServers || typeof win.mcpServers !== 'object') {
    win.mcpServers = {};
  }
  
  console.log('Clients from list-clients:', clients);
  
  // Clear existing mcpServers and rebuild it
  // Since window.mcpServers is exposed via contextBridge, we need to update its properties
  // rather than replacing the entire object
  
  const createAPIMethods = (methods: Record<string, string>) => {
    const result: Record<string, (...args: any) => Promise<any>> = {};
    Object.keys(methods).forEach(key => {
      const methodName = methods[key];
      result[key] = (...args: any) => ipcRenderer.invoke(methodName, ...args);
    });
    return result;
  };

  // First, clear all existing servers from window.mcpServers
  const existingKeys = Object.keys(win.mcpServers || {});
  for (const key of existingKeys) {
    delete win.mcpServers[key];
  }

  // Now add all servers (both predefined and dynamic)
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

async function getServers() {
  const win = window as any;
  if (!win.mcpServers || typeof win.mcpServers !== 'object') {
    win.mcpServers = {};
  }
  console.log("get servers here")
  ipcRenderer.invoke('initialize-mcp-clients').catch((e: Error) => {
    console.warn('initialize-mcp-clients failed or not necessary:', e?.message || e);
  }).finally(()=> {
    updateMcpServersAPI().finally(()=>win.mcpServers);
  });
  // try {
  //   await ipcRenderer.invoke('initialize-mcp-clients');
  // } catch (e) {
  //   console.warn('initialize-mcp-clients failed or not necessary:', e?.message || e);
  // }
  // await updateMcpServersAPI();
  // return win.mcpServers;
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
  processDependencies: (filePath: string) => ipcRenderer.invoke('registry-process-dependencies', filePath),
  configureNpm: () => ipcRenderer.invoke('registry-configure-npm'),
  onRegistryProcessProgress: (callback: (progress: { percent: number, message: string }) => void) => {
    ipcRenderer.on('registry-process-progress', (event: Electron.IpcRendererEvent, progress: { percent: number, message: string }) => callback(progress));
  },
  removeRegistryProcessProgressListener: () => {
    ipcRenderer.removeAllListeners('registry-process-progress');
  }
});

exposeAPIs();
