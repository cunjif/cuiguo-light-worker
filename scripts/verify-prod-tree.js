#!/usr/bin/env node
// 模拟 electron-builder 的 production 依赖收集：从 package.json dependencies 出发，
// 递归读 node_modules/<pkg>/package.json 的 dependencies，收集所有应被打包的包名。
// 然后对比 scan-vendor-deps.js 输出的"风险"包，确认它们是否都在 production 树里。
import fs from 'node:fs';
import path from 'node:path';

function collect(rootDir) {
  const pj = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
  const seeds = new Set(Object.keys(pj.dependencies || {}));
  const result = new Set();
  const queue = [...seeds];
  while (queue.length) {
    const pkg = queue.pop();
    if (result.has(pkg)) continue;
    result.add(pkg);
    // 在 rootDir/node_modules 找该包
    let pkgDir;
    if (pkg.startsWith('@')) {
      pkgDir = path.join(rootDir, 'node_modules', pkg);
    } else {
      pkgDir = path.join(rootDir, 'node_modules', pkg);
    }
    const pp = path.join(pkgDir, 'package.json');
    if (!fs.existsSync(pp)) continue;
    let cpj;
    try { cpj = JSON.parse(fs.readFileSync(pp, 'utf8')); } catch { continue; }
    for (const d of Object.keys(cpj.dependencies || {})) {
      if (!result.has(d)) queue.push(d);
    }
  }
  return result;
}

const rootProd = collect('.');
const mcpProd = collect('src/mcp-builtin/markitdown-mcp-server');

// scan-vendor-deps.js 报告的风险包
const rootRisk = ['@fast-csv/format','@fast-csv/parse','core-util-is','ieee754','immediate','inherits','isarray','lodash.escaperegexp','lodash.groupby','lodash.isboolean','lodash.isequal','lodash.isfunction','lodash.isnil','lodash.isundefined','lodash.uniq','option','process-nextick-args','safe-buffer','safer-buffer','util-deprecate','xmlchars'];
const mcpRisk = [];

console.log('=== ROOT: 风险包是否在 production 树 ===');
for (const p of rootRisk) {
  console.log(`  ${p}: ${rootProd.has(p) ? '在 ✓' : '不在 ✗ (需显式声明)'}`);
}
console.log('\n=== markitdown-mcp-server: 风险包 ===');
for (const p of mcpRisk) {
  console.log(`  ${p}: ${mcpProd.has(p) ? '在 ✓' : '不在 ✗'}`);
}

// 额外: 检查 scan 报告的"缺失"里真正需要兜底的
const rootMissing = ['@cfworker/json-schema'];
console.log('\n=== ROOT: 可选缺失包是否已装 ===');
for (const p of rootMissing) {
  const exists = fs.existsSync(path.join('node_modules', p));
  console.log(`  ${p}: ${exists ? '已装' : '未装'}`);
}