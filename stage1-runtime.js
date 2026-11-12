'use strict';
// =====================================================================
//  1스테이지 "도살자들의 거리 → 피의 투기장": 구간(section) 진행
//  구간 = 배경 1장(stage1-bg-art.js) + 이벤트 목록. 구간마다 월드 x 는 0 부터 다시 시작한다.
//  이벤트: lock(화면 고정 전투, 동시 인원 max) / boss. 등장 경로(from): right·left·door@·cage@·balcony@·wallbreak@
//  화염병 투척자 + 바닥 불, 발코니 적, 좁은 길(depth.top), 벽 파괴 등장, 철문 열림도 여기서 처리한다.
//  ?section=N (1~5) 으로 해당 구간에서 바로 시작한다.
// =====================================================================

// 새 적 id → 임시로 쓰는 기존 그림·전투 수치 (그림이 생기면 이 표에서 지운다)
const ENEMY_ALIAS = {};
const STAGE1_ENEMY_NAMES = { axe: '도끼 도적', blade: '칼 도적', club: '곤봉잡이', heavy: '도살 중갑병', molotov: '화염병 투척자', hound: '사냥개' };
// 살갗의 도살자들: 그림은 stage1-enemy-art.js(tools/enemy_sheets.py), 수치는 여기. 체력·피해는 스테이지 배율 없이 이 값 그대로.
// J = 바렐 기본 1타(일섬) 피해. range 는 다가가서 공격을 시작하는 거리(무기 끝 + 여유).
const S1_J = COMBAT_FRAME_DATA.barel.combo.moves.c1.damage;
const STAGE1_ET = {
  axe:     { name: '도끼 도적', sprite: 'infantry', hp: 40, spd: 1.2, dmg: Math.round(.8 * S1_J), range: 58, rec: 30, kb: 3, score: 120, h: 102, s: 1, hw: 18 },
  blade:   { name: '칼 도적', sprite: 'infantry', hp: 32, spd: 1.2 * 1.2, dmg: Math.round(.5 * S1_J), range: 62, rec: 30, kb: 2, score: 140, h: 107, s: 1, hw: 18 },
  club:    { name: '곤봉잡이', sprite: 'infantry', hp: 55, spd: 1.2 * .85, dmg: Math.round(1.2 * S1_J), range: 150, rec: 30, kb: 4, score: 160, h: 94, s: 1, hw: 20 },
  heavy:   { name: '도살 중갑병', sprite: 'knight', hp: 150, spd: 1.2 * .7, dmg: Math.round(.6 * S1_J), range: 84, rec: 30, kb: 2, score: 500, h: 138, s: 1, hw: 26 },
  molotov: { name: '화염병 투척자', sprite: 'archer', hp: 30, spd: 1.5, dmg: 4, range: 260, rec: 30, kb: 3, score: 150, h: 97, s: 1, hw: 18, ranged: true },
  hound:   { name: '사냥개', sprite: 'spearman', hp: 18, spd: 1.2 * 1.8, dmg: Math.round(.2 * S1_J), range: 330, rec: 30, kb: 3, score: 90, h: 50, s: 1, hw: 22 },
};
// 그림 칸 길이(틱). 기상: 8,6,6,6,6,8 (사냥개는 각 5틱) — 그 뒤 기존 일반 적 규칙대로 기상 직후 20틱은 공격하지 않는다(rec)
const S1_ANIM = { getup: [8, 6, 6, 6, 6, 8], houndGetup: [5, 5, 5, 5, 5, 5], throwFollow: [3, 4, 5, 5, 6], afterGetup: 20,
  dive: [6, 6, 4, 4, 4, 4, 5, 5, 5, 6], trip: [[3, 6], [4, 20], [5, 30]], houndKd: [4, 4, 4, 6, 10], houndHurt: 4 };
// 사냥개 물기 다이빙: 거리 180~330px·깊이 18px 이하에서, 도약 거리 = 화면 폭의 1/4, 높이 40, 판정 깊이 = 일반 적의 0.8배
const HOUND = { ring: [220, 320], near: 180, far: 330, lane: 18, leap: 160 /* 화면 폭 640의 1/4 */, leapH: 40, depthMul: .8, cd: [150, 200],
  every: 30, hold: 90, dmg: .2 };
function animIndex(lens, t) { let acc = 0; for (let i = 0; i < lens.length; i++) { acc += lens[i]; if (t < acc) return i; } return lens.length - 1; }
// 동작: len = 프레임별 틱, hits = 판정 프레임(1부터) 범위와 피해(J 배수). 판정 상자의 앞 거리는 그림에서 잰 무기 끝(tip)으로 정한다.
// warnTo = 이 프레임까지 예고(머리 위 "!"), dash/lunge = 앞으로 이동(바렐 키 × 배수 / 틱), armor = 일반 공격에 경직되지 않는 프레임
const S1_MOVES = {
  axe:   { attack: { len: [4, 4, 4, 5, 3, 3, 5, 5, 5, 5], warnTo: 4, hits: [{ f: [5, 6], dmg: .8 }] } },
  blade: { atk1: { len: Array(10).fill(3), warnTo: 3, hits: [{ f: [4, 4], dmg: .5 }], next: 'atk2' },
           atk2: { len: Array(10).fill(3), warnTo: 0, hits: [{ f: [6, 7], dmg: .5, reachMul: 1.6 }], next: 'atk3' },
           atk3: { len: Array(10).fill(4), warnTo: 0, hits: [{ f: [5, 6], dmg: .8, kd: true }] } },
  club:  { attack: { len: [6, 5, 5, 5, 5, 5, 4, 6, 6, 6], warnTo: 3, dash: [4, 6, .08], armor: [4, 6], hits: [{ f: [7, 8], dmg: 1.2, kd: true }] } },
  heavy: { spin: { len: [6, 5, 5, 4, 4, 4, 4, 4, 5, 8], warnTo: 3, hits: [{ f: [4, 5], dmg: .6, radial: true }, { f: [6, 8], dmg: .6, radial: true, kd: true }] },
           grab: { len: [5, 5, 4, 3, 3, 4, 5, 5, 5, 5], warnTo: 2, dash: [3, 5, .06], grab: [5, 6] } },
};
const HEAVY_GRAB = { cd: 300, every: 40, dmg: .3, squeezes: 3, throwDmg: .6, escapeStun: 30, chokeTpf: 6, near: 1 };
const MOLOTOV = { near: 260, far: 420, wind: 30, flight: 40, restMin: 90, restMax: 140, kickWind: 14, kickAct: 6, kickDmg: 4, kickCd: 90 };
const FIRE = { rx: 70, ry: 22, life: 150, fade: 30, every: 20, dmg: 3, max: 3 };
// 실제 2층 발코니 바닥은 바닥선 위 약 232~251px(월드)라 카메라 위로 잘린다(stage1_bg.json marks.balconyDeckH).
// 보이는 높이(몸 전체가 화면 안)로 낮추고, 발밑에 나무 발판을 그려 "위층에 서 있는" 모습으로 만든다.
const BALCONY_H = 92;

const STAGE1_SECTIONS = [
  { bg: 'street', name: '점령당한 거리', barrels: [520],
    events: [
      { at: .25, max: 3, spawns: [['axe', 'right'], ['club', 'left'], ['axe', 'right']] },
      { at: .65, max: 3, spawns: [['blade', 'right'], ['axe', 'door@shopDoor'], ['club', 'left'], ['axe', 'right']] },
    ] },
  { bg: 'market', name: '정육 시장', barrels: [1000, 2250],
    events: [
      { at: .20, max: 3, spawns: [['molotov', 'balcony@.40'], ['axe', 'right'], ['blade', 'left'], ['club', 'right']] },
      { at: .50, max: 4, spawns: [['molotov', 'balcony@.60'], ['molotov', 'right'], ['blade', 'right'], ['axe', 'left']] },
      { at: .82, max: 4, spawns: [['molotov', 'balcony@.88'], ['molotov', 'balcony@.75'], ['axe', 'right'], ['axe', 'right'], ['club', 'left'], ['blade', 'left']] },
    ] },
  { bg: 'kennel', name: '개 사육장 뒷골목', depth: { top: .5 }, barrels: [700],
    events: [
      { at: .35, max: 4, spawns: [['hound', 'cage@cageDoor'], ['hound', 'cage@cageDoor', 30], ['hound', 'cage@cageDoor', 30], ['axe', 'right']] },
      { at: .75, max: 4, spawns: [['hound', 'right'], ['hound', 'right'], ['club', 'left'], ['blade', 'right']] },
    ] },
  { bg: 'plaza', name: '투기장 앞 광장', gate: true,
    events: [
      { at: .45, max: 3, spawns: [['heavy', 'wallbreak@crackedWall'], ['axe', 'right'], ['blade', 'left']] },
    ] },
  // 보스: 도살자 고라스 리메이크(gorath-remake-runtime.js). ?boss1=old 면 이전 고라스
  { bg: 'arena', name: '피의 투기장', fixedCam: true,
    events: [{ at: .5, boss: G2_DEBUG.old ? 'boss1_old' : 'boss1' }] },
];

const S1 = { on: false, idx: 0, sec: null, bg: null, len: 0, maxCam: 0, ev: 0, lock: null, lockN: 0, fade: null, banner: 0, secT: 0,
  wall: null, hole: null, gate: null, scaffolds: [], fx: [], piles: [] };
// 배경 그림·기믹 이펙트(stage1-fx-art.js)·새 적(stage1-enemy-art.js)은 1스테이지 로딩 때 함께 불러온다
const S1_CLUB_ATTACK = 'assets/runtime/c11c4227b07bc0df9167a6c1.png';
const S1_FILES = [...new Set([S1_CLUB_ATTACK, ...Object.values(STAGE1_BG).flatMap(b => [b.base, b.fg, ...b.anims.map(a => a.file)]),
  ...Object.values(STAGE1_FX).map(f => f.file), ...Object.values(STAGE1_ENEMY_ART).map(a => a.atlas)].filter(Boolean))];
const S1_GROUP = GameAssets.group(0, S1_FILES);
const S1_IMG = Object.fromEntries(S1_FILES.map((f, i) => [f, S1_GROUP.images[i]]));
// 바닥 불 그림: fire_loop 의 불씨 바닥(조밀한 띠)이 그림 아래 끝에서 약 4~35px(월드) → 띠 가운데(19)를 판정 중심에 맞춘다
const FIRE_SPRITE_BASE = 19;

