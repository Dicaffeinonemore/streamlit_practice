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
  grunt: { name: '보병', sprite: 'infantry', hp: 40, spd: 1.2, dmg: 8, range: 56, wind: 28, act: 10, rec: 30, kb: 3, score: 100,
           h: 96, s: 1, hw: 18 },
  rogue: { name: '창병', sprite: 'spearman', hp: 28, spd: 2.0, dmg: 6, range: 78, wind: 18, act: 8, rec: 22, kb: 2, score: 150,
           h: 96, s: 1, hw: 18 },
  brute: { name: '기사', sprite: 'knight', hp: 100, spd: 0.9, dmg: 16, range: 68, wind: 44, act: 12, rec: 44, kb: 6, score: 300, kd: true,
           h: 100, s: 1, hw: 22 },
  boss1: { name: '도살자 고라스', sprite: 'boss1', boss: true, hp: 260, spd: 1.05, dmg: 12, range: 62, wind: 40, act: 12, rec: 42, score: 2000, kd: true,
           h: 148, s: 1, hw: 34, moves: ['charge'] },
  boss2: { name: '까마귀 마녀 모르그라', sprite: 'boss2', boss: true, hp: 380, spd: 1.2, dmg: 13, range: 64, wind: 36, act: 12, rec: 38, score: 3500, kd: true,
           h: 148, s: 1, hw: 28, moves: ['charge', 'slam'] },
  boss3: { name: '황금왕 오렐리온', sprite: 'boss3', boss: true, hp: 520, spd: 1.3, dmg: 15, range: 68, wind: 34, act: 12, rec: 34, score: 6000, kd: true,
           h: 152, s: 1, hw: 34, moves: ['charge', 'slam'] },
};

