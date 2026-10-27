'use strict';
// =====================================================================
//  소리: WebAudio 합성 효과음 + 적 사망 MP3 + 스테이지별 BGM
//  브라우저 정책상 첫 키 입력/클릭 뒤에 켜진다. M 키로 끄고 켠다 (선택은 브라우저에 기억)
//  사용: AUDIO.sfx('hit', 2) / AUDIO.music(스테이지 번호) / AUDIO.stop(페이드 초) / AUDIO.toggle()
//  보스전 BGM 은 mp3 로 바꿀 수 있다: 플레이어가 고른 파일 > 게임 기본 파일(assets/bgm/boss.mp3) > 합성 BGM
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
    prepareBoss();
    prepareEnemyDeath();
    prepareViesaSkills();
    prepareBarelSamples();
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
    swordSwing(i = 0) {
      i = Math.max(0, Math.min(2, i));
      nz(.11 + i * .018, .28, 'bandpass', 1700 - i * 180, 5800 - i * 350, { q: .65, a: .004 });
      nz(.07 + i * .015, .12, 'highpass', 4800, 2200, { d: .018, a: .003 });
    },
    swordHit(i = 0) {
      i = Math.max(0, Math.min(2, i));
      // A fast cutting edge, a dry contact, then a short steel resonance.
      nz(.075 + i * .012, .48, 'bandpass', 6400 - i * 450, 1600, { q: .8, a: .002 });
      nz(.045, .22, 'highpass', 7500, 3200, { a: .001 });
      nz(.055 + i * .008, .2, 'lowpass', 1400, 420, { a: .002 });
      tone(2450 - i * 220, .095 + i * .018, 'sine', .075, { f2: 1500 - i * 140, d: .006, a: .001 });
      tone(3700 - i * 270, .065, 'sine', .035, { f2: 2400, d: .009, a: .001 });
    },
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
    const sampleName = name === 'hurtH' ? 'hurt' : name;
    if (global.BAREL_SFX_URLS && Object.hasOwn(global.BAREL_SFX_URLS, sampleName)) {
      playBarelSample(sampleName, a); return;
    }
    if (global.VIESA_SFX_URLS && Object.hasOwn(global.VIESA_SFX_URLS, name)) {
      playViesaSkill(name);
      return;
    }
    if (name === 'mobdie' && playEnemyDeath()) return;
    const f = SFX[name]; if (!f) return;
    AU.gm = GAIN[name] || 1; try { f(a); } catch (e) { /* 무시 */ } AU.gm = 1;
  }

  // Separate original stage and boss scores, with a per-track fade bus.
  let wantedBoss = false, wantedRate = 1, wantedVictory = null;   // wantedVictory: null | 'victory' | 'ending'
  const trackOf = (i, boss, win) => win ? SCORE.victory[win] : SCORE.tracks[(i % 5) + (boss ? 5 : 0)];
  function musTick(until) {
    const M = AU.mus; if (!M) return;
    while (M.next < until) {
      const step = 60 / (M.T.bpm * M.rate) / 4;
      SCORE.step(M.engine, M.T, M.step++, M.next, step); M.next += step;
    }
  }
  function music(i, rate = 1, boss = false, win = null) {
    stop(win ? .4 : .6); AU.want = i; wantedBoss = boss; wantedRate = rate; wantedVictory = win;
    if (!AU.on || !AU.ctx) return;
    const file = boss && !win && bossBuffer();
    if (file) { playFile(file, rate); return; }
    const engine = SCORE.create(AU.ctx, AU.musB), now = AU.ctx.currentTime;
    // 승리 팡파르는 첫 음부터 또렷하게, 일반 BGM 은 0.8초에 걸쳐 들어온다
    engine.bus.gain.setValueAtTime(0,now);engine.bus.gain.linearRampToValueAtTime(2.5,now+(win?.05:.8));
    AU.mus = { T: trackOf(i, boss, win), engine, step: 0, next: now+.08, rate };
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
  function currentMusic() {
    if (AU.want < 0) return null;
    const name = AU.mus?.buf ? (AU.mus.buf === bossFile.customBuf ? bossFile.customName : 'boss.mp3') : trackOf(AU.want, wantedBoss, wantedVictory).name;
    return { stage: AU.want, boss: wantedBoss, victory: wantedVictory, name, file: !!AU.mus?.buf };
  }

  // ---- 보스전 mp3 ----------------------------------------------------
  // 5명의 보스가 같은 곡을 쓴다. 직접 고른 파일은 IndexedDB 에 저장해 새로고침 뒤에도 유지한다.
  const BOSS_FILE_GAIN = 2, BOSS_MAX_BYTES = 30 * 1024 * 1024;
  const bossFile = { customRaw: null, customBuf: null, customName: '', stored: false, defBuf: null, defState: 'idle', listeners: [] };
  const bossBuffer = () => bossFile.customBuf || bossFile.defBuf;
  const decode = raw => new Promise((ok, fail) => {         // 콜백(구형 Safari)과 Promise 양쪽을 모두 받는다
    const p = AU.ctx.decodeAudioData(raw.slice(0), ok, fail); if (p && p.catch) p.catch(() => {});
  });
  // Embedded with the scripts so local, Streamlit and single-HTML builds use
  // the same sample. One buffer, independent sources for simultaneous kills.
  let enemyDeathBuffer = null, enemyDeathReady = null, enemyDeathOffset = 0;
  function prepareEnemyDeath() {
    if (!enemyDeathReady && global.ENEMY_DEATH_SFX_URL && AU.ctx) {
      enemyDeathReady = fetch(global.ENEMY_DEATH_SFX_URL).then(r => {
        if (!r.ok) throw new Error('Enemy death sample unavailable');
        return r.arrayBuffer();
      }).then(decode).then(buffer => {
        // Skip encoded leading silence so the audible hit starts on the killing blow.
        let first = buffer.length;
        for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
          const data = buffer.getChannelData(ch);
          for (let i = 0; i < first; i++) {
            if (Math.abs(data[i]) > .003) { first = i; break; }
          }
        }
        if (first === buffer.length) return; // Silent sample: retain the immediate fallback.
        enemyDeathOffset = Math.max(0, first / buffer.sampleRate - .002);
        enemyDeathBuffer = buffer;
      }).catch(() => {});
    }
  }
  function playEnemyDeath() {
    if (!enemyDeathBuffer) return false;  // Keep synthesized fallback while loading/on failure.
    const src = AU.ctx.createBufferSource(); src.buffer = enemyDeathBuffer;
    src.connect(AU.sfxB); src.onended = () => src.disconnect(); src.start(0, enemyDeathOffset);
    return true;
  }
  const viesaSkillBuffers = new Map();
  const barelSamples = new Map();
  function prepareBarelSamples() {
    if (!AU.ctx) return Promise.resolve([]);
    for (const [name,url] of Object.entries(global.BAREL_SFX_URLS || {})) {
      if (barelSamples.has(name)) continue;
      const sample = {buffer:null,offset:0,last:-Infinity};
      sample.ready = fetch(url).then(r=>{
        if(!r.ok)throw Error('Barel sample unavailable');return r.arrayBuffer();
      }).then(decode).then(buffer=>{
        let first=buffer.length;
        for(let ch=0;ch<buffer.numberOfChannels;ch++){
          const data=buffer.getChannelData(ch);
          for(let i=0;i<first;i++)if(Math.abs(data[i])>.003){first=i;break;}
        }
        if(first===buffer.length)throw Error('Silent Barel sample');
        sample.offset=Math.max(0,first/buffer.sampleRate-.002);sample.buffer=buffer;
        return true;
      }).catch(()=>false);
      barelSamples.set(name,sample);
    }
    return Promise.all([...barelSamples.values()].map(s=>s.ready));
  }
  function playBarelSample(name, options) {
    const sample=barelSamples.get(name);if(!sample)return;
    const requested=AU.ctx.currentTime;
    const play=()=>{
      if(!sample.buffer||!AU.on||paused||AU.ctx.state==='closed'||
        AU.ctx.currentTime-requested>.15||AU.ctx.currentTime-sample.last<.018)return;
      sample.last=AU.ctx.currentTime;
      const src=AU.ctx.createBufferSource();src.buffer=sample.buffer;
      const limit=options?.duration;
      if(Number.isFinite(limit)&&limit>0){
        const duration=Math.min(limit,sample.buffer.duration-sample.offset),gain=AU.ctx.createGain(),now=AU.ctx.currentTime;
        gain.gain.setValueAtTime(1,now);gain.gain.setValueAtTime(1,now+Math.max(0,duration-.008));
        gain.gain.linearRampToValueAtTime(0,now+duration);
        src.connect(gain);gain.connect(AU.sfxB);src.onended=()=>{src.disconnect();gain.disconnect();};
        src.start(0,sample.offset,duration);
      }else{
        src.connect(AU.sfxB);src.onended=()=>src.disconnect();src.start(0,sample.offset);
      }
    };
    if(sample.buffer)play();else sample.ready.then(play);
  }
  function prepareViesaSkills() {
    for (const [name, url] of Object.entries(global.VIESA_SFX_URLS || {})) {
      const ready = fetch(url).then(r => {
        if (!r.ok) throw new Error('Viesa skill sample unavailable');
        return r.arrayBuffer();
      }).then(decode);
      viesaSkillBuffers.set(name, ready);
      ready.catch(() => {});
    }
  }
  function playViesaSkill(name) {
    // Predecode on audio unlock; a first cast also waits for its sample.
    viesaSkillBuffers.get(name)?.then(buffer => {
      if (!AU.on || paused || AU.ctx.state === 'closed') return;
      const src = AU.ctx.createBufferSource(); src.buffer = buffer;
      src.connect(AU.sfxB); src.onended = () => src.disconnect(); src.start();
    }).catch(() => {});
  }
  function playFile(buf, rate) {
    const c = AU.ctx, now = c.currentTime, bus = c.createGain(), src = c.createBufferSource();
    src.buffer = buf; src.loop = true; src.playbackRate.value = rate; src.connect(bus); bus.connect(AU.musB);
    bus.gain.setValueAtTime(0, now); bus.gain.linearRampToValueAtTime(BOSS_FILE_GAIN, now + .8);
    src.start(now + .05);
    AU.mus = { buf, engine: { bus, dispose() { try { src.stop(); } catch (e) { /* 이미 멈춤 */ } src.disconnect(); bus.disconnect(); } } };
  }
  function bossInfo() {
    return { source: bossFile.customBuf ? 'custom' : bossFile.defBuf ? 'default' : 'synth',
      name: bossFile.customName, stored: bossFile.stored, loading: bossFile.defState === 'loading' };
  }
  function notifyBoss() {
    // 보스전 도중 곡이 바뀌면(파일 선택·해제, 기본 곡 로딩 완료) 새 곡으로 이어서 튼다.
    if (AU.on && AU.want >= 0 && wantedBoss && !wantedVictory && (AU.mus?.buf || null) !== (bossBuffer() || null)) music(AU.want, wantedRate, true);
    bossFile.listeners.forEach(f => { try { f(bossInfo()); } catch (e) { /* 무시 */ } });
  }
  async function prepareBoss() {
    if (!AU.ctx) return;
    if (bossFile.customRaw && !bossFile.customBuf) {
      try { bossFile.customBuf = await decode(bossFile.customRaw); }
      catch (e) { bossFile.customRaw = null; bossFile.customName = ''; }
    }
    if (bossFile.defState === 'idle') {
      bossFile.defState = 'loading'; notifyBoss();
      try {
        const r = await fetch(global.BOSS_BGM_URL || 'assets/bgm/boss.mp3');
        if (!r.ok) throw new Error(r.status);
        bossFile.defBuf = await decode(await r.arrayBuffer()); bossFile.defState = 'ready';
      } catch (e) { bossFile.defState = 'missing'; }   // 기본 mp3 가 없으면 합성 BGM
    }
    notifyBoss();
  }
  function idb(mode, op) {
    return new Promise(done => {
      try {
        const req = indexedDB.open('bmk_audio', 1);
        req.onupgradeneeded = () => req.result.createObjectStore('files');
        req.onerror = () => done(undefined);
        req.onsuccess = () => {
          const db = req.result;
          try {
            const tx = db.transaction('files', mode), r = op(tx.objectStore('files'));
            tx.oncomplete = () => { db.close(); done(mode === 'readonly' ? r.result : true); };
            tx.onerror = tx.onabort = () => { db.close(); done(undefined); };
          } catch (e) { db.close(); done(undefined); }
        };
      } catch (e) { done(undefined); }
    });
  }
  async function setBossFile(file) {
    if (!file) return { ok: false, message: '파일을 고르지 않았습니다.' };
    if (file.size > BOSS_MAX_BYTES) return { ok: false, message: '30MB 이하의 파일만 쓸 수 있습니다.' };
    if (!init()) return { ok: false, message: '이 브라우저는 오디오를 지원하지 않습니다.' };
    const raw = await file.arrayBuffer();
    let buf;
    try { buf = await decode(raw); } catch (e) { return { ok: false, message: '재생할 수 없는 오디오 파일입니다.' }; }
    Object.assign(bossFile, { customRaw: raw, customBuf: buf, customName: file.name });
    bossFile.stored = !!await idb('readwrite', s => s.put({ name: file.name, data: raw }, 'bossBgm'));
    notifyBoss();
    return { ok: true, saved: bossFile.stored };
  }
  async function clearBossFile() {
    Object.assign(bossFile, { customRaw: null, customBuf: null, customName: '', stored: false });
    await idb('readwrite', s => s.delete('bossBgm'));
    notifyBoss();
  }
  idb('readonly', s => s.get('bossBgm')).then(v => {
    if (bossFile.customRaw || !v || typeof v.name !== 'string' || !(v.data instanceof ArrayBuffer)) return;
    Object.assign(bossFile, { customRaw: v.data, customName: v.name, stored: true });
    if (AU.ctx) prepareBoss(); else notifyBoss();
  });
  async function renderPreview(stage, boss, seconds = 12) {
    const c = new OfflineAudioContext(2,Math.ceil(seconds*24000),24000), gain=c.createGain();gain.gain.value=.34;gain.connect(c.destination);
    const engine=SCORE.create(c,gain), T=typeof stage==='string'?SCORE.victory[stage]:SCORE.tracks[stage+(boss?5:0)], step=60/T.bpm/4;
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
      if (AU.want >= 0 && !AU.mus) music(AU.want, wantedRate, wantedBoss, wantedVictory);
    } else { const desired=AU.want; AU.on = false; stop(0); AU.want=desired; if (AU.master) AU.master.gain.value = 0; }
    return AU.on;
  }
  function toggle() { const on = enable(!AU.on); save(on ? 'on' : 'off'); if (on) sfx('click'); return on; }
  // 첫 사용자 입력에서 자동으로 켠다 (예전에 껐다면 꺼진 채로)
  let touched = false;
  function gesture(e) {
    if (e && e.code === 'KeyM') return;   // M is handled by the explicit mute toggle.
    if (!touched) {
      touched = true;
      if (pref() !== 'off') enable(true);
    } else if (AU.on && !paused && AU.ctx?.state !== 'running') {
      // A first touch/iframe gesture may not unlock audio. Retry in the next
      // activation event, also recovering contexts interrupted by the browser.
      enable(true);
    }
  }
  ['keydown', 'pointerdown', 'pointerup', 'touchend', 'click'].forEach(ev => global.addEventListener(ev, gesture, true));

  global.AUDIO = { sfx, music, bossMusic: i => music(i, 1, true), victoryMusic: (i, final) => music(i, 1, false, final ? 'ending' : 'victory'), currentMusic, renderPreview, stop, silence, toggle, enable, pause, setVolumes, isOn: () => AU.on,
    barelSamplesReady: prepareBarelSamples,
    setBossFile, clearBossFile, bossInfo, onBossInfo: f => bossFile.listeners.push(f) };
})(window);
