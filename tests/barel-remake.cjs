// node tests/barel-remake.cjs
// Runs the real Barel loaders against the remade exports (fetch/Image read the repo files) and checks
// that every loader accepts them, gameplay metadata is unchanged, and ?barelRemake=0 restores the old art.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const BASE='http://game/';
const toFile=url=>path.join(root,decodeURIComponent(new URL(String(url),BASE).pathname));
const readJson=name=>JSON.parse(fs.readFileSync(path.join(root,name),'utf8'));
class Image{
  constructor(){this.complete=false;this.naturalWidth=0;this.naturalHeight=0;}
  set src(value){
    this._src=value;
    setImmediate(()=>{
      const file=toFile(value);
      if(!fs.existsSync(file)){this.onerror?.();return;}
      const png=fs.readFileSync(file);
      this.naturalWidth=png.readUInt32BE(16);this.naturalHeight=png.readUInt32BE(20);this.complete=true;this.onload?.();
    });
  }
  get src(){return this._src;}
}
async function fetch(url){
  const file=toFile(url);
  if(!fs.existsSync(file))return {ok:false,status:404};
  return {ok:true,status:200,json:async()=>JSON.parse(fs.readFileSync(file,'utf8'))};
}
const scripts=['src/animation/barel-remake-data.js','src/animation/barel-remake-config.js','src/animation/aseprite.js',
  'src/animation/barel-combo0.js','src/animation/barel-combo1.js','src/animation/barel-combo2.js','src/animation/barel-idle.js',
  'src/animation/barel-walk.js','src/animation/barel-dash.js','src/animation/barel-dash-attack.js','src/animation/barel-jump.js',
  'src/animation/barel-air-attack.js','src/animation/barel-named-motion-data.js','src/animation/barel-named-motion.js'];
function game(search=''){
  const canvas=()=>({width:0,height:0,getContext:()=>({drawImage(){},fillRect(){}})});
  const context=vm.createContext({Image,fetch,URL,URLSearchParams,setImmediate,setTimeout,console:{...console,warn(){},error(){}},
    location:{href:BASE,search},document:{createElement:canvas},
    COMBAT_FRAME_DATA:{barel:{dashAttack:{frameEndTicks:[3,7,11,14,17,23,29,35,41,47]}}}});
  for(const file of scripts)vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
  return context;
}
(async()=>{
  const g=game();
  const loaders=['BarelIdle','BarelWalk','BarelDash','BarelCombo0','BarelCombo1','BarelCombo2','BarelJump','BarelAirAttack','BarelDashAttack'];
  for(const name of loaders)assert.equal(await g[name].ready,true,`${name} rejected the remake asset: ${JSON.stringify(g[name].status())}`);
  for(const name of loaders.slice(0,-1))assert.equal(g[name].status().effective,'aseprite10',name);
  const remake=(frame,clip)=>{assert.ok(frame,clip);assert.match(frame.image.src,new RegExp(`barel-remake-${clip}-10\\.png$`),clip);return frame;};
  remake(g.BarelIdle.frameFor({st:'free',walk:false,z:0},650),'idle');
  remake(g.BarelWalk.frameFor({st:'free',walk:true,z:0,walkTime:450}),'walk');
  remake(g.BarelDash.frameFor({st:'dash',t:6},1000/60,190),'dash');
  remake(g.BarelDashAttack.frameFor({st:'dash_attack',t:15},1000/60),'dash-attack');
  remake(g.BarelCombo0.frameFor({st:'atk',atk:'c1',combo:0,t:9},1000/60),'combo0');
  remake(g.BarelCombo1.frameFor({st:'atk',atk:'c2',combo:1,t:9},1000/60),'combo1');
  remake(g.BarelCombo2.frameFor({st:'atk',atk:'c3',combo:2,t:18},1000/60),'combo2');
  remake(g.BarelJump.frameFor({st:'free',z:40,vz:0},1000/60),'jump');
  remake(g.BarelAirAttack.frameFor({st:'atk',atk:'air',t:4,z:40,vz:3},1000/60),'air-attack');
  // the dash attack's hit box, body height and blade tip drive game.js; the remake must not change them
  const old=readJson('assets/aseprite/barel-dash-attack-10/barel-dash-attack-10.animation.json');
  for(const key of ['hitbox','bodyHeight','bladeTip','expectedDurationsMs','durationMs'])
    assert.deepEqual(g.BarelDashAttack.data[key],old[key],key);
  // one display scale for every clip, matching the legacy 142 px body
  const scales=new Set(fs.readdirSync(path.join(root,'assets/aseprite')).filter(n=>n.startsWith('barel-remake-'))
    .map(n=>readJson(`assets/aseprite/${n}/${n}.animation.json`).renderScale));
  assert.equal(scales.size,1);
  const named=g.BAREL_REMAKE_NAMED_DATA,manifest=new Set(readJson('data/runtime-assets.json'));
  for(const [name,clip] of Object.entries(named)){
    assert.ok(fs.existsSync(path.join(root,clip.path)),name);
    assert.ok(manifest.has(clip.path),name+' absent from component manifest');
    assert.equal(clip.scale,[...scales][0],name);
  }
  await new Promise(resolve=>setImmediate(resolve));
  const skillFrame=(skill,ms)=>g.BarelNamedMotion.frameFor({st:'skill',skill,t:ms},1);
  for(const [skill,ms,index] of [['whirl',0,0],['leap',560,6],['slam',330,4],['redwave',300,4],['redwave',719,9]]){
    const f=skillFrame(skill,ms);assert.ok(f,`${skill} at ${ms}`);
    assert.equal(f.image.src,named[skill].path);
    assert.deepEqual(Array.from(f.atlas.slice(0,2)),[index%named[skill].columns*640,Math.floor(index/named[skill].columns)*640]);
  }
  // ?barelRemake=0: loaders keep their own default URLs and slam/redwave fall back to the atlas clip
  const legacy=game('?barelRemake=0');
  assert.equal(legacy.BAREL_IDLE_CONFIG,undefined);
  await legacy.BarelIdle.ready;
  assert.doesNotMatch(legacy.BarelIdle.frameFor({st:'free',walk:false,z:0},0)?.image.src||'',/barel-remake/);
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(legacy.BarelNamedMotion.frameFor({st:'skill',skill:'slam',t:330},1),null);
  assert.notEqual(legacy.BarelNamedMotion.frameFor({st:'skill',skill:'whirl',t:0},1).image.src,named.whirl.path);
  console.log('PASS remade Barel: 9 ten-frame loaders, 4 skill sheets, unchanged dash-attack gameplay data, ?barelRemake=0 fallback');
})().catch(error=>{console.error(error);process.exit(1);});
