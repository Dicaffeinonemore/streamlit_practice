// $env:COMBAT_UPDATE_SUITE='1'; node tests/regression.cjs
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
module.exports=async({evaluate,call,errors,root})=>{
  const out=path.join(root,'artifacts/combat-update-2026-10-22');fs.mkdirSync(out,{recursive:true});
  await evaluate('requestAnimationFrame=()=>0;AUDIO.enable(false);beginGame();showScreen(null);Promise.all([VARGUL_READY,...SOV_SHEETS.map(im=>im.decode())])');
  const result=await evaluate(`(${trial.toString()})()`);
  for(const phase of [false,true])for(const face of [-1,1]){
    await evaluate(`combatUpdateShot('beam',${phase},${face})`);
    const r=await call('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,`beam-p${phase?2:1}-${face}.png`),Buffer.from(r.data,'base64'));
  }
  for(const kind of ['cross-warning','cross-early','cross','cross-late','wave','drops']){
    await evaluate(`combatUpdateShot('${kind}')`);
    const r=await call('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,kind+'.png'),Buffer.from(r.data,'base64'));
  }
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({...result,errors},null,2));
  console.log('PASS arena-wide ice waves, jump safety, one drop roll per fist, both beam directions/phases and cross FX');
};
function trial(){
  const check=(v,m)=>{if(!v)throw Error(m);},result={waves:[],drops:[]};let e;
  function setup(stage=3,p2=true,face=1){
    clearInput();practice=false;player=newPlayer();startStage(stage);scene='play';showScreen(null);camX=lockAt=1200;camLock=true;waveIdx=STAGES[stage].waves.length;
    arena=null;barrels=[];items=[];parts=[];texts=[];hazards=[];impacts=[];bursts=[];ghosts=[];bolts=[];hitStop=shake=flashT=slowT=clearT=0;
    player.x=camX+VW*.65;player.y=420;player.inv=99999;
    e=mkEnemy(STAGES[stage].boss,camX+VW*.35,420);e.p2shown=p2;e.face=face;e.atkCd=99999;enemies=[e];
    if(stage===4){const s=sovData(e);for(const f of s.fists){const [x,y,h]=sovHome(e,f,s);Object.assign(f,{x,y,h,st:'home',hp:180,max:180});}}
    return e;
  }
  for(const [roll,want] of [[0,'potion'],[.24999,'potion'],[.25,'scroll'],[.39999,'scroll'],[.4,null],[.999,null]]){
    setup();vargulEvent(e,{type:'orbs'});const [z]=vargulHazards(e,'orb'),random=Math.random;Math.random=()=>roll;
    try{
      vargulBreakOrb(z,true);
      check((items[0]?.type??null)===want,'Orb drop threshold '+roll);
      const count=items.length;vargulBreakOrb(z,true);
      check(items.length===count,'Destroyed orb cannot drop twice');
      if(count)check(items[0].x>=camX+20&&items[0].x<=camX+VW-20&&items[0].y>=GTOP+8&&items[0].y<=GBOT-8,'Orb loot is reachable');
      setup();vargulEvent(e,{type:'orbs'});const [removed]=vargulHazards(e,'orb');vargulBreakOrb(removed);
      check(!items.length,'Orb removal without a kill grants no loot');
    }finally{Math.random=random;}
  }
  result.drops.push('Orb kill drops: potion25%, scroll15%, none60%; no duplicate or cleanup drops');
  {
    setup(0,false);e.x=camX+100;player.x=camX+220;player.inv=0;startPat(e,'hook');e.pt=500;
    const hook={type:'hook',owner:e,x:player.x,y:player.y,h:58,dir:1,dead:false};
    check(catchGorathHook(hook),'Hook catches player');
    inputDown('KeyJ');for(let i=0;i<4;i++)updateGorathGrab();
    check(player.grab?.presses===1,'Holding attack counts once');inputUp('KeyJ');
    for(const key of ['ArrowLeft','ArrowRight']){inputDown(key);updateGorathGrab();inputUp(key);}
    check(player.st==='grabbed'&&player.grab.presses===3,'Three presses do not escape');
    inputDown('KeyJ');updateGorathGrab();inputUp('KeyJ');
    check(player.st==='free'&&!player.grab&&hook.dead&&e.gr===40,'Fourth press escapes');
  }
  // Real damage must arrive at all four arena corners from either side, including
  // a nonzero camera origin; the passed interior and airborne player stay safe.
  for(const origin of [24,VW/2,VW-24])for(const px of [1,VW-1])for(const py of [GTOP+1,GBOT-1]){
    setup();player.x=camX+px;player.y=py;player.z=0;player.inv=0;
    const z=spawnVargul(e,'ice_wave',camX+origin,420,0,{hit:false});let at=-1;
    for(let t=0;t<z.waveTicks;t++){z.age=t*MS;const hp=player.hp;updateVargulHazard(z);if(player.hp<hp){at=t;break;}}
    check(at>=0,'Wave reaches corner '+[origin,px,py]);result.waves.push({origin,px,py,at});
    const hp=player.hp;updateVargulHazard(z);check(player.hp===hp,'No repeat wave damage');
    z.hit=false;player.inv=0;player.z=80;updateVargulHazard(z);check(player.hp===hp,'Jump clears traveling wave');
    player.z=0;z.hit=false;z.age=(z.waveTicks-1)*MS;player.x=z.x;player.y=z.y;updateVargulHazard(z);check(player.hp===hp,'Passed center is safe');
    z.age=z.waveTicks*MS;updateVargulHazard(z);check(z.dead,'Wave expires');
  }
  for(const [roll,want] of [[0,'potion'],[.24999,'potion'],[.25,'scroll'],[.39999,'scroll'],[.4,null],[.999,null]]){
    setup(4);const f=e.sov.fists[0],random=Math.random;Math.random=()=>roll;
    try{sovDamageFist(e,f,999,false);const item=items[0];check((item?.type??null)===want,'Drop threshold '+roll);
      const count=items.length;sovBreakFist(e,f);check(items.length===count,'Broken fist cannot reroll');
      if(item)check(item.x>=camX&&item.x<=camX+VW&&item.y>=GTOP&&item.y<=GBOT,'Loot stays reachable');
      sovRise(e,f);f.st='home';sovDamageFist(e,f,999,false);check(items.length===count+(want?1:0),'Rebuilt fist can drop again');
      result.drops.push({roll,type:want});
    }finally{Math.random=random;}
  }
  setup(4);practice=true;const f=e.sov.fists[0];sovDamageFist(e,f,999,false);check(!items.length&&f.hp===180,'Practice grants no loot');practice=false;
  window.combatUpdateShot=(kind,p2=true,face=1)=>{
    setup(kind==='beam'||kind==='drops'?4:3,p2,face);
    if(kind==='beam'){
      e.x=camX+(face>0?VW*.3:VW*.7);player.x=e.x+face*160;
      const s=sovData(e);sovStartJob(e,s,'beam');for(let i=0;i<42;i++){tick++;updateSovereignState(e);runSovereignPattern(e);}e.face=face;
    }else if(kind==='drops'){
      const random=Math.random;try{Math.random=()=>.1;sovDamageFist(e,e.sov.fists[0],999,false);Math.random=()=>.3;sovDamageFist(e,e.sov.fists[1],999,false);}finally{Math.random=random;}
    }else if(kind==='wave'){
      for(let i=0;i<3;i++){const z=spawnVargul(e,'ice_wave',camX+VW*.3,420,0,{hit:false});z.age=(90-i*24)*MS;}
    }else{
      const z=spawnVargul(e,'cross',camX+VW*.55,420,0,{wait:60,active:18});
      z.boom=kind!=='cross-warning';z.age=(kind==='cross-warning'?30:kind==='cross-early'?61:kind==='cross-late'?74:66)*MS;
    }
    shake=flashT=hitStop=0;render();
  };
  return result;
}
