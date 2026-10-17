'use strict';
// One startup flag selects the complete 1.33 integration, not merely its art.
const USE_AURELION_V133 = globalThis.AURELION_V133_OVERRIDE !== false;
const AURELION_K = .55 * .85;
const AURELION_SFX = {kneel_voice:'bwind',holy_chant:'mcharge',holy_strike:'pillar',armor_fall:'land',
  armor_rise:'bwind',royal_decree:'phase2',royal_roar:'phase2',roar_short:'bcharge',grunt_lift:'bwind',
  slam_impact:'land',blade_stuck:'hit',swing_heavy:'swing',blade_charge:'mcharge',wave_release:'bwave',
  guard_ring:'mcharge',parry_clang:'hit',heavy_breath:'bwind',whirl:'swing'};
const AURELION_SHEETS = USE_AURELION_V133 ? AURELION_ART.sheets.map(src => {const im=new Image();im.src=src;return im;}) : [];
const AURELION_READY = Promise.all(AURELION_SHEETS.map(im=>im.decode()));
// A failed image uses the retained renderer; combat remains deterministic.
AURELION_READY.catch(()=>{});
const aurelionMoves=AURELION_ART.timing;
const aurelionRules=AURELION_ART.boss;
const AURELION_ATTACKS=['combo','sword_wave','cleave','charge','judgment','guard','whirl','taunt'];
let aurelionDebug=false;
function isAurelion(e){return USE_AURELION_V133 && e?.type==='boss3';}
function aurelionData(e){return e.aurelion ||= {cooldowns:{},pressure:0,forceGuard:false,lastMove:null,repeats:0,halo:false,stats:{events:{},opportunities:0,hits:[]}};}
function aurelionIn(ranges,f){return (ranges||[]).some(([a,b])=>f>=a&&f<=b);}
function aurelionDrawing(id,f=0){const m=aurelionMoves[id];if(m.loop)f%=m.total_frames;return m.drawings.find(d=>f<d.start+d.duration)||m.drawings.at(-1);}
function aurelionFrame(id,f=0){return AURELION_ART.clips[id]?.[aurelionDrawing(id,f).index-1];}

