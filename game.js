'use strict';
// =====================================================================
//  흑월의 기사 (BLACK MOON KNIGHT) - 벨트스크롤 액션 (Canvas)
// =====================================================================
const cv = document.getElementById('c');
const ctx = cv.getContext('2d');
const W = 960, H = 540;
// 캔버스 실제 픽셀은 화면 크기에 맞춘다 (게임 좌표는 그대로 960x540). 4K에서 과부하 없게 최대 3배
let RENDER_K = 1;
function fitCanvas() {
  RENDER_K = clamp((cv.clientWidth || W) * (window.devicePixelRatio || 1) / W, 1, 3);
  cv.width = Math.round(W * RENDER_K); cv.height = Math.round(H * RENDER_K);
}
addEventListener('resize', fitCanvas);
// 스프라이트 보간: 화면에서 2배 이상 커지면 도트를 또렷하게(nearest), 그보다 작으면 고품질로 부드럽게 줄인다.
// k = 그릴 크기 / 원본 픽셀 크기. 현재 변환(줌, 해상도 배율)까지 곱해서 판단한다
function smoothFor(k, c = ctx) {
  const m = c.getTransform();
  c.imageSmoothingEnabled = Math.hypot(m.a, m.b) * Math.abs(k) < 2; c.imageSmoothingQuality = 'high';
}
const GTOP = 340, GBOT = 500;          // 걸어 다닐 수 있는 바닥 영역(깊이)
const MS = 1000 / 60;                  // 1틱(60fps) = 16.7ms. 공격 모션은 ms 단위로 만든다
const SC = 2;                          // 도트 1칸 = 월드 2px
const BOSS_VISUAL_SCALE = .85;         // Boss art only: smaller pixels, unchanged combat rules.
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
const hit = (...c) => {
  if (!c.some(k => pressed[k] > 0)) return false;
  c.forEach(k => delete pressed[k]); return true;
};
const JUMP_KEYS = ['Space', 'ControlLeft', 'ControlRight'];
// 같은 방향키를 0.25초(15틱) 안에 두 번 누르면 대시
const TAP_DIR = { ArrowLeft: -1, KeyA: -1, ArrowRight: 1, KeyD: 1 };
let lastTap = { dir: 0, t: -99 }, dashReq = 0;
function clearInput() {
  for (const k in keys) delete keys[k];
  for (const k in pressed) delete pressed[k];
  lastTap = { dir: 0, t: -99 }; dashReq = 0; UX.clearTouch();
  document.querySelectorAll('.cap.on').forEach(c => c.classList.remove('on'));
}
function inputDown(code) {
  if (!code || keys[code]) return;
  onKeyOnce(code);
  if (scene === 'play') {
    pressed[code] = BUF_MS;
    const d = TAP_DIR[code];
    if (d) {
      if (lastTap.dir === d && tick - lastTap.t <= 15) { dashReq = d; lastTap = { dir: 0, t: -99 }; }
      else lastTap = { dir: d, t: tick };
    }
  }
  keys[code] = true;
  if (scene === 'tutorial') lightCaps(code, true);
}
function inputUp(code) { keys[code] = false; if (scene === 'tutorial') lightCaps(code, false); }
addEventListener('keydown', e => {
  if(!e.repeat&&vargulDebugKey(e.code)){e.preventDefault();return;}
  if (e.target.closest?.('input, select, textarea, button') && scene !== 'play' && !['Escape', 'KeyM'].includes(e.code)) return;
  if (e.metaKey || e.altKey) return;
  const code = UX.mapKey(e.code);
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Enter'].includes(code) || (scene === 'play' && e.ctrlKey)) e.preventDefault();
  if (!e.repeat) inputDown(code);
});
addEventListener('keyup', e => inputUp(UX.mapKey(e.code)));
addEventListener('blur', () => { clearInput(); pauseGame('다른 창으로 이동해 게임을 멈췄습니다.'); });
document.addEventListener('visibilitychange', () => { if (document.hidden) { clearInput(); pauseGame('화면을 벗어나 게임을 멈췄습니다.'); } });

function lightCaps(code, on) {
  document.querySelectorAll('.cap').forEach(c => {
    if (c.dataset.k.split(' ').includes(code)) c.classList.toggle('on', on);
  });
}

// ---------------------------------------------------------------- 사운드 (audio.js: 합성 효과음 + 스테이지 BGM)
const sfx = (name, a) => AUDIO.sfx(name, a);

// ---------------------------------------------------------------- 데이터
// 적 정의. wind=공격 예고, act=공격 판정 유지, rec=공격 후 경직 (틱)
// 보스는 pats 의 패턴(ms 단위 타임라인)으로 싸운다
const ET = {
  grunt: { name: '망령 병사', sprite: 'infantry', hp: 40, spd: 1.2, dmg: 8, range: 56, wind: 28, act: 10, rec: 30, kb: 3, score: 100,
           h: 96, s: 1, hw: 18 },
  rogue: { name: '흑창병', sprite: 'spearman', hp: 28, spd: 2.0, dmg: 6, range: 78, wind: 18, act: 8, rec: 22, kb: 2, score: 150,
           h: 96, s: 1, hw: 18 },
  brute: { name: '흑철 중기사', sprite: 'knight', hp: 100, spd: 0.9, dmg: 16, range: 68, wind: 44, act: 12, rec: 44, kb: 6, score: 300, kd: true,
           h: 100, s: 1, hw: 22 },
  // 궁병: 거리를 두고 같은 줄(깊이)에 서서 활을 당긴 뒤(예고) 화살을 쏜다. 줄을 바꾸거나 점프하면 피할 수 있다
  archer: { name: '망령 궁수', sprite: 'archer', hp: 30, spd: 1.5, dmg: 7, range: 260, wind: 42, act: 6, rec: 46, kb: 3, score: 200,
           h: 96, s: 1, hw: 18, ranged: true },
  boss1: { name: '도살자 고라스', en: 'GORATH', sprite: 'boss1', boss: true, hp: 700, spd: 1.05, range: 62, score: 2000, kd: true,
           h: 128, s: 1, hw: 34, pats: { slam: '지축 내려찍기', sweep: '식칼 휩쓸기', rage: '도살 돌진', hook: '갈고리 끌어오기', meat: '고기 덩어리 투척' } },
  boss2: { name: '까마귀 마녀 모르그라', en: 'MORGRA', sprite: 'boss2', boss: true, hp: 850, spd: 1.2, range: 64, score: 3500, kd: true,
           h: 126, s: 1, hw: 28, keepAway: true, pats: { teleport: '까마귀 이동', orbs: '녹염 탄막', ravens: '까마귀 떼', feather: '깃털 투척', staff: '지팡이 강타', soul: '영혼 추수' } },
  boss3: { name: '황금왕 아우렐리온', en: 'AURELION', sprite: 'boss3', boss: true, hp: 1500, spd: 1.3, range: 68, score: 6000, kd: true,
           h: 120, s: 1, hw: 34, pats: { slash3: '삼연 검기', pillars: '황금 기둥', charge: '왕의 돌진', cleave: '황금 중파참', whirl: '황금 선풍' } },
  boss4: { name: '프로즌 그레이브로드', en: 'FROZEN GRAVELORD', sprite: 'boss4', boss: true, hp: 1900, spd: 1.25, range: 70, score: 8000, kd: true,
           h: 152, s: 1, hw: 34, orb: 'blue', pats: { frost: '빙결 십자 · 이동 / 점프', slam: '묘지 내려찍기', slash3: '망령 삼연참', orbs: '혼불 탄막' } },
  boss5: { name: '블랙 문 엠페러', en: 'BLACK MOON EMPEROR', sprite: 'boss5', boss: true, hp: 2400, spd: 1.2, range: 78, score: 12000, kd: true,
           h: 176, s: 1, hw: 40, orb: 'eclipse', pats: { eclipse: '심연 고리 · 점프로 넘기', slam: '심연 강타', pillars: '지옥불 기둥', orbs: '마염 탄막', charge: '마왕 돌진', ravens: '악령 떼' } },
};
// 패턴 시작 후 이 시간(ms) 동안 머리 위에 ! 경고 표시
ET.boss2.pats=Object.fromEntries(['staff_swing','magic_bolt','teleport','summon','curtain','cackle','aerial_slash','crow_rush','moon','p2_bolt','p2_summon','p2_curtain','p2_teleport'].map(id=>[id,morgraMoves[id].name]));
const TELE = { slam: 650, sweep: 450, rage: 550, hook: 500, meat: 500, orbs: 500, ravens: 450, feather: 450,
  staff: 500, soul: 700, pillars: 700, charge: 450, cleave: 820, whirl: 900, slash3: 260, frost: 1050, eclipse: 1400 };

const STAGES = [
  { name: 'STAGE 1', title: '붉은 처형자의 성채', theme: 'stage1', len: 3200, boss: 'boss1',
    barrels: [520, 1100, 1650, 2100],
    waves: [
      { at: 400,  e: [['grunt', 1], ['grunt', 1]] },
      { at: 900,  e: [['grunt', 1], ['grunt', -1], ['rogue', 1]] },
      { at: 1400, e: [['rogue', 1], ['archer', -1], ['grunt', 1]] },
      { at: 1900, e: [['grunt', 1], ['grunt', -1], ['brute', 1]] },
      { at: 2240, e: [['boss1', 1], ['grunt', -1]], boss: true },
    ] },
  { name: 'STAGE 2', title: '까마귀 마녀의 성역', theme: 'stage2', len: 3600, boss: 'boss2',
    barrels: [450, 950, 1500, 2000, 2400],
    waves: [
      { at: 400,  e: [['grunt', 1], ['rogue', 1], ['rogue', -1]] },
      { at: 800,  e: [['brute', 1], ['grunt', -1]] },
      { at: 1300, e: [['rogue', 1], ['archer', 1], ['rogue', -1], ['grunt', -1]] },
      { at: 1800, e: [['brute', 1], ['brute', -1]] },
      { at: 2250, e: [['grunt', 1], ['grunt', 1], ['rogue', -1], ['brute', -1]] },
      { at: 2640, e: [['boss2', 1], ['rogue', -1], ['rogue', -1]], boss: true },
    ] },
  { name: 'STAGE 3', title: '몰락한 황금 왕국', theme: 'stage3', len: 4000, boss: 'boss3',
    barrels: [500, 900, 1400, 1900, 2400, 2800],
    waves: [
      { at: 400,  e: [['rogue', 1], ['rogue', 1], ['grunt', -1], ['grunt', -1]] },
      { at: 800,  e: [['brute', 1], ['rogue', -1], ['rogue', -1]] },
      { at: 1200, e: [['brute', 1], ['brute', -1], ['grunt', 1]] },
      { at: 1700, e: [['rogue', 1], ['archer', 1], ['rogue', -1], ['archer', -1], ['grunt', 1]] },
      { at: 2200, e: [['brute', 1], ['brute', -1], ['rogue', 1], ['rogue', -1]] },
      { at: 2650, e: [['grunt', 1], ['grunt', 1], ['grunt', -1], ['brute', -1], ['rogue', 1]] },
      { at: 3040, e: [['boss3', 1]], boss: true },
    ] },
  { name: 'STAGE 4', title: '얼어붙은 망자의 왕국', theme: 'stage4', len: 4200, boss: 'boss4',
    barrels: [520, 1000, 1500, 2100, 2600, 3100],
    waves: [
      { at: 400,  e: [['grunt', 1], ['grunt', 1], ['archer', 1], ['grunt', -1]] },
      { at: 850,  e: [['brute', 1], ['archer', 1], ['rogue', -1]] },
      { at: 1300, e: [['archer', 1], ['archer', -1], ['grunt', 1], ['grunt', -1], ['rogue', 1]] },
      { at: 1800, e: [['brute', 1], ['brute', -1], ['archer', 1]] },
      { at: 2300, e: [['rogue', 1], ['rogue', 1], ['rogue', -1], ['archer', -1], ['archer', 1]] },
      { at: 2800, e: [['brute', 1], ['grunt', -1], ['grunt', -1], ['archer', 1], ['archer', -1]] },
      { at: 3240, e: [['boss4', 1], ['archer', -1]], boss: true },
    ] },
  { name: 'STAGE 5', title: '검은 월식의 심연', theme: 'stage5', len: 4400, boss: 'boss5',
    barrels: [480, 1000, 1600, 2200, 2800, 3300],
    waves: [
      { at: 400,  e: [['brute', 1], ['archer', 1], ['grunt', -1], ['grunt', -1]] },
      { at: 850,  e: [['rogue', 1], ['rogue', 1], ['archer', -1], ['archer', 1], ['grunt', -1]] },
      { at: 1300, e: [['brute', 1], ['brute', -1], ['archer', 1], ['archer', -1]] },
      { at: 1800, e: [['grunt', 1], ['grunt', 1], ['grunt', -1], ['rogue', -1], ['brute', 1], ['archer', 1]] },
      { at: 2300, e: [['brute', 1], ['brute', -1], ['rogue', 1], ['rogue', -1], ['archer', 1]] },
      { at: 2800, e: [['archer', 1], ['archer', 1], ['archer', -1], ['brute', -1], ['brute', 1]] },
      { at: 3300, e: [['rogue', 1], ['rogue', -1], ['grunt', 1], ['grunt', -1], ['brute', 1], ['archer', -1]] },
      { at: 3640, e: [['boss5', 1]], boss: true },
    ] },
];

// Selected encounters teach a new response without making every wave longer.
STAGES[2].waves[3].arena = 'fire';
STAGES[3].waves[2].arena = 'frost'; STAGES[3].waves[4].arena = 'frost';
STAGES[4].waves[2].arena = 'abyss'; STAGES[4].waves[5].arena = 'abyss';
for (const i of [3, 4]) for (const w of STAGES[i].waves) if (!w.boss && w.e.length > 4) w.e = w.e.slice(0, 4);

// 플레이어 3콤보: 예비 동작(wind) → 휘두름(act) → 회수(rec), ms. 휘두름 35% 지점부터 판정
const SP_MAX = 100;           // 필살기 게이지: 적을 때릴수록 차오른다
const GROGGY_TICKS = 300;     // 보스 기절 시간 (5초 = 300틱)
const ATK = {
  c1:  { ...HATK[0], dmg: 10, reach: 80, kd: false, step: 8,  stop: 3, fx: 0 },   // 일섬: 어깨 위에서 대각선으로 내려 벤다
  c2:  { ...HATK[1], dmg: 11, reach: 82, kd: false, step: 8,  stop: 3, fx: 1 },   // 역일섬: 낮은 곳에서 위로 올려 벤다
  c3:  { ...HATK[2], dmg: 16, reach: 98, kd: true,  step: 16, stop: 7, fx: 2 },   // 참격: 머리 위로 들어 땅까지 내려찍고 검기 발사
  air: { dmg: 14, reach: 64, kd: true, stop: 5, fx: 2 },
};
const LINK_MS = 420, BUF_MS = 220;      // 다음 타 연결 허용 시간 / 선입력 유지 시간
// 필살기 "흑월참": 기 모으기 → 돌진 → 4연 베기 → 도약 내려찍기. 시전 중 무적
const SPECIAL = { dur: 2100, slash: 14, fin: 70 };
// 마법 "뇌격": 두루마리 1개로 화면 안의 모든 적에게 번개. 잡몹은 쓰러지고 보스는 최대 체력의 12% 피해
const MAGIC = { max: 3, dur: 640, fire: 380, damage: 80 };
// 첨부 보스전의 전투 기술. 일반 공격보다 강하지만 각각 독립 쿨다운이 있다.
const SKILLS = {
  thrust: { name: '돌진 베기', key: 'U', cd: 4600, dur: 700 },
  slam:   { name: '내려찍기', key: 'H', cd: 6000, dur: 820 },
  whirl:  { name: '회전 베기', key: 'O', cd: 7000, dur: 760 },
  leap:   { name: '점프 강하', key: 'P', cd: 8000, dur: 960 },
  redwave:{ name: '붉은 파동', key: 'L', cd: 6500, dur: 720 },
};
const SKILL_KEYS = { KeyU: 'thrust', KeyH: 'slam', KeyO: 'whirl', KeyP: 'leap', KeyL: 'redwave' };
const INTRO_MS = 2000;                 // 보스 등장 연출 길이
const CHAIN_MS = 1700;                 // 이 시간 안에 다시 때리면 연속 히트가 이어진다

// ---------------------------------------------------------------- 상태
let scene = 'title';
let stageIdx = 0, stage = null;
let camX = 0, camLock = false, lockAt = 0, waveIdx = 0;
let player = null, enemies = [], items = [], barrels = [], parts = [], texts = [];
let hazards = [], impacts = [], bursts = [], ghosts = [], bolts = [];   // 투사체·위험 지대 / 적중 이펙트 / 불꽃 / 잔상 / 번개
let target = null;                     // 최근에 때린 잡몹 (HUD 표시)
let tick = 0, hitStop = 0, shake = 0, flashT = 0, flashCol = '255,255,255', bannerT = 0, clearT = 0, goT = 0, stageStartScore = 0, nextId = 1;
let slowT = 0;                         // 보스를 쓰러뜨리면 잠깐 느려진다 (ms)
let introBoss = null, introT = 0, introLand = false;   // 보스 등장 연출
const chain = { n: 0, t: 0, max: 0 };  // 연속 히트 (화면 왼쪽 HIT 표시, 보스 피해 보너스)
const stat = { ticks: 0, kills: 0, damage: 0, deaths: 0 };
let resumeScene = 'play', settingsFrom = 'title', helpFrom = 'title', stageEntry = null;
let practice = false;
const practiceDone = new Set();
let practiceOrigin = 80;
let arena = null;

function newPlayer(score = 0) {
  return { x: 80, y: 420, z: 0, vx: 0, vz: 0, face: 1, w: 26, hw: 16, hp: 100, max: 100, lives: 3,
    st: 'free', t: 0, atk: null, combo: 0, comboT: 0, buf: 0, x0: 80, wave: false, hitSet: new Set(),
    inv: 0, flash: 0, buff: 0, score, walk: false, walkTime: 0, sp: 0, dashCd: 0, mg: 0, castFired: false, tipX: 0, tipH: 0,
    skill: null, skillCd: Object.fromEntries(Object.keys(SKILLS).map(id => [id, 0])), skillHits: new Set(), skillDest: 0,
    spTg: null, spX: 0, spY: 0, spX0: 0, spY0: 0, spHits: 0, spFin: false };
}

// ---------------------------------------------------------------- 화면(HTML 오버레이) 전환
const screens = ['title', 'tutorial', 'pause', 'clear', 'over', 'ending', 'settings'];
function showScreen(id) {
  screens.forEach(s => $(s).classList.toggle('show', s === id));
  $('skillbar').hidden = !!id; $('playPause').hidden = !!id;
  $('practiceGuide').hidden = !!id || !practice;
  syncTouchControls(id === 'settings' || (!id && scene === 'play'), id === 'settings');
}
// 모바일 키: 플레이 중에 표시하고, 설정 화면에서는 켜자마자 미리보기로 보여준다.
function syncTouchControls(show = scene === 'play' || scene === 'settings', preview = scene === 'settings') {
  const editing = UX.touchEditing;              // 배치 편집 중에는 끈 상태여도 보여 준다
  $('touchControls').hidden = !editing && (!UX.options.touch || !show);
  $('touchControls').classList.toggle('preview', preview && !editing);
  $('touchControls').classList.toggle('editing', editing);
}

function toTutorial(from = 'title') {
  helpFrom = from; clearInput(); scene = 'tutorial'; showScreen('tutorial'); sfx('click');
  $('btnHelpBack').hidden = from !== 'pause'; $('btnPractice').hidden = from === 'pause'; $('btnGo').hidden = from === 'pause';
  document.querySelector('#tutorial .dialog-body').scrollTop = 0;
}
function beginGame(cinematic = false) {
  if (cinematic === true) { startOpening(); return; }
  practice = false; clearInput(); AUDIO.pause(false);
  player = newPlayer(0);
  startStage(0);
}
function toTitle() { clearInput(); practice = false; scene = 'title'; showScreen('title'); AUDIO.silence(); AUDIO.pause(false); UX.refreshTitle(); }
function pauseGame(reason = 'ESC 또는 계속하기') {
  if (!['play', 'intro', 'bossintro'].includes(scene)) return;
  resumeScene = scene; clearInput(); scene = 'pause'; $('pauseReason').textContent = reason; showScreen('pause'); AUDIO.pause(true);
}
function resumeGame() {
  if (scene !== 'pause') return;
  clearInput(); scene = resumeScene; showScreen(null); AUDIO.pause(false); last = performance.now(); acc = 0;
}
function openSettings(from) { settingsFrom = from; clearInput(); scene = 'settings'; showScreen('settings'); }
function closeSettings() { UX.cancelCapture(); scene = settingsFrom; showScreen(settingsFrom); clearInput(); }
function entrySnapshot(i = stageIdx) {
  const { score, hp, lives, sp, mg, buff } = player;
  return { stage: i, score, hp, lives, sp, mg, buff };
}
function continueGame() {
  const saved = UX.checkpoint(); if (!saved) return;
  practice = false; player = Object.assign(newPlayer(), saved); AUDIO.pause(false); startStage(saved.stage, true);
}
function beginPractice() {
  practice = true; practiceDone.clear(); player = newPlayer(); startStage(0); scene = 'play'; bannerT = 0;
  camLock = true; lockAt = 0; barrels = []; player.inv = 0; practiceOrigin = player.x;
  enemies = [mkEnemy('grunt', 350, 420)]; enemies[0].training = true;
  showScreen(null); AUDIO.pause(false); updatePractice();
}
function updatePractice() {
  if (Math.abs(player.x - practiceOrigin) > 40) practiceDone.add('move');
  if (player.z > 20) practiceDone.add('jump');
  if (player.st === 'dash') practiceDone.add('dash');
  if (!enemies.length || enemies[0].st === 'dead') { enemies = [mkEnemy('grunt', clamp(player.x + 110, 100, 550), player.y)]; enemies[0].training = true; }
  const label = code => UX.keyName(UX.options.bindings[code]);
  const steps = [['move', '이동: 방향키 또는 이동 버튼으로 허수아비에게 접근하세요'], ['attack', `공격: ${label('KeyJ')} / 공격 버튼으로 같은 줄의 적을 맞히세요`],
    ['jump', `점프: ${label('Space')} / 점프 버튼을 누르세요`], ['dash', `회피: ${label('ShiftLeft')} / 대시 버튼 또는 방향키 두 번`], ['skill', '기술: 찌르기·강타·회전·강하 중 하나를 명중시키세요']];
  const next = steps.find(([id]) => !practiceDone.has(id));
  $('practiceText').textContent = next ? `연습 ${practiceDone.size}/5 · ${next[1]}` : '연습 완료! 실전에서 공격 예고를 보고 피하세요.';
}

