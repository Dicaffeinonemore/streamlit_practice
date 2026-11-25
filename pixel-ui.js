'use strict';
// HUD_UI is the supplied 1672 × 941 player / boss design as a full-screen overlay
// (tools/build-hud-ui.py removes the live text and fills). Its coordinates are screen coordinates
// at 1672 wide, so the whole HUD is drawn at W / 1672.
const HUD_UI = new Image();
const ENEMY_UI = new Image();
// Large data URLs can fail to decode while the rest of the art loads; retry rather than keep the plain bar.
function loadUIImage(img, source) {
  let tries = 0;
  img.onerror = () => { if (tries++ < 5) setTimeout(() => { img.src = source; }, 400 * tries); };
  img.src = source;
}
loadUIImage(ENEMY_UI, ENEMY_UI_SOURCE);
const HUD_LAYOUT = {
  hp: [152, 99, 432, 23], sp: [56, 147, 507, 21], boss: [475, 850, 1142, 24],
  // Fill strips kept in the atlas by the build script: [x, y, width, height].
  hpStrip: [100, 400, 431, 21], spStrip: [100, 440, 505, 21], bossStrip: [100, 480, 1045, 22], bossLowStrip: [100, 520, 94, 22],
  scrolls: [[603, 92, 47, 74], [650, 92, 47, 74], [697, 92, 47, 74]],
  playerPortrait: [50, 42, 73, 79], bossPortrait: [45, 814, 80, 84],
  pause: [1524, 21, 116, 115],
};
const hudUI = { ready: false, emptyScrolls: [], bossLow: null };
function uiCrop(img, x, y, w, h) {
  const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
  canvas.getContext('2d').drawImage(img, x, y, w, h, 0, 0, w, h);
  return canvas;
}
HUD_UI.onload = () => {
  // Spent scroll charges become dark silhouettes, never mistaken for usable ones.
  hudUI.emptyScrolls = HUD_LAYOUT.scrolls.map(([x, y, w, h]) => {
    const tile = uiCrop(HUD_UI, x, y, w, h), c = tile.getContext('2d');
    c.globalCompositeOperation = 'source-atop'; c.fillStyle = 'rgba(10,7,9,.82)'; c.fillRect(0, 0, w, h);
    return tile;
  });
  const [lx, ly, lw, lh] = HUD_LAYOUT.bossLowStrip;
  hudUI.bossLow = uiCrop(HUD_UI, lx, ly, lw, lh);
  hudUI.ready = true;
};
loadUIImage(HUD_UI, HUD_UI_SOURCE);

// The design's lettering: heavy rounded type, a thick black outline, white or gold.
function hudText(text, x, y, size, fill, align = 'left', maxWidth = 0) {
  ctx.save();
  ctx.font = `900 ${size}px 'Arial Rounded MT Bold', 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif`;
  ctx.textAlign = align; ctx.textBaseline = 'alphabetic';
  if (maxWidth) { const w = ctx.measureText(text).width; if (w > maxWidth) { const s = maxWidth / w; ctx.translate(x, y); ctx.scale(s, 1); x = 0; y = 0; } }
  ctx.lineJoin = 'round'; ctx.lineWidth = size * .22; ctx.strokeStyle = '#000'; ctx.strokeText(text, x, y);
  if (fill === 'gold') {
    const g = ctx.createLinearGradient(0, y - size * .78, 0, y); g.addColorStop(0, '#fff7b0'); g.addColorStop(.45, '#ffd23a'); g.addColorStop(1, '#d88a00'); fill = g;
  } else if (fill === 'white') {
    const g = ctx.createLinearGradient(0, y - size * .78, 0, y); g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#d6d6d6'); fill = g;
  }
  ctx.fillStyle = fill; ctx.fillText(text, x, y);
  ctx.restore();
}
// Fill a bar interior from its strip: the strip is cropped (not squeezed) as the value drops.
function hudBar([x, y, w, h], [sx, sy, sw, sh], ratio, lag, lagColor) {
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  if (lag > ratio) { ctx.fillStyle = lagColor; ctx.fillRect(x, y, w * clamp(lag, 0, 1), h); }
  const amount = w * clamp(ratio, 0, 1);
  if (amount > 0) ctx.drawImage(HUD_UI, sx, sy, Math.min(sw, amount * sw / w), sh, x + 1, y + 1, amount, h - 2);
  ctx.restore();
}

