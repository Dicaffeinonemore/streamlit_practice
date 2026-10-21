const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
module.exports = async ({evaluate, call, errors, root}) => {
  const out = path.join(root, 'artifacts/boss-intro-hud');
  fs.mkdirSync(out, {recursive:true});
  await evaluate(`(async()=>{await Promise.all([PIXEL_UI.decode(), BOSS_UI.decode()]);window.requestAnimationFrame=()=>0;UX.options.touch=false;document.body.classList.remove('touch');})()`);
  const capture = async name => {
    await evaluate("fitCanvas();ctx.setTransform(RENDER_K,0,0,RENDER_K,0,0);render()");
    const shot = await call('Page.captureScreenshot',{format:'png'});
    fs.writeFileSync(path.join(out,name+'.png'),Buffer.from(shot.data,'base64'));
  };
  for(let stage=0;stage<5;stage++) {
    await evaluate(`UX.record(${stage},1000,'A',100);beginBossChallenge(${stage});`);
    assert.equal(await evaluate(`(()=>{
      const b=introBoss;
      // Advance the real intro to its name-card segment.
      while(introT<bossIntroDuration(b)*.6)updIntro();
      drawBossBar(b);if(b.hud)return false;
      pauseGame();drawBossBar(b);if(b.hud)return false;
      openSettings('pause');drawBossBar(b);if(b.hud)return false;
      closeSettings();resumeGame();return scene==='bossintro'&&b.st==='intro';
    })()`),true,`Stage ${stage+1}: intro and paused intro hide boss HP`);
    if(stage===0)await capture('01-during-intro');
    assert.equal(await evaluate(`(()=>{
      while(scene==='bossintro')updIntro();
      drawBossBar(introBoss);
      return scene==='play'&&introBoss.st==='chase'&&introBoss.hud.value===introBoss.hp;
    })()`),true,`Stage ${stage+1}: HP appears when intro completes`);
    if(stage===0)await capture('02-after-intro');
  }
  assert.deepEqual(errors,[]);
  console.log('PASS All five boss intros hide HP, including pause/settings; combat reveals HP. Images: '+out);
};
