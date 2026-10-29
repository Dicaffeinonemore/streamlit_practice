'use strict';
const BAREL_ATLAS = new Image(); BAREL_ATLAS.src = BAREL_ART.atlas;
const BAREL_PORTRAIT = new Image(); BAREL_PORTRAIT.src = BAREL_ART.portrait; BAREL_PORTRAIT.hd = true;
// Match the ordinary soldiers' display scale and pixel sampling.
const BAREL_PLAYER_SCALE = .72;
// Keep the original seven-frame atlas clip accessible under its backup name.
BAREL_ART.clips.hurt_old ||= BAREL_ART.clips.hurt;
function barelFrame(name, progress = 0, loop = false) {
  const frames = BAREL_ART.clips[name];
  return frames && frames[Math.min(frames.length-1, Math.max(0, Math.floor((loop ? progress%1 : Math.min(.99999,progress))*frames.length)))];
}
function barelPlayerFrame() {
  const p=player,t=p.t*MS;
  if(p.st==='dash_attack')return globalThis.BarelDashAttack?.frameFor(p,MS)||barelFrame('thrust',p.t/DASH_ATTACK.frameEndTicks.at(-1));
  if(p.st==='grabbed')return globalThis.BarelGrabbed?.frameFor(p,MS) || barelFrame('hook',t/650,true);
  if(p.st==='atk') {
    const air=globalThis.BarelAirAttack?.frameFor(p,MS);
    if(air)return air;
    const replacement=globalThis.BarelCombo0?.frameFor(p,MS) || globalThis.BarelCombo1?.frameFor(p,MS) || globalThis.BarelCombo2?.frameFor(p,MS);
    if(replacement)return replacement;
    const a=ATK[p.atk] || ATK.c1, duration=p.atk==='air'?400:a.wind+a.act+a.rec;
    return barelFrame(p.atk==='air'?'air':'combo'+p.combo,t/duration);
  }
  if(p.st==='skill') return SKILLS[p.skill] ? barelFrame(p.skill==='redwave'?'cast':p.skill,t/SKILLS[p.skill].dur) : barelFrame('idle');
  if(p.st==='special') return t<1260?barelFrame('super1',t/1260):barelFrame('super2',(t-1260)/740);
  if(p.st==='cast') return barelFrame('cast',t/MAGIC.dur);
  if(p.st==='dash') return globalThis.BarelDash?.frameFor(p,MS,DASH.dur) || barelFrame('dash',t/DASH.dur);
  if(p.st==='hurt') return globalThis.BarelHurt?.frameFor(p)||barelFrame('hurt_old',t/280);
  if(p.st==='down') return globalThis.BarelDown?.frameFor(p)||barelFrame('down',t/930);
  if(p.st==='dead') return barelFrame('death',t/1000);
  const jump=globalThis.BarelJump?.frameFor(p,MS,scene!=='clear'&&scene!=='ending');
  if(jump)return jump;
  if(p.z>0) return barelFrame('jump',p.vz>0?.25:.65);
  if(scene==='clear'||scene==='ending') return barelFrame('victory',tick*MS/1500,true);
  const walk=globalThis.BarelWalk?.frameFor(p);
  if(walk)return walk;
  const idle=globalThis.BarelIdle?.frameFor(p,tick*MS);
  if(idle)return idle;
  return p.walk?barelFrame('walk',(p.walkTime||0)/900,true):barelFrame('idle',tick*MS/1300,true);
}
function paintBarel(frame,actor,alpha=1) {
  const image=frame?.image || BAREL_ATLAS;
  if(!frame || !image.complete || !image.naturalWidth)return false;
  const [x,y,w,h]=frame.atlas,[ax,ay]=frame.anchor;
  ctx.save();ctx.translate(actor.x-camX,actor.y-(actor.z||0));ctx.scale(actor.face||1,1);
  const scale=BAREL_PLAYER_SCALE*(frame.renderScale || 1);
  ctx.scale(scale,scale);
  ctx.globalAlpha=alpha;ctx.imageSmoothingEnabled=false;
  const lit=actor.flash>0 && UX.options.flash;
  if(lit && actor.st==='hurt')ctx.filter='brightness(1.5) sepia(1) saturate(8) hue-rotate(310deg)';
  drawLit(image,x,y,w,h,-ax,-ay,w,h,lit && actor.st!=='hurt'?1.8:1);ctx.restore();return true;
}
// Shared stable framing for ordinary and boss-challenge selection previews.
function drawBarelIdlePreview(canvas,elapsedMs){
  if(!canvas)return false;
  let view=globalThis.BarelIdle?.preview(elapsedMs);
  if(!view){
    if(!BAREL_ATLAS.complete||!BAREL_ATLAS.naturalWidth)return false;
    const frames=BAREL_ART.clips.idle;
    view={image:BAREL_ATLAS,frame:barelFrame('idle',elapsedMs/1300,true),bounds:[
      Math.min(...frames.map(f=>-f.anchor[0])),Math.min(...frames.map(f=>-f.anchor[1])),
      Math.max(...frames.map(f=>f.atlas[2]-f.anchor[0])),Math.max(...frames.map(f=>f.atlas[3]-f.anchor[1]))]};
  }
  const c=canvas.getContext('2d'),[left,top,right,bottom]=view.bounds;
  const scale=Math.min(Math.min(250,canvas.width-16)/(right-left),Math.min(225,canvas.height-16)/(bottom-top));
  c.clearRect(0,0,canvas.width,canvas.height);
  const [sx,sy,w,h]=view.frame.atlas,[ax,ay]=view.frame.anchor;
  const x=(canvas.width-(left+right)*scale)/2,y=canvas.height-8-bottom*scale;
  c.save();
  try{c.globalAlpha=1;c.imageSmoothingEnabled=false;c.drawImage(view.image,sx,sy,w,h,x-ax*scale,y-ay*scale,w*scale,h*scale);}
  finally{c.restore();}
  return true;
}
function barelEffect(name,progress,x,y,width=180,height=150,face=player.face,alpha=1) {
  const f=barelFrame(name,progress);if(!f || !BAREL_ATLAS.naturalWidth)return;
  const [sx,sy,w,h]=f.atlas;
  ctx.save();ctx.translate(x-camX,y);ctx.scale(name==='moon'?-face:face,1);ctx.globalAlpha=alpha*(UX.options.lowFx?.65:1);
  ctx.globalCompositeOperation='lighter';ctx.drawImage(BAREL_ATLAS,sx,sy,w,h,-width/2,-height,width,height);ctx.restore();
}
function drawBarelPlayer() {
  const p=player,t=p.t*MS;
  globalThis.BarelDashFx?.draw();
  if(!paintBarel(barelPlayerFrame(),p,p.st==='dead'?clamp(1-(p.t-65)/35,0,1):1))return false;
  p.tipX=p.x+p.face*72;p.tipH=p.z+68;
  const fx=(name,u,dx=60,w=200,h=160)=>barelEffect(name,u,p.x+p.face*dx,p.y-p.z,w,h);
  globalThis.BarelComboFx?.draw(p,MS);
  if(p.st==='dash'&&!globalThis.BarelDash?.hasBakedEffects())barelEffect('dust',t/DASH.dur,p.x-p.face*24,p.y+2,120,30,p.face);
  if(p.st==='dash_attack'&&p.t>=3&&p.t<14)barelEffect('dust',(p.t-3)/11,p.x-p.face*24,p.y+2,120,30,p.face);
  for(const dust of globalThis.BarelJump?.dustFor(p)||[])
    barelEffect('dust',dust.age/8,dust.x,dust.y,58,16,dust.face,.65);
  if(p.st==='skill' && SKILLS[p.skill]) {
    const start={thrust:180,slam:330,whirl:150,leap:560,redwave:220}[p.skill];
    const u=(t-start)/(SKILLS[p.skill].dur-start);
    if(u>=0&&u<1)fx({thrust:'slash',slam:'impact',whirl:'moon',leap:'impact',redwave:'wave'}[p.skill],u,p.skill==='whirl'?0:65,p.skill==='whirl'?270:240,190);
  }
  if(p.st==='cast' && t>180)fx('lightning',(t-180)/(MAGIC.dur-180),0,210,270);
  if(p.st==='special') {
    // These sheets have space below the luminous core. Lower that core toward
    // the floor and keep the effect grounded even during the finishing leap.
    const groundFx=(name,u,dx,w,h)=>barelEffect(name,u,p.x+p.face*dx,p.y+h*.3,w,h);
    if(t<620)groundFx('moon',t/620,0,270,240);
    else if(t<1260)groundFx('slash',((t-620)%160)/160,80,300,220);
    else groundFx('impact',(t-1260)/740,50,330,270);
  }
  return true;
}
function setupBarelSkills() {
  const names={thrust:'slash',slam:'impact',whirl:'moon',leap:'lightning',redwave:'wave'};
  document.querySelectorAll('.skillbtn,.touch-skill').forEach(b=>{
    if(b.querySelector('.skill-icon'))return;
    const f=barelFrame(names[b.dataset.skill],.4),[x,y,w,h]=f.atlas;
    const c=document.createElement('canvas');c.width=c.height=96;c.className='skill-icon';c.setAttribute('aria-hidden','true');
    c.getContext('2d').drawImage(BAREL_ATLAS,x,y,w,h,0,0,96,96);b.prepend(c);
    const name=b.querySelector('.name');if(name)b.setAttribute('aria-label',name.textContent);
  });
}
BAREL_ATLAS.addEventListener('load',setupBarelSkills,{once:true});
if(BAREL_ATLAS.complete&&BAREL_ATLAS.naturalWidth)setupBarelSkills();
