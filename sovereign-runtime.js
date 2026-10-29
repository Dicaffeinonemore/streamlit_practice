'use strict';
const SOV_GROUP=GameAssets.group(4,SOVEREIGN_ART.sheets);
const SOV_SHEETS=SOV_GROUP.images;
const SOV_CANNON_GROUP=GameAssets.group(4,['assets/runtime/2d766e59244fb5309e870ce7.png','assets/runtime/cb05d55301793a95df46dce9.png']);
const SOV_CANNON_IMAGES=SOV_CANNON_GROUP.images;
const SOV_R=SOVEREIGN_RULES,SOV_A=SOVEREIGN_ART;
// Fist body box: half extents of the gauntlet drawing in world px.
const SOV_FIST={len:SOV_A.fistLength,h:SOV_A.fistHeight,hw:SOV_A.fistLength*.45,hh:SOV_A.fistHeight*.45};
const SOV_FIRST_STAGE={direct:'wind',slam:'rise',hammer:'rise',grab:'wind',clap:'move',wave:'rise',wall:'move',whirl:'warn',
  backhand:'warn',meteor:'rise',ultimate:'channel',beam:'charge'};
let sovereignRemains=[];
function isSovereign(e){return e?.type==='boss5';}
function sovP2(e){return e.p2shown?1:0;}
function sovData(e){
  return e.sov||={now:0,jobs:[],cooldowns:{},marks:[],waves:[],fx:[],pressure:0,pressureT:0,forceBackhand:false,
    lastMove:null,repeats:0,lastDangerEnd:-999,dangerWas:false,pending:null,grounded:false,body:null,downAt:0,transAge:0,
    fists:[0,1].map(i=>({i,x:e.x,y:e.y,h:420,face:e.face,st:'intro',hp:SOV_R.fistHp[0],max:SOV_R.fistHp[0],pose:1,angle:0,
      glow:null,trail:false,timer:0,wake:1,flash:0,vh:0,broken:false,job:null}))};
}
function sovClip(e,name){return e.p2shown&&SOV_A.clips[name+'_p2']?name+'_p2':name;}
function sovGap(e){const [a,b]=SOV_R.gaps[sovP2(e)];return SOV_R.attackDelay+Math.round(rand(a,b));}
function sovereignIntroDuration(){return SOV_R.intro*MS;}
function bossIntroDuration(e){return isSovereign(e)?sovereignIntroDuration(e):vargulIntroDuration(e);}
function sovStanding(e){return !['stun','down','dead'].includes(e.st)&&!e.phaseT;}
function sovActive(f){return ['home','job','return'].includes(f.st);}
function sovWalling(f){return f.job?.id==='wall'&&f.job.stage!=='open';}
function sovHome(e,f,s){
  const [dx,h]=SOV_R.home[f.i?'back':'front'],bob=Math.sin((s.now/SOV_R.home.period+f.i*.5)*Math.PI*2)*SOV_R.home.bob;
  return [e.x+e.face*dx,e.y,h+bob];
}
function sovMove(f,x,y,h,v){
  const dx=x-f.x,dy=y-f.y,dh=h-f.h,d=Math.hypot(dx,dy,dh);
  if(d<=v){f.x=x;f.y=y;f.h=h;return true;}
  f.x+=dx/d*v;f.y+=dy/d*v;f.h+=dh/d*v;return false;
}
function sovFx(e,id,x,y,h,w,hgt,life,extra={}){sovData(e).fx.push({id,x,y,h,w,hgt,life,age:0,face:1,...extra});}
function sovGo(job,stage){job.stage=stage;job.st=-1;}   // job.st is advanced after the job's tick

// ---------------------------------------------------------------- hits on Barel
function sovTouch(f,o={}){
  const p=player,hw=(o.hw??SOV_FIST.hw)+playerBodyHalfWidth(),from=o.fromX??f.x;
  const lo=o.low??f.h-SOV_FIST.hh,hi=o.high??f.h+SOV_FIST.hh;
  return p.st!=='dead'&&p.x>=Math.min(f.x,from)-hw&&p.x<=Math.max(f.x,from)+hw&&
    Math.abs(p.y-f.y)<(o.depth??20)*playerHurtScale()&&p.z<=hi&&p.z+playerBodyHeight()>=lo;
}
function sovHurt(e,job,key,damage,kd,from,push=0,hitHeight=from.h??player.z+56){
  if(job.hits.has(key))return false;
  const dir=Math.sign(player.x-from.x)||e.face,hit=hurtPlayer(damage,dir,kd,e,{hitHeight});
  if(hit){job.hits.add(key);if(push)player.vx=dir*push;}
  return hit;
}
function sovInMark(m){const p=player;return ((p.x-m.x)/m.rx)**2+((p.y-m.y)/m.ry)**2<=1&&p.z<70;}
function sovRemoveMark(s,m){s.marks=s.marks.filter(q=>q!==m);}
function sovImpact(e,f){sovFx(e,'fist_impact',f.x,f.y,10,80,70,18);shake=Math.max(shake,12);sfx('slam');}

// ---------------------------------------------------------------- Barel hits the fists (fists are shields)
// Returns true when a fist (or the iron wall) took the strike: the body is not hit by it.
function strikeSovereignFists(reach,behind=8,hitSet=player.hitSet,o={}){
  if(!hitSet)return false;
  const p=player,x=o.x??p.x,y=o.y??p.y,h=o.h??p.z,face=o.face??p.face,depth=o.depth??24;
  let blocked=false;
  for(const e of enemies){
    if(!isSovereign(e)||!e.sov||e.st==='dead'||e.st==='intro')continue;
    const s=e.sov;
    for(const f of s.fists){
      if(!sovActive(f))continue;
      const dx=(f.x-x)*face,over=o.global||dx>=-behind-SOV_FIST.hw&&dx<=reach+SOV_FIST.hw&&Math.abs(f.y-y)<depth+6&&
        f.h+SOV_FIST.hh>=h+25&&f.h-SOV_FIST.hh<=h+75;
      if(!over)continue;
      if(!o.global)blocked=true;
      if(hitSet.has(f))continue;
      hitSet.add(f);
      if(sovWalling(f)){sparks(f.x,f.y,f.h,8,'#ffd2ec');playerHitSfx(0,o.hitSound);continue;}
      sovDamageFist(e,f,o.damage??ATK.c1.dmg,!!o.kd,o.hitSound);sovPressure(e);
    }
    // Iron wall: every attack from the front side is turned away with sparks.
    if(!o.global&&s.jobs.some(j=>j.id==='wall'&&j.stage==='guard')&&Math.sign(x-e.x)===e.face&&
        Math.abs(e.x-x)<reach+60&&Math.abs(e.y-y)<depth+10){
      blocked=true;
      if(!hitSet.has(s)){hitSet.add(s);sparks(e.x+e.face*45,e.y,70,8,'#ffd2ec');playerHitSfx(0,o.hitSound);}
    }
  }
  return blocked;
}
function sovDamageFist(e,f,dmg,kd,hitSound=null){
  if(!sovActive(f)||practice)return;
  dmg=Math.round(dmg*(kd?SOV_R.kdFistMul:1));f.hp-=dmg;f.flash=6;
  if(dmg>0)sfx('hurt');
  floatText(f.x,f.y-f.h-30,dmg,'#ffb3d8');impact(f.x,f.y,f.h-12,kd?2:1,Math.sign(f.x-player.x)||1);
  hitStop=Math.max(hitStop,kd?5:3);playerHitSfx(kd?2:0,hitSound);
  if(f.hp<=0)sovBreakFist(e,f);
}
function sovBreakFist(e,f){
  if(f.broken||!sovActive(f))return;
  const s=sovData(e);if(f.job)sovEndJob(e,s,f.job);
  f.st='fallen';f.broken=true;f.timer=SOV_R.fallen[sovP2(e)];f.vh=0;f.glow=null;f.trail=false;f.wake=0;f.hp=0;
  sovFx(e,'fist_shatter',f.x,f.y,f.h,100,100,30);shake=Math.max(shake,12);hitStop=Math.max(hitStop,8);sfx('groggy');
  floatText(f.x,f.y-f.h-46,'주먹 파괴!','#ff7ab8');
  if(!practice&&e.st!=='dead'&&!e.phaseT){
    const roll=Math.random(),drops=SOV_R.fistDrops;
    const type=roll<drops.potion?'potion':roll<drops.potion+drops.scroll?'scroll':null;
    if(type)dropItem(type,clamp(f.x,camX+20,camX+VW-20),clamp(f.y,GTOP+8,GBOT-8));
  }
  if(e.st==='dead'||e.phaseT>0||e.st==='stun')return;
  e.gr=Math.min(e.grMax,e.gr+SOV_R.fistGroggy);e.grT=150;
  // Both fists lying broken: immediate groggy (the biggest counter window).
  if(e.gr>=e.grMax||s.fists.every(q=>q.st==='fallen'))sovStun(e,GROGGY_TICKS);
}
function sovStun(e,ticks){
  resetBossFx(e);e.st='stun';e.t=GROGGY_TICKS-ticks;e.vx=e.vz=e.z=0;
  shake=Math.max(shake,16);sfx('groggy');floatText(e.x,e.y-e.d.h-40,'GROGGY!','#ffe14d');
}
// Consecutive hits outside an opening make the next action a backhand.
function sovOpening(e,s){
  return ['stun','down'].includes(e.st)||s.fists.some(f=>['dropped','fallen','rise'].includes(f.st)||
    f.job&&['recover','stuck','stagger','open','dazed'].includes(f.job.stage))||s.jobs.some(j=>j.id==='beam'&&j.stage==='recovery');
}
function sovPressure(e){
  const s=sovData(e);if(sovOpening(e,s))return;
  s.pressure++;s.pressureT=SOV_R.pressureDecay;
  if(s.pressure>=SOV_R.pressure[sovP2(e)])s.forceBackhand=true;
}
function interceptSovereignDamage(e){
  if(e.st==='intro'||e.phaseT>0||e.st==='dead')return true;
  sovPressure(e);return false;
}