function stage1On() { return S1.on && !!S1.sec; }
// 걸을 수 있는 깊이의 위쪽 끝. 좁은 길(depth.top)이면 앞쪽 일부만 남긴다
function walkTop() { const k = stage1On() && S1.sec.depth?.top; return k ? GBOT - (GBOT - GTOP) * k : GTOP; }
function s1Mark(name) { return S1.bg.marks[name]; }
function s1LockCam(at) { return clamp(at * S1.len - VW / 2, 0, S1.maxCam); }

// startStage 끝에서 부른다. 보스 도전은 투기장(E)에서, ?section=N 이면 N번째 구간에서 시작
function startStage1Sections() {
  S1.on = !!stage.sections;
  if (!S1.on) { S1.sec = null; return; }
  let i = 0;
  const q = Number(new URLSearchParams(location.search).get('section'));
  if (bossChallenge) i = STAGE1_SECTIONS.length - 1;
  else if (!practice && Number.isInteger(q) && q >= 1 && q <= STAGE1_SECTIONS.length) i = q - 1;
  S1.fade = null; S1.lockN = 0;
  enterSection(i);
  S1.banner = 0;                                   // 첫 구간은 스테이지 이름 띠가 대신한다
}
function enterSection(i) {
  const sec = STAGE1_SECTIONS[i], bg = STAGE1_BG[sec.bg], p = player;
  Object.assign(S1, { idx: i, sec, bg, len: bg.len, maxCam: Math.max(0, bg.len - VW), ev: 0, lock: null, wall: null, hole: null, gate: null,
    scaffolds: [], fx: [], piles: [], banner: 170, secT: 0 });
  stage.len = bg.len;
  camX = sec.fixedCam ? s1LockCam(.5) : 0; camLock = false; lockAt = camX; goT = 0; arena = null;
  enemies = []; items = []; hazards = []; parts = []; texts = []; target = null; impacts = []; bursts = []; ghosts = []; bolts = [];
  barrels = (sec.barrels || []).map(bx => ({ kind: 'barrel', x: bx, y: rand(walkTop() + 30, GBOT - 10), z: 0, hw: 16, hp: 2, flash: 0, dead: false, t: 0 }));
  p.x = camX + 80; p.y = clamp(430, walkTop() + 10, GBOT); p.z = 0; p.vz = 0; p.vx = 0; p.face = 1; p.inv = Math.max(p.inv, 60);
  if (sec.events[0]?.boss === 'boss1') gorath2Prepare();   // 고라스는 탁자 앞에서 고기를 썰고 있고, 플레이어는 오른쪽 문에서 걸어 들어온다
}
function stage1Finished() { return S1.idx === STAGE1_SECTIONS.length - 1 && S1.ev >= S1.sec.events.length && !S1.lock; }

// 구간 전환: 어두워짐(30틱) → 다음 구간 → 밝아짐(30틱). 그동안 전투는 멈춘다. 철문은 걸어 들어가는 모습을 곁들인다
const S1_FADE = 30;
function startSectionFade(walk = false) { if (!S1.fade) S1.fade = { t: 0, walk, next: S1.idx + 1 }; }
function stage1Fading() {
  const f = S1.fade; if (!f) return false;
  f.t++;
  const p = player;
  if (f.t <= S1_FADE && f.walk) {                  // 철문 안쪽(뒤쪽 깊이)으로 걸어 들어간다
    const gx = (s1Mark('gateLeft') + s1Mark('gateRight')) / 2;
    p.x += clamp(gx - p.x, -1.6, 1.6); p.y += clamp(GTOP + 4 - p.y, -2.2, 2.2); p.walk = true; p.face = 1;
    p.walkTime = (p.walkTime || 0) + MS;
  }
  if (f.t === S1_FADE) enterSection(f.next);
  if (f.t >= S1_FADE * 2) S1.fade = null;
  updFx();
  return true;
}

// ---------------------------------------------------------------- 진행 (update 에서 웨이브 대신)
function updStage1() {
  const sec = S1.sec;
  S1.secT++; if (S1.banner > 0) S1.banner--;
  if (S1.lock) updLock();
  const ev = sec.events[S1.ev];                    // 잠금이 방금 풀렸으면 다음 이벤트
  if (S1.wall) updWallBreak();
  if (S1.gate && S1.gate.t < 40) {
    if (++S1.gate.t === 40) { sfx('slam'); shake = Math.max(shake, 6); goT = 300; }
    else if (S1.gate.t % 10 === 0) sfx('barrel');
  }
  // 카메라: 다음 잠금 위치(또는 구간 끝)까지 플레이어를 따라간다
  const limit = sec.fixedCam ? s1LockCam(.5) : camLock ? lockAt : ev ? s1LockCam(ev.at) : S1.maxCam;
  const goal = player.x - VW * 0.4;
  if (sec.fixedCam) camX = limit;                  // 한 화면: 가운데 고정
  else if (goal > camX) camX = Math.min(goal, limit);
  if (!camLock && ev && !S1.fade && camX >= limit - 0.5 && (!ev.boss || ev.boss === 'boss1' || S1.secT > 40)) beginEvent(ev);
  // 구간 끝: 다음 구간으로. 광장은 철문이 열린 뒤 철문으로 걸어 들어가야 한다
  if (!camLock && !ev && !S1.fade && S1.idx < STAGE1_SECTIONS.length - 1 && player.st !== 'dead') {
    if (sec.gate) { if (S1.gate?.t >= 40 && player.x >= s1Mark('gateLeft') + 24) startSectionFade(true); }
    else if (player.x >= S1.len - 60) startSectionFade();
  }
}
function beginEvent(ev) {
  camLock = true; lockAt = camX;
  if (ev.boss) {
    S1.lock = { id: ++S1.lockN, max: 1, queue: [], delay: 0, boss: true };
    if (ev.boss === 'boss1') gorath2BeginIntro(); else spawnWave({ e: [[ev.boss, 1]] });
    return;
  }
  const queue = ev.spawns.map(([id, from, gap = 0]) => ({ id, from, gap }));
  S1.lock = { id: ++S1.lockN, max: ev.max, queue, delay: 0 };
  const wb = queue.find(q => q.from.startsWith('wallbreak@'));
  if (wb) { S1.wall = { t: 0, x: s1Mark(wb.from.split('@')[1]) }; wb.wall = true; }
}
function updLock() {
  const L = S1.lock;
  let alive = enemies.filter(e => e.lockId === L.id && e.st !== 'dead').length;
  if (L.delay > 0) L.delay--;
  while (L.queue.length && alive < L.max && L.delay <= 0) {
    const q = L.queue[0];
    if (q.wall && !S1.wall?.broke) break;
    L.queue.shift(); spawnStage1Enemy(q, L.id); alive++;
    L.delay = L.queue[0]?.gap || 0;
  }
  if (L.queue.length || !enemies.every(e => e.st === 'dead')) return;
  S1.lock = null; camLock = false; S1.ev++;
  hazards = hazards.filter(z => z.type !== 'firemark');
  if (L.boss) return;
  if (S1.sec.gate && S1.ev >= S1.sec.events.length) { S1.gate = { t: 0 }; sfx('pillar'); shake = Math.max(shake, 4); }
  else goT = 300;
}

// ---------------------------------------------------------------- 등장
function spawnStage1Enemy(q, lockId) {
  const [path, arg] = q.from.split('@'), type = ENEMY_ALIAS[q.id] || q.id, wt = walkTop();
  let x, y = rand(wt + 20, GBOT);
  if (path === 'right') x = camX + VW + rand(30, 110);
  else if (path === 'left') x = camX - rand(30, 110);
  else if (path === 'balcony') {
    const from = s1Mark('balconyFrom'), to = s1Mark('balconyTo');
    x = clamp(clamp(Number(arg) * S1.len, from, to), camX + 60, camX + VW - 60);   // 잠금 화면 안의 발코니로
  } else x = s1Mark(arg) + rand(-6, 6);
  const e = mkEnemy(type, x, y);
  e.s1 = q.id; e.lockId = lockId;
  e.d = { ...(STAGE1_ET[type] || e.d), name: STAGE1_ENEMY_NAMES[q.id] || e.d.name };
  if (STAGE1_ET[type]) e.hp = e.max = e.d.hp;    // 새 적은 스테이지 배율 없이 표의 체력 그대로
  if (q.id === 'heavy' && path === 'wallbreak') e.hp = e.max = Math.round(e.max * 1.3);
  if (q.id === 'heavy') e.grabCd = 60;
  if (q.id === 'hound') { e.diveCd = Math.round(rand(40, 120)); e.ang = (e.id * 2.39) % (Math.PI * 2); e.rad = rand(HOUND.ring[0], HOUND.ring[1]); }
  if (q.id === 'molotov') { e.molotov = true; e.atkCd = rand(30, 70); e.kickCd = 0; e.laneY = y; }
  if (path === 'door' || path === 'cage' || path === 'wallbreak') {   // 뒤쪽 깊이에서 앞으로 걸어 나온다 (등장 중 무적·공격 안 함)
    e.st = 'enter'; e.y = GTOP + 3; e.enterTo = Math.max(wt + 30, GTOP + 40); e.invuln = true;
    e.enterSpd = path === 'cage' ? 1.6 : path === 'wallbreak' ? .7 : 1; e.alpha = path === 'wallbreak' ? 1 : 0;
    e.face = player.x >= e.x ? 1 : -1;
    if (path === 'wallbreak') landingDust(e.x, e.y + 3, .6);   // 중갑병 첫 걸음
  }
  if (path === 'balcony') {                       // 위층에 서 있다: 맞지 않고, 화염병만 던진다
    e.st = 'balcony'; e.balcony = true; e.invuln = true; e.y = GTOP + 10; e.z = BALCONY_H; e.throws = 0;
    S1.scaffolds.push(e.x);
  }
  enemies.push(e);
  return e;
}

