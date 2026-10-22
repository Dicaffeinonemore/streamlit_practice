// Load-only smoke check requested for Viesa. No combat suites or attack inputs.
const fs=require('fs'),path=require('path'),http=require('http'),os=require('os');
const {spawn}=require('child_process');
const root=path.resolve(__dirname,'..'),out=path.join(root,'artifacts/viesa-1.41-load');fs.mkdirSync(out,{recursive:true});
const errors=[],pending=new Map();let browser,ws,session,id=0;
const server=http.createServer((req,res)=>{
  const file=path.resolve(root,'.'+decodeURIComponent(req.url==='/'?'/index.html':req.url.split('?')[0]));
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404).end();return;}
  res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.html')?'text/html; charset=utf-8':'application/octet-stream');fs.createReadStream(file).pipe(res);
});
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'bmk-viesa-load-'));
const delay=ms=>new Promise(r=>setTimeout(r,ms));
function call(method,params={},sid=session){return new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params,...(sid?{sessionId:sid}:{})}));});}
async function evaluate(expression){const r=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;}
async function screenshot(name){const r=await call('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,name+'.png'),Buffer.from(r.data,'base64'));}
(async()=>{try{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const chrome=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(fs.existsSync);
  browser=spawn(chrome,['--headless=new','--no-sandbox','--disable-gpu','--no-first-run','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:'ignore',windowsHide:true});
  const portFile=path.join(profile,'DevToolsActivePort');for(let i=0;i<100&&!fs.existsSync(portFile);i++)await delay(100);
  const [port,endpoint]=fs.readFileSync(portFile,'utf8').trim().split(/\r?\n/);ws=new WebSocket('ws://127.0.0.1:'+port+endpoint);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});
  ws.onmessage=({data})=>{const m=JSON.parse(data);if(m.id){const h=pending.get(m.id);if(h){pending.delete(m.id);m.error?h.reject(m.error):h.resolve(m.result);}}
    else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);};
  const target=await call('Target.createTarget',{url:'about:blank'},null);session=(await call('Target.attachToTarget',{targetId:target.targetId,flatten:true},null)).sessionId;
  await call('Page.enable');await call('Runtime.enable');await call('Emulation.setDeviceMetricsOverride',{width:1280,height:720,deviceScaleFactor:1,mobile:false});
  await call('Page.navigate',{url:'http://127.0.0.1:'+server.address().port});
  for(let i=0;i<200;i++){if(await evaluate('document.readyState==="complete"&&typeof scene!=="undefined"&&typeof UX!=="undefined"'))break;await delay(100);}
  await evaluate('requestAnimationFrame=()=>0;VIESA_READY');
  await evaluate(`$('btnStart').click();$('characterViesa').click();drawCharacterPreview()`);await screenshot('character-select');
  await evaluate(`$('btnCharacterConfirm').click()`);await screenshot('controls');
  await evaluate(`$('btnGo').click();finishOpening();scene='play';bannerT=0;player.inv=0;ctx.setTransform(RENDER_K,0,0,RENDER_K,0,0);render()`);await screenshot('stage1');
  const state=await evaluate(`({version:VIESA_ART.version,scene,characterId:player.characterId,hp:player.hp,max:player.max,stage:stageIdx+1,imagesReady:VIESA_SHEETS.every(im=>im.naturalWidth>0),clips:Object.fromEntries(Object.entries(VIESA_ART.clips).map(([name,list])=>[name,list.length])),save:UX.checkpoint()})`);
  if(errors.length)throw Error(errors.join('\n'));
  fs.writeFileSync(path.join(out,'load.json'),JSON.stringify({check:'Load only; no gameplay/combat suite',...state,errors},null,2));console.log(JSON.stringify({loaded:true,...state,errors}));
}catch(e){console.error(e);process.exitCode=1;}finally{ws?.close();browser?.kill();server.close();}})();
