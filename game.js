'use strict';
// =====================================================================
//  STREET FIST - 벨트스크롤 액션 (Canvas)
// =====================================================================
const cv = document.getElementById('c');
const ctx = cv.getContext('2d');
const W = 960, H = 540;
const GTOP = 340, GBOT = 500;          // 걸어 다닐 수 있는 바닥 영역(깊이)
const $ = id => document.getElementById(id);
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

// ---------------------------------------------------------------- 입력
const keys = {}, pressed = {};
const down = (...c) => c.some(k => keys[k]);
const hit = (...c) => c.some(k => pressed[k]);
addEventListener('keydown', e => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  if (!e.repeat) { pressed[e.code] = true; onKeyOnce(e.code); }
  keys[e.code] = true;
  if (scene === 'tutorial') lightCaps(e.code, true);
});
addEventListener('keyup', e => { keys[e.code] = false; if (scene === 'tutorial') lightCaps(e.code, false); });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

function lightCaps(code, on) {
  document.querySelectorAll('.cap').forEach(c => {
    if (c.dataset.k.split(' ').includes(code)) c.classList.toggle('on', on);
  });
}

// ---------------------------------------------------------------- 사운드
let actx = null;
function beep(f, d = 0.08, type = 'square', v = 0.04) {
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const o = actx.createOscillator(), g = actx.createGain(), t = actx.currentTime;
    o.type = type; o.frequency.setValueAtTime(f, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(40, f * 0.6), t + d);
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g); g.connect(actx.destination); o.start(t); o.stop(t + d);
  } catch (e) { /* 오디오 불가 환경 무시 */ }
}

// ---------------------------------------------------------------- 데이터
// 적 정의. wind=공격 예고, act=공격 판정 유지, rec=공격 후 경직
const ET = {
  grunt: { name: '불량배', hp: 40, spd: 1.2, dmg: 8, range: 48, wind: 28, act: 10, rec: 30, kb: 3, score: 100,
           h: 62, s: 1, col: '#c0392b', pants: '#34495e', skin: '#f0b27a', hair: '#2c2c2c' },
  rogue: { name: '날쌘돌이', hp: 28, spd: 2.1, dmg: 6, range: 44, wind: 16, act: 8, rec: 20, kb: 2, score: 150,
           h: 58, s: 0.95, col: '#8e44ad', pants: '#2c3e50', skin: '#f5cba7', hair: '#f1c40f' },
  brute: { name: '거한', hp: 100, spd: 0.9, dmg: 16, range: 62, wind: 44, act: 12, rec: 44, kb: 6, score: 300, kd: true,
           h: 70, s: 1.25, wide: 1.5, col: '#d35400', pants: '#5d4037', skin: '#e59866', hair: '#111' },
  boss1: { name: '철권 두목 "맥스"', boss: true, hp: 320, spd: 1.15, dmg: 16, range: 74, wind: 26, act: 12, rec: 34, score: 2000, kd: true,
           h: 70, s: 1.55, wide: 1.4, col: '#1f2d3d', pants: '#111', skin: '#d7a47a', hair: '#7f8c8d', crown: '#c0392b', moves: ['charge'] },
  boss2: { name: '항구의 폭군 "레이"', boss: true, hp: 480, spd: 1.3, dmg: 18, range: 78, wind: 24, act: 12, rec: 30, score: 3500, kd: true,
           h: 70, s: 1.6, wide: 1.4, col: '#0e6655', pants: '#17202a', skin: '#c68e63', hair: '#f39c12', crown: '#f1c40f', moves: ['charge', 'slam'] },
  boss3: { name: '마왕 "드라칸"', boss: true, hp: 700, spd: 1.4, dmg: 20, range: 84, wind: 22, act: 12, rec: 26, score: 6000, kd: true,
           h: 70, s: 1.75, wide: 1.5, col: '#4a148c', pants: '#1a0a2e', skin: '#a1887f', hair: '#e74c3c', crown: '#ff1744', moves: ['charge', 'slam'] },
};

const STAGES = [
  { name: 'STAGE 1', title: '네온 거리', theme: 'city', len: 3200, boss: 'boss1',
    barrels: [520, 1100, 1650, 2100],
    waves: [
      { at: 400,  e: [['grunt', 1], ['grunt', 1]] },
      { at: 900,  e: [['grunt', 1], ['grunt', -1], ['rogue', 1]] },
      { at: 1400, e: [['rogue', 1], ['rogue', -1], ['grunt', 1]] },
      { at: 1900, e: [['grunt', 1], ['grunt', -1], ['brute', 1]] },
      { at: 2240, e: [['boss1', 1], ['grunt', -1]], boss: true },
    ] },
  { name: 'STAGE 2', title: '항구 창고', theme: 'harbor', len: 3600, boss: 'boss2',
    barrels: [450, 950, 1500, 2000, 2400],
    waves: [
      { at: 400,  e: [['grunt', 1], ['rogue', 1], ['rogue', -1]] },
      { at: 800,  e: [['brute', 1], ['grunt', -1]] },
      { at: 1300, e: [['rogue', 1], ['rogue', 1], ['rogue', -1], ['grunt', -1]] },
      { at: 1800, e: [['brute', 1], ['brute', -1]] },
      { at: 2250, e: [['grunt', 1], ['grunt', 1], ['rogue', -1], ['brute', -1]] },
      { at: 2640, e: [['boss2', 1], ['rogue', -1], ['rogue', -1]], boss: true },
    ] },
  { name: 'STAGE 3', title: '마왕성', theme: 'castle', len: 4000, boss: 'boss3',
    barrels: [500, 900, 1400, 1900, 2400, 2800],
    waves: [
      { at: 400,  e: [['rogue', 1], ['rogue', 1], ['grunt', -1], ['grunt', -1]] },
      { at: 800,  e: [['brute', 1], ['rogue', -1], ['rogue', -1]] },
      { at: 1200, e: [['brute', 1], ['brute', -1], ['grunt', 1]] },
      { at: 1700, e: [['rogue', 1], ['rogue', 1], ['rogue', -1], ['rogue', -1], ['grunt', 1]] },
      { at: 2200, e: [['brute', 1], ['brute', -1], ['rogue', 1], ['rogue', -1]] },
      { at: 2650, e: [['grunt', 1], ['grunt', 1], ['grunt', -1], ['brute', -1], ['rogue', 1]] },
      { at: 3040, e: [['boss3', 1]], boss: true },
    ] },
];

