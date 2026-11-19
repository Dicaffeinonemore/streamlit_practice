// Phase 7: original browser renders of Stage 3 for side-by-side review with evidence/phase7_compare_*.png.
const {fs,path,root}=require('../extract/common.cjs');
const {openBrowser}=require('../extract/browser.cjs');
// Shared with phase7/verify_stage3.gd: same setup, same steps.
const scenes=JSON.parse(fs.readFileSync(path.join(root,'godot/phase7/fixtures/capture_scenes.json'),'utf8'));
async function main(){const b=await openBrowser();try{
 await b.evaluate(`Promise.all([S1_GROUP.ready,g2Early.ready,g2Late.ready,BarelHurt.ready,BarelJump.ready,BarelDashAttack.ready,VIESA_READY,AURELION_READY])`);
 await b.evaluate(`new Promise(r=>{const ims=[...Object.values(RELEASE_IMAGES),...FLOOR_IMAGES,NAMED_ATLAS].filter(Boolean);let n=0;const poll=()=>ims.every(i=>i.complete&&i.naturalWidth)||n++>200?r(true):setTimeout(poll,25);poll();})`);
 for(const scene of scenes){
  const png=await b.evaluate(`(()=>{const spec=${JSON.stringify(scene)};
   Math.random=()=>.5;UX.saveCheckpoint=()=>{};practice=false;bossChallenge=false;selectedCharacterId=spec.character;player=newPlayer(0,spec.character);startStage(2);
   scene='play';tick=0;nextId=1;hitStop=0;shake=0;flashT=0;slowT=0;clearInput();cv.width=960;cv.height=540;RENDER_K=1;releaseBG.key='';
   barrels=[];Object.assign(player,{x:spec.px,y:430,inv:0});waveIdx=STAGES[2].waves.length;camLock=true;lockAt=0;
   if(spec.intro){camLock=false;spawnWave(STAGES[2].waves.at(-1));}
   for(const o of spec.enemies){const e=mkEnemy(o.kind,o.x,o.y);enemies.push(e);if(o.passive){e.wait=100000;e.atkCd=100000;}
    if(o.phase===2){e.p2shown=true;e.hp=e.max=AURELION_P2_HP;e.nextKd=e.max*.75;aurelionData(e).halo=true;}}
   if(spec.pat)startPat(enemies[0],spec.pat);
   for(let i=0;i<spec.steps;i++){player.inv=Math.max(player.inv,spec.safe?100:0);update();}
   releaseBG.blend=1;ctx.setTransform(1,0,0,1,0,0);render();return cv.toDataURL('image/png').split(',')[1];})()`);
  fs.writeFileSync(path.join(root,'godot/evidence/phase7_source_'+scene.id+'.png'),Buffer.from(png,'base64'));
 }
 console.log('Captured original Stage 3 scenes: '+scenes.map(s=>s.id).join(', '));
}finally{await b.close();}}main().catch(e=>{console.error(e.stack);process.exit(1);});