// ---------------------------------------------------------------- grab (Gorath hook escape rule)
function sovCatch(e,job){
  const p=player;
  if(practice||p.inv>0||['dead','down','special','grabbed'].includes(p.st)||p.z>=40)return false;
  p.st='grabbed';p.t=0;p.grab={sovereign:true,owner:e,job,presses:0,hold:0};
  p.vx=p.vz=p.z=0;p.skill=null;p.combo=p.comboT=p.buf=0;p.walk=false;p.wave=false;clearInput();
  sfx('hit',1);impact(p.x,p.y,58,1,job.dir);return true;
}
function updateSovereignGrab(){
  const p=player,g=p.grab,e=g?.owner;
  if(!g||!e||!enemies.includes(e)||g.job.done||!sovStanding(e)){sovReleaseGrab('cancel');return;}
  p.t++;p.walk=false;p.z=p.vz=p.vx=0;dashReq=0;
  for(const code of GORATH_ESCAPE_KEYS)if(hit(code))g.presses++;
  for(const code in pressed)delete pressed[code];
  if(g.presses>=GORATH_GRAB.presses){sovReleaseGrab('escape');return;}
  if(++g.hold>=GORATH_GRAB.hold)sovReleaseGrab('fail');
}
function sovReleaseGrab(result){
  const p=player,g=p.grab;if(!g?.sovereign)return;
  const e=g.owner,job=g.job,R=SOV_R.grab;
  p.grab=null;p.st='free';p.t=0;p.vx=p.vz=0;clearInput();
  if(!job||job.done){p.inv=Math.max(p.inv,30);return;}
  const f=job.fists[0],dir=Math.sign(p.x-e.x)||e.face,helper=job.helper;
  job.danger=false;job.dangerDone=true;
  if(result==='escape'){
    p.inv=Math.max(p.inv,30);floatText(p.x,p.y-110,'탈출!','#aeeaff');
    job.stage='stagger';job.st=0;sovDamageFist(e,f,R.escapeDamage,false);
  }else if(result==='fail'){
    // Squeeze; the other fist joins with a backhand (allowed exception to the 20-tick rule).
    if(helper?.st==='job'){p.inv=0;hurtPlayer(R.backhand,dir,false,e);sovFx(e,'fist_impact',p.x,p.y,60,70,70,16);}
    p.inv=0;hurtPlayer(R.squeeze,dir,true,e);p.inv=Math.max(p.inv,30);
    job.stage='recover';job.st=0;
  }else{p.inv=Math.max(p.inv,30);job.stage='recover';job.st=0;}
  if(helper?.job===job)sovFinishFist(helper);
  job.helper=null;
}

// ---------------------------------------------------------------- scheduler
function sovAvailable(e,s,id){
  const p2=sovP2(e),home=s.fists.filter(f=>f.st==='home').length;
  if(s.cooldowns[id]>0||s.jobs.some(j=>j.id===id))return false;
  if(s.lastMove===id&&s.repeats>=2)return false;
  if(SOV_R.fists[id]>home)return false;
  if(SOV_R.floor.includes(id)&&(s.marks.length||s.jobs.some(j=>SOV_R.floor.includes(j.id))))return false;
  if((id==='meteor'||id==='ultimate')&&!p2)return false;
  return true;
}
function sovPick(e,s,adx){
  const p2=sovP2(e);
  if(s.forceBackhand&&sovAvailable(e,s,'backhand'))return 'backhand';
  if(p2&&e.hp<=e.max*SOV_R.ultimateAt&&!s.ultimateUsed&&sovAvailable(e,s,'ultimate'))return 'ultimate';
  const band=adx<SOV_R.bands.near?'near':adx<SOV_R.bands.mid?'mid':'far';
  const options=Object.entries(SOV_R.weights[p2][band]).filter(([id])=>sovAvailable(e,s,id));
  if(p2&&s.ultimateUsed&&sovAvailable(e,s,'ultimate'))options.push(['ultimate',SOV_R.ultimateLater]);
  if(!options.length)return null;
  let r=Math.random()*options.reduce((a,[,w])=>a+w,0);
  for(const [id,w] of options)if((r-=w)<0)return id;
  return options.at(-1)[0];
}
// One hit window at a time: a new pattern starts only when every running job has
// finished its hit windows, and its first hit lands >= 20 ticks after the last one ended.
function sovCanStart(e,s,id){
  const p2=sovP2(e);
  if(s.jobs.length>=SOV_R.maxJobs[p2])return false;
  if(s.jobs.some(j=>j.danger||!j.dangerDone))return false;
  return s.now+sovereignFirstHit(id,p2)-s.lastDangerEnd>=SOV_R.dangerGap;
}
function sovStartJob(e,s,id){
  const p=player,need=SOV_R.fists[id],home=s.fists.filter(f=>f.st==='home');
  s.cooldowns[id]=SOV_R.cooldowns[id];s.repeats=s.lastMove===id?s.repeats+1:1;s.lastMove=id;
  let fists=[];
  if(need===2)fists=home.slice(0,2);
  else if(need===1)fists=[id==='backhand'?home.reduce((a,b)=>Math.abs(a.x-p.x)<=Math.abs(b.x-p.x)?a:b):home.find(f=>f.i===0)||home[0]];
  const job={id,t:0,st:0,stage:SOV_FIRST_STAGE[id],fists,hits:new Set(),danger:false,dangerDone:id==='wall',warn:false,done:false,p2:sovP2(e)};
  for(const f of fists){f.st='job';f.job=job;}
  if(id==='backhand'){s.forceBackhand=false;s.pressure=0;}
  if(id==='ultimate'){
    s.ultimateUsed=true;job.hands=[];job.remaining=Math.floor(rand(SOV_R.ultimate.count[0],SOV_R.ultimate.count[1]+1));
    job.elapsedMs=0;job.lastY=null;job.spawned=0;
    for(const f of fists)f.st='reserve';
  }
  s.jobs.push(job);
  e.face=p.x>=e.x?1:-1;
  // command 1-8 pushes the fists forward, 9-16 raises and brings them down.
  const push=['direct','grab','clap','whirl','backhand','wall'].includes(id),own=id==='beam';
  s.body={job,clip:sovClip(e,own?id:'command'),from:own?1:push?1:9,to:own?16:push?8:16,ticks:SOV_R.command,t:0,
    bound:SOV_R.bodyBound.includes(id),drawing:null,idle:false};
  resetBossFx(e);e.st='pat';e.pat=id;e.pt=0;e.walk=false;e.atkCd=sovGap(e);
  sfx('bwind');
}
function sovEndJob(e,s,job){
  if(job.done)return;
  job.done=true;job.danger=false;job.dangerDone=true;
  for(const f of job.fists)if(f.job===job)sovFinishFist(f);
  if(job.helper?.job===job)sovFinishFist(job.helper);
  for(const m of [...s.marks])if(m.job===job)sovRemoveMark(s,m);
  if(player.grab?.job===job)sovReleaseGrab('cancel');
  s.jobs=s.jobs.filter(j=>j!==job);
  if(s.body?.job===job)sovReleaseBody(e);
}
function sovFinishFist(f){f.st='return';f.job=null;f.glow=null;f.trail=false;}
function sovReleaseBody(e){
  const s=sovData(e);s.body=null;
  if(e.st==='pat'){e.st='chase';e.t=0;e.pat=null;e.atkCd=sovGap(e);}
}
function runSovereignPattern(e){
  const b=sovData(e).body;if(!b){sovReleaseBody(e);return;}
  b.t++;
  if(b.t>=b.ticks&&b.clip.startsWith('command')){if(b.bound)b.idle=true;else sovReleaseBody(e);}
}
function chaseSovereign(e){
  const s=sovData(e),p=player,dx=p.x-e.x,dy=p.y-e.y,[sx,sy]=SOV_R.walk[sovP2(e)];
  if(p.st==='dead')return;
  if(Math.abs(dx)>24)e.face=dx>=0?1:-1;
  if(e.atkCd<=0&&p.st!=='down'&&p.st!=='grabbed'){
    let id=null;
    if(s.pending&&s.now<s.pending.until&&sovAvailable(e,s,s.pending.id))id=s.pending.id;
    else{s.pending=null;id=sovPick(e,s,Math.abs(dx));}
    if(id){
      if(sovCanStart(e,s,id)){s.pending=null;sovStartJob(e,s,id);return;}
      s.pending||={id,until:s.now+SOV_R.pendingTicks};   // start is delayed, not cancelled
    }
    e.atkCd=6;
  }
  const tx=p.x-e.face*95;
  e.x+=clamp(tx-e.x,-sx,sx);e.y+=clamp(dy,-sy,sy);
  e.walk=Math.abs(tx-e.x)>2||Math.abs(dy)>2;
}

