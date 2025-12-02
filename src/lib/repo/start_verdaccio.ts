import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawn, ChildProcess, execSync } from 'node:child_process';

// 存储Verdaccio进程引用
let verdaccioProcess: ChildProcess | null = null;

/**
 * 检查本地npm仓库是否运行
 * @param registryUrl npm仓库URL
 * @returns Promise<boolean> 仓库是否运行
 */
async function checkRegistryStatus(registryUrl: string = 'http://localhost:4873'): Promise<boolean> {
    try {
        const url = new URL(registryUrl);
        const response = await fetch(`${registryUrl}/-/ping`);
        return response.ok;
    } catch (error) {
        return false;
    }
}

/**
 * 检查Verdaccio是否已安装
 * @returns boolean 是否已安装
 */
function isVerdaccioInstalled(): boolean {
    try {
        // 检查本地node_modules中是否有verdaccio
        const result = execSync('npx verdaccio --version', { stdio: 'pipe' });
        console.log(`Verdaccio检查结果 ${result}`)
        return !(result.includes('Error') || result.includes('err') || result.includes('Require stack'));
    } catch (error) {
        console.error(`检查Verdaccio失败: ${error}`)
        return false;
    }
}

/**
 * 创建默认的Verdaccio配置文件
 * @param configPath 配置文件路径
 * @returns boolean 是否创建成功
 */
function createVerdaccioConfig(configPath: string): boolean {
    try {
        const configDir = path.dirname(configPath);
        if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
        }

        const config = {
            storage: path.join(configDir, 'storage'),
            plugins: path.join(configDir, 'plugins'),
            config: {
                auth: {
                    'htpasswd': {
                        file: path.join(configDir, 'htpasswd')
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
                        publish: '$all',
                        proxy: 'npmjs'
                    },
                    '**': {
                        access: '$all',
                        publish: '$all',
                        proxy: 'npmjs'
                    }
                },
                server: {
                    keepAliveTimeout: 60,
                    allowHosts: ['localhost', '127.0.0.1', '::1']
                }
            }
        };

        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        return true;
    } catch (error) {
        console.error(`创建Verdaccio配置文件失败: ${error.message}`);
        return false;
    }
}

/**
 * 启动Verdaccio服务
 * @param port 端口号，默认为4873
 * @param configPath 配置文件路径，如果不提供则使用默认配置
 * @returns Promise<boolean> 是否启动成功
 */
export async function startVerdaccio(port: number = 4873, configPath?: string): Promise<boolean> {
    try {
        // 检查Verdaccio是否已经在运行
        if (await checkRegistryStatus(`http://localhost:${port}`)) {
            console.log(`Verdaccio已在端口 ${port} 上运行`);
            return true;
        }

        // 如果已有进程，先终止它
        if (verdaccioProcess) {
            verdaccioProcess.kill();
            verdaccioProcess = null;
        }

        // 检查Verdaccio是否已安装
        if (!isVerdaccioInstalled()) {
            console.error('Verdaccio未安装');
            return false;
        }

        // 如果没有提供配置文件路径，创建默认配置
        if (!configPath) {
            const configDir = path.join(process.cwd(), '.verdaccio');
            configPath = path.join(configDir, 'config.yaml');
            
            if (!fs.existsSync(configPath)) {
                if (!createVerdaccioConfig(configPath)) {
                    return false;
                }
            }
        }

        console.log(`正在启动Verdaccio服务，端口: ${port}...`);

        // 启动Verdaccio进程，使用npx
        const args = ['verdaccio', '--listen', `localhost:${port}`, '--config', configPath];
        verdaccioProcess = spawn('npx', args, {
            stdio: 'pipe',
            detached: false
        });

        // 处理输出
        verdaccioProcess.stdout?.on('data', (data) => {
            console.log(`Verdaccio: ${data.toString().trim()}`);
        });

        verdaccioProcess.stderr?.on('data', (data) => {
            console.error(`Verdaccio错误: ${data.toString().trim()}`);
        });

        // 处理进程错误
        verdaccioProcess.on('error', (error) => {
            console.error(`Verdaccio进程错误: ${error.message}`);
            if (error.code === 'EINVAL') {
                console.error('EINVAL错误：通常是由于命令路径不正确或参数格式错误');
            }
            verdaccioProcess = null;
        });

        // 处理进程退出
        verdaccioProcess.on('close', (code) => {
            console.log(`Verdaccio进程退出，代码: ${code}`);
            verdaccioProcess = null;
        });

        // 等待服务启动
        let attempts = 0;
        const maxAttempts = 10;
        const checkInterval = 1000; // 1秒

        while (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, checkInterval));
            
            if (await checkRegistryStatus(`http://localhost:${port}`)) {
                console.log(`Verdaccio服务已成功启动，地址: http://localhost:${port}`);
                return true;
            }
            
            attempts++;
        }

        console.error(`Verdaccio服务启动超时`);
        return false;
    } catch (error) {
        console.error(`启动Verdaccio失败: ${error.message}`);
        return false;
    }
}

/**
 * 停止Verdaccio服务
 * @returns boolean 是否停止成功
 */
export function stopVerdaccio(): boolean {
    try {
        if (verdaccioProcess) {
            verdaccioProcess.kill();
            verdaccioProcess = null;
            console.log('Verdaccio服务已停止');
            return true;
        } else {
            console.log('没有运行的Verdaccio进程');
            return false;
        }
    } catch (error) {
        console.error(`停止Verdaccio失败: ${error.message}`);
        return false;
    }
}

/**
 * 获取Verdaccio进程状态
 * @returns boolean 是否正在运行
 */
export function isVerdaccioRunning(): boolean {
    return verdaccioProcess !== null && !verdaccioProcess.killed;
}