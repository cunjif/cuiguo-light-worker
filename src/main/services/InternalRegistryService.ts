import { npmRegistry } from '../../lib/repo/internal_repo.js';

export class InternalRegistryService {
  async initialize(port: number = 4873): Promise<boolean> {
    console.log('正在启动内部npm仓库...');
    const initialized = await npmRegistry.initialize(port);
    if (initialized) {
      console.log(`✓ 内部npm仓库已在端口 ${port} 启动`);
    } else {
      console.error('✗ 内部npm仓库启动失败');
    }
    return initialized;
  }

  async shutdown(): Promise<void> {
    console.log('正在停止内部npm仓库...');
    await npmRegistry.shutdown();
    console.log('✓ 内部npm仓库已停止');
  }
}

export const internalRegistryService = new InternalRegistryService();
