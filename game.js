'use strict';
// =====================================================================
//  STREET FIST - 벨트스크롤 액션 (Canvas)
// =====================================================================
const cv = document.getElementById('c');
const ctx = cv.getContext('2d');
const W = 960, H = 540;
const GTOP = 340, GBOT = 500;          // 걸어 다닐 수 있는 바닥 영역(깊이)
const MS = 1000 / 60;                  // 1틱(60fps) = 16.7ms. 공격 모션은 ms 단위로 만든다
const SC = 2;                          // 도트 1칸 = 월드 2px
// 카메라 줌: 월드를 1.5배 확대해 그린다 (도트 1칸 = 화면 3px). 화면에 보이는 월드는 640x360, 위쪽 OY 만큼은 잘라낸다
const Z = 1.5, VW = W / Z, VH = H / Z, OY = 146;
const $ = id => document.getElementById(id);
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const every = (t, n) => Math.floor(t / n) !== Math.floor((t - MS) / n);   // ms 타이머가 n ms 경계를 막 넘었는가
const { Layer, blit, sprite, spriteShaded, shade, RAD, ease, lerp, crescent, sparkBurst, aura, warn, shockwave, orb, teleportRing, goldWave, pillar,
  moon, slashLine, impactFx, FIG, drawFigure, drawTrail, mixP, HATK, HR, heroAtk, heroSpecial, BR, bossPoseAt } = MO;

// ---------------------------------------------------------------- 입력
const keys = {}, pressed = {};
const down = (...c) => c.some(k => keys[k]);
const hit = (...c) => c.some(k => pressed[k]);
const JUMP_KEYS = ['Space', 'ControlLeft', 'ControlRight'];
// 같은 방향키를 0.25초(15틱) 안에 두 번 누르면 대시
const TAP_DIR = { ArrowLeft: -1, KeyA: -1, ArrowRight: 1, KeyD: 1 };
let lastTap = { dir: 0, t: -99 }, dashReq = 0;
addEventListener('keydown', e => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  // Ctrl(점프)을 누른 채 다른 키를 눌러도 브라우저 단축키(북마크·저장 등)가 뜨지 않게 막는다
  if ((scene === 'play' || scene === 'intro') && (e.ctrlKey || e.code.startsWith('Control'))) e.preventDefault();
  if (!e.repeat) {
    pressed[e.code] = true; onKeyOnce(e.code);
    const d = TAP_DIR[e.code];
    if (d) {
      if (lastTap.dir === d && tick - lastTap.t <= 15) { dashReq = d; lastTap = { dir: 0, t: -99 }; }
      else lastTap = { dir: d, t: tick };
    }
  }
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
// 적 정의. wind=공격 예고, act=공격 판정 유지, rec=공격 후 경직 (틱)
// 보스는 pats 의 패턴(ms 단위 타임라인)으로 싸운다
const ET = {
  grunt: { name: '보병', sprite: 'infantry', hp: 40, spd: 1.2, dmg: 8, range: 56, wind: 28, act: 10, rec: 30, kb: 3, score: 100,
           h: 96, s: 1, hw: 18 },
  rogue: { name: '창병', sprite: 'spearman', hp: 28, spd: 2.0, dmg: 6, range: 78, wind: 18, act: 8, rec: 22, kb: 2, score: 150,
           h: 96, s: 1, hw: 18 },
  brute: { name: '기사', sprite: 'knight', hp: 100, spd: 0.9, dmg: 16, range: 68, wind: 44, act: 12, rec: 44, kb: 6, score: 300, kd: true,
           h: 100, s: 1, hw: 22 },
  boss1: { name: '도살자 고라스', sprite: 'boss1', boss: true, hp: 260, spd: 1.05, range: 62, score: 2000, kd: true,
           h: 148, s: 1, hw: 34, pats: { slam: '지축 내려찍기', sweep: '식칼 휩쓸기', rage: '도살 돌진' } },
  boss2: { name: '까마귀 마녀 모르그라', sprite: 'boss2', boss: true, hp: 380, spd: 1.2, range: 64, score: 3500, kd: true,
           h: 148, s: 1, hw: 28, keepAway: true, pats: { teleport: '까마귀 이동', orbs: '녹염 탄막', ravens: '까마귀 떼' } },
  boss3: { name: '황금왕 오렐리온', sprite: 'boss3', boss: true, hp: 520, spd: 1.3, range: 68, score: 6000, kd: true,
           h: 152, s: 1, hw: 34, pats: { slash3: '삼연 검기', pillars: '화염 기둥', charge: '왕의 돌진' } },
};
// 패턴 시작 후 이 시간(ms) 동안 머리 위에 ! 경고 표시
const TELE = { slam: 650, sweep: 450, rage: 550, orbs: 500, ravens: 450, pillars: 700, charge: 450 };

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

// 플레이어 3콤보: 예비 동작(wind) → 휘두름(act) → 회수(rec), ms. 휘두름 35% 지점부터 판정
const SP_MAX = 100;           // 필살기 게이지: 적을 때릴수록 차오른다
const GROGGY_TICKS = 300;     // 보스 기절 시간 (5초 = 300틱)
const ATK = {
  c1:  { ...HATK[0], dmg: 10, reach: 70, kd: false, step: 8,  stop: 3, fx: 0 },   // 일섬: 위에서 대각선으로 내려 벤다
  c2:  { ...HATK[1], dmg: 11, reach: 72, kd: false, step: 8,  stop: 3, fx: 1 },   // 역일섬: 아래에서 위로 올려 벤다
  c3:  { ...HATK[2], dmg: 16, reach: 88, kd: true,  step: 16, stop: 7, fx: 2 },   // 참격: 크게 내려치고 푸른 검기 발사
  air: { dmg: 14, reach: 64, kd: true, stop: 5, fx: 2 },
};
const LINK_MS = 420, BUF_MS = 220;      // 다음 타 연결 허용 시간 / 선입력 유지 시간
// 필살기 "흑월참": 기 모으기 → 돌진 → 4연 베기 → 도약 내려찍기. 시전 중 무적
const SPECIAL = { dur: 2100, slash: 7, fin: 30 };

// ---------------------------------------------------------------- 상태
let scene = 'title';
let stageIdx = 0, stage = null;
let camX = 0, camLock = false, lockAt = 0, waveIdx = 0;
let player = null, enemies = [], items = [], barrels = [], parts = [], texts = [];
let hazards = [], impacts = [], bursts = [], ghosts = [], target = null;   // target: 최근에 때린 잡몹 (HUD 표시)   // 투사체·위험 지대 / 적중 이펙트 / 불꽃 / 잔상
let tick = 0, hitStop = 0, shake = 0, flashT = 0, bannerT = 0, clearT = 0, goT = 0, stageStartScore = 0, nextId = 1;

function newPlayer(score = 0) {
  return { x: 80, y: 420, z: 0, vx: 0, vz: 0, face: 1, w: 26, hw: 16, hp: 100, max: 100, lives: 3,
    st: 'free', t: 0, atk: null, combo: 0, comboT: 0, buf: 0, x0: 80, wave: false, hitSet: new Set(),
    inv: 0, flash: 0, buff: 0, score, walk: false, sp: 0, dashCd: 0, spTg: null, spX: 0, spY: 0, spX0: 0, spY0: 0, spHits: 0, spFin: false };
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
  camX = 0; camLock = false; waveIdx = 0; clearT = 0; goT = 0; flashT = 0;
  enemies = []; items = []; parts = []; texts = []; target = null; hazards = []; impacts = []; bursts = []; ghosts = [];
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
    const x = side > 0 ? camX + VW + rand(30, 110) : camX - rand(30, 110);
    enemies.push(mkEnemy(type, x, rand(GTOP + 20, GBOT)));
  }
}
function mkEnemy(type, x, y) {
  const d = ET[type];
  return { kind: 'enemy', id: nextId++, type, d, x, y, z: 0, vx: 0, vz: 0, face: -1, hw: d.hw, hp: d.hp, max: d.hp,
    st: 'chase', t: 0, wait: rand(0, 40), atkCd: rand(20, 60), pat: null, hitSet: null, inv: 0, flash: 0,
    boss: !!d.boss, nextKd: d.hp * 0.75, gr: 0, grMax: d.hp >= 500 ? 130 : 110, grT: 0, walk: false, recT: d.rec || 30, remove: false,
    hr: 9999, hdir: 1, hheavy: false,                                          // 피격 반동 (맞은 뒤 지난 ms, 방향, 강타 여부)
    pt: 0, marks: {}, bdx: 0, bdy: 0, alpha: 1, wash: null, invuln: false, hot: false, last: null, tipX: null, tipH: 0 };   // 보스 패턴용
}

// ---------------------------------------------------------------- 이펙트 / 아이템
function sparks(x, y, z, n = 7, col = '#fff6a8') {
  for (let i = 0; i < n; i++)
    parts.push({ x, y, z, vx: rand(-3, 3), vz: rand(1, 5), life: rand(14, 26), col });
}
function floatText(x, y, txt, col = '#fff') { texts.push({ x, y, txt, col, life: 50 }); }
// 적중 이펙트(kind 0~2) / 도트 불꽃 / 잔상. 위치는 월드 좌표 (x, 깊이 y, 높이 z)
function impact(x, y, z, kind, dir) { impacts.push({ x, y, z, kind, dir: dir || 1, age: 0, seed: (Math.random() * 999) | 0 }); }
function burst(x, y, z, cols) { bursts.push({ x, y, z, age: 0, seed: (Math.random() * 999) | 0, cols }); }
function ghost(x, y, z, id, face, wash, life) { ghosts.push({ x, y, z, id, face, wash, life, age: 0 }); }
function cutIn() { const c = $('cutin'); c.classList.remove('show'); void c.offsetWidth; c.classList.add('show'); }

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
function canHit(e) { return e.st !== 'dead' && e.st !== 'down' && e.inv <= 0 && !e.invuln; }

// ---------------------------------------------------------------- 플레이어
function startAtk(n) {
  const p = player;
  p.st = 'atk'; p.t = 0; p.buf = 0; p.hitSet = new Set(); p.x0 = p.x; p.wave = false;
  if (n === 'air') { p.atk = 'air'; beep(420, .1, 'square'); return; }
  p.combo = n; p.atk = ['c1', 'c2', 'c3'][n];
  beep(260 + n * 70, .08, 'square');
}

function hurtPlayer(dmg, dir, kd) {
  const p = player;
  if (p.inv > 0 || p.st === 'down' || p.st === 'dead' || p.st === 'special') return false;
  p.hp -= dmg; p.flash = 5; p.combo = 0; p.buf = 0; p.wave = false;
  hitStop = Math.max(hitStop, kd ? 6 : 4); shake = Math.max(shake, kd ? 12 : 7);
  floatText(p.x, p.y - p.z - 110, dmg, '#ff5a6a');
  impact(p.x - dir * 6, p.y, p.z + 56, kd ? 2 : 1, dir);
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
  let landed = false;
  for (const e of enemies) {
    if (!canHit(e) || p.hitSet.has(e)) continue;
    if (inReach(p, e, A.reach, 24, 55)) {
      p.hitSet.add(e); damageEnemy(e, Math.round(A.dmg * mul), A.kd, A.fx);
      p.sp = Math.min(SP_MAX, p.sp + (A.kd ? 8 : 5)); landed = true;
    }
  }
  for (const b of barrels) {
    if (b.dead || p.hitSet.has(b)) continue;
    if (inReach(p, b, A.reach, 24, 55)) { p.hitSet.add(b); damageBarrel(b); }
  }
  if (landed) { hitStop = Math.max(hitStop, A.stop); if (A.fx === 2) shake = Math.max(shake, 8); }
}
// 참격 마무리에서 날아가는 푸른 검기
function launchWave() {
  const p = player;
  hazards.push({ type: 'pwave', x: p.x + p.face * 44, y: p.y, h: p.z + 44, dir: p.face, age: 0 });
  beep(520, .12, 'triangle', 0.05);
}

