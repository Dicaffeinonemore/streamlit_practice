// Real Chrome + actual Streamlit component jump and physics verification.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
module.exports=async({evaluate,call,errors,root,environment})=>{
 const out=path.join(root,'artifacts/barel-jump-10',environment);fs.mkdirSync(out,{recursive:true});
 for(const object of ['BarelJump','BarelWalk','BarelIdle','BarelDash','BarelCombo0','BarelCombo1','BarelCombo2'])assert.equal(await evaluate(`${object}.ready`),true);
 assert.equal(await evaluate('BarelJump.status().effective'),'aseprite10');
 await evaluate('window.jumpRAF=requestAnimationFrame;requestAnimationFrame=()=>0;AUDIO.enable(false);beginGame();showScreen(null)');
 await evaluate('new Promise(resolve=>jumpRAF(()=>resolve()))');
 const results=await evaluate(`(${trial.toString()})()`);
 for(const face of [1,-1]){
  for(const physical of [false,true]){
   const png=await evaluate(`jumpSheet(${face},${physical})`);fs.writeFileSync(path.join(out,`${physical?'trajectory':'ten-frames'}-${face}.png`),Buffer.from(png,'base64'));
  }
  await evaluate(`jumpSetup('aseprite10');player.face=${face};jumpLaunch();for(let i=0;i<18;i++)jumpStep();render()`);
  const shot=await call('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,`apex-${face}.png`),Buffer.from(shot.data,'base64'));
 }
 const realtime=await evaluate(`(async()=>{
  jumpSetup('aseprite10');inputDown('Space');update();inputUp('Space');last=performance.now();acc=0;
  const started=last,seen={},trace=[];
  return new Promise((resolve,reject)=>{function sample(now){try{
   loop(now);const f=barelPlayerFrame(),isJump=f.image?.src.includes('barel-jump-10.png');
   if(isJump)seen[f.index]=true;
   trace.push({wallMs:now-started,frame:isJump?f.index:null,jumpTime:player.jumpTime,z:player.z,vz:player.vz,t:player.t,st:player.st,x:player.x,y:player.y});
   if(now-started<900)jumpRAF(sample);else resolve({seen:Object.keys(seen).map(Number),trace,endedInIdle:f.image?.src.includes('barel-idle-dot-10.png')});
  }catch(error){reject(error);}}jumpRAF(sample);});})()`);
 assert.equal(realtime.seen.length,10,'All ten jump frames in actual RAF');assert(realtime.endedInIdle);
 assert(realtime.trace.some(s=>s.z>88&&s.vz<0),'Real apex');
 const loader=fs.readFileSync(path.join(root,'src/animation/barel-jump.js'),'utf8');
 const fallback=await evaluate(`(async()=>{
  const original=BarelJump,nativeFetch=fetch,config=window.BAREL_JUMP_CONFIG,results=[];
  try{for(const failure of ['http','parse','image','timing','bounds','metadata','offset','scale','period','clock','loop','physics']){
   window.BAREL_JUMP_CONFIG={};window.fetch=async(url,...args)=>{const name=String(url);
    if(name.endsWith('barel-jump-10.animation.json')){
     if(failure==='http')return {ok:false,status:503};if(failure==='parse')return {ok:true,json:async()=>{throw SyntaxError('Bad jump JSON')}};
     const data=await(await nativeFetch(url,...args)).json();
     if(failure==='metadata')data.animationId='walk';if(failure==='offset')data.frameOffsets[0]=[999,0];
     if(failure==='scale')data.renderScale*=2;if(failure==='period')data.durationMs=700;
     if(failure==='clock')data.clock.airSource='player.t * MS';if(failure==='loop')data.loop=true;
     if(failure==='physics')data.physicsReference.gravityPerTick=.6;
     return {ok:true,json:async()=>data};
    }
    const response=await nativeFetch(url,...args);
    if(name.endsWith('/barel-jump-10.json')){const data=await response.json();
     if(failure==='timing')data.frames[0].duration=18;if(failure==='bounds')data.frames[1].frame.x=99999;
     if(failure==='image')data.meta.image='missing-jump.png';return {ok:true,json:async()=>data};}
    return response;};
   eval(${JSON.stringify(loader)});const loaded=await BarelJump.ready;jumpSetup('aseprite10');jumpLaunch();jumpStep();
   if(loaded||BarelJump.status().effective!=='legacy'||barelPlayerFrame()!==barelFrame('jump',.25))throw Error('Fallback '+failure);
   results.push({failure,status:BarelJump.status()});
  }}finally{window.fetch=nativeFetch;window.BarelJump=original;window.BAREL_JUMP_CONFIG=config;BarelJump.reset();}
  return results;})()`);
 assert.deepEqual(errors,[]);
 fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({environment,...results,realtime,fallback,defaultMode:await evaluate('BarelJump.status()'),browserErrors:errors},null,2));
 console.log('PASS '+environment+': default ten jump frames, original 9.6/.55 physics/600ms flight, apex88.65, free control/air attack/hurt/dash policies, flip/landing/idle/walk, pause/hitstop, 12 fallbacks');
};
function trial(){
 const check=(v,m)=>{if(!v)throw Error(m);};
 window.jumpSetup=mode=>{
  clearInput();selectedCharacterId='barel';player=newPlayer(0,'barel');startStage(0);scene='play';showScreen(null);
  stage={...stage,waves:[]};practice=false;camX=0;camLock=false;waveIdx=0;
  const dummy=mkEnemy('grunt',3000,480);dummy.training=true;enemies=[dummy];
  hazards=[];arena=null;barrels=[];items=[];parts=[];texts=[];impacts=[];bursts=[];ghosts=[];bolts=[];
  hitStop=shake=flashT=clearT=slowT=0;tick=0;player.x=300;player.y=420;player.inv=0;BarelJump.setMode(mode);
 };
 window.jumpStep=()=>{const processed=update();if(processed)for(const k in pressed){pressed[k]-=MS;if(pressed[k]<=0)delete pressed[k];}};
 window.jumpLaunch=()=>{inputDown('Space');jumpStep();inputUp('Space');};
 const isNew=()=>!!barelPlayerFrame().image?.src.includes('barel-jump-10.png');
 const traces={};let normal=[];
 for(const mode of ['legacy','aseprite10']){
  traces[mode]=[];
  for(const movement of ['idle','walk','depth','reverse']){
   jumpSetup(mode);if(movement==='walk'||movement==='reverse')inputDown('KeyD');if(movement==='depth')inputDown('KeyW');
   jumpLaunch();const trace=[],frames=new Set();
   for(let n=0;n<48;n++){
    if(n===20&&movement==='reverse'){inputUp('KeyD');inputDown('KeyA');}
    const f=barelPlayerFrame();if(isNew())frames.add(f.index);
    trace.push({n,x:player.x,y:player.y,z:player.z,vz:player.vz,st:player.st,t:player.t,jumpTime:player.jumpTime,
      face:player.face,walk:player.walk,walkTime:player.walkTime,hp:player.hp,hw:player.hw,w:player.w,camX});jumpStep();
   }
   if(movement==='idle'){
    check(trace[0].z===0&&trace[0].vz===9.6,'Existing instant launch');
    check(Math.abs(trace[18].z-88.65)<1e-8&&trace[17].vz>0&&trace[18].vz<0,'Existing apex');
    check(trace[35].z>0&&trace[36].z===0&&trace[36].vz===0&&trace[36].jumpTime===0,'Existing 36-tick landing');
    check(trace.every(s=>s.x===300&&s.y===420&&s.st==='free'),'Jump does not invent world/state movement');
    if(mode==='aseprite10'){check(frames.size===10,'Ten frames at actual game steps');normal=trace;}
   }
   check(!isNew(),'Landing visual ends');check(barelPlayerFrame().image?.src.includes(movement==='idle'?'barel-idle-dot-10.png':'barel-walk-dot-10.png'),'Return to idle/walk');
   traces[mode].push({movement,trace});
  }
 }
 check(JSON.stringify(traces.legacy)===JSON.stringify(traces.aseprite10),'World/physics/camera/collision/state parity');
 jumpSetup('aseprite10');jumpLaunch();jumpStep();const before=JSON.stringify(player);
 for(let i=0;i<100;i++)barelPlayerFrame();check(JSON.stringify(player)===before,'Rendering cannot mutate physics');
 const frozen={t:player.t,time:player.jumpTime,z:player.z,index:barelPlayerFrame().index};hitStop=4;
 for(let i=0;i<4;i++)jumpStep();check(player.t===frozen.t&&player.jumpTime===frozen.time&&player.z===frozen.z&&barelPlayerFrame().index===frozen.index,'Air hitstop freeze');
 pauseGame();const paused=JSON.stringify(player),frame=barelPlayerFrame();for(let i=0;i<5;i++)jumpStep();
 check(JSON.stringify(player)===paused&&barelPlayerFrame()===frame,'Pause preserves jump image');resumeGame();
 while(player.z>0)jumpStep();check(isNew()&&barelPlayerFrame().index===8,'F9 on actual ground contact');
 const landingT=player.t;hitStop=4;for(let i=0;i<4;i++)jumpStep();check(player.t===landingT&&barelPlayerFrame().index===8,'Landing hitstop freeze');
 inputDown('KeyJ');jumpStep();inputUp('KeyJ');check(player.st==='atk'&&player.atk==='c1'&&!isNew(),'Landing never blocks attack');
 jumpSetup('aseprite10');jumpLaunch();for(let i=0;i<8;i++)jumpStep();inputDown('KeyJ');jumpStep();inputUp('KeyJ');
 check(player.st==='atk'&&player.atk==='air'&&!isNew(),'Existing air attack priority');
 while(player.z>0||player.st!=='free')jumpStep();check(!isNew(),'Air attack landing follows original state without stale jump tail');
 jumpSetup('aseprite10');jumpLaunch();for(let i=0;i<8;i++)jumpStep();check(hurtPlayer(5,-1,false),'Air hit accepted');
 check(player.st==='down'&&player.hp===95&&!isNew(),'Existing air hit knockdown');for(let i=0;i<100&&player.st!=='free';i++)jumpStep();check(player.st==='free'&&!isNew(),'Down recovery has no stale jump');
 jumpSetup('aseprite10');jumpLaunch();for(let i=0;i<5;i++)jumpStep();inputDown('ShiftLeft');jumpStep();inputUp('ShiftLeft');
 check(player.st==='free'&&player.z>0&&isNew(),'Air dash remains blocked');
 jumpSetup('aseprite10');jumpLaunch();for(let i=0;i<36;i++)jumpStep();inputDown('ShiftLeft');jumpStep();inputUp('ShiftLeft');
 check(player.st==='dash'&&!isNew(),'Landing never blocks dash');
 jumpSetup('aseprite10');jumpLaunch();for(let i=0;i<36;i++)jumpStep();inputDown('Space');jumpStep();inputUp('Space');
 check(player.z===0&&player.vz===9.6&&barelPlayerFrame().index===0,'Immediate re-jump preserved');
 startStage(0);scene='play';check(!isNew(),'Stage reset clears landing history');
 check(BarelJump.frameFor({characterId:'viesa',st:'free',z:10,vz:1,jumpTime:1},MS)===null,'Other character excluded');
 window.jumpSheet=(face,physical)=>{
  jumpSetup('aseprite10');jumpLaunch();const chosen=[0,2,6,11,15,18,24,32,36,39];
  ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle='#20242c';ctx.fillRect(0,0,cv.width,cv.height);ctx.scale(cv.width/960,cv.height/540);
  let n=0;
  for(let i=0;i<10;i++){
   while(n<chosen[i]){jumpStep();n++;}
   const x=100+i%5*180,y=225+Math.floor(i/5)*250;
   ctx.strokeStyle='#546170';ctx.beginPath();ctx.moveTo(x-80,y);ctx.lineTo(x+80,y);ctx.stroke();ctx.fillStyle='#eee';ctx.font='14px sans-serif';ctx.fillText('F'+(i+1)+' z='+player.z.toFixed(1),x-60,y+25);
   paintBarel(barelPlayerFrame(),{x:x+camX,y,z:physical?player.z:0,face,flash:0});
  }ctx.restore();return cv.toDataURL('image/png').split(',')[1];
 };
 return {initialVz:9.6,gravity:.55,flightTicks:36,flightMs:600,apexZ:88.65,landingVisualMs:84,
  worldParity:true,normal,traces};
}
