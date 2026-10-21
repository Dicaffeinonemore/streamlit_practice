const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
module.exports = async ({ evaluate, call, errors, root }) => {
  await evaluate(`(async()=>{await PIXEL_UI.decode(); await new Promise(r=>setTimeout(r,50)); window.requestAnimationFrame=()=>0; UX.options.touch=false; document.body.classList.remove('touch');player=newPlayer();startStage(3);scene='play';showScreen(null);player.sp=65;player.mg=2;player.hp=74;player.x=250;enemies=[];render();})()`);
  assert.equal(await evaluate('pixelUI.ready'), true);
  await evaluate('BOSS_UI.decode()');
  assert.equal(await evaluate(`(() => {
    ctx.save();ctx.setTransform(1,0,0,1,0,0);
    const k=W/1672*.62, sx=1064*k/1104, sy=sx;
    const brightness=(x,y)=>{const d=ctx.getImageData(Math.round(3+x*sx),Math.round(20+(y-140)*sy),1,1).data;return d[0]+d[1]+d[2]};
    const saved={hp:player.hp,sp:player.sp,mg:player.mg,lives:player.lives};
    Object.assign(player,{hp:100,sp:100,mg:3,lives:3});drawPixelHUD(player);
    const full=[brightness(500,306),brightness(500,366),brightness(812,345),brightness(504,475)];
    Object.assign(player,{hp:0,sp:0,mg:0,lives:0});drawPixelHUD(player);
    const empty=[brightness(500,306),brightness(500,366),brightness(812,345),brightness(504,475)];
    Object.assign(player,saved);ctx.restore();
    if(!full.every((v,i)=>v>empty[i]))throw Error(JSON.stringify({full,empty}));
    return true;
  })()`),true,'New atlas health, SP, scrolls and lives reflect live resources');
  assert.equal(await evaluate(`(() => {
    const boss = mkEnemy('boss4',430,420);
    ctx.save(); ctx.setTransform(1,0,0,1,0,0);
    const redAt = ratio => {
      ctx.clearRect(0,0,W,H);
      drawPixelBossBar(boss,{value:boss.max*ratio,lag:boss.max*ratio});
      const { x, y, scale } = BOSS_UI_LAYOUT;
      return ctx.getImageData(Math.round(x + 1450 * scale),Math.round(y + 370 * scale),1,1).data[0];
    };
    const full=redAt(1), empty=redAt(0), half=redAt(.5);
    ctx.restore();
    const labels=[], original=ctx.fillText;
    ctx.fillText=function(text,...args){labels.push(text);return original.call(this,text,...args)};
    try { player.score=1234; drawPixelHUD(player); } finally { ctx.fillText=original; }
    return full>100 && empty<50 && half<50 && labels.includes('score 1234') && !labels.some(t=>t.startsWith('HP ')||t.includes('목숨'));
  })()`),true,'Boss fill empties correctly and only score text remains');
  assert.equal(await evaluate("getComputedStyle($('playPause')).backgroundImage.startsWith('url(')"), true);
  for (const [width,height] of [[1280,720],[844,390],[390,844]]) {
    await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
    await evaluate('new Promise(r=>setTimeout(r,100))');
    await evaluate("fitCanvas();ctx.setTransform(RENDER_K,0,0,RENDER_K,0,0);$('playPause').hidden=false;render()");
    const layout = await evaluate(`(()=>{const c=cv.getBoundingClientRect(),s=$('skillbar').getBoundingClientRect(),p=$('playPause').getBoundingClientRect();return {inside:s.left>=c.left&&s.right<=c.right+1&&s.bottom<=c.bottom+1,gap:(c.top+350*c.height/H)-s.bottom,pause:p.right<=c.right+1};})()`);
    assert(layout.inside && layout.pause && layout.gap >= 0, JSON.stringify(layout));
    const shot = await call('Page.captureScreenshot',{format:'png'});
    fs.mkdirSync(path.join(root,'artifacts/pixel-ui'),{recursive:true});
    fs.writeFileSync(path.join(root,`artifacts/pixel-ui/layout-${width}.png`),Buffer.from(shot.data,'base64'));
  }
  await call('Emulation.setDeviceMetricsOverride',{width:1280,height:720,deviceScaleFactor:1,mobile:false});
  await evaluate('new Promise(r=>setTimeout(r,100))');
  await evaluate("fitCanvas();ctx.setTransform(RENDER_K,0,0,RENDER_K,0,0);enemies=[mkEnemy('boss4',430,420)];render()");
  const bossShot = await call('Page.captureScreenshot',{format:'png'});
  fs.writeFileSync(path.join(root,'artifacts/pixel-ui/boss.png'),Buffer.from(bossShot.data,'base64'));
  assert.equal(await evaluate(`(()=>{pauseGame();const stopped=scene==='pause';resumeGame();player.skillCd.thrust=1000;updateSkillButtons();return stopped&&scene==='play'&&document.querySelector('[data-skill="thrust"]').dataset.cooldown==='1.0';})()`),true);
  assert.deepEqual(errors, []);
  console.log('PASS Supplied pixel atlas, responsive layout, boss bar clearance, pause and cooldown');
};
