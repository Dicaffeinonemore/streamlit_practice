// Run after rebuilding art: node tools/externalize-art.cjs
// Lossless extraction only: image bytes and atlas coordinates are unchanged.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script\s+src="([^"]+)"/g)].map(m => m[1]);
const assets = new Set();
let before = 0, after = 0;
for (const name of scripts) {
  const file = path.join(root, name), original = fs.readFileSync(file, 'utf8');
  before += Buffer.byteLength(original);
  let output = original.replace(/data:image\/(png|webp|gif|jpeg);base64,([A-Za-z0-9+/=]+)/g, (_, type, data) => {
    const bytes = Buffer.from(data, 'base64');
    const digest = crypto.createHash('sha256').update(bytes).digest('hex').slice(0, 24);
    const asset = `assets/runtime/${digest}.${type === 'jpeg' ? 'jpg' : type}`;
    const target = path.join(root, asset);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    if (!fs.existsSync(target)) fs.writeFileSync(target, bytes);
    return asset;
  });
  if (name === 'floor-art.js') output = output.replace(/const FLOOR_IMAGES = (\[.*\])\.map\(src => \{ const im = new Image\(\); im.src = src; return im; \}\);/, 'const FLOOR_IMAGES = GameAssets.lazy($1);');
  if (name === 'release-art.js') output = output.replace(/const RELEASE_IMAGES = \{\};\r?\nfor \(const \[key, src\] of Object.entries\(RELEASE_ART\)\) \{ const im = new Image\(\); im.src = src; RELEASE_IMAGES\[key\] = im; \}/, 'const RELEASE_IMAGES = GameAssets.lazy(RELEASE_ART);');
  for (const m of output.matchAll(/assets\/runtime\/[a-f0-9]+\.(?:png|webp|gif|jpg)/g)) assets.add(m[0]);
  if (original !== output) fs.writeFileSync(file, output);
  after += Buffer.byteLength(output);
}
fs.writeFileSync(path.join(root, 'data/runtime-assets.json'), JSON.stringify([...assets].sort(), null, 2) + '\n');
console.log(JSON.stringify({ scriptMiBBefore: before / 1048576, scriptMiBAfter: after / 1048576, images: assets.size }));
