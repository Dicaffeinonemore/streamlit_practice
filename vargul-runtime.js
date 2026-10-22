'use strict';
// One flag selects the complete replacement. Legacy boss4 code/art stays intact.
const USE_VARGUL_V136=globalThis.VARGUL_V136_OVERRIDE!==false;
const VARGUL_SHEETS=USE_VARGUL_V136?VARGUL_ART.sheets.map(src=>{const im=new Image();im.src=src;return im;}):[];
const VARGUL_MELEE_FRAMES={};
const VARGUL_MELEE_READY=Promise.all(Object.entries(VARGUL_MELEE_SOURCES).map(async([kind,src])=>{
  const im=new Image();im.src=src;await im.decode();
  // Explicit cuts follow the reference's eight drawings per row, not a uniform grid.
  // The enlarged lower-row drawings overlap in the supplied sheets. Animate the
  // eight separate upper-row drawings and scale the finisher without cutting arcs.
  const rows=kind==='slash'?
    [[0,170,452,[0,208,400,610,808,1022,1230,1442,1672]]]:
    [[0,245,402,[20,185,365,565,780,995,1225,1470,1650]]];
  VARGUL_MELEE_FRAMES[kind]=[];
  for(const [,top,bottom,cuts] of rows)for(let n=0;n<8;n++){
    const canvas=document.createElement('canvas');canvas.width=cuts[n+1]-cuts[n];canvas.height=bottom-top;
    const c=canvas.getContext('2d',{willReadFrequently:true});c.drawImage(im,-cuts[n],-top);
    const pixels=c.getImageData(0,0,canvas.width,canvas.height),d=pixels.data;
    let x0=canvas.width,y0=canvas.height,x1=-1,y1=-1;
    for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++){
      const i=(y*canvas.width+x)*4;
      // Also supports black-backed exports. Very faint fringe is neither drawn nor damaging.
      if(d[i+3]<32||Math.max(d[i],d[i+1],d[i+2])<40)d[i+3]=0;
      else{x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}
    }
    c.putImageData(pixels,0,0);
    const frame=document.createElement('canvas');frame.width=x1-x0+1;frame.height=y1-y0+1;
    frame.getContext('2d').drawImage(canvas,-x0,-y0);
    const spans=[];
    for(let y=y0;y<=y1;y++){
      const runs=[];let start=-1;
      for(let x=x0;x<=x1+1;x++){
        const solid=x<=x1&&d[(y*canvas.width+x)*4+3]>0;
        if(solid&&start<0)start=x;
        if(!solid&&start>=0){runs.push([start-x0,x-x0]);start=-1;}
      }
      spans.push(runs);
    }
    VARGUL_MELEE_FRAMES[kind].push({image:frame,spans,width:frame.width,height:frame.height});
  }
}));
const VARGUL_READY=Promise.all([...VARGUL_SHEETS.map(im=>im.decode()),VARGUL_MELEE_READY]);
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
function vargulFloorBusy(e){return vargulHazards(e).some(z=>['sword','cross'].includes(z.kind)&&z.age/MS<z.wait+z.active);}
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
  if(kind==='ice_wave'){
    const u=VARGUL_RULES.ultimate,ratio=u.outerY/u.outerX;
    // Freeze the arena extent at emission. Keep the original traveling speed;
    // the ring must pass even the far corners, rather than fading near the boss.
    z.waveRadius=Math.max(...[camX,camX+VW].flatMap(px=>[GTOP,GBOT].map(py=>Math.hypot(px-x,(py-y)/ratio))))+u.waveHalfWidth;
    z.waveTicks=Math.ceil(z.waveRadius/(u.outerX/u.waveTicks))+1;
  }
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
    a.ultimate=spawnVargul(e,'ultimate',player.x,player.y,0,{stage:'tracking',hit:false,impactAge:null,wavesEmitted:0});a.ultimateUsed=true;
  }else if(event.type==='ultimate_lock'){
    if(a.ultimate)a.ultimate.stage='fixed';
  }else if(event.type==='ultimate_fall'){
    if(a.ultimate){a.ultimate.stage='fall';e.x=a.ultimate.x;e.y=a.ultimate.y;}
  }else if(event.type==='ultimate_impact'){
    if(a.ultimate){
      a.ultimate.stage='impact';a.ultimate.impactAge=Math.floor((a.ultimate.age+MS)/MS+1e-6);
      e.x=a.ultimate.x;e.y=a.ultimate.y;
    }
    e.z=0;
    vargulFx(e,'spear_flash',e.x,e.y,12,{life:12,width:38,height:60});
    shake=Math.max(shake,24);sfx('land');
  }else if(event.type==='ultimate_land'){
    // Already landed at impact. Begin the existing90-tick punish window here.
    e.z=0;
  }
}
function vargulAttackBox(e,t){
  const fx=vargulMeleeEffectData(e,t);if(fx)return fx.box;
  const geometry=VARGUL_MEASUREMENTS[t.clip][t.drawing-1];
  return t.attack?.body?geometry.body:geometry.attack;
}
function vargulBoxHit(e,box,depth,oldX=e.x){
  const [x,h,w,height]=box,p=player;
  const left=Math.min(e.x,oldX)+Math.min(x*e.face,(x+w)*e.face);
  const right=Math.max(e.x,oldX)+Math.max(x*e.face,(x+w)*e.face);
  return p.x+playerBodyHalfWidth()>=left&&p.x-playerBodyHalfWidth()<=right&&Math.abs(p.y-e.y)<depth*playerHurtScale()&&p.z+playerBodyHeight()>=e.z+h&&p.z<=e.z+h+height;
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
    a.current=t;e.invuln=!!(t.hidden||t.invulnerable);
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
      const height=VARGUL_RULES.ultimate.riseHeight;
      if(t.label==='leap')e.z=(t.local+1)/t.segmentTicks*height;
      else if(t.hidden)e.z=height;
      else if(t.label==='fall')e.z=height*(1-t.local/t.segmentTicks);
      else if(f>=141)e.z=0;
    }
    if(t.attack){
      if(t.first){a.run.active.push({id:t.attack.id,elapsed:a.processed,drawing:t.drawing});sfx('swing');}
      if(!a.hitIds.has(t.attack.id)&&vargulMeleeHit(e,t,oldX)&&vargulHurt(e,t.attack))a.hitIds.add(t.attack.id);
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
  if(e.st==='stun')return {clip:p+'hurt',drawing:1};
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
    // Cross frost keeps a harmless visual tail after the original damage window.
    if(t>=z.wait+(z.kind==='cross'?Math.max(z.active,VARGUL_CROSS_FX.life):z.active))z.dead=true;
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
    if(z.stage==='impact'&&t-z.impactAge<VARGUL_RULES.ultimate.impactTicks&&!z.hit){
      const u=VARGUL_RULES.ultimate,dx=p.x-z.x,dy=p.y-z.y;
      const center=(dx/u.rx)**2+(dy/u.ry)**2<=1&&p.z<200*.5112;
      if(center&&vargulHurt(e,{damage:u.damage,knockdown:true},z))z.hit=true;
    }
    const u=VARGUL_RULES.ultimate,emitted=z.wavesEmitted||0;
    if(z.stage==='impact'&&emitted<u.waveCount&&t-z.impactAge>=u.waveDelay+emitted*u.waveInterval){
      z.wavesEmitted=emitted+1;spawnVargul(e,'ice_wave',z.x,z.y,0,{hit:false,pulse:emitted});vargulLogEvent(e,'ultimate_wave');
    }
    if(z.stage==='impact'&&t-z.impactAge>=u.waveDelay+(u.waveCount-1)*u.waveInterval+1)z.dead=true;
  }else if(z.kind==='ice_wave'){
    const u=VARGUL_RULES.ultimate,band=vargulIceWaveBand(t,z);
    const distance=Math.hypot(p.x-z.x,(p.y-z.y)*u.outerX/u.outerY);
    if(t<z.waveTicks&&!z.hit&&distance>=band.inner&&distance<=band.outer&&p.z<=u.outerHeight&&
      vargulHurt(e,{damage:u.outerDamage,knockdown:true},z))z.hit=true;
    if(t>=z.waveTicks)z.dead=true;
  }
  return true;
}
function vargulIceWaveBand(age,wave){
  const u=VARGUL_RULES.ultimate,t=clamp(age,0,(wave?.waveTicks??u.waveTicks)-1),speed=u.outerX/u.waveTicks;
  return {radius:speed*(t+1),inner:Math.max(0,speed*t-u.waveHalfWidth),
    outer:Math.min(wave?.waveRadius??u.outerX,speed*(t+1)+u.waveHalfWidth)};
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
const VARGUL_CROSS_FX={spread:12,frameTicks:1.5,life:42,scale:.48};
function paintVargulCrossEruption(z,age){
  const d=VARGUL_RULES.cross,fx=VARGUL_CROSS_FX,art=ZONE_ART.frost,im=ZONE_IMAGES.frost,x=z.x-camX;
  ctx.save();
  // Keep the entire damaging footprint readable while the eruption travels.
  if(age<z.active){
    ctx.fillStyle=`rgba(91,193,231,${.22*(1-age/z.active)})`;ctx.beginPath();
    ctx.rect(0,z.y-d.depth,VW,d.depth*2);ctx.rect(x-d.column,GTOP,d.column*2,GBOT-GTOP);ctx.fill();
  }
  if(!im?.complete||!im.naturalWidth||!art){ctx.restore();return;}
  // Stable world positions prevent the wave from restarting when the camera moves.
  z.crossViewLeft??=camX;z.crossViewWidth??=VW;
  const w=art.fw*fx.scale,h=art.h*fx.scale,step=(art.fw-art.feather)*fx.scale,tiles=[];
  const horizontalReach=Math.max(step,Math.abs(z.x-z.crossViewLeft),Math.abs(z.crossViewLeft+z.crossViewWidth-z.x));
  const verticalReach=Math.max(20,Math.abs(z.y-GTOP),Math.abs(GBOT-z.y));
  for(let i=Math.floor((camX-z.x-w/2)/step);i<=Math.ceil((camX+VW-z.x+w/2)/step);i++){
    tiles.push({x:z.x+i*step,y:z.y+5,delay:Math.min(1,Math.abs(i*step)/horizontalReach)*fx.spread,flip:i<0});
  }
  for(let i=Math.floor((GTOP-z.y)/20);i<=Math.ceil((GBOT-z.y)/20);i++){
    const y=z.y+i*20;if(!i||y<GTOP||y>GBOT)continue;
    tiles.push({x:z.x,y,delay:Math.abs(i*20)/verticalReach*fx.spread,flip:i<0});
  }
  ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
  tiles.sort((a,b)=>a.y-b.y);
  for(const tile of tiles){
    const local=age-tile.delay;if(local<0||local>=20*fx.frameTicks)continue;
    // Play the middle row's eruption and decay (frames 5–24), never its labels.
    const frame=4+Math.min(19,Math.floor(local/fx.frameTicks));
    ctx.save();ctx.globalAlpha*=Math.min(1,(local+1)/2,(20*fx.frameTicks-local)/5);
    drawZoneTile(im,art,frame,tile.x-camX-w/2,tile.y-art.ground*fx.scale,w,h,tile.flip);
    ctx.restore();
  }
  ctx.restore();
}
function vargulTelegraph(e){const t=e.vargul?.current;return e.st==='pat'&&t?{warning:!!t.warning,white:!!t.white}:null;}
function vargulAuraVisible(e){return e.p2shown&&!e.phaseT&&!['down','stun','dead','intro'].includes(e.st)&&!e.vargul?.current?.hidden;}
function vargulVisualScale(pose){return VARGUL_ART.scale*(VARGUL_VISUAL_SCALES[pose.clip]?.[pose.drawing-1]??1);}
function vargulMeleeEffectData(e,t=e.vargul?.current){
  if(!t?.attack)return null;
  const id=t.attack.id,kind=id.startsWith('dash')?'thrust':'slash';
  if(!/^(combo|dash|sweep)/.test(id))return null;
  // Keep one continuous animation across launch/dash, including the return pass.
  const timeline=e.vargul?.timeline||[],segment=timeline.filter(v=>v.attack?.id===id);
  const index=Math.max(0,segment.indexOf(t)),progress=index/Math.max(1,segment.length-1);
  const large=id==='combo3'||id==='sweep_back';
  const frame=VARGUL_MELEE_FRAMES[kind]?.[Math.min(7,Math.floor(progress*8))];
  const geo=VARGUL_MEASUREMENTS[t.clip][t.drawing-1];
  const tip=Math.abs(geo.tip[0]),back=id==='sweep_back';
  const w=kind==='thrust'?128:Math.max(80,Math.min(145,tip));
  const h=kind==='thrust'?60:(large?112:86);
  // The sweep's second arc faces behind the boss, regardless of atlas tip noise.
  const box=[back?-w-12:12,12,w,h];
  return {active:true,id,kind,frame,box,depth:t.attack.depth,progress,reverse:back};
}
function vargulMeleeHit(e,t,oldX=e.x){
  const fx=vargulMeleeEffectData(e,t);
  if(!fx)return vargulBoxHit(e,vargulAttackBox(e,t),t.attack.depth,oldX);
  // Missing artwork must never leave an invisible damaging attack.
  if(!fx.frame||!vargulBoxHit(e,fx.box,fx.depth,oldX))return false;
  const [bx,bh,w,h]=fx.box,f=fx.frame,p=player;
  const low=Math.max(0,Math.floor((e.z+bh+h-(p.z+playerBodyHeight()))*f.height/h));
  const high=Math.min(f.height-1,Math.floor((e.z+bh+h-p.z)*f.height/h));
  const direction=e.face*(fx.reverse?-1:1);
  for(let y=low;y<=high;y++)for(const [start,end] of f.spans[y]){
    const u=direction>0?start/f.width:1-end/f.width;
    const v=direction>0?end/f.width:1-start/f.width;
    const left=Math.min(e.x,oldX)+(e.face>0?bx:-(bx+w));
    const right=Math.max(e.x,oldX)+(e.face>0?bx:-(bx+w));
    if(p.x+playerBodyHalfWidth()>=left+u*w&&p.x-playerBodyHalfWidth()<=right+v*w)return true;
  }
  return false;
}
function drawVargulMeleeEffect(e,ground){
  const fx=vargulComboEffectData(e)||((e.st==='pat')?vargulMeleeEffectData(e):null);
  if(!fx)return;
  const [bx,bh,w,h]=fx.box,x=e.x-camX+(e.face>0?bx:-(bx+w));
  ctx.save();
  if(ground){
    // Lane cue is faint; only the solid animated effect is the damaging silhouette.
    ctx.globalAlpha*=fx.active ? .12 : .07;ctx.fillStyle='#8ddfff';
    ctx.fillRect(x,e.y-fx.depth,w,fx.depth*2);
  }else if(fx.active&&fx.frame){
    ctx.translate(x+w/2,e.y-e.z-bh-h/2);ctx.scale(e.face*(fx.reverse?-1:1),1);
    smoothFor(h/fx.frame.height);ctx.drawImage(fx.frame.image,-w/2,-h/2,w,h);
  }
  ctx.restore();
}
function vargulComboEffectData(e){
  const a=e.vargul,t=a?.current;
  if(e.st!=='pat'||a?.move!=='combo'||!t)return null;
  let frame=t,active=!!t.attack?.id.startsWith('combo');
  if(!active){
    if(t.phase!=='S')return null;
    const ahead=a.timeline.slice(a.cursor,a.cursor+8).find(v=>v.attack?.id.startsWith('combo'));
    if(!ahead)return null;frame=ahead;
  }
  return {...vargulMeleeEffectData(e,frame),active};
}
function drawVargul(e){
  if(!isVargul(e))return false;
  const a=vargulData(e),pose=vargulPose(e),frame=VARGUL_ART.clips[pose.clip]?.[pose.drawing-1];
  if(pose.hidden)return true;
  if(!VARGUL_SHEETS[frame?.sheet]?.naturalWidth)return false;
  const visualScale=vargulVisualScale(pose);
  drawVargulMeleeEffect(e,true);
  drawShadow(e.x-camX,e.y,SPRITES.boss4.sh,e.z);
  if(vargulAuraVisible(e))paintVargulFx('frost_aura',(tick%96)/96,e.x,e.y-e.z,150,170,.38);
  ctx.save();const tele=vargulTelegraph(e);
  if(e.flash>0&&UX.options.flash)ctx.filter='brightness(1.8)';
  else if(tele?.white&&UX.options.flash&&Math.floor(e.pt/90)%2===0)ctx.filter='brightness(2)';
  const crossfade=e.phaseT>0&&a.transitionAge>=VARGUL_RULES.down+VARGUL_RULES.awaken;
  if(crossfade){
    const u=(a.transitionAge-VARGUL_RULES.down-VARGUL_RULES.awaken)/8;
    paintVargul(frame,e.x,e.y,e.face,1-u,visualScale);paintVargul(VARGUL_ART.clips.p2_idle[0],e.x,e.y,e.face,u,vargulVisualScale({clip:'p2_idle',drawing:1}));
  }else paintVargul(frame,e.x,e.y-e.z,e.face,1,visualScale);
  ctx.restore();
  if(vargulAuraVisible(e)){
    const mask=VARGUL_ART.clips['mask_'+pose.clip]?.[pose.drawing-1],pulse=.20+.65*(.5+.5*Math.sin(tick*Math.PI*2/90));
    if(mask)paintVargul(mask,e.x,e.y-e.z,e.face,pulse,visualScale,true);
  }
  const geo=VARGUL_MEASUREMENTS[pose.clip]?.[pose.drawing-1];
  if(geo){e.tipX=e.x+e.face*geo.tip[0];e.tipH=e.z+geo.tip[1];}
  drawVargulMeleeEffect(e,false);
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
    const t=Math.max(0,z.age/MS),floor=['sword','cross','ultimate'].includes(z.kind),waiting=z.kind==='ice_wave'||floor&&!z.boom&&z.stage!=='impact';
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
        paintVargulCrossEruption(z,t-z.wait);
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
        // The boss itself dives onto this mark; no detached giant spear.
      }else{
        if(t-z.impactAge<24)paintVargulFx('glacier_impact',(t-z.impactAge)/24,z.x,z.y+40,u.outerX*2,180);
      }
      if(vargulDebug){ctx.save();ctx.strokeStyle='#ff526e';ctx.beginPath();ctx.ellipse(z.x-camX,z.y,u.rx,u.ry,0,0,Math.PI*2);ctx.stroke();ctx.restore();}
    }else if(z.kind==='ice_wave'){
      const u=VARGUL_RULES.ultimate,band=vargulIceWaveBand(Math.floor(t+1e-6),z),ratio=u.outerY/u.outerX,x=z.x-camX;
      ctx.save();ctx.beginPath();ctx.rect(0,GTOP-12,VW,GBOT-GTOP+24);ctx.clip();
      ctx.globalCompositeOperation='lighter';ctx.globalAlpha=1-t/z.waveTicks*.4;
      ctx.fillStyle='rgba(111,218,255,.32)';ctx.beginPath();
      ctx.ellipse(x,z.y,band.outer,band.outer*ratio,0,0,Math.PI*2);
      ctx.ellipse(x,z.y,band.inner,band.inner*ratio,0,0,Math.PI*2,true);ctx.fill('evenodd');
      ctx.strokeStyle='#b3f2ff';ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(x,z.y,band.radius,band.radius*ratio,0,0,Math.PI*2);ctx.stroke();
      for(let i=0;i<16;i++){
        const angle=i/16*Math.PI*2,px=x+Math.cos(angle)*band.radius,py=z.y+Math.sin(angle)*band.radius*ratio;
        ctx.beginPath();ctx.moveTo(px-2,py);ctx.lineTo(px,py-5);ctx.lineTo(px+2,py);ctx.stroke();
      }
      if(vargulDebug){ctx.strokeStyle='#ff526e';for(const radius of [band.inner,band.outer]){
        ctx.beginPath();ctx.ellipse(x,z.y,radius,radius*ratio,0,0,Math.PI*2);ctx.stroke();
      }}ctx.restore();
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
