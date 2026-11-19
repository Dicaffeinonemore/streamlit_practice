// Phase 6: Stage 3 (Aurelion) source data, preserved at the IEEE-754 bit level.
const {fs,path,root,canonical,read,hash}=require('../extract/common.cjs');
const {openBrowser}=require('../extract/browser.cjs');
const out=path.join(root,'godot/phase7/fixtures');
async function main(){fs.mkdirSync(out,{recursive:true});const b=await openBrowser();try{
  await b.evaluate(`Promise.all([S1_GROUP.ready,g2Early.ready,g2Late.ready,BarelHurt.ready,BarelJump.ready,BarelDashAttack.ready])`);
  const source=await b.evaluate(`(()=>{
    const art={scale:MORGRA_ART.scale,hd:MORGRA_ART.hd,idleHeight:MORGRA_ART.idleHeight,projectiles:MORGRA_ART.projectiles,
      clips:Object.fromEntries(Object.entries(MORGRA_ART.clips).map(([k,v])=>[k,v.length]))};
    const legacy=Object.fromEntries(['grunt','rogue','brute','archer','boss3'].map(id=>[id,ET[id]]));
    return JSON.parse(JSON.stringify({STAGE:STAGES[2],STAGE_INDEX:2,AURELION:{K:AURELION_K,SFX:AURELION_SFX,ATTACKS:AURELION_ATTACKS,hd:AURELION_ART.hd,timing:AURELION_ART.timing,boss:AURELION_ART.boss,projectiles:AURELION_ART.projectiles,effects:AURELION_ART.effects,clips:Object.fromEntries(Object.entries(AURELION_ART.clips).map(([k,v])=>[k,v.length]))},AURELION_P2_HP,AURELION_WEIGHT_ORDER:AURELION_ART.boss.phases.map(p=>Object.fromEntries(['near','mid','far'].map(b=>[b,Object.keys(p.weights[b])]))),ET:legacy,MORGRA:art,MORGRA_MOVES:morgraMoves,MORGRA_REVIVE,
      GROGGY_TICKS,INTRO_MS,BOSS_VISUAL_SCALE,CHAIN_MS,ENEMIES:COMBAT_FRAME_DATA.enemies,COLLIDE:FEEL.collide,
      STAGE_COUNT:STAGES.length,SHADOW:SPRITES.boss2?.sh??null,
      BAREL_HURT:{lowHurtboxHeight:BarelHurt.status().loaded?84.919114:84.919114}}));
  })()`);
  fs.writeFileSync(path.join(out,'source_data.json'),JSON.stringify(canonical(source),null,2)+'\n');
  const numbers=[];function walk(v,p=[]){if(typeof v==='number'&&!Number.isInteger(v)){const x=Buffer.alloc(8);x.writeDoubleLE(v);numbers.push({path:p,bits:x.toString('hex')});}else if(v&&typeof v==='object')for(const[k,c]of Object.entries(v))walk(c,[...p,Array.isArray(v)?Number(k):k]);}walk(source);
  fs.writeFileSync(path.join(out,'source_numbers.json'),JSON.stringify(numbers)+'\n');
  fs.writeFileSync(path.join(out,'sources.json'),JSON.stringify(Object.fromEntries(['game.js','aurelion-runtime.js','aurelion-art.js','feel-runtime.js','src/animation/barel-hurt.js'].map(f=>[f,hash(read(f))])),null,2)+'\n');
  console.log('Phase 7 data: '+Object.keys(source.AURELION.timing).length+' Aurelion clips, '+source.STAGE.waves.length+' waves');
}finally{await b.close();}}main().catch(e=>{console.error(e.stack);process.exit(1);});
