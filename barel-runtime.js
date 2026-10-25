'use strict';
const BAREL_ATLAS = new Image(); BAREL_ATLAS.src = BAREL_ART.atlas;
const BAREL_PORTRAIT = new Image(); BAREL_PORTRAIT.src = BAREL_ART.portrait; BAREL_PORTRAIT.hd = true;
// Match the ordinary soldiers' display scale and pixel sampling.
const BAREL_PLAYER_SCALE = .72;
function barelFrame(name, progress = 0, loop = false) {
  const frames = BAREL_ART.clips[name];
  return frames && frames[Math.min(frames.length-1, Math.max(0, Math.floor((loop ? progress%1 : Math.min(.99999,progress))*frames.length)))];
}
function barelPlayerFrame() {
  const p=player,t=p.t*MS;
  if(p.st==='grabbed')return barelFrame('hook',t/650,true);
  if(p.st==='atk') {
    const replacement=globalThis.BarelCombo0?.frameFor(p,MS);
    if(replacement)return replacement;
    const a=ATK[p.atk] || ATK.c1, duration=p.atk==='air'?400:a.wind+a.act+a.rec;
    return barelFrame(p.atk==='air'?'air':'combo'+p.combo,t/duration);
  }
  if(p.st==='skill') return SKILLS[p.skill] ? barelFrame(p.skill==='redwave'?'cast':p.skill,t/SKILLS[p.skill].dur) : barelFrame('idle');
  if(p.st==='special') return t<1260?barelFrame('super1',t/1260):barelFrame('super2',(t-1260)/740);
  if(p.st==='cast') return barelFrame('cast',t/MAGIC.dur);
  if(p.st==='dash') return barelFrame('dash',t/DASH.dur);
  if(p.st==='hurt') return barelFrame('hurt',t/280);
  if(p.st==='down') return barelFrame('down',t/930);
  if(p.st==='dead') return barelFrame('death',t/1000);
  if(p.z>0) return barelFrame('jump',p.vz>0?.25:.65);
  if(scene==='clear'||scene==='ending') return barelFrame('victory',tick*MS/1500,true);
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
  if(actor.flash>0 && UX.options.flash)ctx.filter='brightness(1.8)';
  ctx.drawImage(image,x,y,w,h,-ax,-ay,w,h);ctx.restore();return true;
}
function barelEffect(name,progress,x,y,width=180,height=150,face=player.face,alpha=1) {
  const f=barelFrame(name,progress);if(!f || !BAREL_ATLAS.naturalWidth)return;
  const [sx,sy,w,h]=f.atlas;
  ctx.save();ctx.translate(x-camX,y);ctx.scale(face,1);ctx.globalAlpha=alpha*(UX.options.lowFx?.65:1);
  ctx.globalCompositeOperation='lighter';ctx.drawImage(BAREL_ATLAS,sx,sy,w,h,-width/2,-height,width,height);ctx.restore();
}
function drawBarelPlayer() {
  const p=player,t=p.t*MS;
  if(!paintBarel(barelPlayerFrame(),p,p.st==='dead'?clamp(1-(p.t-65)/35,0,1):1))return false;
  p.tipX=p.x+p.face*72;p.tipH=p.z+68;
  const fx=(name,u,dx=60,w=200,h=160)=>barelEffect(name,u,p.x+p.face*dx,p.y-p.z,w,h);
  if(p.st==='atk') {
    const a=ATK[p.atk] || ATK.c1,u=(t-(a.wind||0))/((a.act||200)+100);
    if(u>=0&&u<1)fx(p.combo===1?'rise':p.combo===2?'impact':'slash',u);
  }
  if(p.st==='dash')barelEffect('dust',t/DASH.dur,p.x-p.face*24,p.y+2,120,30,p.face);
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
