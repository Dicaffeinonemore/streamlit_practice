// $env:VIESA_UI_SUITE='1'; node tests/regression.cjs
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
module.exports=async({evaluate,call,errors,root})=>{
  await evaluate(`(async()=>{
    await Promise.all([VIESA_UI.decode(),PIXEL_UI.decode(),VIESA_READY]);
    await new Promise(r=>setTimeout(r,50));requestAnimationFrame=()=>0;AUDIO.enable(false);
    UX.options.touch=false;document.body.classList.remove('touch');
    player=newPlayer(0,'viesa');startStage(1);scene='play';showScreen(null);syncPlayerCharacterUI('viesa');
    Object.assign(player,{hp:64,sp:43,mg:2,lives:3,x:250,st:'free'});enemies=[];bannerT=0;render();
  })()`);
  assert(await evaluate('viesaUI.ready'),'Viesa art decoded');
  const resources=await evaluate(`(()=>{
    const saved={hp:player.hp,sp:player.sp,mg:player.mg,lives:player.lives};
    ctx.save();ctx.setTransform(1,0,0,1,0,0);
    const sample=(x,y)=>{const d=ctx.getImageData(Math.round(3+x*390/1672),Math.round(20+(y-80)*390/1672),1,1).data;return d[0]+d[1]+d[2];};
    const paint=()=>{ctx.clearRect(0,0,cv.width,cv.height);drawPixelHUD(player);return [[800,338],[800,420],[1230,380],[480,600]].map(([x,y])=>sample(x,y));};
    Object.assign(player,{hp:player.max,sp:100,mg:3,lives:3});const full=paint();
    Object.assign(player,{hp:0,sp:0,mg:0,lives:0});const empty=paint();
    Object.assign(player,saved);ctx.restore();render();return {full,empty};
  })()`);
  assert(resources.full.every((n,i)=>n>resources.empty[i]),JSON.stringify(resources));
  const controls=await evaluate(`(()=>{
    const button=document.querySelector('#skillbar [data-skill="thrust"]');
    const original=UX.options.bindings.KeyU;UX.options.bindings.KeyU='KeyB';UX.refreshBindings();
    const remapped=button.querySelector('.key').textContent;UX.options.bindings.KeyU=original;UX.refreshBindings();
    player.st='free';player.z=0;player.skillCd.thrust=0;updateSkillButtons();
    const viesa=getComputedStyle(button).backgroundImage;
    button.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));
    const used=player.viesaAction?.phase==='rapid_start'&&player.skillCd.thrust>0;
    syncPlayerCharacterUI('barel');const barel=getComputedStyle(button).backgroundImage;
    syncPlayerCharacterUI('viesa');player.st='free';player.viesaAction=null;render();
    return {remapped,used,distinct:viesa!==barel,viesa,barel};
  })()`);
  assert.equal(controls.remapped,'B');assert(controls.used,'Pointer starts Viesa skill');
  assert(controls.distinct&&controls.viesa.startsWith('url(')&&controls.barel.startsWith('url('),'Character skins switch correctly');
  const dir=path.join(root,'artifacts/viesa-ui');fs.mkdirSync(dir,{recursive:true});
  for(const [width,height] of [[1280,720],[844,390],[390,844]]){
    await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
    await evaluate('new Promise(r=>setTimeout(r,100))');
    await evaluate('fitCanvas();ctx.setTransform(RENDER_K,0,0,RENDER_K,0,0);player.inv=0;render()');
    const inside=await evaluate(`(()=>{const c=cv.getBoundingClientRect(),s=$('skillbar').getBoundingClientRect();return s.left>=c.left&&s.right<=c.right+1&&s.bottom<=c.bottom+1;})()`);
    assert(inside,'Skill panel fits '+width);
    const shot=await call('Page.captureScreenshot',{format:'png'});
    fs.writeFileSync(path.join(dir,'hud-'+width+'.png'),Buffer.from(shot.data,'base64'));
  }
  assert.deepEqual(errors,[]);
  console.log('PASS Viesa HUD HP/SP/scrolls/lives, skin switching, key remapping, skill input and three viewport layouts');
};
