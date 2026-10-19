'use strict';
// Original dark-fantasy scores. Shared orchestral synthesis, separate stage/boss compositions.
(function (global) {
  const tracks = [
    { name: '잿빛 군단의 행군', bpm: 78, root: 38, chords: [0,-2,-4,-5], motif: [7,3,2,0], boss: false },
    { name: '안개 속 진혼곡', bpm: 66, root: 40, chords: [0,-4,-5,-1], motif: [3,2,-1,0], boss: false },
    { name: '불타는 왕좌', bpm: 84, root: 38, chords: [0,1,-4,-5], motif: [7,8,3,2], boss: false },
    { name: '얼어붙은 묘지의 기도', bpm: 64, root: 36, chords: [0,-5,-4,-2], motif: [7,2,3,0], boss: false },
    { name: '검은 달의 강림', bpm: 86, root: 37, chords: [0,1,-5,-1], motif: [1,0,7,3], boss: false },
    { name: '도살자의 북', bpm: 104, root: 36, chords: [0,0,1,-5], motif: [0,7,1,0], boss: true },
    { name: '까마귀의 미사', bpm: 96, root: 39, chords: [0,-1,-5,1], motif: [7,6,3,0], boss: true },
    { name: '황금왕의 심판', bpm: 112, root: 38, chords: [0,-4,1,-5], motif: [7,12,8,7], boss: true },
    { name: '영구동토의 왕', bpm: 98, root: 36, chords: [0,-5,1,-1], motif: [12,7,3,1], boss: true },
    { name: '종언의 월식', bpm: 118, root: 37, chords: [0,1,-1,-5], motif: [0,1,7,6], boss: true },
  ];
  const hz = n => 440 * Math.pow(2, (n - 69) / 12);
  function create(c, destination) {
    const bus = c.createGain(); bus.gain.value = 0; bus.connect(destination);
    const reverb = c.createConvolver(), wet = c.createGain(); wet.gain.value = .22;
    const impulse = c.createBuffer(2, Math.ceil(c.sampleRate * 2.4), c.sampleRate);
    let seed = 11939;
    for (let ch = 0; ch < 2; ch++) {
      const d = impulse.getChannelData(ch);
      for (let i = 0; i < d.length; i++) { seed = (seed * 1664525 + 1013904223) >>> 0; d[i] = (seed / 2147483648 - 1) * Math.pow(1 - i / d.length, 3) * .45; }
    }
    reverb.buffer = impulse; reverb.connect(wet); wet.connect(bus);
    const noise = c.createBuffer(1,c.sampleRate,c.sampleRate), d = noise.getChannelData(0);
    for (let i=0;i<d.length;i++) { seed=(seed*1664525+1013904223)>>>0; d[i]=seed/2147483648-1; }
    const waves = {};
    for (const [name, harmonics] of Object.entries({ strings:[1,.5,.32,.23,.16,.1,.06], brass:[1,.65,.42,.22,.12], choir:[1,.12,.28,.06,.08] })) {
      const real=new Float32Array(harmonics.length+1), imag=new Float32Array(harmonics.length+1); imag.set(harmonics,1);
      waves[name]=c.createPeriodicWave(real,imag);
    }
    const nodes = new Set();
    function voice(note, start, length, kind, volume, pan = 0) {
      const env=c.createGain(), filter=c.createBiquadFilter(), stereo=c.createStereoPanner();
      filter.type='lowpass'; filter.frequency.setValueAtTime(kind==='choir'?950:kind==='brass'?700:1500,start);
      filter.frequency.linearRampToValueAtTime(kind==='brass'?1300:kind==='choir'?1250:2100,start+Math.min(length*.4,.35)); filter.Q.value=.4;
      stereo.pan.value=pan; filter.connect(env);env.connect(stereo);stereo.connect(bus);stereo.connect(reverb);
      const attack=Math.min(length*.2,kind==='choir'?.45:kind==='brass'?.12:.07), release=kind==='choir'?.65:.25;
      env.gain.setValueAtTime(0,start);env.gain.linearRampToValueAtTime(volume,start+attack);
      env.gain.setValueAtTime(volume*.78,start+Math.max(attack,length*.65));env.gain.linearRampToValueAtTime(0,start+length+release);
      let ended=0;
      for (const detune of [-5,5]) {
        const os=c.createOscillator();os.setPeriodicWave(waves[kind]);os.frequency.value=hz(note);os.detune.value=detune;os.connect(filter);nodes.add(os);
        os.onended=()=>{nodes.delete(os);os.disconnect();if(++ended===2){filter.disconnect();env.disconnect();stereo.disconnect();}};
        os.start(start);os.stop(start+length+release+.02);
      }
    }
    function drum(start, accent, roll = false) {
      const os=c.createOscillator(), g=c.createGain();os.type='sine';
      os.frequency.setValueAtTime(roll?100:76,start);os.frequency.exponentialRampToValueAtTime(roll?62:38,start+.38);
      g.gain.setValueAtTime(0,start);g.gain.linearRampToValueAtTime(accent,start+.008);g.gain.exponentialRampToValueAtTime(.0001,start+.95);
      os.connect(g);g.connect(bus);g.connect(reverb);os.start(start);os.stop(start+1);nodes.add(os);
      os.onended=()=>{nodes.delete(os);os.disconnect();g.disconnect();};
      const s=c.createBufferSource(), f=c.createBiquadFilter(), ng=c.createGain();s.buffer=noise;f.type='lowpass';f.frequency.value=roll?1300:440;
      ng.gain.setValueAtTime(accent*.32,start);ng.gain.exponentialRampToValueAtTime(.0001,start+.3);
      s.connect(f);f.connect(ng);ng.connect(bus);s.start(start);s.stop(start+.32);nodes.add(s);
      s.onended=()=>{nodes.delete(s);s.disconnect();f.disconnect();ng.disconnect();};
    }
    return { bus, voice, drum, dispose() { for(const n of nodes){try{n.stop();}catch{}n.disconnect();}nodes.clear();bus.disconnect();reverb.disconnect();wet.disconnect(); } };
  }
  // 승리 BGM: 장조. 처음 2마디는 금관 팡파르, 그 뒤 I-V-vi-IV 개선 행진이 8마디 단위로 반복된다.
  const victory = {
    victory: { name: '승리의 개선가', bpm: 96, root: 41, chords: [0,7,9,5], victory: true },
    ending:   { name: '새벽을 여는 기사', bpm: 80, root: 41, chords: [0,7,9,5], victory: true, final: true },
  };
  const MELODY = [[0,4,7,12],[11,7,4,7],[7,11,14,11],[14,null,11,7],[9,12,16,12],[9,null,7,4],[5,9,12,9],[7,5,2,null]];
  function victoryStep(engine, T, st, t, sixteenth) {
    const beat=sixteenth*4, s=st%16, bar=Math.floor(st/16), R=T.root;
    if(bar===0) {                                   // 팡파르: 스네어 롤 위로 상승하는 금관, 박자 3에서 화음 폭발
      const run={0:0,2:4,4:7,6:12};
      if(s in run) engine.voice(R+12+run[s],t,beat*(s===6?1.4:.45),'brass',.06,(s/6-.5)*.4);
      if(s<8&&s%2===0) engine.drum(t,.12,true);
      if(s===8){[0,4,7].forEach((n,i)=>engine.voice(R+24+n,t,beat*1.9,'brass',.045,(i-1)*.4));engine.drum(t,.5);}
      return;
    }
    if(bar===1) {                                   // 팡파르 끝: 으뜸화음을 길게
      if(s===0){
        [0,4,7,12].forEach((n,i)=>engine.voice(R+12+n,t,beat*3.6,'brass',.04,(i-1.5)*.3));
        engine.voice(R-12,t,beat*3.8,'strings',.08);
        [0,7,12].forEach((n,i)=>engine.voice(R+12+n,t,beat*3.8,'choir',.02,(i-1)*.3));
        engine.drum(t,.55);
      }
      if(s===12) engine.drum(t,.2,true);
      return;
    }
    const b=(bar-2)%8, deg=T.chords[Math.floor(b/2)%4], root=R+deg, tri=deg===9?[0,3,7]:[0,4,7];
    if(s===0){
      engine.voice(root-12,t,beat*3.8,'strings',.07,-.12);
      tri.forEach((n,i)=>engine.voice(root+12+n,t,beat*3.7,'strings',.022,(i-1)*.55));
      if(b%2===0) tri.forEach((n,i)=>engine.voice(root+12+n,t,beat*7.3,'choir',T.final?.026:.016,(i-1)*.3));
      engine.drum(t,T.final?.26:.34);
    }
    if(s===8) engine.drum(t,T.final?.14:.22,true);
    if(s%4===2) engine.voice(root+12+tri[(s>>2)%3],t,beat*.5,'strings',.02,s%8===2?-.3:.3);
    if(s%4===0){const n=MELODY[b][s/4]; if(n!==null) engine.voice(R+24+n,t,beat*(T.final?1.4:.9),'brass',.04,-.05);}
  }
  function step(engine, T, st, t, sixteenth) {
    if(T.victory) return victoryStep(engine, T, st, t, sixteenth);
    const bar=Math.floor(st/16)%16,s=st%16,beat=sixteenth*4,root=T.root+T.chords[Math.floor(bar/2)%4];
    const lift=bar>=8?1.12:.9;
    if(s===0){
      engine.voice(root-12,t,beat*3.8,'strings',.075*lift,-.12);
      [0,3,7].forEach((n,i)=>engine.voice(root+12+n,t,beat*3.7,'strings',.024*lift,(i-1)*.55));
      if(bar%2===0) [0,7,12].forEach((n,i)=>engine.voice(root+12+n,t,beat*7.3,'choir',T.boss?.022:.017,(i-1)*.3));
      engine.drum(t,T.boss?.52:.36);
    }
    if(s===8 || (T.boss && [6,11,14].includes(s))) engine.drum(t,s===8?.3:.16,true);
    if(T.boss && bar%4===3 && s===15) engine.drum(t,.13,true);
    if(s%(T.boss?2:4)===0){
      const figure=T.boss?[0,7,0,3,0,7,1,7]:[0,7,3,7];
      engine.voice(root+figure[Math.floor(s/(T.boss?2:4))],t,beat*(T.boss?.33:.6),'strings',T.boss?.045:.028,s%4?-.35:.35);
    }
    if(s===0 && (T.boss || bar%2===0)) {
      const note=T.root+12+T.motif[bar%4]+(bar>=8?12:0);
      engine.voice(note,t,beat*(T.boss?2.6:5.6),'brass',T.boss?.052:.034,-.08);
    }
    if(T.boss && s===10 && bar%2) engine.voice(T.root+12+T.motif[(bar+1)%4],t,beat*1.2,'brass',.038,.16);
  }
  global.SCORE={ tracks, victory, create, step };
})(window);
