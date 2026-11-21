// Phase 12: the original tutorial screen (#tutorial with #demoView) and opening at 960 x 540, for
// side-by-side review with evidence/phase12_*.png from phase12/verify_tutorial.gd (same moments).
const {fs,path,root}=require('../extract/common.cjs');
const {openBrowser}=require('../extract/browser.cjs');
const scenes=[
 {id:'tutorial_barel_move',setup:`selectedCharacterId='barel';tick=0;nextId=1;toTutorial('characterSelect');`,ticks:4},
 {id:'tutorial_barel_wave',setup:`demoStep(9);`,ticks:40},
 {id:'tutorial_viesa_stage3',setup:`toTitle();selectedCharacterId='viesa';player=newPlayer(0,'viesa');startStage(2);scene='play';bannerT=0;camX=640;lockAt=640;player.x=840;pauseGame();toTutorial('pause');`,ticks:90},
 {id:'opening_2',setup:`toTitle();startOpening();openingTime=4500;`,ticks:0}];
async function main(){const b=await openBrowser();try{
 await b.call('Emulation.setDeviceMetricsOverride',{width:960,height:540,deviceScaleFactor:1,mobile:false});
 await b.evaluate(`Promise.all([S1_GROUP.ready,g2Early.ready,g2Late.ready,BarelHurt.ready,BarelJump.ready,BarelDashAttack.ready,VIESA_READY])`);
 await b.evaluate(`(()=>{player=newPlayer(0,'barel');startStage(2);return GameAssets.stageReady;})()`);
 await b.evaluate(`new Promise(r=>{const ims=[...Object.values(RELEASE_IMAGES),...FLOOR_IMAGES,NAMED_ATLAS,BAREL_ATLAS,BAREL_SKILL_ICONS].filter(Boolean);let n=0;const poll=()=>ims.every(i=>i.complete&&i.naturalWidth)||n++>200?r(true):setTimeout(poll,25);poll();})`);
 await b.evaluate(`(()=>{toTitle();stage=null;stageIdx=0;camX=0;player=null;enemies=[];return true;})()`);
 for(const spec of scenes){
  await b.evaluate(`(()=>{Math.random=()=>.5;UX.saveCheckpoint=()=>{};cv.width=960;cv.height=540;RENDER_K=1;${spec.setup}
   for(let i=0;i<${spec.ticks};i++){const processed=update();if(processed)for(const k in pressed){pressed[k]-=MS;if(pressed[k]<=0)delete pressed[k];}}
   ctx.setTransform(1,0,0,1,0,0);if(scene==='opening')drawOpening();else{render();demoPresent();}
   $('playPause').hidden=!['play','intro','bossintro'].includes(scene);$('skillbar').hidden=scene!=='play';syncTouchControls();return true;})()`);
  await b.evaluate(`new Promise(r=>setTimeout(r,60))`);
  const shot=await b.call('Page.captureScreenshot',{format:'png'});
  fs.writeFileSync(path.join(root,'godot/evidence/phase12_source_'+spec.id+'.png'),Buffer.from(shot.data,'base64'));
 }
 console.log('Captured original tutorial scenes: '+scenes.map(s=>s.id).join(', '));
}finally{await b.close();}}main().catch(e=>{console.error(e.stack);process.exit(1);});
