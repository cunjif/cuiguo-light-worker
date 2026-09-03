/**
 * MCP Server Manager
 * 
 * Handles:
 * 1. Publishing built-in MCP servers to internal registry on first launch
 * 2. Installing MCP servers to user data directory
 * 3. Generating config.json with local paths
 * 4. Dynamic server installation/uninstallation
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { app } from 'electron';
import { exec, execSync } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import os from 'node:os';

const execAsync = promisify(exec);

// ESM 下 __dirname 不是全局变量，需手动构造
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Built-in MCP server definitions
interface BuiltinMcpServer {
  name: string;
  package: string;
  dir: string;
  entry: string;
  version?: string;
  args?: string[];
  enabled: boolean;
}

// Default built-in servers (offline self-contained)
// dir: 相对 resources/mcp-builtin 的子目录；entry: 相对 dir 的入口文件
const BUILTIN_SERVERS: BuiltinMcpServer[] = [
  {
    name: 'markitdown',
    package: 'markitdown-mcp-server',
    dir: 'markitdown-mcp-server',
    entry: 'dist/index.js',
    args: [],
    enabled: true,
  },
  {
    name: 'filesystem',
    package: '@modelcontextprotocol/server-filesystem',
    dir: 'filesystem-server',
    entry: 'node_modules/@modelcontextprotocol/server-filesystem/dist/index.js',
    args: ['./', 'C:\\', '/', '*/**'],
    enabled: true,
  },
  {
    name: 'aigroup-mdtoword-mcp',
    package: 'aigroup-mdtoword-mcp',
    dir: 'aigroup-mdtoword-mcp',
    entry: 'dist/index.js',
    args: [],
    enabled: true,
  },
  {
    name: 'Bazi',
    package: 'bazi-mcp',
    dir: 'bazi-server',
    entry: 'node_modules/bazi-mcp/dist/stdio.js',
    args: [],
    enabled: true,
  },
];

// Get the user data directory for MCP servers
function getMcpServersDir(): string {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'mcp-servers');
}

// Get the built-in servers directory (self-contained, offline)
function getBuiltinServersDir(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'mcp-builtin');
  }
  return path.join(__dirname, '..', '..', 'src', 'mcp-builtin');
}

// Get the built-in packages directory
function getBuiltinPackagesDir(): string {
  // In packaged app
  if (process.resourcesPath) {
    return path.join(process.resourcesPath, 'mcp-builtin', 'packages');
  }
  // In development
  return path.join(__dirname, '..', '..', 'mcp-builtin', 'packages');
}

// Check if MCP servers have been initialized
function isInitialized(): boolean {
  const mcpDir = getMcpServersDir();
  const markerFile = path.join(mcpDir, '.initialized');
  return fs.existsSync(markerFile);
}

// Mark MCP servers as initialized
function markInitialized(): void {
  const mcpDir = getMcpServersDir();
  if (!fs.existsSync(mcpDir)) {
    fs.mkdirSync(mcpDir, { recursive: true });
  }
  const markerFile = path.join(mcpDir, '.initialized');
  fs.writeFileSync(markerFile, new Date().toISOString());
}

// Get npm path (cross-platform)
function getNpmPath(): string {
  const isWindows = os.platform() === 'win32';
  return isWindows ? 'npm.cmd' : 'npm';
}

// Get npx path (cross-platform)
function getNpxPath(): string {
  const isWindows = os.platform() === 'win32';
  return isWindows ? 'npx.cmd' : 'npx';
}

// Publish built-in packages to internal registry
// Returns the number of packages successfully published
async function publishBuiltinToRegistry(registryUrl: string = 'http://localhost:4873'): Promise<number> {
  const packagesDir = getBuiltinPackagesDir();
  
  if (!fs.existsSync(packagesDir)) {
    console.log('No built-in packages directory found, skipping publish');
    return 0;
  }
  
  const tgzFiles = fs.readdirSync(packagesDir).filter(f => f.endsWith('.tgz'));
  
  if (tgzFiles.length === 0) {
    console.log('No built-in packages found, skipping publish');
    return 0;
  }
  
  console.log(`Found ${tgzFiles.length} built-in packages to publish`);
  
  const npmPath = getNpmPath();
  let publishedCount = 0;
  
  for (const file of tgzFiles) {
    const filePath = path.join(packagesDir, file);
    try {
      console.log(`Publishing ${file}...`);
      await execAsync(`"${npmPath}" publish "${filePath}" --registry ${registryUrl}`);
      console.log(`✓ ${file} published`);
      publishedCount++;
    } catch (error) {
      console.warn(`Failed to publish ${file}: ${error.message}`);
      // Continue with other packages
    }
  }
  
  return publishedCount;
}

