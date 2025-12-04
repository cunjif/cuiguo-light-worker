import * as fs from 'node:fs';
import * as path from 'node:path';
import { app } from 'electron';
import { processDependencies, checkRegistryStatus } from './publish_all.js';
import { startVerdaccio, stopVerdaccio, isVerdaccioRunning } from './start_verdaccio.js';
import { isZipFile } from './extract_zip.js';
import { NpmAuthHelper } from './npm_auth_helper.js';
import { exec, execSync } from 'node:child_process';
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
 * 内部npm仓库管理器
 */
export class InternalNpmRegistry {
    private registryUrl: string;
    private tempDir: string;
    private isInitialized: boolean = false;

    constructor(registryUrl: string = 'http://localhost:4873/') {
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
            const isRunning = await isVerdaccioRunning();
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
     * @param progressCallback 进度回调函数 (percent: number, message: string) => void
     * @returns Promise<boolean> 处理是否成功
     */
    async processDependenciesZip(zipPath: string, progressCallback?: (percent: number, message: string) => void): Promise<boolean> {
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
            const success = await processDependencies(zipPath, extractDir, this.registryUrl, progressCallback);

            // 清理临时目录
            // try {
            //     if (fs.existsSync(extractDir)) {
            //         fs.rmSync(extractDir, { recursive: true, force: true });
            //     }
            // } catch (error) {
            //     console.warn(`清理临时目录失败: ${error.message}`);
            // }

            return success;
        } catch (error) {
            console.error(`处理依赖包失败: ${error.message}`);
            return false;
        }
    }

    /**
     * 停止内部npm仓库
     * @returns Promise<boolean> 是否停止成功
     */
    async stop(): Promise<boolean> {
        try {
            const stopped = await stopVerdaccio();
            if (stopped) {
                console.log('内部npm仓库已停止');
            }
            return stopped;
        } catch (error) {
            console.error(`停止内部npm仓库失败: ${error.message}`);
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
            running: await isVerdaccioRunning(),
            initialized: this.isInitialized
        };
    }

    /**
     * 设置npm配置指向内部仓库
     * @returns Promise<boolean> 设置是否成功
     */
    async configureNpm(): Promise<boolean> {
        try {
            // 使用NpmAuthHelper配置npm客户端，不需要认证
            const authHelper = new NpmAuthHelper(this.registryUrl);
            const result = await authHelper.configureNpmNoAuth();

            if (result) {
                console.log(`npm registry已设置为: ${this.registryUrl}`);
                console.log('已禁用npm客户端认证要求');
            }

            return result;
        } catch (error) {
            console.error(`设置npm registry失败: ${error.message}`);
            return false;
        }
    }

    /**
     * 重置npm配置
     * @returns Promise<boolean> 重置是否成功
     */
    async unconfigureNpm(): Promise<boolean> {
        try {
            const authHelper = new NpmAuthHelper(this.registryUrl);
            const result = await authHelper.resetNpmConfig();
            if (result) {
                console.log('重置NPM客户端成功');
            }

            return result;
        } catch (error) {
            console.error(`重置npm客户端失败: ${error.message}`);
            return false;
        }
    }

    /**
     * 为项目创建.npmrc文件
     * @param projectPath 项目路径
     * @returns Promise<boolean> 创建是否成功
     */
    async createProjectNpmrc(projectPath: string): Promise<boolean> {
        try {
            // 使用NpmAuthHelper为项目创建.npmrc文件
            const authHelper = new NpmAuthHelper(this.registryUrl);
            const result = await authHelper.createProjectNpmrc(projectPath);

            if (result) {
                console.log(`已为项目 ${projectPath} 创建 .npmrc 文件`);
            }

            return result;
        } catch (error) {
            console.error(`创建项目 .npmrc 文件失败: ${error.message}`);
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

/**
 * 登录到本地npm仓库（使用默认凭证）
 * @param registryUrl npm仓库URL
 * @returns Promise<boolean> 登录是否成功
 */
export async function loginToRegistry(registryUrl: string): Promise<boolean> {
    try {
        // 对于最小化npm仓库，我们简化认证逻辑
        // 直接设置registry和假token
        const registryConfig = `${registryUrl}
${registryUrl.replace('http://', '//')}:_authToken=fake`;
        await execSync(`npm config set registry=${registryConfig}`);
        console.log('已配置npm仓库认证');
        return true;
    } catch (error) {
        console.error(`设置npm registry失败: ${error.message}`);
        return false;
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