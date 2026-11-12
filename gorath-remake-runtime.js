'use strict';
// =====================================================================
//  1스테이지 보스 "도살자 고라스" 리메이크 (type 'boss1')
//  그림·측정값: gorath-remake-art.js (tools/gorath_remake.py). 이전 고라스는 'boss1_old' (gorath-runtime.js + game.js runLegacyPat).
//  탁자 인트로 → 1페이즈(내려찍기·내지르기·몸통 박치기·회전 베기·갈고리) → 변신(체력·그로기 회복)
//  → 2페이즈(두 번 내려찍기·갈고리 주먹·황소 돌진·갈고리·궁극기 "도살장의 비") → 사망.
//  시간 단위는 틱(1/60초). 프레임 번호는 표에서 1부터, 코드의 fi 는 0부터.
//  주소 옵션: ?boss_phase=2 (2페이즈 바로 시작) · ?boss_ult=1 (궁극기 바로 발동) · ?boss1=old (이전 고라스)
// =====================================================================
const G2A = GORATH2_ART, G2M = G2A.marks;
const G2_DEBUG = (() => { const q = new URLSearchParams(location.search); return { phase: Number(q.get('boss_phase')) || 1, ult: q.get('boss_ult') === '1', old: q.get('boss1') === 'old' }; })();
// 아틀라스: 인트로·1페이즈·갈고리·사슬은 1스테이지 로딩 때, 변신·2페이즈·고기는 뒤에서 따로 불러온다
const G2_EARLY = [...new Set(Object.entries(G2A.clips).filter(([id]) => /^(intro_|p1_|hook$|chain$)/.test(id)).flatMap(([, c]) => c.frames.map(f => f.p)))];
const G2_LATE = G2A.pages.map((_, i) => i).filter(i => !G2_EARLY.includes(i));
const G2_IMG = [];
const g2Early = GameAssets.group(0, G2_EARLY.map(i => G2A.pages[i])), g2Late = GameAssets.group('gorath2-late', G2_LATE.map(i => G2A.pages[i]));
G2_EARLY.forEach((p, i) => { G2_IMG[p] = g2Early.images[i]; }); G2_LATE.forEach((p, i) => { G2_IMG[p] = g2Late.images[i]; });
function gorath2LoadLate() { g2Late.ready.then(() => {}, () => {}); }

// ---------------------------------------------------------------- 수치 (플레이해 보고 조정)
// 기준값 = 이전 고라스(boss1_old): 체력, 내려찍기(slamImpact)·돌진(rage)·갈고리(끌려와 맞는 피해)·고기 투척 피해, 이동 속도, 돌진 거리
const G2_BASE = { hp: 700, slam: 14, rush: 16, hook: 20, meat: 11, spd: 1.05, rushPx: 238 };
const G2 = {
  hp: [Math.round(G2_BASE.hp * .55), Math.round(G2_BASE.hp * .6)],   // 페이즈마다 따로 가진 체력: 385 / 420
  grMax: 150,                                    // 그로기 게이지(이전 고라스와 같음)
  bossX: .27, playerX: .7,                       // 인트로 위치(화면 폭 기준): 고라스는 왼쪽, 플레이어는 오른쪽에서 걸어 들어온다
  gap: [[40, 70], [25, 45]],                     // 공격 사이 대기
  spd: [G2_BASE.spd, G2_BASE.spd * 1.25], walkRate: [1, 1.2],
  near: 115, mid: 250,                           // 거리 구간
  hurt: [10, 6], lying: [40, 25], getupTpf: [4, 3], kdTpf: 3,
  hookSpeed: 8, hookRange: .55, hookBack: 14,      // 최대 사거리 = 화면 폭 × 0.55
  ult: [.50, .35], castTpf: 4, shakeTpf: 4, shakeLoops: 7, hookFly: 10, breath: 120,
  meatLand: 72, meatMax: 6, meatGap: 80,
};
// 고기: 피해 반경, 피해, 착지 흔들림
const G2_MEAT = {
  meat_bundle: { r: 70, dmg: G2_BASE.meat, shake: 4 }, meat_bone: { r: 70, dmg: G2_BASE.meat, shake: 4 },
  meat_carcass: { r: 120, dmg: Math.round(G2_BASE.meat * 1.6), shake: 8 },
};
// 동작: len = 프레임별 틱, warnTo = 이 프레임까지 예고(머리 위 "!"), range = 이 거리 안에서 시작, step = 앞으로 이동(프레임 구간, 총 거리)
// hits 의 판정 프레임·앞뒤 거리는 GORATH2_ART.hits (그림에서 잰 칼날·주먹 끝). radial = 앞뒤 모두, link = 갈고리에 잡힌 플레이어에게 넣는 피해 비율
const G2_MOVES = {
  chop:   { clip: 'p1_chop', name: '내려찍기', range: 78, len: [6, 6, 6, 6, 6, 4, 3, 6, 9, 10], warnTo: 5,
            hits: [{ dmg: G2_BASE.slam, kd: true, slam: 9, link: 1 }] },
  thrust: { clip: 'p1_thrust', name: '내지르기', range: 140, len: [6, 6, 6, 6, 6, 4, 4, 4, 5, 10], warnTo: 5, step: { f: [6, 6], px: 44 },
            hits: [{ dmg: G2_BASE.slam * .8 }] },
  tackle: { clip: 'p1_tackle', name: '몸통 박치기', range: 230, len: [6, 6, 6, 6, 6, 8, 8, 8, 8, 14], warnTo: 5, step: { f: [6, 9], px: G2_BASE.rushPx }, dust: true,
            hits: [{ dmg: G2_BASE.rush, kd: true }] },
  sweep:  { clip: 'p1_sweep', name: '회전 베기', range: 86, len: [5, 5, 5, 5, 5, 5, 5, 5, 3, 3, 3, 3, 3, 6, 7, 8], warnTo: 8,
            hits: [{ dmg: G2_BASE.slam * .9, radial: true }] },
  hook:   { clip: 'p1_hook', name: '갈고리 던지기', range: 330, len: [5, 5, 5, 5, 5, 5, 5, 5, 3, 3, 3, 3, 3, 3, 3, 3], warnTo: 8, hook: true, pull: 'p1_hook_pull', pullTpf: 5, link: 'chop' },
  dchop:  { clip: 'p2_double_chop', name: '두 번 내려찍기', range: 108, len: [6, 6, 6, 6, 6, 3, 3, 5, 5, 5, 5, 3, 5, 6, 7, 8], warnTo: 5,
            hits: [{ dmg: G2_BASE.slam * .6, slam: 7, link: .4 }, { dmg: G2_BASE.slam, kd: true, slam: 12, link: .6 }] },
  punch:  { clip: 'p2_punch', name: '갈고리 주먹', range: 96, len: [4, 4, 4, 4, 4, 4, 3, 3, 3, 3, 4, 5, 5, 5, 5, 5], warnTo: 6,
            hits: [{ dmg: G2_BASE.slam * .7 }] },
  charge: { clip: 'p2_charge', name: '황소 돌진', range: 300, len: [6, 6, 6, 6, 6, 5, 5, 5, 5, 5, 5, 5, 6, 6, 7, 8], warnTo: 5, step: { f: [6, 12], px: G2_BASE.rushPx * 1.3 }, dust: true, ghost: true,
            hits: [{ dmg: G2_BASE.rush * 1.2, kd: true }] },
  hook2:  { clip: 'p2_hook', name: '갈고리 던지기', range: 330, len: [4, 4, 4, 4, 4, 4, 4, 4, 3, 3, 3, 3, 3, 3, 3, 3], warnTo: 8, hook: true, pull: 'p2_hook_pull', pullTpf: 6, link: 'dchop' },
};
// 패턴 선택 가중치 [1페이즈, 2페이즈] × 거리(가까움·중간·멀리). walk = 조금 더 걷는다. 같은 패턴 연속 2회 금지
const G2_PICK = [
  { near: [['chop', 35], ['sweep', 25], ['tackle', 20], ['thrust', 20]], mid: [['thrust', 40], ['tackle', 35], ['hook', 25]], far: [['hook', 60], ['walk', 40]] },
  { near: [['dchop', 40], ['punch', 35], ['charge', 25]], mid: [['charge', 40], ['hook2', 35], ['punch', 25]], far: [['hook2', 60], ['walk', 40]] },
];
const G2_NAMES = { ...Object.fromEntries(Object.entries(G2_MOVES).map(([id, m]) => [id, m.name])), transform: '', ult: '도살장의 비' };
// 변신: transform 1~5 → (6,7)×3 → 8~16, 프레임당 5틱
const G2_TRANSFORM = { tpf: 5, seq: [1, 2, 3, 4, 5, 6, 7, 6, 7, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16], repeatFrom: 5, repeatShake: [3, 6, 10], burst: 11, roar: 15 };

