const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
module.exports=async({evaluate,call,errors,root,base})=>{
  await call('Page.navigate',{url:base+'/index.html'});
  for(let n=0;n<150;n++){
    if(await evaluate('typeof UX!=="undefined"'))break;
    await new Promise(r=>setTimeout(r,100));
  }
  await evaluate(`localStorage.setItem('bmk_settings',JSON.stringify({music:.23,touchLayout:{scale:.8,alpha:.5,items:{}}}));localStorage.setItem('bmk_checkpoint','{"sentinel":true}')`);
  await call('Page.navigate',{url:base+'/mobile-lab.html'});
  for(let n=0;n<150;n++){
    if(await evaluate('typeof ready!=="undefined"&&ready'))break;
    await new Promise(r=>setTimeout(r,100));
  }
  assert.equal(await evaluate('ready'),true,'lab connects to live game');
  assert.equal(await evaluate(`JSON.parse(localStorage.getItem('bmk_settings')).music`),.23);
  assert.equal(await evaluate(`localStorage.getItem('bmk_checkpoint')`),'{"sentinel":true}','preview must not overwrite checkpoint');
  const reports=await evaluate('runBatch()');assert.equal(reports.length,20);
  assert(reports.every(r=>r.controls.length===11),'all controls measured for Barel: '+JSON.stringify(reports.map(r=>[r.device,r.controls.length])));
  assert(reports.every(r=>r.viewport.width>0&&r.game.width>0));
  assert(reports.some(r=>r.issues.length>0),'tight viewports expose layout problems');
  const result=await evaluate(`(()=>{
    $('device').value='custom';$('width').value=844;$('height').value=390;
    $('left').value=47;$('right').value=47;$('bottom').value=21;$('top').value=0;resize();
    const l=currentLayout();l.items.KeyU={dx:30,dy:0,k:1,hide:false};api.UX.setTouchLayout(l);
    const before=inspect(false).issues.some(i=>i.type==='outside'&&i.ids.includes('KeyU'));
    fitControls();const after=inspect(false).issues.some(i=>i.type==='outside'&&i.ids.includes('KeyU'));
    const s=snapshot();api.UX.setTouchLayout({});restore(s);return {before,after,restored:JSON.stringify(currentLayout())===JSON.stringify(s.layout)};
  })()`);
  assert.deepEqual(result,{before:true,after:false,restored:true});
  assert.equal(await evaluate(`(()=>{try{restore({version:1,layout:{},viewport:{}});return false;}catch{return true;}})()`),true,'reject invalid profiles');
  await evaluate(`$('save').click();$('scale').value=1.5;updateLayout();$('load').click();$('apply').click();`);
  assert.equal(await evaluate(`JSON.parse(localStorage.getItem('bmk_settings')).music`),.23,'applying layout preserves other preferences');
  assert.equal(await evaluate(`JSON.stringify(JSON.parse(localStorage.getItem('bmk_settings')).touchLayout)===JSON.stringify(currentLayout())`),true);
  await evaluate(`$('character').value='viesa';setScene()`);
  assert.equal(await evaluate('inspect(false).controls.length'),10,'Viesa hides scroll control');
  await call('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await new Promise(r=>setTimeout(r,150));
  const shot=await call('Page.captureScreenshot',{format:'png'});
  const out=path.join(root,'artifacts/mobile-lab');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'desktop.png'),Buffer.from(shot.data,'base64'));
  fs.writeFileSync(path.join(out,'viewport-report.json'),JSON.stringify(reports,null,2));
  await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:false});
  await new Promise(r=>setTimeout(r,150));
  assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'),true,'tool fits a narrow browser');
  assert.deepEqual(errors,[]);
  console.log('PASS mobile lab: 20 viewports, clipping detection, fitting, profile roundtrip, character switching, isolated saves and responsive layout');
};
