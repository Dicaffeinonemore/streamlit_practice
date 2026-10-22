// Verify challenge character selection and initial load; no combat inputs.
const fs=require('fs'),path=require('path'),http=require('http'),os=require('os');
const {spawn}=require('child_process');
const root=path.resolve(__dirname,'..'),out=path.join(root,'artifacts/challenge-character-select');fs.mkdirSync(out,{recursive:true});
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
  const state=await evaluate(`(()=>{
    const check=(value,message)=>{if(!value)throw Error(message);};
    AUDIO.enable(false);UX.record(0,0,'C',100);
    const saved=JSON.stringify(UX.checkpoint());
    $('btnBossChallenge').click();$('challengeList').children[0].click();
    check(scene==='characterSelect'&&selectedCharacterId==='barel','Boss choice opens default character selector');
    $('characterViesa').click();$('btnCharacterConfirm').click();
    check(bossChallenge&&stageIdx===0&&player.characterId==='viesa'&&player.max===80,'Challenge starts with Viesa');
    $('btnChallengeRetry').click();check(bossChallenge&&player.characterId==='viesa','Retry preserves Viesa');
    openBossChallenge();$('challengeList').children[0].click();onKeyOnce('Escape');check(scene==='challenge','Escape returns to bosses');
    $('challengeList').children[0].click();$('btnCharacterBack').click();check(scene==='challenge','Back returns to bosses');
    $('challengeList').children[0].click();onKeyOnce('Enter');check(bossChallenge&&player.characterId==='barel'&&player.max===100,'Barel challenge starts');
    check(JSON.stringify(UX.checkpoint())===saved,'Challenge preserves campaign checkpoint');
    toTitle();$('btnStart').click();$('characterViesa').click();confirmCharacter();check(scene==='tutorial','Campaign keeps tutorial flow');
    return {viesa:true,barel:true,retry:true,back:true,escape:true,campaignFlow:true,checkpointPreserved:true};
  })()`);
  await evaluate(`openBossChallenge();$('challengeList').children[0].click();$('characterViesa').click();drawCharacterPreview()`);await screenshot('selector');
  if(errors.length)throw Error(errors.join('\n'));
  fs.writeFileSync(path.join(out,'load.json'),JSON.stringify({...state,errors},null,2));console.log(JSON.stringify(state));

}catch(e){console.error(e);process.exitCode=1;}finally{ws?.close();browser?.kill();server.close();}})();
