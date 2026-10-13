'use strict';
// =====================================================================
//  중세 도트 원경 5종 (192x84 원본 도트, 게임에서 4배 확대해 좌우로 이어 붙여 스크롤)
//   stage1: 해질녘 야영지 (붉은 평원) / stage2: 안개 낀 밤의 습지 (진흙의 야영지) / stage3: 황금왕의 왕좌의 방 (불타는 성채)
//   stage4: 얼어붙은 묘지 / stage5: 마왕성 심연
//  먼 풍경(far)과 중경(mid)은 한 번만 굽고, 매 프레임 구름·안개·흔들리는 조명·불꽃·깃발·떠다니는 빛을 얹는다.
//  바닥(걷는 곳)은 game.js 가 따로 그린다. ※ motion.js 를 먼저 불러와야 한다 (Layer, Mk 사용)
// =====================================================================
(function (global) {
  const { Layer, Mk, RAMP, RAMPX, rng, rgb } = global.MO;
  const SW = 192, SH = 84, HZ = 56, PAD = 40, BW = SW + PAD * 2;   // HZ: 지평선 (이 아래는 game.js 의 바닥이 덮는다)

  function mkL() { const L = new Layer(BW, SH); L.ox = -PAD; return L; }
  function fl(t, s) { return 0.82 + 0.18 * (Math.sin(t * 0.021 + s) * 0.5 + Math.sin(t * 0.047 + s * 2.3) * 0.5) + 0.06 * Math.sin(t * 0.13 + s * 5); }   // 불빛 깜빡임
  function mixc(a, b, u) {
    const A = rgb(a), B = rgb(b);
    return '#' + [0, 1, 2].map(i => { const v = Math.round(A[i] + (B[i] - A[i]) * u); return (v < 16 ? '0' : '') + v.toString(16); }).join('');
  }
  // 디더링 띠: 경계 2줄을 바둑판으로 섞어 부드럽게
  function dithBands(L, y0, y1, cols, x0, x1) {
    const n = cols.length, h = (y1 - y0) / n;
    for (let y = y0; y < y1; y++) {
      const pos = (y - y0) / h, i = Math.min(n - 1, Math.floor(pos)), fr = pos - i;
      for (let x = x0; x < x1; x++) {
        let c = cols[i];
        if (fr >= 0.78 && i < n - 1 && ((x + y) & 1)) c = cols[i + 1];
        else if (fr < 0.22 && i > 0 && ((x + y) & 1)) c = cols[i - 1];
        L.put(x, y, c);
      }
    }
  }
  function ridge(L, R, base, fill, rim, per, amp, x0, x1, yEnd, under) {   // 산등성이
    for (let x = x0; x < x1; x++) {
      const y = Math.round(base + amp[0] * Math.sin(x / per[0]) + amp[1] * Math.sin(x / per[1] + 1.3) + (R ? (R() - 0.5) * 0.8 : 0));
      L.rect(x, y, 1, yEnd - y, fill); L.put(x, y, rim); if (under) L.put(x, y + 1, under);
    }
  }
  function putMk(L, m, x, y) { m.shadeInto(L, x, y); }                    // 도트 키트로 만든 소품을 (x, y) 좌상단에 찍는다
  // 불꽃 (애니메이션)
  const FPAL = { fire: ['#fffbe0', '#fff0a0', '#fff0a0', '#ffd23a', '#ff8a1a', '#d83a14'], green: ['#f4fff0', '#c8ffc8', '#c8ffc8', '#7dff7a', '#2fbf5a', '#1a6a3a'] };
  function flame(L, x, y, t, s, seed, pal) {
    pal = pal || FPAL.fire;
    const H = Math.max(3, Math.round(6 * s * (0.85 + 0.15 * Math.sin(t * 0.02 + seed) + 0.1 * Math.sin(t * 0.051 + seed * 3)))), hw = Math.max(1, Math.round(2 * s));
    for (let dx = -hw; dx <= hw; dx++) {
      const k = 1 - Math.pow(Math.abs(dx) / (hw + 0.6), 1.6), sway = Math.sin(t * 0.013 + seed + dx) * 0.7 * s, h = Math.max(1, Math.round(H * k));
      for (let j = 0; j < h; j++) {
        const u = j / h, core = Math.abs(dx) * 2 <= hw;
        const col = u < 0.25 ? (core ? pal[0] : pal[1]) : (u < 0.5 ? (core ? pal[2] : pal[3]) : (u < 0.8 ? pal[4] : pal[5]));
        L.put(x + Math.round(dx + sway * u), y - j, col);
      }
    }
  }
  function embers(L, t, x, y, n, spread, rise, seed) {               // 불티
    for (let k = 0; k < n; k++) {
      const age = ((t * 0.025 + k * (61 / n) * 0.97 + seed * 13) % 60), u = age / 60;
      L.put(x + Math.sin(k * 12.9 + age * 0.18 + seed) * spread * (0.3 + u), y - age * rise, u < 0.3 ? '#ffe27a' : (u < 0.65 ? '#ff8a1a' : '#a8381a'), 1 - u * u);
    }
  }
  function motes(L, t, n, col, y0, y1, seed) {                       // 떠다니는 빛 알갱이
    for (let k = 0; k < n; k++) {
      const x = ((k * 47.3 + seed * 19 + t * 0.006 * (0.5 + (k % 3) * 0.35)) % (SW + 20)) - 10, y = y0 + ((k * 13.7 + seed * 7) % (y1 - y0)) + Math.sin(t * 0.0011 + k) * 3;
      L.put(x, y, col, 0.5 + 0.4 * Math.sin(t * 0.003 + k * 2));
    }
  }
  function cloud(L, x, y, w, h, top, mid, under) {
    for (let j = 0; j < h; j++) {
      const u = j / (h - 1), half = Math.round((w / 2) * (j === h - 1 ? 1 : Math.sin(0.35 + u * 1.15) * 0.98));
      L.rect(x - half, y + j, half * 2 + 1, 1, j === h - 1 ? under : (j < h * 0.4 ? top : mid));
    }
  }
  // 조명: 4단계로 끊은 빛 웅덩이 (바이엘 디더링)
  const BAY = [0.125, 0.625, 0.875, 0.375];
  function lightPass(L, lights) {
    const d = L.d, w = L.w;
    for (const g of lights) {
      if (g.bg === 0) continue;
      const cx = Math.round(g.x), cy = g.y, R = g.r, a = g.a, c = g.c;
      const x0 = Math.max(0, cx - R), x1 = Math.min(L.w - 1, cx + R), y0 = Math.max(0, Math.floor(cy - R * 0.8)), y1 = Math.min(L.h - 1, Math.ceil(cy + R * 0.8));
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const i = (y * w + x) * 4, dx = x - cx, dy = (y - cy) * 1.25, dist = Math.sqrt(dx * dx + dy * dy);
        if (dist >= R) continue;
        const lv = Math.floor((1 - dist / R) * 5 + BAY[((y & 1) << 1) | (x & 1)]); if (lv <= 0) continue;
        const q = Math.min(5, lv) / 5 * a;
        d[i] += c[0] * q; d[i + 1] += c[1] * q; d[i + 2] += c[2] * q;
      }
    }
  }

  // ---------------------------------------------------------------- 스테이지 1: 해질녘 야영지
  function flagBanner(L, x, y, w, h, t, seed, c1, c2, c3) {
    L.rect(x, y - 2, 1, h + 10, '#2a1810'); L.put(x, y - 3, '#dcb444');
    for (let i = 0; i < w; i++) {
      const s = Math.sin(t * 0.005 + i * 0.55 + seed), yo = Math.round(s * Math.min(2.5, i * 0.35)), hh = h - ((i * 7 + seed * 3) % 4 === 0 ? 2 : 0) - (i > w - 3 ? 1 : 0);
      for (let j = 0; j < hh; j++) { let c = s > 0.35 ? c1 : (s < -0.35 ? c3 : c2); if (j < 2) c = c3; L.put(x + 1 + i, y + yo + j, c); }
    }
    L.rect(x + Math.floor(w / 2), y + Math.floor(h / 2) - 1, 2, 3, '#e8c86a');
  }
  function pine(L, cx, base, h, col, rim) {
    for (let yy = 0; yy < h; yy++) { const hw = 1 + Math.floor(yy * 0.34) + ((yy % 5 < 2) ? 1 : 0); L.rect(cx - hw, base - h + yy, hw * 2 + 1, 1, col); L.put(cx + hw, base - h + yy, rim); }
    L.rect(cx, base - 2, 1, 2, '#150a1a');
  }
  const STG = {};
  STG.stage1 = {
    far(L) {
      const R = rng(11); let i;
      dithBands(L, 0, 60, ['#1b1740', '#2c2058', '#4a2a6e', '#7a3a7c', '#b04c78', '#dc6a62', '#f08e54', '#f8b866', '#fbd98a'], -PAD, SW + PAD);
      for (i = 0; i < 34; i++) L.put(-PAD + Math.floor(R() * BW), Math.floor(R() * 20), R() < 0.5 ? '#cfc4ee' : '#8f84c4');
      L.disc(96, 47, 38, '#ffd08a', 0.10); L.disc(96, 47, 29, '#ffd9a0', 0.14); L.disc(96, 47, 21, '#ffe3b0', 0.28);   // 지는 해
      L.disc(96, 47, 15, '#ffe9a8'); L.disc(96, 47, 11, '#fff3c4'); L.disc(96, 47, 6, '#fffbe6');
      ridge(L, R, 41, '#6a3a74', '#b0587e', [21, 9], [6, 4], -PAD, SW + PAD, 64, '#80467a');
      const cc = '#4a2a64';                                                        // 먼 성
      L.rect(22, 31, 5, 13, cc); L.rect(21, 29, 7, 2, cc); L.rect(33, 28, 5, 16, cc); L.rect(32, 26, 7, 2, cc); L.rect(26, 36, 8, 8, cc);
      for (i = 0; i < 5; i++) { L.put(22 + i, 28, cc); L.put(34 + i, 25, cc); }
      for (i = 0; i < 4; i++) L.put(35, 22 + i, cc);
      L.rect(36, 21, 4, 2, '#a8384a');
      L.put(24, 35, '#ffd070'); L.put(35, 33, '#ffd070'); L.put(36, 38, '#ffd070'); L.put(29, 39, '#ffb050');
      ridge(L, R, 49, '#46285a', '#8a4a7e', [26, 11], [5, 3], -PAD, SW + PAD, 64, '#5a3270');
    },
    sky(L, t) {
      [[20, 12, 34, 6, 0.0030], [96, 22, 44, 7, 0.0022], [150, 9, 38, 5, 0.0036], [60, 31, 30, 5, 0.0027]].forEach(c => {
        const x = ((c[0] + t * c[4] * 10) % (SW + 90)) - 45;
        cloud(L, Math.round(x), c[1], c[2], c[3], '#f6b98a', '#c4608a', '#7a3a72');
      });
    },
    mid(L) {
      const R = rng(12); let x, i;
      for (x = -PAD; x < SW + PAD; x += 7) pine(L, x + Math.floor(R() * 4), HZ, 12 + Math.floor(R() * 9), '#3a2250', '#7a4a78');
      for (x = -PAD + 3; x < SW + PAD; x += 6) pine(L, x + Math.floor(R() * 3), HZ, 17 + Math.floor(R() * 10), '#25142f', '#6a3858');
      for (x = 6; x < 68; x += 3) {                                                // 목책
        const top = HZ - 12 + ((x / 3 | 0) % 2 ? 0 : 1);
        L.rect(x, top + 2, 2, HZ - top - 2, '#4a3022'); L.rect(x, top, 1, 2, '#4a3022'); L.put(x, top + 3, '#7a5238'); L.rect(x, top + 3, 1, HZ - top - 3, '#6e4a34'); L.put(x + 1, top, '#2e1c14');
      }
      L.rect(6, HZ - 7, 62, 1, '#2a1810'); L.rect(6, HZ - 3, 62, 1, '#2a1810'); L.rect(6, HZ - 8, 62, 1, '#8a5a3c', 0.5);
      const tx = 140;                                                               // 망루 (해를 등지고 선다)
      L.rect(tx - 8, HZ - 22, 2, 22, '#3a2418'); L.rect(tx + 7, HZ - 22, 2, 22, '#3a2418'); L.rect(tx - 8, HZ - 22, 1, 22, '#6e4a34');
      L.line(tx - 7, HZ - 3, tx + 7, HZ - 20, '#2e1c14', 1); L.line(tx + 7, HZ - 3, tx - 7, HZ - 20, '#2e1c14', 1);
      L.rect(tx - 11, HZ - 26, 23, 4, '#4a3022'); L.rect(tx - 11, HZ - 26, 23, 1, '#7a5238'); L.rect(tx - 10, HZ - 29, 1, 3, '#3a2418'); L.rect(tx + 11, HZ - 29, 1, 3, '#3a2418');
      L.rect(tx - 11, HZ - 30, 23, 1, '#3a2418');
      for (i = 0; i < 5; i++) L.rect(tx - 10 + i * 5, HZ - 29, 1, 3, '#3a2418');
      for (i = 0; i < 8; i++) L.rect(tx - 12 + i * 3, HZ - 37 + i, 26 - i * 6, 1, '#2a1810');
      L.rect(tx - 9, HZ - 38, 19, 1, '#2a1810'); L.rect(tx - 5, HZ - 40, 11, 2, '#2a1810'); L.rect(tx - 1, HZ - 44, 3, 4, '#2a1810');
      L.rect(-PAD, HZ - 2, BW, 2, '#150a1a');
    },
    lights: t => [{ x: 140, y: HZ - 31, r: 38, c: [255, 150, 60], a: 0.55 * fl(t, 1) }],
    dyn(L, t) {
      flame(L, 140, HZ - 33, t, 0.9, 1); embers(L, t, 140, HZ - 34, 5, 3, 0.55, 1);
      flagBanner(L, 28, HZ - 30, 13, 12, t, 1, '#c03a3a', '#a02a2a', '#6e1a22');
      flagBanner(L, 52, HZ - 27, 11, 10, t, 4, '#c03a3a', '#a02a2a', '#6e1a22');
      motes(L, t, 16, '#ffd9a0', 14, 54, 1);
    },
  };

  // ---------------------------------------------------------------- 스테이지 2: 안개 낀 밤의 습지
  function deadTree(L, R, x, y, ang, len, th, col, depth) {
    const x1 = x + Math.cos(ang) * len, y1 = y - Math.sin(ang) * len;
    L.line(x, y, x1, y1, col, th);
    if (depth <= 0 || len < 4) return;
    const n = depth > 2 ? 2 : 2 + (R() < 0.5 ? 1 : 0);
    for (let i = 0; i < n; i++) { const da = (R() - 0.5) * 1.5 + (i - 0.5) * 0.5; deadTree(L, R, x1, y1, ang + da, len * (0.62 + R() * 0.15), Math.max(1, th - 1), col, depth - 1); }
  }
  function tentMk(L, x, by, w, h, ramp) {
    const m = new Mk(w, h), a = m.part(ramp, 2); m.poly(a, [[w / 2, 0], [w, h], [0, h]]); putMk(L, m, x, by - h);
    const cx = x + Math.floor(w / 2);
    for (let j = Math.floor(h * 0.45); j < h; j++) { const hw = Math.floor((j - h * 0.45) * 0.42); L.rect(cx - hw, by - h + j, hw * 2 + 1, 1, '#07090e'); }
    L.line(cx, by - h, cx, by - h + Math.floor(h * 0.45), '#07090e');
    L.put(cx, by - h - 1, '#3a2a1e'); L.rect(cx, by - h - 3, 1, 2, '#3a2a1e'); L.rect(cx + 1, by - h - 3, 3, 2, '#6a2a2a');
  }
  const TENT_GREY = ['#14141c', '#22222e', '#363644', '#4e4e60', '#6e6e82'];
  STG.stage2 = {
    far(L) {
      const R = rng(23); let i;
      dithBands(L, 0, 58, ['#080d18', '#0e1626', '#16243a', '#203650', '#2e4a62', '#46687a', '#6a8e98', '#8cb0b0'], -PAD, SW + PAD);
      for (i = 0; i < 40; i++) L.put(-PAD + Math.floor(R() * BW), Math.floor(R() * 28), R() < 0.5 ? '#b8c8e0' : '#6a7a9a');
      L.disc(96, 23, 34, '#a8c8e8', 0.07); L.disc(96, 23, 25, '#b8d4ee', 0.10); L.disc(96, 23, 17, '#c8e0f4', 0.18);   // 달
      L.disc(96, 23, 12, '#dce8f2'); L.disc(96, 23, 9, '#eef4fa'); L.disc(92, 20, 2, '#c0cdd8'); L.disc(100, 26, 2, '#c0cdd8'); L.disc(99, 19, 1, '#c8d4de');
      ridge(L, R, 44, '#2a4252', '#58808e', [24, 10], [5, 3], -PAD, SW + PAD, 62, '#34505e');
      for (let x = -PAD + 5; x < SW + PAD; x += 17 + Math.floor(R() * 10)) deadTree(L, R, x, 47, 1.57 + (R() - 0.5) * 0.4, 9 + R() * 5, 1, '#16242e', 2);
      ridge(L, R, 50, '#1a2c38', '#3e606c', [19, 8], [4, 3], -PAD, SW + PAD, 62, '#22384a');
    },
    sky(L, t) {
      [[10, 10, 52, 3, 0.0020], [110, 18, 60, 4, 0.0014], [70, 31, 46, 3, 0.0026]].forEach(c => {
        const x = ((c[0] + t * c[4] * 10) % (SW + 110)) - 55;
        for (let j = 0; j < c[3]; j++) { const hw = Math.round(c[2] / 2 * (1 - Math.abs(j - 1) * 0.22)); L.rect(Math.round(x) - hw, c[1] + j, hw * 2, 1, j === 0 ? '#34506a' : '#1c2e44', 0.78); }
      });
    },
    mid(L) {
      const R = rng(24); let i, x;
      for (x = -PAD + 4; x < SW + PAD; x += 23 + Math.floor(R() * 15)) deadTree(L, R, x, HZ, 1.57 + (R() - 0.5) * 0.5, 14 + R() * 8, 2, '#0b141a', 3);
      tentMk(L, 22, HZ, 30, 20, TENT_GREY); tentMk(L, 64, HZ, 24, 15, RAMP.cloth); tentMk(L, 170, HZ, 28, 18, TENT_GREY);   // 천막
      const tx = 122;                                                               // 망루
      L.rect(tx - 7, HZ - 26, 2, 26, '#2a1e16'); L.rect(tx + 6, HZ - 26, 2, 26, '#2a1e16'); L.rect(tx - 7, HZ - 26, 1, 26, '#4a3626');
      L.line(tx - 6, HZ - 3, tx + 6, HZ - 24, '#1a120c', 1); L.line(tx + 6, HZ - 3, tx - 6, HZ - 24, '#1a120c', 1);
      L.rect(tx - 10, HZ - 30, 21, 4, '#34261a'); L.rect(tx - 10, HZ - 30, 21, 1, '#5a4630');
      for (i = 0; i < 6; i++) L.rect(tx - 9 + i * 4, HZ - 34, 1, 4, '#1a120c');
      L.rect(tx - 10, HZ - 34, 21, 1, '#1a120c'); L.rect(tx, HZ - 26, 1, 5, '#1a120c');
      for (x = 84; x < 114; x += 6) {                                               // 해골 울타리
        L.rect(x, HZ - 9, 1, 9, '#2a1e16');
        const m = new Mk(5, 5), a = m.part(RAMPX.bone, 2); m.ell(a, 2.5, 2.5, 2.4, 2.4); putMk(L, m, x - 2, HZ - 14);
        L.put(x - 1, HZ - 12, '#07090e'); L.put(x + 1, HZ - 12, '#07090e');
      }
      [[30, HZ - 27], [48, HZ - 23], [150, HZ - 26], [182, HZ - 24]].forEach(p => {   // 나뭇가지 위 까마귀
        L.rect(p[0], p[1], 4, 2, '#05080c'); L.put(p[0] + 4, p[1] + 1, '#05080c'); L.put(p[0] + 3, p[1] - 1, '#05080c'); L.put(p[0] + 5, p[1] + 1, '#8a6a2a');
      });
      L.rect(-PAD, HZ - 2, BW, 2, '#0a1218');
    },
    midDyn(L, t) {                                                                 // 흘러가는 안개
      [[0.0030, 0, 44, 0.10], [0.0021, 70, 50, 0.13], [0.0040, 130, 47, 0.09]].forEach((b, k) => {
        const x = ((t * b[0] * 12 + b[1]) % (SW + 140)) - 70;
        for (let j = 0; j < 6; j++) {
          const hw = Math.round(46 * Math.sin(0.4 + j * 0.45) * (0.7 + 0.3 * Math.sin(t * 0.0007 + k)));
          L.rect(Math.round(x) - hw, b[2] + j, hw * 2, 1, '#a8c0c8', b[3] * (j < 2 || j > 3 ? 0.6 : 1));
        }
      });
    },
    lights: t => [{ x: 122, y: HZ - 26, r: 34, c: [120, 255, 150], a: 0.5 * fl(t, 3) }],
    dyn(L, t) { flame(L, 122, HZ - 28, t, 0.8, 2, FPAL.green); motes(L, t, 12, '#9aff9a', 20, 54, 3); },
  };

  // ---------------------------------------------------------------- 스테이지 3: 황금왕의 왕좌의 방
  function hangBanner(L, x, y, w, h, t, seed, c1, c2, c3) {
    L.rect(x - 1, y, w + 3, 1, '#dcb444'); L.put(x - 1, y, '#fff0a2'); L.put(x + w + 1, y, '#fff0a2');
    for (let j = 0; j < h; j++) {
      const xo = Math.round(Math.sin(t * 0.0028 + j * 0.28 + seed) * Math.min(2, j * 0.1));
      for (let i = 0; i < w; i++) {
        if (j >= h - 5) { const k = j - (h - 6), mid = (w - 1) / 2; if (Math.abs(i - mid) < (5 - k) * (w / 10)) continue; }   // 제비꼬리 끝
        const edge = i === 0 || i === w - 1, fold = Math.sin(i * 0.9 + t * 0.002 + seed) > 0.4;
        L.put(x + 1 + i + xo, y + 1 + j, edge ? c3 : (fold ? c1 : c2));
      }
    }
    const cx = x + 1 + Math.floor(w / 2), cy = y + Math.floor(h * 0.4);
    L.rect(cx - 1, cy - 2, 3, 5, '#e8c86a'); L.put(cx, cy - 3, '#fff0a2'); L.rect(cx - 2, cy, 5, 1, '#e8c86a'); L.rect(cx, cy + 2, 1, 2, '#8a6a1c');
  }
  STG.stage3 = {
    far(L) {
      const R = rng(37); let x, y, i;
      dithBands(L, 0, 60, ['#0d0916', '#130d1e', '#1a1228', '#221832', '#2a1e3a'], -PAD, SW + PAD);
      for (y = 0; y < 60; y += 7) {                                                  // 석벽
        L.rect(-PAD, y, BW, 1, '#0b0712');
        for (x = -PAD + (((y / 7) | 0) % 2 ? 0 : 9); x < SW + PAD; x += 18) L.rect(x, y, 1, 7, '#0b0712');
      }
      for (i = 0; i < 80; i++) L.rect(-PAD + Math.floor(R() * BW), Math.floor(R() * 56), 2 + Math.floor(R() * 3), 1, '#3a2e4c', 0.5);
      [32, 96, 160].forEach((cx, wi) => {                                            // 높은 아치 창과 밤하늘
        L.rect(cx - 14, 10, 28, 48, '#403650'); L.disc(cx, 16, 14, '#403650');
        L.rect(cx - 11, 12, 22, 46, '#0a1030'); L.disc(cx, 16, 11, '#0a1030');
        dithBands(L, 5, 58, ['#0a1030', '#101c48', '#18286a', '#223a88'], cx - 11, cx + 11);
        for (i = 0; i < 9; i++) L.put(cx - 9 + Math.floor(R() * 18), 8 + Math.floor(R() * 18), '#cfd8ff');
        if (wi === 1) { L.disc(cx + 2, 19, 6, '#c8d8ff', 0.3); L.disc(cx + 2, 19, 4, '#e8f0ff'); }
        L.rect(cx - 11, 12, 1, 46, '#5a4e72'); L.rect(cx - 14, 10, 1, 48, '#6a5e82');
        L.rect(cx, 5, 1, 53, '#2a2238'); L.rect(cx - 11, 30, 22, 1, '#2a2238'); L.rect(cx - 11, 44, 22, 1, '#2a2238');
        L.rect(cx - 12, 56, 24, 2, '#5a4e72');
      });
    },
    mid(L) {
      [14, 66, 126, 178].forEach(cx => {                                             // 기둥과 횃대
        const m = new Mk(22, HZ), sh = m.part(RAMPX.stone, 2), cp = m.part(RAMPX.stone, 3), bs = m.part(RAMPX.stone, 2), gd = m.part(RAMP.gold, 2, false);
        m.rect(sh, 4, 8, 14, HZ - 14); m.rect(cp, 1, 3, 20, 6); m.rect(bs, 2, HZ - 8, 18, 8); m.rect(gd, 1, 8, 20, 1); m.rect(gd, 2, HZ - 9, 18, 1);
        putMk(L, m, cx - 11, 0);
        for (let y = 10; y < HZ - 9; y++) { L.put(cx - 3, y, '#2c2a38'); L.put(cx + 1, y, '#2c2a38'); L.put(cx + 4, y, '#403d50', 0.6); }
        L.rect(cx - 1, HZ - 32, 3, 6, '#14141a'); L.rect(cx - 3, HZ - 27, 7, 2, '#22222c'); L.rect(cx - 3, HZ - 27, 7, 1, '#4e4e5e');
      });
      [[0, 30], [1, 24], [2, 18]].forEach(s => {                                     // 단상과 왕좌
        const w = s[1] * 2 + 30;
        L.rect(96 - w / 2, HZ - 3 - s[0] * 3, w, 3, s[0] === 0 ? '#34304a' : '#403d58'); L.rect(96 - w / 2, HZ - 3 - s[0] * 3, w, 1, '#6a6288');
      });
      const t = new Mk(24, 36), bk = t.part(RAMP.gold, 2), st = t.part(RAMP.cloth, 2);
      t.poly(bk, [[3, 36], [2, 8], [6, 0], [12, 3], [18, 0], [22, 8], [21, 36]]); t.rect(st, 6, 12, 12, 18);
      t.rect(bk, 0, 26, 24, 5); t.rect(bk, 1, 31, 22, 5);
      putMk(L, t, 84, HZ - 42);
      L.rect(92, HZ - 38, 8, 2, '#fff0a2', 0.5);
    },
    lights: t => [14, 66, 126, 178].map((x, i) => ({ x, y: HZ - 36, r: 40, c: [255, 150, 60], a: 0.52 * fl(t, i + 1) })),
    dyn(L, t) {
      [14, 66, 126, 178].forEach((x, i) => { flame(L, x, HZ - 33, t, 0.9, i + 1); embers(L, t, x, HZ - 35, 3, 2, 0.5, i); });
      hangBanner(L, 34, 8, 12, 26, t, 1, '#b01e30', '#8e1626', '#5e0f1a');
      hangBanner(L, 146, 8, 12, 26, t, 3, '#b01e30', '#8e1626', '#5e0f1a');
      motes(L, t, 14, '#ffd9a0', 10, 54, 2);
    },
  };


  // ---------------------------------------------------------------- 스테이지 4: 얼어붙은 묘지
  FPAL.blue = ['#ffffff', '#d8ecff', '#d8ecff', '#8ac0ff', '#4a80e0', '#2a4aa0'];
  function tomb(L, x, by, kind, R) {               // 비석 (둥근 비석 / 십자가) + 눈 덮개
    if (kind === 0) {
      const w = 6 + Math.floor(R() * 3), h = 8 + Math.floor(R() * 4), m = new Mk(w, h), a = m.part(RAMPX.stone, 2);
      m.rect(a, 0, 2, w, h - 2); m.ell(a, w / 2, 2.5, w / 2, 2.5); putMk(L, m, x - w / 2, by - h);
      L.rect(x - w / 2 + 1, by - h, w - 2, 1, '#dce8f0'); L.rect(x - 1, by - h + 4, 2, 1, '#2c2a38');
    } else {
      const m = new Mk(7, 12), a = m.part(RAMPX.stone, 2); m.rect(a, 2.5, 0, 2, 12); m.rect(a, 0, 3, 7, 2); putMk(L, m, x - 3, by - 12);
      L.put(x - 3, by - 10, '#dce8f0'); L.put(x - 2, by - 10, '#dce8f0'); L.put(x, by - 13, '#dce8f0');
    }
  }
  STG.stage4 = {
    far(L) {
      const R = rng(41); let i, x;
      dithBands(L, 0, 58, ['#05080f', '#0a1020', '#101a30', '#18263e', '#22344c', '#30445a', '#465a6c', '#5e7280'], -PAD, SW + PAD);
      for (i = 0; i < 60; i++) L.put(-PAD + Math.floor(R() * BW), Math.floor(R() * 30), R() < 0.4 ? '#e8f0ff' : '#7a8aaa');
      L.disc(96, 16, 30, '#c8d8f0', 0.06); L.disc(96, 16, 20, '#d8e4f4', 0.12);           // 창백한 달
      L.disc(96, 16, 12, '#e4ecf6'); L.disc(96, 16, 9, '#f2f6fa'); L.disc(92, 13, 2, '#c8d0dc'); L.disc(100, 19, 1, '#c8d0dc');
      ridge(L, R, 42, '#1a2636', '#46607a', [22, 9], [5, 3], -PAD, SW + PAD, 62, '#26364a');
      const cc = '#0c1220';                                                             // 먼 대성당
      L.rect(36, 24, 34, 22, cc); L.rect(46, 12, 14, 34, cc);
      for (let j = 0; j < 14; j++) { L.rect(53 - Math.floor(j / 2), 12 - 14 + j, 1 + Math.floor(j / 2) * 2, 1, cc); }
      for (let j = 0; j < 10; j++) { L.rect(38 - Math.floor(j / 3), 24 - 10 + j, 2 + Math.floor(j / 3) * 2, 1, cc); L.rect(66 - Math.floor(j / 3), 24 - 10 + j, 2 + Math.floor(j / 3) * 2, 1, cc); }
      L.disc(53, 22, 3, '#3a6a9a'); L.disc(53, 22, 2, '#7ad8ff'); L.put(53, 22, '#eaf8ff');   // 장미창
      [[40, 30], [44, 30], [62, 30], [66, 30], [50, 34], [56, 34]].forEach(q => L.rect(q[0], q[1], 1, 3, '#5a8ab8'));
      ridge(L, R, 50, '#101a26', '#a8c0d0', [17, 7], [3, 2], -PAD, SW + PAD, 62, '#182434');   // 눈 덮인 언덕
      for (x = -PAD; x < SW + PAD; x += 3) if (R() < 0.5) L.put(x, 48 + Math.floor(R() * 4), '#dce8f0');
    },
    sky(L, t) {
      [[20, 8, 50, 3, 0.0018], [120, 26, 60, 3, 0.0013], [80, 36, 44, 2, 0.0024]].forEach(c => {
        const x = ((c[0] + t * c[4] * 10) % (SW + 110)) - 55;
        for (let j = 0; j < c[3]; j++) L.rect(Math.round(x) - c[2] / 2 + j * 3, c[1] + j, c[2] - j * 6, 1, j === 0 ? '#3a4e66' : '#22324a', 0.7);
      });
    },
    mid(L) {
      const R = rng(42); let x;
      for (x = -PAD + 8; x < SW + PAD; x += 26 + Math.floor(R() * 14)) deadTree(L, R, x, HZ, 1.57 + (R() - 0.5) * 0.5, 13 + R() * 7, 2, '#0a0f16', 3);
      for (x = -PAD; x < SW + PAD; x += 4) {                                             // 쇠울타리 (창끝 모양)
        if (x > 96 && x < 132) continue;
        L.rect(x, HZ - 10, 1, 10, '#141c26'); L.put(x, HZ - 11, '#2a3a4c'); L.put(x, HZ - 12, '#46607a');
      }
      L.rect(-PAD, HZ - 7, 136 + PAD, 1, '#141c26'); L.rect(132, HZ - 7, SW + PAD - 132, 1, '#141c26');
      const gx = 114;                                                                   // 묘지 문 아치
      L.rect(gx - 18, HZ - 22, 4, 22, '#1a2230'); L.rect(gx + 14, HZ - 22, 4, 22, '#1a2230');
      for (let k = 0; k <= 16; k++) { const a = Math.PI * k / 16, px = gx + Math.cos(a) * 16, py = HZ - 22 - Math.sin(a) * 8; L.rect(Math.round(px) - 1, Math.round(py), 3, 2, '#1a2230'); }
      L.rect(gx - 18, HZ - 23, 4, 1, '#dce8f0'); L.rect(gx + 14, HZ - 23, 4, 1, '#dce8f0');
      for (x = -PAD + 4; x < SW + PAD; x += 9 + Math.floor(R() * 7)) if (x < 94 || x > 136) tomb(L, x, HZ, R() < 0.35 ? 1 : 0, R);
      const mx = 168, mz = new Mk(26, 24), st = mz.part(RAMPX.stone, 2), rf = mz.part(RAMPX.stone, 3);   // 납골당
      mz.rect(st, 2, 9, 22, 15); mz.poly(rf, [[0, 10], [13, 1], [26, 10]]); putMk(L, mz, mx - 13, HZ - 24);
      L.rect(mx - 3, HZ - 11, 6, 11, '#05070a'); L.rect(mx - 13, HZ - 15, 26, 1, '#dce8f0'); L.rect(mx - 7, HZ - 21, 14, 1, '#dce8f0');
      L.rect(-PAD, HZ - 2, BW, 2, '#0a121c'); L.rect(-PAD, HZ - 3, BW, 1, '#8aa0b4', 0.5);
    },
    midDyn(L, t) {                                                                       // 땅을 기는 안개
      [[0.0026, 0, 48, 0.12], [0.0018, 90, 52, 0.15]].forEach((b, k) => {
        const x = ((t * b[0] * 12 + b[1]) % (SW + 140)) - 70;
        for (let j = 0; j < 5; j++) { const hw = Math.round(50 * Math.sin(0.4 + j * 0.5)); L.rect(Math.round(x) - hw, b[2] + j, hw * 2, 1, '#b8d0e0', b[3] * (j < 1 || j > 3 ? 0.6 : 1)); }
      });
    },
    lights: t => [{ x: 168, y: HZ - 14, r: 26, c: [90, 170, 255], a: 0.4 * fl(t, 4) }, { x: 53, y: 22, r: 16, c: [90, 190, 255], a: 0.35 }],
    dyn(L, t) {
      [[22, 34, 1], [84, 40, 2], [140, 30, 3], [186, 38, 4]].forEach(w => {               // 떠도는 혼불
        const yy = w[1] + Math.sin(t * 0.002 + w[2]) * 3, xx = w[0] + Math.sin(t * 0.0013 + w[2] * 2) * 6;
        flame(L, Math.round(xx), Math.round(yy), t, 0.6, w[2], FPAL.blue);
      });
      for (let k = 0; k < 46; k++) {                                                    // 내리는 눈
        const x = ((k * 37.7 + Math.sin(t * 0.001 + k) * 6 + t * 0.004) % (SW + 10)) - 5, y = ((k * 19.3 + t * 0.012 * (0.6 + (k % 3) * 0.3)) % 58);
        L.put(x, y, k % 4 ? '#dce8f0' : '#ffffff', 0.85);
      }
    },
  };

  // ---------------------------------------------------------------- 스테이지 5: 마왕성 심연
  function spike(L, x, by, w, h, col, rim) {
    for (let j = 0; j < h; j++) { const hw = Math.max(0, Math.round(w / 2 * (j / h))); L.rect(x - hw, by - h + j, hw * 2 + 1, 1, col); L.put(x + hw, by - h + j, rim); }
  }
  STG.stage5 = {
    far(L) {
      const R = rng(51); let i, x;
      dithBands(L, 0, 58, ['#0a0204', '#1a0408', '#2e060c', '#4a0a10', '#6a1210', '#8a1e10', '#a8300e', '#c8501a'], -PAD, SW + PAD);
      L.disc(96, 22, 22, '#ff3a1a', 0.08); L.disc(96, 22, 16, '#ff5a2a', 0.16);          // 붉은 일식
      L.disc(96, 22, 13, '#ffb04a'); L.disc(96, 22, 12, '#0a0204');
      for (i = 0; i < 24; i++) L.put(-PAD + Math.floor(R() * BW), Math.floor(R() * 18), '#6a3a3a');
      ridge(L, R, 40, '#1a0608', '#7a2412', [14, 6], [7, 4], -PAD, SW + PAD, 62, '#2a0a0a');   // 들쭉날쭉한 산맥
      const cc = '#0c0306';                                                              // 마왕성 첨탑
      [[78, 18, 6], [88, 8, 8], [96, 2, 10], [104, 8, 8], [114, 18, 6]].forEach(q => {
        L.rect(q[0] - q[2] / 2, q[1] + 8, q[2], 44 - q[1], cc);
        for (let j = 0; j < 10; j++) L.rect(q[0] - Math.floor(j * q[2] / 20), q[1] - 2 + j, Math.floor(j * q[2] / 10) + 1, 1, cc);
      });
      L.rect(74, 36, 44, 16, cc);
      [[88, 24], [96, 16], [104, 24], [96, 30], [84, 40], [108, 40]].forEach(q => { L.rect(q[0], q[1], 1, 3, '#ff7a1a'); L.put(q[0], q[1], '#ffd23a'); });
      ridge(L, R, 48, '#140406', '#a8300e', [11, 5], [4, 3], -PAD, SW + PAD, 62, '#200608');
      for (x = -PAD; x < SW + PAD; x++) L.put(x, 55 + Math.round(Math.sin(x / 5)), '#ff5a1a', 0.5);   // 지평선의 용암 빛
    },
    sky(L, t) {
      [[10, 6, 60, 4, 0.0020], [110, 14, 70, 4, 0.0015], [60, 30, 50, 3, 0.0026]].forEach(c => {
        const x = ((c[0] + t * c[4] * 10) % (SW + 120)) - 60;
        for (let j = 0; j < c[3]; j++) { const hw = Math.round(c[2] / 2 * (1 - Math.abs(j - 1.5) * 0.2)); L.rect(Math.round(x) - hw, c[1] + j, hw * 2, 1, j === c[3] - 1 ? '#5a1a10' : '#1a0608', 0.8); }
      });
    },
    mid(L) {
      const R = rng(52); let x;
      for (x = -PAD; x < SW + PAD; x += 5 + Math.floor(R() * 6)) spike(L, x, HZ, 4 + Math.floor(R() * 5), 8 + Math.floor(R() * 16), '#0e0608', '#5a1a14');   // 흑요석 가시
      [[18, 14], [64, 20], [132, 12], [178, 18]].forEach(c => {                         // 매달린 사슬
        for (let y = 0; y < c[1]; y++) L.put(c[0] + (y % 2), y, y % 2 ? '#2a2228' : '#4a3a40');
        L.rect(c[0] - 1, c[1], 3, 2, '#3a3036');
      });
      [30, 100, 170].forEach(bx => {                                                    // 화로 받침
        L.rect(bx - 1, HZ - 14, 3, 14, '#1a1012'); L.rect(bx - 5, HZ - 16, 11, 3, '#2a1a1c'); L.rect(bx - 5, HZ - 16, 11, 1, '#5a3a3a');
        L.rect(bx - 4, HZ - 2, 9, 2, '#1a1012');
      });
      for (x = -PAD + 6; x < SW + PAD; x += 14 + Math.floor(R() * 10)) {                // 해골 더미
        const m = new Mk(6, 5), a = m.part(RAMPX.bone, 1); m.ell(a, 3, 2.5, 2.8, 2.4); putMk(L, m, x, HZ - 6);
        L.put(x + 2, HZ - 4, '#0a0204'); L.put(x + 4, HZ - 4, '#0a0204');
      }
      L.rect(-PAD, HZ - 2, BW, 2, '#120406');
    },
    midDyn(L, t) {                                                                      // 피어오르는 연기
      [[0.0022, 20, 34, 0.14], [0.0030, 120, 40, 0.12]].forEach(b => {
        const x = ((t * b[0] * 12 + b[1]) % (SW + 140)) - 70;
        for (let j = 0; j < 6; j++) { const hw = Math.round(40 * Math.sin(0.4 + j * 0.45)); L.rect(Math.round(x) - hw, b[2] + j, hw * 2, 1, '#3a1a18', b[3]); }
      });
      const g = 0.25 + 0.12 * Math.sin(t * 0.003);
      for (let y = HZ - 6; y < HZ; y++) L.rect(-PAD, y, BW, 1, '#ff5a1a', g * (y - HZ + 6) / 6 * 0.5);
    },
    lights: t => [30, 100, 170].map((x, i) => ({ x, y: HZ - 20, r: 36, c: [255, 120, 40], a: 0.55 * fl(t, i + 2) })),
    dyn(L, t) {
      [30, 100, 170].forEach((x, i) => { flame(L, x, HZ - 17, t, 1.1, i + 3); embers(L, t, x, HZ - 19, 5, 3, 0.55, i + 2); });
      for (let k = 0; k < 24; k++) {                                                    // 하늘로 올라가는 불티
        const age = (t * 0.01 + k * 13) % 60, x = (k * 41.3 + Math.sin(age * 0.2 + k) * 4) % SW, y = 56 - age;
        L.put(x, y, age < 30 ? '#ff8a2a' : '#8a2a10', 1 - age / 60);
      }
    },
  };

  // ---------------------------------------------------------------- 굽기 + 매 프레임 합성
  const BAKED = {}, FRAME = {};
  function bake(id) {
    const S = STG[id], far = mkL(), mid = mkL();
    S.far(far); S.mid(mid);
    const L = new Layer(SW, SH), c = document.createElement('canvas'); c.width = SW; c.height = SH;
    return (BAKED[id] = { far, mid, L, img: new ImageData(L.d, SW, SH), c, g: c.getContext('2d') });
  }
  function copyCenter(dst, src) {                  // 넓게 구운 층(BW)에서 화면 폭(SW)만큼 가져와 겹친다
    const dd = dst.d, sd = src.d;
    for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) {
      const si = (y * BW + x + PAD) * 4, a = sd[si + 3]; if (!a) continue;
      const di = (y * SW + x) * 4;
      if (a >= 255) { dd[di] = sd[si]; dd[di + 1] = sd[si + 1]; dd[di + 2] = sd[si + 2]; dd[di + 3] = 255; }
      else { const q = a / 255; dd[di] += (sd[si] - dd[di]) * q; dd[di + 1] += (sd[si + 1] - dd[di + 1]) * q; dd[di + 2] += (sd[si + 2] - dd[di + 2]) * q; dd[di + 3] = 255; }
    }
  }
  // 원경 한 장(192x84 캔버스)을 시간 t(ms)에 맞춰 만든다. 같은 프레임에 여러 번 불러도 한 번만 그린다
  function getBackdrop(id, t) {
    const B = BAKED[id] || bake(id), S = STG[id], key = Math.floor(t / 33);   // 30fps 로 갱신하면 충분
    if (FRAME[id] === key) return B.c;
    FRAME[id] = key;
    const L = B.L; L.clear();
    copyCenter(L, B.far);
    if (S.sky) S.sky(L, t);
    copyCenter(L, B.mid);
    if (S.midDyn) S.midDyn(L, t);
    lightPass(L, S.lights(t));
    S.dyn(L, t);
    B.g.putImageData(B.img, 0, 0);
    const d = L.d; B.c.topColor = `rgb(${d[0]},${d[1]},${d[2]})`;   // 하늘 위쪽 여백을 칠할 색 (맨 윗줄 왼쪽 끝)
    return B.c;
  }
  global.getBackdrop = getBackdrop;
  global.BG_HORIZON = HZ;
})(window);