function isGorath2(e) { return e?.type === 'boss1'; }
function g2Data(e) {
  if (!e.g2) {
    e.g2 = { phase: 1, st: e.st, clip: 'p1_idle', fi: 0, act: null, hook: null, grabbing: false, meats: [], last: null, want: null, wantT: 0,
      ult: [false, false], ultQueue: 0, breath: 0, tail: 0, age: 0, walkT: 0, jitter: 0, barBlink: 0, guard: false, pendingT: false, cardT: 0, introI: -1, dark: 0 };
    e.grMax = G2.grMax; e.damageScale = 1;       // 피해는 표의 값 그대로(2페이즈 공통 배율을 쓰지 않는다)
    e.max = e.hp = G2.hp[0]; e.nextKd = e.max * .75;
  }
  return e.g2;
}
const g2Pre = g => g.phase === 2 ? 'p2_' : 'p1_';
const g2Len = id => G2A.clips[id].frames.length;
function g2Idx(lens, t) { let acc = 0; for (let i = 0; i < lens.length; i++) { acc += lens[i]; if (t < acc) return i; } return lens.length - 1; }

// 화면 연출(붉은 조명·어둠·섬광·기술 이름)과 작은 입자, 쓰러진 몸
const G2S = { red: 0, redTo: 0, dim: 0, dimTo: 0, white: 0, title: 0 };
let G2FX = [], gorath2Remains = [];
function resetGorath2() { Object.assign(G2S, { red: 0, redTo: 0, dim: 0, dimTo: 0, white: 0, title: 0 }); G2FX = []; gorath2Remains = []; }
function g2Bit(x, y, h, vx, vh, col, life = 30, size = 3, grav = .4) { G2FX.push({ x, y, h, vx, vh, col, life, size, grav, t: 0 }); }
function g2TickFx() {
  for (const q of G2FX) { q.t++; q.x += q.vx; q.h += q.vh; q.vh -= q.grav; if (q.h < 0) { q.h = 0; q.vh *= -.3; q.vx *= .5; } }
  if (G2FX.length) G2FX = G2FX.filter(q => q.t < q.life);
  G2S.red += clamp(G2S.redTo - G2S.red, -.03, .03); G2S.dim += clamp(G2S.dimTo - G2S.dim, -.08, .08);
  if (G2S.white > 0) G2S.white--; if (G2S.title > 0) G2S.title--;
}
function g2Dust(x, y, n = 6) { for (let i = 0; i < n; i++) g2Bit(x + rand(-22, 22), y + rand(-4, 4), rand(2, 10), rand(-1.6, 1.6), rand(1, 3), ['#c8b890', '#8a7a5a', '#5a4a3a'][i % 3], rand(18, 30), 3, .25); }

// ---------------------------------------------------------------- 인트로 (구간 E 진입)
// 고기 썰기(프레임당 6틱에서 반복마다 15%씩 빨라져 2틱까지) → 응시(정적, 눈빛 2번) → 탁자 박살 + 포효 → 전투 시작
const G2_INTRO = (() => {
  const tl = [];
  for (let tpf = 6; ; tpf *= .85) {
    const t = Math.max(2, Math.round(tpf));
    for (let f = 0; f < g2Len('intro_chop'); f++) tl.push({ clip: 'intro_chop', fi: f, len: t, ev: G2M.intro_chop.hit.includes(f + 1) ? 'chop' : null });
    if (t <= 2) break;
  }
  tl.push({ clip: 'intro_smash', fi: 0, len: 12, ev: 'hush' }, { clip: 'intro_smash', fi: 1, len: 50, ev: 'stare' });
  for (let f = 2; f < g2Len('intro_smash'); f++) tl.push({ clip: 'intro_smash', fi: f, len: f === 5 || f === 6 ? 3 : 4, ev: f + 1 === G2M.intro_smash.hit ? 'smash' : f === 8 ? 'roar' : null });
  let at = 0; for (const s of tl) { s.at = at; at += s.len; }
  return { tl, total: at, stareAt: tl.find(s => s.ev === 'stare').at };
})();
function gorath2IntroDuration() { return G2_INTRO.total * MS; }
// 구간에 들어설 때(stage1-runtime.js enterSection): 탁자 앞의 고라스를 미리 세워 두고, 플레이어는 오른쪽 문 밖에서 시작한다
function gorath2Prepare() {
  const b = mkEnemy('boss1', camX + VW * G2.bossX, 428), g = g2Data(b), p = player;
  b.st = g.st = 'intro'; b.face = 1; g.clip = 'intro_chop'; g.fi = 0; enemies.push(b);
  p.x = camX + VW + 26; p.y = 434; p.face = -1;
  gorath2LoadLate();
  return b;
}
// 보스 이벤트 시작(stage1-runtime.js beginEvent)
function gorath2BeginIntro() {
  const b = enemies.find(e => isGorath2(e) && e.st === 'intro') || gorath2Prepare(), g = g2Data(b), p = player;
  if (G2_DEBUG.phase === 2 || G2_DEBUG.ult) {     // 디버그: 인트로 없이 2페이즈로
    p.x = camX + VW * G2.playerX; AUDIO.bossMusic(stageIdx);
    g2StartPhase2(b, g); if (G2_DEBUG.ult) g.ultQueue = 1;
    return;
  }
  introBoss = b; introT = 0; introLand = false; scene = 'bossintro'; g.introI = -1;
}
function updateGorath2Intro(b) {
  const g = g2Data(b), p = player, n = Math.floor(introT / MS + 1e-6), tl = G2_INTRO.tl;
  b.z = 0; g.age++;
  const tx = camX + VW * G2.playerX;               // 플레이어 자동 이동(조작 잠금)
  if (p.x > tx) { p.x = Math.max(tx, p.x - 1.3); p.walk = true; p.face = -1; p.walkTime = (p.walkTime || 0) + MS; } else p.walk = false;
  while (g.introI + 1 < tl.length && tl[g.introI + 1].at <= n) {
    const s = tl[++g.introI];
    if (s.ev === 'chop') {                         // 칼날이 탁자에 닿는다: "탕!" + 작은 흔들림 + 고기 조각
      sfx('g2chop'); shake = Math.max(shake, 1);
      for (let i = 0; i < 3; i++) g2Bit(b.x + rand(-8, 22), b.y + 1, 44, rand(-1.4, 1.8), rand(1.5, 3.2), i ? '#a8283a' : '#e07a80', rand(16, 26), 2, .3);
    } else if (s.ev === 'hush') AUDIO.stop(.15);   // 정적
    else if (s.ev === 'smash') {                   // 탁자 박살
      shake = Math.max(shake, 10); sfx('slam');
      if (s1Fx('rubble_chunk')) for (let i = 0; i < 6; i++) S1.fx.push({ id: 'rubble_chunk', f: i % STAGE1_FX.rubble_chunk.frames, x: b.x + rand(-34, 40), y: b.y + 2, h: rand(14, 44),
        vx: rand(-3, 3.4), vy: rand(-.3, 1.2), vh: rand(2.5, 5), g: .35, t: 0, life: rand(34, 48), flip: Math.random() < .5 });
      for (let i = 0; i < 14; i++) g2Bit(b.x + rand(-34, 40), b.y + rand(0, 4), rand(14, 44), rand(-3.6, 3.6), rand(2, 5.5), ['#8a5a2e', '#6a3e1e', '#c08a4a', '#4a2a14'][i % 4], rand(26, 44), i % 3 ? 3 : 5, .35);
    } else if (s.ev === 'roar') { sfx('g2roar'); AUDIO.bossMusic(stageIdx); g.cardT = 1; }
  }
  const s = tl[Math.max(0, g.introI)]; g.clip = s.clip; g.fi = s.fi;
  if (g.cardT > 0) g.cardT++;
  g2TickFx();
}
// 응시 중 투구 눈빛: 50틱 동안 2번 깜빡인다 (0~1)
function g2EyeGlow() {
  if (scene !== 'bossintro' && !(scene === 'pause' && resumeScene === 'bossintro')) return 0;
  const t = introT / MS - G2_INTRO.stareAt;
  for (const from of [8, 28]) if (t >= from && t < from + 14) return Math.sin((t - from) / 14 * Math.PI);
  return 0;
}

