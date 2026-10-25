const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
module.exports=async({evaluate,call,errors,root})=>{
  const out=path.join(root,'artifacts/stage-wipe');fs.mkdirSync(out,{recursive:true});
  await evaluate('requestAnimationFrame=()=>0;AUDIO.enable(false);beginGame();showScreen(null);UX.options.lowFx=false');
  const result=await evaluate(`(()=>{
    const check=(v,m)=>{if(!v)throw Error(m);};
    const pixel=(x,y)=>[...ctx.getImageData(Math.round(x*RENDER_K),Math.round(y*RENDER_K),1,1).data];
    const black=[8,6,11,255];
    const sample=(x,y)=>JSON.stringify(pixel(x,y));
    for(let i=0;i<5;i++){
      startStage(i);render();check(sample(5,5)===JSON.stringify(black),'Stage '+i+' starts covered');
      const before={x:player.x,t:player.t};
      for(let tick=0;tick<36;tick++)update();
      check(scene==='intro'&&bannerT===124,'Wipe stays within intro');
      check(player.x===before.x&&player.t===before.t,'No gameplay during intro');
      for(let tick=36;tick<160;tick++)update();
      check(scene==='play','Original intro duration remains 160 ticks');
    }
    startStage(0);bannerT=142;
    const draw=drawStageEntryWipe;drawStageEntryWipe=()=>{};render();
    const left=sample(10,270),right=sample(950,270);
    drawStageEntryWipe=draw;render();
    check(sample(10,270)===left,'Left side revealed');
    check(sample(950,270)===JSON.stringify(black),'Right side still covered');
    check(right!==JSON.stringify(black),'Test background differs from wipe');
    pauseGame();const paused=bannerT;for(let i=0;i<20;i++)update();
    check(bannerT===paused,'Pause freezes wipe');resumeGame();update();
    check(bannerT===paused-1,'Resume continues wipe');
    retryStage();check(scene==='intro'&&bannerT===160,'Retry restarts wipe');
    nextStage();check(stageIdx===1&&bannerT===160,'Next stage restarts wipe');
    UX.options.lowFx=true;bannerT=154;render();const faded=sample(950,270);
    check(faded!==JSON.stringify(black),'Low FX uses a short fade');
    UX.options.lowFx=false;
    return {stages:5,wipeMs:36*MS,lowFxMs:12*MS,introTicks:160,pause:true,retry:true,nextStage:true};
  })()`);
  for(const elapsed of [0,12,18,24,36]){
    await evaluate(`startStage(0);bannerT=160-${elapsed};render()`);
    const shot=await call('Page.captureScreenshot',{format:'png'});
    fs.writeFileSync(path.join(out,`wipe-${elapsed}.png`),Buffer.from(shot.data,'base64'));
  }
  assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(result,null,2));
  console.log('PASS stage wipe: five stages, 600ms reveal, 200ms low FX fade, unchanged intro duration, pause/resume/retry/next stage');
};