// ---------------------------------------------------------------- 적 상태 (updEnemy 의 공통 처리 뒤, 기본 상태 전환 대신)
function stage1EnemyState(e) {
  const p = player, d = e.d;
  if (e.kickCd > 0) e.kickCd--;
  if (e.grabCd > 0) e.grabCd--;
  if (e.redFlash > 0) e.redFlash--;
  const moves = S1_MOVES[e.s1];
  if (moves && e.mv && (e.st === 'wind' || e.st === 'act')) { runStage1Move(e); return true; }
  if (e.st !== 'wind' && e.st !== 'act') e.mv = null;
  if (e.diveCd > 0) e.diveCd--;
  if (e.st === 'grabbing') { e.walk = false; return true; }   // 조르기·물기: 플레이어 쪽(updateStage1Grab)이 진행한다
  if (e.s1 === 'hound' && e.dv && (e.st === 'wind' || e.st === 'act')) { runHoundDive(e); return true; }
  if (e.st !== 'wind' && e.st !== 'act') e.dv = null;
  if (e.st === 'trip') {                           // 다이빙 빗나감: 넘어져 뒹군다(무방비) → 기상
    if (e.t >= S1_ANIM.trip.reduce((n, [, l]) => n + l, 0)) startGetup(e);
    return true;
  }
  if (e.st === 'down' && STAGE1_ENEMY_ART[e.s1]) {            // 넘어짐 → 기상 그림 동안 rec
    e.x += e.vx; e.z += e.vz; e.vz -= 0.5; e.vx *= 0.97;
    if (e.z <= 0) { e.z = 0; e.vz = 0; e.vx *= 0.7; }
    if (e.t > 60 && e.z === 0) startGetup(e);
    return true;
  }
  if (e.st === 'hurt' && e.s1 === 'hound') {       // 사냥개 피격 그림 6칸 × 4틱, 공중에서 맞으면 떨어진다
    e.hurtT = Math.max(e.hurtT || 0, 6 * S1_ANIM.houndHurt);
    if (e.z > 0 || e.vz) { e.z += e.vz || 0; e.vz = (e.vz || 0) - .5; if (e.z <= 0) { e.z = 0; e.vz = 0; } }
  }
  if (e.st === 'chase') e.getup = false;
  if (e.st === 'chase' && e.s1 === 'hound') { houndChase(e); return true; }
  if (e.st === 'chase' && e.s1 === 'heavy' && heavyMidSpin(e)) return true;
  switch (e.st) {
    case 'enter':
      e.walk = true; e.alpha = Math.min(1, e.alpha + .05);
      e.y += e.enterSpd;
      if (e.y >= e.enterTo) { e.st = 'chase'; e.t = 0; e.alpha = 1; e.invuln = false; e.wait = 8; }
      return true;
    case 'balcony': {
      e.face = p.x >= e.x ? 1 : -1; e.z = BALCONY_H;
      const others = enemies.filter(o => o !== e && o.lockId === e.lockId && o.st !== 'dead').length +
        (S1.lock?.id === e.lockId ? S1.lock.queue.length : 0);
      if (e.throws >= 2 || others <= 1) {          // 난간에서 뛰어내린다
        e.st = 'drop'; e.t = 0; e.vz = 3; e.balcony = false; e.dropTo = Math.max(walkTop() + 24, GTOP + 30);
        sfx('jump'); return true;
      }
      if (e.atkCd <= 0 && p.st !== 'dead' && p.st !== 'down') startMolotovThrow(e);
      return true;
    }
    case 'drop':                                   // 착지 → 6틱 경직 → 지상 화염병 투척자
      e.z += e.vz; e.vz -= .45; e.y += clamp(e.dropTo - e.y, -2.4, 2.4);
      if (e.z <= 0) {
        e.z = 0; e.vz = 0; e.st = 'rec'; e.t = 0; e.recT = 6; e.invuln = false;
        shake = Math.max(shake, 4); sfx('land'); landingDust(e.x, e.y, .7);
      }
      return true;
    case 'rec':
      if (!e.molotov) return false;
      if (e.t > e.recT) { e.st = 'chase'; e.t = 0; e.atkCd = Math.max(e.atkCd, 20); }
      return true;
    case 'chase':
      if (!e.molotov) return false;
      molotovChase(e); return true;
    case 'wind': case 'act':
      if (e.pat === 'throw') { molotovThrow(e); return true; }
      if (e.pat === 'kick') { molotovKick(e); return true; }
      return false;
  }
  return false;
}
// 거리 260~420px 를 유지한다. 포물선이라 줄을 맞추지 않는다. 가까이 붙으면 물러나고, 붙잡히면 약한 발차기
function molotovChase(e) {
  const p = player, d = e.d, dx = p.x - e.x, adx = Math.abs(dx), dy = p.y - e.y;
  if (p.st === 'dead') return;
  if (e.wait > 0) { e.wait--; return; }
  e.face = dx >= 0 ? 1 : -1;
  if (e.t % 150 === 0) e.laneY = rand(walkTop() + 15, GBOT - 5);
  const mx = adx < MOLOTOV.near ? -e.face : adx > MOLOTOV.far ? e.face : 0;
  const my = Math.abs(e.laneY - e.y) > 4 ? Math.sign(e.laneY - e.y) : 0;
  if (mx || my) { e.x += mx * d.spd; e.y += my * d.spd * .6; e.walk = true; }
  e.x = clamp(e.x, camX + 24, camX + VW - 24);
  if (adx < 70 && Math.abs(dy) < 16 && e.kickCd <= 0 && p.st !== 'down') { e.st = 'wind'; e.pat = 'kick'; e.t = 0; e.hitSet = new Set(); sfx('bwind'); return; }
  const busy = enemies.filter(o => o !== e && o.molotov && o.pat === 'throw' && (o.st === 'wind' || o.st === 'act')).length;
  if (e.atkCd <= 0 && adx >= 180 && adx <= 480 && busy < 2 && p.st !== 'down') startMolotovThrow(e);
}
// 30틱 예고(팔을 젖히고 심지에 불) — 목표는 던지기 시작한 순간의 플레이어 발밑, 바닥에 붉은 표식
function startMolotovThrow(e) {
  const p = player;
  e.st = 'wind'; e.pat = 'throw'; e.t = 0; e.face = p.x >= e.x ? 1 : -1;
  e.tx = clamp(p.x, camX + 20, camX + VW - 20); e.ty = clamp(p.y, walkTop() + 10, GBOT);
  hazards.push({ type: 'firemark', x: e.tx, y: e.ty, age: 0, life: (MOLOTOV.wind + MOLOTOV.flight) * MS, owner: e });
  sfx('bwind');
}
function molotovThrow(e) {
  if (e.t < MOLOTOV.wind) return;
  // 던지기 그림 6번 칸(병을 놓는 순간)의 손 위치에서 투사체 그림으로 넘어간다
  const hand = STAGE1_ENEMY_ART.molotov?.frames[STAGE1_ENEMY_ART.molotov.clips.throw[5]].hand || [14, 70];
  const h0 = e.z + hand[1];
  e.throwAt = tick;
  hazards.push({ type: 'molotov', owner: e, x0: e.x + e.face * hand[0], y0: e.y, h0, tx: e.tx, ty: e.ty, x: e.x, y: e.y, h: h0,
    age: 0, T: MOLOTOV.flight * MS, arc: e.balcony ? 24 : 70 });
  sfx('swing', 1);
  e.pat = null; e.t = 0; e.atkCd = Math.round(rand(MOLOTOV.restMin, MOLOTOV.restMax));
  if (e.balcony) { e.st = 'balcony'; e.throws++; } else { e.st = 'rec'; e.recT = S1_ANIM.throwFollow.reduce((a, b) => a + b, 0); }   // 6~10칸 동안 제자리
}
function molotovKick(e) {
  const p = player;
  if (e.st === 'wind') { if (e.t >= MOLOTOV.kickWind) { e.st = 'act'; e.t = 0; } return; }
  if (!e.hitSet.has(p) && inReach(e, p, 40, 16) && hurtPlayer(MOLOTOV.kickDmg, e.face, false, e)) e.hitSet.add(p);
  if (e.t >= MOLOTOV.kickAct) { e.st = 'rec'; e.t = 0; e.recT = 20; e.pat = null; e.kickCd = MOLOTOV.kickCd; e.x -= e.face * 6; }
}
// 기상: 기존 일반 적 규칙 그대로 — 무적 45틱, 기상 그림이 끝난 뒤 20틱 더 공격하지 않는다
function startGetup(e) {
  const len = (e.s1 === 'hound' ? S1_ANIM.houndGetup : S1_ANIM.getup).reduce((a, b) => a + b, 0);
  e.st = 'rec'; e.t = 0; e.inv = Math.max(45, len); e.recT = len + S1_ANIM.afterGetup; e.getup = true; e.z = 0; e.vz = 0;
}

