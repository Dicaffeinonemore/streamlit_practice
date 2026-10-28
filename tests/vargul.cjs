// Isolated browser: $env:VARGUL_SUITE='1'; node tests/regression.cjs
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
module.exports=async({evaluate,call,errors,root,base,ready})=>{
  const out=path.join(root,process.env.VARGUL_ARTIFACT_DIR||'artifacts/vargul-1.36/runtime');fs.mkdirSync(out,{recursive:true});
  await evaluate(`window.testRAF=window.requestAnimationFrame.bind(window);window.requestAnimationFrame=()=>0;AUDIO.enable(false);beginGame();startStage(3);scene='play';showScreen(null);VARGUL_READY`);
  console.log('Vargul decoded: '+await evaluate('VARGUL_SHEETS.map(i=>[i.naturalWidth,i.naturalHeight])'));
  const result=await evaluate(`(${checks.toString()})()`);
  async function key(code){await call('Input.dispatchKeyEvent',{type:'keyDown',code,key:code});await call('Input.dispatchKeyEvent',{type:'keyUp',code,key:code});}
  await key('F2');
  assert.equal(await evaluate("scene==='bossintro'&&isVargul(introBoss)&&introBoss.hp===2000&&introBoss.z===0"),true,'F2 starts Vargul intro');
  await evaluate("for(let i=0;i<192;i++)updIntro();scene='play';hitStop=shake=flashT=0");
  await key('F3');assert.equal(await evaluate('enemies.find(isVargul).hp'),2500,'F3 enters phase2');
  await key('F4');assert.equal(await evaluate('enemies.find(isVargul).hp'),875,'F4 selects 35%');
  await evaluate('window.savedVargulEnemies=enemies;enemies=[]');
  await key('F8');assert.equal(await evaluate('vargulDebug&&aurelionDebug'),true,'F8 shares existing Aurelion box flag');
  await key('F8');
  await evaluate('enemies=window.savedVargulEnemies;delete window.savedVargulEnemies');
  result.repeatKeyRuns=[];
  for(const p2 of [false,true])for(const id of ['combo','dash','sword','cross','orb','sweep',p2?'ultimate':'taunt']){
    await evaluate(`(()=>{clearInput();scene='play';practice=false;camX=0;player=newPlayer();player.x=170;player.y=420;player.inv=999999;hazards=[];enemies=[mkEnemy('boss4',450,420)];const e=enemies[0];e.p2shown=${p2};if(e.p2shown)e.hp=e.max=2500;e.atkCd=0;vargulRepeat=null;vargulDebugMove=0;hitStop=shake=flashT=slowT=0;})()`);
    const index=await evaluate(`VARGUL_ATTACKS.filter(id=>id!==(${p2}?'taunt':'ultimate')).indexOf('${id}')`);
    for(let i=0;i<index;i++)await key('F6');
    await key('F7');assert.equal(await evaluate('vargulRepeat'),id,'F6/F7 chooses '+id);
    const measured=await evaluate(`(()=>{const e=enemies[0];let ticks=0;while((!e.vargul?.stats.runs.length||e.st==='pat')&&ticks<900){updEnemy(e);updHazards();ticks++;}if('${id}'==='orb')strikeVargulOrbs(0,0,new Set(),{global:true,damage:VARGUL_RULES.orb.hp});while(e.vargul.stats.runs.length<2&&ticks<1800){updEnemy(e);updHazards();ticks++;}return {first:structuredClone(e.vargul.stats.runs[0]),repeated:e.vargul.stats.runs.length===2,second:e.vargul.stats.runs[1]?.id,totalTicks:ticks};})()`);
    assert.equal(measured.repeated,true,id+' repeats through actual debug keys');assert.equal(measured.second,id);
    result.repeatKeyRuns.push(measured);await key('F7');
  }
  await evaluate(`window.vargulShotSetup=(p2=false)=>{clearInput();scene='play';showScreen(null);practice=false;player=newPlayer();startStage(3);scene='play';waveIdx=stage.waves.length;camLock=true;camX=lockAt=0;arena=null;barrels=[];hazards=[];items=[];parts=[];texts=[];impacts=[];bursts=[];ghosts=[];bolts=[];player.x=220;player.y=398;player.inv=999999;enemies=[mkEnemy('boss4',410,430)];const e=enemies[0];e.p2shown=p2;if(p2)e.hp=e.max=2500;vargulRepeat=null;vargulDebug=false;hitStop=shake=flashT=slowT=0;return e;};window.vargulShotStep=(n)=>{for(let i=0;i<n;i++){tick++;updEnemy(enemies[0]);updHazards();}};`);
  async function shot(name,expression){
    await evaluate(expression+`;shake=flashT=hitStop=0;player.inv=0;texts=[];render()`);
    const r=await call('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,name+'.png'),Buffer.from(r.data,'base64'));
  }
  await shot('intro-throne-break',`(()=>{const e=vargulShotSetup();introBoss=e;scene='bossintro';e.st='intro';introLand=false;introT=0;for(let i=0;i<135;i++){tick++;updIntro();}})()`);
  await shot('sword-mark',`vargulShotSetup();startPat(enemies[0],'sword');vargulShotStep(58)`);
  await shot('cross-mark',`vargulShotSetup();startPat(enemies[0],'cross');vargulShotStep(68)`);
  await shot('cross-eruption',`vargulShotSetup();startPat(enemies[0],'cross');vargulShotStep(99)`);
  await shot('orb-ai',`vargulShotSetup();startPat(enemies[0],'orb');vargulShotStep(96);vargulDebug=true`);
  await shot('ultimate-mark',`vargulShotSetup(true);startPat(enemies[0],'ultimate');vargulShotStep(116)`);
  await shot('ultimate-fall',`vargulShotSetup(true);startPat(enemies[0],'ultimate');vargulShotStep(139)`);
  await shot('ultimate-impact',`vargulShotSetup(true);startPat(enemies[0],'ultimate');vargulShotStep(146)`);
  await shot('ultimate-kneel',`vargulShotSetup(true);startPat(enemies[0],'ultimate');vargulShotStep(205)`);
  await shot('awaken-d8-burst',`vargulShotSetup();enemies[0].hp=1;damageEnemy(enemies[0],1,false,0,true);vargulShotStep(174)`);
  await shot('p2-tattoo-bright',`vargulShotSetup(true);startPat(enemies[0],'combo');enemies[0].vargul.current=enemies[0].vargul.timeline[15];tick=22`);
  await shot('p2-tattoo-dim',`vargulShotSetup(true);startPat(enemies[0],'combo');enemies[0].vargul.current=enemies[0].vargul.timeline[15];tick=67`);
  await shot('death-last',`vargulShotSetup(true);damageEnemy(enemies[0],99999,true,0,true);vargulShotStep(120)`);
  result.screenshots=fs.readdirSync(out).filter(n=>n.endsWith('.png')&&!n.endsWith('-measured.png'));
  if(process.env.VARGUL_BENCH==='1'){
    console.log('Benchmark 60 seconds: Vargul phase2 with orbs and repeated floor hazards');
    result.benchmark=await evaluate(`new Promise(resolve=>{const e=vargulShotSetup(true);vargulEvent(e,{type:'orbs'});vargulRepeat='cross';vargulDebug=false;const start=performance.now(),frames=[],cpu=[];let previous=start;function sample(now){frames.push(now-previous);previous=now;const before=performance.now();player.inv=999999;player.hp=100;update();render();cpu.push(performance.now()-before);if(now-start<60000)testRAF(sample);else{const sorted=cpu.slice().sort((a,b)=>a-b),periods=frames.slice().sort((a,b)=>a-b);resolve({seconds:(now-start)/1000,frames:frames.length,averageFps:frames.length/((now-start)/1000),meanFrameMs:frames.reduce((a,b)=>a+b,0)/frames.length,p95FrameMs:periods[Math.floor(periods.length*.95)],meanUpdateRenderMs:cpu.reduce((a,b)=>a+b,0)/cpu.length,p95UpdateRenderMs:sorted[Math.floor(sorted.length*.95)],maxUpdateRenderMs:Math.max(...cpu),maxHazards:window.vargulBenchMax||0});}window.vargulBenchMax=Math.max(window.vargulBenchMax||0,hazards.length);}testRAF(sample);})`);
    fs.writeFileSync(path.join(out,'benchmark.json'),JSON.stringify(result.benchmark,null,2));
  }
  if(!result.benchmark&&fs.existsSync(path.join(out,'benchmark.json')))result.benchmark=JSON.parse(fs.readFileSync(path.join(out,'benchmark.json'),'utf8'));
  result.externalResources=await evaluate('performance.getEntriesByType("resource").filter(r=>!r.name.startsWith("data:")).map(r=>r.name)');
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(result,null,2));
  assert.deepEqual(result.externalResources.filter(url=>!url.startsWith(base+'/assets/aseprite/')),[],
    'Embedded scripts and images are self-contained; animation metadata stays on the game server');
  await ready(base+'/production.html');await evaluate('VARGUL_READY');
  assert.equal(await evaluate('VARGUL_DEBUG'),false,'Production disables debug');
  const before=await evaluate('scene');await key('F2');assert.equal(await evaluate('scene'),before,'Debug shortcuts do nothing in production');
  await evaluate(`requestAnimationFrame=()=>0;AUDIO.enable(false);beginGame();startStage(3);scene='play';waveIdx=stage.waves.length;camLock=true;camX=lockAt=stage.waves.at(-1).at;barrels=[];arena=null;enemies=[];spawnWave({e:[['boss4',1]],boss:true});for(let i=0;i<192;i++)updIntro();const e=enemies[0];damageEnemy(e,99999,true,0,true);for(let i=0;i<288;i++)updEnemy(e);damageEnemy(e,99999,true,0,true);for(let i=0;i<152;i++){player.inv=99999;hitStop=0;update();}render();`);
  assert.equal(await evaluate("clearT>0&&vargulRemains.length===1"),true,'New stage4 death reaches clear with final remains');
  result.production={debugDisabled:true,stage4ReachesClear:true};
  result.consoleErrors=errors;
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(result,null,2));
  assert.deepEqual(errors,[],'No browser exceptions');
  console.log('PASS Vargul combat: '+result.patterns.length+' measured timelines');
};
function checks(){
  const check=(c,m)=>{if(!c)throw Error(m);},result={patterns:[],checks:[],timelineValidation:VARGUL_TIMELINE_CHECKS,
    definitions:VARGUL_TIMELINES.map(p=>Object.fromEntries(Object.entries(p).map(([k,v])=>[k,{clip:v.clip,total:v.total,stages:v.stages}])))};
  function setup(p2=false){
    clearInput();practice=false;scene='play';camX=0;player=newPlayer();player.x=170;player.y=420;player.inv=99999;
    hazards=[];enemies=[];barrels=[];items=[];parts=[];texts=[];ghosts=[];bolts=[];impacts=[];bursts=[];chain.n=0;chain.t=0;hitStop=shake=flashT=slowT=0;vargulRepeat=null;
    const e=mkEnemy('boss4',450,420);e.p2shown=p2;if(p2)e.hp=e.max=2500;enemies=[e];return e;
  }
  for(const p2 of [false,true])for(const [id,def] of Object.entries(VARGUL_TIMELINES[p2?1:0])){
    const e=setup(p2);startPat(e,id);let ticks=0;
    while(e.st==='pat'&&ticks<800){updEnemy(e);updHazards();ticks++;}
    check(e.st==='chase',id+' finishes');
    const run=e.vargul.stats.runs.at(-1);check(ticks===def.total,id+' timing '+ticks+' != '+def.total);
    const recovery={combo:p2?22:26,dash:p2?34:36,sword:24,cross:24,orb:36,sweep:22,taunt:70,ultimate:90}[id];
    check(run.recovery===recovery,id+' recovery agrees with source design');
    const startup={combo:p2?15:18,dash:p2?20:24,sweep:p2?14:16,ultimate:26}[id];
    if(startup!==undefined)check(def.stages[0].ticks===startup,id+' source-design startup');
    while(vargulFloorBusy(e))updHazards();
    if(id==='sword'){
      const marks=run.events.filter(v=>v.type==='sword_mark').map(v=>v.elapsed),active=run.events.filter(v=>v.type==='sword_active').map(v=>v.elapsed);
      check(marks.length===(p2?5:3),'source sword mark count');
      check(marks.every((t,i)=>i===0||t-marks[i-1]===(p2?14:18)),'source sword interval');
      check(active.every((t,i)=>t-marks[i]===(p2?38:45)),'source sword wait');
    }
    if(id==='cross'){
      const marks=run.events.filter(v=>v.type==='cross_mark').map(v=>v.elapsed),active=run.events.filter(v=>v.type==='cross_active').map(v=>v.elapsed);
      check(marks.length===(p2?2:1)&&(!p2||marks[1]-marks[0]===30),'source cross count / interval');
      check(active.every((t,i)=>t-marks[i]===(p2?51:60)),'source cross wait');
    }
    result.patterns.push({...run,expectedTicks:def.total});
  }
  function passed(name){result.checks.push(name);}
  {const e=setup();check(e.max===2000&&e.grMax===150,'phase1 stats');e.hp=1100;damageEnemy(e,101,false,0,true);check(!e.p2shown&&!e.phaseT,'no half-HP phase change');passed('2000 HP; no phase change at 50%');}
  {const e=setup();e.invuln=false;startPat(e,'dash');damageEnemy(e,1,false,0,true);check(e.st==='pat','white dash startup superarmor');e.hp=1501;damageEnemy(e,2,false,0,true);check(e.st==='down'&&e.nextKd===1000,'armor still obeys forced down');passed('superarmor preserves damage / threshold knockdown');}
  for(const p2 of [false,true]){
    const e=setup(p2);player.y=350;startPat(e,'dash');
    while(e.vargul.timeline[e.vargul.cursor]?.label==='dash_warning'){
      const t=e.vargul.timeline[e.vargul.cursor];if(t.local===t.lockAt)player.y=450;updEnemy(e);
    }
    check(Math.abs(e.y-350)<1e-6,'dash reaches its locked lane p'+(p2?2:1));
    if(p2){
      while(e.vargul.timeline[e.vargul.cursor]?.label!=='return_warning')updEnemy(e);
      player.y=450;
      while(e.vargul.timeline[e.vargul.cursor]?.label==='return_warning'){
        const t=e.vargul.timeline[e.vargul.cursor];if(t.local===t.lockAt)player.y=350;updEnemy(e);
      }
      check(Math.abs(e.y-450)<1e-6,'return dash rereads and locks a new lane');
    }
  }passed('dash locks its lane before launch; phase2 return reads a fresh lane');
  for(const id of ['combo','sword','cross','orb','sweep']){const e=setup();startPat(e,id);damageEnemy(e,1,false,0,true);check(e.st==='hurt'&&!e.pat,id+' startup interruptible');}passed('all ! startups interruptible');
  for(const p2 of [false,true]){const e=setup(p2);for(let i=0;i<(p2?2:3);i++)damageEnemy(e,1,false,0,true);check(e.vargul.forceSweep&&pickVargulPattern(e,70,0)==='sweep','pressure forces sweep');}passed('3 / 2 pressure hits force next sweep');
  {const e=setup();startPat(e,'sword');for(let i=0;i<34;i++){updEnemy(e);updHazards();}check(vargulHazards(e,'sword').length===1,'first sword marker');const z=vargulHazards(e,'sword')[0],xy=[z.x,z.y];player.x+=100;player.y+=35;damageEnemy(e,1,false,0,true);for(let i=0;i<60;i++)updHazards();check(z.boom&&z.dead,'placed marker finishes after interrupt');check(z.x===xy[0]&&z.y===xy[1]&&e.vargul.stats.events.filter(v=>v.type==='sword_mark').length===1,'future markers canceled; old marker fixed');passed('interrupt cancels future sword marks; placed mark persists');}
  {const e=setup();spawnVargul(e,'sword',200,420,0,{wait:45,active:6});check(vargulFloorBusy(e),'floor locked');for(let i=0;i<52;i++)updHazards();check(!vargulFloorBusy(e),'floor unlocks after active period');passed('floor attacks cannot overlap unresolved floor hazards');}
  {const e=setup();const a=vargulData(e);a.cooldowns={dash:100,sword:100,cross:100,orb:100};a.lastMove='combo';a.repeats=2;check(pickVargulPattern(e,50,0)!=='combo','third repeat excluded');passed('max two consecutive choices');}
  for(const p2 of [false,true]){
    const e=setup(p2);startPat(e,'orb');for(let i=0;i<40;i++){updEnemy(e);updHazards();}const orbs=vargulHazards(e,'orb');check(orbs.length===2,'two orbs');
    const z=orbs[0];player.x=z.x-30;player.y=z.y;player.face=1;
    const strike=new Set();strikeVargulOrbs(60,8,strike);check(z.hp===20,'first hit deals actual10 damage');z.inv=0;strikeVargulOrbs(60,8,strike);check(z.hp===20,'same swing cannot double-hit');
    strikeVargulOrbs(60,8,new Set());check(z.hp===10,'second normal strike');z.inv=0;
    const gr=e.gr;strikeVargulOrbs(60,8,new Set());check(z.dead&&e.gr===gr+20,'HP zero grants 20 groggy');
    const remaining=vargulHazards(e,'orb')[0];vargulBreakOrb(remaining,true);
    check(e.vargul.cooldowns.orb===720,'orb cooldown starts after last gone');
  }passed('orbs have30 HP; actual strike damage; +20 groggy; cooldown after last orb');
  for(const p2 of [false,true]){
    const e=setup(p2);vargulEvent(e,{type:'orbs'});
    const orbs=vargulHazards(e,'orb');orbs[0].shotCooldown=1;orbs[1].shotCooldown=999;
    for(let i=0;i<21;i++){updEnemy(e);updHazards();}
    check(hazards.filter(z=>z.kind==='shard').length===(p2?2:1),'phase shard count');
    player.st='down';orbs[0].shotCooldown=0;const n=hazards.filter(z=>z.kind==='shard').length;
    for(let i=0;i<30;i++){updEnemy(e);updHazards();}
    check(hazards.filter(z=>z.kind==='shard').length===n,'no fire at downed player');
  }passed('independent orb shooting / 1 or 2 shards / no shots at downed player');
  {const e=setup();spawnVargul(e,'sword',100,420,0,{wait:45,active:6});vargulEvent(e,{type:'orbs'});e.hp=1;damageEnemy(e,1,false,0,true);
    check(e.hp===0&&e.phaseT===288&&e.invuln&&!vargulHazards(e).length,'phase begins only at zero; clears owned hazards');
    damageEnemy(e,99,true);check(e.hp===0,'transition immune');
    for(let i=0;i<287;i++){updEnemy(e);updHazards();}
    check(e.hp===0&&e.invuln&&!e.p2shown,'HP not refilled before crossfade ends');
    check(e.vargul.transitionEvents.map(v=>v.type).join(',')==='d8_burst,floor_ring','awaken effects');
    updEnemy(e);check(e.hp===2500&&e.max===2500&&e.p2shown&&!e.invuln&&!e.phaseT,'refill after 288 ticks');
    for(const st of ['down','stun','dead']){e.st=st;check(!vargulAuraVisible(e),'hide aura '+st);}
    result.transition=e.vargul.transitionEvents;passed('zero HP -> down100 + awaken180 + crossfade8 -> HP2500');}
  {const e=setup(true);e.hp=875;e.atkCd=0;check(pickVargulPattern(e,60,0)==='ultimate','35% priority');
    player.x=e.x-10;e.face=1;chaseVargul(e);check(e.pat==='ultimate','first ultimate outranks a rear sweep');
    for(let i=0;i<46;i++){updEnemy(e);updHazards();}check(e.invuln&&vargulPose(e).hidden,'vanished invulnerable');
    const hp=e.hp;damageEnemy(e,100,true);check(e.hp===hp,'offscreen cannot be hit');
    for(let i=46;i<170;i++){updEnemy(e);updHazards();}check(e.vargul.run.drawings.some(v=>v.label==='kneel'),'ultimate lands');
    check(e.vargul.cooldowns.ultimate>0,'ultimate cooldown');passed('ultimate 35% priority / hidden immunity / return');}
  {const e=setup(true);e.st='stun';e.t=1;damageEnemy(e,10,false);check(e.hp===2485,'common groggy x1.5');passed('shared groggy damage multiplier');}
  result.contacts=[];
  for(const p2 of [false,true])for(const id of ['combo','sweep','dash']){
    const e=setup(p2);player.hp=10000;startPat(e,id);
    for(let i=0;e.st==='pat'&&i<400;i++){
      const a=e.vargul,t=a.timeline[a.cursor];
      if(t?.attack&&!a.hitIds.has(t.attack.id)){
        const b=vargulAttackBox(e,t);player.x=e.x+e.face*(b[0]+b[2]/2+(t.travel?14*.5112:0));player.y=e.y;
        player.z=0;player.st='free';player.inv=0;
      }
      updEnemy(e);updHazards();
    }
    const hits=e.vargul.stats.hits;
    check(hits.length===(id==='combo'?3:id==='sweep'||p2?2:1),'measured boxes connect '+id+' p'+(p2?2:1));
    for(const hit of hits)check(hit.damage===Math.round(hit.base*(p2?1.3:1)),'common phase damage multiplier');
    result.contacts.push({id,phase:p2?2:1,hits});
  }passed('actual measured melee boxes connect each strike; shared phase damage x1.3');
  for(const where of ['center','outer']){
    const e=setup(true),u=VARGUL_RULES.ultimate;player.x=where==='center'?300:300+(u.rx+u.outerX)/2;player.y=420;player.z=0;player.inv=0;
    if(where==='center'){spawnVargul(e,'ultimate',300,420,0,{stage:'impact',impactAge:0});updHazards();}
    else{spawnVargul(e,'ice_wave',300,420,0,{hit:false});for(let i=0;i<36;i++)updHazards();}
    check(player.hp===100-Math.round((where==='center'?23:10)*1.3),'ultimate '+where+' collision damage');
  }passed('ultimate ground slam center and expanding ice-wave damage');
  {const e=setup(true);damageEnemy(e,99999,true,0,true);check(e.st==='dead','final death');for(let i=0;i<145;i++)updEnemy(e);check(!e.remove&&vargulPose(e).drawing===16,'death last drawing held');updEnemy(e);check(e.remove&&vargulRemains.length>0,'remains survive removal and stage can clear');passed('death 16 drawings; held final frame; persistent remains');}
  return result;
}
