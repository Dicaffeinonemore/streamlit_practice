const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
module.exports = async ({evaluate, call, errors, root}) => {
  const result = {stages:[]};
  async function loaded() {
    for(let n=0;n<300;n++){
      const state=await evaluate('({loading:GAME_ASSETS.loading,error:GAME_ASSETS.error})');
      assert.equal(state.error,null);
      if(!state.loading)return;
      await new Promise(r=>setTimeout(r,100));
    }
    throw Error('Assets did not become ready');
  }
  await loaded();
  result.title=await evaluate('GAME_ASSETS.stats()');
  assert(result.title.images.every(i=>['common','first-scene'].includes(i.group)));
  await evaluate('requestAnimationFrame=()=>0; AUDIO.enable(false); beginGame(true);');
  await loaded();
  assert(await evaluate("Array.from({length:6},(_,i)=>RELEASE_IMAGES['opening'+i].naturalWidth).every(Boolean)"),'all opening frames loaded');
  await evaluate('finishOpening()');
  await loaded();
  for(const stage of [0,1,2,3,4,0,3]){
    const before=await evaluate(`(()=>{startStage(${stage});const ticks=stat.ticks;loop(performance.now());return {ticks,after:stat.ticks,loading:GAME_ASSETS.loading};})()`);
    assert.equal(before.loading,true);
    assert.equal(before.ticks,before.after,'loading must freeze game time');
    await loaded();
    const stats=await evaluate('GAME_ASSETS.stats()');
    assert(stats.images.every(i=>i.group==='common'||i.group===`stage${stage}`||(stage===0&&i.group==='first-scene')));
    assert(stats.images.some(i=>i.group===`stage${stage}`));
    await evaluate(`scene='play';showScreen(null);player.inv=99999;enemies=[mkEnemy('boss${stage+1}',410,430)];enemies[0].st='chase';for(let i=0;i<120;i++){update();}render();`);
    result.stages.push({stage,...stats});
  }
  await call('Emulation.setDeviceMetricsOverride',{width:812,height:375,deviceScaleFactor:3,mobile:true});
  await evaluate('render()');
  const out=path.join(root,'artifacts/mobile-loading');
  fs.mkdirSync(out,{recursive:true});
  const shot=await call('Page.captureScreenshot',{format:'png'});
  fs.writeFileSync(path.join(out,'stage4-landscape.png'),Buffer.from(shot.data,'base64'));
  await call('Network.enable');
  await call('Network.setCacheDisabled',{cacheDisabled:true});
  const blocked=await evaluate("Object.keys(GAME_ASSET_GROUPS).find(k=>GAME_ASSET_GROUPS[k]==='stage1')");
  await call('Network.setBlockedURLs',{urls:['*'+blocked.split('/').at(-1)]});
  await evaluate('startStage(1)');
  for(let n=0;n<100&&!await evaluate('!!GAME_ASSETS.error');n++)await new Promise(r=>setTimeout(r,100));
  assert(await evaluate('GAME_ASSETS.loading && !!GAME_ASSETS.error'),'failed load stays paused');
  await call('Network.setBlockedURLs',{urls:[]});
  await evaluate("document.querySelector('#assetLoading button').click()");
  await loaded();
  await evaluate('toTitle()');
  await loaded();
  assert(await evaluate("GAME_ASSETS.stats().images.every(i=>['common','first-scene'].includes(i.group))"),'return to title releases stage');
  assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(result,null,2));
  console.log('PASS mobile loading: title, all 5 bosses, revisits, release, network failure/retry');
  console.log('Decoded title MB: '+result.title.images.reduce((n,i)=>n+i.bytes,0)/1e6);
  console.log('Decoded stage MB: '+result.stages.map(s=>s.images.reduce((n,i)=>n+i.bytes,0)/1e6).join(', '));
};