// ---------------------------------------------------------------- 사냥개: 원을 따라 돌다가 물기 다이빙
// 플레이어 주변 반지름 220~320px 원 위(사냥개마다 다른 각도)를 목표로 움직이고, 거리 180~330px에서 줄을 맞춘 뒤 다이빙.
// 화면의 사냥개 중 예고·다이빙 중인 것은 1마리뿐.
function houndChase(e) {
  const p = player, d = e.d, dx = p.x - e.x, adx = Math.abs(dx), dy = p.y - e.y;
  if (p.st === 'dead') return;
  if (e.wait > 0) { e.wait--; return; }
  e.face = dx >= 0 ? 1 : -1;
  e.ang += .012 * (e.id % 2 ? 1 : -1);
  let tx = p.x + Math.cos(e.ang) * e.rad, ty = p.y + Math.sin(e.ang) * e.rad * .22;
  const token = !enemies.some(o => o !== e && o.dv), ready = e.diveCd <= 0 && token && p.st !== 'down' && p.st !== 'grabbed';
  if (ready && adx >= HOUND.near && adx <= HOUND.far) {
    tx = e.x; ty = p.y;                            // 줄을 맞춘다
    if (Math.abs(dy) <= HOUND.lane) { startHoundDive(e); return; }
  }
  tx = clamp(tx, camX + 20, camX + VW - 20); ty = clamp(ty, walkTop() + 10, GBOT);
  const mx = tx - e.x, my = ty - e.y, dist = Math.hypot(mx, my);
  if (dist > 3) { e.x += mx / dist * d.spd; e.y += my / dist * d.spd * .8; e.walk = true; }
}
function startHoundDive(e) {
  e.dv = { t: 0, f: 0, dir: player.x >= e.x ? 1 : -1, hit: false };
  e.face = e.dv.dir; e.st = 'wind'; e.t = 0; e.pat = 'dive'; sfx('bwind');
}
function runHoundDive(e) {
  const p = player, dv = e.dv, art = STAGE1_ENEMY_ART.hound;
  dv.t++;
  const f = animIndex(S1_ANIM.dive, dv.t - 1), fn = f + 1;
  dv.f = f; e.face = dv.dir;
  e.st = fn <= 2 ? 'wind' : 'act';                 // 1~2 예고(머리 위 "!"), 제자리
  if (fn <= 2) return;
  if (fn <= 5) {                        // 도약: 같은 줄을 따라 빠르게, 높이 0→40→0
    const air = S1_ANIM.dive.slice(2, 5).reduce((a, b) => a + b, 0), u = clamp((dv.t - 12) / air, 0, 1);
    if (!dv.leapSfx) { dv.leapSfx = 1; sfx('jump'); }
    e.x += dv.dir * HOUND.leap / air; e.z = Math.sin(Math.PI * u) * HOUND.leapH;
    const mouth = art.frames[art.clips.dive[f]].hand || [30, 20], dx = (p.x - e.x) * dv.dir, mh = e.z + mouth[1];
    if (!dv.hit && dx > mouth[0] - 22 && dx < mouth[0] + 14 && Math.abs(p.y - e.y) < COMBAT_FRAME_DATA.enemies.hit.depthPx * HOUND.depthMul &&
        mh >= p.z - 6 && mh <= p.z + 80 && !practice && p.inv <= 0 && !['dead', 'down', 'special', 'grabbed'].includes(p.st)) {
      dv.hit = true; beginHoundBite(e); return;
    }
    return;
  }
  e.z = 0;                                         // 빗나감: 착지 칸 대신 넘어져 뒹군다
  e.dv = null; e.st = 'trip'; e.t = 0; e.pat = null; e.diveCd = Math.round(rand(HOUND.cd[0], HOUND.cd[1]));
  sfx('land');
}
function beginHoundBite(e) {
  const p = player;
  e.st = 'grabbing'; e.t = 0; e.dv = null; e.pat = null; e.bite = true; e.z = 4;
  p.st = 'grabbed'; p.t = 0; p.grab = { owner: e, stage1: true, bite: true, presses: 0, t: 0, squeezes: 0 };
  p.vx = p.vz = 0; p.skill = null; p.combo = p.comboT = p.buf = 0; p.walk = false; p.wave = false;
  clearInput(); sfx('hit', 1); impact(p.x, p.y, 40, 1, e.face);
}

// ---------------------------------------------------------------- 새 적 근접 동작 (프레임 데이터)
// game.js startAttack 에서: 기존 접근·쿨다운·동시 공격 제한 로직이 공격을 고르면 여기서 그 적의 동작을 시작한다
function startStage1Attack(e) {
  const moves = S1_MOVES[e.s1];
  if (!moves) return false;
  let clip = Object.keys(moves)[0];
  if (e.s1 === 'heavy') {                          // 가까우면 잡기 40% / 회전 철퇴 60%
    const p = player, near = Math.abs(p.x - e.x) < e.d.range * HEAVY_GRAB.near && Math.abs(p.y - e.y) < 14;
    const free = p.st !== 'grabbed' && !enemies.some(o => o !== e && o.st === 'grabbing');
    clip = near && free && e.grabCd <= 0 && Math.random() < .4 ? 'grab' : 'spin';
  }
  beginStage1Move(e, clip);
  return true;
}
function beginStage1Move(e, clip) {
  const m = S1_MOVES[e.s1][clip];
  e.mv = { clip, t: 0, f: 0, hit: false, used: new Set() };
  e.face = player.x >= e.x ? 1 : -1;
  e.st = m.warnTo > 0 ? 'wind' : 'act'; e.t = 0; e.pat = 'swing'; e.hitSet = new Set();
  if (clip === 'grab') e.grabCd = HEAVY_GRAB.cd;
  sfx(e.st === 'wind' ? 'bwind' : 'swing', 0);
}
// 중간 거리면 다가가거나 가끔 회전 철퇴
function heavyMidSpin(e) {
  const p = player, adx = Math.abs(p.x - e.x);
  if (e.atkCd > 0 || p.st === 'dead' || p.st === 'down' || adx < e.d.range || adx > e.d.range * 1.5 || Math.abs(p.y - e.y) > 20 || Math.random() > 1 / 90) return false;
  beginStage1Move(e, 'spin'); return true;
}
// 판정 상자: 앞 거리 = 판정 프레임들에서 잰 무기 끝(tip)의 최댓값, 회전은 뒤쪽 끝(back)까지
const S1_BOX_CACHE = {};
function stage1HitBox(id, clip, hit) {
  const key = id + clip + hit.f;
  if (S1_BOX_CACHE[key]) return S1_BOX_CACHE[key];
  const art = STAGE1_ENEMY_ART[id], fr = [];
  for (let f = hit.f[0]; f <= hit.f[1]; f++) fr.push(art.frames[art.clips[clip][f - 1]]);
  const tips = fr.map(f => f.tip).filter(Boolean), backs = fr.map(f => f.back).filter(Boolean);
  const reach = Math.max(...tips.map(t => t[0])) * (hit.reachMul || 1);
  return (S1_BOX_CACHE[key] = { reach: Math.round(reach * 10) / 10, back: hit.radial ? -Math.min(...backs.map(t => t[0])) : 8,
    hLo: Math.min(...tips.map(t => t[1])), hHi: Math.max(...tips.map(t => t[1])) });
}
function runStage1Move(e) {
  const p = player, m = S1_MOVES[e.s1][e.mv.clip], mv = e.mv;
  mv.t++;
  let acc = 0, f = 0;
  while (f < m.len.length && mv.t > acc + m.len[f]) acc += m.len[f++];
  if (f >= m.len.length) {                         // 동작 끝
    if (m.next && mv.hit) { beginStage1Move(e, m.next); e.st = 'act'; return; }   // 칼 도적: 맞혔으면 다음 타
    e.mv = null; e.st = 'chase'; e.t = 0; e.pat = null; e.atkCd = Math.round(rand(15, 45)); return;
  }
  mv.f = f; const fn = f + 1;                       // 1부터 센 프레임 번호
  e.st = fn <= m.warnTo ? 'wind' : 'act';
  if (m.dash && fn >= m.dash[0] && fn <= m.dash[1] && (p.x - e.x) * e.face > 34) e.x += e.face * m.dash[2] * STAGE1_ET_H;
  if (m.grab && fn >= m.grab[0] && fn <= m.grab[1] && !mv.used.has('grab')) {
    const box = stage1HitBox(e.s1, mv.clip, { f: m.grab }), dx = (p.x - e.x) * e.face;
    if (dx > -8 && dx < box.reach + 14 && Math.abs(p.y - e.y) < 14 && p.z < 32 && !practice && p.inv <= 0 &&
        !['dead', 'down', 'special', 'grabbed'].includes(p.st) && !enemies.some(o => o !== e && o.st === 'grabbing')) {
      mv.used.add('grab'); beginStage1Grab(e); return;
    }
  }
  for (const [i, hit] of (m.hits || []).entries()) {
    if (fn < hit.f[0] || fn > hit.f[1] || mv.used.has(i)) continue;
    const box = stage1HitBox(e.s1, mv.clip, hit), dx = (p.x - e.x) * e.face;
    const inside = hit.radial ? dx > -box.back - 14 && dx < box.reach + 14 && Math.abs(p.y - e.y) < 26 && p.z < 60
      : inReach(e, p, box.reach, COMBAT_FRAME_DATA.enemies.hit.depthPx, COMBAT_FRAME_DATA.enemies.hit.heightPx);
    if (inside && hurtPlayer(Math.round(hit.dmg * S1_J), hit.radial ? (Math.sign(p.x - e.x) || e.face) : e.face, !!hit.kd, e)) { mv.used.add(i); mv.hit = true; }
  }
}
const STAGE1_ET_H = 102.24;                        // 바렐 서 있는 키(월드 px): 돌진·덮침 이동 거리 기준

