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
import os from 'node:os';

const execAsync = promisify(exec);

// Built-in MCP server definitions
interface BuiltinMcpServer {
  name: string;
  package: string;
  version?: string;
  args?: string[];
  enabled: boolean;
}

// Default built-in servers
const BUILTIN_SERVERS: BuiltinMcpServer[] = [
  {
    name: 'playwright',
    package: 'playwright-mcp',
    args: [],
    enabled: true,
  },
  {
    name: 'filesystem',
    package: '@modelcontextprotocol/server-filesystem',
    args: ['./', 'C:\\', '/', '*/**'],
    enabled: true,
  },
  {
    name: 'aigroup-mdtoword-mcp',
    package: 'aigroup-mdtoword-mcp',
    args: [],
    enabled: true,
  },
  {
    name: 'Bazi',
    package: 'bazi-mcp',
    args: [],
    enabled: true,
  },
];

// Get the user data directory for MCP servers
function getMcpServersDir(): string {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'mcp-servers');
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
async function publishBuiltinToRegistry(registryUrl: string = 'http://localhost:4873'): Promise<boolean> {
  const packagesDir = getBuiltinPackagesDir();
  
  if (!fs.existsSync(packagesDir)) {
    console.log('No built-in packages directory found, skipping');
    return true;
  }
  
  const tgzFiles = fs.readdirSync(packagesDir).filter(f => f.endsWith('.tgz'));
  
  if (tgzFiles.length === 0) {
    console.log('No built-in packages found, skipping');
    return true;
  }
  
  console.log(`Found ${tgzFiles.length} built-in packages to publish`);
  
  const npmPath = getNpmPath();
  
  for (const file of tgzFiles) {
    const filePath = path.join(packagesDir, file);
    try {
      console.log(`Publishing ${file}...`);
      await execAsync(`"${npmPath}" publish "${filePath}" --registry ${registryUrl}`);
      console.log(`✓ ${file} published`);
    } catch (error) {
      console.warn(`Failed to publish ${file}: ${error.message}`);
      // Continue with other packages
    }
  }
  
  return true;
}

// Install MCP servers to user data directory
async function installMcpServers(
  registryUrl: string = 'http://localhost:4873',
  servers: BuiltinMcpServer[] = BUILTIN_SERVERS
): Promise<boolean> {
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
  
  for (const server of enabledServers) {
    try {
      console.log(`Installing ${server.package}...`);
      await execAsync(
        `"${npmPath}" install ${server.package} --registry ${registryUrl} --no-save`,
        { cwd: mcpDir }
      );
      console.log(`✓ ${server.package} installed`);
    } catch (error) {
      console.error(`Failed to install ${server.package}: ${error.message}`);
      return false;
    }
  }
  
  return true;
}

// Generate config.json with local paths
function generateConfig(servers: BuiltinMcpServer[] = BUILTIN_SERVERS): Record<string, any> {
  const mcpDir = getMcpServersDir();
  const npmPath = getNpmPath();
  
  const mcpServers: Record<string, any> = {};
  
  for (const server of servers) {
    if (!server.enabled) continue;
    
    // Use node to run the installed MCP server
    mcpServers[server.name] = {
      command: process.execPath, // Use Electron's bundled Node.js
      args: [
        path.join(mcpDir, 'node_modules', server.package),
        ...(server.args || []),
      ],
      env: {
        NODE_ENV: 'production',
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

// Main initialization function
export async function initializeMcpServers(
  configPath: string,
  registryUrl: string = 'http://localhost:4873'
): Promise<boolean> {
  try {
    // Check if already initialized
    if (isInitialized()) {
      console.log('MCP servers already initialized, skipping');
      return true;
    }
    
    console.log('Initializing built-in MCP servers...');
    
    // Step 1: Publish built-in packages to internal registry
    await publishBuiltinToRegistry(registryUrl);
    
    // Step 2: Install MCP servers to user data directory
    const installSuccess = await installMcpServers(registryUrl);
    if (!installSuccess) {
      console.error('Failed to install MCP servers');
      return false;
    }
    
    // Step 3: Generate and save config
    const config = generateConfig();
    saveConfig(configPath, config);
    
    // Step 4: Mark as initialized
    markInitialized();
    
    console.log('MCP servers initialized successfully');
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
