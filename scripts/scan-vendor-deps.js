#!/usr/bin/env node
// 对比 vendor 裸引用 vs 已安装的 node_modules，输出真正缺失的间接依赖。
import fs from 'node:fs';
import path from 'node:path';

const BUILTIN = new Set([
  'fs','path','http','https','crypto','events','os','url','util','stream','zlib',
  'buffer','assert','timers','process','child_process','net','tls','querystring',
  'string_decoder','readline','worker_threads','perf_hooks','async_hooks',
  'inspector','v8','module','sys','punycode','domain','constants','console',
  '_process','cluster','dgram','diagnostics_channel','trace_events','vm','repl',
  'tty','fs/promises','path/posix','path/win32',
]);

const re = /require\(\s*['"]([^'"]+)['"]\s*\)/g;
const importRe = /import\s*(?:[^'"]+\s+from\s*)?['"]([^'"]+)['"]/g;

function topPkg(spec) {
  if (spec.startsWith('.') || spec.startsWith('/') || spec.startsWith('node:')) return null;
  const s = spec.replace(/^node:/, '');
  const parts = s.split('/');
  if (s.startsWith('@')) return parts.slice(0, 2).join('/');
  return parts[0];
}

function walk(d) {
  const out = [];
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) {
      if (['node_modules', '.git', 'test', 'tests', '__tests__', 'docs', 'examples', 'benchmark', 'spec', 'typings', 'types'].includes(e.name)) continue;
      out.push(...walk(p));
    } else if (/\.(js|ts|cjs|mjs)$/.test(e.name) && !/\.d\.ts$/.test(e.name)) {
      out.push(p);
    }
  }
  return out;
}

function scan(dir) {
  const set = new Set();
  if (!fs.existsSync(dir)) return set;
  for (const f of walk(dir)) {
    let c; try { c = fs.readFileSync(f, 'utf8'); } catch { continue; }
    for (const reG of [re, importRe]) {
      reG.lastIndex = 0; let m;
      while ((m = reG.exec(c))) { const pkg = topPkg(m[1]); if (pkg && !BUILTIN.has(pkg) && pkg !== 'package.json' && pkg !== ',') set.add(pkg); }
    }
  }
  return set;
}

function installedPkgs(nodeModulesDir) {
  const set = new Set();
  if (!fs.existsSync(nodeModulesDir)) return set;
  for (const e of fs.readdirSync(nodeModulesDir, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    if (e.name.startsWith('@')) {
      for (const sub of fs.readdirSync(path.join(nodeModulesDir, e.name), { withFileTypes: true })) {
        if (sub.isDirectory()) set.add(`${e.name}/${sub.name}`);
      }
    } else {
      set.add(e.name);
    }
  }
  return set;
}

const targets = [
  { name: 'ROOT (asar)', vendor: 'src/vendor', nodeModules: 'node_modules', pkgFile: 'package.json' },
  { name: 'markitdown-mcp-server', vendor: 'src/mcp-builtin/markitdown-mcp-server/src/vendor', nodeModules: 'src/mcp-builtin/markitdown-mcp-server/node_modules', pkgFile: 'src/mcp-builtin/markitdown-mcp-server/package.json' },
];

for (const t of targets) {
  const refs = scan(t.vendor);
  const installed = installedPkgs(t.nodeModules);
  const pj = JSON.parse(fs.readFileSync(t.pkgFile, 'utf8'));
  const declared = new Set([...Object.keys(pj.dependencies || {}), ...Object.keys(pj.devDependencies || {})]);
  const missing = [...refs].filter(r => !installed.has(r)).sort();
  const inNodeModulesButNotDeclared = [...refs].filter(r => installed.has(r) && !declared.has(r)).sort();
  console.log(`\n=== ${t.name} ===`);
  console.log(`vendor 裸引用(去噪后): ${refs.size}`);
  console.log(`已在 ${t.nodeModules} 安装: ${[...refs].filter(r=>installed.has(r)).length}`);
  console.log(`\n[缺失] 既未安装也未声明 (打包后必坏):`);
  for (const m of missing) console.log(`  ${m}`);
  console.log(`\n[风险] 已装但未声明为 dependencies (devDep 里, electron-builder 不会打进 asar):`);
  for (const m of inNodeModulesButNotDeclared) console.log(`  ${m}`);
}