// 잡기 → 조르기: 바렐을 잡힘 상태로 (탈출 규칙은 고라스·소버린과 같은 GORATH_ESCAPE_KEYS · GORATH_GRAB.presses)
function beginStage1Grab(e) {
  const p = player;
  e.st = 'grabbing'; e.t = 0; e.mv = null; e.pat = null;
  p.st = 'grabbed'; p.t = 0; p.grab = { owner: e, stage1: true, presses: 0, t: 0, squeezes: 0 };
  p.vx = p.vz = 0; p.skill = null; p.combo = p.comboT = p.buf = 0; p.walk = false; p.wave = false;
  clearInput(); sfx('hit', 1); impact(p.x, p.y, 70, 1, e.face);
}
// 탈출에 필요한 연타 수: 조르기 = 기존 잡힘 규칙(GORATH_GRAB.presses), 사냥개 물기 = 그 절반
function grabPresses(g) { return g.bite ? Math.ceil(GORATH_GRAB.presses / 2) : GORATH_GRAB.presses; }
function grabLength(g) { return g.bite ? HOUND.hold : HEAVY_GRAB.every * HEAVY_GRAB.squeezes; }
function updateStage1Grab() {
  const p = player, g = p.grab, e = g?.owner;
  if (!g || !e || !enemies.includes(e) || e.st !== 'grabbing') { releaseStage1Grab('cancel'); return; }
  p.t++; p.walk = false; p.vz = p.vx = 0; dashReq = 0;
  for (const code of GORATH_ESCAPE_KEYS) if (hit(code)) g.presses++;
  for (const code in pressed) delete pressed[code];
  if (g.presses >= grabPresses(g)) { releaseStage1Grab('escape'); return; }
  if (g.bite) {                                    // 사냥개가 플레이어에게 매달린다 (다이빙 5번 칸의 입 위치)
    const art = STAGE1_ENEMY_ART.hound, mouth = art.frames[art.clips.dive[4]].hand || [30, 20];
    e.x = p.x - e.face * mouth[0]; e.y = p.y - 1; p.z = 0;
  } else {
    const hand = STAGE1_ENEMY_ART.heavy.frames[STAGE1_ENEMY_ART.heavy.clips.choke[4]].hand;   // 조르기 5번 프레임 손
    p.x = e.x + e.face * hand[0]; p.y = e.y + 1; p.z = Math.max(0, hand[1] - .8 * STAGE1_ET_H); p.face = -e.face;
  }
  g.t++;
  const every = g.bite ? HOUND.every : HEAVY_GRAB.every;
  if (g.t % every === 0) {                         // 조르기 40틱마다 0.3J / 물기 30틱마다 0.2J
    const n = Math.round((g.bite ? HOUND.dmg : HEAVY_GRAB.dmg) * S1_J);
    stat.damage += Math.min(p.hp, n); p.hp -= n; p.flash = 5; floatText(p.x, p.y - 110, n, '#ff5a6a'); sfx('hurt'); shake = Math.max(shake, 3);
    if (p.hp <= 0) { releaseStage1Grab('cancel'); p.hp = 0; p.lives--; stat.deaths++; p.st = 'dead'; p.t = 0; p.vz = 6; p.vx = 0; sfx('pdie'); return; }
    g.squeezes++;
  }
  if (g.bite ? g.t >= HOUND.hold : g.squeezes >= HEAVY_GRAB.squeezes) releaseStage1Grab(g.bite ? 'end' : 'throw');
}
// result: escape(연타 탈출) / throw(조르기 끝: 내던짐) / end(물기 끝) / hit(물린 채 다른 적에게 맞음) / cancel
function releaseStage1Grab(result) {
  const p = player, g = p.grab; if (!g?.stage1) return;
  const e = g.owner;
  p.grab = null; p.st = 'free'; p.t = 0; p.z = 0; p.vx = p.vz = 0; clearInput();
  if (e && e.st === 'grabbing') { e.st = 'chase'; e.t = 0; e.atkCd = 40; }
  if (g.bite && e && enemies.includes(e) && e.st !== 'dead') {   // 사냥개는 뒤로 튕겨 나가 피격
    e.bite = false; e.st = 'hurt'; e.t = 0; e.hurtT = 6 * S1_ANIM.houndHurt; e.vx = -e.face * 4; e.z = 0; e.vz = 0; e.hr = 0;
    e.diveCd = Math.round(rand(HOUND.cd[0], HOUND.cd[1]));
  }
  if (result === 'escape') {                       // 탈출: 중갑병은 30틱 경직
    p.inv = Math.max(p.inv, 30); floatText(p.x, p.y - 110, '탈출!', '#aeeaff');
    if (e && !g.bite) { e.st = 'hurt'; e.t = 0; e.hurtT = HEAVY_GRAB.escapeStun; e.vx = 0; e.hr = 0; impact(e.x, e.y, 70, 1, p.face); sfx('hit'); }
  } else if (result === 'throw') {                 // 바닥에 내던짐
    p.inv = 0; hurtPlayer(Math.round(HEAVY_GRAB.throwDmg * S1_J), e?.face || 1, true, e); p.inv = Math.max(p.inv, 30);
  } else if (result !== 'hit') p.inv = Math.max(p.inv, 30);
}
function drawStage1Grab() {
  const p = player, g = p.grab; if (p.st !== 'grabbed' || !g?.stage1) return;
  const x = p.x - camX, y = p.y - p.z - 120;
  outlineText(`공격 / 방향키 연타 ${g.presses}/${grabPresses(g)}`, x, y, '#ffe1ab', 'bold 12px sans-serif');
  ctx.save(); ctx.fillStyle = '#28171d'; ctx.fillRect(x - 35, y + 8, 70, 5);
  ctx.fillStyle = '#ffa34d'; ctx.fillRect(x - 35, y + 8, 70 * (1 - g.t / grabLength(g)), 5); ctx.restore();
}
// damageEnemy 에서 상태를 바꾸기 직전: true 면 맞기만 하고 경직되지 않는다
// 중갑병: 일반 공격 3타째까지는 붉게 번쩍이기만, 4타째·강공격(넘어뜨리기)·기술·필살기부터 피격. 넘어짐은 강공격·기술·필살기만(넘어뜨리기 판정이 있는 것).
// 곤봉잡이: 돌진(4~6프레임) 중 일반 공격에 슈퍼아머.
function stage1Armor(e, kd, fixedDamage, attackId) {
  if (!e.s1 || !STAGE1_ET[e.s1]) return false;
  const p = player, strong = kd || fixedDamage || p.st === 'skill' || p.st === 'special';
  e.hitLow = !(p.z > 20 || p.st === 'special') && (attackId === 'c2' || p.st === 'dash' || (p.st === 'skill' && p.skill === 'thrust'));
  if (e.st === 'grabbing') { e.redFlash = 8; e.flash = 0; return true; }
  if (e.s1 === 'heavy') {
    if (tick - (e.armorT ?? -999) > 90) e.armorHits = 0;
    e.armorT = tick; e.armorHits = (e.armorHits || 0) + 1;
    if (!strong && e.armorHits <= 3) { e.redFlash = 8; e.flash = 0; return true; }
    e.armorHits = 0;
  }
  const m = e.mv && S1_MOVES[e.s1][e.mv.clip];
  if (m?.armor && !strong && e.mv.f + 1 >= m.armor[0] && e.mv.f + 1 <= m.armor[1]) { e.redFlash = 6; return true; }
  e.mv = null; e.dv = null;
  return false;
}

// ---------------------------------------------------------------- 투사체 · 바닥 불 (updHazards 에서)
function updateStage1Hazard(z) {
  const p = player;
  switch (z.type) {
    case 'firemark': if (z.age > z.life) z.dead = true; return true;
    case 'molotov': {
      const u = clamp(z.age / z.T, 0, 1);
      z.x = lerp(z.x0, z.tx, u); z.y = lerp(z.y0, z.ty, u); z.h = lerp(z.h0, 0, u) + Math.sin(Math.PI * u) * z.arc;
      if (u >= 1) {                                // 병이 깨지며 불이 번진다
        z.dead = true; sfx('barrel'); shake = Math.max(shake, 3);
        if (s1Fx('glass')) for (let i = 0; i < 3; i++) {   // 유리 조각 3개가 사방으로 튀었다가 15틱 동안 떨어지며 사라진다
          const a = i * 2.1 + rand(-.4, .4);
          S1.fx.push({ id: 'glass', f: Math.floor(rand(0, 5)), x: z.tx, y: z.ty, h: 4, vx: Math.cos(a) * 2.2, vy: Math.sin(a) * .8, vh: rand(2.4, 3.4), g: .4, t: 0, life: 15 });
        } else {
          burst(z.tx, z.ty, 6, ['#fff0a0', '#ff8a2a', '#8a2a10']);
          sparks(z.tx, z.ty, 4, 6, '#bfe0c8');
        }
        spawnFire(z.tx, z.ty);
      }
      return true;
    }
    case 'fire': {
      const life = FIRE.life * MS;
      if (z.age > life) { z.dead = true; return true; }
      const ft = Math.round(z.age / MS);
      if (ft % 40 === 20 && ft < FIRE.life - 30 && s1Fx('embers'))   // 불 위에 불씨를 가끔 하나씩
        S1.fx.push({ id: 'embers', x: z.x + rand(-40, 40), y: z.y + rand(-8, 8), h: rand(20, 34), vh: .35, t: 0, tpf: 6, add: true });
      const k = fireScale(z), inside = (o) => ((o.x - z.x) / (FIRE.rx * k)) ** 2 + ((o.y - z.y) / (FIRE.ry * k)) ** 2 <= 1;
      if (p.z <= 0 && p.st !== 'dead' && inside(p) && tick - (z.hits.get(p) ?? -99) >= FIRE.every) { z.hits.set(p, tick); burnPlayer(FIRE.dmg); }
      for (const e of enemies) {                   // 적도 같은 규칙: 불 위로 날려 보내면 탄다
        if (e.boss || e.st === 'dead' || e.z > 0 || e.invuln || !inside(e) || tick - (z.hits.get(e) ?? -99) < FIRE.every) continue;
        z.hits.set(e, tick); burnEnemy(e, FIRE.dmg);
      }
      return true;
    }
  }
  return false;
}
function fireScale(z) { const left = FIRE.life * MS - z.age, fade = FIRE.fade * MS; return clamp(Math.min(1, z.age / (6 * MS)), .3, 1) * (left < fade ? Math.max(.05, left / fade) : 1); }
function spawnFire(x, y) {
  const fires = hazards.filter(z => z.type === 'fire' && !z.dead).sort((a, b) => b.age - a.age);
  while (fires.length >= FIRE.max) fires.shift().dead = true;   // 가장 오래된 불부터 꺼진다
  hazards.push({ type: 'fire', x, y, age: 0, hits: new Map(), seed: (Math.random() * 999) | 0 });
}
// 바닥 불 피해: 넉백·경직 없음
function burnPlayer(n) {
  const p = player;
  if (practice || p.inv > 0 || p.st === 'dead' || p.st === 'special') return;
  stat.damage += Math.min(p.hp, n);
  p.hp -= n; p.flash = 5; floatText(p.x, p.y - p.z - 110, n, '#ff9a3a'); sfx('hurt');
  if (p.hp <= 0) { p.hp = 0; p.lives--; stat.deaths++; p.st = 'dead'; p.t = 0; p.vz = 6; p.vx = 0; sfx('pdie'); }
}
function burnEnemy(e, n) {
  e.hp -= n; e.flash = 4; floatText(e.x, e.y - e.z - e.d.h - 14, n, '#ff9a3a');
  if (e.hp > 0) return;
  e.hp = 0; e.st = 'dead'; e.t = 0; e.pat = null; e.vz = 4; e.vx = 0;
  player.score += e.d.score; dropFrom(e); sfx('mobdie');
}

