'use strict';
const SCORE_ITEMS = Object.freeze({ coin: 500, coinBag: 1000, gold: 2000 });
const ITEM_SPRITES = {};
// Source PNGs are preserved. Key only neutral bright background pixels reachable
// from the outer edge, so enclosed white highlights remain part of the sprite.
function prepareItemSprite(image) {
  const c = document.createElement('canvas');
  c.width = image.naturalWidth; c.height = image.naturalHeight;
  const g = c.getContext('2d'), w = c.width, h = c.height;
  g.drawImage(image, 0, 0);
  const pixels = g.getImageData(0, 0, w, h), d = pixels.data;
  const seen = new Uint8Array(w * h), queue = new Int32Array(w * h);
  let head = 0, tail = 0;
  const visit = n => {
    if (seen[n]) return;
    seen[n] = 1;
    const i = n * 4, lo = Math.min(d[i], d[i+1], d[i+2]), hi = Math.max(d[i], d[i+1], d[i+2]);
    if (d[i+3] === 0 || (lo >= 175 && hi - lo <= 22)) queue[tail++] = n;
  };
  for (let x = 0; x < w; x++) { visit(x); visit((h-1)*w+x); }
  for (let y = 0; y < h; y++) { visit(y*w); visit(y*w+w-1); }
  while (head < tail) {
    const n = queue[head++], x = n % w, y = Math.floor(n/w);
    d[n*4+3] = 0;
    if (x) visit(n-1); if (x+1<w) visit(n+1);
    if (y) visit(n-w); if (y+1<h) visit(n+w);
  }
  let left=w, top=h, right=0, bottom=0;
  for (let y=0; y<h; y++) for (let x=0; x<w; x++) if (d[(y*w+x)*4+3]) {
    left=Math.min(left,x); right=Math.max(right,x); top=Math.min(top,y); bottom=Math.max(bottom,y);
  }
  g.putImageData(pixels, 0, 0);
  // Cache directional lighting once; source-atop keeps the cutout transparent.
  g.globalCompositeOperation = 'source-atop';
  const light = g.createLinearGradient(left, top, right, bottom);
  light.addColorStop(0, 'rgba(255,237,195,.22)');
  light.addColorStop(.45, 'rgba(255,237,195,0)');
  light.addColorStop(1, 'rgba(12,8,28,.38)');
  g.fillStyle = light; g.fillRect(left, top, right-left+1, bottom-top+1);
  g.globalCompositeOperation = 'source-over';
  return { image: c, x: left, y: top, w: right-left+1, h: bottom-top+1 };
}
const ITEM_READY = Promise.all(Object.entries(ITEM_ART).map(([key, src]) => new Promise(resolve => {
  const image = new Image();
  image.onload = () => {
    ITEM_SPRITES[key] = globalThis.ITEM_ART_PREPARED
      ? {image, x:0, y:0, w:image.naturalWidth, h:image.naturalHeight}
      : prepareItemSprite(image);
    resolve();
  };
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
