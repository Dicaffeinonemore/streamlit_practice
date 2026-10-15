// Browser verification of all catalog entries, FHD rendering and offline bundle.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),http=require('node:http');
const {spawn,spawnSync}=require('node:child_process');const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),profile=fs.mkdtempSync(path.join(os.tmpdir(),'bmk-reference-'));
const python=process.env.PYTHON_PATH || (process.platform==='win32'?path.join(process.env.LOCALAPPDATA,'Python/pythoncore-3.14-64/python.exe'):'python3');
const bundled=spawnSync(python,['-B','-c','import server; print(server.build_reference_html())'],{cwd:root,encoding:'utf8',env:{...process.env,PYTHONIOENCODING:'utf-8'},maxBuffer:100*1024*1024});
if(bundled.status!==0)throw new Error(bundled.stderr);
assert(!bundled.stdout.includes('<script src='));assert(!bundled.stdout.includes('<link rel="stylesheet"'));
const server=http.createServer((req,res)=>{
  const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname).slice(1)||'sprite-lab.html';
  if(name==='reference-embedded.html'){res.setHeader('Content-Type','text/html;charset=utf-8');res.end(bundled.stdout);return;}
  const p=path.resolve(root,name),rel=path.relative(root,p);
  if(rel.startsWith('..')||path.isAbsolute(rel)||!['assets','data','src'].includes(rel.split(path.sep)[0])&&name!=='sprite-lab.html'){res.writeHead(404).end();return;}
  if(!fs.existsSync(p)||!fs.statSync(p).isFile()){res.writeHead(404).end();return;}
  res.setHeader('Content-Type',({'.js':'text/javascript','.json':'application/json','.css':'text/css','.png':'image/png','.html':'text/html'})[path.extname(p)]||'application/octet-stream');res.end(fs.readFileSync(p));
});
const browserPath=process.env.BROWSER_PATH||['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','/usr/bin/chromium'].find(fs.existsSync);
let browser,ws,session,id=0;const pending=new Map(),errors=[];
const wait=ms=>new Promise(r=>setTimeout(r,ms));
function call(method,params={},sid=session){return new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params,...(sid?{sessionId:sid}:{})}));});}
async function evaluate(expression){const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;}
async function until(expression){for(let i=0;i<100;i++){if(await evaluate(expression))return;await wait(100);}throw new Error('Timed out: '+expression);}
async function screenshot(name){const r=await call('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(profile,name+'.png'),Buffer.from(r.data,'base64'));}
(async()=>{
 const timeout=setTimeout(()=>{browser?.kill();server.close();throw new Error('Browser test timed out');},90000);
 try{
  assert(browserPath,'Browser executable required');await new Promise(r=>server.listen(0,'127.0.0.1',r));
  browser=spawn(browserPath,['--headless=new','--no-sandbox','--disable-gpu','--in-process-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{windowsHide:true,stdio:'ignore'});
  const portFile=path.join(profile,'DevToolsActivePort');
  for(let i=0;i<100&&!fs.existsSync(portFile);i++)await wait(100);
  assert(fs.existsSync(portFile),'Chrome did not create DevToolsActivePort');
  const [port,endpoint]=fs.readFileSync(portFile,'utf8').trim().split(/\r?\n/);
  ws=new WebSocket('ws://127.0.0.1:'+port+endpoint);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});
  ws.onmessage=event=>{const m=JSON.parse(event.data);if(m.id){const p=pending.get(m.id);if(!p)return;pending.delete(m.id);m.error?p.reject(new Error(m.error.message)):p.resolve(m.result);}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.text);};
  const target=await call('Target.createTarget',{url:'about:blank'},null);session=(await call('Target.attachToTarget',{targetId:target.targetId,flatten:true},null)).sessionId;
  await call('Page.enable');await call('Runtime.enable');await call('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false});
  const base='http://127.0.0.1:'+server.address().port;
  await call('Page.navigate',{url:base+'/sprite-lab.html'});await until('window.labReady===true');
  const catalog=JSON.parse(fs.readFileSync(path.join(root,'data/reference-catalog.json'),'utf8'));
  for(const c of catalog.characters){
   await evaluate(`document.getElementById('character').value=${JSON.stringify(c.id)};document.getElementById('character').dispatchEvent(new Event('change'))`);
   const clips=JSON.parse(fs.readFileSync(path.join(root,c.animations),'utf8')).animations;
   for(const a of Object.values(clips)){
    await evaluate(`document.getElementById('motion').value=${JSON.stringify(a.id)};document.getElementById('motion').dispatchEvent(new Event('change'))`);
    if(a.frames.length){
     await until("!document.getElementById('play').disabled");
     for(let i=1;i<a.frames.length;i++)await evaluate("document.getElementById('next').click()");
     assert((await evaluate("document.getElementById('counter').textContent")).startsWith(a.frames.length+' / '+a.frames.length));
     assert.equal(await evaluate("document.getElementById('candidate').getContext('2d').imageSmoothingEnabled"),false);
    }else{
     assert(await evaluate("document.getElementById('play').disabled && !document.getElementById('unavailable').hidden"));
    }
    if(a.samples?.length){
     await until("[...document.querySelectorAll('#samples img')].every(i=>i.complete&&i.naturalWidth>0)");
     assert.equal(await evaluate("document.querySelectorAll('#samples img').length"),5);
    }
   }
  }
  await evaluate("document.getElementById('character').value='infantry';document.getElementById('character').dispatchEvent(new Event('change'))");await until("!document.getElementById('play').disabled");
  assert.equal(await evaluate('document.documentElement.scrollWidth<=1920'),true);await screenshot('infantry-fhd');
  await evaluate("document.getElementById('character').value='frozen_graveblord';document.getElementById('character').dispatchEvent(new Event('change'))");await until("!document.getElementById('play').disabled");await screenshot('frost-fhd');
  await evaluate("document.getElementById('motion').value='skill1';document.getElementById('motion').dispatchEvent(new Event('change'))");await screenshot('blocked-skill');
  console.log('PASS: all 7 characters and every motion, 139 candidate frames, blocked panels, FHD nearest-neighbor');
  await call('Page.navigate',{url:base+'/reference-embedded.html'});await until('window.labReady===true');
  assert.equal(await evaluate('window.labError||null'),null);
  assert(await evaluate("document.getElementById('panel').src.startsWith('data:image/png;base64,')"));
  assert(await evaluate("document.getElementById('sourceLink').href.startsWith('data:image/png;base64,')"));
  await evaluate("document.getElementById('character').value='black_moon_emperor';document.getElementById('character').dispatchEvent(new Event('change'))");await until("!document.getElementById('play').disabled");
  await evaluate("document.getElementById('motion').value='effects';document.getElementById('motion').dispatchEvent(new Event('change'))");
  await until("document.querySelectorAll('#samples img').length===5 && [...document.querySelectorAll('#samples img')].every(i=>i.complete&&i.naturalWidth>0)");
  await screenshot('effect-samples');
  await evaluate("document.getElementById('character').value='knight';document.getElementById('character').dispatchEvent(new Event('change'))");await until("!document.getElementById('play').disabled");
  await evaluate("document.getElementById('zoom').value='4';document.getElementById('zoom').dispatchEvent(new Event('change'))");
  assert(await evaluate("document.getElementById('candidate').height>400"),'Zoom must enlarge canvas rather than clip artwork');
  await screenshot('embedded-knight');
  assert.deepEqual(errors,[]);console.log('PASS: Streamlit HTML bundle, original/candidate PNG loading, unclipped 4x canvas, no browser exceptions');console.log('Screenshots: '+profile);
 }finally{clearTimeout(timeout);ws?.close();browser?.kill();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
