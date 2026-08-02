#!/usr/bin/env node
// Recursively vendor an npm package and all its dependencies.
// Usage: node scripts/vendor-package.mjs <package-name> <target-dir>
// Copies the package to <target-dir>/ and all deps to <target-dir>/node_modules/

import { cpSync, existsSync, readFileSync, mkdirSync, rmSync, readdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const nodeModulesRoot = join(projectRoot, 'node_modules');

const SKIP_DIRS = new Set(['node_modules', '.bin', '.cache']);
const SKIP_FILES = new Set(['.package-lock.json']);

function getPackageDir(name, base = nodeModulesRoot) {
  const dir = join(base, name);
  if (existsSync(join(dir, 'package.json'))) return dir;
  return null;
}

function readPkg(dir) {
  return JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
}

function copyPackageContents(srcDir, destDir) {
  mkdirSync(destDir, { recursive: true });
  for (const entry of readdirSync(srcDir)) {
    if (SKIP_DIRS.has(entry) || SKIP_FILES.has(entry)) continue;
    const src = join(srcDir, entry);
    const dest = join(destDir, entry);
    cpSync(src, dest, { recursive: true, dereference: true });
  }
}

function vendorPackage(pkgName, targetDir, visited = new Set()) {
  if (visited.has(pkgName)) return;
  visited.add(pkgName);

  const srcDir = getPackageDir(pkgName);
  if (!srcDir) {
    console.warn(`  WARN: ${pkgName} not found in node_modules, skipping`);
    return;
  }

  const pkg = readPkg(srcDir);
  console.log(`  vendoring ${pkgName}@${pkg.version} -> ${targetDir}`);

  copyPackageContents(srcDir, targetDir);

  const destPkgPath = join(targetDir, 'package.json');
  const destPkg = JSON.parse(readFileSync(destPkgPath, 'utf8'));
  if (!destPkg.type) destPkg.type = 'commonjs';
  delete destPkg.dependencies;
  delete destPkg.devDependencies;
  delete destPkg.peerDependencies;
  delete destPkg.peerDependenciesMeta;
  delete destPkg.optionalDependencies;
  writeFileSync(destPkgPath, JSON.stringify(destPkg, null, 2));

  const deps = pkg.dependencies || {};
  for (const depName of Object.keys(deps)) {
    if (depName.startsWith('node:')) continue;
    const depTargetDir = join(targetDir, 'node_modules', depName);
    vendorPackage(depName, depTargetDir, visited);
  }
}

const pkgName = process.argv[2];
const targetDir = process.argv[3];

if (!pkgName || !targetDir) {
  console.error('Usage: node scripts/vendor-package.mjs <package-name> <target-dir>');
  process.exit(1);
}

const absTarget = join(projectRoot, targetDir);
console.log(`Vendoring ${pkgName} -> ${absTarget}`);

if (existsSync(absTarget)) rmSync(absTarget, { recursive: true, force: true });

vendorPackage(pkgName, absTarget);
console.log(`Done: ${pkgName}`);