// ---------------------------------------------------------------- 상태 (updEnemy 맨 앞에서)
function updateGorath2State(e) {
  if (!isGorath2(e)) return false;
  const g = g2Data(e);
  e.t++; g.age++;
  if (e.flash > 0) e.flash--; if (e.inv > 0) e.inv--; if (e.atkCd > 0) e.atkCd--;
  e.hr += MS; e.walk = false; e.z = 0; e.vz = 0; e.vx = 0; g.jitter = 0;
  if (g.barBlink > 0) g.barBlink--;
  if (g.cardT > 0) g.cardT++;
  if (e.st !== 'stun' && e.st !== 'dead') { if (e.grT > 0) e.grT--; else if (e.gr > 0) e.gr = Math.max(0, e.gr - .2); }   // 그로기 자연 회복(기존 규칙)
  g2TickFx();
  if (e.st !== g.st) g2Interrupted(e, g);          // damageEnemy 가 상태를 바꿨다(피격·넉다운·그로기·사망): 하던 동작 취소
  switch (e.st) {
    case 'intro': break;
    case 'chase': g2Chase(e, g); break;
    case 'pat': g2Act(e, g); break;
    case 'hurt': {                                 // 1페이즈: p1_hit 앞 6칸 / 2페이즈: 맞은 높이의 앞 3칸만, 덜 멈춘다
      const P = g.phase - 1, n = G2.hurt[P];
      g.clip = P ? (e.hitLow ? 'p2_hit_low' : 'p2_hit_high') : 'p1_hit';
      g.fi = Math.min(P ? 2 : 5, Math.floor(e.t / n * (P ? 3 : 6)));
      if (e.t > n) { e.st = 'chase'; e.t = 0; g.tail = P ? 0 : 4; }
      break;
    }
    case 'down': {                                 // 녹다운 그림 → 누운 채 → 기상(무적). 그림 안에서 몸이 움직이므로 위치는 그대로
      const clip = g2Pre(g) + 'knockdown', n = g2Len(clip), land = G2M[clip].land;
      g.clip = clip; g.fi = Math.min(n - 1, Math.floor((e.t - 1) / G2.kdTpf));
      if (e.t === (land - 1) * G2.kdTpf + 1) { shake = Math.max(shake, 8); sfx('land'); g2Dust(e.x - e.face * 40, e.y, 8); }
      if (e.t > n * G2.kdTpf + (g.pendingT ? 30 : G2.lying[g.phase - 1])) { e.st = 'rec'; e.t = 0; e.invuln = true; }
      break;
    }
    case 'rec': {                                  // 기상
      const clip = g2Pre(g) + 'getup', tpf = G2.getupTpf[g.phase - 1], n = g2Len(clip);
      g.clip = clip; g.fi = Math.min(n - 1, Math.floor((e.t - 1) / tpf)); e.invuln = true;
      if (e.t > n * tpf) {
        if (g.pendingT) { g.pendingT = false; g2StartTransform(e, g); }
        else { e.invuln = false; e.st = 'chase'; e.t = 0; e.atkCd = Math.round(rand(15, 35)); }
      }
      break;
    }
    case 'stun':                                   // 그로기 5초(기존 규칙): 피격 자세로 정지
      g.clip = g.phase === 2 ? 'p2_hit_high' : 'p1_hit'; g.fi = 2;
      if (e.t >= GROGGY_TICKS) { e.st = 'chase'; e.t = 0; e.gr = 0; e.grT = 0; e.atkCd = Math.round(rand(30, 60)); }
      break;
    case 'dead': g2Dead(e, g); break;
  }
  g2TickHook(e, g); g2TickMeats(e, g);
  g.st = e.st;
  e.x = clamp(e.x, camX + 34, camX + VW - 34); e.y = clamp(e.y, walkTop() + 10, GBOT);
  return true;
}
function g2Cancel(e, g) {                          // 진행 중인 공격·갈고리·잡기 취소 (잡힌 플레이어는 풀려난다)
  if (player.grab?.gorath2 && player.grab.owner === e) releaseGorath2Grab('cancel');
  g.hook = null; g.grabbing = false; g.act = null; g.want = null; g.wantT = 0; e.pat = null;
}
function g2Interrupted(e, g) {
  if (g.st === 'pat' || g.hook || g.grabbing) g2Cancel(e, g);
  if (e.st === 'chase' && g.st !== 'hurt') g.tail = 0;
}
function g2EndAct(e, g) {
  const [a, b] = G2.gap[g.phase - 1];
  g.act = null; g.hook = null; g.grabbing = false; e.pat = null; e.st = 'chase'; e.t = 0; e.atkCd = Math.round(rand(a, b));
}

// ---------------------------------------------------------------- 대기·걷기·패턴 선택
function g2Idle(e, g) {
  if (g.tail > 0) { g.clip = 'p1_hit'; g.fi = 10 - g.tail; g.tail--; return; }   // 피격 복귀 칸을 빠르게
  if (e.walk) { g.walkT += G2.walkRate[g.phase - 1]; g.clip = g2Pre(g) + 'walk'; g.fi = Math.floor(g.walkT / 6) % g2Len(g.clip); }
  else { g.clip = g2Pre(g) + 'idle'; g.fi = Math.floor(g.age / 8) % g2Len(g.clip); }
}
function g2Chase(e, g) {
  const p = player, dx = p.x - e.x, dy = p.y - e.y, adx = Math.abs(dx), P = g.phase - 1;
  if (p.st === 'dead') { g2Idle(e, g); return; }
  e.face = dx >= 0 ? 1 : -1;
  if (g.phase === 2 && g.breath <= 0) {            // 디버그 발동 및 체력이 외부에서 바뀐 경우의 보완 처리
    const r = e.hp / e.max, k = !g.ult[0] && r <= G2.ult[0] ? 0 : !g.ult[1] && r <= G2.ult[1] ? 1 : -1;
    if (k >= 0 || g.ultQueue > 0) { if (k >= 0) g.ult[k] = true; else g.ultQueue--; g2StartUlt(e, g); return; }
  }
  if (g.breath > 0) { g.breath--; g2Idle(e, g); return; }   // 궁극기 뒤 숨 고르기: 공격하지 않는다
  const want = g.want && G2_MOVES[g.want];
  const stop = want ? Math.max(60, want.range * .8) : 72;
  const mx = adx > stop + 6 ? p.x - e.face * stop - e.x : 0, my = Math.abs(dy) > 6 ? dy : 0, dist = Math.hypot(mx, my), spd = G2.spd[P];
  if (dist > 5) { e.x += mx / dist * spd; e.y += my / dist * spd * .8; e.walk = true; }   // 멀면 걷기, 가까우면 깊이만 맞춘다
  g2Idle(e, g);
  if (e.atkCd > 0 || p.st === 'down') return;
  if (!g.want) {
    const band = adx < G2.near ? 'near' : adx < G2.mid ? 'mid' : 'far';
    const list = G2_PICK[P][band].filter(([id]) => id !== g.last);
    let r = Math.random() * list.reduce((s, [, w]) => s + w, 0), pick = list[0][0];
    for (const [id, w] of list) { if ((r -= w) < 0) { pick = id; break; } }
    if (pick === 'walk') { e.atkCd = 40; g.last = 'walk'; return; }   // 조금 더 걸은 뒤 다시 고른다
    g.want = pick; g.wantT = 0;
  }
  const m = G2_MOVES[g.want];
  if (adx <= m.range && Math.abs(dy) <= 34) g2StartMove(e, g, g.want);
  else if (++g.wantT > 70) { g.want = null; e.atkCd = 8; }   // 닿지 못했다: 다시 고른다
}
function g2StartMove(e, g, id, linked = false) {
  g.act = { kind: 'move', id, t: 0, f: 1, used: new Set(), linked };
  g.want = null; g.wantT = 0; g.last = linked ? g.last : id;
  e.st = 'pat'; e.pat = id; e.t = 0; g.st = 'pat';
  if (!linked) { e.face = player.x >= e.x ? 1 : -1; sfx('bwind'); }
}
function gorath2Warning(e) {
  const a = e.g2?.act;
  return !!a && a.kind === 'move' && !a.linked && a.f <= G2_MOVES[a.id].warnTo;
}

