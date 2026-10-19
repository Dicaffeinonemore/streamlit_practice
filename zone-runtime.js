'use strict';
// 화염 · 서리 · 심연 지대: 24프레임 스프라이트 (1-4 경고 마법진, 5-14 폭발, 15-24 잔불).
// 월드 변환(scale Z, translate -OY) 아래에서 호출된다. 판정 줄(z.y)에 프레임의 바닥 띠를 맞추고 지대 폭만큼 타일로 잇는다.
const ZONE_SCALE = 0.6, ZONE_FADE = 260, ZONE_SIGIL_MS = 110;
function zoneEruptionVisible(z) {
  return z.type === 'rift' && !!ZONE_ART[z.kind] && z.age <= z.delay + z.life + ZONE_FADE;
}
// 프레임 번호(0~23): 경고 중에는 0-3 반복, 판정 중 4-13, 판정이 끝나고 사라지는 동안 14-23
function zoneFrame(z) {
  const t = z.age - z.delay;
  if (t < 0) return Math.floor(z.age / ZONE_SIGIL_MS) % 4;
  if (t <= z.life) return 4 + Math.min(9, Math.floor(t / z.life * 10));
  return 14 + Math.min(9, Math.floor((t - z.life) / ZONE_FADE * 10));
}
function drawZoneTile(im, art, f, x, top, w, h, flip) {
  if (!flip) { ctx.drawImage(im, f * art.fw, 0, art.fw, art.h, x, top, w, h); return; }
  ctx.save(); ctx.translate(x + w / 2, 0); ctx.scale(-1, 1);
  ctx.drawImage(im, f * art.fw, 0, art.fw, art.h, -w / 2, top, w, h);
  ctx.restore();
}
function drawZoneEruption(z) {
  const im = ZONE_IMAGES[z.kind], art = ZONE_ART[z.kind];
  if (!im?.complete || !im.naturalWidth || !art) return false;
  const t = z.age - z.delay, base = zoneFrame(z);
  const w = art.fw * ZONE_SCALE, h = art.h * ZONE_SCALE, step = (art.fw - art.feather) * ZONE_SCALE;
  const n = Math.max(1, Math.round(z.width / step)), span = (n - 1) * step + w, x0 = z.x - camX + (z.width - span) / 2;
  const rows = z.depth > 40 ? Math.ceil(z.depth * 2 / 34) : 1;        // 깊이 방향으로 긴 균열은 여러 줄로 쌓는다
  const alpha = t < 0 ? .55 + .45 * riftWarningAlpha(z) : t <= z.life ? 1 : 1 - Math.max(0, (t - z.life) / ZONE_FADE - .6) / .4;
  const [lo, hi] = t < 0 ? [0, 3] : t <= z.life ? [4, 13] : [14, 23];
  ctx.save();
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  for (let r = 0; r < rows; r++) {
    const gy = rows === 1 ? z.y : z.y - z.depth + (r + .5) * (z.depth * 2 / rows), top = gy - art.ground * ZONE_SCALE;
    for (let i = 0; i < n; i++) {
      // 타일마다 좌우 반전과 ±1프레임 어긋남을 줘서 같은 그림이 줄지어 반복되지 않게 한다
      const seed = hash(i * 7.3 + r * 13.1 + z.y * .37 + Math.floor(z.x) * .013), x = x0 + i * step;
      const f = clamp(base + (t < 0 ? 0 : Math.floor(seed * 3) - 1), lo, hi), flip = seed > .5;
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = alpha;
      drawZoneTile(im, art, f, x, top, w, h, flip);
      if (t >= 0 && t < 160) {                                     // 터지는 순간의 섬광
        ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = alpha * .45 * (1 - t / 160);
        drawZoneTile(im, art, f, x, top, w, h, flip);
      }
    }
  }
  ctx.restore();
  return true;
}
