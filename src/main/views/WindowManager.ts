import { BrowserWindow, app } from 'electron';
import path from 'path';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class WindowManager {
  private mainWindow: BrowserWindow | null = null;
  private preloadPath: string;
  private indexPath: string;
  private registryManagerPath: string;

  constructor() {
    // Relative to dist/main/views/WindowManager.js
    this.preloadPath = resolve(__dirname, '..', '..', 'preload', 'preload.js');
    this.indexPath = resolve(__dirname, '..', '..', 'renderer', 'index.html');
    this.registryManagerPath = resolve(__dirname, '..', '..', 'renderer', 'registry-manager.html');
  }

  createMainWindow(): BrowserWindow {
    this.mainWindow = new BrowserWindow({
      width: 1920,
      height: 1080,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: this.preloadPath
      }
    });

    this.mainWindow.loadFile(this.indexPath);

    this.mainWindow.webContents.on('before-input-event', (event, input) => {
      if (input.key === 'F12' || (input.control && input.shift && input.key === 'I')) {
        if (this.mainWindow?.webContents.isDevToolsOpened()) {
          this.mainWindow.webContents.closeDevTools();
        } else {
          this.mainWindow?.webContents.openDevTools();
        }
      }
    });

    return this.mainWindow;
  }

  createRegistryWindow(): BrowserWindow {
    const registryWindow = new BrowserWindow({
      width: 900,
      height: 700,
      title: '插件管理',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: this.preloadPath
      }
    });

    registryWindow.loadFile(this.registryManagerPath);
    return registryWindow;
  }

  getMainWindow(): BrowserWindow | null {
    return this.mainWindow;
  }
}

export const windowManager = new WindowManager();