// ---------------------------------------------------------------- 동작 실행
function g2Act(e, g) {
  const a = g.act;
  if (!a) { g2EndAct(e, g); return; }
  if (a.kind === 'move') g2RunMove(e, g, a);
  else if (a.kind === 'hookFly') { g.fi = g2Len(g.clip) - 1; if (!g.hook) g2EndAct(e, g); }   // 팔을 뻗은 자세 유지
  else if (a.kind === 'hookPull') g2HookPull(e, g, a);
  else if (a.kind === 'transform') g2Transform(e, g, a);
  else if (a.kind === 'ult') g2Ult(e, g, a);
}
function g2RunMove(e, g, a) {
  const m = G2_MOVES[a.id], p = player, f = e.face;
  a.t++;
  let acc = 0, i = 0;
  while (i < m.len.length && a.t > acc + m.len[i]) acc += m.len[i++];
  if (i >= m.len.length) {
    if (m.hook && g.hook) { a.kind = 'hookFly'; return; }
    g2EndAct(e, g); return;
  }
  const fn = i + 1, first = a.f !== fn || a.t === 1; a.f = fn; g.clip = m.clip; g.fi = i;
  if (fn <= m.warnTo && !a.linked) e.y += clamp(p.y - e.y, -1.3, 1.3);   // 예고 중 깊이 맞추기
  if (m.step && fn >= m.step.f[0] && fn <= m.step.f[1]) {
    const ticks = m.len.slice(m.step.f[0] - 1, m.step.f[1]).reduce((s, v) => s + v, 0);
    if (first && fn === m.step.f[0]) sfx(m.dust ? 'bcharge' : 'bswing');
    e.x += f * m.step.px / ticks;
    if (m.dust && a.t % 5 === 0) g2Dust(e.x - f * 30, e.y, 2);
    if (m.ghost && a.t % 3 === 0) ghosts.push({ x: e.x, y: e.y, z: 0, id: 'boss1', face: f, life: 240, age: 0, g2: [g.clip, g.fi] });
  }
  if (m.hook && fn === G2M[m.clip].release && !a.thrown) { a.thrown = true; g2ThrowHook(e, g); }
  (m.hits || []).forEach((hit, k) => {
    const box = G2A.hits[m.clip][k];
    if (fn < box.f[0] || fn > box.f[1]) return;
    if (!a.used.has('s' + k)) {                    // 휘두르는 순간
      a.used.add('s' + k);
      if (!m.step) sfx('bswing');
      if (hit.slam) { shake = Math.max(shake, hit.slam); sfx('slam'); g2Dust(e.x + f * box.reach * .8, e.y, 6); }
    }
    if (a.used.has(k)) return;
    if (a.linked && p.grab?.gorath2 && p.grab.owner === e) { a.used.add(k); g2LinkedHit(e, g, m, hit, k); return; }
    const dx = (p.x - e.x) * f;
    const inside = hit.radial ? dx > box.back - 14 && dx < box.reach + 14 : dx > -8 && dx < box.reach + (p.hw || 14);
    if (inside && Math.abs(p.y - e.y) < 26 && p.z < 70 &&
        hurtPlayer(Math.round(hit.dmg), hit.radial ? (Math.sign(p.x - e.x) || f) : f, !!hit.kd, e)) a.used.add(k);
  });
}
// 갈고리에 끌려온 플레이어에게 들어가는 연계 타격. 피해 합계 = 기존 갈고리 피해(hit.link 비율). 마지막 타에 풀려나며 넉다운
function g2LinkedHit(e, g, m, hit, k) {
  const p = player, dmg = Math.round(G2_BASE.hook * hit.link), last = k === m.hits.length - 1;
  if (last) { releaseGorath2Grab('hit'); p.inv = 0; hurtPlayer(dmg, e.face, true, e); p.inv = Math.max(p.inv, 30); return; }
  stat.damage += Math.min(p.hp, dmg); p.hp -= dmg; p.flash = 5; chain.n = 0;
  floatText(p.x, p.y - 110, dmg, '#ff5a6a'); sfx('hurt'); shake = Math.max(shake, 7); impact(p.x, p.y, 56, 1, e.face);
  if (p.hp <= 0) { releaseGorath2Grab('cancel'); p.hp = 0; p.lives--; stat.deaths++; p.st = 'dead'; p.t = 0; p.vz = 6; p.vx = e.face * 4; sfx('pdie'); }
}

