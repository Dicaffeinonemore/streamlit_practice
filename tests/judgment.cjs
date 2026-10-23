// $env:JUDGMENT_SUITE='1'; node tests/regression.cjs
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
module.exports=async({evaluate,call,errors,root})=>{
  await evaluate(`(async()=>{
    requestAnimationFrame=()=>0;AUDIO.enable(false);
    await Promise.all([JUDGMENT_READY,MORGRA_ATLAS.decode(),BAREL_ATLAS.decode()]);
    selectedCharacterId='barel';player=newPlayer(0,'barel');startStage(1);scene='play';showScreen(null);
    syncPlayerCharacterUI('barel');bannerT=0;introBoss=null;camX=0;shake=0;flashT=0;
    Object.assign(player,{x:250,y:420,st:'free',inv:0});
  })()`);
  const mechanics=await evaluate(`(()=>{
    const boss=mkEnemy('boss2',540,420);boss.st='pat';boss.p2shown=true;boss.pat='moon';boss.morgraMove='moon';
    const field={type:'morgra',kind:'moon_field',owner:boss,age:102*MS,delay:96,life:120,damageScale:1.5,safe:[{x:200,y:410},{x:540,y:460}]};
    const sample=(x,y,f)=>{
      Object.assign(player,{hp:100,x,y,inv:0,st:'free',z:0});field.hit=false;field.age=f*MS;updateMorgraHazard(field);return player.hp;
    };
    const safe1=sample(200,410,103),safe2=sample(540,460,103),warning=sample(350,420,90),early=sample(350,420,100),damage=sample(350,420,103);
    field.age=120*MS;updateMorgraHazard(field);
    const pixels=[];ctx.save();ctx.setTransform(1,0,0,1,0,0);
    for(const f of [0,6,12,18,23]){
      ctx.clearRect(0,0,cv.width,cv.height);judgmentSprite('moon',f,0,0,256,256);pixels.push(cv.toDataURL());
    }
    ctx.restore();
    return {safe1,safe2,warning,early,damage,expired:field.dead,frames:new Set(pixels).size,charge:[judgmentMoonFrame(0),judgmentMoonFrame(111),judgmentMoonFrame(112)],field:[0,40,96,114,119].map(f=>judgmentFieldFrame({...field,age:f*MS}))};
  })()`);
  assert.equal(mechanics.safe1,100);assert.equal(mechanics.safe2,100);assert.equal(mechanics.warning,100);assert.equal(mechanics.early,100);
  assert(mechanics.damage<100&&mechanics.expired,'Attack timing, damage and cleanup preserved');
  assert.equal(mechanics.frames,5,'Crescent, half and full moon frames differ');
  assert.deepEqual(mechanics.charge,[0,17,18]);
  assert(mechanics.field.every(frame=>frame>=0&&frame<24),'GIF frames remain in range');
  const rollback=await evaluate(`(()=>{
    const original=AUDIO.sfx,sounds=[];AUDIO.sfx=name=>sounds.push(name);
    try{
      player=newPlayer(0,'viesa');scene='play';enemies=[];hazards=[];
      startViesaMelee(0);const melee=playerAttackHasDefaultSound();
      startViesaAttack(0);const arrow=playerAttackHasDefaultSound();fireViesaArrow();
      player.st='free';player.z=0;player.sp=SP_MAX;beginViesaSpecial();
      const ultimate=playerAttackHasDefaultSound();
      player.viesaAction.phase='ult_final';player.t=8;updateViesaUltimate();
      for(let i=0;i<30;i++)updateViesaUltimateProjectiles();
      startCast();const scroll=playerAttackHasDefaultSound();fireBolts();
      const draws=[],draw=judgmentSprite;judgmentSprite=(...args)=>{draws.push(args);return true;};
      try{drawJudgmentMoon({age:50*MS,life:162,x:320,y:340,h:105});}finally{judgmentSprite=draw;}
      return {sounds,melee,arrow,ultimate,scroll,moonWidth:draws[0][4],moonHeight:draws[0][5],durations:JUDGMENT_ART.fieldDurations};
    }finally{AUDIO.sfx=original;player=newPlayer(0,'barel');syncPlayerCharacterUI('barel');}
  })()`);
  for(const sound of ['swing','viesaArrow','viesaUltimate','bwave','moon','mcharge','bolt'])assert(rollback.sounds.includes(sound),'Restored or retained '+sound);
  assert(!rollback.sounds.includes('pwave'),'Arrow default sound remains removed');
  assert(rollback.melee&&!rollback.arrow&&rollback.ultimate&&rollback.scroll,'Default hit audio restored only for requested actions');
  assert.equal(rollback.moonWidth,120);assert.equal(rollback.moonHeight,120);
  assert.equal(rollback.durations.length,24);assert(rollback.durations.every(ms=>ms===80),'Original GIF timing preserved');
  const beamShape=await evaluate(`(()=>{
    ctx.save();ctx.setTransform(1,0,0,1,0,0);camX=0;
    const z={age:104*MS,delay:96,life:120,safe:[]};
    const pixels=()=>ctx.getImageData(5,295,40,44).data;
    ctx.clearRect(0,0,cv.width,cv.height);drawJudgmentField(z);const actual=Array.from(pixels());
    ctx.clearRect(0,0,cv.width,cv.height);paintMorgra(morgraFxFrame('moon_beam',8/6),30,GTOP+25);const expected=Array.from(pixels());
    ctx.restore();return {same:actual.every((n,i)=>n===expected[i]),visible:expected.some((n,i)=>i%4===3&&n>0)};
  })()`);
  assert(beamShape.visible&&beamShape.same,'Top beam above GTOP matches the complete original sprite without cropping');
  const base=path.join(root,'artifacts/judgment');fs.mkdirSync(base,{recursive:true});
  const dir=fs.mkdtempSync(path.join(base,'run-'));
  for(const [name,castFrame] of [['warning',60],['charged',116],['eruption',132],['fade',146]]){
    await evaluate(`(()=>{
      const boss=mkEnemy('boss2',540,420);Object.assign(boss,{st:'pat',p2shown:true,pat:'moon',morgraMove:'moon',pt:${castFrame}*MS});
      enemies=[boss];tick=${castFrame};camX=0;shake=0;flashT=0;texts=[];parts=[];bolts=[];hitStop=0;
      Object.assign(player,{hp:100,x:200,y:410,z:0,st:'free',inv:0});
      hazards=[{type:'morgra',fx:'moon',visual:true,x:VW/2,y:GTOP,h:105,age:(${castFrame}-12)*MS,life:162,owner:boss},
        {type:'morgra',kind:'moon_field',x:VW/2,y:420,h:0,age:(${castFrame}-28)*MS,delay:96,life:120,owner:boss,safe:[{x:200,y:410},{x:540,y:460}]}];
      fitCanvas();ctx.setTransform(RENDER_K,0,0,RENDER_K,0,0);render();
    })()`);
    const shot=await call('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(dir,name+'.png'),Buffer.from(shot.data,'base64'));
  }
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(dir,'results.json'),JSON.stringify(mechanics,null,2));
  console.log('PASS supplied moon frames, warning/eruption/fade, safe zones, damage timing and cleanup; screenshots: '+dir);
};
