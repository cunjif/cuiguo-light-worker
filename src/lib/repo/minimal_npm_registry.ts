import * as fs from 'node:fs';
import * as path from 'node:path';
import * as http from 'node:http';
import * as zlib from 'node:zlib';
import * as tar from 'tar';

/**
 * 最小可用的npm仓库服务
 */
class MinimalNpmRegistryServer {
    private server: http.Server | null = null;
    private port: number;
    private storageDir: string;
    private packages: Map<string, Map<string, PackageInfo>> = new Map();

    constructor(port: number = 4873, storageDir?: string) {
        this.port = port;
        this.storageDir = storageDir || path.join(process.cwd(), '.minimal-npm', 'storage');

        // 确保存储目录存在
        if (!fs.existsSync(this.storageDir)) {
            fs.mkdirSync(this.storageDir, { recursive: true });
        }

        // 加载已存在的包信息
        this.loadPackages();
    }

    /**
     * 加载已存在的包信息
     */
    private loadPackages(): void {
        try {
            if (fs.existsSync(this.storageDir)) {
                const packageDirs = fs.readdirSync(this.storageDir);
                for (const pkg of packageDirs) {
                    const pkgDir = path.join(this.storageDir, pkg);
                    if (fs.statSync(pkgDir).isDirectory()) {
                        const versionDirs = fs.readdirSync(pkgDir);
                        const versionMap = new Map<string, PackageInfo>();
                        for (const version of versionDirs) {
                            const versionDir = path.join(pkgDir, version);
                            if (fs.statSync(versionDir).isDirectory()) {
                                const packageJsonPath = path.join(versionDir, 'package.json');
                                if (fs.existsSync(packageJsonPath)) {
                                    try {
                                        const pkgInfo = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
                                        // 确保包信息符合PackageInfo接口要求
                                        const validPkgInfo: PackageInfo = {
                                            name: pkgInfo.name || pkg,
                                            version: pkgInfo.version || version,
                                            ...pkgInfo
                                        };
                                        versionMap.set(version, validPkgInfo);
                                    } catch (error) {
                                        console.error(`加载包信息失败${pkg}@${version}:`, error);
                                    }
                                }
                            }
                        }
                        if (versionMap.size > 0) {
                            this.packages.set(pkg, versionMap);
                        }
                    }
                }
            }
        } catch (error) {
            console.error('加载包信息时出错:', error);
        }
    }

    /**
     * 启动服务
     */
    start(): Promise<boolean> {
        return new Promise((resolve) => {
            this.server = http.createServer(this.handleRequest.bind(this));

            this.server.listen(this.port, () => {
                console.log(`最小化npm仓库已启动，监听端口: ${this.port}`);
                resolve(true);
            });

            this.server.on('error', (error) => {
                console.error('启动最小化npm仓库失败:', error);
                resolve(false);
            });
        });
    }

    /**
     * 停止服务
     */
    stop(): Promise<boolean> {
        return new Promise((resolve) => {
            if (this.server) {
                this.server.close((error) => {
                    if (error) {
                        console.error('停止最小化npm仓库失败:', error);
                        resolve(false);
                    } else {
                        console.log('最小化npm仓库已停止');
                        this.server = null;
                        resolve(true);
                    }
                });
            } else {
                resolve(true);
            }
        });
    }

    /**
     * 处理HTTP请求
     */
    private handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
        const { method, url, headers } = req;

        console.log(`收到请求: ${method} ${url}`);

