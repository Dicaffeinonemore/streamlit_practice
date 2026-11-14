'use strict';
// Preferences, validated local saves and input devices. No combat state is serialized.
const UX = (() => {
  const defaults = { KeyA: 'KeyA', KeyD: 'KeyD', KeyW: 'KeyW', KeyS: 'KeyS', Space: 'Space',
    KeyJ: 'KeyJ', ShiftLeft: 'ShiftLeft', KeyK: 'KeyK', KeyI: 'KeyI', KeyU: 'KeyU', KeyH: 'KeyH', KeyO: 'KeyO', KeyP: 'KeyP', KeyL: 'KeyL' };
  const labels = { KeyA: '왼쪽', KeyD: '오른쪽', KeyW: '위', KeyS: '아래', Space: '점프', KeyJ: '공격',
    ShiftLeft: '대시', KeyK: '필살기', KeyI: '뇌격', KeyU: '견제 찌르기', KeyH: '내려찍기', KeyO: '회전 베기', KeyP: '점프 강하', KeyL: '붉은 파동' };
  // 키 배치 프리셋. 값 = 동작 → 실제 키. 동작 이름(KeyJ=공격 등)은 게임 내부 식별자일 뿐 실제 키와 무관하다.
  const PRESETS = {
    arcade: { KeyA: 'ArrowLeft', KeyD: 'ArrowRight', KeyW: 'ArrowUp', KeyS: 'ArrowDown', Space: 'KeyX', KeyJ: 'KeyZ',
      ShiftLeft: 'ShiftLeft', KeyK: 'KeyC', KeyI: 'KeyA', KeyU: 'KeyS', KeyH: 'KeyD', KeyO: 'KeyQ', KeyP: 'KeyW', KeyL: 'KeyE' },
    wasd: { KeyA: 'KeyA', KeyD: 'KeyD', KeyW: 'KeyW', KeyS: 'KeyS', Space: 'KeyK', KeyJ: 'KeyJ',
      ShiftLeft: 'ShiftLeft', KeyK: 'Space', KeyI: 'KeyL', KeyU: 'KeyU', KeyH: 'KeyI', KeyO: 'KeyO', KeyP: 'KeyP', KeyL: 'KeyH' },
  };
  const PRESET_INFO = {
    arcade: { name: '1 · 오락실 아케이드', short: '방향키 + Z X C · A S D', desc: '오른손 방향키로 이동, 왼손으로 Z 공격 · X 점프 · C 필살기. A S D / Q W E에 뇌격과 전투 기술, Shift 대시. 고전 벨트스크롤에 익숙하다면 추천.' },
    wasd: { name: '2 · PC 액션 (WASD)', short: 'WASD + J K L', desc: '왼손 WASD로 이동, 오른손 J 공격 · K 점프 · L 뇌격. U I O P H에 전투 기술, Space 필살기 · Shift 대시. 방향키·Z/X/V·Ctrl도 보조로 쓸 수 있습니다.' },
    custom: { name: '3 · 사용자 설정', short: '원하는 대로', desc: '모든 동작의 키를 직접 정합니다. 동작을 고른 뒤 새 키를 누르거나 키보드 그림의 키를 클릭하세요. 비어 있는 방향키·Z/X/V·Ctrl은 보조 조작으로 동작합니다.' },
  };
  const DEFAULT_PRESET = 'arcade';
  // 보조 조작: WASD·사용자 설정에서 다른 동작에 쓰이지 않는 키만 해당 동작으로 바뀐다.
  const ALIAS = { ArrowLeft: 'KeyA', ArrowRight: 'KeyD', ArrowUp: 'KeyW', ArrowDown: 'KeyS', ControlLeft: 'Space', ControlRight: 'Space', KeyZ: 'KeyJ', KeyX: 'KeyK', KeyV: 'KeyI' };
  const reserved = new Set(['KeyM']);
  const validKey = k => typeof k === 'string' && (/^Key[A-Z]$/.test(k) || /^Digit[0-9]$/.test(k) || /^Arrow(Left|Right|Up|Down)$/.test(k) || ['Space', 'ShiftLeft', 'ShiftRight'].includes(k)) && !reserved.has(k);
  const validMap = m => !!m && typeof m === 'object' && Object.keys(defaults).every(k => validKey(m[k])) && new Set(Object.keys(defaults).map(k => m[k])).size === Object.keys(defaults).length;
  const number = (v, a, b) => typeof v === 'number' && Number.isFinite(v) && v >= a && v <= b;
  let available = true, capture = null;
  const storagePrefix = new URLSearchParams(location.search).get('mobile_lab') === '1' ? 'bmk_lab_' : 'bmk_';
  function read(key) { try { return JSON.parse(localStorage.getItem(storagePrefix + key)); } catch { return null; } }
  function write(key, value) {
    try { if (value === null) localStorage.removeItem(storagePrefix + key); else localStorage.setItem(storagePrefix + key, JSON.stringify(value)); }
    catch { available = false; }
    refreshTitle();
  }
  // 모바일 키 배치: 투명도·전체 크기, 키별 위치(--u 단위 오프셋)·크기·숨김. 화면 회전에도 비율이 유지된다.
  const TOUCH_IDS = ['stick', 'KeyJ', 'Space', 'ShiftLeft', 'KeyI', 'KeyK', 'KeyU', 'KeyH', 'KeyO', 'KeyP', 'KeyL'];
  const layoutDefaults = () => typeof MOBILE_DISPLAY !== 'undefined' && MOBILE_DISPLAY.matches()
    ? JSON.parse(JSON.stringify(MOBILE_DISPLAY.profile.layout))
    : { alpha: .55, scale: 1, items: {} };
  function validLayout(l) {
    const out = layoutDefaults();
    if (!l || typeof l !== 'object') return out;
    if (number(l.alpha, .1, 1)) out.alpha = l.alpha;
    if (number(l.scale, .6, 1.6)) out.scale = l.scale;
    for (const id of TOUCH_IDS) {
      const it = l.items && l.items[id];
      if (it && number(it.dx, -40, 40) && number(it.dy, -40, 40) && number(it.k, .5, 2)) out.items[id] = { dx: it.dx, dy: it.dy, k: it.k, hide: it.hide === true };
    }
    return out;
  }
  const saved = read('settings') || {};
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const options = { music: number(saved.music, 0, 1) ? saved.music : .7, sfx: number(saved.sfx, 0, 1) ? saved.sfx : .8,
    quality: saved.quality === 'high' ? 'high' : 'balanced', perf: saved.perf === true,
    lowFx: typeof saved.lowFx === 'boolean' ? saved.lowFx : reduced,
    shake: typeof saved.shake === 'boolean' ? saved.shake : !reduced,
    flash: typeof saved.flash === 'boolean' ? saved.flash : !reduced,
    dangerZones: typeof saved.dangerZones === 'boolean' ? saved.dangerZones : true,   // 1.67: 적 공격 범위 바닥 표시
    touch: typeof saved.touch === 'boolean' ? saved.touch : matchMedia('(pointer: coarse)').matches,
    touchLayout: validLayout(saved.touchLayout), keyPreset: DEFAULT_PRESET, customBindings: null, bindings: { ...PRESETS[DEFAULT_PRESET] } };
  // 이전 저장(프리셋 없이 키 목록만 있음)은 그 키 그대로 '사용자 설정'으로 옮긴다.
  function legacyBindings(b) {
    if (!b || typeof b !== 'object') return null;
    const actions = Object.keys(defaults).filter(k => k !== 'KeyL');
    if (!actions.every(k => validKey(b[k])) || new Set(actions.map(k => b[k])).size !== actions.length) return null;
    const bindings = Object.fromEntries(actions.map(k => [k, b[k]]));
    const used = new Set(Object.values(bindings));
    // Older saves may already use L for another action. Preserve those bindings.
    bindings.KeyL = [b.KeyL, 'KeyL', 'KeyB', 'KeyC', 'KeyN',
      ...Array.from({length: 10}, (_, i) => 'Digit' + i)].find(k => validKey(k) && !used.has(k));
    return bindings;
  }
  if (validMap(saved.customBindings)) options.customBindings = { ...saved.customBindings };
  if (Object.hasOwn(PRESETS, saved.keyPreset)) options.keyPreset = saved.keyPreset;
  else if (saved.keyPreset === 'custom' && options.customBindings) options.keyPreset = 'custom';
  else if (saved.keyPreset === undefined && legacyBindings(saved.bindings)) {
    options.keyPreset = 'custom'; options.customBindings = legacyBindings(saved.bindings);
  }
  options.bindings = { ...(options.keyPreset === 'custom' ? options.customBindings : PRESETS[options.keyPreset]) };
  const ARROW_NAMES = { ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓' };
  function keyName(k) { return ARROW_NAMES[k] || k.replace(/^Key|^Digit/, '').replace('Space', 'SPACE').replace('ShiftLeft', 'L SHIFT').replace('ShiftRight', 'R SHIFT'); }
  const aliasesOn = () => options.keyPreset !== 'arcade';
  // 보조 조작 키 → 동작. 다른 동작에 이미 쓰인 키는 제외한다.
  function aliasFor(code) {
    if (!aliasesOn() || !Object.hasOwn(ALIAS, code)) return '';
    return Object.values(options.bindings).includes(code) ? '' : ALIAS[code];
  }
  function mapKey(code) {
    const action = Object.keys(defaults).find(k => options.bindings[k] === code);
    if (action) return action;
    if (Object.hasOwn(ALIAS, code)) return aliasFor(code);
    return Object.hasOwn(defaults, code) ? '' : code;
  }
  function setPreset(id) {
    if (id === 'custom') {
      if (!options.customBindings) options.customBindings = { ...options.bindings };   // 지금 쓰던 배치에서 시작
    } else if (!Object.hasOwn(PRESETS, id)) return;
    capture = null; options.keyPreset = id;
    options.bindings = { ...(id === 'custom' ? options.customBindings : PRESETS[id]) };
    write('settings', options); bindingButtons();
  }
  // ---------------------------------------------------------------- 키보드 그림
  // [코드, 표시, x, y, 너비] (단위: 키 1칸). 게임에 쓸 수 있는 키 + 시스템 키만 그린다.
  const KB_W = 15.75, KB_H = 5;
  const KB_KEYS = [['Escape', 'ESC', 0, 0, 1], ...'1234567890'.split('').map((d, i) => ['Digit' + d, d, 1.1 + i, 0, 1]),
    ['Tab', 'TAB', 0, 1, 1.5], ...'QWERTYUIOP'.split('').map((c, i) => ['Key' + c, c, 1.5 + i, 1, 1]),
    ['CapsLock', 'CAPS', 0, 2, 1.75], ...'ASDFGHJKL'.split('').map((c, i) => ['Key' + c, c, 1.75 + i, 2, 1]), ['Enter', 'ENTER', 10.75, 2, 1.75],
    ['ShiftLeft', 'SHIFT', 0, 3, 2.25], ...'ZXCVBNM'.split('').map((c, i) => ['Key' + c, c, 2.25 + i, 3, 1]), ['ShiftRight', 'SHIFT', 9.25, 3, 2.5],
    ['ControlLeft', 'CTRL', 0, 4, 1.5], ['Space', 'SPACE', 3, 4, 6], ['ControlRight', 'CTRL', 9.75, 4, 1.5],
    ['ArrowUp', '↑', 13.75, 3, 1], ['ArrowLeft', '←', 12.75, 4, 1], ['ArrowDown', '↓', 13.75, 4, 1], ['ArrowRight', '→', 14.75, 4, 1]];
  const KIND = { KeyA: 'move', KeyD: 'move', KeyW: 'move', KeyS: 'move', Space: 'jump', KeyJ: 'attack', ShiftLeft: 'dash', KeyK: 'special', KeyI: 'magic',
    KeyU: 'skill', KeyH: 'skill', KeyO: 'skill', KeyP: 'skill', KeyL: 'skill' };
  // 키보드 그림용 짧은 이름. 띄어쓰기 자리에서 두 줄로 나뉜다
  const SHORT = { KeyA: '◀이동', KeyD: '▶이동', KeyW: '▲이동', KeyS: '▼이동', Space: '점프', KeyJ: '공격', ShiftLeft: '대시', KeyK: '필살기', KeyI: '뇌격',
    KeyU: '찌르기', KeyH: '내려 찍기', KeyO: '회전 베기', KeyP: '점프 강하', KeyL: '붉은 파동' };
  const SHORT_VIESA = { KeyJ: '화살', KeyH: '근접', KeyU: '연사', KeyL: '저격', KeyO: '지상 플립', KeyP: '공중 플립', KeyK: '흑월 난사' };
  const SYSTEM = { Escape: '일시 정지', Enter: '확인', KeyM: '소리' };
  const shortName = a => (typeof playerControlCharacter !== 'undefined' && playerControlCharacter === 'viesa' && SHORT_VIESA[a]) || SHORT[a];
  // box 안에 키보드를 그린다. opts.focus: 강조할 동작 목록, opts.onKey: 키 클릭 콜백
  function drawKeyboard(box, opts = {}) {
    if (!box) return;
    if (!box.firstChild) {
      box.classList.add('kbd'); box.setAttribute('role', 'img');
      for (const [code, cap, x, y, w] of KB_KEYS) {
        const k = document.createElement('div'); k.className = 'kb-key'; k.dataset.code = code;
        k.style.cssText = `left:${x / KB_W * 100}%;top:${y / KB_H * 100}%;width:${(w - .12) / KB_W * 100}%;height:${.88 / KB_H * 100}%`;
        k.innerHTML = '<span class="kb-cap"></span><span class="kb-act"></span>';
        k.firstChild.textContent = cap; box.append(k);
      }
      box.addEventListener('click', e => { const k = e.target.closest('.kb-key'); if (k && box._onKey) box._onKey(k.dataset.code); });
    }
    box._onKey = opts.onKey || null;
    const focus = opts.focus ? new Set(opts.focus) : null, pressed = new Set(opts.pressed || []), parts = [];
    for (const k of box.children) {
      const code = k.dataset.code, action = Object.keys(defaults).find(a => options.bindings[a] === code);
      const alias = !action && aliasFor(code), act = action || alias;
      let kind = act ? KIND[act] : SYSTEM[code] ? 'system' : '', text = act ? shortName(act) : SYSTEM[code] || '';
      k.className = 'kb-key' + (kind ? ' kb-k kb-' + kind : '') + (alias ? ' kb-alias' : '') +
        (focus && !(act && focus.has(act)) ? ' kb-dim' : '') + (act && pressed.has(act) ? ' kb-on' : '');
      k.lastChild.textContent = text;
      k.title = text ? `${k.firstChild.textContent}: ${text}${alias ? ' (보조)' : ''}` : '';
      if (action && (!focus || focus.has(action))) parts.push(`${keyName(code)} ${shortName(action)}`);
    }
    box.setAttribute('aria-label', '키보드 배치: ' + parts.join(', '));
  }
  function checkpoint() {
    const c = read('checkpoint');
    if (!c || c.version !== 1 || !Number.isInteger(c.stage) || !number(c.stage, 0, 4)) return null;
    const characterId=c.characterId===undefined?'barel':c.characterId;
    if(!['barel','viesa'].includes(characterId))return null;
    for (const [k, min, max] of [['score', 0, 1e9], ['hp', 1, characterId==='viesa'?80:100], ['lives', 1, 3], ['sp', 0, 100], ['mg', 0, 3], ['buff', 0, 900]]) {
      if (!number(c[k], min, max) || !Number.isInteger(c[k])) return null;
    }
    return { version: 1, characterId, stage: c.stage, score: c.score, hp: c.hp, lives: c.lives, sp: c.sp, mg: c.mg, buff: c.buff };
  }
  function records() {
    const r = read('records');
    if (!r || !number(r.bestScore, 0, 1e9) || !Array.isArray(r.stages)) return { bestScore: 0, stages: [] };
    return { bestScore: r.bestScore, stages: r.stages.slice(0, 5).map(s => s && ['S', 'A', 'B', 'C'].includes(s.rank) && number(s.seconds, 0, 1e7) ? { rank: s.rank, seconds: s.seconds } : null) };
  }
  function record(stage, score, rank, seconds) {
    const r = records(), old = r.stages[stage], order = ['S', 'A', 'B', 'C'];
    r.bestScore = Math.max(r.bestScore, score);
    if (!old || order.indexOf(rank) < order.indexOf(old.rank) || (rank === old.rank && seconds < old.seconds)) r.stages[stage] = { rank, seconds };
    write('records', r);
  }
  function refreshTitle() {
    const btn = document.getElementById('btnContinue'); if (!btn) return;
    const c = checkpoint(), r = records();
    btn.hidden = !c; btn.textContent = c ? `STAGE ${c.stage + 1} 이어하기` : '이어하기';
    document.getElementById('recordSummary').textContent = r.bestScore ? `최고 점수 ${r.bestScore.toLocaleString()} · ` + r.stages.map((s, i) => s ? `${i + 1}: ${s.rank}` : '').filter(Boolean).join(' / ') : '첫 클리어 기록에 도전하세요';
    document.getElementById('saveStatus').textContent = available ? '' : '이 브라우저에서는 저장할 수 없습니다. 현재 게임은 계속할 수 있습니다.';
  }
  function applySettings() {
    fitCanvas();
    document.getElementById('performanceStats').hidden = !options.perf;
    AUDIO.setVolumes(options.music, options.sfx);
    document.body.classList.toggle('reduce-motion', !options.shake);
    const titleImage = document.getElementById('namedTitleImage');
    if (titleImage) { const src = options.shake ? NAMED_ART.title : NAMED_ART.titleStill; if (titleImage.src !== src) titleImage.src = src; }
    document.body.classList.toggle('touch', options.touch);
  }
  function assignKey(code) {
    const status = document.getElementById('bindingStatus');
    if (!validKey(code)) { status.textContent = '영문·숫자·방향키·Space·Shift 키를 사용하세요. M은 소리 켜기/끄기에 사용됩니다.'; return; }
    const other = Object.keys(defaults).find(k => k !== capture && options.bindings[k] === code);
    if (other) { status.textContent = playerActionLabel(other, labels[other]) + '에 사용 중인 키입니다.'; return; }
    options.bindings[capture] = code; options.customBindings = { ...options.bindings };
    capture = null; write('settings', options); bindingButtons(); status.textContent = '저장했습니다.';
  }
  function bindingButtons() {
    const box = document.getElementById('bindings'); box.replaceChildren();
    const custom = options.keyPreset === 'custom';
    document.querySelectorAll('[data-preset]').forEach(b => {
      const on = b.dataset.preset === options.keyPreset;
      b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on));
    });
    const desc = document.getElementById('presetDesc'); if (desc) desc.textContent = PRESET_INFO[options.keyPreset].desc;
    const tools = document.getElementById('customTools'); if (tools) tools.hidden = !custom;
    box.classList.toggle('locked', !custom);
    const keyboard = document.getElementById('settingsKeyboard');
    const paint = (focus = null) => drawKeyboard(keyboard, { focus: capture ? [capture] : focus, onKey: code => { if (capture) assignKey(code); } });
    for (const action of Object.keys(defaults)) {
      const row = document.createElement('div'); row.className = 'setting-row kb-row kb-' + KIND[action];
      const actionName=playerActionLabel(action,labels[action]);
      const label = document.createElement('span'); label.textContent = actionName;
      const button = document.createElement('button'); button.className = 'btn small-btn secondary';
      button.textContent = keyName(options.bindings[action]); button.setAttribute('aria-label', actionName + ' 키 변경');
      button.disabled = !custom; button.classList.toggle('capturing', capture === action);
      if (!custom) button.title = '3 · 사용자 설정에서 바꿀 수 있습니다';
      button.onclick = () => { capture = action; bindingButtons(); document.getElementById('bindingStatus').textContent = actionName + ': 새 키를 누르거나 키보드 그림에서 고르세요 (ESC 취소)'; };
      row.onmouseenter = () => { if (!capture) paint([action]); };
      row.onmouseleave = () => { if (!capture) paint(); };
      row.append(label, button); box.append(row);
    }
    paint();
    document.querySelectorAll('.cap[data-k]').forEach(el => {
      const codes = el.dataset.k.split(' '), k = codes.find(c => Object.hasOwn(defaults, c));
      if (k && !codes[0].startsWith('Arrow')) el.textContent = keyName(options.bindings[k]);
    });
    document.querySelectorAll('.skillbtn').forEach(b => {
      b.querySelector('.key').textContent = keyName(options.bindings['Key' + SKILLS[b.dataset.skill].key]);
      if (!b.querySelector('.state')) { const s = document.createElement('span'); s.className = 'state'; b.append(s); }
    });
  }
  addEventListener('keydown', e => {
    if (!capture) return;
    e.preventDefault(); e.stopImmediatePropagation();
    const status = document.getElementById('bindingStatus');
    if (e.code === 'Escape') { capture = null; bindingButtons(); status.textContent = '변경을 취소했습니다.'; return; }
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    assignKey(e.code);
  }, true);
  const touches = new Map();
  // 이동 레버: 손가락 위치를 8방향 키(A/D/W/S)로 바꾼다. 레버를 좌우로 빠르게 두 번 튕기면 키보드처럼 대시.
  const stickDirs = new Set();
  let stickId = null;
  function setStick(dirs) {
    for (const k of ['KeyA', 'KeyD', 'KeyW', 'KeyS']) {
      if (dirs.has(k) && !stickDirs.has(k)) { stickDirs.add(k); inputDown(k); }
      else if (!dirs.has(k) && stickDirs.has(k)) { stickDirs.delete(k); inputUp(k); }
    }
  }
  function drawStick(stick, x, y) {
    stick.style.setProperty('--kx', x + 'px'); stick.style.setProperty('--ky', y + 'px');
    stick.style.setProperty('--len', Math.hypot(x, y) + 'px');
    stick.style.setProperty('--ang', (Math.atan2(y, x) * 180 / Math.PI - 90) + 'deg');
  }
  function moveStick(stick, e) {
    const r = stick.getBoundingClientRect(), R = r.width / 2;
    let dx = e.clientX - (r.left + R), dy = e.clientY - (r.top + R);
    const d = Math.hypot(dx, dy), max = R * .55, dirs = new Set();
    if (d > R * .22) {
      if (Math.abs(dx) > Math.abs(dy) * .41) dirs.add(dx < 0 ? 'KeyA' : 'KeyD');
      if (Math.abs(dy) > Math.abs(dx) * .41) dirs.add(dy < 0 ? 'KeyW' : 'KeyS');
    }
    if (d > max) { dx *= max / d; dy *= max / d; }
    drawStick(stick, dx, dy); setStick(dirs);
  }
  function resetStick(release) {
    const stick = document.getElementById('touchStick');
    if (release) setStick(new Set()); else stickDirs.clear();
    stickId = null; if (stick) { stick.classList.remove('active'); drawStick(stick, 0, 0); }
  }
  let editing = false, selected = null, drag = null;
  const touchId = el => el.id === 'touchStick' ? 'stick' : el.dataset.control;
  const touchItems = () => [document.getElementById('touchStick'), ...document.querySelectorAll('#touchPad [data-control]')];
  const itemOf = id => options.touchLayout.items[id] || (options.touchLayout.items[id] = { dx: 0, dy: 0, k: 1, hide: false });
  const unitPx = () => document.getElementById('touchUnit').getBoundingClientRect().width;
  function applyTouchLayout() {
    const tc = document.getElementById('touchControls'), L = options.touchLayout;
    tc.style.setProperty('--touch-alpha', L.alpha); tc.style.setProperty('--ui-scale', L.scale);
    for (const el of touchItems()) {
      const it = L.items[touchId(el)] || { dx: 0, dy: 0, k: 1, hide: false };
      el.style.setProperty('--dx', it.dx); el.style.setProperty('--dy', it.dy); el.style.setProperty('--k', it.k);
      el.classList.toggle('t-hidden', it.hide); el.classList.toggle('t-selected', editing && el === selected);
    }
    const name = document.getElementById('touchEditName'), hide = document.getElementById('touchEditHide');
    name.textContent = selected ? selected.getAttribute('aria-label') : '키를 끌어서 옮기세요';
    hide.textContent = selected && itemOf(touchId(selected)).hide ? '보이기' : '숨기기';
    for (const b of document.querySelectorAll('#touchEditBar [data-need]')) b.disabled = !selected;
  }
  function keepOnScreen(el, it) {               // 화면 밖으로 끌려나가지 않게 오프셋을 되돌린다
    const r = el.getBoundingClientRect(), u = unitPx(), vw = innerWidth, vh = innerHeight;
    if (r.left < 0) it.dx -= r.left / u; else if (r.right > vw) it.dx -= (r.right - vw) / u;
    if (r.top < 0) it.dy -= r.top / u; else if (r.bottom > vh) it.dy -= (r.bottom - vh) / u;
    applyTouchLayout();
  }
  function startTouchEdit() {
    editing = true; selected = null; clearInput();
    document.getElementById('settings').classList.remove('show');
    document.getElementById('touchEditBar').hidden = false;
    applyTouchLayout(); syncTouchControls();
  }
  function endTouchEdit() {
    if (!editing) return;
    editing = false; selected = null; drag = null; write('settings', options);
    document.getElementById('touchEditBar').hidden = true;
    if (scene === 'settings') document.getElementById('settings').classList.add('show');
    applyTouchLayout(); syncTouchControls();
  }
  function editPointerDown(e) {
    if (!editing || e.target.closest('#touchEditBar')) return;
    const el = e.target.closest('#touchStick, #touchPad [data-control]');
    e.preventDefault(); e.stopPropagation();
    selected = el; applyTouchLayout(); if (!el) return;
    const it = itemOf(touchId(el));
    drag = { id: e.pointerId, el, x: e.clientX, y: e.clientY, dx: it.dx, dy: it.dy };
    try { el.setPointerCapture(e.pointerId); } catch { /* 이미 끝난 포인터 */ }
  }
  function editPointerMove(e) {
    if (!drag || e.pointerId !== drag.id) return;
    e.stopPropagation();
    const it = itemOf(touchId(drag.el)), u = unitPx();
    it.dx = drag.dx + (e.clientX - drag.x) / u; it.dy = drag.dy + (e.clientY - drag.y) / u;
    applyTouchLayout(); keepOnScreen(drag.el, it);
  }
  function editPointerUp(e) { if (drag && e.pointerId === drag.id) { e.stopPropagation(); drag = null; } }
  function editAction(action) {
    if (action === 'done') return endTouchEdit();
    if (action === 'resetAll') { options.touchLayout.items = {}; return applyTouchLayout(); }
    if (!selected) return;
    const it = itemOf(touchId(selected));
    if (action === 'bigger') it.k = Math.min(2, Math.round((it.k + .1) * 10) / 10);
    if (action === 'smaller') it.k = Math.max(.5, Math.round((it.k - .1) * 10) / 10);
    if (action === 'hide') it.hide = !it.hide;
    if (action === 'reset') Object.assign(it, { dx: 0, dy: 0, k: 1, hide: false });
    applyTouchLayout(); keepOnScreen(selected, it);
  }
  function clearTouch() { touches.clear(); resetStick(false); document.querySelectorAll('[data-control]').forEach(b => b.classList.remove('active')); }
  function mount() {
    const quality = document.getElementById('renderQuality'); quality.value = options.quality;
    quality.onchange = () => { options.quality = quality.value; applySettings(); write('settings', options); };
    const perf = document.getElementById('showPerformance'); perf.checked = options.perf;
    perf.onchange = () => { options.perf = perf.checked; applySettings(); write('settings', options); };
    for (const [id, key] of [['musicVolume', 'music'], ['sfxVolume', 'sfx']]) {
      const el = document.getElementById(id); el.value = options[key] * 100;
      el.oninput = () => { options[key] = Number(el.value) / 100; applySettings(); write('settings', options); };
    }
    for (const [id, key] of [['lowFx', 'lowFx'], ['screenShake', 'shake'], ['screenFlash', 'flash'], ['dangerZones', 'dangerZones'], ['touchEnabled', 'touch']]) {
      const el = document.getElementById(id); el.checked = options[key];
      el.onchange = () => { options[key] = el.checked; clearInput(); applySettings(); write('settings', options); if (key === 'touch') syncTouchControls(); };
    }
    document.getElementById('btnResetKeys').onclick = () => setPreset(DEFAULT_PRESET);
    document.querySelectorAll('[data-preset]').forEach(b => { b.onclick = () => setPreset(b.dataset.preset); });
    document.querySelectorAll('[data-copy]').forEach(b => {
      b.onclick = () => { capture = null; options.customBindings = { ...PRESETS[b.dataset.copy] }; setPreset('custom');
        document.getElementById('bindingStatus').textContent = PRESET_INFO[b.dataset.copy].name + ' 배치를 복사했습니다.'; };
    });
    document.querySelectorAll('[data-control]').forEach(b => {
      b.onpointerdown = e => {
        e.preventDefault(); if (scene !== 'play') return;
        b.setPointerCapture(e.pointerId); touches.set(e.pointerId, b.dataset.control); b.classList.add('active'); inputDown(b.dataset.control);
      };
      const release = e => { const code = touches.get(e.pointerId); touches.delete(e.pointerId); if (code && ![...touches.values()].includes(code)) inputUp(code); if (![...touches.values()].includes(b.dataset.control)) b.classList.remove('active'); };
      b.onpointerup = release; b.onpointercancel = release; b.onlostpointercapture = release;
    });
    const stick = document.getElementById('touchStick');
    stick.onpointerdown = e => {
      e.preventDefault(); if (scene !== 'play' || stickId !== null) return;
      stickId = e.pointerId; stick.setPointerCapture(e.pointerId); stick.classList.add('active'); moveStick(stick, e);
    };
    stick.onpointermove = e => { if (e.pointerId === stickId) moveStick(stick, e); };
    const stickUp = e => { if (e.pointerId === stickId) resetStick(true); };
    stick.onpointerup = stickUp; stick.onpointercancel = stickUp; stick.onlostpointercapture = stickUp;
    const tc = document.getElementById('touchControls');
    tc.addEventListener('pointerdown', editPointerDown, true);
    tc.addEventListener('pointermove', editPointerMove, true);
    tc.addEventListener('pointerup', editPointerUp, true);
    tc.addEventListener('pointercancel', editPointerUp, true);
    document.querySelectorAll('#touchEditBar [data-edit]').forEach(b => { b.onclick = () => editAction(b.dataset.edit); });
    const alpha = document.getElementById('touchAlpha'), size = document.getElementById('touchScale');
    const syncSliders = () => { alpha.value = Math.round((1 - options.touchLayout.alpha) * 100); size.value = Math.round(options.touchLayout.scale * 100); };
    alpha.oninput = () => { options.touchLayout.alpha = 1 - Number(alpha.value) / 100; applyTouchLayout(); write('settings', options); };
    size.oninput = () => { options.touchLayout.scale = Number(size.value) / 100; applyTouchLayout(); write('settings', options); };
    document.getElementById('btnTouchEdit').onclick = startTouchEdit;
    document.getElementById('btnTouchReset').onclick = () => { options.touchLayout = layoutDefaults(); syncSliders(); applyTouchLayout(); write('settings', options); };
    syncSliders(); applyTouchLayout();
    // 보스전 BGM: 내 mp3 > 게임 기본 mp3 > 합성 BGM. 5명의 보스가 같은 곡을 쓴다.
    const bgmFile = document.getElementById('bossBgmFile'), bgmStatus = document.getElementById('bossBgmStatus');
    const showBgm = message => {
      const i = AUDIO.bossInfo();
      bgmStatus.textContent = message || (i.source === 'custom' ? `내 파일: ${i.name}${i.stored ? '' : ' (저장 불가 · 이번 접속에만 적용)'}`
        : i.source === 'default' ? '게임 기본 mp3' : i.loading ? '기본 곡 불러오는 중…' : '기본 합성 BGM');
      document.getElementById('btnBossBgmClear').disabled = i.source !== 'custom';
    };
    document.getElementById('btnBossBgm').onclick = () => bgmFile.click();
    bgmFile.onchange = async () => {
      const file = bgmFile.files[0]; bgmFile.value = ''; if (!file) return;
      showBgm('불러오는 중…'); const r = await AUDIO.setBossFile(file); showBgm(r.ok ? '' : r.message);
    };
    document.getElementById('btnBossBgmClear').onclick = async () => { await AUDIO.clearBossFile(); showBgm(); };
    AUDIO.onBossInfo(() => showBgm()); showBgm();
    applySettings(); bindingButtons(); refreshTitle();
  }
  return { options, keyName, mapKey, drawKeyboard, shortName, setPreset, presets: PRESET_INFO, checkpoint, records, record, mount, refreshTitle, clearTouch, startTouchEdit, endTouchEdit, refreshBindings:bindingButtons,
    setTouchLayout: layout => { options.touchLayout = validLayout(layout); applyTouchLayout(); },
    get touchEditing() { return editing; },
    saveCheckpoint: c => write('checkpoint', c && { ...c, version: 1 }), cancelCapture: () => { capture = null; } };
})();
