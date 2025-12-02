import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawn, ChildProcess, execSync } from 'node:child_process';
import * as os from 'node:os';

// 存储Verdaccio进程引用
let verdaccioProcess: ChildProcess | null = null;

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
 * @returns boolean 是否已安装
 */
function isVerdaccioInstalled(): boolean {
    try {
        // 检查本地node_modules中是否有verdaccio
        const npxPath = getNpxPath();
        const result = execSync(`"${npxPath}" verdaccio --version`, { stdio: 'pipe' });
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

uplinks:
  npmjs:
    url: https://registry.npmjs.org/

packages:
  '@*/*':
    access: $all
    publish: $all
    proxy: npmjs
  '**':
    access: $all
    publish: $all
    proxy: npmjs

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
        const npxPath = getNpxPath();
        const args = ['verdaccio', '--listen', `localhost:${port}`, '--config', configPath];
        verdaccioProcess = spawn(npxPath, args, {
            stdio: 'pipe',
            detached: false,
            shell: true  // 使用shell模式，特别是在Windows上
        });

        // 处理输出
        verdaccioProcess.stdout?.on('data', (data) => {
            console.log(`Verdaccio: ${data.toString().trim()}`);
        });

        verdaccioProcess.stderr?.on('data', (data) => {
            console.error(`Verdaccio错误: ${data.toString().trim()}`);
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
export async function stopVerdaccio(): Promise<boolean> {
    try {
        // 首先尝试使用保存的进程引用
        if (!!verdaccioProcess) {
            verdaccioProcess.kill();
            verdaccioProcess = null;
            console.log('Verdaccio服务已停止');
            return true;
        } else {
            // 如果没有进程引用，检查端口上是否有服务在运行
            const isRunning = await checkRegistryStatus();
            if (isRunning) {
                console.log('检测到Verdaccio服务在运行，但没有进程引用');
                
                // 尝试通过系统命令查找并终止占用端口的进程
                try {
                    const { execSync } = await import('child_process');
                    
                    // 在Windows上使用netstat和taskkill
                    if (process.platform === 'win32') {
                        // 查找占用4873端口的进程ID
                        const netstatResult = execSync('netstat -ano | findstr :4873', { encoding: 'utf8' });
                        const lines = netstatResult.split('\n');
                        
                        for (const line of lines) {
                            if (line.includes(':4873') && line.includes('LISTENING')) {
                                const parts = line.trim().split(/\s+/);
                                const pid = parts[parts.length - 1];
                                
                                if (pid && !isNaN(parseInt(pid))) {
                                    console.log(`找到占用端口的进程ID: ${pid}`);
                                    execSync(`taskkill /F /PID ${pid}`, { encoding: 'utf8' });
                                    console.log('已终止占用端口的进程');
                                    return true;
                                }
                            }
                        }
                        
                        console.log('未找到占用端口的进程');
                    } else {
                        // 在Unix系统上使用lsof和kill
                        const lsofResult = execSync('lsof -ti:4873', { encoding: 'utf8' });
                        const pids = lsofResult.trim().split('\n');
                        
                        for (const pid of pids) {
                            if (pid && !isNaN(parseInt(pid))) {
                                console.log(`找到占用端口的进程ID: ${pid}`);
                                execSync(`kill -9 ${pid}`, { encoding: 'utf8' });
                                console.log('已终止占用端口的进程');
                            }
                        }
                        
                        if (pids.length > 0) {
                            return true;
                        }
                    }
                } catch (error) {
                    console.error(`通过系统命令终止进程失败: ${error.message}`);
                }
                
                return false;
            } else {
                console.log('没有运行的Verdaccio进程');
                return false;
            }
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
export async function isVerdaccioRunning(): Promise<boolean> {
    // 首先检查进程引用
    if (verdaccioProcess !== null && !verdaccioProcess.killed) {
        return true;
    }
    
    // 如果进程引用不可用，检查端口状态
    return await checkRegistryStatus();
}