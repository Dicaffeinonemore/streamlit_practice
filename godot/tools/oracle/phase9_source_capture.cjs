// Phase 9: original browser renders of Stage 5 for side-by-side review with evidence/phase9_compare_*.png.
const {fs,path,root}=require('../extract/common.cjs');
const {openBrowser}=require('../extract/browser.cjs');
// Shared with phase9/verify_stage5.gd: same setup, same steps.
const scenes=JSON.parse(fs.readFileSync(path.join(root,'godot/phase9/fixtures/capture_scenes.json'),'utf8'));
async function main(){const b=await openBrowser();try{
 await b.evaluate(`Promise.all([S1_GROUP.ready,g2Early.ready,g2Late.ready,BarelHurt.ready,BarelJump.ready,BarelDashAttack.ready,VIESA_READY,SOV_GROUP.ready,SOV_CANNON_GROUP.ready])`);
 await b.evaluate(`(()=>{player=newPlayer(0,'barel');startStage(4);return GameAssets.stageReady;})()`);
 await b.evaluate(`new Promise(r=>{const ims=[...Object.values(RELEASE_IMAGES),...FLOOR_IMAGES,NAMED_ATLAS,...Object.values(ZONE_IMAGES)].filter(Boolean);let n=0;const poll=()=>ims.every(i=>i.complete&&i.naturalWidth)||n++>200?r(true):setTimeout(poll,25);poll();})`);
 for(const scene of scenes){
  const png=await b.evaluate(`(()=>{const spec=${JSON.stringify(scene)};
   Math.random=()=>.5;UX.saveCheckpoint=()=>{};practice=false;bossChallenge=false;selectedCharacterId=spec.character;player=newPlayer(0,spec.character);sovereignRemains=[];startStage(4);
   scene='play';tick=0;nextId=1;hitStop=0;shake=0;flashT=0;slowT=0;clearInput();cv.width=960;cv.height=540;RENDER_K=1;releaseBG.key='';
   barrels=[];Object.assign(player,{x:spec.px,y:spec.py??430,inv:0});waveIdx=STAGES[4].waves.length;camLock=true;lockAt=0;
   if(spec.intro){camLock=false;spawnWave(STAGES[4].waves.at(-1));}
   if(spec.arena){spawnWave(STAGES[4].waves.find(w=>w.arena));for(const e of enemies){e.wait=100000;e.atkCd=100000;}}
   for(const o of spec.enemies){const e=mkEnemy(o.kind,o.x,o.y);enemies.push(e);if(o.passive){e.wait=100000;e.atkCd=100000;}
    if(o.phase===2){e.p2shown=true;e.hp=e.max=SOVEREIGN_RULES.hp[1];e.nextKd=e.max*.75;}
    if(o.ready){const s=sovData(e);for(const f of s.fists){const [x,y,h]=sovHome(e,f,s);Object.assign(f,{x,y,h,st:'home'});if(o.phase===2)f.hp=f.max=SOVEREIGN_RULES.fistHp[1];}}}
   if(spec.job){const e=enemies.at(-1);sovStartJob(e,sovData(e),spec.job);}
   for(let i=0;i<spec.steps;i++){player.inv=Math.max(player.inv,spec.safe?100:0);update();}
   releaseBG.blend=1;ctx.setTransform(1,0,0,1,0,0);render();return cv.toDataURL('image/png').split(',')[1];})()`);
  fs.writeFileSync(path.join(root,'godot/evidence/phase9_source_'+scene.id+'.png'),Buffer.from(png,'base64'));
 }
 console.log('Captured original Stage 5 scenes: '+scenes.map(s=>s.id).join(', '));
}finally{await b.close();}}main().catch(e=>{console.error(e.stack);process.exit(1);});
