// Rebuild the native Godot port's data/assets from this repository. No browser required.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const out = path.resolve(root, 'artifacts/godot_port');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const ctx = vm.createContext({Image: class {}});
const run = s => vm.runInContext(s, ctx);
run(read('combat-data.js'));
run(read('src/animation/barel-rika-data.js'));
run(read('src/animation/barel-rika.js'));
const gorath = JSON.parse(read('data/gorath_remake.json'));
run('const GORATH2_ART = ' + JSON.stringify(gorath) + '; const G2A = GORATH2_ART; const G2M = G2A.marks; const G2_DEBUG = {old:false};');
const boss = read('gorath-remake-runtime.js');
run(boss.slice(boss.indexOf('const G2_BASE ='), boss.indexOf('function isGorath2')));
run('function g2Len(id) {return G2A.clips[id].frames.length;}');
run(boss.slice(boss.indexOf('const G2_INTRO ='), boss.indexOf('function gorath2IntroDuration')));
const stage = read('stage1-runtime.js');
run(stage.slice(stage.indexOf('const ENEMY_ALIAS'), stage.indexOf('const S1 =')));
const data = run('({combat:COMBAT_FRAME_DATA, barel:BAREL_RIKA_DATA, timelines:BarelRika.TIMELINES, sections:STAGE1_SECTIONS, enemies:STAGE1_ET, enemy_moves:S1_MOVES, boss:G2, boss_moves:G2_MOVES, boss_pick:G2_PICK, boss_intro:G2_INTRO, boss_transform:G2_TRANSFORM, meat:G2_MEAT})');
data.backgrounds = JSON.parse(read('data/stage1_bg.json'));
data.enemy_art = JSON.parse(read('data/stage1_enemies.json'));
data.gorath = gorath;
data.fx = JSON.parse(read('data/stage1_fx.json'));
fs.mkdirSync(path.join(out, 'data'), {recursive:true});
fs.writeFileSync(path.join(out, 'data/game_data.json'), JSON.stringify(data));
const files = new Set(['assets/bgm/boss.mp3']);
function walk(o) {
  if(typeof o === 'string' && /^assets\/.+\.(png|webp|mp3)$/.test(o)) files.add(o);
  else if(o && typeof o === 'object') Object.values(o).forEach(walk);
}
walk(data);
let bytes=0;
for(const f of files) {
  const dst=path.join(out,f);fs.mkdirSync(path.dirname(dst),{recursive:true});
  fs.copyFileSync(path.join(root,f),dst);bytes+=fs.statSync(dst).size;
}
fs.writeFileSync(path.join(out,'data/source_manifest.json'),JSON.stringify({source:'Black Moon Knight v1.67',date:'2026-11-14',files:[...files],bytes},null,2));
console.log(`Exported ${files.size} assets (${(bytes/1024/1024).toFixed(1)} MiB) to ${out}`);
