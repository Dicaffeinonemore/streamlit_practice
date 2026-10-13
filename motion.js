'use strict';
// =====================================================================
//  모션 / 이펙트 엔진 (흑기사 보스전 모션 패치)
//  - 도트를 픽셀 버퍼(Layer)에 직접 찍는다. 좌표 1칸 = 원본 도트 1px (게임에서 2배 확대)
//  - 흑기사와 보스는 "무기 없는 몸통 스프라이트 + 움직이는 팔 + 따로 그리는 무기"로 합성하고,
//    시간(ms)을 넣으면 무기 각도·손 위치·몸 기울기를 돌려주는 포즈 함수로 공격 모션을 만든다.
//  - 이펙트 함수는 모두 Layer 에 직접 그리는 순수 함수. 바닥 기준선(gy)은 인자로 받는다(2.5D 깊이 대응).
// =====================================================================
(function (global) {
  // ---------------------------------------------------------------- 픽셀 버퍼
  const HC = {};
  function rgb(c) { let v = HC[c]; if (!v) { const n = parseInt(c.slice(1), 16); v = HC[c] = [(n >> 16) & 255, (n >> 8) & 255, n & 255]; } return v; }

  class Layer {
    constructor(w, h) { this.w = w; this.h = h; this.d = new Uint8ClampedArray(w * h * 4); }
    clear() { this.d.fill(0); }
    put(x, y, c, a) {
      x = Math.round(x); y = Math.round(y);
      if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
      const i = (y * this.w + x) * 4, v = rgb(c), d = this.d;
      if (a === undefined || a >= 1) { d[i] = v[0]; d[i + 1] = v[1]; d[i + 2] = v[2]; d[i + 3] = 255; }
      else if (a > 0) {
        if (!d[i + 3]) { d[i] = v[0]; d[i + 1] = v[1]; d[i + 2] = v[2]; d[i + 3] = 255 * a; }
        else { d[i] += (v[0] - d[i]) * a; d[i + 1] += (v[1] - d[i + 1]) * a; d[i + 2] += (v[2] - d[i + 2]) * a; }
      }
    }
    rect(x, y, w, h, c, a) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.put(x + i, y + j, c, a); }
    line(x0, y0, x1, y1, c, th, a) {
      x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
      const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, wide = dx >= -dy;
      let e = dx + dy;
      for (;;) {
        this.put(x0, y0, c, a);
        if (th > 1) { if (wide) this.put(x0, y0 + 1, c, a); else this.put(x0 + 1, y0, c, a); }
        if (x0 === x1 && y0 === y1) break;
        const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; }
      }
    }
    disc(cx, cy, r, c, a) { for (let j = -r; j <= r; j++) { const hw = Math.floor(Math.sqrt(r * r - j * j) + 0.5); for (let i = -hw; i <= hw; i++) this.put(cx + i, cy + j, c, a); } }
    arc(cx, cy, r, a0, a1, c, th, a) {     // 각도는 라디안, 0 = 오른쪽, 위쪽이 +
      const n = Math.max(8, Math.ceil(Math.abs(a1 - a0) * r / 1.2));
      for (let k = 0; k <= n; k++) {
        const t = a0 + (a1 - a0) * k / n, x = cx + Math.cos(t) * r, y = cy - Math.sin(t) * r;
        this.put(x, y, c, a); if (th > 1) this.put(x, y + 1, c, a); if (th > 2) this.put(x + 1, y, c, a);
      }
    }
    on(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h && this.d[(y * this.w + x) * 4 + 3] > 0; }
    outline(c) {
      const l = [];
      for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
        if (!this.on(x, y) && (this.on(x - 1, y) || this.on(x + 1, y) || this.on(x, y - 1) || this.on(x, y + 1))) l.push(x, y);
      }
      for (let i = 0; i < l.length; i += 2) this.put(l[i], l[i + 1], c);
    }
    dim(k) { const d = this.d; for (let i = 0; i < d.length; i += 4) { d[i] *= k; d[i + 1] *= k; d[i + 2] *= k; } }
  }

  // src 를 dst 에 그린다. o = { flip, lean(머리 쪽 기울기 px), crouch(무릎 굽힘 px), split(굽힘 경계 줄), flash, wash, washA }
  function blit(src, dst, x, y, o) {
    o = o || {}; x = Math.round(x); y = Math.round(y);
    const sp = o.split || 0, cr = o.crouch ? Math.round(o.crouch) : 0, wv = o.wash ? rgb(o.wash) : null, k = o.washA || 0;
    for (let j = 0; j < src.h; j++) {
      const dy = y + j + ((cr && j < sp) ? cr : 0); if (dy < 0 || dy >= dst.h) continue;
      const sh = o.lean ? Math.round(o.lean * Math.pow(Math.max(0, 1 - j / (src.h - 1)), 1.2)) : 0;
      for (let i = 0; i < src.w; i++) {
        const si = (j * src.w + (o.flip ? src.w - 1 - i : i)) * 4; if (!src.d[si + 3]) continue;
        const dx = x + i + sh; if (dx < 0 || dx >= dst.w) continue;
        const di = (dy * dst.w + dx) * 4;
        let r = src.d[si], g = src.d[si + 1], b = src.d[si + 2];
        if (o.flash) { r = g = b = 255; }
        else if (wv) { r += (wv[0] - r) * k; g += (wv[1] - g) * k; b += (wv[2] - b) * k; }
        dst.d[di] = r; dst.d[di + 1] = g; dst.d[di + 2] = b; dst.d[di + 3] = 255;
      }
    }
  }

  // sprites.js 의 도트 정의를 픽셀 버퍼로 굽고 1px 외곽선을 입힌다 (프레임별 캐시)
  const CACHE = {};
  function sprite(id, f) {
    const k = id + ':' + (f | 0); if (CACHE[k]) return CACHE[k];
    const s = global.SPRITES[id], L = new Layer(s.w, s.h);
    s.fn((x, y, w, h, c) => L.rect(x, y, w, h, c), f | 0, (cx, cy, r, c) => L.disc(cx, cy, r, c));
    L.outline('#0d0b14');
    return (CACHE[k] = L);
  }
  function rng(seed) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }

  const RAD = Math.PI / 180;
  const clamp = (v, a, b) => v < a ? a : (v > b ? b : v);
  const ease = u => u < 0 ? 0 : (u > 1 ? 1 : u * u * (3 - 2 * u));
  const lerp = (a, b, u) => a + (b - a) * u;

  // ---------------------------------------------------------------- 이펙트
  // 호 궤적: 여러 겹의 호를 겹쳐 초승달처럼 보이게 함 (각도는 도)
  function crescent(L, cx, cy, r, a0, a1, cols, th) {
    th = th || cols.length;
    for (let k = 0; k < th; k++) L.arc(cx, cy, r - k, a0 * RAD, a1 * RAD, cols[Math.min(cols.length - 1, k)], 1);
  }
  function sparkBurst(L, x, y, age, seed, cols) {
    if (age < 0 || age > 380) return; cols = cols || ['#ffffff', '#ffe27a', '#f58c3b'];
    const R = rng(seed || 5), t = age / 1000;
    if (age < 80) {
      L.put(x, y, '#ffffff');
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(d => L.put(x + d[0], y + d[1], '#ffffff'));
      [[2, 0], [-2, 0], [0, 2], [0, -2]].forEach(d => L.put(x + d[0], y + d[1], cols[1]));
    }
    for (let i = 0; i < 9; i++) {
      const a = R() * Math.PI * 2, v = 40 + R() * 70;
      L.put(x + Math.cos(a) * v * t, y - Math.sin(a) * v * t + 110 * t * t, age < 110 ? cols[0] : (age < 230 ? cols[1] : cols[2]));
    }
  }
  // 발밑에서 피어오르는 기운 (필살기 기 모으기)
  function aura(L, x, y, t, col1, col2) {
    const R = rng(9);
    for (let i = 0; i < 16; i++) {
      const ph = (t * 0.0016 + R()) % 1, ox = (R() - 0.5) * 26, sp = 14 + R() * 18;
      L.put(x + ox + Math.sin(ph * 9 + i) * 2, y - ph * sp * 2.2, ph < 0.6 ? col1 : col2);
    }
  }
  // 바닥 경고 표식: 깜빡이는 타원 (gy = 그 자리의 바닥선)
  function warn(L, x, w, t, gy) {
    const on = Math.floor(t / 90) % 2 === 0, rx = w / 2, ry = Math.max(3, w * 0.16);
    for (let k = 0; k < 48; k++) {
      const a = k / 48 * Math.PI * 2;
      L.put(x + Math.cos(a) * rx, gy + Math.sin(a) * ry, (k & 1) === (on ? 0 : 1) ? '#ff3a4a' : '#a01a30');
    }
    for (let j = -ry + 1; j < ry; j++) {
      const hw = rx * Math.sqrt(1 - (j * j) / (ry * ry));
      L.rect(x - hw + 1, gy + j, Math.max(0, hw * 2 - 2), 1, '#ff3a4a', on ? 0.32 : 0.14);
    }
  }
  // 도살자 고라스: 내려찍기 충격파 (fx = 파도 앞머리 x)
  function shockwave(L, fx, t, dir, gy) {
    const h = Math.max(1, Math.round(9 * (1 - t / 1100)));
    for (let k = 0; k < 16; k++) {
      const px = fx - dir * k, hh = Math.max(1, Math.round(h * (1 - k / 16)));
      for (let j = 0; j < hh; j++) L.put(px, gy - 1 - j, j > hh - 2 ? '#fff0c0' : (j > hh / 2 ? '#f6b25a' : '#a8864a'));
    }
    const R = rng(31 + (dir > 0 ? 1 : 0));
    for (let i = 0; i < 6; i++) {
      const d = R() * 14, hop = Math.abs(Math.sin((t * 0.01) + i)) * (8 * (1 - t / 1100));
      L.put(fx - dir * d, gy - 3 - hop, '#6a4a28'); L.put(fx - dir * d, gy - 4 - hop, '#a8864a');
    }
  }
  // 까마귀 마녀 모르그라: 초록 불꽃 구슬, 순간이동 고리
  function orb(L, x, y, vx, vy, t) {
    const m = Math.hypot(vx, vy) || 1, ux = vx / m, uy = vy / m;
    for (let k = 1; k <= 6; k++) L.put(x - ux * k * 2, y - uy * k * 2 + Math.sin(t * 0.02 + k) * 0.8, k < 3 ? '#7dff7a' : '#2a6a3a');
    L.disc(Math.round(x), Math.round(y), 3, '#2a6a3a'); L.disc(Math.round(x), Math.round(y), 2, '#7dff7a'); L.put(x, y, '#eaffea');
  }
  function teleportRing(L, x, y, p) {
    const r = Math.round(4 + 22 * p);
    L.arc(x, y, r, 0, Math.PI * 2, '#7dff7a', 1, 1 - p * 0.6);
    L.arc(x, y, Math.max(2, r - 4), 0, Math.PI * 2, '#eaffea', 1, 0.8 * (1 - p));
    const R = rng(3);
    for (let i = 0; i < 10; i++) { const a = R() * 6.28; L.put(x + Math.cos(a) * r * 1.2, y - Math.sin(a) * r * 1.2 - p * 8, '#7dff7a'); }
  }
  // 황금왕 오렐리온: 초승달 검기, 화염 기둥
  function goldWave(L, x, y, dir) {
    for (let k = 0; k < 3; k++) {
      L.arc(x - dir * k * 5, y, 16, (dir > 0 ? -62 : 118) * RAD, (dir > 0 ? 62 : 242) * RAD,
        k === 0 ? '#fff3b8' : (k === 1 ? '#f3d26a' : '#d4a437'), 3, 1 - k * 0.3);
    }
    L.put(x + dir * 16, y, '#ffffff');
    const R = rng(41);
    for (let i = 0; i < 5; i++) L.put(x - dir * (8 + R() * 14), y + (R() - 0.5) * 22, '#ffd23a');
  }
  function pillar(L, x, t, p, gy) {      // p: 0..1 (솟아오름 → 꺼짐)
    const hgt = Math.round(66 * Math.sin(clamp(p, 0, 1) * Math.PI * 0.9 + 0.2)), w = 7 + Math.round(3 * Math.sin(t * 0.03));
    for (let j = 0; j < hgt; j++) {
      const taper = 1 - j / hgt * 0.55, hw = Math.max(2, Math.round(w * taper + Math.sin(j * 0.5 + t * 0.04) * 1.5));
      L.rect(x - hw, gy - 1 - j, hw * 2, 1, '#ff5a1a');
      const iw = Math.max(1, Math.round(hw * 0.62)); L.rect(x - iw, gy - 1 - j, iw * 2, 1, '#ffb02a');
      const cw = Math.max(0, Math.round(hw * 0.28)); if (cw) L.rect(x - cw, gy - 1 - j, cw * 2, 1, '#fff0c0');
    }
    L.rect(x - w - 3, gy - 1, (w + 3) * 2, 2, '#ffb02a');
    const R = rng(17);
    for (let i = 0; i < 8; i++) { const ph = (t * 0.002 + R()) % 1; L.put(x + (R() - 0.5) * 26, gy - ph * hgt, '#ffd23a'); }
  }
  // 필살기 흑월참: 붉은 초승달 (큰 원에서 어긋난 원을 뺀다)
  function moon(L, cx, cy, r, p, flip) {
    const ox = r * 0.42 * (flip ? -1 : 1), r2 = r * 0.88;
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
      if (x * x + y * y > r * r) continue;
      const dx = x - ox; if (dx * dx + y * y < r2 * r2) continue;
      const edge = (x * x + y * y) > (r - 3) * (r - 3);
      L.put(cx + x, cy + y, edge ? '#ffffff' : ((x + y) & 1 && p < 0.7 ? '#ff3a4a' : '#d6203a'), clamp(1.4 - p, 0.35, 1));
    }
  }
  function slashLine(L, x0, y0, x1, y1, k) {   // k: 0..1 선이 그려지는 정도
    const ex = x0 + (x1 - x0) * k, ey = y0 + (y1 - y0) * k;
    L.line(x0, y0, ex, ey, '#ff3a4a', 2); L.line(x0, y0 + 1, ex, ey + 1, '#ffffff');
  }
  // 적중 이펙트 3단계: 0 가벼운 타격(불꽃) / 1 연결기(충격 고리) / 2 마무리(큰 폭발 + 고리 두 겹)
  const IMPACT_DUR = [220, 300, 420];
  function impactFx(L, x, y, age, kind, dir, seed) {
    if (age < 0 || age > IMPACT_DUR[kind]) return;
    x = Math.round(x); y = Math.round(y);
    if (age < 100) {
      const sr = [5, 7, 10][kind], r = Math.max(2, Math.round(sr * (age < 30 ? 0.6 + age / 75 : 1.2 - age / 110)));
      for (let a = 0; a < 8; a++) {
        const an = a * Math.PI / 4, len = (a % 2 ? r * 0.6 : r);
        L.line(x, y, x + Math.cos(an) * len, y - Math.sin(an) * len, a % 2 ? '#ffe27a' : '#ffffff');
      }
      L.disc(x, y, Math.max(1, Math.round(r * 0.35)), '#ffffff');
    }
    if (age < 160) {
      const k = Math.min(1, age / 50), Ls = [10, 14, 20][kind] * dir;
      L.line(x - Ls * 0.5, y + Ls * 0.45, x - Ls * 0.5 + Ls * k, y + Ls * 0.45 - Ls * 0.9 * k, '#ffffff', 2);
    }
    if (kind >= 1) {
      const p = age / IMPACT_DUR[kind], r = Math.round(3 + [0, 9, 16][kind] * p);
      L.arc(x, y, r, 0, 6.283, '#ffffff', 1, 1 - p);
      if (kind === 2) L.arc(x, y, Math.max(2, r - 3), 0, 6.283, '#ffe27a', 1, (1 - p) * 0.8);
    }
    const R = rng(seed), n = [6, 9, 14][kind], t = age / 1000;
    for (let i = 0; i < n; i++) {
      const a = (dir > 0 ? -0.35 : 2.75) + (R() - 0.5) * 2.8, v = 45 + R() * 95;
      L.put(x + Math.cos(a) * v * t, y - Math.sin(a) * v * t + 130 * t * t, age < 100 ? '#ffffff' : (age < 200 ? '#ffe27a' : '#f58c3b'));
    }
  }

  // ---------------------------------------------------------------- 인물 합성: 몸통 + 팔 + 무기 + 궤적
  // sh = 어깨 위치(스프라이트 안), split = 이 줄 위로만 웅크림 적용, th = 팔 두께
  const FIG = {
    player: { w: 40, h: 48, sh: [29, 23], split: 34, arm: ['#4a4a62', '#2c2c3a'], th: 4, hand: '#c9a24a', wpn: 'sword' },
    boss1: { w: 68, h: 74, sh: [55, 29], split: 50, arm: ['#c98e6a', '#9a6446'], th: 7, hand: '#d8d0b8', wpn: 'cleaver' },
    boss2: { w: 60, h: 74, sh: [40, 30], split: 40, arm: ['#6e4294', '#4a2a6a'], th: 5, hand: '#c9b8d8', wpn: 'staff' },
    boss3: { w: 68, h: 76, sh: [53, 27], split: 52, arm: ['#d4a437', '#8a6a1c'], th: 6, hand: '#f3d26a', wpn: 'greatsword' },
  };
  const WPN = {
    sword: { grip: 5, len: 22, w: 3, guard: 7, gc: '#c9a24a', hc: '#6e1220', bl: ['#8b95a8', '#f2f5fa', '#d3dae6'] },
    cleaver: { grip: 7, len: 26, w: 12, guard: 0, hc: '#5a3a24', bl: ['#6a7080', '#b8c0cc', '#eef2f8'], blunt: true },
    greatsword: { grip: 9, len: 38, w: 6, guard: 17, gc: '#f3d26a', hc: '#3a2a1a', bl: ['#6a7488', '#c8d0dc', '#f2f5fa'] },
  };
  function thick(L, x0, y0, x1, y1, c, t) {
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)) * 2), o = t >> 1;
    for (let i = 0; i <= n; i++) { const u = i / n; L.rect(Math.round(x0 + (x1 - x0) * u - o), Math.round(y0 + (y1 - y0) * u - o), t, t, c); }
  }
  function drawArm(L, sx, sy, hx, hy, cols, th) {
    const dx = hx - sx, dy = hy - sy, len = Math.hypot(dx, dy) || 1;
    let nx = -dy / len, ny = dx / len; if (ny < 0) { nx = -nx; ny = -ny; }
    const bend = Math.min(5, len * 0.25), ex = (sx + hx) / 2 + nx * bend, ey = (sy + hy) / 2 + ny * bend;
    thick(L, sx, sy, ex, ey, cols[1], th); thick(L, ex, ey, hx, hy, cols[1], th);
    thick(L, sx, sy - 1, ex, ey - 1, cols[0], th - 2); thick(L, ex, ey - 1, hx, hy - 1, cols[0], th - 2);
  }
  // 무기를 손(hx,hy)에서 ang 도 방향으로 그린다. 끝 좌표를 돌려줌
  function drawWeapon(L, kind, hx, hy, ang, face, o) {
    o = o || {};
    const ux = Math.cos(ang * RAD) * face, uy = -Math.sin(ang * RAD), px = -uy, py = ux;
    const put = (u, v, c) => L.put(hx + ux * u + px * v, hy + uy * u + py * v, c);
    if (kind === 'staff') {
      for (let u = -12; u < 30; u += 0.5) for (let v = -1; v <= 0.5; v += 0.5) put(u, v, v < 0 ? '#7a5a40' : '#5a4030');
      for (let v = -3; v <= 3; v += 0.5) put(30, v, '#c9a24a');
      [[31, -3.5], [32, -4], [33, -3.5], [31, 3.5], [32, 4], [33, 3.5]].forEach(p => { put(p[0], p[1], '#c9a24a'); put(p[0] + 0.5, p[1], '#c9a24a'); });
      const ox = hx + ux * 33, oy = hy + uy * 33;
      L.disc(Math.round(ox), Math.round(oy), 5, '#2a6a3a'); L.disc(Math.round(ox), Math.round(oy), 3, '#7dff7a'); L.put(ox, oy, '#eaffea');
      return [ox, oy];
    }
    const w = WPN[kind];
    for (let u = -3; u < w.grip; u += 0.5) for (let v = -1; v <= 1; v += 0.5) put(u, v, o.red ? '#6e1220' : w.hc);
    if (w.guard) for (let v = -w.guard / 2; v <= w.guard / 2; v += 0.5) { put(w.grip, v, w.gc); put(w.grip + 1, v, w.gc); }
    const b0 = w.grip + (w.guard ? 2 : 0.5), b1 = b0 + w.len;
    for (let u = b0; u <= b1; u += 0.5) {
      let half = w.w / 2;
      if (!w.blunt) { const tp = (b1 - u) / (w.len * 0.22); if (tp < 1) half = Math.max(0.5, half * tp); }
      for (let v = -half; v <= half; v += 0.5) {
        let c = v < -half * 0.35 ? w.bl[0] : (v > half * 0.35 ? w.bl[2] : w.bl[1]);
        if (o.red) c = v < -half * 0.35 ? '#a01a30' : (v > half * 0.35 ? '#ff9aa6' : '#ff5a6a');
        if (kind === 'cleaver' && ((u - b0) % 9 < 1.2) && v < -half + 2.5) continue;   // 식칼 이빨 빠진 자국
        put(u, v, c);
      }
    }
    put(b1, 0, '#ffffff');
    return [hx + ux * b1, hy + uy * b1];
  }
  // 피규어 1체: 몸통(기울기·웅크림) → 궤적 → 팔 → 무기.
  // pose = { ang, hx, hy, lean, crouch, arc:[시작각, 현재각], arcR, arcCols, red }
  // o = { f(프레임), leanW(월드 방향 추가 기울기), crouch, flash, wash, washA, noWeapon }
  function drawFigure(L, id, cx, top, face, pose, o) {
    o = o || {}; const F = FIG[id], sp = sprite(id, o.f || 0);
    const lean = (pose.lean || 0) * face + (o.leanW || 0), cr = (pose.crouch || 0) + (o.crouch || 0);
    blit(sp, L, cx - F.w / 2, top, { flip: face < 0, lean, crouch: cr, split: F.split, flash: o.flash, wash: o.wash, washA: o.wash ? (o.washA || 0.5) : 0 });
    // 어깨 좌표 (몸 기울기·웅크림을 따라감)
    const lx = face > 0 ? F.sh[0] : F.w - 1 - F.sh[0];
    const sh = Math.round(lean * Math.pow(Math.max(0, 1 - F.sh[1] / (F.h - 1)), 1.2));
    const sx = cx - F.w / 2 + lx + sh, sy = top + F.sh[1] + (cr && F.sh[1] < F.split ? cr : 0);
    const hx = sx + (pose.hx || 0) * face, hy = sy + (pose.hy || 0);
    if (o.noWeapon) return { sh: [sx, sy], hand: [hx, hy], tip: [hx, hy] };
    if (pose.arc) {
      const cur = pose.arc[1], st = cur + (pose.arc[0] - cur) * Math.min(1, 100 / Math.max(1, Math.abs(pose.arc[0] - cur)));
      const w0 = face > 0 ? st : 180 - st, w1 = face > 0 ? cur : 180 - cur, cols = pose.arcCols || ['#ffffff', '#bfd4ff', '#7f98d8'];
      crescent(L, hx, hy, pose.arcR || 21, w0, w1, cols, cols.length);
    }
    drawArm(L, sx, sy, hx, hy, F.arm, F.th);
    const tip = drawWeapon(L, F.wpn, hx, hy, pose.ang, face, { red: pose.red });
    L.rect(Math.round(hx) - 1, Math.round(hy) - 1, 3, 3, F.hand);
    return { sh: [sx, sy], hand: [hx, hy], tip };
  }

  // ---------------------------------------------------------------- 포즈 (시간 ms → 자세)
  // ang = 무기 각도(0 정면, 90 위, 음수 아래), hx/hy = 어깨 기준 손 위치(앞이 +x, 아래가 +y),
  // lean = 머리 쪽 기울기(앞 +), crouch = 무릎 굽힘, dy/jy = 몸 위아래 이동
  function mixP(A, B, u) {
    const r = {};
    for (const k in A) if (typeof A[k] === 'number') r[k] = A[k];
    for (const k in B) {
      if (typeof B[k] === 'number') r[k] = (r[k] || 0) + (B[k] - (r[k] || 0)) * u;
      else if (u > 0.5 || r[k] === undefined) r[k] = B[k];
    }
    return r;
  }
  // 흑기사 3콤보 (예비 동작 wind → 휘두름 act → 회수 rec, ms)
  const HATK = [
    { name: '일섬', wind: 90, act: 110, rec: 150, rad: 21 },
    { name: '역일섬', wind: 70, act: 100, rec: 140, rad: 22 },
    { name: '참격', wind: 180, act: 140, rec: 330, rad: 25 },
  ];
  const HR = { ang: 68, hx: 4, hy: 9, lean: 0, crouch: 0, jy: 0 };
  const HK = [
    { w: { ang: 125, hx: -3, hy: -9, lean: -2, crouch: 0 }, s: { ang: -25, hx: 9, hy: 3, lean: 4, crouch: 1 } },
    { w: { ang: -40, hx: 5, hy: 10, lean: 1, crouch: 2 }, s: { ang: 135, hx: 8, hy: -8, lean: 4, crouch: 0 } },
    { w: { ang: 160, hx: -4, hy: -11, lean: -4, crouch: 1 }, s: { ang: -55, hx: 10, hy: 6, lean: 6, crouch: 2 } },
  ];
  function heroAtk(ci, t) {
    const a = HATK[ci], K = HK[ci];
    let r;
    if (t < a.wind) r = mixP(HR, K.w, ease(t / a.wind));
    else if (t < a.wind + a.act) { r = mixP(K.w, K.s, ease((t - a.wind) / a.act)); r.arc = [K.w.ang, r.ang]; }
    else {
      const t3 = t - a.wind - a.act; r = mixP(K.s, HR, ease(t3 / a.rec));
      if (t3 < 110) r.arc = [K.w.ang, K.s.ang];
    }
    r.arcR = a.rad;
    return r;
  }
  // 필살기 흑월참: 기 모으기(0~300) → 솟구침(~450) → 돌진(~620) → 4연 베기(160ms 간격) → 도약(1260~1560) → 내려찍기 → 회수(~2100)
  const SPK = [
    { w: { ang: 130, hx: -3, hy: -9, lean: -2, crouch: 0 }, s: { ang: -35, hx: 9, hy: 3, lean: 5, crouch: 1 } },
    { w: { ang: -40, hx: 6, hy: 10, lean: 1, crouch: 2 }, s: { ang: 140, hx: 8, hy: -9, lean: 4, crouch: 0 } },
    { w: { ang: 28, hx: -2, hy: 3, lean: -3, crouch: 1 }, s: { ang: 8, hx: 12, hy: 1, lean: 8, crouch: 1 } },
    { w: { ang: 170, hx: -6, hy: -3, lean: -3, crouch: 0 }, s: { ang: -20, hx: 10, hy: 3, lean: 5, crouch: 1 } },
  ];
  const SP_CH = { ang: 195, hx: -3, hy: 7, lean: -3, crouch: 3, jy: 0 }, SP_RS = { ang: 105, hx: -1, hy: -10, lean: -1, crouch: 1, jy: 0 };
  const SP_DS = { ang: 8, hx: 10, hy: 1, lean: 8, crouch: 1, jy: 0 };
  const SP_UP = { ang: 168, hx: -4, hy: -12, lean: -5, crouch: 0, jy: -17 }, SP_DN = { ang: -75, hx: 10, hy: 8, lean: 9, crouch: 3, jy: 0 };
  function heroSpecial(t) {
    let r;
    if (t < 300) r = mixP(HR, SP_CH, ease(t / 300));
    else if (t < 450) r = mixP(SP_CH, SP_RS, ease((t - 300) / 150));
    else if (t < 620) r = mixP(SP_RS, SP_DS, ease((t - 450) / 50));
    else if (t < 1260) {
      const k = Math.min(3, Math.floor((t - 620) / 160)), u = t - 620 - k * 160, K = SPK[k], prev = k ? SPK[k - 1].s : SP_DS;
      if (u < 40) r = mixP(prev, K.w, ease(u / 40));
      else if (u < 120) { r = mixP(K.w, K.s, ease((u - 40) / 80)); r.arc = [K.w.ang, r.ang]; }
      else r = mixP(K.s, K.s, 0);
    } else if (t < 1560) { const u = (t - 1260) / 300; r = mixP(SPK[3].s, SP_UP, ease(u)); r.jy = -17 * Math.sin(Math.min(1, u) * Math.PI * 0.5); }
    else if (t < 1650) { r = mixP(SP_UP, SP_DN, ease((t - 1560) / 90)); r.arc = [168, r.ang]; }
    else r = mixP(SP_DN, HR, ease((t - 1650) / 450));
    r.red = t < 1900; r.arcCols = ['#ffffff', '#ff7a88', '#d6203a', '#6e1220']; r.arcR = 26;
    return r;
  }

  // 보스 기본 자세 / 궤적 색 / 궤적 반지름
  const BR = { boss1: { ang: 118, hx: 3, hy: -6 }, boss2: { ang: 88, hx: 4, hy: 9 }, boss3: { ang: 84, hx: 6, hy: 5 } };
  const BCOL = { boss1: ['#ffffff', '#ffe27a', '#f58c3b', '#a8501a'], boss2: ['#eaffea', '#7dff7a', '#2a6a3a'], boss3: ['#fff3b8', '#ffd23a', '#d4a437'] };
  const BARC = { boss1: 30, boss2: 28, boss3: 42 };
  function bossPoseAt(id, pat, t, p2) {
    const R = BR[id]; let r = mixP(R, R, 0);
    const arc = (x, a0) => { x.arc = [a0, x.ang]; return x; };
    if (pat === 'slam') {
      const W = { ang: 155, hx: -4, hy: -15, lean: -4, dy: -7 }, St = { ang: -70, hx: 8, hy: 11, lean: 7, crouch: 2, dy: 0 };
      if (t < 650) r = mixP(R, W, ease(t / 500)); else if (t < 740) r = arc(mixP(W, St, ease((t - 650) / 90)), 155);
      else if (t < 1000) r = mixP(St, St, 0); else r = mixP(St, R, ease((t - 1000) / 150));
    } else if (pat === 'sweep') {
      const W = { ang: 168, hx: -7, hy: -4, lean: -5, crouch: 1 }, St = { ang: -45, hx: 10, hy: 7, lean: 6, crouch: 1 };
      if (t < 450) r = mixP(R, W, ease(t / 330)); else if (t < 680) r = arc(mixP(W, St, ease((t - 450) / 230)), 168);
      else if (t < 900) r = mixP(St, St, 0); else r = mixP(St, R, ease((t - 900) / 250));
    } else if (pat === 'rage') {
      const W = { ang: 150, hx: -4, hy: -10, lean: -2 }, A = { ang: 12, hx: 8, hy: 2, lean: 7 };
      if (t < 550) r = mixP(R, W, ease(t / 400)); else if (t < 1250) r = mixP(W, A, ease((t - 550) / 70)); else r = mixP(A, R, ease((t - 1250) / 400));
    } else if (pat === 'orbs') {
      const n = p2 ? 7 : 5, Rd = { ang: 72, hx: 5, hy: -5, lean: 1 }, Fr = { ang: 30, hx: 8, hy: -1, lean: 3 };
      if (t < 500) r = mixP(R, Rd, ease(t / 350));
      else if (t < 500 + n * 110) { const tt = t - 500, k = Math.floor(tt / 110); r = mixP(Rd, Fr, Math.max(0, 1 - (tt - k * 110) / 90)); }
      else r = mixP(Rd, R, ease((t - 500 - n * 110) / 300));
    } else if (pat === 'ravens') {
      const W = { ang: 125, hx: 2, hy: -8, lean: -2 }, St = { ang: 35, hx: 9, hy: -1, lean: 4 };
      if (t < 450) r = mixP(R, W, ease(t / 400)); else if (t < 560) r = arc(mixP(W, St, ease((t - 450) / 110)), 125);
      else if (t < 1100) r = mixP(St, St, 0); else r = mixP(St, R, ease((t - 1100) / 350));
    } else if (pat === 'slash3') {
      const g = p2 ? 340 : 420, n = p2 ? 4 : 3, k = Math.min(n - 1, Math.floor(t / g)), u = t - k * g;
      const E = k % 2 === 0 ? { w: { ang: 138, hx: -4, hy: -11, lean: -3, dy: -1 }, s: { ang: -35, hx: 10, hy: 6, lean: 5, dy: 0 } }
        : { w: { ang: -40, hx: 8, hy: 9, lean: 1, crouch: 1 }, s: { ang: 142, hx: 4, hy: -10, lean: 4, dy: 0 } };
      const prev = k === 0 ? R : (k % 2 === 0 ? { ang: 142, hx: 4, hy: -10, lean: 4 } : { ang: -35, hx: 10, hy: 6, lean: 5 });
      if (u < 260) r = mixP(prev, E.w, ease(u / 230));
      else if (u < 390) r = arc(mixP(E.w, E.s, ease((u - 260) / 130)), E.w.ang);
      else r = mixP(E.s, E.s, 0);
      if (k === n - 1 && u > 390 + 200) r = mixP(E.s, R, ease((u - 590) / 220));
    } else if (pat === 'pillars') {
      const W = { ang: 165, hx: -3, hy: -14, lean: -3, dy: -3 }, St = { ang: -80, hx: 9, hy: 11, lean: 6, crouch: 2, dy: 0 };
      if (t < 400) r = mixP(R, W, ease(t / 380)); else if (t < 920) r = mixP(W, W, 0);
      else if (t < 1010) r = arc(mixP(W, St, ease((t - 920) / 90)), 165); else if (t < 1600) r = mixP(St, St, 0); else r = mixP(St, R, ease((t - 1600) / 250));
    } else if (pat === 'charge') {
      const W = { ang: 140, hx: -5, hy: -9, lean: -4 }, A = { ang: 6, hx: 12, hy: 1, lean: 8 };
      if (t < 450) r = mixP(R, W, ease(t / 400)); else if (t < 1010) r = mixP(W, A, ease((t - 450) / 60)); else r = mixP(A, R, ease((t - 1010) / 400));
    }
    r.arcCols = BCOL[id]; r.arcR = BARC[id];
    return r;
  }

  global.MO = {
    Layer, blit, sprite, RAD, ease, lerp,
    crescent, sparkBurst, aura, warn, shockwave, orb, teleportRing, goldWave, pillar, moon, slashLine, impactFx,
    FIG, drawFigure, mixP, HATK, HR, heroAtk, heroSpecial, BR, bossPoseAt,
  };
})(window);
