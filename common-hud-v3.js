'use strict';
// Independent Aseprite sprites; the game owns all dynamic text and state.
const compactHud = {};
for (const name of ['player_panel','portrait_frame','name_plate','life_icon','player_bar_frame',
  'hp_track','hp_fill','hp_lag_fill','sp_track','sp_fill','score_plate','scroll_slot','scroll_icon',
  'scroll_icon_empty','buff_glow','skill_slot','skill_keycap','skill_cooldown_mask','key_font',
  'boss_portrait_frame','boss_name_plate','boss_bar_frame','boss_track','boss_hp_fill',
  'boss_lag_fill','boss_phase_pip','boss_groggy_marker','pause_frame']) {
  const image = new Image(); image.src = `assets/aseprite/ui/hud-v4/${name}.png`; compactHud[name] = image;
}
for (const name of ['enemy_health_frame','enemy_health_fill','enemy_name_plate']) {
  const image = new Image(); image.src = `assets/aseprite/ui/enemy-v3/${name}.png`; compactHud[name] = image;
}
function compactReady(...names) { return names.every(n => compactHud[n].complete && compactHud[n].naturalWidth); }
function compactImage(name,x,y) { ctx.drawImage(compactHud[name],x,y); }
function compactFill(name,x,y,ratio) {
  const im=compactHud[name], r=clamp(ratio,0,1), w=Math.floor(im.width*r);
  if(w>0) ctx.drawImage(im,0,0,w,im.height,x,y,w,im.height);
}
function compactText(text,x,y,maxWidth) {
  ctx.font="bold 10px 'Malgun Gothic', sans-serif"; ctx.textAlign='left';
  ctx.lineWidth=2; ctx.strokeStyle='#080609'; ctx.fillStyle='#f0dfcf';
  ctx.strokeText(String(text),x,y,maxWidth); ctx.fillText(String(text),x,y,maxWidth);
}
function drawCompactPlayer(p) {
  if (!compactReady('player_panel','portrait_frame','name_plate','life_icon','player_bar_frame',
    'hp_track','hp_fill','hp_lag_fill','sp_track','sp_fill','score_plate','scroll_slot','scroll_icon',
    'scroll_icon_empty','buff_glow')) return false;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  compactImage('player_panel',12,12);
  if (p.buff > 0) hudFrame('buff_glow',Math.floor(tick / 11) % 2,52,52,11,11);
  ctx.fillStyle = '#2a0a10';
  ctx.fillRect(19,19,36,36);
  const face = portrait('player');
  if (face?.width) ctx.drawImage(face,19,19,36,36);
  if (p.buff > 0) {
    ctx.fillStyle = '#d4b06a';
    ctx.fillRect(19,53,Math.round(36 * clamp(p.buff / 900,0,1)),2);
  }
  compactImage('portrait_frame',15,15);
  compactImage('name_plate',60,13);
  hudV4Text(isViesa(p) ? 'VIESA' : 'VAREL',67,24,10,105);
  compactImage('life_icon',182,16);
  hudV4Text(`×${Math.max(0,p.lives)}`,193,24,9,14);

  compactImage('hp_track',63,32);
  compactFill('hp_lag_fill',63,32,lagTo(p,'hpLag',p.hp,.5) / p.max);
  compactFill('hp_fill',63,32,p.hp / p.max);
  compactImage('player_bar_frame',60,29);
  compactImage('sp_track',63,43);
  compactFill('sp_fill',63,43,p.sp / SP_MAX);
  if (p.sp >= SP_MAX) {
    ctx.fillStyle = Math.floor(tick / 8) % 2 ? '#8fd0ff' : '#3e8fe8';
    ctx.fillRect(63,43,144,1);
  }
  compactImage('player_bar_frame',60,40);

  for (let i=0; i<3; i++) {
    const x = 60 + i * 17;
    compactImage('scroll_slot',x,51);
    compactImage(i < p.mg ? 'scroll_icon' : 'scroll_icon_empty',x+2,53);
  }
  compactImage('score_plate',113,54);
  hudV4Text('SCORE',118,63,7,27,'#c1b5ae');
  hudV4Text(p.score,148,63,8,33);
  ctx.fillStyle = '#5e4520';
  ctx.fillRect(183,57,1,6);
  hudV4Text(`Lv ${stageIdx+1}`,186,63,8,21,'#d4b06a');
  if (scene === 'play' && !UX.options.touch) drawHudV4Skills(p);
  ctx.restore();
  return true;
}

