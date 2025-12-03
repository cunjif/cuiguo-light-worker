// 重定向到最小化npm仓库实现
import * as path from 'node:path';
import * as os from 'node:os';
import * as fs from 'node:fs';
import { startMinimalRegistry, stopMinimalRegistry, isMinimalRegistryRunning } from './minimal_npm_registry.js';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

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

uplinks:
  npmjs:
    url: https://registry.npmjs.org/

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
    console.log(`正在启动最小化npm仓库，端口: ${port}...`);
    // 直接调用最小化仓库的启动函数
    return await startMinimalRegistry(port);
}

/**
 * 停止Verdaccio服务
 * @returns Promise<boolean> 是否停止成功
 */
export async function stopVerdaccio(): Promise<boolean> {
    // 直接调用最小化仓库的停止函数
    return await stopMinimalRegistry();
}

/**
 * 获取Verdaccio进程状态
 * @returns Promise<boolean> 是否正在运行
 */
export async function isVerdaccioRunning(): Promise<boolean> {
    // 直接调用最小化仓库的状态检查函数
    return await isMinimalRegistryRunning();
}