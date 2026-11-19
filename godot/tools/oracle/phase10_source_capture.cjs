// Phase 10: original touch controls (DOM overlay) at 960 x 540, for side-by-side review with
// evidence/phase10_compare_*.png. Same scenes as phase10/fixtures/touch_scenes.json.
const {fs,path,root}=require('../extract/common.cjs');
const {openBrowser}=require('../extract/browser.cjs');
const scenes=JSON.parse(fs.readFileSync(path.join(root,'godot/phase10/fixtures/touch_scenes.json'),'utf8'));
async function main(){const b=await openBrowser();try{
 await b.call('Emulation.setDeviceMetricsOverride',{width:960,height:540,deviceScaleFactor:1,mobile:false});
 await b.evaluate(`Promise.all([S1_GROUP.ready,BarelHurt.ready,BarelJump.ready,BarelDashAttack.ready,VIESA_READY])`);
 await b.evaluate(`(()=>{player=newPlayer(0,'barel');startStage(1);return GameAssets.stageReady;})()`);
 await b.evaluate(`new Promise(r=>{const ims=[...Object.values(RELEASE_IMAGES),...FLOOR_IMAGES,NAMED_ATLAS,BAREL_ATLAS,BAREL_SKILL_ICONS].filter(Boolean);let n=0;const poll=()=>ims.every(i=>i.complete&&i.naturalWidth)||n++>200?r(true):setTimeout(poll,25);poll();})`);
 for(const spec of scenes){
  await b.evaluate(`(()=>{const spec=${JSON.stringify(spec)};
   Element.prototype.setPointerCapture=function(){};Math.random=()=>.5;UX.saveCheckpoint=()=>{};practice=false;bossChallenge=false;
   if(UX.touchEditing)UX.endTouchEdit();
   selectedCharacterId=spec.character;player=newPlayer(0,spec.character);syncPlayerCharacterUI(spec.character);startStage(1);
   scene='play';showScreen(null);tick=0;hitStop=0;shake=0;flashT=0;clearInput();cv.width=960;cv.height=540;RENDER_K=1;releaseBG.key='';
   barrels=[];enemies=[];Object.assign(player,{x:300,y:430,inv:0,sp:spec.sp,mg:spec.mg});waveIdx=STAGES[1].waves.length;camLock=true;lockAt=0;
   for(const [id,ms] of Object.entries(spec.cooldowns||{}))player.skillCd[id]=ms;
   UX.options.touch=true;UX.setTouchLayout(spec.layout||{alpha:.55,scale:1,items:{}});document.body.classList.add('touch');syncTouchControls();
   const at=(el,dx,dy)=>{const r=el.getBoundingClientRect();return {clientX:r.left+r.width/2+dx,clientY:r.top+r.height/2+dy};};
   for(const t of spec.touches||[]){const el=t.id==='stick'?document.getElementById('touchStick'):document.querySelector('#touchPad [data-control="'+t.id+'"]');
     el.dispatchEvent(new PointerEvent('pointerdown',{pointerId:t.pointer,bubbles:true,...at(el,0,0)}));
     if(t.dx||t.dy)el.dispatchEvent(new PointerEvent('pointermove',{pointerId:t.pointer,bubbles:true,...at(el,0,0),clientX:at(el,0,0).clientX+t.dx,clientY:at(el,0,0).clientY+t.dy}));}
   if(spec.edit){UX.startTouchEdit();scene='settings';}
   updateSkillButtons();releaseBG.blend=1;ctx.setTransform(1,0,0,1,0,0);render();return true;})()`);
  const shot=await b.call('Page.captureScreenshot',{format:'png'});
  fs.writeFileSync(path.join(root,'godot/evidence/phase10_source_'+spec.id+'.png'),Buffer.from(shot.data,'base64'));
 }
 console.log('Captured original touch scenes: '+scenes.map(s=>s.id).join(', '));
}finally{await b.close();}}main().catch(e=>{console.error(e.stack);process.exit(1);});
