const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
module.exports=async({evaluate,call,errors,root,environment})=>{
 const out=path.join(root,'artifacts/barel-air-attack-10',environment);fs.mkdirSync(out,{recursive:true});
 for(const object of ['BarelAirAttack','BarelJump','BarelIdle','BarelWalk','BarelDash','BarelCombo0','BarelCombo1','BarelCombo2'])assert.equal(await evaluate(`${object}.ready`),true);
 assert.equal(await evaluate('BarelAirAttack.status().effective'),'aseprite10');
 await evaluate('window.airRAF=requestAnimationFrame;requestAnimationFrame=()=>0;AUDIO.enable(false);beginGame();showScreen(null)');
 await evaluate('new Promise(resolve=>airRAF(()=>resolve()))');
 const results=await evaluate(`(${trial.toString()})()`);
 for(const face of [1,-1]){
  const png=await evaluate(`airSheet(${face})`);fs.writeFileSync(path.join(out,`ten-frames-${face}.png`),Buffer.from(png,'base64'));
  await evaluate(`airSetup('aseprite10');player.face=${face};airLaunch(1);for(let i=0;i<17;i++)airStep();render()`);
  const shot=await call('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,`game-${face}.png`),Buffer.from(shot.data,'base64'));
 }
 const realtime=await evaluate(`(async()=>{
  airSetup('aseprite10');airLaunch(1);last=performance.now();acc=0;const started=last,seen={},trace=[];
  return new Promise((resolve,reject)=>{function sample(now){try{
   loop(now);const f=barelPlayerFrame(),isAir=f.image?.src.includes('barel-air-attack-10.png');if(isAir)seen[f.index]=true;
   trace.push({wallMs:now-started,frame:isAir?f.index:null,t:player.t,z:player.z,vz:player.vz,x:player.x,st:player.st,atk:player.atk});
   if(now-started<850)airRAF(sample);else resolve({seen:Object.keys(seen).map(Number),trace,idle:f.image?.src.includes('barel-idle-dot-10.png')});
  }catch(error){reject(error);}}airRAF(sample);});})()`);
 assert.equal(realtime.seen.length,10);assert(realtime.idle);
 const loader=fs.readFileSync(path.join(root,'src/animation/barel-air-attack.js'),'utf8');
 const fallback=await evaluate(`(async()=>{
  const original=BarelAirAttack,nativeFetch=fetch,config=window.BAREL_AIR_ATTACK_CONFIG,results=[];
  try{for(const failure of ['http','parse','image','timing','bounds','metadata','offset','scale','period','clock','loop','combat']){
   window.BAREL_AIR_ATTACK_CONFIG={};window.fetch=async(url,...args)=>{const name=String(url);
    if(name.endsWith('barel-air-attack-10.animation.json')){
     if(failure==='http')return {ok:false,status:503};if(failure==='parse')return {ok:true,json:async()=>{throw SyntaxError('Bad aerial JSON')}};
     const data=await(await nativeFetch(url,...args)).json();
     if(failure==='metadata')data.animationId='jump';if(failure==='offset')data.frameOffsets[0]=[999,0];
     if(failure==='scale')data.renderScale*=2;if(failure==='period')data.durationMs=410;
     if(failure==='clock')data.clock.mapping='fixed-duration';if(failure==='loop')data.loop=true;
     if(failure==='combat')data.combatReference.damage=15;
     return {ok:true,json:async()=>data};
    }
    const response=await nativeFetch(url,...args);
    if(name.endsWith('/barel-air-attack-10.json')){const data=await response.json();
     if(failure==='timing')data.frames[0].duration=41;if(failure==='bounds')data.frames[1].frame.x=99999;
     if(failure==='image')data.meta.image='missing-aerial.png';return {ok:true,json:async()=>data};}
    return response;};
   eval(${JSON.stringify(loader)});const loaded=await BarelAirAttack.ready;airSetup('aseprite10');airLaunch(1);
   if(loaded||BarelAirAttack.status().effective!=='legacy'||barelPlayerFrame()!==barelFrame('air',0))throw Error('Fallback '+failure);
   results.push({failure,status:BarelAirAttack.status()});
  }}finally{window.fetch=nativeFetch;window.BarelAirAttack=original;window.BAREL_AIR_ATTACK_CONFIG=config;}
  return results;})()`);
 assert.deepEqual(errors,[]);
 fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({environment,...results,realtime,fallback,defaultMode:await evaluate('BarelAirAttack.status()'),browserErrors:errors},null,2));
 console.log('PASS '+environment+': ten actual aerial slash frames, landing-dependent lifetime unchanged, 14 damage/one hit/2.6 movement/effective hitstop6 parity, hit-pose sync, early/late inputs, transitions, 12 fallbacks');
};
function trial(){
 const check=(v,m)=>{if(!v)throw Error(m);};
 window.airSetup=mode=>{
  clearInput();selectedCharacterId='barel';player=newPlayer(0,'barel');startStage(0);scene='play';showScreen(null);
  stage={...stage,waves:[]};practice=false;camX=0;camLock=false;waveIdx=0;
  const dummy=mkEnemy('grunt',3000,480);dummy.training=true;enemies=[dummy];
  hazards=[];arena=null;barrels=[];items=[];parts=[];texts=[];impacts=[];bursts=[];ghosts=[];bolts=[];
  hitStop=shake=flashT=clearT=slowT=0;tick=0;player.x=300;player.y=420;player.inv=0;BarelAirAttack.setMode(mode);
 };
 window.airStep=()=>{const processed=update();if(processed)for(const k in pressed){pressed[k]-=MS;if(pressed[k]<=0)delete pressed[k];}};
 window.airLaunch=entry=>{
  inputDown('Space');airStep();inputUp('Space');
  for(let i=1;i<entry;i++)airStep();inputDown('KeyJ');airStep();inputUp('KeyJ');
 };
 const isNew=()=>!!barelPlayerFrame().image?.src.includes('barel-air-attack-10.png');
 const traces={};let normalFrames=[];
 for(const mode of ['legacy','aseprite10']){
  traces[mode]=[];
  for(const entry of [1,6,18,32,35])for(const face of [1,-1]){
   airSetup(mode);player.face=face;airLaunch(entry);check(player.st==='atk'&&player.atk==='air','Existing airborne entry');
   const start=player.x,trace=[],frames=new Set();let count=0;
   while(player.st==='atk'&&count++<80){
    const f=barelPlayerFrame();if(isNew())frames.add(f.index);
    trace.push({t:player.t,x:player.x,y:player.y,z:player.z,vz:player.vz,jumpTime:player.jumpTime,st:player.st,hp:player.hp,camX});airStep();
   }
   check(count===36-entry,'Same remaining airborne lifetime '+entry);
   check(Math.abs(player.x-start-face*(36-entry)*2.6)<1e-8,'Original aerial movement');
   check(player.z===0&&player.vz===0&&player.st==='free'&&!isNew(),'Immediate original landing exit');
   if(mode==='aseprite10'&&entry===1){check(frames.size===10,'Ten frames on normal early input');normalFrames=[...frames];}
   traces[mode].push({entry,face,trace,end:{x:player.x,y:player.y,z:player.z,st:player.st,t:player.t}});
  }
 }
 check(JSON.stringify(traces.legacy)===JSON.stringify(traces.aseprite10),'Identical duration/world/physics/collision state traces');
 const damageTraces={};
 for(const mode of ['legacy','aseprite10']){
  airSetup(mode);airLaunch(1);const target=mkEnemy('grunt',player.x+30,player.y);target.z=player.z;enemies=[target];
  const hp=target.hp;airStep();check(hp-target.hp===14&&player.hitSet.size===1&&hitStop===6&&target.st==='down','14 damage, one hit, knockdown, effective hitstop6 '+JSON.stringify({damage:hp-target.hp,hits:player.hitSet.size,hitStop,inv:target.inv,st:target.st}));
  if(mode==='aseprite10')check(barelPlayerFrame().index===5,'Actual early hit advances immediately to F6');
  const frozen={t:player.t,x:player.x,z:player.z,index:barelPlayerFrame().index};
  for(let i=0;i<6;i++){airStep();check(player.t===frozen.t&&player.x===frozen.x&&player.z===frozen.z,'Hitstop freezes original clock/physics');if(mode==='aseprite10')check(barelPlayerFrame().index===frozen.index,'Hitstop freezes new pose');}
  const trace=[];let count=0;
  while(player.st==='atk'&&count++<80){trace.push({t:player.t,x:player.x,z:player.z,hp:target.hp,hitSet:player.hitSet.size,hitStop});airStep();}
  check(hp-target.hp===14,'No extra hit from animation');damageTraces[mode]=trace;
 }
 check(JSON.stringify(damageTraces.legacy)===JSON.stringify(damageTraces.aseprite10),'Damage/forward/hitstop parity');
 airSetup('aseprite10');airLaunch(1);const before=JSON.stringify(player);for(let i=0;i<100;i++)barelPlayerFrame();check(JSON.stringify(player)===before,'Pure sampling');
 pauseGame();const paused=JSON.stringify(player),frame=barelPlayerFrame();for(let i=0;i<4;i++)airStep();check(JSON.stringify(player)===paused&&barelPlayerFrame()===frame,'Pause freezes attack');resumeGame();
 inputDown('ShiftLeft');airStep();inputUp('ShiftLeft');check(player.st==='atk'&&isNew(),'Air dash remains blocked');check(!startSkill('thrust'),'Air skill policy retained');
 check(hurtPlayer(5,-1,false),'Air hit accepted');check(player.st==='down'&&!isNew(),'Air hit cancels into down');
 for(let i=0;i<110&&player.st!=='free';i++)airStep();check(player.st==='free'&&!isNew(),'Down recovery');
 airSetup('aseprite10');inputDown('KeyD');airLaunch(1);while(player.st==='atk')airStep();airStep();check(player.walk&&barelPlayerFrame().image?.src.includes('barel-walk-dot-10.png'),'Landing to walk');
 inputUp('KeyD');airStep();check(barelPlayerFrame().image?.src.includes('barel-idle-dot-10.png'),'Stop to idle');
 for(const combo of [0,1,2]){airSetup('aseprite10');startAtk(combo);check(!isNew(),'Ground combo unaffected '+combo);}
 check(BarelAirAttack.frameFor({characterId:'viesa',st:'atk',atk:'air',t:1,z:20,vz:1},MS)===null,'Other character excluded');
 window.airSheet=face=>{
  airSetup('aseprite10');airLaunch(1);const frames=[];let guard=0;
  while(player.st==='atk'&&guard++<80){const f=barelPlayerFrame();if(!frames[f.index])frames[f.index]={frame:f,z:player.z};airStep();}
  ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle='#20242c';ctx.fillRect(0,0,cv.width,cv.height);ctx.scale(cv.width/960,cv.height/540);
  for(let i=0;i<10;i++){const x=100+i%5*180,y=225+Math.floor(i/5)*250;
   ctx.strokeStyle='#546170';ctx.beginPath();ctx.moveTo(x-80,y);ctx.lineTo(x+80,y);ctx.stroke();ctx.fillStyle='#eee';ctx.font='14px sans-serif';ctx.fillText('F'+(i+1),x-60,y+25);
   paintBarel(frames[i].frame,{x:x+camX,y,z:0,face,flash:0});}
  ctx.restore();return cv.toDataURL('image/png').split(',')[1];
 };
 return {attackName:'air',visualReferenceMs:400,actualEnd:'landing',active:'every-attack-step',normalFrames,damage:14,baseHitStopTicks:5,effectiveHitStopTicks:6,forwardPerTick:2.6,worldParity:true,traces,damageTraces};
}