const DASH = { dist: 80, dur: 190, inv: 15, cd: 31 };   // 이동 거리(px), 길이(ms), 무적·쿨타임(틱)
function startDash(d) {
  const p = player;
  p.st = 'dash'; p.t = 0; p.x0 = p.x; p.face = d; p.combo = 0; p.comboT = 0; p.buf = 0; p.wave = false;
  p.inv = Math.max(p.inv, DASH.inv); p.dashCd = DASH.cd;
  burst(p.x - d * 12, p.y, 4, ['#d8c8a8', '#a8864a', '#6a4a28']);
  beep(700, .06, 'triangle', 0.03);
}

function startSpecial() {
  const p = player;
  p.st = 'special'; p.t = 0; p.sp = 0; p.vx = 0; p.combo = 0; p.buf = 0; p.spHits = 0; p.spFin = false;
  // 목표: 바라보는 쪽에서 가장 가까운 적 (뒤쪽 적은 우선순위를 낮춘다)
  let best = null, bd = 1e9;
  for (const e of enemies) {
    if (e.st === 'dead' || Math.abs(e.x - p.x) > 420 || Math.abs(e.y - p.y) > 120) continue;
    const d = Math.abs(e.x - p.x) + Math.abs(e.y - p.y) * 2 + ((e.x - p.x) * p.face < 0 ? 200 : 0);
    if (d < bd) { bd = d; best = e; }
  }
  p.spTg = best;
  if (best) p.face = best.x >= p.x ? 1 : -1;
  p.spX = best ? best.x : p.x + p.face * 140; p.spY = best ? best.y : p.y;
  p.spX0 = p.x; p.spY0 = p.y;
  cutIn(); beep(220, .35, 'sawtooth', 0.06);
}
function updSpecial() {
  const p = player, t = p.t * MS, f = p.face, tg = p.spTg;
  if (tg && tg.st !== 'dead' && t < 1580) { p.spX = tg.x; p.spY = tg.y; }
  if (t >= 450 && t < 620) {                                     // 돌진: 목표 앞까지 순간 이동하며 붉은 잔상
    const u = ease((t - 450) / 150);
    p.x = lerp(p.spX0, p.spX - f * 52, u); p.y = lerp(p.spY0, p.spY, u);
    if (every(t, 26)) ghost(p.x, p.y, p.z, 'player', f, '#ff3a4a', 240);
  }
  for (let k = 0; k < 4; k++) {                                  // 4연 베기: 각 베기의 스윙 중간에 적중
    const st = 620 + k * 160;
    if (t >= st + 40 && t < st + 120) p.x += f * 3 * SC * MS / 80;
    if (t >= st + 80 && p.spHits <= k) { p.spHits = k + 1; specialHit(false, k); }
  }
  if (t >= 1580 && !p.spFin) { p.spFin = true; specialHit(true, 4); }   // 도약 내려찍기
  if (t >= SPECIAL.dur) { p.st = 'free'; p.inv = 24; p.comboT = 0; p.combo = 0; p.spTg = null; }
}
function specialHit(last, k) {
  const p = player, f = p.face, mul = p.buff > 0 ? 1.5 : 1;
  const dmg = Math.round((last ? SPECIAL.fin : SPECIAL.slash) * mul), rx = last ? 110 : 80, ry = last ? 60 : 44;
  let any = false;
  for (const e of enemies) {
    if (!canHit(e)) continue;
    if (Math.abs(e.x - p.spX) < rx + e.hw && Math.abs(e.y - p.spY) < ry) { damageEnemy(e, dmg, last, last ? 2 : 1); any = true; }
  }
  for (const b of barrels) {
    if (!b.dead && Math.abs(b.x - p.spX) < rx && Math.abs(b.y - p.spY) < ry) damageBarrel(b);
  }
  if (!any) impact(p.spX - f * 12, p.spY, 72 + (k === 1 ? 16 : (k === 0 ? 4 : -8)), last ? 2 : 1, f);
  if (last) { flashT = 240; shake = Math.max(shake, 18); hitStop = Math.max(hitStop, 6); beep(150, .3, 'sawtooth', 0.07); }
  else { shake = Math.max(shake, 6); beep(320 + k * 40, .08, 'square', 0.05); }
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
  if (p.buf > 0) p.buf -= MS;
  if (p.dashCd > 0) p.dashCd--;
  p.walk = false;
  if (dashReq) {                                   // 방향키 두 번: 지상에서 이동·공격 중 언제든 대시 (공격은 취소)
    const d = dashReq; dashReq = 0;
    if (p.dashCd <= 0 && p.z === 0 && (p.st === 'free' || p.st === 'atk')) startDash(d);
  }

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
      p.t++;
      if (p.comboT > 0) p.comboT--;
      if (hit(...JUMP_KEYS) && p.z === 0) { p.vz = 9.6; beep(500, .1, 'triangle'); }
      if (hit('KeyK', 'KeyX') && p.sp >= SP_MAX) { startSpecial(); break; }
      if (hit('KeyJ', 'KeyZ')) {
        if (p.z > 0) startAtk('air');
        else startAtk(p.comboT > 0 && p.combo < 2 ? p.combo + 1 : 0);
      }
      break;
    }
    case 'atk': {
      const A = ATK[p.atk];
      p.t++;
      if (p.atk === 'air') {
        p.x += p.face * 2.6;
        playerStrike(A);
        if (p.z <= 0 && p.vz === 0) { p.st = 'free'; p.t = 0; p.comboT = 0; p.combo = 0; }
        break;
      }
      const t = p.t * MS, hitAt = A.wind + A.act;
      if (t >= A.wind && t < hitAt + MS) p.x = p.x0 + A.step * p.face * ease((t - A.wind) / A.act);   // 휘두르며 한 걸음
      if (t >= A.wind + A.act * 0.35 && t < hitAt + 30) playerStrike(A);
      if (hit('KeyJ', 'KeyZ')) p.buf = BUF_MS;
      if (p.combo === 2 && !p.wave && t >= A.wind + A.act * 0.6) { p.wave = true; launchWave(); }
      if (p.buf > 0 && p.combo < 2 && t >= hitAt + A.rec * 0.45) { startAtk(p.combo + 1); break; }
      if (t >= hitAt + A.rec) {
        p.st = 'free'; p.t = 0;
        p.comboT = p.combo < 2 ? Math.round(LINK_MS / MS) : 0;
        if (p.combo === 2) p.combo = 0;
      }
      break;
    }
    case 'dash': {                                 // 150ms 동안 80px 미끄러지듯 이동, 푸른 잔상. 110ms 뒤부터 공격으로 연결 가능
      p.t++;
      const t = p.t * MS;
      p.x = p.x0 + p.face * DASH.dist * ease(Math.min(1, t / 150));
      if (every(t, 30)) ghost(p.x, p.y, p.z, 'player', p.face, '#9cc3ff', 240);
      if (hit('KeyJ', 'KeyZ') && t >= 110) { startAtk(0); break; }
      if (t >= DASH.dur) { p.st = 'free'; p.t = 0; }
      break;
    }
    case 'special':
      p.t++;
      updSpecial();
      break;
    case 'hurt':
      p.t++; p.x += p.vx; p.vx *= 0.85;
      if (p.t > 16) { p.st = 'free'; p.t = 0; }
      break;
    case 'down':
      p.t++; p.x += p.vx; p.vx *= 0.96;
      if (p.t > 55 && p.z === 0) { p.st = 'free'; p.t = 0; p.inv = 100; }
      break;
    case 'dead':
      p.t++; p.x += p.vx; p.vx *= 0.96;
      if (p.t > 100) {
        if (p.lives > 0) {                      // 리스폰
          p.st = 'free'; p.t = 0; p.hp = p.max; p.inv = 150; p.z = 0; p.vz = 0;
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
  p.x = clamp(p.x, camX + 20, Math.min(camX + VW - 20, stage.len - 20));
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
// kind: 적중 이펙트 단계 (0 가벼운 타격 / 1 연결기 / 2 마무리)
function damageEnemy(e, dmg, kd, kind = 0) {
  const p = player;
  const stunned = e.st === 'stun';
  if (stunned) dmg = Math.round(dmg * 1.5);           // 기절 중에는 추가 피해
  e.hp -= dmg; e.flash = 6;
  hitStop = Math.max(hitStop, kd ? 6 : 3);
  beep(kd ? 140 : 210, .07, 'sawtooth');
  const dir = p.x <= e.x ? 1 : -1, hz = e.z + SPRITES[e.d.sprite].gy * SC * 0.55;
  e.hr = 0; e.hdir = dir; e.hheavy = kind >= 2;
  impact(e.x - dir * e.hw * 0.6, e.y, hz, kind, dir);
  burst(e.x - dir * e.hw * 0.5, e.y, hz, kind === 2 ? ['#ffffff', '#9cc3ff', '#6a7cc0'] : undefined);
  floatText(e.x, e.y - e.z - e.d.h * e.d.s - 14, dmg, '#ffe27a');
  if (!e.boss) target = { e, t: 150 };

  if (e.hp <= 0) {
    e.hp = 0; e.st = 'dead'; e.t = 0; e.pat = null;
    p.score += e.d.score; dropFrom(e);
    if (e.boss) {                                  // 보스는 그 자리에서 무너진다
      resetBossFx(e); e.vx = 0; e.vz = 0; shake = 20; hitStop = 16; flashT = 200;
      hazards = hazards.filter(z => z.type === 'pwave');
    } else { e.vz = 6; e.vx = dir * 5; }
    return;
  }
  if (e.boss) {                                   // 보스: 슈퍼아머, 그로기 게이지 + 체력 25% 단위로 다운
    if (stunned) return;                           // 기절 중에는 맞아도 상태가 바뀌지 않는다
    e.gr = Math.min(e.grMax, e.gr + dmg * 0.9); e.grT = 150;
    if (e.gr >= e.grMax) {
      resetBossFx(e);
      e.st = 'stun'; e.t = 0; e.vx = 0; e.z = 0; e.vz = 0;
      shake = 16; hitStop = 10; beep(90, .5, 'sawtooth', 0.07);
      floatText(e.x, e.y - e.z - e.d.h - 40, 'GROGGY!', '#ffe14d');
      return;
    }
    if (e.hp <= e.nextKd) {
      e.nextKd -= e.max * 0.25;
      resetBossFx(e);
      e.st = 'down'; e.t = 0; e.vz = 5; e.vx = dir * 3;
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
    const x = side > 0 ? camX + VW + 40 : camX - 40;
    enemies.push(mkEnemy('rogue', x, rand(GTOP + 20, GBOT)));
  }
  floatText(camX + VW / 2, OY + 90, '부하 소환!', '#ff80ab');
}

function startAttack(e, pat) {
  e.pat = pat; e.st = 'wind'; e.t = 0; e.hitSet = new Set();
  e.face = player.x >= e.x ? 1 : -1;
  beep(pat === 'swing' ? 90 : 70, .12, 'triangle', 0.03);
}

// ---------------------------------------------------------------- 보스 패턴
// 고라스: 내려찍기(충격파) / 휩쓸기 / 돌진(분노)
// 모르그라: 순간이동 / 녹염 탄막 / 까마귀 떼
// 오렐리온: 삼연 검기 / 화염 기둥 / 왕의 돌진(분노)
// 체력 절반 이하(2페이즈)에서는 탄 수가 늘고 쿨타임이 짧아진다
function phase2(e) { return e.hp < e.max * 0.5; }
function resetBossFx(e) { e.pat = null; e.bdx = 0; e.bdy = 0; e.alpha = 1; e.wash = null; e.invuln = false; e.hot = false; }
function pickPat(e, adx, ady, p2) {
  const near = adx < (e.type === 'boss1' ? 110 : 130) && ady < 34;   // 고라스 휩쓸기 사거리 ≈ 108px
  let ch = null;
  if (e.type === 'boss1') {
    if (near) ch = ['sweep', 'sweep', 'slam', p2 ? 'rage' : 'slam'];
    else if (adx < 460 && Math.random() < 0.6) ch = p2 ? ['slam', 'rage', 'rage'] : ['slam', 'slam', 'rage'];
  } else if (e.type === 'boss2') {
    ch = adx < 110 ? ['teleport', 'teleport', 'orbs'] : ['orbs', 'orbs', 'ravens', 'ravens', 'teleport'];
  } else if (near) ch = ['slash3', 'pillars', 'slash3', p2 ? 'charge' : 'pillars'];
  else if (Math.random() < 0.6) ch = ['pillars', 'slash3', p2 ? 'charge' : 'pillars', p2 ? 'charge' : 'slash3'];
  if (!ch) return null;                            // 멀면 조금 더 다가간 뒤 다시 고른다
  const fresh = ch.filter(c => c !== e.last), list = fresh.length ? fresh : ch;
  return list[Math.floor(Math.random() * list.length)];
}
function startPat(e, pat) {
  resetBossFx(e);
  e.st = 'pat'; e.pat = pat; e.pt = 0; e.marks = {}; e.last = pat;
  e.face = player.x >= e.x ? 1 : -1;
  beep(70, .12, 'triangle', 0.03);
}
function endPat(e, next) {
  resetBossFx(e);
  e.st = 'chase'; e.t = 0; e.wait = 0;
  e.atkCd = Math.round((700 + Math.random() * 600) * (phase2(e) ? 0.7 : 1) / MS);
  if (next) startPat(e, next);
}
function bossChase(e) {
  const p = player, d = e.d, dx = p.x - e.x, dy = p.y - e.y, adx = Math.abs(dx);
  e.face = dx >= 0 ? 1 : -1;
  if (p.st === 'dead') return;
  const attackers = enemies.reduce((n, o) => n + ((o !== e && (o.st === 'wind' || o.st === 'act' || o.st === 'pat')) ? 1 : 0), 0);
  const can = attackers < 3 && p.st !== 'down' && e.atkCd <= 0;
  let tx, ty = p.y;
  if (d.keepAway) tx = adx < 120 ? e.x - e.face * 60 : (adx > 200 ? p.x - e.face * 170 : e.x);   // 마녀는 거리를 둔다
  else if (can || adx < 220) tx = p.x - e.face * (d.range - 14);
  else { tx = p.x - e.face * (150 + (e.id % 3) * 35); ty = p.y + ((e.id % 2) ? 34 : -34); }
  const mx = tx - e.x, my = ty - e.y, dist = Math.hypot(mx, my), spd = d.spd * (phase2(e) ? 1.25 : 1);
  if (dist > 4) { e.x += mx / dist * spd; e.y += my / dist * spd * 0.8; e.walk = true; }
  if (can) {
    const pat = pickPat(e, adx, Math.abs(dy), phase2(e));
    if (pat) startPat(e, pat); else e.atkCd = 12;
  }
}
function bossTip(e) { return e.tipX !== null ? [e.tipX, e.tipH] : [e.x + e.face * 28, 130]; }
function alignY(e, k) { e.y += clamp(player.y - e.y, -k, k); }   // 근접 패턴 예비 동작 중 깊이 맞추기

function runPat(e) {
  const p = player, t = e.pt, m = e.marks, p2 = phase2(e), f = e.face;
  switch (e.pat) {
    case 'slam': {                                 // 식칼을 들어 올렸다가 내려꽂고, 양쪽으로 충격파
      if (t < 650) e.bdy = -Math.round(7 * Math.min(1, t / 450));
      else if (!m.a) { m.a = 1; e.bdy = 0; slamImpact(e); }
      if (p2 && t >= 950 && !m.b) { m.b = 1; slamImpact(e); }
      if (t >= (p2 ? 1500 : 1150)) endPat(e);
      break;
    }
    case 'sweep': {                                // 뒤로 크게 젖힌 식칼을 앞으로 휩쓸기
      if (t < 450) { e.bdx = -Math.round(3 * Math.min(1, t / 200)); alignY(e, 1.4); }
      else if (t < 680) {
        const u = (t - 450) / 230; e.bdx = Math.round(-3 + 9 * u); e.hot = u > 0.2 && u < 0.85;
        if (!m.s) { m.s = 1; shake = Math.max(shake, 8); beep(80, .2, 'sawtooth', 0.05); }
        if (e.hot && !m.h && inReach(e, p, 92, 26, 70) && hurtPlayer(12, f, false)) m.h = 1;
      } else { e.bdx = Math.round(6 * (1 - Math.min(1, (t - 680) / 300))); e.hot = false; }
      if (t >= 1150) endPat(e);
      break;
    }
    case 'rage': case 'charge': {                  // 붉게(금빛으로) 번쩍이며 기를 모은 뒤 잔상을 남기며 돌진
      const rage = e.pat === 'rage', wind = rage ? 550 : 450, end = rage ? 1250 : 1010;
      if (t < wind) { e.wash = Math.floor(t / (rage ? 90 : 80)) % 2 ? (rage ? '#ff2a2a' : '#ffe27a') : null; e.bdx = rage ? Math.round(Math.sin(t * 0.06)) : 0; alignY(e, 1.6); }
      else if (t < end) {
        e.wash = null; e.bdx = 0; e.hot = true;
        e.x += f * (rage ? 170 : 270) * SC / 1000 * MS;
        if (every(t, rage ? 50 : 35)) ghost(e.x, e.y, e.z, e.d.sprite, f, rage ? '#ff5a2a' : '#ffd23a', 260);
        if (rage && every(t, 50)) burst(e.x - f * 32, e.y, 4, ['#a8864a', '#a8864a', '#6a4a28']);
        if (!m.h && Math.abs(p.x - e.x) < 44 && Math.abs(p.y - e.y) < 26 && p.z < 60 && hurtPlayer(rage ? 16 : 18, f, true)) m.h = 1;
      } else e.hot = false;
      if (t >= (rage ? 1900 : 1700)) endPat(e);
      break;
    }
    case 'teleport': {                             // 깃털 속으로 사라졌다가 플레이어 곁에 나타남
      e.invuln = t < 520;
      if (t < 250) { e.alpha = 1 - t / 250; if (!m.r1) { m.r1 = 1; hazards.push({ type: 'ring', x: e.x, y: e.y, h: 68, age: 0 }); } }
      else {
        if (!m.mv) {
          m.mv = 1; const side = p.x - camX > VW / 2 ? -1 : 1;
          e.x = clamp(p.x + side * rand(104, 132), camX + 40, camX + VW - 40); e.y = clamp(p.y + rand(-20, 20), GTOP + 10, GBOT);
          e.face = p.x >= e.x ? 1 : -1;
          hazards.push({ type: 'ring', x: e.x, y: e.y, h: 68, age: 0 });
        }
        e.alpha = clamp((t - 250) / 250, 0, 1);
      }
      if (t >= 620) endPat(e, Math.random() < 0.75 ? 'orbs' : null);
      break;
    }
    case 'orbs': {                                 // 지팡이를 휘둘러 녹색 불꽃 구슬을 부채꼴로 발사
      e.bdy = -Math.round(2 * Math.min(1, t / 300));
      const n = p2 ? 7 : 5, spread = p2 ? [-30, -20, -10, 0, 10, 20, 30] : [-24, -12, 0, 12, 24];
      if (t < 500 && every(t, 60)) { const o = bossTip(e); burst(o[0], e.y, o[1], ['#eaffea', '#7dff7a', '#2a6a3a']); }
      for (let k = 0; k < n; k++) {
        if (t >= 500 + k * 110 && !m['o' + k]) {
          m['o' + k] = 1;
          const o = bossTip(e), ang = Math.atan2(p.y - e.y, p.x - o[0]) + spread[k] * RAD, v = (p2 ? 88 : 78) * SC / 1000 * MS;
          const flight = Math.max(10, Math.hypot(p.x - o[0], p.y - e.y) / v);
          hazards.push({ type: 'orb', x: o[0], y: e.y, h: o[1], vx: Math.cos(ang) * v, vy: Math.sin(ang) * v, vh: (48 - o[1]) / flight, age: 0 });
          beep(600 - k * 30, .05, 'triangle', 0.03);
        }
      }
      if (t >= 500 + n * 110 + 450) endPat(e);
      break;
    }
    case 'ravens': {                               // 까마귀를 풀어놓고 한꺼번에 급강하
      e.bdy = -Math.round(2 * Math.min(1, t / 300));
      const n = p2 ? 7 : 5;
      if (t >= 450 && !m.a) {
        m.a = 1;
        for (let i = 0; i < n; i++) {
          const th = rand(150, 175);                // 화면 위쪽(HUD 아래)에서 맴돈다
          hazards.push({ type: 'raven', x: clamp(p.x + (i - (n - 1) / 2) * 48, camX + 20, camX + VW - 20),
            y: clamp(p.y + rand(-24, 24), GTOP + 10, GBOT), h: th + 60, th, age: 0, launch: 600 + i * 170, st: 'in', vx: 0, vy: 0, vh: 0 });
        }
        beep(300, .25, 'sawtooth', 0.04);
      }
      if (t >= 450 + n * 170 + 500) endPat(e);
      break;
    }
    case 'slash3': {                               // 대검을 내리벤 뒤 되베고, 벨 때마다 황금 검기
      const n = p2 ? 4 : 3, gap = p2 ? 340 : 420;
      for (let k = 0; k < n; k++) {
        const s = k * gap;
        if (t >= s && t < s + 260) {
          e.bdy = -1; alignY(e, 1);
          if (every(t, 50)) { const o = bossTip(e); burst(o[0], e.y, o[1], ['#fff3b8', '#ffd23a', '#d4a437']); }
        }
        if (t >= s + 260 && !m['s' + k]) {
          m['s' + k] = 1; e.bdy = 0; e.x += f * 10;
          hazards.push({ type: 'wave', x: e.x + f * 52, y: e.y, h: 52, dir: f, v: (p2 ? 150 : 125) * SC / 1000, age: 0 });
          shake = Math.max(shake, 5); beep(240, .12, 'sawtooth', 0.04);
        }
      }
      if (t >= (n - 1) * gap + 260 + 420) endPat(e);
      break;
    }
    case 'pillars': {                              // 대검을 높이 들었다가 땅에 찍으면 붉은 표식 자리에 불기둥
      e.bdy = -Math.round(3 * Math.min(1, t / 400));
      const xs = p2 ? [0, -52, 52, -104, 104] : [0, -60, 60];
      if (t >= 300 && !m.a) {
        m.a = 1;
        xs.forEach((o, i) => hazards.push({ type: 'pillar', x: clamp(p.x + o, camX + 20, camX + VW - 20), y: p.y, age: 0, delay: 620 + i * 100, life: 650, hit: false }));
      }
      if (t >= 920 && !m.b) { m.b = 1; shake = Math.max(shake, 8); }
      if (t >= 300 + 620 + xs.length * 100 + 700) endPat(e);
      break;
    }
  }
}
function slamImpact(e) {
  const p = player;
  shake = Math.max(shake, 16); hitStop = Math.max(hitStop, 4); beep(70, .3, 'sawtooth', 0.08);
  for (const d of [-1, 1]) hazards.push({ type: 'shock', x: e.x + d * 20, y: e.y, dir: d, age: 0, hit: false });
  burst(e.x + e.face * 30, e.y, 4, ['#fff0c0', '#f6b25a', '#a8864a']);
  if (Math.abs(p.x - e.x) < 70 && Math.abs(p.y - e.y) < 26 && p.z < 30) hurtPlayer(14, Math.sign(p.x - e.x) || 1, true);
}

function updEnemy(e) {
  const p = player, d = e.d;
  e.t++;
  if (e.flash > 0) e.flash--;
  if (e.inv > 0) e.inv--;
  if (e.atkCd > 0) e.atkCd--;
  e.hr += MS;
  e.walk = false;
  if (e.boss && e.st !== 'stun') { if (e.grT > 0) e.grT--; else if (e.gr > 0) e.gr = Math.max(0, e.gr - 0.2); }   // 그로기 자연 회복
  if (e.st === 'pat') {
    e.pt += MS; runPat(e);
    e.x = clamp(e.x, camX - 70, camX + VW + 70); e.y = clamp(e.y, GTOP + 10, GBOT);
    return;
  }
  if (e.boss && e.st === 'dead') {                 // 무너지며 불꽃이 튄다
    if (e.t < 84 && e.t % 4 === 0) burst(e.x + rand(-30, 30), e.y, rand(10, 130), ['#ffffff', '#ffe27a', '#f58c3b']);
    if (e.t > 120) e.remove = true;
    return;
  }
  const dx = p.x - e.x, dy = p.y - e.y;

  switch (e.st) {
    case 'down': case 'dead':
      e.x += e.vx; e.z += e.vz; e.vz -= 0.5; e.vx *= 0.97;
      if (e.z <= 0) { e.z = 0; e.vz = 0; e.vx *= 0.7; }
      if (e.st === 'dead') { if (e.t > 65) e.remove = true; }
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
      }
      break;
    }

    case 'act': {
      if (e.pat === 'swing') {
        if (e.t <= d.act && !e.hitSet.has(p) && inReach(e, p, d.range + 8, 20, 55)) {
          if (hurtPlayer(d.dmg, e.face, !!d.kd)) e.hitSet.add(p);
        }
        if (e.t > d.act + 2) { e.st = 'rec'; e.t = 0; e.recT = d.rec; e.atkCd = rand(15, 45); }
      }
      break;
    }

    case 'chase': {
      if (e.boss) { bossChase(e); break; }
      if (p.st === 'dead') break;
      if (e.wait > 0) { e.wait--; break; }
      e.face = dx >= 0 ? 1 : -1;
      const attackers = enemies.reduce((n, o) => n + ((o !== e && (o.st === 'wind' || o.st === 'act' || o.st === 'pat')) ? 1 : 0), 0);
      const can = attackers < 2 && p.st !== 'down' && e.atkCd <= 0;
      const side = dx >= 0 ? 1 : -1;
      // 추적 목표: 공격 가능하면 플레이어 코앞, 아니면 거리를 두고 맴돈다
      const tx = can ? p.x - side * (d.range - 14) : p.x - side * (150 + (e.id % 3) * 35);
      const ty = can ? p.y : p.y + ((e.id % 2) ? 34 : -34);
      const mx = tx - e.x, my = ty - e.y, dist = Math.hypot(mx, my);
      if (dist > 4) { e.x += mx / dist * d.spd; e.y += my / dist * d.spd * 0.8; e.walk = true; }
      if (can && Math.abs(dx) < d.range && Math.abs(dy) < 14) startAttack(e, 'swing');
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
  e.x = clamp(e.x, camX - 70, camX + VW + 70);
  e.y = clamp(e.y, GTOP + 10, GBOT);
}

// ---------------------------------------------------------------- 투사체 · 위험 지대
// 보스 공격은 깊이(y)가 맞아야 맞는다. 충격파는 점프로 넘을 수 있다
function updHazards() {
  const p = player, off = z => z.x < camX - 60 || z.x > camX + VW + 60;
  for (const z of hazards) {
    z.age += MS;
    switch (z.type) {
      case 'shock': {
        const fx = z.x + z.dir * z.age * 0.32;
        if (!z.hit && Math.abs(fx - p.x) < 12 && Math.abs(p.y - z.y) < 24 && p.z < 14 && hurtPlayer(14, z.dir, true)) z.hit = true;
        if (z.age > 1100) z.dead = true;
        break;
      }
      case 'orb':
        z.x += z.vx; z.y += z.vy; z.h = Math.max(36, z.h + z.vh);
        if (Math.abs(z.x - p.x) < 14 && Math.abs(z.y - p.y) < 16 && Math.abs(z.h - (p.z + 48)) < 44 && hurtPlayer(8, Math.sign(z.vx) || 1, false)) z.dead = true;
        if (z.age > 3500 || off(z) || z.y < GTOP - 40 || z.y > GBOT + 40) z.dead = true;
        break;
      case 'wave':
        z.x += z.dir * z.v * MS;
        if (Math.abs(z.x - p.x) < 20 && Math.abs(z.y - p.y) < 24 && p.z < 70 && hurtPlayer(10, z.dir, false)) z.dead = true;
        if (z.age > 1700 || off(z)) z.dead = true;
        break;
      case 'raven':
        if (z.st === 'in') {
          z.h = Math.max(z.th, z.h - 0.12 * MS);
          if (z.age >= z.launch) {
            const ax = p.x - z.x, ay = p.y - z.y, ah = (p.z + 44) - z.h, mm = Math.hypot(ax, ay, ah) || 1, v = 98 * SC / 1000 * MS;
            z.st = 'dive'; z.vx = ax / mm * v; z.vy = ay / mm * v; z.vh = ah / mm * v;
          }
        } else {
          z.x += z.vx; z.y += z.vy; z.h += z.vh;
          if (Math.abs(z.x - p.x) < 18 && Math.abs(z.y - p.y) < 18 && Math.abs(z.h - (p.z + 44)) < 34 && hurtPlayer(7, Math.sign(z.vx) || 1, false)) z.dead = true;
          if (z.h <= 0 || off(z)) z.dead = true;
        }
        break;
      case 'pillar': {
        const pr = (z.age - z.delay) / z.life;
        if (pr >= 0 && !z.boom) { z.boom = true; shake = Math.max(shake, 6); beep(90, .2, 'sawtooth', 0.05); }
        if (pr > 0.12 && pr < 0.85 && !z.hit && Math.abs(z.x - p.x) < 18 && Math.abs(z.y - p.y) < 18 && p.z < 90 &&
          hurtPlayer(14, Math.sign(p.x - z.x) || 1, true)) z.hit = true;
        if (z.age > z.delay + z.life) z.dead = true;
        break;
      }
      case 'ring':
        if (z.age > 420) z.dead = true;
        break;
      case 'pwave': {                              // 흑기사의 검기: 처음 닿은 적에게 적중
        z.x += z.dir * 110 * SC / 1000 * MS;
        for (const e of enemies) {
          if (!canHit(e) || Math.abs(e.x - z.x) > e.hw || Math.abs(e.y - z.y) > 26) continue;
          damageEnemy(e, Math.round(8 * (p.buff > 0 ? 1.5 : 1)), false, 1);
          p.sp = Math.min(SP_MAX, p.sp + 4); z.dead = true; break;
        }
        if (z.age > 900) z.dead = true;
        break;
      }
    }
  }
  hazards = hazards.filter(z => !z.dead);
}

// ---------------------------------------------------------------- 메인 업데이트
function update() {
  tick++;
  if (scene === 'intro') {
    if (--bannerT <= 0) scene = 'play';
    return;
  }
  if (scene !== 'play') return;
  if (flashT > 0) flashT -= MS;
  if (hitStop > 0) { hitStop--; return; }
  if (shake > 0) shake *= 0.85;

  updPlayer();

  // 카메라와 웨이브(화면 고정 전투)
  const waves = stage.waves;
  const limit = camLock ? lockAt : (waveIdx < waves.length ? waves[waveIdx].at : stage.len - VW);
  const target = player.x - VW * 0.4;
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
  updHazards();

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

  // 파티클 / 텍스트 / 이펙트
  for (const q of parts) { q.x += q.vx; q.z += q.vz; q.vz -= 0.4; q.vx *= 0.95; q.life--; if (q.z < 0) { q.z = 0; q.vz *= -0.4; } }
  parts = parts.filter(q => q.life > 0);
  for (const t of texts) { t.y -= 0.7; t.life--; }
  texts = texts.filter(t => t.life > 0);
  for (const a of impacts) a.age += MS;
  impacts = impacts.filter(a => a.age < 450);
  for (const s of bursts) s.age += MS;
  bursts = bursts.filter(s => s.age < 400);
  for (const g of ghosts) g.age += MS;
  ghosts = ghosts.filter(g => g.age < g.life);
  if (goT > 0) goT--;
  if (target && target.t > 0) target.t--;
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

// ---------------------------------------------------------------- 배경
// 원경: 192x84 도트 배경을 Scale2x 로 두 번 매끄럽게 키워 4배 크기로 느리게 스크롤 (화면 좌표)
const BG_S = 4, BG_W = 192 * BG_S, HORIZON = (GTOP - OY) * Z;     // HORIZON: 화면에서 걸을 수 있는 바닥이 시작되는 줄
const BG_Y = Math.round(HORIZON) - 57 * BG_S;                    // 그림 속 바닥선을 HORIZON 에 맞춘다
const srng = seed => { let v = seed >>> 0; return () => ((v = (Math.imul(v, 1664525) + 1013904223) >>> 0) / 4294967296); };
const bgCache = {}, floorCache = {};

// Scale2x: 계단 모양 대각선을 매끄럽게 채우면서 도트 느낌은 유지하는 2배 확대
function scale2x(src) {
  const w = src.width, h = src.height, s = src.getContext('2d').getImageData(0, 0, w, h).data;
  const c = document.createElement('canvas'); c.width = w * 2; c.height = h * 2;
  const g = c.getContext('2d'), out = g.createImageData(w * 2, h * 2), o = out.data;
  const px = (x, y) => { const i = (clamp(y, 0, h - 1) * w + clamp(x, 0, w - 1)) * 4; return (s[i] << 16) | (s[i + 1] << 8) | s[i + 2]; };
  const put = (x, y, v) => { const i = (y * w * 2 + x) * 4; o[i] = (v >> 16) & 255; o[i + 1] = (v >> 8) & 255; o[i + 2] = v & 255; o[i + 3] = 255; };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const P = px(x, y), A = px(x, y - 1), B = px(x + 1, y), C = px(x - 1, y), D = px(x, y + 1);
    put(2 * x, 2 * y, C === A && C !== D && A !== B ? A : P);
    put(2 * x + 1, 2 * y, A === B && A !== C && B !== D ? B : P);
    put(2 * x, 2 * y + 1, D === C && D !== B && C !== A ? C : P);
    put(2 * x + 1, 2 * y + 1, B === D && B !== A && D !== C ? D : P);
  }
  g.putImageData(out, 0, 0);
  return c;
}
function drawBackdrop(theme, scroll) {
  const img = bgCache[theme] || (bgCache[theme] = scale2x(scale2x(getBackground(theme))));
  const off = scroll * 0.35, first = Math.floor(off / BG_W);
  ctx.imageSmoothingEnabled = false;
  for (let n = first; n <= first + 2; n++) {
    const x = Math.round(n * BG_W - off);
    ctx.save();
    if (n % 2) { ctx.translate(x + BG_W, 0); ctx.scale(-1, 1); } else ctx.translate(x, 0);   // 좌우를 번갈아 뒤집어 이음매를 없앤다
    ctx.drawImage(img, 0, 0, img.width, 1, 0, 0, BG_W, BG_Y + 1);                       // 하늘 위쪽 여백: 맨 윗줄 늘이기
    ctx.drawImage(img, 0, 0, img.width, img.height, 0, BG_Y, BG_W, 84 * BG_S);
    ctx.restore();
  }
  // 대기 원근: 먼 배경을 살짝 어둡고 뿌옇게 해서 캐릭터가 앞으로 나와 보이게
  const g = ctx.createLinearGradient(0, 0, 0, HORIZON);
  g.addColorStop(0, 'rgba(20,14,40,.30)'); g.addColorStop(1, 'rgba(255,226,190,.12)');
  ctx.fillStyle = g; rect(0, 0, W, HORIZON + 2);
}

// 바닥: 스테이지별 도트 지면을 한 번 그려 두고 월드와 같은 속도로 스크롤.
// 아래(카메라 쪽)로 갈수록 자갈·풀·석판이 커지는 원근을 준다. P() 는 좌우가 이어지게 감싸 찍는다
const FL_W = 320, FL_TOP = GTOP - 8, FL_H = Math.ceil((OY + VH - FL_TOP) / SC) + 2;
const FLOOR_FN = {
  stage1(L, R, P, depth) {                         // 붉은 평원: 수레바퀴 자국이 난 흙길, 풀 무더기, 자갈
    bands(L, ['#a8885a', '#a08050', '#987848', '#906e40', '#88663a', '#805e34', '#78562e']);
    for (let i = 0; i < 1600; i++) {
      const x = R() * FL_W, y = R() * FL_H, c = ['#6a4a28', '#b8986a', '#8a6a3a', '#5a3c20'][(R() * 4) | 0];
      P(x, y, c); if (depth(y) > 1.1) P(x + 1, y, c);
    }
    for (const ry of [0.36, 0.64]) {
      for (let x = 0; x < FL_W; x++) {
        const y = Math.round(ry * FL_H + Math.sin(x / 23) * 1.2 + Math.sin(x / 7) * 0.5), t = ry > 0.5 ? 2 : 1;
        P(x, y - 1, '#b8986a'); for (let k = 0; k < t; k++) P(x, y + k, '#5e4222');
      }
    }
    for (let i = 0; i < 30; i++) {                 // 균열
      let x = R() * FL_W, y = R() * FL_H;
      for (let k = 0; k < 5; k++) { const nx = x + (R() * 6 - 1) * depth(y), ny = y + (R() - 0.5) * 2; wline(P, x, y, nx, ny, '#5a3c1c'); x = nx; y = ny; }
    }
    pebbles(R, P, depth, 70, '#b8a27a', '#e0cca0', '#4a3418');
    tufts(R, P, depth, 110, ['#4a6a20', '#6a8a30', '#8aa040', '#a8c050']);
  },
  stage2(L, R, P, depth) {                         // 진흙의 야영지: 물웅덩이, 판자길, 지푸라기
    bands(L, ['#62523a', '#5c4c36', '#564632', '#50402e', '#4a3a2a', '#44362a', '#3e3226']);
    for (let i = 0; i < 260; i++) {
      const x = R() * FL_W, y = R() * FL_H, len = (3 + R() * 8) * depth(y);
      wline(P, x, y, x + len, y, R() < 0.5 ? '#6a5a40' : '#382c20');
    }
    for (let i = 0; i < 12; i++) {                 // 물웅덩이: 하늘이 비치는 수면 + 가장자리 반사광
      const cy = 4 + R() * (FL_H - 8), s = depth(cy), rx = (9 + R() * 16) * s, ry = Math.max(2, rx * 0.26), cx = R() * FL_W;
      for (let j = -ry; j <= ry; j++) {
        const hw = rx * Math.sqrt(Math.max(0, 1 - (j * j) / (ry * ry)));
        for (let x = -hw; x <= hw; x++) P(cx + x, cy + j, j < 0 ? '#5a7280' : '#3e4c56');
      }
      for (let x = -rx * 0.7; x < rx * 0.2; x++) P(cx + x, cy - ry + 1, '#a8c0c8');
      for (let x = -rx * 0.8; x <= rx * 0.8; x++) P(cx + x, cy + ry + 1, '#2e261c');
    }
    const y0 = Math.round(FL_H * 0.44), y1 = Math.round(FL_H * 0.6);   // 판자길
    for (let y = y0; y < y1; y++) for (let x = 0; x < FL_W; x++) P(x, y, y === y0 ? '#9a7448' : (y === y1 - 1 ? '#3a2616' : '#6a4a2c'));
    for (let x = 0; x < FL_W; x += 12) {
      wline(P, x, y0, x - 2, y1 - 1, '#3a2616');
      P(x + 3, y0 + 2, '#c0c0c8'); P(x + 3, y1 - 3, '#c0c0c8');
      for (let k = 0; k < 2; k++) { const gy = y0 + 2 + ((R() * (y1 - y0 - 4)) | 0); wline(P, x + 2, gy, x + 9, gy, '#7a5a38'); }
    }
    for (let i = 0; i < 160; i++) {
      const x = R() * FL_W, y = R() * FL_H, l = 2 + R() * 3;
      wline(P, x, y, x + l, y - l * (R() - 0.5), R() < 0.5 ? '#b8a860' : '#8a7a40');
    }
    pebbles(R, P, depth, 25, '#7a6a52', '#9a8a6a', '#2a2018');
    tufts(R, P, depth, 40, ['#3a4a20', '#4a5a28', '#5a6a30']);
  },
  stage3(L, R, P, depth) {                         // 불타는 성채: 원근이 들어간 석판 바닥 + 왕실 융단 + 그을음과 불티
    let y = 0, row = 0;
    while (y < FL_H) {
      const hh = Math.round(4 + 9 * (y / FL_H)), tw = Math.round(hh * 2.6), off = (row % 2) * tw / 2;
      for (let x = -off; x < FL_W; x += tw) {
        const c = ['#3e3846', '#443d4e', '#38323f', '#4a4254'][(R() * 4) | 0];
        for (let j = 0; j < hh; j++) for (let i = 0; i < tw; i++) {
          P(x + i, y + j, j === 0 || i === 0 ? '#5c5270' : (j === hh - 1 || i === tw - 1 ? '#1e1a24' : c));
        }
        if (R() < 0.25) wline(P, x + tw * 0.3, y + 1, x + tw * 0.5 + R() * 4, y + hh - 2, '#26202c');
      }
      y += hh; row++;
    }
    const c0 = Math.round(FL_H * 0.3), c1 = Math.round(FL_H * 0.5);   // 왕실 융단
    for (let yy = c0; yy < c1; yy++) for (let x = 0; x < FL_W; x++) {
      const edge = yy - c0 < 2 || c1 - yy <= 2;
      P(x, yy, edge ? (yy === c0 || yy === c1 - 1 ? '#5a4210' : '#c9a24a') : ((x + yy * 2) % 14 < 2 ? '#a02838' : '#7a1a2a'));
    }
    for (let x = 0; x < FL_W; x += 14) {
      const my = (c0 + c1) >> 1;
      P(x, my, '#e8c86a'); P(x - 1, my, '#c9a24a'); P(x + 1, my, '#c9a24a'); P(x, my - 1, '#c9a24a'); P(x, my + 1, '#c9a24a');
    }
    for (let i = 0; i < 14; i++) {                 // 그을음
      const cy = R() * FL_H, cx = R() * FL_W, r = (3 + R() * 5) * depth(cy);
      for (let j = -r * 0.35; j <= r * 0.35; j++) for (let x = -r; x <= r; x++) if (R() < 0.6) P(cx + x, cy + j, '#241c22', 0.6);
    }
    for (let i = 0; i < 60; i++) P(R() * FL_W, R() * FL_H, R() < 0.5 ? '#ff7a1a' : '#ffd23a');
  },
};
function bands(L, cols) {                          // 위(먼 쪽)에서 아래로 색 띠, 경계는 격자 무늬로 섞는다
  const n = cols.length;
  for (let y = 0; y < FL_H; y++) {
    const f = y / FL_H * n, i = Math.min(n - 1, f | 0), frac = f - i;
    for (let x = 0; x < FL_W; x++) L.put(x, y, frac > 0.75 && i < n - 1 && ((x + y) & 1) ? cols[i + 1] : cols[i]);
  }
}
function wline(P, x0, y0, x1, y1, c) {
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
  for (let i = 0; i <= n; i++) P(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n, c);
}
function pebbles(R, P, depth, n, c, hi, sh) {
  for (let i = 0; i < n; i++) {
    const y = R() * FL_H, x = R() * FL_W, r = Math.max(1, Math.round(1.3 * depth(y)));
    for (let j = -r; j <= r; j++) for (let k = -r; k <= r; k++) if (j * j + k * k <= r * r) P(x + k + 1, y + j + 1, sh);
    for (let j = -r; j <= r; j++) for (let k = -r; k <= r; k++) if (j * j + k * k <= r * r) P(x + k, y + j, c);
    P(x - r / 2, y - r / 2, hi);
  }
}
function tufts(R, P, depth, n, cols) {
  for (let i = 0; i < n; i++) {
    const y = R() < 0.4 ? R() * FL_H * 0.22 : R() * FL_H, x = R() * FL_W, s = depth(y), blades = 3 + ((R() * 3) | 0);
    for (let b = 0; b < blades; b++) {
      const bx = x + (b - blades / 2) * s * 1.1, h = (2 + R() * 3) * s;
      wline(P, bx, y, bx + (R() - 0.5) * 2.5 * s, y - h, cols[(R() * cols.length) | 0]);
    }
  }
}
function floorImage(theme) {
  if (floorCache[theme]) return floorCache[theme];
  const L = new Layer(FL_W, FL_H), R = srng(theme.charCodeAt(5) * 7919 + 17);
  const P = (x, y, c, a) => L.put((((Math.round(x) % FL_W) + FL_W) % FL_W), y, c, a);
  FLOOR_FN[theme](L, R, P, y => 0.55 + 0.9 * y / FL_H);
  for (let y = 0; y < 3; y++) for (let x = 0; x < FL_W; x++) {   // 윗 가장자리는 듬성듬성 지워 원경과 자연스럽게 잇는다
    if ((y === 0 && (x & 3)) || (y === 1 && ((x + y) & 1)) || (y === 2 && !((x + 1) & 3))) L.d[(y * FL_W + x) * 4 + 3] = 0;
  }
  const c = document.createElement('canvas'); c.width = FL_W; c.height = FL_H;
  c.getContext('2d').putImageData(new ImageData(L.d, FL_W, FL_H), 0, 0);
  return (floorCache[theme] = c);
}
function drawFloor(theme) {                        // 월드 좌표에서 호출
  const img = floorImage(theme), tw = FL_W * SC, first = Math.floor(camX / tw);
  ctx.imageSmoothingEnabled = false;
  for (let k = first; k * tw - camX < VW; k++) {   // 홀수 칸은 좌우로 뒤집어 반복이 덜 보이게
    const x = k * tw - camX;
    if (k % 2) { ctx.save(); ctx.translate(x + tw, 0); ctx.scale(-1, 1); ctx.drawImage(img, 0, FL_TOP, tw, FL_H * SC); ctx.restore(); }
    else ctx.drawImage(img, x, FL_TOP, tw, FL_H * SC);
  }
  const g = ctx.createLinearGradient(0, FL_TOP, 0, FL_TOP + 40);   // 지평선 쪽은 살짝 어둡게
  g.addColorStop(0, 'rgba(10,6,20,.35)'); g.addColorStop(1, 'rgba(10,6,20,0)');
  ctx.fillStyle = g; rect(0, FL_TOP, VW, 40);
}

// ---------------------------------------------------------------- 캐릭터: 픽셀 버퍼에 합성한 뒤 확대해 찍는다
// 버퍼에는 무기와 궤적이 들어갈 여백을 둔다 (좌우 PADX, 위 PADT, 아래 PADB)
const PADX = 64, PADT = 60, PADB = 24;
const layerPool = {};
function layerFor(w, h) {
  const k = w + 'x' + h; let o = layerPool[k];
  if (!o) { const L = new Layer(w, h); o = layerPool[k] = { L, img: new ImageData(L.d, w, h) }; } else o.L.clear();
  return o;
}
const scratch = document.createElement('canvas'); scratch.width = 256; scratch.height = 224;
const sctx = scratch.getContext('2d');

// 피규어 1체를 버퍼에 그린다. pose 가 있으면 몸통+팔+무기 합성, 없으면 스프라이트만 (잡몹/잔상)
// o = { f, lean(앞 +), leanW(월드 방향), crouch, dx, dy(도트), flash, wash, washA, noWeapon, swing(잡몹 궤적 반지름), eyes }
function figure(id, face, pose, o) {
  const S = SPRITES[id], P = layerFor(S.w + PADX * 2, S.h + PADT + PADB), L = P.L;
  const cx = L.w / 2 + Math.round(o.dx || 0), top = PADT + Math.round((o.dy || 0) + (pose ? (pose.jy || 0) + (pose.dy || 0) : 0));
  let res = null;
  if (pose && FIG[id]) res = drawFigure(L, id, cx, top, face, pose, o);
  else blit(sprite(id, o.f), L, cx - S.w / 2, top, { flip: face < 0, lean: (o.lean || 0) * face + (o.leanW || 0), crouch: o.crouch,
    split: S.h - 14, flash: o.flash, wash: o.wash, washA: o.washA });
  shade(L);                                        // 하이라이트·그늘·색 외곽선 (팔과 무기까지 한 덩어리로)
  if (res) drawTrail(L, res.trail);
  if (o.swing) crescent(L, cx + face * 8, top + 22, o.swing, face > 0 ? 115 : 65, face > 0 ? -40 : 220, ['#ffffff', '#bfd4ff', '#7f98d8']);
  if (o.eyes && pose) {                            // 필살기 중 투구 속 붉은 눈빛
    const sh = Math.round((pose.lean || 0) * face * Math.pow(1 - 12 / 47, 1.2)), ex = cx - 20 + (face > 0 ? 25 : 14) + sh;
    const ey = top + 12 + Math.round(pose.crouch || 0);
    L.put(ex, ey, '#ff3a4a'); L.put(ex + face, ey, '#ff7a88');
  }
  return { P, ax: L.w / 2, ay: PADT + S.gy, res };
}
// 버퍼를 발밑 기준점 (sx, sy) 에 찍는다. lying: 뒤로 눕힌다
function present(F, sx, sy, alpha, lying, face, gy) {
  const L = F.P.L;
  sctx.putImageData(F.P.img, 0, 0);
  ctx.save(); ctx.imageSmoothingEnabled = false;
  if (alpha < 1) ctx.globalAlpha = Math.max(0, alpha);
  ctx.translate(Math.round(sx), Math.round(sy));
  if (lying) { ctx.scale(face, 1); ctx.translate(gy * SC * 0.5, -8); ctx.rotate(-Math.PI / 2); ctx.scale(face, 1); }
  ctx.drawImage(scratch, 0, 0, L.w, L.h, -F.ax * SC, -F.ay * SC, L.w * SC, L.h * SC);
  ctx.restore();
}
function drawShadow(sx, y, sh, z) {
  ctx.fillStyle = 'rgba(0,0,0,.35)';
  ctx.beginPath(); ctx.ellipse(sx, y, sh * SC * (1 - Math.min(z, 150) / 300), 6 * SC * 0.7, 0, 0, Math.PI * 2); ctx.fill();
}
function idleFrame(walk) { return Math.floor(tick / (walk ? 10 : 30)) % 2; }

function playerPose(lying) {
  const p = player, t = p.t * MS;
  switch (p.st) {
    case 'atk':
      if (p.atk === 'air') {                       // 공중 내려찍기
        const r = mixP(HR, { ang: -50, hx: 10, hy: 6, lean: 6, crouch: 0 }, ease(t / 90));
        r.arc = [130, r.ang]; r.arcR = 22; return r;
      }
      return heroAtk(p.combo, t);
    case 'special': return heroSpecial(t);
    case 'dash': return mixP(HR, { ang: 15, hx: 9, hy: 3, lean: 7, crouch: 1 }, ease(Math.min(1, t / 80)));
    case 'hurt': { const a = Math.max(0, 1 - p.t / 16); return { ang: 205, hx: -2, hy: 9, lean: -6.3 * a, crouch: 2.1 * a }; }
    case 'down': case 'dead':
      return lying ? { ang: 235, hx: -2, hy: 12, lean: -12, crouch: 5 } : { ang: 205, hx: -2, hy: 9, lean: -9, crouch: 3 };
    default:
      if (p.z > 0) return { ang: 100, hx: 2, hy: 3, lean: 1, crouch: 0 };
      return { ang: 68, hx: 4, hy: 9, lean: p.walk ? 2 : 0, crouch: p.walk && Math.floor(tick * MS / 130) % 2 ? 1 : 0 };
  }
}
function drawPlayer() {
  const p = player, S = SPRITES.player, sx = p.x - camX, sp = p.st === 'special';
  drawShadow(sx, p.y, S.sh, p.z);
  if (p.inv > 0 && p.st === 'free' && Math.floor(tick / 4) % 2) return;
  if (p.buff > 0) {                                // 파워업 오라
    const Hh = S.gy * SC;
    ctx.globalAlpha = 0.35 + 0.15 * Math.sin(tick * 0.3); ctx.fillStyle = '#ffd23f';
    ctx.beginPath(); ctx.ellipse(sx, p.y - p.z - Hh * 0.5, S.sh * SC * 1.5, Hh * 0.58, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
  }
  const lying = (p.st === 'down' && p.z === 0 && p.t > 8) || (p.st === 'dead' && p.z === 0);
  const pose = playerPose(lying);
  const F = figure('player', p.face, pose, {
    f: p.st === 'free' && !p.walk ? idleFrame(false) : 0,
    wash: p.flash > 0 ? '#ffffff' : (sp ? '#ff3a4a' : null), washA: p.flash > 0 ? 0.75 : 0.3,
    eyes: sp && p.t * MS < 1500 });
  const bob = p.walk && p.z === 0 && p.st === 'free' ? -Math.abs(Math.sin(tick * 0.3)) * 3 : 0;
  present(F, sx, p.y - p.z + bob, 1, lying, p.face, S.gy);
}

function drawEnemy(e) {
  const d = e.d, S = SPRITES[d.sprite], sx = e.x - camX;
  drawShadow(sx, e.y, S.sh, e.z);
  if (e.st === 'dead' && !e.boss && e.t > 35 && Math.floor(tick / 4) % 2) return;
  const lying = !(e.boss && e.st === 'dead') && (e.st === 'down' || e.st === 'dead') && e.z === 0;
  const o = { f: idleFrame(e.walk), dx: 0 };
  let pose = null, alpha = 1;
  // 피격 반동: 맞은 쪽 반대로 꺾였다가 흔들리며 돌아오고, 잠깐 무릎이 굽는다
  if (e.hr < 600 && e.st !== 'dead') {
    const osc = Math.cos(e.hr * 0.03) * Math.exp(-e.hr / 200);
    o.leanW = e.hdir * (e.hheavy ? 8 : 4.5) * osc; o.dx = e.hdir * (e.hheavy ? 3 : 1.5) * Math.exp(-e.hr / 160);
    if (e.hr < 130) o.crouch = e.hheavy ? 2 : 1;
  }
  if (e.flash > 0) { o.wash = '#ffffff'; o.washA = 0.7; }
  if (e.boss) {
    const id = d.sprite;
    pose = mixP(BR[id], BR[id], 0);
    if (e.st === 'pat') {
      pose = bossPoseAt(id, e.pat, e.pt, phase2(e));
      o.dx += e.bdx * e.face; o.dy = e.bdy; alpha = e.alpha;
      if (e.wash && !o.wash) { o.wash = e.wash; o.washA = 0.5; }
      if (alpha < 0.6) o.noWeapon = true;
    } else if (e.st === 'stun') {                  // 기절: 무기를 떨군 채 비틀거림
      o.leanW = (o.leanW || 0) + Math.sin(tick * MS * 0.012) * 2.5 - e.face * 2; o.crouch = Math.max(o.crouch || 0, 1);
      pose = mixP(BR[id], { ang: -25, hx: 3, hy: 11, lean: -2 }, 1);
    } else if (e.st === 'dead') {                  // 쓰러짐: 하얗게 깜빡이며 무너지고 사라진다
      const t = e.t * MS;
      o.leanW = e.hdir * Math.min(14, t * 0.012); o.crouch = Math.min(6, Math.round(t * 0.006));
      pose = mixP(BR[id], { ang: -35, hx: 2, hy: 11, lean: -3 }, 1);
      alpha = t < 900 ? 1 : Math.max(0, 1 - (t - 900) / 900);
      if (t < 900 && Math.floor(t / 70) % 2 === 0) { o.wash = '#ffffff'; o.washA = 0.7; }
    } else if (e.st === 'down') pose = mixP(BR[id], { ang: -35, hx: 2, hy: 11, lean: -3 }, 1);
  } else {
    if (e.st === 'hurt' || ((e.st === 'down' || e.st === 'dead') && !lying)) o.lean = -5;
    if (e.st === 'wind') {                         // 공격 예고: 뒤로 젖히며 번쩍
      const k = Math.min(1, e.t / 12);
      o.lean = -6 * k; o.dx -= 3.5 * k * e.face;
      if (e.t > 6 && Math.floor(e.t / 4) % 2) { o.wash = '#ffffff'; o.washA = 0.6; }
    }
    if (e.st === 'act' && e.pat === 'swing') { o.f = 1; o.lean = 6; o.dx += 7 * e.face; o.swing = Math.round(d.range * 0.3); }
  }
  const bob = e.walk && e.z === 0 ? -Math.abs(Math.sin(tick * 0.3 + e.id)) * 3 : 0;
  const F = figure(d.sprite, e.face, pose, o);
  if (F.res) { e.tipX = e.x + (F.res.tip[0] - F.ax) * SC; e.tipH = e.z - bob + (F.ay - F.res.tip[1]) * SC; }   // 지팡이 끝 = 탄막 발사 위치
  present(F, sx, e.y - e.z + bob, alpha, lying, e.face, S.gy);
}
function drawGhost(g) {
  const F = figure(g.id, g.face, null, { lean: g.id === 'player' ? 6 : 7, wash: g.wash, washA: 0.55 });
  present(F, g.x - camX, g.y - g.z, (g.id === 'player' ? 0.4 : 0.35) * (1 - g.age / g.life), false, g.face, 0);
}

// ---------------------------------------------------------------- 이펙트 레이어 (보이는 월드를 도트 1칸 해상도로)
const FXW = VW / SC, FXH = VH / SC;
const fxCanvas = document.createElement('canvas'); fxCanvas.width = FXW; fxCanvas.height = FXH;
const fxCtx = fxCanvas.getContext('2d');
function mkFx() { const L = new Layer(FXW, FXH); return { L, img: new ImageData(L.d, FXW, FXH) }; }
const fxGround = mkFx(), fxTop = mkFx();       // 캐릭터 뒤(바닥 표식·충격파) / 캐릭터 앞(투사체·적중 이펙트)
const fxX = x => (x - camX) / SC, fxY = (y, h) => (y - (h || 0) - OY) / SC;
function presentFx(F) { fxCtx.putImageData(F.img, 0, 0); ctx.imageSmoothingEnabled = false; ctx.drawImage(fxCanvas, 0, OY, VW, VH); }

function drawGroundFx(L) {
  for (const z of hazards) {
    if (z.type === 'shock') shockwave(L, fxX(z.x + z.dir * z.age * 0.32), z.age, z.dir, fxY(z.y));
    else if (z.type === 'pillar' && z.age < z.delay) warn(L, fxX(z.x), 22, z.age, fxY(z.y));
  }
  for (const e of enemies) if (e.st === 'pat' && e.pat === 'slam' && e.pt < 650) warn(L, fxX(e.x), 70, e.pt, fxY(e.y));
}
function drawTopFx(L) {
  for (const z of hazards) {
    const x = fxX(z.x);
    if (z.type === 'orb') orb(L, x, fxY(z.y, z.h), z.vx, z.vy - z.vh, z.age);
    else if (z.type === 'wave') goldWave(L, x, fxY(z.y, z.h), z.dir);
    else if (z.type === 'raven') blit(spriteShaded('raven', Math.floor(z.age / 90) % 2), L, x - 7, fxY(z.y, z.h) - 4, { flip: z.st === 'dive' ? z.vx < 0 : z.x > player.x });
    else if (z.type === 'pillar' && z.age >= z.delay) pillar(L, x, z.age, (z.age - z.delay) / z.life, fxY(z.y));
    else if (z.type === 'ring') teleportRing(L, x, fxY(z.y, z.h), z.age / 420);
    else if (z.type === 'pwave') {
      const y = fxY(z.y, z.h);
      for (let k = 0; k < 3; k++) L.arc(x - z.dir * k * 4, y, 11, (z.dir > 0 ? -58 : 122) * RAD, (z.dir > 0 ? 58 : 238) * RAD, k ? '#7f98d8' : '#ffffff', 2, 1 - k * 0.25);
    }
  }
  for (const e of enemies) {                       // 황금왕 2페이즈: 왕관에서 불티
    if (e.type === 'boss3' && phase2(e) && e.st !== 'dead')
      for (let i = 0; i < 5; i++) L.put(fxX(e.x) + (Math.random() - 0.5) * 16, fxY(e.y, e.z + 138) - Math.random() * 12, Math.random() < 0.5 ? '#ffd23a' : '#ff7a1a');
  }
  const p = player;
  if (p.st === 'special') {
    const sp = p.t * MS, f = p.face, px = fxX(p.x), py = fxY(p.y, p.z);
    if (sp < 640) aura(L, px, py - 2, sp, '#ff3a4a', '#ff9aa6');
    if (sp >= 450 && sp < 620 && Math.floor(sp / 24) % 2 === 0) {
      for (let i = 0; i < 4; i++) L.line(px - f * (12 + i * 5), py - 34 + i * 8, px - f * (26 + i * 7), py - 34 + i * 8, '#ff9aa6');
    }
    const cx = fxX(p.spX), cy = fxY(p.spY, 68), AN = [-40, 40, 0, -18];
    for (let k = 0; k < 4; k++) {                  // 4연 베기의 붉은 베기 선
      const age = sp - (700 + k * 160), u = Math.cos(AN[k] * RAD) * f, v = Math.sin(AN[k] * RAD);
      if (age >= 0 && age <= 220) slashLine(L, cx - u * 30, cy + v * 30, cx + u * 30, cy - v * 30, Math.min(1, age / 50));
    }
    if (sp >= 1570 && sp < 1950) moon(L, cx, cy, Math.round(lerp(8, 32, ease((sp - 1570) / 220))), (sp - 1570) / 380, f < 0);
  }
  for (const a of impacts) impactFx(L, fxX(a.x), fxY(a.y, a.z), a.age, a.kind, a.dir, a.seed);
  for (const s of bursts) sparkBurst(L, fxX(s.x), fxY(s.y, s.z), s.age, s.seed, s.cols);
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

function outlineText(txt, x, y, col = '#fff', font = 'bold 14px sans-serif', align = 'center') {
  ctx.font = font; ctx.textAlign = align; ctx.lineWidth = 3; ctx.strokeStyle = '#000'; ctx.strokeText(txt, x, y);
  ctx.fillStyle = col; ctx.fillText(txt, x, y);
}

// ---------------------------------------------------------------- HUD (아케이드 패널)
// 금테 패널 + 초상화 + 체력바(최근 피해만큼 붉은 잔상이 남았다가 줄어듦) + 타깃 표시
const PIX = '"Press Start 2P", "Courier New", monospace';
if (document.fonts) document.fonts.load(`10px ${PIX}`).catch(() => {});
const PORTRAIT = { player: [6, 0, 28, 24], boss1: [14, 0, 36, 27], boss2: [13, 0, 33, 27], boss3: [20, 0, 31, 27] };   // 머리 부분 (x, y, w, h)
const portraitCache = {};
function portrait(id) {
  if (portraitCache[id]) return portraitCache[id];
  const [sx, sy, w, h] = PORTRAIT[id], src = sprite(id, 0), L = new Layer(w + 2, h + 2);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = ((sy + y) * src.w + sx + x) * 4, j = ((y + 1) * L.w + x + 1) * 4;
    for (let k = 0; k < 4; k++) L.d[j + k] = src.d[i + k];
  }
  shade(L);
  const c = document.createElement('canvas'); c.width = L.w; c.height = L.h;
  c.getContext('2d').putImageData(new ImageData(L.d, L.w, L.h), 0, 0);
  return (portraitCache[id] = c);
}
function panel(x, y, w, h) {
  ctx.fillStyle = '#000'; rect(x - 4, y - 4, w + 8, h + 8);
  ctx.fillStyle = '#8a6a1c'; rect(x - 3, y - 3, w + 6, h + 6);
  ctx.fillStyle = '#f3d26a'; rect(x - 3, y - 3, w + 6, 1); rect(x - 3, y - 3, 1, h + 6);
  ctx.fillStyle = '#3a2a08'; rect(x - 1, y - 1, w + 2, h + 2);
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, 'rgba(46,36,80,.94)'); g.addColorStop(1, 'rgba(12,9,26,.94)');
  ctx.fillStyle = g; rect(x, y, w, h);
  ctx.fillStyle = 'rgba(255,255,255,.07)'; rect(x, y, w, 2);
  for (const [cx, cy] of [[x - 3, y - 3], [x + w - 2, y - 3], [x - 3, y + h - 2], [x + w - 2, y + h - 2]]) {   // 모서리 리벳
    ctx.fillStyle = '#f3d26a'; rect(cx, cy, 5, 5); ctx.fillStyle = '#5a4210'; rect(cx + 2, cy + 2, 3, 3);
  }
}
function pxText(txt, x, y, col, size, align = 'left') {
  ctx.font = `${size}px ${PIX}`; ctx.textAlign = align;
  ctx.fillStyle = '#000'; ctx.fillText(txt, x + 2, y + 2);
  ctx.fillStyle = col; ctx.fillText(txt, x, y);
}
function krText(txt, x, y, col, size, align = 'left', stroke = '#000') {
  ctx.font = `bold ${size}px 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif`; ctx.textAlign = align;
  ctx.lineWidth = 4; ctx.strokeStyle = stroke; ctx.strokeText(txt, x, y);
  ctx.fillStyle = col; ctx.fillText(txt, x, y);
}
const hpCols = r => r > 0.5 ? ['#d8ff7a', '#3a9a2a'] : r > 0.25 ? ['#fff07a', '#c08a10'] : ['#ffa07a', '#b0201a'];
function lifeBar(x, y, w, h, r, lag, cols) {
  ctx.fillStyle = '#000'; rect(x - 2, y - 2, w + 4, h + 4);
  ctx.fillStyle = '#2a0c14'; rect(x, y, w, h);
  ctx.fillStyle = '#e8303a'; rect(x, y, Math.round(w * clamp(lag, 0, 1)), h);
  const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, cols[0]); g.addColorStop(1, cols[1]);
  ctx.fillStyle = g; rect(x, y, Math.round(w * clamp(r, 0, 1)), h);
  ctx.fillStyle = 'rgba(255,255,255,.4)'; rect(x, y, Math.round(w * clamp(r, 0, 1)), Math.max(1, h >> 2));
  ctx.fillStyle = 'rgba(0,0,0,.45)'; for (let i = 1; i < 10; i++) rect(x + Math.round(w * i / 10), y, 1, h);
}
function lagTo(o, key, v, rate) { o[key] = o[key] === undefined || o[key] < v ? v : Math.max(v, o[key] - rate); return o[key]; }
function drawPortrait(id, x, y, w, h, flip, glow) {
  ctx.fillStyle = glow ? (Math.floor(tick / 6) % 2 ? '#ffe14d' : '#c9a24a') : '#c9a24a'; rect(x - 2, y - 2, w + 4, h + 4);
  const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#6a2a3a'); g.addColorStop(1, '#160a16');
  ctx.fillStyle = g; rect(x, y, w, h);
  const img = portrait(id), s = Math.max(1, Math.floor(Math.min(w / img.width, h / img.height)));
  const dw = img.width * s, dh = img.height * s, dx = Math.round(x + (w - dw) / 2), dy = y + h - dh;
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip(); ctx.imageSmoothingEnabled = false;
  if (flip) { ctx.translate(dx + dw, dy); ctx.scale(-1, 1); ctx.drawImage(img, 0, 0, dw, dh); } else ctx.drawImage(img, dx, dy, dw, dh);
  ctx.restore();
}

function drawHUD() {
  const p = player;
  // ---- 흑기사 패널 (왼쪽)
  panel(14, 12, 328, 88);
  drawPortrait('player', 22, 20, 64, 56, false, p.buff > 0);
  if (p.buff > 0) { ctx.fillStyle = '#000'; rect(21, 82, 66, 8); ctx.fillStyle = '#ffe14d'; rect(22, 83, 64 * p.buff / 900, 6); }
  pxText('BLACK KNIGHT', 96, 30, '#f3d26a', 9);
  pxText(`L-${stageIdx + 1}`, 334, 30, '#9cc3ff', 9, 'right');
  krText('흑기사', 96, 51, '#ffffff', 15);
  for (let i = 0; i < p.lives; i++) {                // 남은 목숨: 붉은 깃털 투구
    const x = 160 + i * 16, y = 39;
    ctx.fillStyle = '#000'; rect(x - 1, y - 1, 12, 13);
    ctx.fillStyle = '#4a4a62'; rect(x, y + 3, 10, 9); ctx.fillStyle = '#ff3a4a'; rect(x + 2, y + 7, 6, 1);
    ctx.fillStyle = '#b3202a'; rect(x + 3, y, 5, 4);
  }
  pxText(String(p.score).padStart(7, '0'), 334, 51, '#ffffff', 10, 'right');
  lifeBar(96, 60, 238, 12, p.hp / p.max, lagTo(p, 'hpLag', p.hp, 0.5) / p.max, hpCols(p.hp / p.max));
  pxText(String(Math.max(0, p.hp)), 330, 71, '#ffffff', 8, 'right');
  const spFull = p.sp >= SP_MAX;
  ctx.fillStyle = '#000'; rect(94, 78, 242, 10);
  const sg = ctx.createLinearGradient(96, 0, 334, 0); sg.addColorStop(0, '#2a6aff'); sg.addColorStop(1, spFull ? '#ff5a7a' : '#7ad8ff');
  ctx.fillStyle = '#0a1430'; rect(96, 80, 238, 6);
  ctx.fillStyle = spFull && Math.floor(tick / 6) % 2 ? '#fff6c8' : sg; rect(96, 80, 238 * p.sp / SP_MAX, 6);
  if (spFull) pxText('K:흑월참', 334, 96, '#ffe14d', 8, 'right'); else pxText('SP', 96, 96, '#7ad8ff', 7);

  // ---- 스테이지 패널 (오른쪽)
  panel(722, 12, 224, 50);
  pxText(stage.name, 732, 32, '#f3d26a', 10);
  krText(stage.title, 732, 54, '#ffffff', 14);
  pxText(`x${enemies.filter(e => e.st !== 'dead').length}`, 938, 32, '#ff9aa6', 9, 'right');   // 남은 적

  // ---- 보스 패널 (가운데) / 아니면 최근에 때린 적 이름과 체력 (레퍼런스의 "Goblin" 표시)
  const boss = enemies.find(e => e.boss && (e.st !== 'dead' || e.t < 60));
  if (boss) {
    panel(356, 12, 352, 88);
    drawPortrait(boss.d.sprite, 364, 20, 80, 60, true, boss.st === 'stun');
    krText(boss.d.name, 454, 36, '#ffb0a0', 15, 'left', '#2a0008');
    lifeBar(454, 44, 246, 12, boss.hp / boss.max, lagTo(boss, 'hpLag', boss.hp, boss.max * 0.004) / boss.max, ['#ff7a6a', '#b0101a']);
    ctx.fillStyle = 'rgba(255,255,255,.7)';
    for (const f of [0.25, 0.5, 0.75]) rect(454 + Math.round(246 * f), 42, 1, 16);        // 다운 구간 눈금
    if (boss.st !== 'dead') {
      // 그로기 게이지 (가득 차면 5초 기절, 기절 중에는 남은 시간이 줄어든다)
      const stun = boss.st === 'stun', r = stun ? 1 - boss.t / GROGGY_TICKS : boss.gr / boss.grMax;
      ctx.fillStyle = '#000'; rect(452, 62, 250, 9); ctx.fillStyle = '#2a1a04'; rect(454, 64, 246, 5);
      ctx.fillStyle = stun ? (Math.floor(tick / 6) % 2 ? '#ffe14d' : '#ff9800') : '#ffb300'; rect(454, 64, 246 * r, 5);
      if (stun) krText(`기절 ${((GROGGY_TICKS - boss.t) / 60).toFixed(1)}초 · 받는 피해 x1.5`, 454, 90, '#ffe14d', 12);
      else if (boss.st === 'pat') krText(boss.d.pats[boss.pat], 454, 90, '#ff9aa6', 13);   // 사용 중인 기술 이름
      else pxText('GROGGY', 454, 88, '#c9a24a', 7);
    }
  } else if (target && target.t > 0 && enemies.includes(target.e)) {
    const e = target.e, a = Math.min(1, target.t / 20);
    ctx.globalAlpha = a;
    krText(e.d.name, W / 2, 36, '#ffffff', 16, 'center', '#1a3a8a');
    lifeBar(W / 2 - 70, 44, 140, 7, e.hp / e.max, lagTo(e, 'hpLag', e.hp, e.max * 0.01) / e.max, ['#fff07a', '#d08a10']);
    ctx.globalAlpha = 1;
  }

  // GO 화살표
  if (goT > 0 && Math.floor(tick / 20) % 2 === 0) { krText('GO', W - 120, H / 2 - 30, '#ffd23f', 40); krText('➜', W - 60, H / 2 - 30, '#ffd23f', 40); }
}

function drawEnemyOverlay(e) {                     // 월드 좌표: 기절 별, 공격 예고 !
  if (e.st === 'dead') return;
  const h = e.d.h * e.d.s, sx = e.x - camX, top = e.y - e.z - h;
  if (e.st === 'stun') {
    for (let i = 0; i < 4; i++) {
      const a = tick * 0.12 + i * Math.PI / 2;
      ctx.fillStyle = '#ffe14d'; circle(sx + Math.cos(a) * 34, top + 8 + Math.sin(a) * 9, 5);
    }
  }
  const warnNow = (e.st === 'wind' && e.t > 2) || (e.st === 'pat' && e.pt < (TELE[e.pat] || 0) && Math.floor(e.pt / 110) % 2 === 0);
  if (warnNow) outlineText('!', sx, top - (e.boss ? 24 : 28), '#ff3d3d', 'bold 26px sans-serif');
}

// 화면 가장자리를 살짝 어둡게 (아케이드 모니터 느낌)
let vignette = null;
function drawVignette() {
  if (!vignette) {
    vignette = ctx.createRadialGradient(W / 2, H * 0.55, H * 0.4, W / 2, H * 0.55, W * 0.72);
    vignette.addColorStop(0, 'rgba(0,0,0,0)'); vignette.addColorStop(1, 'rgba(0,0,0,.38)');
  }
  ctx.fillStyle = vignette; rect(0, 0, W, H);
}

function render() {
  const theme = stage ? stage.theme : 'stage1';
  ctx.save();
  if (shake > 0.5) ctx.translate(rand(-shake, shake) * 0.6, rand(-shake, shake) * 0.6);
  drawBackdrop(theme, camX * Z);
  ctx.save(); ctx.scale(Z, Z); ctx.translate(0, -OY);         // ↓ 월드 좌표 (1.5배 줌)
  drawFloor(theme);
  if (stage) {
    fxGround.L.clear(); drawGroundFx(fxGround.L); presentFx(fxGround);
    const sp = player.st === 'special' ? player.t * MS : -1;
    // y 순서로 정렬해서 그린다 (필살기 중에는 흑기사와 그 잔상만 어둠 위에 따로 그림)
    const list = [];
    barrels.forEach(b => list.push({ y: b.y, f: () => drawBarrel(b) }));
    items.forEach(i => list.push({ y: i.y, f: () => drawItem(i) }));
    enemies.forEach(e => list.push({ y: e.y, f: () => drawEnemy(e) }));
    ghosts.forEach(g => { if (sp < 0 || g.id !== 'player') list.push({ y: g.y - 0.5, f: () => drawGhost(g) }); });
    if (sp < 0) list.push({ y: player.y, f: drawPlayer });
    list.sort((a, b) => a.y - b.y).forEach(l => l.f());
    if (sp >= 0) {                                 // 흑월참: 배경과 적을 어둡게
      const k = sp < 200 ? 1 - 0.65 * (sp / 200) : (sp > 1900 ? 0.35 + 0.65 * ((sp - 1900) / 200) : 0.35);
      ctx.fillStyle = `rgba(16,2,8,${(1 - k).toFixed(3)})`; rect(-40, OY - 40, VW + 80, VH + 80);
      ghosts.forEach(g => { if (g.id === 'player') drawGhost(g); });
      drawPlayer();
    }

    for (const q of parts) { ctx.fillStyle = q.col; rect(q.x - camX - 2, q.y - q.z - 2, 4, 4); }
    fxTop.L.clear(); drawTopFx(fxTop.L); presentFx(fxTop);
    enemies.forEach(drawEnemyOverlay);
    for (const t of texts) outlineText(String(t.txt), t.x - camX, t.y, t.col, 'bold 16px sans-serif');
  }
  ctx.restore();
  drawVignette();
  ctx.restore();
  if (flashT > 0) { ctx.fillStyle = `rgba(255,255,255,${Math.min(0.9, flashT / 220 * 0.9).toFixed(3)})`; rect(0, 0, W, H); }
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
  camX = tick * 1.2;
  const theme = ['stage1', 'stage2', 'stage3'][Math.floor(tick / 600) % 3];
  drawBackdrop(theme, camX * Z);
  ctx.save(); ctx.scale(Z, Z); ctx.translate(0, -OY); drawFloor(theme); ctx.restore();
  drawVignette();
}

// ---------------------------------------------------------------- 루프
let last = 0, acc = 0;
function loop(t) {
  acc += Math.min(100, t - last); last = t;
  while (acc >= MS) { update(); acc -= MS; for (const k in pressed) delete pressed[k]; }
  if (scene === 'title' || scene === 'tutorial') { ctx.clearRect(0, 0, W, H); const sv = stage; renderIdle(); stage = sv; }
  else render();
  requestAnimationFrame(loop);
}
requestAnimationFrame(t => { last = t; loop(t); });
