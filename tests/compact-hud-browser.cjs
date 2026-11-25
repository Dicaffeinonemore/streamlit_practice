const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
module.exports=async({evaluate,call,errors,root})=>{
  await evaluate(`(async()=>{await Promise.all(Object.values(compactHud).map(i=>i.decode())); window.requestAnimationFrame=()=>0; UX.options.touch=false;player=newPlayer();startStage(0);scene='play';showScreen(null);player.mg=1;player.hp=60;player.sp=0;render()})()`);
  assert.equal(await evaluate(`(()=>{ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,W,H);drawPixelHUD(player);const rgb=(x,y)=>[...ctx.getImageData(x,y,1,1).data];const hp=rgb(70,32), emptyHp=rgb(200,32), emptySp=rgb(64,44);ctx.restore();return hp[0]===245&&emptyHp[0]<100&&emptySp.join(',')==='10,18,38,255'})()`),true,'v4 HP fill and empty SP track are drawn inside the panel');
  for (const [width,height] of [[960,540],[1280,720],[844,390]]) {
    await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
    assert.equal(await evaluate(`(()=>{
      const bounds=cv.getBoundingClientRect(), scale=bounds.width/960;
      const slot=document.querySelector('#skillbar .skillbtn').getBoundingClientRect(), pause=$('playPause').getBoundingClientRect();
      const close=(a,b)=>Math.abs(a-b)<1;
      return close(slot.left,bounds.left+42*scale)&&close(slot.top,bounds.top+72*scale)&&close(slot.width,26*scale)&&
        close(pause.left,bounds.left+922*scale)&&close(pause.height,26*scale)&&
        getComputedStyle($('playPause')).backgroundImage.includes('pause_frame.png');
    })()`),true,'DOM hit areas align with the v4 art at width '+width);
  }
  await call('Emulation.setDeviceMetricsOverride',{width:1280,height:720,deviceScaleFactor:1,mobile:false});
  assert.equal(await evaluate(`(()=>{
    updateSkillButtons();
    document.querySelector('#skillbar [data-skill="thrust"]').dispatchEvent(new PointerEvent('pointerdown'));
    const casts=player.st==='skill'&&player.skillCd.thrust>0;
    $('playPause').click();
    const pauses=scene==='pause';resumeGame();
    return casts&&pauses&&scene==='play';
  })()`),true,'the new hit areas still launch skills and pause the game');
  assert.equal(await evaluate(`(()=>{const e=mkEnemy('axe',430,420);return drawCompactEnemy(e)&&drawCompactBoss(mkEnemy('boss4',430,420),{value:50,lag:50})})()`),true);
  await evaluate(`player=newPlayer(53040,'viesa');syncPlayerCharacterUI('viesa');player.mg=2;player.skillCd.thrust=2400;fitCanvas();ctx.setTransform(RENDER_K,0,0,RENDER_K,0,0);render()`);
  assert.equal(await evaluate(`isViesa(player)&&document.body.classList.contains('viesa-player')`),true,'Viesa uses the shared HUD');
  const shot=await call('Page.captureScreenshot',{format:'png'});
  const dir=path.join(root,'artifacts/compact-hud');fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'web.png'),Buffer.from(shot.data,'base64'));
  for (let i=0; i<5; i++) {
    assert.equal(await evaluate(`(async()=>{
      await GameAssets.prepareStage(${i});
      const boss=mkEnemy('boss'+(${i}+1),430,420);
      if(${i}===0)g2Data(boss);
      const first=hudBossFace(boss);
      if(boss.g2)boss.g2.phase=2; else boss.p2shown=true;
      const second=hudBossFace(boss);
      return !!first&&!!second&&first!==second;
    })()`),true,'stage '+(i+1)+' uses a distinct phase-two portrait');
  }
  await evaluate(`(async()=>{
    player=newPlayer(53040,'barel'); startStage(3); await GameAssets.prepareStage(3);
    scene='play';showScreen(null);camLock=true;camX=3240;barrels=[];
    Object.assign(player,{x:camX+195,y:434,inv:0,hp:72,sp:0,mg:2});
    player.skillCd.slam=2400;
    const boss=mkEnemy('boss4',camX+475,443);
    Object.assign(boss,{p2shown:true,st:'chase',hp:1500,max:2500,face:-1,inv:0});
    enemies=[boss]; releaseBG.key='phase4'; releaseBG.blend=1;
    fitCanvas();ctx.setTransform(RENDER_K,0,0,RENDER_K,0,0);render();
  })()`);
  const bossShot=await call('Page.captureScreenshot',{format:'png'});
  fs.writeFileSync(path.join(dir,'web-boss-v4.png'),Buffer.from(bossShot.data,'base64'));
  assert.deepEqual(errors,[]);
  console.log('PASS HUD v4: live resources, controls, responsive hit areas and five phase portraits');
};
