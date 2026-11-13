const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
module.exports=async({evaluate,call,errors,root,base,ready})=>{
  const supplied=JSON.parse(fs.readFileSync(path.join(root,'data/mobile-layout-iphone-mini.json'),'utf8'));
  await call('Emulation.setUserAgentOverride',{userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1'});
  const metrics={width:812,height:375,screenWidth:375,screenHeight:812,deviceScaleFactor:1,mobile:true};
  await call('Emulation.setDeviceMetricsOverride',metrics);
  for(const page of ['index.html','embedded.html']){
    await ready(base+'/'+page);
    assert.deepEqual(await evaluate('MOBILE_DISPLAY.profile.layout'),supplied.layout,'approved layout preserved');
    await evaluate(`requestAnimationFrame=()=>0;AUDIO.enable(false);beginGame();scene='play';UX.options.touch=true;showScreen(null);fitCanvas();render();`);
    const dimensions=await evaluate(`(()=>{
      const r=$('wrap').getBoundingClientRect(),stick=$('touchStick').getBoundingClientRect(),pad=$('touchPad').getBoundingClientRect();
      return {active:document.documentElement.classList.contains('mini-landscape'),x:r.x,y:r.y,w:r.width,h:r.height,b:r.bottom,right:r.right,stickLeft:stick.left,padRight:pad.right,W,H,dy:UX.options.touchLayout.items.stick.dy};
    })()`);
    assert(dimensions.active&&dimensions.x>=50&&dimensions.right<=762&&dimensions.y>=0&&dimensions.b<=354.5,JSON.stringify(dimensions));
    assert(Math.abs(dimensions.w/dimensions.h-16/9)<.01);
    assert(dimensions.stickLeft>=50&&dimensions.padRight<=762);
    assert.equal(dimensions.W,960);assert.equal(dimensions.H,540);
    assert.equal(dimensions.dy,supplied.layout.items.stick.dy);
    await call('Emulation.setDeviceMetricsOverride',{...metrics,width:375,height:812});
    await evaluate('new Promise(r=>setTimeout(r,100))');
    assert.equal(await evaluate(`document.documentElement.classList.contains('mini-landscape')`),false,'landscape inset removed on rotation');
    await call('Emulation.setDeviceMetricsOverride',metrics);
    await evaluate('new Promise(r=>setTimeout(r,100))');
    assert.equal(await evaluate(`document.documentElement.classList.contains('mini-landscape')`),true,'profile restored on rotation');
  }
  await evaluate('(async()=>{await GameAssets.stageReady;await BAREL_ATLAS.decode();fitCanvas();render()})()');
  const shot=await call('Page.captureScreenshot',{format:'png'});
  fs.mkdirSync(path.join(root,'artifacts/mini-display'),{recursive:true});fs.writeFileSync(path.join(root,'artifacts/mini-display/landscape.png'),Buffer.from(shot.data,'base64'));
  await call('Emulation.setUserAgentOverride',{userAgent:'Mozilla/5.0 desktop test'});
  await call('Emulation.setDeviceMetricsOverride',{width:1280,height:720,deviceScaleFactor:1,mobile:false});
  await ready(base+'/index.html');
  assert.equal(await evaluate('MOBILE_DISPLAY.matches()'),false,'desktop uses regular layout');
  assert.deepEqual(errors,[]);
  console.log('PASS approved mini profile: local/embedded, safe bounds, 16:9, rotation and desktop isolation');
};