// ---------------------------------------------------------------- 적월마광포
// Coordinates are in the same camera-space world pixels used by render().
function sovCannonPosition(job){
  const C=SOV_R.ultimate,p=player,k=C.handScale,[ox,oy]=C.handOrigin;
  const top=OY+C.margin+oy*k,bottom=OY+VH-C.margin-(217.2-oy)*k;
  const target=p.y-p.z-playerBodyHeight()*.5;
  let best=null,bestScore=-Infinity;
  for(let i=0;i<150;i++){
    const dir=Math.random()<.5?1:-1;
    const lo=dir===1?C.margin+ox*k:C.margin+(362-ox)*k;
    const hi=dir===1?VW-C.margin-(362-ox)*k:VW-C.margin-ox*k;
    const x=camX+(dir===1?rand(lo,VW/2):rand(VW/2,hi));
    const y=i<24?clamp(job.spawned%2===0?target+rand(-18,18):target+(Math.random()<.5?-1:1)*rand(70,140),top,bottom):rand(top,bottom);
    const left=x+(dir===1?-ox*k:-(362-ox)*k),right=x+(dir===1?(362-ox)*k:ox*k);
    const handTop=y-oy*k,handBottom=y+(217.2-oy)*k;
    const overlaps=right>p.x-playerBodyHalfWidth()-12&&left<p.x+playerBodyHalfWidth()+12&&
      handBottom>p.y-p.z-playerBodyHeight()-12&&handTop<p.y-p.z+12;
    const gap=job.lastY==null?Infinity:Math.abs(y-job.lastY);
    if(!overlaps&&gap>=C.minYGap)return {x,y,dir};
    const score=(overlaps?-10000:0)+Math.min(gap,200)+Math.abs(x-p.x)*.05;
    if(score>bestScore){bestScore=score;best={x,y,dir};}
  }
  // Deterministic fallback handles unlucky random samples while preserving both constraints.
  for(let y=top;y<=bottom;y+=4)for(const dir of [1,-1]){
    const x=camX+(dir===1?C.margin+ox*k:VW-C.margin-ox*k);
    const left=x+(dir===1?-ox*k:-(362-ox)*k),right=x+(dir===1?(362-ox)*k:ox*k);
    const overlaps=right>p.x-playerBodyHalfWidth()-12&&left<p.x+playerBodyHalfWidth()+12&&
      y+(217.2-oy)*k>p.y-p.z-playerBodyHeight()-12&&y-oy*k<p.y-p.z+12;
    if(!overlaps&&(job.lastY==null||Math.abs(y-job.lastY)>=C.minYGap))return {x,y,dir};
  }
  return best;
}
function sovCannonSpawn(job){
  const position=sovCannonPosition(job);
  job.lastY=position.y;job.spawned++;job.remaining--;
  job.hands.push({...position,ageMs:0,fired:false,hit:false});
}
function sovCannonTick(e,s,job,dt){
  const C=SOV_R.ultimate,fireAt=C.fadeMs+C.telegraphMs+C.chargedMs,laserMs=20000/C.laserFps;
  if(!job.spawned)sovCannonSpawn(job);
  job.elapsedMs+=dt;job.warn=false;job.danger=false;
  for(const h of [...job.hands]){
    const previous=h.ageMs;h.ageMs+=dt;
    if(!h.fired&&h.ageMs>=fireAt){
      h.fired=true;sfx('bolt');shake=Math.max(shake,5);
      if(job.remaining>0)sovCannonSpawn(job);
    }
    if(h.ageMs>=C.fadeMs&&h.ageMs<fireAt)job.warn=true;
    const beamStart=fireAt+8000/C.laserFps,beamEnd=fireAt+16000/C.laserFps;
    // Interval overlap preserves the active window even if dt spans a frame boundary.
    if(h.ageMs>=beamStart&&previous<beamEnd){
      job.danger=true;
      const p=player,half=C.laserThickness/2;
      const withinX=h.dir>0?p.x+playerBodyHalfWidth()>=h.x&&p.x-playerBodyHalfWidth()<=camX+VW:
        p.x-playerBodyHalfWidth()<=h.x&&p.x+playerBodyHalfWidth()>=camX;
      const playerBottom=p.y-p.z,playerTop=playerBottom-playerBodyHeight();
      if(!h.hit&&withinX&&playerBottom>=h.y-half&&playerTop<=h.y+half&&
         hurtPlayer(C.damage,h.dir,false,e,{hitHeight:Math.max(0,p.y-h.y)}))h.hit=true;
    }
  }
  job.hands=job.hands.filter(h=>h.ageMs<fireAt+laserMs+C.fadeMs);
  if(!job.remaining&&!job.hands.length){job.dangerDone=true;sovEndJob(e,s,job);}
}

