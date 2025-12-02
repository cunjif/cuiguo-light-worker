import * as fs from 'node:fs'
import * as path from 'node:path'
import { execSync } from 'node:child_process';
import { extractZip } from './extract_zip.js';

/**
 * 解压包含.tgz文件的zip压缩包
 * @param zipPath zip文件路径
 * @param extractDir 解压目标目录
 * @returns Promise<boolean> 解压是否成功
 */
async function extractDependencies(zipPath: string, extractDir: string): Promise<boolean> {
    try {
        console.log(`正在解压依赖包: ${zipPath}`);
        
        // 确保目标目录存在
        if (!fs.existsSync(extractDir)) {
            fs.mkdirSync(extractDir, { recursive: true });
        }
        
        // 解压zip文件
        await extractZip(zipPath, extractDir);
        console.log(`依赖包已成功解压到: ${extractDir}`);
        return true;
    } catch (error) {
        console.error(`解压依赖包失败: ${error.message}`);
        return false;
    }
}

/**
 * 将.tgz文件发布到本地npm仓库
 * @param dir 包含.tgz文件的目录
 * @param registryUrl npm仓库URL
 * @returns Promise<boolean> 发布是否成功
 */
async function publishToRepo(dir: string, registryUrl: string = 'http://localhost:4873'): Promise<boolean> {
    try {
        // 读取所有 .tgz 文件
        const files = fs.readdirSync(dir).filter((f: string) => f.endsWith('.tgz'));

        console.log(`找到 ${files.length} 个包文件`);

        if (files.length === 0) {
            console.warn('没有找到.tgz文件');
            return false;
        }

        // 设置 npm 仓库为本地 verdaccio
        execSync(`npx npm set registry ${registryUrl}`);

        // 逐个发布包
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const filePath = path.join(dir, file);
            
            try {
                console.log(`[${i + 1}/${files.length}] 发布 ${file}...`);
                execSync(`npx npm publish ${filePath}`, { stdio: 'inherit' });
                console.log(`✓ ${file} 发布成功`);
            } catch (error) {
                console.error(`✗ 发布 ${file} 失败:`, error.message);
                // 继续发布其他包，不中断整个流程
            }
        }
        
        console.log(`发布完成！仓库地址: ${registryUrl}`);
        return true;
    } catch (error) {
        console.error(`发布过程中发生错误: ${error.message}`);
        return false;
    }
}

/**
 * 完整的依赖包处理流程：解压zip包并发布到本地npm仓库
 * @param zipPath 包含.tgz文件的zip压缩包路径
 * @param tempDir 临时解压目录
 * @param registryUrl npm仓库URL
 * @returns Promise<boolean> 整个流程是否成功
 */
async function processDependencies(zipPath: string, tempDir?: string, registryUrl: string = 'http://localhost:4873'): Promise<boolean> {
    try {
        // 如果没有指定临时目录，使用默认目录
        const extractDir = tempDir || path.join(path.dirname(zipPath), 'temp_deps');
        
        // 1. 解压zip文件
        const extractSuccess = await extractDependencies(zipPath, extractDir);
        if (!extractSuccess) {
            console.error('解压步骤失败，终止流程');
            return false;
        }
        
        // 2. 检查本地npm仓库状态
        console.log('检查本地npm仓库状态...');
        const isRunning = await checkRegistryStatus(registryUrl);
        if (!isRunning) {
            console.warn(`本地npm仓库(${registryUrl})未运行，请先启动仓库服务`);
        }
        
        // 3. 发布.tgz文件到本地仓库
        const publishSuccess = await publishToRepo(extractDir, registryUrl);
        if (!publishSuccess) {
            console.error('发布步骤失败');
            return false;
        }
        
        console.log('依赖包处理流程完成！');
        return true;
    } catch (error) {
        console.error(`依赖包处理流程失败: ${error.message}`);
        return false;
    }
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

export {
    extractDependencies,
    publishToRepo,
    processDependencies,
    checkRegistryStatus
};