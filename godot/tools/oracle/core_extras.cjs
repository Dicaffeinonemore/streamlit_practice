const {fs,path,canonical}=require('../extract/common.cjs');
module.exports=async function(browser,out){
  const street=await browser.evaluate(`(()=>{
    Math.random=()=>.5;UX.saveCheckpoint=()=>{};player=newPlayer(0,'barel');startStage(0);scene='play';
    updStage1=__sourceUpdStage1;stage1Finished=__sourceStage1Finished;
    tick=0;nextId=1;enemies=[];barrels=[];items=[];hazards=[];hitStop=0;shake=0;flashT=0;clearT=0;
    stat.ticks=stat.damage=stat.deaths=stat.kills=0;chain.n=chain.t=chain.max=0;clearInput();
    player.inv=10000;inputDown('KeyD');const frames=[];
    for(let frame=0;frame<600;frame++){
      if([200,440,490].includes(frame))for(const e of enemies){e.st='dead';e.t=0;e.mv=null;e.vx=e.vz=0;e.hp=0;}
      const processed=update();if(processed)for(const k in pressed){pressed[k]-=MS;if(pressed[k]<=0)delete pressed[k];}
      frames.push({camX,event:S1.ev,locked:camLock,lockId:S1.lockN,queue:S1.lock?.queue.map(q=>[q.id,q.from])||[],secTicks:S1.secT,
        player:{x:player.x,y:player.y,st:player.st,inv:player.inv},
        enemies:enemies.map(e=>({id:e.id,species:e.s1,x:e.x,y:e.y,st:e.st,t:e.t,invulnerable:e.invuln,alpha:e.alpha,lockId:e.lockId,hp:e.hp}))});
      if(S1.fade)break; // Phase 2 stops at the boundary before entering the market.
    }return frames;
  })()`);
  const boundaries=await browser.evaluate(`(()=>{
    const e={x:100,y:430,z:10,face:1},z=feelZone(e,'rect',-8,120,20,'rel',55),points=[];
    for(const face of [1,-1])for(const dx of [-8.000001,-8,-7.999999,0,119.999999,120,120.000001])for(const dy of [0,19.999999,20])for(const height of [10,64.999999,65]){
      z.face=face;const target={x:e.x+face*dx,y:e.y+dy,z:height};points.push({face,dx,dy,height,inside:zoneContains(z,target)});
    }return points;
  })()`);
  const clocks=await browser.evaluate(`(()=>{
    update=()=>{tick++;return true};render=()=>{};scheduleLoop=()=>{};waitingAssets=false;const tests=[];
    for(const hz of [30,60,144]){
      last=0;acc=0;tick=0;slowT=1100;scene='play';let timestamp=0;const frames=[];
      for(let i=0;i<hz*3;i++){
        const paused=i>=18&&i<22;scene=paused?'pause':'play';renderRevision++;timestamp+=(i===120?300:1000/hz);
        const real=Math.min(100,timestamp-last);loop(timestamp);
        frames.push({real,paused,ticks:tick,accumulator:acc,slowT});
      }tests.push({hz,frames});
    }return tests;
  })()`);
  for(const test of clocks)for(const frame of test.frames){const bytes=Buffer.alloc(8);bytes.writeDoubleLE(frame.real);frame.real_bits=bytes.toString('hex');}
  fs.writeFileSync(path.join(out,'core_extras.json'),JSON.stringify(canonical({street,boundaries,clocks}))+'\n');
  console.log(`EXTRAS: ${street.length} street steps, ${boundaries.length} geometry boundaries, ${clocks.reduce((n,t)=>n+t.frames.length,0)} clock frames`);
};