// ---------------------------------------------------------------- patterns
function sovJobTick(e,s,job){
  const p=player,R=SOV_R,mul=R.fistSpeed[job.p2],rec=R.recover[job.p2],[a,b]=job.fists,st=job.st,go=n=>sovGo(job,n);
  job.danger=false;job.warn=false;
  switch(job.id){
    case 'direct':case 'grab':{
      const D=R[job.id],grab=job.id==='grab',lock=grab?D.lock:D.lock;
      if(job.stage==='wind'){
        job.warn=true;a.pose=grab?3:12;a.glow=grab?'red':'white';a.face=e.face;a.angle=0;
        if(st===lock){job.lane=p.y;job.dir=Math.sign(p.x-a.x)||e.face;}
        a.y+=clamp((st<lock?p.y:job.lane)-a.y,-3,3);sovMove(a,e.x+e.face*55,a.y,grab?50:58,4);
        if(st>=D.wind-1){a.y=job.lane;job.travel=0;go('fly');sfx('swing',grab?1:2);}
      }else if(job.stage==='fly'){
        job.danger=true;a.pose=grab?3:1;a.face=job.dir;a.trail=true;a.glow=grab?'red':'white';
        const old=a.x,edge=a.x<=camX+12||a.x>=camX+VW-12;
        a.x=clamp(a.x+job.dir*D.speed*mul,camX+12,camX+VW-12);job.travel+=Math.abs(a.x-old);
        if(grab){if(sovTouch(a,{fromX:old})&&sovCatch(e,job)){go('hold');break;}}
        else if(sovTouch(a,{fromX:old}))sovHurt(e,job,'out',D.damage,true,a);
        if(job.travel>=D.range||edge||a.x===old){
          if(!grab)sovFx(e,'fist_impact',a.x+job.dir*18,a.y,a.h,50,50,16);else job.dangerDone=true;
          go('recover');
        }
      }else if(job.stage==='recover'){
        a.trail=false;a.glow=null;a.angle=0;
        if(st>=rec-1){if(grab)sovEndJob(e,s,job);else go('back');}
      }else if(job.stage==='back'){
        job.danger=true;a.trail=true;const old=a.x;a.x-=job.dir*D.back*mul;
        if(sovTouch(a,{fromX:old}))sovHurt(e,job,'back',D.backDamage,false,a);
        if((a.x-e.x)*job.dir<=40||st>150)sovEndJob(e,s,job);
      }else if(job.stage==='hold'){
        job.danger=true;a.pose=4;a.trail=false;a.glow='red';a.x=p.x-job.dir*6;a.y=p.y;a.h=52;a.angle=Math.sin(s.now*.6)*.06;
        const g=p.grab,other=s.fists.find(f=>f!==a);
        if(g&&!job.helper&&g.hold>=GORATH_GRAB.hold-16&&other?.st==='home'){job.helper=other;other.st='job';other.job=job;}
        if(job.helper){const h=job.helper;h.pose=9;h.glow='white';h.face=job.dir;sovMove(h,p.x-job.dir*30,p.y,60,9);}
        if(p.st!=='grabbed'){job.dangerDone=true;go('recover');}
      }else if(job.stage==='stagger'){
        a.pose=1;a.glow=null;a.trail=false;a.angle=Math.sin(st*.5)*.25;
        if(st>=D.stagger-1)sovEndJob(e,s,job);
      }
      break;
    }
    case 'slam':{
      const S=R.slam,track=S.track[job.p2],lock=S.lock[job.p2];
      if(job.stage==='rise'){
        job.warn=true;a.pose=2;a.glow='white';a.angle=0;
        if(!job.mark){job.mark={job,x:a.x,y:clamp(a.y,GTOP+10,GBOT),rx:S.rx,ry:S.ry,blink:false};s.marks.push(job.mark);}
        sovMove(a,job.mark.x,job.mark.y,S.height,Math.max(4,S.height/S.rise));
        if(st>=S.rise-1)go('track');
      }else if(job.stage==='track'){
        job.warn=true;const m=job.mark;
        m.x+=clamp(p.x-m.x,-S.dx,S.dx);m.y=clamp(m.y+clamp(p.y-m.y,-S.dy,S.dy),GTOP+10,GBOT);
        sovMove(a,m.x,m.y,S.height,8);
        if(st>=track-1)go('lock');
      }else if(job.stage==='lock'){
        job.warn=true;job.mark.blink=true;sovMove(a,job.mark.x,job.mark.y,S.height,8);
        if(st>=lock-1)go('fall');
      }else if(job.stage==='fall'){
        job.danger=true;a.x=job.mark.x;a.y=job.mark.y;a.trail=true;a.h=Math.max(SOV_FIST.hh,S.height*(1-(st+1)/S.fall));
        if(st>=S.fall-1){a.h=SOV_FIST.hh;a.trail=false;sovImpact(e,a);go('impact');}
      }else if(job.stage==='impact'){
        job.danger=true;if(sovInMark(job.mark))sovHurt(e,job,'slam',S.damage,true,a);
        if(st>=S.active-1){sovRemoveMark(s,job.mark);job.dangerDone=true;go('stuck');}
      }else if(job.stage==='stuck'){a.glow=null;if(st>=S.stuck-1)sovEndJob(e,s,job);}
      break;
    }
    case 'hammer':{
      const H=R.hammer;
      if(job.stage==='rise'){
        job.warn=true;a.pose=2;a.glow='white';a.angle=0;sovMove(a,p.x,p.y,H.height,10);
        if(st>=H.rise-1){job.k=0;go('aim');}
      }else if(job.stage==='aim'){
        job.warn=true;a.glow='white';a.pose=2;
        if(!job.mark){job.mark={job,x:p.x,y:clamp(p.y,GTOP+10,GBOT),rx:H.rx,ry:H.ry,blink:false};s.marks.push(job.mark);}
        const m=job.mark;m.blink=H.delay-st<=14;sovMove(a,m.x,m.y,H.height,12);
        if(st>=H.delay-H.fall-1)go('fall');
      }else if(job.stage==='fall'){
        job.danger=true;const m=job.mark;a.x=m.x;a.y=m.y;a.trail=true;a.h=Math.max(SOV_FIST.hh,H.height*(1-(st+1)/H.fall));
        if(st>=H.fall-1){a.h=SOV_FIST.hh;a.trail=false;sovImpact(e,a);go('impact');}
      }else if(job.stage==='impact'){
        job.danger=true;
        if(sovInMark(job.mark))sovHurt(e,job,'h'+job.k,H.damage[job.k],job.k===H.count-1,a);
        if(st>=H.active-1){
          sovRemoveMark(s,job.mark);job.mark=null;job.k++;
          if(job.k>=H.count){job.dangerDone=true;go('stuck');}else go('aim');
        }
      }else if(job.stage==='stuck'){a.glow=null;if(st>=H.stuck-1)sovEndJob(e,s,job);}
      break;
    }
    case 'clap':{
      const C=R.clap,pairs=()=>[[a,job.side],[b,-job.side]];
      if(job.stage==='move'){
        job.warn=true;
        if(st===0){job.side=e.face;job.lane=p.y;job.cx=clamp(p.x,camX+C.offset+10,camX+VW-C.offset-10);}
        for(const [f,side] of pairs()){
          const tx=job.cx+side*C.offset;f.pose=1;f.face=-side;f.angle=0;
          sovMove(f,tx,job.lane,C.height,Math.max(6,Math.hypot(tx-f.x,job.lane-f.y,C.height-f.h)/Math.max(1,C.move-st)));
        }
        if(st>=C.move-1)go('warn');
      }else if(job.stage==='warn'){
        job.warn=true;a.glow=b.glow='white';if(st>=C.warn-1)go('close');
      }else if(job.stage==='close'){
        job.danger=true;
        for(const [f,side] of pairs()){
          const old=f.x;f.x=job.cx+side*(C.offset-(C.offset-18)*(st+1)/C.close);f.trail=true;
          if(sovTouch(f,{fromX:old,low:C.low,high:C.high,depth:22}))sovHurt(e,job,'clap',C.damage,true,f);
        }
        if(st>=C.close-1){
          if(Math.abs(p.x-job.cx)<30&&Math.abs(p.y-job.lane)<22&&p.z<=C.high)sovHurt(e,job,'clap',C.damage,true,a);
          sovFx(e,'fist_impact',job.cx,job.lane,C.height,90,90,18);shake=Math.max(shake,12);sfx('slam');
          job.dangerDone=true;go('stuck');
        }
      }else if(job.stage==='stuck'){a.glow=b.glow=null;a.trail=b.trail=false;if(st>=C.stuck-1)sovEndJob(e,s,job);}
      break;
    }
    case 'wave':{
      const W=R.wave;
      if(job.stage==='rise'){
        job.warn=true;
        for(const f of [a,b]){f.pose=10;f.glow='white';f.angle=0;sovMove(f,f.x,f.y,W.height,Math.max(4,W.height/W.rise));}
        if(st>=W.rise-1)go('fall');
      }else if(job.stage==='fall'){
        job.danger=true;for(const f of [a,b]){f.trail=true;f.h=Math.max(SOV_FIST.hh,W.height*(1-(st+1)/W.fall));}
        if(st>=W.fall-1){
          for(const f of [a,b]){
            f.h=SOV_FIST.hh;f.trail=false;sovFx(e,'fist_impact',f.x,f.y,10,80,70,18);
            for(const dir of [-1,1])s.waves.push({job,x:f.x,dir,age:0,hit:false});
          }
          shake=Math.max(shake,16);sfx('slam');go('stuck');
        }
      }else if(job.stage==='stuck'){
        a.glow=b.glow=null;job.danger=s.waves.some(w=>w.job===job);
        if(st>=W.stuck-1){for(const f of [a,b])if(f.job===job)sovFinishFist(f);job.fists=[];go('waves');}
      }else if(job.stage==='waves'){
        job.danger=s.waves.some(w=>w.job===job);if(!job.danger)sovEndJob(e,s,job);
      }
      break;
    }
    case 'wall':{
      const L=R.wall,place=()=>[a,b].forEach((f,i)=>{f.pose=9;f.face=job.side;f.angle=0;f.glow=null;
        sovMove(f,e.x+job.side*(46+i*6),e.y+(i?-3:3),70+i*8+Math.sin(s.now*.2+i)*1.5,8);});
      if(job.stage==='move'){if(st===0)job.side=e.face;place();if(st>=L.move-1)go('guard');}
      else if(job.stage==='guard'){place();if(st>=L.guard-1)go('open');}
      else if(job.stage==='open'){
        // Fists sink to the floor: below Barel's sword line, the body is open from the front.
        for(const f of [a,b]){f.h=Math.max(0,f.h-6);f.angle=.35*job.side;}
        if(st>=L.open-1)sovEndJob(e,s,job);
      }
      break;
    }
    case 'whirl':{
      const Wh=R.whirl;
      if(job.stage==='warn'){
        job.warn=true;
        [a,b].forEach((f,i)=>{f.glow='white';f.pose=1;f.angle=0;
          sovMove(f,e.x+(i?-1:1)*e.face*Wh.rx,e.y,Wh.height,Math.max(6,Wh.rx*1.4/Wh.warn));});
        if(st>=Wh.warn-1){job.start=e.face>0?0:Math.PI;go('spin');}
      }else if(job.stage==='spin'){
        job.danger=true;
        const th=job.start+(st+1)/Wh.spin*Wh.turns*Math.PI*2;
        [a,b].forEach((f,i)=>{
          const ang=th+i*Math.PI,old=f.x;
          f.x=e.x+Math.cos(ang)*Wh.rx;f.y=e.y+Math.sin(ang)*Wh.ry;f.h=Wh.height;f.face=-Math.sign(Math.sin(ang))||1;f.trail=true;f.glow='white';
          if(sovTouch(f,{fromX:old,low:Wh.low,high:Wh.high,depth:22}))sovHurt(e,job,'spin',Wh.damage,false,e,Wh.push,playerImpactHeight(Wh.low,Wh.high));
        });
        if(st>=Wh.spin-1){job.dangerDone=true;go('dazed');}
      }else if(job.stage==='dazed'){
        [a,b].forEach((f,i)=>{f.trail=false;f.glow=null;f.h=Math.max(36,f.h-1.5);f.angle=Math.sin(s.now*.3+i*2)*.3;});
        if(st>=Wh.dazed-1)sovEndJob(e,s,job);
      }
      break;
    }
    case 'backhand':{
      const K=R.backhand;
      if(job.stage==='warn'){
        job.warn=true;a.pose=9;a.glow='white';a.angle=0;
        if(st===0)job.dir=Math.sign(p.x-e.x)||e.face;
        a.face=job.dir;sovMove(a,e.x+job.dir*30,e.y,64,6);
        if(st>=K.warn-1){job.lane=p.y;job.tx=p.x+job.dir*60;go('swing');}
      }else if(job.stage==='swing'){
        job.danger=true;a.trail=true;
        const old=a.x,left=K.swing-st;a.x+=(job.tx-a.x)/left;a.y+=(job.lane-a.y)/left;a.h=60;
        if(sovTouch(a,{fromX:old,depth:26}))sovHurt(e,job,'bh',K.damage,false,e,K.push,a.h);
        if(st>=K.swing-1){job.dangerDone=true;go('recover');}
      }else if(job.stage==='recover'){a.trail=false;a.glow=null;if(st>=rec-1)sovEndJob(e,s,job);}
      break;
    }
    case 'meteor':{
      const M=R.meteor;
      if(job.stage==='rise'){
        job.warn=true;
        for(const f of [a,b]){f.pose=11;f.glow='white';f.angle=0;sovMove(f,f.x,f.y,M.height,Math.max(8,(M.height-f.h)/Math.max(1,M.rise-st)));}
        if(st>=M.rise-1){job.marks=[];go('rain');}
      }else if(job.stage==='rain'){
        if(st%M.interval===0&&job.marks.length<M.count){
          const k=job.marks.length,m={job,x:p.x,y:clamp(p.y,GTOP+10,GBOT),rx:M.rx,ry:M.ry,blink:false,at:st,k,fist:job.fists[k%2]};
          job.marks.push(m);s.marks.push(m);
        }
        for(const f of [a,b]){
          const m=job.marks.find(q=>q.fist===f&&!q.done);
          if(!m){if(job.marks.length<M.count)sovMove(f,f.x,f.y,M.height,16);else f.glow=null;continue;}
          const impactAt=m.at+M.delay,fallAt=impactAt-M.fall;
          m.blink=impactAt-st<=14;
          if(st<fallAt){f.pose=2;f.trail=false;sovMove(f,m.x,m.y,M.height,f.h>=M.height-1?80:16);}
          else if(st<impactAt){
            job.danger=true;f.x=m.x;f.y=m.y;f.pose=2;f.trail=true;f.h=Math.max(SOV_FIST.hh,M.height*(impactAt-st-1)/M.fall);
            if(st===impactAt-1){sovFx(e,'eruption',m.x,m.y,0,110,120,30,{ground:true});shake=Math.max(shake,14);sfx('slam');}
          }else{
            job.danger=true;f.trail=false;
            if(sovInMark(m))sovHurt(e,job,'m'+m.k,M.damage,true,f);
            if(st>=impactAt+M.active-1){m.done=true;sovRemoveMark(s,m);}
          }
        }
        if(job.marks.length>=M.count&&job.marks.every(q=>q.done)){job.dangerDone=true;go('stuck');}
      }else if(job.stage==='stuck'){
        for(const f of [a,b]){f.glow=null;f.pose=2;}
        if(st>=M.stuck-1)sovEndJob(e,s,job);
      }
      break;
    }
    case 'ultimate': sovCannonTick(e,s,job,MS);break;
    case 'beam':{
      const B=R.beam,fire=B.fire[job.p2],body=s.body;
      if(job.stage==='charge'){
        job.warn=true;
        if(st<B.lock)e.y+=clamp(p.y-e.y,-1.6,1.6);
        else{if(st===B.lock)job.lane=clamp(p.y,GTOP+10,GBOT);e.y+=(job.lane-e.y)/Math.max(1,B.charge-st);}
        if(body)body.drawing=1+Math.min(7,Math.floor(st/B.charge*8));
        if(st>=B.charge-1){e.y=job.lane;go('fire');sfx('bolt');shake=Math.max(shake,6);}
      }else if(job.stage==='fire'){
        job.danger=true;if(body)body.drawing=9+Math.floor(st/6)%4;
        if(Math.abs(p.y-job.lane)<=B.depth*playerHurtScale()&&p.z+playerBodyHeight()>=B.low&&p.z<=B.high&&(p.x-e.x)*e.face>0)sovHurt(e,job,'beam',B.damage,false,e,0,playerImpactHeight(B.low,B.high));
        if(st>=fire-1){job.dangerDone=true;go('recovery');}
      }else if(job.stage==='recovery'){
        if(body)body.drawing=13+Math.min(3,Math.floor(st/B.recovery*4));
        if(st>=B.recovery-1)sovEndJob(e,s,job);
      }
      break;
    }
  }
}

