// Run through the shared isolated CDP harness:
// $env:AURELION_SUITE='1'; node tests/regression.cjs
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
module.exports=async({evaluate,call,errors,root})=>{
  const out=path.join(root,'artifacts/aurelion-1.33');fs.mkdirSync(out,{recursive:true});
  await evaluate(`window.testRAF=window.requestAnimationFrame.bind(window);window.requestAnimationFrame=()=>0;AUDIO.enable(false);beginGame();startStage(2);scene='play';showScreen(null);AURELION_READY`);
  const result=await evaluate(`(${checks.toString()})()`);
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(result,null,2));
  console.log('PASS 16 forced patterns, guard, lanes, markers, phase/death and multi-hit checks');
  assert.equal(await evaluate('performance.getEntriesByType("resource").filter(r=>!r.name.startsWith("data:")).length'),0,'Embedded HTML makes no external resource requests');
  for(const p2 of [false,true])for(const move of ['combo','sword_wave','cleave','charge','judgment','guard','whirl','taunt'])for(const debug of [false,true]) {
    await evaluate(`(()=>{clearInput();player=newPlayer();player.x=220;player.y=420;player.inv=9999;enemies=[mkEnemy('boss3',410,420)];hazards=[];items=[];barrels=[];parts=[];texts=[];bursts=[];impacts=[];ghosts=[];bolts=[];const e=enemies[0];e.p2shown=${p2};startPat(e,'${move}');if(e.pat==='combo')setAurelionTimeline(e,'combo','full');const a=e.aurelion;a.halo=${p2};const at=a.timeline.findIndex(t=>t.d.hitboxes.length||t.events.some(v=>v.type==='spawn'&&v.id!=='dust_small'));e.pt=(Math.max(12,at)+1)*MS;runPat(e);player.inv=0;flashT=0;hitStop=0;shake=0;slowT=0;chain.n=0;chain.t=0;aurelionDebug=${debug};render();})()`);
    const r=await call('Page.captureScreenshot',{format:'png'});
    fs.writeFileSync(path.join(out,`${move}-p${p2?2:1}-${debug?'boxes':'art'}.png`),Buffer.from(r.data,'base64'));
  }
  if(process.env.AURELION_BENCH==='1') {
    result.benchmark=[];
    for(const [type,stageIndex] of [['boss1',0],['boss2',1],['boss3',2]]) {
      console.log('Benchmark 60 seconds: '+type);
      result.benchmark.push(await evaluate(`new Promise(resolve=>{player=newPlayer();startStage(${stageIndex});scene='play';showScreen(null);waveIdx=stage.waves.length;camLock=true;lockAt=camX;arena=null;barrels=[];player.x=220;player.y=420;enemies=[mkEnemy('${type}',400,420)];hazards=[];aurelionDebug=false;const start=performance.now(),samples=[],cpu=[];let last=start;function sample(now){samples.push(now-last);last=now;const t=performance.now();player.inv=9999;player.hp=player.max;update();render();cpu.push(performance.now()-t);if(now-start<60000)testRAF(sample);else{const sorted=cpu.slice().sort((a,b)=>a-b);resolve({type:'${type}',seconds:(now-start)/1000,frames:samples.length,meanFrameMs:samples.reduce((a,b)=>a+b,0)/samples.length,meanUpdateRenderMs:cpu.reduce((a,b)=>a+b,0)/cpu.length,p95UpdateRenderMs:sorted[Math.floor(sorted.length*.95)]});}}testRAF(sample);})`));
    }
  }
  assert.deepEqual(errors,[],'No browser errors');
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(result,null,2));
  console.log('PASS Aurelion integration; report and screenshots: '+out);
};
function checks(){
  const check=(c,msg)=>{if(!c)throw Error(msg);},results={patterns:[],multihit:[]};
  function setup(p2=false,x=200){clearInput();practice=false;scene='play';player=newPlayer();player.x=x;player.y=420;player.inv=9999;chain.n=0;hazards=[];const e=mkEnemy('boss3',300,420);e.p2shown=p2;enemies=[e];return e;}
  check(AURELION_SHEETS.every(i=>i.naturalWidth&&i.naturalWidth<=4096&&i.naturalHeight<=4096),'sheet decode');
  for(const p2 of [false,true])for(const id of AURELION_ATTACKS){
    const e=setup(p2);startPat(e,id);if(id==='combo')setAurelionTimeline(e,id,'full');
    let ticks=0;for(;e.st==='pat'&&ticks<900;ticks++)updEnemy(e);
    check(e.st==='chase',id+' finishes');
    const stats=e.aurelion.stats,waves=hazards.filter(z=>z.kind==='gold_wave').length,shocks=hazards.filter(z=>z.kind==='gold_shock').length;
    if(id==='sword_wave')check(waves===(p2?4:3),'wave count');
    if(id==='cleave')check(shocks===(p2?7:4),'shock count');
    if(id==='combo')check(stats.opportunities===3,'combo opportunities');
    if(id==='whirl')check(stats.opportunities===12,'whirl opportunities');
    results.patterns.push({id,phase:p2?2:1,ticks,waves,shocks,opportunities:stats.opportunities});
  }
  // A repeated event is emitted once per drawing instance, never twice by re-evaluation/rewind.
  {const e=setup(true);startPat(e,'sword_wave');e.pt=1000;runPat(e);const n=hazards.length;runPat(e);e.pt=100;runPat(e);e.pt=1000;runPat(e);check(hazards.length===n,'crossing events do not replay');}
  {const e=setup();player.inv=0;player.x=250;player.st='atk';player.atk='c1';player.combo=0;startPat(e,'guard');const old=[e.hp,e.gr,player.score,chain.n,player.hp,player.inv];damageEnemy(e,10,false);check(JSON.stringify(old)===JSON.stringify([e.hp,e.gr,player.score,chain.n,player.hp,player.inv]),'parry no side effects');check(e.aurelion.guard==='parry'&&player.st==='hurt','parry animation');for(let i=0;i<20;i++){updEnemy(e);if(player.inv>0)player.inv--;}check(player.hp<old[4],'counterattack lands');}
  for(const mode of ['heavy','special','lightning']){const e=setup();player.st=mode==='special'?'special':'atk';startPat(e,'guard');damageEnemy(e,10,mode==='heavy',0,mode==='lightning');check(e.hp===1490&&e.gr===39&&e.aurelion.guard==='broken','break '+mode);}
  {const e=setup();startPat(e,'guard');for(let i=0;i<61;i++)updEnemy(e);check(e.aurelion.guard==='timeout','guard timeout');}
  {const e=setup();startPat(e,'combo');setAurelionTimeline(e,'combo','stop1');check(e.aurelion.timeline.filter(t=>t.d.hitboxes.length&&t.source===t.d.start).length===1,'combo stop1');setAurelionTimeline(e,'combo','stop2');check(e.aurelion.timeline.filter(t=>t.d.hitboxes.length&&t.source===t.d.start).length===2,'combo stop2');}
  {const e=setup();player.x=620;startPat(e,'charge');for(let i=0;i<180&&e.st==='pat';i++)updEnemy(e);check(e.aurelion.stats.opportunities===9,'charge maximum four body cycles plus stab');}
  {const e=setup();const random=Math.random;Math.random=()=>0;try{player.x=250;startAtk(0);check(e.pat==='guard','reactive guard at attack start');}finally{Math.random=random;}}
  {const e=setup();for(let i=0;i<3;i++)damageEnemy(e,1,false);check(e.aurelion.forceGuard&&pickAurelionPattern(e,50,0)==='guard','pressure forces next guard');}
  {const e=setup();startPat(e,'taunt');damageEnemy(e,1,false);check(e.st==='hurt','taunt interruptible');}
  {const e=setup();e.st='stun';e.t=10;updEnemy(e);check(!e.invuln&&canHit(e),'groggy keeps common vulnerability');damageEnemy(e,10,false);check(e.hp===1485,'common 1.5 groggy multiplier');}
  {const e=setup();introBoss=e;e.st='intro';scene='bossintro';introT=0;introLand=false;for(let i=0;i<141;i++)updIntro();check(scene==='bossintro','intro holds 141 ticks');updIntro();check(scene==='play','intro ends at 142');e.p2shown=true;e.aurelion.halo=true;check(aurelionHaloVisible(e),'phase2 halo');for(const st of ['down','stun','dead']){e.st=st;check(!aurelionHaloVisible(e),'hide halo '+st);}}
  for(const kind of ['gold_wave','gold_shock','judge_pillar'])for(const lane of [0,40]){const e=setup();player.x=300;player.y=420+lane;player.inv=0;const z=spawnAurelionFx(e,kind,300,420);z.age=4*MS;updateAurelionHazard(z);check((player.hp<player.max)===(lane===0),kind+' lane '+lane);}
  {const e=setup();player.x=300;player.z=70;player.inv=0;const z=spawnAurelionFx(e,'gold_shock',300,420);z.age=4*MS;updateAurelionHazard(z);check(player.hp===player.max,'jump clears shock');}
  {const e=setup();player.x=300;player.inv=0;inputDown('ArrowUp');for(let i=0;i<15;i++)updPlayer();clearInput();const z=spawnAurelionFx(e,'gold_wave',300,420);z.age=4*MS;updateAurelionHazard(z);check(player.hp===player.max&&420-player.y>24,'walking changes lane safely');}
  {const e=setup();player.x=300;player.inv=0;inputDown('Space');for(let i=0;i<19;i++)updPlayer();clearInput();const z=spawnAurelionFx(e,'gold_shock',300,420);z.age=4*MS;updateAurelionHazard(z);check(player.z>64*AURELION_K&&player.hp===player.max,'actual jump apex clears shock');}
  {const e=setup(true);startPat(e,'judgment');spawnAurelionEvent(e,{type:'spawn',id:'judge_mark'});const marks=JSON.stringify(e.aurelion.marks);player.x+=100;player.y+=40;updHazards();check(marks===JSON.stringify(e.aurelion.marks),'marks fixed');check(e.aurelion.marks.length===5,'five marks');player.inv=0;spawnAurelionEvent(e,{type:'spawn',id:'judge_pillar'});for(let i=0;i<15;i++)updHazards();check(player.hp===player.max,'outside marks safe');resetBossFx(e);check(!hazards.some(z=>z.kind==='judge_mark'&&!z.dead),'cancel markers');}
  {const e=setup();e.hp=760;damageEnemy(e,10,false,0,true);check(e.hp===750&&e.phaseT===242&&e.invuln,'phase threshold');for(let i=0;i<146;i++)updEnemy(e);check(!e.aurelion.halo,'halo not early');updEnemy(e);check(e.aurelion.halo,'awaken third drawing halo');for(let i=147;i<242;i++)updEnemy(e);check(!e.phaseT&&!e.invuln,'242 ticks');damageEnemy(e,99999,true);for(let i=0;i<170;i++)updEnemy(e);check(!e.remove&&aurelionPose(e).f===120,'last death frame held');updEnemy(e);check(e.remove,'death removed after 121+50');}
  for(const p2 of [false,true])for(const id of ['combo','whirl']){
    const e=setup(p2);player.inv=0;player.hp=1000;startPat(e,id);if(id==='combo')setAurelionTimeline(e,id,'full');
    for(let i=0;e.st==='pat'&&i<400;i++){const a=e.aurelion,entry=a.timeline[a.cursor],hb=entry?.d.hitboxes?.[0];if(hb){player.x=e.x+e.face*(hb.box[0]+hb.box[2]/2)*AURELION_K;player.y=e.y;}
      // Keep the target in range; preserve real 40-tick invulnerability and down recovery.
      updPlayer();updEnemy(e);
    }
    results.multihit.push({id,phase:p2?2:1,hits:e.aurelion.stats.hits});
  }
  results.punish=punish();results.killEstimate=killEstimate();return results;
  function punish(){
    const rows=[];
    for(const row of aurelionRules.punish_check.rows)for(const p2 of [false,true]){
      const id=row.id.startsWith('guard_')?'guard':row.id,mode=id==='guard'?row.id.slice(6):id==='combo'?'full':undefined;
      const needed=[];
      for(const dash of [false,true]){
        const e=setup(p2);player.x=e.x-row.use_distance*AURELION_K;player.y=e.y+row.lane_gap;player.face=1;
        startPat(e,id);setAurelionTimeline(e,id,mode);const a=e.aurelion;
        const recovery=a.timeline.find(t=>id==='guard'||aurelionIn([aurelionMoves[id].punish_window.frames],t.source));
        a.current=recovery;updateAurelionState(e);a.cooldowns.guard=9999;
        const hp=e.hp;let t=0;
        if(dash&&e.x-player.x>ATK.c1.reach+e.hw)startDash(1);
        for(;t<120&&e.hp===hp;t++){
          clearInput();
          if(player.st==='free'){
            if(inReach(player,e,ATK.c1.reach,24,55))startAtk(0);
            else {if(e.x-player.x>=ATK.c1.reach+e.hw)inputDown('ArrowRight');if(Math.abs(player.y-e.y)>=24)inputDown(player.y>e.y?'ArrowUp':'ArrowDown');}
          }else if(player.st==='dash'&&player.t>=6&&Math.abs(player.y-e.y)<24)inputDown('KeyJ');
          updPlayer();
        }
        clearInput();needed.push(t);
      }
      rows.push({id:row.id,phase:p2?2:1,distance:+(row.use_distance*AURELION_K).toFixed(2),lane:row.lane_gap,window:row.window,firstHit:Math.ceil((ATK.c1.wind+ATK.c1.act*.35)/MS),walkTicks:needed[0],dashTicks:needed[1],possible:Math.min(...needed)<=row.window});
    }
    return rows;
  }
  function killEstimate(){
    const rows=[];
    // Ideal contact benchmark: repeated first slash, passive boss, actual common
    // damage/chain/groggy/down/revival and player attack animation. No dodge time.
    for(const type of ['boss2','boss3']){
      setup();const e=mkEnemy(type,300,420);enemies=[e];player.x=250;player.face=1;player.inv=99999;
      let ticks=0,hits=0,lastHp=e.hp;
      for(;ticks<18000&&e.st!=='dead';ticks++){
        if(hitStop>0){hitStop--;continue;}
        if(chain.t>0){chain.t-=MS;if(chain.t<=0)chain.n=0;}
        e.atkCd=99999;if(isAurelion(e))aurelionData(e).cooldowns.guard=99999;
        player.x=e.x-50;player.y=e.y;player.face=1;
        if(player.st==='free'&&canHit(e)&&!e.phaseT&&e.st!=='reviving')startAtk(0);
        lastHp=e.hp;updPlayer();if(e.hp<lastHp)hits++;
        updEnemy(e);e.x=300;e.y=420;enemies=[e];hazards=[];items=[];
      }
      check(e.st==='dead','kill estimate terminates '+type);
      rows.push({type,hits,ticks,seconds:+(ticks/60).toFixed(2)});
    }
    return rows;
  }
}