// Install MCP servers to user data directory
async function installMcpServers(
  registryUrl: string = 'http://localhost:4873',
  servers: BuiltinMcpServer[] = BUILTIN_SERVERS
): Promise<BuiltinMcpServer[]> {
  const mcpDir = getMcpServersDir();
  
  if (!fs.existsSync(mcpDir)) {
    fs.mkdirSync(mcpDir, { recursive: true });
  }
  
  // Create package.json for the mcp-servers directory
  const packageJsonPath = path.join(mcpDir, 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    fs.writeFileSync(packageJsonPath, JSON.stringify({
      name: 'mcp-servers',
      version: '1.0.0',
      private: true,
    }, null, 2));
  }
  
  const npmPath = getNpmPath();
  const enabledServers = servers.filter(s => s.enabled);
  
  console.log(`Installing ${enabledServers.length} MCP servers...`);
  
  let anyFailed = false;
  const installedServers: BuiltinMcpServer[] = [];

  for (const server of enabledServers) {
    try {
      console.log(`Installing ${server.package}...`);
      await execAsync(
        `"${npmPath}" install ${server.package} --registry ${registryUrl} --no-save`,
        { cwd: mcpDir }
      );
      console.log(`✓ ${server.package} installed`);
      installedServers.push(server);
    } catch (error) {
      console.error(`Failed to install ${server.package}: ${error.message}`);
      anyFailed = true;
    }
  }
  
  if (installedServers.length === 0) {
    return [];
  }
  
  return installedServers;
}

// Generate config.json pointing at self-contained server directories
function generateConfig(servers: BuiltinMcpServer[] = BUILTIN_SERVERS): Record<string, any> {
  const serversDir = getBuiltinServersDir();

  const mcpServers: Record<string, any> = {};

  for (const server of servers) {
    if (!server.enabled) continue;

    const entry = path.join(serversDir, server.dir, server.entry);
    mcpServers[server.name] = {
      command: process.execPath, // Use Electron's bundled Node.js
      args: [
        entry,
        ...(server.args || []),
      ],
      // 必须继承系统环境变量（PATH/SystemRoot/TEMP 等），否则 Windows 下子进程 Node 会崩溃；
      // ELECTRON_RUN_AS_NODE=1 让 electron.exe 以 Node.js 模式运行 js 入口而非启动 Electron 窗口
      env: {
        ...process.env,
        NODE_ENV: 'production',
        ELECTRON_RUN_AS_NODE: '1',
      },
    };
  }

  return { mcpServers };
}

// Save config.json
function saveConfig(configPath: string, config: Record<string, any>): boolean {
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
    console.log('Config saved:', configPath);
    return true;
  } catch (error) {
    console.error('Error saving config:', error);
    return false;
  }
}