// ---------------------------------------------------------------- fists, waves, fx
function sovFistHome(e,s,f){
  const [x,y,h]=sovHome(e,f,s);
  f.pose=1;f.glow=null;f.trail=false;f.face=e.face;f.angle*=.7;
  sovMove(f,x,y,h,Math.max(SOV_R.home.speed,Math.hypot(x-f.x,y-f.y,h-f.h)*.15));
}
function sovRise(e,f){
  f.st='rise';f.timer=SOV_R.rise;f.max=f.hp=SOV_R.fistHp[sovP2(e)];f.broken=false;f.wake=0;f.vh=0;
  sovFx(e,'reform',f.x,f.y,Math.max(20,f.h),90,90,30);sfx('pickup');
}
function sovTickFists(e,s){
  for(const f of s.fists){
    if(f.flash>0)f.flash--;
    if(f.st==='home')sovFistHome(e,s,f);
    else if(f.st==='return'){
      const [x,y,h]=sovHome(e,f,s);f.pose=1;f.face=e.face;f.angle*=.8;
      if(sovMove(f,x,y,h,SOV_R.direct.back*SOV_R.fistSpeed[sovP2(e)]))f.st='home';
    }else if(['dropped','fallen','dead'].includes(f.st)){
      if(f.h>0){f.vh-=.6;f.h=Math.max(0,f.h+f.vh);}
      f.angle=0;f.glow=null;f.trail=false;
      if(f.st==='fallen'&&f.timer>0)f.timer--;
      if(f.st==='fallen'&&f.timer<=0&&!s.grounded&&sovStanding(e))sovRise(e,f);
    }else if(f.st==='rise'){
      const [x,y,h]=sovHome(e,f,s);f.timer--;f.wake=1-Math.max(0,f.timer)/SOV_R.rise;f.pose=1;f.face=e.face;
      sovMove(f,x,y,h,Math.max(2,Math.hypot(x-f.x,y-f.y,h-f.h)/Math.max(1,f.timer)));
      if(f.timer<=0){f.st='home';f.wake=1;}
    }
  }
}
function sovTickWaves(e,s){
  const W=SOV_R.wave,p=player;
  for(const w of s.waves){
    w.age++;w.x+=w.dir*W.speed;
    if(!w.hit&&p.st!=='dead'&&Math.abs(p.x-w.x)<16&&p.z<=W.top&&hurtPlayer(W.damage,w.dir,true,e))w.hit=true;
    if(w.x<camX-40||w.x>camX+VW+40)w.dead=true;
  }
  s.waves=s.waves.filter(w=>!w.dead);
}
function sovTickFx(s){for(const f of s.fx)f.age++;s.fx=s.fx.filter(f=>f.age<f.life);}
function sovGround(e,s){
  for(const j of [...s.jobs])sovEndJob(e,s,j);
  for(const f of s.fists)if(!['fallen','dead','dropped'].includes(f.st))Object.assign(f,{st:'dropped',vh:0,glow:null,trail:false,job:null,wake:0});
  s.grounded=true;s.pending=null;
}
function beginSovereignTransition(e){
  const s=sovData(e);sovGround(e,s);resetBossFx(e);
  // Leftover marks, waves and the beam are all cleared for the awakening.
  s.marks=[];s.waves=[];
  e.hp=0;e.phaseT=SOV_R.kneelDown+SOV_R.awaken;s.transAge=0;e.st='rec';e.t=0;e.z=e.vz=e.vx=0;e.invuln=true;e.gr=0;e.grT=0;
  player.inv=Math.max(player.inv,90);sfx('land');
}
function sovTransition(e,s){
  const R=SOV_R,awake=s.transAge-R.kneelDown;
  e.walk=false;e.invuln=true;e.flash=0;
  if(awake===Math.floor((R.awakenShakeDrawing-1)/16*R.awaken)){shake=Math.max(shake,22);sfx('phase2');sovFx(e,'reform',e.x,e.y,80,170,170,40);}
  s.transAge++;e.phaseT--;
  if(!e.phaseT){
    e.p2shown=true;e.max=e.hp=R.hp[1];e.nextKd=e.max*.75;e.gr=0;e.grT=0;e.invuln=false;e.st='chase';e.t=0;e.atkCd=sovGap(e);
    s.grounded=false;s.pressure=0;s.forceBackhand=false;s.ultimateUsed=false;s.cooldowns={};
    for(const f of s.fists)sovRise(e,f);   // phase-2 gauntlets, full HP
    floatText(e.x,e.y-170,'2 페이즈','#ff9bd0');
  }
}
function sovDeath(e,s){
  if(!s.dead){
    s.dead=true;for(const j of [...s.jobs])sovEndJob(e,s,j);s.marks=[];s.waves=[];
    if(player.grab?.sovereign)sovReleaseGrab('cancel');
    for(const f of s.fists)Object.assign(f,{st:'dead',broken:true,vh:0,glow:null,trail:false,wake:0,job:null});
  }
  e.t++;e.invuln=true;e.walk=false;
  if(e.t===24){for(const f of s.fists)sovFx(e,'fist_shatter',f.x,f.y,Math.max(f.h,14),110,110,32);shake=Math.max(shake,14);sfx('slam');}
  if(e.t>=SOV_R.death+SOV_R.deathHold){
    if(!s.remains){sovereignRemains.push({x:e.x,y:e.y,face:e.face,fists:s.fists.map(f=>({x:f.x,y:f.y,face:f.face}))});s.remains=true;}
    e.remove=true;
  }
}
function updateSovereignState(e){
  if(!isSovereign(e))return false;
  const s=sovData(e);s.now++;sovCaptureAfterimages(e,s);
  for(const id in s.cooldowns)if(s.cooldowns[id]>0)s.cooldowns[id]--;
  if(s.pressureT>0&&--s.pressureT===0)s.pressure=0;
  if(e.phaseT>0){sovTransition(e,s);sovTickFists(e,s);sovTickFx(s);return true;}
  if(e.st==='dead'){sovDeath(e,s);sovTickFists(e,s);sovTickFx(s);return true;}
  const down=['stun','down'].includes(e.st);
  if(down&&!s.grounded){sovGround(e,s);s.downAt=e.t;}
  if(!down&&s.grounded){s.grounded=false;for(const f of s.fists)if(f.st==='dropped')sovRise(e,f);}
  if(e.st==='down'){e.vz=Math.min(e.vz,0);e.z=0;}   // heavy armour does not bounce
  for(const j of [...s.jobs])if(!j.done){sovJobTick(e,s,j);j.st++;j.t++;}
  sovTickFists(e,s);sovTickWaves(e,s);sovTickFx(s);
  const danger=s.jobs.some(j=>j.danger)||s.waves.length>0;
  if(s.dangerWas&&!danger)s.lastDangerEnd=s.now;
  s.dangerWas=danger;
  if(s.forceBackhand&&e.atkCd>10+SOV_R.attackDelay)e.atkCd=10+SOV_R.attackDelay;
  e.hw=SOV_R.hw;
  if(e.st!=='pat')e.invuln=false;
  return false;
}
function updateSovereignIntro(e){
  const s=sovData(e),R=SOV_R,f=Math.floor(introT/MS+1e-6),start=Math.round((R.introFistDrawing-1)/16*R.intro);
  s.now++;e.z=0;
  for(const q of s.fists){
    const [hx,hy,hh]=sovHome(e,q,s);
    if(f<start){Object.assign(q,{x:hx,y:hy,h:420,st:'intro'});continue;}
    if(q.st==='intro'){
      const u=Math.min(1,(f-start)/R.introFistDrop);q.x=hx;q.y=hy;q.h=420+(hh-420)*ease(u);q.face=e.face;q.pose=1;
      if(u>=1){q.st='home';sovFx(e,'reform',q.x,q.y,q.h,90,90,30);sfx('land');shake=Math.max(shake,8);}
    }else sovFistHome(e,s,q);
  }
  sovTickFx(s);
}
function sovereignWarning(e){return !!e.sov?.jobs.some(j=>j.warn);}

