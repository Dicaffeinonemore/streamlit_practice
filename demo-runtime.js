'use strict';
// =====================================================================
//  조작 안내 시범 플레이: 실제 게임 엔진으로 허수아비 앞에서 동작을 자동 입력해 보여 준다.
//  조작 안내 화면(scene 'tutorial')에서만 돈다. 시작할 때 게임 상태를 보관하고 끝낼 때 되돌리므로
//  일시정지 중에 열어도 진행 중인 판은 그대로다. 화면은 본 캔버스에 그린 뒤 #demoView 로 복사한다.
//  대본: ['tap', 동작, 시작ms, 누르는ms=90] / ['hold', 동작, 시작ms, 누르는ms]. 동작 = 게임 내부 키 이름(KeyJ=공격 …)
// =====================================================================
const DEMO = { on: false, i: 0, t: 0, after: 0, paused: false, saved: null, player: null, char: 'barel', steps: [], events: [], end: 0, lit: new Set() };

const DEMO_STEPS = {
  barel: [
    { title: '이동', keys: ['KeyA', 'KeyD', 'KeyW', 'KeyS'], dummy: 430,
      desc: '좌우로 걷고 위/아래로 줄(깊이)을 바꿉니다. 적과 같은 줄에 서야 공격이 맞습니다. 화면에 GO → 가 뜨면 오른쪽으로 전진하세요.',
      script: [['hold', 'KeyD', 0, 700], ['hold', 'KeyW', 820, 380], ['hold', 'KeyS', 1300, 380], ['hold', 'KeyA', 1800, 500]] },
    { title: '점프', keys: ['Space'], dummy: 430,
      desc: '점프로 바닥 충격파와 낮은 공격을 넘습니다. 이동 키를 누른 채 점프하면 앞으로 뛰어오릅니다.',
      script: [['tap', 'Space', 200], ['hold', 'KeyD', 1350, 750], ['tap', 'Space', 1420]] },
    { title: '공격 3연타', keys: ['KeyJ'], dummy: 78,
      desc: '연타하면 3연 콤보! 3타 참격은 검기를 날립니다. 연속으로 맞히면 HIT가 쌓이고 보스에게 주는 피해가 커집니다.',
      script: [['tap', 'KeyJ', 200], ['tap', 'KeyJ', 430], ['tap', 'KeyJ', 660]] },
    { title: '대시 · 대시 찌르기', keys: ['ShiftLeft', 'KeyJ'], dummy: 360,
      desc: '잠깐 무적이 되는 빠른 이동입니다. 같은 방향 이동 키를 빠르게 두 번 눌러도 됩니다. 대시 중 공격하면 대시 찌르기.',
      script: [['tap', 'ShiftLeft', 200], ['tap', 'ShiftLeft', 1250], ['tap', 'KeyJ', 1360]] },
    { title: '공중 공격', keys: ['Space', 'KeyJ'], dummy: 85,
      desc: '점프 중에 공격하면 공중 베기가 나갑니다.',
      script: [['tap', 'Space', 200], ['tap', 'KeyJ', 470]] },
    { title: '견제 찌르기', keys: ['KeyU'], dummy: 110, desc: '앞으로 빠르게 찌르는 견제 기술. 기술은 각자 재사용 시간이 있습니다.', script: [['tap', 'KeyU', 250]] },
    { title: '내려찍기', keys: ['KeyH'], dummy: 90, desc: '검을 땅에 내려찍어 주변 적을 넘어뜨립니다.', script: [['tap', 'KeyH', 250]] },
    { title: '회전 베기', keys: ['KeyO'], dummy: 80, desc: '몸을 돌려 앞뒤의 적을 한꺼번에 벱니다. 둘러싸였을 때 유용합니다.', script: [['tap', 'KeyO', 250]] },
    { title: '점프 강하', keys: ['KeyP'], dummy: 170, desc: '높이 뛰어올라 앞쪽 적에게 내리꽂힙니다.', script: [['tap', 'KeyP', 250]] },
    { title: '붉은 파동', keys: ['KeyL'], dummy: 300, desc: '멀리 날아가며 적을 꿰뚫는 붉은 검기 (재사용 6.5초).', script: [['tap', 'KeyL', 250]] },
    { title: '필살기 흑월참', keys: ['KeyK'], dummy: 160, setup: p => { p.sp = SP_MAX; },
      desc: 'SP 게이지가 가득 차면 사용! 돌진 3연 베기 + 초승달 마무리. 사용하는 동안 무적입니다.', script: [['tap', 'KeyK', 350]] },
    { title: '마법 뇌격', keys: ['KeyI'], dummy: 260, setup: p => { p.mg = 1; },
      desc: '두루마리 1개로 화면 안의 모든 적에게 번개! 두루마리는 최대 3개까지 모입니다.', script: [['tap', 'KeyI', 350]] },
  ],
  viesa: [
    { title: '이동', keys: ['KeyA', 'KeyD', 'KeyW', 'KeyS'], dummy: 430,
      desc: '좌우로 걷고 위/아래로 사격 줄(깊이)을 바꿉니다. 화살은 같은 줄의 적에게 맞습니다.',
      script: [['hold', 'KeyD', 0, 700], ['hold', 'KeyW', 820, 380], ['hold', 'KeyS', 1300, 380], ['hold', 'KeyA', 1800, 500]] },
    { title: '점프', keys: ['Space'], dummy: 430,
      desc: '점프로 바닥 충격파와 낮은 공격을 넘습니다. 이동 키를 누른 채 점프하면 앞으로 뛰어오릅니다.',
      script: [['tap', 'Space', 200], ['hold', 'KeyD', 1350, 750], ['tap', 'Space', 1420]] },
    { title: '화살', keys: ['KeyJ'], dummy: 320,
      desc: '화살 한 발에 8 피해. 사격 도중 다시 누르면 연속 사격합니다. 화살은 무제한입니다.',
      script: [['tap', 'KeyJ', 200], ['tap', 'KeyJ', 560], ['tap', 'KeyJ', 920]] },
    { title: '대시', keys: ['ShiftLeft'], dummy: 400,
      desc: '이동하는 동안 무적인 빠른 이동입니다. 같은 방향 이동 키를 빠르게 두 번 눌러도 됩니다.',
      script: [['tap', 'ShiftLeft', 200], ['tap', 'ShiftLeft', 1200]] },
    { title: '공중 사격', keys: ['Space', 'KeyJ'], dummy: 300,
      desc: '공중에서는 아래 30°로 쏘며 천천히 내려옵니다. 땅에 닿으면 착지합니다.',
      script: [['tap', 'Space', 200], ['tap', 'KeyJ', 470], ['tap', 'KeyJ', 820]] },
    { title: '근접 콤보', keys: ['KeyH'], dummy: 80, desc: '가까이 붙은 적을 활로 세 번 후려칩니다.', script: [['tap', 'KeyH', 250], ['tap', 'KeyH', 520], ['tap', 'KeyH', 790]] },
    { title: '화살 연사', keys: ['KeyU'], dummy: 320, desc: '6발 연사 (발당 10 피해). 위/아래 키로 사격 줄을 조절할 수 있습니다.', script: [['tap', 'KeyU', 250]] },
    { title: '돌진 → 지상 백플립', keys: ['KeyO'], dummy: 200, desc: '돌진하며 적을 꿰뚫고 땅에서 백플립. 돌진 중 무적이며 적마다 20 추가 피해.', script: [['tap', 'KeyO', 250]] },
    { title: '돌진 → 공중 백플립', keys: ['KeyP', 'KeyJ'], dummy: 200, desc: '높은 백플립 후 최대 40틱 체공. 체공 중 공격 키로 사격을 이어갑니다. 공중에서도 착지 전 한 번 쓸 수 있습니다.',
      script: [['tap', 'KeyP', 250], ['tap', 'KeyJ', 1100], ['tap', 'KeyJ', 1400]] },
    { title: '장거리 저격', keys: ['KeyL'], dummy: 420, desc: '누르고 있으면 조준, 놓으면 관통 사격. 2초 동안 누르고 있으면 자동 발사합니다.', script: [['hold', 'KeyL', 250, 900]] },
    { title: '필살기 흑월 난사', keys: ['KeyK'], dummy: 260, setup: p => { p.sp = SP_MAX; },
      desc: 'SP 100에서 사용. 공중 도약 → 마법진 → 환영 화살 200발 → 거대 화살 폭발. 시전 전체 무적.', script: [['tap', 'KeyK', 350]] },
    { title: '마법 뇌격', keys: ['KeyI'], dummy: 260, setup: p => { p.mg = 1; },
      desc: '두루마리 1개로 화면 안의 모든 적에게 번개! 두루마리는 최대 3개까지 모입니다.', script: [['tap', 'KeyI', 350]] },
  ],
};
const DEMO_MAX_MS = 10000;     // 한 동작이 끝나지 않아도 이 시간이 지나면 다음으로

