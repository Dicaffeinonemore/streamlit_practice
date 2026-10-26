// Actual idle rendering and state transitions in local Chrome/Streamlit.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
module.exports=async({evaluate,call,errors,root,environment})=>{
  const out=path.join(root,'artifacts/barel-idle-dot-10',environment);fs.mkdirSync(out,{recursive:true});
  for(const object of ['BarelIdle','BarelCombo0','BarelCombo1','BarelCombo2'])assert.equal(await evaluate(`${object}.ready`),true);
  assert.equal(await evaluate('BarelIdle.status().effective'),'aseprite10');
  await evaluate('window.idleNativeRAF=requestAnimationFrame;requestAnimationFrame=()=>0;AUDIO.enable(false);beginGame();showScreen(null)');
  await evaluate('new Promise(resolve=>idleNativeRAF(()=>resolve()))');
  const results=await evaluate(`(${trial.toString()})()`);
  for(const face of [1,-1]){
    const png=await evaluate(`idleContactSheet(${face})`);
    fs.writeFileSync(path.join(out,`ten-frames-${face}.png`),Buffer.from(png,'base64'));
    const transition=await evaluate(`idleReturnSheet(${face})`);
    fs.writeFileSync(path.join(out,`combo2-idle-${face}.png`),Buffer.from(transition,'base64'));
    await evaluate(`idleSetup('aseprite10');player.face=${face};tick=650/MS;render()`);
    const shot=await call('Page.captureScreenshot',{format:'png'});
    fs.writeFileSync(path.join(out,`game-${face}.png`),Buffer.from(shot.data,'base64'));
  }
  const realtime=await evaluate(`(async()=>{
    idleSetup('aseprite10');render();
    const started=performance.now(),seen={0:true},trace=[];let previous=0,wraps=0;last=started;acc=0;
    return new Promise(resolve=>{
      function sample(now){
        loop(now);const frame=barelPlayerFrame();
        if(!idleIsNew()||player.x!==300||player.y!==420||player.z!==0||player.st!=='free')throw Error('Idle changed player state/position');
        seen[frame.index]=true;if(previous===9&&frame.index===0)wraps++;previous=frame.index;
        trace.push({wallMs:now-started,clockMs:tick*MS,frame:frame.index,x:player.x,y:player.y});
        if(now-started<2900)idleNativeRAF(sample);else resolve({displayedFrames:Object.keys(seen).map(Number),wraps,trace});
      }
      idleNativeRAF(sample);
    });
  })()`);
  assert.equal(realtime.displayedFrames.length,10);assert(realtime.wraps>=2,'Two real F10 -> F1 loop boundaries');
  const loader=fs.readFileSync(path.join(root,'src/animation/barel-idle.js'),'utf8');
  const fallback=await evaluate(`(async()=>{
    const original=BarelIdle,nativeFetch=fetch,oldConfig=window.BAREL_IDLE_CONFIG,results=[];
    try{
      for(const failure of ['http','parse','timing','image','bounds','metadata','offset','scale','period','clock','loop','preview']){
        window.BAREL_IDLE_CONFIG={};
        window.fetch=async(url,...args)=>{
          const name=String(url);
          if(name.endsWith('barel-idle-dot-10.animation.json')){
            if(failure==='http')return {ok:false,status:503};
            if(failure==='parse')return {ok:true,json:async()=>{throw SyntaxError('Malformed idle JSON')}};
            if(['metadata','offset','scale','period','clock','loop','preview'].includes(failure)){
              const data=await (await nativeFetch(url,...args)).json();
              if(failure==='metadata')data.animationId='walk';
              if(failure==='offset')data.frameOffsets[0]=[999,0];
              if(failure==='scale')data.renderScale*=2;
              if(failure==='period')data.durationMs=1400;
              if(failure==='clock')data.clock.source='player.t * MS';
              if(failure==='loop')data.loop=false;
              if(failure==='preview')data.previewBounds[0]=999;
              return {ok:true,json:async()=>data};
            }
          }
          const response=await nativeFetch(url,...args);
          if(name.endsWith('/barel-idle-dot-10.json')){
            const data=await response.json();
            if(failure==='timing')data.frames[0].duration=131;
            if(failure==='image')data.meta.image='missing-idle-test.png';
            if(failure==='bounds')data.frames[3].frame.x=44800;
            return {ok:true,json:async()=>data};
          }
          return response;
        };
        eval(${JSON.stringify(loader)});const loaded=await BarelIdle.ready;
        idleSetup('aseprite10');
        if(loaded||BarelIdle.status().effective!=='legacy'||idleIsNew()||barelPlayerFrame()!==barelFrame('idle',tick*MS/1300,true))throw Error('Fallback '+failure);
        for(let i=0;i<3;i++){startAtk(i);if(!barelPlayerFrame().image)throw Error('Idle failure damaged combo '+i);}
        results.push({failure,status:BarelIdle.status()});
      }
    }finally{window.fetch=nativeFetch;window.BarelIdle=original;window.BAREL_IDLE_CONFIG=oldConfig;}
    return results;
  })()`);
  assert.deepEqual(errors,[]);
  const previews=await require('./barel-idle-dot-preview.cjs')({evaluate,call,root,out});
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({environment,...results,realtime,fallback,previews,
    defaultMode:await evaluate('BarelIdle.status()'),browserErrors:errors},null,2));
  console.log('PASS '+environment+': idle dot 10 frames/1300ms, gameplay and both boss-selection previews animate, stable fit, mode fallback, state transitions, 12 error fallbacks, default aseprite10');
};
function trial(){
  const check=(v,m)=>{if(!v)throw Error(m);};
  window.idleIsNew=()=>!!barelPlayerFrame()?.image?.src.includes('/barel-idle-dot-10.png');
  window.idleSetup=mode=>{
    clearInput();selectedCharacterId='barel';player=newPlayer(0,'barel');startStage(0);
    scene='play';showScreen(null);practice=false;camX=0;camLock=true;lockAt=0;waveIdx=0;
    const dummy=mkEnemy('grunt',VW+200,480);dummy.training=true;enemies=[dummy];
    hazards=[];arena=null;barrels=[];items=[];parts=[];texts=[];impacts=[];bursts=[];ghosts=[];bolts=[];
    hitStop=shake=flashT=clearT=slowT=0;tick=0;player.x=300;player.y=420;player.inv=0;
    BarelIdle.setMode(mode);for(const object of [BarelCombo0,BarelCombo1,BarelCombo2])object.setMode('aseprite10');
  };
  const step=()=>{tick++;updPlayer();};
  idleSetup('aseprite10');
  const boundaries=[[0,0],[129.999,0],[130,1],[1170,9],[1299.999,9],[1300,0],[1430,1],[2600,0]];
  for(const [time,index] of boundaries){tick=time/MS;player.t=997;check(barelPlayerFrame().index===index,'Idle boundary '+time);}
  const before=JSON.stringify(player);for(let i=0;i<100;i++)BarelIdle.frameFor(player,tick*MS);
  check(JSON.stringify(player)===before,'Render sampling cannot mutate actor or collision box');
  const traces={};
  for(const mode of ['legacy','aseprite10']){
    idleSetup(mode);const trace=[];
    for(let i=0;i<160;i++){step();trace.push({x:player.x,y:player.y,z:player.z,t:player.t,hp:player.hp,st:player.st,w:player.w,hw:player.hw});}
    traces[mode]=trace;
  }
  check(JSON.stringify(traces.legacy)===JSON.stringify(traces.aseprite10),'Idle mode preserves simulation/collision trace');
  idleSetup('aseprite10');inputDown('KeyD');for(let i=0;i<6;i++)step();
  check(player.walk&&!idleIsNew(),'Move uses existing walk');const moved=player.x;inputUp('KeyD');step();
  check(!player.walk&&player.x===moved&&idleIsNew(),'Walk -> idle, no position jump');
  idleSetup('aseprite10');startAtk(0);check(!idleIsNew(),'Idle -> existing attack');
  for(let i=0;i<21;i++)step();check(player.st==='free'&&idleIsNew(),'Attack -> idle');
  check(barelPlayerFrame().index===Math.floor((tick*MS%1300)/130),'Global idle phase continues after attack');
  idleSetup('aseprite10');startAtk(0);
  while(player.combo===0&&player.st==='atk'){if(player.t*MS>=150)player.buf=220;step();}
  check(player.combo===1&&!idleIsNew(),'First buffered link');
  while(player.combo===1&&player.st==='atk'){if(player.t*MS>=130)player.buf=220;step();}
  check(player.combo===2&&!idleIsNew(),'Second buffered link');
  while(player.st==='atk')step();
  check(player.st==='free'&&player.combo===0&&player.x===332&&idleIsNew(),'Full three-hit chain -> idle at same world position');
  const endPosition={x:player.x,y:player.y};paintBarel(barelPlayerFrame(),player);
  check(player.x===endPosition.x&&player.y===endPosition.y,'Idle render offset does not move actor');
  idleSetup('aseprite10');inputDown('Space');step();inputUp('Space');step();
  check(player.z>0&&!idleIsNew(),'Jump pose retained');
  let count=0;while((player.z>0||player.vz!==0)&&count++<100)step();
  check(count<100&&idleIsNew(),'Landing -> idle');
  idleSetup('aseprite10');check(hurtPlayer(5,-1,false),'Hurt accepted');check(!idleIsNew(),'Hurt pose retained');
  for(let i=0;i<17;i++)step();check(player.st==='free'&&player.hp===95&&idleIsNew(),'Hurt -> idle');
  idleSetup('aseprite10');check(hurtPlayer(5,-1,true),'Knockdown accepted');check(!idleIsNew(),'Down pose retained');
  count=0;while(player.st!=='free'&&count++<100)step();
  check(count<100&&player.z===0&&player.inv===100&&idleIsNew(),'Down/landing/rise -> idle');
  idleSetup('aseprite10');tick=19;pauseGame();const paused=tick;for(let i=0;i<10;i++)update();
  check(tick===paused,'Pause freezes existing global clock');resumeGame();update();check(tick===paused+1,'Resume idle clock');
  const cases=[{st:'free',walk:true},{st:'atk',atk:'c1',combo:0},{st:'atk',atk:'c2',combo:1},{st:'atk',atk:'c3',combo:2},
    {st:'dash'},{st:'hurt'},{st:'down'},{st:'dead'},{st:'cast'},{st:'skill',skill:'thrust'},{st:'special'},{st:'grabbed'},{st:'free',z:20,vz:2}];
  for(const state of cases){
    idleSetup('legacy');Object.assign(player,state,{t:5});const legacy=barelPlayerFrame();
    BarelIdle.setMode('aseprite10');check(barelPlayerFrame()===legacy,'Non-idle state unchanged: '+state.st);
  }
  check(BarelIdle.frameFor({characterId:'viesa',st:'free',z:0,walk:false},0)===null,'Other character excluded');
  window.idleContactSheet=face=>{
    idleSetup('aseprite10');ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle='#20242c';ctx.fillRect(0,0,cv.width,cv.height);ctx.scale(cv.width/960,cv.height/540);
    for(let i=0;i<10;i++){
      tick=i*130/MS;const x=100+i%5*180,y=225+Math.floor(i/5)*250;
      ctx.strokeStyle='#546170';ctx.beginPath();ctx.moveTo(x-80,y);ctx.lineTo(x+80,y);ctx.stroke();
      ctx.fillStyle='#eee';ctx.font='14px sans-serif';ctx.fillText('F'+(i+1)+' '+i*130+'ms',x-65,y+25);
      paintBarel(barelPlayerFrame(),{x,y,z:0,face,flash:0});
    }ctx.restore();return cv.toDataURL('image/png').split(',')[1];
  };
  window.idleReturnSheet=face=>{
    idleSetup('aseprite10');ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle='#20242c';ctx.fillRect(0,0,cv.width,cv.height);ctx.scale(cv.width/960,cv.height/540);
    ['combo2 end','idle F1','idle F6','idle F10 -> F1'].forEach((label,i)=>{
      if(i===0){startAtk(2);player.t=679.9/MS;}else{player.st='free';player.t=0;player.z=0;player.vz=0;tick=(i===1?0:i===2?650:1300)/MS;}
      const x=130+i*225,y=330;ctx.strokeStyle='#546170';ctx.beginPath();ctx.moveTo(x-100,y);ctx.lineTo(x+100,y);ctx.stroke();
      ctx.fillStyle='#eee';ctx.font='14px sans-serif';ctx.fillText(label,x-85,y+30);paintBarel(barelPlayerFrame(),{x,y,z:0,face,flash:0});
    });ctx.restore();return cv.toDataURL('image/png').split(',')[1];
  };
  return {periodMs:1300,durationsMs:Array(10).fill(130),clock:'tick * MS',resetOnEntry:false,boundaries,
    simulationMatchesLegacy:true,fullComboEndPosition:endPosition,stateReturns:['walk','attack','combo2','jump','hurt','down'],nonIdleStatesUnchanged:cases};
}