// 플레이어 공격 데이터 (on~off 틱 동안 판정)
const ATK = {
  c1:  { dur: 20, on: 4, off: 10, reach: 46, dmg: 10, kd: false },
  c2:  { dur: 20, on: 4, off: 10, reach: 46, dmg: 11, kd: false },
  c3:  { dur: 30, on: 7, off: 14, reach: 60, dmg: 16, kd: true },
  air: { dur: 0,  on: 0, off: 999, reach: 52, dmg: 14, kd: true },
};

// ---------------------------------------------------------------- 상태
let scene = 'title';
let stageIdx = 0, stage = null;
let camX = 0, camLock = false, lockAt = 0, waveIdx = 0;
let player = null, enemies = [], items = [], barrels = [], parts = [], texts = [], rings = [];
let tick = 0, hitStop = 0, shake = 0, bannerT = 0, clearT = 0, goT = 0, stageStartScore = 0, nextId = 1;

function newPlayer(score = 0) {
  return { x: 80, y: 420, z: 0, vx: 0, vz: 0, face: 1, w: 26, hw: 14, hp: 100, max: 100, lives: 3,
    st: 'free', t: 0, atk: null, combo: 0, comboT: 0, queue: false, hitSet: new Set(),
    inv: 0, flash: 0, buff: 0, score, walk: false };
}

// ---------------------------------------------------------------- 화면(HTML 오버레이) 전환
const screens = ['title', 'tutorial', 'pause', 'clear', 'over', 'ending'];
function showScreen(id) { screens.forEach(s => $(s).classList.toggle('show', s === id)); }

function toTutorial() { scene = 'tutorial'; showScreen('tutorial'); beep(600, .1); }
function beginGame() {
  player = newPlayer(0);
  startStage(0);
}
function toTitle() { scene = 'title'; showScreen('title'); }

$('btnStart').onclick = toTutorial;
$('btnGo').onclick = beginGame;
$('btnNext').onclick = nextStage;
$('btnRetry').onclick = retryStage;
$('btnToTitle').onclick = toTitle;
$('btnEndTitle').onclick = toTitle;

function onKeyOnce(code) {
  if (code === 'Enter') {
    if (scene === 'title') toTutorial();
    else if (scene === 'tutorial') beginGame();
    else if (scene === 'clear') nextStage();
    else if (scene === 'over') retryStage();
    else if (scene === 'ending') toTitle();
  }
  if (code === 'KeyP' || code === 'Escape') {
    if (scene === 'play') { scene = 'pause'; showScreen('pause'); }
    else if (scene === 'pause') { scene = 'play'; showScreen(null); }
  }
}

// ---------------------------------------------------------------- 스테이지 진행
function startStage(i) {
  stageIdx = i; stage = STAGES[i];
  camX = 0; camLock = false; waveIdx = 0; clearT = 0; goT = 0;
  enemies = []; items = []; parts = []; texts = []; rings = [];
  barrels = stage.barrels.map(bx => ({ kind: 'barrel', x: bx, y: rand(GTOP + 30, GBOT - 10), z: 0, hw: 16,
    hp: 2, flash: 0, dead: false, t: 0 }));
  const p = player;
  p.x = 80; p.y = 420; p.z = 0; p.vx = 0; p.vz = 0; p.face = 1; p.st = 'free'; p.t = 0; p.inv = 90;
  p.hp = Math.min(p.max, p.hp + (i > 0 ? 40 : 0));
  stageStartScore = p.score;
  scene = 'intro'; bannerT = 160;
  showScreen(null);
}
function nextStage() {
  if (stageIdx + 1 < STAGES.length) startStage(stageIdx + 1);
}
function retryStage() {
  player = newPlayer(stageStartScore);
  startStage(stageIdx);
}

function spawnWave(w) {
  for (const [type, side] of w.e) {
    const x = side > 0 ? camX + W + rand(30, 110) : camX - rand(30, 110);
    enemies.push(mkEnemy(type, x, rand(GTOP + 20, GBOT)));
  }
}
function mkEnemy(type, x, y) {
  const d = ET[type];
  return { kind: 'enemy', id: nextId++, type, d, x, y, z: 0, vx: 0, vz: 0, face: -1, hw: 14 * d.s, hp: d.hp, max: d.hp,
    st: 'chase', t: 0, wait: rand(0, 40), atkCd: rand(20, 60), pat: null, hitSet: null, inv: 0, flash: 0, shown: 0,
    boss: !!d.boss, nextKd: d.hp * 0.75, walk: false, recT: d.rec, remove: false };
}

// ---------------------------------------------------------------- 이펙트 / 아이템
function sparks(x, y, z, n = 7, col = '#fff6a8') {
  for (let i = 0; i < n; i++)
    parts.push({ x, y, z, vx: rand(-3, 3), vz: rand(1, 5), life: rand(14, 26), col });
}
function floatText(x, y, txt, col = '#fff') { texts.push({ x, y, txt, col, life: 50 }); }

function dropItem(type, x, y) {
  items.push({ kind: 'item', type, x, y, z: 0, vz: 5, vx: rand(-1, 1), life: 1500, t: 0 });
}
function dropFrom(e) {
  const r = Math.random();
  if (e.boss) { dropItem('coin', e.x - 20, e.y); dropItem('big', e.x + 20, e.y); return; }
  if (r < 0.07) dropItem('big', e.x, e.y);
  else if (r < 0.28) dropItem('potion', e.x, e.y);
  else if (r < 0.34) dropItem('power', e.x, e.y);
  else if (r < 0.60) dropItem('coin', e.x, e.y);
}
function dropFromBarrel(b) {
  const r = Math.random();
  dropItem(r < 0.45 ? 'potion' : r < 0.60 ? 'big' : r < 0.75 ? 'power' : 'coin', b.x, b.y);
}

// ---------------------------------------------------------------- 판정 도우미
// a의 앞쪽 reach 범위 안에 t가 있는가 (깊이 ytol, 높이 zt)
function inReach(a, t, reach, ytol, zt = 45) {
  const dx = (t.x - a.x) * a.face;
  return dx > -8 && dx < reach + (t.hw || 14) && Math.abs(t.y - a.y) < ytol && Math.abs(t.z - a.z) < zt;
}

