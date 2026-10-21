'use strict';
// 흑월의 갑주왕 (boss5, v1.38). All ticks are 60 Hz; distances are world px (Barel = 102.24).
// Source: docs/boss5_sovereign.md. Body + two independent gauntlet actors (fistF / fistB).
const SOVEREIGN_RULES = {
  hp:[2400,3000], fistHp:[140,180], fistKdMul:1.5, fistGroggy:40,
  walk:[[.75,.45],[1.05,.6]], fistSpeed:[1,1.2], recover:[40,30], fallen:[480,360],
  gaps:[[30,50],[14,28]], maxPatterns:[1,2], safeGap:20,
  near:110, mid:260,
  home:{F:{dx:75,h:85}, B:{dx:-80,h:100}, bob:6, bobPeriod:120},
  fistBox:{w:26, h:22, depth:16},
  intro:210, introFists:{drawing:13, fall:40},
  kneelIn:40, awaken:210, awakenShake:7, death:96, deathHold:50, ultimateKneel:120,
  pressure:[3,2],
  names:{strike:'직격',slam:'추적 내려찍기',hammer:'망치질',grab:'붙잡기',clap:'협공',wave:'지면 파동',
    bulwark:'철벽',whirl:'회오리',backhand:'손등 치기',meteor:'유성 낙하',ultimate:'흑월 강림',beam:'투구 광선'},
  // Fists the pattern needs (2 = both). 0 = body only.
  fists:{strike:1,slam:1,hammer:1,grab:1,clap:2,wave:2,bulwark:2,whirl:2,backhand:1,meteor:2,ultimate:2,beam:0},
  floor:['slam','hammer','meteor'],
  // 2-4 exceptions are internal to these patterns; the scheduler still spaces patterns apart.
  cooldowns:{strike:120,slam:180,hammer:360,grab:300,clap:300,wave:360,bulwark:600,whirl:420,beam:300,meteor:900,ultimate:900,backhand:0},
  // [first judgment tick, last judgment tick] after start, used by the 20-tick scheduler.
  danger:{strike:[24,175],slam:[110,116],hammer:[36,112],grab:[30,130],clap:[54,62],wave:[36,150],
    bulwark:null,whirl:[24,144],backhand:[10,20],meteor:[66,130],ultimate:[90,290],beam:[30,80]},
  weights:[{
    near:{clap:20,grab:20,whirl:15,bulwark:15,strike:15,beam:15},
    mid:{strike:30,slam:25,grab:15,hammer:15,beam:15},
    far:{strike:30,slam:30,beam:25,wave:15}
  },{
    near:{clap:20,whirl:20,grab:15,bulwark:10,hammer:15,beam:10,meteor:10},
    mid:{strike:25,slam:20,hammer:15,meteor:15,beam:15,wave:10},
    far:{strike:25,slam:20,meteor:20,beam:20,wave:15}
  }],
  command:{ticks:32, push:['strike','grab','clap','whirl','backhand','bulwark'], lift:['slam','hammer','wave','meteor']},
  strike:{warn:24, lock:16, speed:9, range:420, back:7, h:62, damage:14, backDamage:8},
  slam:{rise:20, h:200, track:[60,50], trackX:2.5, trackY:1.5, lock:[24,20], fall:6, active:6, rx:45, ry:18, stuck:50, damage:16},
  hammer:{hits:3, wait:30, h:120, fall:6, active:4, rx:45, ry:18, stuck:40, damage:[12,12,14]},
  grab:{warn:30, lock:20, speed:8, range:360, h:50, presses:8, hold:50, stun:60, fistDamage:30, squeeze:18, backhand:10},
  clap:{move:30, side:110, h:80, warn:24, close:8, stuck:40, low:20, high:170, damage:16},
  wave:{rise:30, h:220, fall:6, speed:6, height:20, stuck:40, damage:12},
  bulwark:{hold:90, open:40},
  whirl:{warn:24, ticks:120, turns:2, rx:130, ry:30, h:95, low:30, high:160, open:50, damage:12, push:7},
  backhand:{warn:10, swing:10, reach:95, damage:10, push:9},
  meteor:{rise:30, marks:4, every:20, delay:36, fall:6, active:4, rx:45, ry:20, stuck:60, damage:16},
  ultimate:{hpGate:.35, merge:60, hover:30, speed:10, low:0, high:50, halfWidth:52, damage:23},
  beam:{charge:30, lock:20, fire:[40,50], depth:14, low:40, high:120, recover:36, damage:14},
};
const SOVEREIGN_PATTERNS = Object.keys(SOVEREIGN_RULES.names);
