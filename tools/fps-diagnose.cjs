// Compare the OS/Chrome energy-saver cap in an isolated temporary Chrome profile.
// Changes only that profile's setting; never touches the user's browser or Windows power settings.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const { spawn } = require('node:child_process');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'bmk-perf-'));
const delay = ms => new Promise(r => setTimeout(r, ms));
let mode='normal';let browser, ws, session, serial = 0;
const pending = new Map(), errors = [];
const server = http.createServer((req, res) => {
  const file = path.resolve(root, '.' + new URL(req.url, 'http://localhost').pathname.replace(/\/$/, '/index.html'));
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404).end(); return; }
  const mime = {'.js':'text/javascript','.json':'application/json','.png':'image/png','.webp':'image/webp','.gif':'image/gif','.mp3':'audio/mpeg'};
  res.setHeader('Content-Type', mime[path.extname(file)] || 'text/html; charset=utf-8');
  if(file.endsWith('index.html')&&mode==='blank'){res.end('<!doctype html><html><body></body></html>');return;}
  fs.createReadStream(file).pipe(res);
});
function call(method, params = {}, sid = session) {
  return new Promise((resolve, reject) => {
    const id = ++serial;
    const timer = setTimeout(() => { pending.delete(id); reject(Error('CDP timeout: ' + method)); }, 45000);
    pending.set(id, { resolve: r => {clearTimeout(timer);resolve(r);}, reject: e => {clearTimeout(timer);reject(e);} });
    ws.send(JSON.stringify({ id, method, params, ...(sid ? {sessionId: sid} : {}) }));
  });
}
async function evaluate(expression) {
  const r = await call('Runtime.evaluate', {expression, returnByValue: true, awaitPromise: true});
  if (r.exceptionDetails) throw Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result.value;
}
(async () => {
  try {
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    const executable = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(fs.existsSync);
    browser = spawn(executable, ['--headless=new', '--no-sandbox', ...(process.env.PERF_SOFTWARE ? ['--disable-gpu'] : []), '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0', '--user-data-dir=' + profile, 'about:blank'], {stdio: 'ignore', windowsHide: true});
    const portFile = path.join(profile, 'DevToolsActivePort');
    for (let n = 0; n < 100 && !fs.existsSync(portFile); n++) await delay(100);
    const [port, endpoint] = fs.readFileSync(portFile, 'utf8').trim().split(/\r?\n/);
    ws = new WebSocket('ws://127.0.0.1:' + port + endpoint);
    await new Promise((r, j) => {ws.onopen = r; ws.onerror = j;});
    ws.onmessage = ({data}) => {
      const m = JSON.parse(data);
      if (m.id) { const p = pending.get(m.id); if (p) {pending.delete(m.id); m.error ? p.reject(m.error) : p.resolve(m.result);} }
      else if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.text);
    };
    console.log('Browser connected');
    const target = await call('Target.createTarget', {url:'about:blank'}, null);
    session = (await call('Target.attachToTarget', {targetId:target.targetId, flatten:true}, null)).sessionId;
    await call('Page.enable'); await call('Runtime.enable');
    await call('Emulation.setDeviceMetricsOverride', {width:1280,height:720,deviceScaleFactor:1,mobile:false});


    const results=[];
    for(mode of ['blank','normal']){
      await call('Page.navigate',{url:'http://127.0.0.1:'+server.address().port+'/index.html?debug=1'});await delay(1800);
      if(mode==='normal')await evaluate('GameAssets.stageReady');
      await evaluate(`window.nativeRAF=requestAnimationFrame;if(typeof loopRequest!=='undefined'){cancelAnimationFrame(loopRequest);clearTimeout(loopTimeout)}window.gaps=async function(){let last;const a=[];for(let i=0;i<65;i++)await new Promise(r=>nativeRAF(t=>{if(last)a.push(t-last);last=t;r()}));return {mean:a.reduce((s,v)=>s+v,0)/a.length,min:Math.min(...a),max:Math.max(...a)}};requestAnimationFrame=()=>0;`);
      const result={label:mode,raf:await evaluate('gaps()')};results.push(result);console.log(JSON.stringify(result));
    }

    await call('Page.navigate',{url:'chrome://settings/performance'});await delay(1000);
    const pref=await evaluate(`new Promise(r=>chrome.settingsPrivate.getPref('performance_tuning.battery_saver_mode.state',r))`);console.log('TEMP_PROFILE_PREF',JSON.stringify(pref));
    const changed=await evaluate(`new Promise(r=>chrome.settingsPrivate.setPref('performance_tuning.battery_saver_mode.state',0,'',r))`);console.log('TEMP_PROFILE_DISABLED',changed);
    for(mode of ['blank','normal']){
      await call('Page.navigate',{url:'http://127.0.0.1:'+server.address().port+'/index.html?debug=1'});await delay(1800);
      if(mode==='normal')await evaluate('GameAssets.stageReady');
      await evaluate(`window.nativeRAF=requestAnimationFrame;if(typeof loopRequest!=='undefined'){cancelAnimationFrame(loopRequest);clearTimeout(loopTimeout)}window.gaps=async function(){let last;const a=[];for(let i=0;i<65;i++)await new Promise(r=>nativeRAF(t=>{if(last)a.push(t-last);last=t;r()}));return {mean:a.reduce((s,v)=>s+v,0)/a.length,min:Math.min(...a),max:Math.max(...a)}};requestAnimationFrame=()=>0;`);
      const result={label:mode+'-energy-saver-off',raf:await evaluate('gaps()')};results.push(result);console.log(JSON.stringify(result));
    }
    await evaluate(`beginGame();startStage(3);scene='play';showScreen(null);waveIdx=stage.waves.length;barrels=[];enemies=['grunt','rogue','archer','brute'].map((type,i)=>mkEnemy(type,260+i*70,420));player.inv=999999;GameAssets.stageReady`);
    await evaluate(`requestAnimationFrame=nativeRAF;GamePerf.reset();last=performance.now();acc=0;wakeLoop()`);
    await delay(2200);
    results.push({label:'stage4-live-energy-saver-off',stats:await evaluate('GamePerf.snapshot()')});
    await evaluate(`vargulDebugStart();{const e=enemies.find(isVargul);e.st='chase';e.phaseT=0;e.invuln=false;e.p2shown=true;e.x=player.x+170;e.y=player.y;vargulRepeat='cross';e.atkCd=0;player.inv=999999;}scene='play';GamePerf.reset();`);
    await delay(2200);
    results.push({label:'vargul-p2-live-energy-saver-off',stats:await evaluate('GamePerf.snapshot()')});
    assert.deepEqual(errors,[]);
    console.log(JSON.stringify(results.slice(-2),null,2));
    fs.writeFileSync(path.join(root,'artifacts/fps-variants.json'),JSON.stringify(results,null,2));
  }finally{if(ws)ws.close();if(browser)browser.kill();server.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