// ---------------------------------------------------------------- 플레이어
function startAtk(n) {
  const p = player;
  p.st = 'atk'; p.t = 0; p.queue = false; p.hitSet = new Set();
  if (n === 'air') { p.atk = 'air'; beep(420, .1, 'square'); return; }
  p.combo = n; p.atk = ['c1', 'c2', 'c3'][n];
  beep(260 + n * 70, .08, 'square');
}

function hurtPlayer(dmg, dir, kd) {
  const p = player;
  if (p.inv > 0 || p.st === 'down' || p.st === 'dead') return false;
  p.hp -= dmg; p.flash = 8; p.combo = 0; p.queue = false;
  hitStop = Math.max(hitStop, 4); shake = Math.max(shake, 6);
  floatText(p.x, p.y - p.z - 80, dmg, '#ff5252');
  sparks(p.x, p.y, p.z + 40, 8, '#ff8a80');
  beep(110, .15, 'sawtooth', 0.06);
  if (p.hp <= 0) {
    p.hp = 0; p.lives--; p.st = 'dead'; p.t = 0; p.vz = 6; p.vx = dir * 4; return true;
  }
  if (kd || p.z > 0) { p.st = 'down'; p.t = 0; p.vz = 5; p.vx = dir * 3.5; }
  else { p.st = 'hurt'; p.t = 0; p.vx = dir * 2; p.inv = 40; }
  return true;
}

function playerStrike(A) {
  const p = player, mul = p.buff > 0 ? 1.5 : 1;
  for (const e of enemies) {
    if (e.st === 'dead' || e.st === 'down' || e.inv > 0 || p.hitSet.has(e)) continue;
    if (inReach(p, e, A.reach, 24, 55)) { p.hitSet.add(e); damageEnemy(e, Math.round(A.dmg * mul), A.kd); }
  }
  for (const b of barrels) {
    if (b.dead || p.hitSet.has(b)) continue;
    if (inReach(p, b, A.reach, 24, 55)) { p.hitSet.add(b); damageBarrel(b); }
  }
}

function damageBarrel(b) {
  b.hp--; b.flash = 6; hitStop = Math.max(hitStop, 2); beep(180, .06, 'triangle');
  sparks(b.x, b.y, 30, 5, '#d7a86e');
  if (b.hp <= 0) { b.dead = true; sparks(b.x, b.y, 25, 14, '#a1744a'); dropFromBarrel(b); beep(120, .15, 'sawtooth'); }
}

function updPlayer() {
  const p = player;
  if (p.inv > 0) p.inv--;
  if (p.flash > 0) p.flash--;
  if (p.buff > 0) p.buff--;
  p.walk = false;

  // 중력
  if (p.z > 0 || p.vz !== 0) {
    p.z += p.vz; p.vz -= 0.55;
    if (p.z <= 0) { p.z = 0; p.vz = 0; }
  }

  switch (p.st) {
    case 'free': {
      let ax = 0, ay = 0;
      if (down('ArrowLeft', 'KeyA')) ax -= 1;
      if (down('ArrowRight', 'KeyD')) ax += 1;
      if (down('ArrowUp', 'KeyW')) ay -= 1;
      if (down('ArrowDown', 'KeyS')) ay += 1;
      const sp = p.z > 0 ? 2.6 : 3.1;
      p.x += ax * sp; p.y += ay * sp * 0.75;
      if (ax) p.face = ax;
      p.walk = !!(ax || ay);
      if (p.comboT > 0) p.comboT--;
      if (hit('Space') && p.z === 0) { p.vz = 9.6; beep(500, .1, 'triangle'); }
      if (hit('KeyJ', 'KeyZ')) {
        if (p.z > 0) startAtk('air');
        else startAtk(p.comboT > 0 && p.combo < 2 ? p.combo + 1 : 0);
      }
      break;
    }
    case 'atk': {
      const A = ATK[p.atk];
      if (p.atk === 'air') {
        p.t++; p.x += p.face * 2.6;
        playerStrike(A);
        if (p.z <= 0 && p.vz === 0) { p.st = 'free'; p.comboT = 0; p.combo = 0; }
      } else {
        p.t++;
        if (p.t <= A.on) p.x += p.face * 1.4;
        if (p.t >= A.on && p.t <= A.off) playerStrike(A);
        if (hit('KeyJ', 'KeyZ') && p.t >= A.on) p.queue = true;
        if (p.t >= A.dur) {
          if (p.queue && p.combo < 2) startAtk(p.combo + 1);
          else { p.st = 'free'; p.comboT = 14; }
        }
      }
      break;
    }
    case 'hurt':
      p.t++; p.x += p.vx; p.vx *= 0.85;
      if (p.t > 16) { p.st = 'free'; }
      break;
    case 'down':
      p.t++; p.x += p.vx; p.vx *= 0.96;
      if (p.t > 55 && p.z === 0) { p.st = 'free'; p.inv = 100; }
      break;
    case 'dead':
      p.t++; p.x += p.vx; p.vx *= 0.96;
      if (p.t > 100) {
        if (p.lives > 0) {                      // 리스폰
          p.st = 'free'; p.hp = p.max; p.inv = 150; p.z = 0; p.vz = 0;
          p.x = camX + 100; p.y = 420;
        } else {
          scene = 'over';
          $('overInfo').textContent = `${stage.name} ${stage.title} — 점수 ${p.score}`;
          showScreen('over');
        }
      }
      break;
  }
  // 이동 제한
  p.x = clamp(p.x, camX + 20, Math.min(camX + W - 20, stage.len - 20));
  p.y = clamp(p.y, GTOP + 10, GBOT);

  // 아이템 획득
  for (const it of items) {
    if (it.gone || p.st === 'dead') continue;
    if (Math.abs(it.x - p.x) < 28 && Math.abs(it.y - p.y) < 22 && p.z < 40 && it.z < 30) {
      it.gone = true; beep(880, .12, 'triangle', 0.05);
      if (it.type === 'potion') { heal(30); }
      else if (it.type === 'big') { heal(60); }
      else if (it.type === 'coin') { p.score += 500; floatText(p.x, p.y - 90, '+500', '#ffd23f'); }
      else if (it.type === 'power') { p.buff = 900; floatText(p.x, p.y - 90, 'POWER UP!', '#ffe14d'); }
    }
  }
}
function heal(n) {
  const p = player, before = p.hp;
  p.hp = Math.min(p.max, p.hp + n);
  floatText(p.x, p.y - 90, '+' + (p.hp - before), '#6dff8a');
  sparks(p.x, p.y, 40, 10, '#6dff8a');
}