// ---------------------------------------------------------------- 갈고리 (1·2페이즈 공통)
// 던지기 시트에서 손을 떠나는 칸에 발사 → 날아가는 동안 손에서 갈고리까지 사슬 → 명중: 끌어당겨 연계 / 빗나감: 되감기
function g2Hand(e, g) {
  const fr = G2A.clips[g.clip]?.frames[g.fi], h = fr?.hand || [58, 62];
  return [e.x + e.face * h[0], h[1]];
}
function g2ThrowHook(e, g) {
  const [hx, hh] = g2Hand(e, g);
  g.hook = { x: hx, y: e.y, h: hh, dir: e.face, st: 'out', x0: hx };
  sfx('g2hook');
}
function g2TickHook(e, g) {
  const k = g.hook, p = player;
  if (!k || k.ult) return;
  if (k.st === 'out') {
    const old = k.x; k.x += k.dir * G2.hookSpeed;
    if (!practice && p.inv <= 0 && !['dead', 'down', 'special', 'grabbed'].includes(p.st) && p.z < 32 &&
        p.x >= Math.min(old, k.x) - 18 && p.x <= Math.max(old, k.x) + 18 && Math.abs(k.y - p.y) < GORATH_GRAB.depth) { g2Catch(e, g); return; }
    if (Math.abs(k.x - k.x0) >= VW * G2.hookRange || k.x < camX - 10 || k.x > camX + VW + 10) {   // 빗나감: 끌어당기기 동작으로 되감는다
      k.st = 'back'; g.act = { kind: 'hookPull', t: 0, miss: true, id: g.act?.id || (g.phase === 2 ? 'hook2' : 'hook') };
    }
  } else if (k.st === 'back') {
    const [hx, hh] = g2Hand(e, g), d = hx - k.x;
    k.h += clamp(hh - k.h, -3, 3);
    if (Math.abs(d) <= G2.hookBack) g.hook = null; else k.x += Math.sign(d) * G2.hookBack;
  }
}
function g2Catch(e, g) {
  const p = player, k = g.hook;
  p.st = 'grabbed'; p.t = 0; p.grab = { owner: e, gorath2: true, presses: 0, hold: 0, pull: 0 };
  p.vx = p.vz = p.z = 0; p.skill = null; p.combo = p.comboT = p.buf = 0; p.walk = false; p.wave = false;
  clearInput(); k.st = 'held'; k.x = p.x; k.h = 58; g.grabbing = true;
  g.act = { kind: 'hookPull', t: 0, miss: false, id: g.act?.id || (g.phase === 2 ? 'hook2' : 'hook') };
  sfx('hit', 1); impact(p.x, p.y, 58, 1, k.dir);
}
function g2HookPull(e, g, a) {
  const m = G2_MOVES[a.id], n = g2Len(m.pull), k = g.hook;
  a.t++; g.clip = m.pull;
  g.fi = a.miss ? Math.min(n - 1, Math.floor((a.t - 1) / m.pullTpf)) : Math.floor((a.t - 1) / m.pullTpf) % n;
  if (a.miss) { if (!k && a.t > n * m.pullTpf) g2EndAct(e, g); return; }
  if (!g.grabbing || !k) { g2EndAct(e, g); return; }   // 탈출하거나 풀려났다
  const tx = clamp(e.x + e.face * GORATH_GRAB.offset, camX + 20, camX + VW - 20);
  k.x += clamp(tx - k.x, -GORATH_GRAB.pullSpeed, GORATH_GRAB.pullSpeed);
  if (Math.abs(tx - k.x) <= 1 || a.t > 80) { k.hidden = true; g2StartMove(e, g, m.link, true); }   // 고라스 앞까지 끌려왔다: 바로 연계
}
// 플레이어 쪽(updPlayer 의 grabbed): 연타 탈출은 기존 잡힘 규칙(GORATH_ESCAPE_KEYS · GORATH_GRAB.presses)
function updateGorath2Grab() {
  const p = player, gr = p.grab, e = gr?.owner, g = e?.g2;
  if (!gr || !e || !enemies.includes(e) || e.st !== 'pat' || !g?.grabbing) { releaseGorath2Grab('cancel'); return; }
  p.t++; p.walk = false; p.z = p.vz = p.vx = 0; dashReq = 0;
  for (const code of GORATH_ESCAPE_KEYS) if (hit(code)) gr.presses++;
  for (const code in pressed) delete pressed[code];
  if (gr.presses >= GORATH_GRAB.presses) { releaseGorath2Grab('escape'); return; }
  if (g.hook && !g.hook.hidden) p.x = clamp(g.hook.x, camX + 20, camX + VW - 20);   // 사슬 끝에 붙어 끌려온다
  p.y += clamp(e.y - p.y, -2, 2); p.face = -e.face;
  const a = g.act;                                  // 남은 시간 막대: 끌려오는 동안 절반, 연계 타격까지 나머지
  if (a?.kind === 'hookPull') gr.hold = Math.min(GORATH_GRAB.hold * .5, a.t * .6);
  else if (a?.kind === 'move') { const m = G2_MOVES[a.id], end = m.len.slice(0, G2A.hits[m.clip].at(-1).f[0] - 1).reduce((s, v) => s + v, 0); gr.hold = GORATH_GRAB.hold * (.5 + .5 * Math.min(1, a.t / end)); }
}
function releaseGorath2Grab(result) {
  const p = player, gr = p.grab;
  if (!gr?.gorath2) { if (p.st === 'grabbed' && !gr) { p.st = 'free'; p.t = 0; } return; }
  const e = gr.owner, g = e.g2;
  p.grab = null; p.st = 'free'; p.t = 0; p.vx = p.vz = 0; clearInput();
  if (g) { g.grabbing = false; g.hook = null; }
  if (result === 'hit') return;                    // 연계 타격: 부른 쪽이 피해를 준다
  p.inv = Math.max(p.inv, 30);
  if (result === 'escape' && g) {                   // 탈출: 그로기 +40, 고라스 경직(기존 규칙)
    g.act = null; e.pat = null; e.gr = Math.min(e.grMax, e.gr + 40); e.grT = 150; e.t = 0; e.hr = 0;
    e.st = e.gr >= e.grMax ? 'stun' : 'hurt'; g.st = e.st; e.atkCd = 45;
    impact(e.x, e.y, 65, 1, p.face); sfx(e.st === 'stun' ? 'groggy' : 'hit');
    floatText(p.x, p.y - 110, '탈출!', '#aeeaff');
  }
}

// ---------------------------------------------------------------- 2페이즈 전환 (1페이즈 체력 0 → 체력·그로기 전부 회복 후 변신)
// damageEnemy 에서 1페이즈 체력이 0 이 되면 부른다. 사망 처리·승리 처리를 부르지 않는다
function beginGorath2Transition(e) {
  const g = g2Data(e), down = e.st === 'down' && g.st === 'down';
  g2Cancel(e, g);
  e.hp = 0; e.invuln = true; e.flash = 6;
  hitStop = Math.max(hitStop, 12); shake = Math.max(shake, 8); g.barBlink = 30; sfx('hit', 2);   // "이겼나?"
  if (down) { g.pendingT = true; return; }          // 넉다운 중이었다: 끝까지 쓰러진 뒤 30틱 → 기상 → 변신
  g2StartTransform(e, g);
}
function g2StartTransform(e, g) {
  e.st = g.st = 'pat'; e.pat = 'transform'; e.t = 0; e.invuln = true; e.hp = 0; e.max = G2.hp[1];
  g.act = { kind: 'transform', t: 0, step: -1 };
  gorath2LoadLate();
}
function g2Transform(e, g, a) {
  const T = G2_TRANSFORM, s = Math.floor(a.t / T.tpf);
  a.t++; e.invuln = true; e.flash = 0;
  if (s >= T.seq.length) { g2StartPhase2(e, g); return; }
  g.clip = 'transform'; g.fi = T.seq[s] - 1;
  const rep = s >= T.repeatFrom && s < T.burst ? Math.floor((s - T.repeatFrom) / 2) : -1;
  if (rep >= 0) {                                  // 목 갑옷을 움켜쥔 칸 3회 반복: 반복마다 체력바가 1/3씩 차오른다
    g.jitter = (tick % 2 ? 1 : -1) * (1 + (rep > 0 ? 1 : 0));
    e.hp = Math.min(e.max, e.max * (a.t - T.repeatFrom * T.tpf) / ((T.burst - T.repeatFrom) * T.tpf));
  }
  if (s !== a.step) {
    a.step = s;
    if (rep >= 0 && (s - T.repeatFrom) % 2 === 0) { shake = Math.max(shake, T.repeatShake[rep]); sfx('g2creak'); }
    if (s === T.burst) {                           // 갑옷을 뜯어낸다: 그로기·피격 누적값 완전 회복
      shake = Math.max(shake, 14); G2S.white = 2; sfx('slam'); sfx('g2block');
      e.hp = e.max; g2ResetStagger(e);
      for (let i = 0; i < 22; i++) g2Bit(e.x + rand(-26, 26), e.y, rand(50, 110), rand(-5, 5), rand(1, 6), ['#8a5a4a', '#c8a890', '#5a3a30', '#e8d8c8'][i % 4], rand(26, 46), i % 3 ? 3 : 5, .38);
    }
    if (s === T.roar) { sfx('g2roar'); sfx('phase2'); G2S.redTo = 1; g2MarkPhase2(e); }
  }
}
function g2ResetStagger(e) { e.gr = 0; e.grT = 0; e.nextKd = e.max * .75; e.hr = 9999; e.flash = 0; }
function g2MarkPhase2(e) { e.p2shown = true; e.barLabel = '2페이즈'; e.barTint = 'rgba(210,24,30,.55)'; }
// 2페이즈 시작. 변신이 어떤 이유로 끊겨도 체력·그로기는 반드시 가득 찬 상태로 맞춘다
function g2StartPhase2(e, g) {
  g.phase = 2; g.act = null; g.hook = null; g.grabbing = false; g.pendingT = false; g.tail = 0; g.last = null; g.want = null;
  e.max = G2.hp[1]; e.hp = e.max; g2ResetStagger(e); g2MarkPhase2(e); G2S.redTo = 1;
  e.invuln = false; e.pat = null; e.st = g.st = 'chase'; e.t = 0; e.atkCd = 30;
  gorath2LoadLate();
}