// ---------------------------------------------------------------- 벽 파괴 등장 (구간 D)
function updWallBreak() {
  const w = S1.wall;
  if (w.broke) return;
  w.t++;
  if (w.t === 1 || w.t === 21) { sfx('slam'); shake = Math.max(shake, 3); if (s1Fx('dust')) landingDust(w.x + (w.t === 1 ? -16 : 18), GTOP + 6, .45); }
  if (w.t < 40) {                                  // 예고: 먼지·돌 부스러기가 떨어진다
    shake = Math.max(shake, 1.5);
    if (w.t % 3 === 0) parts.push({ x: w.x + rand(-30, 30), y: GTOP + 3, z: rand(70, 110), vx: rand(-.3, .3), vz: 0, life: 40, col: Math.random() < .5 ? '#6a5a50' : '#9a8a78' });
    if (w.t % 8 === 0 && !s1Fx('dust')) burst(w.x + rand(-26, 26), GTOP + 3, rand(40, 90), ['#a89880', '#7a6a5a', '#4a3a30']);
    return;
  }
  w.broke = true; shake = 14; hitStop = Math.max(hitStop, 4); sfx('land'); sfx('barrel');
  S1.hole = { x: w.x, seed: (Math.random() * 999) | 0 };
  if (s1Fx('rubble_chunk')) {                      // 돌 파편 6~8개가 앞으로 튀었다가 떨어져 사라진다, 구멍 아래 잔해 2무더기, 큰 먼지
    const n = 6 + Math.floor(rand(0, 3));
    for (let i = 0; i < n; i++) S1.fx.push({ id: 'rubble_chunk', f: i % STAGE1_FX.rubble_chunk.frames, x: w.x + rand(-30, 30), y: GTOP + 6, h: rand(20, 70),
      vx: rand(-2.6, 2.6), vy: rand(.8, 2.2), vh: rand(2.5, 5), g: .35, t: 0, life: rand(40, 55), flip: Math.random() < .5 });
    S1.piles = [{ x: w.x - 30, y: GTOP + 8, f: 0 }, { x: w.x + 32, y: GTOP + 10, f: 1, flip: true }];
    landingDust(w.x, GTOP + 8, 1);
  } else {
    for (let i = 0; i < 26; i++) parts.push({ x: w.x + rand(-28, 28), y: GTOP + 4 + rand(0, 20), z: rand(10, 80), vx: rand(-4, 4), vz: rand(2, 6), life: rand(30, 55), col: ['#6a5a50', '#9a8a78', '#3a2e28'][i % 3] });
    for (let i = 0; i < 5; i++) burst(w.x + rand(-30, 30), GTOP + 6, rand(10, 70), ['#c8b8a0', '#7a6a5a', '#3a2e28']);
  }
}

