'use strict';
// Coordinates refer to the supplied 1672 × 941 transparent UI atlas.
const PIXEL_UI = new Image();
const BOSS_UI = new Image();
const ENEMY_UI = new Image();
ENEMY_UI.src = ENEMY_UI_SOURCE;
BOSS_UI.src = BOSS_UI_SOURCE;
const pixelUI = { ready: false, hud: null, emptyScrolls: [], emptyLives: [] };
function uiCrop(x, y, w, h) {
  const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
  canvas.getContext('2d').drawImage(PIXEL_UI, x, y, w, h, 0, 0, w, h);
  return canvas;
}
PIXEL_UI.onload = () => {
  pixelUI.hud = uiCrop(0, 140, 1104, 420);
  const dimCrop = (x, y, w, h) => {
    const tile = uiCrop(x, y, w, h), c = tile.getContext('2d');
    c.globalCompositeOperation = 'source-atop'; c.fillStyle = 'rgba(10,7,9,.85)'; c.fillRect(0, 0, w, h);
    return tile;
  };
  pixelUI.emptyScrolls = [0, 1, 2].map(i => dimCrop(773 + i * 82, 303, 83, 90));
  pixelUI.emptyLives = [0, 1, 2].map(i => dimCrop(284 + i * 88, 423, 88, 132));
  document.querySelectorAll('#skillbar .skillbtn').forEach((button, i) => {
    const tile = uiCrop(505 + 131 * i, 644, 140, 243), c = tile.getContext('2d');
    // Physical key labels remain DOM text so remapping continues to work.
    c.fillStyle = '#03101c'; c.fillRect(20, 63, 35, 35);
    button.style.backgroundImage = `url("${tile.toDataURL()}")`;
  });
  const pause = uiCrop(1510, 388, 150, 135);
  document.getElementById('playPause').style.setProperty('background-image', `url("${pause.toDataURL()}")`, 'important');
  pixelUI.ready = true;
};
PIXEL_UI.src = PIXEL_UI_SOURCE;

function drawPixelHUD(p) {
  if(isViesa(p)&&drawViesaUI(p))return true;
  if (!pixelUI.ready) return false;
  const k = W / 1672 * .62;
  // Keep the current width and scale both axes equally to preserve the atlas ratio.
  const scale = 1064 * k / 1104;
  ctx.save(); ctx.translate(3, 20); ctx.scale(scale, scale); ctx.translate(0, -140); ctx.imageSmoothingEnabled = false;
  ctx.drawImage(pixelUI.hud, 0, 140);
  if(isViesa(p)){
    drawViesaHUDPortrait(145,324,82,80);
    for(let i=0;i<p.lives;i++)drawViesaHUDPortrait(330+i*88,477,24,27);
  }
  for (const [y, ratio, color] of [[290, p.hp / p.max, '#290508'], [350, p.sp / SP_MAX, '#031329']]) {
    const width = 468, amount = width * clamp(ratio, 0, 1);
    ctx.save(); ctx.beginPath(); ctx.roundRect(274, y, width, 34, 17); ctx.clip();
    ctx.fillStyle = color; ctx.fillRect(274, y, width, 34);
    if (amount > 0) ctx.drawImage(PIXEL_UI, 305, y, 300, 34, 274, y, amount, 34);
    ctx.restore();
  }
  // Empty scroll slots are silhouettes, never mistaken for usable charges.
  for (let i = 0; i < MAGIC.max; i++) if (i >= p.mg) {
    ctx.drawImage(pixelUI.emptyScrolls[i], 773 + i * 82, 303);
  }
  for (let i = 0; i < 3; i++) if (i >= p.lives) ctx.drawImage(pixelUI.emptyLives[i], 284 + i * 88, 423);
  if (p.buff > 0) {
    ctx.fillStyle = '#36240c'; ctx.fillRect(70, 434, 130, 6);
    ctx.fillStyle = '#ffdd63'; ctx.fillRect(70, 434, 130 * p.buff / 900, 6);
  }
  ctx.restore();
  pxText(`score ${p.score}`, 6, 14, '#ffe1a0', 11);
  return true;
}

const BOSS_UI_LAYOUT = { x: 140, y: 350, width: 680, scale: 600 / 2172 };
// Trim only the transparent padding, then scale both axes equally.
const ENEMY_UI_LAYOUT = { right: 8, top: 56, width: 290, crop: [185, 28, 1815, 660] };
const enemyPortraitCache = new Map();
function enemyHUDPortrait(e) {
  const role = namedEnemyRole(e);
  if (enemyPortraitCache.has(role)) return enemyPortraitCache.get(role);
  const frame = role && namedClip(role, 'idle');
  if (!frame || !NAMED_ATLAS.complete || !NAMED_ATLAS.naturalWidth) return null;
  const [sx, sy, w, h] = frame.atlas;
  const size = Math.min(w, h * .65);
  const left = clamp(frame.anchor[0] - size / 2, 0, w - size);
  const top = e.type === 'rogue' ? h * .16 : 0;
  const portrait = document.createElement('canvas'); portrait.width = portrait.height = 128;
  const c = portrait.getContext('2d'); c.imageSmoothingEnabled = false;
  c.drawImage(NAMED_ATLAS, sx + left, sy + top, size, size, 0, 0, 128, 128);
  enemyPortraitCache.set(role, portrait);
  return portrait;
}
function drawPixelEnemyBar(e) {
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

function drawPixelBossBar(boss, hud) {
  if (!BOSS_UI.complete || !BOSS_UI.naturalWidth) return false;
  ctx.save();
  // Extend only the central section; the end ornaments retain their proportions.
  const { x, y, width, scale } = BOSS_UI_LAYOUT;
  const extra = width / scale - 2172, barWidth = 1588 + extra;
  ctx.translate(x, y); ctx.scale(scale, scale);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(BOSS_UI, 0, 0, 500, 724, 0, 0, 500, 724);
  ctx.drawImage(BOSS_UI, 500, 0, 1300, 724, 500, 0, 1300 + extra, 724);
  ctx.drawImage(BOSS_UI, 1800, 0, 372, 724, 1800 + extra, 0, 372, 724);
  ctx.beginPath(); ctx.roundRect(342, 342, barWidth, 58, 29); ctx.clip();
  ctx.fillStyle = '#1b0c12'; ctx.fillRect(342, 342, barWidth, 58);
  ctx.fillStyle = '#a75236'; ctx.fillRect(342, 342, barWidth * clamp(hud.lag / boss.max, 0, 1), 58);
  const fill = barWidth * clamp(hud.value / boss.max, 0, 1);
  if (fill > 0) ctx.drawImage(BOSS_UI, 400, 342, 1000, 58, 342, 342, fill, 58);
  ctx.restore();
  krText(boss.d.name, x + (1136 + extra / 2) * scale, y + 320 * scale, '#ffe5dd', 13, 'center');
  pxText(boss.p2shown ? 'II' : 'I', x + 370 * scale, y + 320 * scale, '#e1b99b', 9);
  const groggy = boss.st === 'stun' ? 1 - boss.t / GROGGY_TICKS : boss.gr / boss.grMax;
  ctx.fillStyle = '#cfab70'; rect(x + 380 * scale, y + 416 * scale, (1500 + extra) * scale * clamp(groggy, 0, 1), 2);
  return true;
}