// ---------------------------------------------------------------- 궁극기 "도살장의 비"
// 시전(p2_ult_cast 1~16) → 갈고리가 천장에 걸림 → 흔들기(p2_ult_shake 반복, 잡아당길 때마다 고기 낙하 예약) → 회수(시전 16→회수 끝 칸) → 숨 고르기
// 시작부터 회수가 끝날 때까지 무적(g.guard): 맞으면 피해 없이 막힘 불꽃과 소리만
// 최종 피해가 계산된 뒤 호출한다. 한 번의 큰 타격도 다음 미발동 기준을 넘지 못한다.
function gorath2UltThreshold(e, dmg) {
  if (!isGorath2(e)) return null;
  const g = g2Data(e);
  if (g.phase !== 2 || g.guard || dmg <= 0) return null;
  const index = G2.ult.findIndex((ratio, i) => !g.ult[i] && e.hp - dmg <= e.max * ratio);
  return index < 0 ? null : { index, hp: e.max * G2.ult[index] };
}
function gorath2TriggerThreshold(e, threshold) {
  const g = g2Data(e);
  g.ult[threshold.index] = true;
  g2Cancel(e, g);                                // 공격과 갈고리를 취소하고 잡힌 플레이어를 풀어준다
  e.gr = 0; e.grT = 0; e.invuln = false;         // 그로기와 기상 상태에서도 즉시 시전
  e.z = e.vz = e.vx = 0; g.breath = 0; g.tail = 0;
  g2StartUlt(e, g);
}
function g2StartUlt(e, g) {
  e.st = g.st = 'pat'; e.pat = 'ult'; e.t = 0; e.face = player.x >= e.x ? 1 : -1;
  g.act = { kind: 'ult', ph: 'cast', t: 0, pulls: 0 }; g.guard = true; g.want = null;
  G2S.dimTo = 1; G2S.title = 120; sfx('g2roar');
}
function g2Ult(e, g, a) {
  a.t++; e.flash = 0;
  const cast = 'p2_ult_cast', n = g2Len(cast);
  if (a.ph === 'cast') {
    g.clip = cast; g.fi = Math.min(n - 1, Math.floor((a.t - 1) / G2.castTpf));
    if (a.t > n * G2.castTpf) { a.ph = 'fly'; a.t = 0; g.hook = { ult: true, u: 0 }; sfx('bwave'); }
  } else if (a.ph === 'fly') {                     // 갈고리가 화면 위쪽 밖으로: 닿는 순간 천장에 걸린다
    g.clip = cast; g.fi = n - 1; g.hook.u = a.t / G2.hookFly;
    if (a.t >= G2.hookFly) { g.hook.u = 1; a.ph = 'shake'; a.t = 0; shake = Math.max(shake, 8); sfx('slam'); g2CeilingDust(10); }
  } else if (a.ph === 'shake') {
    const shakeN = g2Len('p2_ult_shake'), f = Math.floor((a.t - 1) / G2.shakeTpf) % shakeN;
    g.clip = 'p2_ult_shake'; g.fi = f;
    if ((a.t - 1) % G2.shakeTpf === 0 && G2M.p2_ult_shake.pull.includes(f + 1)) g2Pull(e, g, a);
    if (a.t >= shakeN * G2.shakeTpf * G2.shakeLoops) { a.ph = 'recover'; a.t = 0; g2DropMeat(g, 'meat_carcass', true); }   // 회수 시작: 마지막 큰 낙하
  } else {                                         // 회수: 천장의 갈고리를 되감고 시전을 거꾸로
    const end = G2M.p2_ult_cast.recoverEnd, hold = 6, rel = a.t - hold;
    g.clip = cast; g.fi = rel <= 0 ? n - 1 : Math.max(end - 1, n - 1 - Math.floor((rel - 1) / G2.castTpf));
    if (g.hook) { g.hook.u = 1 - a.t / (hold + G2.castTpf); if (g.hook.u <= 0) g.hook = null; }
    if (rel > (n - end + 1) * G2.castTpf) {        // 무적 해제 → 대기 → 숨 고르기
      g.guard = false; g.hook = null; G2S.dimTo = 0; g.breath = G2.breath;
      g.act = null; e.pat = null; e.st = g.st = 'chase'; e.t = 0; e.atkCd = 0;
    }
  }
}
function g2CeilingDust(n) {
  for (let i = 0; i < n; i++) g2Bit(camX + rand(20, VW - 20), rand(walkTop() + 10, GBOT), rand(230, 300), rand(-.3, .3), 0, Math.random() < .5 ? '#6a5a50' : '#9a8a78', rand(50, 80), 2, .12);
}
// 잡아당기는 칸마다 2건(묶음·뼈 무작위). 세 번째마다 1건을 큰 고기로 바꾸고 반드시 플레이어 발밑
function g2Pull(e, g, a) {
  a.pulls++; shake = Math.max(shake, 5); sfx('g2thud'); g2CeilingDust(7);
  const big = a.pulls % 3 === 0;
  for (let i = 0; i < 2; i++) {
    if (big && i === 0) g2DropMeat(g, 'meat_carcass', true);
    else g2DropMeat(g, Math.random() < .5 ? 'meat_bundle' : 'meat_bone', Math.random() < .5);
  }
}
// 고기 낙하 예약: 경고와 고기를 같은 순간 시작, 정확히 72틱 뒤 착지. aimed = 플레이어 발밑
function g2DropMeat(g, kind, aimed) {
  const live = g.meats.filter(m => m.t < G2.meatLand), p = player, wt = walkTop(), must = kind === 'meat_carcass';
  if (live.length >= G2.meatMax) return;
  const clear = (x, y) => !live.some(m => Math.hypot(m.x - x, m.y - y) < G2.meatGap);
  let x = clamp(p.x, camX + 40, camX + VW - 40), y = clamp(p.y, wt + 10, GBOT);
  if (!(aimed && (must || clear(x, y)))) {
    for (let n = 0; n < 10; n++) { x = rand(camX + 50, camX + VW - 50); y = rand(wt + 15, GBOT - 5); if (clear(x, y)) break; }
  }
  const land = G2M[kind].land, start = G2.meatLand - (land - 1) * 3;      // 시트 재생 시작 = 72틱 − 착지 프레임 전까지의 재생 틱
  g.meats.push({ kind, x, y, t: 0, start, land, n: g2Len(kind), spin: Math.random() < .5 ? 1 : -1 });
}
// 시트 프레임: 착지 프레임 전까지 3틱, 착지 프레임부터 4틱, 마지막 칸 90틱 유지 뒤 30틱 동안 사라진다
function g2MeatFrame(m) {
  const s = m.t - m.start, pre = (m.land - 1) * 3;
  if (s < 0) return { sky: true, u: m.t / m.start };
  if (s < pre) return { fi: Math.floor(s / 3), alpha: 1 };
  const lastAt = pre + (m.n - m.land) * 4, fi = Math.min(m.n - 1, m.land - 1 + Math.floor((s - pre) / 4));
  return { fi, alpha: clamp(1 - (s - lastAt - 90) / 30, 0, 1), dead: s > lastAt + 120 };
}
function g2TickMeats(e, g) {
  if (!g.meats.length) return;
  const p = player;
  for (const m of g.meats) {
    m.t++;
    if (m.t !== G2.meatLand) continue;              // 착지 판정: 착지 프레임 시작 틱에 1회
    const M = G2_MEAT[m.kind], dx = p.x - m.x, dy = p.y - m.y;
    shake = Math.max(shake, M.shake); sfx('g2thud'); g2Dust(m.x, m.y, M.shake);
    if ((dx / M.r) ** 2 + (dy / (M.r * .35)) ** 2 <= 1 && p.z <= 60) hurtPlayer(M.dmg, Math.sign(dx) || 1, true, { damageScale: 1, boss: true });
  }
  g.meats = g.meats.filter(m => !g2MeatFrame(m).dead);
}

