'use strict';
// =====================================================================
//  모션 / 이펙트 엔진 (흑기사 보스전 모션 패치)
//  - 도트를 픽셀 버퍼(Layer)에 직접 찍는다. 좌표 1칸 = 원본 도트 1px
//  - 도트 키트(Mk): 파트별 모양만 그리면 5단계 음영을 자동으로 입힌다 (흑기사·보스·배경 소품)
//  - 흑기사와 보스는 "무기 없는 몸통 스프라이트 + 움직이는 팔 + 따로 그리는 무기"로 합성하고,
//    시간(ms)을 넣으면 무기 각도·손 위치·몸 기울기를 돌려주는 포즈 함수로 공격 모션을 만든다.
//  - 이펙트 함수는 모두 Layer 에 직접 그리는 순수 함수. 바닥 기준선(gy)은 인자로 받는다(2.5D 깊이 대응).
// =====================================================================
(function (global) {
  // ---------------------------------------------------------------- 픽셀 버퍼
  const HC = {};
  function rgb(c) { let v = HC[c]; if (!v) { const n = parseInt(c.slice(1), 16); v = HC[c] = [(n >> 16) & 255, (n >> 8) & 255, n & 255]; } return v; }

  class Layer {
    constructor(w, h) { this.w = w; this.h = h; this.ox = 0; this.d = new Uint8ClampedArray(w * h * 4); }   // ox: 그릴 때 x 에서 빼는 값 (넓은 배경 층용)
    clear() { this.d.fill(0); }
    put(x, y, c, a) {
      x = Math.round(x) - this.ox; y = Math.round(y);
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
    o = o || {}; x = Math.round(x) - (dst.ox || 0); y = Math.round(y);
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


  // ---------------------------------------------------------------- 도트 키트 (Mk)
  // 모양(마스크)만 파트별로 그리면 왼쪽 위 광원 기준 5단계 음영을 자동으로 입힌다.
  // 파트는 등록 순서가 곧 앞뒤 순서(나중이 앞). 앞 파트가 드리운 그림자와 가장자리 하이라이트까지 계산한다
  const RAMP = {
    steel: ['#14141d', '#202033', '#31314f', '#4a4b78', '#7b7fb4'],
    steelD: ['#0f0f16', '#191927', '#26263c', '#383858', '#55577e'],
    leather: ['#1a120d', '#2c1d14', '#46301f', '#654630', '#8a6444'],
    cloth: ['#34091a', '#5e1224', '#8e1d2f', '#bb2e3f', '#e75a62'],
    cape: ['#1c0912', '#35101c', '#561828', '#7c2234', '#a02e42'],
    gold: ['#47310e', '#78561a', '#b08a2a', '#dcb444', '#fff0a2'],
    purple: ['#150a24', '#2a1640', '#43266a', '#6a3f9c', '#9a6cc8'],
    feather: ['#07070b', '#101018', '#1c1c2a', '#32324a', '#52527a'],
    skin: ['#6a3a2a', '#9a5e44', '#c98e6a', '#e0aa84', '#f4c8a4'],
    bsteel: ['#0a0a0d', '#15151a', '#22222a', '#383842', '#8c8e9c'],     // 흑철 (가장자리가 은빛으로 빛남)
    bsteelD: ['#070709', '#0f0f13', '#18181e', '#2a2a32', '#55565f'],
    crimson: ['#14040a', '#2c0810', '#481018', '#661a22', '#86262c'],    // 핏빛 망토
    rag: ['#0c0a0a', '#181414', '#262020', '#3a302c', '#564840'],        // 해진 천
    ash: ['#2a2224', '#4a3c3a', '#6e5a54', '#8e7a70', '#b09a8e'],        // 잿빛 피부
    rust: ['#140c08', '#2a1a10', '#45301e', '#6a4a30', '#9a7a58'],       // 녹슨 철
    ghost: ['#0a0e14', '#141c26', '#22303e', '#344a5c', '#56708a'],      // 망령의 천
    tgold: ['#1e1606', '#3e2e0c', '#6a5216', '#9a7a24', '#d0b050'],      // 바랜 금
    obsid: ['#08060a', '#140c14', '#24141e', '#3e1e2a', '#7a3040'],      // 흑요석 갑옷
    purpleD: ['#0c0614', '#1a0c28', '#2c1642', '#43266a', '#6a3f9c'],
  };
  const RAMPX = {
    wood: ['#2a1a10', '#42281a', '#5e3c26', '#80553a', '#a67650'],
    hay: ['#6a5a1e', '#8e7a2c', '#b89c3c', '#d8be58', '#f0dc82'],
    stone: ['#1c1a24', '#2c2a38', '#403d50', '#5c5870', '#807c98'],
    iron: ['#14141a', '#22222c', '#34343f', '#4e4e5e', '#7a7a8e'],
    bone: ['#6a6250', '#948a74', '#bdb298', '#ddd3ba', '#f4ecd6'],
  };
  class Mk {
    constructor(w, h) { this.w = w; this.h = h; this.tx = 0; this.ty = 0; this.id = new Uint8Array(w * h); this.parts = [null]; }
    part(ramp, base, occ) { this.parts.push({ ramp, base: base == null ? 2 : base, occ: occ !== false }); return this.parts.length - 1; }
    px(x, y, p) { if (x < 0 || y < 0 || x >= this.w || y >= this.h) return; this.id[y * this.w + x] = p; }
    rect(p, x, y, w, h) { x = Math.round(x + this.tx); y = Math.round(y + this.ty); for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, p); }
    ell(p, cx, cy, rx, ry) {
      cx += this.tx; cy += this.ty;
      for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++) for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
        const u = (x + 0.5 - cx) / rx, v = (y + 0.5 - cy) / ry; if (u * u + v * v <= 1) this.px(x, y, p);
      }
    }
    poly(p, pts) {
      const tx = this.tx, ty = this.ty; pts = pts.map(q => [q[0] + tx, q[1] + ty]);
      let y0 = 1e9, y1 = -1e9; pts.forEach(q => { y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); });
      const n = pts.length;
      for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) {
        const yc = y + 0.5, xs = [];
        for (let i = 0; i < n; i++) {
          const a = pts[i], b = pts[(i + 1) % n];
          if ((a[1] <= yc && b[1] > yc) || (b[1] <= yc && a[1] > yc)) xs.push(a[0] + (yc - a[1]) / (b[1] - a[1]) * (b[0] - a[0]));
        }
        xs.sort((a, b) => a - b);
        for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.ceil(xs[k] - 0.5); x <= Math.floor(xs[k + 1] - 0.5); x++) this.px(x, y, p);
      }
    }
    cap(p, x0, y0, x1, y1, r) {                    // 끝이 둥근 막대 (팔다리)
      x0 += this.tx; x1 += this.tx; y0 += this.ty; y1 += this.ty;
      const minx = Math.floor(Math.min(x0, x1) - r - 1), maxx = Math.ceil(Math.max(x0, x1) + r + 1);
      const miny = Math.floor(Math.min(y0, y1) - r - 1), maxy = Math.ceil(Math.max(y0, y1) + r + 1);
      const dx = x1 - x0, dy = y1 - y0, l2 = dx * dx + dy * dy || 1;
      for (let y = miny; y <= maxy; y++) for (let x = minx; x <= maxx; x++) {
        let t = ((x + 0.5 - x0) * dx + (y + 0.5 - y0) * dy) / l2; t = t < 0 ? 0 : (t > 1 ? 1 : t);
        const ex = x0 + dx * t - (x + 0.5), ey = y0 + dy * t - (y + 0.5); if (ex * ex + ey * ey <= r * r) this.px(x, y, p);
      }
    }
    // 음영을 계산해 L 에 찍는다 (L 의 같은 좌표에)
    shadeInto(L, ox, oy) {
      ox = ox || 0; oy = oy || 0;
      const w = this.w, h = this.h, id = this.id, parts = this.parts;
      const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h) ? 0 : id[y * w + x];
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const p = id[y * w + x]; if (!p) continue;
        const P = parts[p];
        let dl = 7, dd = 7, k;
        for (k = 1; k <= 6; k++) { const q = at(x - k, y - k); if (q === 0 || q < p) { dl = k; break; } }
        for (k = 1; k <= 6; k++) { const q = at(x + k, y + k); if (q === 0 || q < p) { dd = k; break; } }
        const t = dd - dl;
        let v = P.base + (t >= 4 ? 2 : (t >= 2 ? 1 : (t <= -4 ? -2 : (t <= -2 ? -1 : 0))));
        if (P.occ) { const a = at(x - 1, y), b = at(x, y - 1), c = at(x - 1, y - 1); if (a > p || b > p || c > p) v -= 1; }
        L.put(x + ox, y + oy, P.ramp[v < 0 ? 0 : (v > 4 ? 4 : v)]);
      }
    }
  }
  // 두 관절 IK: 엉덩이(hx,hy) → 발목(fx,fy), 무릎은 앞(+x)으로 굽힌다
  function ik2(hx, hy, fx, fy, l1, l2) {
    let dx = fx - hx, dy = fy - hy, d = Math.hypot(dx, dy); const mx = l1 + l2 - 0.05;
    if (d > mx) { fx = hx + dx / d * mx; fy = hy + dy / d * mx; dx = fx - hx; dy = fy - hy; d = mx; }
    if (d < 1) d = 1;
    const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d), hh = Math.sqrt(Math.max(0, l1 * l1 - a * a)), vx = dx / d, vy = dy / d;
    return { k: [hx + vx * a + vy * hh, hy + vy * a - vx * hh], f: [fx, fy] };
  }

  // sprites.js 의 도트 정의를 픽셀 버퍼로 굽는다 (프레임별 캐시). 외곽선·음영은 합성 후 shade() 가 입힌다
  const CACHE = {};
  function sprite(id, f) {
    const k = id + ':' + (f | 0); if (CACHE[k]) return CACHE[k];
    const s = global.SPRITES[id], L = new Layer(s.w, s.h);
    if (s.build) s.build(L, f | 0);                 // 도트 키트로 만든 스프라이트 (프레임 표)
    else s.fn((x, y, w, h, c) => L.rect(x, y, w, h, c), f | 0, (cx, cy, r, c) => L.disc(cx, cy, r, c));
    return (CACHE[k] = L);
  }
  function spriteShaded(id, f) {                   // 이펙트 레이어에 바로 찍는 작은 스프라이트용 (까마귀 등)
    const k = id + ':s' + (f | 0); if (CACHE[k]) return CACHE[k];
    const src = sprite(id, f), L = new Layer(src.w + 2, src.h + 2);
    blit(src, L, 1, 1); shade(L);
    return (CACHE[k] = L);
  }

  // 아케이드 도트 마감: 왼쪽 위에서 빛이 드는 가장자리 하이라이트, 오른쪽 아래 2단 그늘,
  // 그리고 맞닿은 색을 아주 어둡게 한 "색 외곽선"(셀아웃). 몸통·팔·무기를 합성한 뒤 통째로 입힌다
  const OUT = [13, 11, 20];
  function shade(L) {
    const w = L.w, h = L.h, d = L.d, a = new Uint8Array(w * h);
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (d[(y * w + x) * 4 + 3]) { a[y * w + x] = 1; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
    if (x1 < 0) return;
    const on = (x, y) => x >= 0 && y >= 0 && x < w && y < h && a[y * w + x] === 1;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if (!a[y * w + x]) continue;
      const i = (y * w + x) * 4;
      let k = 0;
      if (!on(x, y - 1) || !on(x - 1, y)) k = 0.12;
      else if (!on(x, y + 1) || !on(x + 1, y)) k = -0.3;
      else if (!on(x, y + 2) || !on(x + 2, y)) k = -0.13;
      if (k > 0) { d[i] += (255 - d[i]) * k; d[i + 1] += (255 - d[i + 1]) * k; d[i + 2] += (255 - d[i + 2]) * k; }
      else if (k < 0) { d[i] *= 1 + k; d[i + 1] *= 1 + k; d[i + 2] *= 1 + k; }
    }
    for (let y = Math.max(0, y0 - 1); y <= Math.min(h - 1, y1 + 1); y++) for (let x = Math.max(0, x0 - 1); x <= Math.min(w - 1, x1 + 1); x++) {
      if (a[y * w + x]) continue;
      const n = on(x + 1, y) ? y * w + x + 1 : on(x - 1, y) ? y * w + x - 1 : on(x, y + 1) ? (y + 1) * w + x : on(x, y - 1) ? (y - 1) * w + x : -1;
      if (n < 0) continue;
      const i = (y * w + x) * 4, j = n * 4;
      d[i] = OUT[0] + d[j] * 0.2; d[i + 1] = OUT[1] + d[j + 1] * 0.2; d[i + 2] = OUT[2] + d[j + 2] * 0.2; d[i + 3] = 255;
    }
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
  function shockwave(L, fx, t, dir, gy, colors = ['#fff0c0', '#f6b25a', '#a8864a']) {
    const h = Math.max(1, Math.round(9 * (1 - t / 1100)));
    for (let k = 0; k < 16; k++) {
      const px = fx - dir * k, hh = Math.max(1, Math.round(h * (1 - k / 16)));
      for (let j = 0; j < hh; j++) L.put(px, gy - 1 - j, j > hh - 2 ? colors[0] : (j > hh / 2 ? colors[1] : colors[2]));
    }
    const R = rng(31 + (dir > 0 ? 1 : 0));
    for (let i = 0; i < 6; i++) {
      const d = R() * 14, hop = Math.abs(Math.sin((t * 0.01) + i)) * (8 * (1 - t / 1100));
      L.put(fx - dir * d, gy - 3 - hop, '#6a4a28'); L.put(fx - dir * d, gy - 4 - hop, '#a8864a');
    }
  }
  // 까마귀 마녀 모르그라: 초록 불꽃 구슬, 순간이동 고리
  const ORB_PAL = { green: ['#7dff7a', '#2a6a3a', '#eaffea'], blue: ['#7ad8ff', '#1e4a6a', '#eaf8ff'], fire: ['#ff8a2a', '#8a1a10', '#fff0c0'], eclipse: ['#ff498d', '#4b153e', '#ffe4fa'] };
  function orb(L, x, y, vx, vy, t, pal) {
    const m = Math.hypot(vx, vy) || 1, ux = vx / m, uy = vy / m, P = ORB_PAL[pal] || ORB_PAL.green;
    for (let k = 1; k <= 6; k++) L.put(x - ux * k * 2, y - uy * k * 2 + Math.sin(t * 0.02 + k) * 0.8, k < 3 ? P[0] : P[1]);
    L.disc(Math.round(x), Math.round(y), 3, P[1]); L.disc(Math.round(x), Math.round(y), 2, P[0]); L.put(x, y, P[2]);
  }
  function teleportRing(L, x, y, p) {
    const r = Math.round(4 + 22 * p);
    L.arc(x, y, r, 0, Math.PI * 2, '#7dff7a', 1, 1 - p * 0.6);
    L.arc(x, y, Math.max(2, r - 4), 0, Math.PI * 2, '#eaffea', 1, 0.8 * (1 - p));
    const R = rng(3);
    for (let i = 0; i < 10; i++) { const a = R() * 6.28; L.put(x + Math.cos(a) * r * 1.2, y - Math.sin(a) * r * 1.2 - p * 8, '#7dff7a'); }
  }
  // 황금왕 오렐리온: 초승달 검기, 화염 기둥
  function goldWave(L, x, y, dir, colors = ['#fff3b8', '#f3d26a', '#d4a437']) {
    for (let k = 0; k < 3; k++) {
      L.arc(x - dir * k * 5, y, 16, (dir > 0 ? -62 : 118) * RAD, (dir > 0 ? 62 : 242) * RAD,
        colors[k], 3, 1 - k * 0.3);
    }
    L.put(x + dir * 16, y, '#ffffff');
    const R = rng(41);
    for (let i = 0; i < 5; i++) L.put(x - dir * (8 + R() * 14), y + (R() - 0.5) * 22, colors[1]);
  }
  function pillar(L, x, t, p, gy, colors = ['#fff0c0', '#ffb02a', '#ff5a1a']) {      // p: 0..1 (솟아오름 → 꺼짐)
    const hgt = Math.round(66 * Math.sin(clamp(p, 0, 1) * Math.PI * 0.9 + 0.2)), w = 7 + Math.round(3 * Math.sin(t * 0.03));
    for (let j = 0; j < hgt; j++) {
      const taper = 1 - j / hgt * 0.55, hw = Math.max(2, Math.round(w * taper + Math.sin(j * 0.5 + t * 0.04) * 1.5));
      L.rect(x - hw, gy - 1 - j, hw * 2, 1, colors[2]);
      const iw = Math.max(1, Math.round(hw * 0.62)); L.rect(x - iw, gy - 1 - j, iw * 2, 1, colors[1]);
      const cw = Math.max(0, Math.round(hw * 0.28)); if (cw) L.rect(x - cw, gy - 1 - j, cw * 2, 1, colors[0]);
    }
    L.rect(x - w - 3, gy - 1, (w + 3) * 2, 2, colors[1]);
    const R = rng(17);
    for (let i = 0; i < 8; i++) { const ph = (t * 0.002 + R()) % 1; L.put(x + (R() - 0.5) * 26, gy - ph * hgt, colors[1]); }
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
  // sh = 어깨 위치(스프라이트 안), split = 이 줄 위로만 웅크림 적용, th = 팔 두께, arm = 팔 색(밝은 → 어두운),
  // elb = 팔꿈치 장식 색(null 이면 없음), over = 팔 위에 덧그리는 어깨 덮개 스프라이트, ov = 어깨 기준 덮개 위치
  // back = 양손잡이: 뒤쪽 어깨(sh)에서 손잡이의 at 지점까지 뒷팔을 몸 뒤에 그린다
  const FIG = {
    player: { w: 52, h: 58, sh: [31, 22], split: 36, arm: ['#8c8e9c', '#383842', '#15151a'], elb: '#55565f', th: 5, hand: ['#15151a', '#8c8e9c'], wpn: 'darkblade', over: 'pauld', ov: [7, 7],
      back: { sh: [21, 22], at: 5, arm: ['#55565f', '#22222a', '#0a0a0d'] } },
    boss1: { w: 68, h: 74, sh: [55, 29], split: 50, arm: ['#b09a8e', '#8e7a70', '#4a3c3a'], elb: null, th: 7, hand: '#d8d0b8', wpn: 'cleaver', over: 'pauld1', ov: [9, 7] },
    boss2: { w: 60, h: 74, sh: [40, 30], split: 40, arm: ['#9a6cc8', '#6a3f9c', '#43266a'], elb: null, th: 5, hand: '#c9b8d8', wpn: 'staff', over: 'mant2', ov: [8, 6] },
    boss3: { w: 68, h: 76, sh: [53, 27], split: 52, arm: ['#d0b050', '#9a7a24', '#3e2e0c'], elb: '#d0b050', th: 6, hand: '#9a7a24', wpn: 'greatsword', over: 'pauld3', ov: [10, 8] },
    boss4: { w: 68, h: 76, sh: [52, 28], split: 52, arm: ['#8c98ab', '#383e4c', '#151824'], elb: '#737f92', th: 6, hand: '#555f70', wpn: 'rustblade', over: 'pauld4', ov: [10, 8],
      back: { sh: [18, 28], at: 6, arm: ['#555f70', '#222834', '#0a0d14'] } },
    boss5: { w: 84, h: 88, sh: [62, 32], split: 60, arm: ['#7a3040', '#3e1e2a', '#140c14'], elb: '#ff5a1a', th: 8, hand: '#24141e', wpn: 'scythe', over: 'pauld5', ov: [12, 10] },
  };
  const WPN = {
    sword: { grip: 5, len: 22, w: 3, guard: 7, gc: '#c9a24a', hc: '#6e1220', bl: ['#8b95a8', '#f2f5fa', '#d3dae6'] },
    cleaver: { grip: 7, len: 26, w: 12, guard: 0, hc: '#5a3a24', bl: ['#6a7080', '#b8c0cc', '#eef2f8'], blunt: true },
    greatsword: { grip: 9, len: 38, w: 6, guard: 17, gc: '#f3d26a', hc: '#3a2a1a', bl: ['#6a7488', '#c8d0dc', '#f2f5fa'] },
    // 흑기사의 대검: 검은 칼날, 은빛 날, 가운데 붉은 홈, 양손 손잡이
    darkblade: { grip: 9, len: 34, w: 6, guard: 11, gc: '#383842', hc: '#2a1418', bl: ['#c8ccd8', '#1c1c24', '#c8ccd8'], fuller: '#c81e2a', pommel: '#55565f' },
    // 망령 기사단장의 녹슨 대검 (이 빠진 날)
    rustblade: { grip: 10, len: 40, w: 8, guard: 15, gc: '#45301e', hc: '#1a120c', bl: ['#45301e', '#8a6a4a', '#b8a080'], notch: true },
  };
  function thick(L, x0, y0, x1, y1, c, t, ox, oy) {
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)) * 2), o = t >> 1; ox = ox || 0; oy = oy || 0;
    for (let i = 0; i <= n; i++) { const u = i / n; L.rect(Math.round(x0 + (x1 - x0) * u - o + ox), Math.round(y0 + (y1 - y0) * u - o + oy), t, t, c); }
  }
  // 팔: 어깨 → 팔꿈치(앞으로 살짝 굽음) → 손. 색이 3개면 그늘·본색·하이라이트 3단으로 칠한다
  function drawArm(L, sx, sy, hx, hy, cols, th, elb) {
    const dx = hx - sx, dy = hy - sy, len = Math.hypot(dx, dy) || 1;
    let nx = -dy / len, ny = dx / len; if (ny < 0) { nx = -nx; ny = -ny; }
    const bend = Math.min(5, len * 0.25), ex = (sx + hx) / 2 + nx * bend, ey = (sy + hy) / 2 + ny * bend;
    if (cols.length > 2) {
      thick(L, sx, sy, ex, ey, cols[2], th); thick(L, ex, ey, hx, hy, cols[2], th);
      thick(L, sx, sy, ex, ey, cols[1], th - 1, -1, -1); thick(L, ex, ey, hx, hy, cols[1], th - 1, -1, -1);
      thick(L, sx, sy, ex, ey, cols[0], 1, -1, -1); thick(L, ex, ey, hx, hy, cols[0], 1, -1, -1);
      if (elb !== null) L.rect(Math.round(ex) - 1, Math.round(ey) - 1, 3, 2, elb || '#b08a2a');
      return;
    }
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
    if (kind === 'scythe') {                       // 마왕의 큰 낫: 긴 자루 끝에 뒤로 휜 날
      for (let u = -16; u < 46; u += 0.5) for (let v = -1; v <= 1; v += 0.5) put(u, v, v < 0 ? '#3e1e2a' : '#140c14');
      for (let v = -2; v <= 2; v += 0.5) { put(44, v, '#7a3040'); put(-16, v, '#7a3040'); }
      for (let k = 0; k <= 1; k += 0.02) {
        const bu = 46 - 24 * Math.pow(k, 1.3), bv = -(3 + 22 * Math.sin(k * Math.PI / 2)), hw = 3.2 * (1 - k) + 0.6;
        for (let d = -hw; d <= hw; d += 0.5) put(bu - d * 0.4, bv + d, d < -hw + 1 ? '#ff7a4a' : (d > hw - 1 ? '#3a0a0a' : (o.red ? '#ff5a6a' : '#8a1a20')));
      }
      return [hx + ux * 46, hy + uy * 46];
    }
    const w = WPN[kind], dark = kind === 'darkblade';
    const g0 = dark ? -6 : -3;                       // 양손 대검은 손잡이가 길다
    for (let u = g0; u < w.grip; u += 0.5) for (let v = -1; v <= 1; v += 0.5) put(u, v, o.red ? '#6e1220' : (((kind === 'sword' || dark) && Math.floor(u) % 2 === 0) ? '#5a1a22' : w.hc));
    if (w.pommel) { for (let v = -1.5; v <= 1.5; v += 0.5) { put(g0 - 0.5, v, w.pommel); put(g0 - 1.5, v * 0.7, w.pommel); } put(g0 - 1, -1, '#c8ccd8'); }
    if (kind === 'sword') { for (let v = -1; v <= 1; v += 0.5) put(-3.5, v, '#dcb444'); put(-4, 0, '#fff0a2'); }   // 손잡이 감개 + 금 폼멜
    if (w.guard) for (let v = -w.guard / 2; v <= w.guard / 2; v += 0.5) { put(w.grip, v, w.gc); put(w.grip + 1, v, w.gc); }
    const b0 = w.grip + (w.guard ? 2 : 0.5), b1 = b0 + w.len;
    for (let u = b0; u <= b1; u += 0.5) {
      let half = w.w / 2;
      if (!w.blunt) { const tp = (b1 - u) / (w.len * 0.22); if (tp < 1) half = Math.max(0.5, half * tp); }
      for (let v = -half; v <= half; v += 0.5) {
        let c = v < -half * 0.35 ? w.bl[0] : (v > half * 0.35 ? w.bl[2] : w.bl[1]);
        if (dark) c = Math.abs(v) > half - 1 ? w.bl[0] : (Math.abs(v) < 0.6 && u > b0 + 2 && u < b1 - 6 ? w.fuller : w.bl[1]);   // 은빛 날 · 검은 몸 · 붉은 홈
        if (o.red) c = v < -half * 0.35 ? '#a01a30' : (v > half * 0.35 ? '#ff9aa6' : '#ff5a6a');
        if (kind === 'cleaver' && ((u - b0) % 9 < 1.2) && v < -half + 2.5) continue;   // 식칼 이빨 빠진 자국
        if (w.notch && ((u - b0) % 11 < 1.5) && v > half - 2) continue;                // 녹슨 대검의 이 빠진 날
        put(u, v, c);
      }
    }
    put(b1, 0, '#ffffff');
    return [hx + ux * b1, hy + uy * b1];
  }
  // 피규어 1체: 몸통(기울기·웅크림) → 팔 → 무기. 궤적은 음영 처리 뒤 drawTrail() 로 따로 그린다.
  // pose = { ang, hx, hy, lean, crouch, arc:[시작각, 현재각], arcR, arcCols, red }
  // o = { f(프레임), leanW(월드 방향 추가 기울기), crouch, flash, wash, washA, noWeapon, shOff:[앞쪽 x, 아래 y](프레임이 몸을 옮긴 만큼) }
  function drawFigure(L, id, cx, top, face, pose, o) {
    o = o || {}; const F = FIG[id], sp = sprite(id, o.f || 0), so = o.shOff || [0, 0];
    const lean = (pose.lean || 0) * face + (o.leanW || 0), cr = (pose.crouch || 0) + (o.crouch || 0);
    const bo = { flip: face < 0, lean, crouch: cr, split: F.split, flash: o.flash, wash: o.wash, washA: o.wash ? (o.washA || 0.5) : 0 };
    // 어깨 좌표 (몸 기울기·웅크림·프레임 이동을 따라감)
    const shoulder = (sx0, sy0) => {
      const yy = sy0 + so[1], xx = face > 0 ? sx0 + so[0] : F.w - 1 - sx0 - so[0];
      const shf = Math.round(lean * Math.pow(Math.max(0, 1 - yy / (F.h - 1)), 1.2));
      return [cx - F.w / 2 + xx + shf, top + yy + (cr && yy < F.split ? cr : 0)];
    };
    const [sx, sy] = shoulder(F.sh[0], F.sh[1]);
    const hx = sx + (pose.hx || 0) * face, hy = sy + (pose.hy || 0);
    if (F.back && !o.noWeapon) {                    // 양손잡이: 뒷팔은 몸에 가려지도록 먼저
      const [bx, by] = shoulder(F.back.sh[0], F.back.sh[1]), ua = (pose.ang || 0) * RAD;
      drawArm(L, bx, by, hx + Math.cos(ua) * face * F.back.at, hy - Math.sin(ua) * F.back.at, F.back.arm, F.th - 1, null);
    }
    blit(sp, L, cx - F.w / 2, top, bo);
    if (o.noWeapon) return { sh: [sx, sy], hand: [hx, hy], tip: [hx, hy], trail: null };
    let trail = null;
    if (pose.arc) {
      const cur = pose.arc[1], st = cur + (pose.arc[0] - cur) * Math.min(1, 100 / Math.max(1, Math.abs(pose.arc[0] - cur)));
      trail = { x: hx, y: hy, r: pose.arcR || 21, a0: face > 0 ? st : 180 - st, a1: face > 0 ? cur : 180 - cur,
        cols: pose.arcCols || ['#ffffff', '#bfd4ff', '#7f98d8'], fleck: pose.fleck };
    }
    drawArm(L, sx, sy, hx, hy, F.arm, F.th, F.elb);
    if (F.over) {                                  // 어깨 덮개는 팔 위에
      const ov = F.ov || [6, 6];
      blit(sprite(F.over, 0), L, sx - ov[0], sy - ov[1], { flip: face < 0, flash: o.flash, wash: o.wash, washA: bo.washA });
    }
    const tip = drawWeapon(L, F.wpn, hx, hy, pose.ang, face, { red: pose.red });
    if (Array.isArray(F.hand)) { L.rect(Math.round(hx) - 1, Math.round(hy) - 1, 3, 3, F.hand[0]); L.put(hx - 1, hy - 1, F.hand[1]); }
    else L.rect(Math.round(hx) - 1, Math.round(hy) - 1, 3, 3, F.hand);
    return { sh: [sx, sy], hand: [hx, hy], tip, trail };
  }
  // 궤적: 겹친 초승달 + (흑기사) 궤적 바깥으로 튀는 붉은 핏방울
  function drawTrail(L, tr) {
    if (!tr) return;
    crescent(L, tr.x, tr.y, tr.r, tr.a0, tr.a1, tr.cols, tr.cols.length);
    if (tr.fleck) {
      for (let i = 0; i < 14; i++) {
        const a = (tr.a0 + (tr.a1 - tr.a0) * Math.random()) * RAD, r = tr.r + 1 + Math.random() * 6;
        L.put(tr.x + Math.cos(a) * r, tr.y - Math.sin(a) * r, Math.random() < 0.6 ? tr.fleck : '#5a0a12');
        if (Math.random() < 0.3) L.put(tr.x + Math.cos(a) * (r + 1), tr.y - Math.sin(a) * (r + 1), tr.fleck);
      }
    }
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
    { name: '일섬', wind: 90, act: 110, rec: 150, rad: 30 },
    { name: '역일섬', wind: 70, act: 100, rec: 140, rad: 30 },
    { name: '참격', wind: 200, act: 140, rec: 340, rad: 36 },
  ];
  const HR = { ang: -34, hx: 3, hy: 13, lean: 1, crouch: 1, jy: 0 };   // 기본 자세: 두 손으로 대검을 낮게, 칼끝은 앞 아래
  const HK = [
    { w: { ang: 125, hx: -3, hy: -10, lean: -2, crouch: 0 }, s: { ang: -30, hx: 10, hy: 6, lean: 5, crouch: 2 } },   // 어깨 위에서 대각선으로
    { w: { ang: -55, hx: 4, hy: 14, lean: 1, crouch: 3 }, s: { ang: 130, hx: 8, hy: -10, lean: 3, crouch: 0 } },      // 낮은 곳에서 위로
    { w: { ang: 158, hx: -6, hy: -15, lean: -5, crouch: 0 }, s: { ang: -72, hx: 11, hy: 12, lean: 8, crouch: 4 } },  // 머리 위로 크게 들었다가 땅까지
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
  const BR = { boss1: { ang: 118, hx: 3, hy: -6 }, boss2: { ang: 88, hx: 4, hy: 9 }, boss3: { ang: 84, hx: 6, hy: 5 },
    boss4: { ang: -30, hx: 5, hy: 12 }, boss5: { ang: 100, hx: 4, hy: 2 } };
  const BCOL = { boss1: ['#ffffff', '#ffe27a', '#f58c3b', '#a8501a'], boss2: ['#eaffea', '#7dff7a', '#2a6a3a'], boss3: ['#fff3b8', '#ffd23a', '#d4a437'],
    boss4: ['#eaf8ff', '#7ad8ff', '#2a6a8a'], boss5: ['#fff0c0', '#ff7a1a', '#a01a14', '#4a0808'] };
  const BARC = { boss1: 30, boss2: 28, boss3: 42, boss4: 44, boss5: 50 };
  function bossPoseAt(id, pat, t, p2) {
    const R = BR[id]; let r = mixP(R, R, 0);
    const arc = (x, a0) => { x.arc = [a0, x.ang]; return x; };
    if (pat === 'frost' || pat === 'eclipse') {
      const wind = pat === 'frost' ? 1050 : 1400, cycle = pat === 'frost' && p2 ? t % 1400 : t;
      const W = { ang: 165, hx: -3, hy: -14, lean: -3, dy: -3 }, St = { ang: -72, hx: 9, hy: 11, lean: 5, crouch: 2, dy: 0 };
      if (cycle < wind) r = mixP(R, W, ease(cycle / 500));
      else if (cycle < wind + 150) r = arc(mixP(W, St, ease((cycle - wind) / 150)), 165);
      else r = mixP(St, R, ease((cycle - wind - 150) / 600));
    } else if (pat === 'slam') {
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
    Layer, blit, sprite, spriteShaded, shade, RAD, ease, lerp, rng, rgb, Mk, RAMP, RAMPX, ik2,
    crescent, sparkBurst, aura, warn, shockwave, orb, teleportRing, goldWave, pillar, moon, slashLine, impactFx,
    FIG, drawFigure, drawTrail, mixP, HATK, HR, heroAtk, heroSpecial, BR, bossPoseAt,
  };
})(window);
