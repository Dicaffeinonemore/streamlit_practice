// Real Chrome game suite, shared by local HTTP and the Streamlit component.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
module.exports=async({evaluate,call,errors,root,environment})=>{
  const out=path.join(root,'artifacts/barel-combo1-10',environment);fs.mkdirSync(out,{recursive:true});
  assert.equal(await evaluate('BarelCombo0.ready'),true);
  assert.equal(await evaluate('BarelCombo1.ready'),true);
  assert.equal(await evaluate('BarelCombo1.status().effective'),'aseprite10');
  await evaluate("globalThis.BarelIdle?.setMode('legacy')");
  await evaluate("globalThis.BarelCombo2?.setMode('legacy')");
  await evaluate('window.combo1NativeRAF=requestAnimationFrame;requestAnimationFrame=()=>0;AUDIO.enable(false);beginGame();showScreen(null)');
  await evaluate('new Promise(resolve=>combo1NativeRAF(()=>resolve()))');
  const results=await evaluate(`(${trial.toString()})()`);
  for(const face of [1,-1]){
    const png=await evaluate(`combo1ContactSheet(${face})`);
    fs.writeFileSync(path.join(out,`ten-frames-${face}.png`),Buffer.from(png,'base64'));
    const chain=await evaluate(`combo1ChainSheet(${face})`);
    fs.writeFileSync(path.join(out,`combo-links-${face}.png`),Buffer.from(chain,'base64'));
    await evaluate(`combo1Setup('aseprite10');startAtk(1);player.face=${face};player.t=125/MS;render()`);
    const shot=await call('Page.captureScreenshot',{format:'png'});
    fs.writeFileSync(path.join(out,`game-${face}.png`),Buffer.from(shot.data,'base64'));
  }
  const realtime=await evaluate(`(async()=>{
    combo1Setup('aseprite10');startAtk(1);
    render();
    const trace=[],images={0:true},started=performance.now();last=started;acc=0;
    return new Promise(resolve=>{
      function sample(now){
        loop(now);const f=barelPlayerFrame();
        trace.push({wallMs:now-started,attackMs:player.t*MS,state:player.st,frame:f.image?f.index:null});
        if(f.image)images[f.index]=true;
        if(now-started<550)combo1NativeRAF(sample);else resolve({trace,images});
      }
      combo1NativeRAF(sample);
    });
  })()`);
  assert(realtime.trace.some(p=>p.state==='free'),'Actual fixed-step loop completes combo1');
  assert.equal(Object.keys(realtime.images).length,10,'Real RAF displays all 10 frames');
  realtime.displayedFrames=Object.keys(realtime.images).map(Number);
  delete realtime.images;
  const loader=fs.readFileSync(path.join(root,'src/animation/barel-combo1.js'),'utf8');
  const fallback=await evaluate(`(async()=>{
    const original=BarelCombo1,nativeFetch=fetch,oldConfig=window.BAREL_COMBO1_CONFIG;
    const results=[];
    try{
      for(const failure of ['http','parse','timing','image','bounds','metadata','offset','scale']){
        window.BAREL_COMBO1_CONFIG={};
        window.fetch=async(url,...args)=>{
          const name=String(url);
          if(name.endsWith('barel-combo1-10.animation.json')){
            if(failure==='http')return {ok:false,status:503};
            if(failure==='parse')return {ok:true,json:async()=>{throw SyntaxError('Malformed combo1 JSON')}};
            if(['metadata','offset','scale'].includes(failure)){
              const data=await (await nativeFetch(url,...args)).json();
              if(failure==='metadata')data.attackId='combo0';
              if(failure==='offset')data.frameOffsets[0]=[999,0];
              if(failure==='scale')data.renderScale*=2;
              return {ok:true,json:async()=>data};
            }
          }
          const response=await nativeFetch(url,...args);
          if(name.endsWith('/barel-combo1-10.json')){
            const data=await response.json();
            if(failure==='timing')data.frames[0].duration=71;
            if(failure==='image')data.meta.image='missing-combo1-test.png';
            if(failure==='bounds')data.frames[3].frame.x=38400;
            return {ok:true,json:async()=>data};
          }
          return response;
        };
        eval(${JSON.stringify(loader)});const loaded=await BarelCombo1.ready;
        combo1Setup('aseprite10');startAtk(1);
        if(loaded||BarelCombo1.status().effective!=='legacy'||barelPlayerFrame().image)throw Error('Fallback '+failure);
        startAtk(0);if(!barelPlayerFrame().image)throw Error('combo1 failure damaged combo0');
        results.push({failure,status:BarelCombo1.status()});
      }
    }finally{window.fetch=nativeFetch;window.BarelCombo1=original;window.BAREL_COMBO1_CONFIG=oldConfig;}
    return results;
  })()`);
  assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({environment,...results,realtime,fallback,defaultMode:await evaluate('BarelCombo1.status()'),browserErrors:errors},null,2));
  console.log('PASS '+environment+': combo1 10 real frames/310ms, identical legacy damage/movement, 105-200ms hits, hitstop, both combo links, input cancel/jump/flip, eight failure fallbacks, default aseprite10');
};
function trial(){
  const check=(v,m)=>{if(!v)throw Error(m);};
  window.combo1Setup=mode=>{
    clearInput();selectedCharacterId='barel';player=newPlayer(0,'barel');startStage(0);
    scene='play';showScreen(null);practice=false;camX=0;camLock=false;waveIdx=0;
    enemies=[];hazards=[];arena=null;barrels=[];items=[];parts=[];texts=[];
    impacts=[];bursts=[];ghosts=[];bolts=[];hitStop=shake=flashT=clearT=slowT=0;
    player.x=300;player.y=420;player.inv=0;
    BarelCombo0.setMode('aseprite10');BarelCombo1.setMode(mode);
  };
  const a=ATK.c2;
  check(a.wind===70&&a.act===100&&a.rec===140,'Existing timing constants');
  check(a.dmg===11&&a.reach===82&&a.step===8&&a.stop===3,'Existing damage/reach/step/hitstop');
  check(BUF_MS===220&&a.wind+a.act*.35===105&&a.wind+a.act+30===200&&a.wind+a.act+a.rec*.45===233,'Existing hit/link/input buffer');
  combo1Setup('aseprite10');startAtk(1);
  const boundaries=[[0,0],[69.999,0],[70,1],[105,2],[140,3],[170,4],[200,5],[220,6],[240,7],[260,8],[285,9],[309.999,9]];
  for(const [time,index] of boundaries){player.t=time/MS;check(barelPlayerFrame().index===index,'Frame at '+time);}
  const traces={};
  for(const mode of ['legacy','aseprite10']){
    combo1Setup(mode);const e=mkEnemy('grunt',350,420);enemies=[e];const hp=e.hp;
    startAtk(1);const trace=[],frames=new Set();
    for(let i=0;i<19;i++){
      const f=barelPlayerFrame();if(mode==='aseprite10')frames.add(f.index);
      updPlayer();trace.push({tick:player.t,state:player.st,x:player.x,hp:e.hp,hitSet:player.hitSet.size,hitStop});
    }
    check(player.st==='free','310ms duration at existing 60Hz resolution');
    check(hp-e.hp===11&&player.x===308,'Single 11 damage hit and world step 8');
    if(mode==='aseprite10')check(frames.size===10,'All 10 frames at 60Hz');
    traces[mode]=trace;
  }
  check(JSON.stringify(traces.legacy)===JSON.stringify(traces.aseprite10),'Legacy/new traces identical');
  combo1Setup('aseprite10');startAtk(1);player.t=8;hitStop=3;
  const frozen={t:player.t,x:player.x,index:barelPlayerFrame().index};
  for(let i=0;i<3;i++){update();check(player.t===frozen.t&&player.x===frozen.x&&barelPlayerFrame().index===frozen.index,'Real hitstop freezes visuals');}
  updPlayer();check(player.t===9,'Existing clock resumes');
  combo1Setup('aseprite10');startAtk(0);player.buf=200;player.t=267.5/MS-1;updPlayer();
  check(player.combo===1&&player.atk==='c2'&&barelPlayerFrame().image,'combo0 -> combo1');
  player.buf=200;player.t=233/MS-1;updPlayer();
  check(player.combo===2&&player.atk==='c3'&&!barelPlayerFrame().image,'combo1 -> legacy combo2');
  for(const time of [232.9,233]){
    combo1Setup('aseprite10');startAtk(1);player.buf=200;player.t=time/MS-1;updPlayer();
    check(player.combo===(time<233?1:2),'Exact combo2 link boundary');
  }
  combo1Setup('aseprite10');startAtk(1);inputDown('ShiftLeft');updPlayer();inputUp('ShiftLeft');
  check(player.st==='dash'&&BarelCombo1.frameFor(player,MS)===null,'Dash input cancels combo1');
  combo1Setup('aseprite10');startAtk(1);check(hurtPlayer(5,-1,false),'Hurt accepted');
  check(player.st==='hurt'&&player.hp===95&&!barelPlayerFrame().image,'Hurt cancels combo1');
  combo1Setup('aseprite10');startAtk(1);check(!startSkill('thrust'),'Startup skill cancel blocked');
  player.t=170/MS;check(startSkill('thrust')&&!barelPlayerFrame().image,'Existing recovery skill cancel');
  combo1Setup('aseprite10');inputDown('Space');updPlayer();inputUp('Space');updPlayer();
  check(player.z>0&&!barelPlayerFrame().image,'Jump retained');
  startAtk('air');check(!barelPlayerFrame().image,'Air attack retained');
  const otherActor={characterId:'viesa',st:'atk',atk:'c2',combo:1,t:3};
  check(BarelCombo1.frameFor(otherActor,MS)===null,'Other character excluded');
  window.combo1ContactSheet=face=>{
    combo1Setup('aseprite10');startAtk(1);
    const times=[0,70,105,140,170,200,220,240,260,285];
    ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle='#20242c';ctx.fillRect(0,0,cv.width,cv.height);
    ctx.scale(cv.width/960,cv.height/540);
    times.forEach((time,i)=>{
      player.t=time/MS;const x=100+(i%5)*180,y=225+Math.floor(i/5)*250;
      ctx.strokeStyle='#546170';ctx.beginPath();ctx.moveTo(x-80,y);ctx.lineTo(x+80,y);ctx.stroke();
      ctx.fillStyle='#eee';ctx.font='14px sans-serif';ctx.fillText('F'+(i+1)+' '+time+'ms',x-65,y+25);
      paintBarel(barelPlayerFrame(),{x,y,z:0,face,flash:0});
    });ctx.restore();return cv.toDataURL('image/png').split(',')[1];
  };
  window.combo1ChainSheet=face=>{
    combo1Setup('aseprite10');
    ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle='#20242c';ctx.fillRect(0,0,cv.width,cv.height);
    ctx.scale(cv.width/960,cv.height/540);
    [[0,260],[1,0],[1,232.9],[2,0]].forEach(([combo,time],i)=>{
      startAtk(combo);player.t=time/MS;const x=120+i*230,y=330;
      ctx.strokeStyle='#546170';ctx.beginPath();ctx.moveTo(x-100,y);ctx.lineTo(x+100,y);ctx.stroke();
      ctx.fillStyle='#eee';ctx.font='15px sans-serif';ctx.fillText('combo'+combo+' '+time+'ms',x-70,y+30);
      paintBarel(barelPlayerFrame(),{x,y,z:0,face,flash:0});
    });ctx.restore();return cv.toDataURL('image/png').split(',')[1];
  };
  return {durationMs:310,activeMs:[105,200],linkMs:233,damage:11,reach:82,step:8,hitStopTicks:3,boundaries,traces,hitstop:frozen,combo0Preserved:true};
}
