// Actual Canvas/game-loop verification in Chrome and Streamlit iframe.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
module.exports=async({evaluate,call,errors,root,environment})=>{
 const out=path.join(root,'artifacts/barel-dash-10',environment);fs.mkdirSync(out,{recursive:true});
 for(const object of ['BarelDash','BarelWalk','BarelIdle','BarelCombo0','BarelCombo1','BarelCombo2'])assert.equal(await evaluate(`${object}.ready`),true);
 assert.equal(await evaluate('BarelDash.status().effective'),'aseprite10');
 await evaluate('window.dashRAF=requestAnimationFrame;requestAnimationFrame=()=>0;AUDIO.enable(false);beginGame();showScreen(null)');
 await evaluate('new Promise(resolve=>dashRAF(()=>resolve()))');
 const results=await evaluate(`(${trial.toString()})()`);
 for(const face of [1,-1]){
  const png=await evaluate(`dashSheet(${face})`);fs.writeFileSync(path.join(out,`ten-frames-${face}.png`),Buffer.from(png,'base64'));
  await evaluate(`dashSetup('aseprite10');startDash(${face});for(let i=0;i<6;i++)update();render()`);
  const shot=await call('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,`afterimages-${face}.png`),Buffer.from(shot.data,'base64'));
 }
 const realtime=await evaluate(`(async()=>{
  dashSetup('aseprite10');startDash(1);last=performance.now();acc=0;
  const started=last,seen={0:true},trace=[];let dashes=1,maxGhosts=0;
  return new Promise((resolve,reject)=>{function sample(now){try{
   loop(now);const f=barelPlayerFrame(),fx=BarelDashFx.status();maxGhosts=Math.max(maxGhosts,fx.length);
   if(fx.length>4)throw Error('Unbounded afterimages');
   if(player.st==='dash'){if(!f.image?.src.includes('barel-dash-10.png'))throw Error('Default dash atlas missing');seen[f.index]=true;}
   trace.push({wallMs:now-started,t:player.t,st:player.st,index:player.st==='dash'?f.index:null,x:player.x,face:player.face,fx});
   if(player.st==='free'&&player.dashCd===0&&dashes<5){startDash(dashes%2?-1:1);dashes++;}
   if(now-started<2900)dashRAF(sample);else resolve({seen:Object.keys(seen).map(Number),dashes,maxGhosts,trace});
  }catch(error){reject(error);}}dashRAF(sample);});})()`);
 assert.equal(realtime.seen.length,10);assert.equal(realtime.dashes,5);assert(realtime.maxGhosts>=3&&realtime.maxGhosts<=4);
 const loader=fs.readFileSync(path.join(root,'src/animation/barel-dash.js'),'utf8');
 const fallback=await evaluate(`(async()=>{
  const original=BarelDash,originalFx=BarelDashFx,nativeFetch=fetch,config=window.BAREL_DASH_CONFIG,results=[];
  try{for(const failure of ['http','parse','image','timing','bounds','metadata','offset','scale','period','clock','loop']){
   window.BAREL_DASH_CONFIG={};window.fetch=async(url,...args)=>{const name=String(url);
    if(name.endsWith('barel-dash-10.animation.json')){
     if(failure==='http')return {ok:false,status:503};if(failure==='parse')return {ok:true,json:async()=>{throw SyntaxError('Bad dash JSON')}};
     const data=await(await nativeFetch(url,...args)).json();
     if(failure==='metadata')data.animationId='walk';if(failure==='offset')data.frameOffsets[0]=[999,0];
     if(failure==='scale')data.renderScale*=2;if(failure==='period')data.durationMs=200;
     if(failure==='clock')data.clock.source='player.walkTime';if(failure==='loop')data.loop=true;
     return {ok:true,json:async()=>data};
    }
    const response=await nativeFetch(url,...args);
    if(name.endsWith('/barel-dash-10.json')){const data=await response.json();
     if(failure==='timing')data.frames[0].duration=20;if(failure==='bounds')data.frames[1].frame.x=99999;
     if(failure==='image')data.meta.image='missing-dash.png';return {ok:true,json:async()=>data};}
    return response;};
   eval(${JSON.stringify(loader)});const loaded=await BarelDash.ready;dashSetup('aseprite10');startDash(1);
   if(loaded||BarelDash.status().effective!=='legacy'||barelPlayerFrame()!==barelFrame('dash',0))throw Error('Fallback '+failure);
   results.push({failure,status:BarelDash.status()});
  }}finally{window.fetch=nativeFetch;window.BarelDash=original;window.BarelDashFx=originalFx;window.BAREL_DASH_CONFIG=config;BarelDashFx.clear();}
  return results;})()`);
 assert.deepEqual(errors,[]);
 fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({environment,...results,realtime,fallback,defaultMode:await evaluate('BarelDash.status()'),browserErrors:errors},null,2));
 console.log('PASS '+environment+': default dash atlas, ten live frames, five alternating dashes, 80px/190ms contract, attack cancel110ms, red fixed snapshots/max4/fade, unchanged state traces, 11 fallbacks');
};
function trial(){
 const check=(v,m)=>{if(!v)throw Error(m);};
 window.dashSetup=mode=>{
  clearInput();selectedCharacterId='barel';player=newPlayer(0,'barel');startStage(0);scene='play';showScreen(null);
  stage={...stage,waves:[]};practice=false;camX=0;camLock=false;waveIdx=0;
  const dummy=mkEnemy('grunt',3000,480);dummy.training=true;enemies=[dummy];
  hazards=[];arena=null;barrels=[];items=[];parts=[];texts=[];impacts=[];bursts=[];ghosts=[];bolts=[];
  hitStop=shake=flashT=clearT=slowT=0;tick=0;player.x=300;player.y=420;player.inv=0;BarelDash.setMode(mode);BarelDashFx.clear();
 };
 dashSetup('aseprite10');startDash(1);
 for(let i=0;i<10;i++){player.t=i*19/MS;check(barelPlayerFrame().index===i,'Frame boundary '+i);}
 const before=JSON.stringify(player);for(let i=0;i<100;i++)barelPlayerFrame();check(before===JSON.stringify(player),'Render cannot mutate actor');
 const traces={};
 for(const mode of ['legacy','aseprite10']){
  traces[mode]=[];
  for(const face of [1,-1]){
   dashSetup(mode);startDash(face);const trace=[];let seen=new Set([0]);
   for(let i=0;i<20;i++){update();if(player.st==='dash'&&mode==='aseprite10')seen.add(barelPlayerFrame().index);
    trace.push({x:player.x,y:player.y,z:player.z,st:player.st,t:player.t,face:player.face,inv:player.inv,cd:player.dashCd,hp:player.hp,camX});}
   check(Math.abs(player.x-(300+face*80))<1e-8,'Distance 80px');check(trace[10].st==='dash'&&trace[11].st==='free','Existing 190ms ends on fixed tick 200ms');
   if(mode==='aseprite10')check(seen.size===10,'Ten frames at actual fixed ticks');
   traces[mode].push(trace);
  }
 }
 check(JSON.stringify(traces.legacy)===JSON.stringify(traces.aseprite10),'Dash world/collision/invulnerability/camera parity');
 const transitions=[];
 for(const key of [null,'KeyD','KeyA']){
  dashSetup('aseprite10');if(key)inputDown(key);startDash(1);for(let i=0;i<13;i++)update();
  check(player.st==='free','Exit free');check(!!player.walk===!!key,'Exit follows held movement');
  check(barelPlayerFrame().image?.src.includes(key?'barel-walk-dot-10.png':'barel-idle-dot-10.png'),'Exit correct clip');transitions.push({key,st:player.st,walk:player.walk});
 }
 dashSetup('aseprite10');inputDown('ShiftLeft');update();inputUp('ShiftLeft');check(player.st==='dash','Existing dash key');
 dashSetup('aseprite10');inputDown('KeyD');update();inputUp('KeyD');update();inputDown('KeyD');update();check(player.st==='dash','Existing double tap');
 dashSetup('aseprite10');startDash(1);for(let i=0;i<6;i++)update();inputDown('KeyJ');update();
 check(player.st==='atk'&&player.combo===0&&barelPlayerFrame().image?.src.includes('barel-combo0-dot-10.png'),'Attack priority after110ms');
 for(let i=0;i<5;i++)update();check(BarelDashFx.status().length===0,'Cancel drains afterimages');
 dashSetup('aseprite10');startAtk(0);inputDown('ShiftLeft');update();check(player.st==='dash','Existing attack to dash cancel');
 dashSetup('aseprite10');startDash(1);inputDown('KeyA');for(let i=0;i<5;i++)update();check(player.face===1,'Existing dash facing fixed');
 dashSetup('aseprite10');startDash(1);for(let i=0;i<6;i++)update();
 const saved=BarelDashFx.status();check(saved.length===3,'33ms capture cadence');
 const last=saved.at(-1);check(last.index===5&&last.face===1,'Frame and direction snapshot');
 player.x+=25;camX+=60;ctx.globalAlpha=.37;ctx.filter='none';const unchanged=JSON.stringify(BarelDashFx.status());
 const nativeDraw=ctx.drawImage;let tinted=null;
 ctx.drawImage=function(image,...args){tinted=image;return nativeDraw.call(this,image,...args);};
 try{BarelDashFx.draw();}finally{ctx.drawImage=nativeDraw;}
 check(ctx.globalAlpha===.37&&ctx.filter==='none','Canvas state restored');ctx.globalAlpha=1;
 const raw=document.createElement('canvas'),atlas=barelPlayerFrame().image;raw.width=atlas.naturalWidth;raw.height=atlas.naturalHeight;
 raw.getContext('2d').drawImage(atlas,0,0);
 const originalPixels=raw.getContext('2d').getImageData(0,0,raw.width,raw.height).data;
 const tintedPixels=tinted.getContext('2d').getImageData(0,0,raw.width,raw.height).data;
 let metalChecked=false;const colors=new Set();
 for(let i=0;i<originalPixels.length;i+=4){
  if(originalPixels[i+3]>220){
   colors.add(tintedPixels.slice(i,i+3).join(','));
   if(!metalChecked&&originalPixels[i+1]>90&&Math.abs(originalPixels[i]-originalPixels[i+1])<12){
    check(tintedPixels[i]-tintedPixels[i+1]>originalPixels[i]-originalPixels[i+1],'Crimson tint on armor');
    const luminance=p=>.2126*p[i]+.7152*p[i+1]+.0722*p[i+2];
    check(luminance(tintedPixels)<luminance(originalPixels),'Tint does not brighten armor');metalChecked=true;
   }
  }
 }
 check(metalChecked&&colors.size>100,'Afterimage preserves armor/blade detail rather than flat silhouette');
 check(JSON.stringify(BarelDashFx.status())===unchanged,'Render/camera cannot move snapshots');
 hitStop=3;const clock=player.t;for(let i=0;i<3;i++)update();check(player.t===clock&&JSON.stringify(BarelDashFx.status())===unchanged,'Hitstop freezes animation and snapshots');
 update();check(BarelDashFx.status().some(g=>g.x===last.x&&g.y===last.y&&g.index===last.index),'Existing snapshots fixed after player moves');
 player.st='free';const alpha=BarelDashFx.status()[0].alpha;updFx();check(BarelDashFx.status()[0].alpha<alpha,'Fade decreases alpha');
 for(let i=0;i<12;i++)updFx();check(BarelDashFx.status().length===0,'Expired snapshots removed');
 for(let n=0;n<20;n++){startDash(n%2?-1:1);for(let i=0;i<9;i++)update();check(BarelDashFx.status().length<=4,'Rapid repeat cap');}
 startStage(0);check(BarelDashFx.status().length===0,'Stage reset clears snapshots');
 dashSetup('aseprite10');player.x=stage.len-30;startDash(1);for(let i=0;i<12;i++)update();check(player.x<=stage.len-20,'Stage clamp preserved');
 dashSetup('aseprite10');selectedCharacterId='viesa';player=newPlayer(0,'viesa');player.x=300;player.y=420;startDash(1);for(let i=0;i<6;i++)update();
 check(BarelDashFx.status().length===0&&ghosts.some(g=>g.viesa),'Viesa keeps existing ghosts');
 window.dashSheet=face=>{
  dashSetup('aseprite10');startDash(face);ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle='#20242c';ctx.fillRect(0,0,cv.width,cv.height);ctx.scale(cv.width/960,cv.height/540);
  for(let i=0;i<10;i++){player.t=i*19/MS;const x=100+i%5*180,y=225+Math.floor(i/5)*250;
   ctx.strokeStyle='#546170';ctx.beginPath();ctx.moveTo(x-80,y);ctx.lineTo(x+80,y);ctx.stroke();ctx.fillStyle='#eee';ctx.font='14px sans-serif';ctx.fillText('F'+(i+1)+' '+i*19+'ms',x-60,y+25);paintBarel(barelPlayerFrame(),{x,y,z:0,face,flash:0});}
  ctx.restore();return cv.toDataURL('image/png').split(',')[1];
 };
 return {periodMs:190,durationsMs:Array(10).fill(19),distance:80,travelMs:150,cancelMs:110,actualFixedTickEndMs:200,
   timingPreserved:true,worldParity:true,transitions,afterimageCheck:{intervalMs:1000/30,maxCount:4,lifeMs:150,saved},traces};
}
