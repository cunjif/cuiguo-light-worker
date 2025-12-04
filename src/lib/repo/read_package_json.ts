import * as path from 'node:path';
import * as tar from 'tar';
import * as fs from 'node:fs';


export async function readPackageJsonFromTgz(tgzFilePath: string) {
    try {
        let packageJsonContent = null;
        
        // 解压并查找package.json
        await tar.extract({
            file: tgzFilePath,
            filter: (path, entry) => {
                // 只处理package.json文件
                if (path.endsWith('package.json')) {
                    return true;
                }
                return false;
            },
            onentry: (entry) => {
                // 读取package.json内容
                const chunks: Array<Buffer<ArrayBufferLike>> = [];
                entry.on('data', (chunk) => chunks.push(chunk));
                entry.on('end', () => {
                    packageJsonContent = Buffer.concat(chunks).toString();
                });
            }
        });
        
        if (packageJsonContent) {
            const packageJson = JSON.parse(packageJsonContent);
            console.log('Package name:', packageJson.name);
            console.log('Version:', packageJson.version);
            return packageJson;
        } else {
            throw new Error('package.json not found in archive');
        }
    } catch (error) {
        console.error('Error reading package.json:', error);
        throw error;
    }
}