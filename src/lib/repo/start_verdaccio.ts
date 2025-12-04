import * as path from 'node:path';
import * as os from 'node:os';
import * as fs from 'node:fs';
import { exec, spawn } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

// 存储Verdaccio进程实例
let verdaccioProcess: any = null;

// 获取项目中的npm路径
function getNpmPath(): string {
    const isWindows = os.platform() === 'win32';
    const projectRoot = process.cwd();

    // 检查项目中是否有env目录包含npm
    const envNpmPath = isWindows
        ? path.join(projectRoot, 'env', 'Scripts', 'npm.cmd')
        : path.join(projectRoot, 'env', 'bin', 'npm');

    if (fs.existsSync(envNpmPath)) {
        return envNpmPath;
    }

    // 回退到系统npm
    return isWindows ? 'npm.cmd' : 'npm';
}

// 获取项目中的npx路径
function getNpxPath(): string {
    const isWindows = os.platform() === 'win32';
    const projectRoot = process.cwd();

    // 检查项目中是否有env目录包含npx
    const envNpxPath = isWindows
        ? path.join(projectRoot, 'env', 'Scripts', 'npx.cmd')
        : path.join(projectRoot, 'env', 'bin', 'npx');

    if (fs.existsSync(envNpxPath)) {
        return envNpxPath;
    }

    // 回退到系统npx
    return isWindows ? 'npx.cmd' : 'npx';
}

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
 * @returns Promise<boolean> 是否已安装
 */
async function isVerdaccioInstalled(): Promise<boolean> {
    try {
        // 检查本地node_modules中是否有verdaccio
        const npxPath = getNpxPath();
        const { stdout, stderr } = await execAsync(`"${npxPath}" verdaccio --version`);
        const result = stdout + stderr;
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

        // 创建YAML格式的配置文件
        const config = `# Verdaccio configuration file
storage: ${path.join(configDir, 'storage').replace(/\\/g, '/')}
plugins: ${path.join(configDir, 'plugins').replace(/\\/g, '/')}

auth:
  htpasswd:
    file: ${path.join(configDir, 'htpasswd').replace(/\\/g, '/')}
    max_users: -1

packages:
  '@*/*':
    access: $anonymous
    publish: $anonymous     
    unpublish: $anonymous   
    proxy: npmjs
  '**':
    access: $anonymous
    publish: $anonymous     
    unpublish: $anonymous 
    proxy: npmjs

logs:
  - { type: stdout, format: pretty, level: http }

server:
  keepAliveTimeout: 60
  allowHosts:
    - localhost
    - 127.0.0.1
    - '::1'
`;

        fs.writeFileSync(configPath, config);
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
        // 检查Verdaccio是否已安装
        const isInstalled = await isVerdaccioInstalled();
        if (!isInstalled) {
            console.error('Verdaccio未安装，请先安装: npm install -g verdaccio');
            return false;
        }

        // 检查是否已在运行
        const isRunning = await isVerdaccioRunning();
        if (isRunning) {
            console.log('Verdaccio已在运行中');
            return true;
        }

        // 如果没有提供配置文件路径，创建默认配置
        if (!configPath) {
            const configDir = path.join(os.tmpdir(), 'verdaccio-config');
            if (!fs.existsSync(configDir)) {
                fs.mkdirSync(configDir, { recursive: true });
            }
            configPath = path.join(configDir, 'config.yaml');
            
            // 创建默认配置文件
            const configCreated = createVerdaccioConfig(configPath);
            if (!configCreated) {
                console.error('创建Verdaccio配置文件失败');
                return false;
            }
        }

        // 获取npx路径
        const npxPath = getNpxPath();

        // 启动Verdaccio
        console.log(`正在启动Verdaccio，端口: ${port}...`);
        
        // 使用spawn启动Verdaccio进程，以便我们可以控制它
        verdaccioProcess = spawn(`"${npxPath}"`, ['verdaccio', '-c', configPath, '-l', `${port}`], {
            shell: true,
            stdio: 'pipe',
            detached: false
        });

        // 监听输出
        verdaccioProcess.stdout.on('data', (data: Buffer) => {
            console.log(`Verdaccio: ${data.toString()}`);
        });

        verdaccioProcess.stderr.on('data', (data: Buffer) => {
            console.error(`Verdaccio错误: ${data.toString()}`);
        });

        verdaccioProcess.on('error', (error: Error) => {
            console.error(`启动Verdaccio失败: ${error.message}`);
            verdaccioProcess = null;
        });

        verdaccioProcess.on('close', (code: number) => {
            console.log(`Verdaccio进程退出，代码: ${code}`);
            verdaccioProcess = null;
        });

        // 等待一段时间让Verdaccio启动
        await new Promise(resolve => setTimeout(resolve, 3000));

        // 检查是否成功启动
        const isRunningAfterStart = await isVerdaccioRunning();
        if (isRunningAfterStart) {
            console.log(`Verdaccio启动成功，地址: http://localhost:${port}`);
            return true;
        } else {
            console.error('Verdaccio启动失败');
            if (verdaccioProcess) {
                verdaccioProcess.kill();
                verdaccioProcess = null;
            }
            return false;
        }
    } catch (error) {
        console.error(`启动Verdaccio失败: ${error.message}`);
        return false;
    }
}

/**
 * 停止Verdaccio服务
 * @returns Promise<boolean> 是否停止成功
 */
export async function stopVerdaccio(): Promise<boolean> {
    try {
        if (verdaccioProcess) {
            console.log('正在停止Verdaccio服务...');
            verdaccioProcess.kill('SIGTERM');
            
            // 等待进程结束
            await new Promise(resolve => {
                const checkInterval = setInterval(() => {
                    if (!verdaccioProcess) {
                        clearInterval(checkInterval);
                        resolve(true);
                    }
                }, 500);
                
                // 强制超时
                setTimeout(() => {
                    clearInterval(checkInterval);
                    if (verdaccioProcess) {
                        verdaccioProcess.kill('SIGKILL');
                        verdaccioProcess = null;
                    }
                    resolve(true);
                }, 5000);
            });
            
            console.log('Verdaccio服务已停止');
            return true;
        } else {
            // 检查是否有其他Verdaccio进程在运行
            try {
                const isRunning = await isVerdaccioRunning();
                if (isRunning) {
                    console.log('发现其他Verdaccio进程，尝试终止...');
                    
                    // 根据操作系统使用不同的命令
                    const isWindows = os.platform() === 'win32';
                    const killCommand = isWindows 
                        ? `taskkill /F /IM node.exe /FI "WINDOWTITLE eq verdaccio*"` 
                        : `pkill -f "verdaccio"`;
                    
                    await execAsync(killCommand);
                    
                    // 等待一段时间让进程结束
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    
                    // 再次检查
                    const stillRunning = await isVerdaccioRunning();
                    if (!stillRunning) {
                        console.log('成功终止其他Verdaccio进程');
                        return true;
                    } else {
                        console.warn('无法终止其他Verdaccio进程');
                        return false;
                    }
                } else {
                    console.log('没有运行中的Verdaccio进程');
                    return true;
                }
            } catch (error) {
                console.error(`停止Verdaccio进程失败: ${error.message}`);
                return false;
            }
        }
    } catch (error) {
        console.error(`停止Verdaccio服务失败: ${error.message}`);
        return false;
    }
}

/**
 * 获取Verdaccio进程状态
 * @returns Promise<boolean> 是否正在运行
 */
export async function isVerdaccioRunning(): Promise<boolean> {
    try {
        const response = await fetch('http://localhost:4873/-/ping');
        return response.ok;
    } catch (error) {
        return false;
    }
}