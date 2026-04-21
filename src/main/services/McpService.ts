import { Client, StdioClientTransport, CreateMessageRequestSchema, ServerConfig, ClientObj,
  ListToolsResultSchema, CallToolResultSchema,
  ListPromptsResultSchema, GetPromptResultSchema,
  ListResourcesResultSchema, ReadResourceResultSchema, ListResourceTemplatesResultSchema 
} from '../types.js';
import { HttpClient } from './HttpClient.js';
import { configModel } from '../models/ConfigModel.js';
import { mcpClientModel } from '../models/McpClientModel.js';
import notifier from 'node-notifier';
import { BrowserWindow, ipcMain } from 'electron';

export class McpService {
  async initializeClient(name: string, config: ServerConfig): Promise<Client | HttpClient> {
    console.log(`Initializing client for ${name} with config:`, config);
    
    const serverType = config.type || (config.url ? 'http' : 'local');
    
    if (serverType === 'http' || serverType === 'sse' || config.url) {
      if (!config.url) {
        throw new Error(`HTTP/SSE server ${name} must have a 'url' property`);
      }
      const httpClient = new HttpClient(name, config.url);
      await httpClient.connect();
      return httpClient;
    }
    
    if (serverType === 'local' || config.command) {
      if (!config.command) {
        throw new Error(`Local MCP server ${name} must have a 'command' property`);
      }

      const transport = new StdioClientTransport({
        command: config.command,
        args: config.args || [],
        env: config.env || process.env,
      });
      
      const client = new Client({
        name: `${name}-client`,
        version: "1.0.0",
      }, {
        capabilities: {
          "sampling": {}
        }
      });
      
      await client.connect(transport);
      
      client.setRequestHandler(CreateMessageRequestSchema, async (request) => {
        console.log('Sampling request received:\n', request)
        return {
          model: "test-sampling-model",
          stopReason: "endTurn",
          role: "assistant",
          content: {
            type: "text",
            text: "This is a test message from the client used for sampling the LLM. If you receive this message, please stop further attempts, as the sampling test has been successful.",
          }
        };
      });

      return client;
    }
    
    throw new Error(`Server ${name} must have either 'url' or 'command' property, or specify 'type' as 'local' or 'http'`);
  }

  async handleMcpRequest(client: Client | HttpClient, method: string, schema: any, params?: any) {
    const requestObject = {
      method: method,
      ...(params && { params: params })
    };
    const result = await client.request(requestObject, schema);
    return result;
  }

