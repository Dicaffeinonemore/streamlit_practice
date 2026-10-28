// Local diagnostic only; uses an isolated Chrome profile and does not alter game files.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const { spawn } = require('node:child_process');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'bmk-perf-'));
const delay = ms => new Promise(r => setTimeout(r, ms));
let browser, ws, session, serial = 0;
const pending = new Map(), errors = [];
const server = http.createServer((req, res) => {
  const file = path.resolve(root, '.' + new URL(req.url, 'http://localhost').pathname.replace(/\/$/, '/index.html'));
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404).end(); return; }
  const mime = {'.js':'text/javascript','.json':'application/json','.png':'image/png','.webp':'image/webp','.gif':'image/gif','.mp3':'audio/mpeg'};
  res.setHeader('Content-Type', mime[path.extname(file)] || 'text/html; charset=utf-8');
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
    await call('Page.navigate', {url:'http://127.0.0.1:' + server.address().port + '/index.html?debug=1'});
    for(let n=0;n<300;n++) {if(await evaluate(`typeof scene!=='undefined'&&document.readyState==='complete'`))break;await delay(100);}
    await delay(1500);

    const report={label:process.env.PERF_LABEL||'current',gpu:(await call('SystemInfo.getInfo',{},null)).gpu.featureStatus};
    report.loading=await evaluate(`({jsBytes:performance.getEntriesByType('resource').filter(r=>r.name.endsWith('.js')).reduce((s,r)=>s+r.decodedBodySize,0),heap:performance.memory?.usedJSHeapSize,scale:RENDER_K,images:__images.reduce((s,i)=>s+i.naturalWidth*i.naturalHeight*4,0)})`);
    await evaluate(`window.__raf=requestAnimationFrame;requestAnimationFrame=()=>0;`);await delay(100);
    await evaluate(`window.__sample=async function(label){const gaps=[],renderMs=[],updateMs=[];let previous;for(let i=0;i<150;i++){await new Promise(resolve=>__raf(t=>{if(previous)gaps.push(t-previous);previous=t;player.inv=99999;player.hp=player.max;for(const e of enemies)e.hp=e.max;const a=performance.now();update();updateMs.push(performance.now()-a);ctx.setTransform(RENDER_K,0,0,RENDER_K,0,0);const b=performance.now();render();renderMs.push(performance.now()-b);resolve()}))}const stat=a=>{a.sort((x,y)=>x-y);return {mean:a.reduce((s,v)=>s+v,0)/a.length,p95:a[Math.floor(a.length*.95)],max:a.at(-1),over25:a.filter(v=>v>25).length}};return {label,frame:stat(gaps),render:stat(renderMs),update:stat(updateMs)}}`);
    report.samples=[];
    if(process.env.PERF_TRACE) await evaluate(`window.__slow=[];for(const name of ['drawBackdrop','drawFloor','drawHUD','drawEnemy','drawPlayer','drawVargul','paintVargul','drawVargulHazards','presentFx']){const fn=eval(name);window['__orig_'+name]=fn;eval(name+'=function(...args){const t=performance.now();const result=window.__orig_'+name+'(...args);const ms=performance.now()-t;if(ms>10)__slow.push({name:"'+name+'",ms});return result}');}`);
    await evaluate(`player=newPlayer();startStage(3);scene='play';showScreen(null);waveIdx=stage.waves.length;barrels=[];enemies=['grunt','rogue','archer','brute'].map((t,i)=>mkEnemy(t,240+i*65,420));`);
    report.stagePreparationMs=await evaluate(`(async()=>{const t=performance.now();if(typeof GameAssets!=='undefined')await GameAssets.stageReady;return performance.now()-t})()`);
    report.rafControlMs=await evaluate(`(async()=>{const times=[];let previous;for(let n=0;n<60;n++)await new Promise(r=>__raf(t=>{if(previous)times.push(t-previous);previous=t;r()}));return times.reduce((s,v)=>s+v,0)/times.length})()`);
    report.samples.push(await evaluate(`__sample('stage4-field')`));
    for(const phase of [false,true]){
      await evaluate(`{vargulDebugStart();const e=enemies.find(isVargul);e.st='chase';e.phaseT=0;e.invuln=false;e.p2shown=`+phase+`;e.x=player.x+170;e.y=player.y;vargulRepeat='cross';e.atkCd=0;}`);
      report.samples.push(await evaluate(`__sample('vargul-phase`+(phase?2:1)+`-cross')`));
    }
    if (await evaluate('typeof GamePerf!=="undefined"')) {
      await evaluate(`requestAnimationFrame=__raf;scene='play';UX.options.perf=true;$('showPerformance').checked=true;$('showPerformance').onchange();GamePerf.reset();last=performance.now();acc=0;wakeLoop()`);
      await delay(800);
      report.live=await evaluate('GamePerf.snapshot()');
      assert.equal(await evaluate('cv.width===960&&cv.height===540'),true,'Laptop default uses base resolution');
      const shot=await call('Page.captureScreenshot',{format:'png'});
      fs.writeFileSync(path.join(root,'artifacts/perf-stage4.png'),Buffer.from(shot.data,'base64'));
      await evaluate('pauseGame()');await delay(250);
      const paused=await evaluate('({draws:GamePerf.snapshot().draws,tick})');
      await delay(450);
      report.pause=await evaluate('({draws:GamePerf.snapshot().draws,tick})');
      assert.deepEqual(report.pause,paused,'Pause freezes simulation and repeated drawing');
      await call('Input.dispatchKeyEvent',{type:'keyDown',code:'Escape',key:'Escape'});
      await call('Input.dispatchKeyEvent',{type:'keyUp',code:'Escape',key:'Escape'});
      await delay(150);
      assert.equal(await evaluate(`scene==='play'&&GamePerf.snapshot().draws>${paused.draws}`),true,'Keyboard resumes drawing promptly');
      await evaluate(`pauseGame();openSettings('pause');$('renderQuality').value='high';$('renderQuality').onchange()`);
      assert.equal(await evaluate('RENDER_K<=2'),true,'High quality caps at two times');
      await evaluate(`$('lowFx').checked=true;$('lowFx').onchange()`);
      assert.equal(await evaluate('RENDER_K'),1,'Low effects also caps resolution');
      const settings=await call('Page.captureScreenshot',{format:'png'});
      fs.writeFileSync(path.join(root,'artifacts/perf-settings.png'),Buffer.from(settings.data,'base64'));
      assert.equal(await evaluate('GameAssets.cacheSize.images<=8&&GameAssets.cacheSize.tiles<=8&&GameAssets.cacheSize.frames<=96&&GameAssets.cacheSize.sprites<=48'),true,'Caches stay bounded');
    }
    report.errors=errors;
    assert.deepEqual(errors,[],'No browser runtime exceptions');
    if(process.env.PERF_TRACE) report.slowSections=await evaluate('__slow');
    fs.mkdirSync(path.join(root,'artifacts'),{recursive:true});
    fs.writeFileSync(path.join(root,'artifacts/perf-stage4-'+report.label+'.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
  }finally{if(ws)ws.close();if(browser)browser.kill();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
