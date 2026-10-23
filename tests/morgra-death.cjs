// $env:MORGRA_DEATH_SUITE='1'; node tests/regression.cjs
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
module.exports=async({evaluate,errors,root})=>{
  await evaluate('requestAnimationFrame=()=>0;AUDIO.enable(false);Promise.all([MORGRA_ATLAS.decode(),JUDGMENT_READY])');
  const audio=await evaluate(`(async()=>{
    const decoder=new AudioContext();
    const buffer=await decoder.decodeAudioData(await (await fetch(ENEMY_DEATH_SFX_URL)).arrayBuffer());
    let first=buffer.length;
    for(let ch=0;ch<buffer.numberOfChannels;ch++){
      const data=buffer.getChannelData(ch);
      for(let i=0;i<first;i++)if(Math.abs(data[i])>.003){first=i;break;}
    }
    const starts=[],original=AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start=function(...args){
      if(Math.abs(this.buffer.duration-buffer.duration)<.01)starts.push(args);
      return original.apply(this,args);
    };
    try{
      AUDIO.enable(true);
      for(let i=0;i<100&&!starts.length;i++){
        AUDIO.sfx('mobdie');await new Promise(r=>setTimeout(r,50));
      }
      return {leadingSilence:first/buffer.sampleRate,starts};
    }finally{AudioBufferSourceNode.prototype.start=original;AUDIO.enable(false);await decoder.close();}
  })()`);
  assert(audio.starts.length,'Decoded death sample plays');
  assert(Math.abs(audio.starts[0][1]-Math.max(0,audio.leadingSilence-.002))<.002,'Playback skips leading silence');
  const deaths=await evaluate(`(()=>{
    player=newPlayer(0,'barel');scene='play';practice=false;enemies=[];hazards=[];
    const original=AUDIO.sfx,calls=[];let victim;
    AUDIO.sfx=name=>{if(name==='mobdie'||name==='bossdie')calls.push({name,hp:victim.hp,t:victim.t});};
    try{
      const weak=mkEnemy('grunt',400,420);weak.hp=1;weak.inv=0;weak.st='chase';victim=weak;
      damageEnemy(weak,1,false);const immediate=calls.length;
      damageEnemy(weak,1,false);
      const second=mkEnemy('grunt',450,420);second.hp=1;second.inv=0;second.st='chase';victim=second;
      damageEnemy(second,1,false);
      return {immediate,calls};
    }finally{AUDIO.sfx=original;}
  })()`);
  assert.equal(deaths.immediate,1,'Death sound dispatches within lethal damage call');
  assert.equal(deaths.calls.length,2,'Each death plays once, including simultaneous kills');
  assert(deaths.calls.every(c=>c.hp===0&&c.t===0),'Sound starts at HP zero, before death animation advances');
  const visual=await evaluate(`(()=>{
    camX=0;tick=0;ctx.setTransform(RENDER_K*Z,0,0,RENDER_K*Z,0,-OY*RENDER_K*Z);
    hazards=[{type:'morgra',kind:'moon_field',age:24*MS,delay:96,life:120,safe:[{x:200,y:420},{x:520,y:460}]}];
    const originalFlash=UX.options.flash;
    const render=age=>{
      hazards[0].age=age*MS;
      ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,ctx.canvas.width,ctx.canvas.height);ctx.restore();
      drawMorgraHazards(true);
      const pixel=(x,y)=>Array.from(ctx.getImageData(Math.floor(x*RENDER_K*Z),Math.floor((y-OY)*RENDER_K*Z),1,1).data);
      return {safe:pixel(200,420),safe2:pixel(520,460),danger:pixel(400,420),image:ctx.canvas.toDataURL()};
    };
    try{
      UX.options.flash=true;const warning=render(24),later=render(32),active=render(104);
      UX.options.flash=false;const steady=render(24),steadyLater=render(28);
      return {warning,later,active,steady,steadyLater};
    }finally{UX.options.flash=originalFlash;}
  })()`);
  for(const frame of Object.values(visual)){
    assert.equal(frame.safe[3],0,'Safe zone remains clear in warning and attack');
    assert.equal(frame.safe2[3],0,'Second safe zone also remains clear');
    assert(frame.danger[3]>0&&frame.danger[2]>frame.danger[1],'Attack area is purple throughout warning and attack');
  }
  assert.notEqual(visual.warning.image,visual.later.image,'Warning shimmers over time');
  assert(visual.steady.image===visual.steadyLater.image,'Flash setting disables shimmer animation within each phase');
  const dir=path.join(root,'artifacts/morgra-death');fs.mkdirSync(dir,{recursive:true});
  for(const name of ['warning','active'])fs.writeFileSync(path.join(dir,name+'.png'),Buffer.from(visual[name].image.split(',')[1],'base64'));
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({leadingSilenceSeconds:audio.leadingSilence,playbackOffsetSeconds:audio.starts[0][1],deaths:deaths.calls.length}));
  console.log('PASS immediate death audio, single dispatch per kill, purple moon warning/attack, clear safe zones and reduced flashing');
};
