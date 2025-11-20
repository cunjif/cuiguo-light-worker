// main.ts
import { app, BrowserWindow, ipcMain } from 'electron';
import {
  Client, McpServersConfig,
  ListToolsResultSchema, CallToolResultSchema,
  ListPromptsResultSchema, GetPromptResultSchema,
  ListResourcesResultSchema, ReadResourceResultSchema, ListResourceTemplatesResultSchema
} from './types.js';
import { initializeClient, manageRequests } from './client.js';

import notifier from 'node-notifier';

import path from 'path';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync, writeFileSync } from 'fs';

let appPath;

if (app.isPackaged) {
  // Electron Packaged
  appPath = path.dirname(process.execPath);
} else {
  // Dev
  appPath = app.getAppPath();
}

console.log('Current Path:', appPath);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Config file is located in src/main/config.json
const configPath = path.join(__dirname, 'config.json');

const preloadPath = path.resolve(__dirname, '..', 'preload', 'preload.js');
const indexPath = path.resolve(__dirname, '..', 'renderer', 'index.html');

interface ClientObj {
  name: string;
  client: Client;
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
      const clients = await Promise.all(
        Object.entries(config.mcpServers).map(async ([name, serverConfig]) => {
          console.log(`Initializing client for ${name} with config:`, serverConfig);

          const timeoutPromise = new Promise<Client>((resolve, reject) => {
            setTimeout(() => {
              reject(new Error(`Initialization of client for ${name} timed out after 30 seconds`));
            }, 30000); // 30 seconds
          });

          const client = await Promise.race([
            initializeClient(name, serverConfig),
            timeoutPromise,
          ]);

          console.log(`${name} initialized.`);
          const capabilities = client.getServerCapabilities();
          return { name, client, capabilities };
        })
      );

      console.log('All clients initialized.');
      notifier.notify({
        appID: 'AIQL',
        title: "MCP Servers are ready",
        message: "All Clients initialized."
      });

      return clients;
    } catch (error) {
      console.error('Error during client initialization:', error?.message);
      notifier.notify({
        appID: 'AIQL',
        title: 'Client initialization failed',
        message: "Cannot start with current config, " +  error?.message,
      });

      process.exit(1);
    }
  } else {
    console.log('NO clients configured.');
    notifier.notify({
      appID: 'AIQL',
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

  // You can uncomment the following line to enable DevTools permanently.
  // mainWindow.webContents.openDevTools();
}

let features: any[] = [];

// Register IPC handlers for a MCP server
function registerIpcHandlers(
  name: string,
  client: Client,
  capabilities: Record<string, any> | undefined) {

  const feature: { [key: string]: any } = { name };

  const registerHandler = (method: string, schema: any) => {
    const eventName = `${name}-${method}`;
    console.log(`IPC Main ${eventName}`);
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

  for (const [type, actions] of Object.entries(capabilitySchemas)) {
    if (capabilities?.[type]) {
      feature[type] = {};
      for (const [action, schema] of Object.entries(actions)) {
        feature[type][action] = registerHandler(`${type}/${action}`, schema);
      }
    }
  }

  return feature;
}

app.whenReady().then(async () => {

  const clients = await initClient();
  
  // Register IPC handlers for all initialized clients and populate features array
  features = clients.map(clientObj => {
    const feature = registerIpcHandlers(clientObj.name, clientObj.client, clientObj.capabilities);
    feature.type = 'local'; // Mark startup clients as local
    return feature;
  });
  
  console.log('Features initialized:', features.length, features);

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });

  ipcMain.handle('list-clients', () => {
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

      // For HTTP/SSE servers, we don't need to initialize them in the main process
      // They will be accessed directly from the renderer via HTTP
      if (serverConfig.type === 'http') {
        console.log(`HTTP/SSE server ${serverName} detected. Skipping main process initialization.`);
        console.log(`Server will be accessible via: ${serverConfig.url}`);
        
        // Create a feature entry for HTTP servers with full config
        const httpFeature = {
          name: serverName,
          type: 'http',
          url: serverConfig.url,
          config: serverConfig,
          message: 'HTTP/SSE server - access via HTTP directly'
        };
        
        features.push(httpFeature);
        
        // Save the server config (without the type field)
        const config = readConfig(configPath);
        if (config) {
          config.mcpServers[serverName] = cleanServerConfig(serverConfig);
          saveConfig(configPath, config);
        }

        return {
          success: true,
          message: `HTTP/SSE server ${serverName} registered successfully`,
          feature: httpFeature
        };
      }

      // For local command servers, initialize normally
      if (serverConfig.type === 'local') {
        const timeoutPromise = new Promise<Client>((resolve, reject) => {
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
        
        // Add config information to feature
        newServerFeature.type = 'local';
        newServerFeature.config = serverConfig;
        newServerFeature.command = serverConfig.command;
        newServerFeature.args = serverConfig.args;
        
        features.push(newServerFeature);
        console.log(`[DEBUG] Features array now contains:`, features.map(f => ({ name: f.name, type: f.type, has_tools: !!f.tools })));

        console.log(`New server ${serverName} registered with IPC handlers`);

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
      }

      return {
        success: false,
        message: 'Unknown server type'
      };
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

  features = clients.map(({ name, client, capabilities }) => {
    console.log('Capabilities:', name, '\n', capabilities);
    return registerIpcHandlers(name, client, capabilities);
  });

  console.log(features)

});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

