const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
module.exports=async({evaluate,call,errors,root,environment})=>{
 const out=path.join(root,'artifacts/barel-walk-10',environment);fs.mkdirSync(out,{recursive:true});
 for(const object of ['BarelWalk','BarelIdle','BarelCombo0','BarelCombo1','BarelCombo2'])assert.equal(await evaluate(`${object}.ready`),true);
 assert.equal(await evaluate('BarelWalk.status().effective'),'aseprite10');
 await evaluate('window.walkRAF=requestAnimationFrame;requestAnimationFrame=()=>0;AUDIO.enable(false);beginGame();showScreen(null)');
 await evaluate('new Promise(resolve=>walkRAF(()=>resolve()))');
 assert.equal(await evaluate(`(()=>{clearInput();selectedCharacterId='barel';player=newPlayer(0,'barel');startStage(0);scene='play';inputDown('KeyD');updPlayer();return barelPlayerFrame().image?.src.includes('/barel-walk-10.png');})()`),true,'Default walk must render the supplied atlas without setMode or query overrides');
 const results=await evaluate(`(${trial.toString()})()`);
 for(const face of [1,-1]){
  const png=await evaluate(`walkSheet(${face})`);fs.writeFileSync(path.join(out,`ten-frames-${face}.png`),Buffer.from(png,'base64'));
 }
 const realtime=await evaluate(`(async()=>{
  walkSetup('aseprite10');inputDown('KeyD');update();last=performance.now();acc=0;const started=last,seen={},trace=[];let previous=-1,wraps=0;
  return new Promise((resolve,reject)=>{function sample(now){try{loop(now);const f=barelPlayerFrame();
   if(!f.image?.src.includes('barel-walk-10.png'))throw Error('Walk missing in live loop');
   seen[f.index]=true;if(previous===9&&f.index===0)wraps++;previous=f.index;
   trace.push({wallMs:now-started,clockMs:player.walkTime,index:f.index,x:player.x,y:player.y,camX});
   if(now-started<2100)walkRAF(sample);else{inputUp('KeyD');resolve({seen:Object.keys(seen).map(Number),wraps,trace});}}catch(error){reject(error);}}
  walkRAF(sample);});})()`);
 assert.equal(realtime.seen.length,10);assert(realtime.wraps>=2);
 const shot=await call('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,'game.png'),Buffer.from(shot.data,'base64'));
 const loader=fs.readFileSync(path.join(root,'src/animation/barel-walk.js'),'utf8');
 const fallback=await evaluate(`(async()=>{
  const original=BarelWalk,nativeFetch=fetch,config=window.BAREL_WALK_CONFIG,results=[];
  try{for(const failure of ['http','parse','image','timing','bounds','metadata','offset','scale','period','clock','loop']){
   window.BAREL_WALK_CONFIG={mode:'aseprite10'};
   window.fetch=async(url,...args)=>{const name=String(url);
    if(name.endsWith('barel-walk-10.animation.json')){
     if(failure==='http')return {ok:false,status:503};
     if(failure==='parse')return {ok:true,json:async()=>{throw SyntaxError('Invalid walk JSON')}};
     const data=await(await nativeFetch(url,...args)).json();
     if(failure==='metadata')data.animationId='idle';if(failure==='offset')data.frameOffsets[0]=[999,0];
     if(failure==='scale')data.renderScale*=2;if(failure==='period')data.durationMs=901;
     if(failure==='clock')data.clock.source='tick * MS';if(failure==='loop')data.loop=false;
     return {ok:true,json:async()=>data};
    }
    const response=await nativeFetch(url,...args);
    if(name.endsWith('/barel-walk-10.json')){const data=await response.json();
     if(failure==='timing')data.frames[0].duration=91;if(failure==='bounds')data.frames[1].frame.x=99999;
     if(failure==='image')data.meta.image='missing-walk.png';return {ok:true,json:async()=>data};}
    return response;};
   eval(${JSON.stringify(loader)});const loaded=await BarelWalk.ready;walkSetup('aseprite10');player.walk=true;
   if(loaded||BarelWalk.status().effective!=='legacy'||barelPlayerFrame()!==barelFrame('walk',0,true))throw Error('Fallback '+failure);
   results.push({failure,status:BarelWalk.status()});
  }}finally{window.fetch=nativeFetch;window.BarelWalk=original;window.BAREL_WALK_CONFIG=config;}
  BarelWalk.setMode('aseprite10');return results;})()`);
 assert.deepEqual(errors,[]);
 const metadata=JSON.parse(fs.readFileSync(path.join(root,'assets/aseprite/barel-walk-10/barel-walk-10.animation.json'),'utf8'));
 for(const sample of realtime.trace)sample.frontContactWorldX=sample.x+(metadata.visualReview.feet[sample.index].front.soleX-224)*metadata.renderScale*.72;
 fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({environment,...results,realtime,fallback,visualReview:metadata.visualReview,defaultMode:await evaluate('BarelWalk.status()'),browserErrors:errors},null,2));
 console.log('PASS '+environment+': supplied walk atlas active by default without override; 10 x 90ms, live loops, flip, movement/camera/depth parity, state transitions, 11 fallbacks. Original gait preserved.');
};
function trial(){
 const check=(v,m)=>{if(!v)throw Error(m);};
 window.walkSetup=mode=>{
  clearInput();selectedCharacterId='barel';player=newPlayer(0,'barel');startStage(0);scene='play';showScreen(null);
  stage={...stage,waves:[]};practice=false;camX=0;camLock=false;waveIdx=0;
  const dummy=mkEnemy('grunt',3000,480);dummy.training=true;enemies=[dummy];
  hazards=[];arena=null;barrels=[];items=[];parts=[];texts=[];impacts=[];bursts=[];ghosts=[];bolts=[];
  hitStop=shake=flashT=clearT=slowT=0;tick=0;player.x=300;player.y=420;player.inv=0;BarelWalk.setMode(mode);
 };
 const step=()=>{tick++;updPlayer();};
 walkSetup('aseprite10');player.walk=true;
 for(const [time,index] of [[0,0],[89.999,0],[90,1],[810,9],[899.999,9],[900,0],[990,1],[1800,0]]){
  player.walkTime=time;check(barelPlayerFrame().index===index,'Boundary '+time);
 }
 const before=JSON.stringify(player);for(let i=0;i<100;i++)barelPlayerFrame();check(before===JSON.stringify(player),'Sampling changes actor');
 const traces={};
 for(const mode of ['legacy','aseprite10']){
  walkSetup(mode);const trace=[];
  for(let i=0;i<260;i++){
   if(i===0)inputDown('KeyD');if(i===65){inputUp('KeyD');inputDown('KeyA');}
   if(i===100){inputUp('KeyA');inputDown('KeyW');}if(i===130){inputDown('KeyD');}
   if(i===155){inputUp('KeyW');inputUp('KeyD');}if(i===170)inputDown('KeyD');
   if(i===200)player.x=stage.len-1;
   update();trace.push({x:player.x,y:player.y,z:player.z,face:player.face,st:player.st,clock:player.walkTime,walk:player.walk,camX,hp:player.hp});
  }traces[mode]=trace;
 }
 check(JSON.stringify(traces.legacy)===JSON.stringify(traces.aseprite10),'Movement/depth/camera/edge parity');
 walkSetup('aseprite10');inputDown('KeyD');step();check(player.walkTime===0&&barelPlayerFrame().index===0,'Start F1');
 for(let i=0;i<6;i++)step();check(Math.abs(player.x-321.7)<1e-8,'Existing X speed');
 const phase=player.walkTime;inputUp('KeyD');inputDown('KeyA');step();check(player.face===-1&&player.walkTime>phase,'Reverse continuous phase');
 inputUp('KeyA');step();check(!player.walk&&player.walkTime===0&&barelPlayerFrame().image.src.includes('barel-idle'),'Stop idle');
 inputDown('KeyW');const y=player.y;step();check(player.face===-1&&Math.abs(player.y-y+2.325)<1e-8,'Depth preserves facing and speed');
 const returns=[];
 for(const kind of ['attack','combo','dash','jump','hurt','down']){
  walkSetup('aseprite10');inputDown('KeyD');step();
  if(kind==='attack'||kind==='combo')startAtk(0);
  if(kind==='dash')inputDown('ShiftLeft');if(kind==='jump')inputDown('Space');
  if(kind==='hurt'||kind==='down')hurtPlayer(5,-1,kind==='down');
  step();inputUp('ShiftLeft');inputUp('Space');let count=0;
  if(kind==='dash')check(player.st==='dash','Dash entered');
  if(kind==='jump')check(player.vz>0,'Jump entered');
  if(kind==='hurt')check(player.st==='hurt','Hurt entered');
  if(kind==='down')check(player.st==='down','Down entered');
  while((player.st!=='free'||player.z>0||!player.walk)&&count++<200){
   if(kind==='combo'&&player.st==='atk'&&player.combo<2&&player.t*MS>150)player.buf=220;
   step();
  }
  check(count<200&&barelPlayerFrame().image?.src.includes('barel-walk-10.png'),'Return from '+kind);returns.push({kind,ticks:count});
 }
 walkSetup('aseprite10');player.walk=true;player.walkTime=180;hitStop=4;const clock=player.walkTime;
 for(let i=0;i<3;i++)update();check(player.walkTime===clock&&barelPlayerFrame().index===2,'Hitstop freezes walk clock');
 for(const state of [{st:'atk',atk:'c1',combo:0},{st:'dash'},{st:'hurt'},{st:'down'},{st:'free',z:20},{st:'free',walk:false}]){
  walkSetup('legacy');Object.assign(player,state);const old=barelPlayerFrame();BarelWalk.setMode('aseprite10');check(old===barelPlayerFrame(),'Other animation unchanged '+state.st);
 }
 window.walkSheet=face=>{
  walkSetup('aseprite10');player.walk=true;ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle='#20242c';ctx.fillRect(0,0,cv.width,cv.height);ctx.scale(cv.width/960,cv.height/540);
  for(let i=0;i<10;i++){player.walkTime=i*90;const x=100+i%5*180,y=225+Math.floor(i/5)*250;
   ctx.strokeStyle='#546170';ctx.beginPath();ctx.moveTo(x-80,y);ctx.lineTo(x+80,y);ctx.stroke();ctx.fillStyle='#eee';ctx.font='14px sans-serif';ctx.fillText('F'+(i+1),x-60,y+25);paintBarel(barelPlayerFrame(),{x,y,z:0,face,flash:0});}
  ctx.restore();return cv.toDataURL('image/png').split(',')[1];
 };
 return {periodMs:900,durationsMs:Array(10).fill(90),clock:'player.walkTime',movementParity:true,returns,traces};
}
