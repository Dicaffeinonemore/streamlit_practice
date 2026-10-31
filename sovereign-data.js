'use strict';
// v1.38 흑월의 군주, 소버린 (The Black Moon Sovereign). Body + two independent fists.
// All ticks are 60 Hz; distances, heights and speeds are world px (per tick).
const SOVEREIGN_RULES = {
  hp:[2400,3000], hw:24, walk:[[.75,.45],[1.05,.6]], gaps:[[30,50],[14,28]], attackDelay:90, bands:{near:110,mid:260},
  names:{direct:'직격',slam:'추적 내려찍기',hammer:'망치질',grab:'붙잡기',clap:'협공',wave:'지면 파동',wall:'철벽',
    whirl:'회오리',backhand:'손등 치기',meteor:'유성 낙하',ultimate:'적월마광포',beam:'투구 광선'},
  cooldowns:{direct:120,slam:180,hammer:360,grab:300,clap:300,wave:360,wall:600,whirl:420,beam:300,meteor:900,ultimate:900,backhand:0},
  weights:[{
    near:{clap:20,grab:20,whirl:15,wall:15,direct:15,beam:15},
    mid:{direct:30,slam:25,grab:15,hammer:15,beam:15},
    far:{direct:30,slam:30,beam:25,wave:15}
  },{
    near:{clap:20,whirl:20,grab:15,wall:10,hammer:15,beam:10,meteor:10},
    mid:{direct:25,slam:20,hammer:15,meteor:15,beam:15,wave:10},
    far:{direct:25,slam:20,meteor:20,beam:20,wave:15}
  }],
  // Fists a pattern needs at home; 0 = body only.
  fists:{direct:1,slam:1,hammer:1,grab:1,backhand:1,clap:2,wave:2,wall:2,whirl:2,meteor:2,ultimate:2,beam:0},
  floor:['slam','hammer','meteor'],
  // Patterns allowed to overlap their own hit windows (two fists together).
  together:['clap','wave','whirl','meteor','ultimate'],
  // Body stays in its pattern pose for the whole job (others release it after the command pose).
  bodyBound:['wall','whirl','ultimate','beam'],
  maxJobs:[1,2], dangerGap:20, pendingTicks:90, recover:[40,30], fistSpeed:[1,1.2], ultimateAt:.35, ultimateLater:15,
  home:{front:[75,85],back:[-80,100],bob:3,period:180,speed:4},
  afterimage:{life:18,interval:3,max:6,minDistance:2,alpha:.22},
  fistHp:[140,180], kdFistMul:1.5, fistGroggy:40, fallen:[480,360], rise:30, pressure:[3,2], pressureDecay:120,
  fistDrops:{potion:.25,scroll:.15},
  intro:200, introFistDrawing:13, introFistDrop:40, kneelDown:40, awaken:210, awakenShakeDrawing:7, death:110, deathHold:60,
  command:24,
  direct:{wind:24,lock:16,speed:9,range:420,back:7,damage:14,backDamage:8},
  slam:{rise:20,height:200,track:[60,50],dx:2.5,dy:1.5,lock:[24,20],fall:6,active:6,rx:45,ry:18,stuck:50,damage:16},
  hammer:{rise:12,height:150,count:3,delay:30,fall:6,active:4,rx:45,ry:18,stuck:40,damage:[12,12,14]},
  grab:{wind:30,lock:22,speed:8,range:420,stagger:60,escapeDamage:30,squeeze:18,backhand:10},
  clap:{move:30,offset:110,height:80,warn:24,close:8,stuck:40,low:20,high:170,damage:16},
  wave:{rise:30,height:220,fall:6,speed:6,top:20,stuck:40,damage:12},
  wall:{move:16,guard:90,open:40},
  whirl:{warn:24,spin:120,turns:2,rx:130,ry:30,height:70,low:30,high:160,dazed:50,damage:12,push:7},
  backhand:{warn:10,swing:12,damage:10,push:9},
  meteor:{rise:30,height:420,interval:20,count:4,delay:36,fall:8,active:4,rx:45,ry:20,stuck:60,damage:16},
  // 1.0s hand charge + 0.5s laser startup = 1.5s until the active beam.
  ultimate:{count:[10,13],fadeMs:200,telegraphMs:600,chargedMs:200,laserFps:16,
    handScale:.45,laserHeight:94,laserThickness:22,margin:20,minYGap:65,damage:23,debug:false,
    handOrigin:[220,120],laserOrigins:[[88,110],[80,110],[77,110],[75,110],[68,110],[59,110],[47,110],[42,110],
      [55,112],[53,112],[48,112],[43,112],[53,112],[50,112],[48,112],[44,112],[50,112],[48,112],[45,112],[42,112]],
    laserEnds:[252,287,291,297,351,373,384,365,383,379,384,366,383,379,384,357,369,368,384,335]},
  beam:{charge:30,lock:20,fire:[40,50],recovery:36,depth:14,low:40,high:120,damage:14,neckLength:20,neckHalfHeight:3}
};
const SOVEREIGN_ATTACKS = Object.keys(SOVEREIGN_RULES.names);
// Tick of the first hit window after a pattern starts; the scheduler uses it
// to keep 20 ticks between the previous hit window and the next one.
function sovereignFirstHit(id, p2) {
  const R = SOVEREIGN_RULES, s = R.slam;
  return { direct:R.direct.wind, slam:s.rise+s.track[p2?1:0]+s.lock[p2?1:0], hammer:R.hammer.rise+R.hammer.delay,
    grab:R.grab.wind, clap:R.clap.move+R.clap.warn, wave:R.wave.rise, wall:Infinity, whirl:R.whirl.warn,
    backhand:R.backhand.warn, meteor:R.meteor.rise+R.meteor.delay-R.meteor.fall,
    ultimate:Math.ceil((R.ultimate.fadeMs+R.ultimate.telegraphMs+R.ultimate.chargedMs+8000/R.ultimate.laserFps)/(1000/60)),
    beam:R.beam.charge }[id];
}
