import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { verdaccioConfigManager } from '../verdaccio-config.js';

// 获取当前模块的目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class VerdaccioManager {
    private verdaccioProcess: ChildProcess | null = null;
    private isRunning: boolean = false;

    async start(): Promise<boolean> {
        if (this.isRunning) {
            console.log('Verdaccio 已经在运行');
            return true;
        }

        try {
            console.log('正在启动 Verdaccio...');
            
            // 使用本地 verdaccio 安装路径（相对于项目根目录）
            // 从当前文件位置向上找到项目根目录
            // 当前文件: src/lib/repo/repo.ts -> 编译后: dist/lib/repo/repo.js
            // 目标: 项目根目录 (chat-mcp)
            const projectRoot = path.resolve(__dirname, '..', '..', '..');
            const verdaccioPath = path.join(projectRoot, 'env', 'Scripts', 'verdaccio.cmd');
            
            // 创建或获取配置文件
            let configPath: string;
            if (!verdaccioConfigManager.configExists()) {
                configPath = verdaccioConfigManager.createConfigFile();
                console.log('创建默认 Verdaccio 配置文件:', configPath);
            } else {
                configPath = verdaccioConfigManager.getConfigPath();
                console.log('使用现有 Verdaccio 配置文件:', configPath);
            }
            
            console.log('当前文件目录:', __dirname);
            console.log('项目根目录:', projectRoot);
            console.log('Verdaccio 路径:', verdaccioPath);
            console.log('配置文件路径:', configPath);
            
            this.verdaccioProcess = spawn('cmd', ['/c', verdaccioPath, '-c', configPath], {
                stdio: ['ignore', 'pipe', 'pipe'],
                detached: false,
                cwd: projectRoot
            });

            this.verdaccioProcess.stdout?.on('data', (data: Buffer) => {
                const output = data.toString();
                console.log('Verdaccio stdout:', output);
                
                // 检查是否成功启动
                if (output.includes('http address') || output.includes('4873')) {
                    this.isRunning = true;
                    console.log('Verdaccio 启动成功，运行在 http://localhost:4873');
                }
            });

            this.verdaccioProcess.stderr?.on('data', (data: Buffer) => {
                console.error('Verdaccio stderr:', data.toString());
            });

            this.verdaccioProcess.on('close', (code: number | null) => {
                this.isRunning = false;
                console.log(`Verdaccio 进程退出，退出码: ${code}`);
            });

            this.verdaccioProcess.on('error', (error: Error) => {
                this.isRunning = false;
                console.error('启动 Verdaccio 失败:', error);
            });

            // 等待启动完成
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            return this.isRunning;
        } catch (error) {
            console.error('启动 Verdaccio 时出错:', error);
            return false;
        }
    }

    stop(): boolean {
        if (this.verdaccioProcess && !this.verdaccioProcess.killed) {
            console.log('正在停止 Verdaccio...');
            this.verdaccioProcess.kill('SIGTERM');
            this.isRunning = false;
            return true;
        }
        return false;
    }

    isAlive(): boolean {
        return this.isRunning && !!this.verdaccioProcess && !this.verdaccioProcess.killed;
    }
}

// 创建全局实例
const verdaccioManager = new VerdaccioManager();

// 导出函数供主进程调用
export const startVerdaccio = (): Promise<boolean> => verdaccioManager.start();
export const stopVerdaccio = (): boolean => verdaccioManager.stop();
export const isVerdaccioRunning = (): boolean => verdaccioManager.isAlive();
export { verdaccioManager };