function demoSave() {
  return { stageIdx, stage, camX, camLock, lockAt, waveIdx, player, enemies, items, barrels, parts, texts, hazards, impacts, bursts, ghosts, bolts, target,
    tick, hitStop, shake, flashT, flashCol, bannerT, clearT, goT, slowT, introBoss, introT, introLand, arena, practice, practiceOrigin, lastTap, dashReq,
    chain: { ...chain }, stat: { ...stat }, viesaEffects, viesaUltObjects };
}
function demoRestore(s) {
  ({ stageIdx, stage, camX, camLock, lockAt, waveIdx, player, enemies, items, barrels, parts, texts, hazards, impacts, bursts, ghosts, bolts, target,
    tick, hitStop, shake, flashT, flashCol, bannerT, clearT, goT, slowT, introBoss, introT, introLand, arena, practice, practiceOrigin, lastTap, dashReq,
    viesaEffects, viesaUltObjects } = s);
  Object.assign(chain, s.chain); Object.assign(stat, s.stat);
}
function demoKeys() { for (const k in keys) delete keys[k]; for (const k in pressed) delete pressed[k]; DEMO.lit.clear(); }

function demoStart(from) {
  if (DEMO.on) demoStop();
  DEMO.saved = demoSave(); DEMO.on = true; DEMO.paused = false;
  DEMO.char = from === 'pause' && player ? player.characterId : selectedCharacterId;
  DEMO.steps = DEMO_STEPS[DEMO.char] || DEMO_STEPS.barel;
  if (!stage) {                                  // 타이틀에서 왔다: 1스테이지 연습장 풍경을 쓴다
    stageIdx = 0; stage = STAGES[0]; camX = 0; practice = true; player = newPlayer(0, DEMO.char); startStage1Sections();
  }
  practice = false; camLock = true; lockAt = camX;
  globalThis.BarelJump?.reset(); globalThis.BarelDashFx?.clear();
  demoList(); demoStep(0); demoPlayButton();
}
// 다른 화면으로 나갈 때 부른다. 바깥에서 이미 새 판을 만들었으면(player 교체) 되돌리지 않는다.
function demoStop() {
  if (!DEMO.on) return;
  DEMO.on = false; demoKeys();
  if (player === DEMO.player) demoRestore(DEMO.saved);
  DEMO.saved = null; DEMO.player = null;
  globalThis.BarelJump?.reset(); globalThis.BarelDashFx?.clear();
}

