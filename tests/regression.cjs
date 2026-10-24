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
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8').replace('<head>', '<head>'+ (process.env.VARGUL_SUITE?'<script>globalThis.VARGUL_DEBUG_OVERRIDE=true</script>':''));
const bgmPath=path.join(root,'assets/bgm/boss.mp3');
const embeddedSource=fs.existsSync(bgmPath)?html.replace('<script src="audio.js">','<script>window.BOSS_BGM_URL="data:audio/mpeg;base64,'+fs.readFileSync(bgmPath).toString('base64')+'";</script>\n<script src="audio.js">'):html;
const embedded = scripts.reduce((s, name) => s.replace(`<script src="${name}"></script>`, () => `<script>\n${fs.readFileSync(path.join(root, name), 'utf8')}\n</script>`), embeddedSource);
const allowed = new Set(['index.html', ...scripts]);
const server = http.createServer((req, res) => {
  const name = req.url === '/' ? 'index.html' : req.url.slice(1);
  if(name==='favicon.ico'){res.writeHead(204).end();return;}
  if(name==='assets/bgm/boss.mp3'&&fs.existsSync(bgmPath)){res.setHeader('Content-Type','audio/mpeg');res.end(fs.readFileSync(bgmPath));return;}
  if(name==='production.html'){res.setHeader('Content-Type','text/html; charset=utf-8');res.end(embedded.replace('<script>globalThis.VARGUL_DEBUG_OVERRIDE=true</script>',''));return;}
  if (name !== 'embedded.html' && !allowed.has(name)) { res.writeHead(404).end(); return; }
  res.setHeader('Content-Type', name.endsWith('.js') ? 'text/javascript; charset=utf-8' : 'text/html; charset=utf-8');
  res.end(name === 'embedded.html' ? embedded : (name==='index.html'?html:fs.readFileSync(path.join(root, name))));
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
  const wins = new Set();
  for (const win of ['victory', 'ending']) {
    const data = (await AUDIO.renderPreview(win, false, 10)).getChannelData(0);
    let peak = 0, energy = 0, hash = 0;
    for (let i = 0; i < data.length; i++) { check(Number.isFinite(data[i]), 'Finite victory samples'); peak = Math.max(peak, Math.abs(data[i])); energy += data[i] * data[i]; if (i % 997 === 0) hash += data[i] * i; }
    const rms = Math.sqrt(energy / data.length);
    check(peak < .98 && rms > .005, 'Audible, unclipped ' + win + ' score (rms ' + rms + ', peak ' + peak + ')');
    wins.add(hash.toFixed(4)); results.push({ win, rms: +rms.toFixed(4), peak: +peak.toFixed(4) });
  }
  check(wins.size === 2, 'Victory and ending are distinct');
  for (const s of [0, 4]) {
    startStage(s); waveIdx = stage.waves.length; camLock = false; enemies = []; clearT = 0; scene = 'play'; update();
    const m = AUDIO.currentMusic();
    check(clearT > 0 && m?.victory === (s === 4 ? 'ending' : 'victory'), 'Clearing a stage starts the victory score');
    const name = m.name; AUDIO.enable(true); AUDIO.enable(false); AUDIO.enable(true);
    check(AUDIO.currentMusic()?.name === name, 'Mute/resume retains victory score');
  }
  startStage(1); check(AUDIO.currentMusic()?.victory === null && AUDIO.currentMusic()?.boss === false, 'Next stage replaces victory score');
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
  reset(); player.x=250; inputDown('KeyD');
  const walkFrames=new Set();
  for(let i=0;i<55;i++){updPlayer();walkFrames.add(namedPlayerFrame().id);}
  check('Player walking reaches all eight supplied frames',walkFrames.size===8 && namedPlayerFrame().source==='player_walk');
  clearInput();updPlayer();
  check('Walking stops at the original idle pose',namedPlayerFrame()===namedClip('player','idle') && player.walkTime===0);
  inputDown('KeyA');updPlayer();
  check('Walking restarts at frame zero and faces left',player.face===-1 && namedPlayerFrame()===namedClip('player','walk',0));
  clearInput();updPlayer();inputDown('KeyW');updPlayer();
  check('Depth movement also uses walking animation',namedPlayerFrame().source==='player_walk');
  clearInput();
  for (const distance of [40, 100, 160, 260, 310, -100, -260]) {
    reset(); player.x = distance < 0 ? 400 : 200; player.face = Math.sign(distance);
    enemies = [mkEnemy('grunt', player.x + distance, 420)]; startSkill('thrust');
    for (let i = 0; i < 50; i++) updPlayer();
    check('Thrust reaches target once at distance ' + distance, enemies[0].hp === enemies[0].max-28 && player.st === 'free');
  }
  reset(); player.x = 200; enemies = [mkEnemy('grunt', 300, 485)]; startSkill('thrust');
  for (let i = 0; i < 50; i++) updPlayer();
  check('Thrust respects lane', enemies[0].hp === enemies[0].max);
  reset(); player.x=200; player.face=1; enemies=[mkEnemy('grunt',320,420),mkEnemy('grunt',380,420)];
  startSkill('slam'); for(let i=0;i<50;i++)updPlayer();
  check('Slam expanded reach and outer limit', enemies[0].hp===enemies[0].max-24 && enemies[1].hp===enemies[1].max);
  reset(); player.x=200; player.face=1; enemies=[mkEnemy('grunt',300,420),mkEnemy('grunt',100,420)];
  startSkill('whirl'); player.t=11; updPlayer();
  check('Whirl deals sixteen on both sides at expanded range', enemies.every(e=>e.hp===e.max-16));
  for (const id of [...Object.keys(SKILLS), 'special', 'cast']) for (const dir of [-1,1]) for (const distance of [-60,20,180]) {
    reset();player.x=320;player.face=-dir;player.mg=3;
    enemies=[mkEnemy('grunt',player.x+dir*distance,420)];
    inputDown(dir===1?'ArrowRight':'ArrowLeft');
    if(id==='special')startSpecial();else if(id==='cast')startCast();else startSkill(id);
    check('All skills honor input '+id+' '+dir+' '+distance,player.face===dir);
    clearInput();
    for(let i=0;i<40;i++)updPlayer();
    check('All skills avoid backward movement '+id+' '+dir+' '+distance,player.face===dir&&(player.x-320)*dir>=-.001);
  }
  for (const id of [...Object.keys(SKILLS), 'special', 'cast']) for (const dir of [-1,1]) {
    reset();player.x=320;player.face=dir;player.mg=3;enemies=[mkEnemy('grunt',320-dir*50,420)];
    if(id==='special')startSpecial();else if(id==='cast')startCast();else startSkill(id);
    check('All skills retain facing without input '+id+' '+dir,player.face===dir);
  }
  for (const [key, dir] of [['ArrowRight',1],['ArrowLeft',-1],['KeyD',1],['KeyA',-1],[null,1],[null,-1]]) {
    reset(); player.x=320; player.face=key ? -dir : dir;
    enemies=[mkEnemy('grunt',player.x-dir*60,420),mkEnemy('grunt',player.x+dir*180,420)];
    if(key)inputDown(key);
    inputDown('KeyL');updPlayer();
    check('Red wave honors aim with closer enemy behind '+key+' '+dir,player.skill==='redwave'&&player.face===dir);
    clearInput();inputDown(dir===1?'ArrowLeft':'ArrowRight');
    for(let i=0;i<20;i++)updPlayer();
    check('Red wave locks selected direction through windup '+key+' '+dir,hazards.length===1&&hazards[0].dir===dir);
    for(let i=0;i<35;i++)updHazards();
    check('Red wave hits forward target, not enemy behind '+key+' '+dir,enemies[0].hp===enemies[0].max&&enemies[1].hp===enemies[1].max-24);
  }
  for(const dir of [1,-1]) {
    reset(); player.x=dir===1?100:700; player.face=dir;
    enemies=[mkEnemy('grunt',player.x+dir*300,420),mkEnemy('grunt',player.x+dir*460,420),
      mkEnemy('grunt',player.x+dir*300,480),mkEnemy('grunt',player.x+dir*300,420)];
    enemies[3].z=100;
    startSkill('redwave');
    for(let i=0;i<17;i++)updPlayer();
    check('Red wave has harmless windup '+dir, hazards.length===0);
    for(let i=0;i<30;i++)updPlayer();
    check('Red wave fires once and enters cooldown '+dir, hazards.length===1 && player.skillCd.redwave>0 && !canStartSkill('redwave'));
    for(let i=0;i<65;i++)updHazards();
    check('Red wave pierces once, respects depth and height, expires '+dir,
      enemies[0].hp===enemies[0].max-24 && enemies[1].hp===enemies[1].max-24 && enemies[2].hp===enemies[2].max && enemies[3].hp===enemies[3].max && hazards.length===0);
  }
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
  const bossPats = type => { const id0 = nextId, pats = mkEnemy(type, 0, 0).d.pats; nextId = id0; return pats; };
  for (const type of ['boss1', 'boss2', 'boss3', 'boss4', 'boss5']) for (const p2 of [false, true]) for (const pat of Object.keys(type==='boss4'?VARGUL_TIMELINES[p2?1:0]:bossPats(type))) {
    reset(); startStage(Number(type.slice(-1)) - 1); scene = 'play'; player.x = 210; player.inv = 99999;
    const b = mkEnemy(type, 370, 420); enemies = [b]; if (p2) {b.hp = b.max * .4;b.p2shown=true;} startPat(b, pat);
    for (let i = 0; i < 270 && b.st === 'pat'; i++) { updEnemy(b); updHazards(); updFx(); if (i % 45 === 0) render(); }
    patterns++;
  }
  hdFrame = originalFrame; check('All ' + patterns + ' boss pattern/phase cases render', missing.size === 0);
  for (let s = 0; s < 5; s++) {
    reset(); startStage(s); scene = 'play'; hitStop = 0;
    for (let w = 0; w < stage.waves.length; w++) {
      camX = stage.waves[w].at; player.x = camX + 256; camLock = false; waveIdx = w; enemies = []; update();
      if (scene === 'bossintro') for (let i = 0; i < Math.ceil(bossIntroDuration(introBoss)/MS)+1; i++) update();
      for (const e of [...enemies]) if (e.st !== 'dead') damageEnemy(e, 1e6, true);
      for(const e of enemies)if(e.st==='reviving'){
        for(let i=0;i<261;i++)updEnemy(e);
        damageEnemy(e,1e6,true);
      }
      for(const e of enemies)if((e.type==='boss3'||isVargul(e)||isSovereign(e))&&e.st!=='dead'){   // Refilled bosses require a second depletion.
        for(let i=0;i<300&&e.phaseT>0;i++)updEnemy(e);
        damageEnemy(e,1e6,true);
      }
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
const timeout = setTimeout(() => { console.error('Browser test timed out'); browser?.kill(); server.close(); process.exit(1); }, process.env.SOVEREIGN_MOTION_SUITE||process.env.AURELION_SUITE||process.env.VARGUL_SUITE||process.env.VARGUL_STAGE3||process.env.VARGUL_STAGE4||process.env.VARGUL_ORB_AI||process.env.VARGUL_VISUAL_SUITE||process.env.VARGUL_ULTIMATE_SUITE||process.env.BOSS_GROGGY_SUITE?360000:90000);
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
      else if((process.env.VARGUL_SUITE||process.env.VARGUL_STAGE3||process.env.VARGUL_STAGE4||process.env.BOSS_GROGGY_SUITE||process.env.VARGUL_CAPTURE_CONSOLE||process.env.VARGUL_ORB_AI||process.env.VARGUL_VISUAL_SUITE||process.env.VARGUL_ULTIMATE_SUITE)&&m.method==='Runtime.consoleAPICalled'&&m.params.type==='error')errors.push(m.params.args.map(a=>a.value||a.description).join(' '));
      else if((process.env.VARGUL_SUITE||process.env.VARGUL_STAGE3||process.env.VARGUL_STAGE4||process.env.BOSS_GROGGY_SUITE||process.env.VARGUL_CAPTURE_CONSOLE||process.env.VARGUL_ORB_AI||process.env.VARGUL_VISUAL_SUITE||process.env.VARGUL_ULTIMATE_SUITE)&&m.method==='Log.entryAdded'&&m.params.entry.level==='error')errors.push(m.params.entry.text);
    };
    const target = await call('Target.createTarget', { url: 'about:blank' }, null);
    session = (await call('Target.attachToTarget', { targetId: target.targetId, flatten: true }, null)).sessionId;
    await call('Page.enable'); await call('Runtime.enable');
    if(process.env.VARGUL_SUITE||process.env.VARGUL_STAGE3||process.env.VARGUL_STAGE4||process.env.BOSS_GROGGY_SUITE||process.env.VARGUL_CAPTURE_CONSOLE||process.env.VARGUL_ORB_AI||process.env.VARGUL_VISUAL_SUITE||process.env.VARGUL_ULTIMATE_SUITE)await call('Log.enable');
    await call('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
    const base = 'http://127.0.0.1:' + server.address().port;
    if(process.env.JUDGMENT_SUITE){await ready(base+'/embedded.html');await require('./judgment.cjs')({evaluate,call,errors,root});return;}
    if(process.env.VIESA_UI_SUITE){await ready(base+'/embedded.html');await require('./viesa-ui.cjs')({evaluate,call,errors,root});return;}
    if(process.env.MORGRA_DEATH_SUITE){await ready(base+'/embedded.html');await require('./morgra-death.cjs')({evaluate,call,errors,root});return;}
    if(process.env.DEATH_FADE_SUITE){await ready(base+'/embedded.html');await require('./death-fade.cjs')({evaluate,call,errors,root});return;}
    if(process.env.VIESA_FIXES_SUITE){await ready(base+'/embedded.html');await require('./viesa-fixes.cjs')({evaluate,call,errors,root});return;}
    if(process.env.CHARACTER_SELECT_SUITE){await ready(base+'/embedded.html');await require('./character-select.cjs')({evaluate,call,errors,root});return;}
    if(process.env.COMBAT_UPDATE_SUITE){await ready(base+'/embedded.html');await require('./combat-update.cjs')({evaluate,call,errors,root});return;}
    if(process.env.SOVEREIGN_MOTION_SUITE){await ready(base+'/embedded.html');await require('./sovereign-motion.cjs')({evaluate,call,errors,root});return;}
    if(process.env.BOSS_INTRO_HUD_SUITE){await ready(base+'/embedded.html');await require('./boss-intro-hud.cjs')({evaluate,call,errors,root});return;}
    if(process.env.ENEMY_UI_SUITE){await ready(base+'/embedded.html');await require('./enemy-ui.cjs')({evaluate,call,errors,root});return;}
    if(process.env.PIXEL_UI_SUITE){await ready(base+'/embedded.html');await require('./pixel-ui.cjs')({evaluate,call,errors,root});return;}
    if(process.env.BOSS_CHALLENGE_SUITE){await ready(base+'/embedded.html');await require('./boss-challenge.cjs')({evaluate,call,errors,root});return;}
    if(process.env.BOSS_GROGGY_SUITE){await ready(base+'/embedded.html');await require('./boss-groggy.cjs')({evaluate,call,errors,root});return;}
    if(process.env.VARGUL_ULTIMATE_SUITE){await ready(base+'/embedded.html');await require('./vargul-ultimate.cjs')({evaluate,call,errors,root});return;}
    if(process.env.VARGUL_MELEE_SUITE){await ready(base+'/embedded.html');await require('./vargul-melee.cjs')({evaluate,call,errors,root});return;}
    if(process.env.VARGUL_VISUAL_SUITE){await ready(base+'/embedded.html');await require('./vargul-visual.cjs')({evaluate,call,errors,root});return;}
    if(process.env.VARGUL_ORB_AI){await ready(base+'/embedded.html');await require('./vargul-orb-ai.cjs')({evaluate,call,errors,root});return;}
    if(process.env.VARGUL_STAGE4){await ready(base+'/embedded.html');await require('./vargul-stage4.cjs')({evaluate,call,errors,root});return;}
    if(process.env.VARGUL_STAGE3){await ready(base+'/embedded.html');await require('./vargul-stage3.cjs')({evaluate,call,errors,root});return;}
    if(process.env.VARGUL_SUITE){await ready(base+'/embedded.html');await require('./vargul.cjs')({evaluate,call,errors,root,base,ready});return;}
    if(process.env.AURELION_SUITE){await ready(base+'/embedded.html');await require('./aurelion.cjs')({evaluate,call,errors,root});return;}
    await ready(base); await evaluate('window.requestAnimationFrame=()=>0; toTutorial()');
    for (const [width, height] of [[1280, 720], [960, 540], [390, 844], [844, 390]]) {
      await call('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
      const bounds = await evaluate(`(()=>{const h=document.querySelector('#tutorial h2').getBoundingClientRect(),b=$('btnGo').getBoundingClientRect(),d=document.querySelector('#tutorial .dialog-body');return {top:h.top,bottom:b.bottom,left:b.left,right:b.right,scroll:getComputedStyle(d).overflowY};})()`);
      assert(bounds.top >= 0 && bounds.bottom <= height && bounds.left >= 0 && bounds.right <= width, 'Tutorial fits ' + width + 'x' + height);
      assert.equal(bounds.scroll, 'auto');
      await screenshot('tutorial-' + width);
    }
    await call('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
    await evaluate('NAMED_ATLAS.decode()');
    await evaluate('Promise.all(FLOOR_IMAGES.map(im=>im.decode()))');
    assert.equal(await evaluate(`(()=>{
      if(GTOP!==340||GBOT!==500)return false;
      const original=ctx.drawImage;
      try {
        for(let n=0;n<5;n++) {
          player=newPlayer();startStage(n);
          if(FLOOR_ART[n].filename!==(n+1)+'스테이지 바닥.png')return false;
          for(const x of [-1,0,639.5,1280.25,stage.len-VW]) {
            camX=x;let calls=0;
            ctx.drawImage=function(im,...args){if(im!==FLOOR_IMAGES[n])throw Error('Wrong stage floor');calls++;return original.call(this,im,...args)};
            if(!drawStageFloor()||calls<1)return false;
          }
          const saved=FLOOR_IMAGES[n];FLOOR_IMAGES[n]=null;
          try{if(drawStageFloor()!==false)return false;ctx.drawImage=original;drawFloor(stage.theme)}finally{FLOOR_IMAGES[n]=saved}
        }
      }finally{ctx.drawImage=original;camX=0}
      return true;
    })()`),true,'Five floor mappings, scrolling, unchanged lanes and missing-image fallback');
    console.log('PASS Five supplied stage floors decode, scroll and fall back safely');

    assert.equal(await evaluate("NAMED_SPRITES.sources.gorath_motion.filename"),'1스테이지 보스 고라스 모션.png');
    assert.equal(await evaluate("NAMED_SPRITES.sources.player.filename"),'다크 기사 전투 스프라이트 시트.png');
    assert.equal(await evaluate(`(()=>{player=newPlayer();startStage(1);const b=mkEnemy('boss2',400,420);if(namedEnemyRole(b)!==null)return false;b.p2shown=true;return namedEnemyRole(b)==='boss2p2' && namedEnemyRole(mkEnemy('boss5',400,420))==='boss5'})()`),true);
    for(const stage of [0,1,2,3,4]) {
      assert.equal(await evaluate(`(()=>{player=newPlayer();startStage(${stage});scene='play';player.inv=0;const b=mkEnemy(STAGES[${stage}].boss,430,420);b.p2shown=true;enemies=[b];for(const st of ['chase','hurt','dead']){b.st=st;b.t=10;if(!namedEnemyFrame(b))return false;render();}b.st='pat';for(const pat of Object.keys(b.d.pats)){b.pat=pat;b.pt=800;render()}return true})()`),true);
      await screenshot('named-boss-'+(stage+1));
    }
    assert.equal(await evaluate(`(()=>{player=newPlayer();startStage(0);scene='play';player.inv=0;for(const id of Object.keys(SKILLS)){player.st='skill';player.skill=id;for(const t of [0,12,20,30,36]){player.t=t;if(!['player_base','player_moves'].includes(namedPlayerFrame().source))return false;render()}}player.st='free';return namedPlayerFrame()===namedClip('player','idle') && namedPlayerFrame().source==='player_base'})()`),true);
    for(const state of ['idle','dash','thrust','slam','whirl','leap','air','redwave']) {
      await evaluate(`player=newPlayer();startStage(0);scene='play';showScreen(null);player.inv=0;player.x=250;enemies=[];player.t=22;player.st=${JSON.stringify(state==='idle'?'free':state==='dash'?'dash':state==='air'?'atk':'skill')};player.skill=${JSON.stringify(state)};player.atk='air';player.z=${state==='air'?65:0};updateSkillButtons();render()`);
      await screenshot('new-player-'+state);
    }
    await screenshot('named-player');
    for(const face of [-1,1]) {
      await evaluate(`player=newPlayer();startStage(0);scene='play';showScreen(null);player.inv=0;player.x=300;player.walk=true;player.walkTime=350;player.face=${face};enemies=[];render()`);
      await screenshot('player-walk-'+face);
    }
    await evaluate('toTitle(); document.getElementById("namedTitleImage").decode()');
    assert.equal(await evaluate(`getComputedStyle($('btnTitleSettings')).backgroundImage.startsWith('url(')`),true,'Settings uses supplied artwork');
    assert.equal(await evaluate(`getComputedStyle($('btnTitleSettings')).backgroundSize`),'contain','Settings art is fitted inside button');
    for(const [width,height] of [[1920,1080],[844,390],[390,844]]) {
      await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
      assert.equal(await evaluate(`(()=>{const r=$('wrap').getBoundingClientRect();return ['btnStart','btnContinue','btnTitleSettings'].every(id=>{const b=$(id).getBoundingClientRect();return b.top>=r.top&&b.bottom<=r.bottom&&b.left>=r.left&&b.right<=r.right})})()`),true,'Named title controls fit');
      await screenshot('named-title-'+width);
    }
    await call('Emulation.setDeviceMetricsOverride',{width:1280,height:720,deviceScaleFactor:1,mobile:false});
    await screenshot('named-title');
    for(let stage=0;stage<5;stage++) {
      assert.equal(await evaluate(`(()=>{player=newPlayer();startStage(${stage});scene='play';player.inv=0;enemies=['grunt','rogue','archer','brute'].map((type,i)=>mkEnemy(type,230+i*110,420));for(const e of enemies){for(const st of ['chase','wind','act','rec','hurt','down','dead']){e.st=st;e.t=4;const f=namedEnemyFrame(e);if(!f||f.source!==(e.type==='brute'?'heavy${stage+1}':'soldiers${stage+1}'))return false;render()}e.st='chase';e.walk=false;}render();return true})()`),true,'All soldier states use stage '+(stage+1)+' art');
      await screenshot('soldiers-stage-'+(stage+1));
      assert.equal(await evaluate(`(()=>{const e=enemies[3],actor=namedEnemyRole(e);if(actor!=='stage${stage+1}_brute')return false;const ids=[];for(const [st,t] of [['wind',0],['wind',30],['act',0],['act',8],['rec',0]]){e.st=st;e.t=t;ids.push(namedEnemyFrame(e).id)}if(new Set(ids).size!==5)return false;e.st='chase';e.walk=true;for(const tickValue of [0,12,24,36]){tick=tickValue;if(namedEnemyFrame(e).source!=='heavy${stage+1}')return false;}e.st='dead';e.t=35;return namedEnemyFrame(e).id===NAMED_SPRITES.clips[actor].death.at(-1)})()`),true,'Heavy knight windup, active, recovery, walk and final death '+(stage+1));
      await evaluate(`enemies=['chase','wind','act','hurt','dead'].map((st,i)=>{const e=mkEnemy('brute',100+i*110,420);e.st=st;e.t=st==='dead'?30:4;e.face=i===3?-1:1;return e});player.x=40;render()`);
      await screenshot('heavy-knights-stage-'+(stage+1));
    }
    assert.equal(await evaluate(`(()=>{const e=enemies[0];e.st='dead';e.t=60;const f=namedEnemyFrame(e);const ids=NAMED_SPRITES.clips[namedEnemyRole(e)].death;return f.id===ids.at(-1)})()`),true,'Soldier death reaches final frame before removal');
    console.log('PASS All five soldier themes, all states, heavy infantry and completed death animation');

    console.log('PASS Named sprite roles, phase-two gate, player techniques, boss states and title GIF');
    for(const p2 of [false,true]) {
      assert.equal(await evaluate(`(()=>{player=newPlayer();startStage(4);scene='play';player.x=170;player.inv=0;const b=mkEnemy('boss5',400,420);enemies=[b];b.p2shown=${p2};b.st='chase';b.walk=false;for(const state of ['chase','hurt','stun','dead']){b.st=state;b.t=80;if(namedEnemyFrame(b)?.source!=='emperor')return false;}for(const pat of Object.keys(b.d.pats)){b.st='pat';b.pat=pat;for(const t of [0,500,1000,1800]){b.pt=t;if(namedEnemyFrame(b)?.source!=='emperor')return false;render();}}b.st='chase';b.t=0;render();return true})()`),true,'Emperor source for every boss state and phase');
      await screenshot('emperor-phase-'+(p2?2:1));
    }
    await evaluate('toTutorial()');
    await evaluate('Promise.all(Object.values(RELEASE_IMAGES).map(im=>im.decode()))');
    assert.equal(await evaluate('Object.values(RELEASE_IMAGES).every(im=>im.naturalWidth>0)'), true);
    console.log('PASS All release images decode, including opening and phase arenas');
    await evaluate(`beginGame(true); openingTime=5000; drawOpening(); onKeyOnce('Space')`);
    assert.equal(await evaluate('scene'), 'intro');
    assert.equal(await evaluate("$('openingSkip').hidden"), true);
    await evaluate('beginGame(true); openingTime=17999; update()');
    assert.equal(await evaluate('scene'), 'intro');
    console.log('PASS Opening skip and automatic completion start stage one');
    for (const n of [0,2,3,4]) {
      assert.equal(await evaluate(`(()=>{player=newPlayer();startStage(${n});scene='play';const b=mkEnemy(STAGES[${n}].boss,430,420);enemies=[b];const v=isVargul(b),sv=isSovereign(b);b.hp=b.type==='boss3'||v||sv?b.max*.05:b.max*.51;damageEnemy(b,b.max*.1,false);const duration=v?288:sv?SOVEREIGN_RULES.kneelDown+SOVEREIGN_RULES.awaken:isAurelion(b)?242:72;if(b.phaseT!==duration||!b.invuln)return false;const hp=b.hp;damageEnemy(b,10,false);if(b.hp!==hp)return false;for(let t=0;t<duration;t++)updEnemy(b);return b.hp===(v?2500:sv?SOVEREIGN_RULES.hp[1]:hp)&&!b.invuln&&b.st===(v||sv?'chase':'rec')&&b.z===0})()`),true,'Safe phase transition');
      const key = await evaluate(`(()=>{player=newPlayer();startStage(${n});scene='play';const b=mkEnemy(STAGES[${n}].boss,430,420);enemies=[b];b.hp=b.max*.4;b.p2shown=true;render();return releaseBackdropKey()})()`);
      assert.equal(key,[3,4].includes(n)?'phase'+(n+1):'boss'+(n+1));
    }
    for (const [width,height] of [[1920,1080],[1280,720],[844,390]]) {
      await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
      const layout=await evaluate(`(()=>{UX.options.touch=false;UX.applySettings?.();document.body.classList.remove('touch');$('skillbar').hidden=false;player=newPlayer();startStage(3);scene='play';enemies=[mkEnemy('boss4',430,420)];render();const c=cv.getBoundingClientRect(),s=$('skillbar').getBoundingClientRect();return {gap:(c.top+350*c.height/H)-s.bottom,bottom:s.bottom<=c.bottom+1}})()`);
      assert(layout.gap>=0 && layout.bottom,JSON.stringify(layout)+' Boss bar and skillbar do not overlap at '+width);
      await screenshot('release-boss-'+width);
    }
    await evaluate(`(()=>{const b=enemies[0];drawBossBar(b);b.hp-=40;tick++;drawBossBar(b);if(!(b.hud.lag>b.hud.value&&b.hud.value>b.hp))throw Error('Damage trail');scene='pause';const v=b.hud.value;tick++;drawBossBar(b);if(b.hud.value!==v)throw Error('HUD changed during pause');scene='play';})()`);
    console.log('PASS Phase backgrounds, bottom HUD layout, delayed damage and paused HUD');
    await call('Emulation.setDeviceMetricsOverride',{width:1280,height:720,deviceScaleFactor:1,mobile:false});
    console.log('PASS ' + await evaluate('(' + spriteChecks.toString() + ')()'));
    console.log('PASS ' + await evaluate('(' + legionChecks.toString() + ')()'));
    console.log('PASS Ten orchestral scores and boss music lifecycle: ' + JSON.stringify(await evaluate('(' + scoreChecks.toString() + ')()')));
    for (const [stage, boss, name] of [[0, false, 'stage-march'], [2, true, 'boss-aurelion'], ["'victory'", false, 'victory'], ["'ending'", false, 'ending']]) {
      fs.writeFileSync(path.join(profile, name + '.wav'), Buffer.from(await evaluate('(' + scorePreviewWav.toString() + ')(' + stage + ',' + boss + ')'), 'base64'));
    }
    const results = await evaluate('(' + combatChecks.toString() + ')()');
    results.forEach(name => console.log('PASS ' + name));
    await ready(base); assert.deepEqual(await evaluate('({stage:UX.checkpoint().stage,score:UX.checkpoint().score})'), { stage: 1, score: 2345 });
    console.log('PASS Checkpoint persists across page reload');
    await evaluate(`(()=>{const bindings={...UX.options.bindings};delete bindings.KeyL;bindings.KeyJ='KeyL';localStorage.setItem('bmk_settings',JSON.stringify({...UX.options,bindings}))})()`);
    await ready(base);
    assert.equal(await evaluate("UX.options.bindings.KeyJ==='KeyL' && UX.options.bindings.KeyL==='KeyB' && new Set(Object.values(UX.options.bindings)).size===14"),true);
    console.log('PASS Legacy bindings preserve remaps and allocate an unused red-wave key');
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
    const points = await evaluate(`(()=>{const s=$('touchStick').getBoundingClientRect(),j=document.querySelector('[data-control="KeyJ"]').getBoundingClientRect();return [{x:s.x+s.width*.9,y:s.y+s.height/2,id:1},{x:j.x+j.width/2,y:j.y+j.height/2,id:2}];})()`);
    assert.equal(await evaluate('getComputedStyle($("touchStick")).opacity'), '0.55');
    assert.equal(await evaluate('!!document.querySelector("[data-control=KeyJ] svg") && !!document.querySelector("[data-control=KeyU] .skill-icon")'), true);
    await call('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points });
    assert.equal(await evaluate('!!keys.KeyD && !!keys.KeyJ'), true);
    await call('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
    assert.equal(await evaluate('!!keys.KeyD || !!keys.KeyJ'), false);
    console.log('PASS Multi-touch movement/attack and pointer cancellation'); await screenshot('touch');
    const stickAt = (fx, fy) => evaluate(`(()=>{const s=$('touchStick').getBoundingClientRect();return {x:s.x+s.width*${fx},y:s.y+s.height*${fy},id:5};})()`);
    await call('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [await stickAt(.15, .15)] });
    assert.equal(await evaluate('[keys.KeyA,keys.KeyW,keys.KeyD,keys.KeyS].map(Boolean).join()'), 'true,true,false,false');
    await call('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [await stickAt(.5, .95)] });
    assert.equal(await evaluate('[keys.KeyA,keys.KeyW,keys.KeyD,keys.KeyS].map(Boolean).join()'), 'false,false,false,true');
    await call('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    assert.equal(await evaluate('!!(keys.KeyA||keys.KeyW||keys.KeyD||keys.KeyS)'), false);
    console.log('PASS Touch lever maps diagonals and releases on lift');
    await evaluate('openSettings("pause");$("touchEnabled").checked=false;$("touchEnabled").onchange()');
    assert.equal(await evaluate('$("touchControls").hidden'), true);
    await evaluate('$("touchEnabled").checked=true;$("touchEnabled").onchange()');
    assert.equal(await evaluate('!$("touchControls").hidden && $("touchControls").classList.contains("preview")'), true);
    await evaluate('closeSettings();scene="play";showScreen(null)');
    console.log('PASS Mobile keys appear immediately when enabled in settings');
    await evaluate('openSettings("pause");$("btnTouchEdit").click()');
    assert.equal(await evaluate('$("touchControls").classList.contains("editing") && !$("settings").classList.contains("show") && !$("touchEditBar").hidden'), true);
    const atk0 = await evaluate('(()=>{const r=document.querySelector("[data-control=KeyJ]").getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,w:r.width};})()');
    await call('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: atk0.x, y: atk0.y, id: 7 }] });
    await call('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: atk0.x - 60, y: atk0.y - 120, id: 7 }] });
    await call('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    assert.equal(await evaluate('!!keys.KeyJ'), false);
    await evaluate('document.querySelector("[data-edit=bigger]").click();document.querySelector("[data-edit=bigger]").click()');
    const atk1 = await evaluate('(()=>{const r=document.querySelector("[data-control=KeyJ]").getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,w:r.width};})()');
    assert(Math.abs(atk1.x - (atk0.x - 60)) < 2 && Math.abs(atk1.y - (atk0.y - 120)) < 2, JSON.stringify([atk0, atk1]));
    assert(Math.abs(atk1.w / atk0.w - 1.2) < .02);
    await screenshot('touch-edit');
    await evaluate('openSettings("pause")');
    await evaluate('const b=document.querySelector("[data-control=KeyO]");b.dispatchEvent(new PointerEvent("pointerdown",{bubbles:true,pointerId:9}));document.querySelector("[data-edit=hide]").click();document.querySelector("[data-edit=done]").click()');
    assert.equal(await evaluate('!$("touchControls").classList.contains("editing") && $("settings").classList.contains("show")'), true);
    const savedLayout = await evaluate('JSON.parse(localStorage.getItem("bmk_settings")).touchLayout');
    assert(savedLayout.items.KeyJ.k === 1.2 && savedLayout.items.KeyO.hide === true, JSON.stringify(savedLayout));
    {
      await evaluate('$("touchAlpha").value=70;$("touchAlpha").oninput();$("touchScale").value=120;$("touchScale").oninput()');
      assert.equal(await evaluate('getComputedStyle($("touchStick")).opacity'), '0.3');
      await evaluate('$("btnTouchReset").click()');
      assert.equal(await evaluate('getComputedStyle($("touchStick")).opacity + "," + $("touchAlpha").value + "," + JSON.stringify(UX.options.touchLayout.items)'), '0.55,45,{}');
    }
    await evaluate('closeSettings();scene="play";showScreen(null)');
    assert.equal(await evaluate('getComputedStyle(document.querySelector("[data-control=KeyO]")).display !== "none"'), true);
    console.log('PASS Mobile key layout: drag, resize, hide, opacity, size, save and reset');
    await evaluate('clearInput();player.st="free";player.z=0;player.skillCd.thrust=0;updateSkillButtons()');
    const skillPoint = await evaluate('(()=>{const r=document.querySelector("[data-control=KeyU]").getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,id:3};})()');
    await call('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [skillPoint] });
    await evaluate('updPlayer();updateSkillButtons()');
    assert.equal(await evaluate('player.st'), 'skill');
    await call('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    assert.equal(await evaluate('!!keys.KeyU'), false);
    console.log('PASS Touch skill releases even when cooldown disables button');
    await evaluate('clearInput();player.st="free";player.skillCd.redwave=0;updateSkillButtons()');
    const redPoint=await evaluate('(()=>{const r=document.querySelector("[data-control=KeyL]").getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,id:4};})()');
    assert(redPoint.x<390 && redPoint.y<844);
    await call('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[redPoint]});
    assert.equal(await evaluate('updPlayer();player.skill'),'redwave');
    await call('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    assert.equal(await evaluate('!!keys.KeyL'),false);
    console.log('PASS Red wave is reachable and usable on mobile');
    const bgm = await evaluate(`(async()=>{
      const n=4000,b=new ArrayBuffer(44+n*2),v=new DataView(b),str=(at,t)=>[...t].forEach((c,i)=>v.setUint8(at+i,c.charCodeAt(0)));
      str(0,'RIFF');v.setUint32(4,36+n*2,true);str(8,'WAVE');str(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);
      v.setUint32(24,8000,true);v.setUint32(28,16000,true);v.setUint16(32,2,true);v.setUint16(34,16,true);str(36,'data');v.setUint32(40,n*2,true);
      for(let i=0;i<n;i++)v.setInt16(44+i*2,Math.round(Math.sin(i/8)*3000),true);
      const out={};AUDIO.enable(true);
      out.bad=await AUDIO.setBossFile(new File([new Uint8Array([1,2,3,4])],'broken.mp3'));
      out.good=await AUDIO.setBossFile(new File([b],'my-boss.mp3',{type:'audio/wav'}));
      out.status=$('bossBgmStatus').textContent;
      AUDIO.bossMusic(2);out.playing=AUDIO.currentMusic();
      await AUDIO.clearBossFile();out.after=AUDIO.currentMusic();out.info=AUDIO.bossInfo();
      AUDIO.stop(0);AUDIO.enable(false);return out;})()`);
    assert.equal(bgm.bad.ok, false);
    assert.equal(bgm.good.ok && bgm.good.saved, true, JSON.stringify(bgm));
    assert.equal(bgm.status, '내 파일: my-boss.mp3');
    assert.deepEqual([bgm.playing.file, bgm.playing.name, bgm.playing.boss], [true, 'my-boss.mp3', true]);
    assert.equal(bgm.after.file, fs.existsSync(bgmPath), 'clearing custom BGM restores the available built-in file or synth');
    assert.equal(bgm.info.source, fs.existsSync(bgmPath)?'default':'synth');
    console.log('PASS Boss BGM uses a chosen mp3, rejects broken files and restores the built-in fallback');
    await ready(base + '/embedded.html');
    assert.equal(await evaluate('scene'), 'title');
    await evaluate('window.requestAnimationFrame=()=>0;beginGame();scene="play";render()');
    console.log('PASS Single HTML bundle initializes and renders');
    assert.equal(await evaluate(`(()=>{
      player=newPlayer();startStage(0);scene='play';player.buff=0;
      if(mkEnemy('boss1',350,420).max!==700 || mkEnemy('boss2',350,420).max!==850)return false;
      const e=mkEnemy('brute',350,420);enemies=[e];barrels=[];e.hp=1000;e.max=1000;
      player.spX=e.x;player.spY=e.y;
      for(let k=0;k<4;k++){e.inv=0;e.st='chase';specialHit(false,k);}
      e.inv=0;e.st='chase';specialHit(true,4);
      if(e.hp!==874)return false;
      const b=mkEnemy('boss2',400,420);b.p2shown=true;b.hp=b.max=1200;
      if(pickMorgraPattern(b,250,0)!=='moon')return false;
      b.pat='moon';initMorgraPattern(b);
      if(b.morgraCooldown!==600 || pickMorgraPattern(b,250,0)==='moon')return false;
      b.morgraCooldown=0;if(pickMorgraPattern(b,60,0)!=='moon')return false;
      for(const kind of ['fire','frost','abyss']) {
        const alphas=[];const layer={rect:(...args)=>alphas.push(args[5]),line:()=>{}};
        hazards=[{type:'rift',kind,x:0,y:420,width:VW,depth:23,age:0,delay:1200}];
        enemies=[];drawGroundFx(layer);hazards[0].age=150;drawGroundFx(layer);
        if(alphas[0]<=alphas[1])return false;
        hazards[0].age=1200;if(riftWarningAlpha(hazards[0])!==1)return false;
      }
      const positions=[],original=ctx.translate;
      try {
        ctx.translate=function(x,y){positions.push(x);return original.call(this,x,y);};
        releaseBG.key=releaseBackdropKey();releaseBG.blend=1;
        drawReleaseBackdrop('stage1',0);const x0=positions[0];positions.length=0;
        drawReleaseBackdrop('stage1',120);if(positions[0]-x0!==-120)return false;
      } finally {ctx.translate=original;}
      hazards=[];return true;
    })()`),true,'Special damage, boss HP, phase-two moon cadence, hazard blinking and backdrop scroll');
    assert.equal(await evaluate(`(()=>{
      player=newPlayer();startStage(4);scene='play';camX=0;
      const regular=mkEnemy('brute',300,420), boss=mkEnemy('boss5',450,420);
      const weak=mkEnemy('archer',500,420), outside=mkEnemy('brute',VW+100,420);
      const immune=mkEnemy('boss3',550,420);
      enemies=[regular,boss,weak,outside,immune];
      for(const e of enemies){e.st='chase';e.alpha=1;e.phaseT=0;e.invuln=false;}
      regular.hp=200;regular.st='stun';boss.hp=1000;boss.st='stun';weak.hp=70;
      immune.invuln=true;const immuneHP=immune.hp,outsideHP=outside.hp;
      chain.n=20;fireBolts();
      return regular.hp===120 && boss.hp===920 && weak.hp===0 && weak.st==='dead'
        && outside.hp===outsideHP && immune.hp===immuneHP;
    })()`),true,'Lightning deals exactly 80 regardless of combo/stun; range and immunity preserved');
    console.log('PASS Fixed lightning damage against regular enemies and bosses');
    assert.equal(await evaluate(`(async()=>{
      await ITEM_READY;
      if(Object.keys(ITEM_SPRITES).length!==8) return false;
      for(const s of Object.values(ITEM_SPRITES)) {
        if(s.w<=0 || s.h<=0 || s.w>=s.image.width || s.h>=s.image.height) return false;
        if(s.image.getContext('2d').getImageData(0,0,1,1).data[3]!==0) return false;
      }
      for(const key of Object.keys(keys)) delete keys[key];
      for(const key of Object.keys(pressed)) delete pressed[key];
      dashReq=0; player=newPlayer(); items=[];
      for(const [type,points] of Object.entries(SCORE_ITEMS)) {
        const before=player.score; dropItem(type,player.x,player.y); updPlayer();
        if(player.score-before!==points) return false;
        updPlayer(); if(player.score-before!==points) return false;
      }
      for(const [type,hp] of [['potion',30],['big',60]]) {
        player.hp=1; dropItem(type,player.x,player.y); updPlayer();
        if(player.hp!==1+hp) return false;
      }
      player.sp=0;dropItem('crystal',player.x,player.y);updPlayer();
      if(player.sp!==25) return false;
      player.mg=0;dropItem('scroll',player.x,player.y);updPlayer();
      if(player.mg!==1) return false;
      const random=Math.random;
      try {
        for(const [r,type] of [[.45,'coin'],[.55,'coinBag'],[.59,'gold']]) {
          items=[];stat.kills=2;Math.random=()=>r;dropFrom({x:300,y:300});
          if(items[0]?.type!==type) return false;
        }
        for(const [r,type] of [[.90,'coin'],[.96,'coinBag'],[.99,'gold']]) {
          items=[];Math.random=()=>r;dropFromBarrel({x:300,y:300});
          if(items[0]?.type!==type) return false;
        }
        items=[];dropFrom({boss:true,x:300,y:300});
        if(items[0]?.type!=='gold') return false;
      } finally {Math.random=random;}
      items=[];return true;
    })()`), true);
    await evaluate(`ctx.fillStyle='#24202e';ctx.fillRect(0,0,960,540);Object.keys(ITEM_SPRITES).forEach((key,i)=>{drawItemSprite(key,65+i*116,280,80,80);outlineText(key,65+i*116,310);})`);
    await screenshot('item-sprites');
    console.log('PASS Item sprites, exact scores, single pickup, healing, SP, scroll and drop tables');
    assert.equal(await evaluate(`BAREL_ATLAS.naturalWidth > 0 && BAREL_PORTRAIT.naturalWidth > 0`), true);
    assert.equal(await evaluate(`document.querySelectorAll('#skillbar .skill-icon').length`), 5);
    assert.equal(await evaluate(`document.querySelectorAll('#touchPad .skill-icon').length`), 5);
    assert.equal(await evaluate(`(()=>{
      player=newPlayer();scene='play';player.inv=0;
      for(const st of ['free','atk','skill','dash','hurt','down','dead','cast','special']) {
        player.st=st;player.atk='c1';player.combo=0;player.skill='thrust';
        for(const t of [0,5,15,30,60]) {player.t=t;if(!barelPlayerFrame() || !drawBarelPlayer())return false;}
      }
      for(const id of Object.keys(SKILLS)) {player.st='skill';player.skill=id;player.t=25;drawBarelPlayer();}
      player.st='free';player.skillCd.thrust=2300;updateSkillButtons();
      return document.querySelector('[data-skill=thrust]').dataset.cooldown==='2.3';
    })()`), true);
    console.log('PASS Barel atlas, portrait, all player states, five effect icons and cooldown labels');

    assert.equal(await evaluate(`(()=>{
      practice=false;player=newPlayer();startStage(0);scene='play';camX=0;
      player.x=220;player.y=420;player.inv=0;
      const b=mkEnemy('boss1',100,420);enemies=[b];startPat(b,'hook');b.pt=500;
      const h={type:'hook',owner:b,x:200,y:420,h:62,dir:1,age:0,out:true,hit:false};hazards=[h];
      updHazards();
      if(player.st!=='grabbed'||player.hp!==player.max||player.x!==220||canStartSkill('thrust'))return false;
      inputDown('KeyJ');for(let i=0;i<4;i++)updPlayer();
      if(player.grab.presses!==1||player.x>=220)return false;
      inputUp('KeyJ');
      for(let i=0;i<2;i++){inputDown('KeyJ');updPlayer();inputUp('KeyJ');}
      if(player.st!=='grabbed'||player.grab.presses!==3)return false;
      inputDown('KeyJ');updPlayer();inputUp('KeyJ');
      return player.st==='free'&&!player.grab&&h.dead&&b.gr===40&&b.st==='hurt';
    })()`),true,'Hook pulls gradually, locks skills, and four fresh presses escape');
    assert.equal(await evaluate(`(()=>{
      function setup(dy=0,z=0,inv=0){
        clearInput();player=newPlayer();player.x=220;player.y=420+dy;player.z=z;player.inv=inv;
        const b=mkEnemy('boss1',100,420);enemies=[b];startPat(b,'hook');b.pt=500;
        const h={type:'hook',owner:b,x:200,y:420,h:62,dir:1,age:0,out:true,hit:false};hazards=[h];return {b,h};
      }
      for(const args of [[15,0,0],[0,40,0],[0,0,10]]){setup(...args);updHazards();if(player.st==='grabbed')return false;}
      let {b,h}=setup();updHazards();const hp=player.hp;
      for(let i=0;i<100&&player.grab;i++)updPlayer();
      if(player.hp!==hp-20||player.st!=='down'||player.grab||!h.dead)return false;
      ({b,h}=setup());updHazards();scene='pause';const x=player.x;for(let i=0;i<20;i++)update();
      if(player.x!==x||player.grab.hold!==0)return false;
      scene='play';b.st='dead';updHazards();
      return player.st==='free'&&!player.grab&&h.dead;
    })()`),true,'Hook avoids other lanes, jumping and invulnerability; timeout hits once; pause/death release safely');
    assert.equal(await evaluate(`(()=>{
      if(!GORATH_ATLAS.naturalWidth||GORATH_ART.idleHeight<=142*BAREL_PLAYER_SCALE)return false;
      player=newPlayer();player.inv=0;player.x=200;player.y=420;
      const b=mkEnemy('boss1',400,420);enemies=[b];hazards=[];
      for(const pat of ['sweep','slam','rage','hook','meat']) {
        startPat(b,pat);for(const time of [0,250,500,670,1000]){b.pt=time;if(!gorathEnemyFrame(b)||!drawGorath(b))return false;}
      }
      return true;
    })()`),true,'New Gorath atlas is larger than Barel and all five attacks render');
    console.log('PASS Gorath design and hook grab / escape / failure / cancellation');
    assert.equal(await evaluate(`(()=>{
      practice=false;player=newPlayer();startStage(1);scene='play';player.inv=0;chain.n=0;
      const b=mkEnemy('boss2',400,420);enemies=[b];b.gr=90;
      damageEnemy(b,b.max*.55,false);if(b.p2shown||b.st==='reviving')return false;
      b.inv=0;b.invuln=false;b.st='chase';const score=player.score;
      damageEnemy(b,99999,false);
      if(b.st!=='reviving'||b.hp!==0||b.p2shown||b.remove||player.score!==score||canHit(b))return false;
      damageEnemy(b,99999,true);if(player.score!==score)return false;
      for(let i=0;i<260;i++)updEnemy(b);
      if(b.st!=='reviving'||b.hp!==0)return false;
      updEnemy(b);
      if(!b.p2shown||b.hp!==1200||b.max!==1200||b.gr!==0||b.grMax!==240||!phase2(b)||b.invuln)return false;
      player.inv=0;const hp=player.hp;hurtPlayer(10,1,false,b);if(hp-player.hp!==15)return false;
      damageEnemy(b,99999,true);const award=player.score;damageEnemy(b,99999,true);
      return b.st==='dead'&&award===score+b.d.score&&player.score===award;
    })()`),true,'Morgra dies fully, waits, revives at full enhanced stats, awards only final death');
    assert.equal(await evaluate(`(()=>{
      for(const type of ['boss1','boss3','boss4','boss5']) {
        player=newPlayer();const b=mkEnemy(type,400,420);enemies=[b];chain.n=0;b.gr=90;b.hp=b.max*(type==='boss3'?.01:.51);
        if(isVargul(b)||isSovereign(b)){
          const t=isVargul(b)?288:SOVEREIGN_RULES.kneelDown+SOVEREIGN_RULES.awaken,hp2=isVargul(b)?2500:SOVEREIGN_RULES.hp[1];
          b.hp=1;damageEnemy(b,1,false,0,true);if(b.hp!==0||b.p2shown||b.phaseT!==t||b.gr!==0)return false;
          for(let i=0;i<t;i++)updEnemy(b);
          if(!b.p2shown||b.hp!==hp2||b.max!==hp2||b.gr!==0||b.grMax!==150)return false;
          player.inv=0;const health=player.hp;hurtPlayer(10,1,false,b);if(health-player.hp!==13)return false;
          continue;
        }
        const max=b.max,grMax=b.grMax;damageEnemy(b,b.max*.02,false);const hp=b.hp;
        if(!b.p2shown||b.gr!==0||b.max!==(type==='boss3'?2200:max)||b.grMax!==grMax||(type==='boss3'&&hp!==2200))return false;
        for(let i=0;i<72;i++)updEnemy(b);
        if(b.hp!==hp)return false;
        player.inv=0;const health=player.hp;hurtPlayer(10,1,false,b);if(health-player.hp!==13)return false;
      }
      let previous=0,previousD=0;
      for(let s=0;s<5;s++){stageIdx=s;const e=mkEnemy('grunt',0,420);if(e.max<=previous||e.d.dmg<=previousD)return false;previous=e.max;previousD=e.d.dmg;}
      {// 아우렐리온: 50%에서는 넘어가지 않고, 1페이즈 체력이 다하면 체력·그로기 완전 회복 후 같은 각성 모션
        player=newPlayer();const b=mkEnemy('boss3',400,420);enemies=[b];chain.n=0;const score=player.score,drops=items.length;
        b.hp=b.max*.51;damageEnemy(b,b.max*.02,false);if(b.p2shown||b.phaseT)return false;
        b.st='chase';b.hp=5;b.gr=b.grMax-1;b.grT=100;damageEnemy(b,50,false);
        if(!b.p2shown||b.max!==2200||b.hp!==2200||b.gr!==0||b.grT!==0||b.nextKd!==2200*.75||b.st==='dead'||!b.invuln||b.phaseT!==(isAurelion(b)?242:72))return false;
        if(player.score!==score||items.length!==drops)return false;
        for(let i=0;i<300&&b.phaseT>0;i++)updEnemy(b);
        if(b.invuln||b.phaseT||b.hp!==2200)return false;
        damageEnemy(b,b.max*2,true);if(b.st!=='dead')return false;
      }
      const id0=nextId,hp=['boss1','boss2','boss3','boss4','boss5'].map(t=>mkEnemy(t,0,0).max);nextId=id0;return hp.every((v,i)=>!i||hp[i-1]<v);
    })()`),true,'Stage difficulty increases; other bosses only reset groggy and boost phase damage');
    assert.equal(await evaluate(`(()=>{
      player=newPlayer();startStage(1);scene='play';player.inv=0;player.x=220;player.y=420;
      const b=mkEnemy('boss2',100,420);enemies=[b];hazards=[];startPat(b,'magic_bolt');
      b.pt=27*MS;runPat(b);if(hazards.some(h=>h.kind==='bolt'))return false;
      b.pt=28*MS;runPat(b);runPat(b);if(hazards.filter(h=>h.kind==='bolt').length!==1)return false;
      hazards=[];startPat(b,'curtain');b.pt=36*MS;runPat(b);const h=hazards.find(h=>h.kind==='pillar');
      const hp=player.hp;h.age=(h.delay+5)*MS;updateMorgraHazard(h);if(player.hp!==hp)return false;
      player.x+=100;h.age=(h.delay+6)*MS;updateMorgraHazard(h);if(player.hp!==hp||h.x!==220)return false;
      player.x=220;updateMorgraHazard(h);const loss=hp-player.hp;updateMorgraHazard(h);
      if(loss!==14||player.hp!==hp-14)return false;
      player=newPlayer();player.inv=0;player.x=220;player.y=420;
      const moon={type:'morgra',kind:'moon_field',age:102*MS,delay:96,life:120,safe:[{x:220,y:420}],owner:b,damageScale:1.5};
      updateMorgraHazard(moon);if(player.hp!==player.max)return false;
      player.x=330;updateMorgraHazard(moon);return player.hp===player.max-33;
    })()`),true,'Morgra event timing, single spawn, pillar warning/lane and moon safety match damage');
    assert.equal(await evaluate('MORGRA_ART.clips.moon.length===7 && MORGRA_ART.clips.fx_moon.length===3 && !!morgraFrame("p2_curtain",28) && !!morgraFrame("moon",124)'),true,'Morgra character moon and effect moon remain distinct');
    console.log('PASS Morgra resurrection, frame combat and progressive difficulty');

    await call('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
    await evaluate('player=newPlayer();startStage(0);scene="play";showScreen(null);player.x=230;player.inv=0;player.y=420;enemies=[mkEnemy("boss1",400,420)];hazards=[];render()');
    await screenshot('gorath-design');
    await evaluate('startPat(enemies[0],"slam");enemies[0].pt=720;render()');
    await screenshot('gorath-slam');
    await evaluate('startPat(enemies[0],"hook");enemies[0].face=-1;enemies[0].pt=600;hazards=[{type:"hook",owner:enemies[0],x:player.x,y:player.y,h:58,dir:-1,age:0,out:true,hit:false}];catchGorathHook(hazards[0]);render()');
    await screenshot('gorath-grab');
    await evaluate('UX.options.touch=false;document.body.classList.remove("touch");player=newPlayer();startStage(1);scene="play";showScreen(null);player.x=210;player.y=420;player.inv=0;enemies=[mkEnemy("boss2",410,420)];hazards=[];render()');
    await screenshot('morgra-phase1');
    await evaluate('damageEnemy(enemies[0],99999,true);enemies[0].t=210;render()');
    await screenshot('morgra-revive');
    await evaluate('enemies[0].t=260;updEnemy(enemies[0]);startPat(enemies[0],"p2_curtain");enemies[0].pt=28*MS;runPat(enemies[0]);render()');
    await screenshot('morgra-phase2');
    await evaluate('hazards=[];startPat(enemies[0],"moon");enemies[0].pt=28*MS;runPat(enemies[0]);render()');
    await screenshot('morgra-moon');
    await evaluate('hazards=[];enemies=[];player.st="dash";player.t=5;render()');
    await screenshot('barel-dash-feet');
    await evaluate('UX.options.touch=false;document.body.classList.remove("touch");player=newPlayer();startStage(2);scene="play";player.x=210;player.inv=0;enemies=[mkEnemy("boss3",430,420)];render()');
    await screenshot('stage3-king');
    await evaluate('startPat(enemies[0],"cleave");enemies[0].pt=820;render()');
    await screenshot('stage3-cleave');
    await evaluate('UX.options.touch=false;document.body.classList.remove("touch");player=newPlayer();startStage(3);scene="play";player.x=220;player.inv=0;enemies=[mkEnemy("boss4",430,420),mkEnemy("grunt",560,460),mkEnemy("rogue",300,380),mkEnemy("archer",600,360),mkEnemy("brute",140,470)];render()');
    await screenshot('stage4');
    await evaluate('player=newPlayer();startStage(4);scene="play";player.x=210;player.inv=0;enemies=[mkEnemy("boss5",430,420)];render()');
    await screenshot('stage5-emperor');
    await evaluate('player=newPlayer();startStage(0);scene="play";showScreen(null);player.inv=0;player.x=160;enemies=[];startSkill("redwave");for(let i=0;i<23;i++)updPlayer();for(let i=0;i<12;i++)updHazards();updateSkillButtons();render()');
    await screenshot('red-wave');
    for (const [stage, kind] of [[2, 'fire'], [3, 'frost'], [4, 'abyss']]) {
      assert.equal(await evaluate(`(async()=>{await ZONE_IMAGES.${kind}.decode();player=newPlayer();startStage(${stage});scene='play';showScreen(null);player.x=camX+200;player.y=480;player.inv=99999;enemies=[mkEnemy(STAGES[${stage}].boss,camX+430,420)];
        hazards=[{type:'rift',kind:'${kind}',x:camX,y:425,width:VW,depth:23,age:0,delay:1200,life:350,arena:true}];const z=hazards[0],at=age=>{z.age=age;render();return zoneEruptionVisible(z)?zoneFrame(z):-1;};
        const sigils=[0,120,240,360,480].map(at);if(sigils.some(f=>f<0||f>3)||new Set(sigils).size<4)return false;
        if(at(1200)!==4||at(1200+349)!==13||at(1200+351)<14||at(1200+350+ZONE_FADE)!==23)return false;
        return at(1200+350+ZONE_FADE+1)===-1&&ZONE_ART.${kind}.frames===24})()`), true, kind + ' zone plays 24 frames: sigils, eruption, embers');
      for (const [age, phase] of [[300, 'warn'], [1380, 'peak'], [1700, 'embers']]) {
        await evaluate(`hazards[0].age=${age};render()`);
        await screenshot('zone-' + kind + '-' + phase);
      }
    }
    assert.equal(await evaluate(`(()=>{player=newPlayer();startStage(3);scene='play';const b=mkEnemy('boss4',camX+430,420);enemies=[b];player.x=camX+200;player.y=420;
      hazards=[{type:'rift',kind:'frost',x:player.x-19,y:(GTOP+GBOT)/2,width:38,depth:85,delay:950,life:320,age:1000,owner:b}];render();
      if(!zoneEruptionVisible(hazards[0])||zoneFrame(hazards[0])<4)return false;
      for(let i=0;i<20;i++)updHazards();return hazards.length===1&&zoneFrame(hazards[0])>=14})()`), true, 'Boss frost rift also uses the zone sprite and keeps its embers');
    await screenshot('zone-boss-frost');
    await evaluate('hazards=[]');
    fs.writeFileSync(path.join(profile, 'reference-units.png'), Buffer.from(await evaluate('(' + referenceSheet.toString() + ')()'), 'base64'));
    await evaluate('toTitle();AUDIO.enable(false)');
    await evaluate('(()=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=()=>{throw new DOMException("blocked", "SecurityError")};try{beginGame();scene="play";render();}finally{Storage.prototype.setItem=original}})()');
    assert.equal(await evaluate('scene'), 'play');
    assert.equal(await evaluate('$("saveStatus").textContent.includes("저장할 수 없습니다")'), true);
    console.log('PASS Storage restrictions leave game playable with clear status');
    assert.equal(await evaluate(`(()=>{
      player=newPlayer();startStage(0);scene='play';enemies=[];hazards=[];parts=[];bolts=[];ghosts=[];startSpecial();
      const original=barelEffect,seen=[];barelEffect=(...args)=>seen.push(args);
      try{for(const t of [300,900,1600]){player.t=t/MS;player.z=50;drawBarelPlayer();}}
      finally{barelEffect=original;}
      if(seen.length!==3||seen.some(a=>a[3]!==player.y+a[5]*.3))return false;
      player.t=30;updSpecial();if(ghosts.length)return false;
      const p0=morgraIntroPose(0),p1=morgraIntroPose(900),p2=morgraIntroPose(INTRO_MS);
      if(p0.alpha!==0||p2.alpha!==1||p2.offset!==0||p1.offset>=p0.offset)return false;
      startStage(1);spawnWave({e:[['boss2',1]],boss:true});
      if(introBoss.z!==0)return false;
      for(let i=0;i<120;i++){updIntro();if(introBoss.z!==0||introLand)return false;}
      return scene==='play';
    })()`),true,'Grounded special effects, no old special ghosts, Morgra rises without falling or landing');
    for(const ms of [300,900,1600]){
      await evaluate(`player=newPlayer();startStage(0);scene='play';showScreen(null);enemies=[];startSpecial();player.t=${ms}/MS;flashT=0;shake=0;render()`);
      await screenshot('special-ground-'+ms);
    }
    for(const ms of [200,700,1200,1800]){
      await evaluate(`player=newPlayer();startStage(1);spawnWave({e:[['boss2',1]],boss:true});introT=${ms};introBoss.z=0;showScreen(null);flashT=0;shake=0;render()`);
      await screenshot('morgra-circle-intro-'+ms);
    }
    assert.deepEqual(errors, [], 'No browser exceptions');
    console.log('PASS No browser exceptions. Screenshots: ' + profile);
  } catch (e) { console.error(e); if (errors.length) console.error(errors); process.exitCode = 1; }
  finally { clearTimeout(timeout); ws?.close(); browser?.kill(); server.close(); }
})();
