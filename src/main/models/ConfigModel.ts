import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { app } from 'electron';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { McpServersConfig } from '../types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class ConfigModel {
  private configPath: string;

  constructor() {
    let appPath;
    if (app.isPackaged) {
      appPath = path.dirname(process.execPath);
    } else {
      // In dev, the compiled file is in dist/main/models/ConfigModel.js
      // The config.json is copied to dist/main/config.json
      // So we go up one level from __dirname (dist/main/models) to dist/main/
      appPath = path.resolve(__dirname, '..');
    }
    this.configPath = path.join(appPath, 'config.json');
    console.log('Config Path initialized:', this.configPath);
  }

  readConfig(): McpServersConfig | null {
    try {
      const config = readFileSync(this.configPath, 'utf8');
      return JSON.parse(config);
    } catch (error) {
      console.error('Error reading config file:', error);
      return null;
    }
  }

  saveConfig(config: McpServersConfig): boolean {
    try {
      writeFileSync(this.configPath, JSON.stringify(config, null, 2), 'utf8');
      console.log('Config saved successfully:', this.configPath);
      return true;
    } catch (error) {
      console.error('Error saving config file:', error);
      return false;
    }
  }

  cleanServerConfig(config: any): any {
    const cleaned = { ...config };
    delete cleaned.type;
    return cleaned;
  }

  getConfigPath(): string {
    return this.configPath;
  }
}

export const configModel = new ConfigModel();