// ---------------------------------------------------------------- 적
function damageEnemy(e, dmg, kd) {
  const p = player;
  e.hp -= dmg; e.flash = 6; e.shown = 240;
  hitStop = Math.max(hitStop, kd ? 6 : 3);
  beep(kd ? 140 : 210, .07, 'sawtooth');
  sparks(e.x, e.y, e.z + e.d.h * e.d.s * 0.6);
  floatText(e.x, e.y - e.z - e.d.h * e.d.s - 14, dmg);
  const dir = p.x <= e.x ? 1 : -1;

  if (e.hp <= 0) {
    e.hp = 0; e.st = 'dead'; e.t = 0; e.vz = 6; e.vx = dir * 5; e.pat = null;
    p.score += e.d.score; dropFrom(e);
    if (e.boss) { shake = 20; hitStop = 16; }
    return;
  }
  if (e.boss) {                                   // 보스: 슈퍼아머, 체력 25% 단위로 다운
    if (e.hp <= e.nextKd) {
      e.nextKd -= e.max * 0.25;
      e.st = 'down'; e.t = 0; e.vz = 5; e.vx = dir * 3; e.pat = null;
      if (e.type === 'boss3') { spawnAdds(); }
    } else if (e.st === 'chase' || e.st === 'rec') { e.st = 'hurt'; e.t = 0; e.vx = dir; }
    return;
  }
  if (e.type === 'brute' && e.st === 'wind' && !kd) return;   // 거한은 예고 동작 중 슈퍼아머
  if (kd) { e.st = 'down'; e.t = 0; e.vz = 5; e.vx = dir * 4; }
  else { e.st = 'hurt'; e.t = 0; e.vx = dir * e.d.kb * 0.6; }
  e.pat = null;
}
function spawnAdds() {
  for (const side of [1, -1]) {
    const x = side > 0 ? camX + W + 40 : camX - 40;
    enemies.push(mkEnemy('rogue', x, rand(GTOP + 20, GBOT)));
  }
  floatText(camX + W / 2, 200, '부하 소환!', '#ff80ab');
}

function startAttack(e, pat) {
  e.pat = pat; e.st = 'wind'; e.t = 0; e.hitSet = new Set();
  e.face = player.x >= e.x ? 1 : -1;
  beep(pat === 'swing' ? 90 : 70, .12, 'triangle', 0.03);
}
function enraged(e) { return e.boss && e.type === 'boss3' && e.hp < e.max * 0.5; }

function updEnemy(e) {
  const p = player, d = e.d;
  e.t++;
  if (e.flash > 0) e.flash--;
  if (e.inv > 0) e.inv--;
  if (e.shown > 0) e.shown--;
  if (e.atkCd > 0) e.atkCd--;
  e.walk = false;
  const dx = p.x - e.x, dy = p.y - e.y;

  switch (e.st) {
    case 'down': case 'dead':
      e.x += e.vx; e.z += e.vz; e.vz -= 0.5; e.vx *= 0.97;
      if (e.z <= 0) { e.z = 0; e.vz = 0; e.vx *= 0.7; }
      if (e.st === 'dead') { if (e.t > (e.boss ? 120 : 65)) e.remove = true; }
      else if (e.t > 60 && e.z === 0) { e.st = 'rec'; e.t = 0; e.inv = 45; e.recT = 20; }
      break;

    case 'hurt':
      e.x += e.vx; e.vx *= 0.85;
      if (e.t > (e.boss ? 10 : 18)) { e.st = 'chase'; e.t = 0; e.wait = rand(0, 12); }
      break;

    case 'rec':
      if (e.t > e.recT) { e.st = 'chase'; e.t = 0; e.atkCd = rand(20, 55); }
      break;

    case 'wind': {
      if (e.pat === 'swing') {
        if (e.t >= d.wind) { e.st = 'act'; e.t = 0; e.hitSet = new Set(); }
      } else if (e.pat === 'charge') {
        e.face = dx >= 0 ? 1 : -1;
        e.y += clamp(dy, -1.6, 1.6);                // 돌진 전 깊이 맞추기
        if (e.t >= 42) { e.st = 'act'; e.t = 0; e.hitSet = new Set(); }
      } else if (e.pat === 'slam') {
        if (e.t >= 26) {
          e.st = 'act'; e.t = 0; e.vz = 12;
          e.vx = e.face * clamp(Math.abs(dx) / 40, 1, 7);
          e.vy = clamp(dy / 40, -2, 2);
        }
      }
      break;
    }

    case 'act': {
      if (e.pat === 'swing') {
        if (e.t <= d.act && !e.hitSet.has(p) && inReach(e, p, d.range + 8, 20, 55)) {
          if (hurtPlayer(d.dmg, e.face, !!d.kd)) e.hitSet.add(p);
        }
        if (e.t > d.act + 2) { e.st = 'rec'; e.t = 0; e.recT = enraged(e) ? d.rec * 0.6 : d.rec; e.atkCd = rand(15, 45); }
      } else if (e.pat === 'charge') {
        e.x += e.face * 8;
        if (!e.hitSet.has(p) && inReach(e, p, 40, 26, 55)) {
          if (hurtPlayer(d.dmg + 6, e.face, true)) e.hitSet.add(p);
        }
        if (e.t > 34 || e.x < camX - 20 || e.x > camX + W + 20) {
          e.st = 'rec'; e.t = 0; e.recT = 55; e.atkCd = rand(40, 80);
        }
      } else if (e.pat === 'slam') {
        e.x += e.vx; e.y += e.vy; e.z += e.vz; e.vz -= 0.6;
        if (e.z <= 0 && e.t > 3) {
          e.z = 0; e.vz = 0; shake = 16; hitStop = 4; beep(70, .3, 'sawtooth', 0.08);
          rings.push({ x: e.x, y: e.y, r: 10, life: 24 });
          if (Math.abs(p.x - e.x) < 120 && Math.abs(p.y - e.y) < 38 && p.z < 35)
            hurtPlayer(d.dmg + 8, Math.sign(p.x - e.x) || 1, true);
          e.st = 'rec'; e.t = 0; e.recT = 55; e.atkCd = rand(40, 80);
        }
      }
      break;
    }

    case 'chase': {
      if (p.st === 'dead') break;
      if (e.wait > 0) { e.wait--; break; }
      e.face = dx >= 0 ? 1 : -1;
      const attackers = enemies.reduce((n, o) => n + ((o !== e && (o.st === 'wind' || o.st === 'act')) ? 1 : 0), 0);
      const can = attackers < (e.boss ? 3 : 2) && p.st !== 'down' && e.atkCd <= 0;
      const side = dx >= 0 ? 1 : -1;
      // 추적 목표: 공격 가능하면 플레이어 코앞, 아니면 거리를 두고 맴돈다
      const tx = can ? p.x - side * (d.range - 14) : p.x - side * (150 + (e.id % 3) * 35);
      const ty = can ? p.y : p.y + ((e.id % 2) ? 34 : -34);
      const mx = tx - e.x, my = ty - e.y, dist = Math.hypot(mx, my);
      const spd = d.spd * (enraged(e) ? 1.4 : 1);
      if (dist > 4) { e.x += mx / dist * spd; e.y += my / dist * spd * 0.8; e.walk = true; }

      if (can) {
        if (e.boss) {
          const adx = Math.abs(dx), r = Math.random();
          if (adx > 220 && d.moves.includes('charge') && r < 0.025) { startAttack(e, 'charge'); break; }
          if (adx > 110 && adx < 340 && d.moves.includes('slam') && r > 0.975) { startAttack(e, 'slam'); break; }
        }
        if (Math.abs(dx) < d.range && Math.abs(dy) < 14) startAttack(e, 'swing');
      }
      break;
    }
  }

  // 적끼리 겹치지 않게 살짝 밀어내기
  if (e.st === 'chase' || e.st === 'rec') {
    for (const o of enemies) {
      if (o === e || o.st === 'dead' || o.st === 'down') continue;
      const ox = e.x - o.x, oy = e.y - o.y;
      if (Math.abs(ox) < 30 && Math.abs(oy) < 12) { e.x += Math.sign(ox || 1) * 0.6; e.y += Math.sign(oy || 1) * 0.4; }
    }
  }
  if (e.st !== 'act' || e.pat !== 'charge') e.x = clamp(e.x, camX - 70, camX + W + 70);
  e.y = clamp(e.y, GTOP + 10, GBOT);
}

