// Actual browser game tests, shared by local HTTP and Streamlit iframe.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
module.exports=async({evaluate,call,errors,root,environment})=>{
  const out=path.join(root,'artifacts/barel-combo2-dot-10',environment);fs.mkdirSync(out,{recursive:true});
  for(const id of [0,1,2])assert.equal(await evaluate(`BarelCombo${id}.ready`),true);
  assert.equal(await evaluate('BarelComboFx.ready'),true);
  for(const id of [0,1,2])assert.equal(await evaluate(`BarelCombo${id}.frameFor({characterId:'barel',st:'atk',atk:'c${id+1}',combo:${id},t:0},1000/60).image.src.includes('barel-combo${id}-dot-10.png')`),true,'Each hit must select its supplied dot atlas by default');
  assert.equal(await evaluate('BarelCombo2.status().effective'),'aseprite10');
  await evaluate("globalThis.BarelIdle?.setMode('legacy')");
  await evaluate('window.combo2NativeRAF=requestAnimationFrame;requestAnimationFrame=()=>0;AUDIO.enable(false);beginGame();showScreen(null)');
  await evaluate('new Promise(resolve=>combo2NativeRAF(()=>resolve()))');
  const results=await evaluate(`(${trial.toString()})()`);
  const samples=await evaluate(`(async()=>{
    AUDIO.stop(0);AUDIO.enable(true);
    const ready=await AUDIO.barelSamplesReady();
    if(ready.length!==6||ready.some(ok=>!ok))throw Error('All six supplied MP3s must decode');
    const nativeStart=AudioBufferSourceNode.prototype.start,played=[];
    AudioBufferSourceNode.prototype.start=function(...args){
      if(this.buffer){
        const data=this.buffer.getChannelData(0);let peak=0,energy=0;
        for(const v of data){if(!Number.isFinite(v))throw Error('Invalid MP3 PCM');peak=Math.max(peak,Math.abs(v));energy+=v*v;}
        played.push({duration:this.buffer.duration,offset:args[1]||0,limit:args[2]??null,peak,rms:Math.sqrt(energy/data.length)});
      }
      return nativeStart.apply(this,args);
    };
    try{
      AUDIO.sfx('swordHit');AUDIO.sfx('barelWave');AUDIO.sfx('barelFinalHit');
      if(played.length!==3||played.some(p=>p.peak<=.003||p.rms<=0)||new Set(played.map(p=>p.duration)).size!==3)throw Error('Distinct audible MP3 sources must play');
      AUDIO.sfx('hurtH');
      if(played.length!==4||played[3].peak<=.003||played[3].rms<=0)throw Error('Heavy hurt must play the supplied hurt MP3');
      AUDIO.sfx('barelSlam');
      if(played.length!==5||played[4].peak<=.003||played[4].rms<=0)throw Error('P/H must play the supplied impact MP3');
      AUDIO.sfx('barelCombo',{duration:.88});
      if(played.length!==6||played[5].peak<=.003||played[5].rms<=0||!(played[5].limit>0&&played[5].limit<=.88))throw Error('Combo sample must play with a duration bounded before the finisher');
      AUDIO.pause(true);AUDIO.sfx('swordHit');AUDIO.sfx('barelWave');AUDIO.sfx('barelFinalHit');
      AUDIO.sfx('hurt');AUDIO.sfx('hurtH');
      AUDIO.sfx('barelSlam');
      AUDIO.sfx('barelCombo',{duration:.88});
      if(played.length!==6)throw Error('Paused samples must stay silent');
      AUDIO.pause(false);AUDIO.enable(false);AUDIO.sfx('swordHit');
      AUDIO.sfx('hurt');AUDIO.sfx('hurtH');
      AUDIO.sfx('barelSlam');
      AUDIO.sfx('barelCombo',{duration:.88});
      if(played.length!==6)throw Error('Muted sample must stay silent');
      return {ready,played};
    }finally{AudioBufferSourceNode.prototype.start=nativeStart;AUDIO.pause(false);AUDIO.enable(false);}
  })()`);
  results.samples=samples;
  for(const face of [1,-1]){
    const fx=await evaluate(`comboFxSheet(${face})`);
    fs.writeFileSync(path.join(out,`supplied-effects-${face}.png`),Buffer.from(fx,'base64'));
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
  console.log('PASS '+environment+': supplied FX rows 1/2/3 with six cels and blade timing, no projectile/ground smash, sword sounds, unchanged combo damage/knockdown/hitstop, chain/cancel/jump/flip and loader fallbacks');
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
  for(let combo=0;combo<3;combo++){
    combo2Setup('aseprite10');startAtk(combo);const a=ATK[player.atk],seen=new Set();
    for(let time=0;time<a.wind+a.act+a.rec;time+=1){
      player.t=time/MS;const f=BarelComboFx.frameFor(player,MS);
      if(time<a.wind||time>=a.wind+a.act+70)check(f===null,'No FX in windup or late recovery');
      if(f){check(f.row===combo,'Top/middle/bottom row matches combo');seen.add(f.index);}
    }
    check(seen.size===6,'All six supplied FX cels play for hit '+combo);
    player.t=(a.wind+a.act*.35)/MS;
    check(BarelComboFx.frameFor(player,MS).index===2,'Bright cel starts with blade contact');
    player.st='dash';check(BarelComboFx.frameFor(player,MS)===null,'Cancel stops FX immediately');
  }
  combo2Setup('aseprite10');startAtk('air');check(BarelComboFx.frameFor(player,MS)===null,'No supplied ground-combo FX on air attack');
  player.characterId='viesa';player.atk='c1';check(BarelComboFx.frameFor(player,MS)===null,'No Barel FX on Viesa');
  window.comboFxSheet=face=>{
    combo2Setup('aseprite10');ctx.save();ctx.setTransform(1,0,0,1,0,0);
    ctx.fillStyle='#20242c';ctx.fillRect(0,0,cv.width,cv.height);ctx.scale(cv.width/960,cv.height/540);
    for(let combo=0;combo<3;combo++)for(let index=0;index<6;index++){
      startAtk(combo);const a=ATK[player.atk],peak=a.wind+a.act*.35,end=a.wind+a.act+70;
      const time=index<2?a.wind+(peak-a.wind)*(index+.5)/2:peak+(end-peak)*(index-2+.5)/4;
      Object.assign(player,{t:time/MS,x:80+index*160,y:155+combo*180,z:0,face,flash:0});
      paintBarel(barelPlayerFrame(),player);BarelComboFx.draw(player,MS);
      ctx.fillStyle='#eee';ctx.font='11px sans-serif';ctx.fillText((combo+1)+' / '+(index+1),index*160+10,combo*180+172);
    }
    ctx.restore();return cv.toDataURL('image/png').split(',')[1];
  };
  const nativeSfx=AUDIO.sfx,sounds=[];
  try{
    AUDIO.sfx=(name,kind)=>sounds.push({name,kind});
    for(const attack of [0,1,2,'air']){
      combo2Setup('aseprite10');const e=mkEnemy('brute',340,420);enemies=[e];
      startAtk(attack);playerStrike(ATK[player.atk]);
      check(sounds.slice(-3).map(s=>s.name).join(',')==='swordSwing,hurt,swordHit','Sword swing, enemy hurt and cutting contact for '+attack);
    }
    combo2Setup('aseprite10');startAtk(0);
    check(sounds.at(-1).name==='swordSwing','A miss only plays the swing');
    for(const st of ['atk','skill','special','cast']){
      player.st=st;player.skill='thrust';playerHitSfx(2);
      check(sounds.at(-1).name==='swordHit','All Barel impact states use sword MP3: '+st);
    }
    player.st='skill';player.skill='redwave';playerHitSfx(1);
    check(sounds.at(-1).name==='barelWave','L impact uses wave sample');
    combo2Setup('aseprite10');startSkill('redwave');player.t=300/MS;updSkill();
    check(sounds.at(-1).name==='barelWave','L launch uses wave sample');
    const wave=hazards.find(z=>z.type==='pwave'&&z.red);check(!!wave,'L projectile created');
    const target=mkEnemy('brute',wave.x+5,wave.y);enemies=[target];player.st='free';player.skill=null;
    const hp=target.hp;updHazards();
    check(target.hp<hp&&sounds.at(-1).name==='barelWave','L projectile retains wave sound after player recovers');
    for(const [skill,time] of [['slam',330],['leap',560]]){
      combo2Setup('aseprite10');startSkill(skill);
      const enemy=mkEnemy('brute',player.x+30,player.y);enemy.hp=enemy.max=1000;enemies=[enemy];
      player.t=time/MS;const before=sounds.length;updSkill();
      check(enemy.hp<1000,'P/H impact deals damage');
      check(sounds.slice(before).some(s=>s.name==='hurt')&&sounds.slice(before).every(s=>['hurt','barelSlam'].includes(s.name)),'P/H contact and ground impact retain their MP3 plus enemy hurt: '+skill);
    }
    combo2Setup('aseprite10');player.st='special';player.spX=350;player.spY=420;
    const victim=mkEnemy('brute',350,420);victim.hp=victim.max=1000;enemies=[victim];
    const comboStart=sounds.length;
    for(let k=0;k<4;k++){victim.inv=0;specialHit(false,k);}
    const comboSounds=sounds.slice(comboStart);
    check(comboSounds.filter(s=>s.name==='barelCombo').length===1,'Special combo sample starts once across all four slashes');
    check(comboSounds.some(s=>s.name==='hurt')&&comboSounds.every(s=>['hurt','barelCombo'].includes(s.name)),'Combo keeps enemy hurt and replaces individual sword samples');
    victim.inv=0;const before=sounds.length;
    barrels=[{x:350,y:420,hp:2,dead:false}];specialHit(true,4);
    check(sounds.slice(before).some(s=>s.name==='hurt')&&sounds.slice(before).every(s=>['hurt','barelFinalHit'].includes(s.name)),'Final impact retains finisher sound plus enemy hurt');
    player.characterId='viesa';player.st='atk';player.viesaClip='slash1';playerHitSfx(0);
    check(sounds.at(-1).name==='hit','Viesa retains her original contact sound');
    for(const characterId of ['barel','viesa'])for(const heavy of [false,true]){
      combo2Setup('aseprite10');player.characterId=characterId;player.inv=0;
      const before=sounds.length;
      check(hurtPlayer(5,1,heavy),'Player receives damage');
      check(sounds.slice(before).some(s=>s.name===(heavy?'hurtH':'hurt')),'Shared hurt audio for '+characterId+' heavy='+heavy);
    }
    for(const characterId of ['barel','viesa'])for(const type of Object.keys(ET)){
      combo2Setup('aseprite10');player.characterId=characterId;
      const enemy=mkEnemy(type,350,420);enemies=[enemy];const hp=enemy.hp,before=sounds.length;
      damageEnemy(enemy,1,false);
      check(enemy.hp<hp&&sounds.slice(before).filter(s=>s.name==='hurt').length===1,'Successful hit plays enemy hurt for '+characterId+' -> '+type);
      enemy.invuln=true;const blocked=sounds.length;damageEnemy(enemy,1,false);
      check(sounds.length===blocked,'Invulnerable target makes no successful hit sound');
    }
  }finally{AUDIO.sfx=nativeSfx;}
  check(a.wind===200&&a.act===140&&a.rec===340,'Existing timing');
  check(a.dmg===16&&a.reach===98&&a.step===16&&a.stop===7&&a.kd===true,'Existing combat/knockdown');
  check(BUF_MS===220&&a.wind+a.act*.35===249&&a.wind+a.act+30===370,'Hit range and input buffer');
  const originalEffect=barelEffect,overlays=[];
  try{
    barelEffect=(...args)=>overlays.push(args[0]);
    for(const mode of ['legacy','aseprite10'])for(const attack of [0,1,2,'air']){
      combo2Setup(mode);startAtk(attack);
      for(let time=0;time<680;time+=10){player.t=time/MS;drawBarelPlayer();}
    }
    check(overlays.length===0,'Basic attacks do not draw the old atlas effect overlays');
    combo2Setup('aseprite10');player.st='skill';player.skill='thrust';player.t=250/MS;drawBarelPlayer();
    check(overlays.includes('slash'),'Skill overlay remains available');
  }finally{barelEffect=originalEffect;}
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
    check(trace.every(t=>!t.wave&&!t.smash&&t.waves===0),'Basic finisher emits no wave or ground smash');
    const firstHit=trace.find(t=>t.hp<hp);
    check(firstHit.tick===15,'Existing tick quantization of blade hit');
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
  return {durationMs:680,activeMs:[249,370],nextCombo:null,waveMs:null,smashMs:null,damage:16,reach:98,step:16,
    knockback:{vx:4,vz:5,state:'down'},hitStopTicks:7,boundaries,traces,hitstop:frozen,earlierCombosPreserved:true};
}
