'use strict';
const GORATH_ATLAS=new Image();GORATH_ATLAS.src=GORATH_ART.atlas;
function gorathFrame(name,u=0,loop=false) {
  const fs=GORATH_ART.clips[name];
  return fs?.[Math.max(0,Math.min(fs.length-1,Math.floor((loop?u%1:Math.min(.99999,u))*fs.length)))];
}
function gorathTimed(name,time) {
  const move=GORATH_ART.timing[name],f=Math.max(0,time/MS);
  const drawing=move.drawings.find(d=>f<d.start+d.duration)||move.drawings.at(-1);
  return GORATH_ART.clips[name][drawing.index-1];
}
function gorathEnemyFrame(e) {
  if(e.st==='dead')return gorathTimed('death',e.t*MS);
  if(e.st==='down')return gorathFrame('knockdown',e.t/55);
  if(e.st==='stun')return gorathFrame('hurt',.1);
  if(e.st==='hurt')return gorathFrame('hurt',e.t/25);
  if(e.st==='intro')return gorathFrame('intro',introT/INTRO_MS);
  if(e.st==='pat') {
    let t=e.pt;
    // Repeat the matching pose when phase two repeats the existing impact/throw.


    if(e.pat==='hook') {
      if(player.grab?.owner===e)return gorathFrame('chain_throw',player.grab.hold>0?.75:.55);
      return gorathFrame('chain_throw',t<500?0:t<570?.2:t<1000?.4:.99);
    }
    const names={sweep:'sweep',slam:'overhead_slam',rage:'dash_slash',meat:'meat_throw'};
    const name=names[e.pat];
    if(name) {
      const wind={sweep:450,slam:650,rage:550,meat:500}[e.pat];
      const activeEnd={sweep:680,slam:750,rage:1250,meat:570}[e.pat];
      const end={sweep:1150,slam:1150,rage:1900,meat:1200}[e.pat];
      const m=GORATH_ART.timing[name],phase=m.phases;
      const phaseTime=t<wind?t/wind*(phase.startup[1]+1):t<activeEnd?
        phase.active[0]+(t-wind)/(activeEnd-wind)*(phase.active[1]-phase.active[0]+1):
        phase.recovery[0]+(t-activeEnd)/(end-activeEnd)*(m.total_frames-phase.recovery[0]);
      return gorathTimed(name,phaseTime*MS);
    }
  }
  return gorathTimed(e.walk?'walk':'idle',(tick%48)*MS);
}
function paintGorath(f,x,y,face=1,alpha=1,scale=1) {
  if(!f||!GORATH_ATLAS.naturalWidth)return false;
  const [sx,sy,w,h]=f.atlas,[ax,ay]=f.anchor,k=scale*GORATH_ART.scale;   // atlas keeps source pixels
  ctx.save();ctx.translate(x-camX,y);ctx.scale(face,1);ctx.globalAlpha*=alpha;smoothFor(k);
  ctx.drawImage(GORATH_ATLAS,sx,sy,w,h,-ax*k,-ay*k,w*k,h*k);ctx.restore();return true;
}
function drawGorath(e) {
  if(e.type!=='boss1'||!GORATH_ATLAS.naturalWidth)return false;
  drawShadow(e.x-camX,e.y,SPRITES.boss1.sh,e.z);
  ctx.save();
  if(e.flash>0&&UX.options.flash)ctx.filter='brightness(1.8)';
  else if(e.st==='pat'&&e.pat==='hook'&&e.pt<500&&Math.floor(e.pt/90)%2)ctx.filter='sepia(1) saturate(5) hue-rotate(320deg)';
  paintGorath(gorathEnemyFrame(e),e.x,e.y-e.z,e.face,e.st==='dead'?clamp(1-(e.t-65)/55,0,1):1,BOSS_VISUAL_SCALE);
  ctx.restore();
  if(e.st==='pat') {
    const t=e.pt;
    if(e.pat==='sweep'&&t>=450&&t<730)paintGorath(gorathFrame('slash_arc',(t-450)/280),e.x+e.face*70,e.y-65,e.face);
    if(e.pat==='slam')for(const at of [650])if(t>=at&&t<at+350) {
      paintGorath(gorathFrame('ground_shockwave',(t-at)/350),e.x+e.face*45,e.y,e.face);
      if(!UX.options.lowFx)paintGorath(gorathFrame('impact_dust',(t-at)/350),e.x+e.face*45,e.y,e.face);
    }
    if(e.pat==='rage'&&t>=550&&t<1250) {
      paintGorath(gorathFrame('slash_arc',(t%240)/240),e.x+e.face*60,e.y-65,e.face);
      if(!UX.options.lowFx)paintGorath(gorathFrame('impact_dust',(t%300)/300),e.x-e.face*45,e.y,e.face);
    }
  }
  return true;
}
function drawGorathHazards() {
  if(!GORATH_ATLAS.naturalWidth)return;
  for(const z of hazards) {
    if(z.dead||z.owner?.type!=='boss1')continue;
    if(z.type==='hook') {
      const o=z.owner,x=o.x+o.face*28,y=o.y-62,dx=z.x-x,dy=z.y-z.h-y;
      const f=gorathFrame('chain_tile'),[sx,sy,sw,sh]=f.atlas,k=GORATH_ART.scale,w=sw*k,h=sh*k,len=Math.hypot(dx,dy);
      ctx.save();ctx.translate(x-camX,y);ctx.rotate(Math.atan2(dy,dx));smoothFor(k);
      for(let at=0;at<len;at+=w){const n=Math.min(w,len-at);ctx.drawImage(GORATH_ATLAS,sx,sy,n/k,sh,at,-h/2,n,h);}
      ctx.restore();paintGorath(gorathFrame(z.latched?'hook_latched':'hook_fly',(z.age%160)/160),z.x,z.y-z.h,z.dir);
    } else if(z.type==='meat')paintGorath(gorathFrame('meat_fly',(z.age%160)/160),z.x,z.y-z.h,z.owner.face);
    else if(z.type==='splat')paintGorath(gorathFrame('meat_splat',z.age/360),z.x,z.y,1,clamp(1-z.age/650,0,1));
  }
}
let gorathPortrait=null;
function getGorathPortrait() {
  if(!GORATH_ATLAS.naturalWidth)return null;
  if(!gorathPortrait) {
    const f=gorathFrame('idle'),[x,y,w,h]=f.atlas;
    gorathPortrait=document.createElement('canvas');gorathPortrait.width=gorathPortrait.height=64;gorathPortrait.hd=true;
    const c=gorathPortrait.getContext('2d');c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';
    c.drawImage(GORATH_ATLAS,x+w*.22,y+5/GORATH_ART.scale,w*.56,h*.48,0,0,64,64);
  }
  return gorathPortrait;
}
// Hook rules adapted from gorath_framedata.zip to the game's world scale.
const GORATH_GRAB = { depth: 14, reach: 236, pullSpeed: 6, offset: 54, hold: 50, presses: 4 };
const GORATH_ESCAPE_KEYS = ['KeyJ','KeyZ','KeyA','KeyD','KeyW','KeyS','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'];
function catchGorathHook(hook) {
  const p=player,o=hook.owner;
  if(practice || !o || o.type!=='boss1' || o.st!=='pat' || o.pat!=='hook' || p.inv>0 ||
      ['dead','down','special','grabbed'].includes(p.st) || p.z>=32)return false;
  p.st='grabbed';p.t=0;p.grab={owner:o,hook,presses:0,hold:0,pull:0};
  p.vx=p.vz=p.z=0;p.skill=null;p.combo=p.comboT=p.buf=0;p.walk=false;p.wave=false;
  clearInput();hook.hit=true;hook.out=false;hook.latched=true;
  o.marks.h=1;o.marks.ht=o.pt;sfx('hit',1);impact(p.x,p.y,58,1,hook.dir);
  return true;
}
function releaseGorathGrab(result='cancel') {
  const p=player,g=p.grab;if(!g)return;
  const o=g.owner;g.hook.dead=true;p.grab=null;p.st='free';p.t=0;p.vx=p.vz=0;clearInput();
  if(result==='fail') {
    p.inv=0;startPat(o,'sweep');o.pt=500;o.marks.h=1;
    hurtPlayer(20,o.face,true,o);p.inv=Math.max(p.inv,30);
  } else {
    p.inv=Math.max(p.inv,30);
    if(result==='escape') {
      resetBossFx(o);o.gr=Math.min(o.grMax,o.gr+40);o.grT=150;o.t=0;o.vx=0;o.hr=0;
      o.st=o.gr>=o.grMax?'stun':'hurt';o.atkCd=45;
      impact(o.x,o.y,65,1,p.face);sfx(o.st==='stun'?'groggy':'hit');
      floatText(p.x,p.y-110,'탈출!', '#aeeaff');
    }
  }
}
function updateGorathGrab() {
  const p=player,g=p.grab,o=g?.owner;
  if(!g || !o || !enemies.includes(o) || o.st!=='pat' || o.pat!=='hook' || g.hook.dead || o.phaseT>0) {
    if(g)releaseGorathGrab();else {p.st='free';p.t=0;}
    return;
  }
  p.t++;p.walk=false;p.z=p.vz=p.vx=0;dashReq=0;
  for(const code of GORATH_ESCAPE_KEYS)if(hit(code))g.presses++;
  for(const code in pressed)delete pressed[code];
  if(g.presses>=GORATH_GRAB.presses){releaseGorathGrab('escape');return;}
  const tx=clamp(o.x+o.face*GORATH_GRAB.offset,camX+20,camX+VW-20);
  p.x+=clamp(tx-p.x,-GORATH_GRAB.pullSpeed,GORATH_GRAB.pullSpeed);
  p.y+=clamp(o.y-p.y,-2,2);p.face=-o.face;g.pull++;
  if(Math.abs(tx-p.x)<=1 || g.pull>=45)g.hold++;
  g.hook.x=p.x;g.hook.y=p.y;g.hook.h=58;
  if(g.hold>=GORATH_GRAB.hold)releaseGorathGrab('fail');
}
function drawGorathGrab() {
  const p=player,g=p.grab;if(p.st!=='grabbed'||!g)return;
  const x=p.x-camX,y=p.y-120;
  outlineText(`공격 / 방향키 연타 ${g.presses}/${GORATH_GRAB.presses}`,x,y,'#ffe1ab','bold 12px sans-serif');
  ctx.save();ctx.fillStyle='#28171d';ctx.fillRect(x-35,y+8,70,5);
  ctx.fillStyle='#ffa34d';ctx.fillRect(x-35,y+8,70*(1-g.hold/GORATH_GRAB.hold),5);ctx.restore();
}
