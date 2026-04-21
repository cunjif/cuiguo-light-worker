import { Menu, app } from 'electron';
import { internalRegistryService } from '../services/InternalRegistryService.js';

export class MenuManager {
  createApplicationMenu() {
    const menu = Menu.buildFromTemplate([
      {
        label: '应用',
        submenu: [
          {
            label: '退出',
            click: () => {
              console.log('应用即将退出，正在停止内部npm仓库...');
              internalRegistryService.shutdown().then(() => {
                app.quit();
              });
            }
          }
        ]
      }
    ]);

    Menu.setApplicationMenu(menu);
  }
}

export const menuManager = new MenuManager();
