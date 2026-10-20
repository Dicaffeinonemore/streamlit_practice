'use strict';
// Explicit roles are independent of filesystem ordering and background keys.
function namedClip(actor, action, index = 0) {
  const ids = NAMED_SPRITES.clips[actor]?.[action];
  if (!ids?.length) return null;
  return NAMED_SPRITES.frames[ids[Math.max(0, Math.min(ids.length - 1, Math.floor(index)))]];
}
function namedAt(actor, action, progress, loop = false) {
  const ids = NAMED_SPRITES.clips[actor]?.[action];
  if (!ids?.length) return null;
  return namedClip(actor, action, (loop ? progress % 1 : clamp(progress, 0, .999999)) * ids.length);
}
function namedPlayerFrame() {
  const p = player, t = p.t * MS;
  if (p.st === 'skill') {
    if (p.skill === 'redwave') return t<540 ? namedClip('player','cast',t<300?0:t<420?1:2) : namedClip('player','idle');
    if (p.skill === 'thrust') return namedClip('player','rush',t<180?0:t<240?1:t<300?2:t<360?3:t<500?4:5);
    if (p.skill === 'slam') return namedClip('player',t<330?'overhead':t<600?'plunge':'idle');
    if (p.skill === 'whirl') return namedClip('player','whirl',t<180?0:t<300?1:t<430?2:t<540?3:t<620?4:5);
    if (p.skill === 'leap') return t<120 ? namedClip('player','dash',0) : t<480 ? namedClip('player','jump',t<300?0:1) : namedClip('player',t<720?'plunge':'idle');
  }
  if (p.st === 'atk') {
    const a=ATK[p.atk],active=t>=a.wind && t<=a.wind+a.act;
    if(p.atk==='air')return namedClip('player',active?'plunge':'jump',1);
    return namedClip('player',t<a.wind?'overhead':active?(p.combo===1?'swing':'stab'):'idle');
  }
  if (p.st === 'dash') return namedAt('player','dash',t/280);
  if (p.st === 'hurt') return namedClip('player','hurt');
  if (p.st === 'down' || p.st === 'dead') return namedClip('player','death');
  if (p.st === 'cast') return namedClip('player','overhead');
  if (p.st === 'special') {
    if (t<620) return namedClip('player','cast',0);
    if(t<1260)return namedAt('player','rush',(t-620)/640);
    return namedClip('player',t<1650?'overhead':t<1900?'plunge':'idle');
  }
  if(p.st==='free')return p.z>0 ? namedClip('player','jump',p.vz>0?0:1) : p.walk ? namedAt('player','walk',(p.walkTime||0)/800,true) : namedClip('player','idle');
  return null;
}
function namedEnemyRole(e) {
  if(['grunt','rogue','archer','brute'].includes(e.type))return 'stage'+(stageIdx+1)+'_'+e.type;
  if(e.type==='boss2')return e.p2shown ? 'boss2p2' : null;
  return ['boss1','boss3','boss4','boss5'].includes(e.type) ? e.type : null;
}
function namedEnemyFrame(e) {
  const actor=namedEnemyRole(e); if(!actor)return null;
  if(!e.boss && ['wind','act','rec'].includes(e.st)) {
    if(e.type==='brute') {
      if(e.st==='wind')return namedClip(actor,'attack',e.t/e.d.wind<.6?0:1);
      if(e.st==='act')return namedClip(actor,'attack',e.t/e.d.act<.6?2:3);
      return namedClip(actor,'attack',4);
    }
    if(e.st==='wind')return namedClip(actor,'attack',0);
    if(e.st==='act')return namedAt(actor,'attack',.34+e.t/e.d.act*.65);
    return namedClip(actor,'idle',0);
  }
  if(e.phaseT>0 && NAMED_SPRITES.clips[actor].awaken)return namedAt(actor,'awaken',1-e.phaseT/72);
  if(e.st==='dead')return namedAt(actor,'death',e.t*MS/(e.boss?1100:450));
  if(!e.boss && e.st==='down' && e.z===0)return namedAt(actor,'death',e.t/35);
  if(e.st==='hurt'||e.st==='stun'||e.st==='down')return namedAt(actor,NAMED_SPRITES.clips[actor].hurt?'hurt':'idle',e.t/30);
  if(actor==='boss5') {
    if(e.st==='pat') {
      const tele=TELE[e.pat]||500;
      if(e.pt<tele)return namedClip(actor,'cast',0);
      if(e.pat==='eclipse')return namedAt(actor,'awaken',(e.pt-tele)/1100);
      if(['orbs','charge','ravens'].includes(e.pat))return namedAt(actor,'slash',(e.pt-tele)/700);
      return namedAt(actor,'cast',(e.pt-tele)/700);
    }
    // The winged form persists after transformation, including idle and movement.
    if(e.p2shown)return namedAt(actor,'awaken',tick*MS/1800,true);
  }
  if(e.st==='pat') {
    const mapping={boss1:{sweep:'sweep',slam:'slam',rage:'rage',hook:'hook',meat:'idle'},boss2p2:{staff:'staff',teleport:'walk',orbs:'cast',ravens:'cast',feather:'staff',soul:'awaken'},boss3:{slash3:'slash',cleave:'slash',charge:'charge',whirl:'slash',pillars:'cast'},boss4:{slash3:'slash',slam:'slash',frost:'cast',orbs:'cast'}};
    const clip=mapping[actor][e.pat]; if(!clip)return null;
    const tele=TELE[e.pat]||500;
    if(e.pt<tele)return namedClip(actor, clip==='slash'?'idle':clip,0);
    return namedAt(actor,clip,(e.pt-tele)/700);
  }
  return namedAt(actor,e.walk?'walk':'idle',tick*MS/(e.walk?720:1400),true);
}
function paintNamedFrame(frame, actor, shadow=false) {
  if(!frame || !NAMED_ATLAS.complete || !NAMED_ATLAS.naturalWidth)return false;
  const [sx,sy,w,h]=frame.atlas,[ax,ay]=frame.anchor,k=frame.scale*(actor.type==='brute' && !frame.source.startsWith('heavy')?1.12:1)*(actor.boss?BOSS_VISUAL_SCALE:1);
  if(shadow)drawShadow(actor.x-camX,actor.y,SPRITES[actor.d.sprite].sh,actor.z);
  ctx.save();
  const hurt=actor.hr<220 ? Math.cos(actor.hr*.03)*Math.exp(-actor.hr/150)*(actor.hdir||1)*3 : 0;
  ctx.translate(actor.x-camX+hurt,actor.y-actor.z);ctx.scale(actor.face,1);
  ctx.globalAlpha=actor.st==='dead'?(actor.boss?clamp(1-(actor.t-65)/55,0,1):clamp(1-(actor.t-40)/25,0,1)):actor.alpha??1;
  smoothFor(k);
  if(actor.flash>0 && UX.options.flash)ctx.filter='brightness(2)';
  ctx.drawImage(NAMED_ATLAS,sx,sy,w,h,-ax*k,-ay*k,w*k,h*k);
  ctx.restore();return true;
}
function drawNamedPlayer() {
  const f=namedPlayerFrame();if(!paintNamedFrame(f,player))return false;
  const t=player.t*MS,impactAt=player.skill==='slam'?330:player.skill==='leap'?560:-1;
  if(player.st==='skill' && impactAt>=0 && t>=impactAt && t<impactAt+180)
    paintNamedFrame(namedClip('player','impact'),{...player,x:player.x+player.face*54,z:0,alpha:1-(t-impactAt)/180});
  player.tipX=player.x+player.face*72;player.tipH=player.z+68;
  return true;
}
function drawNamedWave(z) {
  return paintNamedFrame(namedAt('player','wave',z.age/360,true),
    {x:z.x,y:z.y,z:z.h,face:z.dir,alpha:Math.min(1,(520-z.travel)/50)});
}
function drawNamedEnemy(e){return paintNamedFrame(namedEnemyFrame(e),e,true);}
function setupNamedTitle() {
  const title=document.getElementById('title');title.classList.add('named-title');
  document.getElementById('btnTitleSettings').classList.remove('secondary');
  const image=document.createElement('img');image.id='namedTitleImage';image.alt='붉은 월식 아래 흑월의 기사';image.src=NAMED_ART.title;
  title.prepend(image);
  for(const [id,label] of [['btnStart','새 게임'],['btnContinue','이어하기'],['btnTitleSettings','설정']])document.getElementById(id).setAttribute('aria-label',label);
}
setupNamedTitle();
