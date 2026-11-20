// $env:VIESA_FIXES_SUITE='1'; node tests/regression.cjs
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
module.exports=async({evaluate,call,errors,root})=>{
  const out=path.join(root,'artifacts/viesa-fixes');fs.mkdirSync(out,{recursive:true});
  await evaluate('requestAnimationFrame=()=>0;AUDIO.enable(false);VIESA_READY');
  const samples=await evaluate(`(async()=>{
    const audio=new AudioContext();
    try{
      const durations={};
      for(const [name,url] of Object.entries(VIESA_SFX_URLS)){
        const raw=await (await fetch(url)).arrayBuffer();
        durations[name]=(await audio.decodeAudioData(raw)).duration;
      }
      return durations;
    }finally{await audio.close();}
  })()`);
  assert.equal(Object.keys(samples).length,3);
  assert(Object.values(samples).every(seconds=>seconds>0),'All skill MP3s decode');
  await evaluate(`toTitle();$('btnStart').click();selectCharacter('viesa');drawCharacterPreview()`);
  const selection=await evaluate(`(()=>{const im=$('viesaSelectPortrait');return {animated:im.tagName==='CANVAS',visible:im.getContext('2d').getImageData(0,0,im.width,im.height).data.some((n,i)=>i%4===3&&n>0)};})()`);
  assert(selection.animated&&selection.visible,'Selector draws the animated full-body sprite');
  fs.writeFileSync(path.join(out,'selection.png'),Buffer.from((await call('Page.captureScreenshot',{format:'png'})).data,'base64'));
  const result=await evaluate(`(()=>{
    const check=(ok,message)=>{if(!ok)throw Error(message);};
    $('btnCharacterConfirm').click();$('btnGo').click();finishOpening();scene='play';bannerT=0;enemies=[];hazards=[];
    const originalSfx=AUDIO.sfx,sounds=[];AUDIO.sfx=name=>sounds.push(name);
    try{
      player.st='free';player.z=0;player.sp=SP_MAX;beginViesaSpecial();
      check(sounds.filter(n=>n==='viesaUltimate').length===1,'Ultimate sample starts once');
      fireViesaArrow();fireViesaArrow({air:true});
      check(sounds.filter(n=>n==='viesaArrow').length===2,'Ground and air normal arrows use the arrow sample');
      sounds.length=0;
      player.st='free';player.skillCd.thrust=0;startViesaSkill('thrust');
      for(let i=0;i<100&&player.st==='skill';i++)updPlayer();
      check(sounds.filter(n=>n==='viesaArrow').length===6,'Each rapid arrow plays the arrow sample');
      player.st='free';player.skillCd.redwave=0;startViesaSkill('redwave');
      for(let i=0;i<100&&player.st==='skill';i++)updPlayer();
      check(sounds.filter(n=>n==='viesaSnipe').length===1,'Snipe sample starts on release');
      check(!$('cutin').classList.contains('show'),'Skill casts do not show the Barel caption');
    }finally{AUDIO.sfx=originalSfx;}
    player.st='free';player.viesaAction=null;hazards=[];resetViesaEffects();
    const heights=[];player.z=100;player.vz=-1;startViesaAttack('air');
    for(let i=0;i<160&&player.z>0;i++){
      const before=player.z;pressed.KeyJ=true;updPlayer();
      check(player.z<before,'Continuous air shots must descend each tick');heights.push(player.z);
    }
    check(player.z===0&&player.vz===0,'Continuous air shots land');
    check(heights.length>=55,'Air shooting stays aloft substantially longer');
    check(player.viesaAction?.phase==='land_jump','Landing interrupts the air shot');
    for(let i=0;i<10;i++)updPlayer();
    player.z=100;player.vz=-2;startViesaAttack('air');
    for(let i=0;i<160&&player.z>0;i++)updPlayer();
    check(player.z===0,'A single air shot also lands');
    player.st='free';player.z=0;player.sp=SP_MAX;beginViesaSpecial();
    const phases=new Set();
    for(let i=0;i<140&&player.st==='special';i++){updPlayer();phases.add(player.viesaAction?.phase);}
    check(player.st==='free'&&player.z===0,'Ultimate completes and lands');
    check(phases.size>=4,'All ultimate phases run');
    const idle=VIESA_ART.clips.idle[0],standing=VIESA_ART.clips.ult_final[5];
    const ratio=standing.atlas[3]/idle.atlas[3];
    check(Math.abs(ratio-1)<.03,'Standing ultimate body matches idle height');
    // Test real input, inventory consumption, and damage to an on-screen enemy.
    const target=()=>{const e=mkEnemy('grunt',player.x+60,player.y);e.hp=e.max=1000;enemies=[e];return e;};
    player.inv=0;player.buff=0;player.mg=1;player.viesaAction=null;clearInput();
    let e=target();pressed.KeyI=true;updPlayer();
    check(player.st==='cast'&&player.mg===0,'I starts Viesa lightning and consumes one scroll');
    check(VIESA_ART.clips.scroll_cast.length===10,'Lightning has ten dedicated scroll poses');
    const castTick=player.t,poses=new Set();
    for(let t=0;t*MS<MAGIC.dur;t++){
      player.t=t;const pose=viesaPose();poses.add(pose);
      check(VIESA_ART.clips.scroll_cast.includes(pose),'Cast always uses the scroll clip');
      if(t*MS>=MAGIC.fire&&t*MS<MAGIC.fire+MS)check(pose===VIESA_ART.clips.scroll_cast[7],'Release pose matches lightning damage tick');
    }
    check(poses.size===10,'All scroll animation frames are reachable');player.t=castTick;
    for(let i=0;i<50;i++)updPlayer();
    check(e.hp===920&&player.st==='free','Lightning deals 80 exactly once');
    pressed.KeyI=true;updPlayer();check(player.st==='free'&&player.mg===0,'Empty inventory cannot cast');clearInput();
    e=target();hazards=[];fireViesaArrow();
    let arrow=hazards[0];for(let i=0;i<30&&!arrow.dead;i++)updateViesaProjectile(arrow);
    check(e.hp===992,'Normal arrow deals 8 on contact');
    e=target();hazards=[];player.skillCd.thrust=0;pressed.KeyU=true;updPlayer();
    for(let i=0;i<100;i++)updPlayer();
    check(hazards.length===6&&hazards.every(z=>z.damage===10),'U produces six arrows with 10 damage each');
    arrow=hazards[0];for(let i=0;i<30&&!arrow.dead;i++)updateViesaProjectile(arrow);
    check(e.hp===990,'Rapid arrow deals 10 on contact');
    // 모아 쏘기: hold on draw frame 7, +4 damage per level up to three levels.
    const charged=[];
    for(const holdTicks of [5,45,65,85,200]){
      clearInput();hazards=[];resetViesaEffects();player.st='free';player.z=player.vz=0;player.buff=0;player.skillCd.redwave=0;
      pressed.KeyL=true;keys.KeyL=true;updPlayer();
      for(let i=0;i<holdTicks&&player.viesaAction?.phase==='snipe_draw';i++){
        if(player.t>=VIESA_CHARGE.drawTicks)check(viesaPose()===VIESA_ART.clips.snipe_draw[6],'Charging holds draw frame 7');
        updPlayer();
      }
      delete keys.KeyL;for(let i=0;i<60&&player.st==='skill';i++)updPlayer();
      charged.push(hazards.find(z=>z.snipe)?.damage);
    }
    clearInput();
    check(JSON.stringify(charged)===JSON.stringify([25,29,33,37,37]),'Charge levels add 4 damage, max three: '+charged);
    // Shift dash then keep holding the direction: run faster than walking until released.
    player.st='free';player.z=player.vz=0;player.dashCd=0;player.x=camX+100;player.face=1;clearInput();
    keys.ArrowRight=true;startDash(1);for(let i=0;i<14;i++)updPlayer();
    check(player.st==='free'&&player.running&&VIESA_ART.clips.run.includes(viesaPose()),'Dash continues into a run');
    const runX=player.x;updPlayer();
    check(Math.abs(player.x-runX-PLAYER_DATA.move.groundPxPerTick*1.1*RUN_SPEED_SCALE)<1e-9,'Running is faster than walking');
    // Turning around keeps the run: overlap (newer key wins) and a short gap between keys.
    const beforeTurn=player.x;keys.ArrowLeft=true;pressed.ArrowLeft=BUF_MS;updPlayer();
    check(player.running&&player.face===-1&&player.x<beforeTurn,'Pressing the other way over the held key turns the run');
    delete keys.ArrowLeft;for(let i=0;i<RUN_TURN_GRACE_TICKS-1;i++)updPlayer();
    check(player.running,'A brief gap while switching keys keeps the run');
    keys.ArrowRight=true;updPlayer();const turnX=player.x;updPlayer();
    check(player.running&&player.face===1&&Math.abs(player.x-turnX-PLAYER_DATA.move.groundPxPerTick*1.1*RUN_SPEED_SCALE)<1e-9,'Run continues at run speed after turning back');
    delete keys.ArrowRight;for(let i=0;i<RUN_TURN_GRACE_TICKS;i++)updPlayer();check(!player.running,'Releasing the direction ends the run');
    clearInput();
    const dashResults=[];
    for(const mode of ['shift','whirl','leap']){
      clearInput();player.x=camX+100;player.z=player.vz=0;player.st='free';player.inv=0;player.dashCd=0;player.viesaAirPUsed=false;
      e=target();const hp=player.hp;
      if(mode==='shift')startDash(1);else{player.skillCd[mode]=0;startViesaSkill(mode);}
      for(let i=0;i<(mode==='shift'?9:16);i++){
        updPlayer();check(!hurtPlayer(5,-1,false),'Moving dash is invulnerable');
      }
      check(player.hp===hp&&e.hp===(mode==='shift'?1000:980),'Shift dash deals no damage; O/P deal 20 once; all prevent incoming damage: '+mode);
      dashResults.push(mode);
    }
    enemies=[];resetViesaEffects();player.st='free';player.z=0;player.sp=SP_MAX;beginViesaSpecial();
    const cast=player.viesaAction;
    e=target();viesaUltProjectile('phantom',cast);
    let projectile=viesaUltObjects[0];Object.assign(projectile,{tx:e.x,ty:e.y,th:40,life:1});
    updateViesaUltimateProjectiles();check(e.hp===996,'Ultimate phantom deals 4');
    e.inv=0;viesaUltProjectile('giant',cast);projectile=viesaUltObjects[0];Object.assign(projectile,{tx:e.x,ty:e.y,th:0,life:1});
    updateViesaUltimateProjectiles();check(e.hp===836,'Ultimate explosion deals 160');
    enemies=[];
    player.st='free';player.z=0;player.inv=0;player.hp=player.max;player.viesaAction=null;
    hurtPlayer(1,-1,false);
    check(player.st==='hurt'&&viesaPose()===VIESA_ART.clips.hurt[0],'Damage selects the hurt animation');
    player.inv=0;hurtPlayer(player.max,-1,false);
    check(player.st==='dead'&&viesaPose()===VIESA_ART.clips.death[0],'Lethal damage selects the death animation');
    for(const frame of [VIESA_ART.clips.hurt[2],VIESA_ART.clips.death[0]]){
      check(Math.abs(frame.atlas[3]/idle.atlas[3]-1)<.15,'Standing hurt/death body stays near idle size');
    }
    for(const frame of VIESA_ART.clips.death){
      check(frame.anchor[1]===frame.atlas[3],'Each death pose touches the ground at z=0');
    }
    // Exercise lethal damage during an airborne skill, including its old action.
    player.st='free';player.z=100;player.vz=0;player.hp=player.max;player.inv=0;
    player.viesaAction={phase:'hover'};hurtPlayer(player.max,-1,false);
    for(let i=0;i<60;i++)updPlayer();
    check(player.st==='dead'&&player.z===0&&player.vz===0,'Airborne death falls to the floor');
    check(viesaPose()===VIESA_ART.clips.death.at(-1),'Landed death holds the final grounded pose');
    return {continuousShotHeights:heights,singleShotLanded:true,ultimatePhases:[...phases],standingHeightRatio:ratio,scrollDamage:80,normalArrowDamage:8,rapidArrowDamage:10,chargedSnipeDamage:charged,ultimateDamage:{phantom:4,explosion:160},invulnerableDashes:dashResults};
  })()`);
  await evaluate(`player.st='special';player.t=10;player.z=110;player.viesaAction={phase:'ult_barrage',clock:10};ctx.setTransform(RENDER_K,0,0,RENDER_K,0,0);render()`);
  fs.writeFileSync(path.join(out,'ultimate.png'),Buffer.from((await call('Page.captureScreenshot',{format:'png'})).data,'base64'));
  await evaluate(`document.getElementById('assetLoading').hidden=true;enemies=[];hazards=[];player.hp=player.max;player.inv=0;player.flash=0;player.st='skill';player.z=0;player.t=70;player.x=camX+260;player.viesaAction={phase:'snipe_draw',held:70,charge:2,shots:0};resetViesaEffects();ctx.setTransform(RENDER_K,0,0,RENDER_K,0,0);render()`);
  fs.writeFileSync(path.join(out,'charge.png'),Buffer.from((await call('Page.captureScreenshot',{format:'png'})).data,'base64'));
  await evaluate(`(()=>{
    ctx.setTransform(RENDER_K,0,0,RENDER_K,0,0);ctx.fillStyle='#17151d';ctx.fillRect(0,0,VW,VH);
    const poses=[['idle',0],['hurt',0],['hurt',2],['knockdown',3],['getup',5],['death',0],['death',4]];
    poses.forEach(([name,index],i)=>{
      const x=70+i*130;ctx.fillStyle='#777';ctx.fillRect(x-55,310,110,1);
      paintViesa(VIESA_ART.clips[name][index],{x:camX+x,y:310,z:0,face:1});
      ctx.fillStyle='white';ctx.font='14px sans-serif';ctx.fillText(name+' '+index,x-40,345);
    });
  })()`);
  fs.writeFileSync(path.join(out,'hurt-death-size.png'),Buffer.from((await call('Page.captureScreenshot',{format:'png'})).data,'base64'));
  const scrollPreview=await evaluate(`(()=>{
    const canvas=document.createElement('canvas');canvas.width=1200;canvas.height=480;
    const c=canvas.getContext('2d');c.fillStyle='#17151d';c.fillRect(0,0,1200,480);
    VIESA_ART.clips.scroll_cast.forEach((frame,i)=>{
      const x=110+(i%5)*240,y=200+Math.floor(i/5)*240,k=VIESA_ART.scale*1.5;
      const [sx,sy,w,h]=frame.atlas,[ax,ay]=frame.anchor;
      c.fillStyle='#777';c.fillRect(x-85,y,170,1);c.imageSmoothingEnabled=false;
      c.drawImage(VIESA_SHEETS[frame.sheet],sx,sy,w,h,x-ax*k,y-ay*k,w*k,h*k);
      c.fillStyle='white';c.font='14px sans-serif';c.fillText('scroll '+(i+1),x-30,y+25);
    });
    return canvas.toDataURL('image/png').split(',')[1];
  })()`);
  fs.writeFileSync(path.join(out,'lightning-scroll.png'),Buffer.from(scrollPreview,'base64'));
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({selection,...result,errors},null,2));
  console.log('PASS Viesa combat fixes, hurt/death size, ultimate size and phases, full-body selection');
};
