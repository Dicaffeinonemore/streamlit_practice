// Phase 13: drives the exported Web build (build/web) in headless Chrome over the DevTools protocol.
//   node godot/phase13/tools/verify_web.cjs
// The page is opened with ?bmk_probe=1, so phase13/web_probe.gd (Web pack only) publishes visible button
// centres (window.bmkButtons) and game state (window.bmkState). Buttons are clicked by label with real
// browser input events, whatever the Web font metrics.
// Desktop 1280 x 720: load, settings → boss file through the browser chooser (accepted; > 30 MB refused;
// 기본값으로), 새 게임 → 비에사로 시작 → Enter → Esc → Stage 1, IndexedDB checkpoint, M → sound pref,
// reload → 이어하기 restores Viesa. Phone 844 x 390 at DPR 3 with touch taps. Small window 800 x 450.
const fs = require('fs'), path = require('path'), http = require('http'), os = require('os');
const { spawn } = require('child_process');
const godot = path.resolve(__dirname, '../..');
const web = path.join(godot, 'build/web');
const out = path.join(godot, 'evidence/phase13/web');
const smallMp3 = path.join(godot, 'port_assets/audio/original/gorath/g2hook.mp3');
fs.mkdirSync(out, { recursive: true });

const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.wasm': 'application/wasm', '.png': 'image/png', '.pck': 'application/octet-stream' };
const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(req.url.split('?')[0]);
  const file = path.resolve(web, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!file.startsWith(web + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404).end(); return; }
  res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Content-Length': fs.statSync(file).size });
  fs.createReadStream(file).pipe(res);
});
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'bmk-phase13-web-'));
const delay = ms => new Promise(r => setTimeout(r, ms));
const pending = new Map(), listeners = [];
let ws, browser, id = 0;
const checks = [], consoleLines = [];
function check(ok, label) { checks.push({ ok: !!ok, label }); if (!ok) console.log('FAIL ' + label); }
function call(method, params = {}, sessionId) {
  return new Promise((resolve, reject) => { const n = ++id; pending.set(n, { resolve, reject }); ws.send(JSON.stringify({ id: n, method, params, ...(sessionId ? { sessionId } : {}) })); });
}

