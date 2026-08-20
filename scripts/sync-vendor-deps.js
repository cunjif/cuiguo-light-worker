#!/usr/bin/env node
// 从 npm registry 拉取每个 vendor 包的原始 dependencies，
// 合并到宿主 package.json 的 dependencies，补齐 electron-builder 打包后缺失的间接依赖。
// 只新增宿主中不存在的依赖；已存在的保留原范围，避免破坏现有 lock。
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

// vendored-xxx → registry 原始名 映射
const NAME_MAP = {
  'vendored-turndown': 'turndown',
  'vendored-papaparse': 'papaparse',
  'vendored-domino': 'domino',
};

function viewDeps(name, version) {
  try {
    const out = execSync(`npm view "${name}@${version}" dependencies --json`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    return JSON.parse(out) || {};
  } catch (e) {
    console.warn(`  ! 拉取失败 ${name}@${version}: ${e.message.split('\n')[0]}`);
    return {};
  }
}

function collectVendorDeps(vendorDir) {
  const merged = {};
  if (!fs.existsSync(vendorDir)) return merged;
  for (const sub of fs.readdirSync(vendorDir, { withFileTypes: true })) {
    if (!sub.isDirectory()) continue;
    const pjPath = path.join(vendorDir, sub.name, 'package.json');
    if (!fs.existsSync(pjPath)) {
      console.log(`  - 跳过 ${sub.name} (无 package.json，可能为本地源码如 markitdown-ts)`);
      continue;
    }
    const pj = JSON.parse(fs.readFileSync(pjPath, 'utf8'));
    if (!pj.name || !pj.version) {
      console.log(`  - 跳过 ${sub.name} (缺 name/version)`);
      continue;
    }
    const origName = NAME_MAP[pj.name] || pj.name;
    console.log(`  + ${origName}@${pj.version}`);
    const deps = viewDeps(origName, pj.version);
    for (const [k, v] of Object.entries(deps)) {
      if (!merged[k]) merged[k] = v;
      else console.log(`      ${k}@${v} 与已有 ${merged[k]} 冲突，保留 ${merged[k]}`);
    }
  }
  return merged;
}

function mergeIntoHost(hostPkgPath, vendorDeps, label) {
  const pj = JSON.parse(fs.readFileSync(hostPkgPath, 'utf8'));
  pj.dependencies = pj.dependencies || {};
  const before = Object.keys(pj.dependencies).length;
  const added = [];
  for (const [k, v] of Object.entries(vendorDeps)) {
    if (pj.dependencies[k] === undefined) {
      pj.dependencies[k] = v;
      added.push(`${k}@${v}`);
    }
  }
  // 排序 dependencies，保持可读
  pj.dependencies = Object.fromEntries(Object.entries(pj.dependencies).sort(([a], [b]) => a.localeCompare(b)));
  fs.writeFileSync(hostPkgPath, JSON.stringify(pj, null, 2) + '\n', 'utf8');
  console.log(`\n[${label}] ${hostPkgPath}`);
  console.log(`  原有 dependencies: ${before}，现: ${Object.keys(pj.dependencies).length}，新增 ${added.length}:`);
  for (const a of added) console.log(`    + ${a}`);
}

console.log('=== ROOT: 扫描 src/vendor ===');
const rootDeps = collectVendorDeps('src/vendor');
mergeIntoHost('package.json', rootDeps, 'ROOT');

console.log('\n=== markitdown-mcp-server: 扫描 src/mcp-builtin/markitdown-mcp-server/src/vendor ===');
const mcpDeps = collectVendorDeps('src/mcp-builtin/markitdown-mcp-server/src/vendor');
mergeIntoHost('src/mcp-builtin/markitdown-mcp-server/package.json', mcpDeps, 'markitdown-mcp-server');

console.log('\n完成。下一步: 在根目录和 markitdown-mcp-server 目录分别执行 `npm install`。');