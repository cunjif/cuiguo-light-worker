import * as fs from 'node:fs';
import * as path from 'node:path';
import { execSync } from 'node:child_process';

/**
 * 使用系统自带的解压工具解压zip文件
 * @param zipPath zip文件路径
 * @param extractDir 解压目标目录
 * @returns Promise<void>
 */
export async function extractZip(zipPath: string, extractDir: string): Promise<void> {
    return new Promise((resolve, reject) => {
        try {
            // 确保目标目录存在
            if (!fs.existsSync(extractDir)) {
                fs.mkdirSync(extractDir, { recursive: true });
            }

            // 检查操作系统并使用相应的解压命令
            const isWindows = process.platform === 'win32';
            
            if (isWindows) {
                // Windows系统使用PowerShell的Expand-Archive命令
                const command = `powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${extractDir}' -Force"`;
                execSync(command, { stdio: 'inherit' });
            } else {
                // Linux/Mac系统使用unzip命令
                execSync(`unzip -o "${zipPath}" -d "${extractDir}"`, { stdio: 'inherit' });
            }
            
            resolve();
        } catch (error) {
            reject(new Error(`解压zip文件失败: ${error.message}`));
        }
    });
}

/**
 * 检查文件是否为zip格式
 * @param filePath 文件路径
 * @returns boolean 是否为zip文件
 */
export function isZipFile(filePath: string): boolean {
    try {
        const ext = path.extname(filePath).toLowerCase();
        return ext === '.zip';
    } catch (error) {
        return false;
    }
}

/**
 * 获取zip文件中的文件列表（不实际解压）
 * @param zipPath zip文件路径
 * @returns Promise<string[]> 文件列表
 */
export async function listZipContents(zipPath: string): Promise<string[]> {
    return new Promise((resolve, reject) => {
        try {
            const isWindows = process.platform === 'win32';
            let command;
            
            if (isWindows) {
                // Windows系统使用PowerShell列出zip内容
                command = `powershell -Command "Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::OpenRead('${zipPath}').Entries | ForEach-Object { $_.FullName }"`;
            } else {
                // Linux/Mac系统使用unzip -l命令
                command = `unzip -l "${zipPath}" | awk 'NR>3 && NF>1 && $NF!~/^$/ {print $NF}'`;
            }
            
            const result = execSync(command, { encoding: 'utf8' });
            const files = result.trim().split('\n').filter(file => file.length > 0);
            resolve(files);
        } catch (error) {
            reject(new Error(`获取zip文件内容列表失败: ${error.message}`));
        }
    });
}