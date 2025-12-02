import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface VerdaccioConfig {
  storage: string;
  web: {
    title: string;
    enable: boolean;
  };
  auth: {
    htpasswd: {
      file: string;
      maxUsers: number;
    };
  };
  uplinks: {
    npmjs: {
      url: string;
    };
  };
  packages: {
    '@*/*': {
      access: string;
      publish: string;
      proxy: string;
    };
    '**': {
      access: string;
      publish: string;
      proxy: string;
    };
  };
  logs: {
    type: string;
    format: string;
  };
  listen: string[];
}

export class VerdaccioConfigManager {
  private configPath: string;
  private storagePath: string;
  private projectRoot: string;

  constructor(projectRoot?: string) {
    // 计算项目根目录：从 dist/lib 到项目根目录
    this.projectRoot = projectRoot || path.resolve(__dirname, '..', '..', '..');
    this.storagePath = path.join(this.projectRoot, 'verdaccio-storage');
    this.configPath = path.join(this.projectRoot, 'verdaccio-config.yaml');
  }

  createDefaultConfig(): VerdaccioConfig {
    // 确保存储目录存在
    if (!existsSync(this.storagePath)) {
      mkdirSync(this.storagePath, { recursive: true });
    }

    return {
      storage: this.storagePath,
      web: {
        title: 'Electron Verdaccio',
        enable: true
      },
      auth: {
        htpasswd: {
          file: path.join(this.storagePath, 'htpasswd'),
          maxUsers: 1000
        }
      },
      uplinks: {
        npmjs: {
          url: 'https://registry.npmjs.org/'
        }
      },
      packages: {
        '@*/*': {
          access: '$all',
          publish: '$authenticated',
          proxy: 'npmjs'
        },
        '**': {
          access: '$all',
          publish: '$authenticated',
          proxy: 'npmjs'
        }
      },
      logs: {
        type: 'stdout',
        format: 'pretty'
      },
      listen: ['0.0.0.0:4873']
    };
  }

  generateYamlConfig(config: VerdaccioConfig): string {
    return `
# Verdaccio configuration for Electron
storage: ${config.storage}

web:
  title: ${config.web.title}
  enable: ${config.web.enable}

auth:
  htpasswd:
    file: ${config.auth.htpasswd.file}
    maxUsers: ${config.auth.htpasswd.maxUsers}

uplinks:
  npmjs:
    url: ${config.uplinks.npmjs.url}

packages:
  '${Object.keys(config.packages)[0]}':
    access: ${config.packages['@*/*'].access}
    publish: ${config.packages['@*/*'].publish}
    proxy: ${config.packages['@*/*'].proxy}
  
  '${Object.keys(config.packages)[1]}':
    access: ${config.packages['**'].access}
    publish: ${config.packages['**'].publish}
    proxy: ${config.packages['**'].proxy}

logs:
  type: ${config.logs.type}
  format: ${config.logs.format}

listen: ${JSON.stringify(config.listen)}
`;
  }

  createConfigFile(customConfig?: Partial<VerdaccioConfig>): string {
    const config = customConfig ? { ...this.createDefaultConfig(), ...customConfig } : this.createDefaultConfig();
    const yamlContent = this.generateYamlConfig(config);
    
    try {
      writeFileSync(this.configPath, yamlContent, 'utf8');
      console.log('Verdaccio 配置文件已创建:', this.configPath);
      return this.configPath;
    } catch (error) {
      console.error('创建 Verdaccio 配置文件失败:', error);
      throw error;
    }
  }

  getConfigPath(): string {
    return this.configPath;
  }

  configExists(): boolean {
    return existsSync(this.configPath);
  }

  getStoragePath(): string {
    return this.storagePath;
  }
}

export const verdaccioConfigManager = new VerdaccioConfigManager();