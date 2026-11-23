// Continue after the last life (story mode) in the browser game.
//   node tests/continue-smoke.cjs
// The real loop is stopped; update() is stepped by hand so the 10 s countdown is exact.
const fs = require('fs'), path = require('path'), http = require('http'), os = require('os');
const { spawn } = require('child_process');
const root = path.resolve(__dirname, '..'), out = path.join(root, 'artifacts/continue-smoke'); fs.mkdirSync(out, { recursive: true });
const errors = [], pending = new Map(), checks = []; let browser, ws, session, id = 0;
const server = http.createServer((req, res) => {
  const file = path.resolve(root, '.' + decodeURIComponent(req.url === '/' ? '/index.html' : req.url.split('?')[0]));
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404).end(); return; }
  res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream'); fs.createReadStream(file).pipe(res);
});
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'bmk-continue-'));
const delay = ms => new Promise(r => setTimeout(r, ms));
const check = (ok, label) => { checks.push({ ok: !!ok, label }); if (!ok) console.log('FAIL ' + label); };
function call(method, params = {}, sid = session) { return new Promise((resolve, reject) => { const n = ++id; pending.set(n, { resolve, reject }); ws.send(JSON.stringify({ id: n, method, params, ...(sid ? { sessionId: sid } : {}) })); }); }
async function evaluate(expression) { const r = await call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value; }
async function screenshot(name) { const r = await call('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(out, name + '.png'), Buffer.from(r.data, 'base64')); }
// Like a real keyboard: Enter carries text '\r', so a focused button is activated by the browser.
async function key(code, keyName, vk) { for (const type of ['keyDown', 'keyUp']) await call('Input.dispatchKeyEvent', { type, code, key: keyName, windowsVirtualKeyCode: vk, ...(type === 'keyDown' && keyName === 'Enter' ? { text: '\r' } : {}) }); await delay(50); }
// Kills the player with no lives left and lets the 100-tick fall finish.
const KILL = `player.lives = 0; player.hp = 0; player.st = 'dead'; player.t = 101; update(); scene`;
const STEP = n => `for (let i = 0; i < ${n}; i++) update(); scene`;
const STATE = `({ scene, lives: player.lives, hp: player.hp, max: player.max, score: player.score, st: player.st, inv: player.inv, count: $('continueCount').textContent, continues: stat.continues || 0, x: player.x, camX })`;
(async () => {
  try {
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    const chrome = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(fs.existsSync);
    browser = spawn(chrome, ['--headless=new', '--no-sandbox', '--disable-gpu', '--no-first-run', '--remote-debugging-port=0', '--user-data-dir=' + profile, 'about:blank'], { stdio: 'ignore', windowsHide: true });
    const portFile = path.join(profile, 'DevToolsActivePort'); for (let i = 0; i < 100 && !fs.existsSync(portFile); i++) await delay(100);
    const [port, endpoint] = fs.readFileSync(portFile, 'utf8').trim().split(/\r?\n/); ws = new WebSocket('ws://127.0.0.1:' + port + endpoint); await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
    ws.onmessage = ({ data }) => { const m = JSON.parse(data); if (m.id) { const h = pending.get(m.id); if (h) { pending.delete(m.id); m.error ? h.reject(m.error) : h.resolve(m.result); } }
      else if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text); };
    const target = await call('Target.createTarget', { url: 'about:blank' }, null); session = (await call('Target.attachToTarget', { targetId: target.targetId, flatten: true }, null)).sessionId;
    await call('Page.enable'); await call('Runtime.enable'); await call('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
    await call('Page.navigate', { url: 'http://127.0.0.1:' + server.address().port });
    for (let i = 0; i < 200; i++) { if (await evaluate('document.readyState==="complete"&&typeof scene!=="undefined"&&typeof beginGame==="function"')) break; await delay(100); }
    await evaluate(`requestAnimationFrame = () => 0; cancelAnimationFrame(loopRequest); clearTimeout(loopTimeout); true`);

    // Story: last life → CONTINUE? 10
    await evaluate(`beginGame(); scene = 'play'; bannerT = 0; player.score = 4321; true`);
    check(await evaluate(KILL) === 'continue', 'Story: losing the last life asks CONTINUE?');
    let s = await evaluate(STATE);
    check(s.count === '10', 'The countdown starts at 10');
    await evaluate(STEP(120)); s = await evaluate(STATE);
    check(s.scene === 'continue' && s.count === '8', `2 s later it shows 8 (${s.count})`);
    await evaluate(`render(); true`); await screenshot('continue');
    // Enter continues on the spot.
    await key('Enter', 'Enter', 13);
    s = await evaluate(STATE);
    check(s.scene === 'play' && s.lives === 3 && s.hp === s.max && s.score === 0 && s.st === 'free' && s.inv === 150 && s.continues === 1 && s.x === s.camX + 100, `Enter: back in play, 3 lives, full HP, score 0, invulnerable (${JSON.stringify(s)})`);
    // Countdown runs out → GAME OVER.
    check(await evaluate(KILL) === 'continue', 'Dying again asks again (unlimited)');
    await evaluate(STEP(599)); check(await evaluate('scene') === 'continue', 'Still asking at 9.98 s');
    await evaluate(STEP(1)); s = await evaluate(STATE);
    check(s.scene === 'over', 'At 10 s it becomes GAME OVER');
    check(/점수 0/.test(await evaluate(`$('overInfo').textContent`)), 'GAME OVER shows the score after the continue (0)');
    await screenshot('over');
    // Esc gives up at once; the button continues too.
    await evaluate(`retryStage(); scene = 'play'; bannerT = 0; true`);
    await evaluate(KILL); await key('Escape', 'Escape', 27);
    check(await evaluate('scene') === 'over', 'Esc gives up → GAME OVER');
    await evaluate(`retryStage(); scene = 'play'; bannerT = 0; true`);
    await evaluate(KILL); await evaluate(`$('btnContinueFight').click(); true`);
    check(await evaluate('scene') === 'play', '이어서 싸우기 button continues');
    await evaluate(KILL); await evaluate(`$('btnContinueGiveUp').click(); true`);
    check(await evaluate('scene') === 'over', '포기 button gives up');
    // Boss challenge keeps the plain GAME OVER.
    await evaluate(`beginGame(); bossChallenge = true; scene = 'play'; bannerT = 0; true`);   // the flag is what the death branch reads
    const challengeScene = await evaluate(KILL);
    check(challengeScene === 'over', `Boss challenge: no continue, straight to GAME OVER (${challengeScene}, bossChallenge=${await evaluate('bossChallenge')})`);
    check(await evaluate(`$('btnContinue').onclick === continueGame && continueGame.toString().includes('UX.checkpoint') && document.querySelectorAll('#btnContinueFight').length === 1`), 'The title Continue (saved game) is untouched and the button id is unique');
    check(errors.length === 0, 'No page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
    const failures = checks.filter(c => !c.ok).length;
    console.log(`CONTINUE: ${checks.length} checks, ${failures} failures`);
    process.exitCode = failures ? 1 : 0;
  } catch (e) { console.error(e); process.exitCode = 1; } finally { ws?.close(); browser?.kill(); server.close(); }
})();
