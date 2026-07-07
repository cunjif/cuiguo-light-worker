#!/usr/bin/env node
/**
 * MCP Server Launcher
 * 
 * This script launches MCP servers from the bundled packages.
 * It handles:
 * 1. Finding the installed MCP server
 * 2. Running it with the correct Node.js path
 * 3. Supporting both Windows and Unix platforms
 * 
 * Usage: node mcp-launcher.js <server-name> [args...]
 * Example: node mcp-launcher.js playwright-mcp --port 3000
 */

import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import os from 'node:os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get the app resources directory
function getResourcesDir() {
  // In packaged Electron app
  if (process.resourcesPath) {
    return path.join(process.resourcesPath, 'mcp-builtin');
  }
  // In development
  return path.join(__dirname, '..', '..', '..', 'mcp-builtin');
}

// Get the installed MCP servers directory
function getInstalledMcpDir() {
  const userDataPath = process.env.USER_DATA_PATH || os.homedir();
  return path.join(userDataPath, 'mcp-servers');
}

// Find the MCP server entry point
function findMcpServer(serverName) {
  const installedDir = getInstalledMcpDir();
  
  // Try to find in installed directory
  const serverPath = path.join(installedDir, 'node_modules', serverName);
  const packageJsonPath = path.join(serverPath, 'package.json');
  
  if (fs.existsSync(packageJsonPath)) {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const bin = packageJson.bin;
    
    if (bin) {
      // Handle both string and object bin formats
      const binPath = typeof bin === 'string' ? bin : bin[serverName] || bin[Object.keys(bin)[0]];
      if (binPath) {
        return path.join(serverPath, binPath);
      }
    }
    
    // Fallback to main
    if (packageJson.main) {
      return path.join(serverPath, packageJson.main);
    }
  }
  
  return null;
}

// Main function
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.error('Usage: node mcp-launcher.js <server-name> [args...]');
    process.exit(1);
  }
  
  const serverName = args[0];
  const serverArgs = args.slice(1);
  
  console.log(`Launching MCP server: ${serverName}`);
  console.log(`Arguments: ${serverArgs.join(' ')}`);
  
  // Find the server entry point
  const serverEntry = findMcpServer(serverName);
  
  if (!serverEntry) {
    console.error(`MCP server not found: ${serverName}`);
    console.error(`Please install it first or check the name.`);
    process.exit(1);
  }
  
  console.log(`Server entry: ${serverEntry}`);
  
  // Spawn the server process
  const child = spawn(process.execPath, [serverEntry, ...serverArgs], {
    stdio: ['inherit', 'inherit', 'inherit'],
    env: {
      ...process.env,
      NODE_ENV: 'production',
    },
  });
  
  child.on('error', (err) => {
    console.error(`Failed to start MCP server: ${err.message}`);
    process.exit(1);
  });
  
  child.on('exit', (code, signal) => {
    console.log(`MCP server exited with code ${code} and signal ${signal}`);
    process.exit(code || 0);
  });
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