// ---------------------------------------------------------------- 그리기
function stage1BackdropReady() { return stage1On() && !!S1_IMG[S1.bg.base]?.naturalWidth; }
function s1Top() { return GTOP - S1.bg.floorY * S1.bg.scale; }      // 그림 맨 위의 월드 y
// 월드 좌표: 정지 배경 → 움직이는 조각(12fps = 5틱마다, 36프레임 반복) → 구멍·철문·좁은 길 장식·발판
function drawStage1Back() {
  if (!stage1BackdropReady()) return false;
  const b = S1.bg, k = b.scale, top = s1Top(), base = S1_IMG[b.base];
  ctx.imageSmoothingEnabled = false;
  const sx0 = Math.max(0, Math.floor(camX / k) - 1), sx1 = Math.min(b.width, Math.ceil((camX + VW) / k) + 1);
  ctx.drawImage(base, sx0, 0, sx1 - sx0, b.height, sx0 * k - camX, top, (sx1 - sx0) * k, b.height * k);
  const f = Math.floor(tick / 5) % 36;
  for (const a of b.anims) {
    const im = S1_IMG[a.file];
    if (!im?.naturalWidth || (a.x + a.w) * k < camX || a.x * k > camX + VW) continue;
    ctx.drawImage(im, (f % a.cols) * a.w, Math.floor(f / a.cols) * a.h, a.w, a.h, a.x * k - camX, top + a.y * k, a.w * k, a.h * k);
  }
  if (S1.hole) {                                   // 구멍 그림의 아래 끝을 벽 밑단(바닥선)에 맞춘다
    const hole = STAGE1_FX.wall_hole;
    if (!drawFx('wall_hole', 0, S1.hole.x, GTOP + 4 - hole.h * hole.scale / 2)) drawWallHole(S1.hole);
    for (const p of S1.piles) drawFx('rubble_pile', p.f, p.x, p.y, { flip: p.flip });
  }
  if (S1.gate) drawGateOpening();
  if (walkTop() > GTOP) drawNarrowPath();
  for (const x of S1.scaffolds) drawScaffold(x, false);
  return true;
}
// 캐릭터보다 나중: 투기장 울타리 전경, 발판 난간
function drawStage1Front() {
  if (!stage1BackdropReady()) return;
  for (const x of S1.scaffolds) drawScaffold(x, true);
  const b = S1.bg, im = S1_IMG[b.fg];
  if (!im?.naturalWidth) return;
  const k = b.scale, sx0 = Math.max(0, Math.floor(camX / k) - 1), sx1 = Math.min(b.width, Math.ceil((camX + VW) / k) + 1);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(im, sx0, 0, sx1 - sx0, b.height, sx0 * k - camX, s1Top(), (sx1 - sx0) * k, b.height * k);
}
function drawWallHole(h) {
  const R = srng(h.seed), cx = h.x - camX, by = GTOP + 2, w = 34, hh = 86, n = 18;
  ctx.save(); ctx.fillStyle = '#070409'; ctx.beginPath();
  for (let i = 0; i <= n; i++) {                   // 아래는 평평하고 위는 들쭉날쭉한 구멍
    const a = Math.PI * i / n, r = .78 + R() * .3;
    ctx.lineTo(cx - Math.cos(a) * w * r, by - Math.sin(a) * hh * r);
  }
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#2e2622'; ctx.lineWidth = 3; ctx.stroke();
  ctx.fillStyle = '#4a3e36';
  for (let i = 0; i < 7; i++) rect(cx - w + R() * w * 2, by - 6 + R() * 6, 4 + R() * 6, 3 + R() * 4);
  ctx.restore();
}
function drawGateOpening() {
  const b = S1.bg, k = b.scale, gx0 = s1Mark('gateLeft'), gx1 = s1Mark('gateRight'), gy0 = s1Mark('gateTop'), gy1 = GTOP + 2;
  const u = ease(clamp(S1.gate.t / 40, 0, 1)), w = gx1 - gx0, h = gy1 - gy0;
  ctx.save(); ctx.beginPath(); ctx.rect(gx0 - camX, gy0, w, h); ctx.clip();
  const g = ctx.createLinearGradient(0, gy0, 0, gy1);  // 안쪽 불빛: 위는 어둡고 바닥에서 번진다
  g.addColorStop(0, '#120403'); g.addColorStop(.55, '#5a1a08'); g.addColorStop(1, '#c8641e');
  ctx.fillStyle = g; rect(gx0 - camX, gy0, w, h);
  const cx = gx0 - camX + w / 2, glow = ctx.createRadialGradient(cx, gy1, 4, cx, gy1, w * .55);
  glow.addColorStop(0, `rgba(255,214,140,${(.55 + .12 * Math.sin(tick * .15)).toFixed(3)})`); glow.addColorStop(1, 'rgba(255,140,60,0)');
  ctx.fillStyle = glow; rect(gx0 - camX, gy0, w, h);
  ctx.imageSmoothingEnabled = false;                // 철문 부분을 위로 밀어 올린다 (창살 끝은 위에 남는다)
  ctx.drawImage(S1_IMG[b.base], gx0 / k, (gy0 - s1Top()) / k, w / k, h / k, gx0 - camX, gy0 - u * (h - 14), w, h);
  ctx.restore();
}
// 좁은 길: 뒤쪽 금지 구역에 그림자 띠 + 경계를 따라 상자·통·쇠사슬 더미 (부서지지 않는 장식)
function drawNarrowPath() {
  const top = walkTop(), y0 = GTOP - 40;
  const g = ctx.createLinearGradient(0, y0, 0, top + 6);
  g.addColorStop(0, 'rgba(6,3,8,.9)'); g.addColorStop(.8, 'rgba(6,3,8,.72)'); g.addColorStop(1, 'rgba(6,3,8,0)');
  ctx.fillStyle = g; rect(0, y0, VW, top + 6 - y0);
  const step = 84, first = Math.floor((camX - 60) / step);
  for (let i = first; i * step < camX + VW + 60; i++) {
    const x = i * step + 20 + hash(i * 3.1) * 26 - camX, y = top - 2, kind = Math.floor(hash(i + .37) * 3);
    if (kind === 0) { if (!drawItemSprite('box', x, y, 46, 46)) { ctx.fillStyle = '#6b4224'; rect(x - 18, y - 36, 36, 36); } }
    else if (kind === 1) drawDrum(x, y);
    else drawChainPile(x, y);
  }
}
function drawDrum(x, y) {
  ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(x, y, 18, 5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#4a2a14'; rect(x - 14, y - 38, 28, 37);
  ctx.fillStyle = '#6a3e1e'; rect(x - 12, y - 38, 20, 37);
  ctx.fillStyle = '#8a5a2e'; rect(x - 10, y - 38, 4, 37);
  ctx.fillStyle = '#2a2a30'; rect(x - 15, y - 31, 30, 3); rect(x - 15, y - 11, 30, 3);   // 쇠테
  ctx.fillStyle = '#5a5a66'; rect(x - 15, y - 31, 30, 1); rect(x - 15, y - 11, 30, 1);
  ctx.fillStyle = '#2e1a0c'; ctx.beginPath(); ctx.ellipse(x, y - 38, 14, 4, 0, 0, Math.PI * 2); ctx.fill();   // 뚜껑
  ctx.strokeStyle = '#7a4c28'; ctx.lineWidth = 1; ctx.stroke();
}
function drawChainPile(x, y) {
  ctx.save(); ctx.strokeStyle = '#3a3a42'; ctx.lineWidth = 3;
  for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.ellipse(x - 14 + i * 5.5, y - 4 - (i % 2) * 5, 4, 3, i * .7, 0, Math.PI * 2); ctx.stroke(); }
  ctx.strokeStyle = '#7a7a86'; ctx.lineWidth = 1;
  for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.ellipse(x - 14 + i * 5.5, y - 5 - (i % 2) * 5, 3, 2, i * .7, 0, Math.PI); ctx.stroke(); }
  ctx.restore();
}
// 픽셀 나무 발코니. 캐릭터 뒤의 지지대와 캐릭터 앞의 난간을 나눠 그린다.
function drawScaffold(wx, front) {
  const x = Math.round(wx - camX), fy = Math.round(GTOP + 10 - BALCONY_H), w = 82;
  if (x < -w || x > VW + w) return;
  if (front) {
    ctx.fillStyle = '#211611'; rect(x - 41, fy - 20, 82, 5);
    for (const dx of [-39, -21, -3, 15, 35]) rect(x + dx, fy - 17, 4, 18);
    ctx.fillStyle = '#745037'; rect(x - 40, fy - 20, 80, 2);
    ctx.fillStyle = '#ac7950'; rect(x - 37, fy - 20, 24, 1); rect(x + 4, fy - 20, 25, 1);
    ctx.fillStyle = '#5b3b29';
    for (const dx of [-38, -20, -2, 16, 36]) rect(x + dx, fy - 15, 1, 13);
    return;
  }
  const base = Math.round(GTOP + 6), height = base - fy;
  ctx.fillStyle = '#211611'; rect(x - 35, fy, 9, height); rect(x + 26, fy, 9, height);
  ctx.fillStyle = '#523623'; rect(x - 33, fy + 5, 5, height - 5); rect(x + 28, fy + 5, 5, height - 5);
  ctx.fillStyle = '#795136'; rect(x - 32, fy + 12, 1, height - 18); rect(x + 29, fy + 17, 1, height - 25);
  // 계단식 대각 버팀목으로 픽셀 격자를 유지한다.
  ctx.fillStyle = '#392519';
  for (let i = 0; i < 9; i++) rect(x - 27 + i * 6, fy + 13 + i * 6, 8, 6);
  ctx.fillStyle = '#6c482e';
  for (let i = 0; i < 9; i++) rect(x - 27 + i * 6, fy + 13 + i * 6, 6, 2);
  ctx.fillStyle = '#211611'; rect(x - 44, fy, 88, 11); rect(x - 39, fy + 11, 78, 3);
  ctx.fillStyle = '#674329'; rect(x - 42, fy + 2, 84, 7);
  ctx.fillStyle = '#a17149'; rect(x - 42, fy + 1, 84, 2);
  ctx.fillStyle = '#3c291d';
  for (const dx of [-27, -6, 15, 35]) rect(x + dx, fy + 3, 2, 5);
  ctx.fillStyle = '#c09162'; rect(x - 37, fy + 3, 9, 1); rect(x - 1, fy + 4, 11, 1); rect(x + 23, fy + 3, 8, 1);
}
// 화염병 투척자는 그을린 주황빛, 발코니 적은 어둡게. 발코니에서는 그림자를 그리지 않는다
function drawStage1Enemy(e) {
  if (!e.s1) return false;
  if (drawStage1Soldier(e)) return true;
  if (!e.molotov && !e.balcony) return false;      // 이하: 새 그림이 없을 때의 임시 표시
  ctx.save();
  ctx.filter = (e.molotov ? 'sepia(.55) saturate(1.7) hue-rotate(-12deg) ' : '') + (e.balcony ? 'brightness(.62)' : 'brightness(.95)');
  if (!(e.balcony && paintNamedFrame(namedEnemyFrame(e), e, false))) drawEnemyBody(e);
  ctx.restore();
  return true;
}
// ---------------------------------------------------------------- 새 적 그림 (stage1-enemy-art.js, tools/enemy_sheets.py)
const S1_ENEMY_IMG = Object.fromEntries(Object.entries(STAGE1_ENEMY_ART).map(([id, a]) => [id, S1_IMG[a.atlas]]));
// 상태 → [동작 id, 칸 번호(0부터)]
// getup: 기상 시트(6칸 × 5틱). throw: 투척 시트 1~5칸이 30틱 예고, 6칸에서 병을 놓고 6~10칸은 던진 뒤 15틱 동안.
function stage1SoldierFrame(e) {
  const art = STAGE1_ENEMY_ART[e.s1], n = c => art.clips[c].length, at = (c, u) => [c, clamp(Math.floor(u * n(c)), 0, n(c) - 1)];
  const loop = (c, tpf) => [c, Math.floor(tick / tpf + e.id * 3) % n(c)];
  const hound = e.s1 === 'hound';
  if (e.st === 'dead') return hound ? ['knockdown', animIndex(S1_ANIM.houndKd, e.t)] : at('knockdown', e.t / 25);
  if (e.st === 'down') return hound ? ['knockdown', animIndex(S1_ANIM.houndKd, e.t)] : at('knockdown', e.t / 40);
  if (e.st === 'rec' && e.getup) return ['getup', animIndex(hound ? S1_ANIM.houndGetup : S1_ANIM.getup, e.t)];
  if (e.st === 'hurt') {
    if (hound) return ['hurt', Math.min(5, Math.floor(e.t / S1_ANIM.houndHurt))];
    const [, i] = at('hurt', e.t / (e.hurtT || 18) / 2);   // 1~5 상단 피격, 6~10 하단 피격
    return ['hurt', clamp(i, 0, 4) + (e.hitLow ? 5 : 0)];
  }
  if (hound) {
    if (e.st === 'grabbing') return ['dive', 4];  // 물고 있는 동안 5번 칸 고정 (좌우 흔들림은 그릴 때)
    if (e.st === 'trip') { const i = animIndex(S1_ANIM.trip.map(([, l]) => l), e.t); return ['knockdown', S1_ANIM.trip[i][0]]; }
    if (e.dv) return ['dive', e.dv.f];
    return e.walk ? loop('run', 3) : loop('idle', 6);
  }
  if (e.st === 'grabbing') return loop('choke', HEAVY_GRAB.chokeTpf);
  if (e.mv) return [e.mv.clip, e.mv.f];
  if (e.molotov) {                                  // 던지기: 1~5칸 예고 30틱(각 6틱), 6칸에서 병을 놓고 6~10칸 3,4,5,5,6틱
    if (e.pat === 'throw' && e.st === 'wind') return ['throw', clamp(Math.floor(e.t / (MOLOTOV.wind / 5)), 0, 4)];
    if (e.pat === 'kick') return ['throw', e.st === 'wind' ? 4 : 6];
    const since = e.throwAt === undefined ? Infinity : tick - e.throwAt;
    if (since < S1_ANIM.throwFollow.reduce((a, b) => a + b, 0)) return ['throw', 5 + animIndex(S1_ANIM.throwFollow, since)];
  }
  return e.walk ? loop('walk', 5) : loop('idle', 8);
}
const S1_TINT = {}, S1_TINT_FILTER = { dark: 'brightness(.62)', red: 'sepia(1) saturate(6) hue-rotate(-45deg) brightness(1.15)' };
function tintedAtlas(id, kind, source = S1_ENEMY_IMG[id], variant = '') {
  const key = id + kind + variant;
  if (S1_TINT[key]) return S1_TINT[key];
  const im = source, c = document.createElement('canvas');
  c.width = im.naturalWidth; c.height = im.naturalHeight;
  const g = c.getContext('2d'); g.filter = S1_TINT_FILTER[kind]; g.drawImage(im, 0, 0);
  c.naturalWidth = c.width; c.naturalHeight = c.height;   // drawLit 이 이미지처럼 크기를 읽는다
  return (S1_TINT[key] = c);
}
// Remove thin, disconnected pieces that crossed a source sheet's cell boundary.
const S1_CLEAN_FRAMES = new Map();
function cleanStage1Frame(id, src, sx, sy, w, h) {
  const key = [id, sx, sy, w, h].join(':');
  if (S1_CLEAN_FRAMES.has(key)) return S1_CLEAN_FRAMES.get(key);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(src, sx, sy, w, h, 0, 0, w, h);
  const image = g.getImageData(0, 0, w, h), pixels = image.data, seen = new Uint8Array(w * h), parts = [];
  for (let n = 0; n < w * h; n++) {
    if (seen[n] || pixels[n * 4 + 3] <= 16) continue;
    const stack = [n], part = []; seen[n] = 1; let x0 = w, x1 = 0, y0 = h, y1 = 0;
    while (stack.length) {
      const i = stack.pop(), x = i % w, y = Math.floor(i / w); part.push(i);
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy, j = yy * w + xx;
        if (xx >= 0 && xx < w && yy >= 0 && yy < h && !seen[j] && pixels[j * 4 + 3] > 16) { seen[j] = 1; stack.push(j); }
      }
    }
    parts.push({ part, x0, x1, y0, y1 });
  }
  const largest = Math.max(0, ...parts.map(p => p.part.length));
  for (const p of parts) {
    const edge = p.x0 === 0 || p.x1 === w - 1 || p.y0 === 0 || p.y1 === h - 1;
    const sliver = p.x1 - p.x0 + 1 <= w * .08 || p.y1 - p.y0 + 1 <= h * .08;
    if (edge && sliver && p.part.length < largest * .08) for (const i of p.part) pixels[i * 4 + 3] = 0;
  }
  g.putImageData(image, 0, 0); S1_CLEAN_FRAMES.set(key, c); return c;
}
function drawStage1Soldier(e) {
  const art = STAGE1_ENEMY_ART[e.s1], im = S1_ENEMY_IMG[e.s1];
  if (!art || !im?.naturalWidth) return false;
  if (e.st === 'dead' && e.t > 25 && Math.floor(tick / 4) % 2) return true;   // 끝 프레임에서 40틱 깜빡이다 사라진다
  const [clip, i] = stage1SoldierFrame(e);
  const clubAttack = e.s1 === 'club' && clip === 'attack';
  const clubAnchors = [[190,338],[192,338],[180,338],[235,338],[240,338],
    [215,332],[190,332],[230,332],[225,332],[240,332]];
  const col = i % 5, row = Math.floor(i / 5);
  const fr = clubAttack ? { atlas: [col * 411, row * 382, col === 4 ? 412 : 411, row === 0 ? 382 : 383], anchor: clubAnchors[i] } : art.frames[art.clips[clip][i]];
  const k = clubAttack ? .38 : art.scale * (e.s1 === 'heavy' && clip === 'spin' ? 1.6 : 1);
  const [sx, sy, w, h] = fr.atlas, [ax, ay] = fr.anchor, x = e.x - camX + (e.bite && e.st === 'grabbing' ? (tick % 4 < 2 ? 2 : -2) : 0);
  if (!e.balcony) drawShadow(x, e.y, e.s1 === 'heavy' ? 22 : e.s1 === 'hound' ? 18 : 15, e.z);
  ctx.save();
  const hurt = e.hr < 220 ? Math.cos(e.hr * .03) * Math.exp(-e.hr / 150) * (e.hdir || 1) * 3 : 0;
  ctx.translate(x + hurt, e.y - e.z); ctx.scale(e.face, 1);
  ctx.globalAlpha = e.alpha ?? 1;
  // 발코니 위는 어둡게(뒤쪽), 경직 내성은 붉은 점멸 — 매 프레임 ctx.filter 대신 미리 칠해 둔 아틀라스를 쓴다
  const red = e.redFlash > 0 && Math.floor(e.redFlash / 2) % 2 === 0;
  const base = clubAttack ? S1_IMG[S1_CLUB_ATTACK] : im;
  if (!base?.naturalWidth) { ctx.restore(); return false; }
  const variant = clubAttack ? ':attack' : '';
  const src = red ? tintedAtlas(e.s1, 'red', base, variant) : e.balcony ? tintedAtlas(e.s1, 'dark', base, variant) : base;
  smoothFor(k);
  const frame = cleanStage1Frame(e.s1 + variant + (red ? 'red' : e.balcony ? 'dark' : 'normal'), src, sx, sy, w, h);
  drawLit(frame, 0, 0, w, h, -ax * k, -ay * k, w * k, h * k, e.flash > 0 && UX.options.flash ? 2 : 1);
  ctx.restore();
  return true;
}

