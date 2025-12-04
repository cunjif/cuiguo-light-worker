import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import * as path from 'node:path';
import * as os from 'node:os';

const execAsync = promisify(exec);

/**
 * npm认证辅助工具类
 * 用于在Electron应用中配置npm客户端，确保不需要认证
 */
export class NpmAuthHelper {
    private registryUrl: string;

    constructor(registryUrl: string = 'http://localhost:4873/') {
        this.registryUrl = registryUrl;
    }

    /**
     * 配置npm客户端，使其不需要认证即可使用内部仓库
     * @returns Promise<boolean> 配置是否成功
     */
    async configureNpmNoAuth(): Promise<boolean> {
        try {
            // 设置registry
            await execAsync(`npm config set registry=${this.registryUrl}`);

            // 设置一个假的token，避免npm客户端报错
            const registryHost = this.registryUrl.replace('http://', '').replace('https://', '');
            await execAsync(`npm config set //${registryHost}:_authToken="fake-token"`);

            // 设置strict-ssl为false，避免SSL证书问题
            await execAsync('npm config set strict-ssl=false');

            console.log(`npm registry已设置为: ${this.registryUrl}`);
            console.log('已配置npm客户端使用假token，避免认证要求');
            return true;
        } catch (error) {
            console.error(`配置npm客户端失败: ${error.message}`);
            return false;
        }
    }

    /**
     * 创建临时的.npmrc文件，用于特定项目
     * @param projectPath 项目路径
     * @returns Promise<boolean> 创建是否成功
     */
    async createProjectNpmrc(projectPath: string): Promise<boolean> {
        try {
            const npmrcContent = `
registry=${this.registryUrl}
//${this.registryUrl.replace('http://', '').replace('https://', '')}:_authToken=fake-token
strict-ssl=false
`.trim();

            const npmrcPath = path.join(projectPath, '.npmrc');
            require('fs').writeFileSync(npmrcPath, npmrcContent);

            console.log(`已在项目 ${projectPath} 中创建 .npmrc 文件`);
            return true;
        } catch (error) {
            console.error(`创建项目 .npmrc 文件失败: ${error.message}`);
            return false;
        }
    }

    /**
     * 重置npm配置，恢复到默认状态
     * @returns Promise<boolean> 重置是否成功
     */
    async resetNpmConfig(): Promise<boolean> {
        try {
            // 删除registry配置
            await execAsync('npm config delete registry');

            // 删除token配置
            const registryHost = this.registryUrl.replace('http://', '').replace('https://', '');
            await execAsync(`npm config delete //${registryHost}:_authToken`);

            // 重置strict-ssl
            await execAsync('npm config set strict-ssl=true');

            console.log('npm配置已重置为默认状态');
            return true;
        } catch (error) {
            console.error(`重置npm配置失败: ${error.message}`);
            return false;
        }
    }

    /**
     * 获取当前npm配置
     * @returns Promise<Object> 当前npm配置
     */
    async getCurrentConfig(): Promise<Object> {
        try {
            const { stdout } = await execAsync('npm config list --json');
            return JSON.parse(stdout);
        } catch (error) {
            console.error(`获取npm配置失败: ${error.message}`);
            return {};
        }
    }
}

/**
 * 创建一个全局实例，方便使用
 */
export const npmAuthHelper = new NpmAuthHelper();

/**
 * 便捷函数：配置npm客户端不需要认证
 * @param registryUrl 仓库URL，默认为http://localhost:4873/
 * @returns Promise<boolean> 配置是否成功
 */
export async function configureNpmNoAuth(registryUrl: string = 'http://localhost:4873/'): Promise<boolean> {
    const helper = new NpmAuthHelper(registryUrl);
    return await helper.configureNpmNoAuth();
}

/**
 * 便捷函数：为项目创建.npmrc文件
 * @param projectPath 项目路径
 * @param registryUrl 仓库URL，默认为http://localhost:4873/
 * @returns Promise<boolean> 创建是否成功
 */
export async function createProjectNpmrc(projectPath: string, registryUrl: string = 'http://localhost:4873/'): Promise<boolean> {
    const helper = new NpmAuthHelper(registryUrl);
    return await helper.createProjectNpmrc(projectPath);
}