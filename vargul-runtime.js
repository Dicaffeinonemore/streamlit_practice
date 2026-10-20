'use strict';
// One flag selects the complete replacement. Legacy boss4 code/art stays intact.
const USE_VARGUL_V136=globalThis.VARGUL_V136_OVERRIDE!==false;
const VARGUL_SHEETS=USE_VARGUL_V136?VARGUL_ART.sheets.map(src=>{const im=new Image();im.src=src;return im;}):[];
const VARGUL_READY=Promise.all(VARGUL_SHEETS.map(im=>im.decode()));
VARGUL_READY.catch(()=>{});
const VARGUL_DEBUG=globalThis.VARGUL_DEBUG_OVERRIDE===true||new URLSearchParams(location.search).get('debug')==='1';
let vargulDebug=false,vargulDebugMove=0,vargulRepeat=null,vargulRemains=[];
function isVargul(e){return USE_VARGUL_V136&&e?.type==='boss4';}
function vargulData(e){return e.vargul||={cooldowns:{},pressure:0,forceSweep:false,repeats:0,lastMove:null,token:0,stats:{runs:[],hits:[],events:[]}};}
function vargulHazards(e,kind){return hazards.filter(z=>z.type==='vargul'&&z.owner===e&&!z.dead&&(!kind||z.kind===kind));}
function clearVargulHazards(e){for(const z of vargulHazards(e))z.dead=true;}
function vargulWarningTicks(e,n){return e.p2shown?Math.round(n*.85):n;}
function vargulAttackGap(e){const [a,b]=VARGUL_RULES.gaps[e.p2shown?1:0];return Math.round(rand(a,b));}
function vargulPunishable(e){return e.st==='pat'&&e.vargul?.current?.phase==='R';}
function vargulArmored(e){return isVargul(e)&&e.st==='pat'&&!!e.vargul?.current?.armor;}
function interceptVargulDamage(e){
  if(e.st==='intro'||e.phaseT>0||e.invuln||e.st==='dead')return true;
  const a=vargulData(e);
  if(!vargulPunishable(e)&&e.st!=='stun'&&e.st!=='down'){
    a.pressure++;if(a.pressure>=(e.p2shown?2:3))a.forceSweep=true;
  }
  return false;
}
function resetVargulPattern(e){
  if(!isVargul(e))return;
  const a=vargulData(e);
  if(a.run&&!a.run.finished){a.run.interrupted=true;a.run.finished=true;a.run.ticks=a.cursor||0;}
  a.move=null;a.current=null;a.timeline=null;e.z=0;
  // Placed sword/cross warnings survive interruption. Future placements belong
  // to the abandoned timeline and can no longer be emitted.
}
function initVargulPattern(e){
  const a=vargulData(e),id=e.pat,def=VARGUL_TIMELINES[e.p2shown?1:0][id];
  if(!def){endPat(e);return;}
  a.move=id;a.timeline=def.timeline;a.cursor=0;a.processed=-1;a.current=def.timeline[0];a.hitIds=new Set();
  a.token++;a.repeats=a.lastMove===id?a.repeats+1:1;a.lastMove=id;
  if(id!=='orb')a.cooldowns[id]=VARGUL_RULES.cooldowns[id];
  if(id==='sweep'){a.forceSweep=false;a.pressure=0;}
  a.travel=0;a.lockedY=null;a.ultimate=null;
  if(id==='sweep'&&a.sweepFace){e.face=a.sweepFace;a.sweepFace=null;}
  a.run={id,phase:e.p2shown?2:1,token:a.token,ticks:0,drawings:[],active:[],events:[],recovery:0,finished:false};
  a.stats.runs.push(a.run);
  if(a.stats.runs.length>100)a.stats.runs.shift();
  e.invuln=false;
}
function pickVargulPattern(e,dx,dy){
  const a=vargulData(e);
  if(VARGUL_DEBUG&&vargulRepeat&&VARGUL_TIMELINES[e.p2shown?1:0][vargulRepeat]){
    if(vargulRepeat==='orb'&&vargulHazards(e,'orb').length)return null;
    if(['sword','cross'].includes(vargulRepeat)&&vargulFloorBusy(e))return null;
    return vargulRepeat;
  }
  if(e.p2shown&&e.hp<=e.max*.35&&!a.cooldowns.ultimate&&!a.ultimateUsed)return 'ultimate';
  if(a.forceSweep&&(a.lastMove!=='sweep'||a.repeats<2))return 'sweep';
  const band=dx<200*.5112*.8?'near':dx<200*.5112*2?'mid':'far';
  const options=Object.entries(VARGUL_RULES.weights[e.p2shown?1:0][band]).filter(([id])=>
    !a.cooldowns[id]&&!(a.lastMove===id&&a.repeats>=2)&&
    !(['cross','sword'].includes(id)&&vargulFloorBusy(e))&&!(id==='orb'&&vargulHazards(e,'orb').length));
  // The first ultimate is immediate; later uses participate at every distance.
  if(e.p2shown&&a.ultimateUsed&&!a.cooldowns.ultimate&&!(a.lastMove==='ultimate'&&a.repeats>=2))options.push(['ultimate',15]);
  if(!options.length)return null;
  let r=Math.random()*options.reduce((s,[,w])=>s+w,0),id=options.at(-1)[0];
  for(const [choice,w] of options)if((r-=w)<0){id=choice;break;}
  if(id==='back_off'||id==='approach'){a.locomotion=id;a.locomotionTicks=24;return null;}
  if(['combo','sweep'].includes(id)&&dy>26)return null;
  return id;
}
function vargulFloorBusy(e){return vargulHazards(e).some(z=>['sword','cross'].includes(z.kind));}
function vargulCrossHorizontalBounds(){return [camX,camX+VW];}
function chaseVargul(e){
  const a=vargulData(e),p=player,dx=p.x-e.x,dy=p.y-e.y;
  if(p.st==='dead')return;
  if(e.atkCd<=0&&p.st!=='down'){
    const ultimateDue=e.p2shown&&e.hp<=e.max*.35&&!a.ultimateUsed&&!a.cooldowns.ultimate;
    if(!vargulRepeat&&!ultimateDue&&dx*e.face<0&&Math.abs(dx)<200*.5112*.8&&Math.abs(dy)<26&&!a.cooldowns.sweep&&!(a.lastMove==='sweep'&&a.repeats>=2)){
      a.sweepFace=e.face;startPat(e,'sweep');return;
    }
    const id=pickVargulPattern(e,Math.abs(dx),Math.abs(dy));
    if(id){startPat(e,id);return;}e.atkCd=6;
  }
  e.face=dx>=0?1:-1;
  const [sx,sy]=VARGUL_RULES.walk[e.p2shown?1:0],away=a.locomotion==='back_off'&&a.locomotionTicks>0;
  const target=away?e.x-e.face*40:p.x-e.face*55;
  e.x+=clamp(target-e.x,-sx*.5112,sx*.5112);
  e.y+=clamp(dy,-sy*.5112,sy*.5112);e.walk=Math.abs(target-e.x)>2||Math.abs(dy)>2;
  if(a.locomotionTicks>0)a.locomotionTicks--;
}
function spawnVargul(e,kind,x=e.x,y=e.y,h=0,extra={}){
  const a=vargulData(e),z={type:'vargul',kind,owner:e,x,y,h,face:e.face,age:-MS,
    damageScale:e.p2shown?1.3:1,bornElapsed:Math.max(0,a.processed??0),castToken:a.token,castRun:a.run,...extra};
  hazards.push(z);return z;
}
function vargulFx(e,fx,x=e.x,y=e.y,h=0,extra={}){return spawnVargul(e,'fx',x,y,h,{fx,life:32,...extra});}
function vargulLogEvent(e,type){
  const a=vargulData(e),ev={type,elapsed:Math.max(0,a.processed??0)};
  a.run?.events.push(ev);a.stats.events.push(ev);if(a.stats.events.length>300)a.stats.events.shift();
}
function vargulEvent(e,event){
  const a=vargulData(e),k=.5112;vargulLogEvent(e,event.type);
  if(event.type==='sword_mark'){
    spawnVargul(e,'sword',player.x,player.y,0,{wait:vargulWarningTicks(e,45),active:6});
  }else if(event.type==='cross_mark'){
    spawnVargul(e,'cross',player.x,player.y,0,{wait:vargulWarningTicks(e,60),active:18});
  }else if(event.type==='orbs'){
    if(vargulHazards(e,'orb').length)return;
    const r=VARGUL_RULES.orb;
    a.hadOrbs=true;
    for(let i=0;i<2;i++)spawnVargul(e,'orb',clamp(e.x+(i?1:-1)*40,camX+24,camX+VW-24),e.y,r.height,
      {entityKind:'summon',index:i,hp:r.hp,maxHp:r.hp,inv:0,flash:0,vx:0,vy:0,ai:'approach',
        shotCooldown:r.interval[e.p2shown?1:0]*(i+1)/2});
  }else if(event.type==='turn'){
    e.face*=-1;a.travel=0;a.lockedY=null;
  }else if(event.type==='ultimate_mark'){
    a.ultimate=spawnVargul(e,'ultimate',player.x,player.y,0,{stage:'tracking',life:116,hit:false,impactAge:null});a.ultimateUsed=true;
  }else if(event.type==='ultimate_lock'){
    if(a.ultimate)a.ultimate.stage='fixed';
  }else if(event.type==='ultimate_fall'){
    if(a.ultimate)a.ultimate.stage='fall';
  }else if(event.type==='ultimate_impact'){
    if(a.ultimate){a.ultimate.stage='impact';a.ultimate.impactAge=a.ultimate.age/MS;}
    shake=Math.max(shake,24);sfx('land');
  }else if(event.type==='ultimate_land'){
    const mark=a.ultimate;
    if(mark){e.x=clamp(mark.x-e.face*55,camX+28,camX+VW-28);e.y=clamp(mark.y-18,GTOP+10,GBOT);}
    e.z=0;sfx('land');
  }
}
function vargulAttackBox(e,t){
  const geometry=VARGUL_MEASUREMENTS[t.clip][t.drawing-1];
  return t.attack?.body?geometry.body:geometry.attack;
}
function vargulBoxHit(e,box,depth,oldX=e.x){
  const [x,h,w,height]=box,p=player;
  const left=Math.min(e.x,oldX)+Math.min(x*e.face,(x+w)*e.face);
  const right=Math.max(e.x,oldX)+Math.max(x*e.face,(x+w)*e.face);
  return p.x+12>=left&&p.x-12<=right&&Math.abs(p.y-e.y)<depth&&p.z+90>=e.z+h&&p.z<=e.z+h+height;
}
function vargulHurt(e,attack,source=e){
  const before=player.hp,hit=hurtPlayer(attack.damage,Math.sign(player.x-source.x)||source.face||e.face,!!attack.knockdown,source);
  if(hit){const a=vargulData(e);a.stats.hits.push({id:a.move,elapsed:a.cursor,base:attack.damage,damage:before-player.hp});if(a.stats.hits.length>200)a.stats.hits.shift();}
  return hit;
}
function runVargulPattern(e){
  const a=vargulData(e);if(!a.timeline)initVargulPattern(e);
  const target=Math.floor(e.pt/MS+1e-6)-1;
  while(a.timeline&&a.processed<target&&e.st==='pat'){
    a.processed++;const t=a.timeline[a.cursor];
    if(!t){finishVargulPattern(e);return;}
    a.current=t;e.invuln=!!t.hidden;
    const oldX=e.x;
    for(const event of t.events||[])vargulEvent(e,event);
    if(t.align){
      if(t.first){a.lockedY=null;a.travel=0;}
      if(t.local<t.lockAt)e.y+=clamp(player.y-e.y,-VARGUL_RULES.walk[e.p2shown?1:0][1]*.5112,VARGUL_RULES.walk[e.p2shown?1:0][1]*.5112);
      if(t.local===t.lockAt-1){a.lockedY=player.y;vargulLogEvent(e,'dash_lock');}
      if(a.lockedY!==null)e.y+=(a.lockedY-e.y)/Math.max(1,t.segmentTicks-t.local);
    }
    let stopTravel=false;
    if(t.travel){
      const step=Math.min(14*.5112,520*.5112-a.travel),next=clamp(e.x+e.face*step,camX+20,camX+VW-20);
      a.travel+=Math.abs(next-e.x);e.x=next;
      stopTravel=a.travel>=520*.5112-.001||next===camX+20||next===camX+VW-20;
      if(t.local%4===0)vargulFx(e,'dash_frost',e.x-e.face*25,e.y,25,{life:14,face:e.face,width:90,height:48});
    }
    if(a.move==='ultimate'){
      const f=a.cursor;
      if(f<45&&f>=vargulWarningTicks(e,30))e.z=(f-vargulWarningTicks(e,30))/(45-vargulWarningTicks(e,30))*240;
      if(f>=45&&f<160)e.z=0;
    }
    if(t.attack){
      if(t.first){a.run.active.push({id:t.attack.id,elapsed:a.processed,drawing:t.drawing});sfx('swing');}
      if(!a.hitIds.has(t.attack.id)&&vargulBoxHit(e,vargulAttackBox(e,t),t.attack.depth,oldX)&&vargulHurt(e,t.attack))a.hitIds.add(t.attack.id);
      if(t.attack.id.startsWith('combo')&&t.first){const tip=VARGUL_MEASUREMENTS[t.clip][t.drawing-1].tip;vargulFx(e,'spear_flash',e.x+e.face*tip[0],e.y,tip[1],{life:10,width:50,height:28});}
    }
    const previous=a.run.drawings.at(-1);
    if(previous&&previous.drawing===t.drawing&&previous.phase===t.phase&&previous.label===t.label){previous.end=a.processed;previous.ticks++;}
    else a.run.drawings.push({drawing:t.drawing,phase:t.phase,label:t.label,start:a.processed,end:a.processed,ticks:1});
    if(t.phase==='R')a.run.recovery++;
    a.cursor++;a.run.ticks=a.processed+1;
    if(stopTravel){while(a.timeline[a.cursor]?.travel)a.cursor++;}
    if(a.cursor>=a.timeline.length){finishVargulPattern(e);return;}
  }
}
function finishVargulPattern(e){
  const a=vargulData(e);if(a.run){a.run.finished=true;a.run.interrupted=false;a.run.timelineTicks=a.cursor;}
  endPat(e);
}
function beginVargulTransition(e){
  const a=vargulData(e);resetBossFx(e);clearVargulHazards(e);
  e.hp=0;e.phaseT=VARGUL_RULES.down+VARGUL_RULES.awaken+VARGUL_RULES.crossfade;
  a.transitionAge=0;a.transitionEvents=[];e.st='rec';e.t=0;e.z=e.vz=e.vx=0;e.invuln=true;e.gr=0;e.grT=0;
  player.inv=Math.max(player.inv,90);sfx('land');
}
function updateVargulState(e){
  if(!isVargul(e))return false;
  const a=vargulData(e);
  for(const id in a.cooldowns)if(a.cooldowns[id]>0)a.cooldowns[id]--;
  updateVargulOrbs(e);
  if(e.phaseT>0){
    const age=a.transitionAge,awake=age-VARGUL_RULES.down;
    e.walk=false;e.invuln=true;e.flash=0;
    if(awake===Math.ceil(3*VARGUL_RULES.awaken/8)){
      vargulFx(e,'frost_burst',e.x,e.y,64,{life:36,width:155,height:130});
      for(let i=0;i<5;i++)vargulFx(e,'ice_shard',e.x+(i-2)*17,e.y,64,{life:28,width:38,height:36});
      shake=Math.max(shake,18);sfx('phase2');a.transitionEvents.push({type:'d8_burst',age,drawing:4});
    }
    if(awake===Math.ceil(7*VARGUL_RULES.awaken/8)){
      vargulFx(e,'cross_eruption',e.x,e.y,0,{life:36,width:150,height:48});a.transitionEvents.push({type:'floor_ring',age,drawing:8});
    }
    a.transitionAge++;e.phaseT--;
    if(!e.phaseT){
      e.p2shown=true;e.max=e.hp=2500;e.nextKd=e.max*.75;e.gr=0;e.grT=0;e.invuln=false;
      e.st='chase';e.atkCd=vargulAttackGap(e);a.pressure=0;a.forceSweep=false;a.ultimateUsed=false;
      floatText(e.x,e.y-170,'2 페이즈','#b9eaff');a.phaseBanner=90;
    }
    return true;
  }
  if(a.phaseBanner>0)a.phaseBanner--;
  if(e.st==='dead'){
    e.t++;e.invuln=true;
    if(e.t===42){vargulFx(e,'frost_burst',e.x,e.y,45,{life:30,width:120,height:100});sfx('land');}
    if(e.t>=VARGUL_RULES.death+VARGUL_RULES.deathHold){
      if(!a.remains){vargulRemains.push({x:e.x,y:e.y,face:e.face});a.remains=true;}e.remove=true;
    }
    return true;
  }
  const pose=vargulPose(e),body=VARGUL_MEASUREMENTS[pose.clip]?.[pose.drawing-1]?.body;
  if(body)e.hw=body[2]/2;
  if(e.st!=='pat')e.invuln=false;
  return false;
}
function vargulPose(e){
  const a=vargulData(e),p=e.p2shown?'p2_':'p1_';
  const pose=(clip,progress)=>({clip,drawing:Math.min(VARGUL_ART.clips[clip].length,Math.max(1,1+Math.floor(progress*VARGUL_ART.clips[clip].length)))});
  if(e.phaseT>0){const t=a.transitionAge;
    if(t<VARGUL_RULES.down)return pose('p1_knockdown',t/VARGUL_RULES.down);
    return pose('awaken',Math.min(.999,(t-VARGUL_RULES.down)/VARGUL_RULES.awaken));
  }
  if(e.st==='intro')return pose('p1_intro',introT/MS/VARGUL_RULES.intro);
  if(e.st==='dead')return pose('death',Math.min(.999,e.t/VARGUL_RULES.death));
  if(e.st==='down')return pose(p+'knockdown',Math.min(.999,e.t/61));
  if(e.st==='stun')return pose(p+'knockdown',.5);
  if(e.st==='hurt'){
    const clip=p+'hurt',count=VARGUL_ART.clips[clip].length,half=count/2;
    return {clip,drawing:Math.min(count,(e.hheavy?half:0)+1+Math.min(half-1,Math.floor(e.t/11*half)))};
  }
  if(e.st==='pat'&&a.current)return {clip:a.current.clip,drawing:a.current.drawing,hidden:a.current.hidden};
  const clip=p+(e.walk?'walk':'idle');return {clip,drawing:1+Math.floor(tick/(e.walk?6:9))%VARGUL_ART.clips[clip].length};
}
function vargulIntroDuration(e){return isVargul(e)?VARGUL_RULES.intro*MS:aurelionIntroDuration(e);}
function updateVargulIntro(e){
  const a=vargulData(e),f=Math.floor(introT/MS+1e-6);
  e.z=0;
  // The supplied throne first breaks on drawing 11; align debris to that art.
  if(f>=120&&!a.introBreak){a.introBreak=true;shake=Math.max(shake,16);sfx('land');
    vargulFx(e,'frost_burst',e.x,e.y,22,{life:40,width:135,height:115});
    for(let i=0;i<5;i++)vargulFx(e,'ice_shard',e.x+(i-2)*20,e.y,15+i%2*20,{life:36,width:30,height:45});
  }
  for(const z of vargulHazards(e))z.age+=MS;
  for(const z of vargulHazards(e,'fx'))if(z.age/MS>=z.life)z.dead=true;
}
function updateVargulOrbs(e){
  const a=vargulData(e),orbs=vargulHazards(e,'orb');
  if(!orbs.length){
    if(a.hadOrbs){a.cooldowns.orb=720;a.hadOrbs=false;}return;
  }
  a.hadOrbs=true;
  if(e.st==='dead'||e.phaseT>0){clearVargulHazards(e);return;}
}
function moveVargulOrb(z,t){
  const r=VARGUL_RULES.orb,p=player,dx=p.x-z.x,distance=Math.abs(dx),side=Math.sign(dx)||(z.index?1:-1);
  z.ai=distance>r.range+r.rangeSlack?'approach':distance<r.range-r.rangeSlack?'retreat':'strafe';
  const drift=Math.sin(t/r.driftPeriod*Math.PI*2+z.index*Math.PI);
  let vx=z.ai==='approach'?side*r.speed:z.ai==='retreat'?-side*r.speed:drift*r.speed*.3;
  let vy=clamp((p.y+(z.index?1:-1)*26+drift*16-z.y)*.04,-r.depthSpeed,r.depthSpeed);
  // Independent steering and separation: neither position is attached to the player.
  for(const other of vargulHazards(z.owner,'orb'))if(other!==z){
    const sx=z.x-other.x,sy=z.y-other.y;
    if(Math.abs(sx)<38&&Math.abs(sy)<26){vx+=Math.sign(sx)||(z.index?1:-1);vy+=(Math.sign(sy)||(z.index?1:-1))*.3;}
  }
  if(z.flash>0){vx*=.25;vy*=.25;}
  z.vx=(z.vx||0)+clamp(vx-(z.vx||0),-r.accel,r.accel);
  z.vy=(z.vy||0)+clamp(vy-(z.vy||0),-r.accel,r.accel);
  z.x=clamp(z.x+clamp(z.vx,-r.speed,r.speed),camX+24,camX+VW-24);
  z.y=clamp(z.y+clamp(z.vy,-r.depthSpeed,r.depthSpeed),GTOP+14,GBOT-12);
  z.h=r.height+Math.sin(t/24+z.index*Math.PI)*r.bob;
}
function vargulBreakOrb(z,destroyed=false){
  if(z.dead)return;z.dead=true;
  vargulFx(z.owner,'frost_burst',z.x,z.y,z.h,{life:18,width:45,height:45});
  if(destroyed){
    const e=z.owner;e.gr=Math.min(e.grMax,e.gr+VARGUL_RULES.orb.groggy);e.grT=150;hitStop=Math.max(hitStop,3);sfx('hit');
    if(e.gr>=e.grMax&&e.st!=='dead'&&!e.phaseT){resetBossFx(e);e.st='stun';e.t=0;e.z=e.vz=e.vx=0;shake=Math.max(shake,16);sfx('groggy');}
  }
  if(!vargulHazards(z.owner,'orb').length){const a=vargulData(z.owner);a.cooldowns.orb=720;a.hadOrbs=false;}
}
// Every caller supplies a persistent Set per actual strike, not per update tick.
function strikeVargulOrbs(reach,behind=8,hitSet=player.hitSet,options={}){
  const p=player;
  if(!hitSet)return false;
  let hit=false;
  for(const z of hazards){
    if(z.type!=='vargul'||z.kind!=='orb'||z.dead||z.inv>0||hitSet.has(z))continue;
    const x=options.x??p.x,y=options.y??p.y,h=options.h??p.z,face=options.face??p.face,dx=(z.x-x)*face;
    const overlaps=options.global||dx>=-behind-12&&dx<=reach+12&&Math.abs(z.y-y)<(options.depth??20)&&Math.abs(z.h-(h+44))<45;
    if(!overlaps)continue;
    hitSet.add(z);z.hp=Math.max(0,z.hp-(options.damage??ATK.c1.dmg));z.inv=VARGUL_RULES.orb.inv;hit=true;
    if(z.hp<=0)vargulBreakOrb(z,true);else{sfx('hit');hitStop=Math.max(hitStop,2);}
  }
  return hit;
}
function updateVargulHazard(z){
  if(z.type!=='vargul')return false;
  if(z.dead)return true;
  const e=z.owner,t=Math.max(0,Math.floor(z.age/MS+1e-6)),a=vargulData(e),p=player;
  if(z.kind==='fx'){if(t>=z.life)z.dead=true;return true;}
  if(e.st==='dead'||e.phaseT>0){z.dead=true;return true;}
  if(z.kind==='sword'||z.kind==='cross'){
    if(t>=z.wait&&!z.boom){
      z.boom=true;const event={type:z.kind+'_active',elapsed:z.bornElapsed+t,token:z.castToken};
      z.castRun?.events.push(event);a.stats.events.push(event);if(a.stats.events.length>300)a.stats.events.shift();sfx('pillar');
    }
    if(t>=z.wait&&t<z.wait+z.active&&!z.hit){
      const d=VARGUL_RULES[z.kind],inside=z.kind==='sword'?
        ((p.x-z.x)/d.radius)**2+((p.y-z.y)/d.depth)**2<=1&&p.z<150*.5112:
        ((p.x>=camX&&p.x<=camX+VW&&Math.abs(p.y-z.y)<=d.depth)||Math.abs(p.x-z.x)<=d.column)&&p.z<=d.height;
      if(inside&&vargulHurt(e,{damage:d.damage,knockdown:z.kind==='cross'},z))z.hit=true;
    }
    if(t>=z.wait+z.active)z.dead=true;
  }else if(z.kind==='orb'){
    const r=VARGUL_RULES.orb;
    moveVargulOrb(z,t);
    if(z.inv>0)z.inv--;
    if(z.shotCooldown>0)z.shotCooldown--;
    if(z.flash>0&&--z.flash===0&&z.shotPending){
      z.shotPending=false;
      if(p.st!=='down'&&p.st!=='dead'){
        const count=e.p2shown?2:1;
        for(let i=0;i<count;i++){
          const dx=p.x-z.x,dy=p.y-z.y,dh=p.z+44-z.h,length=Math.hypot(dx,dy,dh)||1,s=VARGUL_RULES.shard.speed;
          // Two separate trajectories in phase 2; no homing after release.
          const offset=count===2?(i-.5)*.10:0,cos=Math.cos(offset),sin=Math.sin(offset);
          spawnVargul(e,'shard',z.x,z.y,z.h,{casterIndex:z.index,vx:(dx*cos-dy*sin)/length*s,vy:(dx*sin+dy*cos)/length*s,vh:dh/length*s,life:180});
        }
        sfx('bwave');
      }
    }
    if(!z.flash&&z.shotCooldown<=0&&p.st!=='down'&&p.st!=='dead'){
      z.flash=vargulWarningTicks(e,r.flash);z.shotPending=true;z.shotCooldown=r.interval[e.p2shown?1:0];
    }
  }else if(z.kind==='shard'){
    const old={x:z.x,y:z.y,h:z.h};z.x+=z.vx;z.y+=z.vy;z.h+=z.vh;
    const dx=z.x-old.x,dy=z.y-old.y,dh=z.h-old.h,length=dx*dx+dy*dy+dh*dh;
    const u=length?clamp(((p.x-old.x)*dx+(p.y-old.y)*dy+(p.z+44-old.h)*dh)/length,0,1):0;
    if(Math.abs(old.x+u*dx-p.x)<14&&Math.abs(old.y+u*dy-p.y)<14&&Math.abs(old.h+u*dh-(p.z+44))<32&&vargulHurt(e,{damage:8},z))z.dead=true;
    if(t>=180||z.x<camX-100||z.x>camX+VW+100||z.h<0)z.dead=true;
  }else if(z.kind==='ultimate'){
    if(z.stage==='tracking'){z.x=p.x;z.y=p.y;}
    if(z.stage==='impact'&&t-z.impactAge<8&&!z.hit){
      const u=VARGUL_RULES.ultimate,dx=p.x-z.x,dy=p.y-z.y;
      const center=(dx/u.rx)**2+(dy/u.ry)**2<=1&&p.z<200*.5112;
      const outer=!center&&(dx/u.outerX)**2+(dy/u.outerY)**2<=1&&p.z<=u.outerHeight;
      if((center||outer)&&vargulHurt(e,{damage:center?u.damage:u.outerDamage,knockdown:true},z))z.hit=true;
    }
    if(z.stage==='impact'&&t-z.impactAge>=24)z.dead=true;
  }
  return true;
}
function paintVargul(frame,x,y,face=1,alpha=1,k=VARGUL_ART.scale,add=false){
  const im=frame&&VARGUL_SHEETS[frame.sheet];if(!im?.naturalWidth)return false;
  const [sx,sy,w,h]=frame.atlas,[ax,ay]=frame.anchor,d=k/(VARGUL_ART.hd||1);   // atlas is HD x stored pixels
  ctx.save();ctx.translate(x-camX,y);ctx.scale(face,1);ctx.globalAlpha*=alpha;smoothFor(d);
  if(add)ctx.globalCompositeOperation='lighter';
  ctx.drawImage(im,sx,sy,w,h,-ax*k,-ay*k,w*d,h*d);ctx.restore();return true;
}
function paintVargulFx(id,progress,x,y,width,height,alpha=1,face=1){
  const frames=VARGUL_ART.clips['fx_'+id+'_add'];if(!frames)return;
  const f=frames[Math.min(frames.length-1,Math.max(0,Math.floor(progress*frames.length)))],im=VARGUL_SHEETS[f.sheet];if(!im?.naturalWidth)return;
  const [sx,sy,w,h]=f.atlas;
  ctx.save();ctx.globalCompositeOperation='lighter';ctx.globalAlpha*=alpha;ctx.translate(x-camX,y);ctx.scale(face,1);smoothFor(height/h);
  ctx.drawImage(im,sx,sy,w,h,-width/2,-height,width,height);ctx.restore();
}
function paintVargulCrossWarning(progress,z,alpha){
  const height=480*.5112*.35,depth=VARGUL_RULES.cross.depth;
  // Render-time clips reuse the frozen atlas. No source pixels are reprocessed.
  ctx.save();ctx.beginPath();ctx.rect(0,z.y-depth,VW,depth*2);ctx.clip();
  paintVargulFx('cross_warning',progress,camX+VW/2,z.y+height/2,VW,height,alpha);ctx.restore();
  ctx.save();ctx.beginPath();ctx.rect(0,z.y-height/2,VW,height/2-depth);ctx.rect(0,z.y+depth,VW,height/2-depth);ctx.clip();
  paintVargulFx('cross_warning',progress,z.x,z.y+height/2,480*.5112,height,alpha);ctx.restore();
}
function vargulTelegraph(e){const t=e.vargul?.current;return e.st==='pat'&&t?{warning:!!t.warning,white:!!t.white}:null;}
function vargulAuraVisible(e){return e.p2shown&&!e.phaseT&&!['down','stun','dead','intro'].includes(e.st)&&!e.vargul?.current?.hidden;}
function drawVargul(e){
  if(!isVargul(e))return false;
  const a=vargulData(e),pose=vargulPose(e),frame=VARGUL_ART.clips[pose.clip]?.[pose.drawing-1];
  if(pose.hidden)return true;
  if(!VARGUL_SHEETS[frame?.sheet]?.naturalWidth)return false;
  drawShadow(e.x-camX,e.y,SPRITES.boss4.sh,e.z);
  if(vargulAuraVisible(e))paintVargulFx('frost_aura',(tick%96)/96,e.x,e.y,150,170,.38);
  ctx.save();const tele=vargulTelegraph(e);
  if(e.flash>0&&UX.options.flash)ctx.filter='brightness(1.8)';
  else if(tele?.white&&UX.options.flash&&Math.floor(e.pt/90)%2===0)ctx.filter='brightness(2)';
  const crossfade=e.phaseT>0&&a.transitionAge>=VARGUL_RULES.down+VARGUL_RULES.awaken;
  if(crossfade){
    const u=(a.transitionAge-VARGUL_RULES.down-VARGUL_RULES.awaken)/8;
    paintVargul(frame,e.x,e.y,e.face,1-u);paintVargul(VARGUL_ART.clips.p2_idle[0],e.x,e.y,e.face,u);
  }else paintVargul(frame,e.x,e.y-e.z,e.face);
  ctx.restore();
  if(vargulAuraVisible(e)){
    const mask=VARGUL_ART.clips['mask_'+pose.clip]?.[pose.drawing-1],pulse=.20+.65*(.5+.5*Math.sin(tick*Math.PI*2/90));
    if(mask)paintVargul(mask,e.x,e.y-e.z,e.face,pulse,VARGUL_ART.scale,true);
  }
  const geo=VARGUL_MEASUREMENTS[pose.clip]?.[pose.drawing-1];
  if(geo){e.tipX=e.x+e.face*geo.tip[0];e.tipH=e.z+geo.tip[1];}
  if(vargulDebug)drawVargulBoxes(e);
  return true;
}
function drawVargulBoxes(e){
  const pose=vargulPose(e),geo=VARGUL_MEASUREMENTS[pose.clip]?.[pose.drawing-1];if(!geo||pose.hidden)return;
  const box=(b,color)=>{const [x,h,w,hh]=b;ctx.strokeStyle=color;ctx.strokeRect(e.x-camX+(e.face>0?x:-(x+w)),e.y-e.z-h-hh,w,hh);};
  ctx.save();ctx.lineWidth=1;box(geo.body,'#6dff9e');if(e.vargul?.current?.attack)box(vargulAttackBox(e,e.vargul.current),'#ff5276');ctx.restore();
}
function drawVargulHazards(ground=false){
  if(!USE_VARGUL_V136)return;
  for(const z of hazards){
    if(z.type!=='vargul'||z.dead)continue;
    const t=Math.max(0,z.age/MS),floor=['sword','cross','ultimate'].includes(z.kind),waiting=floor&&!z.boom&&z.stage!=='impact';
    if(ground!==!!waiting)continue;
    if(z.kind==='fx')paintVargulFx(z.fx,t/z.life,z.x,z.y-z.h+(z.height||80)/2,z.width||100,z.height||80,1-t/z.life*.65,z.face);
    else if(z.kind==='sword'||z.kind==='cross'){
      const d=VARGUL_RULES[z.kind];
      if(!z.boom){
        const fast=z.wait-t<20,alpha=UX.options.flash ? .55+.4*(.5+.5*Math.sin(t*(fast?1.2:.3))) : .8;
        if(z.kind==='sword')paintVargulFx('sword_warning',(t%30)/30,z.x,z.y+d.depth,d.radius*2,d.depth*2,alpha);
        else{
          // Keep the original vertical arm width; stretch only its horizontal band.
          paintVargulCrossWarning((t%26)/26,z,alpha);
          ctx.save();ctx.globalAlpha=alpha*.58;ctx.fillStyle='#f53d4f';
          ctx.fillRect(0,z.y-d.depth,VW,d.depth*2);
          ctx.fillRect(z.x-camX-d.column,GTOP,d.column*2,GBOT-GTOP);ctx.restore();
        }
      }else if(z.kind==='sword')paintVargulFx('sword_fall',(t-z.wait)/6,z.x,z.y+12,76,155);
      else{
        paintVargulFx('cross_eruption',(t-z.wait)/18,camX+VW/2,z.y+30,VW,125);
        for(const y of [GTOP+24,(GTOP+GBOT)/2,GBOT-12])paintVargulFx('cross_eruption',(t-z.wait)/18,z.x,y,d.column*2+22,85,.75);
      }
      if(vargulDebug){ctx.save();ctx.strokeStyle='#ff526e';
        if(z.kind==='sword'){ctx.beginPath();ctx.ellipse(z.x-camX,z.y,d.radius,d.depth,0,0,Math.PI*2);ctx.stroke();}
        else{ctx.strokeRect(0,z.y-d.depth,VW,2*d.depth);ctx.strokeRect(z.x-camX-d.column,GTOP,2*d.column,GBOT-GTOP);}ctx.restore();}
    }else if(z.kind==='orb'){
      const size=42,alpha=z.inv>0?.45:1;ctx.save();if(z.flash>0&&UX.options.flash)ctx.filter='brightness(2)';
      paintVargulFx('ice_orb',(t%52)/52,z.x,z.y-z.h+size/2,size,size,alpha);ctx.restore();
      const x=z.x-camX,y=z.y-z.h-size/2-7,barWidth=size+4;
      ctx.save();ctx.fillStyle='#182532';ctx.fillRect(x-barWidth/2,y,barWidth,4);
      ctx.fillStyle='#89dcff';ctx.fillRect(x-barWidth/2+1,y+1,(barWidth-2)*clamp(z.hp/z.maxHp,0,1),2);ctx.restore();
      if(vargulDebug){ctx.save();ctx.strokeStyle='#73e5ff';ctx.strokeRect(x-12,z.y-z.h-12,24,24);
        ctx.beginPath();ctx.moveTo(x,z.y-z.h);ctx.lineTo(player.x-camX,player.y-player.z-44);ctx.stroke();ctx.restore();}
    }else if(z.kind==='shard')paintVargulFx('ice_shard',(t%22)/22,z.x,z.y-z.h+9,24,18,1,z.vx>=0?1:-1);
    else if(z.kind==='ultimate'){
      const u=VARGUL_RULES.ultimate;
      if(z.stage!=='impact'){
        const alpha=UX.options.flash?.5+.4*Math.sin(t*(z.stage==='tracking'?.22:1))**2:.8;
        paintVargulFx('ultimate_warning',(t%33)/33,z.x,z.y+u.ry,u.rx*2,u.ry*2,alpha);
        if(z.stage==='fall')paintVargulFx('giant_spear',clamp((t-90)/6,0,1),z.x,z.y,90,260);
      }else{
        paintVargulFx('glacier_impact',(t-z.impactAge)/24,z.x,z.y+40,u.outerX*2,180);
        ctx.save();ctx.globalCompositeOperation='lighter';ctx.strokeStyle='#adebff';ctx.lineWidth=3;ctx.beginPath();
        ctx.ellipse(z.x-camX,z.y,u.outerX,u.outerY,0,0,Math.PI*2);ctx.stroke();ctx.restore();
      }
      if(vargulDebug){ctx.save();ctx.strokeStyle='#ff526e';for(const [rx,ry] of [[u.rx,u.ry],[u.outerX,u.outerY]]){ctx.beginPath();ctx.ellipse(z.x-camX,z.y,rx,ry,0,0,Math.PI*2);ctx.stroke();}ctx.restore();}
    }
  }
}
function drawVargulRemains(){for(const r of vargulRemains)paintVargul(VARGUL_ART.clips.death.at(-1),r.x,r.y,r.face);}
let vargulPortrait=null;
function getVargulPortrait(){
  const f=VARGUL_ART.clips.p1_idle[0],im=VARGUL_SHEETS[f.sheet];if(!im?.naturalWidth)return null;
  if(!vargulPortrait){const c=document.createElement('canvas');c.width=c.height=64;c.hd=true;const [x,y,w,h]=f.atlas;c.getContext('2d').drawImage(im,x+w*.2,y+h*.1,w*.55,h*.35,0,0,64,64);vargulPortrait=c;}
  return vargulPortrait;
}
function vargulDebugStart(){
  if(!VARGUL_DEBUG)return;
  practice=false;beginGame();startStage(3);scene='play';showScreen(null);waveIdx=stage.waves.length;camX=lockAt=stage.waves.at(-1).at;camLock=true;arena=null;
  player.x=camX+190;player.y=430;barrels=[];enemies=[];hazards=[];
  spawnWave({e:[['boss4',1]],boss:true});
}
function vargulDebugKey(code){
  if(!VARGUL_DEBUG||!USE_VARGUL_V136)return false;
  if(code==='F2'){vargulDebugStart();return true;}
  if(code==='F8'){vargulDebug=!vargulDebug;aurelionDebug=vargulDebug;return true;}
  const e=enemies.find(isVargul);if(!e)return false;
  if(code==='F3'){
    resetBossFx(e);clearVargulHazards(e);e.phaseT=0;e.p2shown=true;e.max=e.hp=2500;e.nextKd=1875;e.invuln=false;e.inv=0;e.gr=e.grT=0;e.st='chase';e.atkCd=20;
    scene='play';showScreen(null);
    vargulData(e).ultimateUsed=false;vargulRepeat=null;return true;
  }
  if(code==='F4'){if(e.p2shown){e.hp=e.max*.35;e.atkCd=0;vargulData(e).cooldowns.ultimate=0;vargulRepeat=null;}return true;}
  if(code==='F6'){
    const list=VARGUL_ATTACKS.filter(id=>id!==(e.p2shown?'taunt':'ultimate'));
    vargulDebugMove=(vargulDebugMove+1)%list.length;if(vargulRepeat)vargulRepeat=list[vargulDebugMove];return true;
  }
  if(code==='F7'){
    const list=VARGUL_ATTACKS.filter(id=>id!==(e.p2shown?'taunt':'ultimate'));
    vargulRepeat=vargulRepeat?null:list[vargulDebugMove];return true;
  }
  return false;
}
function drawVargulDebug(){
  if(!VARGUL_DEBUG)return;
  ctx.save();ctx.fillStyle='rgba(0,0,0,.75)';ctx.fillRect(8,116,W-16,22);ctx.font='12px sans-serif';ctx.fillStyle='#bcecff';
  ctx.textAlign='left';ctx.textBaseline='alphabetic';
  const e=enemies.find(isVargul),list=VARGUL_ATTACKS.filter(id=>id!==(e?.p2shown?'taunt':'ultimate'));
  ctx.fillText(`DEBUG F2 바르굴전 / F3 2P / F4 35% / F6 선택:${list[vargulDebugMove]} / F7 반복 ${vargulRepeat||'끔'} / F8 판정`,16,132);ctx.restore();
}
