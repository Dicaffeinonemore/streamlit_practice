// Actual browser game tests, shared by local HTTP and Streamlit iframe.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
module.exports=async({evaluate,call,errors,root,environment})=>{
  const out=path.join(root,'artifacts/barel-combo2-dot-10',environment);fs.mkdirSync(out,{recursive:true});
  for(const id of [0,1,2])assert.equal(await evaluate(`BarelCombo${id}.ready`),true);
  for(const id of [0,1,2])assert.equal(await evaluate(`BarelCombo${id}.frameFor({characterId:'barel',st:'atk',atk:'c${id+1}',combo:${id},t:0},1000/60).image.src.includes('barel-combo${id}-dot-10.png')`),true,'Each hit must select its supplied dot atlas by default');
  assert.equal(await evaluate('BarelCombo2.status().effective'),'aseprite10');
  await evaluate("globalThis.BarelIdle?.setMode('legacy')");
  await evaluate('window.combo2NativeRAF=requestAnimationFrame;requestAnimationFrame=()=>0;AUDIO.enable(false);beginGame();showScreen(null)');
  await evaluate('new Promise(resolve=>combo2NativeRAF(()=>resolve()))');
  const results=await evaluate(`(${trial.toString()})()`);
  for(const face of [1,-1]){
    const png=await evaluate(`combo2ContactSheet(${face})`);
    fs.writeFileSync(path.join(out,`ten-frames-${face}.png`),Buffer.from(png,'base64'));
    const chain=await evaluate(`combo2ChainSheet(${face})`);
    fs.writeFileSync(path.join(out,`combo-links-${face}.png`),Buffer.from(chain,'base64'));
    await evaluate(`combo2Setup('aseprite10');startAtk(2);player.face=${face};for(let i=0;i<20;i++)updPlayer();render()`);
    const shot=await call('Page.captureScreenshot',{format:'png'});
    fs.writeFileSync(path.join(out,`game-${face}.png`),Buffer.from(shot.data,'base64'));
  }
  const realtime=await evaluate(`(async()=>{
    combo2Setup('aseprite10');startAtk(2);render();
    const trace=[],seen={0:true},started=performance.now();last=started;acc=0;
    return new Promise(resolve=>{
      function sample(now){
        loop(now);const f=barelPlayerFrame();
        trace.push({wallMs:now-started,attackMs:player.t*MS,state:player.st,frame:f.image?f.index:null,wave:player.wave,smash:player.smash});
        if(f.image)seen[f.index]=true;
        if(now-started<900)combo2NativeRAF(sample);else resolve({trace,displayedFrames:Object.keys(seen).map(Number)});
      }
      combo2NativeRAF(sample);
    });
  })()`);
  assert(realtime.trace.some(p=>p.state==='free'),'Actual game loop finishes the final hit');
  assert.equal(realtime.displayedFrames.length,10,'Real RAF displays all ten cels');
  const loader=fs.readFileSync(path.join(root,'src/animation/barel-combo2.js'),'utf8');
  const fallback=await evaluate(`(async()=>{
    const original=BarelCombo2,nativeFetch=fetch,oldConfig=window.BAREL_COMBO2_CONFIG,results=[];
    try{
      for(const failure of ['http','parse','timing','image','bounds','metadata','offset','scale','terminal','events']){
        window.BAREL_COMBO2_CONFIG={};
        window.fetch=async(url,...args)=>{
          const name=String(url);
          if(name.endsWith('barel-combo2-dot-10.animation.json')){
            if(failure==='http')return {ok:false,status:503};
            if(failure==='parse')return {ok:true,json:async()=>{throw SyntaxError('Malformed combo2 JSON')}};
            if(['metadata','offset','scale','terminal','events'].includes(failure)){
              const data=await (await nativeFetch(url,...args)).json();
              if(failure==='metadata')data.attackId='combo1';
              if(failure==='offset')data.frameOffsets[0]=[999,0];
              if(failure==='scale')data.renderScale*=2;
              if(failure==='terminal')data.terminalAttack=false;
              if(failure==='events')data.combat.waveMs=285;
              return {ok:true,json:async()=>data};
            }
          }
          const response=await nativeFetch(url,...args);
          if(name.endsWith('/barel-combo2-dot-10.json')){
            const data=await response.json();
            if(failure==='timing')data.frames[0].duration=71;
            if(failure==='image')data.meta.image='missing-combo2-test.png';
            if(failure==='bounds')data.frames[3].frame.x=38400;
            return {ok:true,json:async()=>data};
          }
          return response;
        };
        eval(${JSON.stringify(loader)});const loaded=await BarelCombo2.ready;
        combo2Setup('aseprite10');startAtk(2);
        if(loaded||BarelCombo2.status().effective!=='legacy'||barelPlayerFrame().image)throw Error('Fallback '+failure);
        for(const combo of [0,1]){startAtk(combo);if(!barelPlayerFrame().image)throw Error('Earlier attack damaged by failure');}
        results.push({failure,status:BarelCombo2.status()});
      }
    }finally{window.fetch=nativeFetch;window.BarelCombo2=original;window.BAREL_COMBO2_CONFIG=oldConfig;}
    return results;
  })()`);
  assert.deepEqual(errors,[]);
  const result={environment,...results,realtime,fallback,defaultMode:await evaluate('BarelCombo2.status()'),browserErrors:errors};
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(result,null,2));
  console.log('PASS '+environment+': combo2 10 real frames/680ms, unchanged 16 damage/knockdown/step16/hitstop7, wave284/smash319, full combo chain/free return, cancel/jump/flip, ten failure fallbacks, default aseprite10');
};
function trial(){
  const check=(v,m)=>{if(!v)throw Error(m);};
  window.combo2Setup=mode=>{
    clearInput();selectedCharacterId='barel';player=newPlayer(0,'barel');startStage(0);
    scene='play';showScreen(null);practice=false;camX=0;camLock=false;waveIdx=0;
    enemies=[];hazards=[];arena=null;barrels=[];items=[];parts=[];texts=[];
    impacts=[];bursts=[];ghosts=[];bolts=[];hitStop=shake=flashT=clearT=slowT=0;
    player.x=300;player.y=420;player.inv=0;
    BarelCombo0.setMode('aseprite10');BarelCombo1.setMode('aseprite10');BarelCombo2.setMode(mode);
  };
  const a=ATK.c3;
  check(a.wind===200&&a.act===140&&a.rec===340,'Existing timing');
  check(a.dmg===16&&a.reach===98&&a.step===16&&a.stop===7&&a.kd===true,'Existing combat/knockdown');
  check(BUF_MS===220&&a.wind+a.act*.35===249&&a.wind+a.act+30===370,'Hit range and input buffer');
  check(a.wind+a.act*.6===284&&a.wind+a.act*.85===319,'Existing wave/smash times');
  combo2Setup('aseprite10');startAtk(2);
  const boundaries=[[0,0],[69.999,0],[70,1],[130,2],[200,3],[220,4],[249,5],[284,5],[319,5],[340,6],[370,7],[460,8],[550,9],[679.999,9]];
  for(const [time,index] of boundaries){player.t=time/MS;check(barelPlayerFrame().index===index,'Frame at '+time);}
  const traces={};
  for(const mode of ['legacy','aseprite10']){
    combo2Setup(mode);const e=mkEnemy('brute',350,420);enemies=[e];const hp=e.hp;
    startAtk(2);const trace=[],frames=new Set();
    for(let i=0;i<41;i++){
      const f=barelPlayerFrame();if(mode==='aseprite10')frames.add(f.index);
      updPlayer();trace.push({tick:player.t,state:player.st,x:player.x,hp:e.hp,enemyState:e.st,vx:e.vx,vz:e.vz,
        hitSet:player.hitSet.size,hitStop,wave:player.wave,smash:player.smash,waves:hazards.filter(z=>z.type==='pwave').length});
    }
    check(player.st==='free'&&player.combo===0&&player.comboT===0,'Terminal attack returns to free/reset combo');
    check(hp-e.hp===16&&player.x===316,'Single 16 damage hit and step 16');
    check(e.st==='down'&&e.vx===4&&e.vz===5,'Original knockdown and knockback');
    check(player.wave&&player.smash&&hazards.filter(z=>z.type==='pwave').length===1,'Both finish effects emitted once');
    const wave=trace.find(t=>t.wave),smash=trace.find(t=>t.smash),firstHit=trace.find(t=>t.hp<hp);
    check(wave.tick===18&&smash.tick===20&&firstHit.tick===15,'Existing tick quantization of events/hit');
    if(mode==='aseprite10')check(frames.size===10,'All 10 frames at 60Hz');
    traces[mode]=trace;
  }
  check(JSON.stringify(traces.legacy)===JSON.stringify(traces.aseprite10),'Legacy/new combat and knockback traces identical');
  combo2Setup('aseprite10');startAtk(2);player.t=15;hitStop=7;
  const frozen={t:player.t,x:player.x,index:barelPlayerFrame().index};
  for(let i=0;i<7;i++){update();check(player.t===frozen.t&&player.x===frozen.x&&barelPlayerFrame().index===frozen.index,'Real hitstop freezes frame and actor');}
  updPlayer();check(player.t===16,'Same clock resumes');
  combo2Setup('aseprite10');startAtk(0);player.buf=200;player.t=267.5/MS-1;updPlayer();
  check(player.combo===1&&barelPlayerFrame().image,'combo0 -> combo1');
  player.buf=200;player.t=233/MS-1;updPlayer();
  check(player.combo===2&&player.atk==='c3'&&barelPlayerFrame().index===0,'combo1 -> new combo2');
  player.buf=200;player.t=493/MS-1;updPlayer();check(player.combo===2,'No fourth-hit link during recovery');
  player.t=680/MS-1;updPlayer();check(player.st==='free'&&player.combo===0,'Free at unchanged end condition');
  updPlayer();check(player.st==='free','Buffered final hit cannot auto-start a fourth attack');
  combo2Setup('aseprite10');startAtk(2);inputDown('ShiftLeft');updPlayer();inputUp('ShiftLeft');
  check(player.st==='dash'&&BarelCombo2.frameFor(player,MS)===null,'Dash input cancels final hit');
  combo2Setup('aseprite10');startAtk(2);check(hurtPlayer(5,-1,false),'Hurt accepted');
  check(player.st==='hurt'&&player.hp===95&&!barelPlayerFrame().image,'Hurt cancels final hit');
  combo2Setup('aseprite10');startAtk(2);check(!startSkill('thrust'),'Startup skill cancel remains blocked');
  player.t=340/MS;check(startSkill('thrust')&&!barelPlayerFrame().image,'Recovery skill cancel retained');
  combo2Setup('aseprite10');startAtk(2);inputDown('Space');updPlayer();inputUp('Space');
  check(player.st==='atk'&&player.z===0,'Attack jump cancel remains blocked');
  combo2Setup('aseprite10');inputDown('Space');updPlayer();inputUp('Space');updPlayer();
  check(player.z>0&&BarelCombo2.frameFor(player,MS)===null,'Normal jump retained');
  startAtk('air');check(player.atk==='air'&&BarelCombo2.frameFor(player,MS)===null,'Air attack retained');
  check(BarelCombo2.frameFor({characterId:'viesa',st:'atk',atk:'c3',combo:2,t:3},MS)===null,'Other characters excluded');
  window.combo2ContactSheet=face=>{
    combo2Setup('aseprite10');startAtk(2);const times=[0,70,130,200,220,249,340,370,460,550];
    ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle='#20242c';ctx.fillRect(0,0,cv.width,cv.height);ctx.scale(cv.width/960,cv.height/540);
    times.forEach((time,i)=>{
      player.t=time/MS;const x=100+(i%5)*180,y=225+Math.floor(i/5)*250;
      ctx.strokeStyle='#546170';ctx.beginPath();ctx.moveTo(x-80,y);ctx.lineTo(x+80,y);ctx.stroke();
      ctx.fillStyle='#eee';ctx.font='14px sans-serif';ctx.fillText('F'+(i+1)+' '+time+'ms',x-65,y+25);
      paintBarel(barelPlayerFrame(),{x,y,z:0,face,flash:0});
    });ctx.restore();return cv.toDataURL('image/png').split(',')[1];
  };
  window.combo2ChainSheet=face=>{
    combo2Setup('aseprite10');ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle='#20242c';ctx.fillRect(0,0,cv.width,cv.height);ctx.scale(cv.width/960,cv.height/540);
    [[1,232.9],[2,0],[2,319],[2,679.9]].forEach(([combo,time],i)=>{
      startAtk(combo);player.t=time/MS;const x=130+i*225,y=330;
      ctx.strokeStyle='#546170';ctx.beginPath();ctx.moveTo(x-100,y);ctx.lineTo(x+100,y);ctx.stroke();
      ctx.fillStyle='#eee';ctx.font='14px sans-serif';ctx.fillText('combo'+combo+' '+time+'ms',x-80,y+30);
      paintBarel(barelPlayerFrame(),{x,y,z:0,face,flash:0});
    });ctx.restore();return cv.toDataURL('image/png').split(',')[1];
  };
  return {durationMs:680,activeMs:[249,370],nextCombo:null,waveMs:284,smashMs:319,damage:16,reach:98,step:16,
    knockback:{vx:4,vz:5,state:'down'},hitStopTicks:7,boundaries,traces,hitstop:frozen,earlierCombosPreserved:true};
}
