'use strict';
// Preferences, validated local saves and input devices. No combat state is serialized.
const UX = (() => {
  const defaults = { KeyA: 'KeyA', KeyD: 'KeyD', KeyW: 'KeyW', KeyS: 'KeyS', Space: 'Space',
    KeyJ: 'KeyJ', ShiftLeft: 'ShiftLeft', KeyK: 'KeyK', KeyI: 'KeyI', KeyU: 'KeyU', KeyH: 'KeyH', KeyO: 'KeyO', KeyP: 'KeyP' };
  const labels = { KeyA: '왼쪽', KeyD: '오른쪽', KeyW: '위', KeyS: '아래', Space: '점프', KeyJ: '공격',
    ShiftLeft: '대시', KeyK: '필살기', KeyI: '뇌격', KeyU: '돌진 찌르기', KeyH: '내려찍기', KeyO: '회전 베기', KeyP: '점프 강하' };
  const reserved = new Set(['KeyM', 'KeyZ', 'KeyX', 'KeyV']);
  const validKey = k => typeof k === 'string' && (/^Key[A-Z]$/.test(k) || /^Digit[0-9]$/.test(k) || ['Space', 'ShiftLeft', 'ShiftRight'].includes(k)) && !reserved.has(k);
  const number = (v, a, b) => typeof v === 'number' && Number.isFinite(v) && v >= a && v <= b;
  let available = true, capture = null;
  function read(key) { try { return JSON.parse(localStorage.getItem('bmk_' + key)); } catch { return null; } }
  function write(key, value) {
    try { if (value === null) localStorage.removeItem('bmk_' + key); else localStorage.setItem('bmk_' + key, JSON.stringify(value)); }
    catch { available = false; }
    refreshTitle();
  }
  const saved = read('settings') || {};
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const options = { music: number(saved.music, 0, 1) ? saved.music : .7, sfx: number(saved.sfx, 0, 1) ? saved.sfx : .8,
    lowFx: typeof saved.lowFx === 'boolean' ? saved.lowFx : reduced,
    shake: typeof saved.shake === 'boolean' ? saved.shake : !reduced,
    flash: typeof saved.flash === 'boolean' ? saved.flash : !reduced,
    touch: typeof saved.touch === 'boolean' ? saved.touch : matchMedia('(pointer: coarse)').matches,
    bindings: { ...defaults } };
  if (saved.bindings && Object.keys(defaults).every(k => validKey(saved.bindings[k])) &&
      new Set(Object.keys(defaults).map(k => saved.bindings[k])).size === Object.keys(defaults).length) options.bindings = { ...saved.bindings };
  function keyName(k) { return k.replace(/^Key|^Digit/, '').replace('Space', 'SPACE').replace('ShiftLeft', 'L SHIFT').replace('ShiftRight', 'R SHIFT'); }
  function mapKey(code) {
    const action = Object.keys(defaults).find(k => options.bindings[k] === code);
    return action || (Object.hasOwn(defaults, code) ? '' : code);
  }
  function checkpoint() {
    const c = read('checkpoint');
    if (!c || c.version !== 1 || !Number.isInteger(c.stage) || !number(c.stage, 0, 4)) return null;
    for (const [k, min, max] of [['score', 0, 1e9], ['hp', 1, 100], ['lives', 1, 3], ['sp', 0, 100], ['mg', 0, 3], ['buff', 0, 900]]) {
      if (!number(c[k], min, max) || !Number.isInteger(c[k])) return null;
    }
    return { version: 1, stage: c.stage, score: c.score, hp: c.hp, lives: c.lives, sp: c.sp, mg: c.mg, buff: c.buff };
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
    AUDIO.setVolumes(options.music, options.sfx);
    document.body.classList.toggle('reduce-motion', !options.shake);
    const titleImage = document.getElementById('namedTitleImage');
    if (titleImage) { const src = options.shake ? NAMED_ART.title : NAMED_ART.titleStill; if (titleImage.src !== src) titleImage.src = src; }
    document.body.classList.toggle('touch', options.touch);
  }
  function bindingButtons() {
    const box = document.getElementById('bindings'); box.replaceChildren();
    for (const action of Object.keys(defaults)) {
      const row = document.createElement('div'); row.className = 'setting-row';
      const label = document.createElement('span'); label.textContent = labels[action];
      const button = document.createElement('button'); button.className = 'btn small-btn secondary';
      button.textContent = keyName(options.bindings[action]); button.setAttribute('aria-label', labels[action] + ' 키 변경');
      button.onclick = () => { capture = action; document.getElementById('bindingStatus').textContent = labels[action] + ': 새 키를 누르세요 (ESC 취소)'; };
      row.append(label, button); box.append(row);
    }
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
    if (e.code === 'Escape') { capture = null; status.textContent = '변경을 취소했습니다.'; return; }
    if (!validKey(e.code) || e.ctrlKey || e.altKey || e.metaKey) { status.textContent = '영문·숫자·Space·Shift 키를 사용하세요. M/Z/X/V는 보조 조작에 사용됩니다.'; return; }
    const other = Object.keys(defaults).find(k => k !== capture && options.bindings[k] === e.code);
    if (other) { status.textContent = labels[other] + '에 사용 중인 키입니다.'; return; }
    options.bindings[capture] = e.code; capture = null; write('settings', options); bindingButtons(); status.textContent = '저장했습니다.';
  }, true);
  const touches = new Map();
  function clearTouch() { touches.clear(); document.querySelectorAll('[data-control]').forEach(b => b.classList.remove('active')); }
  function mount() {
    for (const [id, key] of [['musicVolume', 'music'], ['sfxVolume', 'sfx']]) {
      const el = document.getElementById(id); el.value = options[key] * 100;
      el.oninput = () => { options[key] = Number(el.value) / 100; applySettings(); write('settings', options); };
    }
    for (const [id, key] of [['lowFx', 'lowFx'], ['screenShake', 'shake'], ['screenFlash', 'flash'], ['touchEnabled', 'touch']]) {
      const el = document.getElementById(id); el.checked = options[key];
      el.onchange = () => { options[key] = el.checked; clearInput(); applySettings(); write('settings', options); };
    }
    document.getElementById('btnResetKeys').onclick = () => { capture = null; options.bindings = { ...defaults }; write('settings', options); bindingButtons(); };
    document.querySelectorAll('[data-control]').forEach(b => {
      b.dataset.label = b.textContent;
      b.onpointerdown = e => {
        e.preventDefault(); if (scene !== 'play') return;
        b.setPointerCapture(e.pointerId); touches.set(e.pointerId, b.dataset.control); b.classList.add('active'); inputDown(b.dataset.control);
      };
      const release = e => { const code = touches.get(e.pointerId); touches.delete(e.pointerId); if (code && ![...touches.values()].includes(code)) inputUp(code); if (![...touches.values()].includes(b.dataset.control)) b.classList.remove('active'); };
      b.onpointerup = release; b.onpointercancel = release; b.onlostpointercapture = release;
    });
    applySettings(); bindingButtons(); refreshTitle();
  }
  return { options, keyName, mapKey, checkpoint, records, record, mount, refreshTitle, clearTouch,
    saveCheckpoint: c => write('checkpoint', c && { ...c, version: 1 }), cancelCapture: () => { capture = null; } };
})();