$('btnStart').onclick = () => toTutorial();
$('btnGo').onclick = () => beginGame(true);
$('btnNext').onclick = nextStage;
$('btnRetry').onclick = retryStage;
$('btnToTitle').onclick = toTitle;
$('btnEndTitle').onclick = toTitle;
$('btnContinue').onclick = continueGame;
$('btnPractice').onclick = beginPractice;
$('btnPracticeGo').onclick = () => beginGame(true);
$('btnPracticeHelp').onclick = () => { pauseGame(); toTutorial('pause'); };
$('btnResume').onclick = resumeGame;
$('playPause').onclick = () => pauseGame();
$('btnPauseTitle').onclick = toTitle;
$('btnRestart').onclick = () => { AUDIO.pause(false); if (practice) beginPractice(); else retryStage(); };
$('btnTitleSettings').onclick = () => openSettings('title');
$('btnPauseSettings').onclick = () => openSettings('pause');
$('btnPauseHelp').onclick = () => toTutorial('pause');
$('btnHelpBack').onclick = () => { scene = 'pause'; showScreen('pause'); clearInput(); };
$('btnSettingsBack').onclick = closeSettings;
document.querySelectorAll('.skillbtn').forEach(b => {
  b.addEventListener('pointerdown', e => {
    e.preventDefault();
    if (scene === 'play' && canStartSkill(b.dataset.skill)) startSkill(b.dataset.skill);
  });
});

function onKeyOnce(code) {
  if (scene === 'opening' && ['Enter', 'Space', 'Escape'].includes(code)) { finishOpening(); return; }
  if (code === 'Enter') {
    if (scene === 'title') toTutorial();
    else if (scene === 'tutorial' && helpFrom !== 'pause') beginGame(true);
    else if (scene === 'clear') nextStage();
    else if (scene === 'over') retryStage();
    else if (scene === 'ending') toTitle();
  }
  if (code === 'KeyM') AUDIO.toggle();             // 소리 켜기/끄기
  if (code === 'Escape') {
    if (['play', 'intro', 'bossintro'].includes(scene)) pauseGame();
    else if (scene === 'pause') resumeGame();
    else if (scene === 'settings') { if (UX.touchEditing) UX.endTouchEdit(); else closeSettings(); }
    else if (scene === 'tutorial') { if (helpFrom === 'pause') { scene = 'pause'; showScreen('pause'); } else toTitle(); }
  }
}

// ---------------------------------------------------------------- 스테이지 진행
function startStage(i, restored = false) {
  vargulRemains=[];sovereignRemains=[];
  clearInput(); hitStop = 0; shake = 0; flashCol = '255,255,255';
  stageIdx = i; stage = STAGES[i]; releaseBG.key = ''; releaseBG.previous = ''; releaseBG.blend = 1;
  arena = null;
  camX = 0; camLock = false; waveIdx = 0; clearT = 0; goT = 0; flashT = 0;
  enemies = []; items = []; parts = []; texts = []; target = null; hazards = []; impacts = []; bursts = []; ghosts = []; bolts = [];
  chain.n = 0; chain.t = 0; chain.max = 0; stat.ticks = 0; stat.kills = 0; stat.damage = 0; stat.deaths = 0; slowT = 0; introBoss = null;
  barrels = stage.barrels.map(bx => ({ kind: 'barrel', x: bx, y: rand(GTOP + 30, GBOT - 10), z: 0, hw: 16,
    hp: 2, flash: 0, dead: false, t: 0 }));
  const p = player;
  p.x = 80; p.y = 420; p.z = 0; p.vx = 0; p.vz = 0; p.face = 1; p.st = 'free'; p.t = 0; p.inv = 90;
  p.grab = null; p.skill = null; for (const id in p.skillCd) p.skillCd[id] = 0;
  p.combo = 0; p.comboT = 0; p.buf = 0; p.atk = null; p.dashCd = 0; p.spTg = null;
  p.hp = Math.min(p.max, p.hp + (!restored && i > 0 ? 40 : 0));
  stageStartScore = p.score;
  if (!practice) { stageEntry = entrySnapshot(); UX.saveCheckpoint(stageEntry); }
  scene = 'intro'; bannerT = 160;
  showScreen(null);
  AUDIO.music(i);
}
function nextStage() {
  if (stageIdx + 1 < STAGES.length) startStage(stageIdx + 1);
}
function retryStage() {
  player = Object.assign(newPlayer(stageStartScore), stageEntry || {});
  startStage(stageIdx, true);
}