// ---------------------------------------------------------------- 기믹 이펙트 스프라이트 (stage1-fx-art.js, tools/stage_fx.py)
// 그림이 아직 없으면 아래의 임시 도형 그리기가 대신한다
function s1Fx(id) { const f = STAGE1_FX[id]; return !!(f && S1_IMG[f.file]?.naturalWidth); }
// 월드 좌표 (x, y) 에 기준점을 맞춰 한 칸 그린다. 불 시트는 가산 합성
function drawFx(id, frame, x, y, o = {}) {
  if (!s1Fx(id)) return false;
  const f = STAGE1_FX[id], k = f.scale * (o.mul || 1), i = ((frame % f.frames) + f.frames) % f.frames;
  ctx.save(); ctx.imageSmoothingEnabled = false;
  if (f.additive) ctx.globalCompositeOperation = 'lighter';
  if (o.alpha !== undefined) ctx.globalAlpha = clamp(o.alpha, 0, 1);
  ctx.translate(Math.round(x - camX), Math.round(y));
  if (o.flip) ctx.scale(-1, 1);
  ctx.drawImage(S1_IMG[f.file], i * f.w, 0, f.w, f.h, -f.ax * k, -f.ay * k, f.w * k, f.h * k);
  ctx.restore();
  return true;
}
// 착지 먼지(dust, 4틱/칸). 그림이 없으면 기존 임시 먼지
function landingDust(x, y, mul = 1) {
  if (s1Fx('dust')) S1.fx.push({ id: 'dust', x, y, h: 0, t: 0, tpf: 4, mul });
  else burst(x, y, 4, ['#c8b890', '#8a7a5a', '#5a4a3a']);
}
// updFx 에서: 유리·돌 파편(튀었다가 떨어지며 사라짐), 한 번 재생하는 먼지·불씨
function updStage1Fx() {
  if (!S1.fx.length) return;
  for (const p of S1.fx) {
    p.t++;
    if (p.g) {
      p.x += p.vx; p.y += p.vy || 0; p.h += p.vh; p.vh -= p.g;
      if (p.h <= 0) { p.h = 0; p.vh = 0; p.vx *= .5; p.vy = 0; }
      if (p.t >= p.life) p.dead = true;
    } else {
      p.h += p.vh || 0;
      if (p.t >= STAGE1_FX[p.id].frames * p.tpf) p.dead = true;
    }
  }
  S1.fx = S1.fx.filter(p => !p.dead);
}
// 캐릭터 뒤, 바닥 위: 바닥 불(fire_burst 4틱/칸 → fire_loop 5틱/칸 반복 → 마지막 30틱 fire_out 6틱/칸), 불씨, 유리·돌 파편, 먼지
function drawStage1GroundSprites() {
  if (!stage1On()) return;
  for (const z of hazards) {
    if (z.type !== 'fire' || !s1Fx('fire_loop')) continue;
    const t = Math.floor(z.age / MS), left = FIRE.life - t, y = z.y + FIRE_SPRITE_BASE;
    if (left <= 30) drawFx('fire_out', Math.min(4, Math.floor((30 - left) / 6)), z.x, y);
    else if (t < 28) drawFx('fire_burst', Math.floor(t / 4), z.x, y);
    else drawFx('fire_loop', Math.floor((t - 28) / 5), z.x, y);
  }
  for (const p of S1.fx) {
    if (p.g) drawFx(p.id, p.f, p.x, p.y - p.h, { flip: p.flip, alpha: Math.min(1, (p.life - p.t) / 8) });
    else drawFx(p.id, Math.floor(p.t / p.tpf), p.x, p.y - p.h, { mul: p.mul });
  }
}
// 캐릭터 앞: 날아가는 화염병(bottle_spin 3틱/칸, 던진 방향으로 반전) + 심지 불(fuse, 회전하지 않고 항상 위로), 던지기 예고 중 손의 심지 불
function drawStage1TopSprites() {
  if (!stage1On() || !s1Fx('bottle_spin')) return;
  const fuseH = s1Fx('fuse') ? STAGE1_FX.bottle_spin.h * STAGE1_FX.bottle_spin.scale * .35 : 0;
  for (const z of hazards) {
    if (z.type !== 'molotov') continue;
    const t = Math.floor(z.age / MS), x = z.x, y = z.y - z.h, flip = z.tx < z.x0;
    drawFx('bottle_spin', Math.floor(t / 3), x, y, { flip });
    if (fuseH) drawFx('fuse', Math.floor(t / 6), x, y - fuseH);
  }
  if (s1Fx('fuse') && !S1_ENEMY_IMG.molotov?.naturalWidth) for (const e of enemies) {   // 새 그림은 손의 병에 이미 불이 있다
    if (!e.molotov || e.st !== 'wind' || e.pat !== 'throw') continue;
    drawFx('fuse', Math.floor(tick / 6), e.x - e.face * 12, e.y - e.z - 70, { mul: .8 });
  }
}

// 이펙트 층(도트 1칸 = 월드 2px). 바닥: 붉은 표식·바닥 불 (캐릭터 뒤)
function drawStage1Ground(L) {
  for (const z of hazards) {
    if (z.type === 'firemark') {
      const x = fxX(z.x), y = fxY(z.y), rx = FIRE.rx / SC, ry = FIRE.ry / SC, a = .55 + .35 * Math.sin(z.age * .02);
      for (let i = 0; i < 64; i++) { const t = i / 64 * Math.PI * 2; L.put(x + Math.cos(t) * rx, y + Math.sin(t) * ry, '#ff2a2a', a); }
      for (let dy = -ry + 1; dy < ry; dy++) { const hw = rx * Math.sqrt(1 - (dy / ry) ** 2); L.line(x - hw, y + dy, x + hw, y + dy, '#ff2a2a', 1, .12); }
    } else if (z.type === 'fire' && !s1Fx('fire_loop')) {   // 임시 도형(스프라이트가 없을 때)
      const k = fireScale(z), x = fxX(z.x), y = fxY(z.y), rx = FIRE.rx / SC * k, ry = Math.max(1, FIRE.ry / SC * k), t = z.age;
      for (let dy = -Math.floor(ry); dy <= ry; dy++) {
        const hw = rx * Math.sqrt(Math.max(0, 1 - (dy / ry) ** 2));
        L.line(x - hw, y + dy, x + hw, y + dy, '#3a0c06', 1, .5);
        L.line(x - hw * .7, y + dy, x + hw * .7, y + dy, '#c8401a', 1, .35);
      }
      const n = Math.max(3, Math.round(16 * k));
      for (let i = 0; i < n; i++) {               // 일렁이는 불꽃 혀
        const hx = (hash(z.seed + i * 1.7) - .5) * 2, hy = (hash(z.seed * 2 + i * 3.3) - .5) * 2 * Math.sqrt(1 - hx * hx);
        const fx = x + hx * rx * .9, fy = y + hy * ry * .8, fl = (3 + 5 * hash(z.seed + i)) * k * (.6 + .4 * Math.sin(t * .018 + i * 1.9));
        L.line(fx, fy, fx + Math.sin(t * .01 + i), fy - fl, '#ff7a1a', 2, .9);
        L.line(fx, fy - 1, fx, fy - fl * .6, '#ffd060', 1, .9);
        if ((tick + i) % 6 < 3) L.put(fx, fy - fl - 1, '#fff0b0', .7);
      }
    } else if (z.type === 'molotov') L.disc(Math.round(fxX(z.x)), Math.round(fxY(z.y)), 2, '#000000', .3);
  }
}
// 위: 날아가는 화염병, 던지기 예고 중 심지 불빛
function drawStage1Top(L) {
  if (s1Fx('bottle_spin')) return;                 // 스프라이트는 drawStage1TopSprites 가 그린다 (이건 임시 도형)
  for (const z of hazards) {
    if (z.type !== 'molotov') continue;
    const x = Math.round(fxX(z.x)), y = Math.round(fxY(z.y, z.h)), fl = tick % 4 < 2 ? 1 : 2;
    L.rect(x - 1, y - 2, 3, 5, '#2e4a2e'); L.put(x, y - 1, '#6a9a6a'); L.rect(x, y - 4, 1, 2, '#c8b890');
    L.disc(x, y - 6, fl, '#ff9a2a', .9); L.put(x, y - 7, '#fff0a0');
    L.put(x - Math.sign(z.tx - z.x0) * 3, y - 5, '#ff7a1a', .5);
  }
  for (const e of enemies) {
    if (!e.molotov || e.st !== 'wind' || e.pat !== 'throw') continue;
    const x = Math.round(fxX(e.x - e.face * 12)), y = Math.round(fxY(e.y, e.z + 76)), fl = tick % 4 < 2 ? 1 : 2;
    L.disc(x, y, fl + 1, '#ff7a1a', .55); L.put(x, y, '#fff0a0');
  }
}
// 화면 좌표: 구간 이름(전환 때), 전환 어둠
function drawStage1Overlay() {
  if (!stage1On()) return;
  if (S1.banner > 0 && !S1.fade) {
    const a = clamp(Math.min(S1.banner, 170 - S1.banner) / 20, 0, 1);
    ctx.save(); ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(0,0,0,.55)'; rect(0, 138, W, 58);
    pxText(`AREA ${S1.idx + 1}`, W / 2, 156, '#e45b64', 9, 'center');
    krText(S1.sec.name, W / 2, 184, '#ffe5dd', 24, 'center', '#5a0a14');
    ctx.restore();
  }
  if (S1.fade) {
    const t = S1.fade.t, a = t <= S1_FADE ? t / S1_FADE : 1 - (t - S1_FADE) / S1_FADE;
    ctx.fillStyle = `rgba(8,6,11,${clamp(a, 0, 1).toFixed(3)})`; rect(0, 0, W, H);
  }
}
