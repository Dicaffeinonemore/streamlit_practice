'use strict';
// Called under the existing world transform; the combat lane remains GTOP..GBOT.
function drawStageFloor() {
  const index = stage ? stageIdx : 0;
  const im = FLOOR_IMAGES[index], art = FLOOR_ART[index];
  if (!art || !im?.complete || !im.naturalWidth) return false;
  const [sx, sy, sw, sh] = art.crop;
  const height = Math.ceil(OY + VH - FL_TOP) + 1;
  const width = sw / sh * height;
  const first = Math.floor(camX / width);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  for (let k = first; k * width - camX < VW; k++) {
    // Shared rounded edges prevent subpixel cracks at any camera position.
    const left = Math.round(k * width - camX);
    const right = Math.round((k + 1) * width - camX);
    ctx.save();
    ctx.translate(k % 2 ? right : left, FL_TOP);
    if (k % 2) ctx.scale(-1, 1);
    ctx.drawImage(im, sx, sy, sw, sh, 0, 0, right - left, height);
    ctx.restore();
  }
  const shade = ctx.createLinearGradient(0, FL_TOP, 0, FL_TOP + 14);
  shade.addColorStop(0, 'rgba(8,5,14,.4)');
  shade.addColorStop(1, 'rgba(8,5,14,0)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, FL_TOP, VW, 14);
  ctx.restore();
  return true;
}