const STAGES = [
  { name: 'STAGE 1', title: '붉은 평원', theme: 'stage1', len: 3200, boss: 'boss1',
    barrels: [520, 1100, 1650, 2100],
    waves: [
      { at: 400,  e: [['grunt', 1], ['grunt', 1]] },
      { at: 900,  e: [['grunt', 1], ['grunt', -1], ['rogue', 1]] },
      { at: 1400, e: [['rogue', 1], ['rogue', -1], ['grunt', 1]] },
      { at: 1900, e: [['grunt', 1], ['grunt', -1], ['brute', 1]] },
      { at: 2240, e: [['boss1', 1], ['grunt', -1]], boss: true },
    ] },
  { name: 'STAGE 2', title: '진흙의 야영지', theme: 'stage2', len: 3600, boss: 'boss2',
    barrels: [450, 950, 1500, 2000, 2400],
    waves: [
      { at: 400,  e: [['grunt', 1], ['rogue', 1], ['rogue', -1]] },
      { at: 800,  e: [['brute', 1], ['grunt', -1]] },
      { at: 1300, e: [['rogue', 1], ['rogue', 1], ['rogue', -1], ['grunt', -1]] },
      { at: 1800, e: [['brute', 1], ['brute', -1]] },
      { at: 2250, e: [['grunt', 1], ['grunt', 1], ['rogue', -1], ['brute', -1]] },
      { at: 2640, e: [['boss2', 1], ['rogue', -1], ['rogue', -1]], boss: true },
    ] },
  { name: 'STAGE 3', title: '불타는 성채', theme: 'stage3', len: 4000, boss: 'boss3',
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
const SP_MAX = 100;           // 필살기 게이지: 적을 때릴수록 차오른다
const GROGGY_TICKS = 300;     // 보스 기절 시간 (5초 = 300틱)
const ATK = {
  c1:  { dur: 20, on: 4, off: 10, reach: 54, dmg: 10, kd: false },
  c2:  { dur: 20, on: 4, off: 10, reach: 54, dmg: 11, kd: false },
  c3:  { dur: 30, on: 7, off: 14, reach: 68, dmg: 16, kd: true },
  air: { dur: 0,  on: 0, off: 999, reach: 60, dmg: 14, kd: true },
};

// ---------------------------------------------------------------- 상태
let scene = 'title';
let stageIdx = 0, stage = null;
let camX = 0, camLock = false, lockAt = 0, waveIdx = 0;
let player = null, enemies = [], items = [], barrels = [], parts = [], texts = [], rings = [];
let tick = 0, hitStop = 0, shake = 0, bannerT = 0, clearT = 0, goT = 0, stageStartScore = 0, nextId = 1;

function newPlayer(score = 0) {
  return { x: 80, y: 420, z: 0, vx: 0, vz: 0, face: 1, w: 26, hw: 16, hp: 100, max: 100, lives: 3,
    st: 'free', t: 0, atk: null, combo: 0, comboT: 0, queue: false, hitSet: new Set(),
    inv: 0, flash: 0, buff: 0, score, walk: false, sp: 0 };
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
  return { kind: 'enemy', id: nextId++, type, d, x, y, z: 0, vx: 0, vz: 0, face: -1, hw: d.hw, hp: d.hp, max: d.hp,
    st: 'chase', t: 0, wait: rand(0, 40), atkCd: rand(20, 60), pat: null, hitSet: null, inv: 0, flash: 0, shown: 0,
    boss: !!d.boss, nextKd: d.hp * 0.75, gr: 0, grMax: d.hp >= 500 ? 130 : 110, grT: 0, walk: false, recT: d.rec, remove: false };
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
  if (p.inv > 0 || p.st === 'down' || p.st === 'dead' || p.st === 'special') return false;
  p.hp -= dmg; p.flash = 8; p.combo = 0; p.queue = false;
  hitStop = Math.max(hitStop, 4); shake = Math.max(shake, 6);
  floatText(p.x, p.y - p.z - 110, dmg, '#ff5252');
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
    if (inReach(p, e, A.reach, 24, 55)) {
      p.hitSet.add(e); damageEnemy(e, Math.round(A.dmg * mul), A.kd);
      p.sp = Math.min(SP_MAX, p.sp + (A.kd ? 8 : 5));
    }
  }
  for (const b of barrels) {
    if (b.dead || p.hitSet.has(b)) continue;
    if (inReach(p, b, A.reach, 24, 55)) { p.hitSet.add(b); damageBarrel(b); }
  }
}

// 필살기 "회전 참격": 주변 360도를 3연속으로 벤다. 시전 중 무적.
const SPECIAL = { dur: 46, pulses: [12, 22, 32], dmg: 14, lastDmg: 24, reachX: 140, ytol: 60 };
function startSpecial() {
  const p = player;
  p.st = 'special'; p.t = 0; p.sp = 0; p.vz = 5; p.vx = 0;
  beep(220, .35, 'sawtooth', 0.06);
  rings.push({ x: p.x, y: p.y, r: 10, life: 24, col: '255,236,120' });
  shake = Math.max(shake, 6);
}
function specialPulse(last) {
  const p = player, mul = p.buff > 0 ? 1.5 : 1;
  const dmg = Math.round((last ? SPECIAL.lastDmg : SPECIAL.dmg) * mul);
  for (const e of enemies) {
    if (e.st === 'dead' || e.st === 'down' || e.inv > 0) continue;
    if (Math.abs(e.x - p.x) < SPECIAL.reachX + e.hw && Math.abs(e.y - p.y) < SPECIAL.ytol) damageEnemy(e, dmg, last);
  }
  for (const b of barrels) {
    if (!b.dead && Math.abs(b.x - p.x) < SPECIAL.reachX && Math.abs(b.y - p.y) < SPECIAL.ytol) damageBarrel(b);
  }
  rings.push({ x: p.x, y: p.y, r: 20, life: 24, col: '255,236,120' });
  beep(last ? 150 : 300, .12, 'square', 0.06);
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
      if (hit('KeyK', 'KeyX') && p.sp >= SP_MAX) { startSpecial(); break; }
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
    case 'special':
      p.t++;
      if (SPECIAL.pulses.includes(p.t)) specialPulse(p.t === SPECIAL.pulses[SPECIAL.pulses.length - 1]);
      if (p.t >= SPECIAL.dur) { p.st = 'free'; p.inv = 30; p.comboT = 0; p.combo = 0; }
      break;
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
  const stunned = e.st === 'stun';
  if (stunned) dmg = Math.round(dmg * 1.5);           // 기절 중에는 추가 피해
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
  if (e.boss) {                                   // 보스: 슈퍼아머, 그로기 게이지 + 체력 25% 단위로 다운
    if (stunned) return;                           // 기절 중에는 맞아도 상태가 바뀌지 않는다
    e.gr = Math.min(e.grMax, e.gr + dmg * 0.9); e.grT = 150;
    if (e.gr >= e.grMax) {
      e.st = 'stun'; e.t = 0; e.pat = null; e.vx = 0; e.z = 0; e.vz = 0;
      shake = 16; hitStop = 10; beep(90, .5, 'sawtooth', 0.07);
      floatText(e.x, e.y - e.z - e.d.h - 40, 'GROGGY!', '#ffe14d');
      return;
    }
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
  if (e.boss && e.st !== 'stun') { if (e.grT > 0) e.grT--; else if (e.gr > 0) e.gr = Math.max(0, e.gr - 0.2); }   // 그로기 자연 회복
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

    case 'stun':                                    // 5초간 기절
      if (e.t >= GROGGY_TICKS) { e.st = 'rec'; e.t = 0; e.recT = 30; e.gr = 0; e.grT = 0; e.atkCd = rand(30, 60); }
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

// 중세 도트 배경: 192x84 원본을 5배 확대해 좌우를 뒤집어 이어 붙이며 느리게 스크롤(원경)
const BG_SCALE = 5, BG_W = 192 * BG_SCALE;
const BG_Y = GTOP - 57 * BG_SCALE;          // 그림 속 바닥선이 걸을 수 있는 영역 위쪽에 오도록 맞춤

function drawBG(theme) {
  const img = getBackground(theme), off = camX * 0.35, first = Math.floor(off / BG_W);
  ctx.imageSmoothingEnabled = false;
  for (let n = first; n <= first + 1; n++) {
    const x = Math.round(n * BG_W - off);
    ctx.save();
    if (n % 2) { ctx.translate(x + BG_W, 0); ctx.scale(-1, 1); } else ctx.translate(x, 0);
    ctx.drawImage(img, 0, 0, 192, 1, 0, 0, BG_W, BG_Y);                                   // 위쪽 여백: 맨 윗줄 늘이기
    ctx.drawImage(img, 0, 0, 192, 84, 0, BG_Y, BG_W, 84 * BG_SCALE);
    ctx.drawImage(img, 0, 83, 192, 1, 0, BG_Y + 84 * BG_SCALE, BG_W, H);                  // 아래쪽 여백: 맨 아랫줄 늘이기
    ctx.restore();
  }
  // 걷는 바닥은 캐릭터 이동 속도로 스크롤되는 선을 얹어 속도감을 준다
  ctx.fillStyle = 'rgba(0,0,0,.28)'; rect(0, GTOP, W, 4);
  ctx.strokeStyle = 'rgba(0,0,0,.16)'; ctx.lineWidth = 2;
  for (let y = GTOP + 40; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  for (let x = -(camX % 90); x < W; x += 90) { ctx.beginPath(); ctx.moveTo(x, GTOP); ctx.lineTo(x - 30, H); ctx.stroke(); }
}

const SPR_SCALE = 2;   // 도트 1칸 = 화면 2px (정수 배율이라 도트가 선명하게 유지됨)

function drawChar(e, o) {
  const S = SPRITES[o.sprite], sc = SPR_SCALE;
  const sx = Math.round(e.x - camX), sy = Math.round(e.y);
  const H = S.gy * sc;
  ctx.fillStyle = 'rgba(0,0,0,.35)';
  ctx.beginPath(); ctx.ellipse(sx, sy, S.sh * sc * (1 - Math.min(e.z, 150) / 300), 6 * sc * 0.7, 0, 0, Math.PI * 2); ctx.fill();
  if (o.blink && Math.floor(tick / 4) % 2) return;

  ctx.save();
  ctx.translate(sx, sy - Math.round(e.z)); ctx.scale(e.face, 1);
  if (o.lying) { ctx.translate(H * 0.5, -8); ctx.rotate(-Math.PI / 2); }
  else {
    ctx.translate(Math.round(o.dx || 0), Math.round(o.dy || 0));
    if (o.lean) ctx.rotate(o.lean);
    if (o.spin) { ctx.translate(0, -H * 0.5); ctx.rotate(o.spin); ctx.translate(0, H * 0.5); }
  }
  if (o.aura) {
    ctx.globalAlpha = 0.35 + 0.15 * Math.sin(tick * 0.3); ctx.fillStyle = '#ffd23f';
    ctx.beginPath(); ctx.ellipse(0, -H * 0.5, S.sh * sc * 1.5, H * 0.58, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
  }
  ctx.imageSmoothingEnabled = false;
  const img = getSprite(o.sprite, o.frame, o.flash);
  ctx.drawImage(img, -S.ax * sc, -S.gy * sc, S.w * sc, S.h * sc);

  if (o.fx) {                                                                                       // 타격 이펙트
    ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(o.fx * 0.35, -H * 0.55, o.fx * 0.62, -1.0, 1.0); ctx.stroke();
  }
  ctx.restore();
}

// 도트 스프라이트는 프레임이 2장(0/1)뿐이라 기울임/돌진 이동으로 동작을 표현한다
function idleFrame(walk) { return Math.floor(tick / (walk ? 10 : 30)) % 2; }

function playerLook() {
  const p = player, o = { sprite: 'player' };
  o.walk = p.walk; o.flash = p.flash > 0; o.aura = p.buff > 0;
  o.frame = idleFrame(p.walk);
  if (p.walk && p.z === 0) o.dy = -Math.abs(Math.sin(tick * 0.3)) * 3;
  o.blink = p.inv > 0 && p.st === 'free';
  o.lying = (p.st === 'down' && p.z === 0 && p.t > 8) || (p.st === 'dead' && p.z === 0);
  if (p.st === 'hurt' || (p.st === 'down' && !o.lying)) { o.lean = -0.2; o.flash = true; }
  if (p.st === 'special') { o.spin = (p.t / SPECIAL.dur) * Math.PI * 6; o.frame = 1; o.aura = true; }
  if (p.st === 'atk') {
    const A = ATK[p.atk];
    if (p.atk === 'air') { o.lean = 0.45; o.fx = 44; }
    else {
      const a = p.t < A.on ? p.t / A.on : p.t <= A.off ? 1 : Math.max(0, 1 - (p.t - A.off) / 10);
      const big = p.atk === 'c3';
      o.dx = a * (big ? 16 : 9); o.lean = a * (big ? 0.3 : 0.16); o.frame = 1;
      if (p.t >= A.on && p.t <= A.off) o.fx = A.reach;
    }
  }
  return o;
}
function enemyLook(e) {
  const d = e.d, o = { sprite: d.sprite };
  o.walk = e.walk; o.flash = e.flash > 0;
  o.frame = idleFrame(e.walk);
  if (e.walk && e.z === 0) o.dy = -Math.abs(Math.sin(tick * 0.3 + e.id)) * 3;
  o.lying = (e.st === 'down' || e.st === 'dead') && e.z === 0;
  if (e.st === 'dead' && e.t > (e.boss ? 90 : 35)) o.blink = true;
  if (e.st === 'hurt' || ((e.st === 'down' || e.st === 'dead') && !o.lying)) o.lean = -0.2;
  if (e.st === 'stun') { o.lean = Math.sin(tick * 0.15) * 0.12 - 0.05; o.frame = 0; }
  if (e.st === 'wind') {                                   // 공격 예고: 뒤로 젖히며 번쩍
    const k = Math.min(1, e.t / 12);
    o.lean = -0.14 * k; o.dx = -7 * k;
    if (e.t > 6 && Math.floor(e.t / 4) % 2) o.flash = true;
  }
  if (e.st === 'act') {
    if (e.pat === 'swing') { o.lean = 0.16; o.dx = 14; o.frame = 1; o.fx = d.range * 0.8; }
    else if (e.pat === 'charge') { o.lean = 0.3; o.dx = 6; o.frame = 1; }
    else if (e.pat === 'slam') { o.lean = 0.25; o.frame = 1; }
  }
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
  ctx.fillStyle = 'rgba(0,0,0,.55)'; rect(10, 10, 270, 96);
  outlineText('PLAYER', 20, 30, '#ffd23f', 'bold 15px sans-serif', 'left');
  drawBar(20, 38, 200, 16, p.hp / p.max, hpColor(p.hp / p.max));
  outlineText(`${p.hp}/${p.max}`, 226, 51, '#fff', 'bold 12px sans-serif', 'left');
  const spFull = p.sp >= SP_MAX;
  drawBar(20, 60, 200, 8, p.sp / SP_MAX, spFull && Math.floor(tick / 8) % 2 ? '#fff6a8' : '#35b6ff');
  outlineText(spFull ? 'K : 필살기!' : 'SP', 226, 69, spFull ? '#ffe14d' : '#8fd4ff', 'bold 12px sans-serif', 'left');
  outlineText('LIFE', 20, 96, '#fff', 'bold 12px sans-serif', 'left');
  for (let i = 0; i < p.lives; i++) { ctx.fillStyle = '#ff4d6d'; circle(66 + i * 20, 92, 7); }
  if (p.buff > 0) { drawBar(150, 88, 100, 8, p.buff / 900, '#ffe14d'); outlineText('POWER', 150, 85, '#ffe14d', 'bold 10px sans-serif', 'left'); }
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
    // 그로기 게이지 (가득 차면 5초 기절, 기절 중에는 남은 시간이 줄어든다)
    if (boss.st !== 'dead') {
      if (boss.st === 'stun') {
        drawBar(bx, 56, bw, 8, 1 - boss.t / GROGGY_TICKS, Math.floor(tick / 6) % 2 ? '#ffe14d' : '#ff9800');
        outlineText(`GROGGY  ${((GROGGY_TICKS - boss.t) / 60).toFixed(1)}s  (받는 피해 x1.5)`, W / 2, 80, '#ffe14d', 'bold 13px sans-serif');
      } else {
        drawBar(bx, 56, bw, 8, boss.gr / boss.grMax, '#ffb300');
        outlineText('GROGGY', bx - 8, 64, '#ffcc66', 'bold 11px sans-serif', 'right');
      }
    }
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
  if (e.st === 'stun') {
    for (let i = 0; i < 4; i++) {
      const a = tick * 0.12 + i * Math.PI / 2;
      ctx.fillStyle = '#ffe14d'; circle(sx + Math.cos(a) * 34, top + 8 + Math.sin(a) * 9, 5);
    }
  }
  if (e.st === 'wind' && e.t > 2) outlineText('!', sx, top - (e.boss ? 24 : 28), '#ff3d3d', 'bold 26px sans-serif');
}

function render() {
  ctx.save();
  if (shake > 0.5) ctx.translate(rand(-shake, shake) * 0.5, rand(-shake, shake) * 0.5);
  drawBG(stage ? stage.theme : 'stage1');
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
      ctx.strokeStyle = `rgba(${r.col || '255,200,120'},${r.life / 24})`; ctx.lineWidth = 5;
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
  drawBG(['stage1', 'stage2', 'stage3'][Math.floor(tick / 600) % 3]);
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
