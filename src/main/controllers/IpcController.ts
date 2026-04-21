import { ipcMain } from 'electron';
import path from 'path';
import * as fs from 'node:fs';
import os from 'node:os';
import { writeFileSync } from 'node:fs';
import { mcpService } from '../services/McpService.js';
import { mcpClientModel } from '../models/McpClientModel.js';
import { configModel } from '../models/ConfigModel.js';
import { internalRegistryService } from '../services/InternalRegistryService.js';
import { npmRegistry } from '../../lib/repo/internal_repo.js';

export class IpcController {
  registerHandlers() {
    ipcMain.handle('list-clients', () => {
      return mcpClientModel.getFeatures();
    });

    ipcMain.handle('get-mcp-config', () => {
      const config = configModel.readConfig();
      return config ? config.mcpServers : {};
    });

    ipcMain.handle('initialize-mcp-clients', async (event, serverNames?: string[]) => {
      if (serverNames && serverNames.length > 0) {
        await mcpService.bootstrapSpecificClients(serverNames);
      } else {
        await mcpService.bootstrapClientsFromConfig();
      }
      return mcpClientModel.getFeatures();
    });

    ipcMain.handle('initialize-mcp-server', async (event, serverName, serverConfig) => {
      return await mcpService.initializeDynamicServer(serverName, serverConfig);
    });

    ipcMain.handle('delete-mcp-server', async (event, serverName) => {
      return await mcpService.deleteServer(serverName);
    });

    // Registry handlers
    ipcMain.handle('registry-status', async () => {
      return await npmRegistry.getStatus();
    });

    ipcMain.handle('registry-start', async () => {
      const result = await internalRegistryService.initialize();
      return {
        success: result,
        message: result ? '内部npm仓库启动成功' : '内部npm仓库启动失败',
        url: result ? 'http://localhost:4873' : null
      };
    });

    ipcMain.handle('registry-stop', async () => {
      await internalRegistryService.shutdown();
      return {
        success: true,
        message: '内部npm仓库已停止'
      };
    });

    ipcMain.handle('registry-process-dependencies', async (event, fileData) => {
      try {
        const progressCallback = (percent: number, message: string) => {
          event.sender.send('registry-process-progress', { percent, message });
        };

        if (typeof fileData === 'string') {
          const result = await npmRegistry.processDependenciesZip(fileData, progressCallback);
          return {
            success: result,
            message: result ? '依赖包处理成功' : '依赖包处理失败'
          };
        }

        if (typeof fileData === 'object' && fileData.name && fileData.data) {
          const tempDir = os.tmpdir();
          const tempFilePath = path.join(tempDir, fileData.name);
          const buffer = Buffer.from(fileData.data);
          writeFileSync(tempFilePath, buffer);

          const result = await npmRegistry.processDependenciesZip(tempFilePath, progressCallback);

          try {
            fs.unlinkSync(tempFilePath);
          } catch (err) {
            console.warn('清理临时文件失败:', (err as any).message);
          }

          return {
            success: result,
            message: result ? '依赖包处理成功' : '依赖包处理失败'
          };
        }

        return { success: false, message: '无效的文件数据' };
      } catch (error) {
        return { success: false, message: `依赖包处理失败: ${(error as any).message}` };
      }
    });

    ipcMain.handle('registry-configure-npm', async () => {
      try {
        const result = await npmRegistry.configureNpm();
        return {
          success: result,
          message: result ? 'npm配置成功' : 'npm配置失败'
        };
      } catch (error) {
        return { success: false, message: `npm配置失败: ${(error as any).message}` };
      }
    });
  }
}

export const ipcController = new IpcController();
