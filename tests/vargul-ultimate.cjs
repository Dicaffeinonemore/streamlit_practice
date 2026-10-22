// $env:VARGUL_ULTIMATE_SUITE='1'; node tests/regression.cjs
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
module.exports=async({evaluate,call,errors,root})=>{
  const out=path.join(root,'artifacts/combat-update-2026-10-22/ultimate');fs.mkdirSync(out,{recursive:true});
  await evaluate('requestAnimationFrame=()=>0;AUDIO.enable(false);beginGame();showScreen(null);VARGUL_READY');
  const result=await evaluate(`(${trial.toString()})()`);
  for(const [name,age] of [['rise',39],['dive',138],['impact',143],['spear-planted',161],['ice-wave',180],['last-wave',220],['recovery',241]]){
    await evaluate(`ultimateSlamShot(${age})`);
    const shot=await call('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,name+'.png'),Buffer.from(shot.data,'base64'));
  }
  assert.deepEqual(errors,[],'No console errors / browser exceptions');result.consoleErrors=errors;
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(result,null,2));
  console.log('PASS Vargul spear impact / planted pose / three expanding waves / jump /90-tick recovery');
};
function trial(){
  const check=(v,m)=>{if(!v)throw Error(m);},u=VARGUL_RULES.ultimate,result={trace:[],radii:[],hits:[],jump:[]};let e;
  function setup({px=220,bx=430}={}){
    clearInput();practice=false;player=newPlayer();startStage(3);scene='play';showScreen(null);camX=lockAt=0;camLock=true;
    waveIdx=stage.waves.length;arena=null;barrels=[];hazards=[];items=[];texts=[];parts=[];impacts=[];bursts=[];ghosts=[];bolts=[];
    hitStop=shake=flashT=slowT=clearT=0;player.x=px;player.y=420;player.inv=999999;
    e=mkEnemy('boss4',bx,420);e.p2shown=true;e.hp=e.max=2500;e.training=true;enemies=[e];return e;
  }
  function step(){e.atkCd=99999;update();}
  setup();e.training=false;startPat(e,'ultimate');let locked=null;
  for(let i=0;i<600;i++){
    if(i===90)player.x=260;
    if(i===110)player.x=340;
    step();const mark=e.vargul.ultimate;
    if(i===105)locked=[mark.x,mark.y];
    if(i===134)check(mark.x===locked[0]&&mark.y===locked[1],'Landing mark stops tracking');
    const row={elapsed:i,label:e.vargul.current?.label,x:e.x,y:e.y,height:e.z,hidden:!!vargulPose(e).hidden,invulnerable:!!e.invuln,
      clip:vargulPose(e).clip,drawing:vargulPose(e).drawing,
      wave:vargulHazards(e,'ice_wave').map(z=>({pulse:z.pulse,age:z.age/MS,life:z.waveTicks,reach:z.waveRadius,...vargulIceWaveBand(Math.floor(z.age/MS+1e-6),z)}))};
    result.trace.push(row);
    if(i===45){const hp=e.hp;damageEnemy(e,100,true,0,true);check(e.hp===hp,'Airborne immunity');}
    if(i===137){const hp=e.hp;damageEnemy(e,100,true,0,true);check(e.hp===hp,'Visible dive remains immune');}
    if(i===160)check(!e.invuln,'Recovery is vulnerable');
  }
  const rise=result.trace.filter(r=>r.label==='leap'),fall=result.trace.filter(r=>r.label==='fall');
  check(rise.length===19&&rise.every((r,i)=>i===0||r.height>rise[i-1].height),'Rise moves upward');
  check(fall.length===6&&fall.every((r,i)=>!r.hidden&&r.invulnerable&&(i===0||r.height<fall[i-1].height)),'Six visible invulnerable dive ticks');
  const impact=result.trace.find(r=>r.elapsed===141);check(impact.height===0&&impact.x===locked[0]&&impact.y===locked[1],'Body slams locked position');
  check(impact.clip==='p2_cast'&&impact.drawing===8,'Spear planted into floor at impact');
  check(result.trace.filter(r=>r.elapsed>=141&&r.elapsed<250).every(r=>r.clip==='p2_cast'&&r.drawing>=8&&r.drawing<=11),'Spear stays planted through wave emission');
  check(result.trace.filter(r=>r.label==='kneel').length===90,'Full90-tick recovery');
  check(result.trace.find(r=>r.elapsed===149).wave.length===1,'Wave begins eight ticks after impact');
  check(!result.trace.find(r=>r.elapsed===148).wave.length,'No premature wave');
  result.radii=result.trace.flatMap(r=>r.wave.map(w=>({pulse:w.pulse,elapsed:r.elapsed,radius:w.radius,inner:w.inner,outer:w.outer,life:w.life,reach:w.reach})));
  result.waveStarts=[];
  for(let pulse=0;pulse<u.waveCount;pulse++){
    const rows=result.radii.filter(r=>r.pulse===pulse);result.waveStarts.push(rows[0]?.elapsed);
    check(rows.length===rows[0].life&&rows.every((r,i)=>i===0||r.radius>rows[i-1].radius),'Each wave travels until the arena edge');
    check(rows[0].elapsed===149+pulse*24&&rows.at(-1).radius>=rows[0].reach,'Staggered wave start/full arena radius');
  }
  check(result.trace.filter(r=>r.wave.length===2).length>0,'Concentric waves overlap visually');
  check(!result.trace.at(-1).wave.length,'Last wave expires after reaching arena edges');
  function waveTrial(distance,{height=0,jumpOffset=null}={}){
    setup({px:300+distance});player.inv=0;player.hp=player.max=1000000;
    const z=spawnVargul(e,'ice_wave',300,420,0,{hit:false});let firstHit=null;
    for(let t=0;t<=z.waveTicks;t++){
      if(jumpOffset===null){player.z=height;player.vz=0;}
      else if(t===jumpOffset){inputDown('Space');inputUp('Space');}
      const before=player.hp;step();if(player.hp<before&&firstHit===null)firstHit=t;
    }
    return {distance,height,jumpOffset,damage:1000000-player.hp,firstHit,dead:!!z.dead};
  }
  setup({px:300});player.inv=0;spawnVargul(e,'ultimate',300,420,0,{stage:'impact',impactAge:0,waveStarted:false});step();
  check(player.hp===70,'Center damage30');result.centerDamage=30;
  for(const distance of [25,60,95,120]){
    const r=waveTrial(distance);result.hits.push(r);check(r.damage===13,'Traveling wave also hits beyond the old radius');
  }
  check(result.hits[0].firstHit<result.hits[1].firstHit&&result.hits[1].firstHit<result.hits[2].firstHit,'Near positions hit before far positions');
  // Use a real buffered jump, without overriding the jump height.
  for(let offset=0;offset<=26;offset++)result.jump.push(waveTrial(80,{jumpOffset:offset}));
  check(result.jump.some(r=>r.damage===0)&&result.jump.some(r=>r.damage===13),'Real jump can avoid advancing wave');
  setup();spawnVargul(e,'ice_wave',300,420,0,{hit:false});damageEnemy(e,99999,true,0,true);
  check(!vargulHazards(e,'ice_wave').length,'Boss death clears ice wave');
  // Hitbox exists for all eight slam ticks, even after removing invulnerability between test probes.
  setup();spawnVargul(e,'ultimate',300,420,0,{stage:'impact',impactAge:0,waveStarted:false});
  const active=[];
  for(let t=0;t<9;t++){
    const z=vargulHazards(e,'ultimate')[0];player.x=300;player.y=420;player.z=0;player.st='free';player.inv=0;player.hp=100;z.hit=false;hitStop=0;
    step();if(100-player.hp===30)active.push(t);
  }
  check(active.join(',')==='0,1,2,3,4,5,6,7','Exact eight center collision ticks');result.centerActiveTicks=active;
  setup();e.training=false;startPat(e,'ultimate');player.inv=0;player.hp=player.max=1000000;
  let maxJump=0;
  let jumps=0;
  for(let t=0;t<=250;t++){
    keys.ArrowRight=t>=105&&player.x<285;
    const nearing=vargulHazards(e,'ice_wave').some(z=>{
      const band=vargulIceWaveBand(Math.floor(z.age/MS+1e-6),z),distance=Math.hypot(player.x-z.x,(player.y-z.y)*u.outerX/u.outerY);
      return distance>band.inner&&distance-band.radius<=18;
    });
    if(nearing&&player.z===0&&player.st==='free'){inputDown('Space');inputUp('Space');jumps++;}
    step();maxJump=Math.max(maxJump,player.z);
  }
  keys.ArrowRight=false;result.fullDodge={damage:1000000-player.hp,maxJump,jumps,player:[player.x,player.y],boss:[e.x,e.y]};
  check(result.fullDodge.damage===0&&maxJump>u.outerHeight&&jumps>=2,'Full slam dodge '+JSON.stringify(result.fullDodge));
  setup();e.training=false;startPat(e,'ultimate');for(let i=0;i<=160;i++)step();
  const hp=e.hp;damageEnemy(e,1,false,0,true);check(e.hp===hp-1,'Actual damage allowed during recovery');
  window.ultimateSlamShot=age=>{setup();e.training=false;startPat(e,'ultimate');for(let i=0;i<=age;i++)step();shake=flashT=hitStop=0;render();};
  return result;
}
