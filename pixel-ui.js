'use strict';
// Coordinates refer to the supplied 1672 × 941 transparent UI atlas.
const PIXEL_UI = new Image();
const BOSS_UI = new Image();
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
  if (!pixelUI.ready) return false;
  const k = W / 1672 * .62;
  // Keep the current width and scale both axes equally to preserve the atlas ratio.
  const scale = 1064 * k / 1104;
  ctx.save(); ctx.translate(3, 20); ctx.scale(scale, scale); ctx.translate(0, -140); ctx.imageSmoothingEnabled = false;
  ctx.drawImage(pixelUI.hud, 0, 140);
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