// ---------------------------------------------------------------- 피격 가로채기 · 사망
// damageEnemy 맨 앞: 궁극기 중에는 피해 없이 금속성 "막힘" 불꽃과 소리만
function interceptGorath2Damage(e) {
  if (!isGorath2(e)) return false;
  const g = g2Data(e), p = player;
  if (!g.guard) return e.st === 'intro';
  if (tick - (g.blockT ?? -99) > 5) {
    g.blockT = tick; sfx('g2block');
    const dir = p.x <= e.x ? 1 : -1, x = e.x - dir * e.hw * .7;
    burst(x, e.y, 62, ['#ffffff', '#ffd9a0', '#a8a8b8']);
    for (let i = 0; i < 5; i++) g2Bit(x, e.y, 62, -dir * rand(1, 4), rand(1, 4), i % 2 ? '#ffe9b0' : '#ffffff', rand(8, 16), 2, .3);
    floatText(e.x, e.y - e.d.h - 14, '막힘', '#c8c8d8');
  }
  return true;
}
// damageEnemy 에서 2페이즈 체력이 0 이 되면: 슬로모션 30틱(속도 0.3), 하얀 섬광 2틱, 큰 타격음
function gorath2Death(e) {
  const g = g2Data(e);
  g2Cancel(e, g); g.meats = []; g.guard = false; g.st = 'dead'; g.dark = 0;   // 진행 중 동작·투사체·경고 모두 취소
  e.invuln = false; e.vx = e.vz = 0;
  slowT = 30 * MS / .3; G2S.white = 2; G2S.dimTo = 0; G2S.redTo = 0; shake = Math.max(shake, 12);
  hazards = hazards.filter(z => z.type === 'pwave'); sfx('bossdie'); sfx('slam');
}
function g2Dead(e, g) {
  const tpf = 5, n = g2Len('death'), land = G2M.death.land;
  g.clip = 'death'; g.fi = Math.min(n - 1, Math.floor((e.t - 1) / tpf)); e.flash = 0;
  if (e.t === (land - 1) * tpf + 1) { shake = Math.max(shake, 8); sfx('land'); g2Dust(e.x + e.face * 50, e.y, 10); }   // 쓰러지는 칸
  const after = e.t - n * tpf;
  g.dark = clamp(after / 60, 0, 1) * .3;            // 마지막 칸에서 몸 색을 60틱 동안 30% 어둡게
  if (after >= 60) {                               // 관중 함성 → 기존 승리 처리(보스가 사라지면 스테이지 클리어 판정)
    sfx('g2crowd'); gorath2Remains.push({ x: e.x, y: e.y, face: e.face }); e.remove = true; G2FX = [];
  }
}