function hudV4Text(text,x,y,size,width,color='#f0dfcf') {
  ctx.font = `bold ${size}px Georgia, 'Malgun Gothic', sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = color;
  ctx.fillText(String(text),x,y,width);
}

function hudFrame(name,frame,w,h,x,y) {
  ctx.drawImage(compactHud[name],frame*w,0,w,h,x,y,w,h);
}

function drawHudV4Skills(p) {
  if (!compactReady('skill_slot','skill_keycap','skill_cooldown_mask','key_font')) return;
  const vies = isViesa(p);
  const icons = vies ? viesaUI.atlas : HUD_UI;
  const ids = ['thrust','slam','whirl','leap','redwave'];
  for (const [i,id] of ids.entries()) {
    const x = 42 + i * 29, y = 72;
    compactImage('skill_slot',x,y);
    if (icons && (vies || hudUI.ready)) {
      const region = vies ? [952+i*140,700,105,120] : [51+i*87.2,201,61,66];
      ctx.drawImage(icons,...region,x+5,y+2,16,16);
    }
    const remaining = vies && id === 'slam' ? 0 : p.skillCd[id];
    if (remaining > 0) {
      ctx.drawImage(compactHud.skill_cooldown_mask,0,0,20,16,x+3,y+2,20,16);
      hudV4Text((remaining/1000).toFixed(1),x+6,y+13,8,14);
    }
    const action = 'Key' + SKILLS[id].key;
    const binding = UX.options.bindings[action] ?? action;
    const key = UX.keyName(binding).toUpperCase();
    const glyph = key.length === 1 ? 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.indexOf(key) : -1;
    if (glyph >= 0) {
      compactImage('skill_keycap',x+8,y+18);
      ctx.drawImage(compactHud.key_font,glyph*6,0,5,5,x+10,y+20,5,5);
    } else {
      // Remapped keys such as SPACE need the whole row.
      ctx.fillStyle = '#080609';
      ctx.fillRect(x+2,y+18,22,8);
      ctx.fillStyle = '#9a7434';
      ctx.fillRect(x+3,y+18,20,1);
      hudV4Text(key,x+4,y+24,7,18);
    }
  }
}
function drawCompactEnemy(e) {
  if(!compactReady('enemy_name_plate','enemy_health_frame','enemy_health_fill')) return false;
  const x=W-180,y=18; ctx.save();ctx.imageSmoothingEnabled=false;
  compactImage('enemy_name_plate',x,y); compactImage('enemy_health_frame',x+72,y+1);
  compactFill('enemy_health_fill',x+78,y+5,e.hp/e.max); compactText(e.d.name||'',x+5,y+10,62);
  ctx.restore(); return true;
}
function drawCompactBoss(boss,hud) {
  if (!compactReady('boss_portrait_frame','boss_name_plate','boss_bar_frame','boss_track',
    'boss_hp_fill','boss_lag_fill','boss_phase_pip','boss_groggy_marker')) return false;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  const p2 = boss.g2 ? boss.g2.phase >= 2 : !!boss.p2shown;
  ctx.fillStyle = '#2a0a10';
  ctx.fillRect(262,484,36,36);
  const face = hudBossFace(boss);
  if (face?.width) ctx.drawImage(face,262,484,36,36);
  compactImage('boss_portrait_frame',258,480);
  hudBossPlate(306,190);
  hudV4Text(boss.d.name || '',318,495,10,170);
  hudBossPlate(620,84);
  hudV4Text(boss.barLabel && !/^(I|II)$/.test(boss.barLabel) ? boss.barLabel : p2 ? 'PHASE II' : 'PHASE I',
    632,495,8,48,'#d4b06a');
  hudFrame('boss_phase_pip',p2 ? 1 : 0,7,7,683,489);
  hudFrame('boss_phase_pip',p2 ? 0 : 1,7,7,692,489);
  compactImage('boss_track',317,506);
  compactFill('boss_lag_fill',317,506,hud.lag / boss.max);
  compactFill('boss_hp_fill',317,506,hud.value / boss.max);
  compactImage('boss_bar_frame',304,503);
  const groggy = boss.st === 'stun' ? 1 - boss.t / GROGGY_TICKS : boss.gr / boss.grMax;
  if (groggy > 0) compactImage('boss_groggy_marker',317 + Math.round(371 * clamp(groggy,0,1)),504);
  ctx.restore();
  return true;
}

function hudBossPlate(x,width) {
  // Preserve the 11px ornament and 4px end cap from the Aseprite slice.
  const im = compactHud.boss_name_plate;
  ctx.drawImage(im,0,0,11,16,x,484,11,16);
  const middle = width - 15;
  for (let offset=0; offset<middle; offset+=135) {
    const length = Math.min(135,middle-offset);
    ctx.drawImage(im,11,0,length,16,x+11+offset,484,length,16);
  }
  ctx.drawImage(im,146,0,4,16,x+width-4,484,4,16);
}