// ---------------------------------------------------------------- 메인 업데이트
function update() {
  tick++;
  if (scene === 'intro') {
    if (--bannerT <= 0) scene = 'play';
    return;
  }
  if (scene !== 'play') return;
  if (hitStop > 0) { hitStop--; return; }
  if (shake > 0) shake *= 0.85;

  updPlayer();

  // 카메라와 웨이브(화면 고정 전투)
  const waves = stage.waves;
  const limit = camLock ? lockAt : (waveIdx < waves.length ? waves[waveIdx].at : stage.len - W);
  const target = player.x - W * 0.4;
  if (target > camX) camX = Math.min(target, limit);
  if (!camLock && waveIdx < waves.length && camX >= waves[waveIdx].at - 0.5) {
    camLock = true; lockAt = waves[waveIdx].at;
    spawnWave(waves[waveIdx]); waveIdx++;
  }
  if (camLock && enemies.every(e => e.st === 'dead')) {
    camLock = false;
    if (waveIdx < waves.length) goT = 300;
  }

  enemies.forEach(updEnemy);
  enemies = enemies.filter(e => !e.remove);

  // 스테이지 클리어 판정 (보스 사망)
  if (clearT === 0 && waveIdx >= waves.length && !camLock && enemies.length === 0) clearT = 1;
  if (clearT > 0 && ++clearT > 200) finishStage();

  // 통 / 아이템
  for (const b of barrels) { if (b.flash > 0) b.flash--; }
  barrels = barrels.filter(b => !b.dead);
  for (const it of items) {
    it.t++; it.life--;
    if (it.z > 0 || it.vz !== 0) { it.x += it.vx; it.z += it.vz; it.vz -= 0.4; if (it.z <= 0) { it.z = 0; it.vz = 0; it.vx = 0; } }
    if (it.life <= 0) it.gone = true;
  }
  items = items.filter(i => !i.gone);

  // 파티클 / 텍스트
  for (const q of parts) { q.x += q.vx; q.z += q.vz; q.vz -= 0.4; q.vx *= 0.95; q.life--; if (q.z < 0) { q.z = 0; q.vz *= -0.4; } }
  parts = parts.filter(q => q.life > 0);
  for (const t of texts) { t.y -= 0.7; t.life--; }
  texts = texts.filter(t => t.life > 0);
  for (const r of rings) { r.r += 6; r.life--; }
  rings = rings.filter(r => r.life > 0);
  if (goT > 0) goT--;
}

function finishStage() {
  const p = player;
  const bonus = p.hp * 10;
  p.score += bonus;
  if (stageIdx + 1 < STAGES.length) {
    scene = 'clear';
    $('clearTitle').textContent = `${stage.name} CLEAR!`;
    $('clearInfo').innerHTML = `남은 체력 보너스 +${bonus}<br>현재 점수 <b style="color:#ffd23f">${p.score}</b>`;
    showScreen('clear');
  } else {
    scene = 'ending';
    $('endInfo').textContent = `최종 점수 ${p.score}`;
    showScreen('ending');
  }
}

// =====================================================================
//  렌더링
// =====================================================================
function rect(x, y, w, h) { ctx.fillRect(x, y, w, h); }
function circle(x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }

function layer(par, w, fn) {
  const off = camX * par, first = Math.floor(off / w);
  for (let n = first; n <= first + Math.ceil(W / w) + 1; n++) fn(n * w - off, n);
}