function demoStep(i) {
  const n = DEMO.steps.length; DEMO.i = (i % n + n) % n;
  const step = DEMO.steps[DEMO.i];
  DEMO.t = 0; DEMO.after = 0; demoKeys();
  DEMO.events = step.script.map(([kind, code, at, ms]) => ({ code, at, up: at + (ms || (kind === 'tap' ? 90 : 300)), down: false, released: false }));
  DEMO.end = Math.max(...DEMO.events.map(e => e.up));
  // 매번 새 캐릭터와 허수아비: 재사용 시간·게이지·위치가 대본과 맞게 시작한다
  const y = clamp(420, GTOP + 30, GBOT - 30), x = camX + VW * .22;
  const p = newPlayer(0, DEMO.char); p.x = x; p.y = y; p.face = 1; p.inv = 0;
  step.setup?.(p);
  player = DEMO.player = p;
  const dummy = mkEnemy('grunt', x + step.dummy, y); dummy.training = true; dummy.hp = dummy.max = 99999; dummy.face = -1;
  enemies = [dummy];
  items = []; barrels = []; parts = []; texts = []; hazards = []; impacts = []; bursts = []; ghosts = []; bolts = []; target = null; arena = null;
  hitStop = 0; shake = 0; flashT = 0; slowT = 0; chain.n = 0; chain.t = 0; lastTap = { dir: 0, t: -99 }; dashReq = 0;
  viesaEffects = []; viesaUltObjects = [];
  globalThis.BarelJump?.reset(); globalThis.BarelDashFx?.clear();
  demoCaption();
}