function spGaugeShine(x,y,w,h) {
  if (player?.sp < SP_MAX || !player) return;
  ctx.fillStyle = Math.floor(tick / 8) % 2 ? '#8fd0ff88' : '#3e8fe855';
  ctx.fillRect(x,y,w,Math.max(1,Math.round(h / 4)));
}

function drawPixelHUD(p) {
  if (drawCompactPlayer(p)) return true;
  if (isViesa(p) && drawViesaUI(p)) return true;
  if (!hudUI.ready) return false;
  const L = HUD_LAYOUT;
  ctx.save(); ctx.scale(W / 1672, W / 1672);
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(HUD_UI, 0, 0, 800, 300, 0, 0, 800, 300);
  if (isViesa(p)) { const [x, y, w, h] = L.playerPortrait; drawViesaHUDPortrait(x, y, w, h); }
  hudBar(L.hp, L.hpStrip, p.hp / p.max, lagTo(p, 'hpLag', p.hp, .5) / p.max, '#f3d6c6');
  hudBar(L.sp, L.spStrip, p.sp / SP_MAX, 0, '');
  spGaugeShine(...L.sp);   // SP 가득: 마나 게이지 반짝임
  for (let i = 0; i < MAGIC.max && i < 3; i++) if (i >= p.mg) ctx.drawImage(hudUI.emptyScrolls[i], L.scrolls[i][0], L.scrolls[i][1]);
  if (p.buff > 0) {   // 파워업: 초상화 테두리가 금빛으로 깜빡인다
    const [x, y, w, h] = L.playerPortrait;
    ctx.strokeStyle = Math.floor(tick / 6) % 2 ? '#ffe14d' : '#c9a24a'; ctx.lineWidth = 5; ctx.strokeRect(x - 3, y - 3, w + 6, h + 6);
    ctx.fillStyle = '#36240c'; ctx.fillRect(x, y + h - 6, w, 6);
    ctx.fillStyle = '#ffdd63'; ctx.fillRect(x, y + h - 6, w * clamp(p.buff / 900, 0, 1), 6);
  }
  hudText(isViesa(p) ? 'viesa' : 'varel', 142, 70, 54, 'white');
  hudText(`1P×${Math.max(0, p.lives)}`, 297, 70, 54, 'gold');
  hudText(String(p.score), 621, 70, 54, 'white', 'right', 320);
  hudText(`level ${stageIdx + 1}`, 645, 70, 54, 'white');
  ctx.restore();
  return true;
}