        // 处理ping请求（npm客户端用来检查仓库是否可用）
        if (url === '/-/ping') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true }));
            return;
        }

        // 处理whoami请求（检查用户是否登录）
        if (url === '/-/whoami' && method === 'GET') {
            // 为了简化，我们总是返回一个默认用户
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end('anonymous');
            return;
        }

        // 处理包发布请求
        if (method === 'PUT' && !url?.startsWith('/-')) {
            this.handlePackagePublish(req, res);
            return;
        }

        // 处理包信息请求
        if (method === 'GET' && !url?.startsWith('/-') && !url?.includes('.tgz')) {
            this.handlePackageInfo(req, res);
            return;
        }

        // 处理包下载请求
        if (method === 'GET' && url?.includes('.tgz')) {
            this.handlePackageDownload(req, res);
            return;
        }

        // 默认响应
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
    }

    /**
     * 提取tgz文件中的package.json并返回版本
     */
    private async extractPackageJson(tgzBuffer: Buffer): Promise<{ packageJson: any, version: string }> {
        const tempDir = path.join(this.storageDir, 'temp_extract_' + Date.now());
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        try {
            // 保存tgz到临时文件
            const tempTgzPath = path.join(tempDir, 'temp.tgz');
            fs.writeFileSync(tempTgzPath, tgzBuffer);

            // 尝试提取package.json，先尝试作为gzipped tar
            let extracted = false;
            
            try {
                // 使用同步方法解压
                const gunzipped = zlib.gunzipSync(tgzBuffer);
                // 将解压后的数据写入临时文件
                const tempTarPath = path.join(tempDir, 'temp.tar');
                fs.writeFileSync(tempTarPath, gunzipped);
                // 提取package.json
                await new Promise<void>((resolve, reject) => {
                    tar.extract({
                        file: tempTarPath,
                        cwd: tempDir,
                        filter: (p: string) => p === 'package.json'
                    }).then(() => resolve()).catch(reject);
                });
                extracted = true;
            } catch (error: any) {
                console.log('尝试使用gzip解压失败:', error.message);
                // 如果不是gzipped，尝试直接作为tar提取
                try {
                    await new Promise<void>((resolve, reject) => {
                        tar.extract({
                            file: tempTgzPath,
                            cwd: tempDir,
                            filter: (p: string) => p === 'package.json'
                        }).then(() => resolve()).catch(reject);
                    });
                    extracted = true;
                } catch (tarError: any) {
                    throw new Error(`提取失败: ${tarError.message}`);
                }
            }

            if (!extracted) {
                throw new Error('无法提取package.json');
            }

            // 读取package.json
            const packageJsonPath = path.join(tempDir, 'package.json');
            if (!fs.existsSync(packageJsonPath)) {
                throw new Error('文件中未找到package.json');
            }

            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
            const version = packageJson.version;
            if (!version) {
                throw new Error('package.json中未找到version字段');
            }

            return { packageJson, version };
        } finally {
            // 清理临时目录
            if (fs.existsSync(tempDir)) {
                fs.rmSync(tempDir, { recursive: true, force: true });
            }
        }
    }

    /**
     * 处理包发布请求(接收tgz文件并解压)
     */
    private async handlePackagePublish(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
        console.log("处理上传的包")
        const packageName = req.url?.substring(1) || '';

        if (!packageName) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: '包名不能为空' }));
            return;
        }

        // 获取原始文件名
        const contentDisposition = req.headers['content-disposition'] || '';
        const filenameMatch = contentDisposition.match(/filename="([^"]+)"/);
        const originalFilename = filenameMatch ? filenameMatch[1] : `${packageName}.tgz`;

        let body = Buffer.alloc(0);
        req.on('data', (chunk) => {
            body = Buffer.concat([body, chunk]);
        });

        req.on('end', async () => {
            try {
                // 提取package.json和版本
                const { packageJson, version } = await this.extractPackageJson(body);

                // 创建版本目录
                const versionDir = path.join(this.storageDir, packageName, version);
                if (!fs.existsSync(versionDir)) {
                    fs.mkdirSync(versionDir, { recursive: true });
                }

                // 保存tgz文件，保持原始文件名
                const tgzFilePath = path.join(versionDir, originalFilename);
                fs.writeFileSync(tgzFilePath, body);

                // 保存package.json
                fs.writeFileSync(
                    path.join(versionDir, 'package.json'),
                    JSON.stringify(packageJson, null, 2)
                );

                // 更新内存中的包信息
                const versionMap = this.packages.get(packageName) || new Map<string, PackageInfo>();
                versionMap.set(version, packageJson as PackageInfo);
                this.packages.set(packageName, versionMap);

                console.log(`成功发布 ${packageName}@${version}`);

                res.writeHead(201, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ ok: true }));
            } catch (error) {
                console.error('发布包失败', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: '发布包失败' }));
            }
        });
    }

    // 移除了不再需要的removeDirectory方法，因为我们不再使用临时解压目录

    /**
     * 处理包信息请求
     */
    private handlePackageInfo(req: http.IncomingMessage, res: http.ServerResponse): void {
        const packageName = req.url?.substring(1) || '';

        if (!packageName) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: '包名不能为空' }));
            return;
        }

        const versionMap = this.packages.get(packageName);

        if (!versionMap || versionMap.size === 0) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: '包不存在' }));
            return;
        }

        // 构造versions对象
        const versions: { [key: string]: PackageInfo } = {};
        let latestVersion = '';

        versionMap.forEach((pkgInfo, version) => {
            versions[version] = pkgInfo;
            // 简单地取最新版本作为latest（可以改进为按时间）
            if (version > latestVersion) {
                latestVersion = version;
            }
        });

        // 构造符合npm规范的包信息响应
        const response = {
            name: packageName,
            versions: versions,
            'dist-tags': {
                latest: latestVersion
            }
        };

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(response));
    }

    /**
     * 处理包下载请求
     */
    private handlePackageDownload(req: http.IncomingMessage, res: http.ServerResponse): void {
        try {
            // 从URL中提取包名和版本
            // URL格式: /packageName/-/packageName-version.tgz
            const urlParts = req.url?.split('/') || [];
            const filename = urlParts[urlParts.length - 1] || '';
            const packageName = urlParts[urlParts.length - 3] || '';

            if (!packageName || !filename) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: '包名或文件名不能为空' }));
                return;
            }

            // 从文件名提取版本 (packageName-version.tgz)
            const versionMatch = filename.match(new RegExp(`^${packageName}-(.+)\.tgz$`));
            if (!versionMatch) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: '文件名格式不正确' }));
                return;
            }
            const version = versionMatch[1];

            // 构建tgz文件路径
            const versionDir = path.join(this.storageDir, packageName, version);

            // 查找版本目录中的tgz文件（可能有多个，但通常一个）
            const files = fs.readdirSync(versionDir).filter(f => f.endsWith('.tgz'));
            if (files.length === 0) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: '包文件不存在' }));
                return;
            }

            const tgzFilePath = path.join(versionDir, files[0]); // 取第一个tgz文件

            // 检查文件是否存在
            if (fs.existsSync(tgzFilePath)) {
                // 读取文件内容
                const fileContent = fs.readFileSync(tgzFilePath);

                // 设置响应头并返回文件
                res.writeHead(200, {
                    'Content-Type': 'application/gzip',
                    'Content-Length': fileContent.length
                });
                res.end(fileContent);
            } else {
                // 如果没有找到tgz文件，返回404
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: '包文件不存在' }));
            }
        } catch (error) {
            console.error('下载包失败', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: '下载包失败' }));
        }
    }
}

