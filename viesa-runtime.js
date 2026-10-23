'use strict';
// Viesa uses the same player object, world y-depth / z-height, damage and saves.
const VIESA_SHEETS=VIESA_ART.sheets.map(src=>{const im=new Image();im.src=src;return im;});
const VIESA_PORTRAIT=new Image();VIESA_PORTRAIT.src=VIESA_ART.portrait;VIESA_PORTRAIT.hd=true;
const VIESA_READY=Promise.all([...VIESA_SHEETS,VIESA_PORTRAIT].map(im=>im.decode()));VIESA_READY.catch(()=>{});
const VIESA_SKILLS={
  thrust:{name:'화살 연사',clip:'rapid_start',key:'U'},
  slam:{name:'근접 콤보',clip:'slash1',key:'H'},
  whirl:{name:'돌진 → 지상 백플립',clip:'dash_slash',key:'O'},
  leap:{name:'돌진 → 공중 백플립',clip:'dash_slash',key:'P'},
  redwave:{name:'장거리 저격',clip:'snipe_draw',key:'L'}
};
let viesaEffects=[];
let viesaUltObjects=[];
const viesaEffectPool=[],viesaProjectilePool=[];
let playerControlCharacter='barel';
function isViesa(p=player){return p?.characterId==='viesa';}
function playerHurtScale(){return isViesa() ? .9 : 1;}
function playerBodyHalfWidth(){return 12*playerHurtScale();}
function playerBodyHeight(){return 90*playerHurtScale();}
function viesaFrame(name,index=0){const list=VIESA_ART.clips[name];return list?.[Math.min(list.length-1,Math.max(0,Math.floor(index)))];}
function viesaEffect(name,x,y,h=0,extra={}){
  if(viesaEffects.length>=128)return;
  const f=viesaEffectPool.pop()||{};
  Object.assign(f,{name,x,y,h,age:0,life:18,face:player.face,width:44,height:44},extra);viesaEffects.push(f);
}
function updateViesaEffects(){
  let write=0;for(const f of viesaEffects){if(++f.age<f.life)viesaEffects[write++]=f;else viesaEffectPool.push(f);}viesaEffects.length=write;
}
function resetViesaEffects(){
  for(const f of viesaEffects)viesaEffectPool.push(f);viesaEffects=[];
  for(const z of viesaUltObjects){z.cast=null;viesaProjectilePool.push(z);}viesaUltObjects=[];
}
function viesaPose(p=player){
  const action=p.viesaAction;
  if(p.st==='dead')return viesaFrame('death',Math.floor(p.t/5));
  if(p.st==='down')return p.t<32?viesaFrame('knockdown',Math.floor(p.t/5)):viesaFrame('getup',Math.floor((p.t-32)/4));
  if(p.st==='hurt'||p.st==='grabbed')return viesaFrame('hurt',Math.floor(p.t/4));
  if(p.st==='atk')return viesaFrame(p.viesaClip,Math.floor(p.t/4));
  if(p.st==='cast')return viesaFrame('snipe_draw',Math.min(5,Math.floor(p.t/5)));
  if(p.st==='special'&&action)return viesaFrame(action.phase,action.phase==='ult_barrage'?Math.floor(p.t/3)%7:Math.floor(p.t/4));
  if(p.st==='skill'&&action){
    if(action.phase==='snipe_draw')return viesaFrame('snipe_draw',p.t<18?Math.floor(p.t/3):4+Math.floor((p.t-18)/5)%2);
    if(action.phase==='rapid_loop')return viesaFrame('rapid_loop',Math.floor(p.t/3)%6);
    if(action.phase==='hover')return viesaFrame('backflip',5);
    if(action.phase==='land_backflip')return viesaFrame('backflip',6+Math.floor(p.t/4));
    if(action.phase==='land_jump')return viesaFrame('jump',5);
    return viesaFrame(action.phase,Math.floor(p.t/4));
  }
  if(p.st==='dash')return viesaFrame('run',Math.floor(p.t/2)%8);
  if(p.z>0)return viesaFrame('jump',p.vz>0?Math.min(3,Math.floor((p.jumpTime||0)/6)):4);
  return p.walk?viesaFrame('walk',Math.floor((p.walkTime||0)/80)%8):viesaFrame('idle',Math.floor(tick/6)%8);
}
function paintViesa(frame,actor,alpha=1){
  const im=frame&&VIESA_SHEETS[frame.sheet];if(!im?.naturalWidth)return false;
  const [x,y,w,h]=frame.atlas,[ax,ay]=frame.anchor,k=VIESA_ART.scale;
  ctx.save();ctx.translate(actor.x-camX,actor.y-(actor.z||0));ctx.scale(actor.face||1,1);ctx.globalAlpha*=alpha;
  smoothFor(k);if(actor.flash>0&&UX.options.flash)ctx.filter='brightness(1.8)';
  ctx.drawImage(im,x,y,w,h,-ax*k,-ay*k,w*k,h*k);ctx.restore();return true;
}
function drawViesaFx(name,frame,x,y,h,width,height,face=1,alpha=1){
  const f=viesaFrame('fx_'+name,frame),im=f&&VIESA_SHEETS[f.sheet];if(!im?.naturalWidth)return;
  const [sx,sy,sw,sh]=f.atlas;
  ctx.save();ctx.translate(x-camX,y-h);ctx.scale(face,1);ctx.globalAlpha*=alpha;
  if(f.additive)ctx.globalCompositeOperation='lighter';smoothFor(height/sh);
  ctx.drawImage(im,sx,sy,sw,sh,-width/2,-height/2,width,height);ctx.restore();
}
function drawViesaPlayer(){
  if(!isViesa())return false;
  const p=player,frame=viesaPose(),a=p.viesaAction;
  if(p.st==='special'&&a&&a.phase!=='ult_leap'){
    const fading=a.phase==='ult_final'&&p.t>=8;
    const f=fading?5:a.phase==='ult_summon'&&p.t<8?Math.floor(p.t/4):2+Math.floor((a.clock||0)/4)%3;
    const size=VIESA_ART.worldHeight*1.6,alpha=fading?clamp(1-(p.t-8)/12,0,1):1;
    drawViesaFx('moon_sigil',f,p.x-p.face*24,p.y,p.z+VIESA_ART.worldHeight*.55,size,size,p.face,alpha);
  }
  paintViesa(frame,p,p.st==='dead'?clamp(1-(p.t-65)/35,0,1):1);
  p.tipX=p.x+p.face*(frame.tip?.[0]??42)*VIESA_ART.scale;p.tipH=p.z+(frame.tip?.[1]??80)*VIESA_ART.scale;
  if(p.st==='skill'&&a){
    if(a.phase==='snipe_draw'&&p.t>=12)drawViesaFx('charge_glow',Math.floor(p.t/4)%6,p.tipX,p.y,p.tipH,40,40,p.face);
    if(a.phase==='dash_slash')drawViesaFx('dash_streak',Math.min(4,Math.floor(p.t/5)),p.x-p.face*28,p.y,28,100,38,p.face);
  }
  return true;
}
function drawViesaProjectiles(){
  for(const z of hazards){
    if(z.type!=='viesa_arrow'||z.dead)continue;
    const length=VIESA_ART.worldHeight*.45,height=z.snipe?18:12;
    if(z.fading){drawViesaFx('arrow_fade',Math.floor(z.fadeAge/3),z.x,z.y,z.h,length,height,z.dir,1-z.fadeAge/15);continue;}
    if(z.snipe)drawViesaFx('snipe_arrow',Math.floor(z.age/MS/2)%4,z.x,z.y,z.h,length,height,z.dir);
    else{
      ctx.save();if(z.vh) {ctx.translate(z.x-camX,z.y-z.h);ctx.rotate(-Math.atan2(z.vh,Math.abs(z.speed))*z.dir);ctx.translate(-(z.x-camX),-(z.y-z.h));}
      drawViesaFx('arrow_trail',Math.floor(z.age/MS/2)%3,z.x-z.dir*length*.6,z.y,z.h,length,14,z.dir,.8);
      drawViesaFx('arrow',0,z.x,z.y,z.h,length,10,z.dir);ctx.restore();
    }
  }
  for(const f of viesaEffects){
    const index=Math.floor(f.age/f.life*(VIESA_ART.clips['fx_'+f.name]?.length||1));
    drawViesaFx(f.name,index,f.x,f.y,f.h,f.width||44,f.height||44,f.face,1-f.age/f.life*.65);
  }
  for(const z of viesaUltObjects){
    const size=VIESA_ART.worldHeight*(z.kind==='giant'?1.5:z.kind==='volley'?.8:.35);
    ctx.save();ctx.translate(z.x-camX,z.y-z.h);ctx.rotate(Math.atan2((z.ty-z.th)-(z.sy-z.sh),z.tx-z.sx)-(z.face<0?Math.PI:0));ctx.translate(-(z.x-camX),-(z.y-z.h));
    drawViesaFx(z.kind==='giant'?'giant_arrow':z.kind==='volley'?'volley':'phantom_arrow',z.kind==='phantom'?z.variant:Math.floor(z.age/2)%4,z.x,z.y,z.h,size,z.kind==='volley'?35:size*.25,z.face);
    ctx.restore();
  }
}
function canStartViesaSkill(id){
  const p=player;if(!VIESA_SKILLS[id]||!p||id!=='slam'&&p.skillCd[id]>0||scene!=='play')return false;
  if(p.z>0&&(id!=='leap'||p.viesaAirPUsed))return false;
  if(id==='slam'&&p.st==='atk'&&['slash1','slash2','kick'].includes(p.viesaClip))return true;
  return p.st==='free'||p.st==='dash'&&p.t*MS>=110||p.st==='atk'&&p.t>=16||id==='leap'&&p.st==='skill'&&p.viesaAction?.phase==='hover';
}
function viesaBeginAction(phase,{id=null,high=false}={}){
  const p=player;aimPlayerSkill();
  p.st='skill';p.t=0;p.vx=0;p.skill=id;p.combo=p.comboT=p.buf=0;p.hitSet=new Set();
  p.viesaHoverGrace=0;p.viesaAction={phase,id,held:0,shots:0,x0:p.x,face:p.face,high,h0:p.z,released:false};
  reactAurelionAttack();
  return true;
}
function beginViesaSpecial(){
  const p=player;if(p.st!=='free'||p.z>0||p.sp<SP_MAX)return false;
  viesaBeginAction('ult_leap');p.st='special';p.sp=0;p.vz=0;
  Object.assign(p.viesaAction,{clock:0,hitTimes:new Map(),arrows:0});sfx('viesaUltimate');
  return true;
}
function startViesaSkill(id){
  if(!canStartViesaSkill(id))return false;
  if(id==='slam'){
    if(player.st==='atk'&&['slash1','slash2','kick'].includes(player.viesaClip))player.buf=BUF_MS;
    else startViesaMelee(player.comboT>0&&player.combo<2?player.combo+1:0);
    return true;
  }
  const phase=VIESA_SKILLS[id].clip;viesaBeginAction(phase,{id,high:id==='leap'});
  player.skillCd[id]=SKILLS[id].cd;player.vz=0;
  if(id==='leap')player.viesaAirPUsed=true;
  if(phase==='dash_slash'){player.inv=Math.max(player.inv,2);player.viesaAction.dashHits=new Set();}
  if(phase==='dash_slash')sfx('spdash');
  if(phase==='snipe_draw')sfx('spcharge');
  return true;
}
function viesaNext(phase){const p=player;p.viesaAction.phase=phase;p.viesaAction.x0=p.x;p.viesaAction.h0=p.z;p.t=0;}
function viesaFinish(){const p=player;p.st='free';p.t=0;p.skill=null;p.viesaAction=null;p.comboT=0;p.vz=0;}
function startViesaAttack(n,melee=false){
  const p=player;
  p.st='atk';p.t=0;p.buf=0;p.hitSet=new Set();p.x0=p.x;p.wave=false;p.viesaFired=false;p.viesaShotQueued=false;p.viesaAction=null;
  p.combo=p.comboT=p.viesaHoverGrace=0;p.viesaClip=n==='air'?'jump_shot':'shot';p.atk=n==='air'?'air':'c1';
  // Repeated air shots keep falling instead of restarting a hover each shot.
  if(n==='air')p.vz=clamp(p.vz,-1.6,-.25);
  reactAurelionAttack();if(!melee)sfx('pwave');
}
function startViesaMelee(n){
  const p=player;startViesaAttack(0,true);p.combo=n;p.viesaClip=['slash1','slash2','kick'][n];p.atk=['c1','c2','c3'][n];sfx('swing',n);
}
function updateViesaAttack(){
  const p=player;
  if(p.viesaClip==='jump_shot'&&p.z<=0){p.st='free';p.t=0;p.viesaShotQueued=false;viesaLanding();return;}
  const name=p.viesaClip,frame=Math.floor(p.t/4)+1,duration=VIESA_ART.clips[name].length*4;
  const shooting=name==='shot'||name==='jump_shot';
  if(hit(shooting?'KeyJ':'KeyH')){if(shooting)p.viesaShotQueued=true;else p.buf=BUF_MS;}
  if(name==='shot'||name==='jump_shot'){
    if(frame>=4&&!p.viesaFired){p.viesaFired=true;fireViesaArrow({air:name==='jump_shot'});}
    if(p.viesaShotQueued&&frame>=5){startViesaAttack(name==='jump_shot'?'air':0);return;}
  }else{
    const active=name==='slash2'?frame>=2&&frame<=4:frame>=3&&frame<=4;
    if(active)playerStrike({dmg:Math.round(ATK.c1.dmg*({slash1:.9,slash2:1,kick:1.2}[name])),reach:ATK.c1.reach,kd:name==='kick',fx:name==='kick'?2:1,stop:3,pushScale:name==='kick'?1.3:1});
    if(p.buf>0&&p.combo<2&&p.t>=16){startViesaMelee(p.combo+1);return;}
  }
  if(p.t>=duration){
    const combo=['slash1','slash2','kick'].includes(name);p.st='free';p.t=0;
    p.comboT=combo&&p.combo<2?Math.round(LINK_MS/MS):0;
    if(p.buf>0&&combo&&p.combo<2)startViesaMelee(p.combo+1);
    else if(p.viesaShotQueued&&shooting)startViesaAttack(name==='jump_shot'?'air':0);
    else if(p.combo===2)p.combo=0;
    if(name==='jump_shot'&&p.st==='free')p.viesaHoverGrace=6;
  }
}
function fireViesaArrow({air=false,snipe=false,rapid=false,paidSpecial=false,laneOffset=0}={}){
  const p=player,range=snipe?VW*2:VW/3,speed=snipe?VW/5:range/24,depth=24*1.3;
  const target=enemies.filter(e=>canHit(e)&&(e.x-p.x)*p.face>0&&(e.x-p.x)*p.face<=range&&Math.abs(e.y-p.y)<=depth*2)
    .sort((a,b)=>Math.abs(a.x-p.x)-Math.abs(b.x-p.x))[0];
  const y=clamp(p.y+laneOffset,GTOP+1,GBOT),mul=p.buff>0?1.5:1;
  hazards.push({type:'viesa_arrow',x:p.x+p.face*26,y,h:p.z+VIESA_ART.worldHeight*.6,dir:p.face,age:0,
    speed,vh:air?-speed*Math.tan(Math.PI/6):0,range,travel:0,depth,aimY:target&&!laneOffset?target.y:y,startY:y,
    damage:Math.round((snipe?ATK.c1.dmg*2.5:rapid?10:8)*mul),snipe,paidSpecial,hits:new Set(),auxHits:new Set(),fadeAge:0});
  sfx(snipe?'viesaSnipe':'viesaArrow');
}
function fadeViesaArrow(z){if(!z.fading){z.fading=true;z.fadeAge=0;}}
function updateViesaProjectile(z){
  if(z.type!=='viesa_arrow')return false;
  if(z.fading){if(++z.fadeAge>=15)z.dead=true;return true;}
  if(z.snipe&&(z.x<camX||z.x>camX+VW)){z.dead=true;return true;}
  const p=player,from=z.x,remaining=z.snipe?Math.max(0,Math.min(z.speed,z.dir>0?camX+VW-z.x:z.x-camX)):Math.min(z.speed,z.range-z.travel);
  z.x+=z.dir*remaining;z.travel+=remaining;z.h+=z.vh;
  const age=Math.floor(z.age/MS);if(age<=8)z.y=lerp(z.startY,z.aimY,Math.min(1,age/8));
  const dx=Math.abs(z.x-from),origin={x:from,y:z.y,h:z.h-44,face:z.dir,depth:z.depth,damage:z.damage,kd:z.snipe};
  const previous=z.auxHits.size;
  strikeVargulOrbs(dx,0,z.auxHits,origin);
  const blocked=strikeSovereignFists(dx,0,z.auxHits,origin);
  strikeMorgraCrows(dx,0,{x:from,y:z.y,z:z.h-44,face:z.dir});
  if(!z.snipe&&(blocked||z.auxHits.size>previous)){z.dead=true;viesaEffect('hit_spark',z.x,z.y,z.h);return true;}
  const contacts=[...enemies.filter(e=>canHit(e)&&!z.hits.has(e)&&!(blocked&&isSovereign(e))&&Math.abs(e.y-z.y)<z.depth&&
    z.h>=e.z-5&&z.h<=e.z+Math.max(80,e.d.h*e.d.s)&&e.x+e.hw>=Math.min(from,z.x)-4&&e.x-e.hw<=Math.max(from,z.x)+4),
    ...barrels.filter(b=>!b.dead&&!z.hits.has(b)&&Math.abs(b.y-z.y)<z.depth&&z.h<80&&b.x+b.hw>=Math.min(from,z.x)-4&&b.x-b.hw<=Math.max(from,z.x)+4)]
    .sort((a,b)=>Math.abs(a.x-from)-Math.abs(b.x-from));
  for(const e of contacts){
    z.hits.add(e);if(e.kind==='barrel')damageBarrel(e);else{damageEnemy(e,z.damage,z.snipe,z.snipe?2:1);if(!z.paidSpecial)p.sp=Math.min(SP_MAX,p.sp+4);}
    viesaEffect('hit_spark',e.x,z.y,z.h,{width:48,height:48});
    if(!z.snipe){z.x=e.x;z.dead=true;break;}
  }
  if(z.h<0||!z.snipe&&z.travel>=z.range)fadeViesaArrow(z);
  if(z.snipe&&(z.x<=camX||z.x>=camX+VW)||z.age>3500)z.dead=true;
  return true;
}
// Sweep the whole movement segment; each target takes dash damage only once.
function viesaDashStrike(from,hits){
  const p=player;if(!hits)return;
  const reach=Math.abs(p.x-from)+20,damage=Math.round(20*(p.buff>0?1.5:1));
  const origin={x:from,y:p.y,h:p.z,face:p.face,depth:24,damage,kd:false};
  strikeMorgraCrows(reach,20,{x:from,y:p.y,z:p.z,face:p.face});
  strikeVargulOrbs(reach,20,hits,origin);
  const blocked=strikeSovereignFists(reach,20,hits,origin);
  for(const e of enemies){
    if(!canHit(e)||hits.has(e)||blocked&&isSovereign(e))continue;
    const dx=(e.x-from)*p.face;
    if(dx < -20-e.hw||dx > reach+e.hw||Math.abs(e.y-p.y)>=24||Math.abs(e.z-p.z)>=55)continue;
    hits.add(e);damageEnemy(e,damage,false,1);p.sp=Math.min(SP_MAX,p.sp+5);
  }
}
function updateViesaAction(){
  const p=player,a=p.viesaAction;if(!a){viesaFinish();return;}
  const phase=a.phase;
  if(a.id==='whirl')hit('KeyJ'); // O never queues a shot during its grounded sequence.
  if(phase==='snipe_draw'){
    a.held++;
    if(!down('KeyL'))a.released=true;
    if(a.held>=30&&(a.released||a.held>=120))viesaNext('snipe_release');
  }else if(phase==='snipe_release'){
    if(p.t>=4&&!a.shots){a.shots++;fireViesaArrow({snipe:true});}
    if(p.t>=24)viesaFinish();
  }else if(phase==='rapid_start'){
    if(p.t>=16)viesaNext('rapid_loop');
  }else if(phase==='rapid_loop'){
    if([0,9,18,27,36,45].includes(p.t-1)&&a.shots<6){
      const lane=Number(down('ArrowDown','KeyS'))-Number(down('ArrowUp','KeyW'));
      fireViesaArrow({rapid:true,laneOffset:lane*24*1.3});a.shots++;
    }
    if(p.t>=54)viesaNext('rapid_end');
  }else if(phase==='rapid_end'){
    if(p.t>=16)viesaFinish();
  }else if(phase==='dash_slash'){
    const previousX=p.x;
    p.x=a.x0+a.face*(VW/4)*Math.min(1,p.t/16);p.z=a.h0;p.vz=0;
    if(p.t<=16){p.inv=Math.max(p.inv,2);viesaDashStrike(previousX,a.dashHits);}
    const frame=Math.floor(p.t/4)+1;
    if(frame>=5&&frame<=6)playerStrike({dmg:Math.round(ATK.c1.dmg*1.6),reach:ATK.c1.reach,kd:true,fx:2,stop:4});
    if(p.t>=28){viesaNext('backflip');if(a.high&&a.h0>0){p.t=4;p.inv=Math.max(p.inv,1);}}
  }else if(phase==='backflip'){
    const frame=Math.floor(p.t/4)+1,u=clamp(a.high&&a.h0>0?(p.t-4)/20:p.t/24,0,1),height=VIESA_ART.worldHeight;
    p.x=a.x0-a.face*(a.high?VW/4:VW/3)*u;p.vz=0;
    p.z=a.high?a.h0>0?a.h0+height*.3*Math.sin(u*Math.PI/2):height*Math.sin(u*Math.PI/2):height*.5*Math.sin(Math.PI*u);
    if(frame>=2&&frame<=6)p.inv=Math.max(p.inv,1);
    if(p.t>=24){
      if(a.high){viesaNext('hover');p.viesaLanding='backflip';}
      else{p.z=0;viesaNext('land_backflip');viesaLandingDust();}
    }
  }else if(phase==='hover'){
    p.z+=p.vz;p.vz-=.55*.25;
    if(p.z<=0){p.z=p.vz=0;viesaLanding();}
    else if(hit('KeyJ'))startViesaAttack('air');
    else if(p.t>=40){const falling=p.vz;p.viesaLanding='backflip';viesaFinish();p.vz=falling;}
  }else if(phase==='land_backflip'||phase==='land_jump'){
    if(p.t>=8){p.viesaAirPUsed=false;p.viesaLanding=null;viesaFinish();}
  }
}
function viesaLandingDust(){viesaEffect('land_dust',player.x,player.y,3,{width:65,height:25,life:20});}
function viesaLanding(){
  const p=player;p.viesaAirPUsed=false;p.viesaHoverGrace=0;
  if(!['free','skill'].includes(p.st))return;
  const phase=p.viesaLanding==='backflip'?'land_backflip':'land_jump';
  viesaBeginAction(phase);viesaLandingDust();
}
function viesaControlsHeight(){
  const p=player;return isViesa()&&(p.st==='special'||
    p.st==='skill'&&['dash_slash','backflip','hover'].includes(p.viesaAction?.phase));
}
function viesaInput(){
  const p=player;
  if(p.z===0&&p.st!=='skill')p.viesaAirPUsed=false;
  if(p.st==='free'&&p.viesaHoverGrace>0)p.viesaHoverGrace--;
  if(p.st==='free'&&p.z===0&&p.sp>=SP_MAX&&hit('KeyK'))return beginViesaSpecial();
  for(const code of ['KeyU','KeyL','KeyO','KeyP']){
    const id=SKILL_KEYS[code];if(canStartViesaSkill(id)&&hit(code))return startViesaSkill(id);
  }
  if(p.z===0&&!(p.st==='atk'&&['slash1','slash2','kick'].includes(p.viesaClip))&&canStartViesaSkill('slam')&&hit('KeyH'))return startViesaSkill('slam');
  return false;
}
function viesaBowPosition(){
  const p=player,f=viesaPose();return {x:p.x+p.face*(f?.tip?.[0]??40)*VIESA_ART.scale,y:p.y,h:p.z+(f?.tip?.[1]??70)*VIESA_ART.scale};
}
function viesaUltProjectile(kind,cast){
  const p=player,start=viesaBowPosition(),height=VIESA_ART.worldHeight,edge=p.face>0?camX+VW-12:camX+12;
  const living=enemies.filter(e=>e.st!=='dead'&&!e.invuln&&(e.x-p.x)*p.face>=0&&e.x>=camX&&e.x<=camX+VW);
  let tx=lerp(p.x,edge,Math.random()),ty=rand(GTOP,GBOT),th=rand(15,55);
  const target=kind==='giant'?living.sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y))[0]:Math.random()<.6?living[Math.floor(Math.random()*living.length)]:null;
  if(target){tx=target.x+(kind==='giant'?0:rand(-12,12));ty=target.y;th=kind==='giant'?0:target.z+40;}
  if(kind==='giant'&&!target){tx=clamp(p.x+p.face*VW*.4,camX+12,camX+VW-12);ty=p.y;th=0;}
  const z=viesaProjectilePool.pop()||{};
  Object.assign(z,{kind,cast,sx:start.x,sy:start.y,sh:start.h,x:start.x,y:start.y,h:start.h,tx,ty,th,face:p.face,age:0,
    life:Math.max(3,Math.ceil(Math.hypot(tx-start.x,ty-start.y,th-start.h)/(kind==='giant'?55:75))),variant:Math.floor(Math.random()*4),
    impact:kind==='phantom'&&(cast.arrows%3===0),damage:(kind==='giant'?160:4)*(p.buff>0?1.5:1)});
  viesaUltObjects.push(z);
}
function updateViesaUltimate(){
  const p=player,a=p.viesaAction;if(!a){viesaFinish();return;}
  a.clock++;p.vz=0;const height=VIESA_ART.worldHeight;
  if(a.phase==='ult_leap'){
    p.z=height*1.2*clamp((p.t-12)/12,0,1);
    if(p.t>=24)viesaNext('ult_summon');
  }else if(a.phase==='ult_summon'){
    if(p.t>=16)viesaNext('ult_barrage');
  }else if(a.phase==='ult_barrage'){
    for(let i=0;i<4;i++){a.arrows++;viesaUltProjectile('phantom',a);}
    if(p.t%4===0)viesaUltProjectile('volley',a);
    if(p.t>=50)viesaNext('ult_final');
  }else if(a.phase==='ult_final'){
    if(p.t>=8&&!a.finalFired){a.finalFired=true;viesaUltProjectile('giant',a);sfx('bwave');}
    if(p.t>=12)p.z=height*1.2*(1-clamp((p.t-12)/4,0,1));
    if(p.t>=16&&!a.landed){a.landed=true;viesaLandingDust();}
    if(p.t>=24){p.z=0;p.viesaAirPUsed=false;viesaFinish();}
  }
}
function updateViesaUltimateProjectiles(){
  let write=0;
  for(const z of viesaUltObjects){
    const u=clamp(++z.age/z.life,0,1);z.x=lerp(z.sx,z.tx,u);z.y=lerp(z.sy,z.ty,u);z.h=lerp(z.sh,z.th,u);
    if(u<1){viesaUltObjects[write++]=z;continue;}
    const giant=z.kind==='giant',radius=VIESA_ART.worldHeight*1.2;let blocked=false;
    if(giant){
      viesaEffect('ult_explosion',z.tx,z.ty,35,{width:VIESA_ART.worldHeight*2.5,height:VIESA_ART.worldHeight*1.5,life:28});
      shake=Math.max(shake,18);sfx('moon');
      const opts={x:z.tx,y:z.ty,h:0,face:1,depth:radius,damage:z.damage,kd:true};
      strikeVargulOrbs(radius,radius,new Set(),opts);blocked=strikeSovereignFists(radius,radius,new Set(),opts);
    }else if(z.impact)viesaEffect('ult_impact',z.tx,z.ty,z.th,{width:44,height:44,life:12});
    if(z.kind!=='volley')for(const e of enemies){
      if(e.st==='dead'||e.invuln||e.inv>0||e.phaseT>0||e.st==='intro'||blocked&&isSovereign(e))continue;
      const inside=giant?Math.hypot(e.x-z.tx,e.y-z.ty)<=radius+e.hw:Math.abs(e.x-z.tx)<=e.hw+12&&Math.abs(e.y-z.ty)<=24*1.3&&Math.abs(e.z+40-z.th)<65;
      if(!inside||!giant&&tick-(z.cast.hitTimes.get(e)??-Infinity)<3)continue;
      z.cast.hitTimes.set(e,tick);const stop=hitStop;
      damageEnemy(e,z.damage,giant,giant?2:0);
      if(!giant&&e.st!=='dead'&&!e.phaseT)hitStop=stop;
    }
    if(giant)for(const b of barrels)if(!b.dead&&Math.hypot(b.x-z.tx,b.y-z.ty)<=radius)damageBarrel(b);
    z.cast=null;viesaProjectilePool.push(z);
  }
  viesaUltObjects.length=write;
}
function playerActionLabel(action,fallback){
  const v=playerControlCharacter==='viesa';
  if(!v)return fallback;
  return ({KeyJ:'화살 / 공중 체공 사격',KeyH:'근접 콤보',KeyU:'화살 연사',KeyL:'장거리 저격 (유지/해제)',KeyO:'돌진 → 지상 백플립',KeyP:'돌진 → 공중 백플립',KeyK:'필살기 흑월 난사'})[action]||fallback;
}
function syncPlayerCharacterUI(id){
  playerControlCharacter=id;
  const v=id==='viesa';document.body.classList.toggle('viesa-player',v);
  const guide=document.getElementById('viesaControlGuide');if(guide)guide.hidden=!v;
  document.querySelector('#tutorial .grid').hidden=v;
  document.querySelectorAll('#tutorial .tips').forEach(el=>el.hidden=v);
  document.querySelectorAll('.skillbtn').forEach(b=>{const skill=b.dataset.skill;b.hidden=v&&!VIESA_SKILLS[skill];const label=b.querySelector('.name');if(label)label.textContent=v?VIESA_SKILLS[skill]?.name||'':SKILLS[skill].name;});
  document.querySelectorAll('#touchPad [data-control]').forEach(b=>{b.hidden=v&&b.dataset.control==='KeyI';b.setAttribute('aria-label',playerActionLabel(b.dataset.control,b.dataset.originalLabel||(b.dataset.originalLabel=b.getAttribute('aria-label')||'')));});
  UX.refreshBindings?.();
}
function drawViesaHUDPortrait(x,y,rx,ry){
  if(!VIESA_PORTRAIT.naturalWidth)return;
  ctx.save();ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.clip();
  ctx.fillStyle='#21101f';ctx.fillRect(x-rx,y-ry,rx*2,ry*2);
  ctx.drawImage(VIESA_PORTRAIT,x-rx,y-ry,rx*2,ry*2);ctx.restore();
}
