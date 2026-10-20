// $env:BOSS_GROGGY_SUITE='1'; node tests/regression.cjs
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
module.exports=async({evaluate,call,errors,root})=>{
  const out=path.join(root,'artifacts/boss-groggy-standing');fs.mkdirSync(out,{recursive:true});
  await evaluate('requestAnimationFrame=()=>0;AUDIO.enable(false);beginGame();showScreen(null);Promise.all([AURELION_READY,VARGUL_READY,GORATH_ATLAS.decode(),MORGRA_ATLAS.decode(),NAMED_ATLAS.decode()])');
  const result=await evaluate(`(${trial.toString()})()`);
  for(const type of ['boss1','boss2','boss3','boss4','boss5']){
    await evaluate(`bossGroggyShot('${type}')`);
    const shot=await call('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,type+'-standing.png'),Buffer.from(shot.data,'base64'));
  }
  assert.deepEqual(errors,[],'No console errors / browser exceptions');result.consoleErrors=errors;
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(result,null,2));
  console.log('PASS All five bosses / both phases: standing groggy, foot-anchored sway,300ticks, damage x1.5, threshold down preserved');
};
function trial(){
  const check=(v,m)=>{if(!v)throw Error(m);},result={cases:[],thresholds:[]};let e;
  function setup(type,p2){
    clearInput();practice=false;player=newPlayer();startStage(Number(type.at(-1))-1);scene='play';showScreen(null);camX=lockAt=0;camLock=true;
    waveIdx=stage.waves.length;arena=null;barrels=[];hazards=[];parts=[];items=[];texts=[];impacts=[];bursts=[];ghosts=[];bolts=[];
    hitStop=shake=flashT=slowT=clearT=0;chain.n=chain.t=0;player.x=180;player.y=420;player.inv=999999;
    e=mkEnemy(type,400,420);e.p2shown=p2;e.hp=e.max=5000;e.nextKd=0;e.gr=e.grMax-1;enemies=[e];return e;
  }
  function assertPose(type,p2){
    if(type==='boss1')check(gorathEnemyFrame(e)===gorathFrame('hurt',.1),'Gorath standing hurt');
    if(type==='boss2'){
      const native=paintMorgra;let frame;
      paintMorgra=function(f,...args){frame=f;return native(f,...args);};
      try{drawMorgra(e);}finally{paintMorgra=native;}
      check(frame===morgraFrame(p2?'p2_hurt':'hurt',0),'Morgra standing hurt');
    }
    if(type==='boss3')check(aurelionPose(e).id==='hurt','Aurelion no fallen stun');
    if(type==='boss4')check(vargulPose(e).clip===(p2?'p2_hurt':'p1_hurt')&&vargulPose(e).drawing===1,'Vargul standing hurt');
    if(type==='boss5')check(namedEnemyFrame(e)===(p2?namedAt('boss5','awaken',1):namedClip('boss5','idle',0)),'Emperor standing phase form');
  }
  for(const type of ['boss1','boss2','boss3','boss4','boss5'])for(const p2 of [false,true]){
    setup(type,p2);damageEnemy(e,10,false,0,true);
    check(e.st==='stun'&&e.t===0&&e.z===0,'Real groggy threshold enters standing stun');assertPose(type,p2);
    const angle0=bossGroggySway(e),x=e.x,y=e.y,face=e.face;
    const nativeRotate=ctx.rotate,nativeSave=ctx.save,nativeRestore=ctx.restore;let angles=[],balance=0;
    ctx.rotate=function(a){angles.push(a);return nativeRotate.call(this,a);};
    ctx.save=function(){balance++;return nativeSave.call(this);};ctx.restore=function(){balance--;return nativeRestore.call(this);};
    try{drawEnemy(e);e.t=12;drawEnemy(e);}finally{ctx.rotate=nativeRotate;ctx.save=nativeSave;ctx.restore=nativeRestore;}
    check(angles.some(a=>Math.abs(a-angle0)<1e-10)&&angles.some(a=>Math.abs(a-angle0)>.01),'Sway is animated for every renderer');
    check(balance===0&&e.x===x&&e.y===y&&e.z===0&&e.face===face,'Rendering preserves world position and canvas stack');
    e.t=0;chain.n=0;const hp=e.hp;damageEnemy(e,10,false);check(hp-e.hp===15&&e.st==='stun','Groggy x1.5 and state preserved');
    let ticks=0;
    while(e.st==='stun'&&ticks<350){updEnemy(e);ticks++;check(!e.invuln,'Groggy always vulnerable');}
    check(ticks===GROGGY_TICKS&&ticks===300&&e.st==='rec'&&e.gr===0,'Existing300-tick groggy recovery');
    result.cases.push({type,phase:p2?2:1,duration:ticks,damage:15,swayAngles:angles,standing:true});
    // Actual health threshold still uses down rather than the groggy animation.
    setup(type,p2);e.gr=0;e.nextKd=e.max*.75;e.hp=e.nextKd+1;damageEnemy(e,2,false,0,true);
    check(e.st==='down','Health threshold down unchanged');result.thresholds.push({type,phase:p2?2:1,state:e.st});
  }
  // Preserve the legacy runtime switches: their fallback boss sprites must also stand.
  for(const type of ['boss1','boss2','boss3','boss4','boss5']){
    setup(type,false);e.st='stun';const frame=bossHD(e);check(!/death|knockdown/.test(frame),'Legacy bossHD no death/fallen groggy pose');
    check(HD[e.d.sprite]?.N[frame]!==undefined,'Legacy standing frame exists');
  }
  window.bossGroggyShot=type=>{
    setup(type,false);const first=e;first.x=220;first.st='stun';first.t=80;first.gr=first.grMax;
    const second=mkEnemy(type,470,420);second.p2shown=true;second.st='stun';second.t=105;second.gr=second.grMax;
    second.hp=second.max=5000;enemies=[first,second];player.x=55;player.inv=0;tick=80;hitStop=shake=flashT=0;render();
  };
  return result;
}
