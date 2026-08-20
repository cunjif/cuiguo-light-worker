#!/usr/bin/env node
/**
 * Pack MCP Servers (offline self-contained mode)
 *
 * 为每个 MCP server 在其目录下 npm install 完整依赖树，
 * 产物（server 代码 + node_modules）由 electron-builder 的 extraFiles
 * 打进 resources/mcp-builtin，运行时直接指向，不联网、不 npm install。
 *
 * Usage: node scripts/pack-mcp-servers.js
 */

import { exec } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

// 本地 server（源码在 src/mcp-builtin/<dir>）
// build=true 的需要先 tsc/copyfiles，build=false 的 dist 已 pre-built
const LOCAL_MCP_SERVERS = [
  { name: 'markitdown-mcp-server', dir: 'src/mcp-builtin/markitdown-mcp-server', build: true },
  { name: 'aigroup-mdtoword-mcp', dir: 'src/mcp-builtin/aigroup-mdtoword-mcp', build: false },
];

// npm registry 上的 server，install 到独立自包含目录
const NPM_MCP_SERVERS = [
  { name: 'filesystem-server', pkg: '@modelcontextprotocol/server-filesystem@latest', dir: 'src/mcp-builtin/filesystem-server' },
  { name: 'bazi-server', pkg: 'bazi-mcp@latest', dir: 'src/mcp-builtin/bazi-server' },
];

async function prepareLocalServers() {
  for (const s of LOCAL_MCP_SERVERS) {
    const dir = path.join(process.cwd(), s.dir);
    if (!fs.existsSync(dir)) {
      console.warn(`Local server directory not found: ${s.dir}, skipping`);
      continue;
    }

    console.log(`\n=== ${s.name} ===`);
    console.log(`Installing dependencies (build machine online)...`);
    await execAsync('npm install --ignore-scripts', { cwd: dir });

    if (s.build) {
      console.log(`Building ${s.name}...`);
      await execAsync('npm run build', { cwd: dir });
      console.log(`✓ Built ${s.name}`);
    }

    console.log(`Pruning devDependencies (keep runtime deps only)...`);
    await execAsync('npm prune --production', { cwd: dir });

    const nmDir = path.join(dir, 'node_modules');
    const hasDeps = fs.existsSync(nmDir);
    console.log(`✓ ${s.name} self-contained${hasDeps ? '' : ' (no runtime deps)'}`);
  }
}

async function prepareNpmServers() {
  for (const s of NPM_MCP_SERVERS) {
    const dir = path.join(process.cwd(), s.dir);
    fs.mkdirSync(dir, { recursive: true });

    const pkgJsonPath = path.join(dir, 'package.json');
    if (!fs.existsSync(pkgJsonPath)) {
      fs.writeFileSync(pkgJsonPath, JSON.stringify({
        name: s.name,
        version: '1.0.0',
        private: true,
      }, null, 2));
    }

    console.log(`\n=== ${s.name} ===`);
    console.log(`Installing ${s.pkg}...`);
    await execAsync(`npm install ${s.pkg} --ignore-scripts`, { cwd: dir });
    console.log(`✓ ${s.name} self-contained`);
  }
}

async function main() {
  console.log('Preparing self-contained MCP servers (offline-ready)...');
  console.log(`Project: ${process.cwd()}`);

  await prepareLocalServers();
  await prepareNpmServers();

  console.log('\n============================================================');
  console.log('Done. All servers are self-contained in src/mcp-builtin/.');
  console.log('electron-builder extraFiles will bundle them into resources/mcp-builtin.');
  console.log('Runtime uses them directly — no npm install, no network.');
  console.log('============================================================');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
