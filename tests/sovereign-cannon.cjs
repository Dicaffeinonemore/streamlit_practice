const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
module.exports=async({evaluate,call,errors,root})=>{
  await evaluate(`(async()=>{requestAnimationFrame=()=>0;AUDIO.enable(false);beginGame();showScreen(null);await SOV_CANNON_GROUP.ready;await Promise.all(SOV_SHEETS.map(i=>i.decode()));})()`);
  const result=await evaluate(`(${trial.toString()})()`);
  assert.equal(result.name,'적월마광포');assert.equal(result.cooldown,900);
  assert.equal(result.selected,'ultimate');assert.equal(result.phase1Available,false);
  assert(result.count>=10&&result.count<=13);assert(result.maxHands<=3);
  assert(result.firstDangerMs>=1500&&result.firstDangerMs<=2000);
  assert.equal(result.observedCount,result.count);
  assert(result.allInside&&result.gaps&&result.noOverlap);
  assert.equal(result.initialNoHit,0);assert.equal(result.activeHit,1);assert.equal(result.onceOnly,1);assert.equal(result.afterActive,1);
  assert.equal(result.wrongSide,0);assert.equal(result.ended,true);assert.equal(result.cancelled,true);
  assert.equal(result.realDamage,30);assert.equal(result.positionsValid,true);
  // Each sequential hand can round its millisecond threshold up by one 60Hz tick.
  assert(result.elapsed>=result.expectedElapsed-35&&result.elapsed<=result.expectedElapsed+result.count*1000/60+35);
  assert.deepEqual(errors,[]);
  await evaluate(`cannonSetup();sovStartJob(enemies[0],enemies[0].sov,'ultimate');
    const j=enemies[0].sov.jobs[0];j.spawned=1;j.remaining=0;j.hands=[{x:camX+195,y:360,dir:1,ageMs:SOV_R.ultimate.fadeMs+SOV_R.ultimate.telegraphMs+SOV_R.ultimate.chargedMs+700,fired:true,hit:false}];
    SOV_R.ultimate.debug=true;render();`);
  const shot=await call('Page.captureScreenshot',{format:'png'});
  const out=path.join(root,'artifacts/sovereign-cannon');fs.mkdirSync(out,{recursive:true});
  fs.writeFileSync(path.join(out,'debug.png'),Buffer.from(shot.data,'base64'));
  console.log('PASS Sovereign cannon: scheduler, positions, timing, damage, cleanup, sprites');
};
function trial(){
  window.cannonSetup=()=>{
    clearInput();practice=false;player=newPlayer(0,'barel');startStage(4);scene='play';showScreen(null);camX=0;camLock=true;
    stage={...stage,waves:[]};barrels=[];hazards=[];parts=[];items=[];texts=[];impacts=[];bursts=[];ghosts=[];bolts=[];
    hitStop=shake=0;player.x=320;player.y=450;player.z=0;player.inv=99999;
    const e=mkEnemy('boss5',500,420);e.p2shown=true;e.st='chase';e.hp=e.max*SOV_R.ultimateAt*.9;enemies=[e];
    const s=sovData(e);for(const f of s.fists){const [x,y,h]=sovHome(e,f,s);Object.assign(f,{x,y,h,st:'home'});}return e;
  };
  const e=cannonSetup(),s=e.sov,C=SOV_R.ultimate,fire=C.fadeMs+C.telegraphMs+C.chargedMs;
  const selected=sovPick(e,s,100),phase1Available=(()=>{e.p2shown=false;const x=sovAvailable(e,s,'ultimate');e.p2shown=true;return x})();
  sovStartJob(e,s,'ultimate');const job=s.jobs[0],count=job.remaining;let maxHands=0,allInside=true,gaps=true,noOverlap=true,last=null,observed=new Set(),firstDangerMs=null;
  while(!job.done&&job.t<2400){
    sovJobTick(e,s,job);job.t++;job.st++;maxHands=Math.max(maxHands,job.hands.length);
    if(job.danger&&firstDangerMs===null)firstDangerMs=job.elapsedMs;
    for(const h of job.hands)if(!observed.has(h)){
      observed.add(h);if(last!==null&&Math.abs(h.y-last)<C.minYGap)gaps=false;last=h.y;
      const left=h.x+(h.dir===1?-C.handOrigin[0]*C.handScale:-(362-C.handOrigin[0])*C.handScale);
      const right=h.x+(h.dir===1?(362-C.handOrigin[0])*C.handScale:C.handOrigin[0]*C.handScale);
      const top=h.y-C.handOrigin[1]*C.handScale,bottom=h.y+(217.2-C.handOrigin[1])*C.handScale;
      allInside&&=left>=camX+C.margin-.001&&right<=camX+VW-C.margin+.001&&top>=OY+C.margin-.001&&bottom<=OY+VH-C.margin+.001;
      noOverlap&&=!(right>player.x-playerBodyHalfWidth()-12&&left<player.x+playerBodyHalfWidth()+12&&bottom>player.y-player.z-playerBodyHeight()-12&&top<player.y-player.z+12);
    }
  }
  const elapsed=job.elapsedMs,expectedElapsed=count*fire+20000/C.laserFps+C.fadeMs;
  const ended=job.done&&!s.jobs.includes(job)&&job.fists.every(f=>f.st==='return');
  let calls=0;const oldHurt=hurtPlayer;hurtPlayer=()=>{calls++;return true;};
  const damageTest=(age,dir=1,x=200)=>{const h={x,y:400,dir,ageMs:age,fired:true,hit:false};const j={hands:[h],spawned:1,remaining:1,elapsedMs:0};player.x=300;player.y=440;player.z=0;sovCannonTick(e,s,j,MS);return {h,j};};
  const test=damageTest(fire+100);const initialNoHit=calls;
  test.h.ageMs=fire+8000/C.laserFps;sovCannonTick(e,s,test.j,MS);const activeHit=calls;
  sovCannonTick(e,s,test.j,MS);const onceOnly=calls;
  test.h.hit=false;test.h.ageMs=fire+16000/C.laserFps+1;sovCannonTick(e,s,test.j,MS);const afterActive=calls;
  calls=0;damageTest(fire+9000/C.laserFps,-1,200);const wrongSide=calls;hurtPlayer=oldHurt;
  cannonSetup();const realBoss=enemies[0],hp=player.hp;player.inv=0;player.x=300;player.y=440;
  const realHand={x:200,y:400,dir:1,ageMs:fire+8000/C.laserFps,fired:true,hit:false};
  sovCannonTick(realBoss,realBoss.sov,{hands:[realHand],spawned:1,remaining:1,elapsedMs:0},MS);
  const realDamage=hp-player.hp;
  let positionsValid=true;
  for(const groundY of [350,400,450,500])for(const jump of [0,60]){
    player.y=groundY;player.z=jump;player.x=320;const sample={spawned:0,lastY:null};
    for(let i=0;i<100;i++){
      const h=sovCannonPosition(sample),k=C.handScale,ox=C.handOrigin[0],oy=C.handOrigin[1];
      const l=h.x+(h.dir===1?-ox*k:-(362-ox)*k),r=h.x+(h.dir===1?(362-ox)*k:ox*k);
      const t=h.y-oy*k,b=h.y+(217.2-oy)*k;
      const overlap=r>player.x-playerBodyHalfWidth()-12&&l<player.x+playerBodyHalfWidth()+12&&b>player.y-player.z-playerBodyHeight()-12&&t<player.y-player.z+12;
      if(overlap||(sample.lastY!==null&&Math.abs(h.y-sample.lastY)<C.minYGap))positionsValid=false;
      sample.lastY=h.y;sample.spawned++;
    }
  }
  const e2=cannonSetup(),s2=e2.sov;sovStartJob(e2,s2,'ultimate');sovJobTick(e2,s2,s2.jobs[0]);sovGround(e2,s2);
  const cancelled=s2.jobs.length===0&&s2.fists.every(f=>f.st==='dropped');
  return {name:SOV_R.names.ultimate,cooldown:SOV_R.cooldowns.ultimate,selected,phase1Available,count,maxHands,allInside,gaps,noOverlap,
    initialNoHit,activeHit,onceOnly,afterActive,wrongSide,realDamage,positionsValid,ended,cancelled,elapsed,expectedElapsed,firstDangerMs,observedCount:observed.size};
}
