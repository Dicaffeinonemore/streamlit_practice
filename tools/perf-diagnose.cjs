// Local diagnostic only; uses an isolated Chrome profile and does not alter game files.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const { spawn } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'bmk-perf-'));
const delay = ms => new Promise(r => setTimeout(r, ms));
let browser, ws, session, serial = 0;
const pending = new Map(), errors = [];
const server = http.createServer((req, res) => {
  const file = path.resolve(root, '.' + new URL(req.url, 'http://localhost').pathname.replace(/\/$/, '/index.html'));
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404).end(); return; }
  res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.json') ? 'application/json' : file.endsWith('.png') ? 'image/png' : 'text/html; charset=utf-8');
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
    // Track every Image, including detached atlas images, before application scripts run.
    await call('Page.addScriptToEvaluateOnNewDocument', {source:`window.__images=[];const NativeImage=Image;window.Image=class extends NativeImage{constructor(...a){super(...a);this.__origin=new Error().stack.split('\\n')[2];__images.push(this)}};window.__long=[];new PerformanceObserver(l=>__long.push(...l.getEntries().map(e=>({start:e.startTime,duration:e.duration})))).observe({type:'longtask',buffered:true});`});
    console.log('Navigating');
    await call('Page.navigate', {url:'http://127.0.0.1:' + server.address().port + '/index.html'});
    for(let n=0;n<300;n++) {if(await evaluate(`typeof scene!=='undefined'&&document.readyState==='complete'`))break;await delay(100);}
    await delay(1500);
    const report = {environment: await call('Browser.getVersion', {}, null), gpu: await call('SystemInfo.getInfo', {}, null)};
    report.loading = await evaluate(`({navigation:performance.getEntriesByType('navigation').map(n=>({domContentLoaded:n.domContentLoadedEventEnd,load:n.loadEventEnd})),jsBytes:performance.getEntriesByType('resource').filter(r=>r.name.endsWith('.js')).reduce((s,r)=>s+r.decodedBodySize,0),longTasks:__long,images:__images.map(i=>({width:i.naturalWidth,height:i.naturalHeight,origin:i.__origin,source:i.src.startsWith('data:')?'embedded':new URL(i.src).pathname})),heap:performance.memory?.usedJSHeapSize,renderScale:RENDER_K})`);
    console.log('Loaded', JSON.stringify({jsBytes:report.loading.jsBytes,images:report.loading.images.length,rgbaMiB:report.loading.images.reduce((s,i)=>s+i.width*i.height*4,0)/1048576}));
    await evaluate(`window.__raf=requestAnimationFrame;window.requestAnimationFrame=()=>0;`);
    await delay(100);
    await evaluate(`player=newPlayer();startStage(0);scene='play';showScreen(null);player.inv=999999;enemies=['grunt','rogue','archer','brute'].map((t,i)=>mkEnemy(t,200+i*85,420));barrels=[];waveIdx=stage.waves.length;window.__measure=async function(label,n=100){let gaps=[],costs=[],prev;for(let i=0;i<n;i++){await new Promise(r=>__raf(t=>{if(prev)gaps.push(t-prev);prev=t;const a=performance.now();ctx.setTransform(RENDER_K,0,0,RENDER_K,0,0);render();costs.push(performance.now()-a);r()}));}const stats=a=>{a.sort((x,y)=>x-y);return {mean:a.reduce((s,x)=>s+x,0)/a.length,p50:a[Math.floor(a.length*.5)],p95:a[Math.floor(a.length*.95)],max:a.at(-1)}};return {label,scale:RENDER_K,frame:stats(gaps),render:stats(costs)}};`);
    report.samples=[];
    for(const scale of [1, 3]) {
      await evaluate(`RENDER_K=${scale};cv.width=W*RENDER_K;cv.height=H*RENDER_K;`);
      report.samples.push(await evaluate(`__measure('stage1-scale${scale}')`));
    }
    await evaluate(`window.__buttons=updateSkillButtons;updateSkillButtons=()=>{};`);
    report.samples.push(await evaluate(`__measure('scale3-no-dom-buttons')`));
    await evaluate(`updateSkillButtons=__buttons;window.__oldFlash=UX.options.flash;enemies.forEach(e=>e.flash=10);`);
    report.samples.push(await evaluate(`__measure('scale3-enemy-flash')`));
    await evaluate(`UX.options.flash=false;`);
    report.samples.push(await evaluate(`__measure('scale3-flash-disabled')`));
    await evaluate(`UX.options.flash=__oldFlash;enemies.forEach(e=>e.flash=0);RENDER_K=1;cv.width=W;cv.height=H;`);
    report.cpu = await evaluate(`(()=>{const result={};for(const name of ['update','drawBackdrop','drawFloor','drawGroundFx','drawTopFx','drawHUD','updateSkillButtons','render']){const fn=eval(name),a=performance.now();for(let n=0;n<150;n++){if(name==='drawGroundFx')fn(fxGround.L);else if(name==='drawTopFx')fn(fxTop.L);else if(name==='drawBackdrop')fn('stage1',0);else if(name==='drawFloor')fn('stage1');else fn();}result[name]=(performance.now()-a)/150;}return result})()`);
    report.live=[];
    await evaluate(`window.__liveRender=render;window.__liveUpdate=update;window.__times={r:[],u:[]};render=function(){const t=performance.now();__liveRender();__times.r.push(performance.now()-t)};update=function(){const t=performance.now();const result=__liveUpdate();__times.u.push(performance.now()-t);return result};requestAnimationFrame=__raf;last=performance.now();acc=0;requestAnimationFrame(loop);window.__live=async function(label){__times={r:[],u:[]};const gaps=[];let previous;for(let n=0;n<180;n++){await new Promise(r=>__raf(t=>{if(previous)gaps.push(t-previous);previous=t;player.inv=999999;player.hp=player.max;for(const e of enemies)e.hp=e.max;keys.KeyD=n%120<60;keys.KeyA=!keys.KeyD;keys.KeyJ=true;if(n%18===0)pressed.KeyJ=150;r()}))}clearInput();const stats=a=>{a.sort((a,b)=>a-b);return {mean:a.reduce((s,x)=>s+x,0)/a.length,p50:a[Math.floor(a.length*.5)],p95:a[Math.floor(a.length*.95)],max:a.at(-1),over25ms:a.filter(t=>t>25).length}};return {label,frame:stats(gaps),render:stats(__times.r),update:stats(__times.u),scene,enemies:enemies.length}};`);
    for(const scale of [1,3]) {
      await evaluate(`player=newPlayer();startStage(0);scene='play';showScreen(null);player.inv=999999;enemies=['grunt','rogue','archer','brute'].map((t,i)=>mkEnemy(t,200+i*85,420));waveIdx=stage.waves.length;RENDER_K=${scale};cv.width=W*RENDER_K;cv.height=H*RENDER_K;`);
      report.live.push(await evaluate(`__live('moving-combat-scale${scale}')`));
    }
    report.errors=errors;
    fs.writeFileSync(path.join(root,process.env.PERF_SOFTWARE ? 'artifacts/performance-diagnosis-software.json' : 'artifacts/performance-diagnosis.json'), JSON.stringify(report,null,2));
    console.log(JSON.stringify({samples:report.samples,cpu:report.cpu,live:report.live,gpu:report.gpu.gpu.featureStatus,errors},null,2));
  } finally {if(ws)ws.close();if(browser)browser.kill();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
