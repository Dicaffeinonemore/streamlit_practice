const http = require('node:http');
const os = require('node:os');
const {fs,path,cp,root,read} = require('./common.cjs');
async function openBrowser() {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(),'bmk-extract-'));
  const server=http.createServer((req,res)=>{
    const name=decodeURIComponent(req.url.split('?')[0]);
    const target=path.resolve(root,'.'+(name==='/'?'/index.html':name));
    if(!target.startsWith(root+path.sep)||!fs.existsSync(target)||fs.statSync(target).isDirectory()){res.writeHead(404).end();return;}
    const type={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json','.png':'image/png','.webp':'image/webp','.gif':'image/gif','.mp3':'audio/mpeg'}[path.extname(target)]||'application/octet-stream';
    res.setHeader('Content-Type',type);
    if(target===path.join(root,'index.html')) {
      res.end(read('index.html').replace('<head>',`<head><script>
        window.requestAnimationFrame=()=>0;window.cancelAnimationFrame=()=>{};
        window.__b64=d=>{let s='';for(let i=0;i<d.length;i+=16384)s+=String.fromCharCode(...d.subarray(i,i+16384));return btoa(s);};
        Math.random=(()=>{let s=11939;return()=>((s=(Math.imul(s,1664525)+1013904223)>>>0)/4294967296)})();
      </script>`));
    } else if(target===path.join(root,'audio.js')) {
      // Expose closure synthesis for offline extraction in this isolated page only.
      res.end(read('audio.js').replace('  global.AUDIO = {','  global.__BMK_OFFLINE = {setup,SFX,GAIN,AU};\n  global.AUDIO = {'));
    } else res.end(fs.readFileSync(target));
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const port=server.address().port;
  const executable=process.env.BROWSER_PATH||['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','/usr/bin/chromium','/usr/bin/google-chrome'].find(f=>fs.existsSync(f));
  if(!executable)throw Error('Set BROWSER_PATH to a Chromium executable.');
  const browser=cp.spawn(executable,['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-port=0','--disable-background-networking','--disable-extensions','--force-device-scale-factor=1','--window-size=1280,900','--user-data-dir='+profile,'about:blank'],{windowsHide:true,stdio:'ignore'});
  const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const active=path.join(profile,'DevToolsActivePort');
  for(let i=0;i<200&&!fs.existsSync(active);i++)await sleep(100);
  if(!fs.existsSync(active))throw Error('Browser failed to start; check sandbox/process permissions.');
  const debugPort=fs.readFileSync(active,'utf8').split('\n')[0];
  const tabs=await(await fetch(`http://127.0.0.1:${debugPort}/json`)).json();
  const socket=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject;});
  let id=0;const pending=new Map();const errors=[];
  socket.onmessage=event=>{const msg=JSON.parse(event.data);if(msg.id){const p=pending.get(msg.id);if(p){pending.delete(msg.id);msg.error?p.reject(Error(msg.error.message)):p.resolve(msg.result);}}else if(msg.method==='Runtime.exceptionThrown')errors.push(msg.params.exceptionDetails.exception?.description||msg.params.exceptionDetails.text);};
  function call(method,params={}){return new Promise((resolve,reject)=>{const n=++id;const timeout=setTimeout(()=>{pending.delete(n);reject(Error('CDP timed out: '+method));},method==='Runtime.evaluate'?180000:30000);pending.set(n,{resolve:v=>{clearTimeout(timeout);resolve(v);},reject:e=>{clearTimeout(timeout);reject(e);}});socket.send(JSON.stringify({id:n,method,params}));});}
  async function evaluate(expression){const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;}
  await call('Runtime.enable');await call('Page.enable');
  console.log('Browser connected; loading original source graph');
  await call('Page.navigate',{url:`http://127.0.0.1:${port}/`});
  for(let i=0;i<200;i++) {
    if(await evaluate(`document.readyState==='complete'&&typeof scene!=='undefined'&&typeof BarelRika!=='undefined'`))break;
    await sleep(100);
    if(i===199)throw Error('Source page initialization timed out: '+errors.join('\n'));
  }
  const version=await call('Browser.getVersion');
  return {evaluate,call,errors,version,async close(){socket.close();server.closeAllConnections();server.close();browser.kill();/* The OS temporary isolated profile is retained for diagnostics. */}};
}
module.exports={openBrowser};
