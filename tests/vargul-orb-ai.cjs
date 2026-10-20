// $env:VARGUL_ORB_AI='1'; node tests/regression.cjs
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
module.exports=async({evaluate,call,errors,root})=>{
  const out=path.join(root,'artifacts/vargul-1.36/orb-ai');fs.mkdirSync(out,{recursive:true});
  const baseline=JSON.parse(fs.readFileSync(path.join(root,'artifacts/vargul-1.36/stage3/art-baseline.json'),'utf8'));
  for(const [file,entry] of Object.entries(baseline))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex'),entry.sha256);
  await evaluate('requestAnimationFrame=()=>0;AUDIO.enable(false);beginGame();showScreen(null);VARGUL_READY');
  const result=await evaluate(`(${trial.toString()})()`);
  await evaluate('shake=flashT=hitStop=0;render()');
  const shot=await call('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,'orb-ai.png'),Buffer.from(shot.data,'base64'));
  assert.deepEqual(errors,[],'No console errors / browser exceptions');
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({...result,artUnchanged:true,consoleErrors:errors},null,2));
  console.log('PASS Vargul independent orb AI / health / all attack sources / summon lock / lifespan / cleanup');
};
function trial(){
  const check=(c,m)=>{if(!c)throw Error(m);},result={checks:[],shots:[],damage:[]};let e;
  function setup(p2=false){
    clearInput();practice=false;player=newPlayer();startStage(3);scene='play';showScreen(null);camX=lockAt=0;camLock=true;
    waveIdx=stage.waves.length;arena=null;barrels=[];items=[];hazards=[];parts=[];texts=[];bolts=[];impacts=[];bursts=[];ghosts=[];
    player.x=220;player.y=420;player.inv=999999;hitStop=shake=flashT=slowT=clearT=0;vargulRepeat=null;
    e=mkEnemy('boss4',450,420);e.training=true;e.p2shown=p2;if(p2)e.hp=e.max=2500;enemies=[e];vargulEvent(e,{type:'orbs'});return vargulHazards(e,'orb');
  }
  function step(n){for(let i=0;i<n;i++)update();}
  const orbs=setup();check(orbs.length===2&&orbs.every(z=>z.hp===30&&z.maxHp===30),'Two30HP summons');
  const start=orbs.map(z=>[z.x,z.y]);step(60);
  check(orbs.some((z,i)=>Math.hypot(z.x-start[i][0],z.y-start[i][1])>10),'AI moves independently');
  const before=orbs.map(z=>[z.x,z.y]);player.x+=180;step(1);
  check(orbs.every((z,i)=>Math.abs(z.x-before[i][0])<=.901&&Math.abs(z.y-before[i][1])<=.551),'No player-relative teleport/orbit');
  step(1200);check(vargulHazards(e,'orb').length===2,'No600-tick expiry');
  check(orbs.every(z=>z.x>=24&&z.x<=VW-24&&z.y>=GTOP+14&&z.y<=GBOT-12),'Arena bounded');
  result.checks.push('Independent movement, no attachment, alive beyond1200ticks, arena bounds');
  for(const p2 of [false,true]){
    const pair=setup(p2),shots=[];const native=spawnVargul;
    spawnVargul=function(owner,kind,...args){const z=native(owner,kind,...args);if(kind==='shard')shots.push({caster:z.casterIndex,at:tick});return z;};
    try{step(500);}finally{spawnVargul=native;}
    check(shots.some(z=>z.caster===0)&&shots.some(z=>z.caster===1),'Both summons fire');
    result.shots.push({phase:p2?2:1,count:shots.length,casters:[...new Set(shots.map(z=>z.caster))],shots});
    for(const z of pair){z.flash=0;z.shotPending=false;z.shotCooldown=0;}
    player.st='down';player.t=0;const native2=spawnVargul;let downShots=0;
    spawnVargul=function(owner,kind,...args){if(kind==='shard')downShots++;return native2(owner,kind,...args);};
    try{step(30);}finally{spawnVargul=native2;}check(!downShots,'No shooting downed player');
    setup(p2);player.inv=0;player.hp=player.max=1000000;step(500);
    const received=1000000-player.hp,expected=p2?10:8;
    check(received>0&&e.vargul.stats.hits.every(z=>z.damage===expected),'Actual aimed projectiles hit for phase damage');
    result.shots.at(-1).actualPlayerDamage=received;
  }
  function target(){const pair=setup(),z=pair[0];z.x=player.x+30;z.y=player.y;z.h=44;player.face=1;player.hitSet=new Set();return z;}
  {const z=target();playerStrike(ATK.c1);check(z.hp===20,'Normal damage10');playerStrike(ATK.c1);check(z.hp===20,'Same swing no duplicate');
    player.hitSet=new Set();playerStrike(ATK.c1);check(z.hp===20,'10-tick hit invulnerability');z.inv=0;player.hitSet=new Set();playerStrike(ATK.c1);check(z.hp===10,'Second normal damage');
    z.inv=0;player.hitSet=new Set();const gr=e.gr;playerStrike(ATK.c1);check(z.dead&&e.gr===gr+20,'Third normal breaks, groggy20');result.damage.push({source:'normal',perHit:10,hitsToBreak:3});}
  {const z=target();player.buff=100;playerStrike(ATK.c1);check(z.hp===15,'Buff damage15');result.damage.push({source:'buff_normal',damage:15});}
  {const z=target();skillStrike('orb-test',18,80,8,false,1);check(z.hp===12,'Skill actual18');result.damage.push({source:'skill',damage:18});}
  {const z=target();player.spX=player.x;player.spY=player.y;specialHit(false,0);check(z.hp===Math.max(0,30-SPECIAL.slash),'Special actual damage');result.damage.push({source:'special',damage:SPECIAL.slash});}
  {const z=target();fireBolts();check(z.hp===Math.max(0,30-MAGIC.damage),'Lightning actual damage');result.damage.push({source:'lightning',damage:MAGIC.damage});}
  {const z=target();z.x=player.x+44;launchWave();updHazards();check(z.hp===22,'Wave actual8');result.damage.push({source:'wave',damage:8});}
  {const z=target();hazards.push({type:'pwave',red:true,x:z.x,y:z.y,h:44,dir:1,travel:0,damage:18,hits:new Set(),age:0});
    updHazards();check(z.hp===12,'Red wave actual18');result.damage.push({source:'red_wave',damage:18});}
  {const pair=setup();strikeVargulOrbs(0,0,new Set(),{global:true,damage:30});check(pair.every(z=>z.dead),'HP attacks destroy both');
    check(e.vargul.cooldowns.orb===720,'Cooldown after last destruction');}
  {const pair=setup();strikeVargulOrbs(0,0,new Set([pair[1]]),{global:true,damage:30});check(pair[0].dead&&!pair[1].dead,'One remains');
    const a=e.vargul;a.cooldowns={dash:99999,sword:99999,cross:99999,taunt:99999};
    for(let i=0;i<20;i++)check(pickVargulPattern(e,270,0)!=='orb','AI cannot summon while one survives');
    vargulEvent(e,{type:'orbs'});check(vargulHazards(e,'orb').length===1,'Direct event also guards duplicate spawn');
    strikeVargulOrbs(0,0,new Set(),{global:true,damage:30});check(a.cooldowns.orb===720,'Last orb starts cooldown');
    hitStop=0;step(719);check(a.cooldowns.orb===1,'Full cooldown honored');step(1);check(!a.cooldowns.orb,'Cooldown expires');
    check(pickVargulPattern(e,270,0)==='orb','AI can summon again');vargulEvent(e,{type:'orbs'});check(vargulHazards(e,'orb').length===2,'New pair');}
  result.checks.push('Independent shooters P1/P2, no shots while down, real damage sources, hit deduplication/invulnerability, no resummon with survivor,720tick cooldown');
  {setup();e.hp=1;damageEnemy(e,1,false,0,true);check(!vargulHazards(e,'orb').length,'Phase transition cleanup');}
  {setup(true);damageEnemy(e,99999,true,0,true);check(!vargulHazards(e,'orb').length,'Boss death cleanup');}
  result.checks.push('Owner phase transition / death cleanup');
  setup(true);step(155);const z=vargulHazards(e,'orb')[0];z.hp=18;z.flash=10;
  result.finalOrbs=vargulHazards(e,'orb').map(z=>({x:z.x,y:z.y,h:z.h,hp:z.hp,maxHp:z.maxHp,ai:z.ai}));
  return result;
}
