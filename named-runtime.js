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
    if (p.skill === 'thrust') return namedClip('player','dash',t<180?0:t<240?1:t<360?2:t<480?3:5);
    if (p.skill === 'slam') return namedClip('player','leap',t<300?3:t<620?4:5);
    if (p.skill === 'whirl') return namedClip('player','whirl',t<180?0:t<540?1:2);
    if (p.skill === 'leap') return namedClip('player','leap',t<120?0:t<340?1:t<560?3:t<720?4:5);
  }
  if (p.st === 'atk' && p.atk !== 'air') {
    const a=ATK[p.atk],active=t>=a.wind && t<=a.wind+a.act;
    return p.combo===1 ? namedClip('player','upper',active?1:t<a.wind?0:2) : namedClip('player','dash',active?3:t<a.wind?0:5);
  }
  if (p.st === 'dash') return namedClip('player','dash',t<60?1:2);
  if (p.st === 'special') {
    if (t<620) return namedClip('player','special',t<450?0:1);
    if(t<1260)return namedClip('player','dash',3);
    return namedClip('player','leap',t<1650?3:t<1900?4:5);
  }
  return null; // Sheet has no verified walk/hurt/death; preserve existing motion.
}
function namedEnemyRole(e) {
  if(['grunt','rogue','archer','brute'].includes(e.type))return 'stage'+(stageIdx+1)+'_'+(e.type==='brute'?'grunt':e.type);
  if(e.type==='boss2')return e.p2shown ? 'boss2p2' : null;
  return ['boss1','boss3','boss4','boss5'].includes(e.type) ? e.type : null;
}
function namedEnemyFrame(e) {
  const actor=namedEnemyRole(e); if(!actor)return null;
  if(!e.boss && ['wind','act','rec'].includes(e.st)) {
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
  const [sx,sy,w,h]=frame.atlas,[ax,ay]=frame.anchor,k=frame.scale*(actor.type==='brute'?1.12:1);
  if(shadow)drawShadow(actor.x-camX,actor.y,SPRITES[actor.d.sprite].sh,actor.z);
  ctx.save();
  const hurt=actor.hr<220 ? Math.cos(actor.hr*.03)*Math.exp(-actor.hr/150)*(actor.hdir||1)*3 : 0;
  ctx.translate(actor.x-camX+hurt,actor.y-actor.z);ctx.scale(actor.face,1);
  ctx.globalAlpha=actor.st==='dead'?(actor.boss?clamp(1-(actor.t-65)/55,0,1):clamp(1-(actor.t-40)/25,0,1)):actor.alpha??1;
  ctx.imageSmoothingEnabled=false;
  if(actor.flash>0 && UX.options.flash)ctx.filter='brightness(2)';
  ctx.drawImage(NAMED_ATLAS,sx,sy,w,h,-ax*k,-ay*k,w*k,h*k);
  ctx.restore();return true;
}
function drawNamedPlayer() {
  const f=namedPlayerFrame();if(!paintNamedFrame(f,player))return false;
  player.tipX=player.x+player.face*72;player.tipH=player.z+68;
  return true;
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
