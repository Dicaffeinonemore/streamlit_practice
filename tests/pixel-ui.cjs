const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
// Player / boss HUD design (assets_src/hud, tools/build-hud-ui.py): a 1672-wide full-screen overlay.
module.exports = async ({ evaluate, call, errors, root }) => {
  await evaluate(`(async()=>{await HUD_UI.decode(); await new Promise(r=>setTimeout(r,50)); window.requestAnimationFrame=()=>0; UX.options.touch=false; document.body.classList.remove('touch');player=newPlayer();startStage(3);scene='play';showScreen(null);player.sp=65;player.mg=2;player.hp=74;player.x=250;enemies=[];render();})()`);
  assert.equal(await evaluate('hudUI.ready'), true);
  assert.equal(await evaluate(`(() => {
    ctx.save();ctx.setTransform(1,0,0,1,0,0);
    const k=W/1672, at=(x,y)=>ctx.getImageData(Math.round(x*k),Math.round(y*k),1,1).data;
    const brightness=(x,y)=>{const d=at(x,y);return d[0]+d[1]+d[2]};
    const saved={hp:player.hp,sp:player.sp,mg:player.mg,lives:player.lives};
    Object.assign(player,{hp:100,sp:100,mg:3,lives:3});player.hpLag=100;drawPixelHUD(player);
    const full=[brightness(400,110),brightness(400,157),brightness(722,120)];
    Object.assign(player,{hp:0,sp:0,mg:0,lives:0});player.hpLag=0;drawPixelHUD(player);
    const empty=[brightness(400,110),brightness(400,157),brightness(722,120)];
    Object.assign(player,saved);ctx.restore();
    if(!full.every((v,i)=>v>empty[i]+60))throw Error(JSON.stringify({full,empty}));
    return true;
  })()`),true,'Health, SP and scroll charges reflect live resources');
  assert.equal(await evaluate(`(() => {
    const boss = mkEnemy('boss4',430,420);
    ctx.save(); ctx.setTransform(1,0,0,1,0,0);
    const k=W/1672;
    const colourAt = ratio => {
      ctx.clearRect(0,0,W,H);
      drawPixelBossBar(boss,{value:boss.max*ratio,lag:boss.max*ratio});
      return ctx.getImageData(Math.round(1400*k),Math.round(862*k),1,1).data;
    };
    const full=colourAt(1), empty=colourAt(0), half=colourAt(.5);
    ctx.restore();
    const labels=[], original=ctx.fillText;
    ctx.fillText=function(text,...args){labels.push(String(text));return original.call(this,text,...args)};
    try { Object.assign(player,{score:1234,lives:2}); drawPixelHUD(player); drawPixelBossBar(boss,{value:boss.max,lag:boss.max}); } finally { ctx.fillText=original; }
    const green=c=>c[1]>120&&c[0]<90, red=c=>c[0]>150&&c[1]<60;
    if(!(green(full)&&red(empty)&&red(half)))throw Error(JSON.stringify({full,empty,half}));
    for(const label of ['varel','1P×2','1234','level 4',boss.d.name])if(!labels.includes(label))throw Error('missing '+label+' in '+JSON.stringify(labels));
    return !labels.includes('score 1234');
  })()`),true,'Boss bar is green over red; name, lives, score, stage and boss name are live text');
  assert.equal(await evaluate("getComputedStyle($('playPause')).backgroundImage.startsWith('url(')"), true);
  for (const [width,height] of [[1280,720],[844,390],[390,844]]) {
    await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
    await evaluate('new Promise(r=>setTimeout(r,100))');
    await evaluate("fitCanvas();ctx.setTransform(RENDER_K,0,0,RENDER_K,0,0);$('playPause').hidden=false;$('skillbar').hidden=false;render()");
    // The skill buttons sit over the drawn icons (x 38-474, y 180-294 of 1672 × 941).
    const layout = await evaluate(`(()=>{const c=cv.getBoundingClientRect(),s=$('skillbar').getBoundingClientRect(),p=$('playPause').getBoundingClientRect(),k=c.width/1672;
      return {left:Math.abs(s.left-(c.left+38*k)),right:Math.abs(s.right-(c.left+474*k)),top:Math.abs(s.top-(c.top+180*k)),pause:Math.abs(p.right-(c.left+1640*k))+Math.abs(p.top-(c.top+21*k))};})()`);
    assert(layout.left < 3 && layout.right < 4 && layout.top < 3 && layout.pause < 4, JSON.stringify(layout));
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
  console.log('PASS HUD design atlas: live bars, text and boss bar, skill buttons over the icons, pause and cooldown');
};
