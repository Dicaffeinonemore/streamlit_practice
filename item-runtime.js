'use strict';
const SCORE_ITEMS = Object.freeze({ coin: 500, coinBag: 1000, gold: 2000 });
const ITEM_SPRITES = {};
// item-art.js holds pre-keyed, trimmed and lit sprites (tools/build_item_art.py).
// No canvas pixel reads at load time; the bundle is ~0.5MB instead of ~13.8MB.
const ITEM_READY = Promise.all(Object.entries(ITEM_ART).map(([key, src]) => new Promise(resolve => {
  const image = new Image();
  image.onload = () => { ITEM_SPRITES[key] = { image, x: 0, y: 0, w: image.naturalWidth, h: image.naturalHeight }; resolve(); };
  image.onerror = () => resolve();
  image.src = src;
})));
function drawItemSprite(key, x, bottom, maxWidth, maxHeight, flash = false) {
  const s = ITEM_SPRITES[key];
  if (!s || s.w <= 0 || s.h <= 0) return false;
  const scale = Math.min(maxWidth/s.w, maxHeight/s.h), w = s.w*scale, h = s.h*scale;
  ctx.save(); ctx.imageSmoothingEnabled = false;
  if (flash) ctx.filter = 'brightness(2)';
  ctx.drawImage(s.image, s.x, s.y, s.w, s.h, Math.round(x-w/2), Math.round(bottom-h), Math.round(w), Math.round(h));
  ctx.restore();
  return true;
}
