const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
module.exports=async({evaluate,call,root})=>{
  await call('Emulation.setUserAgentOverride',{userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1'});
  await call('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
  await call('Emulation.setDeviceMetricsOverride',{width:375,height:812,screenWidth:375,screenHeight:812,deviceScaleFactor:1,mobile:true});
  await call('Page.navigate',{url:'http://127.0.0.1:8502'});
  let loaded=false;
  for(let i=0;i<300;i++){
    loaded=await evaluate(`(()=>{try{return !!document.querySelector('.st-key-game_host iframe')?.contentWindow.eval('typeof MOBILE_DISPLAY!=="undefined"&&typeof UX!=="undefined"')}catch{return false}})()`);
    if(loaded)break;await new Promise(r=>setTimeout(r,100));
  }
  assert(loaded,'actual Streamlit game iframe loaded');
  async function inspect(){return evaluate(`(()=>{
    const f=document.querySelector('.st-key-game_host iframe'),r=f.getBoundingClientRect(),w=f.contentWindow;
    return {x:r.x,y:r.y,width:r.width,height:r.height,inner:[w.innerWidth,w.innerHeight],mini:w.document.documentElement.classList.contains('mini-landscape'),navigation:getComputedStyle(document.querySelector('.st-key-game_navigation')).display};
  })()`);}
  const portrait=await inspect();
  assert(Math.abs(portrait.x)<1&&Math.abs(portrait.y)<1&&Math.abs(portrait.width-375)<1&&Math.abs(portrait.height-812)<1,JSON.stringify(portrait));
  assert.equal(portrait.mini,false,'portrait phone must not receive landscape mini padding');assert.equal(portrait.navigation,'none');
  await call('Emulation.setDeviceMetricsOverride',{width:812,height:375,screenWidth:375,screenHeight:812,deviceScaleFactor:1,mobile:true});
  await new Promise(r=>setTimeout(r,250));
  const landscape=await inspect();
  assert(Math.abs(landscape.width-812)<1&&Math.abs(landscape.height-375)<1,JSON.stringify(landscape));assert.equal(landscape.mini,true);
  await evaluate(`(async()=>{const w=document.querySelector('.st-key-game_host iframe').contentWindow;await w.eval('GameAssets.stageReady');w.eval('AUDIO.enable(false);beginGame();scene="play";showScreen(null);UX.options.touch=true;syncTouchControls();fitCanvas();render();');})()`);
  const shot=await call('Page.captureScreenshot',{format:'png'});fs.mkdirSync(path.join(root,'artifacts/streamlit-mobile'),{recursive:true});fs.writeFileSync(path.join(root,'artifacts/streamlit-mobile/landscape.png'),Buffer.from(shot.data,'base64'));
  await call('Emulation.setTouchEmulationEnabled',{enabled:false});
  await call('Emulation.setDeviceMetricsOverride',{width:1280,height:720,deviceScaleFactor:1,mobile:false});
  await new Promise(r=>setTimeout(r,250));
  const desktop=await inspect();assert.notEqual(desktop.navigation,'none');assert(desktop.width<1280&&desktop.height<720);
  console.log('PASS actual Streamlit host: portrait/landscape viewport fill, orientation detection and desktop layout');
};
