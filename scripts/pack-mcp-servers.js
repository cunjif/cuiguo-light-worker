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

// MCP servers to bundle
const MCP_SERVERS = [
  'playwright-mcp@0.0.10',
  '@modelcontextprotocol/server-filesystem@latest',
  'aigroup-mdtoword-mcp@latest',
  'bazi-mcp@latest',
];

// Output directory
const OUTPUT_DIR = path.join(process.cwd(), 'src', 'mcp-builtin', 'packages');

async function main() {
  console.log('Packing MCP servers...');
  console.log(`Output directory: ${OUTPUT_DIR}`);
  
  // Create output directory
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  
  // Create a temporary directory for packing
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
    packageJson.dependencies[server.split('@')[0]] = server.includes('@') ? server.split('@').slice(1).join('@') : 'latest';
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
    const packageName = server.split('@')[0];
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
