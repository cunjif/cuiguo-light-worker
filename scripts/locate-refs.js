import fs from 'node:fs';
import path from 'node:path';
const targets = ['bn.js','public-encrypt','@napi-rs/canvas','domino','regenerator-runtime','readtoend','@cfworker/json-schema','@modelcontextprotocol/sdk','asn1.js','core-js','elliptic','browserify-sign','create-hash','randombytes','parse-asn1'];
const re = /require\(\s*['"]([^'"]+)['"]\s*\)/g;
function walk(d){const out=[];for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory()){if(['node_modules','.git','test','tests','__tests__','docs','examples','spec','typings'].includes(e.name))continue;out.push(...walk(p))}else if(/\.(js|ts|cjs|mjs)$/.test(e.name)&&!/\.d\.ts$/.test(e.name)){out.push(p)}}return out}
const hits = {};
for (const root of ['src/vendor','src/mcp-builtin/markitdown-mcp-server/src/vendor']) {
  for (const f of walk(root)) {
    let c; try { c = fs.readFileSync(f,'utf8'); } catch { continue; }
    let m; re.lastIndex = 0;
    while ((m = re.exec(c))) {
      const spec = m[1];
      const top = spec.startsWith('@') ? spec.split('/').slice(0,2).join('/') : spec.split('/')[0];
      if (targets.includes(top)) (hits[top] = hits[top] || new Set()).add(f.replace(/\\/g,'/'));
    }
  }
}
for (const [t, s] of Object.entries(hits)) {
  console.log(t + ':');
  [...s].slice(0,4).forEach(f => console.log('  ' + f));
}