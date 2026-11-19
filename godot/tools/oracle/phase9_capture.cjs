// Phase 9: Stage 5 (Sovereign) source data, preserved at the IEEE-754 bit level.
const {fs,path,root,canonical,read,hash}=require('../extract/common.cjs');
const {openBrowser}=require('../extract/browser.cjs');
const out=path.join(root,'godot/phase9/fixtures');
async function main(){fs.mkdirSync(out,{recursive:true});const b=await openBrowser();try{
  await b.evaluate(`Promise.all([S1_GROUP.ready,g2Early.ready,g2Late.ready,BarelHurt.ready,BarelJump.ready,BarelDashAttack.ready])`);
  const source=await b.evaluate(`(()=>{
    const art={scale:MORGRA_ART.scale,hd:MORGRA_ART.hd,idleHeight:MORGRA_ART.idleHeight,projectiles:MORGRA_ART.projectiles,
      clips:Object.fromEntries(Object.entries(MORGRA_ART.clips).map(([k,v])=>[k,v.length]))};
    const legacy=Object.fromEntries(['grunt','rogue','brute','archer','boss5'].map(id=>[id,ET[id]]));
    const A=SOVEREIGN_ART;
    // Object key order decides weighted picks; the canonical JSON writer sorts keys, so keep it.
    const order=SOVEREIGN_RULES.weights.map(p=>Object.fromEntries(Object.entries(p).map(([band,w])=>[band,Object.keys(w)])));
    const firstHit=[0,1].map(p2=>Object.fromEntries(SOVEREIGN_ATTACKS.map(id=>{const n=sovereignFirstHit(id,!!p2);return [id,Number.isFinite(n)?n:-1];})));
    return JSON.parse(JSON.stringify({STAGE:STAGES[4],STAGE_INDEX:4,
      SOVEREIGN:{RULES:SOVEREIGN_RULES,WEIGHT_ORDER:order,FIRST_HIT:firstHit,FIRST_STAGE:SOV_FIRST_STAGE,ATTACKS:SOVEREIGN_ATTACKS,
        FIST:SOV_FIST,SWORD:[SOV_SWORD_LOW,SOV_SWORD_HIGH],
        ART:{ppw:A.ppw,bodyHeight:A.bodyHeight,fistLength:A.fistLength,fistHeight:A.fistHeight,maskPrefix:A.maskPrefix,maskPulseTicks:A.maskPulseTicks,
          clips:Object.fromEntries(Object.entries(A.clips).map(([k,v])=>[k,v.length])),
          cores:Object.fromEntries(['fist_p1','fist_p2','fallen_p1','fallen_p2'].map(k=>[k,A.clips[k].map(f=>f.core||null)]))}},
      ARENA:{lanes:[370,425,480],first:1800,every:5000,delay:1200,life:350,depth:23,damage:12,fade:ZONE_FADE,jump:{frost:24,other:90}},
      VIEW:{OY,VH,VW},GORATH_GRAB,GORATH_ESCAPE_KEYS,
      ET:legacy,MORGRA:art,MORGRA_MOVES:morgraMoves,MORGRA_REVIVE,
      GROGGY_TICKS,INTRO_MS,BOSS_VISUAL_SCALE,CHAIN_MS,ENEMIES:COMBAT_FRAME_DATA.enemies,COLLIDE:FEEL.collide,
      STAGE_COUNT:STAGES.length,SHADOW:SPRITES.boss2?.sh??null,
      BAREL_HURT:{lowHurtboxHeight:84.919114}}));
  })()`);
  fs.writeFileSync(path.join(out,'source_data.json'),JSON.stringify(canonical(source),null,2)+'\n');
  const numbers=[];function walk(v,p=[]){if(typeof v==='number'&&!Number.isInteger(v)){const x=Buffer.alloc(8);x.writeDoubleLE(v);numbers.push({path:p,bits:x.toString('hex')});}else if(v&&typeof v==='object')for(const[k,c]of Object.entries(v))walk(c,[...p,Array.isArray(v)?Number(k):k]);}walk(source);
  fs.writeFileSync(path.join(out,'source_numbers.json'),JSON.stringify(numbers)+'\n');
  fs.writeFileSync(path.join(out,'sources.json'),JSON.stringify(Object.fromEntries(['game.js','sovereign-runtime.js','sovereign-data.js','sovereign-art.js','gorath-runtime.js','zone-runtime.js','feel-runtime.js','src/animation/barel-hurt.js'].map(f=>[f,hash(read(f))])),null,2)+'\n');
  console.log('Phase 9 data: '+source.SOVEREIGN.ATTACKS.length+' Sovereign attacks, '+source.STAGE.waves.length+' waves, arenas '+source.STAGE.waves.map(w=>w.arena||'-').join(','));
}finally{await b.close();}}main().catch(e=>{console.error(e.stack);process.exit(1);});
