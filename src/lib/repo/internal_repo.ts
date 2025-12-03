import * as fs from 'node:fs';
import * as path from 'node:path';
import { app } from 'electron';
import { processDependencies, checkRegistryStatus } from './publish_all.js';
import { startVerdaccio, stopVerdaccio, isVerdaccioRunning } from './start_verdaccio.js';
import { isZipFile } from './extract_zip.js';
import { exec, execSync, spawn } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

/**
 * 检查是否已登录到指定的npm仓库
 * @param registryUrl npm仓库URL
 * @returns Promise<boolean> 是否已登录
 */
async function isLoggedInToRegistry(registryUrl: string): Promise<boolean> {
    try {
        // 获取当前配置的registry
        const { stdout: currentRegistry } = await execAsync('npm config get registry');
        if (currentRegistry.trim() !== registryUrl) {
            // 如果当前registry不匹配，设置它
            await execAsync(`npm set registry ${registryUrl}`);
        }

        // 尝试获取用户信息
        await execAsync('npm whoami');
        return true;
    } catch (error) {
        // 如果出现错误，说明未登录或登录已过期
        return false;
    }
}

/**
 * 登录到本地npm仓库（使用默认凭证）
 * @param registryUrl npm仓库URL
 * @returns Promise<boolean> 登录是否成功
 */
export async function loginToRegistry(registryUrl: string): Promise<boolean> {
    try {
        // 设置 npm 仓库为本地 verdaccio
        await execAsync(`npm set registry ${registryUrl}`);
        
        // 对于本地verdaccio，通常不需要严格的认证
        // 我们可以尝试添加一个测试用户，但如果失败了，我们仍然可以尝试发布
        try {
           // 使用 spawn 执行 npm adduser 并传递输入
            const child = spawn('npm', ['adduser', '--registry', registryUrl], {
                stdio: ['pipe', 'pipe', 'pipe']
            });
            
            // 向子进程写入用户名、密码和邮箱
            child.stdin.write('verdaccio\n');
            child.stdin.write('verdaccio\n');
            child.stdin.write('verdaccio@example.com\n');
            child.stdin.end();
            
            // 等待子进程完成
            await new Promise<void>((resolve, reject) => {
                child.on('close', (code) => {
                    if (code === 0) {
                        resolve();
                    } else {
                        reject(new Error(`npm adduser exited with code ${code}`));
                    }
                });
                
                child.on('error', (err) => {
                    reject(err);
                });
            });
            
            console.log('已成功添加npm用户');
            return true;
        } catch (loginError) {
            console.warn(`添加npm用户失败，但这可能不会阻止发布: ${loginError.message}`);
            // 即使登录失败，我们也返回true，因为本地verdaccio通常允许匿名发布
            return true;
        }
    } catch (error) {
        console.error(`设置npm registry失败: ${error.message}`);
        return false;
    }
}

/**
 * 内部npm仓库管理器
 */
export class InternalNpmRegistry {
    private registryUrl: string;
    private tempDir: string;
    private isInitialized: boolean = false;

    constructor(registryUrl: string = 'http://localhost:4873') {
        this.registryUrl = registryUrl;
        // 获取应用数据目录
        const userDataPath = app.getPath('userData');
        this.tempDir = path.join(userDataPath, 'npm-registry-temp');

        // 确保临时目录存在
        if (!fs.existsSync(this.tempDir)) {
            fs.mkdirSync(this.tempDir, { recursive: true });
        }
    }

