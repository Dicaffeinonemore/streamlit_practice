// Actual local Streamlit + isolated headless Chrome; no packages beyond requirements.txt.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const net = require('node:net'), {spawn} = require('node:child_process');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const python = process.env.STREAMLIT_TEST_PYTHON || path.join(root, '.venv-streamlit-test', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
const chrome = process.env.BROWSER_PATH || ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/chromium', '/usr/bin/google-chrome'].find(fs.existsSync);
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let backend, browser, ws, log = '', sequence = 0;
const pending = new Map(), contexts = new Map(), errors = [];
function call(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++sequence; pending.set(id, {resolve, reject});
    ws.send(JSON.stringify({id, method, params}));
  });
}
async function evaluate(expression, contextId) {
  const r = await call('Runtime.evaluate', {expression, contextId, returnByValue: true, awaitPromise: true});
  if (r.exceptionDetails) throw Error(r.exceptionDetails.text);
  return r.result.value;
}
(async () => {
  const socket = net.createServer();
  await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve));
  const port = socket.address().port; await new Promise(resolve => socket.close(resolve));
  const url = `http://127.0.0.1:${port}`;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'bmk-streamlit-test-'));
  const timeout = setTimeout(() => {console.error('Timed out', log); process.exitCode = 1; ws?.close(); browser?.kill(); backend?.kill();}, 90000);
  try {
    assert(chrome, 'Chrome is required');
    backend = spawn(python, ['-m', 'streamlit', 'run', 'server.py', '--server.headless=true', '--browser.gatherUsageStats=false', '--server.fileWatcherType=none', '--server.address=127.0.0.1', `--server.port=${port}`], {cwd: root, windowsHide: true, env: {...process.env, PYTHONDONTWRITEBYTECODE: '1', PYTHONUTF8: '1'}});
    backend.stdout.on('data', b => log = (log + b).slice(-20000));
    backend.stderr.on('data', b => log = (log + b).slice(-20000));
    backend.on('error', e => log += String(e));
    let health = false;
    for (let i = 0; i < 100; i++) {try {health = (await fetch(url+'/_stcore/health')).ok;} catch {} if (health) break; await delay(100);}
    assert(health, log);
    browser = spawn(chrome, ['--headless=new', '--no-sandbox', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0', '--window-size=1280,900', '--user-data-dir='+profile, 'about:blank'], {windowsHide: true, stdio: 'ignore'});
    const active = path.join(profile, 'DevToolsActivePort');
    for (let i = 0; i < 100 && !fs.existsSync(active); i++) await delay(100);
    const debugPort = fs.readFileSync(active, 'utf8').split('\n')[0];
    const pages = await (await fetch(`http://127.0.0.1:${debugPort}/json`)).json();
    ws = new WebSocket(pages.find(p => p.type === 'page').webSocketDebuggerUrl);
    ws.onmessage = event => {
      const message = JSON.parse(event.data);
      if (message.id) {const p = pending.get(message.id); pending.delete(message.id); if (message.error) p?.reject(Error(JSON.stringify(message.error))); else p?.resolve(message.result);}
      if (message.method === 'Runtime.executionContextCreated') contexts.set(message.params.context.id, message.params.context);
      if (message.method === 'Runtime.executionContextDestroyed') contexts.delete(message.params.executionContextId);
      if (message.method === 'Runtime.executionContextsCleared') contexts.clear();
      if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
      if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') errors.push(message.params.args.map(a => a.value || a.description).join(' '));
    };
    await new Promise(resolve => ws.onopen = resolve);
    await call('Runtime.enable'); await call('Page.enable');
    await call('Page.addScriptToEvaluateOnNewDocument', {source: `
      if(window.AudioContext){const Native=window.AudioContext;
        window.AudioContext=class extends Native {constructor(...args){super(...args);window.testAudioContext=this;
          const create=this.createDynamicsCompressor.bind(this);
          this.createDynamicsCompressor=()=>{const node=create();window.testAudioMeter=this.createAnalyser();node.connect(window.testAudioMeter);return node;};
        }};
      }`});
    await call('Page.navigate', {url});
    let result, gameContext;
    for (let i = 0; i < 150; i++) {
      for (const [id, context] of contexts) {
        if (!context.auxData?.isDefault) continue;
        try {
          result = await evaluate(`location.href.includes('/component/') && document.readyState === 'complete' && typeof scene !== 'undefined' && typeof UX !== 'undefined' ? ({url:location.href,scene,canvas:!!document.querySelector('#c'),width:W,height:H,renderWidth:cv.width,renderHeight:cv.height}) : null`, id);
        } catch {continue;}
        if (result) { gameContext = id; break; }
      }
      if (result) break;
      await delay(200);
    }
    assert(result, 'Game did not initialize through Streamlit. '+log);
    await delay(500);
    assert.equal(result.canvas, true); assert.equal(result.width, 960); assert.equal(result.height, 540);
    // Reproduce a first interaction without browser activation inside the component.
    await evaluate("localStorage.removeItem('sf_snd');dispatchEvent(new PointerEvent('pointerdown',{pointerType:'touch'}))", gameContext);
    await delay(100);
    assert.equal(await evaluate('testAudioContext.state',gameContext),'suspended','Initial blocked audio must be retryable');
    const frame = await evaluate(`(()=>{const f=[...document.querySelectorAll('iframe')].find(f=>f.src.includes('/component/'));const r=f.getBoundingClientRect();return {x:r.x+r.width*.1,y:r.y+r.height*.15};})()`);
    for(const type of ['mousePressed','mouseReleased'])await call('Input.dispatchMouseEvent',{type,...frame,button:'left',clickCount:1});
    await delay(200);
    assert.equal(await evaluate('testAudioContext.state',gameContext),'running','Trusted iframe click retries audio unlock');
    const rms = () => evaluate(`(()=>{const a=new Float32Array(testAudioMeter.fftSize);testAudioMeter.getFloatTimeDomainData(a);return Math.sqrt(a.reduce((sum,v)=>sum+v*v,0)/a.length)})()`,gameContext);
    await evaluate('AUDIO.music(0)',gameContext);await delay(1200);
    assert(await rms()>.0001,'Stage BGM produces audio inside Streamlit');
    await evaluate('AUDIO.silence()',gameContext);await delay(450);
    await evaluate("AUDIO.sfx('hit',2)",gameContext);await delay(70);
    assert(await rms()>.0001,'Effects produce audio inside Streamlit');
    await evaluate('AUDIO.pause(true)',gameContext);await delay(100);
    await evaluate("dispatchEvent(new Event('touchend'));dispatchEvent(new Event('click'))",gameContext);
    assert.equal(await evaluate('testAudioContext.state',gameContext),'suspended');
    await evaluate('AUDIO.pause(false)',gameContext);await delay(100);
    assert.equal(await evaluate('testAudioContext.state',gameContext),'running');
    for(const event of ['pointerup','touchend','click']) {
      await evaluate('testAudioContext.suspend()',gameContext);
      await evaluate(`dispatchEvent(new Event('${event}'))`,gameContext);await delay(80);
      assert.equal(await evaluate('testAudioContext.state',gameContext),'running',event+' recovers interrupted audio');
    }
    await evaluate("AUDIO.toggle();dispatchEvent(new Event('touchend'));dispatchEvent(new Event('click'))",gameContext);
    assert.equal(await evaluate('AUDIO.isOn()',gameContext),false,'Retry preserves explicit mute');
    console.log('PASS Streamlit iframe audio: blocked first gesture, trusted unlock, BGM/effects signal, pause/resume and mute');
    assert.deepEqual(errors, []);
    assert((await fetch(url+'/_stcore/health')).ok, 'Backend health after game initialization');
    const out = path.join(root, 'artifacts/streamlit-1.37'); fs.mkdirSync(out, {recursive: true});
    fs.writeFileSync(path.join(out, 'smoke.json'), JSON.stringify({streamlit: '1.56.0', ...result, errors, health: true}, null, 2));
    const shot = await call('Page.captureScreenshot', {format: 'png'});
    fs.writeFileSync(path.join(out, 'game.png'), Buffer.from(shot.data, 'base64'));
    console.log('PASS Actual Streamlit component game: '+JSON.stringify(result));
  } catch (e) {console.error(e, log); process.exitCode = 1;}
  finally {clearTimeout(timeout); ws?.close(); browser?.kill(); backend?.kill();}
})();
