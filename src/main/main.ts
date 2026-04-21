// main.ts
import { app, BrowserWindow } from 'electron';
import { internalRegistryService } from './services/InternalRegistryService.js';
import { mcpService } from './services/McpService.js';
import { windowManager } from './views/WindowManager.js';
import { menuManager } from './views/MenuManager.js';
import { ipcController } from './controllers/IpcController.js';
import notifier from 'node-notifier';

app.whenReady().then(async () => {
  // 1. Initialize Registry Service
  const registryInitialized = await internalRegistryService.initialize(4873);
  if (registryInitialized) {
    notifier.notify({
      appID: 'CUIGUO',
      title: '插件管理已启动',
      message: '私有 npm 仓库运行在 http://localhost:4873'
    });
  } else {
    notifier.notify({
      appID: 'AIQL',
      title: '内部npm仓库启动失败',
      message: '私有 npm 仓库无法启动'
    });
  }

  // 2. Initialize UI
  windowManager.createMainWindow();
  menuManager.createApplicationMenu();

  // 3. Register IPC Handlers
  ipcController.registerHandlers();

  // 4. Bootstrap MCP Clients
  mcpService.bootstrapClientsFromConfig().catch(err => {
    console.error('Deferred MCP client initialization failed:', err?.message);
  });
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    windowManager.createMainWindow();
  }
});

app.on('window-all-closed', async () => {
  await internalRegistryService.shutdown();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', async () => {
  await internalRegistryService.shutdown();
});
