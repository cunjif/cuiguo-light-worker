import * as fs from 'node:fs';
import * as path from 'node:path';
import * as http from 'node:http';
import * as querystring from 'node:querystring';
import { Readable } from 'node:stream';
import { createGunzip } from 'node:zlib';

/**
 * 最小可用的npm仓库服务
 */
class MinimalNpmRegistryServer {
    private server: http.Server | null = null;
    private port: number;
    private storageDir: string;
    private packages: Map<string, PackageInfo> = new Map();

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
                const packages = fs.readdirSync(this.storageDir);
                for (const pkg of packages) {
                    const pkgDir = path.join(this.storageDir, pkg);
                    if (fs.statSync(pkgDir).isDirectory()) {
                        const packageJsonPath = path.join(pkgDir, 'package.json');
                        if (fs.existsSync(packageJsonPath)) {
                            try {
                                const pkgInfo = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
                                // 确保包信息符合PackageInfo接口要求
                                const validPkgInfo: PackageInfo = {
                                    name: pkgInfo.name || pkg,
                                    version: pkgInfo.version || '1.0.0',
                                    ...pkgInfo
                                };
                                this.packages.set(pkg, validPkgInfo);
                            } catch (error) {
                                console.error(`加载包信息失败${pkg}:`, error);
                            }
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
     * 处理包发布请求(接收tgz文件并解压)
     */
    private handlePackagePublish(req: http.IncomingMessage, res: http.ServerResponse): void {
        const packageName = req.url?.substring(1) || '';

        if (!packageName) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: '包名不能为空' }));
            return;
        }

        let body = Buffer.alloc(0);
        req.on('data', (chunk) => {
            body = Buffer.concat([body, chunk]);
        });

        req.on('end', () => {
            try {
                const packageDir = path.join(this.storageDir, packageName);
                if (!fs.existsSync(packageDir)) {
                    fs.mkdirSync(packageDir, { recursive: true });
                }

                const tgzFileName = `${packageName}.tgz`;
                const tgzFilePath = path.join(packageDir, tgzFileName);
                fs.writeFileSync(tgzFilePath, body);

                let version = '1.0.0';
                const extractedTgzFileName = path.basename(tgzFilePath);
                const versionMatch = extractedTgzFileName.match(/^(?:@[^/]+\/)?[^@]+@([\d.]+[\w\.-]*)/);
                if (versionMatch) {
                    version = versionMatch[1];
                }

                let packageData = {
                    name: packageName,
                    version: version,
                    description: '自动从tgz文件创建的包信息',
                    main: 'index.js'
                };

                console.log(`创建包信息 ${packageName}@${version}`);

                // 保存包信息
                fs.writeFileSync(
                    path.join(packageDir, 'package.json'),
                    JSON.stringify(packageData, null, 2)
                );

                // 确保packageData符合PackageInfo接口要求
                const validPackageData: PackageInfo = {
                    ...packageData,
                    name: packageData.name || packageName,
                    version: packageData.version || '1.0.0'
                };
                // 更新内存中的包信息
                this.packages.set(packageName, validPackageData);

                console.log(`成功发布 ${packageName}@${packageData.version}`);

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

        const packageInfo = this.packages.get(packageName);

        if (!packageInfo) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: '包不存在' }));
            return;
        }

        // 构造符合npm规范的包信息响应
        const response = {
            name: packageInfo.name,
            versions: {
                [packageInfo.version]: packageInfo
            },
            'dist-tags': {
                latest: packageInfo.version
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
            // 从URL中提取包名
            const urlParts = req.url?.split('/') || [];
            const packageName = urlParts[urlParts.length - 2] || '';

            if (!packageName) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: '包名不能为空' }));
                return;
            }

            // 构建tgz文件路径
            const packageDir = path.join(this.storageDir, packageName);
            const tgzFilePath = path.join(packageDir, `${packageName}.tgz`);

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
