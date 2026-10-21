// $env:SOVEREIGN_MOTION_SUITE='1'; node tests/regression.cjs
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
module.exports=async({evaluate,call,errors,root})=>{
  const out=path.join(root,'artifacts/sovereign-motion');fs.mkdirSync(out,{recursive:true});
  await evaluate('requestAnimationFrame=()=>0;AUDIO.enable(false);beginGame();showScreen(null);Promise.all(SOV_SHEETS.map(im=>im.decode()))');
  const results=await evaluate(`(${setup.toString()})()`);
  fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify(results,null,2));
  const video=await evaluate(`new Promise(resolve=>{
    const stream=cv.captureStream(30),chunks=[];
    const recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp9',videoBitsPerSecond:6000000});
    recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
    recorder.onstop=async()=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.readAsDataURL(new Blob(chunks,{type:'video/webm'}));stream.getTracks().forEach(t=>t.stop());};
    let n=0;recorder.start();
    const timer=setInterval(()=>{
      if(n===330)motionSetup(true);
      for(let step=0;step<2;step++){tick++;player.inv=99999;updEnemy(enemies[0]);}render();
      ctx.save();ctx.fillStyle='rgba(10,8,22,.85)';ctx.fillRect(16,65,460,54);
      ctx.fillStyle='#f4d5ef';ctx.font='16px sans-serif';ctx.fillText('STAGE 5 / PHASE '+(n<330?'1':'2')+' / ATTACK GAP +1.5s',28,87);
      ctx.font='13px sans-serif';ctx.fillText('Movement afterimages / calmer floating gauntlets',28,108);ctx.restore();
      if(++n>=660){clearInterval(timer);recorder.stop();}
    },1000/30);
  })`);
  fs.writeFileSync(path.join(out,'stage5-motion.webm'),Buffer.from(video,'base64'));
  const shot=await call('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,'preview.png'),Buffer.from(shot.data,'base64'));
  assert.deepEqual(errors,[]);console.log('PASS Sovereign timing, all patterns in both phases, bounded fading trails; video saved');
};
function setup(){
  const check=(v,m)=>{if(!v)throw Error(m);};
  window.motionSetup=p2=>{
    clearInput();practice=false;player=newPlayer();startStage(4);scene='play';showScreen(null);camX=lockAt=0;camLock=true;
    waveIdx=stage.waves.length;arena=null;barrels=[];hazards=[];parts=[];items=[];texts=[];impacts=[];bursts=[];ghosts=[];bolts=[];
    hitStop=shake=flashT=slowT=clearT=0;player.x=170;player.y=420;player.inv=99999;
    const e=mkEnemy('boss5',440,420);e.p2shown=p2;e.st='chase';e.hp=e.max=SOV_R.hp[p2?1:0];e.atkCd=sovGap(e);enemies=[e];
    const s=sovData(e);for(const f of s.fists){const [x,y,h]=sovHome(e,f,s);Object.assign(f,{x,y,h,st:'home',hp:SOV_R.fistHp[p2?1:0],max:SOV_R.fistHp[p2?1:0]});}return e;
  };
  const result=[];
  for(const p2 of [false,true]){
    let e=motionSetup(p2);const [a,b]=SOV_R.gaps[p2?1:0];
    for(let i=0;i<200;i++){const gap=sovGap(e);check(gap>=a+90&&gap<=b+90,'Exactly 90 extra ticks');}
    const wait=e.atkCd;
    for(let i=0;i<wait-1;i++){updEnemy(e);check(!e.sov.jobs.length,'No early attack');}
    for(const id of SOVEREIGN_ATTACKS){
      if(!p2&&['ultimate','meteor'].includes(id))continue;
      e=motionSetup(p2);const s=e.sov;sovStartJob(e,s,id);const job=s.jobs[0];let count=0,maxGhosts=0;
      while(!job.done&&count++<1800){tick++;updateSovereignState(e);runSovereignPattern(e);if(count%60===0)render();for(const f of s.fists){maxGhosts=Math.max(maxGhosts,(f.afterimages||[]).length);check(Number.isFinite(f.x+f.y+f.h),'Finite fist position');}}
      check(job.done,'Pattern completes: '+id);check(maxGhosts<=SOV_R.afterimage.max,'Bounded trail memory');
      result.push({phase:p2?2:1,pattern:id,ticks:count,maxGhosts});
    }
  }
  const e=motionSetup(false),s=e.sov,f=s.fists[0];
  for(let i=0;i<12;i++){f.x+=9;s.now++;sovCaptureAfterimages(e,s);}
  check(f.afterimages.length>0,'Movement leaves ghosts');
  for(let i=0;i<24;i++){s.now++;sovCaptureAfterimages(e,s);}
  check(f.afterimages.length===0,'Stationary ghosts expire');motionSetup(false);return result;
}