// 存储全局服务器实例
let registryServer: MinimalNpmRegistryServer | null = null;

/**
 * 启动最小化npm仓库服务
 */
export async function startMinimalRegistry(port: number = 4873): Promise<boolean> {
    try {
        console.log("启动最小npm仓库")
        // 如果已有实例，先停止
        if (registryServer) {
            await registryServer.stop();
        }

        // 创建新实例并启动
        registryServer = new MinimalNpmRegistryServer(port);
        return await registryServer.start();
    } catch (error) {
        console.error('启动最小化npm仓库失败:', error);
        return false;
    }
}

/**
 * 停止最小化npm仓库服务
 */
export async function stopMinimalRegistry(): Promise<boolean> {
    try {
        if (registryServer) {
            const result = await registryServer.stop();
            registryServer = null;
            return result;
        }
        return true;
    } catch (error) {
        console.error('停止最小化npm仓库失败:', error);
        return false;
    }
}

/**
 * 检查最小化npm仓库服务器是否正在运行
 */
export async function isMinimalRegistryRunning(registryUrl: string = 'http://localhost:4873'): Promise<boolean> {
    try {
        const response = await fetch(`${registryUrl}/-/ping`);
        return response.ok;
    } catch (error) {
        return false;
    }
}

/**
 * 包信息接口
 */
interface PackageInfo {
    name: string;
    version: string;
    [key: string]: any;
}