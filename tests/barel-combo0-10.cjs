// Shared real-browser suite for local HTTP and the actual Streamlit iframe.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
module.exports=async({evaluate,call,errors,root,environment})=>{
  const out=path.join(root,'artifacts/barel-combo0-dot-10',environment);
  fs.mkdirSync(out,{recursive:true});
  assert.equal(await evaluate('BarelCombo0.ready'),true);
  assert.equal(await evaluate('BarelCombo0.status().effective'),'aseprite10');
  await evaluate("globalThis.BarelIdle?.setMode('legacy')");
  await evaluate("globalThis.BarelCombo1?.setMode('legacy')");
  await evaluate("globalThis.BarelCombo2?.setMode('legacy')");
  await evaluate('window.barelTestNativeRAF=requestAnimationFrame;requestAnimationFrame=()=>0;AUDIO.enable(false);beginGame();showScreen(null)');
  const results=await evaluate(`(${trial.toString()})()`);
  for(const face of [1,-1]){
    const png=await evaluate(`barelComboTestSheet(${face})`);
    fs.writeFileSync(path.join(out,`ten-frames-${face}.png`),Buffer.from(png,'base64'));
    await evaluate(`barelComboTestSetup('aseprite10');startAtk(0);player.face=${face};player.t=170/MS;render()`);
    const shot=await call('Page.captureScreenshot',{format:'png'});
    fs.writeFileSync(path.join(out,`game-${face}.png`),Buffer.from(shot.data,'base64'));
  }
  // Drive the unmodified fixed-step game loop from real browser RAF timestamps.
  const realtime=await evaluate(`(async()=>{
    barelComboTestSetup('aseprite10');startAtk(0);
    const trace=[],images={},started=performance.now();last=started;acc=0;
    return new Promise(resolve=>{
      function sample(now){
        loop(now);
        const f=barelPlayerFrame();
        trace.push({wallMs:now-started,attackMs:player.t*MS,state:player.st,frame:f.image?f.index:null});
        if(f.image&&!images[f.index])images[f.index]=cv.toDataURL('image/png').split(',')[1];
        if(now-started<600)barelTestNativeRAF(sample);
        else resolve({trace,images});
      }
      barelTestNativeRAF(sample);
    });
  })()`);
  assert(realtime.trace.some(p=>p.state==='free'),'Real game loop completes the attack');
  assert.equal(Object.keys(realtime.images).length,10,'Real RAF shows every frame');
  for(const [i,png] of Object.entries(realtime.images))fs.writeFileSync(path.join(out,`realtime-F${Number(i)+1}.png`),Buffer.from(png,'base64'));
  delete realtime.images;
  const loader=fs.readFileSync(path.join(root,'src/animation/barel-combo0.js'),'utf8');
  const fallback=await evaluate(`(async()=>{
    const original=BarelCombo0,fetchOriginal=fetch,oldConfig=window.BAREL_COMBO0_CONFIG;
    const results=[];
    try{
      for(const failure of ['http','parse','timing','image']){
        window.BAREL_COMBO0_CONFIG={};
        window.fetch=async(url,...args)=>{
          if(String(url).endsWith('.animation.json')){
            if(failure==='http')return {ok:false,status:503};
            if(failure==='parse')return {ok:true,json:async()=>{throw SyntaxError('test malformed JSON')}};
          }
          const response=await fetchOriginal(url,...args);
          if(String(url).endsWith('/barel-combo0-dot-10.json')){
            const data=await response.json();
            if(failure==='timing')data.frames[0].duration=41;
            if(failure==='image')data.meta.image='missing-barel-test.png';
            return {ok:true,json:async()=>data};
          }
          return response;
        };
        eval(${JSON.stringify(loader)});
        const loaded=await BarelCombo0.ready;
        barelComboTestSetup('aseprite10');startAtk(0);
        if(loaded||BarelCombo0.status().effective!=='legacy'||barelPlayerFrame().image)throw Error('Fallback '+failure);
        results.push({failure,status:BarelCombo0.status()});
      }
    }finally{window.fetch=fetchOriginal;window.BarelCombo0=original;window.BAREL_COMBO0_CONFIG=oldConfig;}
    return results;
  })()`);
  assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({environment,...results,realtime,fallback,browserErrors:errors},null,2));
  console.log('PASS '+environment+': 10 rendered frames, 350ms, damage/movement match legacy, hitstop, combo1, dash/hurt/skill/jump, flip/ground, HTTP/parse/timing/image fallback');
};
function trial(){
  const check=(v,m)=>{if(!v)throw Error(m);};
  window.barelComboTestSetup=(mode)=>{
    clearInput();selectedCharacterId='barel';player=newPlayer(0,'barel');startStage(0);
    scene='play';showScreen(null);practice=false;camX=0;camLock=false;waveIdx=0;
    enemies=[];hazards=[];arena=null;barrels=[];items=[];parts=[];texts=[];
    impacts=[];bursts=[];ghosts=[];bolts=[];hitStop=shake=flashT=clearT=slowT=0;
    player.x=300;player.y=420;player.inv=0;BarelCombo0.setMode(mode);
  };
  barelComboTestSetup('aseprite10');startAtk(0);
  const boundaries=[[0,0],[39.999,0],[40,1],[70,2],[105,3],[130,4],[155,5],[185,6],[230,7],[255,8],[295,9],[349.999,9]];
  for(const [time,index] of boundaries){player.t=time/MS;check(barelPlayerFrame().index===index,'Boundary '+time);}
  const a=ATK.c1;
  check(a.wind+a.act+a.rec===350,'Combat duration');
  check(a.wind+a.act*.35===128.5&&a.wind+a.act+30===230,'Combat active range');
  check(a.wind+a.act+a.rec*.45===267.5,'Combo link boundary');
  const traces={};
  for(const mode of ['legacy','aseprite10']){
    barelComboTestSetup(mode);
    const e=mkEnemy('grunt',350,420);enemies=[e];const before=e.hp;
    startAtk(0);const frames=new Set(),trace=[];
    for(let i=0;i<21;i++){
      const f=barelPlayerFrame();if(mode==='aseprite10')frames.add(f.index);
      updPlayer();
      trace.push({tick:player.t,state:player.st,x:player.x,hp:e.hp,hitSet:player.hitSet.size,hitStop});
    }
    check(player.st==='free','Attack ends after 350ms');
    check(before-e.hp===10,'Exactly one 10 damage hit');
    check(player.x===308,'World step stays 8');
    if(mode==='aseprite10')check(frames.size===10,'All 10 frames at real 60Hz sampling');
    traces[mode]=trace;
  }
  check(JSON.stringify(traces.legacy)===JSON.stringify(traces.aseprite10),'Combat traces identical');
  barelComboTestSetup('aseprite10');startAtk(0);player.t=9;hitStop=3;
  const frozen={t:player.t,x:player.x,index:barelPlayerFrame().index};
  for(let i=0;i<3;i++){update();check(player.t===frozen.t&&player.x===frozen.x&&barelPlayerFrame().index===frozen.index,'Real hitstop freeze');}
  updPlayer();check(player.t===10,'Shared clock resumes');
  barelComboTestSetup('aseprite10');startAtk(0);player.buf=200;player.t=267.5/MS-1;updPlayer();
  check(player.combo===1&&player.atk==='c2'&&!barelPlayerFrame().image,'Buffered combo1');
  barelComboTestSetup('aseprite10');startAtk(0);inputDown('ShiftLeft');updPlayer();inputUp('ShiftLeft');
  check(player.st==='dash'&&BarelCombo0.frameFor(player,MS)===null,'Input dash cancels attack');
  barelComboTestSetup('aseprite10');startAtk(0);check(hurtPlayer(5,-1,false),'Hit accepted');
  check(player.st==='hurt'&&player.hp===95&&!barelPlayerFrame().image,'Hurt cancels visual');
  barelComboTestSetup('aseprite10');startAtk(0);check(!startSkill('thrust'),'Startup skill cancel remains blocked');
  player.t=200/MS;startSkill('thrust');
  check(player.st==='skill'&&!barelPlayerFrame().image,'Skill uses existing clip');
  barelComboTestSetup('aseprite10');inputDown('Space');updPlayer();inputUp('Space');updPlayer();
  check(player.z>0&&BarelCombo0.frameFor(player,MS)===null,'Jump preserved');
  barelComboTestSetup('aseprite10');startAtk(1);check(!barelPlayerFrame().image,'Other combo unchanged');
  startAtk('air');check(player.atk==='air'&&BarelCombo0.frameFor(player,MS)===null,'Air attack unchanged');
  window.barelComboTestSheet=(face)=>{
    barelComboTestSetup('aseprite10');startAtk(0);
    const times=[0,40,70,105,130,155,185,230,255,295];
    ctx.save();ctx.setTransform(1,0,0,1,0,0);
    ctx.fillStyle='#20242c';ctx.fillRect(0,0,cv.width,cv.height);
    ctx.scale(cv.width/960,cv.height/540);
    times.forEach((time,i)=>{
      player.t=time/MS;
      const x=100+(i%5)*180,y=225+Math.floor(i/5)*250;
      ctx.strokeStyle='#546170';ctx.beginPath();ctx.moveTo(x-80,y);ctx.lineTo(x+80,y);ctx.stroke();
      ctx.fillStyle='#eee';ctx.font='14px sans-serif';ctx.fillText('F'+(i+1)+' '+time+'ms',x-65,y+25);
      paintBarel(barelPlayerFrame(),{x,y,z:0,face,flash:0});
    });
    ctx.restore();return cv.toDataURL('image/png').split(',')[1];
  };
  return {boundaries,traces,hitstop:frozen,attackDurationMs:350,combatUnchanged:true};
}
