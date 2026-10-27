'use strict';
const MORGRA_ATLAS=new Image();MORGRA_ATLAS.src=MORGRA_ART.atlas;
const MORGRA_REVIVE={death:110,wait:45,rise:106,hp:1200,groggy:240};
const morgraScale=()=>MORGRA_ART.scale*BOSS_VISUAL_SCALE;
const morgraMoves={...MORGRA_ART.timing};
for(const [id,d] of Object.entries(MORGRA_ART.boss.derived_moves)) {
  let start=0;
  const drawings=d.steps.map(([clip,index,duration])=>{const f={clip,index,duration,start,hitboxes:[]};start+=duration;return f;});
  morgraMoves[id]={id,name:d.name,total_frames:start,drawings,phases:{startup:[0,(d.startup||1)-1]},
    events:d.spawn?[{frame:drawings[d.spawn.at_step-1].start,type:'spawn',id:d.spawn.id,count:d.spawn.count,dz:d.spawn.dz}]:[],
    invulnerable:(d.invulnerable_steps||[]).map(n=>[drawings[n-1].start,drawings[n-1].start+drawings[n-1].duration-1])};
  if(id==='p2_teleport')morgraMoves[id].events.push({frame:18,type:'move',id:'teleport'});
}
function morgraDrawing(id,f) {
  const d=morgraMoves[id];if(d.loop)f%=d.total_frames;
  return d.drawings.find(a=>f<a.start+a.duration)||d.drawings.at(-1);
}
function morgraFrame(id,f=0) {
  const d=morgraDrawing(id,f);return MORGRA_ART.clips[d.clip||id]?.[d.index-1]||null;
}
function morgraFxFrame(id,f=0) {
  const a=MORGRA_ART.clips['fx_'+id];return a?.[Math.min(a.length-1,Math.max(0,Math.floor(f)))];
}
function paintMorgra(f,x,y,face=1,alpha=1,k=BOSS_VISUAL_SCALE) {
  if(!f||!MORGRA_ATLAS.naturalWidth)return false;
  const [sx,sy,w,h]=f.atlas,[ax,ay]=f.anchor,d=k/(MORGRA_ART.hd||1);   // atlas keeps source pixels
  ctx.save();ctx.translate(x-camX,y);ctx.scale(face,1);ctx.globalAlpha*=alpha;smoothFor(d);
  ctx.drawImage(MORGRA_ATLAS,sx,sy,w,h,-ax*k,-ay*k,w*d,h*d);ctx.restore();return true;
}
function beginMorgraRevival(e) {
  resetBossFx(e);e.hp=0;e.gr=0;e.grT=0;e.st='reviving';e.t=0;e.invuln=true;e.remove=false;
  e.z=e.vz=e.vx=0;e.hud=null;hazards=hazards.filter(h=>h.type==='pwave');
  sfx('bossdie');hitStop=Math.max(hitStop,8);floatText(e.x,e.y-120,'끝나지 않은 저주','#c9a0ff');
}
function updateMorgraRevival(e) {
  e.t++;e.walk=false;e.flash=0;
  const riseAt=MORGRA_REVIVE.death+MORGRA_REVIVE.wait;
  if(e.t===riseAt+62){sfx('phase2');shake=Math.max(shake,10);}
  if(e.t<riseAt+MORGRA_REVIVE.rise)return;
  e.p2shown=true;e.hp=e.max=MORGRA_REVIVE.hp;e.gr=0;e.grMax=MORGRA_REVIVE.groggy;e.grT=0;
  e.nextKd=e.max*.75;e.hud=null;e.invuln=false;e.inv=0;e.st='rec';e.t=0;e.recT=45;
  e.morgraMove=null;e.moonUsed=false;e.morgraCooldown=0;e.z=0;
  player.inv=Math.max(player.inv,45);floatText(e.x,e.y-140,'PHASE 2','#d8bfff');
}
function morgraResolve(e,pat) {
  const a=e.p2shown?{orbs:'p2_bolt',ravens:'p2_summon',feather:'p2_curtain',staff:'aerial_slash',soul:'moon',teleport:'p2_teleport'}:
    {orbs:'magic_bolt',ravens:'summon',feather:'curtain',staff:'staff_swing',soul:'magic_bolt'};
  return a[pat]||pat;
}
function initMorgraPattern(e) {
  e.morgraMove=morgraResolve(e,e.pat);e.morgraX=e.x;e.morgraLane=e.y;e.morgraHit=false;
  if(e.morgraMove==='moon'){e.moonUsed=true;e.morgraCooldown=600;}
}
function pickMorgraPattern(e,dx,dy) {
  // Use judgment throughout phase two, then repeat at the next decision after 10s.
  if(e.p2shown&&(!e.moonUsed||!e.morgraCooldown))return 'moon';
  const choices=e.p2shown?(dx<115&&dy<25?['aerial_slash','aerial_slash','p2_teleport','p2_bolt']:
    ['crow_rush','p2_bolt','p2_curtain','p2_summon']):(dx<110&&dy<25?['staff_swing','staff_swing','teleport']:
    ['magic_bolt','magic_bolt','curtain','summon']);
  const fresh=choices.filter(x=>x!==e.last);return fresh[Math.floor(Math.random()*fresh.length)];
}
function morgraFx(id,x,y,h=0,owner=null,life=24) {
  hazards.push({type:'morgra',fx:id,x,y,h,age:0,life,visual:true,owner,face:owner?.face||1});
}
function spawnMorgraEvent(e,event) {
  const scale=morgraScale(),p=player,id=event.id;
  const x=e.x+e.face*(event.offset?.[0]||0)*scale,y=e.y,h=(event.offset?.[1]||0)*scale;
  const push=(kind,extra={})=>hazards.push({type:'morgra',kind,x,y,h,age:0,owner:e,face:e.face,
    damageScale:e.p2shown?1.5:1,...extra});
  if(id==='bolt'||id==='feather_shot') {
    const offsets=event.dz||[0];
    for(const dy of offsets)push(id,{x:e.x+e.face*42,y:e.y+dy,h:55});
    sfx('orb');
  } else if(id==='crow') {
    const cap=e.p2shown?5:3,alive=hazards.filter(z=>z.owner===e&&z.kind==='crow'&&!z.dead).length;
    for(let i=0;i<Math.min(event.count||cap,cap-alive);i++)push('crow',{x:e.x+e.face*(30+i*18),y:e.y+(i-1)*16,h:95+i*8});
    sfx('raven');
  } else if(id==='warning_circle') {
    for(const dy of e.p2shown?[-30,0,30]:[0])push('pillar',{x:p.x,y:clamp(p.y+dy,GTOP+10,GBOT),h:0,delay:e.p2shown?36:45});
  } else if(id==='giant_raven') {
    push(id,{x:e.x+e.face*35,y:e.morgraLane,h:55});sfx('raven');
  } else if(id==='safe_zone') {
    e.morgraSafe=[{x:clamp(p.x+(p.x<camX+VW/2?150:-150),camX+55,camX+VW-55),y:clamp(p.y,GTOP+22,GBOT-22)},
      {x:p.x<camX+VW/2?camX+VW-65:camX+65,y:clamp(p.y+50,GTOP+22,GBOT-22)}];
    push('moon_field',{x:camX+VW/2,y:p.y,h:0,safe:e.morgraSafe,delay:96,life:120});
  } else if(id==='moon_beam') {sfx('pillar');shake=Math.max(shake,12);}
  else if(id==='moon')morgraFx('moon',camX+VW/2,GTOP,105,e,162);
  else morgraFx(id,x,y,h,e,id==='staff_arc'?12:24);
}
function runMorgraPattern(e) {
  if(!e.morgraMove)initMorgraPattern(e);
  const id=e.morgraMove,m=morgraMoves[id],f=e.pt/MS,p=player;
  if(!m){endPat(e);return;}
  const d=morgraDrawing(id,f);
  e.invuln=(m.invulnerable||[]).some(([a,b])=>f>=a&&f<=b);
  e.alpha=(d.clip==='hidden'||id==='crow_rush'&&f>=30&&f<36)?0:1;
  for(let i=0;i<(m.events||[]).length;i++) {
    const ev=m.events[i];if(f<ev.frame||e.marks['event'+i])continue;e.marks['event'+i]=true;
    if(ev.type==='spawn')spawnMorgraEvent(e,ev);
    if(ev.type==='align')e.morgraLane=p.y;
    if(ev.type==='move'&&['teleport','reappear_180px_past_player'].includes(ev.id)) {
      morgraFx('teleport_burst',e.x,e.y,0,e);
      e.x=clamp(p.x+(p.x<camX+VW/2?1:-1)*(e.p2shown?180:240),camX+35,camX+VW-35);
      e.y=clamp(p.y+(e.p2shown?0:30),GTOP+10,GBOT);e.face=p.x>=e.x?1:-1;
      morgraFx('teleport_burst',e.x,e.y,0,e);
    }
  }
  if(id==='aerial_slash'&&f>=22&&f<37) {
    const speed=m.move.per_drawing[d.index]||0;
    e.x+=e.face*speed*morgraScale();
  }
  if(!e.morgraHit)for(const hb of d.hitboxes||[]) {
    const [x,y,w,h]=hb.box,k=morgraScale(),dx=(p.x-e.x)*e.face,hover=morgraHover(e);
    if(dx+playerBodyHalfWidth()>=x*k&&dx-playerBodyHalfWidth()<=(x+w)*k&&Math.abs(p.y-e.y)<hb.depth*playerHurtScale()&&p.z+playerBodyHeight()>=hover+y*k&&p.z<=hover+(y+h)*k) {
      if(hurtPlayer(m.attack.damage,e.face,!!m.attack.knockdown,e,{hitHeight:playerImpactHeight(hover+y*k,hover+(y+h)*k),hitstunTicks:m.attack.hitstunTicks??m.attack.hitstun})){e.morgraHit=true;hitStop=Math.max(hitStop,m.attack.hitstop||0);}
    }
  }
  if(f>=m.total_frames){e.morgraMove=null;endPat(e,id==='teleport'&&Math.random()<.5?'cackle':null);}
}
function morgraArmored(e) {
  if(e.type!=='boss2'||e.st!=='pat')return false;
  return (morgraMoves[e.morgraMove]?.super_armor||[]).some(([a,b])=>e.pt/MS>=a&&e.pt/MS<=b);
}
function strikeMorgraCrows(reach,behind=0,origin=player) {
  const p=origin;
  for(const h of hazards) {
    const dx=(h.x-p.x)*p.face;
    if(h.kind==='crow'&&!h.dead&&dx>=-behind-15&&dx<=reach+15&&Math.abs(h.y-p.y)<26&&Math.abs(h.h-(p.z+55))<55) {
      h.dead=true;h.owner.gr=Math.min(h.owner.grMax,h.owner.gr+8);h.owner.grT=150;
      sfx('hurt');
      morgraFx('bolt_hit',h.x,h.y,h.h,h.owner,18);
    }
  }
}
function morgraHover(e) {
  if(!e.p2shown||['dead','down','stun','reviving'].includes(e.st))return 0;
  if(e.st==='pat'&&e.morgraMove==='aerial_slash'&&e.pt/MS>=22&&e.pt/MS<53)return 0;
  return 18;
}
function updateMorgraHazard(z) {
  if(z.type!=='morgra')return false;
  const f=z.age/MS,p=player,k=morgraScale(),def=MORGRA_ART.projectiles[z.kind];
  if(z.visual){if(f>=z.life)z.dead=true;return true;}
  if(z.owner&&['dead','reviving'].includes(z.owner.st)){z.dead=true;return true;}
  if(z.kind==='pillar') {
    const a=f-z.delay;
    if(a>=6&&a<24&&!z.hit&&Math.abs(p.x-z.x)<76*k&&Math.abs(p.y-z.y)<20&&p.z<100) {
      if(hurtPlayer(14,Math.sign(p.x-z.x)||1,true,z))z.hit=true;
    }
    if(a>=30)z.dead=true;return true;
  }
  if(z.kind==='moon_field') {
    const safe=z.safe.some(s=>((p.x-s.x)/42)**2+((p.y-s.y)/22)**2<=1);
    const a=f-z.delay;
    if(a>=6&&a<18&&!safe&&!z.hit&&hurtPlayer(22,1,true,z))z.hit=true;
    if(f>=z.life)z.dead=true;return true;
  }
  if(!def){z.dead=true;return true;}
  const oldX=z.x;
  if(z.kind==='crow') {
    if(!z.diving&&Math.abs(z.x-p.x)<120*k){z.diving=true;const dist=Math.max(1,Math.hypot(p.x-z.x,p.y-z.y));z.vx=(p.x-z.x)/dist*3.5;z.vy=(p.y-z.y)/dist*3.5;}
    if(z.diving){z.x+=z.vx;z.y+=z.vy;z.h=Math.max(45,z.h-4);}
    else {z.x+=Math.sign(p.x-z.x)*def.speed*k;z.y+=clamp(p.y-z.y,-.6,.6);}
  } else z.x+=z.face*def.speed*k;
  const [bx,by,bw,bh]=def.hitbox;
  const left=Math.min(oldX,z.x)+Math.min(bx*z.face,(bx+bw)*z.face)*k;
  const right=Math.max(oldX,z.x)+Math.max(bx*z.face,(bx+bw)*z.face)*k;
  if(p.x+10*playerHurtScale()>=left&&p.x-10*playerHurtScale()<=right&&Math.abs(p.y-z.y)<def.depth*playerHurtScale()&&p.z+Math.min(85*playerHurtScale(),playerBodyHeight())>=z.h+by*k&&p.z<=z.h+(by+bh)*k) {
    if(hurtPlayer(def.damage,z.face,!!def.knockdown,z,{hitHeight:playerImpactHeight(z.h+by*k,z.h+(by+bh)*k),hitstunTicks:def.hitstunTicks??def.hitstun})) {z.dead=true;morgraFx('bolt_hit',z.x,z.y,z.h,z.owner,18);}
  }
  if(f>(def.lifetime||160)||z.x<camX-150||z.x>camX+VW+150)z.dead=true;
  return true;
}
function drawMorgra(e) {
  if(e.type!=='boss2'||!MORGRA_ATLAS.naturalWidth)return false;
  if(e.st==='intro'){drawMorgraIntro(e);return true;}
  let id=e.p2shown?'p2_idle':e.walk?'walk':'idle',f=tick;
  if(e.st==='reviving') {const start=MORGRA_REVIVE.death+MORGRA_REVIVE.wait;id=e.t<start?'death':'revive';f=e.t<start?Math.min(e.t,109):e.t-start;}
  else if(e.st==='dead'){id=e.p2shown?'p2_death':'death';f=e.t;}
  else if(e.st==='down'){id='knockdown';f=Math.min(109,e.t/60*110);}
  else if(e.st==='stun'){id=e.p2shown?'p2_hurt':'hurt';f=0;}
  else if(e.st==='hurt'){id=e.p2shown?'p2_hurt':'hurt';f=e.t*3;}
  else if(e.st==='intro'){id='intro';f=introT/MS;}
  else if(e.st==='pat'){id=e.morgraMove||morgraResolve(e,e.pat);f=e.pt/MS;}
  drawShadow(e.x-camX,e.y,SPRITES.boss2.sh,e.z);
  ctx.save();if(e.flash>0&&UX.options.flash)ctx.filter='brightness(1.8)';
  paintMorgra(morgraFrame(id,f),e.x,e.y-e.z-morgraHover(e),e.face,e.st==='dead'?clamp(1-(e.t-65)/55,0,1):e.alpha);
  ctx.restore();
  if(e.st==='reviving'&&e.t>=217&&e.t<241)paintMorgra(morgraFxFrame('teleport_burst',(e.t-217)/6),e.x,e.y);
  return true;
}
function morgraIntroPose(time) {
  const u=clamp(time/INTRO_MS,0,1),rise=ease(clamp((u-.12)/.76,0,1));
  return {rise,offset:150*(1-rise),alpha:rise,circleAlpha:Math.min(1,u/.12,(1-u)/.12)};
}
function drawMorgraIntro(e) {
  const pose=morgraIntroPose(introT),x=e.x-camX,y=e.y;
  ctx.save();ctx.globalAlpha=pose.circleAlpha;ctx.strokeStyle='#ba8cff';ctx.fillStyle='rgba(76,29,125,.4)';
  ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(x,y,66,23,0,0,Math.PI*2);ctx.fill();ctx.stroke();
  ctx.beginPath();ctx.ellipse(x,y,49,17,0,0,Math.PI*2);ctx.stroke();
  for(let i=0;i<8;i++){
    const a=i*Math.PI/4+introT*.0005;
    ctx.beginPath();ctx.moveTo(x+Math.cos(a)*50,y+Math.sin(a)*17);
    ctx.lineTo(x+Math.cos(a+.1)*61,y+Math.sin(a+.1)*21);ctx.stroke();
  }
  ctx.restore();
  // Reveal above the ground plane as the body rises out of the circle.
  ctx.save();ctx.beginPath();ctx.rect(x-200,y-210,400,213);ctx.clip();
  paintMorgra(morgraFrame('intro',introT/MS),e.x,y+pose.offset,e.face,pose.alpha);
  ctx.restore();
}
function drawMorgraHazards(ground=false) {
  for(const z of hazards) {
    if(z.type!=='morgra'||z.dead)continue;
    if(ground!==(z.kind==='moon_field'))continue;
    const f=z.age/MS;
    if(z.kind==='moon_field') {
      drawJudgmentField(z);
    } else if(z.kind==='pillar') {
      paintMorgra(morgraFxFrame(f<z.delay?'warning_circle':'dark_pillar',f<z.delay?Math.floor(f/15)%3:(f-z.delay)/6),z.x,z.y);
      if(f<z.delay){ctx.save();ctx.strokeStyle='#c48cff';ctx.lineWidth=1.5;ctx.beginPath();ctx.ellipse(z.x-camX,z.y,44,22,0,0,Math.PI*2);ctx.stroke();ctx.restore();}
    }
    else {
      const id=z.fx|| (z.kind==='crow'?(z.diving?'crow_dive':'crow_fly'):z.kind);
      if(id==='moon'&&drawJudgmentMoon(z))continue;
      const n=MORGRA_ART.clips['fx_'+id]?.length||1;
      paintMorgra(morgraFxFrame(id,z.visual?f/(z.life/n):Math.floor(f/5)%n),z.x,z.y-z.h,z.face);
    }
  }
}
let morgraPortrait=null;
function getMorgraPortrait() {
  if(!MORGRA_ATLAS.naturalWidth)return null;
  if(!morgraPortrait) {
    morgraPortrait=document.createElement('canvas');morgraPortrait.width=morgraPortrait.height=64;morgraPortrait.hd=true;
    const [x,y,w,h]=MORGRA_ART.clips.idle[0].atlas,c=morgraPortrait.getContext('2d');c.imageSmoothingQuality='high';
    c.drawImage(MORGRA_ATLAS,x+w*.15,y,w*.7,h*.55,0,0,64,64);
  }
  return morgraPortrait;
}