// Trim only the transparent padding, then scale both axes equally.
const ENEMY_UI_LAYOUT = { right: 8, top: 56, width: 290, crop: [185, 28, 1815, 660] };
const enemyPortraitCache = new Map();
function enemyHUDPortrait(e) {
  if (e.s1 && STAGE1_ENEMY_ART[e.s1]) {
    const key = 'stage1:' + e.s1;
    if (enemyPortraitCache.has(key)) return enemyPortraitCache.get(key);
    const art = STAGE1_ENEMY_ART[e.s1], im = S1_ENEMY_IMG[e.s1];
    if (!im?.naturalWidth) return null;
    const frame = art.frames[art.clips.idle[0]], [sx, sy, w, h] = frame.atlas;
    const size = Math.min(w, h * .65);
    const left = clamp(frame.anchor[0] - size / 2, 0, w - size);
    const portrait = document.createElement('canvas'); portrait.width = portrait.height = 128;
    const c = portrait.getContext('2d'); c.imageSmoothingEnabled = false;
    c.drawImage(im, sx + left, sy, size, size, 0, 0, 128, 128);
    enemyPortraitCache.set(key, portrait);
    return portrait;
  }
  const role = namedEnemyRole(e);
  if (enemyPortraitCache.has(role)) return enemyPortraitCache.get(role);
  const frame = role && namedClip(role, 'idle');
  if (!frame || !NAMED_ATLAS.complete || !NAMED_ATLAS.naturalWidth) return null;
  const [sx, sy, w, h] = frame.atlas;
  const size = Math.min(w, h * .65);
  const left = clamp(frame.anchor[0] - size / 2, 0, w - size);
  const top = e.type === 'rogue' ? h * .16 : 0;
  const portrait = document.createElement('canvas'); portrait.width = portrait.height = 128;
  const c = portrait.getContext('2d', { willReadFrequently: true }); c.imageSmoothingEnabled = false;
  c.drawImage(NAMED_ATLAS, sx + left, sy + top, size, size, 0, 0, 128, 128);
  enemyPortraitCache.set(role, portrait);
  return portrait;
}
function drawPixelEnemyBar(e) {
  if (drawCompactEnemy(e)) return true;
  if (!ENEMY_UI.complete || !ENEMY_UI.naturalWidth) return false;
  const portrait = enemyHUDPortrait(e);
  if (!portrait) return false;
  const { right, top, width, crop } = ENEMY_UI_LAYOUT;
  const [cx, cy, cw, ch] = crop, scale = width / cw, x = W - right - width;
  ctx.save(); ctx.translate(x - cx * scale, top - cy * scale); ctx.scale(scale, scale);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(ENEMY_UI, cx, cy, cw, ch, cx, cy, cw, ch);
  // Replace the sample knight inside the frame with this stage's actual enemy.
  ctx.save(); ctx.beginPath(); ctx.ellipse(480, 342, 171, 167, 0, 0, Math.PI * 2); ctx.clip();
  const bg = ctx.createRadialGradient(480, 335, 10, 480, 342, 180);
  bg.addColorStop(0, '#5b1014'); bg.addColorStop(1, '#130305');
  ctx.fillStyle = bg; ctx.fillRect(305, 170, 350, 345);
  ctx.drawImage(portrait, 306, 178, 348, 348);
  ctx.restore();
  // Restore ornaments which overlap the portrait window.
  for (const [ox, oy, ow, oh] of [[436, 152, 90, 48], [280, 310, 70, 85], [625, 310, 60, 75], [412, 468, 138, 140]]) {
    ctx.drawImage(ENEMY_UI, ox, oy, ow, oh, ox, oy, ow, oh);
  }
  ctx.save(); ctx.beginPath(); ctx.roundRect(697, 332, 1168, 63, 31); ctx.clip();
  ctx.fillStyle = '#21090e'; ctx.fillRect(697, 332, 1168, 63);
  ctx.fillStyle = '#a75236'; ctx.fillRect(697, 332, 1168 * clamp(lagTo(e, 'hpLag', e.hp, e.max * .01) / e.max, 0, 1), 63);
  const fill = 1168 * clamp(e.hp / e.max, 0, 1);
  if (fill > 0) ctx.drawImage(ENEMY_UI, 760, 332, 800, 63, 697, 332, fill, 63);
  ctx.restore(); ctx.restore();
  krText(e.d.name, x + (1280 - cx) * scale, top + (254 - cy) * scale, '#ffe5dd', 12, 'center', '#240b0e');
  return true;
}