function drawBG(theme) {
  const sky = ctx.createLinearGradient(0, 0, 0, GTOP);
  let ground = ['#3c3c52', '#26263a'], line = 'rgba(255,255,255,.07)';
  if (theme === 'city') { sky.addColorStop(0, '#140a30'); sky.addColorStop(.6, '#5b2a86'); sky.addColorStop(1, '#ff6a88'); }
  else if (theme === 'harbor') { sky.addColorStop(0, '#07263d'); sky.addColorStop(1, '#4a90b8'); ground = ['#5a5545', '#3a372c']; }
  else { sky.addColorStop(0, '#12040a'); sky.addColorStop(1, '#5a1230'); ground = ['#3a2a3a', '#20141f']; }
  ctx.fillStyle = sky; rect(0, 0, W, GTOP);

  if (theme === 'city') {
    ctx.fillStyle = '#2a1b4d';
    layer(0.2, 70, (x, n) => { const h = 60 + hash(n) * 120; rect(x, GTOP - h, 66, h); });
    layer(0.5, 130, (x, n) => {
      const h = 90 + hash(n + 9) * 100;
      ctx.fillStyle = '#3b2766'; rect(x, GTOP - h, 120, h);
      ctx.fillStyle = 'rgba(255,220,120,.55)';
      for (let i = 0; i < 4; i++) for (let j = 0; j < Math.floor(h / 28); j++)
        if (hash(n * 13 + i * 7 + j) > 0.45) rect(x + 12 + i * 27, GTOP - h + 10 + j * 28, 14, 14);
      if (hash(n + 3) > 0.55) {
        const c = ['#ff2e9a', '#2effe6', '#ffe14d'][Math.abs(n) % 3];
        ctx.shadowColor = c; ctx.shadowBlur = 14; ctx.fillStyle = c; rect(x + 18, GTOP - h - 16, 70, 12); ctx.shadowBlur = 0;
      }
    });
  } else if (theme === 'harbor') {
    ctx.fillStyle = '#2f6f93'; rect(0, GTOP - 70, W, 70);                  // 바다
    ctx.fillStyle = '#1d3b52';
    layer(0.15, 300, (x, n) => { rect(x + 100, GTOP - 190, 14, 190); rect(x + 40, GTOP - 190, 220, 10); rect(x + 230, GTOP - 190, 6, 60); });
    const pal = ['#c0392b', '#2471a3', '#d68910', '#1e8449', '#7d3c98'];
    layer(0.5, 118, (x, n) => {
      const rows = 1 + Math.floor(hash(n + 5) * 2);
      for (let r = 0; r < rows; r++) {
        ctx.fillStyle = pal[Math.floor(hash(n * 3 + r) * pal.length)]; rect(x, GTOP - 50 * (r + 1), 112, 48);
        ctx.fillStyle = 'rgba(0,0,0,.22)'; for (let k = 8; k < 112; k += 14) rect(x + k, GTOP - 50 * (r + 1), 3, 48);
      }
    });
  } else {
    ctx.fillStyle = '#2a0f1a';
    layer(0.2, 170, (x, n) => {
      const h = 120 + hash(n) * 110; rect(x + 30, GTOP - h, 110, h);
      for (let k = 0; k < 4; k++) rect(x + 30 + k * 30, GTOP - h - 14, 18, 14);
      ctx.fillStyle = '#ffb74d'; rect(x + 78, GTOP - h + 30, 14, 26); ctx.fillStyle = '#2a0f1a';
    });
    layer(0.5, 210, (x, n) => {
      ctx.fillStyle = '#3d1d2b'; rect(x + 80, GTOP - 230, 46, 230); rect(x + 70, GTOP - 240, 66, 14); rect(x + 70, GTOP - 14, 66, 14);
      const fl = 8 + Math.sin(tick * 0.3 + n) * 2;
      ctx.shadowColor = '#ff9100'; ctx.shadowBlur = 16; ctx.fillStyle = '#ff9100'; circle(x + 103, GTOP - 150, fl); ctx.shadowBlur = 0;
      ctx.fillStyle = '#ffeb3b'; circle(x + 103, GTOP - 148, fl * 0.5);
    });
  }

  // 바닥
  const g = ctx.createLinearGradient(0, GTOP, 0, H);
  g.addColorStop(0, ground[0]); g.addColorStop(1, ground[1]);
  ctx.fillStyle = g; rect(0, GTOP, W, H - GTOP);
  ctx.fillStyle = 'rgba(0,0,0,.35)'; rect(0, GTOP, W, 4);
  ctx.strokeStyle = line; ctx.lineWidth = 2;
  for (let y = GTOP + 40; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  for (let x = -(camX % 90); x < W; x += 90) { ctx.beginPath(); ctx.moveTo(x, GTOP); ctx.lineTo(x - 30, H); ctx.stroke(); }
}

function drawChar(e, o) {
  const s = o.s || 1, h = o.h * s;
  const sx = Math.round(e.x - camX), sy = e.y;
  ctx.fillStyle = 'rgba(0,0,0,.35)';
  ctx.beginPath(); ctx.ellipse(sx, sy, 18 * s * (1 - Math.min(e.z, 150) / 300), 6 * s, 0, 0, Math.PI * 2); ctx.fill();
  if (o.blink && Math.floor(tick / 4) % 2) return;

  ctx.save();
  ctx.translate(sx, sy - e.z); ctx.scale(e.face, 1);
  if (o.lying) { ctx.translate(h * 0.5, -10 * s); ctx.rotate(-Math.PI / 2); }
  if (o.aura) {
    ctx.globalAlpha = 0.35 + 0.15 * Math.sin(tick * 0.3); ctx.fillStyle = '#ffd23f';
    ctx.beginPath(); ctx.ellipse(0, -h * 0.5, 26 * s, h * 0.62, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
  }
  const C = c => o.flash ? '#fff' : c;
  const legH = h * 0.38, torsoH = h * 0.36, bw = 22 * s * (o.wide || 1);
  const sw = o.walk ? Math.sin(tick * 0.3) * 6 * s : 0;
  const shY = -legH - torsoH + 6 * s;

  ctx.fillStyle = C(o.skin); rect(-bw / 2 - 3 * s, shY, 6 * s, torsoH * 0.8);                // 뒤쪽 팔
  ctx.fillStyle = C(o.pants);
  rect(-bw / 2 + 1 * s + sw, -legH, 9 * s, legH);
  if (o.kick) rect(2 * s, -legH, 30 * s, 9 * s); else rect(bw / 2 - 10 * s - sw, -legH, 9 * s, legH);
  ctx.fillStyle = C(o.col); rect(-bw / 2, -legH - torsoH, bw, torsoH);                          // 몸통
  ctx.fillStyle = C(o.skin); circle(2 * s, -legH - torsoH - 9 * s, 10 * s);                       // 머리
  ctx.fillStyle = C(o.hair);
  ctx.beginPath(); ctx.arc(2 * s, -legH - torsoH - 9 * s, 10.5 * s, Math.PI * 1.05, Math.PI * 1.95); ctx.fill();
  if (o.band) { ctx.fillStyle = C(o.band); rect(-8 * s, -legH - torsoH - 12 * s, 21 * s, 4 * s); rect(-14 * s, -legH - torsoH - 12 * s, 7 * s, 3 * s); }
  if (o.crown) {
    ctx.fillStyle = C(o.crown);
    ctx.beginPath(); ctx.moveTo(-6 * s, -legH - torsoH - 17 * s); ctx.lineTo(-4 * s, -legH - torsoH - 28 * s); ctx.lineTo(0, -legH - torsoH - 19 * s);
    ctx.lineTo(4 * s, -legH - torsoH - 30 * s); ctx.lineTo(8 * s, -legH - torsoH - 19 * s); ctx.lineTo(11 * s, -legH - torsoH - 27 * s);
    ctx.lineTo(11 * s, -legH - torsoH - 17 * s); ctx.fill();
  }
  ctx.fillStyle = '#111'; rect(6 * s, -legH - torsoH - 11 * s, 3 * s, 3 * s);                    // 눈

  // 앞쪽 팔 (공격 시 뻗음)
  ctx.fillStyle = C(o.skin);
  const a = o.atk;
  if (a !== undefined && a !== null && !o.kick) {
    const len = 8 * s + 28 * s * Math.max(a, -0.3);
    rect(bw / 2 - 4 * s, shY, len, 7 * s);
    ctx.fillStyle = C(o.col === '#2e86de' ? '#fff' : o.skin); circle(bw / 2 - 4 * s + len, shY + 3.5 * s, 5 * s);
  } else rect(bw / 2 - 3 * s, shY, 6 * s, torsoH * 0.8);

  if (o.fx) {                                                                                       // 타격 이펙트
    ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(bw / 2 + 6 * s, -h * 0.5, o.fx * 0.55, -1.0, 1.0); ctx.stroke();
  }
  ctx.restore();
}

function playerLook() {
  const p = player, o = { h: 64, s: 1, col: '#2e86de', pants: '#2c3e50', skin: '#f5cba7', hair: '#4a2c17', band: '#e74c3c' };
  o.walk = p.walk; o.flash = p.flash > 0; o.aura = p.buff > 0;
  o.blink = p.inv > 0 && p.st === 'free';
  o.lying = (p.st === 'down' && p.z === 0 && p.t > 8) || (p.st === 'dead' && p.z === 0);
  if (p.st === 'atk') {
    const A = ATK[p.atk];
    if (p.atk === 'air') { o.kick = true; o.fx = 40; }
    else {
      const a = p.t < A.on ? p.t / A.on : p.t <= A.off ? 1 : Math.max(0, 1 - (p.t - A.off) / 10);
      if (p.atk === 'c3') { o.kick = true; } else o.atk = a;
      if (p.t >= A.on && p.t <= A.off) o.fx = A.reach;
    }
  }
  return o;
}
function enemyLook(e) {
  const d = e.d, o = { h: d.h, s: d.s, wide: d.wide, col: d.col, pants: d.pants, skin: d.skin, hair: d.hair, crown: d.crown };
  o.walk = e.walk; o.flash = e.flash > 0;
  o.lying = (e.st === 'down' || e.st === 'dead') && e.z === 0;
  if (e.st === 'dead' && e.t > (e.boss ? 90 : 35)) o.blink = true;
  if (e.st === 'wind') { o.atk = -0.4; if (e.t > 6 && Math.floor(e.t / 4) % 2) o.flash = true; }
  if (e.st === 'act') { if (e.pat === 'swing') o.atk = 1; else o.kick = true; }
  return o;
}

function drawBarrel(b) {
  const sx = b.x - camX, y = b.y;
  ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(sx, y, 20, 6, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = b.flash ? '#fff' : '#8d5a2b'; rect(sx - 16, y - 44, 32, 44);
  ctx.fillStyle = b.flash ? '#fff' : '#5d3a1a'; rect(sx - 17, y - 36, 34, 5); rect(sx - 17, y - 14, 34, 5);
  ctx.fillStyle = b.flash ? '#fff' : '#a8723a'; rect(sx - 14, y - 44, 6, 44);
}

function drawItem(it) {
  const sx = it.x - camX, bob = it.z === 0 ? Math.sin(it.t * 0.1) * 3 : 0, y = it.y - it.z - 14 + bob;
  if (it.life < 200 && Math.floor(it.life / 6) % 2) return;
  ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(sx, it.y, 12, 4, 0, 0, Math.PI * 2); ctx.fill();
  if (it.type === 'potion' || it.type === 'big') {
    const big = it.type === 'big', k = big ? 1.4 : 1;
    ctx.shadowColor = big ? '#4dd2ff' : '#ff4d6d'; ctx.shadowBlur = 10;
    ctx.fillStyle = big ? '#2e9bff' : '#ff3d5a'; circle(sx, y, 9 * k);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#e8f6ff'; rect(sx - 3 * k, y - 15 * k, 6 * k, 8 * k);
    ctx.fillStyle = '#c9a063'; rect(sx - 4 * k, y - 18 * k, 8 * k, 4 * k);
    ctx.fillStyle = 'rgba(255,255,255,.6)'; circle(sx - 3 * k, y - 2 * k, 2.5 * k);
  } else if (it.type === 'coin') {
    ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.ellipse(sx, y, Math.abs(Math.cos(it.t * 0.08)) * 9 + 1, 9, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#b8860b'; ctx.lineWidth = 2; ctx.stroke();
  } else {
    ctx.shadowColor = '#ffe14d'; ctx.shadowBlur = 14; ctx.fillStyle = '#ffe14d';
    ctx.beginPath();
    for (let i = 0; i < 10; i++) { const r = i % 2 ? 5 : 12, a = -Math.PI / 2 + i * Math.PI / 5; ctx.lineTo(sx + Math.cos(a) * r, y + Math.sin(a) * r); }
    ctx.fill(); ctx.shadowBlur = 0;
  }
}

function drawBar(x, y, w, h, ratio, col) {
  ctx.fillStyle = '#000'; rect(x - 1, y - 1, w + 2, h + 2);
  ctx.fillStyle = '#4a1b1b'; rect(x, y, w, h);
  ctx.fillStyle = col; rect(x, y, w * clamp(ratio, 0, 1), h);
}
function hpColor(r) { return r > 0.5 ? '#3ddc5a' : r > 0.25 ? '#ffc400' : '#ff3d3d'; }

function outlineText(txt, x, y, col = '#fff', font = 'bold 14px sans-serif', align = 'center') {
  ctx.font = font; ctx.textAlign = align; ctx.lineWidth = 3; ctx.strokeStyle = '#000'; ctx.strokeText(txt, x, y);
  ctx.fillStyle = col; ctx.fillText(txt, x, y);
}

function drawHUD() {
  const p = player;
  // 플레이어 패널
  ctx.fillStyle = 'rgba(0,0,0,.55)'; rect(10, 10, 270, 74);
  outlineText('PLAYER', 20, 30, '#ffd23f', 'bold 15px sans-serif', 'left');
  drawBar(20, 38, 200, 16, p.hp / p.max, hpColor(p.hp / p.max));
  outlineText(`${p.hp}/${p.max}`, 226, 51, '#fff', 'bold 12px sans-serif', 'left');
  outlineText('LIFE', 20, 76, '#fff', 'bold 12px sans-serif', 'left');
  for (let i = 0; i < p.lives; i++) { ctx.fillStyle = '#ff4d6d'; circle(66 + i * 20, 72, 7); }
  if (p.buff > 0) { drawBar(150, 66, 100, 8, p.buff / 900, '#ffe14d'); outlineText('POWER', 150, 63, '#ffe14d', 'bold 10px sans-serif', 'left'); }
  outlineText(`SCORE ${String(p.score).padStart(7, '0')}`, W - 16, 28, '#fff', 'bold 18px monospace', 'right');
  outlineText(`${stage.name}  ${stage.title}`, W - 16, 50, '#ffd23f', 'bold 14px sans-serif', 'right');

  // 보스 체력 바
  const boss = enemies.find(e => e.boss && e.st !== 'dead' || e.boss && e.st === 'dead' && e.t < 60);
  if (boss) {
    const bw = 460, bx = (W - bw) / 2;
    outlineText(boss.d.name, W / 2, 28, '#ff8a80', 'bold 16px sans-serif');
    drawBar(bx, 36, bw, 16, boss.hp / boss.max, '#e53935');
    ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 1;
    for (const f of [0.25, 0.5, 0.75]) { ctx.beginPath(); ctx.moveTo(bx + bw * f, 36); ctx.lineTo(bx + bw * f, 52); ctx.stroke(); }
  }

  // GO 화살표
  if (goT > 0 && Math.floor(tick / 20) % 2 === 0) outlineText('GO  ➜', W - 90, H / 2 - 40, '#ffd23f', 'bold 38px sans-serif');
}

function drawEnemyOverlay(e) {
  if (e.st === 'dead') return;
  const h = e.d.h * e.d.s, sx = e.x - camX, top = e.y - e.z - h;
  if (!e.boss) {
    const bw = 44;
    drawBar(sx - bw / 2, top - 20, bw, 6, e.hp / e.max, hpColor(e.hp / e.max));
    if (e.shown > 0) outlineText(e.d.name, sx, top - 26, '#ddd', 'bold 10px sans-serif');
  }
  if (e.st === 'wind' && e.t > 2) outlineText('!', sx, top - (e.boss ? 24 : 28), '#ff3d3d', 'bold 26px sans-serif');
}

function render() {
  ctx.save();
  if (shake > 0.5) ctx.translate(rand(-shake, shake) * 0.5, rand(-shake, shake) * 0.5);
  drawBG(stage ? stage.theme : 'city');
  if (stage) {
    // y 순서로 정렬해서 그린다
    const list = [];
    barrels.forEach(b => list.push({ y: b.y, f: () => drawBarrel(b) }));
    items.forEach(i => list.push({ y: i.y, f: () => drawItem(i) }));
    enemies.forEach(e => list.push({ y: e.y, f: () => { drawChar(e, enemyLook(e)); } }));
    list.push({ y: player.y, f: () => drawChar(player, playerLook()) });
    list.sort((a, b) => a.y - b.y).forEach(l => l.f());

    // 충격파 링
    for (const r of rings) {
      ctx.strokeStyle = `rgba(255,200,120,${r.life / 24})`; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.ellipse(r.x - camX, r.y, r.r, r.r * 0.3, 0, 0, Math.PI * 2); ctx.stroke();
    }
    for (const q of parts) { ctx.fillStyle = q.col; rect(q.x - camX - 2, q.y - q.z - 2, 4, 4); }
    enemies.forEach(drawEnemyOverlay);
    for (const t of texts) outlineText(String(t.txt), t.x - camX, t.y, t.col, 'bold 16px sans-serif');
  }
  ctx.restore();
  if (stage && player) drawHUD();

  if (scene === 'intro') {
    const a = clamp(Math.min(bannerT, 160 - bannerT) / 25, 0, 1);
    ctx.globalAlpha = a; ctx.fillStyle = 'rgba(0,0,0,.6)'; rect(0, H / 2 - 70, W, 140);
    outlineText(stage.name, W / 2, H / 2 - 10, '#ffd23f', 'bold 56px sans-serif');
    outlineText(stage.title, W / 2, H / 2 + 38, '#fff', 'bold 28px sans-serif');
    ctx.globalAlpha = 1;
  }
  if (clearT > 20 && scene === 'play') outlineText('VICTORY!', W / 2, H / 2 - 20, '#ffd23f', 'bold 64px sans-serif');
}

function renderIdle() {   // 타이틀/튜토리얼 뒤 배경
  stage = stage || STAGES[0];
  camX = tick * 1.2;
  drawBG(['city', 'harbor', 'castle'][Math.floor(tick / 600) % 3]);
}

// ---------------------------------------------------------------- 루프
let last = 0, acc = 0;
const STEP = 1000 / 60;
function loop(t) {
  acc += Math.min(100, t - last); last = t;
  while (acc >= STEP) { update(); acc -= STEP; for (const k in pressed) delete pressed[k]; }
  if (scene === 'title' || scene === 'tutorial') { ctx.clearRect(0, 0, W, H); const sv = stage; renderIdle(); stage = sv; }
  else render();
  requestAnimationFrame(loop);
}
requestAnimationFrame(t => { last = t; loop(t); });
