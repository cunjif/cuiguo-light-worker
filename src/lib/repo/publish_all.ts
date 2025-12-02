import * as fs from 'node:fs'
import { execSync } from 'node:child_process';
import { startVerdaccio, isVerdaccioRunning } from './repo.js';

async function push_to_repo(dir: string): Promise<boolean> {
    // 确保 Verdaccio 正在运行
    if (!isVerdaccioRunning()) {
        console.log('Verdaccio 未运行，正在启动...');
        const started = await startVerdaccio();
        if (!started) {
            console.error('无法启动 Verdaccio');
            return false;
        }
        // 等待 Verdaccio 完全启动
        await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // 读取所有 .tgz 文件
    const files = fs.readdirSync(dir).filter((f: string) => f.endsWith('.tgz'));

    console.log(`找到 ${files.length} 个包文件`);

    // 设置 npm 仓库为本地 verdaccio
    execSync('npm set registry http://localhost:4873');

    files.forEach((file, index) => {
        try {
            console.log(`[${index + 1}/${files.length}] 发布 ${file}...`);
            execSync(`npm publish ${file}`, { stdio: 'inherit' });
        } catch (error) {
            console.error(`发布 ${file} 失败:`, error.message);
            return false;
        }
    });
    console.log('发布完成！仓库地址: http://localhost:4873');
    return true;
}