// ---------------------------------------------------------------- drawing
// Snapshot actual positions on simulation ticks, never on render calls.
// Ghosts are visual only and expire even when the subject stops moving.
function sovCaptureAfterimages(e,s){
  const R=SOV_R.afterimage,active=sovStanding(e)&&e.st!=='intro';
  const pose=sovPose(e);
  const subjects=[[e,SOV_A.clips[pose.clip]?.[pose.drawing-1],e.y-e.z,active]];
  for(const f of s.fists){
    const stage=f.hp/f.max>.66?0:f.hp/f.max>.33?1:2;
    subjects.push([f,SOV_A.clips[e.p2shown?'fist_p2':'fist_p1'][(f.pose===1?[5,6,7][stage]:f.pose)-1],f.y-f.h,active&&sovActive(f)]);
  }
  for(const [o,frame,y,visible] of subjects){
    o.afterimages=(o.afterimages||[]).filter(g=>s.now-g.at<R.life);
    if(!visible){o.afterimages=[];o.trailSample=null;continue;}
    if(s.now%R.interval)continue;
    const old=o.trailSample;
    if(old&&Math.hypot(o.x-old.x,y-old.y)>=R.minDistance){
      o.afterimages.push(old);if(o.afterimages.length>R.max)o.afterimages.shift();
    }
    o.trailSample={frame,x:o.x,y,face:o.face,angle:o.angle||0,at:s.now};
  }
}
function sovDrawAfterimages(o,s){
  const R=SOV_R.afterimage;
  for(const g of o.afterimages||[]){
    const fade=Math.max(0,1-(s.now-g.at)/R.life);
    if(fade&&g.frame)sovPaint(g.frame,g.x,g.y,{face:g.face,angle:g.angle,alpha:R.alpha*fade,filter:'sepia(.4) saturate(.7) hue-rotate(260deg)'});
  }
}
function sovPaint(frame,x,y,o={}){
  const im=frame&&SOV_SHEETS[frame.sheet];if(!im?.naturalWidth)return false;
  const [sx,sy,w,h]=frame.atlas,[ax,ay]=frame.anchor,k=(o.scale??1)/SOV_A.ppw;
  ctx.save();ctx.translate(x-camX,y);ctx.scale(o.face??1,1);if(o.angle)ctx.rotate(o.angle);ctx.globalAlpha*=o.alpha??1;smoothFor(k);
  if(o.add)ctx.globalCompositeOperation='lighter';if(o.filter)ctx.filter=o.filter;
  drawLit(im,sx,sy,w,h,-ax*k,-ay*k,w*k,h*k,o.gain??1);ctx.restore();return true;
}
// Effect drawings are additive RGB on black; drawn stretched to w x h around their anchor.
function sovFxDraw(id,u,x,y,w,h,o={}){
  const frames=SOV_A.clips['fx_'+id];if(!frames)return;
  const f=frames[o.index??Math.min(frames.length-1,Math.max(0,Math.floor(u*frames.length)))],im=SOV_SHEETS[f.sheet];if(!im?.naturalWidth)return;
  const [sx,sy,fw,fh]=f.atlas,[ax,ay]=f.anchor,kx=w/fw,ky=h/fh;
  ctx.save();ctx.globalCompositeOperation='lighter';ctx.globalAlpha*=o.alpha??1;ctx.translate(x-camX,y);ctx.scale(o.face??1,1);
  if(o.angle)ctx.rotate(o.angle);smoothFor(ky);
  ctx.drawImage(im,sx,sy,fw,fh,-ax*kx,-ay*ky,fw*kx,fh*ky);ctx.restore();
}
function sovPose(e){
  const s=sovData(e),R=SOV_R,clip=n=>sovClip(e,n),len=c=>SOV_A.clips[c].length;
  const seq=(c,u)=>({clip:c,drawing:Math.min(len(c),Math.max(1,1+Math.floor(u*len(c))))});
  const range=(c,a,b,u)=>({clip:c,drawing:Math.min(b,a+Math.floor(clamp(u,0,.999)*(b-a+1)))});
  const loop=(c,a,b,rate)=>({clip:c,drawing:a+Math.floor(tick/rate)%(b-a+1)});
  if(e.phaseT>0){const t=s.transAge;return t<R.kneelDown?range('kneel',1,6,t/R.kneelDown):seq('awaken',Math.min(.999,(t-R.kneelDown)/R.awaken));}
  if(e.st==='intro')return seq('intro',Math.min(.999,introT/MS/R.intro));
  if(e.st==='dead')return seq('death',Math.min(.999,e.t/R.death));
  if(e.st==='stun'||e.st==='down'){
    // kneel 1-6 going down, 7-10 groggy loop, 11-16 standing up.
    const c=clip('kneel'),elapsed=e.t-s.downAt,left=(e.st==='stun'?GROGGY_TICKS:61)-e.t;
    if(elapsed<24)return range(c,1,6,elapsed/24);
    if(left<24)return range(c,11,16,1-left/24);
    return loop(c,7,10,9);
  }
  if(e.st==='hurt'){
    const c=clip('hurt'),n=len(c),half=Math.floor(n/2);
    return {clip:c,drawing:Math.min(n,(e.hheavy?half:0)+1+Math.min(half-1,Math.floor(e.t/11*half)))};
  }
  const b=s.body;
  if(e.st==='pat'&&b){
    if(b.idle)return loop(clip('idle'),1,16,7);
    if(b.drawing)return {clip:b.clip,drawing:b.drawing};
    return range(b.clip,b.from,b.to,b.t/b.ticks);
  }
  return e.walk?loop(clip('walk'),1,16,5):loop(clip('idle'),1,16,7);
}
function sovHelmHeight(e){return e.p2shown?88:118;}
function drawSovereign(e){
  if(!isSovereign(e))return false;
  const s=sovData(e),pose=sovPose(e),frame=SOV_A.clips[pose.clip]?.[pose.drawing-1];
  if(!SOV_SHEETS[frame?.sheet]?.naturalWidth)return false;
  drawShadow(e.x-camX,e.y,22,e.z);
  sovDrawAfterimages(e,s);
  sovPaint(frame,e.x,e.y-e.z,{face:e.face,gain:e.flash>0&&UX.options.flash?1.8:1});
  // Phase-2: moon in the empty helm and the magenta cracks breathe (~90 ticks).
  const mask=SOV_A.clips[SOV_A.maskPrefix+pose.clip]?.[pose.drawing-1];
  if(mask&&(e.p2shown||pose.clip==='awaken')){
    const pulse=.2+.65*(.5+.5*Math.sin(tick*Math.PI*2/SOV_A.maskPulseTicks));
    sovPaint(mask,e.x,e.y-e.z,{face:e.face,alpha:pulse,add:true});
  }
  // Helm slit brightens before the beam.
  const beam=s.jobs.find(j=>j.id==='beam'&&j.stage==='charge');
  if(beam){
    const u=Math.min(1,beam.st/SOV_R.beam.charge),x=e.x-camX+e.face*8,y=e.y-e.z-sovHelmHeight(e),r=6+18*u;
    ctx.save();ctx.globalCompositeOperation='lighter';const g=ctx.createRadialGradient(x,y,0,x,y,r);
    g.addColorStop(0,`rgba(255,235,245,${.9*u})`);g.addColorStop(.4,`rgba(255,73,141,${.7*u})`);g.addColorStop(1,'rgba(255,73,141,0)');
    ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);ctx.restore();
  }
  return true;
}
function sovGlow(x,y,color,r){
  ctx.save();ctx.globalCompositeOperation='lighter';
  const c=color==='red'?'255,40,60':'255,240,250',g=ctx.createRadialGradient(x,y,0,x,y,r);
  g.addColorStop(0,`rgba(${c},.95)`);g.addColorStop(.45,`rgba(${c},.45)`);g.addColorStop(1,`rgba(${c},0)`);
  ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);ctx.restore();
}
function drawSovFist(e,s,f){
  const set=SOV_A.clips[e.p2shown?'fist_p2':'fist_p1'],ratio=f.hp/f.max,stage=ratio>.66?0:ratio>.33?1:2;
  const lying=['dropped','fallen','dead'].includes(f.st)||f.st==='rise'&&f.wake<.5;
  if(lying){
    if(e.p2shown){
      const k=f.st==='rise'?(f.wake<.25?2:3):f.broken?1:0;
      sovPaint(SOV_A.clips.fallen_p2[k],f.x,f.y-f.h,{face:f.face});
    }else{
      // No phase-1 fallen drawing: side fist laid down, wrist core dimmed, brightening as it wakes.
      const k=f.broken?2:stage,y=f.y-f.h-SOV_FIST.h*.5+3;
      sovPaint(SOV_A.clips.fallen_p1[k],f.x,y,{face:f.face,angle:.1});
      if(f.wake>0)sovPaint(set[[4,5,6][k]],f.x,y,{face:f.face,angle:.1,alpha:f.wake});
    }
    return;
  }
  const fr=set[(f.pose===1?[5,6,7][stage]:f.pose)-1];
  sovDrawAfterimages(f,s);
  if(f.h>14&&f.h<400){
    ctx.fillStyle='rgba(0,0,0,.28)';ctx.beginPath();
    ctx.ellipse(f.x-camX,f.y,SOV_FIST.len*.4*(1-Math.min(f.h,220)/400),6,0,0,Math.PI*2);ctx.fill();
  }
  if(f.trail)sovFxDraw('punch_trail',(tick%16)/16,f.x-f.face*SOV_FIST.len*.7,f.y-f.h,74,30,{face:f.face,alpha:.9});
  const back=f.i===1&&['home','return','rise'].includes(f.st),blink=f.glow&&Math.floor(tick/5)%2===0&&UX.options.flash;
  const gain=f.flash>0?2:blink?1.5:1,filter=gain===1&&back?'brightness(.75)':null;
  const alpha=f.st==='rise'?Math.min(1,(f.wake-.5)*2+.3):1;
  sovPaint(fr,f.x,f.y-f.h,{face:f.face,angle:f.angle,filter,gain,alpha});
  if(stage===2&&f.pose!==1&&Math.floor(tick/8)%2===0)
    sovPaint(fr,f.x,f.y-f.h,{face:f.face,angle:f.angle,alpha:.45,filter:'sepia(1) saturate(8) hue-rotate(-45deg)'});
  if(f.glow&&fr.core){
    const k=1/SOV_A.ppw,c=Math.cos(f.angle),sn=Math.sin(f.angle),cx=fr.core[0]*k,cy=fr.core[1]*k;
    sovGlow(f.x-camX+f.face*(cx*c-cy*sn),f.y-f.h+(cx*sn+cy*c),f.glow,12+3*Math.sin(tick*.5));
  }
  if(f.hp<f.max&&sovActive(f)){
    const x=f.x-camX,y=f.y-f.h-SOV_FIST.h*.5-9;
    ctx.fillStyle='#1d1220';ctx.fillRect(x-16,y,32,4);ctx.fillStyle=stage===2?'#ff4d6d':'#ff9bd0';ctx.fillRect(x-15,y+1,30*clamp(ratio,0,1),2);
  }
}
// Fists are separate objects in the depth-sorted list; the back fist goes behind the body.
function sovereignDrawList(list){
  for(const e of enemies){
    if(!isSovereign(e)||!e.sov)continue;
    const s=e.sov;
    for(const f of s.fists){
      if(f.st==='reserve')continue;
      const behind=f.i===1&&['home','return','rise','intro'].includes(f.st);
      list.push({y:f.y+(behind?-.5:.5),f:()=>drawSovFist(e,s,f)});
    }
  }
}
function drawSovereignGround(){
  for(const r of sovereignRemains){
    sovPaint(SOV_A.clips.death.at(-1),r.x,r.y,{face:r.face});
    for(const f of r.fists)sovPaint(SOV_A.clips.fallen_p2[1],f.x,f.y,{face:f.face});
  }
  for(const e of enemies){
    if(!isSovereign(e)||!e.sov)continue;
    const s=e.sov;
    for(const m of s.marks){
      const alpha=m.blink&&UX.options.flash?.35+.65*(Math.floor(s.now/3)%2):.75;
      sovFxDraw('slam_mark',(s.now%40)/40,m.x,m.y,m.rx*2.5,m.ry*2.8,{alpha});
    }
    for(const w of s.waves){
      ctx.save();ctx.fillStyle='rgba(255,73,141,.16)';ctx.fillRect(w.x-camX-5,GTOP-6,10,GBOT-GTOP+12);ctx.restore();
      for(const y of [GTOP+12,(GTOP+GBOT)/2,GBOT-2])sovFxDraw('ground_wave',(w.age%20)/20,w.x,y,64,44,{face:w.dir});
    }
    const beam=s.jobs.find(j=>j.id==='beam'&&j.lane!==undefined&&j.stage==='charge');
    if(beam){
      ctx.save();ctx.globalAlpha=.18+.14*(Math.floor(s.now/4)%2);ctx.fillStyle='#ff498d';
      const x0=e.x-camX,x1=e.face>0?VW:0;ctx.fillRect(Math.min(x0,x1),beam.lane-SOV_R.beam.depth,Math.abs(x1-x0),SOV_R.beam.depth*2);ctx.restore();
    }
  }
}
function sovDrawCannon(job){
  const C=SOV_R.ultimate,fireAt=C.fadeMs+C.telegraphMs+C.chargedMs,laserMs=20000/C.laserFps;
  const [hand,laser]=SOV_CANNON_IMAGES;
  for(const h of job.hands){
    const age=h.ageMs,shot=age-fireAt,sx=h.x-camX,len=h.dir>0?VW-sx:sx;
    const fade=age<C.fadeMs?age/C.fadeMs:shot>laserMs?Math.max(0,1-(shot-laserMs)/C.fadeMs):1;
    if(age>=C.fadeMs&&shot<0){
      const blink=age>=C.fadeMs+C.telegraphMs&&Math.floor(age/100)%2===0;
      ctx.save();ctx.globalAlpha=blink?.65:.32;ctx.fillStyle='#ff245e';
      ctx.fillRect(Math.min(sx,sx+h.dir*len),h.y-1,Math.abs(len),2);ctx.restore();
    }
    const frame=age<C.fadeMs?0:age<C.fadeMs+C.telegraphMs?
      Math.min(7,Math.floor((age-C.fadeMs)/C.telegraphMs*8)):shot<0?
      8+Math.min(3,Math.floor((age-C.fadeMs-C.telegraphMs)/C.chargedMs*4)):
      12+Math.min(7,Math.floor(Math.max(0,shot)/laserMs*8));
    ctx.save();ctx.translate(sx,h.y);ctx.scale(h.dir,1);
    if(hand.naturalWidth){
      const row=Math.floor(frame/4),y0=Math.floor(row*hand.naturalHeight/5),y1=Math.floor((row+1)*hand.naturalHeight/5),w=hand.naturalWidth/4;
      ctx.globalAlpha=fade;ctx.imageSmoothingEnabled=true;
      ctx.drawImage(hand,frame%4*w,y0,w,y1-y0,-C.handOrigin[0]*C.handScale,-C.handOrigin[1]*C.handScale,w*C.handScale,(y1-y0)*C.handScale);
    }
    if(shot>=0&&shot<laserMs&&laser.naturalWidth){
      const n=Math.min(19,Math.floor(shot*C.laserFps/1000)),row=Math.floor(n/4),w=laser.naturalWidth/4;
      const y0=Math.floor(row*laser.naturalHeight/5),y1=Math.floor((row+1)*laser.naturalHeight/5),height=y1-y0;
      const [originX,originY]=C.laserOrigins[n],scale=C.laserHeight/height,split=Math.min(w-1,originX+28),end=Math.min(w,C.laserEnds[n]);
      ctx.globalAlpha=UX.options.lowFx?.65:1;ctx.globalCompositeOperation='screen';
      // Keep the ring at native aspect; stretch only the beam beyond the ring.
      ctx.drawImage(laser,n%4*w,y0,split,height,-originX*scale,-originY*scale,split*scale,C.laserHeight);
      ctx.drawImage(laser,n%4*w+split,y0,end-split,height,(split-originX)*scale,-originY*scale,
        Math.max(.01,len-(split-originX)*scale),C.laserHeight);
    }
    ctx.restore();
    if(C.debug){
      ctx.save();ctx.fillStyle='#00ffff';ctx.beginPath();ctx.arc(sx,h.y,3,0,Math.PI*2);ctx.fill();
      ctx.strokeStyle=shot>=8000/C.laserFps&&shot<16000/C.laserFps?'#ffff00':'#55ffff';
      ctx.strokeRect(Math.min(sx,sx+h.dir*len),h.y-C.laserThickness/2,len,C.laserThickness);
      ctx.fillStyle='#fff';ctx.font='12px sans-serif';ctx.fillText(`H${frame+1} L${shot>=0&&shot<laserMs?1+Math.floor(shot*C.laserFps/1000):'-'}`,sx+5,h.y-10);ctx.restore();
    }
  }
}
function drawSovereignTop(){
  for(const e of enemies){
    if(!isSovereign(e)||!e.sov)continue;
    const s=e.sov,beam=s.jobs.find(j=>j.id==='beam'&&j.stage==='fire');
    for(const job of s.jobs)if(job.id==='ultimate')sovDrawCannon(job);
    if(beam){
      // helm_beam: drawings 1-3 open, 4-8 loop, 9-10 close.
      const fire=SOV_R.beam.fire[beam.p2],st=beam.st,index=st<6?Math.floor(st/2):fire-st<=4?8+Math.min(1,Math.floor((4-(fire-st))/2)):3+Math.floor(st/3)%5;
      const x0=e.x+e.face*14,y=beam.lane-sovHelmHeight(e),len=e.face>0?camX+VW+20-x0:x0-camX+20;
      // About 1 cm at the usual desktop display size: only the short muzzle
      // tapers. The rest of the beam and its gameplay collision stay unchanged.
      const neck=Math.min(len,SOV_R.beam.neckLength),half=SOV_R.beam.neckHalfHeight;
      const mouth=x0-camX,flare=mouth+e.face*neck,end=mouth+e.face*len;
      ctx.save();ctx.beginPath();ctx.moveTo(mouth,y-half);ctx.lineTo(flare,y-26);ctx.lineTo(end,y-26);
      ctx.lineTo(end,y+26);ctx.lineTo(flare,y+26);ctx.lineTo(mouth,y+half);ctx.closePath();ctx.clip();
      sovFxDraw('helm_beam',0,x0,y,len,52,{index,face:e.face});
      ctx.restore();
    }
    for(const f of s.fx){
      const u=f.age/f.life,y=f.y-f.h+(f.ground?0:0);
      sovFxDraw(f.id,u,f.x,y,f.w,f.hgt,{alpha:1-u*.4,face:f.face});
    }
  }
}
let sovPortrait=null;
function getSovereignPortrait(){
  const f=SOV_A.clips.idle[0],im=SOV_SHEETS[f.sheet];if(!im?.naturalWidth)return null;
  if(!sovPortrait){
    const c=document.createElement('canvas');c.width=c.height=64;c.hd=true;const [x,y,w,h]=f.atlas,s=h*.3;
    c.getContext('2d').drawImage(im,x+f.anchor[0]-s*.42,y+h*.03,s,s,0,0,64,64);sovPortrait=c;
  }
  return sovPortrait;
}