  registerIpcHandlers(
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
        return await this.handleMcpRequest(client, `${method}`, schema, params);
      });
      return eventName;
    };
  
    const capabilitySchemas = this.getCapabilitySchemas();
  
    for (const [type, actions] of Object.entries(capabilitySchemas)) {
      feature[type] = {};
      for (const [action, schema] of Object.entries(actions)) {
        feature[type][action] = registerHandler(`${type}/${action}`, schema);
      }
    }
  
    return feature;
  }

  async initClients(): Promise<ClientObj[]> {
    const config = configModel.readConfig();
    if (config && config.mcpServers && Object.keys(config.mcpServers).length > 0) {
      try {
        const results = await Promise.allSettled(
          Object.entries(config.mcpServers).map(([name, serverConfig]) => {
            const timeoutPromise = new Promise<Client | HttpClient>((resolve, reject) => {
              setTimeout(() => {
                reject(new Error(`Initialization of client for ${name} timed out after 30 seconds`));
              }, 30000);
            });

            return Promise.race([
              this.initializeClient(name, serverConfig),
              timeoutPromise,
            ])
              .then(client => {
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
        console.error('Error during client initialization:', (error as any)?.message);
        notifier.notify({
          appID: 'CUIGUO',
          title: 'Client initialization failed',
          message: "Cannot start with current config, " + (error as any)?.message,
        });
        return [];
      }
    } else {
      notifier.notify({
        appID: 'CUIGUO',
        title: 'NO clients configured',
        message: "NO MCP servers in config.json. You can add them dynamically through the UI.",
      });
      return [];
    }
  }

  async bootstrapClientsFromConfig() {
    let clients: ClientObj[] = [];
    try {
      clients = await this.initClients();
    } catch (error) {
      console.error('Failed to initialize clients:', (error as any)?.message);
      clients = [];
    }
  
    const features = clients.map(clientObj => {
      const feature = this.registerIpcHandlers(clientObj.name, clientObj.client, clientObj.capabilities);
      if (clientObj.client instanceof HttpClient) {
        feature.type = 'http';
        feature.url = (clientObj.client as HttpClient).getUrl();
      } else {
        feature.type = 'local';
      }
      return feature;
    });
  
    mcpClientModel.setFeatures(features);
    console.log('Features initialized:', features.length);
    this.notifyClientsUpdated();
  }

  async bootstrapSpecificClients(serverNames: string[]) {
    const config = configModel.readConfig();
    if (!config || !config.mcpServers) {
      console.error('No config or mcpServers found');
      return;
    }
  
    const serversToInit = serverNames.filter(name => config.mcpServers[name]);
    if (serversToInit.length === 0) {
      console.log('No valid servers to initialize');
      return;
    }
  
    console.log(`Initializing ${serversToInit.length} specific servers: ${serversToInit.join(', ')}`);
  
    try {
      for (const serverName of serversToInit) {
        const serverConfig = config.mcpServers[serverName];
        
        mcpClientModel.removeFeatureByName(serverName);
  
        try {
          const timeoutPromise = new Promise<Client | HttpClient>((resolve, reject) => {
            setTimeout(() => {
              reject(new Error(`Initialization of client for ${serverName} timed out after 30 seconds`));
            }, 30000);
          });
  
          const client = await Promise.race([
            this.initializeClient(serverName, serverConfig),
            timeoutPromise,
          ]);
  
          const capabilities = client.getServerCapabilities();
          const feature = this.registerIpcHandlers(serverName, client, capabilities);
          
          if (client instanceof HttpClient) {
            feature.type = 'http';
            feature.url = (client as HttpClient).getUrl();
          } else {
            feature.type = 'local';
          }
  
          mcpClientModel.addFeature(feature);
        } catch (error) {
          console.error(`Failed to initialize server ${serverName}:`, (error as any)?.message);
        }
      }
  
      this.notifyClientsUpdated();
    } catch (error) {
      console.error('Error during specific client initialization:', (error as any)?.message);
    }
  }

  async initializeDynamicServer(serverName: string, serverConfig: ServerConfig) {
    const existingFeatures = mcpClientModel.getFeatures();
    const existingServerIndex = existingFeatures.findIndex(f => f.name === serverName);
    if (existingServerIndex !== -1) {
      return { success: false, message: 'Server already exists' };
    }

    try {
      const timeoutPromise = new Promise<Client | HttpClient>((resolve, reject) => {
        setTimeout(() => {
          reject(new Error(`Initialization of client for ${serverName} timed out after 30 seconds`));
        }, 30000);
      });

      const client = await Promise.race([
        this.initializeClient(serverName, serverConfig),
        timeoutPromise,
      ]);

      const capabilities = client.getServerCapabilities();
      const newServerFeature = this.registerIpcHandlers(serverName, client, capabilities);

      if (client instanceof HttpClient) {
        newServerFeature.type = 'http';
        newServerFeature.url = (client as HttpClient).getUrl();
      } else {
        newServerFeature.type = 'local';
        newServerFeature.command = serverConfig.command;
        newServerFeature.args = serverConfig.args;
      }

      newServerFeature.config = serverConfig;
      mcpClientModel.addFeature(newServerFeature);

      this.notifyClientsUpdated();

      const config = configModel.readConfig();
      if (config) {
        config.mcpServers[serverName] = configModel.cleanServerConfig(serverConfig);
        configModel.saveConfig(config);
      }

      return {
        success: true,
        message: `Server ${serverName} initialized successfully`,
        feature: newServerFeature
      };
    } catch (error) {
      console.error(`Error initializing server ${serverName}:`, (error as any)?.message);
      return {
        success: false,
        message: `Failed to initialize server: ${(error as any)?.message}`
      };
    }
  }

  async deleteServer(serverName: string) {
    mcpClientModel.removeFeatureByName(serverName);

    const config = configModel.readConfig();
    if (config && config.mcpServers[serverName]) {
      delete config.mcpServers[serverName];
      configModel.saveConfig(config);
    }

    this.notifyClientsUpdated();
    return {
      success: true,
      message: `Server ${serverName} deleted successfully`
    };
  }

  notifyClientsUpdated() {
    BrowserWindow.getAllWindows().forEach(w => w.webContents.send('clients-updated'));
  }

  getCapabilitySchemas() {
    return {
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
  }
}

export const mcpService = new McpService();
