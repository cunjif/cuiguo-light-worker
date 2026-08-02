#!/usr/bin/env node
/**
 * Pack MCP Servers
 * 
 * This script downloads and packs MCP server packages into .tgz files
 * for bundling with the Electron app.
 * 
 * Usage: node scripts/pack-mcp-servers.js
 */

import { exec, execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

// MCP servers to bundle (from npm registry)
const MCP_SERVERS = [
  'playwright-mcp@0.0.10',
  '@modelcontextprotocol/server-filesystem@latest',
  'bazi-mcp@latest',
];

// Local MCP servers to bundle (from local source directories)
const LOCAL_MCP_SERVERS = [
  { name: 'markitdown-mcp-server', dir: 'src/mcp-builtin/markitdown-mcp-server' },
  { name: 'aigroup-mdtoword-mcp', dir: 'src/mcp-builtin/aigroup-mdtoword-mcp' },
];

// Additional dependencies to pack from the main project's node_modules
// (for packages not available on the public npm registry)
const EXTRA_PACKAGES_TO_PACK = [];

// Output directory
const OUTPUT_DIR = path.join(process.cwd(), 'src', 'mcp-builtin', 'packages');

async function packLocalServers() {
  const projectNodeModules = path.join(process.cwd(), 'node_modules');

  for (const local of LOCAL_MCP_SERVERS) {
    const localDir = path.join(process.cwd(), local.dir);
    if (!fs.existsSync(localDir)) {
      console.warn(`Local package directory not found: ${local.dir}, skipping`);
      continue;
    }

    const localNodeModules = path.join(localDir, 'node_modules');
    let createdSymlink = false;

    if (!fs.existsSync(localNodeModules) && fs.existsSync(projectNodeModules)) {
      try {
        fs.symlinkSync(projectNodeModules, localNodeModules, 'junction');
        createdSymlink = true;
        console.log(`Linked node_modules for ${local.name}`);
      } catch (error) {
        console.warn(`Failed to link node_modules for ${local.name}:`, error.message);
        continue;
      }
    }

    try {
      console.log(`Building local package: ${local.name}...`);
      await execAsync('npm run build', { cwd: localDir });
      console.log(`✓ Built ${local.name}`);
    } catch (error) {
      console.error(`Failed to build ${local.name}:`, error.message);
      if (createdSymlink) {
        try { fs.unlinkSync(localNodeModules); } catch {}
      }
      continue;
    }

    try {
      console.log(`Packing local package: ${local.name}...`);
      const { stdout } = await execAsync(`npm pack "${localDir}" --ignore-scripts`, { cwd: OUTPUT_DIR });
      const packedFile = stdout.trim();
      console.log(`✓ Packed: ${packedFile}`);
    } catch (error) {
      console.error(`Failed to pack ${local.name}:`, error.message);
    }

    if (createdSymlink) {
      try { fs.unlinkSync(localNodeModules); } catch {}
    }
  }
}

async function packExtraDependencies() {
  const projectNodeModules = path.join(process.cwd(), 'node_modules');

  for (const pkg of EXTRA_PACKAGES_TO_PACK) {
    const pkgDir = path.join(projectNodeModules, pkg);
    if (!fs.existsSync(pkgDir)) {
      console.warn(`Extra dependency not found in node_modules: ${pkg}, skipping`);
      continue;
    }

    try {
      console.log(`Packing extra dependency: ${pkg}...`);
      const { stdout } = await execAsync(`npm pack "${pkgDir}"`, { cwd: OUTPUT_DIR });
      const packedFile = stdout.trim();
      console.log(`✓ Packed: ${packedFile}`);
    } catch (error) {
      console.error(`Failed to pack ${pkg}:`, error.message);
    }
  }
}

async function main() {
  console.log('Packing MCP servers...');
  console.log(`Output directory: ${OUTPUT_DIR}`);
  
  // Create output directory
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  
  // Pack local MCP servers first
  await packLocalServers();

  // Pack extra dependencies from main project's node_modules
  await packExtraDependencies();

  // Create a temporary directory for packing npm packages
  const tempDir = path.join(process.cwd(), 'temp-mcp-pack');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  
  // Create package.json for the temp directory
  const packageJson = {
    name: 'temp-mcp-pack',
    version: '1.0.0',
    private: true,
    dependencies: {},
  };
  
  for (const server of MCP_SERVERS) {
    const atIndex = server.indexOf('@', server.startsWith('@') ? 1 : 0);
    const name = atIndex > 0 ? server.substring(0, atIndex) : server;
    const version = atIndex > 0 ? server.substring(atIndex + 1) : 'latest';
    packageJson.dependencies[name] = version;
  }
  
  fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify(packageJson, null, 2));
  
  // Install dependencies
  console.log('Installing MCP server packages...');
  try {
    await execAsync('npm install --ignore-scripts', { cwd: tempDir });
    console.log('✓ Packages installed');
  } catch (error) {
    console.error('Failed to install packages:', error.message);
    process.exit(1);
  }
  
  // Pack each package
  console.log('Packing packages...');
  const nodeModulesDir = path.join(tempDir, 'node_modules');
  
  for (const server of MCP_SERVERS) {
    const atIndex = server.indexOf('@', server.startsWith('@') ? 1 : 0);
    const packageName = atIndex > 0 ? server.substring(0, atIndex) : server;
    const packageDir = path.join(nodeModulesDir, packageName);
    
    if (!fs.existsSync(packageDir)) {
      console.warn(`Package not found: ${packageName}, skipping`);
      continue;
    }
    
    try {
      console.log(`Packing ${packageName}...`);
      const { stdout } = await execAsync(`npm pack "${packageDir}"`, { cwd: OUTPUT_DIR });
      const packedFile = stdout.trim();
      console.log(`✓ Packed: ${packedFile}`);
    } catch (error) {
      console.error(`Failed to pack ${packageName}:`, error.message);
    }
  }
  
  // Clean up temp directory
  console.log('Cleaning up...');
  try {
    fs.rmSync(tempDir, { recursive: true, force: true });
    console.log('✓ Temp directory removed');
  } catch (error) {
    console.warn('Failed to remove temp directory:', error.message);
  }
  
  console.log('\nDone! Packed files are in:', OUTPUT_DIR);
  console.log('Files:', fs.readdirSync(OUTPUT_DIR));
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
