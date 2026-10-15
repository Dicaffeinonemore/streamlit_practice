'use strict';
// =====================================================================
//  소리: WebAudio 로 합성하는 효과음 + 스테이지별 BGM (외부 파일 없음)
//  브라우저 정책상 첫 키 입력/클릭 뒤에 켜진다. M 키로 끄고 켠다 (선택은 브라우저에 기억)
//  사용: AUDIO.sfx('hit', 2) / AUDIO.music(스테이지 번호) / AUDIO.stop(페이드 초) / AUDIO.toggle()
// =====================================================================
(function (global) {
  const AU = { ctx: null, on: false, master: null, sfxB: null, musB: null, noise: null, mus: null, timer: 0, gm: 1, want: -1 };
  const mtof = n => 440 * Math.pow(2, (n - 69) / 12);
  let musicVolume = .7, sfxVolume = .8, paused = false;
  function setVolumes(music, effects) {
    musicVolume = Math.max(0, Math.min(1, music)); sfxVolume = Math.max(0, Math.min(1, effects));
    if (AU.ctx) {
      const t = AU.ctx.currentTime;
      AU.musB.gain.cancelScheduledValues(t); AU.musB.gain.setValueAtTime(.34 * musicVolume, t);
      AU.sfxB.gain.setValueAtTime(.9 * sfxVolume, t);
    }
  }
  function pause(on) {
    paused = on;
    if (!AU.ctx) return;
    if (on) AU.ctx.suspend().catch(() => {});
    else if (AU.on) AU.ctx.resume().catch(() => {});
  }

  function setup(ctx) {
    AU.ctx = ctx;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 5; comp.attack.value = 0.003; comp.release.value = 0.2;
    AU.master = ctx.createGain(); AU.master.gain.value = 0.8; AU.master.connect(comp); comp.connect(ctx.destination);
    AU.sfxB = ctx.createGain(); AU.sfxB.gain.value = 0.9; AU.sfxB.connect(AU.master);
    AU.musB = ctx.createGain(); AU.musB.gain.value = 0.34; AU.musB.connect(AU.master);
    const n = ctx.sampleRate * 1.5, buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    AU.noise = buf;
    setVolumes(musicVolume, sfxVolume);
  }
  function init() {
    if (AU.ctx) return AU.ctx;
    const C = global.AudioContext || global.webkitAudioContext; if (!C) return null;
    try { setup(new C()); } catch (e) { AU.ctx = null; }
    return AU.ctx;
  }
  // 톤: 주파수 f → f2 로 미끄러지며 감쇠
  function tone(f, dur, type, vol, o) {
    o = o || {}; const c = AU.ctx, t = c.currentTime + (o.d || 0) + 0.005;
    const os = c.createOscillator(), g = c.createGain(); os.type = type || 'square';
    os.frequency.setValueAtTime(f, t); if (o.f2) os.frequency.exponentialRampToValueAtTime(Math.max(20, o.f2), t + dur);
    vol *= AU.gm; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + (o.a || 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let out = g; os.connect(g);
    if (o.lp) { const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = o.lp; g.connect(fl); out = fl; }
    out.connect(AU.sfxB); os.start(t); os.stop(t + dur + 0.05);
  }
  // 잡음: 필터 주파수 f0 → f1
  function nz(dur, vol, type, f0, f1, o) {
    o = o || {}; const c = AU.ctx, t = c.currentTime + (o.d || 0) + 0.005;
    const s = c.createBufferSource(); s.buffer = AU.noise; s.loop = true;
    const fl = c.createBiquadFilter(); fl.type = type; fl.Q.value = o.q || 0.8;
    fl.frequency.setValueAtTime(f0, t); fl.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    vol *= AU.gm; const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + (o.a || 0.006)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(fl); fl.connect(g); g.connect(AU.sfxB); s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }
  const SFX = {
    swing(i) { nz(0.16 + i * 0.04, 0.2 + i * 0.05, 'bandpass', 700 - i * 150, 2600 + i * 500, { q: 1.2 }); tone(260 - i * 40, 0.12, 'sine', 0.08, { f2: 110 }); },
    dash() { nz(0.2, 0.22, 'highpass', 500, 3200); },
    jump() { tone(420, 0.12, 'triangle', 0.1, { f2: 820 }); nz(0.08, 0.1, 'highpass', 900, 3000); },
    hit(ci) {
      nz(0.12, 0.5, 'lowpass', 3200, 300); tone(170, 0.16, 'sine', 0.5, { f2: 48 });
      if (ci >= 1) tone(980, 0.09, 'square', 0.09, { f2: 420, lp: 3000 });
      if (ci >= 2) { tone(95, 0.4, 'sine', 0.55, { f2: 32 }); nz(0.35, 0.3, 'lowpass', 2400, 120); tone(1400, 0.18, 'triangle', 0.1, { f2: 700, d: 0.02 }); }
    },
    hurt() { tone(340, 0.2, 'sawtooth', 0.18, { f2: 110, lp: 1800 }); nz(0.1, 0.3, 'lowpass', 2400, 400); },
    hurtH() { tone(300, 0.34, 'sawtooth', 0.26, { f2: 70, lp: 1500 }); nz(0.2, 0.45, 'lowpass', 2800, 200); tone(90, 0.35, 'sine', 0.5, { f2: 30 }); },
    pdie() { tone(320, 1.0, 'sawtooth', 0.25, { f2: 36, lp: 1200 }); nz(0.8, 0.3, 'lowpass', 2000, 80); },
    spcharge() { tone(80, 0.5, 'sawtooth', 0.2, { f2: 760, lp: 2600, a: 0.2 }); tone(1200, 0.5, 'sine', 0.07, { f2: 2400, d: 0.1 }); nz(0.5, 0.12, 'highpass', 800, 4000); },
    spdash() { nz(0.2, 0.3, 'highpass', 400, 4200); tone(300, 0.2, 'sawtooth', 0.1, { f2: 900, lp: 2000 }); },
    spslash(k) { nz(0.14, 0.34, 'bandpass', 900 + k * 200, 3600, { q: 1.5 }); tone(620 + k * 110, 0.12, 'square', 0.08, { f2: 240, lp: 2600 }); nz(0.1, 0.4, 'lowpass', 3000, 300, { d: 0.04 }); tone(140, 0.14, 'sine', 0.4, { f2: 45, d: 0.04 }); },
    moon() { tone(130, 0.9, 'sine', 0.7, { f2: 26 }); nz(1.0, 0.5, 'lowpass', 2600, 70); tone(880, 0.5, 'triangle', 0.1, { f2: 220, d: 0.03 }); nz(0.6, 0.2, 'highpass', 2000, 6000, { d: 0.05 }); },
    pwave() { tone(520, 0.28, 'sine', 0.14, { f2: 1300 }); nz(0.22, 0.14, 'highpass', 1500, 5000); },
    land() { tone(110, 0.6, 'sine', 0.7, { f2: 28 }); nz(0.5, 0.45, 'lowpass', 2000, 80); },
    slam() { tone(100, 0.55, 'sine', 0.7, { f2: 26 }); nz(0.45, 0.5, 'lowpass', 2200, 90); },
    bswing() { nz(0.32, 0.32, 'bandpass', 300, 1300, { q: 0.9 }); tone(130, 0.3, 'sawtooth', 0.12, { f2: 70, lp: 900 }); },
    bcharge() { tone(70, 0.55, 'sawtooth', 0.2, { f2: 190, lp: 700, a: 0.15 }); nz(0.5, 0.12, 'lowpass', 500, 1500); },
    bwind() { tone(80, 0.3, 'sawtooth', 0.1, { f2: 150, lp: 600, a: 0.12 }); },
    tele() { tone(900, 0.28, 'sine', 0.16, { f2: 200 }); nz(0.2, 0.12, 'highpass', 2000, 6000); },
    tele2() { tone(200, 0.28, 'sine', 0.16, { f2: 1000 }); nz(0.2, 0.12, 'highpass', 2000, 6000); },
    orb() { tone(720, 0.2, 'sine', 0.14, { f2: 300 }); tone(1400, 0.08, 'square', 0.04, { f2: 600, lp: 3000 }); },
    raven() { for (let k = 0; k < 3; k++) { tone(700, 0.14, 'sawtooth', 0.1, { f2: 350, lp: 2200, d: k * 0.13 }); nz(0.1, 0.08, 'bandpass', 1800, 900, { d: k * 0.13 }); } },
    bwave() { tone(240, 0.28, 'sawtooth', 0.14, { f2: 900, lp: 2400 }); nz(0.22, 0.2, 'bandpass', 900, 3200); },
    pillar() { nz(0.6, 0.4, 'lowpass', 1800, 200); tone(75, 0.5, 'sine', 0.45, { f2: 36 }); },
    bossdie() { nz(1.8, 0.6, 'lowpass', 4200, 60); tone(150, 1.6, 'sine', 0.7, { f2: 20 }); for (let k = 1; k < 4; k++) { tone(110 - k * 14, 0.5, 'sine', 0.5, { f2: 26, d: k * 0.28 }); nz(0.35, 0.3, 'lowpass', 2500, 100, { d: k * 0.28 }); } },
    phase2() { for (let k = 0; k < 3; k++) tone(440, 0.14, 'square', 0.09, { f2: 330, lp: 2000, d: k * 0.2 }); tone(80, 0.7, 'sawtooth', 0.2, { f2: 240, lp: 900 }); },
    groggy() { tone(520, 0.5, 'triangle', 0.12, { f2: 180 }); for (let k = 0; k < 3; k++) tone(1200 + k * 200, 0.08, 'square', 0.05, { lp: 3200, d: 0.1 + k * 0.09 }); },
    victory() { [72, 76, 79, 84].forEach((n, i) => tone(mtof(n), 0.28, 'square', 0.12, { lp: 3200, d: i * 0.14 })); [72, 76, 79, 84].forEach(n => tone(mtof(n), 1.1, 'triangle', 0.12, { d: 0.62 })); tone(mtof(60), 1.2, 'sawtooth', 0.1, { lp: 900, d: 0.62 }); },
    defeat() { [67, 63, 60, 55].forEach((n, i) => tone(mtof(n), 0.4, 'sawtooth', 0.14, { lp: 1400, d: i * 0.28 })); tone(mtof(43), 1.4, 'sine', 0.3, { d: 1.0, f2: mtof(40) }); },
    click() { tone(900, 0.05, 'square', 0.06, { lp: 3000 }); },
    mobdie() { nz(0.22, 0.4, 'lowpass', 2600, 200); tone(260, 0.28, 'square', 0.1, { f2: 60, lp: 1800 }); },
    barrel() { nz(0.18, 0.4, 'lowpass', 1600, 200); tone(180, 0.14, 'triangle', 0.2, { f2: 90 }); },
    pickup() { tone(mtof(79), 0.09, 'square', 0.1, { lp: 3200 }); tone(mtof(86), 0.16, 'square', 0.1, { lp: 3200, d: 0.07 }); },
    mcharge() { tone(200, 0.4, 'sine', 0.2, { f2: 1500, a: 0.15 }); tone(mtof(91), 0.4, 'triangle', 0.08, { f2: mtof(96), d: 0.05 }); nz(0.4, 0.12, 'highpass', 1500, 6000, { a: 0.2 }); },
    bolt() { nz(0.5, 0.7, 'highpass', 900, 5000); nz(0.9, 0.55, 'lowpass', 3000, 70, { d: 0.03 }); tone(70, 0.9, 'sine', 0.7, { f2: 28, d: 0.03 }); tone(1800, 0.2, 'sawtooth', 0.1, { f2: 200, lp: 3000 }); },
  };
  const GAIN = { mobdie: 1.6, pickup: 1.8, swing: 4, dash: 2.5, jump: 2, hurt: 2.5, spdash: 2, pwave: 2.5, bswing: 3.5, bwind: 2, tele: 2.2, tele2: 2.2, orb: 3, bwave: 3, phase2: 2, click: 4, raven: 1.6, barrel: 2 };   // 작게 들리는 소리 보정
  function sfx(name, a) {
    if (!AU.on || !AU.ctx || AU.ctx.state === 'closed') return;
    const f = SFX[name]; if (!f) return;
    AU.gm = GAIN[name] || 1; try { f(a); } catch (e) { /* 무시 */ } AU.gm = 1;
  }

  // Separate original stage and boss scores, with a per-track fade bus.
  let wantedBoss = false, wantedRate = 1;
  function musTick(until) {
    const M = AU.mus; if (!M) return;
    while (M.next < until) {
      const step = 60 / (M.T.bpm * M.rate) / 4;
      SCORE.step(M.engine, M.T, M.step++, M.next, step); M.next += step;
    }
  }
  function music(i, rate = 1, boss = false) {
    stop(.6); AU.want = i; wantedBoss = boss; wantedRate = rate;
    if (!AU.on || !AU.ctx) return;
    const engine = SCORE.create(AU.ctx, AU.musB), now = AU.ctx.currentTime;
    engine.bus.gain.setValueAtTime(0,now);engine.bus.gain.linearRampToValueAtTime(2.5,now+.8);
    AU.mus = { T: SCORE.tracks[(i % 5) + (boss ? 5 : 0)], engine, step: 0, next: now+.08, rate };
    AU.timer = setInterval(() => { if (AU.ctx?.state === 'running') musTick(AU.ctx.currentTime+.25); },40);
  }
  function stop(fade = 0) {
    clearInterval(AU.timer); const old = AU.mus; AU.mus = null; AU.want = -1;
    if (old && AU.ctx) {
      const now = AU.ctx.currentTime;
      old.engine.bus.gain.cancelScheduledValues(now);old.engine.bus.gain.setValueAtTime(old.engine.bus.gain.value,now);
      old.engine.bus.gain.linearRampToValueAtTime(0,now+fade);
      if (fade) setTimeout(() => old.engine.dispose(), (fade+.1)*1000); else old.engine.dispose();
    }
  }
  function silence() { stop(.25); }
  function currentMusic() { return AU.want < 0 ? null : { stage: AU.want, boss: wantedBoss, name: SCORE.tracks[(AU.want%5)+(wantedBoss?5:0)].name }; }
  async function renderPreview(stage, boss, seconds = 12) {
    const c = new OfflineAudioContext(2,Math.ceil(seconds*24000),24000), gain=c.createGain();gain.gain.value=.34;gain.connect(c.destination);
    const engine=SCORE.create(c,gain), T=SCORE.tracks[stage+(boss?5:0)], step=60/T.bpm/4;
    engine.bus.gain.setValueAtTime(2.5,0);engine.bus.gain.setValueAtTime(2.5,Math.max(0,seconds-1));engine.bus.gain.linearRampToValueAtTime(0,seconds);
    for(let st=0;st*step<seconds;st++) SCORE.step(engine,T,st,st*step,step);
    const buffer = await c.startRendering(); engine.dispose(); return buffer;
  }

  function pref() { try { return localStorage.getItem('sf_snd'); } catch (e) { return null; } }
  function save(v) { try { localStorage.setItem('sf_snd', v); } catch (e) { /* 저장 불가 환경 무시 */ } }
  function enable(on) {
    if (on) {
      const c = init(); if (!c) { AU.on = false; return false; }
      if (c.resume && !paused) c.resume().catch(() => {});
      AU.master.gain.value = .8;
      AU.on = true;
      if (AU.want >= 0 && !AU.mus) music(AU.want, wantedRate, wantedBoss);
    } else { const desired=AU.want; AU.on = false; stop(0); AU.want=desired; if (AU.master) AU.master.gain.value = 0; }
    return AU.on;
  }
  function toggle() { const on = enable(!AU.on); save(on ? 'on' : 'off'); if (on) sfx('click'); return on; }
  // 첫 사용자 입력에서 자동으로 켠다 (예전에 껐다면 꺼진 채로)
  let touched = false;
  function gesture(e) {
    if (touched || (e && e.code === 'KeyM')) return;   // M(소리 토글) 은 토글 쪽에서 처리
    touched = true; if (pref() !== 'off') enable(true);
  }
  ['keydown', 'pointerdown'].forEach(ev => global.addEventListener(ev, gesture, true));

  global.AUDIO = { sfx, music, bossMusic: i => music(i, 1, true), currentMusic, renderPreview, stop, silence, toggle, enable, pause, setVolumes, isOn: () => AU.on };
})(window);