    /**
     * 初始化内部npm仓库
     * @param port 端口号，默认为4873
     * @returns Promise<boolean> 初始化是否成功
     */
    async initialize(port: number = 4873): Promise<boolean> {
        try {
            if (this.isInitialized) {
                console.log('内部npm仓库已经初始化');
                return true;
            }

            console.log('正在初始化内部npm仓库...');

            // 检查仓库是否已运行
            const isRunning = await checkRegistryStatus(this.registryUrl);
            if (!isRunning) {
                // 启动Verdaccio服务
                const started = await startVerdaccio(port);
                if (!started) {
                    console.error('启动内部npm仓库失败');
                    return false;
                }
            }

            this.isInitialized = true;
            console.log(`内部npm仓库初始化成功，地址: ${this.registryUrl}`);
            return true;
        } catch (error) {
            console.error(`初始化内部npm仓库失败: ${error.message}`);
            return false;
        }
    }

    /**
     * 处理依赖包zip文件
     * @param zipPath zip文件路径
     * @returns Promise<boolean> 处理是否成功
     */
    async processDependenciesZip(zipPath: string): Promise<boolean> {
        try {
            if (!this.isInitialized) {
                console.error('内部npm仓库未初始化，请先调用initialize方法');
                return false;
            }

            // 检查文件是否存在
            if (!fs.existsSync(zipPath)) {
                console.error(`文件不存在: ${zipPath}`);
                return false;
            }

            // 检查是否为zip文件
            if (!isZipFile(zipPath)) {
                console.error(`不是有效的zip文件: ${zipPath}`);
                return false;
            }

            // 创建临时解压目录
            const extractDir = path.join(this.tempDir, 'extracted');

            // 处理依赖包
            const success = await processDependencies(zipPath, extractDir, this.registryUrl);

            // 清理临时目录
            try {
                if (fs.existsSync(extractDir)) {
                    fs.rmSync(extractDir, { recursive: true, force: true });
                }
            } catch (error) {
                console.warn(`清理临时目录失败: ${error.message}`);
            }

            return success;
        } catch (error) {
            console.error(`处理依赖包失败: ${error.message}`);
            return false;
        }
    }

    /**
     * 获取仓库状态
     * @returns Promise<Object> 仓库状态信息
     */
    async getStatus(): Promise<{ url: string, running: boolean, initialized: boolean }> {
        return {
            url: this.registryUrl,
            running: await checkRegistryStatus(this.registryUrl),
            initialized: this.isInitialized
        };
    }

    /**
     * 设置npm配置指向内部仓库
     * @returns Promise<boolean> 设置是否成功
     */
    async configureNpm(): Promise<boolean> {
        try {
            // 检查是否已登录到仓库
            let loggedIn = await isLoggedInToRegistry(this.registryUrl);
            if (!loggedIn) {
                console.log('未登录到npm仓库，正在尝试自动登录...');
                loggedIn = await loginToRegistry(this.registryUrl);
                if (!loggedIn) {
                    console.error('自动登录失败，请手动登录到npm仓库');
                    return false;
                }
                console.log('已成功登录到npm仓库');
            }

            await execAsync(`npm set registry ${this.registryUrl}`);
            console.log(`npm registry已设置为: ${this.registryUrl}`);
            return true;
        } catch (error) {
            console.error(`设置npm registry失败: ${error.message}`);
            return false;
        }
    }

    /**
     * 关闭内部npm仓库
     * @returns Promise<boolean> 关闭是否成功
     */
    async shutdown(): Promise<boolean> {
        try {
            const stopped = await stopVerdaccio();
            this.isInitialized = false;
            return stopped;
        } catch (error) {
            console.error(`关闭内部npm仓库失败: ${error.message}`);
            return false;
        }
    }
}

// 导出单例实例
export const npmRegistry = new InternalNpmRegistry();

// 导出便捷函数
export async function setupInternalNpmRegistry(zipPath?: string, port: number = 4873): Promise<boolean> {
    try {
        // 初始化仓库
        const initialized = await npmRegistry.initialize(port);
        if (!initialized) {
            return false;
        }

        // 如果提供了zip文件，处理它
        if (zipPath) {
            return await npmRegistry.processDependenciesZip(zipPath);
        }

        return true;
    } catch (error) {
        console.error(`设置内部npm仓库失败: ${error.message}`);
        return false;
    }
}