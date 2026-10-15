// Run with Node 22+ and Chrome/Chromium: node tests/regression.cjs
// Uses an isolated temporary browser profile; no packages or user browser data.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { spawn } = require('node:child_process');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const scripts = JSON.parse(fs.readFileSync(path.join(root, 'server.py'), 'utf8').match(/SCRIPTS = (\[.*?\])/)[1]);
for (const name of scripts) new vm.Script(fs.readFileSync(path.join(root, name), 'utf8'), { filename: name });
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const embedded = scripts.reduce((s, name) => s.replace(`<script src="${name}"></script>`, () => `<script>\n${fs.readFileSync(path.join(root, name), 'utf8')}\n</script>`), html);
const allowed = new Set(['index.html', ...scripts]);
const server = http.createServer((req, res) => {
  const name = req.url === '/' ? 'index.html' : req.url.slice(1);
  if (name !== 'embedded.html' && !allowed.has(name)) { res.writeHead(404).end(); return; }
  res.setHeader('Content-Type', name.endsWith('.js') ? 'text/javascript; charset=utf-8' : 'text/html; charset=utf-8');
  res.end(name === 'embedded.html' ? embedded : fs.readFileSync(path.join(root, name)));
});
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'bmk-test-'));
const browserPath = process.env.BROWSER_PATH || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/chromium', '/usr/bin/google-chrome'
].find(p => fs.existsSync(p));
if (!browserPath) throw new Error('Set BROWSER_PATH to your Chrome/Chromium executable.');
let browser, ws, session, id = 0;
const pending = new Map(), errors = [];
function call(method, params = {}, sid = session) {
  return new Promise((resolve, reject) => {
    const n = ++id; pending.set(n, { resolve, reject });
    ws.send(JSON.stringify({ id: n, method, params, ...(sid ? { sessionId: sid } : {}) }));
  });
}
async function evaluate(expression) {
  const r = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result.value;
}
const delay = ms => new Promise(r => setTimeout(r, ms));
async function screenshot(name) {
  const r = await call('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(profile, name + '.png'), Buffer.from(r.data, 'base64'));
}
async function ready(url) {
  await call('Page.navigate', { url });
  for (let i = 0; i < 50; i++) {
    if (await evaluate("document.readyState === 'complete' && typeof UX !== 'undefined' && typeof scene !== 'undefined'")) return;
    await delay(100);
  }
  throw new Error('Page did not initialize');
}
function spriteChecks() {
  const check = (condition, message) => { if (!condition) throw new Error(message); };
  let repaired = 0, frames = 0, preservedGaps = 0;
  for (const id of Object.keys(HD_DATA)) HD_DATA[id].f.forEach((fd, index) => {
    const raw = new Uint8Array(fd.w * fd.h), bin = atob(fd.d), L = HD[id].F[index].L;
    let at = 0, changes = 0;
    for (let i = 0; i < bin.length; i += 2) {
      const run = bin.charCodeAt(i + 1);
      raw.fill(bin.charCodeAt(i), at, at + run); at += run;
    }
    for (let p = 0; p < raw.length; p++) {
      const j = p * 4;
      if (raw[p]) {
        const color = parseInt(HD_DATA[id].pal[raw[p] - 1].slice(1), 16);
        check(L.d[j] === (color >> 16 & 255) && L.d[j + 1] === (color >> 8 & 255) && L.d[j + 2] === (color & 255) && L.d[j + 3] === 255, 'Original sprite color/alpha preserved');
      } else if (L.d[j + 3]) {
        check(id === 'player' && L.d[j + 3] === 255, 'Only player pinholes become opaque');
        changes++;
      }
    }
    if (id !== 'player') return;
    const visited = new Set();
    for (let p = 0; p < raw.length; p++) {
      if (raw[p] || visited.has(p)) continue;
      const region = [p]; visited.add(p);
      let edge = false;
      for (let q = 0; q < region.length; q++) {
        const n = region[q], x = n % fd.w, y = Math.floor(n / fd.w);
        if (!x || !y || x === fd.w - 1 || y === fd.h - 1) edge = true;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy, next = ny * fd.w + nx;
          if (nx < 0 || nx >= fd.w || ny < 0 || ny >= fd.h || raw[next] || visited.has(next)) continue;
          visited.add(next); region.push(next);
        }
      }
      if (edge || region.length > 24) {
        check(region.every(n => L.d[n * 4 + 3] === 0), 'Exterior and large pose gaps stay transparent');
        if (!edge) preservedGaps++;
      }
    }
    check(changes > 0, 'Player frame ' + index + ' has repaired pinholes');
    repaired += changes; frames++;
  });
  // A known chest hole in the supplied idle pose must remain solid through
  // composition in both directions, including the damage flash color wash.
  const fr = hdFrame('player', 'idle_0'), x = 58, y = 34;
  check(fr.L.d[(y * fr.L.w + x) * 4 + 3] === 255, 'Idle chest is opaque');
  for (const face of [-1, 1]) {
    const F = hdFigure('player', 'idle_0', face, { wash: '#ffffff', washA: .75 });
    const px = HPAD + (face < 0 ? fr.L.w - 1 - x : x);
    check(F.P.L.d[((HPAD + y) * F.P.L.w + px) * 4 + 3] === 255, 'Chest stays opaque when facing ' + face);
  }
  check(preservedGaps > 0, 'Pose gaps exercised');
  return 'All ' + frames + ' player frames repaired (' + repaired + ' pixels); original colors, exterior transparency and ' + preservedGaps + ' pose gaps preserved';
}
function legionChecks() {
  // Every state of every sheet-cut unit must resolve to an existing frame with a stable ground anchor.
  const check = (c, message) => { if (!c) throw new Error(message); };
  const seen = {}, mark = (id, name) => { check(name in HD[id].N, id + ' missing frame ' + name); (seen[id] = seen[id] || new Set()).add(name); };
  for (const type of ['grunt', 'rogue', 'archer', 'brute']) {
    const e = mkEnemy(type, 400, 420), id = e.d.sprite;
    check(HD[id] && HD_SCALE[id] > 0, 'Atlas for ' + id);
    for (const form of ['atk', 'heavy']) for (const [st, len, pat] of [['wind', e.d.wind, 'swing'], ['act', e.d.act + 3, 'swing'], ['rec', e.d.rec, 'swing'], ['rec', 20, null], ['hurt', 20, null], ['dead', 70, null], ['chase', 1, null]])
      for (let t = 0; t <= len; t++) { e.st = st; e.t = t; e.form = form; e.pat = pat; e.recT = len; e.walk = t % 2 === 0; mark(id, legionFrame(e)); }
    e.st = 'down'; for (const z of [20, 0]) for (const t of [5, 30, 55]) { e.z = z; e.t = t; mark(id, legionFrame(e)); }
    for (const name in HD[id].N) { const f = hdFrame(id, name); check(f.ay > 0 && f.ay <= f.L.h && f.ax >= 0 && f.ax < f.L.w, 'Ground anchor inside ' + id + ' ' + name); }
  }
  for (const type of ['boss3', 'boss4', 'boss5']) {
    const e = mkEnemy(type, 400, 420), id = e.d.sprite;
    for (const p2 of [false, true]) {
      e.hp = p2 ? e.max * .4 : e.max;
      for (const pat of Object.keys(e.d.pats)) for (let t = 0; t <= 3400; t += 10) { e.st = 'pat'; e.pat = pat; e.pt = t; mark(id, bossHD(e)); }
      for (const st of ['intro', 'dead', 'stun', 'down', 'chase']) for (let k = 0; k <= 160; k += 4) {
        e.st = st; e.t = k; e.z = k % 8 ? 0 : 10; e.walk = k % 8 === 0; introT = k / 160 * INTRO_MS; tick = k * 7; mark(id, bossHD(e));
      }
    }
  }
  return 'Sheet-cut motion: ' + Object.entries(seen).map(([id, set]) => id + ' ' + set.size).join(', ') + ' frames reached';
}
async function scoreChecks() {
  const check = (ok, name) => { if (!ok) throw new Error(name); };
  const fingerprints = new Set(), results = [];
  for (let stage = 0; stage < 5; stage++) for (const boss of [false, true]) {
    const buffer = await AUDIO.renderPreview(stage, boss, 4), data = buffer.getChannelData(0);
    let peak = 0, energy = 0, hash = 0;
    for (let i = 0; i < data.length; i++) { check(Number.isFinite(data[i]), 'Finite audio samples'); peak = Math.max(peak, Math.abs(data[i])); energy += data[i] * data[i]; if (i % 997 === 0) hash += data[i] * i; }
    const rms = Math.sqrt(energy / data.length);
    check(peak < .98 && rms > .005, 'Audible, unclipped score ' + stage + ':' + boss + ' (rms ' + rms + ', peak ' + peak + ')');
    fingerprints.add(hash.toFixed(4)); results.push({ stage, boss, rms: +rms.toFixed(4), peak: +peak.toFixed(4) });
  }
  check(fingerprints.size === 10, 'Ten distinct compositions');
  window.requestAnimationFrame = () => 0; AUDIO.enable(false); beginGame();
  for (let stage = 0; stage < 5; stage++) {
    startStage(stage); check(AUDIO.currentMusic()?.boss === false, 'Stage selects exploration score');
    spawnWave({ e: [[STAGES[stage].boss, 1]], boss: true });
    check(AUDIO.currentMusic()?.stage === stage && AUDIO.currentMusic()?.boss, 'Boss entry selects own score');
    const name = AUDIO.currentMusic().name; AUDIO.enable(true); AUDIO.pause(true); AUDIO.pause(false); AUDIO.enable(false); AUDIO.enable(true);
    check(AUDIO.currentMusic()?.name === name, 'Mute/resume retains boss score');
    AUDIO.stop(0); AUDIO.enable(false); AUDIO.enable(true);
    check(AUDIO.currentMusic() === null, 'Stopped score cannot restart after mute');
  }
  AUDIO.silence(); AUDIO.enable(false); toTitle();
  return results;
}
async function scorePreviewWav(stage, boss) {
  const b = await AUDIO.renderPreview(stage, boss, 16), frames = b.length, bytes = new ArrayBuffer(44 + frames * 4), v = new DataView(bytes);
  const str = (at, s) => [...s].forEach((c, i) => v.setUint8(at + i, c.charCodeAt(0)));
  str(0,'RIFF');v.setUint32(4,36+frames*4,true);str(8,'WAVE');str(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,2,true);
  v.setUint32(24,b.sampleRate,true);v.setUint32(28,b.sampleRate*4,true);v.setUint16(32,4,true);v.setUint16(34,16,true);str(36,'data');v.setUint32(40,frames*4,true);
  for(let ch=0;ch<2;ch++) { const data=b.getChannelData(ch); for(let i=0;i<frames;i++) { if(!Number.isFinite(data[i]) || Math.abs(data[i])>=.98) throw new Error('Preview clips');v.setInt16(44+i*4+ch*2,Math.round(data[i]*32767),true); } }
  let binary='';const array=new Uint8Array(bytes);for(let at=0;at<array.length;at+=16384) binary+=String.fromCharCode(...array.subarray(at,at+16384));return btoa(binary);
}
function referenceSheet() {
  // Contact sheet of every soldier / boss 4-5 frame at in-game scale, for visual review.
  const ids = ['infantry', 'spearman', 'archer', 'knight', 'boss4', 'boss5'], cell = 190, cols = 16;
  const rows = ids.map(id => Math.ceil(Object.keys(HD[id].N).length / cols)), canvas = document.createElement('canvas');
  canvas.width = cols * cell; canvas.height = rows.reduce((a, b) => a + b, 0) * cell;
  const c = canvas.getContext('2d'); c.imageSmoothingEnabled = false; c.fillStyle = '#2a2d3a'; c.fillRect(0, 0, canvas.width, canvas.height);
  let row = 0;
  ids.forEach((id, n) => {
    Object.keys(HD[id].N).forEach((name, i) => {
      const f = hdFrame(id, name), k = HD_SCALE[id], s = document.createElement('canvas'), x = (i % cols) * cell, y = (row + Math.floor(i / cols)) * cell;
      s.width = f.L.w; s.height = f.L.h; s.getContext('2d').putImageData(new ImageData(f.L.d, f.L.w, f.L.h), 0, 0);
      c.fillStyle = '#c33'; c.fillRect(x, y + cell - 12, cell, 1);
      c.drawImage(s, x + cell / 2 - f.ax * k, y + cell - 12 - f.ay * k, f.L.w * k, f.L.h * k);
      c.fillStyle = '#eee'; c.font = '11px sans-serif'; c.fillText(id + ' ' + name, x + 3, y + 12);
    });
    row += rows[n];
  });
  return canvas.toDataURL().split(',')[1];
}
function combatChecks() {
  window.requestAnimationFrame = () => 0;
  const passed = [];
  const check = (name, condition) => { if (!condition) throw new Error(name); passed.push(name); };
  const reset = () => { beginGame(); scene = 'play'; showScreen(null); hitStop = 0; acc = 0; player.inv = 0; };
  for (const distance of [40, 100, 160, 260, 310, -100, -260]) {
    reset(); player.x = distance < 0 ? 400 : 200;
    enemies = [mkEnemy('grunt', player.x + distance, 420)]; startSkill('thrust');
    for (let i = 0; i < 50; i++) updPlayer();
    check('Thrust reaches target once at distance ' + distance, enemies[0].hp === 22 && player.st === 'free');
  }
  reset(); player.x = 200; enemies = [mkEnemy('grunt', 300, 485)]; startSkill('thrust');
  for (let i = 0; i < 50; i++) updPlayer();
  check('Thrust respects lane', enemies[0].hp === 40);
  reset(); hitStop = 3;
  dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyJ' })); loop(last + MS * 1.1);
  check('Input survives hit stop', pressed.KeyJ > 0 && player.st === 'free');
  for (let i = 0; i < 6; i++) loop(last + MS * 1.1);
  check('Buffered attack executes', player.st === 'atk' && !pressed.KeyJ);
  for (let i = 0; i < 80; i++) loop(last + MS * 1.1);
  check('Held attack does not repeat', player.st === 'free');
  reset(); player.st = 'hurt'; inputDown('KeyJ');
  for (let i = 0; i < 40; i++) loop(last + MS * 1.1);
  check('Expired input cannot attack after long recovery', player.st === 'free');
  reset(); player.z = 10; player.vz = -3; inputDown('Space');
  for (let i = 0; i < 6; i++) loop(last + MS * 1.1);
  check('Jump just before landing is buffered', player.z > 0 && player.vz > 0);
  reset(); startDash(1); inputDown('KeyJ');
  for (let i = 0; i < 9; i++) loop(last + MS * 1.1);
  check('Early attack connects after dash recovery', player.st === 'atk');
  reset(); player.st = 'hurt'; updateSkillButtons();
  check('Skill button matches actual availability', !canStartSkill('thrust') && document.querySelector('[data-skill=thrust]').disabled && !document.querySelector('[data-skill=thrust]').classList.contains('ready'));
  for (const original of ['play', 'intro', 'bossintro']) {
    reset(); if (original === 'bossintro') { introBoss = mkEnemy('boss1', 450, 420); enemies = [introBoss]; }
    scene = original; inputDown('KeyD'); pauseGame(); const before = [tick, stat.ticks, player.x, introT, bannerT];
    for (let i = 0; i < 8; i++) update();
    check('Pause freezes ' + original, JSON.stringify(before) === JSON.stringify([tick, stat.ticks, player.x, introT, bannerT]) && !keys.KeyD);
    resumeGame(); check('Resume restores ' + original, scene === original);
  }
  reset(); dispatchEvent(new Event('blur')); check('Blur auto-pauses', scene === 'pause');
  reset(); stat.damage = 50; chain.max = 10; const beforeRank = rankOf(120);
  player.hp = 50; hurtPlayer(60, 1, false);
  check('Deaths and actual lost HP recorded', stat.deaths === 1 && stat.damage === 100);
  player.hp = 100; check('Respawn cannot improve rank', ['S','A','B','C'].indexOf(rankOf(120)) >= ['S','A','B','C'].indexOf(beforeRank));
  reset(); const saved = JSON.stringify(UX.checkpoint()); beginPractice();
  player.x += 60; player.z = 25; updatePractice(); player.z = 0; startDash(1); updatePractice();
  player.st = 'atk'; damageEnemy(enemies[0], 10, false); player.st = 'skill'; damageEnemy(enemies[0], 10, false); updatePractice();
  check('Practice teaches five actions', practiceDone.size === 5);
  check('Practice does not replace checkpoint', saved === JSON.stringify(UX.checkpoint()));
  check('Practice is invulnerable', hurtPlayer(99, 1, false) === false && player.hp === 100);
  pauseGame(); const trainingCamera = camX; toTutorial('pause'); loop(last + MS * 2);
  check('Pause help does not move camera', camX === trainingCamera);
  reset(); player.score = 1234; player.hp = 37; player.sp = 44; player.mg = 2; startStage(2);
  const checkpoint = UX.checkpoint(); toTitle(); continueGame();
  check('Continue restores stage entry without double healing', stageIdx === 2 && player.hp === checkpoint.hp && player.score === 1234 && player.sp === 44 && player.mg === 2);
  player.score += 999; player.hp = 2; retryStage();
  check('Retry restores resources and score', player.hp === checkpoint.hp && player.score === 1234);
  reset(); player.x = 300; player.y = 420;
  hazards = [{ type: 'rift', kind: 'frost', x: 0, y: 420, width: 640, depth: 20, age: 0, delay: 950, life: 320 }];
  for (let i = 0; i < 50; i++) updHazards(); check('Hazard telegraph is harmless', player.hp === 100);
  player.z = 40; for (let i = 0; i < 10; i++) updHazards(); check('Frost can be jumped', player.hp === 100);
  player.z = 0; updHazards(); check('Frost damages grounded target', player.hp === 88);
  reset(); player.x = 300; player.y = 420; player.z = 40;
  hazards = [{ type: 'eclipse', x: 265, y: 420, age: 1190, delay: 1200, life: 1300 }];
  updHazards(); check('Eclipse ring can be jumped', player.hp === 100);
  player.z = 0; updHazards(); check('Eclipse ring hits ground target', player.hp === 84);
  const missing = new Set(), originalFrame = hdFrame;
  hdFrame = (id, name) => { if (HD[id].N[name] === undefined) missing.add(id + ':' + name); return originalFrame(id, name); };
  let patterns = 0;
  for (const type of ['boss1', 'boss2', 'boss3', 'boss4', 'boss5']) for (const pat of Object.keys(ET[type].pats)) for (const p2 of [false, true]) {
    reset(); startStage(Number(type.slice(-1)) - 1); scene = 'play'; player.x = 210; player.inv = 99999;
    const b = mkEnemy(type, 370, 420); enemies = [b]; if (p2) b.hp = b.max * .4; startPat(b, pat);
    for (let i = 0; i < 270 && b.st === 'pat'; i++) { updEnemy(b); updHazards(); updFx(); if (i % 45 === 0) render(); }
    patterns++;
  }
  hdFrame = originalFrame; check('All ' + patterns + ' boss pattern/phase cases render', missing.size === 0);
  for (let s = 0; s < 5; s++) {
    reset(); startStage(s); scene = 'play'; hitStop = 0;
    for (let w = 0; w < stage.waves.length; w++) {
      camX = stage.waves[w].at; player.x = camX + 256; camLock = false; waveIdx = w; enemies = []; update();
      if (scene === 'bossintro') for (let i = 0; i < 121; i++) update();
      for (const e of [...enemies]) if (e.st !== 'dead') damageEnemy(e, 1e6, true);
      for (let i = 0; i < 400 && scene === 'play'; i++) update();
    }
    check('Stage ' + (s + 1) + ' completes', scene === (s < 4 ? 'clear' : 'ending'));
    check('Stage ' + (s + 1) + ' checkpoint advances', s < 4 ? UX.checkpoint().stage === s + 1 : UX.checkpoint() === null);
  }
  check('Records saved', UX.records().bestScore > 0 && UX.records().stages.filter(Boolean).length === 5);
  localStorage.setItem('bmk_checkpoint', '{bad'); check('Broken JSON save rejected', UX.checkpoint() === null);
  localStorage.setItem('bmk_checkpoint', JSON.stringify({ version: 1, stage: 88 })); check('Invalid save rejected', UX.checkpoint() === null);
  reset(); player.score = 2345; startStage(1); toTitle();
  return passed;
}
const timeout = setTimeout(() => { console.error('Browser test timed out'); browser?.kill(); server.close(); process.exit(1); }, 90000);
(async () => {
  try {
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    browser = spawn(browserPath, ['--headless=new', '--no-sandbox', '--disable-gpu', '--in-process-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0', '--user-data-dir=' + profile, 'about:blank'], { stdio: 'ignore', windowsHide: true });
    browser.on('error', e => { throw e; });
    const portFile = path.join(profile, 'DevToolsActivePort');
    for (let i = 0; i < 50 && !fs.existsSync(portFile); i++) await delay(100);
    const [port, endpoint] = fs.readFileSync(portFile, 'utf8').trim().split(/\r?\n/);
    ws = new WebSocket('ws://127.0.0.1:' + port + endpoint);
    await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
    ws.onmessage = ({ data }) => {
      const m = JSON.parse(data);
      if (m.id) { const h = pending.get(m.id); if (h) { pending.delete(m.id); m.error ? h.reject(m.error) : h.resolve(m.result); } }
      else if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
    };
    const target = await call('Target.createTarget', { url: 'about:blank' }, null);
    session = (await call('Target.attachToTarget', { targetId: target.targetId, flatten: true }, null)).sessionId;
    await call('Page.enable'); await call('Runtime.enable');
    await call('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
    const base = 'http://127.0.0.1:' + server.address().port;
    await ready(base); await evaluate('window.requestAnimationFrame=()=>0; toTutorial()');
    for (const [width, height] of [[1280, 720], [960, 540], [390, 844], [844, 390]]) {
      await call('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
      const bounds = await evaluate(`(()=>{const h=document.querySelector('#tutorial h2').getBoundingClientRect(),b=$('btnGo').getBoundingClientRect(),d=document.querySelector('#tutorial .dialog-body');return {top:h.top,bottom:b.bottom,left:b.left,right:b.right,scroll:getComputedStyle(d).overflowY};})()`);
      assert(bounds.top >= 0 && bounds.bottom <= height && bounds.left >= 0 && bounds.right <= width, 'Tutorial fits ' + width + 'x' + height);
      assert.equal(bounds.scroll, 'auto');
      await screenshot('tutorial-' + width);
    }
    await call('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
    console.log('PASS ' + await evaluate('(' + spriteChecks.toString() + ')()'));
    console.log('PASS ' + await evaluate('(' + legionChecks.toString() + ')()'));
    console.log('PASS Ten orchestral scores and boss music lifecycle: ' + JSON.stringify(await evaluate('(' + scoreChecks.toString() + ')()')));
    for (const [stage, boss, name] of [[0, false, 'stage-march'], [2, true, 'boss-aurelion']]) {
      fs.writeFileSync(path.join(profile, name + '.wav'), Buffer.from(await evaluate('(' + scorePreviewWav.toString() + ')(' + stage + ',' + boss + ')'), 'base64'));
    }
    const results = await evaluate('(' + combatChecks.toString() + ')()');
    results.forEach(name => console.log('PASS ' + name));
    await ready(base); assert.deepEqual(await evaluate('({stage:UX.checkpoint().stage,score:UX.checkpoint().score})'), { stage: 1, score: 2345 });
    console.log('PASS Checkpoint persists across page reload');
    await evaluate("window.requestAnimationFrame=()=>0; $('btnTitleSettings').click(); document.querySelectorAll('#bindings button')[5].click()");
    await call('Input.dispatchKeyEvent', { type: 'keyDown', code: 'KeyF', key: 'f' });
    await call('Input.dispatchKeyEvent', { type: 'keyUp', code: 'KeyF', key: 'f' });
    assert.equal(await evaluate("UX.options.bindings.KeyJ"), 'KeyF');
    await evaluate('closeSettings();beginGame();scene="play";hitStop=0;clearInput()');
    await call('Input.dispatchKeyEvent', { type: 'keyDown', code: 'KeyF', key: 'f' });
    assert.equal(await evaluate('updPlayer();player.st'), 'atk');
    await call('Input.dispatchKeyEvent', { type: 'keyUp', code: 'KeyF', key: 'f' });
    console.log('PASS Remapped physical keyboard attacks');
    await evaluate('toTitle();openSettings("title");$("btnResetKeys").click();$("touchEnabled").checked=true;$("touchEnabled").onchange();closeSettings();beginGame();scene="play";showScreen(null);render()');
    await call('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await call('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    const points = await evaluate(`['KeyD','KeyJ'].map((k,i)=>{const r=document.querySelector('[data-control="'+k+'"]').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,id:i+1};})`);
    await call('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points });
    assert.equal(await evaluate('!!keys.KeyD && !!keys.KeyJ'), true);
    await call('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
    assert.equal(await evaluate('!!keys.KeyD || !!keys.KeyJ'), false);
    console.log('PASS Multi-touch movement/attack and pointer cancellation'); await screenshot('touch');
    await evaluate('clearInput();player.st="free";player.z=0;player.skillCd.thrust=0;updateSkillButtons()');
    const skillPoint = await evaluate('(()=>{const r=document.querySelector("[data-control=KeyU]").getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,id:3};})()');
    await call('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [skillPoint] });
    await evaluate('updPlayer();updateSkillButtons()');
    assert.equal(await evaluate('player.st'), 'skill');
    await call('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    assert.equal(await evaluate('!!keys.KeyU'), false);
    console.log('PASS Touch skill releases even when cooldown disables button');
    await ready(base + '/embedded.html');
    assert.equal(await evaluate('scene'), 'title');
    await evaluate('window.requestAnimationFrame=()=>0;beginGame();scene="play";render()');
    console.log('PASS Single HTML bundle initializes and renders');
    await call('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
    await evaluate('UX.options.touch=false;document.body.classList.remove("touch");player=newPlayer();startStage(2);scene="play";player.x=210;player.inv=0;enemies=[mkEnemy("boss3",430,420)];render()');
    await screenshot('stage3-king');
    await evaluate('startPat(enemies[0],"cleave");enemies[0].pt=820;render()');
    await screenshot('stage3-cleave');
    await evaluate('UX.options.touch=false;document.body.classList.remove("touch");player=newPlayer();startStage(3);scene="play";player.x=220;player.inv=0;enemies=[mkEnemy("boss4",430,420),mkEnemy("grunt",560,460),mkEnemy("rogue",300,380),mkEnemy("archer",600,360),mkEnemy("brute",140,470)];render()');
    await screenshot('stage4');
    await evaluate('player=newPlayer();startStage(4);scene="play";player.x=210;player.inv=0;enemies=[mkEnemy("boss5",430,420)];render()');
    await screenshot('stage5-emperor');
    fs.writeFileSync(path.join(profile, 'reference-units.png'), Buffer.from(await evaluate('(' + referenceSheet.toString() + ')()'), 'base64'));
    await evaluate('toTitle();AUDIO.enable(false)');
    await evaluate('(()=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=()=>{throw new DOMException("blocked", "SecurityError")};try{beginGame();scene="play";render();}finally{Storage.prototype.setItem=original}})()');
    assert.equal(await evaluate('scene'), 'play');
    assert.equal(await evaluate('$("saveStatus").textContent.includes("저장할 수 없습니다")'), true);
    console.log('PASS Storage restrictions leave game playable with clear status');
    assert.deepEqual(errors, [], 'No browser exceptions');
    console.log('PASS No browser exceptions. Screenshots: ' + profile);
  } catch (e) { console.error(e); if (errors.length) console.error(errors); process.exitCode = 1; }
  finally { clearTimeout(timeout); ws?.close(); browser?.kill(); server.close(); }
})();
