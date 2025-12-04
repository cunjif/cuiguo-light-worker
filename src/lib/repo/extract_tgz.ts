import * as fs from 'node:fs';
import * as path from 'node:path';
import * as zlib from 'node:zlib';
import * as tar from 'tar';

/**
 * 提取tgz文件中的package.json，获取版本号，然后将整个tgz解压到以版本号命名的目录中，实现组件的多版本管理
 * @param tgzPath tgz文件路径
 * @param baseOutputDir 基础输出目录
 * @returns Promise<string> 返回版本号
 */
export async function extractTgzWithVersion(tgzPath: string, baseOutputDir: string): Promise<string> {
    try {
        // 确保基础输出目录存在
        if (!fs.existsSync(baseOutputDir)) {
            fs.mkdirSync(baseOutputDir, { recursive: true });
        }

        // 创建临时目录用于提取package.json
        const tempDir = path.join(baseOutputDir, 'temp_extract');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        // 提取package.json到临时目录
        await new Promise<void>((resolve, reject) => {
            fs.createReadStream(tgzPath)
                .pipe(zlib.createGunzip())
                .pipe(tar.extract({ cwd: tempDir, filter: (p: string) => p === 'package.json' }))
                .on('finish', resolve)
                .on('error', reject);
        });

        // 读取package.json
        const packageJsonPath = path.join(tempDir, 'package.json');
        if (!fs.existsSync(packageJsonPath)) {
            throw new Error('tgz文件中未找到package.json');
        }

        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
        const version = packageJson.version;
        if (!version) {
            throw new Error('package.json中未找到version字段');
        }

        // 创建版本目录
        const versionDir = path.join(baseOutputDir, version);
        if (!fs.existsSync(versionDir)) {
            fs.mkdirSync(versionDir, { recursive: true });
        }

        // 将package.json解压到版本目录
        await new Promise<void>((resolve, reject) => {
            fs.createReadStream(tgzPath)
                .pipe(zlib.createGunzip())
                .pipe(tar.extract({ cwd: versionDir, filter: (p) => p === 'package.json' }))
                .on('finish', resolve)
                .on('error', reject);
        });

        // 清理临时目录
        fs.rmSync(tempDir, { recursive: true, force: true });

        return version;
    } catch (error) {
        throw new Error(`提取tgz文件失败: ${error.message}`);
    }
}

/**
 * 检查文件是否为tgz格式
 * @param filePath 文件路径
 * @returns boolean 是否为tgz文件
 */
export function isTgzFile(filePath: string): boolean {
    try {
        const ext = path.extname(filePath).toLowerCase();
        return ext === '.tgz' || ext === '.tar.gz';
    } catch (error) {
        return false;
    }
}