// ---------------------------------------------------------------- 그리기
function g2FrameOf(clip, fi) { const c = G2A.clips[clip]; return c && c.frames[clamp(fi, 0, c.frames.length - 1)]; }
// 월드 좌표 (x, y = 발밑 화면 y). o.rot = 그림 가운데 기준 회전, o.src = 같은 크기의 다른 그림(실루엣), o.dx/dy = 밀기
function paintG2(clip, fi, x, y, face = 1, alpha = 1, o = {}) {
  const c = G2A.clips[clip], f = g2FrameOf(clip, fi), im = f && G2_IMG[f.p];
  if (!im?.naturalWidth) return false;
  const [sx, sy, w, h] = f.atlas, [ax, ay] = f.anchor, k = c.k;
  ctx.save(); ctx.translate(x - camX + (o.dx || 0), y + (o.dy || 0)); ctx.scale(face, 1); ctx.globalAlpha *= alpha;
  if (o.rot) { const cx = (w / 2 - ax) * k, cy = (h / 2 - ay) * k; ctx.translate(cx, cy); ctx.rotate(o.rot); ctx.translate(-cx, -cy); }
  smoothFor(k);
  if (o.src) ctx.drawImage(o.src, 0, 0, w, h, -ax * k, -ay * k, w * k, h * k);
  else drawLit(im, sx, sy, w, h, -ax * k, -ay * k, w * k, h * k);
  ctx.restore();
  return true;
}
// 오라용 붉은 실루엣(프레임마다 한 번 만들어 둔다)
const G2_SIL = new Map();
function g2Silhouette(clip, fi) {
  const key = clip + ':' + fi;
  if (G2_SIL.has(key)) return G2_SIL.get(key);
  const f = g2FrameOf(clip, fi), im = G2_IMG[f.p], [sx, sy, w, h] = f.atlas;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const q = c.getContext('2d'); q.drawImage(im, sx, sy, w, h, 0, 0, w, h);
  q.globalCompositeOperation = 'source-in'; q.fillStyle = '#b01018'; q.fillRect(0, 0, w, h);
  G2_SIL.set(key, c);
  if (G2_SIL.size > 40) { const first = G2_SIL.keys().next().value; G2_SIL.get(first).width = 0; G2_SIL.delete(first); }
  return c;
}
function drawGorath2(e) {
  if (!isGorath2(e)) return false;
  const g = g2Data(e), f = g2FrameOf(g.clip, g.fi);
  if (!f || !G2_IMG[f.p]?.naturalWidth) return true;   // 그림을 아직 불러오는 중
  const x = e.x + g.jitter, y = e.y - e.z;
  if (!['intro_chop'].includes(g.clip)) drawShadow(e.x - camX, e.y, 26, e.z);
  if (g.guard && !UX.options.lowFx) {              // 무적 오라: 어두운 붉은 외곽(가산 합성 깜빡임)
    const src = g2Silhouette(g.clip, g.fi), a = .3 + .22 * Math.sin(tick * .45);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const [dx, dy] of [[-3, 0], [3, 0], [0, -3], [0, 2]]) paintG2(g.clip, g.fi, x, y, e.face, a, { src, dx, dy });
    ctx.restore();
  }
  ctx.save();
  if (e.flash > 0 && UX.options.flash) flashGain = 1.8;
  if (g.dark > 0) ctx.filter = `brightness(${(1 - g.dark).toFixed(3)})`;
  paintG2(g.clip, g.fi, x, y, e.face);
  ctx.restore(); flashGain = 1;
  return true;
}
function drawGorath2Ghost(gh) { return !!gh.g2 && (paintG2(gh.g2[0], gh.g2[1], gh.x, gh.y - gh.z, gh.face, .32 * (1 - gh.age / gh.life)), true); }
function g2Boss() { return enemies.find(isGorath2); }
// 사슬: (x0,y0) → (x1,y1) 월드 좌표(화면 y). chain.png 를 방향에 맞게 돌려 이어 붙인다
function g2Chain(x0, y0, x1, y1) {
  const c = G2A.clips.chain, f = c.frames[0], im = G2_IMG[f.p];
  if (!im?.naturalWidth) return;
  const [sx, sy, w, h] = f.atlas, k = c.k, tw = w * k, th = h * k, len = Math.hypot(x1 - x0, y1 - y0);
  ctx.save(); ctx.translate(x0 - camX, y0); ctx.rotate(Math.atan2(y1 - y0, x1 - x0)); smoothFor(k);
  for (let at = 0; at < len; at += tw * .8) { const n = Math.min(tw, len - at); ctx.drawImage(im, sx, sy, n / k, h, at, -th / 2, n, th); }
  ctx.restore();
}
function g2HookSprite(x, y, ang) {
  const c = G2A.clips.hook, f = c.frames[0], im = G2_IMG[f.p];
  if (!im?.naturalWidth) return;
  const [sx, sy, w, h] = f.atlas, [ax, ay] = f.anchor, k = c.k;
  ctx.save(); ctx.translate(x - camX, y); ctx.rotate(ang); if (Math.cos(ang) < 0) ctx.scale(1, -1); smoothFor(k);
  ctx.drawImage(im, sx, sy, w, h, -ax * k, -ay * k, w * k, h * k); ctx.restore();
}
// 배경 바로 위(캐릭터·바닥 표식보다 뒤): 2페이즈 붉은 조명, 궁극기 어둠 30%
function drawGorath2Scenery() {
  if (G2S.red > .01) { ctx.fillStyle = `rgba(150,10,14,${(.2 * G2S.red).toFixed(3)})`; rect(-40, OY - 40, VW + 80, VH + 80); }
  if (G2S.dim > .01) { ctx.fillStyle = `rgba(0,0,0,${(.3 * G2S.dim).toFixed(3)})`; rect(-40, OY - 40, VW + 80, VH + 80); }
}
// 바닥 층(캐릭터 뒤): 쓰러진 몸, 고기 낙하 경고, 착지한 고기와 잔해
function drawGorath2Ground() {
  for (const r of gorath2Remains) { ctx.save(); ctx.filter = 'brightness(.7)'; paintG2('death', g2Len('death') - 1, r.x, r.y, r.face); ctx.restore(); }
  const e = g2Boss(), g = e?.g2;
  if (!g) return;
  for (const m of g.meats) {
    const M = G2_MEAT[m.kind], x = m.x - camX;
    if (m.t < G2.meatLand) {                       // 붉은 타원(가로 = 피해 반경 x2, 세로 = 가로 x0.3): 72틱 동안 커지고 진해지며 마지막 24틱은 깜빡인다
      const u = m.t / G2.meatLand, k = .35 + .65 * u, blink = m.t >= G2.meatLand - 24 && Math.floor(m.t / 3) % 2 ? .45 : 1;
      ctx.save();
      ctx.fillStyle = `rgba(255,30,30,${((.12 + .38 * u) * blink).toFixed(3)})`;
      ctx.beginPath(); ctx.ellipse(x, m.y, M.r * k, M.r * .3 * k, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = `rgba(255,90,70,${((.35 + .6 * u) * blink).toFixed(3)})`; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = `rgba(0,0,0,${(.25 + .35 * u).toFixed(3)})`;               // 고기 그림자: 가까워질수록 커진다
      ctx.beginPath(); ctx.ellipse(x, m.y, M.r * .55 * u, M.r * .16 * u, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      outlineText('!', x, m.y - M.r * .3 * k - 3, '#ff3d3d', 'bold 13px sans-serif');
    } else { const fr = g2MeatFrame(m); if (!fr.dead) paintG2(m.kind, fr.fi, m.x, m.y, 1, fr.alpha); }
  }
}
// 캐릭터 앞: 떨어지는 고기, 사슬·갈고리, 투구 눈빛, 입자
function drawGorath2Top() {
  const e = g2Boss(), g = e?.g2;
  if (g) {
    for (const m of g.meats) {
      if (m.t >= G2.meatLand) continue;
      const fr = g2MeatFrame(m);
      if (fr.sky) {                                // 하늘에서 내려오는 고기: 시트 1번 칸을 화면 위 밖에서 등가속으로, 살짝 회전
        const u = fr.u, drop = (m.y - OY + 30) * (1 - u * u);
        paintG2(m.kind, 0, m.x, m.y, 1, 1, { dy: -drop, rot: m.spin * 10 * RAD * (1 - u) * Math.cos(m.t * .2) });
      } else paintG2(m.kind, fr.fi, m.x, m.y, 1, fr.alpha);
    }
    const k = g.hook;
    if (k?.ult) {                                  // 궁극기: 시트의 사슬이 칸 밖으로 나가는 곳부터 같은 방향으로 화면 위쪽 끝까지
      const ch = g2FrameOf(g.clip, g.fi)?.chain;
      if (ch) {
        const x0 = e.x + e.face * ch[0], y0 = e.y - ch[1], a = ch[2] * RAD, ux = e.face * Math.cos(a), uy = -Math.sin(a);
        let len = uy < -.05 ? (y0 - (OY - 30)) / -uy : VW;
        len = Math.min(len, VW) * clamp(k.u, 0, 1);
        if (len > 2) { g2Chain(x0, y0, x0 + ux * len, y0 + uy * len); if (k.u < 1) g2HookSprite(x0 + ux * len, y0 + uy * len, Math.atan2(uy, ux)); }
      }
    } else if (k && !k.hidden) {
      const [hx, hh] = g2Hand(e, g), y1 = k.y - k.h;
      g2Chain(hx, e.y - hh, k.x, y1); g2HookSprite(k.x, y1, k.dir > 0 ? 0 : Math.PI);
    }
    const glow = g.clip === 'intro_smash' && g.fi === 1 ? g2EyeGlow() : 0;
    if (glow > 0 && G2M.introEyes) {               // 응시: 투구 눈 위치에 붉은 빛(작은 원형 가산 합성)
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (const [dx, h] of G2M.introEyes) {
        const x = e.x + e.face * dx - camX, y = e.y - h, gr = ctx.createRadialGradient(x, y, 0, x, y, 6);
        gr.addColorStop(0, `rgba(255,70,50,${glow.toFixed(3)})`); gr.addColorStop(.4, `rgba(255,20,20,${(glow * .6).toFixed(3)})`); gr.addColorStop(1, 'rgba(255,0,0,0)');
        ctx.fillStyle = gr; rect(x - 6, y - 6, 12, 12);
      }
      ctx.restore();
    }
  }
  for (const q of G2FX) { ctx.globalAlpha = Math.min(1, (q.life - q.t) / 6); ctx.fillStyle = q.col; rect(q.x - camX - q.size / 2, q.y - q.h - q.size / 2, q.size, q.size); }
  ctx.globalAlpha = 1;
}
// 화면 좌표: 인트로의 위아래 검은 띠, 이름 카드, 기술 이름, 하얀 섬광
function drawGorath2IntroBars() {
  if (!isGorath2(introBoss)) return false;
  const n = introT / MS, T = G2_INTRO.total, bh = Math.round(64 * ease(Math.min(1, n / 20)) * clamp((T - n) / 12, 0, 1));
  ctx.fillStyle = '#05030a'; rect(0, 0, W, bh); rect(0, H - bh, W, bh);
  return true;
}
function drawGorath2Overlay() {
  const e = g2Boss(), g = e?.g2;
  if (g && g.cardT > 0 && g.cardT < 130) {         // 이름 카드: 포효와 함께 들어와 전투 초반까지
    const k = ease(Math.min(1, g.cardT / 10)), fade = clamp((130 - g.cardT) / 16, 0, 1), off = Math.round((1 - k) * 240), y = 190;   // 체력바(아래)와 겹치지 않게 위쪽에
    ctx.save(); ctx.globalAlpha = fade;
    ctx.fillStyle = 'rgba(5,3,10,.55)'; rect(0, y - 46, W, 92);
    pxText(`STAGE ${stageIdx + 1}`, W / 2 - off, y - 22, '#ffffff', 11, 'center');
    krText(e.d.name, W / 2 + off, y + 14, '#ffe27a', 34, 'center', '#7a1a24');
    pxText(e.d.en, W / 2 + off, y + 38, '#f3d26a', 10, 'center');
    const lw = Math.round(360 * k); ctx.fillStyle = '#dcb444'; rect(W / 2 - lw / 2, y + 46, lw, 2);
    ctx.restore();
  }
  if (G2S.title > 0) {
    const a = clamp(Math.min(G2S.title, 120 - G2S.title) / 14, 0, 1);
    ctx.save(); ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(20,2,4,.6)'; rect(0, 112, W, 64);
    krText('도살장의 비', W / 2, 154, '#ff6a5a', 34, 'center', '#3a0508');
    pxText('SLAUGHTERHOUSE RAIN', W / 2, 170, '#e8a090', 8, 'center');
    ctx.restore();
  }
  if (G2S.white > 0 && UX.options.flash) { ctx.fillStyle = 'rgba(255,255,255,.85)'; rect(0, 0, W, H); }
}
