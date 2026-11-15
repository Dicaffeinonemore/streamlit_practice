const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const cp = require('node:child_process');
const root = path.resolve(__dirname, '../../..');
const project = path.join(root, 'godot');
const output = path.join(project, 'port_assets');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k => [k,canonical(value[k])]));
  return value;
}
function write(file, bytes) {
  const target = path.resolve(output, file);
  if (!target.startsWith(output + path.sep)) throw Error('Output outside asset directory: '+file);
  fs.mkdirSync(path.dirname(target),{recursive:true});
  // Avoid rewriting unchanged originals; libvips may retain read handles on Windows.
  if(!fs.existsSync(target)||!fs.readFileSync(target).equals(Buffer.isBuffer(bytes)?bytes:Buffer.from(bytes)))fs.writeFileSync(target,bytes);
  return 'port_assets/'+file.replaceAll('\\','/');
}
const json = (file, value) => write(file,JSON.stringify(canonical(value),null,2)+'\n');
const slug = value => String(value).replace(/([a-z])([A-Z])/g,'$1_$2').toLowerCase().replace(/[^a-z0-9_.-]+/g,'_').replace(/^_+|_+$/g,'');
function dependency(name) {
  try { return require(name); } catch {
    const base=process.env.CODEX_NODE_MODULES || path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
    return require(path.join(base,name));
  }
}
function python() {
  if(process.env.BMK_PYTHON) return process.env.BMK_PYTHON;
  const bundled=path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe');
  return fs.existsSync(bundled)?bundled:'python';
}
module.exports={fs,path,cp,root,project,output,read,hash,canonical,write,json,slug,dependency,python};