class Page {
  constructor(sessionId, name) { this.sid = sessionId; this.name = name; }
  call(method, params) { return call(method, params, this.sid); }
  async eval(expression) {
    const r = await this.call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    return r.result.value;
  }
  async shot(name) { const r = await this.call('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(out, name + '.png'), Buffer.from(r.data, 'base64')); }
  state() { return this.eval('window.bmkState || null'); }
  async waitStarted(label) {
    const t0 = Date.now();
    for (let i = 0; i < 1200; i++) { if (await this.eval(`!document.getElementById('status') && !!window.bmkState && window.bmkState.menu === 'title'`)) break; await delay(100); }
    const started = await this.eval(`!document.getElementById('status') && !!window.bmkState`);
    check(started, `${this.name}: engine started, title shown (${label})`);
    if (!started) { await this.shot(this.name + '_not_started'); console.log('  status:', await this.eval(`(document.getElementById('status-notice') || {}).textContent || 'no status overlay'`), 'search:', await this.eval('location.search')); }
    await delay(1000);
    return (Date.now() - t0) / 1000;
  }
  // Waits for a visible button whose label equals (or starts with) the text; returns [x, y, disabled].
  async button(text, prefix = false) {
    for (let i = 0; i < 50; i++) {
      const found = await this.eval(`(() => { const b = window.bmkButtons || {}; const k = Object.keys(b).find(k => ${prefix} ? k.startsWith(${JSON.stringify(text)}) : k === ${JSON.stringify(text)}); return k ? b[k] : null; })()`);
      if (found) return found;
      await delay(100);
    }
    check(false, `${this.name}: button ${text} is shown`);
    return null;
  }
  // 960 x 540 game point → CSS pixel, from the canvas size and the stretch (integer, fractional below base).
  async toCss([x, y]) {
    return this.eval(`(() => { const c = document.getElementById('canvas'), r = c.getBoundingClientRect(), k = c.width / r.width;
      let s = Math.min(c.width / 960, c.height / 540); if (s >= 1) s = Math.floor(s);
      const ox = (c.width - 960 * s) / 2, oy = (c.height - 540 * s) / 2;
      return [r.left + (ox + ${x} * s) / k, r.top + (oy + ${y} * s) / k]; })()`);
  }
  async click(text, prefix = false) {
    const b = await this.button(text, prefix); if (!b) return;
    const [x, y] = await this.toCss(b);
    await this.call('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
    await this.call('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
    await delay(60);
    await this.call('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
    await delay(400);
  }
  async tap(text, prefix = false) {
    const b = await this.button(text, prefix); if (!b) return;
    const [x, y] = await this.toCss(b);
    await this.call('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    await delay(80);
    await this.call('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await delay(500);
  }
  async key(code, key, vk) {
    for (const type of ['keyDown', 'keyUp']) { await this.call('Input.dispatchKeyEvent', { type, code, key, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk }); await delay(60); }
    await delay(300);
  }
  // user:// lives in IndexedDB '/userfs' (Emscripten IDBFS), synced by Godot after files close.
  async userFiles() {
    return this.eval(`new Promise((resolve, reject) => { const r = indexedDB.open('/userfs'); r.onerror = () => reject(r.error);
      r.onsuccess = () => { const db = r.result; if (!db.objectStoreNames.contains('FILE_DATA')) { resolve({}); return; }
        const files = {}; const c = db.transaction('FILE_DATA', 'readonly').objectStore('FILE_DATA').openCursor();
        c.onsuccess = e => { const cur = e.target.result; if (!cur) { resolve(files); return; }
          const v = cur.value, name = String(cur.key).split('/').pop();
          if (v && v.contents) files[name] = name.endsWith('.json') ? new TextDecoder().decode(v.contents) : v.contents.length;
          cur.continue(); }; }; })`);
  }
}

async function openPage(name, metrics, contextId) {
  const target = await call('Target.createTarget', { url: 'about:blank', ...(contextId ? { browserContextId: contextId } : {}) });
  const { sessionId } = await call('Target.attachToTarget', { targetId: target.targetId, flatten: true });
  const page = new Page(sessionId, name);
  await page.call('Page.enable'); await page.call('Runtime.enable'); await page.call('DOM.enable');
  await page.call('Emulation.setDeviceMetricsOverride', metrics);
  if (metrics.mobile) await page.call('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  // Keep the page's AudioContext reachable to check that a gesture resumes it.
  await page.call('Page.addScriptToEvaluateOnNewDocument', { source: `(() => { const A = window.AudioContext; if (!A) return;
    window.AudioContext = class extends A { constructor(...a) { super(...a); (window.__bmkAudio = window.__bmkAudio || []).push(this); } }; })();` });
  return page;
}

(async () => {
  try {
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    const url = 'http://127.0.0.1:' + server.address().port + '/?bmk_probe=1';
    const chrome = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(fs.existsSync);
    browser = spawn(chrome, ['--headless=new', '--no-first-run', '--autoplay-policy=user-gesture-required', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
      '--remote-debugging-port=0', '--user-data-dir=' + profile, 'about:blank'], { stdio: 'ignore', windowsHide: true });
    const portFile = path.join(profile, 'DevToolsActivePort');
    for (let i = 0; i < 100 && !fs.existsSync(portFile); i++) await delay(100);
    const [port, endpoint] = fs.readFileSync(portFile, 'utf8').trim().split(/\r?\n/);
    ws = new WebSocket('ws://127.0.0.1:' + port + endpoint);
    await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
    ws.onmessage = ({ data }) => {
      const m = JSON.parse(data);
      if (m.id) { const h = pending.get(m.id); if (h) { pending.delete(m.id); m.error ? h.reject(Error(JSON.stringify(m.error))) : h.resolve(m.result); } return; }
      if (m.method === 'Runtime.consoleAPICalled') consoleLines.push({ type: m.params.type, text: m.params.args.map(a => a.value ?? a.description ?? '').join(' ') });
      if (m.method === 'Runtime.exceptionThrown') consoleLines.push({ type: 'exception', text: m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text });
      for (const l of listeners) l(m);
    };

    // ---------------- Desktop 1280 x 720
    const desk = await openPage('desktop', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
    await desk.call('Page.navigate', { url });
    const loadSeconds = await desk.waitStarted('first load');
    const titleButtons = await desk.eval('Object.keys(window.bmkButtons || {})');
    check(!titleButtons.includes('종료') && titleButtons.includes('새 게임'), `desktop: Web title has no 종료 (${titleButtons.join(', ')})`);
    check((await desk.button('이어하기'))?.[2] === true, 'desktop: 이어하기 is disabled before any save');
    await desk.shot('desktop_title');
    const audioBefore = await desk.eval(`(window.__bmkAudio || []).map(c => c.state)`);
    // Settings → boss music through the browser file chooser.
    await desk.click('설정');
    check((await desk.state()).menu === 'settings', 'desktop: 설정 opens the settings');
    await desk.call('Page.setInterceptFileChooserDialog', { enabled: true });
    const chooser = () => new Promise(resolve => {
      const l = m => { if (m.method === 'Page.fileChooserOpened' && m.sessionId === desk.sid) { listeners.splice(listeners.indexOf(l), 1); resolve(m.params); } };
      listeners.push(l); setTimeout(() => resolve(null), 8000);
    });
    let opened = chooser();
    await desk.click('보스전 음악:', true);
    let params = await opened;
    check(params && params.mode === 'selectSingle', 'desktop: 보스전 음악 opens the browser file chooser');
    if (params) await desk.call('DOM.setFileInputFiles', { files: [smallMp3], backendNodeId: params.backendNodeId });
    await delay(2500);
    let files = await desk.userFiles();
    const bossPref = JSON.parse(files['bmk_audio.json'] || '{}');
    check(bossPref.boss_name === path.basename(smallMp3) && bossPref.boss_extension === 'mp3' && files['boss_bgm'] === fs.statSync(smallMp3).size, 'desktop: the chosen file is decoded and stored in IndexedDB');
    check(!!(await desk.button('보스전 음악: 내 파일: ' + path.basename(smallMp3))), 'desktop: the settings row names the chosen file');
    await desk.shot('desktop_settings_custom_boss');
    const big = path.join(profile, 'too-big.mp3');
    fs.writeFileSync(big, Buffer.alloc(31 * 1024 * 1024, 1));
    opened = chooser();
    await desk.click('보스전 음악:', true);
    params = await opened;
    if (params) await desk.call('DOM.setFileInputFiles', { files: [big], backendNodeId: params.backendNodeId });
    await delay(2000);
    files = await desk.userFiles();
    check(params && JSON.parse(files['bmk_audio.json'] || '{}').boss_name === path.basename(smallMp3) && files['boss_bgm'] === fs.statSync(smallMp3).size, 'desktop: a > 30 MB file is refused and the previous choice kept');
    await desk.shot('desktop_settings_too_big');
    await desk.click('보스전 음악 기본값으로');
    await delay(1500);
    files = await desk.userFiles();
    check(!files['boss_bgm'] && JSON.parse(files['bmk_audio.json'] || '{}').boss_name === '', 'desktop: 기본값으로 removes the stored file');
    // 뒤로 is below the fold of the settings list; a reload returns to the title (and reloads the pack).
    await desk.call('Page.reload', { ignoreCache: false });
    await desk.waitStarted('reload after settings');
    // New game with Viesa.
    await desk.click('새 게임');
    check((await desk.state()).menu === 'characters', 'desktop: 새 게임 opens character select');
    await desk.shot('desktop_characters');
    await desk.click('비에사로 시작');
    await delay(1500);
    check((await desk.state()).menu === 'tutorial', 'desktop: 비에사로 시작 opens the tutorial');
    await desk.shot('desktop_tutorial');
    await desk.key('Enter', 'Enter', 13);
    await delay(800);
    check((await desk.state()).menu === 'opening', 'desktop: Enter plays the opening');
    await desk.shot('desktop_opening');
    await desk.key('Escape', 'Escape', 27);
    await delay(2500);
    let st = await desk.state();
    check(!st.menuVisible && st.gameMode === 'story' && st.character === 'viesa' && st.stage === 0, `desktop: Esc skips to Stage 1 with Viesa (${JSON.stringify(st)})`);
    await desk.key('ArrowRight', 'ArrowRight', 39);
    await desk.shot('desktop_stage1');
    const audioAfter = await desk.eval(`(window.__bmkAudio || []).map(c => c.state)`);
    check(audioAfter.length > 0 && audioAfter.every(s => s === 'running'), `desktop: audio runs after the first gesture (before ${JSON.stringify(audioBefore)}, after ${JSON.stringify(audioAfter)})`);
    files = await desk.userFiles();
    const checkpoint = JSON.parse(files['bmk_checkpoint.json'] || 'null');
    check(checkpoint && checkpoint.characterId === 'viesa' && checkpoint.stage === 0, 'desktop: the stage-entry checkpoint is in IndexedDB');
    await desk.key('KeyM', 'm', 77);
    await delay(1500);
    files = await desk.userFiles();
    check(!(await desk.state()).sound && JSON.parse(files['bmk_audio.json'] || '{}').sound === 'off', 'desktop: M turns the sound off and stores it');
    // Reload: the same browser profile must offer 이어하기 and restore the run.
    await desk.call('Page.reload', { ignoreCache: false });
    await desk.waitStarted('reload');
    check((await desk.button('이어하기'))?.[2] === false, 'desktop: 이어하기 is offered after a reload');
    check((await desk.state()).sound === false, 'desktop: sound stays off after a reload');
    await desk.shot('desktop_title_after_reload');
    await desk.click('이어하기');
    await delay(2500);
    st = await desk.state();
    check(!st.menuVisible && st.gameMode === 'story' && st.character === 'viesa' && st.stage === 0, `desktop: 이어하기 restores Viesa in Stage 1 (${JSON.stringify(st)})`);
    await desk.shot('desktop_continue');
    await desk.key('KeyM', 'm', 77);
    await delay(1500);
    check((await desk.state()).sound && JSON.parse((await desk.userFiles())['bmk_audio.json'] || '{}').sound === 'on', 'desktop: M turns the sound back on');
    await desk.key('Escape', 'Escape', 27);
    check((await desk.state()).menu === 'pause', 'desktop: Esc pauses');

    // ---------------- Phone landscape, touch (fresh storage)
    const phone = await openPage('phone', { width: 844, height: 390, deviceScaleFactor: 3, mobile: true }, (await call('Target.createBrowserContext')).browserContextId);
    await phone.call('Page.navigate', { url });
    await phone.waitStarted('phone');
    const canvas = await phone.eval(`(() => { const c = document.getElementById('canvas'); return [c.width, c.height]; })()`);
    check(canvas[0] === 844 * 3 && canvas[1] === 390 * 3, `phone: canvas uses device pixels (${canvas}), 2x integer stretch`);
    await phone.shot('phone_title');
    await phone.tap('새 게임');
    check((await phone.state()).menu === 'characters', 'phone: tapping 새 게임 opens character select');
    await phone.tap('비에사로 시작');
    await delay(1500);
    check((await phone.state()).menu === 'tutorial', 'phone: tapping 비에사로 시작 opens the tutorial');
    await phone.shot('phone_tutorial');
    await phone.tap('게임 시작');
    await delay(800);
    await phone.tap('건너뛰기', true);
    await delay(2500);
    st = await phone.state();
    check(!st.menuVisible && st.gameMode === 'story' && st.character === 'viesa', `phone: 게임 시작 and 건너뛰기 by touch reach Stage 1 (${JSON.stringify(st)})`);
    await phone.shot('phone_stage1');

    // ---------------- Small desktop window (below 960 x 540)
    const small = await openPage('small', { width: 800, height: 450, deviceScaleFactor: 1, mobile: false }, (await call('Target.createBrowserContext')).browserContextId);
    await small.call('Page.navigate', { url });
    await small.waitStarted('small window');
    await small.shot('small_title');
    const settings = await small.button('설정');
    check(settings && (await small.toCss(settings))[1] < 450, 'small: the lowest title button is inside the 450 px window');
    await small.click('새 게임');
    check((await small.state()).menu === 'characters', 'small: 새 게임 is reachable below 960 x 540');
    await small.shot('small_characters');

    const errors = consoleLines.filter(l => l.type === 'exception' || (l.type === 'error' && /SCRIPT ERROR|ERROR:/.test(l.text)));
    check(errors.length === 0, `no script errors in the console (${errors.length})`);
    const failures = checks.filter(c => !c.ok).length;
    fs.writeFileSync(path.join(out, 'web_checks.json'), JSON.stringify({ failures, checks, loadSeconds, sizes: Object.fromEntries(fs.readdirSync(web).map(f => [f, fs.statSync(path.join(web, f)).size])), console: consoleLines.slice(0, 200) }, null, 2));
    console.log(`WEB: ${checks.length} checks, ${failures} failures, first load ${loadSeconds.toFixed(1)} s`);
    for (const e of errors) console.log('  ' + e.text);
    process.exitCode = failures ? 1 : 0;
  } catch (e) { console.error(e); for (const l of consoleLines.filter(l => l.type !== 'log').slice(0, 30)) console.error('  console ' + l.type + ': ' + l.text); process.exitCode = 1; }
  finally { ws?.close(); browser?.kill(); server.close(); setTimeout(() => fs.rmSync(profile, { recursive: true, force: true }), 1500); }
})();