function demoPress(code, on) {
  if (on) { keys[code] = true; pressed[code] = BUF_MS; DEMO.lit.add(code); }
  else { keys[code] = false; DEMO.lit.delete(code); }
  demoLights();
}
// update() 대신 한 틱. 게임 규칙 함수들이 scene === 'play' 를 확인하므로 그동안만 바꿔 둔다.
function demoUpdate() {
  if (!DEMO.on || DEMO.paused) return false;
  tick++; DEMO.t += MS;
  for (const e of DEMO.events) {
    if (!e.down && DEMO.t >= e.at) { e.down = true; demoPress(e.code, true); }
    if (e.down && !e.released && DEMO.t >= e.up) { e.released = true; demoPress(e.code, false); }
  }
  if (flashT > 0) flashT -= MS;
  if (shake > 0) shake *= .85;
  if (chain.t > 0) { chain.t -= MS; if (chain.t <= 0) chain.n = 0; }
  if (hitStop > 0) hitStop--;
  else {
    scene = 'play';
    try {
      updPlayer(); globalThis.BarelJump?.observe(player);
      enemies.forEach(updEnemy); updHazards(); updFx();
      parts = parts.filter(q => --q.life > 0); texts = texts.filter(t => --t.life > 0);
    } finally { scene = 'tutorial'; }
    const d = enemies[0]; if (d) d.hp = d.max;   // 허수아비는 쓰러지지 않는다
  }
  const p = player, idle = p.st === 'free' && p.z <= 0;
  if (DEMO.t > DEMO.end + 250 && idle) DEMO.after += MS;
  if (DEMO.after >= 700 || DEMO.t >= DEMO_MAX_MS) demoStep(DEMO.i + 1);
  const bar = document.getElementById('demoBar');
  if (bar) bar.style.width = Math.min(100, DEMO.t / Math.max(DEMO.end + 1300, DEMO.t + DEMO.after + 1) * 100) + '%';
  return true;
}
function demoPresent() {
  const view = document.getElementById('demoView'); if (!view || !DEMO.on) return;
  if (view.width !== cv.width || view.height !== cv.height) { view.width = cv.width; view.height = cv.height; }   // 본 화면 해상도 그대로(확대해도 선명)
  view.getContext('2d').drawImage(cv, 0, 0);
}

// ---------------------------------------------------------------- 화면
function demoCapsHtml(codes) {
  return codes.map(a => `<span class="cap demo-cap" data-action="${a}" data-k="${a}">${UX.keyName(UX.options.bindings[a])}</span>`).join('');
}
function demoCaption() {
  const step = DEMO.steps[DEMO.i]; if (!step) return;
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('demoStep', `${DEMO.i + 1} / ${DEMO.steps.length}`); set('demoTitle', step.title); set('demoDesc', step.desc);
  set('demoPreset', UX.presets[UX.options.keyPreset].name);
  const keysBox = document.getElementById('demoKeys');
  if (keysBox) keysBox.innerHTML = step.keys.map((a, i) => (i && step.keys.length === 2 && step.keys[0] !== step.keys[1] ? '<span class="or">+</span>' : '') + demoCapsHtml([a])).join('');
  document.querySelectorAll('#demoList [data-step]').forEach(b => {
    const on = Number(b.dataset.step) === DEMO.i; b.classList.toggle('on', on); b.setAttribute('aria-selected', String(on));
    if (on) b.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  });
  demoLights();
}
function demoLights() {
  const step = DEMO.steps[DEMO.i]; if (!step) return;
  document.querySelectorAll('#demoKeys .demo-cap').forEach(c => c.classList.toggle('on', DEMO.lit.has(c.dataset.action)));
  UX.drawKeyboard(document.getElementById('demoKeyboard'), { focus: step.keys, pressed: [...DEMO.lit] });
}
function demoList() {
  const box = document.getElementById('demoList'); if (!box) return;
  box.replaceChildren();
  DEMO.steps.forEach((step, i) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'demo-chip'; b.dataset.step = i; b.setAttribute('role', 'tab');
    b.innerHTML = `<b></b>${demoCapsHtml(step.keys)}`; b.firstChild.textContent = step.title;
    b.onclick = () => { demoStep(i); if (DEMO.paused) { DEMO.paused = false; demoPlayButton(); } };
    box.append(b);
  });
}
function demoPlayButton() {
  const b = document.getElementById('btnDemoPlay'); if (!b) return;
  b.textContent = DEMO.paused ? '▶ 재생' : '❚❚ 멈춤'; b.setAttribute('aria-label', DEMO.paused ? '시범 플레이 재생' : '시범 플레이 멈춤');
}
function demoMount() {
  const on = (id, f) => { const el = document.getElementById(id); if (el) el.onclick = f; };
  on('btnDemoPrev', () => demoStep(DEMO.i - 1));
  on('btnDemoNext', () => demoStep(DEMO.i + 1));
  on('btnDemoPlay', () => { DEMO.paused = !DEMO.paused; demoPlayButton(); });
}
