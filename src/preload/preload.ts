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

exposeAPIs();