// Read config.json
function readConfig(configPath: string): Record<string, any> | null {
  try {
    const content = fs.readFileSync(configPath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.error('Error reading config:', error);
    return null;
  }
}

// Main initialization function (offline self-contained mode)
export async function initializeMcpServers(
  configPath: string,
  registryUrl: string = 'http://localhost:4873'
): Promise<boolean> {
  try {
    // 注意：不使用 .initialized 标记跳过。build 脚本每次会用 src/main/config.json
    // 覆盖 dist/main/config.json，若此处跳过则内置配置丢失后永不恢复。
    // 下面的合并逻辑本身幂等（先剔除同名内置项再写入），每次执行安全。
    console.log('Initializing built-in MCP servers (offline self-contained mode)...');

    const enabledServers = BUILTIN_SERVERS.filter(s => s.enabled);
    const serversDir = getBuiltinServersDir();

    // 验证各 server 入口存在
    let allOk = true;
    for (const s of enabledServers) {
      const entry = path.join(serversDir, s.dir, s.entry);
      if (fs.existsSync(entry)) {
        console.log(`✓ ${s.name}: ${entry}`);
      } else {
        console.error(`✗ ${s.name}: entry not found at ${entry}`);
        allOk = false;
      }
    }

    if (!allOk) {
      console.error('Some built-in servers are missing, aborting init');
      return false;
    }

    // 生成内置 server 配置，合并到现有 config（保留用户手动配的外部 server，如 playwright npx）
    const builtinConfig = generateConfig(enabledServers);
    const existingConfig = readConfig(configPath);
    const existingServers = (existingConfig?.mcpServers) || {};
    const builtinNames = new Set(enabledServers.map(s => s.name));
    const mergedServers: Record<string, any> = {};
    for (const [name, cfg] of Object.entries(existingServers)) {
      if (!builtinNames.has(name)) {
        mergedServers[name] = cfg;
      }
    }
    Object.assign(mergedServers, builtinConfig.mcpServers);
    saveConfig(configPath, { mcpServers: mergedServers });
    markInitialized();

    console.log('MCP servers initialized successfully (offline)');
    return true;
  } catch (error) {
    console.error('Failed to initialize MCP servers:', error);
    return false;
  }
}

// Install a single MCP server dynamically
export async function installMcpServer(
  packageName: string,
  registryUrl: string = 'http://localhost:4873'
): Promise<boolean> {
  const mcpDir = getMcpServersDir();
  const npmPath = getNpmPath();
  
  try {
    console.log(`Installing ${packageName}...`);
    await execAsync(
      `"${npmPath}" install ${packageName} --registry ${registryUrl} --no-save`,
      { cwd: mcpDir }
    );
    console.log(`✓ ${packageName} installed`);
    return true;
  } catch (error) {
    console.error(`Failed to install ${packageName}: ${error.message}`);
    return false;
  }
}

// Uninstall a single MCP server
export async function uninstallMcpServer(packageName: string): Promise<boolean> {
  const mcpDir = getMcpServersDir();
  const npmPath = getNpmPath();
  
  try {
    console.log(`Uninstalling ${packageName}...`);
    await execAsync(`"${npmPath}" uninstall ${packageName}`, { cwd: mcpDir });
    console.log(`✓ ${packageName} uninstalled`);
    return true;
  } catch (error) {
    console.error(`Failed to uninstall ${packageName}: ${error.message}`);
    return false;
  }
}

// List installed MCP servers
export function listInstalledMcpServers(): string[] {
  const mcpDir = getMcpServersDir();
  const nodeModulesDir = path.join(mcpDir, 'node_modules');
  
  if (!fs.existsSync(nodeModulesDir)) {
    return [];
  }
  
  const packages: string[] = [];
  
  // Read scoped packages (@scope/package)
  const scopeDirs = fs.readdirSync(nodeModulesDir).filter(d => d.startsWith('@'));
  for (const scope of scopeDirs) {
    const scopeDir = path.join(nodeModulesDir, scope);
    const pkgDirs = fs.readdirSync(scopeDir);
    for (const pkg of pkgDirs) {
      packages.push(`${scope}/${pkg}`);
    }
  }
  
  // Read regular packages
  const regularDirs = fs.readdirSync(nodeModulesDir).filter(d => !d.startsWith('@'));
  for (const pkg of regularDirs) {
    packages.push(pkg);
  }
  
  return packages;
}

// Get the MCP servers directory
export { getMcpServersDir };

// Export built-in server definitions
export { BUILTIN_SERVERS };
export type { BuiltinMcpServer };

/**
 * Rebuild the filesystem MCP server with a new root path.
 * Updates BUILTIN_SERVERS args and regenerates config.json.
 */
export async function rebuildFilesystemServer(rootPath: string): Promise<boolean> {
  try {
    const fsServer = BUILTIN_SERVERS.find(s => s.name === 'filesystem');
    if (!fsServer) {
      console.error('Filesystem server not found in BUILTIN_SERVERS');
      return false;
    }

    fsServer.args = [rootPath];
    console.log(`Filesystem MCP server root path updated to: ${rootPath}`);

    const { app } = await import('electron');
    let appPath;
    if (app.isPackaged) {
      appPath = path.dirname(process.execPath);
    } else {
      appPath = path.dirname(fileURLToPath(import.meta.url));
    }
    const configPath = path.join(appPath, 'config.json');

    const builtinConfig = generateConfig(BUILTIN_SERVERS.filter(s => s.enabled));
    const existingConfig = readConfig(configPath);
    const existingServers = existingConfig?.mcpServers || {};
    const builtinNames = new Set(BUILTIN_SERVERS.filter(s => s.enabled).map(s => s.name));
    const mergedServers: Record<string, any> = {};
    for (const [name, cfg] of Object.entries(existingServers)) {
      if (!builtinNames.has(name)) {
        mergedServers[name] = cfg;
      }
    }
    Object.assign(mergedServers, builtinConfig.mcpServers);
    saveConfig(configPath, { mcpServers: mergedServers });

    console.log('Filesystem MCP server rebuilt successfully');
    return true;
  } catch (error) {
    console.error('Failed to rebuild filesystem server:', error);
    return false;
  }
}