function spawnWave(w) {
  arena = w.arena ? { kind: w.arena, time: 0, next: 1800, cycle: 0 } : null;
  for (const [type, side] of w.e) {
    if (ET[type].boss) {                           // 보스: 하늘에서 떨어져 착지 → 포효 → 이름 카드
      const b = mkEnemy(type, camX + VW * 0.72, clamp(player.y, GTOP + 40, GBOT - 30));
      b.st = 'intro'; b.z = type === 'boss2'||isVargul(b)||isSovereign(b) ? 0 : 360; b.face = -1;
      enemies.push(b); introBoss = b; introT = 0; introLand = false; scene = 'bossintro';
      AUDIO.bossMusic(stageIdx);
      continue;
    }
    const x = side > 0 ? camX + VW + rand(30, 110) : camX - rand(30, 110);
    enemies.push(mkEnemy(type, x, rand(GTOP + 20, GBOT)));
  }
}
function mkEnemy(type, x, y) {
  // The retained ET.boss4 / runLegacyPat / named renderer are bypassed only
  // while USE_VARGUL_V136 is enabled; VARGUL_V136_OVERRIDE=false restores them.
  const base = type==='boss4'&&USE_VARGUL_V136?{...ET[type],name:'바르굴, 얼어붙은 묘지왕',en:'VARGUL, THE FROZEN GRAVELORD',hp:2000,h:VARGUL_ART.worldHeight,hw:19,pats:VARGUL_RULES.names}:
    type==='boss5'&&USE_SOVEREIGN?{...ET[type],name:'흑월의 갑주왕',en:'THE BLACK MOON SOVEREIGN',hp:SOVEREIGN_RULES.hp[0],h:SOVEREIGN_ART.bodyHeight,hw:SOVEREIGN_RULES.hw,pats:SOVEREIGN_RULES.names}:
    type==='boss3'&&USE_AURELION_V133?{...ET[type],hp:1800,h:240*AURELION_K,pats:Object.fromEntries(AURELION_ATTACKS.map(id=>[id,aurelionMoves[id].name]))}:ET[type];
  const faction = ['처형군', '까마귀 군단', '황금 왕실', '서리 망자', '심연 군단'][stageIdx];
  const d = base.boss ? base : { ...base, hp: Math.round(base.hp*(1.2+stageIdx*.3)), dmg: Math.round(base.dmg*(1.1+stageIdx*.2)), spd: base.spd*(1+stageIdx*.05), name: faction + ' ' + ({grunt:'보병',rogue:'창병',archer:'궁병',brute:'중기사'}[type] || base.name) };
  return { kind: 'enemy', id: nextId++, type, d, x, y, z: 0, vx: 0, vz: 0, face: -1, hw: d.hw, hp: d.hp, max: d.hp,
    st: 'chase', t: 0, wait: rand(0, 40), atkCd: rand(20, 60), pat: null, hitSet: null, inv: 0, flash: 0,
    boss: !!d.boss, nextKd: d.hp * 0.75, gr: 0, grMax: type==='boss2'?120:d.hp >= 500 ? 150 : 120, grT: 0, walk: false, recT: d.rec || 30, remove: false,
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
function burst(x, y, z, cols) { if (UX.options.lowFx && bursts.length >= 6) return; bursts.push({ x, y, z, age: 0, seed: (Math.random() * 999) | 0, cols }); }
function ghost(x, y, z, id, face, wash, life) { ghosts.push({ x, y, z, id, face, wash, life, age: 0, aurelion: id==='boss3'&&USE_AURELION_V133?aurelionGhostFrame():null, gorath: id==='boss1'?gorathEnemyFrame(enemies.find(e=>e.type==='boss1')||{st:'chase'}):null, barel: id==='player'?barelPlayerFrame():null, named: id==='player'?namedPlayerFrame():null }); }
function cutIn() { const c = $('cutin'); c.classList.remove('show'); void c.offsetWidth; c.classList.add('show'); }

function dropItem(type, x, y) {
  items.push({ kind: 'item', type, x, y, z: 0, vz: 5, vx: rand(-1, 1), life: 1500, t: 0 });
}
function dropFrom(e) {
  const r = Math.random();
  if (e.boss) { dropItem('gold', e.x - 20, e.y); dropItem('big', e.x + 20, e.y); return; }
  stat.kills++;
  if (stat.kills % 6 === 1) { dropItem('scroll', e.x, e.y); return; }   // 6마리마다 한 번은 마법 두루마리
  if (r < 0.07) dropItem('big', e.x, e.y);
  else if (r < 0.28) dropItem('potion', e.x, e.y);
  else if (r < 0.34) dropItem('power', e.x, e.y);
  else if (r < 0.42) dropItem('crystal', e.x, e.y);
  else if (r < 0.53) dropItem('coin', e.x, e.y);
  else if (r < 0.58) dropItem('coinBag', e.x, e.y);
  else if (r < 0.60) dropItem('gold', e.x, e.y);
}
function dropFromBarrel(b) {
  const r = Math.random();
  dropItem(r < 0.4 ? 'potion' : r < 0.52 ? 'big' : r < 0.64 ? 'power' : r < 0.76 ? 'scroll' : r < 0.86 ? 'crystal' : r < 0.94 ? 'coin' : r < 0.98 ? 'coinBag' : 'gold', b.x, b.y);
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
  p.st = 'atk'; p.t = 0; p.buf = 0; p.hitSet = new Set(); p.x0 = p.x; p.wave = false; p.smash = false;
  if (n === 'air') { p.atk = 'air';reactAurelionAttack(); sfx('swing', 2); return; }
  p.combo = n; p.atk = ['c1', 'c2', 'c3'][n];reactAurelionAttack();
  sfx('swing', n);
}

function hurtPlayer(dmg, dir, kd, source=null) {
  dmg = Math.round(dmg * (source?.damageScale ?? (source?.boss && source.p2shown ? (source.type==='boss2'?1.5:1.3) : 1)));
  const p = player;
  if (practice) return false;
  if (p.inv > 0 || p.st === 'down' || p.st === 'dead' || p.st === 'special' || p.st === 'grabbed') return false;
  stat.damage += Math.min(p.hp, dmg);
  p.hp -= dmg; p.flash = 5; p.combo = 0; p.buf = 0; p.wave = false; p.skill = null; chain.n = 0;
  hitStop = Math.max(hitStop, kd ? 6 : 4); shake = Math.max(shake, kd ? 12 : 7);
  floatText(p.x, p.y - p.z - 110, dmg, '#ff5a6a');
  impact(p.x - dir * 6, p.y, p.z + 56, kd ? 2 : 1, dir);
  sfx(kd ? 'hurtH' : 'hurt');
  if (p.hp <= 0) {
    p.hp = 0; p.lives--; stat.deaths++; p.st = 'dead'; p.t = 0; p.vz = 6; p.vx = dir * 4; sfx('pdie'); return true;
  }
  if (kd || p.z > 0) { p.st = 'down'; p.t = 0; p.vz = 5; p.vx = dir * 3.5; }
  else { p.st = 'hurt'; p.t = 0; p.vx = dir * 2; p.inv = 40; }
  return true;
}

function playerStrike(A) {
  const p = player, mul = p.buff > 0 ? 1.5 : 1;
  strikeMorgraCrows(A.reach);
  strikeVargulOrbs(A.reach,8,p.hitSet,{damage:Math.round(A.dmg*mul)});
  const sovBlock=strikeSovereignFists(A.reach,8,p.hitSet,{damage:Math.round(A.dmg*mul),kd:A.kd});
  let landed = false;
  for (const e of enemies) {
    if (!canHit(e) || p.hitSet.has(e) || sovBlock&&isSovereign(e)) continue;
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
// 대검이 땅에 박히는 순간: 돌 파편 · 흙먼지 · 붉은 불꽃
function groundSmash(x, y) {
  shake = Math.max(shake, 10); sfx('slam');
  for (let i = 0; i < 12; i++) parts.push({ x: x + rand(-14, 14), y: y + rand(-6, 6), z: rand(2, 10), vx: rand(-3.2, 3.2), vz: rand(3, 7.5), life: rand(22, 38), col: ['#2a2a30', '#4a4a52', '#1a1a1e', '#6a6a72'][i % 4] });
  burst(x, y, 6, ['#ffffff', '#c8c8d0', '#6a6a72']);
  burst(x, y, 10, ['#ff5a6a', '#a01a24', '#5a0a12']);
  impact(x, y, 8, 1, player.face);
}
// 참격 마무리에서 날아가는 푸른 검기
function launchWave() {
  const p = player;
  hazards.push({ type: 'pwave', x: p.x + p.face * 44, y: p.y, h: p.z + 44, dir: p.face, age: 0 });
  sfx('pwave');
}

const DASH = { dist: 80, dur: 190, inv: 15, cd: 31 };   // 이동 거리(px), 길이(ms), 무적·쿨타임(틱)
function startDash(d) {
  const p = player;
  p.st = 'dash'; p.t = 0; p.x0 = p.x; p.face = d; p.combo = 0; p.comboT = 0; p.buf = 0; p.wave = false;
  p.inv = Math.max(p.inv, DASH.inv); p.dashCd = DASH.cd;
  burst(p.x - d * 12, p.y, 4, ['#d8c8a8', '#a8864a', '#6a4a28']);
  sfx('dash');
}

function startSpecial() {
  const p = player;
  p.st = 'special'; p.t = 0; p.sp = 0; p.vx = 0; p.combo = 0; p.buf = 0; p.spHits = 0; p.spFin = false; p.spDash = false;reactAurelionAttack();
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
  cutIn(); sfx('spcharge');
}
function updSpecial() {
  const p = player, t = p.t * MS, f = p.face, tg = p.spTg;
  if (tg && tg.st !== 'dead' && t < 1580) { p.spX = tg.x; p.spY = tg.y; }
  if (t >= 450 && !p.spDash) { p.spDash = true; sfx('spdash'); }
  if (t >= 450 && t < 620) {                                     // 돌진: 목표 앞까지 순간 이동하며 붉은 잔상
    const u = ease((t - 450) / 150);
    p.x = lerp(p.spX0, p.spX - f * 52, u); p.y = lerp(p.spY0, p.spY, u);
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
  strikeVargulOrbs(rx,rx,new Set(),{x:p.spX,y:p.spY,h:0,depth:ry,damage:dmg});
  const sovBlock=strikeSovereignFists(rx,rx,new Set(),{x:p.spX,y:p.spY,h:0,depth:ry,damage:dmg,kd:true});
  let any = false;
  for (const e of enemies) {
    if (!canHit(e) || sovBlock&&isSovereign(e)) continue;
    if (Math.abs(e.x - p.spX) < rx + e.hw && Math.abs(e.y - p.spY) < ry) { damageEnemy(e, dmg, last, last ? 2 : 1); any = true; }
  }
  for (const b of barrels) {
    if (!b.dead && Math.abs(b.x - p.spX) < rx && Math.abs(b.y - p.spY) < ry) damageBarrel(b);
  }
  if (!any) impact(p.spX - f * 12, p.spY, 72 + (k === 1 ? 16 : (k === 0 ? 4 : -8)), last ? 2 : 1, f);
  if (last) { flashT = 240; shake = Math.max(shake, 18); hitStop = Math.max(hitStop, 6); sfx('moon'); }
  else { shake = Math.max(shake, 6); sfx('spslash', k); }
}

function startCast() {
  const p = player;
  p.st = 'cast'; p.t = 0; p.mg--; p.castFired = false; p.combo = 0; p.buf = 0; p.vx = 0;reactAurelionAttack();
  p.inv = Math.max(p.inv, 48);
  sfx('mcharge');
}
function fireBolts() {
  const p = player, xs = [];
  p.castFired = true; flashT = 200; flashCol = '207,224,255'; shake = Math.max(shake, 22); hitStop = Math.max(hitStop, 4);
  sfx('bolt');
  strikeVargulOrbs(0,0,new Set(),{global:true,damage:MAGIC.damage});
  strikeSovereignFists(0,0,new Set(),{global:true,damage:MAGIC.damage});
  for (const e of enemies) {
    if (e.st === 'dead' || e.st === 'intro' || e.x < camX - 20 || e.x > camX + VW + 20) continue;
    xs.push([e.x, e.y]);
    if (e.boss) { if (!e.invuln && e.alpha >= 0.9) damageEnemy(e, MAGIC.damage, false, 2, true); }
    else { e.bolted = true; e.inv = 0; damageEnemy(e, MAGIC.damage, true, 2, true); }
  }
  const c = xs.length ? xs[0] : [p.x + p.face * 120, p.y];
  xs.push([clamp(c[0] - 72, camX + 16, camX + VW - 16), c[1]], [clamp(c[0] + 72, camX + 16, camX + VW - 16), c[1]]);
  xs.forEach((q, i) => bolts.push({ x: q[0], y: q[1], age: -i * 45, seed: (Math.random() * 999) | 0 }));
}

function damageBarrel(b) {
  b.hp--; b.flash = 6; hitStop = Math.max(hitStop, 2); sfx('hit', 0);
  sparks(b.x, b.y, 30, 5, '#d7a86e');
  if (b.hp <= 0) { b.dead = true; sparks(b.x, b.y, 25, 14, '#a1744a'); dropFromBarrel(b); sfx('barrel'); }
}

function canStartSkill(id) {
  const p = player;
  if (!p || !SKILLS[id] || p.skillCd[id] > 0 || p.z > 0 || p.st === 'dead' || p.st === 'down' ||
      p.st === 'hurt' || p.st === 'special' || p.st === 'cast' || p.st === 'skill' || p.st === 'grabbed') return false;
  if (p.st === 'atk') {
    const A = ATK[p.atk], t = p.t * MS;
    if (p.atk === 'air' || t < A.wind + A.act) return false;
  }
  if (p.st === 'dash' && p.t * MS < 110) return false;
  return scene === 'play';
}
function startSkill(id) {
  if (!canStartSkill(id)) return false;
  const p = player;
  p.st = 'skill'; p.skill = id; p.t = 0; p.x0 = p.x; p.vx = 0; p.vz = 0; p.z = 0;
  p.combo = 0; p.comboT = 0; p.buf = 0; p.wave = false; p.skillHits = new Set(); p.vargulSkillHits = new Map(); p.skillCd[id] = SKILLS[id].cd;
  const targets = enemies.filter(e => e.st !== 'dead' && Math.abs(e.y - p.y) < 60 && Math.abs(e.x - p.x) < 320)
    .sort((a, b) => Math.abs(a.x - p.x) - Math.abs(b.x - p.x));
  if (targets[0]) p.face = targets[0].x >= p.x ? 1 : -1;
  p.skillDest = clamp(targets[0] ? targets[0].x - p.face * 44 : p.x + p.face * 160,
    camX + 24, Math.min(camX + VW - 24, stage.len - 24));
  reactAurelionAttack();
  if (id === 'thrust' || id === 'leap') sfx('spdash');
  else sfx('swing', id === 'slam' ? 2 : 1);
  return true;
}
function skillStrike(phase, dmg, reach, behind, kd, fx) {
  strikeMorgraCrows(reach,behind);
  const p = player, mul = p.buff > 0 ? 1.5 : 1;
  p.vargulSkillHits ||= new Map();
  if(!p.vargulSkillHits.has(phase))p.vargulSkillHits.set(phase,new Set());
  strikeVargulOrbs(reach,behind,p.vargulSkillHits.get(phase),{depth:38,damage:Math.round(dmg*mul)});
  const sovBlock=strikeSovereignFists(reach,behind,p.vargulSkillHits.get(phase),{depth:38,damage:Math.round(dmg*mul),kd});
  let landed = false;
  for (const e of enemies) {
    const key = phase + ':' + e.id;
    if (!canHit(e) || p.skillHits.has(key) || sovBlock&&isSovereign(e)) continue;
    const dx = (e.x - p.x) * p.face;
    if (dx > -behind - e.hw && dx < reach + e.hw && Math.abs(e.y - p.y) < 38 && Math.abs(e.z - p.z) < 85) {
      p.skillHits.add(key); damageEnemy(e, Math.round(dmg * mul), kd, fx); landed = true;
      p.sp = Math.min(SP_MAX, p.sp + (kd ? 9 : 5));
    }
  }
  for (const b of barrels) {
    const key = phase + ':b' + b.x;
    if (b.dead || p.skillHits.has(key)) continue;
    const dx = (b.x - p.x) * p.face;
    if (dx > -behind - b.hw && dx < reach + b.hw && Math.abs(b.y - p.y) < 38) {
      p.skillHits.add(key); damageBarrel(b);
    }
  }
  if (landed) { hitStop = Math.max(hitStop, kd ? 7 : 4); shake = Math.max(shake, kd ? 12 : 6); }
  return landed;
}
function updSkill() {
  const p = player, id = p.skill, t = p.t * MS, prev = (p.t - 1) * MS;
  if (id === 'thrust') {
    if (t >= 180 && t <= 360 + MS) {
      const u = ease((t - 180) / 180);
      p.x = lerp(p.x0, p.skillDest, u); p.inv = Math.max(p.inv, 4);
      if (every(t, 30)) ghost(p.x, p.y, p.z, 'player', p.face, '#ff6b78', 210);
      if (t >= 240) skillStrike(0, 28, 68, 8, false, 1);
      if (prev < 240 && t >= 240) {
        impact(p.x + p.face * 42, p.y, 55, 1, p.face);
        burst(p.x + p.face * 42, p.y, 55, ['#ffffff', '#ff9aa6', '#ff3a4a']); sfx('hit', 2);
      }
    }
  } else if (id === 'slam') {
    if (prev < 330 && t >= 330) {
      skillStrike(0, 24, 130, 10, true, 2); groundSmash(p.x + p.face * 84, p.y);
    }
  } else if (id === 'whirl') {
    if (t >= 100 && t < 540) p.inv = Math.max(p.inv, 4);
    [200, 330, 460].forEach((at, k) => {
      if (prev < at && t >= at) {
        skillStrike(k, 16, 110, 110, false, 1); sfx('swing', k === 1 ? 2 : 1);
        impact(p.x + p.face * (k === 1 ? -14 : 20), p.y, 54, 1, p.face);
      }
    });
  } else if (id === 'redwave') {
    if (prev < 300 && t >= 300) {
      hazards.push({ type: 'pwave', red: true, x: p.x + p.face * 32, y: p.y,
        h: 44, dir: p.face, age: 0, travel: 0, hits: new Set(),
        damage: Math.round(24 * (p.buff > 0 ? 1.5 : 1)) });
      sfx('pwave');
    }
  } else if (id === 'leap') {
    if (t >= 120 && t < 560) {
      const u = (t - 120) / 440;
      p.x = lerp(p.x0, p.skillDest, ease(u)); p.z = Math.sin(Math.PI * u) * 88; p.inv = Math.max(p.inv, 4);
      if (every(t, 40)) ghost(p.x, p.y, p.z, 'player', p.face, '#9cc3ff', 220);
    }
    if (prev < 560 && t >= 560) {
      p.z = 0; skillStrike(0, 26, 76, 38, true, 2); groundSmash(p.x + p.face * 34, p.y);
    }
  }
  if (t >= SKILLS[id].dur) { p.st = 'free'; p.t = 0; p.z = 0; p.skill = null; p.inv = Math.max(p.inv, 10); }
}

function updPlayer() {
  const p = player;
  if (p.inv > 0) p.inv--;
  if (p.flash > 0) p.flash--;
  if (p.buff > 0) p.buff--;
  if (p.buf > 0) p.buf -= MS;
  if (p.dashCd > 0) p.dashCd--;
  for (const id in p.skillCd) if (p.skillCd[id] > 0) p.skillCd[id] = Math.max(0, p.skillCd[id] - MS);
  if (p.st === 'grabbed') { if(p.grab?.sovereign)updateSovereignGrab();else updateGorathGrab(); return; }
  const wasWalking = p.walk;
  p.walk = false;
  for (const code in SKILL_KEYS) {
    if (canStartSkill(SKILL_KEYS[code]) && hit(code) && startSkill(SKILL_KEYS[code])) return;
  }
  if (p.dashCd <= 0 && p.z === 0 && (p.st === 'free' || p.st === 'atk') && hit('ShiftLeft')) dashReq = p.face;
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
      p.walkTime = p.walk && p.z === 0 ? (wasWalking ? p.walkTime + MS : 0) : 0;
      p.t++;
      if (p.comboT > 0) p.comboT--;
      if (p.z === 0 && hit(...JUMP_KEYS)) { p.vz = 9.6; sfx('jump'); }
      if (p.sp >= SP_MAX && hit('KeyK', 'KeyX')) { startSpecial(); break; }
      if (p.mg > 0 && p.z === 0 && hit('KeyI', 'KeyV')) { startCast(); break; }
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
      if (p.combo === 2 && !p.smash && t >= A.wind + A.act * 0.85) { p.smash = true; groundSmash(p.tipX || p.x + p.face * 90, p.y); }
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
      if (t >= 110 && hit('KeyJ', 'KeyZ')) { startAtk(0); break; }
      if (t >= DASH.dur) { p.st = 'free'; p.t = 0; }
      break;
    }
    case 'special':
      p.t++;
      updSpecial();
      break;
    case 'skill':
      p.t++;
      updSkill();
      break;
    case 'cast':                                   // 검을 치켜들어 번개를 부른다
      p.t++;
      if (!p.castFired && p.t * MS >= MAGIC.fire) fireBolts();
      if (p.t * MS >= MAGIC.dur) { p.st = 'free'; p.t = 0; }
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
          scene = 'over'; AUDIO.stop(0.3); sfx('defeat');
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
      it.gone = true; sfx('pickup');
      if (it.type === 'potion') { heal(30); }
      else if (it.type === 'big') { heal(60); }
      else if (Object.hasOwn(SCORE_ITEMS, it.type)) { const points = SCORE_ITEMS[it.type]; p.score += points; floatText(p.x, p.y - 90, '+' + points, '#ffd23f'); }
      else if (it.type === 'power') { p.buff = 900; floatText(p.x, p.y - 90, 'POWER UP!', '#ffe14d'); }
      else if (it.type === 'scroll') { p.mg = Math.min(MAGIC.max, p.mg + 1); floatText(p.x, p.y - 90, '뇌격 두루마리', '#9cc3ff'); }
      else if (it.type === 'crystal') { p.sp = Math.min(SP_MAX, p.sp + 25); floatText(p.x, p.y - 90, 'SP +25', '#cfc0ff'); }
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
function damageEnemy(e, dmg, kd, kind = 0, fixedDamage = false) {
  if(isVargul(e)&&interceptVargulDamage(e))return;
  if(isSovereign(e)&&interceptSovereignDamage(e))return;
  if(isAurelion(e)&&interceptAurelionDamage(e,kd,fixedDamage))return;
  if (e.phaseT > 0 || e.st === 'reviving' || e.st === 'dead' || e.invuln) return;
  const p = player;
  if (practice) practiceDone.add(p.st === 'skill' ? 'skill' : 'attack');
  const stunned = e.st === 'stun';
  if (stunned && !fixedDamage) dmg = Math.round(dmg * 1.5);           // 기절 중에는 추가 피해
  if (e.boss && !fixedDamage) dmg = Math.round(dmg * (1 + Math.min(0.5, 0.05 * chain.n)));   // 연속 히트가 이어질수록 보스에게 최대 +50%
  chain.n++; chain.t = CHAIN_MS; chain.max = Math.max(chain.max, chain.n);
  e.hp -= dmg; e.flash = 6;
  hitStop = Math.max(hitStop, kd ? 6 : 3);
  sfx('hit', kind);
  const dir = p.x <= e.x ? 1 : -1, hz = e.z + SPRITES[e.d.sprite].gy * SC * 0.55;
  e.hr = 0; e.hdir = dir; e.hheavy = kind >= 2;
  impact(e.x - dir * e.hw * 0.6, e.y, hz, kind, dir);
  burst(e.x - dir * e.hw * 0.5, e.y, hz, kind === 2 ? ['#ffffff', '#9cc3ff', '#6a7cc0'] : undefined);
  floatText(e.x, e.y - e.z - e.d.h * e.d.s - 14, dmg, '#ffe27a');
  if (!e.boss) target = { e, t: 150 };

  if (e.hp <= 0) {
    if(isVargul(e)&&!e.p2shown){beginVargulTransition(e);return;}
    if(isSovereign(e)&&!e.p2shown){beginSovereignTransition(e);return;}
    if(e.type==='boss2'&&!e.p2shown){beginMorgraRevival(e);return;}
    if(e.type==='boss3'&&!e.p2shown){beginBossPhase2(e,true);return;}   // 아우렐리온: 1페이즈 체력을 다 깎으면 완전 회복 후 각성
    e.hp = 0; e.st = 'dead'; e.t = 0; e.pat = null;
    if (practice) return;
    p.score += e.d.score; dropFrom(e);
    if (e.boss) {                                  // 보스는 그 자리에서 무너지고, 잠깐 슬로 모션
      resetBossFx(e); e.vx = 0; e.vz = 0; shake = 20; hitStop = 16; flashT = 220; flashCol = '255,255,255'; slowT = 1100;
      hazards = hazards.filter(z => z.type === 'pwave'); sfx('bossdie');
    } else { e.vz = 6; e.vx = dir * 5; sfx('mobdie'); }
    return;
  }
  if (e.boss) {                                   // 보스: 슈퍼아머, 그로기 게이지 + 체력 25% 단위로 다운
    if (e.type!=='boss2' && e.type!=='boss3' && !isVargul(e) && !isSovereign(e) && !e.p2shown && e.hp <= e.max*.5) { beginBossPhase2(e,false); return; }
    if (stunned) return;                           // 기절 중에는 맞아도 상태가 바뀌지 않는다
    e.gr = Math.min(e.grMax, e.gr + dmg * 0.9); e.grT = 150;
    if (e.gr >= e.grMax) {
      resetBossFx(e);
      e.st = 'stun'; e.t = 0; e.vx = 0; e.z = 0; e.vz = 0;
      shake = 16; hitStop = 10; sfx('groggy');
      floatText(e.x, e.y - e.z - e.d.h - 40, 'GROGGY!', '#ffe14d');
      return;
    }
    if(morgraArmored(e))return;
    if (e.hp <= e.nextKd) {
      e.nextKd -= e.max * 0.25;
      resetBossFx(e);
      e.st = 'down'; e.t = 0; e.vz = 5; e.vx = dir * 3;
      if (e.type === 'boss3') spawnAdds(['rogue', 'rogue']);
      else if (e.type === 'boss4'&&!isVargul(e)) spawnAdds(['archer', 'grunt']);
      else if (e.type === 'boss5'&&!isSovereign(e)) spawnAdds(['brute', 'archer']);
    } else if (e.st === 'chase' || e.st === 'rec' || (isAurelion(e)&&e.st==='pat'&&!aurelionArmored(e)&&e.aurelion.guard!=='broken') || (isVargul(e)&&e.st==='pat'&&!vargulArmored(e))) { if(isAurelion(e)||isVargul(e))resetBossFx(e);e.st = 'hurt'; e.t = 0; e.vx = dir; }
    return;
  }
  if (e.type === 'brute' && e.st === 'wind' && !kd) return;   // 거한은 예고 동작 중 슈퍼아머
  if (kd) { e.st = 'down'; e.t = 0; e.vz = 5; e.vx = dir * 4; }
  else { e.st = 'hurt'; e.t = 0; e.vx = dir * e.d.kb * 0.6; }
  e.pat = null;
}
function spawnAdds(types) {
  [1, -1].forEach((side, i) => {
    const x = side > 0 ? camX + VW + 40 : camX - 40;
    enemies.push(mkEnemy(types[i], x, rand(GTOP + 20, GBOT)));
  });
  floatText(camX + VW / 2, OY + 90, '부하 소환!', '#ff80ab');
}

function startAttack(e, pat) {
  e.pat = pat; e.st = 'wind'; e.t = 0; e.hitSet = new Set();
  e.face = player.x >= e.x ? 1 : -1;
  e.form = e.d.sprite === 'knight' && Math.random() < 0.4 ? 'heavy' : 'atk';   // 중기사: 내려베기 / 찌르며 베기
  sfx('bwind');
}

// ---------------------------------------------------------------- 보스 패턴
// 고라스: 내려찍기(충격파) / 휩쓸기 / 돌진(분노)
// 모르그라: 순간이동 / 녹염 탄막 / 까마귀 떼
// 오렐리온: 삼연 검기 / 화염 기둥 / 왕의 돌진(분노)
// 체력 절반 이하(2페이즈)에서는 탄 수가 늘고 쿨타임이 짧아진다
function bossColors(e) { return e.type === 'boss4' ? ['#eaf8ff','#7ad8ff','#365caa'] : e.type === 'boss5' ? ['#ffe4fa','#ff498d','#691a52'] : ['#fff3b8','#f3d26a','#d4a437']; }
function phase2(e) { return !!e.p2shown; }
// 2페이즈 돌입: 그로기 게이지를 비우고 각성 모션(무적) 뒤 공격 재개.
// refill(아우렐리온)이면 최대 체력을 AURELION_P2_HP 로 늘려 가득 채운다.
const AURELION_P2_HP = 2200;
function beginBossPhase2(e, refill) {
  if (refill) { e.max = e.hp = AURELION_P2_HP; e.nextKd = e.max * 0.75; }
  e.p2shown=true;e.gr=0;e.grT=0;resetBossFx(e);
  e.phaseT=72;if(isAurelion(e))beginAurelionTransition(e);e.st='rec';e.t=0;e.recT=36;e.z=e.vz=e.vx=0;e.invuln=true;
  hazards=hazards.filter(h=>h.type==='pwave');player.inv=Math.max(player.inv,90);
  sfx('phase2');floatText(e.x,e.y-e.d.h-40,'PHASE 2','#ff5a6a');
}
function resetBossFx(e) { resetVargulPattern(e); resetAurelionPattern(e); e.pat = null; e.bdx = 0; e.bdy = 0; e.alpha = 1; e.wash = null; e.invuln = false; e.hot = false; }
function pickPat(e, adx, ady, p2) {
  if(isVargul(e))return pickVargulPattern(e,adx,ady);
  if(isAurelion(e))return pickAurelionPattern(e,adx,ady);
  if(e.type==='boss2')return pickMorgraPattern(e,adx,ady);
  p2=false;
  const near = adx < (e.type === 'boss1' ? 110 : 130) && ady < 34;   // 고라스 휩쓸기 사거리 ≈ 108px
  let ch = null;
  if (e.type === 'boss1') {
    if (near) ch = ['sweep', 'sweep', 'slam', p2 ? 'rage' : 'hook'];
    else if (adx < 460 && Math.random() < 0.75) ch = p2 ? ['hook', 'meat', 'rage', 'rage', 'slam'] : ['hook', 'meat', 'slam', 'meat', 'sweep'];
  } else if (e.type === 'boss2') {
    ch = adx < 110 ? ['teleport', 'staff', 'staff', 'orbs', 'feather'] :
      (p2 ? ['orbs', 'soul', 'feather', 'ravens', 'teleport', 'soul'] : ['orbs', 'orbs', 'ravens', 'feather', 'soul', 'teleport']);
  } else if (e.type === 'boss4') {               // 바르굴: 근접 삼연참·내려찍기, 멀면 혼불 탄막
    if (near) ch = ['frost', 'slash3', 'slam', p2 ? 'frost' : 'orbs'];
    else ch = ['frost', 'orbs', 'slash3'];
  } else if (e.type === 'boss5') {               // 모르데카이: 모든 기술을 섞어 쓴다
    if (near) ch = ['eclipse', 'slam', 'charge', p2 ? 'pillars' : 'orbs'];
    else ch = ['eclipse', 'pillars', 'orbs', 'ravens'];
  } else if (near) ch = ['slash3', 'cleave', 'whirl', p2 ? 'charge' : 'pillars', 'cleave'];
  else if (Math.random() < 0.75) ch = p2 ? ['pillars', 'whirl', 'charge', 'cleave', 'slash3'] : ['pillars', 'slash3', 'charge', 'cleave', 'slash3'];
  if (!ch) return null;                            // 멀면 조금 더 다가간 뒤 다시 고른다
  const fresh = ch.filter(c => c !== e.last), list = fresh.length ? fresh : ch;
  return list[Math.floor(Math.random() * list.length)];
}
function startPat(e, pat) {
  resetBossFx(e);
  e.st = 'pat'; e.pat = pat; e.pt = 0; e.marks = {}; e.last = pat;
  e.face = player.x >= e.x ? 1 : -1;
  if(e.type==='boss2')initMorgraPattern(e);
  if(isAurelion(e))initAurelionPattern(e);
  if(isVargul(e))initVargulPattern(e);
  sfx('bwind');
}
function endPat(e, next) {
  resetBossFx(e);
  e.st = 'chase'; e.t = 0; e.wait = 0;
  e.atkCd = isSovereign(e)?sovGap(e):isVargul(e)?vargulAttackGap(e):isAurelion(e)?aurelionAttackGap(e):Math.round((700 + Math.random() * 600) * (e.type==='boss2' && phase2(e) ? 0.8 : 1) / MS);
  if (next) startPat(e, next);
}
function bossChase(e) {
  if(isVargul(e)){chaseVargul(e);return;}
  if(isSovereign(e)){chaseSovereign(e);return;}
  if(isAurelion(e)){chaseAurelion(e);return;}
  const p = player, d = e.d, dx = p.x - e.x, dy = p.y - e.y, adx = Math.abs(dx);
  e.face = dx >= 0 ? 1 : -1;
  if (p.st === 'dead') return;
  const attackers = enemies.reduce((n, o) => n + ((o !== e && (o.st === 'wind' || o.st === 'act' || o.st === 'pat')) ? 1 : 0), 0);
  const can = attackers < 3 && p.st !== 'down' && e.atkCd <= 0;
  let tx, ty = p.y;
  if (d.keepAway) tx = adx < 120 ? e.x - e.face * 60 : (adx > 200 ? p.x - e.face * 170 : e.x);   // 마녀는 거리를 둔다
  else if (can || adx < 220) tx = p.x - e.face * (d.range - 14);
  else { tx = p.x - e.face * (150 + (e.id % 3) * 35); ty = p.y + ((e.id % 2) ? 34 : -34); }
  const mx = tx - e.x, my = ty - e.y, dist = Math.hypot(mx, my), spd = d.spd;
  if (dist > 4) { e.x += mx / dist * spd; e.y += my / dist * spd * 0.8; e.walk = true; }
  if (can) {
    const pat = pickPat(e, adx, Math.abs(dy), phase2(e));
    if (pat) startPat(e, pat); else e.atkCd = 12;
  }
}
function bossTip(e) { return e.tipX !== null ? [e.tipX, e.tipH] : [e.x + e.face * 28, 130]; }
function alignY(e, k) { e.y += clamp(player.y - e.y, -k, k); }   // 근접 패턴 예비 동작 중 깊이 맞추기

function runPat(e) {
  const count=hazards.length;
  if(isVargul(e))runVargulPattern(e);else if(isSovereign(e))runSovereignPattern(e);else if(isAurelion(e))runAurelionPattern(e);else if(e.type==='boss2')runMorgraPattern(e);else runLegacyPat(e);
  for(let i=count;i<hazards.length;i++) {
    hazards[i].owner ??= e;
    hazards[i].damageScale ??= e.p2shown?(e.type==='boss2'?1.5:1.3):1;
  }
}
function runLegacyPat(e) {
  const p = player, t = e.pt, m = e.marks, p2 = false, f = e.face;
  switch (e.pat) {
    case 'frost': {
      const count = p2 ? 2 : 1;
      for (let k = 0; k < count; k++) {
        if (t >= 100 + k * 1400 && !m['cross' + k]) {
          m['cross' + k] = true;
          hazards.push({ type: 'rift', kind: 'frost', x: camX, y: p.y, width: VW, depth: 17, delay: 950, life: 320, age: 0, owner: e });
          hazards.push({ type: 'rift', kind: 'frost', x: p.x - 19, y: (GTOP + GBOT) / 2, width: 38, depth: 85, delay: 950, life: 320, age: 0, owner: e });
          sfx('bwind');
        }
      }
      if (t >= (p2 ? 3300 : 2100)) endPat(e);
      break;
    }
    case 'eclipse': {
      if (t >= 200 && !m.ring) {
        m.ring = true; hazards.push({ type: 'eclipse', x: p.x, y: p.y, age: 0, delay: 1200, life: p2 ? 1000 : 1300, owner: e }); sfx('bwind');
      }
      if (t >= 3100) endPat(e);
      break;
    }
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
        if (!m.s) { m.s = 1; shake = Math.max(shake, 8); sfx('bswing'); }
        if (e.hot && !m.h && inReach(e, p, 92, 26, 70) && hurtPlayer(12, f, false, e)) m.h = 1;
      } else { e.bdx = Math.round(6 * (1 - Math.min(1, (t - 680) / 300))); e.hot = false; }
      if (t >= 1150) endPat(e);
      break;
    }
    case 'rage': case 'charge': {                  // 붉게(금빛으로) 번쩍이며 기를 모은 뒤 잔상을 남기며 돌진
      const rage = e.pat === 'rage', wind = rage ? 550 : 450, end = rage ? 1250 : 1010;
      if (t < wind) { e.wash = Math.floor(t / (rage ? 90 : 80)) % 2 ? (rage ? '#ff2a2a' : '#ffe27a') : null; e.bdx = rage ? Math.round(Math.sin(t * 0.06)) : 0; alignY(e, 1.6); }
      else if (t < end) {
        if (!m.c) { m.c = 1; sfx('bcharge'); }
        e.wash = null; e.bdx = 0; e.hot = true;
        e.x += f * (rage ? 170 : 270) * SC / 1000 * MS;
        if (every(t, rage ? 50 : 35)) ghost(e.x, e.y, e.z, e.d.sprite, f, rage ? '#ff5a2a' : '#ffd23a', 260);
        if (rage && every(t, 50)) burst(e.x - f * 32, e.y, 4, ['#a8864a', '#a8864a', '#6a4a28']);
        if (!m.h && Math.abs(p.x - e.x) < 44 && Math.abs(p.y - e.y) < 26 && p.z < 60 && hurtPlayer(rage ? 16 : 18, f, true, e)) m.h = 1;
      } else e.hot = false;
      if (t >= (rage ? 1900 : 1700)) endPat(e);
      break;
    }
    case 'hook': {                                 // 사슬 갈고리로 끌어온 뒤 식칼 휩쓸기 연계
      if (player.grab?.owner === e) break;
      if (t < 500) alignY(e, 1.2);
      if (t >= 500 && !m.a) {
        m.a = 1; sfx('bwave');
        hazards.push({ type: 'hook', owner: e, x: e.x + f * 32, y: e.y, h: 62, dir: f, age: 0, out: true, hit: false });
      }
      if (t >= 1350) endPat(e);
      break;
    }
    case 'meat': {                                 // 플레이어의 발밑을 예고한 뒤 고기 덩어리 투척
      const n = p2 ? 2 : 1;
      for (let k = 0; k < n; k++) {
        const at = 500 + k * 340;
        if (t >= at - 420 && !m['w' + k]) {
          m['w' + k] = 1; m['tx' + k] = clamp(p.x + p.vx * 10, camX + 24, camX + VW - 24);
          m['ty' + k] = p.y; hazards.push({ type: 'meatmark', x: m['tx' + k], y: p.y, age: 0 });
        }
        if (t >= at && !m['t' + k]) {
          m['t' + k] = 1; sfx('bswing');
          hazards.push({ type: 'meat', owner: e, x0: e.x + f * 28, y0: e.y, tx: m['tx' + k], ty: m['ty' + k], age: 0, T: 760, arc: 92, h: 76 });
        }
      }
      if (t >= 500 + n * 340 + 700) endPat(e);
      break;
    }
    case 'teleport': {                             // 깃털 속으로 사라졌다가 플레이어 곁에 나타남
      e.invuln = t < 520;
      if (t < 250) { e.alpha = 1 - t / 250; if (!m.r1) { m.r1 = 1; sfx('tele'); hazards.push({ type: 'ring', x: e.x, y: e.y, h: 68, age: 0 }); } }
      else {
        if (!m.mv) {
          m.mv = 1; sfx('tele2'); const side = p.x - camX > VW / 2 ? -1 : 1;
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
          hazards.push({ type: 'orb', x: o[0], y: e.y, h: o[1], vx: Math.cos(ang) * v, vy: Math.sin(ang) * v, vh: (48 - o[1]) / flight, age: 0, pal: e.d.orb });
          sfx('orb');
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
        sfx('raven');
      }
      if (t >= 450 + n * 170 + 500) endPat(e);
      break;
    }
    case 'feather': {                              // 낮게 날아오는 붉은 깃털 투척
      const n = p2 ? 3 : 2;
      for (let k = 0; k < n; k++) {
        const at = 450 + k * 300;
        if (t >= at && !m['f' + k]) {
          m['f' + k] = 1; sfx('bwave');
          hazards.push({ type: 'feather', x: e.x + f * 40, y: e.y, h: 46, dir: f, age: 0, v: (p2 ? 150 : 125) * SC / 1000 * MS });
        }
      }
      if (t >= 450 + n * 300 + 500) endPat(e);
      break;
    }
    case 'staff': {                                // 휘두르기 뒤 지팡이를 내려쳐 보라색 충격
      if (t < 500) alignY(e, 1.4);
      if (t >= 500 && !m.a) {
        m.a = 1; sfx('bswing'); shake = Math.max(shake, 6);
        if (inReach(e, p, 104, 28, 70)) hurtPlayer(10, f, false, e);
      }
      if (t >= 1100 && !m.b) {
        m.b = 1; sfx('slam'); shake = Math.max(shake, 12);
        const cx = e.x + f * 76; burst(cx, e.y, 8, ['#ffffff', '#c8a0ff', '#7a3ac8']);
        hazards.push({ type: 'ring', x: cx, y: e.y, h: 18, age: 0 });
        if (Math.abs(p.x - cx) < 40 && Math.abs(p.y - e.y) < 28 && p.z < 24) hurtPlayer(13, f, true, e);
      }
      if (t >= 1750) endPat(e);
      break;
    }
    case 'soul': {                                 // 느리게 출발해 점점 빨라지는 유도 영혼
      const n = p2 ? 3 : 2;
      for (let k = 0; k < n; k++) {
        const at = 700 + k * 260;
        if (t >= at && !m['s' + k]) {
          m['s' + k] = 1; sfx('orb');
          hazards.push({ type: 'soul', x: e.x + f * 40, y: e.y, h: 92, vx: f * 0.8, vy: -0.25, vh: 0, age: 0 });
        }
      }
      if (t >= 700 + n * 260 + 700) endPat(e);
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
          hazards.push({ type: 'wave', colors: bossColors(e), x: e.x + f * 52, y: e.y, h: 52, dir: f, v: (p2 ? 150 : 125) * SC / 1000, age: 0 });
          shake = Math.max(shake, 5); sfx('bwave');
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
        xs.forEach((o, i) => hazards.push({ type: 'pillar', colors: bossColors(e), x: clamp(p.x + o, camX + 20, camX + VW - 20), y: p.y, age: 0, delay: 620 + i * 100, life: 650, hit: false }));
      }
      if (t >= 920 && !m.b) { m.b = 1; shake = Math.max(shake, 8); }
      if (t >= 300 + 620 + xs.length * 100 + 700) endPat(e);
      break;
    }
    case 'cleave': {                               // 머리 위에서 내리쳐 전방으로 황금 충격파
      if (t < 700) e.wash = t > 400 && Math.floor(t / 90) % 2 ? '#ffe27a' : null;
      else e.wash = null;
      if (t >= 820 && !m.a) {
        m.a = 1; e.hot = true; sfx('bwave'); shake = Math.max(shake, 16);
        hazards.push({ type: 'shock', colors: bossColors(e), x: e.x + f * 60, y: e.y, dir: f, age: 0, hit: false, gold: true });
        if (p2) hazards.push({ type: 'shock', colors: bossColors(e), x: e.x - f * 60, y: e.y, dir: -f, age: 0, hit: false, gold: true });
        burst(e.x + f * 60, e.y, 8, ['#fff3b8', '#ffd23a', '#d4a437']);
      }
      if (t >= 820 && t < 1100 && !m.h && inReach(e, p, 92, 30, 70) && hurtPlayer(16, f, true, e)) m.h = 1;
      if (t >= 1100) e.hot = false;
      if (t >= 1900) endPat(e);
      break;
    }
    case 'whirl': {                                // 검기를 두르고 회전하며 세 번 휩쓴다
      if (t < 600) e.wash = Math.floor(t / 90) % 2 ? '#ffe27a' : null;
      else e.wash = null;
      if (t >= 900 && t < 2000) {
        e.hot = true; if (!m.s) { m.s = 1; sfx('bcharge'); }
        e.x += f * 34 * SC / 1000 * MS; alignY(e, 0.8);
        [1000, 1330, 1660].forEach((at, k) => {
          if (t >= at && !m['h' + k]) {
            m['h' + k] = 1; sfx('bwave'); shake = Math.max(shake, 8);
            if (Math.abs(p.x - e.x) < 76 && Math.abs(p.y - e.y) < 32 && p.z < 18) hurtPlayer(11, f, false, e);
          }
        });
      } else e.hot = false;
      if (t >= 2400) endPat(e);
      break;
    }
  }
}
function slamImpact(e) {
  const p = player;
  shake = Math.max(shake, 16); hitStop = Math.max(hitStop, 4); sfx('slam');
  for (const d of [-1, 1]) hazards.push({ type: 'shock', colors: bossColors(e), x: e.x + d * 20, y: e.y, dir: d, age: 0, hit: false });
  burst(e.x + e.face * 30, e.y, 4, ['#fff0c0', '#f6b25a', '#a8864a']);
  if (Math.abs(p.x - e.x) < 70 && Math.abs(p.y - e.y) < 26 && p.z < 30) hurtPlayer(14, Math.sign(p.x - e.x) || 1, true, e);
}

function updEnemy(e) {
  if(updateVargulState(e))return;
  if(updateSovereignState(e))return;
  if(updateAurelionState(e))return;
  if(e.st==='reviving'){updateMorgraRevival(e);return;}
  if(e.morgraCooldown>0)e.morgraCooldown--;
  if (e.phaseT > 0 && e.st !== 'dead') {
    e.phaseT--; e.walk = false; e.flash = 0;
    if (!e.phaseT) { e.invuln = false; e.st = 'rec'; e.t = 0; e.recT = 36; }
    return;
  }
  if (e.training) { if (e.st !== 'dead') { e.st = 'chase'; e.z = 0; e.inv = 0; e.flash = Math.max(0, e.flash - 1); } return; }
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
      if (e.pat === 'swing' || e.pat === 'shoot') {
        if (e.pat === 'shoot') { e.face = dx >= 0 ? 1 : -1; e.y += clamp(dy, -0.6, 0.6); }   // 시위를 당기며 조금 조준을 따라간다
        if (e.t >= d.wind) { e.st = 'act'; e.t = 0; e.hitSet = new Set(); }
      }
      break;
    }

    case 'act': {
      if (e.pat === 'swing') {
        if (e.t <= d.act && !e.hitSet.has(p) && inReach(e, p, d.range + 8, 20, 55)) {
          if (hurtPlayer(d.dmg, e.face, !!d.kd, e)) e.hitSet.add(p);
        }
        if (e.t > d.act + 2) { e.st = 'rec'; e.t = 0; e.recT = d.rec; e.atkCd = rand(15, 45); }
      } else if (e.pat === 'shoot') {
        if (e.t === 1) { hazards.push({ type: 'arrow', owner: e, damage: d.dmg, x: e.x + e.face * 40, y: e.y, h: 50, dir: e.face, age: 0 }); sfx('swing', 0); }
        if (e.t > d.act) { e.st = 'rec'; e.t = 0; e.recT = d.rec; e.atkCd = rand(60, 110); }
      }
      break;
    }

    case 'chase': {
      if (e.boss) { bossChase(e); break; }
      if (d.ranged) { archerChase(e); break; }
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

// 궁병: 플레이어와 200~320px 거리를 두고 같은 줄로 맞춘 뒤 쏜다. 너무 가까우면 물러난다
function archerChase(e) {
  const p = player, d = e.d, dx = p.x - e.x, dy = p.y - e.y, adx = Math.abs(dx);
  if (p.st === 'dead') return;
  if (e.wait > 0) { e.wait--; return; }
  e.face = dx >= 0 ? 1 : -1;
  let mx = 0;
  if (adx < 190) mx = -e.face; else if (adx > 330) mx = e.face;
  const my = clamp(dy, -1, 1);
  if (mx || Math.abs(dy) > 2) { e.x += mx * d.spd; e.y += my * d.spd * 0.8; e.walk = true; }
  e.x = clamp(e.x, camX + 24, camX + VW - 24);
  const archers = enemies.reduce((n, o) => n + ((o !== e && o.d.ranged && (o.st === 'wind' || o.st === 'act')) ? 1 : 0), 0);
  if (e.atkCd <= 0 && archers < 2 && adx > 150 && adx < 360 && Math.abs(dy) < 18 && p.st !== 'down') startAttack(e, 'shoot');
}

// ---------------------------------------------------------------- 투사체 · 위험 지대
// 보스 공격은 깊이(y)가 맞아야 맞는다. 충격파는 점프로 넘을 수 있다
function updArena() {
  if (!arena || !camLock || player.st === 'dead' || enemies.every(e => e.st === 'dead')) return;
  arena.time += MS;
  if (arena.time < arena.next) return;
  const lanes = [370, 425, 480], safe = arena.cycle % lanes.length;
  const selected = arena.kind === 'abyss' ? lanes.filter((_, i) => i !== safe) : [lanes.reduce((a, b) => Math.abs(a - player.y) < Math.abs(b - player.y) ? a : b)];
  for (const y of selected) hazards.push({ type: 'rift', kind: arena.kind, x: camX, y, width: VW, depth: 23,
    age: 0, delay: 1200, life: 350, arena: true });
  arena.cycle++; arena.next += 5000;
}
function updHazards() {
  const p = player, off = z => z.x < camX - 60 || z.x > camX + VW + 60;
  for (const z of hazards) {
    z.age += MS;
    if(updateVargulHazard(z)||updateAurelionHazard(z)||updateMorgraHazard(z))continue;
    if (z.owner && ['dead', 'down', 'stun'].includes(z.owner.st) && ['rift', 'eclipse'].includes(z.type)) { z.dead = true; continue; }
    switch (z.type) {
      case 'rift': {
        if (z.age >= z.delay && !z.boom) { z.boom = true; sfx('pillar'); }
        const jumpLimit = z.kind === 'frost' ? 24 : 90;
        if (z.age >= z.delay && z.age <= z.delay + z.life && !z.hit && p.x >= z.x && p.x <= z.x + z.width && Math.abs(p.y - z.y) < z.depth && p.z < jumpLimit) {
          if (hurtPlayer(12, p.x < z.x + z.width / 2 ? -1 : 1, true, z)) z.hit = true;
        }
        if (z.age > z.delay + z.life + ZONE_FADE) z.dead = true;   // 지대 그림(잔불 프레임)이 사라질 시간
        break;
      }
      case 'eclipse': {
        const u = clamp((z.age - z.delay) / z.life, 0, 1), radius = 35 + u * 280;
        if (z.age >= z.delay && !z.boom) { z.boom = true; sfx('bwave'); }
        if (z.age >= z.delay && !z.hit && Math.abs(Math.hypot(p.x - z.x, (p.y - z.y) * 2) - radius) < 16 && p.z < 24) {
          if (hurtPlayer(16, Math.sign(p.x - z.x) || 1, true, z)) z.hit = true;
        }
        if (z.age > z.delay + z.life) z.dead = true;
        break;
      }
      case 'shock': {
        const fx = z.x + z.dir * z.age * 0.32;
        if (!z.hit && Math.abs(fx - p.x) < 12 && Math.abs(p.y - z.y) < 24 && p.z < 14 && hurtPlayer(14, z.dir, true, z)) z.hit = true;
        if (z.age > 1100) z.dead = true;
        break;
      }
      case 'orb':
        z.x += z.vx; z.y += z.vy; z.h = Math.max(36, z.h + z.vh);
        if (Math.abs(z.x - p.x) < 14 && Math.abs(z.y - p.y) < 16 && Math.abs(z.h - (p.z + 48)) < 44 && hurtPlayer(8, Math.sign(z.vx) || 1, false, z)) z.dead = true;
        if (z.age > 3500 || off(z) || z.y < GTOP - 40 || z.y > GBOT + 40) z.dead = true;
        break;
      case 'wave':
        z.x += z.dir * z.v * MS;
        if (Math.abs(z.x - p.x) < 20 && Math.abs(z.y - p.y) < 24 && p.z < 70 && hurtPlayer(10, z.dir, false, z)) z.dead = true;
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
          if (Math.abs(z.x - p.x) < 18 && Math.abs(z.y - p.y) < 18 && Math.abs(z.h - (p.z + 44)) < 34 && hurtPlayer(7, Math.sign(z.vx) || 1, false, z)) z.dead = true;
          if (z.h <= 0 || off(z)) z.dead = true;
        }
        break;
      case 'pillar': {
        const pr = (z.age - z.delay) / z.life;
        if (pr >= 0 && !z.boom) { z.boom = true; shake = Math.max(shake, 6); sfx('pillar'); }
        if (pr > 0.12 && pr < 0.85 && !z.hit && Math.abs(z.x - p.x) < 18 && Math.abs(z.y - p.y) < 18 && p.z < 90 &&
          hurtPlayer(14, Math.sign(p.x - z.x) || 1, true, z)) z.hit = true;
        if (z.age > z.delay + z.life) z.dead = true;
        break;
      }
      case 'hook': {
        const o = z.owner;
        if (!o || o.st !== 'pat' || o.pat !== 'hook') {
          if(p.grab?.hook===z)releaseGorathGrab();
          z.dead = true; break;
        }
        if(z.latched) {
          if(p.grab?.hook!==z)z.dead=true;
          else {z.x=p.x;z.y=p.y;z.h=58;}
          break;
        }
        if (z.out) {
          const oldX=z.x;
          z.x += z.dir * 240 * SC / 1000 * MS;
          if (!z.hit && p.x>=Math.min(oldX,z.x)-18 && p.x<=Math.max(oldX,z.x)+18 &&
              Math.abs(z.y-p.y)<GORATH_GRAB.depth)catchGorathHook(z);
          if (z.hit || Math.abs(z.x - o.x) > GORATH_GRAB.reach || off(z)) z.out = false;
        } else {
          const tx = o.x + o.face * 32; z.x += Math.sign(tx - z.x) * 10;
          if (Math.abs(z.x - tx) < 10) z.dead = true;
        }
        if (z.age > 1600) z.dead = true;
        break;
      }
      case 'meat': {
        const u = clamp(z.age / z.T, 0, 1);
        z.x = lerp(z.x0, z.tx, u); z.y = lerp(z.y0, z.ty, u); z.h = lerp(76, 0, u) + Math.sin(Math.PI * u) * z.arc;
        if (u >= 1) {
          z.dead = true; sfx('slam'); shake = Math.max(shake, 9);
          hazards.push({ type: 'splat', owner: z.owner, x: z.tx, y: z.ty, age: 0 });
          burst(z.tx, z.ty, 4, ['#a8283a', '#ffffff', '#5a1018']);
          if (Math.abs(z.tx - p.x) < 30 && Math.abs(z.ty - p.y) < 25 && p.z < 20) hurtPlayer(11, Math.sign(p.x - z.tx) || 1, true, z);
        }
        break;
      }
      case 'meatmark': if (z.age > 1180) z.dead = true; break;
      case 'splat': if (z.age > 520) z.dead = true; break;
      case 'feather':
        z.x += z.dir * z.v;
        if (Math.abs(z.x - p.x) < 20 && Math.abs(z.y - p.y) < 22 && p.z < 28 && hurtPlayer(9, z.dir, false, z)) z.dead = true;
        if (z.age > 2200 || off(z)) z.dead = true;
        break;
      case 'soul': {
        const dx = p.x - z.x, dy = p.y - z.y, dh = (p.z + 48) - z.h, d = Math.hypot(dx, dy, dh) || 1;
        const speed = (z.age < 500 ? 22 : 56) * SC / 1000 * MS, turn = Math.min(1, MS / 380);
        z.vx += (dx / d * speed - z.vx) * turn; z.vy += (dy / d * speed - z.vy) * turn; z.vh += (dh / d * speed - z.vh) * turn;
        z.x += z.vx; z.y += z.vy; z.h += z.vh;
        if (Math.hypot(z.x - p.x, z.y - p.y, z.h - (p.z + 48)) < 20 && hurtPlayer(8, Math.sign(z.vx) || 1, false, z)) z.dead = true;
        if (z.age > 3400 || off(z)) z.dead = true;
        break;
      }
      case 'ring':
        if (z.age > 420) z.dead = true;
        break;
      case 'arrow':                                // 궁병의 화살: 같은 줄을 따라 곧게 날아간다
        z.x += z.dir * 7;
        if (Math.abs(z.x - p.x) < 14 && Math.abs(z.y - p.y) < 18 && Math.abs(z.h - (p.z + 44)) < 34 && hurtPlayer(z.damage ?? 7, z.dir, false, z)) z.dead = true;
        if (z.age > 2600 || off(z)) z.dead = true;
        break;
      case 'pwave': {                              // 흑기사의 검기: 처음 닿은 적에게 적중
        z.vargulHits ||= new Set();
        strikeVargulOrbs(z.red?23:14,z.red?23:14,z.vargulHits,{x:z.x,y:z.y,h:z.h-44,face:z.dir,depth:26,damage:z.red?z.damage:Math.round(8*(p.buff>0?1.5:1))});
        const sovBlock=strikeSovereignFists(z.red?23:14,z.red?23:14,z.vargulHits,{x:z.x,y:z.y,h:z.h-44,face:z.dir,depth:26,damage:z.red?z.damage:Math.round(8*(p.buff>0?1.5:1))});
        if (sovBlock && !z.red) { z.dead = true; break; }
        if (z.red) {
          const from = z.x, step = Math.min(9, 520 - z.travel);
          z.x += z.dir * step; z.travel += step;
          for (const e of enemies) {
            if (!canHit(e) || z.hits.has(e.id) || sovBlock&&isSovereign(e) || Math.abs(e.y - z.y) >= 26 ||
                Math.abs(e.z + 44 - z.h) >= 38 ||
                e.x + e.hw < Math.min(from, z.x) - 14 || e.x - e.hw > Math.max(from, z.x) + 14) continue;
            z.hits.add(e.id); damageEnemy(e, z.damage, false, 1);
            p.sp = Math.min(SP_MAX, p.sp + 4);
          }
          if (z.travel >= 520) z.dead = true;
          break;
        }
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
  if (['pause', 'settings', 'tutorial', 'clear', 'over', 'ending'].includes(scene)) return false;
  tick++;
  if (scene === 'opening') { openingTime += MS; if (openingTime >= 18000) finishOpening(); return; }
  if (scene === 'intro') {
    if (--bannerT <= 0) scene = 'play';
    return;
  }
  if (scene === 'bossintro') { updIntro(); return; }
  if (scene !== 'play') return;
  stat.ticks++;
  if (flashT > 0) flashT -= MS;
  if (hitStop > 0) { hitStop--; return; }
  if (chain.t > 0) { chain.t -= MS; if (chain.t <= 0) chain.n = 0; }
  if (shake > 0) shake *= 0.85;

  updPlayer();
  if (scene !== 'play') return true;
  if (practice) {
    enemies.forEach(updEnemy); updHazards(); updFx(); updatePractice();
    parts = parts.filter(q => --q.life > 0); texts = texts.filter(t => --t.life > 0);
    return true;
  }

  // 카메라와 웨이브(화면 고정 전투)
  const waves = stage.waves;
  const limit = camLock ? lockAt : (waveIdx < waves.length ? waves[waveIdx].at : stage.len - VW);
  const camGoal = player.x - VW * 0.4;
  if (camGoal > camX) camX = Math.min(camGoal, limit);
  if (!camLock && waveIdx < waves.length && camX >= waves[waveIdx].at - 0.5) {
    camLock = true; lockAt = waves[waveIdx].at;
    spawnWave(waves[waveIdx]); waveIdx++;
  }
  if (camLock && enemies.every(e => e.st === 'dead')) {
    camLock = false;
    arena = null; hazards = hazards.filter(z => !z.arena);
    if (waveIdx < waves.length) goT = 300;
  }

  enemies.forEach(updEnemy);
  enemies = enemies.filter(e => !e.remove);
  updArena();
  updHazards();

  // 스테이지 클리어 판정 (보스 사망)
  if (clearT === 0 && waveIdx >= waves.length && !camLock && enemies.length === 0) { clearT = 1; AUDIO.victoryMusic(stageIdx, stageIdx + 1 >= STAGES.length); }   // 승리 BGM: 팡파르 → 개선 행진 (마지막은 엔딩곡)
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
  updFx();
  if (goT > 0) goT--;
  if (target && target.t > 0) target.t--;
  return true;
}

function updFx() {
  for (const a of impacts) a.age += MS;
  impacts = impacts.filter(a => a.age < 450);
  for (const s of bursts) s.age += MS;
  bursts = bursts.filter(s => s.age < 400);
  for (const g of ghosts) g.age += MS;
  ghosts = ghosts.filter(g => g.age < g.life);
  for (const b of bolts) b.age += MS;
  bolts = bolts.filter(b => b.age < 420);
}
// 보스 등장: 위에서 떨어져 착지(충격) → 식칼·지팡이·대검을 들어 포효 → 이름 카드. 그동안 전투는 멈춘다
function updIntro() {
  const b = introBoss;
  introT += MS;
  const duration=bossIntroDuration(b),u = introT / duration;
  if(isVargul(b))updateVargulIntro(b);
  if(isSovereign(b))updateSovereignIntro(b);
  if(isAurelion(b))updateAurelionIntro(b);
  b.z = (b.type === 'boss2' || b.type === 'boss3'||isVargul(b)||isSovereign(b)) ? 0 : 360 * (1 - ease(Math.min(1, u / 0.25)));   // 오렐리온은 떨어지지 않고 빛기둥 속에서 나타난다
  if (!introLand && u >= 0.25 && b.type !== 'boss2' && !isAurelion(b)&&!isVargul(b)&&!isSovereign(b)) {
    introLand = true; b.z = 0; shake = 22; sfx('land');
    for (let k = 0; k < 7; k++) burst(b.x + (k - 3) * 10, b.y, 4, ['#fff0c0', '#c8b890', '#8a7a5a']);
    impact(b.x, b.y, 10, 2, 1);
  }
  if (shake > 0) shake *= 0.85;
  if (flashT > 0) flashT -= MS;
  updFx();
  if (introT + .001 >= duration) { scene = 'play'; b.st = 'chase'; b.atkCd = 40; player.inv = Math.max(player.inv, 18); }
}
function introPoseT(u) { return u < 0.28 ? 0 : u < 0.5 ? 500 * ease((u - 0.28) / 0.22) : u < 0.8 ? 500 : 500 * (1 - ease((u - 0.8) / 0.2)); }
// Recovery never erases damage/death penalties. S/A require a deathless stage.
function rankOf(secs) {
  const pts = Math.max(0, 60 - stat.damage * .18 - stat.deaths * 20) + clamp((300 - secs) / 300, 0, 1) * 20 + Math.min(chain.max, 20);
  if (pts >= 85 && stat.deaths === 0) return 'S';
  if (pts >= 65 && stat.deaths === 0) return 'A';
  return pts >= 40 && stat.deaths <= 1 ? 'B' : 'C';
}
function tallyHtml() {
  const secs = Math.round(stat.ticks / 60), mm = Math.floor(secs / 60), ss = secs % 60, rk = rankOf(secs);
  const col = { S: '#ffe27a', A: '#9cf0a8', B: '#9cc3ff', C: '#c8c0e0' }[rk];
  return `최대 연속 히트 <b>${chain.max}</b> · 시간 <b>${mm}:${String(ss).padStart(2, '0')}</b> · 남은 체력 <b>${Math.max(0, player.hp)}</b><br>` +
    `누적 피해 <b>${stat.damage}</b> · 사망 <b>${stat.deaths}</b> · 랭크 <b style="color:${col};font-size:1.6em">${rk}</b>`;
}

function finishStage() {
  const p = player;
  const bonus = p.hp * 10;
  p.score += bonus;
  UX.record(stageIdx, p.score, rankOf(Math.round(stat.ticks / 60)), Math.round(stat.ticks / 60));
  UX.saveCheckpoint(stageIdx + 1 < STAGES.length ? { ...entrySnapshot(stageIdx + 1), hp: Math.min(p.max, p.hp + 40) } : null);
  if (stageIdx + 1 < STAGES.length) {
    scene = 'clear';
    $('clearTitle').textContent = `${stage.name} CLEAR!`;
    $('clearInfo').innerHTML = `${tallyHtml()}<br>남은 체력 보너스 +${bonus}<br>현재 점수 <b style="color:#ffd23f">${p.score}</b>`;
    showScreen('clear');
  } else {
    scene = 'ending';
    $('endInfo').innerHTML = `${tallyHtml()}<br>최종 점수 ${p.score}`;
    showScreen('ending');
  }
}

// =====================================================================
//  렌더링
// =====================================================================
function rect(x, y, w, h) { ctx.fillRect(x, y, w, h); }
function circle(x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }

// ---------------------------------------------------------------- 배경
// 원경: backgrounds.js 가 매 프레임 그린 192x84 도트 그림(구름·안개·불꽃·깃발이 움직임)을 4배로 키워 느리게 스크롤 (화면 좌표)
const BG_S = 4, BG_W = 192 * BG_S, HORIZON = (GTOP - OY) * Z;     // HORIZON: 화면에서 걸을 수 있는 바닥이 시작되는 줄
const BG_Y = Math.round(HORIZON) - BG_HORIZON * BG_S;            // 그림 속 지평선을 HORIZON 에 맞춘다
const srng = seed => { let v = seed >>> 0; return () => ((v = (Math.imul(v, 1664525) + 1013904223) >>> 0) / 4294967296); };
const floorCache = {};
function drawBackdrop(theme, scroll) {
  if (drawReleaseBackdrop(theme, scroll)) return;
  const img = getBackdrop(theme, tick * MS), off = scroll, first = Math.floor(off / BG_W);
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = img.topColor; rect(0, 0, W, BG_Y + 1);   // 하늘 위쪽 여백은 한 가지 색으로 (맨 윗줄을 늘이면 별이 세로줄이 된다)
  for (let n = first; n <= first + 2; n++) {
    const x = Math.round(n * BG_W - off);
    ctx.save();
    if (n % 2) { ctx.translate(x + BG_W, 0); ctx.scale(-1, 1); } else ctx.translate(x, 0);   // 좌우를 번갈아 뒤집어 이음매를 없앤다
    ctx.drawImage(img, 0, 0, 192, 84, 0, BG_Y, BG_W, 84 * BG_S);
    ctx.restore();
  }
}

// 바닥: 스테이지별 도트 지면을 한 번 그려 두고 월드와 같은 속도로 스크롤.
// 아래(카메라 쪽)로 갈수록 자갈·풀·석판이 커지는 원근을 준다. P() 는 좌우가 이어지게 감싸 찍는다
const FL_W = 320, FL_TOP = GTOP - 8, FL_H = Math.ceil((OY + VH - FL_TOP) / SC) + 2;
const FLOOR_FN = {
  stage1(L, R, P, depth) {                         // 해질녘 들판: 가운데 흙길(바큇자국), 양옆 풀밭, 지평선에 노을빛
    const G = ['#34401f', '#44552a', '#5a7034', '#728a40'], D = ['#6a4a2a', '#8a6538', '#a8814a', '#c19c60'];
    for (let y = 0; y < FL_H; y++) {
      const s = y / FL_H, top = FL_H * 0.14, bot = FL_H * 0.86;
      for (let x = 0; x < FL_W; x++) {
        const wob = Math.sin(x / 19) * 1.5 + Math.sin(x / 7 + y) * 0.6 + (R() - 0.5) * 1.6;
        const inRoad = y > top + wob && y < bot + wob, dist = Math.min(y - top - wob, bot + wob - y);
        if (inRoad) {
          const e = Math.min(1, dist / (FL_H * 0.25)), ti = clamp(Math.floor(e * 3.2 + s * 0.8 + (R() - 0.5) * 1.4), 0, 3);
          P(x, y, dist < 1.2 ? '#26301a' : D[ti]);
        } else P(x, y, G[clamp(Math.floor(s * 3.4 + (R() - 0.5) * 1.7), 0, 3)]);
      }
    }
    for (const rf of [0.36, 0.64]) {                // 바큇자국
      for (let x = 0; x < FL_W; x++) {
        const y = Math.round(rf * FL_H + Math.sin(x / 23) * 1.2), t = rf > 0.5 ? 2 : 1;
        P(x, y - 1, '#c9a46a', 0.6); for (let k = 0; k < t; k++) P(x, y + k, '#5a3c20');
      }
    }
    for (let i = 0; i < 260; i++) {                 // 흙 알갱이
      const x = R() * FL_W, y = FL_H * 0.15 + R() * FL_H * 0.7;
      P(x, y, R() < 0.5 ? '#d8b880' : '#46301c'); if (depth(y) > 1.1 && R() < 0.4) P(x + 1, y, '#d8b880');
    }
    pebbles(R, P, depth, 40, '#b8a27a', '#e0cca0', '#4a3418');
    for (let i = 0; i < 260; i++) {                 // 풀잎 (길 밖)
      const y = R() < 0.5 ? R() * FL_H * 0.14 : FL_H * 0.86 + R() * FL_H * 0.14, x = R() * FL_W, hh = 1 + Math.floor(depth(y) * 2.2);
      wline(P, x, y, x + (R() - 0.5), y - hh, '#8aa24a'); P(x, y, '#26301a'); if (hh > 2) P(x + 1, y - hh + 1, '#a8c05a');
    }
    for (let y = 0; y < 5; y++) for (let x = 0; x < FL_W; x++) P(x, y, '#e8905a', 0.38 - y * 0.07);   // 노을빛 반사
  },
  stage2(L, R, P, depth) {                         // 안개 낀 밤의 습지: 이끼 낀 진흙 + 가운데 돌길 + 달빛 비친 웅덩이
    const M = ['#16221f', '#1e2e2c', '#293c38', '#364c46'], ST = ['#34423e', '#46564e', '#58685e', '#72827a'];
    bands(L, M);
    for (let i = 0; i < 900; i++) { const x = R() * FL_W, y = R() * FL_H; P(x, y, M[(R() * 4) | 0]); }
    let y = Math.round(FL_H * 0.28), row = 0;      // 돌길: 아래로 갈수록 커지는 판석
    const y1 = Math.round(FL_H * 0.74);
    while (y < y1) {
      const hh = Math.round(3 + 6 * (y / FL_H)), tw = Math.round(hh * 2.2), off = (row % 2) * tw / 2;
      for (let x = -off; x < FL_W; x += tw) {
        const tone = (R() * 4) | 0;
        for (let j = 0; j < hh && y + j < y1; j++) for (let i = 0; i < tw; i++) {
          const grout = j === hh - 1 || i === tw - 1;
          P(x + i, y + j, grout ? '#0c1614' : ST[clamp(tone - 1 + (j < 2 || i < 2 ? 0 : 1), 0, 3)]);
        }
      }
      y += hh; row++;
    }
    for (let i = 0; i < 9; i++) {                   // 웅덩이
      const cy = 3 + R() * (FL_H - 6), s = depth(cy), rx = (8 + R() * 14) * s, ry = Math.max(2, rx * 0.22), cx = R() * FL_W;
      for (let j = -ry; j <= ry; j++) {
        const hw = rx * Math.sqrt(Math.max(0, 1 - (j * j) / (ry * ry)));
        for (let x = -hw; x <= hw; x++) P(cx + x, cy + j, x > -hw + 2 && x < hw - 2 ? (j < 0 ? '#3a6270' : '#2c4c58') : '#24404a');
      }
      for (let x = -3; x < 3; x++) P(cx + x, cy - 1, '#8ab0c0', 0.8);
      for (let x = -1; x < 2; x++) P(cx + x, cy, '#dcecf4', 0.7);
    }
    for (let i = 0; i < 160; i++) {                 // 갈대·잡초
      const x = R() * FL_W, yy = R() * FL_H, hh = 1 + Math.floor(depth(yy) * 2.5);
      if (yy > FL_H * 0.28 && yy < FL_H * 0.74) continue;
      wline(P, x, yy, x + (R() - 0.5), yy - hh, R() < 0.5 ? '#3a4a2a' : '#2a3820');
    }
    for (let yy = 0; yy < 4; yy++) for (let x = 0; x < FL_W; x++) P(x, yy, '#8cb0b0', 0.3 - yy * 0.07);   // 안개가 낀 지평선
  },
  stage3(L, R, P, depth) {                         // 황금왕의 왕좌의 방: 밝고 어두운 바둑판 석판 + 금테 융단 + 달빛 기둥
    const LT = ['#4a4562', '#585270', '#665f80'], DK = ['#241f34', '#2c2640', '#352f4a'];
    const dark = c => { const n = parseInt(c.slice(1), 16), f = v => Math.round(v * 0.82).toString(16).padStart(2, '0'); return '#' + f(n >> 16) + f((n >> 8) & 255) + f(n & 255); };
    let y = 0, row = 0;
    while (y < FL_H) {
      const hh = Math.round(4 + 9 * (y / FL_H)), tw = Math.round(hh * 2.6), off = (row % 2) * tw / 2;
      let col = 0;
      for (let x = -off; x < FL_W; x += tw, col++) {
        const base = ((col + row) & 1) ? LT[(R() * 3) | 0] : DK[(R() * 3) | 0], shadeC = dark(base);
        for (let j = 0; j < hh; j++) for (let i = 0; i < tw; i++) {
          const grout = j === hh - 1 || i === tw - 1;
          P(x + i, y + j, grout ? '#100c18' : ((i > tw * 0.82 && j > hh * 0.55) || j > hh * 0.86 ? shadeC : base));
        }
        if (R() < 0.18) wline(P, x + tw * 0.3, y + 1, x + tw * 0.5 + R() * 4, y + hh - 2, '#14101c');
      }
      y += hh; row++;
    }
    const c0 = Math.round(FL_H * 0.32), c1 = Math.round(FL_H * 0.56);   // 왕실 융단 (금테)
    for (let yy = c0; yy < c1; yy++) for (let x = 0; x < FL_W; x++) {
      const e = Math.min(yy - c0, c1 - 1 - yy);
      P(x, yy, e === 0 ? '#e8c86a' : e === 1 ? '#c9a24a' : e === 2 ? '#5e0f1a' : (((x >> 3) + yy) & 1 ? '#8a1a2a' : '#7a1624'));
    }
    for (let x = 0; x < FL_W; x += 16) {
      const my = (c0 + c1) >> 1;
      P(x, my, '#e8c86a'); P(x - 1, my, '#c9a24a'); P(x + 1, my, '#c9a24a'); P(x, my - 1, '#c9a24a'); P(x, my + 1, '#c9a24a');
    }
    for (const cx of [50, 160, 270]) {             // 높은 창에서 비스듬히 쏟아지는 달빛
      for (let yy = 0; yy < FL_H; yy++) {
        const s = yy / FL_H, x0 = cx - 10 + s * 34, w = 20 + s * 26;
        for (let x = 0; x < w; x++) P(x0 + x, yy, x > w * 0.25 && x < w * 0.75 ? '#cfe0ff' : '#9ab8ff', 0.08);
      }
    }
    for (let yy = 0; yy < 4; yy++) for (let x = 0; x < FL_W; x++) P(x, yy, '#1a1228', 0.5 - yy * 0.12);
  },
  stage4(L, R, P, depth) {                         // 얼어붙은 망자의 왕국: 눈밭 + 가운데 얼어붙은 판석 길 + 뼛조각과 마른 풀
    bands(L, ['#6e8098', '#7c8ea4', '#8a9cb0', '#98aabc', '#a8b8c8', '#b8c6d4', '#c8d4e0']);
    for (let i = 0; i < 900; i++) { const x = R() * FL_W, y = R() * FL_H; P(x, y, R() < 0.5 ? '#dce8f0' : '#8a9cb0'); }
    let y = Math.round(FL_H * 0.34), row = 0;
    const y1 = Math.round(FL_H * 0.66);
    while (y < y1) {
      const hh = Math.round(3 + 6 * (y / FL_H)), tw = Math.round(hh * 2.4), off = (row % 2) * tw / 2;
      for (let x = -off; x < FL_W; x += tw) {
        const c = ['#4a5a6c', '#56667a', '#5e6e82', '#4e5e70'][(R() * 4) | 0];
        for (let j = 0; j < hh && y + j < y1; j++) for (let i = 0; i < tw; i++) {
          P(x + i, y + j, j === hh - 1 || i === tw - 1 ? '#2a3440' : (j === 0 && R() < 0.6 ? '#dce8f0' : c));   // 판석 위에 쌓인 눈
        }
      }
      y += hh; row++;
    }
    for (let i = 0; i < 8; i++) {                   // 얼음 웅덩이
      const cy = 3 + R() * (FL_H - 6), rx = (6 + R() * 10) * depth(cy), ry = Math.max(2, rx * 0.22), cx = R() * FL_W;
      for (let j = -ry; j <= ry; j++) { const hw = rx * Math.sqrt(Math.max(0, 1 - (j * j) / (ry * ry))); for (let x = -hw; x <= hw; x++) P(cx + x, cy + j, j < 0 ? '#9ac8e8' : '#7aa8cc'); }
      P(cx - 2, cy - 1, '#ffffff'); P(cx - 1, cy - 1, '#ffffff');
    }
    for (let i = 0; i < 26; i++) { const x = R() * FL_W, yy = R() * FL_H, l = 2 + R() * 2 * depth(yy); wline(P, x, yy, x + l, yy - 1, '#ddd3ba'); P(x, yy, '#ffffff'); }   // 뼛조각
    for (let i = 0; i < 90; i++) {                  // 눈 위로 삐져나온 마른 풀
      const x = R() * FL_W, yy = R() < 0.5 ? R() * FL_H * 0.32 : FL_H * 0.68 + R() * FL_H * 0.32, hh = 1 + Math.floor(depth(yy) * 2);
      wline(P, x, yy, x + (R() - 0.5), yy - hh, '#4a4636');
    }
    for (let yy = 0; yy < 4; yy++) for (let x = 0; x < FL_W; x++) P(x, yy, '#0a121c', 0.4 - yy * 0.09);
  },
  stage5(L, R, P, depth) {                         // 검은 월식의 심연: 갈라진 흑요석 바닥, 틈마다 흐르는 용암, 재
    bands(L, ['#1a0c10', '#20101a', '#24121c', '#2a141e', '#2e1620', '#321822', '#361a24']);
    for (let i = 0; i < 700; i++) { const x = R() * FL_W, y = R() * FL_H; P(x, y, R() < 0.5 ? '#4a3a3a' : '#120608'); }
    for (let i = 0; i < 26; i++) {                  // 용암 줄기 (어두운 테두리 + 밝은 가운데)
      let x = R() * FL_W, y = R() * FL_H;
      const n = 4 + ((R() * 5) | 0);
      for (let k = 0; k < n; k++) {
        const nx = x + (4 + R() * 10) * depth(y) * (R() < 0.5 ? -1 : 1), ny = y + (R() - 0.3) * 4;
        wline(P, x, y + 1, nx, ny + 1, '#6a1a10'); wline(P, x, y, nx, ny, '#ff5a1a');
        if (depth(y) > 0.9) wline(P, x, y - 1, nx, ny - 1, '#6a1a10');
        if (R() < 0.5) P((x + nx) / 2, (y + ny) / 2, '#ffd23a');
        x = nx; y = ny;
      }
    }
    pebbles(R, P, depth, 40, '#2a1c20', '#5a3a3a', '#08040a');
    for (let i = 0; i < 18; i++) { const x = R() * FL_W, yy = R() * FL_H; P(x, yy, '#ddd3ba'); P(x + 1, yy, '#bdb298'); P(x, yy + 1, '#0a0204'); }   // 해골 조각
    for (let yy = 0; yy < 5; yy++) for (let x = 0; x < FL_W; x++) P(x, yy, '#ff5a1a', 0.3 - yy * 0.06);   // 지평선의 용암 빛
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
  if (drawStageFloor()) return;
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
const scratch = document.createElement('canvas'); scratch.width = 300; scratch.height = 330;   // 고해상도 프레임(최대 241x275 + 여백)도 들어가게
const sctx = scratch.getContext('2d');

// 피규어 1체를 버퍼에 그린다. pose 가 있으면 몸통+팔+무기 합성, 없으면 스프라이트만 (잡몹/잔상)
// o = { f, lean(앞 +), leanW(월드 방향), crouch, dx, dy(도트), flash, wash, washA, noWeapon, shOff, swing(잡몹 궤적 반지름), eyes:[x, y](스프라이트 안 눈 위치) }
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
  if (o.eyes && pose) {                            // 필살기 중 투구 속 붉은 눈빛이 번진다
    const [ex0, ey0] = o.eyes, sh = Math.round((pose.lean || 0) * face * Math.pow(Math.max(0, 1 - ey0 / (S.h - 1)), 1.2));
    const ex = cx - S.w / 2 + (face > 0 ? ex0 : S.w - 1 - ex0) + sh, ey = top + ey0 + (pose.crouch && ey0 < FIG[id].split ? Math.round(pose.crouch) : 0);
    L.put(ex, ey, '#ffffff'); L.put(ex + face, ey, '#ffb0ba'); L.put(ex - face, ey, '#ff3a4a'); L.put(ex - 2 * face, ey, '#ff3a4a', 0.7);
    L.put(ex, ey - 1, '#ff3a4a', 0.6); L.put(ex, ey + 1, '#ff3a4a', 0.6);
  }
  return { P, ax: L.w / 2, ay: PADT + S.gy, res };
}
// 버퍼를 발밑 기준점 (sx, sy) 에 찍는다. lying: 뒤로 눕힌다
// k = 버퍼 1px 의 월드 크기 (도트 SC, 고해상도 1)
function present(F, sx, sy, alpha, lying, face, gy, k = SC) {
  const L = F.P.L;
  sctx.putImageData(F.P.img, 0, 0);
  ctx.save(); ctx.imageSmoothingEnabled = false;
  if (alpha < 1) ctx.globalAlpha = Math.max(0, alpha);
  ctx.translate(Math.round(sx), Math.round(sy));
  if (lying) { ctx.scale(face, 1); ctx.translate(gy * SC * 0.5, -8); ctx.rotate(-Math.PI / 2); ctx.scale(face, 1); }
  ctx.drawImage(scratch, 0, 0, L.w, L.h, -F.ax * k, -F.ay * k, L.w * k, L.h * k);
  ctx.restore();
}
function drawShadow(sx, y, sh, z) {
  ctx.fillStyle = 'rgba(0,0,0,.35)';
  ctx.beginPath(); ctx.ellipse(sx, y, sh * SC * (1 - Math.min(z, 150) / 300), 6 * SC * 0.7, 0, 0, Math.PI * 2); ctx.fill();
}
function idleFrame(walk) { return Math.floor(tick / (walk ? 10 : 30)) % 2; }

// 동작이 바뀌는 순간(대기→공격, 1타→2타, 피격→회복, 보스 패턴 시작/끝 …) 직전 자세에서 새 자세로
// 짧게(기본 0.1초) 섞어 넘긴다. 프레임이 툭 끊기지 않고 GIF 처럼 이어진다
function blendPose(a, key, pose, dur = 100) {
  const now = tick * MS;
  if (a.pbKey !== key) { a.pbFrom = a.pbLast; a.pbT0 = now; a.pbKey = key; a.pbDur = dur; }
  const u = (now - a.pbT0) / a.pbDur;
  const out = a.pbFrom && u < 1 ? mixP(a.pbFrom, pose, ease(u)) : pose;
  a.pbLast = out;
  return out;
}
function playerFrame(lying) {
  const p = player, t = p.t * MS;
  if (lying) return 11;
  switch (p.st) {
    case 'atk': {
      if (p.atk === 'air') return 16;
      const A = ATK[p.atk];
      return t < A.wind ? 12 : (t < A.wind + A.act + A.rec * 0.35 ? 13 : 12);
    }
    case 'special': return t < 450 ? 15 : t < 620 ? 14 : t < 1260 ? 13 : t < 1650 ? 16 : t < 1900 ? 13 : 12;
    case 'skill':
      if (p.skill === 'thrust') return t < 180 ? 12 : 14;
      if (p.skill === 'slam') return t < 330 ? 12 : 13;
      if (p.skill === 'whirl') return 13;
      return t < 560 ? 16 : 13;
    case 'dash': return 14;
    case 'hurt': return t < 130 ? 10 : 11;
    case 'down': case 'dead': return 10;
    case 'cast': return 12;
    default:
      if (p.z > 0) return 16;
      if (p.walk) return 4 + Math.floor(tick * MS / 105) % 6;
      return Math.floor(tick * MS / 260) % 4;
  }
}
function playerPose(lying) {
  const p = player, t = p.t * MS;
  switch (p.st) {
    case 'atk':
      if (p.atk === 'air') {                       // 공중 내려찍기
        const r = mixP(HR, { ang: -50, hx: 10, hy: 6, lean: 6, crouch: 0 }, ease(t / 90));
        r.arc = [130, r.ang]; r.arcR = 22; return r;
      }
      { const r = heroAtk(p.combo, t); r.arcCols = ['#ffffff', '#e0e0e8', '#a0a0b0', '#5a5a66']; r.fleck = '#b01a26'; return r; }
    case 'special': return heroSpecial(t);
    case 'skill': {
      if (p.skill === 'thrust') {
        const r = mixP(HR, { ang: 5, hx: 12, hy: 1, lean: 8, crouch: 1 }, ease(Math.min(1, t / 180)));
        if (t >= 180 && t < 430) { r.arc = [30, -18]; r.arcR = 24; }
        return r;
      }
      if (p.skill === 'slam') {
        const r = t < 330 ? mixP(HR, { ang: 158, hx: -4, hy: -12, lean: -4, crouch: 1 }, ease(t / 300)) :
          mixP({ ang: -62, hx: 11, hy: 8, lean: 7, crouch: 3 }, HR, ease((t - 330) / 420));
        if (t >= 290 && t < 520) { r.arc = [158, -62]; r.arcR = 28; }
        return r;
      }
      if (p.skill === 'whirl') {
        const k = Math.max(0, Math.min(2, Math.floor((t - 150) / 130))), ang = [145, -35, 145][k];
        const r = mixP(HR, { ang, hx: 9, hy: 1, lean: 4, crouch: 1 }, ease(Math.min(1, t / 120)));
        if (t >= 150 && t < 580) { r.arc = [ang - 210, ang]; r.arcR = 30; }
        return r;
      }
      const r = t < 560 ? { ang: -52, hx: 10, hy: 6, lean: 6, crouch: 0 } :
        mixP({ ang: -62, hx: 11, hy: 9, lean: 8, crouch: 3 }, HR, ease((t - 560) / 320));
      if (t >= 520 && t < 760) { r.arc = [135, -62]; r.arcR = 28; }
      return r;
    }
    case 'dash': return mixP(HR, { ang: 15, hx: 9, hy: 3, lean: 7, crouch: 1 }, ease(Math.min(1, t / 80)));
    case 'cast': return mixP(HR, { ang: 94, hx: 3, hy: -13, lean: -2, crouch: 0 }, ease(Math.min(1, t / 260)));   // 검을 하늘로
    case 'hurt': { const a = Math.max(0, 1 - p.t / 16); return { ang: 205, hx: -2, hy: 9, lean: -6.3 * a, crouch: 2.1 * a }; }
    case 'down': case 'dead':
      return lying ? { ang: 235, hx: -2, hy: 12, lean: -12, crouch: 5 } : { ang: 205, hx: -2, hy: 9, lean: -9, crouch: 3 };
    default:
      if (p.z > 0) return { ang: 40, hx: 2, hy: 6, lean: 1, crouch: 0 };
      return p.walk ? { ang: -20, hx: 4, hy: 11, lean: 3, crouch: 0 } : HR;   // 걸을 땐 칼끝을 조금 들고, 서 있으면 낮은 자세
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
  if (drawBarelPlayer()) return;
  if (drawNamedPlayer()) return;
  if (HD.player) { drawPlayerHD(lying); return; }
  const key = (p.st === 'atk' ? 'atk' + p.atk : p.st) + (lying ? 'L' : '') + (p.st === 'free' ? (p.z > 0 ? 'j' : p.walk ? 'w' : '') : '');
  const pose = blendPose(p, key, playerPose(lying), p.st === 'hurt' ? 50 : p.st === 'atk' ? 70 : 110);
  const f = playerFrame(lying), HF = HERO_FRAMES[f] || HERO_FRAMES[0];
  const F = figure('player', p.face, pose, {
    f, shOff: [HF.lx, HF.bob],                       // 걷기·웅크림 프레임이 몸을 옮긴 만큼 어깨(팔)도 따라간다
    wash: p.flash > 0 ? '#ffffff' : (sp ? '#ff3a4a' : null), washA: p.flash > 0 ? 0.75 : 0.3,
    eyes: sp && p.t * MS < 1500 ? heroEye(f) : null });
  if (F.res) { p.tipX = p.x + (F.res.tip[0] - F.ax) * SC; p.tipH = p.z + (F.ay - F.res.tip[1]) * SC; }   // 검 끝 (뇌격 빛이 모이는 곳)
  present(F, sx, p.y - p.z, 1, lying, p.face, S.gy);
}

function drawEnemy(e) {
  if(!e.boss||e.st!=='stun'){drawEnemyBody(e);return;}
  // Render-only sway around the feet; physics and groggy duration stay fixed.
  const x=e.x-camX,y=e.y-e.z;
  ctx.save();ctx.translate(x,y);ctx.rotate(bossGroggySway(e));ctx.translate(-x,-y);
  try{drawEnemyBody(e);}finally{ctx.restore();}
}
function bossGroggySway(e){return e.face*(.018+Math.sin(e.t*.11)*.035);}
function drawEnemyBody(e) {
  if(drawVargul(e))return;
  if(drawSovereign(e))return;
  if(drawAurelion(e))return;
  if(drawMorgra(e))return;
  if (drawGorath(e)) return;
  if (drawNamedEnemy(e)) return;
  if (HD[e.d.sprite] && !e.boss) { drawLegion(e); return; }
  if (HD[e.d.sprite]) { drawEnemyHD(e); return; }
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
    if (e.st === 'intro') pose = bossPoseAt(id, 'slam', introPoseT(introT / INTRO_MS), false);   // 착지 후 무기를 치켜든다
    else if (e.st === 'pat') {
      pose = bossPoseAt(id, e.pat, e.pt, phase2(e));
      o.dx += e.bdx * e.face; o.dy = e.bdy; alpha = e.alpha;
      if (e.wash && !o.wash) { o.wash = e.wash; o.washA = 0.5; }
      if (alpha < 0.6) o.noWeapon = true;
    } else if (e.st === 'stun') {                  // 기절: 무기를 떨군 채 비틀거림
      o.leanW = (o.leanW || 0) - e.face * 2; o.crouch = Math.max(o.crouch || 0, 1);
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
    if (e.st === 'dead' && e.bolted) { o.wash = '#cfe0ff'; o.washA = 0.7; }
    if (e.st === 'wind') {                         // 공격 예고: 뒤로 젖히며 번쩍
      const k = Math.min(1, e.t / 12);
      o.lean = -6 * k; o.dx -= 3.5 * k * e.face;
      if (e.t > 6 && Math.floor(e.t / 4) % 2) { o.wash = '#ffffff'; o.washA = 0.6; }
    }
    if (e.st === 'act' && e.pat === 'swing') { o.f = 1; o.lean = 6; o.dx += 7 * e.face; o.swing = Math.round(d.range * 0.3); }
    if (e.st === 'wind' && e.pat === 'shoot') o.dx = 0;
  }
  if (pose) pose = blendPose(e, e.st + (e.pat || ''), pose, 120);          // 보스: 패턴 사이를 부드럽게
  else {                                          // 잡몹: 기울기와 밀림을 매끄럽게 따라가게
    e.sLean = (e.sLean || 0) + ((o.lean || 0) - (e.sLean || 0)) * 0.4; o.lean = e.sLean;
    e.sDx = (e.sDx || 0) + ((o.dx || 0) - (e.sDx || 0)) * 0.45; o.dx = e.sDx;
  }
  if (d.ranged && (e.st === 'wind' || (e.st === 'act' && e.t < 3))) { o.f = 1; o.lean = (o.lean || 0) - 2 * Math.min(1, e.t / 10); }   // 시위를 당긴다
  const bob = e.walk && e.z === 0 ? -Math.abs(Math.sin(tick * 0.3 + e.id)) * 3 : 0;
  const F = figure(d.sprite, e.face, pose, o);
  if (F.res) { e.tipX = e.x + (F.res.tip[0] - F.ax) * SC; e.tipH = e.z - bob + (F.ay - F.res.tip[1]) * SC; }   // 지팡이 끝 = 탄막 발사 위치
  present(F, sx, e.y - e.z + bob, alpha, lying, e.face, S.gy, SC * (e.boss ? BOSS_VISUAL_SCALE : 1));
}
function drawGhost(g) {
  if(g.aurelion&&paintAurelion(g.aurelion,g.x,g.y-g.z,g.face,.3*(1-g.age/g.life)))return;
  if(g.gorath && paintGorath(g.gorath,g.x,g.y-g.z,g.face,.3*(1-g.age/g.life),BOSS_VISUAL_SCALE))return;
  if(g.barel && paintBarel(g.barel,g,.3*(1-g.age/g.life)))return;
  if(g.named && paintNamedFrame(g.named,{...g,alpha:.3*(1-g.age/g.life)}))return;
  if (HD[g.id]) {                                  // 고해상도: 대시·돌진 프레임으로 잔상
    const F = hdFigure(g.id, HD_GHOST[g.id], g.face, { wash: g.wash, washA: 0.55 });
    present(F, g.x - camX, g.y - g.z, (g.id === 'player' ? 0.4 : 0.35) * (1 - g.age / g.life), false, g.face, 0, (HD_SCALE[g.id] || 1) * (g.id.startsWith('boss') ? BOSS_VISUAL_SCALE : 1));
    return;
  }
  const F = figure(g.id, g.face, null, { f: g.id === 'player' ? 14 : 0, lean: g.id === 'player' ? 6 : 7, wash: g.wash, washA: 0.55 });
  present(F, g.x - camX, g.y - g.z, (g.id === 'player' ? 0.4 : 0.35) * (1 - g.age / g.life), false, g.face, 0, SC * (g.id.startsWith('boss') ? BOSS_VISUAL_SCALE : 1));
}

// ---------------------------------------------------------------- 고해상도 스프라이트 (흑기사 · 보스 1~3)
// hd_sprites.js 의 아틀라스(참고 시트를 잘라 64색으로 줄인 프레임)를 풀어 쓴다. 고해상도 1px = 월드 1px (도트 1칸의 절반)
// 대검·식칼·지팡이와 궤적이 그림 안에 들어 있으므로 팔·무기 합성 없이 "상태 + 시간 → 프레임 이름"만 고른다
// The player atlas has small transparent islands inside otherwise solid armor.
// Repair these once at load time, leaving exterior air and larger pose gaps intact.
function sealSpritePinholes(L) {
  const { w, h, d } = L, seen = new Uint8Array(w * h);
  for (let start = 0; start < seen.length; start++) {
    if (seen[start] || d[start * 4 + 3]) continue;
    const pixels = [start];
    seen[start] = 1;
    let exterior = false, minX = w, minY = h, maxX = 0, maxY = 0;
    let shadow = -1, shade = Infinity;
    for (let q = 0; q < pixels.length; q++) {
      const p = pixels[q], x = p % w, y = Math.floor(p / w);
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      if (x === 0 || x === w - 1 || y === 0 || y === h - 1) exterior = true;
      for (const n of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1]) {
        if (n < 0) continue;
        const j = n * 4;
        if (d[j + 3]) {
          const light = d[j] * 3 + d[j + 1] * 6 + d[j + 2];
          if (light < shade) { shade = light; shadow = j; }
        } else if (!seen[n]) { seen[n] = 1; pixels.push(n); }
      }
    }
    // Long slits and large openings can be intentional (sword, arms, legs).
    if (exterior || pixels.length > 24 || maxX - minX >= 8 || maxY - minY >= 8 || shadow < 0) continue;
    for (const p of pixels) {
      const j = p * 4;
      d[j] = d[shadow]; d[j + 1] = d[shadow + 1]; d[j + 2] = d[shadow + 2]; d[j + 3] = 255;
    }
  }
}
const HD = {};
for (const id in HD_DATA) {
  const D = HD_DATA[id], pal = D.pal.map(c => { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; });
  const F = D.f.map(fd => {
    const L = new Layer(fd.w, fd.h), bin = atob(fd.d);
    let p = 0, bot = 0;
    for (let i = 0; i < bin.length; i += 2) {
      const v = bin.charCodeAt(i), run = bin.charCodeAt(i + 1);
      if (v) {
        const c = pal[v - 1];
        for (let k = 0; k < run; k++) { const j = (p + k) * 4; L.d[j] = c[0]; L.d[j + 1] = c[1]; L.d[j + 2] = c[2]; L.d[j + 3] = 255; }
        bot = Math.floor((p + run - 1) / fd.w);
      }
      p += run;
    }
    if (id === 'player') sealSpritePinholes(L);
    return { L, ax: fd.ax, ay: fd.ay, bot };
  });
  const cnt = {};                                  // 동작별 프레임 수 (idle_0 … idle_5 → idle: 6)
  for (const name in D.n) { const a = name.slice(0, name.lastIndexOf('_')); cnt[a] = (cnt[a] || 0) + 1; }
  HD[id] = { F, N: D.n, cnt };
}
const HD_GHOST = { player: 'skd_2', boss1: 'a4_3', boss2: 'flame_5', boss3: 'a11', boss4: 'walk_3', boss5: 'dash_10' };
// 지팡이 끝·검 끝(탄막 발사, 검기 불꽃 위치): 발밑 기준 [앞쪽 x, 높이] (월드 px)
const HD_TIP = { boss1: [40, 60], boss2: [62, 91], boss3: [44, 64], boss4: [46, 112], boss5: [52, 118] };
function hdFrame(id, name) { const H = HD[id], i = H.N[name]; return H.F[i === undefined ? 0 : i]; }
const HPAD = 24;
// 프레임 1장을 버퍼에 그린다. o = { lean(px, 앞 +), dx, crouch, flash, wash, washA, bottom(발밑 대신 그림 맨 아래를 기준점으로) }
function hdFigure(id, name, face, o) {
  const fr = hdFrame(id, name), S = fr.L, P = layerFor(S.w + HPAD * 2, S.h + HPAD * 2), L = P.L;
  blit(S, L, HPAD + Math.round(o.dx || 0), HPAD, { flip: face < 0, lean: Math.round(o.lean || 0), split: Math.round(S.h * 0.55),
    crouch: o.crouch || 0, flash: o.flash, wash: o.wash, washA: o.washA });
  return { P, ax: HPAD + (face < 0 ? S.w - 1 - fr.ax : fr.ax), ay: HPAD + (o.bottom ? fr.bot : fr.ay), fr };
}
// 프레임 맨 위 픽셀 (치켜든 검 끝): 발밑 기준 [앞쪽 x, 높이]
function hdTop(fr) {
  const L = fr.L;
  for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) if (L.d[(y * L.w + x) * 4 + 3]) return [x - fr.ax, fr.ay - y];
  return [0, fr.ay];
}

// ---- 흑기사: 상태 → 프레임
// 1타 일섬 atkb (치켜듦 → 대각선 내려베기) · 2타 역일섬 atku (낮게 → 올려베기) · 3타 참격 q (머리 위 → 땅까지 내려찍기)
function heroAtkHD(ci, t) {
  const A = HATK[ci], tw = A.wind, ta = tw + A.act;
  if (ci === 0) return t < tw * 0.55 ? 'atkb_1' : t < tw ? 'atkb_2' : t < tw + A.act * 0.85 ? 'atkb_3' : t < ta + A.rec * 0.6 ? 'atkb_4' : 'atkb_0';
  if (ci === 1) return t < tw ? 'atku_0' : t < ta + A.rec * 0.3 ? 'atku_2' : t < ta + A.rec * 0.6 ? 'atku_1' : 'atku_3';
  return t < tw * 0.5 ? 'q_1' : t < tw ? 'q_2' : t < tw + A.act * 0.6 ? 'q_3' : t < ta + A.rec * 0.45 ? 'q_4' : t < ta + A.rec * 0.8 ? 'q_6' : 'q_7';
}
// 흑월참: 기 모으기 → 돌진 → 4연 베기 → 도약 → 내려찍기(바닥 폭발) → 회수
function heroSpecialHD(t) {
  if (t < 450) return t < 260 ? 'q_7' : 'q_0';
  if (t < 620) return 'skd_2';
  if (t < 1260) return ['atkb_3', 'atku_2', 'skp_1', 'atkb_6'][Math.min(3, Math.floor((t - 620) / 160))];
  if (t < 1560) return 'skj_1';
  if (t < 1650) return 'skj_0';
  if (t < 1900) return 'skj_3';
  return 'skj_4';
}
function heroSkillHD(id, t) {
  if (id === 'thrust') return t < 100 ? 'atkc_0' : t < 200 ? 'atkc_1' : t < 260 ? 'atkc_2' : t < 360 ? 'atkc_3' : t < 480 ? 'atkc_4' : 'atkc_5';
  if (id === 'slam') return t < 300 ? 'atks_0' : t < 420 ? 'atks_1' : t < 620 ? 'atks_2' : 'atks_3';
  if (id === 'whirl') return t < 140 ? 'skp_0' : t < 520 ? (Math.floor((t - 140) / 95) % 2 ? 'skp_1' : 'skp_0') : 'skp_2';
  return t < 120 ? 'skj_1' : t < 340 ? 'skj_0' : t < 560 ? 'skj_2' : t < 720 ? 'skj_3' : 'skj_4';
}
function heroHD(lying) {
  const p = player, t = p.t * MS;
  switch (p.st) {
    case 'atk':
      if (p.atk === 'air') return { name: t < 90 ? 'skj_1' : 'skj_0', bottom: true };   // 공중 내려찍기: 칼끝을 아래로
      return { name: heroAtkHD(p.combo, t) };
    case 'special': return { name: heroSpecialHD(t) };
    case 'skill': return { name: heroSkillHD(p.skill, t), bottom: p.skill === 'leap' && t < 560 };
    case 'dash': return { name: t < 50 ? 'skd_0' : t < 120 ? 'skd_2' : 'skd_3' };
    case 'cast': return { name: t < 120 ? 'q_0' : 'q_1' };                              // 검을 하늘로
    case 'hurt': return { name: t < 110 ? 'hurt_0' : 'hurt_1' };
    case 'down':
      if (!lying) return { name: 'hurt_1', bottom: p.z > 0 };
      return { name: p.t > 44 ? 'hurt_2' : 'death_2' };                                 // 쓰러졌다가 무릎을 짚고 일어난다
    case 'dead': return { name: !lying ? 'death_0' : p.t < 40 ? 'death_1' : 'death_2' };
    default:
      if (p.z > 0) return { name: 'skj_1', bottom: true };
      if (p.walk) return { name: 'walk_' + Math.floor(tick * MS / 92) % 7 };
      return { name: 'idle_' + Math.floor(tick * MS / 230) % 4 };
  }
}
function drawPlayerHD(lying) {
  const p = player, S = SPRITES.player, sx = p.x - camX, sp = p.st === 'special', s = heroHD(lying);
  const hurtT = p.st === 'hurt' ? p.t * MS : 999, osc = p.st === 'hurt' ? Math.exp(-hurtT / 180) : 0;
  const F = hdFigure('player', s.name, p.face, {
    bottom: s.bottom, lean: -8 * osc * p.face,
    wash: p.flash > 0 ? '#ffffff' : (sp ? '#ff3a4a' : null), washA: p.flash > 0 ? 0.75 : 0.16 });
  const top = hdTop(F.fr);                         // 검 끝 (뇌격 빛이 모이는 곳)
  p.tipX = p.x + top[0] * p.face; p.tipH = p.z + top[1];
  if (p.st === 'atk' && p.combo === 2) p.tipX = p.x + p.face * 56;   // 참격이 땅에 박히는 자리
  present(F, sx, p.y - p.z, 1, false, p.face, S.gy, 1);
}

// ---- 보스 1~3: 상태 → 프레임 (패턴 타임라인은 runPat 과 같다)
function bossHD(e) {
  const t = e.pt, T = tick * MS, p2 = false, id = e.d.sprite, dt = e.t * MS, iu = introT / INTRO_MS;
  if (id === 'boss1') {                            // 도살자 고라스
    if (e.st === 'intro') return iu < 0.25 ? 'jump_0' : iu < 0.36 ? 'jump_1' : iu < 0.48 ? 'jump_2' : iu < 0.8 ? 'rage_' + Math.floor(T / 130) % 2 : 'idle_0';
    if (e.st === 'dead') return dt < 260 ? 'death_0' : dt < 520 ? 'death_1' : dt < 880 ? 'death_2' : dt < 1300 ? 'death_3' : 'death_4';
    if (e.st === 'stun') return 'idle_0';
    if (e.st === 'down') return e.z > 0 ? 'hurt_2' : e.t > 48 ? 'stun_3' : 'stun_2';
    if (e.st === 'pat') {
      if (e.pat === 'slam') {
        if (t < 250) return 'a1_0'; if (t < 500) return 'a1_1'; if (t < 650) return 'a1_2';
        if (!p2) return t < 980 ? 'a1_3' : 'a1_0';
        return t < 800 ? 'a1_3' : t < 950 ? 'a1_2' : t < 1350 ? 'a1_3' : 'a1_0';
      }
      if (e.pat === 'sweep') return t < 450 ? 'a2_0' : t < 700 ? 'a2_1' : 'a2_2';
      if (e.pat === 'rage') {
        if (t < 550) return Math.floor(t / 110) % 2 ? 'rage_3' : 'rage_2';
        if (t < 1250) return 'a4_' + (1 + Math.min(4, Math.floor((t - 550) / 140)));
        return t < 1500 ? 'a4_5' : 'a4_0';
      }
      if (e.pat === 'hook') return t < 360 ? 'a3_0' : t < 760 ? 'a3_1' : 'a3_2';
      if (e.pat === 'meat') return t < 350 ? 'a5_0' : t < 650 ? 'a5_1' : t < 1050 ? 'a5_2' : 'a5_3';
    }
    if (e.hr < 150) return e.hheavy ? 'hurt_1' : 'hurt_0';
    if (p2) return e.walk ? 'run_' + Math.floor(T / 120) % 3 : 'rage_' + Math.floor(T / 260) % 2;   // 광폭화
    return e.walk ? 'walk_' + Math.floor(T / 150) % 3 : 'idle_' + Math.floor(T / 300) % 3;
  }
  if (id === 'boss2') {                            // 까마귀 마녀 모르그라
    if (e.st === 'intro') return iu > 0.5 && iu < 0.82 ? (iu < 0.6 ? 'soul_1' : 'soul_2') : 'idle_' + Math.floor(T / 220) % 6;
    if (e.st === 'dead') return dt < 220 ? 'death_0' : dt < 520 ? 'death_1' : dt < 820 ? 'death_2' : dt < 1120 ? 'death_3' : dt < 1450 ? 'death_4' : 'death_5';
    if (e.st === 'stun') return 'idle_0';
    if (e.st === 'down') return e.z > 0 ? 'hurt_2' : e.t > 48 ? 'hurt_3' : 'death_2';
    if (e.st === 'pat') {
      if (e.pat === 'teleport') return t < 250 ? 'flame_5' : t < 500 ? 'flame_6' : 'idle_0';
      if (e.pat === 'orbs') {
        const n = p2 ? 7 : 5;
        if (t < 250) return 'flame_0'; if (t < 380) return 'flame_1'; if (t < 500) return 'flame_2';
        return t < 500 + n * 110 + 300 ? 'flame_3' : 'flame_0';
      }
      if (e.pat === 'ravens') return t < 250 ? 'gas_0' : t < 450 ? 'gas_1' : t < 1100 ? 'gas_3' : 'gas_4';
      if (e.pat === 'feather') return 'feat_' + Math.min(5, Math.floor(t / 240));
      if (e.pat === 'staff') return 'slam_' + Math.min(4, Math.floor(t / 350));
      if (e.pat === 'soul') return 'soul_' + Math.min(5, Math.floor(t / 360));
    }
    if (e.hr < 260) return 'hurt_' + (e.hheavy ? 2 : Math.min(3, Math.floor(e.hr / 90)));
    return e.walk ? 'walk_' + Math.floor(T / 120) % 8 : 'idle_' + Math.floor(T / 220) % 6;
  }
  if (id === 'boss4') {                            // 프로즌 그레이브로드
    if (e.st === 'intro') return iu < 0.42 ? 'idle_1' : iu < 0.56 ? 'wave_0' : iu < 0.66 ? 'wave_1' : iu < 0.9 ? 'intro_8' : 'idle_1';
    if (e.st === 'dead') return 'death_' + Math.min(6, Math.floor(dt / 230));
    if (e.st === 'stun') return 'idle_1';
    if (e.st === 'down') return e.z > 0 ? 'death_1' : e.t > 48 ? 'wave_0' : 'death_2';
    if (e.st === 'pat') {
      if (e.pat === 'frost') {                     // 웅크렸다가 일어서며 검을 박아 얼음을 솟구치게 한다 (2페이즈는 두 번)
        const u = p2 && t >= 1400 ? t - 1400 : t;
        return u < 300 ? 'wave_0' : u < 650 ? 'wave_1' : u < 1050 ? 'wave_2' : u < 1400 ? 'wave_7' : 'wave_2';
      }
      if (e.pat === 'slam') {                      // 서리창을 끌어 올렸다가 땅에 찍는다
        if (t < 300) return 'spear_0'; if (t < 650) return 'spear_2';
        if (!p2) return t < 1000 ? 'spear_3' : 'spear_2';
        return t < 800 ? 'spear_3' : t < 950 ? 'spear_2' : t < 1300 ? 'spear_3' : 'spear_2';
      }
      if (e.pat === 'slash3') {                    // 서리 베기: 들어 올림 → 세 방향 베기 → 낮게 마무리
        const n = p2 ? 4 : 3, gap = p2 ? 340 : 420, k = Math.min(n - 1, Math.floor(t / gap)), u = t - k * gap;
        if (t >= (n - 1) * gap + 520) return 'sk1_5';
        return u < 200 ? (k ? 'sk1_1' : 'sk1_0') : u < 260 ? 'sk1_1' : 'sk1_' + (2 + k % 3);
      }
      if (e.pat === 'orbs') {                      // 망령을 불러내 혼불을 쏜다
        const n = p2 ? 7 : 5;
        return t < 250 ? 'summon_0' : t < 500 ? 'summon_2' : t < 500 + n * 110 + 250 ? 'summon_3' : 'summon_0';
      }
    }
    return e.walk ? 'walk_' + Math.floor(T / 120) % 8 : 'idle_' + (1 + Math.floor(T / 190) % 7);
  }
  if (id === 'boss5') {                            // 블랙 문 엠페러
    if (e.st === 'intro') return iu < 0.42 ? 'dash_0' : iu < 0.56 ? 'descent_2' : iu < 0.9 ? 'descent_6' : 'idle_1';
    if (e.st === 'dead') return 'death_' + Math.min(8, Math.floor(dt / 190));
    if (e.st === 'stun') return 'idle_0';
    if (e.st === 'down') return e.z > 0 || e.t > 48 ? 'death_1' : 'death_2';
    if (e.st === 'pat') {
      if (e.pat === 'eclipse') return t < 400 ? 'sk2_0' : t < 1300 ? 'sk2_2' : t < 2000 ? 'sk2_7' : t < 2500 ? 'sk2_0' : 'idle_1';   // 종언의 월식
      if (e.pat === 'slam') return t < 250 ? 'descent_0' : t < 500 ? 'descent_1' : t < (p2 ? 1300 : 1000) ? 'descent_2' : 'descent_6';   // 암흑 강하
      if (e.pat === 'pillars') return t < 300 ? 'sk3_0' : t < 620 ? 'sk3_1' : t < 920 ? 'sk3_3' : t < 1500 ? 'sk3_11' : 'sk3_0';   // 허무의 처형식
      if (e.pat === 'orbs') {                      // 흑월 연참: 초승달 검기를 연달아 날린다
        const n = p2 ? 7 : 5;
        if (t < 250) return 'sk1_0'; if (t < 500) return 'sk1_1';
        return t < 500 + n * 110 + 150 ? 'sk1_' + (2 + Math.floor((t - 500) / 110) % 5) : 'sk1_1';
      }
      if (e.pat === 'charge') {                    // 월영 돌진
        if (t < 225) return 'dash_0'; if (t < 450) return 'dash_2';
        if (t < 1010) return Math.floor(t / 90) % 2 ? 'dash_8' : 'dash_10';
        return t < 1250 ? 'dash_14' : t < 1450 ? 'dash_17' : 'dash_0';
      }
      if (e.pat === 'ravens') {                    // 흑월 올려치기로 악령을 풀어놓는다
        const Q = [[150, 'upper_0'], [300, 'upper_1'], [450, 'upper_2'], [650, 'upper_4'], [850, 'upper_5'], [1100, 'upper_6']];
        for (const [at, name] of Q) if (t < at) return name;
        return 'upper_0';
      }
    }
    return e.walk ? 'walk_' + Math.floor(T / 115) % 8 : 'idle_' + Math.floor(T / 170) % 7;
  }
  // 황금왕 오렐리온
  if (e.st === 'intro') {                          // 빛기둥 속에서 모습을 드러낸다
    const Q = ['i0', 'i1', 'i2', 'i3', 'i5', 'i7', 'i8', 'i9'];
    return iu >= 0.78 ? 'i11' : Q[Math.min(Q.length - 1, Math.floor(iu / 0.78 * Q.length))];
  }
  if (e.st === 'dead') { const Q = ['d0', 'd1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd9', 'd10', 'd11', 'd12', 'd13']; const k = Math.floor(dt / 150); return k < Q.length ? Q[k] : 'd14'; }
  if (e.st === 'stun') return 'i11';
  if (e.st === 'down') return e.z > 0 ? 'h2' : e.t > 48 ? 'd1' : 'd3';
  if (e.st === 'pat') {
    if (e.pat === 'slash3') {
      const n = p2 ? 4 : 3, gap = p2 ? 340 : 420, k = Math.min(n - 1, Math.floor(t / gap)), u = t - k * gap;
      return u < 130 ? 'a2' : u < 260 ? 'a3' : u < 340 ? 'a4' : u < 400 ? 'a5' : 'a6';
    }
    if (e.pat === 'pillars') return t < 200 ? 's0' : t < 420 ? 's1' : t < 650 ? 's3' : t < 950 ? 's4' : t < 1400 ? 's7' : 's0';
    if (e.pat === 'charge') {
      if (t < 225) return 'a8'; if (t < 450) return 'a9';
      if (t < 1010) return Math.floor(t / 80) % 2 ? 'a10' : 'a11';
      return t < 1150 ? 'a12' : t < 1350 ? 'a13' : 'a14';
    }
    if (e.pat === 'cleave') {
      const Q = ['c0', 'c2', 'c3', 'c4', 'c6', 'c8', 'c10', 'c12', 'c14'];
      return Q[Math.min(Q.length - 1, Math.floor(t / 220))];
    }
    if (e.pat === 'whirl') {
      const Q = ['w0', 'w1', 'w4', 'w6', 'w8', 'w9', 'w11', 'w13', 'w15'];
      return Q[Math.min(Q.length - 1, Math.floor(t / 280))];
    }
  }
  if (e.hr < 260) return 'h' + [1, 2, 3, 4][Math.min(3, Math.floor(e.hr / 90))];
  return ['i11', 'i13', 'i15', 'i13'][Math.floor(T / (e.walk ? 130 : 260)) % 4];
}
// ---- 검은 달 군단 병사 (legion_sprites.js): 상태 → 프레임
// 공격 모션은 [예고, 판정, 회복] 구간마다 보여 줄 프레임 번호. 각 구간 길이는 ET 의 wind/act/rec 틱
const LEGION_ATK = {
  infantry: { atk: [[0, 1], [2, 3], [4, 5]] },
  spearman: { atk: [[0, 1], [2, 3, 4], [5]] },
  archer: { atk: [[0, 1, 2, 3], [4], [4]] },
  knight: { atk: [[0, 1], [2, 3], [4, 5]], heavy: [[0], [1, 2], [3]] },
};
const hdCount = (id, anim) => HD[id].cnt[anim] || 1;
function legionFrame(e) {
  const id = e.d.sprite, d = e.d, t = e.t, T = tick * MS + e.id * 137;
  const pick = (anim, list, u) => anim + '_' + list[Math.min(list.length - 1, Math.floor(clamp(u, 0, 0.999) * list.length))];
  const form = LEGION_ATK[id][e.form] ? e.form : 'atk', A = LEGION_ATK[id][form];
  switch (e.st) {
    case 'wind': return pick(form, A[0], t / d.wind);
    case 'act': return pick(form, A[1], t / (d.act + 2));
    case 'rec':
      if (!e.pat) return 'hurt_3';                 // 쓰러졌다가 일어나는 중
      return t < e.recT * 0.6 ? pick(form, A[2], t / (e.recT * 0.6)) : 'idle_0';
    case 'hurt': return pick('hurt', [0, 1, 2], t / 18);
    case 'down': return e.z > 0 ? 'hurt_2' : t < 46 ? 'death_' + (hdCount(id, 'death') - 1) : 'hurt_3';
    case 'dead': return 'death_' + Math.min(hdCount(id, 'death') - 1, Math.floor(t / 7));
    default: return e.walk ? 'walk_' + Math.floor(T / 95) % hdCount(id, 'walk') : 'idle_' + Math.floor(T / 170) % hdCount(id, 'idle');
  }
}
function drawLegion(e) {
  const id = e.d.sprite, sx = e.x - camX, o = e.boss ? {} : { wash: BOSS_COLORS[stageIdx], washA: .22 };
  drawShadow(sx, e.y, SPRITES[id].sh, e.z);
  if (e.hr < 400 && e.st !== 'dead' && e.st !== 'down') {   // 피격 반동: 맞은 쪽 반대로 꺾였다가 돌아온다
    const osc = Math.cos(e.hr * 0.03) * Math.exp(-e.hr / 160);
    o.lean = e.hdir * (e.hheavy ? 6 : 3.5) * osc; o.dx = e.hdir * (e.hheavy ? 4 : 2) * Math.exp(-e.hr / 160);
  }
  if (e.flash > 0) { o.wash = '#ffffff'; o.washA = 0.7; }
  else if (e.st === 'dead' && e.bolted) { o.wash = '#cfe0ff'; o.washA = 0.7; }
  else if (e.st === 'wind' && e.t > 6 && Math.floor(e.t / 4) % 2) { o.wash = '#ffffff'; o.washA = 0.3; }   // 공격 예고
  const alpha = e.st === 'dead' ? clamp(1 - (e.t - 45) / 20, 0, 1) : 1;
  present(hdFigure(id, legionFrame(e), e.face, o), sx, e.y - e.z, alpha, false, e.face, 0, HD_SCALE[id]);
}
function drawEnemyHD(e) {
  const d = e.d, id = d.sprite, S = SPRITES[id], sx = e.x - camX, o = { dx: 0 }, k = (HD_SCALE[id] || 1) * (e.boss ? BOSS_VISUAL_SCALE : 1);
  drawShadow(sx, e.y, S.sh, e.z);
  let alpha = 1;
  // 피격 반동: 맞은 쪽 반대로 꺾였다가 흔들리며 돌아온다
  if (e.hr < 600 && e.st !== 'dead' && e.st !== 'down') {
    const osc = Math.cos(e.hr * 0.03) * Math.exp(-e.hr / 200);
    o.lean = e.hdir * (e.hheavy ? 10 : 6) * osc; o.dx = e.hdir * (e.hheavy ? 6 : 3) * Math.exp(-e.hr / 160);
  }
  if (e.flash > 0) { o.wash = '#ffffff'; o.washA = 0.7; }
  let dy = 0;
  if (e.st === 'pat') {
    o.dx += e.bdx * e.face * SC / k; dy = e.bdy * SC; alpha = e.alpha;
    if (e.wash && !o.wash) { o.wash = e.wash; o.washA = 0.4; }
  } else if (e.st === 'dead') {
    const t = e.t * MS, fade = id === 'boss3' || id === 'boss5' ? 1750 : 1500;
    alpha = t < fade ? 1 : Math.max(0, 1 - (t - fade) / (2000 - fade));
    if (t < 900 && Math.floor(t / 70) % 2 === 0) { o.wash = '#ffffff'; o.washA = 0.6; }
  }
  if (id === 'boss2' && e.st !== 'dead' && e.st !== 'down') dy += Math.round(Math.sin(tick * MS * 0.004) * 2);   // 마녀는 살짝 떠 있다
  const F = hdFigure(id, bossHD(e), e.face, o), tip = HD_TIP[id];
  e.tipX = e.x + e.face * tip[0]; e.tipH = e.z - dy + tip[1];
  present(F, sx, e.y - e.z + dy, alpha, false, e.face, S.gy, k);
}

// ---------------------------------------------------------------- 이펙트 레이어 (보이는 월드를 도트 1칸 해상도로)
const FXW = VW / SC, FXH = VH / SC;
const fxCanvas = document.createElement('canvas'); fxCanvas.width = FXW; fxCanvas.height = FXH;
const fxCtx = fxCanvas.getContext('2d');
function mkFx() { const L = new Layer(FXW, FXH); return { L, img: new ImageData(L.d, FXW, FXH) }; }
const fxGround = mkFx(), fxTop = mkFx();       // 캐릭터 뒤(바닥 표식·충격파) / 캐릭터 앞(투사체·적중 이펙트)
const fxX = x => (x - camX) / SC, fxY = (y, h) => (y - (h || 0) - OY) / SC;
function presentFx(F) { fxCtx.putImageData(F.img, 0, 0); ctx.imageSmoothingEnabled = false; ctx.drawImage(fxCanvas, 0, OY, VW, VH); }

function riftWarningAlpha(z) {
  if (z.age >= z.delay) return 1;
  return Math.floor(z.age / 150) % 2 === 0 ? .95 : .24;
}
function drawGroundFx(L) {
  for (const z of hazards) {
    if (z.type === 'rift') {
      const active = z.age >= z.delay, c = z.kind === 'frost' ? '#7ad8ff' : z.kind === 'abyss' ? '#ce8cff' : '#ff965c';
      const x = fxX(z.x), y = fxY(z.y - z.depth), w = z.width / SC, h = z.depth * 2 / SC;
      const warning = riftWarningAlpha(z);
      if (active && z.age > z.delay + z.life) continue;          // 판정이 끝난 뒤에는 지대 그림만 사라지며 남는다
      L.rect(x, y, w, h, c, active ? (ZONE_IMAGES[z.kind]?.naturalWidth ? .3 : .65) : .38 * warning);
      L.line(x, y, x + w, y, c, 2, warning); L.line(x, y + h, x + w, y + h, c, 2, warning);
      L.line(x, y, x, y + h, c, 2, warning); L.line(x + w, y, x + w, y + h, c, 2, warning);
      for (let dx = 5; dx < w; dx += 16) L.line(x + dx, y + 2, x + Math.min(w, dx + 8), y + h - 2, c, 1, .65 * warning);
    } else if (z.type === 'eclipse') {
      const active = z.age >= z.delay, radius = active ? 35 + clamp((z.age - z.delay) / z.life, 0, 1) * 280 : 35;
      const c = active ? '#ff9aa6' : '#ce8cff';
      for (let i = 0; i < 96; i++) {
        const a = i * Math.PI * 2 / 96, b = (i + 1) * Math.PI * 2 / 96;
        L.line(fxX(z.x + Math.cos(a) * radius), fxY(z.y + Math.sin(a) * radius / 2),
          fxX(z.x + Math.cos(b) * radius), fxY(z.y + Math.sin(b) * radius / 2), c, active ? 3 : 2);
      }
      if (!active) warn(L, fxX(z.x), 22, z.age, fxY(z.y));
    } else if (z.type === 'shock') shockwave(L, fxX(z.x + z.dir * z.age * 0.32), z.age, z.dir, fxY(z.y), z.colors);
    else if (z.type === 'pillar' && z.age < z.delay) warn(L, fxX(z.x), 22, z.age, fxY(z.y));
    else if (z.type === 'meatmark') warn(L, fxX(z.x), 28, z.age, fxY(z.y));
    else if (z.type === 'splat') {
      const a = Math.max(0, 1 - z.age / 520), x = fxX(z.x), y = fxY(z.y);
      L.disc(x, y, 10, '#5a1018', .45 * a); L.line(x - 13, y, x + 13, y, '#a8283a', 1, .65 * a);
    }
  }
  for (const e of enemies) if (e.st === 'pat' && e.pat === 'slam' && e.pt < 650) warn(L, fxX(e.x), 70, e.pt, fxY(e.y));
}
function drawTopFx(L) {
  for (const z of hazards) {
    const x = fxX(z.x);
    if (z.type === 'orb') orb(L, x, fxY(z.y, z.h), z.vx, z.vy - z.vh, z.age, z.pal);
    else if (z.type === 'wave') goldWave(L, x, fxY(z.y, z.h), z.dir, z.colors);
    else if (z.type === 'raven') blit(spriteShaded('raven', Math.floor(z.age / 90) % 2), L, x - 7, fxY(z.y, z.h) - 4, { flip: z.st === 'dive' ? z.vx < 0 : z.x > player.x });
    else if (z.type === 'pillar' && z.age >= z.delay) pillar(L, x, z.age, (z.age - z.delay) / z.life, fxY(z.y), z.colors);
    else if (z.type === 'ring') teleportRing(L, x, fxY(z.y, z.h), z.age / 420);
    else if (z.type === 'arrow') {
      const y = Math.round(fxY(z.y, z.h)), d = z.dir;
      for (let k = 0; k < 9; k++) L.put(x - d * k, y, '#5a3a24');
      L.put(x + d, y, '#c8ccd8'); L.put(x + d * 2, y, '#ffffff'); L.put(x + d, y - 1, '#8c8e9c'); L.put(x + d, y + 1, '#8c8e9c');
      L.put(x - d * 8, y - 1, '#c8283a'); L.put(x - d * 9, y - 1, '#c8283a'); L.put(x - d * 8, y + 1, '#c8283a');
      for (let k = 1; k <= 3; k++) L.put(x - d * (9 + k * 2), y, '#ffffff', 0.3 / k);
    }
    else if (z.type === 'hook') {
      if(z.owner?.type==='boss1' && GORATH_ATLAS.naturalWidth)continue;
      const o = z.owner, y = fxY(z.y, z.h), ox = o ? fxX(o.x + o.face * 28) : x;
      L.line(ox, fxY(z.y, 58), x, y, '#4a3a32', 2); L.line(ox, fxY(z.y, 58) - 1, x, y - 1, '#b8a080', 1);
      L.arc(x, y, 5, -.6, Math.PI + .6, '#d8d0c0', 2);
    }
    else if (z.type === 'meat') {
      if(z.owner?.type==='boss1' && GORATH_ATLAS.naturalWidth)continue;
      const y = fxY(z.y, z.h); L.disc(x, y, 7, '#8a1a2a'); L.disc(x - 2, y - 2, 3, '#d85862'); L.put(x + 3, y + 2, '#f0b0a0');
    }
    else if (z.type === 'feather') {
      const y = fxY(z.y, z.h), d = z.dir;
      L.line(x - d * 8, y + 2, x + d * 6, y - 2, '#ff5a6a', 2); L.line(x - d * 6, y, x + d * 4, y, '#ffffff', 1);
    }
    else if (z.type === 'soul') {
      const y = fxY(z.y, z.h), pulse = 5 + Math.sin(z.age * .02) * 2;
      L.disc(x, y, Math.round(pulse), '#7a3ac8', .55); L.disc(x, y, 3, '#e0c8ff'); L.put(x, y - 1, '#ffffff');
    }
    else if (z.type === 'pwave') {
      const y = fxY(z.y, z.h);
      if (z.red) {
        if (NAMED_ATLAS.complete && NAMED_ATLAS.naturalWidth && namedClip('player','wave')) continue;
        const count = UX.options.lowFx ? 1 : 3;
        for (let k = count - 1; k >= 0; k--) {
          L.disc(x - z.dir * k * 7, y, 10 - k, k ? '#761729' : '#c92242', .8 - k * .18);
          L.arc(x - z.dir * k * 5, y, 13, (z.dir > 0 ? -72 : 108) * RAD,
            (z.dir > 0 ? 72 : 252) * RAD, k ? '#ff2345' : '#ffb5b9', 2, 1 - k * .2);
        }
        continue;
      }
      for (let k = 0; k < 3; k++) L.arc(x - z.dir * k * 4, y, 11, (z.dir > 0 ? -58 : 122) * RAD, (z.dir > 0 ? 58 : 238) * RAD, k ? '#7f98d8' : '#ffffff', 2, 1 - k * 0.25);
    }
  }
  for (const e of enemies) {                       // 황금왕 2페이즈: 왕관에서 불티
    if (e.type === 'boss5' && !isSovereign(e) && e.st !== 'dead')
      for (let i = 0; i < 4; i++) L.put(fxX(e.x) + (Math.random() - 0.5) * 50, fxY(e.y, e.z + 60 + Math.random() * 100), Math.random() < 0.5 ? '#ff498d' : '#c48adb');
    if (e.type === 'boss3' && !isAurelion(e) && phase2(e) && e.st !== 'dead')
      for (let i = 0; i < 5; i++) L.put(fxX(e.x) + (Math.random() - 0.5) * 16, fxY(e.y, e.z + 138) - Math.random() * 12, Math.random() < 0.5 ? '#ffd23a' : '#ff7a1a');
  }
  const p = player;
  if (p.st === 'skill' && !(NAMED_ATLAS.complete && NAMED_ATLAS.naturalWidth && namedPlayerFrame())) {
    const t = p.t * MS, px = fxX(p.x), py = fxY(p.y, p.z + 54), f = p.face;
    if (p.skill === 'thrust' && t >= 170 && t < 470) {
      const a = 1 - (t - 170) / 300;
      for (let i = 0; i < 4; i++) L.line(px - f * (8 + i * 8), py - 4 + i * 2, px + f * (20 - i * 2), py - 4 + i * 2, i ? '#ff6b78' : '#ffffff', 1, a);
    } else if (p.skill === 'whirl' && t >= 140 && t < 600) {
      const a0 = (t * 0.55) % 360;
      for (let i = 0; i < 3; i++) L.arc(px, py, 33 - i * 3, (a0 + i * 35) * RAD, (a0 + 245 + i * 35) * RAD, i ? '#ff7a88' : '#ffffff', 2, 0.9 - i * 0.2);
    } else if (p.skill === 'redwave' && t < 300) {
      L.disc(px + f * 15, py, Math.round(3 + t / 50), '#c92242', .65);
    } else if ((p.skill === 'slam' && t >= 280 && t < 610) || (p.skill === 'leap' && t >= 520 && t < 790)) {
      const age = p.skill === 'slam' ? t - 280 : t - 520;
      const r = 10 + age * 0.09;
      L.arc(px + f * 20, fxY(p.y, 4), r, Math.PI, Math.PI * 2, '#ffffff', 2, Math.max(0, 1 - age / 350));
      L.arc(px + f * 20, fxY(p.y, 4), r + 4, Math.PI, Math.PI * 2, '#ff6b78', 1, Math.max(0, .8 - age / 420));
    }
  }
  if (p.st === 'cast') {                            // 시전: 검 끝에 빛이 모이고 발밑에 고리
    const u = p.castFired ? 1 : Math.min(1, p.t * MS / MAGIC.fire), tx = fxX(p.tipX), ty = fxY(p.y, p.tipH);
    L.disc(Math.round(tx), Math.round(ty), Math.round(2 + u * 3), '#9cc3ff', 0.35);
    for (let i = 0; i < 6; i++) { const an = tick * MS * 0.012 + i * 1.047, r = (1 - u) * 14 + 3; L.put(tx + Math.cos(an) * r, ty + Math.sin(an) * r * 0.6, i % 2 ? '#ffffff' : '#9cc3ff'); }
    L.arc(fxX(p.x), fxY(p.y) - 1, Math.round(6 + u * 12), 0, 6.283, '#9cc3ff', 1, 0.5 * (1 - u * 0.5));
  }
  for (const b of bolts) drawBolt(L, b);
  for (const e of enemies) {                       // 보스 격파: 겹겹이 퍼지는 빛 고리
    if (!e.boss || e.st !== 'dead') continue;
    const t = e.t * MS;
    for (let k = 0; k < 3; k++) { const ag = t - k * 170; if (ag > 0 && ag < 750) L.arc(fxX(e.x), fxY(e.y, 68), ag * 0.1, 0, 6.283, k === 1 ? '#ffe27a' : '#ffffff', k ? 1 : 2, (1 - ag / 750) * 0.9); }
  }
  for (const a of impacts) impactFx(L, fxX(a.x), fxY(a.y, a.z), a.age, a.kind, a.dir, a.seed);
  for (const s of bursts) sparkBurst(L, fxX(s.x), fxY(s.y, s.z), s.age, s.seed, s.cols);
}
// 번개 한 줄기: 화면 위에서 땅까지 지그재그 (50ms 마다 모양이 바뀜) + 바닥 섬광
function drawBolt(L, b) {
  if (b.age < 0) return;
  const u = b.age / 380, a = Math.max(0, 1 - u * u), x0 = fxX(b.x), gy = fxY(b.y), R = srng(b.seed + Math.floor(b.age / 50));
  const pts = [[x0, 0]]; let y = 0;
  while (y < gy) { y = Math.min(gy, y + 5 + Math.floor(R() * 4)); pts.push([x0 + (R() - 0.5) * (y < gy - 6 ? 9 : 3), y]); }
  for (let i = 0; i + 1 < pts.length; i++) {
    const q0 = pts[i], q1 = pts[i + 1];
    L.line(q0[0] - 2, q0[1], q1[0] - 2, q1[1], '#6a8cff', 1, 0.3 * a); L.line(q0[0] + 3, q0[1], q1[0] + 3, q1[1], '#6a8cff', 1, 0.3 * a);
    L.line(q0[0] + 1, q0[1], q1[0] + 1, q1[1], '#9cc3ff', 1, 0.9 * a);
    L.line(q0[0], q0[1], q1[0], q1[1], '#ffffff', 2, a);
    if (i % 3 === 1 && a > 0.4) { const R2 = srng(b.seed + i); L.line(q1[0], q1[1], q1[0] + (R2() - 0.5) * 14, q1[1] + 4 + R2() * 5, '#cfe0ff', 1, 0.55 * a); }
  }
  L.disc(Math.round(x0), Math.round(gy) - 1, Math.round(9 * (1 - u)) + 2, '#cfe0ff', 0.55 * a);
  L.rect(Math.round(x0) - 14, Math.round(gy), 29, 1, '#ffffff', 0.5 * a);
}

function drawBarrel(b) {
  const sx = b.x - camX, y = b.y;
  ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(sx, y, 20, 6, 0, 0, Math.PI * 2); ctx.fill();
  if (drawItemSprite('box', sx, y, 48, 48, b.flash > 0)) return;
  ctx.fillStyle = b.flash ? '#fff' : '#8d5a2b'; rect(sx - 16, y - 44, 32, 44);
  ctx.fillStyle = b.flash ? '#fff' : '#5d3a1a'; rect(sx - 17, y - 36, 34, 5); rect(sx - 17, y - 14, 34, 5);
  ctx.fillStyle = b.flash ? '#fff' : '#a8723a'; rect(sx - 14, y - 44, 6, 44);
}

function drawItem(it) {
  const sx = it.x - camX, bob = it.z === 0 ? Math.sin(it.t * 0.1) * 3 : 0, y = it.y - it.z - 14 + bob;
  if (it.life < 200 && Math.floor(it.life / 6) % 2) return;
  ctx.save();
  const shadowScale = Math.max(.55, 1 - it.z / 150);
  ctx.translate(sx + 3, it.y + 1); ctx.scale(16 * shadowScale, 5 * shadowScale);
  const shadow = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  shadow.addColorStop(0, 'rgba(5,3,12,.58)'); shadow.addColorStop(1, 'rgba(5,3,12,0)');
  ctx.fillStyle = shadow; ctx.beginPath(); ctx.arc(0, 0, 1, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  const size = it.type === 'big' ? [38, 32] : it.type === 'potion' ? [38, 24] : it.type === 'gold' ? [36, 24] : it.type === 'scroll' ? [36, 30] : [28, 32];
  if (drawItemSprite(it.type, sx, y + 12, size[0], size[1])) return;
  if (it.type === 'potion' || it.type === 'big') {
    const big = it.type === 'big', k = big ? 1.4 : 1;
    ctx.shadowColor = big ? '#4dd2ff' : '#ff4d6d'; ctx.shadowBlur = 10;
    ctx.fillStyle = big ? '#2e9bff' : '#ff3d5a'; circle(sx, y, 9 * k);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#e8f6ff'; rect(sx - 3 * k, y - 15 * k, 6 * k, 8 * k);
    ctx.fillStyle = '#c9a063'; rect(sx - 4 * k, y - 18 * k, 8 * k, 4 * k);
    ctx.fillStyle = 'rgba(255,255,255,.6)'; circle(sx - 3 * k, y - 2 * k, 2.5 * k);
  } else if (it.type === 'scroll') {                // 뇌격 두루마리: 양피지 + 붉은 끈 + 푸른 룬
    ctx.shadowColor = '#9cc3ff'; ctx.shadowBlur = 12 + 4 * Math.sin(it.t * 0.15);
    ctx.fillStyle = '#0d0b14'; rect(sx - 14, y - 9, 28, 18); ctx.shadowBlur = 0;
    ctx.fillStyle = '#e8d8a8'; rect(sx - 10, y - 6, 20, 12); ctx.fillStyle = '#fff6d0'; rect(sx - 10, y - 6, 20, 2);
    ctx.fillStyle = '#c0a060'; rect(sx - 13, y - 8, 4, 16); rect(sx + 9, y - 8, 4, 16);
    ctx.fillStyle = '#c8283a'; rect(sx - 1, y - 6, 3, 12); ctx.fillStyle = '#9cc3ff'; rect(sx - 6, y - 2, 2, 2); rect(sx + 5, y, 2, 2);
  } else if (it.type === 'crystal') {               // 기력 수정: SP +25
    ctx.shadowColor = '#a88cff'; ctx.shadowBlur = 14;
    ctx.fillStyle = '#6a4ccc'; ctx.beginPath(); ctx.moveTo(sx, y - 14); ctx.lineTo(sx + 9, y); ctx.lineTo(sx, y + 10); ctx.lineTo(sx - 9, y); ctx.closePath(); ctx.fill();
    ctx.shadowBlur = 0; ctx.fillStyle = '#a88cff'; ctx.beginPath(); ctx.moveTo(sx, y - 14); ctx.lineTo(sx + 9, y); ctx.lineTo(sx, y); ctx.lineTo(sx - 9, y); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffffff'; rect(sx - 3, y - 8, 2, 4);
  } else if (Object.hasOwn(SCORE_ITEMS, it.type)) {
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
const PORTRAIT = { player: [18, 0, 21, 21], boss1: [14, 0, 38, 27], boss2: [14, 0, 34, 28], boss3: [21, 0, 28, 27], boss4: [19, 0, 30, 28], boss5: [27, 1, 32, 28] };   // 머리 부분 (x, y, w, h)
const portraitCache = {};
// 고해상도 초상화: 대기 프레임에서 머리 부분을 잘라 밝게 (frame, 머리 영역 한 변, 위 여백, 밝기)
const PORTRAIT_HD = { player: ['idle_0', 36, -2, 1.5], boss1: ['idle_0', 40, -3, 1.6], boss2: ['idle_0', 36, 2, 1.5], boss3: ['i11', 48, 8, 1.0], boss4: ['idle_1', 30, 2, 1.25], boss5: ['idle_1', 32, 4, 1.2] };
function portraitHD(id) {
  const [name, n, oy, gain] = PORTRAIT_HD[id], fr = hdFrame(id, name), s = fr.L;
  const on = (x, y) => s.d[(y * s.w + x) * 4 + 3] > 0;
  let y0 = 0; while (y0 < s.h && ![...Array(s.w).keys()].some(x => on(x, y0))) y0++;
  let sum = 0, cnt = 0;                            // 머리 중심: 위쪽 줄들의 평균 x
  for (let y = y0 + 4; y < Math.min(s.h, y0 + 26); y++) for (let x = 0; x < s.w; x++) if (on(x, y)) { sum += x; cnt++; }
  const x0 = Math.round(sum / Math.max(1, cnt)) - (n >> 1), yy = y0 + oy, L = new Layer(n, n);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const sx = x0 + x, sy = yy + y; if (sx < 0 || sy < 0 || sx >= s.w || sy >= s.h || !on(sx, sy)) continue;
    const i = (sy * s.w + sx) * 4, j = (y * n + x) * 4;
    for (let k = 0; k < 3; k++) L.d[j + k] = Math.min(255, s.d[i + k] * gain + 8);
    L.d[j + 3] = 255;
  }
  const c = document.createElement('canvas'); c.width = n; c.height = n; c.hd = true;
  c.getContext('2d').putImageData(new ImageData(L.d, n, n), 0, 0);
  return c;
}
function portrait(id) {
  if(id==='boss4'&&USE_VARGUL_V136&&getVargulPortrait())return getVargulPortrait();
  if(id==='boss5'&&USE_SOVEREIGN&&getSovereignPortrait())return getSovereignPortrait();
  if(id==='boss3'&&getAurelionPortrait())return getAurelionPortrait();
  if(id==='boss2' && getMorgraPortrait())return getMorgraPortrait();
  if(id==='boss1' && getGorathPortrait())return getGorathPortrait();
  if(id==='player' && BAREL_PORTRAIT.naturalWidth)return BAREL_PORTRAIT;
  if(id==='player' && NAMED_ATLAS.complete && NAMED_ATLAS.naturalWidth) {
    if(portraitCache.playerNamed)return portraitCache.playerNamed;
    const f=namedClip('player','idle');
    if(f && f.source==='player_base') {
      const c=document.createElement('canvas');c.width=c.height=64;c.hd=true;
      c.getContext('2d').drawImage(NAMED_ATLAS,f.atlas[0]+195-f.rect[0],f.atlas[1]+140-f.rect[1],140,140,0,0,64,64);
      return portraitCache.playerNamed=c;
    }
  }
  if (portraitCache[id]) return portraitCache[id];
  if (HD[id]) return (portraitCache[id] = portraitHD(id));
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
  ctx.fillStyle = '#68707a'; rect(x - 3, y - 3, w + 6, h + 6);
  ctx.fillStyle = '#b5a8a3'; rect(x - 3, y - 3, w + 6, 1); rect(x - 3, y - 3, 1, h + 6);
  ctx.fillStyle = '#3a2a08'; rect(x - 1, y - 1, w + 2, h + 2);
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, 'rgba(37,31,38,.94)'); g.addColorStop(1, 'rgba(12,9,26,.94)');
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
  const img = portrait(id), fit = Math.min(w / img.width, h / img.height), s = img.hd ? fit : Math.max(1, Math.floor(fit));
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
  if (spFull) pxText(`${UX.keyName(UX.options.bindings.KeyK)}:흑월참`, 96, 96, '#ffe14d', 8); else pxText('SP', 96, 96, '#7ad8ff', 7);
  for (let i = 0; i < MAGIC.max; i++) {             // 뇌격 두루마리 칸 (I 키)
    const x = 270 + i * 22, y = 89, on = i < p.mg;
    ctx.fillStyle = '#000'; rect(x - 3, y - 1, 20, 10);
    ctx.fillStyle = on ? '#e8d8a8' : '#2a2234'; rect(x, y, 14, 8);
    ctx.fillStyle = on ? '#c0a060' : '#3a3048'; rect(x - 2, y - 1, 2, 10); rect(x + 14, y - 1, 2, 10);
    if (on) { ctx.fillStyle = '#c8283a'; rect(x + 6, y, 2, 8); }
  }
  if (p.mg > 0) pxText(UX.keyName(UX.options.bindings.KeyI), 258, 97, '#9cc3ff', 8, 'right');

  // ---- 스테이지 패널 (오른쪽)
  panel(722, 12, 224, 50);
  pxText(stage.name, 732, 32, '#f3d26a', 10);
  krText(stage.title, 732, 54, '#ffffff', 14);
  pxText(`x${enemies.filter(e => e.st !== 'dead').length}`, 938, 32, '#ff9aa6', 9, 'right');   // 남은 적
  pxText(AUDIO.isOn() ? 'M:SOUND' : 'M:MUTE', 938, 54, AUDIO.isOn() ? '#7ad8ff' : '#7a7090', 7, 'right');

  // ---- 보스 패널 (가운데) / 아니면 최근에 때린 적 이름과 체력 (레퍼런스의 "Goblin" 표시)
  const boss = enemies.find(e => e.boss && (e.st !== 'dead' || e.t < 60));
  if (boss) {
    drawBossBar(boss);
  } else if (target && target.t > 0 && enemies.includes(target.e)) {
    const e = target.e, a = Math.min(1, target.t / 20);
    ctx.globalAlpha = a;
    krText(e.d.name, W / 2, 36, '#ffffff', 16, 'center', '#1a3a8a');
    lifeBar(W / 2 - 70, 44, 140, 7, e.hp / e.max, lagTo(e, 'hpLag', e.hp, e.max * 0.01) / e.max, ['#fff07a', '#d08a10']);
    ctx.globalAlpha = 1;
  }

  // 연속 히트 (2타부터): 숫자 + 등급 + 남은 시간 막대
  if (chain.n >= 2) {
    const big = chain.n >= 6, x = 22, y = 150;
    ctx.font = `28px ${PIX}`; ctx.textAlign = 'left';
    ctx.fillStyle = '#7a1a24'; ctx.fillText(String(chain.n), x + 3, y + 3);
    ctx.fillStyle = big ? '#ffe27a' : '#ffffff'; ctx.fillText(String(chain.n), x, y);
    const w = ctx.measureText(String(chain.n)).width;
    pxText('HIT', x + w + 8, y, '#ffffff', 12);
    const rank = chain.n >= 10 ? 'EXCELLENT' : chain.n >= 6 ? 'GREAT' : chain.n >= 3 ? 'GOOD' : '';
    if (rank) pxText(rank, x, y + 20, '#f3d26a', 9);
    ctx.fillStyle = '#000'; rect(x - 1, y + 27, 102, 6); ctx.fillStyle = '#f3d26a'; rect(x, y + 28, 100 * Math.max(0, chain.t) / CHAIN_MS, 4);
  }

  // GO 화살표
  if (arena && camLock) {
    const help = { fire: '화염 지대 · 표식이 없는 줄로 이동하세요', frost: '서리 지대 · 표식을 벗어나거나 점프로 피하세요', abyss: '심연 지대 · 표식이 없는 줄이 안전합니다' };
    outlineText(help[arena.kind], W / 2, H - 116, '#ffe27a', 'bold 15px sans-serif');
  }
  if (goT > 0 && Math.floor(tick / 20) % 2 === 0) { krText('GO', W - 120, H / 2 - 30, '#ffd23f', 40); krText('➜', W - 60, H / 2 - 30, '#ffd23f', 40); }
  updateSkillButtons();
}

function updateSkillButtons() {
  document.querySelectorAll('.skillbtn').forEach(b => {
    const id = b.dataset.skill, cd = player ? player.skillCd[id] : SKILLS[id].cd;
    const ratio = clamp(cd / SKILLS[id].cd, 0, 1), ready = canStartSkill(id);
    b.style.setProperty('--cool', ratio.toFixed(3));
    b.classList.toggle('ready', ready);
    b.dataset.cooldown = cd > 0 ? (cd / 1000).toFixed(1) : '';
    b.disabled = !ready;
    const status = ready ? '준비 완료' : cd > 0 ? `${(cd / 1000).toFixed(1)}초` : scene !== 'play' ? '일시정지' : player.z > 0 ? '착지 후 사용' : '동작 종료 후 사용';
    b.title = `${SKILLS[id].name} · ${status}`;
    b.setAttribute('aria-label', b.title);
    const label = b.querySelector('.state'); if (label) label.textContent = status;
  });
  document.querySelectorAll('#touchControls [data-control]').forEach(b => {
    const id = SKILL_KEYS[b.dataset.control];
    if (id) {
      const cd = player ? player.skillCd[id] : 0;
      b.disabled = !canStartSkill(id);
      b.title = cd > 0 ? `${(cd / 1000).toFixed(1)}초` : b.disabled ? '동작 종료 후 사용' : '준비 완료';
      b.style.setProperty('--cool', clamp(cd / SKILLS[id].cd, 0, 1).toFixed(3));
      b.dataset.cooldown = cd > 0 ? Math.ceil(cd / 1000) : '';
      b.classList.toggle('ready', !b.disabled);
    }
  });
  if (player) {
    $('touchPad').querySelector('.t-special').classList.toggle('ready', player.sp >= SP_MAX);
    $('touchPad').querySelector('.t-magic').dataset.count = player.mg;
  }
}

function drawEnemyOverlay(e) {                     // 월드 좌표: 기절 별, 공격 예고 !
  if (e.st === 'dead') return;
  const h = isAurelion(e)?240*AURELION_K:e.d.h * e.d.s, sx = e.x - camX, top = e.y - e.z - h;
  if (e.st === 'stun') {
    for (let i = 0; i < 4; i++) {
      const a = tick * 0.12 + i * Math.PI / 2;
      ctx.fillStyle = '#ffe14d'; circle(sx + Math.cos(a) * 34, top + 8 + Math.sin(a) * 9, 5);
    }
  }
  const tele=e.type==='boss2'?(morgraMoves[e.morgraMove]?.phases?.startup?.[1]+1||0)*MS:(TELE[e.pat]||0);
  const warnNow = isSovereign(e)?(sovereignWarning(e)&&Math.floor(tick*MS/110)%2===0):isVargul(e)?(vargulTelegraph(e)?.warning&&Math.floor(e.pt/110)%2===0):isAurelion(e)?(aurelionTelegraph(e)?.warning&&Math.floor(e.pt/110)%2===0):(e.st === 'wind' && e.t > 2) || (e.st === 'pat' && e.pt < tele && Math.floor(e.pt / 110) % 2 === 0);
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
  if (UX.options.shake && shake > 0.5 && scene !== 'pause' && scene !== 'settings') ctx.translate(rand(-shake, shake) * 0.6, rand(-shake, shake) * 0.6);
  drawBackdrop(theme, camX * Z);
  ctx.save(); ctx.scale(Z, Z); ctx.translate(0, -OY);         // ↓ 월드 좌표 (1.5배 줌)
  drawFloor(theme);
  drawVargulRemains();drawVargulHazards(true);drawSovereignGround();
  if (stage) {
    fxGround.L.clear(); drawGroundFx(fxGround.L); presentFx(fxGround);
    const sp = player.st === 'special' ? player.t * MS : -1;
    // y 순서로 정렬해서 그린다 (필살기 중에는 흑기사와 그 잔상만 어둠 위에 따로 그림)
    const list = [];
    barrels.forEach(b => list.push({ y: b.y, f: () => drawBarrel(b) }));
    items.forEach(i => list.push({ y: i.y, f: () => drawItem(i) }));
    enemies.forEach(e => list.push({ y: e.y, f: () => drawEnemy(e) }));
    sovereignDrawList(list);
    hazards.forEach(z => { if (zoneEruptionVisible(z)) list.push({ y: z.y, f: () => drawZoneEruption(z) }); });
    ghosts.forEach(g => { if (sp < 0 || g.id !== 'player') list.push({ y: g.y - 0.5, f: () => drawGhost(g) }); });
    if (sp < 0) list.push({ y: player.y, f: drawPlayer });
    list.sort((a, b) => a.y - b.y).forEach(l => l.f());
    if (sp >= 0) {                                 // 흑월참: 배경과 적을 어둡게
      const k = sp < 200 ? 1 - 0.65 * (sp / 200) : (sp > 1900 ? 0.35 + 0.65 * ((sp - 1900) / 200) : 0.35);
      ctx.fillStyle = `rgba(16,2,8,${(1 - k).toFixed(3)})`; rect(-40, OY - 40, VW + 80, VH + 80);
      ghosts.forEach(g => { if (g.id === 'player') drawGhost(g); });
      drawPlayer();
    }

    if (player.st === 'cast' && !player.castFired) {   // 뇌격 직전: 화면이 푸르게 어두워진다
      ctx.fillStyle = `rgba(10,16,48,${(0.32 * Math.min(1, player.t * MS / 300)).toFixed(3)})`; rect(-40, OY - 40, VW + 80, VH + 80);
    }
    for (const q of parts) { ctx.fillStyle = q.col; rect(q.x - camX - 2, q.y - q.z - 2, 4, 4); }
    fxTop.L.clear(); drawTopFx(fxTop.L); presentFx(fxTop);
    for(const z of hazards)if(z.type==='pwave' && z.red) { if(BAREL_ATLAS.naturalWidth)barelEffect('wave',(z.age%360)/360,z.x,z.y-z.h+60,180,150,z.dir);else drawNamedWave(z); }
    enemies.forEach(drawEnemyOverlay);
    drawGorathHazards();
    drawMorgraHazards();
    drawAurelionHazards();
    drawVargulHazards(false);
    drawSovereignTop();
    drawGorathGrab();
    for (const t of texts) outlineText(String(t.txt), t.x - camX, t.y, t.col, 'bold 16px sans-serif');
  }
  ctx.restore();
  drawVignette();
  ctx.restore();
  if (UX.options.flash && flashT > 0) { ctx.fillStyle = `rgba(${flashCol},${Math.min(0.55, flashT / 220 * 0.55).toFixed(3)})`; rect(0, 0, W, H); }
  if (scene === 'bossintro' || (scene === 'pause' && resumeScene === 'bossintro')) { drawIntroCard(introT / bossIntroDuration(introBoss)); if (introBoss&&!isVargul(introBoss)) drawBossBar(introBoss); }
  else if (stage && player) drawHUD();

  if (scene === 'intro' || (scene === 'pause' && resumeScene === 'intro')) {
    const a = clamp(Math.min(bannerT, 160 - bannerT) / 25, 0, 1);
    ctx.globalAlpha = a; ctx.fillStyle = 'rgba(0,0,0,.6)'; rect(0, H / 2 - 70, W, 140);
    outlineText(stage.name, W / 2, H / 2 - 10, '#ffd23f', 'bold 56px sans-serif');
    outlineText(stage.title, W / 2, H / 2 + 38, '#fff', 'bold 28px sans-serif');
    ctx.globalAlpha = 1;
  }
  if (clearT > 20 && scene === 'play') outlineText('VICTORY!', W / 2, H / 2 - 20, '#ffd23f', 'bold 64px sans-serif');
  drawVargulDebug();
}

// 보스 등장: 위아래 검은 띠(시네마 화면) + 미끄러져 들어오는 이름 카드
function drawIntroCard(u) {
  const b = introBoss, bh = Math.round(64 * ease(Math.min(1, u * 7)) * (u > 0.9 ? 1 - (u - 0.9) * 10 : 1));
  ctx.fillStyle = '#05030a'; rect(0, 0, W, bh); rect(0, H - bh, W, bh);
  if (u > 0.42 && u < 0.92) {
    const k = ease((u - 0.42) / 0.12), fade = u > 0.84 ? 1 - (u - 0.84) / 0.08 : 1, off = Math.round((1 - k) * 240), y = H - 120;
    ctx.globalAlpha = Math.max(0, fade);
    ctx.fillStyle = 'rgba(5,3,10,.55)'; rect(0, y - 46, W, 92);
    pxText(`STAGE ${stageIdx + 1}`, W / 2 - off, y - 22, '#ffffff', 11, 'center');
    krText(b.d.name, W / 2 + off, y + 14, '#ffe27a', 34, 'center', '#7a1a24');
    pxText(b.d.en, W / 2 + off, y + 38, '#f3d26a', 10, 'center');
    const lw = Math.round(360 * k); ctx.fillStyle = '#dcb444'; rect(W / 2 - lw / 2, y + 46, lw, 2);
    ctx.globalAlpha = 1;
  }
}

function renderIdle() {   // 타이틀/튜토리얼 뒤 배경: 스테이지 풍경이 흐르고 흑기사가 망토를 휘날리며 서 있다
  camX = tick * 0.6;
  const theme = ['stage1', 'stage2', 'stage3', 'stage4', 'stage5'][Math.floor(tick / 600) % 5];
  drawBackdrop(theme, camX * Z);
  ctx.save(); ctx.scale(Z, Z); ctx.translate(0, -OY); drawFloor(theme); ctx.restore();
  if (scene === 'title') {
    ctx.save(); ctx.scale(2.6, 2.6);
    ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.beginPath(); ctx.ellipse(96, 190, 34, 6, 0, 0, Math.PI * 2); ctx.fill();
    if (HD.player) present(hdFigure('player', 'idle_' + Math.floor(tick * MS / 230) % 4, 1, {}), 96, 190, 1, false, 1, 0, 1);
    else {
      const f = Math.floor(tick * MS / 260) % 4;
      present(figure('player', 1, HR, { f, shOff: [HERO_FRAMES[f].lx, HERO_FRAMES[f].bob] }), 96, 190, 1, false, 1, SPRITES.player.gy);
    }
    ctx.restore();
  }
  drawVignette();
}

// ---------------------------------------------------------------- 루프
let last = 0, acc = 0;
function loop(t) {
  const real = Math.min(100, t - last); last = t;
  const frozen = ['pause', 'settings', 'tutorial', 'clear', 'over', 'ending'].includes(scene);
  acc += frozen ? 0 : slowT > 0 ? real * 0.3 : real;
  if (!frozen && slowT > 0) slowT -= real;
  while (acc >= MS) {
    const processed = update(); acc -= MS;
    if (processed) for (const k in pressed) { pressed[k] -= MS; if (pressed[k] <= 0) delete pressed[k]; }
  }
  ctx.setTransform(RENDER_K, 0, 0, RENDER_K, 0, 0);   // 960x540 좌표계를 실제 해상도로 확대
  if (scene === 'title' || (scene === 'tutorial' && helpFrom !== 'pause') || (scene === 'settings' && settingsFrom === 'title')) { ctx.clearRect(0, 0, W, H); renderIdle(); }
  else if (scene === 'opening') drawOpening();
  else render();
  $('playPause').hidden = !['play', 'intro', 'bossintro'].includes(scene);
  $('skillbar').hidden = scene !== 'play';
  syncTouchControls();
  $('practiceGuide').hidden = !practice || scene !== 'play';
  requestAnimationFrame(loop);
}
UX.mount();
fitCanvas();
requestAnimationFrame(t => { last = t; loop(t); });