// The boss frame's face. The remade Gorath (boss1) is cut from its own idle frame; the other
// bosses use their existing portraits.
const phaseHUDFaces = new Map();
function hudFaceCrop(key,im,frame,cut) {
  if (phaseHUDFaces.has(key)) return phaseHUDFaces.get(key);
  if (!im?.naturalWidth || !frame) return null;
  const [x,y,w,h] = frame.atlas, [dx,dy,side] = cut(w,h,frame);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 36;
  const c = canvas.getContext('2d');
  c.imageSmoothingEnabled = false;
  c.drawImage(im,x+dx,y+dy,side,side,0,0,36,36);
  phaseHUDFaces.set(key,canvas);
  return canvas;
}
function hudBossFace(boss) {
  let face;
  if (boss.type === 'boss1' && boss.g2) {
    const phase = boss.g2?.phase >= 2 ? 'p2_idle' : 'p1_idle';
    const f = G2A.clips[phase]?.frames[0];
    face = hudFaceCrop(phase,f && G2_IMG[f.p],f,(w,h) => [w*.36,0,Math.min(w*.4,h)]);
  } else if (boss.p2shown) {
    switch (boss.type) {
      case 'boss2': {
        const f = MORGRA_ART.clips.p2_idle[0];
        face = hudFaceCrop('morgra2',MORGRA_ATLAS,f,(w,h) => {const s=Math.min(w*.7,h*.55);return [(w-s)/2,0,s];});
        break;
      }
      case 'boss3': {
        const f = AURELION_ART.clips.awaken.at(-1);
        face = hudFaceCrop('aurelion2',AURELION_SHEETS[f.sheet],f,(w,h) => {const s=Math.min(w*.65,h*.35);return [(w-s)/2,h*.03,s];});
        break;
      }
      case 'boss4': {
        const f = VARGUL_ART.clips.p2_idle[0];
        face = hudFaceCrop('vargul2',VARGUL_SHEETS[f.sheet],f,(w,h) => [w*.2,h*.13,Math.min(w*.65,h*.38)]);
        break;
      }
      case 'boss5': {
        const f = SOV_A.clips.idle_p2[0];
        face = hudFaceCrop('sovereign2',SOV_SHEETS[f.sheet],f,(w,h) => [f.anchor[0]-h*.126,h*.03,h*.3]);
        break;
      }
    }
  }
  return face || portrait(boss.d.sprite);
}
// Boss bar (bottom of the HUD design): portrait, gold name on the plate, green over red.
function drawPixelBossBar(boss, hud) {
  if (drawCompactBoss(boss, hud)) return true;
  if (!hudUI.ready) return false;
  const L = HUD_LAYOUT, [bx, by, bw, bh] = L.boss;
  ctx.save(); ctx.scale(W / 1672, W / 1672);
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(HUD_UI, 0, 790, 1672, 130, 0, 790, 1672, 130);
  // The design shows Aurelion; every other boss gets its own face in the frame.
  if (boss.d.sprite !== 'boss3') {
    const [x, y, w, h] = L.bossPortrait, img = hudBossFace(boss);
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#5a1a1e'); g.addColorStop(1, '#140608');
    ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
    const s = Math.max(w / img.width, h / img.height);
    ctx.imageSmoothingEnabled = !!img.hd;
    ctx.drawImage(img, x + (w - img.width * s) / 2, y + h - img.height * s, img.width * s, img.height * s);
    ctx.restore();
  }
  ctx.save(); ctx.beginPath(); ctx.rect(bx, by, bw, bh); ctx.clip();
  ctx.fillStyle = ctx.createPattern(hudUI.bossLow, 'repeat-x'); ctx.translate(bx, by + 1); ctx.fillRect(0, 0, bw, bh - 2); ctx.translate(-bx, -by - 1);
  const value = clamp(hud.value / boss.max, 0, 1), lag = clamp(hud.lag / boss.max, 0, 1);
  if (lag > value) { ctx.fillStyle = '#ffc96b'; ctx.fillRect(bx, by + 1, bw * lag, bh - 2); }
  const [sx, sy, sw, sh] = L.bossStrip;
  if (value > 0) ctx.drawImage(HUD_UI, sx, sy, sw * value, sh, bx + 1, by + 1, bw * value, bh - 2);
  if (value > 0 && boss.barTint) { ctx.fillStyle = boss.barTint; ctx.fillRect(bx, by, bw * value, bh); }   // 2페이즈: 체력바를 붉게
  ctx.restore();
  // Groggy gauge: a thin gold line riding just above the bar frame.
  const groggy = boss.st === 'stun' ? 1 - boss.t / GROGGY_TICKS : boss.gr / boss.grMax;
  if (groggy > 0) { ctx.fillStyle = '#000'; ctx.fillRect(bx + 4, 834, (bw - 8) * clamp(groggy, 0, 1) + 2, 7); ctx.fillStyle = '#f0c870'; ctx.fillRect(bx + 5, 835, (bw - 8) * clamp(groggy, 0, 1), 5); }
  hudText(boss.d.name || '', 300, 872, 44, 'gold', 'center', 300);
  if (boss.barLabel) hudText(boss.barLabel, bx + bw, 830, 26, '#ff8a80', 'right');
  ctx.restore();
  return true;
}
