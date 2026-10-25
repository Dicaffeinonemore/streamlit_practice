const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
module.exports=async({evaluate,call,errors,root,environment})=>{
 const out=path.join(root,'artifacts/barel-grabbed-10',environment);fs.mkdirSync(out,{recursive:true});
 for(const id of ['BarelGrabbed','BarelIdle','BarelJump','BarelAirAttack','BarelCombo0','BarelCombo1','BarelCombo2'])assert.equal(await evaluate(`${id}.ready`),true);
 assert.equal(await evaluate('BarelGrabbed.status().effective'),'aseprite10');
 await evaluate('window.grabRAF=requestAnimationFrame;requestAnimationFrame=()=>0;AUDIO.enable(false);beginGame();showScreen(null)');
 await evaluate('new Promise(resolve=>grabRAF(()=>resolve()))');
 const results=await evaluate(`(${trial.toString()})()`);
 for(const face of [1,-1]){
  const png=await evaluate(`grabSheet(${face})`);fs.writeFileSync(path.join(out,`ten-frames-${face}.png`),Buffer.from(png,'base64'));
  for(const boss of ['gorath','sovereign']){
   await evaluate(`grabSetup('aseprite10',${JSON.stringify(boss)},${face});for(let i=0;i<24;i++)grabStep();render()`);
   const shot=await call('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,`${boss}-${face}.png`),Buffer.from(shot.data,'base64'));
  }
 }
 const realtime=[];
 for(const boss of ['gorath','sovereign']){
  const result=await evaluate(`(async()=>{
   grabSetup('aseprite10',${JSON.stringify(boss)},1);last=performance.now();acc=0;const started=last,seen={},trace=[];let wraps=0,prev=-1;
   return new Promise((resolve,reject)=>{function sample(now){try{
    loop(now);const f=barelPlayerFrame(),isGrab=f.image?.src.includes('barel-grabbed-10.png');if(isGrab){seen[f.index]=true;if(prev===9&&f.index===2)wraps++;prev=f.index;}
    trace.push({wallMs:now-started,t:player.t,st:player.st,x:player.x,y:player.y,z:player.z,face:player.face,index:isGrab?f.index:null,hp:player.hp,hold:player.grab?.hold});
    if(now-started<1650)grabRAF(sample);else resolve({boss:${JSON.stringify(boss)},seen:Object.keys(seen).map(Number),wraps,trace});
   }catch(error){reject(error);}}grabRAF(sample);});})()`);
  assert.equal(result.seen.length,10);assert(result.wraps>=1);realtime.push(result);
 }
 const loader=fs.readFileSync(path.join(root,'src/animation/barel-grabbed.js'),'utf8');
 const fallback=await evaluate(`(async()=>{
  const original=BarelGrabbed,nativeFetch=fetch,config=window.BAREL_GRABBED_CONFIG,results=[];
  try{for(const failure of ['http','parse','image','timing','bounds','metadata','offset','scale','period','clock','loop','loopRange']){
   window.BAREL_GRABBED_CONFIG={};window.fetch=async(url,...args)=>{const name=String(url);
    if(name.endsWith('barel-grabbed-10.animation.json')){
     if(failure==='http')return {ok:false,status:503};if(failure==='parse')return {ok:true,json:async()=>{throw SyntaxError('Bad grabbed JSON')}};
     const data=await(await nativeFetch(url,...args)).json();
     if(failure==='metadata')data.animationId='idle';if(failure==='offset')data.frameOffsets[0]=[999,0];
     if(failure==='scale')data.renderScale*=2;if(failure==='period')data.durationMs=700;
     if(failure==='clock')data.clock.source='tick * MS';if(failure==='loop')data.loop=false;if(failure==='loopRange')data.loopFromFrame=4;
     return {ok:true,json:async()=>data};
    }
    const response=await nativeFetch(url,...args);
    if(name.endsWith('/barel-grabbed-10.json')){const data=await response.json();
     if(failure==='timing')data.frames[0].duration=66;if(failure==='bounds')data.frames[1].frame.x=99999;
     if(failure==='image')data.meta.image='missing-grabbed.png';return {ok:true,json:async()=>data};}
    return response;};
   eval(${JSON.stringify(loader)});const loaded=await BarelGrabbed.ready;grabSetup('aseprite10','gorath',1);
   if(loaded||BarelGrabbed.status().effective!=='legacy'||barelPlayerFrame()!==barelFrame('hook',0,true))throw Error('Fallback '+failure);
   results.push({failure,status:BarelGrabbed.status()});
  }}finally{window.fetch=nativeFetch;window.BarelGrabbed=original;window.BAREL_GRABBED_CONFIG=config;}
  return results;})()`);
 assert.deepEqual(errors,[]);
 fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({environment,...results,realtime,fallback,defaultMode:await evaluate('BarelGrabbed.status()'),browserErrors:errors},null,2));
 console.log('PASS '+environment+': grabbed 10 actual frames for Gorath/Sovereign, F3-F10 resistance loop, unchanged pull/hold/4-press escape/input lock/fail damage/down/cancel, flip/ground, 12 fallbacks');
};
function trial(){
 const check=(v,m)=>{if(!v)throw Error(m);};
 window.grabSetup=(mode,boss='gorath',face=1)=>{
  clearInput();selectedCharacterId='barel';player=newPlayer(0,'barel');startStage(boss==='gorath'?0:4);scene='play';showScreen(null);
  stage={...stage,waves:[]};practice=false;camX=0;camLock=false;waveIdx=0;
  hazards=[];arena=null;barrels=[];items=[];parts=[];texts=[];impacts=[];bursts=[];ghosts=[];bolts=[];
  hitStop=shake=flashT=clearT=slowT=0;tick=0;player.inv=0;player.x=face===1?350:290;player.y=420;player.face=-face;
  const e=mkEnemy(boss==='gorath'?'boss1':'boss5',face===1?140:500,424);e.face=face;e.atkCd=99999;enemies=[e];
  BarelGrabbed.setMode(mode);
  if(boss==='gorath'){
   startPat(e,'hook');e.pt=500;e.face=face;e.marks.a=1;
   const hook={type:'hook',owner:e,x:player.x,y:player.y,h:58,dir:face,age:0,out:true,hit:false,dead:false};hazards=[hook];
   check(catchGorathHook(hook),'Actual Gorath catch entry');
  }else{
   const s=sovData(e);for(const f of s.fists){const [x,y,h]=sovHome(e,f,s);Object.assign(f,{x,y,h,st:'home',hp:180,max:180});}
   sovStartJob(e,s,'grab');const job=s.jobs[0];job.dir=face;job.stage='hold';job.st=0;check(sovCatch(e,job),'Actual Sovereign catch entry');
  }
  return e;
 };
 window.grabStep=()=>{const processed=update();if(processed)for(const k in pressed){pressed[k]-=MS;if(pressed[k]<=0)delete pressed[k];}};
 const isNew=()=>!!barelPlayerFrame().image?.src.includes('barel-grabbed-10.png');
 const traces={};
 for(const mode of ['legacy','aseprite10']){
  traces[mode]=[];
  for(const boss of ['gorath','sovereign'])for(const face of [1,-1]){
   const e=grabSetup(mode,boss,face),trace=[],frames=new Set();let count=0;
   while(player.st==='grabbed'&&count++<130){
    const f=barelPlayerFrame();if(isNew())frames.add(f.index);
    trace.push({t:player.t,x:player.x,y:player.y,z:player.z,vx:player.vx,vz:player.vz,face:player.face,st:player.st,hp:player.hp,
     hold:player.grab.hold,pull:player.grab.pull??0,presses:player.grab.presses,ownerX:e.x,ownerY:e.y,camX});grabStep();
   }
   check(count<130&&player.st==='down'&&!player.grab&&!isNew(),'Existing grab timeout/down '+boss);
   check(player.hp===(boss==='gorath'?80:72),'Existing grab fail damage '+boss+' '+player.hp);
   if(mode==='aseprite10')check(frames.size===10,'All ten actual grab states '+boss);
   traces[mode].push({boss,face,trace,end:{x:player.x,y:player.y,z:player.z,st:player.st,hp:player.hp,inv:player.inv}});
  }
 }
 check(JSON.stringify(traces.legacy)===JSON.stringify(traces.aseprite10),'All owner relationship/hold/damage/position rules identical');
 const escapes=[];
 for(const boss of ['gorath','sovereign']){
  const e=grabSetup('aseprite10',boss,1);const before={hp:player.hp,mg:player.mg,sp:player.sp};
  inputDown('Space');inputDown('ShiftLeft');inputDown('KeyU');grabStep();
  check(player.st==='grabbed'&&player.z===0&&player.vz===0&&player.grab.presses===0&&player.atk===null,'Jump/dash/skill remain blocked');
  inputUp('Space');inputUp('ShiftLeft');inputUp('KeyU');
  check(!hurtPlayer(9,-1,true),'Ordinary additional damage remains rejected while grabbed');
  for(const key of ['KeyJ','KeyA','KeyD']){inputDown(key);grabStep();inputUp(key);}
  check(player.st==='grabbed'&&player.grab.presses===3&&player.face===-1&&player.hp===before.hp,'Three presses resist without attacking or facing change');
  inputDown('KeyJ');grabStep();inputUp('KeyJ');
  check(player.st==='free'&&!player.grab&&player.inv>=30&&!isNew(),'Fourth press escape');
  check(player.mg===before.mg&&player.sp===before.sp&&player.hp===before.hp,'No accidental attacks/skills/damage');
  escapes.push({boss,st:player.st,hp:player.hp,inv:player.inv,ownerState:e.st});
  grabSetup('aseprite10',boss,1);for(let i=0;i<5;i++)grabStep();
  const snapshot={t:player.t,x:player.x,y:player.y,hold:player.grab.hold,index:barelPlayerFrame().index};
  pauseGame();for(let i=0;i<5;i++)grabStep();check(player.t===snapshot.t&&player.x===snapshot.x&&player.grab.hold===snapshot.hold&&barelPlayerFrame().index===snapshot.index,'Pause freeze');resumeGame();
  hitStop=4;for(let i=0;i<4;i++)grabStep();check(player.t===snapshot.t&&barelPlayerFrame().index===snapshot.index,'Hitstop freeze');
  player.grab.owner.st='dead';updPlayer();check(player.st==='free'&&!player.grab&&!isNew(),'Owner death cancels grabbed');
 }
 grabSetup('aseprite10','gorath',1);
 const boundaries=[[0,0],[64.999,0],[65,1],[130,2],[585,9],[649.999,9],[650,2],[1169.999,9],[1170,2]];
 for(const [time,index] of boundaries){player.t=time/MS;check(barelPlayerFrame().index===index,'Grab loop boundary '+time);}
 const snapshot={x:player.x,y:player.y,z:player.z,t:player.t,presses:player.grab.presses,hold:player.grab.hold};
 for(let i=0;i<100;i++)barelPlayerFrame();check(JSON.stringify(snapshot)===JSON.stringify({x:player.x,y:player.y,z:player.z,t:player.t,presses:player.grab.presses,hold:player.grab.hold}),'Rendering pure');
 const saved=player.grab;player.grab=null;check(BarelGrabbed.frameFor(player,MS)===null&&barelPlayerFrame()===barelFrame('hook',player.t*MS/650,true),'Orphan state uses legacy');player.grab=saved;
 check(BarelGrabbed.frameFor({...player,characterId:'viesa'},MS)===null,'Other character excluded');
 window.grabSheet=face=>{
  grabSetup('aseprite10','gorath',-face);ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle='#20242c';ctx.fillRect(0,0,cv.width,cv.height);ctx.scale(cv.width/960,cv.height/540);
  for(let i=0;i<10;i++){player.t=i*65/MS;const x=100+i%5*180,y=225+Math.floor(i/5)*250;
   ctx.strokeStyle='#546170';ctx.beginPath();ctx.moveTo(x-80,y);ctx.lineTo(x+80,y);ctx.stroke();ctx.fillStyle='#eee';ctx.font='14px sans-serif';ctx.fillText('F'+(i+1),x-60,y+25);paintBarel(barelPlayerFrame(),{x:x+camX,y,z:0,face,flash:0});}
  ctx.restore();return cv.toDataURL('image/png').split(',')[1];
 };
 return {entryMs:650,resistanceFromFrame:3,resistanceLoopMs:520,escapePresses:4,holdTicks:50,boundaries,worldParity:true,traces,escapes};
}