// Each entry is one game tick; source-frame intervals preserve crossed events.
function aurelionTimeline(id,indices,p2=false,options={}) {
  const m=aurelionMoves[id],result=[];let occurrences={};
  for(let instance=0;instance<indices.length;instance++) {
    const index=indices[instance],d=m.drawings[index-1],repeat=occurrences[index]||0;
    occurrences[index]=repeat+1;
    let duration=options.duration??(id==='sword_wave'&&index===1&&repeat?m.repeat_windup:d.duration);
    const speed=p2&&d.phase==='S'&&options.compress!==false?1/aurelionRules.phases[1].telegraph_mult:1;
    const ticks=Math.max(1,Math.ceil(duration/speed));let previous=-1;
    for(let t=0;t<ticks;t++) {
      const local=t===ticks-1?d.duration-1:Math.min(d.duration-1,Math.floor(t*d.duration/ticks));
      const events=(m.events||[]).filter(ev=>ev.frame>=d.start&&ev.frame<d.start+d.duration&&ev.frame-d.start>previous&&ev.frame-d.start<=local);
      result.push({id,index,d,source:d.start+local,instance,repeat,events});previous=local;
    }
  }
  return result;
}
function aurelionSequence(e,id,mode) {
  const m=aurelionMoves[id],all=m.drawings.map(d=>d.index),p2=e.p2shown;
  if(id==='combo') {
    const probabilities=aurelionRules.rules.combo_stops[p2?'phase2':'phase1'],r=Math.random();
    return m.sequences[mode||(r<probabilities.stop1?'stop1':r<probabilities.stop1+probabilities.stop2?'stop2':'full')];
  }
  if(id==='sword_wave')return m.sequences[p2?'phase2':'phase1'];
  if(id==='whirl')return [1,...Array.from({length:m.run_loop.max_cycles},()=>[2,3,4,5]).flat(),6,7,8,9];
  if(id==='charge')return [1,2,...Array.from({length:m.run_loop.max_cycles},()=>m.run_loop.drawings).flat(),5,6,7,8];
  if(id==='guard')return m.sequences[mode||'guard'];
  return all;
}
function setAurelionTimeline(e,id,mode) {
  const a=aurelionData(e);a.move=id;a.guard=id==='guard'?(mode||'guard'):null;
  let timeline=aurelionTimeline(id,aurelionSequence(e,id,mode),e.p2shown,{compress:id!=='guard',...(mode==='timeout'?{duration:aurelionMoves.guard.timeout_punish}:{})});
  if(id==='guard'&&a.guard==='guard')timeline=aurelionTimeline(id,[1,2,1,2,1],false).slice(0,aurelionMoves.guard.guard_frames);
  a.timeline=timeline;a.cursor=0;a.processed=-1;a.current=timeline[0];a.hitInstances=new Set();a.seenInstances=new Set();a.token=(a.token||0)+1;
  a.whirlLanded=false;
  e.pt=0;e.invuln=false;
}
function initAurelionPattern(e) {
  const a=aurelionData(e),id=e.pat;
  // Old IDs are accepted only as explicit aliases for tools that force patterns.
  const resolved={slash3:'combo',pillars:'judgment'}[id]||id;
  if(!aurelionMoves[resolved])return;
  e.pat=resolved;
  a.repeats=a.lastMove===resolved?a.repeats+1:1;a.lastMove=resolved;
  a.cooldowns[resolved]=aurelionRules.rules.cooldowns[resolved]||0;
  if(resolved==='guard'){a.forceGuard=false;a.pressure=0;}a.marks=[];
  setAurelionTimeline(e,resolved);
}
function resetAurelionPattern(e) {
  if(!isAurelion(e))return;
  const a=aurelionData(e);
  for(const z of hazards)if(z.type==='aurelion'&&z.owner===e&&z.kind==='judge_mark')z.dead=true;
  a.move=null;a.guard=null;a.current=null;a.marks=[];
}
function aurelionAttackGap(e) {
  const [lo,hi]=aurelionRules.rules.attack_gap[e.p2shown?'phase2':'phase1'];
  return Math.round(rand(lo,hi));
}
function pickAurelionPattern(e,dx,dy) {
  const a=aurelionData(e);
  if(a.forceGuard)return 'guard';
  if(a.tauntPending&&!a.cooldowns.taunt){a.tauntPending=false;return 'taunt';}
  const bands=aurelionRules.distance_bands;
  const band=dx<bands.near[1]*AURELION_K?'near':dx<bands.mid[1]*AURELION_K?'mid':'far';
  const weights=aurelionRules.phases[e.p2shown?1:0].weights[band];
  const choices=Object.entries(weights).filter(([id])=>!a.cooldowns[id]&&!(id===a.lastMove&&a.repeats>=aurelionRules.rules.same_move_max_in_row));
  if(!choices.length)return null;
  let r=Math.random()*choices.reduce((s,[,w])=>s+w,0);
  const id=choices.find(([,w])=>(r-=w)<0)?.[0]||choices.at(-1)[0];
  if(id==='approach'||id==='back_off'){a.locomotion=id;a.locomotionTicks=24;return null;}
  const depth=['sword_wave','judgment'].includes(id)?bands.align.ranged_dz:bands.align.melee_dz;
  if(dy>depth)return null;
  return id;
}
function chaseAurelion(e) {
  const a=aurelionData(e),p=player,dx=p.x-e.x,dy=p.y-e.y;
  if(p.st==='dead')return;
  if((a.turnTicks||0)<=0){e.face=dx>=0?1:-1;a.turnTicks=4;}else a.turnTicks--;
  const speed=e.p2shown?aurelionRules.phases[1].walk_speed:aurelionRules.stats.walk_speed;
  const away=a.locomotion==='back_off'&&a.locomotionTicks>0;
  if(a.locomotionTicks>0)a.locomotionTicks--;
  const target=away?e.x-e.face*40:p.x-e.face*50;
  e.x+=clamp(target-e.x,-speed[0]*AURELION_K,speed[0]*AURELION_K);
  e.y+=clamp(dy,-speed[1]*AURELION_K,speed[1]*AURELION_K);e.walk=Math.abs(target-e.x)>2||Math.abs(dy)>2;
  const attackers=enemies.filter(o=>o!==e&&['wind','act','pat'].includes(o.st)).length;
  if(attackers>=3||p.st==='down'||e.atkCd>0||a.locomotionTicks>0)return;
  const pat=pickAurelionPattern(e,Math.abs(dx),Math.abs(dy));
  if(pat)startPat(e,pat);else e.atkCd=6;
}
function reactAurelionAttack() {
  if(!USE_AURELION_V133)return;
  for(const e of enemies)if(isAurelion(e)&&e.st==='chase'&&!e.phaseT&&player.st!=='down') {
    const a=aurelionData(e);
    if(!a.cooldowns.guard&&Math.abs(e.x-player.x)<170*AURELION_K&&Math.abs(e.y-player.y)<20&&
       Math.random()<aurelionRules.guard.reactive_chance[e.p2shown?'phase2':'phase1']&&
       enemies.filter(o=>o!==e&&['wind','act','pat'].includes(o.st)).length<3)startPat(e,'guard');
  }
}
function aurelionPunishable(e) {
  const a=aurelionData(e),m=aurelionMoves[a.move];
  return a.guard==='broken'||a.guard==='timeout'||a.move==='taunt'||(m?.punish_window&&a.current&&aurelionIn([m.punish_window.frames],a.current.source));
}
function interceptAurelionDamage(e,kd,fixedDamage) {
  const a=aurelionData(e);
  if(e.invuln||e.phaseT>0||e.st==='dead')return false;
  if(e.st==='pat'&&a.guard==='guard') {
    const heavy=kd||fixedDamage||player.st==='special'||player.st==='cast'||player.atk==='air'&&player.st==='atk'||
      player.st==='atk'&&player.combo===2||player.st==='skill'&&['thrust','slam','leap'].includes(player.skill);
    if(heavy){setAurelionTimeline(e,'guard','broken');e.gr=Math.min(e.grMax,e.gr+30);e.grT=150;return false;}
    setAurelionTimeline(e,'guard','parry');
    // Existing short hurt animation, with no damage, invincibility or chain mutation.
    if(!['special','dead','down'].includes(player.st)){player.st='hurt';player.t=0;player.vx=0;player.skill=null;player.buf=0;}
    return true;
  }
  if(!aurelionPunishable(e)) {
    a.pressure++;if(a.pressure>=(e.p2shown?2:3))a.forceGuard=true;
  }
  return false;
}
function aurelionArmored(e){const a=e.aurelion;return isAurelion(e)&&e.st==='pat'&&a?.current&&aurelionIn(aurelionMoves[a.move]?.super_armor,a.current.source);}
function aurelionBoxHit(box,depth,x,y,face=1,h=0,oldX=x) {
  const [bx,by,bw,bh]=box,k=AURELION_K,p=player;
  const left=Math.min(x,oldX)+Math.min(bx*face,(bx+bw)*face)*k;
  const right=Math.max(x,oldX)+Math.max(bx*face,(bx+bw)*face)*k;
  return p.x+12>=left&&p.x-12<=right&&Math.abs(p.y-y)<depth&&p.z+90>=h+by*k&&p.z<=h+(by+bh)*k;
}
function aurelionHurtPlayer(e,attack,source=e) {
  const hpBefore=player.hp;
  const hit=hurtPlayer(attack.damage,source.face??e.face,!!attack.knockdown,source);
  if(hit){hitStop=Math.max(hitStop,attack.hitstop||0);const a=aurelionData(e);a.stats.hits.push({move:a.move,frame:a.cursor,baseDamage:attack.damage,damage:hpBefore-player.hp});
    if(player.st==='down'&&Math.random()<aurelionRules.phases[e.p2shown?1:0].taunt.chance)a.tauntPending=true;}
  return hit;
}
function spawnAurelionFx(e,id,x=e.x,y=e.y,h=0,extra={}) {
  const def=AURELION_ART.projectiles[id]||{},fx=def.use||id;
  const fxDef=AURELION_ART.effects[fx];
  const z={type:'aurelion',kind:id,fx,x,y,h,owner:e,face:e.face,age:0,
    life:(def.frame_duration||fxDef?.frame_duration||5)*(fxDef?.frames||4),visual:!!def.visual_only,
    damageScale:e.p2shown?1.3:1,...extra};hazards.push(z);return z;
}
function spawnAurelionEvent(e,event) {
  const a=aurelionData(e),id=event.id,k=AURELION_K;
  if(event.type==='sfx'){sfx(AURELION_SFX[id]||'bwind');return;}
  if(event.type==='shake'){shake=Math.max(shake,event.strength);return;}
  if(event.type==='slowmo'){slowT=Math.max(slowT,event.frames*MS);return;}
  if(event.type==='ui')return; // Existing card / health bar own their presentation.
  if(event.type!=='spawn')return;
  a.stats.events[id]=(a.stats.events[id]||0)+1;
  const x=e.x+e.face*(event.offset?.[0]||0)*k,h=(event.offset?.[1]||0)*k;
  if(id==='royal_halo'||id==='gold_aura'){a.halo=true;return;}
  if(id==='gold_shock') {
    const def=AURELION_ART.projectiles.gold_shock;
    for(const dir of e.p2shown?[1,-1]:[1])for(let i=0;i<(dir===1?4:3);i++)
      spawnAurelionFx(e,id,dir===1?x+e.face*i*def.step*k:e.x-e.face*(i+1)*def.step*k,e.y,0,{delay:i*def.interval,visual:false});
  } else if(id==='judge_mark') {
    const placement=AURELION_ART.projectiles.judge_mark.placement[e.p2shown?'phase2':'phase1'];
    a.marks=placement.map(([dx,dy])=>({x:clamp(player.x+dx*k,camX+20,camX+VW-20),y:clamp(player.y+dy*.75,GTOP+10,GBOT)}));
    for(const mark of a.marks)spawnAurelionFx(e,id,mark.x,mark.y,0,{life:9999,castToken:a.token});
  } else if(id==='judge_pillar') {
    for(const mark of a.marks||[])spawnAurelionFx(e,id,mark.x,mark.y,0,{visual:false});
    for(const z of hazards)if(z.owner===e&&z.kind==='judge_mark')z.dead=true;
  } else spawnAurelionFx(e,id,x,e.y,h);
}
function runAurelionPattern(e) {
  const a=aurelionData(e);if(!a.move)initAurelionPattern(e);
  if(!a.timeline){endPat(e);return;}
  const target=Math.floor(e.pt/MS+1e-6)-1;
  // No replay on a backwards clock; a fresh pattern/guard branch resets processed.
  while(a.processed<target&&e.st==='pat') {
    a.processed++;
    const entry=a.timeline[a.cursor];
    if(!entry) {
      if(a.move==='guard'&&a.guard==='guard'){setAurelionTimeline(e,'guard','timeout');return;}
      endPat(e);return;
    }
    a.current=entry;const m=aurelionMoves[a.move],token=a.token;
    e.invuln=aurelionIn(m.invulnerable,entry.source);
    for(const event of entry.events)spawnAurelionEvent(e,event);
    const speed=m.move?.per_drawing?.[entry.index]||0;
    e.x=clamp(e.x+e.face*speed*AURELION_K,camX-60,camX+VW+60);
    if(entry.d.hitboxes?.length&&!a.seenInstances.has(entry.instance)){a.seenInstances.add(entry.instance);a.stats.opportunities++;}
    if(!a.hitInstances.has(entry.instance))for(const hb of entry.d.hitboxes||[]) {
      const attack={...m.attack,...(hb.kind==='body'?m.body_attack:m.hit_attacks?.[entry.index])};
      // Upgrade the first successful hit, even if the opening swings were dodged.
      if(a.move==='whirl'&&!a.whirlLanded){attack.damage=16;attack.knockdown=true;}
      if(aurelionBoxHit(hb.box,hb.depth,e.x,e.y,e.face)&&aurelionHurtPlayer(e,attack)){
        if(a.move==='whirl')a.whirlLanded=true;
        a.hitInstances.add(entry.instance);break;
      }
    }
    if(a.token!==token)return;
    a.cursor++;
    if(a.move==='charge'&&entry.index===4&&a.timeline[a.cursor]?.index===3&&Math.abs(player.x-e.x)<130*AURELION_K) {
      while(a.timeline[a.cursor]&&a.timeline[a.cursor].index!==5)a.cursor++;
    }
    if(a.cursor>=a.timeline.length){
      if(a.move==='guard'&&a.guard==='guard')setAurelionTimeline(e,'guard','timeout');
      else endPat(e);
      return;
    }
  }
}
function aurelionIntroDuration(e){return isAurelion(e)?aurelionMoves.intro.total_frames*MS:INTRO_MS;}
function beginAurelionTransition(e) {const a=aurelionData(e);e.phaseT=242;a.transitionAge=0;a.halo=false;}
function updateAurelionIntro(e) {
  const a=aurelionData(e),to=Math.min(141,Math.floor(introT/MS));
  for(const ev of aurelionMoves.intro.events)if(ev.frame>(a.introFrame??-1)&&ev.frame<=to)spawnAurelionEvent(e,ev);
  a.introFrame=to;
}
function updateAurelionState(e) {
  if(!isAurelion(e))return false;
  const a=aurelionData(e);
  for(const id in a.cooldowns)if(a.cooldowns[id]>0)a.cooldowns[id]--;
  if(e.phaseT>0) {
    const age=a.transitionAge||0,id=age<100?'knockdown':'awaken',f=age<100?age:age-100;
    for(const ev of aurelionMoves[id].events)if(ev.frame===f)spawnAurelionEvent(e,ev);
    a.transitionAge=age+1;
  }
  if(e.st==='dead') {
    e.t++;if(e.flash>0)e.flash--;
    for(const ev of aurelionMoves.death.events)if(ev.frame===e.t-1)spawnAurelionEvent(e,ev);
    if(e.t>=aurelionMoves.death.total_frames+50)e.remove=true;
    return true;
  }
  const pose=aurelionPose(e),d=aurelionDrawing(pose.id,pose.f),boxes=d.hurtboxes||[];
  if(boxes.length)e.hw=(Math.max(...boxes.map(b=>b[0]+b[2]))-Math.min(...boxes.map(b=>b[0])))*AURELION_K/2;
  // A stun borrows the fallen pose, not its immunity: common groggy remains punishable.
  if(!e.phaseT)e.invuln=e.st!=='stun'&&aurelionIn(aurelionMoves[pose.id].invulnerable,pose.f);
  return false;
}
function aurelionPose(e) {
  const a=aurelionData(e);
  if(e.phaseT>0){const age=a.transitionAge||0;return age<100?{id:'knockdown',f:age}:{id:'awaken',f:age-100};}
  if(e.st==='intro')return {id:'intro',f:introT/MS};
  if(e.st==='dead')return {id:'death',f:Math.min(120,e.t)};
  if(e.st==='down')return {id:'knockdown',f:Math.min(99,e.t/60*100)};
  if(e.st==='stun')return {id:'knockdown',f:40};
  if(e.st==='hurt')return {id:'hurt',f:(e.hheavy?20:0)+Math.min(19,e.t*2)};
  if(e.st==='pat'&&a.current)return {id:a.move,f:a.current.source};
  return {id:e.walk?'walk':'idle',f:tick};
}
function paintAurelion(f,x,y,face=1,alpha=1,k=.85,add=false) {
  const im=f&&AURELION_SHEETS[f.sheet];if(!im?.naturalWidth)return false;
  const [sx,sy,w,h]=f.atlas,[ax,ay]=f.anchor;
  ctx.save();ctx.translate(x-camX,y);ctx.scale(face,1);ctx.globalAlpha*=alpha;ctx.imageSmoothingEnabled=false;
  if(add)ctx.globalCompositeOperation='lighter';
  ctx.drawImage(im,sx,sy,w,h,-ax*k,-ay*k,w*k,h*k);ctx.restore();return true;
}
function aurelionTelegraph(e) {
  const a=e.aurelion;if(e.st!=='pat'||!a?.current)return null;
  const tele=aurelionMoves[a.move].telegraph;
  if(a.guard==='guard')return {flash:'gold',warning:false};
  if(!tele)return null;
  const f=a.current.source;
  return {flash:tele.flash&&tele.flash_frames&&aurelionIn([tele.flash_frames],f)?tele.flash:null,
    warning:!!tele.warning_icon_frames&&aurelionIn([tele.warning_icon_frames],f)};
}
function aurelionFxFrame(id,f) {const frames=AURELION_ART.clips['fx_'+id];return frames?.[Math.max(0,Math.min(frames.length-1,Math.floor(f)))];}
function drawAurelion(e) {
  if(!isAurelion(e))return false;
  const a=aurelionData(e),pose=aurelionPose(e),f=aurelionFrame(pose.id,pose.f);
  if(!AURELION_SHEETS[f?.sheet]?.naturalWidth)return false;
  drawShadow(e.x-camX,e.y,SPRITES.boss3.sh,e.z);
  if(aurelionHaloVisible(e)) {
    paintAurelion(aurelionFxFrame('royal_halo',Math.floor(tick/6)%4),e.x,e.y-e.z-215*AURELION_K,e.face,1,.85,true);
    if(e.p2shown)paintAurelion(aurelionFxFrame('gold_aura',Math.floor(tick/5)%4),e.x,e.y,e.face,.55,.85,true);
  }
  ctx.save();const tele=aurelionTelegraph(e);
  if(e.flash>0&&UX.options.flash)ctx.filter='brightness(1.8)';
  else if(tele?.flash&&UX.options.flash&&Math.floor(e.pt/90)%2===0)ctx.filter=tele.flash==='white'?'brightness(2)':tele.flash==='red'?'sepia(1) saturate(5) hue-rotate(310deg)':'sepia(1) saturate(4)';
  paintAurelion(f,e.x,e.y-e.z,e.face);ctx.restore();
  const drawing=aurelionDrawing(pose.id,pose.f),blade=drawing.hitboxes?.find(b=>b.kind!=='body')?.box;
  const tip=aurelionMoves[pose.id].events?.find(ev=>ev.at==='blade_tip')?.offset;
  e.tipX=e.x+e.face*(blade?blade[0]+blade[2]:tip?.[0]??90)*AURELION_K;
  e.tipH=e.z+(blade?blade[1]+blade[3]/2:tip?.[1]??160)*AURELION_K;
  if(aurelionDebug)drawAurelionBoxes(e);
  return true;
}
function aurelionHaloVisible(e){return !!e.aurelion?.halo&&(e.p2shown||e.st==='intro')&&!['down','stun','dead'].includes(e.st)&&(!e.phaseT||e.aurelion.transitionAge>=146);}
function drawAurelionBoxes(e) {
  const pose=aurelionPose(e),d=aurelionDrawing(pose.id,pose.f);
  const draw=(box,color)=>{const [x,y,w,h]=box;ctx.strokeStyle=color;ctx.strokeRect(e.x-camX+(e.face>0?x:-(x+w))*AURELION_K,e.y-e.z-(y+h)*AURELION_K,w*AURELION_K,h*AURELION_K);};
  ctx.save();ctx.lineWidth=1;for(const b of d.hurtboxes||[])draw(b,'#71ff9a');for(const b of d.hitboxes||[])draw(b.box,'#ff5276');ctx.restore();
}
function updateAurelionHazard(z) {
  if(!USE_AURELION_V133||z.type!=='aurelion')return false;
  const e=z.owner,f=z.age/MS-(z.delay||0),def=AURELION_ART.projectiles[z.kind];
  if(e?.st==='dead'||e?.phaseT>0){z.dead=true;return true;}
  if(f<0)return true;
  if(z.kind==='judge_mark') {
    if(e.st!=='pat'||e.aurelion?.move!=='judgment'||e.aurelion.token!==z.castToken)z.dead=true;
    return true;
  }
  if(!z.visual&&def?.hitbox) {
    const old=z.x;
    if(z.kind==='gold_wave')z.x+=z.face*def.speed[e.p2shown?'phase2':'phase1']*AURELION_K;
    const active=!def.active_frames||aurelionIn([def.active_frames],f);
    if(active&&!z.hit&&aurelionBoxHit(def.hitbox,def.depth,z.x,z.y,z.face,z.h,old)&&aurelionHurtPlayer(e,def,z))z.hit=true;
    if(z.kind==='gold_wave'&&z.hit)z.dead=true;
  }
  if(f>=(def?.lifetime||z.life)||z.x<camX-180||z.x>camX+VW+180)z.dead=true;
  return true;
}
function drawAurelionHazards() {
  if(!USE_AURELION_V133)return;
  for(const z of hazards)if(z.type==='aurelion'&&!z.dead) {
    const f=z.age/MS-(z.delay||0);if(f<0)continue;
    const def=AURELION_ART.projectiles[z.kind],fx=AURELION_ART.effects[z.fx];
    const step=def.frame_duration||fx.frame_duration;
    const frame=def.loop?Math.floor(f/step)%fx.frames:Math.min(fx.frames-1,Math.floor(f/step));
    const alpha=z.kind==='judge_mark'?riftWarningAlpha({age:z.age,delay:Infinity}):1;
    paintAurelion(aurelionFxFrame(z.fx,frame),z.x,z.y-z.h,z.face,alpha,.85*(def.scale||1),true);
    if(aurelionDebug&&def.hitbox){ctx.save();ctx.strokeStyle='#ff5276';const [x,y,w,h]=def.hitbox;ctx.strokeRect(z.x-camX+(z.face>0?x:-(x+w))*AURELION_K,z.y-z.h-(y+h)*AURELION_K,w*AURELION_K,h*AURELION_K);ctx.restore();}
  }
}
let aurelionPortrait=null;
function getAurelionPortrait() {
  if(!USE_AURELION_V133)return null;
  const f=aurelionFrame('idle'),im=AURELION_SHEETS[f.sheet];if(!im?.naturalWidth)return null;
  if(!aurelionPortrait){const c=document.createElement('canvas');c.width=c.height=64;c.hd=true;
    const [x,y,w,h]=f.atlas;c.getContext('2d').drawImage(im,x+w*.2,y+h*.03,w*.65,h*.35,0,0,64,64);aurelionPortrait=c;}
  return aurelionPortrait;
}

function aurelionGhostFrame(){const e=enemies.find(isAurelion);if(!e)return null;const p=aurelionPose(e);return aurelionFrame(p.id,p.f);}
