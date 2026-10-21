const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
module.exports = async ({ evaluate, call, errors, root }) => {
  await evaluate(`(async()=>{await Promise.all([ENEMY_UI.decode(),PIXEL_UI.decode(),NAMED_ATLAS.decode()]);window.requestAnimationFrame=()=>0;UX.options.touch=false;document.body.classList.remove('touch');player=newPlayer();startStage(4);scene='play';showScreen(null);player.x=220;enemies=[mkEnemy('grunt',430,420)];target={e:enemies[0],t:150};})()`);
  assert.equal(await evaluate(`(()=>{
    for(let stage=0;stage<5;stage++) {stageIdx=stage;for(const type of ['grunt','rogue','archer','brute']) {
      if(!enemyHUDPortrait(mkEnemy(type,430,420))) return false;
    }}
    return enemyPortraitCache.size===20;
  })()`),true,'All stage and enemy combinations have portraits');
  assert.equal(await evaluate(`(()=>{
    const e=enemies[0],{right,top,width,crop}=ENEMY_UI_LAYOUT,s=width/crop[2];
    const x=W-right-width+(1400-crop[0])*s,y=top+(360-crop[1])*s;
    ctx.save();ctx.setTransform(1,0,0,1,0,0);
    const sample=r=>{ctx.clearRect(0,0,W,H);e.hp=e.hpLag=e.max*r;drawPixelEnemyBar(e);return ctx.getImageData(Math.round(x),Math.round(y),1,1).data[0]};
    const full=sample(1),empty=sample(0),half=sample(.5);ctx.restore();e.hp=e.hpLag=e.max*.6;
    return full>150&&empty<70&&half<70;
  })()`),true,'Health fill follows full, half and empty values');
  await call('Emulation.setDeviceMetricsOverride',{width:1280,height:720,deviceScaleFactor:1,mobile:false});
  await evaluate('new Promise(r=>setTimeout(r,150))');
  await evaluate("fitCanvas();ctx.setTransform(RENDER_K,0,0,RENDER_K,0,0);$('playPause').hidden=false;render()");
  const shot = await call('Page.captureScreenshot',{format:'png'});
  fs.mkdirSync(path.join(root,'artifacts/enemy-hud'),{recursive:true});
  fs.writeFileSync(path.join(root,'artifacts/enemy-hud/new-frame.png'),Buffer.from(shot.data,'base64'));
  assert.deepEqual(errors,[]);
  console.log('PASS Enemy portraits, health fill and embedded deployment rendering');
};
