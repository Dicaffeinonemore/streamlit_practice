'use strict';
// =====================================================================
//  중세 도트 배경 3종 (192x84 원본 도트 -> 5배 확대, 좌우로 이어 붙여 스크롤)
//   stage1: 붉은 평원 / stage2: 진흙의 야영지 / stage3: 불타는 성채
// =====================================================================
(function (global) {
  const rng = seed => { let s = seed; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };
  const bands = (r, W, y0, y1, cols) => {
    const n = cols.length, h = (y1 - y0) / n;
    for (let i = 0; i < n; i++) r(0, Math.floor(y0 + i * h), W, Math.ceil(h) + 1, cols[i]);
  };
  const DEFS = {};

  DEFS.stage1 = function (r, ci) {
    const W = 192, rnd = rng(11); let i, x, y;
    bands(r, W, 0, 56, ['#2e2450', '#4a2f66', '#7a3a6e', '#b0516a', '#d8703a', '#eea04a', '#f6c870']);
    ci(138, 44, 15, '#f6b25a'); ci(138, 44, 11, '#ffd88a'); ci(138, 44, 7, '#fff0c0');
    for (i = 0; i < 5; i++) r(Math.floor(rnd() * 150), 8 + Math.floor(rnd() * 22), 22 + Math.floor(rnd() * 24), 2, '#7a4a7e');
    for (i = 0; i < 4; i++) r(Math.floor(rnd() * 180), 10 + Math.floor(rnd() * 20), 12, 1, '#c8688a');
    for (x = 0; x < W; x++) { y = 46 + Math.round(4 * Math.sin(x / 17) + 3 * Math.sin(x / 7)); r(x, y, 1, 60 - y, '#6a3a5a'); }
    r(14, 32, 8, 20, '#3a2848'); r(36, 28, 9, 24, '#3a2848'); r(22, 38, 14, 14, '#3a2848');
    for (i = 0; i < 3; i++) { r(14 + i * 3, 30, 2, 2, '#3a2848'); r(36 + i * 3, 26, 2, 2, '#3a2848'); }
    r(17, 38, 2, 4, '#e8a04a'); r(40, 34, 2, 4, '#e8a04a'); r(27, 44, 4, 8, '#1e1230');
    r(40, 22, 1, 6, '#2a1e30'); r(41, 22, 5, 3, '#b3202a');
    for (x = 70; x < 190; x += 3) { const hh = 4 + Math.floor(rnd() * 3); r(x, 56 - hh, 2, hh, '#2e1e38'); if (rnd() > .5) r(x + 1, 56 - hh - 6, 1, 7, '#2e1e38'); }
    for (i = 0; i < 3; i++) { const sx = 80 + i * 40; r(sx, 30, 3, 26, '#5a3a58'); r(sx - 2, 24, 7, 8, '#6a4668'); r(sx - 4, 18, 9, 7, '#7a5278'); }
    r(0, 56, W, 28, '#6a5a2a'); r(0, 56, W, 2, '#8a7a3a');
    r(0, 66, W, 18, '#8a6a3a'); r(0, 66, W, 1, '#a8864a'); r(0, 76, W, 8, '#7a5a30');
    for (i = 0; i < 90; i++) { x = Math.floor(rnd() * W); y = 58 + Math.floor(rnd() * 24); r(x, y, 1, 2, y < 66 ? '#8aa040' : '#6a4a28'); }
    for (i = 0; i < 40; i++) { x = Math.floor(rnd() * W); y = 68 + Math.floor(rnd() * 14); r(x, y, 3, 1, '#a8864a'); }
    const ax = [30, 58, 98, 120, 160];
    for (i = 0; i < ax.length; i++) { r(ax[i], 58 + (i % 2) * 3, 1, 6, '#5a3a1a'); r(ax[i] - 1, 57 + (i % 2) * 3, 3, 1, '#e8e4d8'); }
    const bx = [66, 150];
    for (i = 0; i < bx.length; i++) { r(bx[i], 40, 1, 24, '#5a3a1a'); r(bx[i] + 1, 41, 11, 7, '#a02a2a'); r(bx[i] + 1, 41, 11, 1, '#d8483a'); r(bx[i] + 10, 47, 3, 2, '#a02a2a'); r(bx[i] + 5, 43, 3, 3, '#e8c86a'); }
    ci(100, 79, 4, '#6a4a2a'); ci(100, 79, 1, '#aab4c4'); r(8, 78, 20, 1, '#5a3a1a'); r(26, 77, 3, 3, '#aab4c4');
  };

  DEFS.stage2 = function (r, ci) {
    const W = 192, rnd = rng(23); let i, x, y;
    bands(r, W, 0, 54, ['#2e3a40', '#3a484e', '#475a5e', '#566a6a', '#667a76', '#7a8a82']);
    for (i = 0; i < 6; i++) r(Math.floor(rnd() * 160), 4 + Math.floor(rnd() * 30), 24 + Math.floor(rnd() * 26), 3, '#28343a');
    for (x = 0; x < W; x++) { y = 44 + Math.round(3 * Math.sin(x / 23) + 2 * Math.sin(x / 9)); r(x, y, 1, 56 - y, '#4a5a56'); }
    for (x = 0; x < W; x += 4) { r(x, 42, 2, 12, '#3a2a1a'); r(x, 40, 2, 2, '#4a3a24'); r(x + 1, 39, 1, 1, '#4a3a24'); }
    r(0, 48, W, 2, '#2a1e12');
    r(126, 12, 30, 44, '#4a3420'); r(126, 12, 30, 3, '#6a4a2c'); r(128, 18, 26, 1, '#2a1e12'); r(128, 30, 26, 1, '#2a1e12'); r(128, 42, 26, 1, '#2a1e12');
    r(132, 20, 4, 8, '#1a120a'); r(144, 20, 4, 8, '#1a120a'); r(132, 32, 4, 8, '#1a120a'); r(144, 32, 4, 8, '#1a120a');
    for (i = 0; i < 6; i++) r(126, 14 + i * 7, 30, 1, '#3a2814');
    r(124, 8, 34, 4, '#5a4028'); for (i = 0; i < 6; i++) r(124 + i * 6, 5, 3, 3, '#5a4028');
    r(138, 0, 1, 8, '#2a1e12'); r(139, 1, 8, 5, '#6a2a2a');
    ci(132, 56, 5, '#2a1e12'); ci(132, 56, 2, '#6a4a2c'); ci(150, 56, 5, '#2a1e12'); ci(150, 56, 2, '#6a4a2c');
    r(24, 44, 22, 3, '#4a3420'); r(28, 38, 3, 8, '#5a4028'); r(40, 38, 3, 8, '#5a4028'); r(30, 36, 12, 2, '#6a4a2c');
    r(18, 24, 3, 14, '#6a4a2c'); r(18, 24, 14, 2, '#6a4a2c'); r(20, 38, 20, 2, '#6a4a2c'); r(14, 22, 7, 5, '#3a2a1a'); ci(36, 48, 3, '#2a1e12');
    const tent = (cx, base, hgt, col, colD) => {
      for (let t = 0; t < hgt; t++) { const hw = Math.floor((t + 1) * (hgt > 14 ? 1.2 : 1.1)); r(cx - hw, base - hgt + t, hw * 2, 1, col); r(cx, base - hgt + t, hw, 1, colD); }
      r(cx - 1, base - 6, 3, 6, '#1a120a');
    };
    tent(78, 58, 16, '#8a3a3a', '#6a2a2a'); tent(100, 56, 12, '#8a8a74', '#6a6a58'); tent(64, 56, 11, '#6a6a58', '#52523f');
    r(78, 38, 1, 4, '#3a2a1a');
    r(0, 58, W, 26, '#4a3e2c'); r(0, 58, W, 2, '#5a4e3a'); r(0, 68, W, 16, '#5a4a34'); r(0, 78, W, 6, '#4a3c2a');
    for (i = 0; i < 14; i++) { x = Math.floor(rnd() * 170); y = 62 + Math.floor(rnd() * 18); r(x, y, 10 + Math.floor(rnd() * 12), 2, '#6a7c84'); r(x + 2, y, 5, 1, '#8ea0a8'); }
    for (i = 0; i < 60; i++) { x = Math.floor(rnd() * W); y = 60 + Math.floor(rnd() * 22); r(x, y, 2, 1, '#3a2e1e'); }
    for (x = 0; x < W; x += 2) { r(x, 72 + Math.round(Math.sin(x / 10)), 2, 1, '#3a2e1e'); }
    r(168, 70, 8, 2, '#2a1e12'); r(169, 66, 6, 4, '#ff7a1a'); r(170, 63, 4, 4, '#ffd23a'); r(171, 61, 2, 3, '#fff0c0');
    r(176, 40, 2, 20, '#5a5a52'); r(174, 32, 6, 9, '#6a6a62');
    for (i = 0; i < 90; i++) { x = Math.floor(rnd() * W); y = Math.floor(rnd() * 80); r(x, y, 1, 3, '#a8bcc4'); r(x - 1, y + 3, 1, 1, '#8aa0a8'); }
    r(10, 66, 8, 8, '#6a4a2a'); r(10, 68, 8, 1, '#3a2814'); r(10, 71, 8, 1, '#3a2814'); r(14, 60, 7, 7, '#5a4028'); r(14, 62, 7, 1, '#3a2814');
  };

  DEFS.stage3 = function (r, ci) {
    const W = 192, rnd = rng(37); let i, x, y;
    bands(r, W, 0, 58, ['#12081a', '#1e0c26', '#2e1030', '#4a1634', '#6e1c34', '#9a2a30', '#c4481e']);
    for (i = 0; i < 50; i++) r(Math.floor(rnd() * W), Math.floor(rnd() * 24), 1, 1, '#e8d8e8');
    ci(34, 20, 11, '#d8c4b0'); ci(34, 20, 9, '#efe0cc'); ci(30, 17, 2, '#cdb89e'); ci(38, 24, 2, '#cdb89e');
    for (i = 0; i < 4; i++) { const sx = 60 + i * 34; r(sx, 20, 8, 38, '#3a1830'); r(sx - 3, 14, 14, 10, '#4a2038'); r(sx - 5, 8, 16, 8, '#5a2840'); }
    r(0, 28, W, 30, '#2a2430'); r(0, 28, W, 2, '#44384c');
    for (x = 0; x < W; x += 8) { r(x, 24, 5, 4, '#2a2430'); r(x, 24, 5, 1, '#44384c'); }
    for (i = 0; i < 40; i++) r(Math.floor(rnd() * W), 32 + Math.floor(rnd() * 24), 3, 1, '#1e1824');
    const tower = tx => {
      r(tx, 8, 22, 50, '#322a3a'); r(tx, 8, 22, 2, '#4c4056'); r(tx - 2, 4, 26, 5, '#3a3042'); for (let k = 0; k < 5; k++) r(tx - 2 + k * 6, 0, 4, 4, '#3a3042');
      r(tx + 4, 18, 3, 7, '#ffb040'); r(tx + 14, 18, 3, 7, '#ffb040'); r(tx + 9, 32, 3, 7, '#ff8a2a'); r(tx + 5, 19, 1, 4, '#fff0c0'); r(tx + 15, 19, 1, 4, '#fff0c0');
    };
    tower(8); tower(162);
    const fl = [[12, 0], [20, 2], [166, 1], [176, 0]];
    for (i = 0; i < fl.length; i++) { r(fl[i][0], 0, 3, 4, '#ff7a1a'); r(fl[i][0] + 1, 0, 1, 2, '#ffd23a'); }
    r(78, 30, 36, 28, '#1a1420'); r(82, 34, 28, 24, '#0e0a14'); r(86, 30, 20, 4, '#1a1420');
    r(80, 32, 32, 1, '#44384c'); for (i = 0; i < 7; i++) r(84 + i * 4, 36, 1, 22, '#3a3040'); r(84, 44, 24, 1, '#3a3040'); r(84, 52, 24, 1, '#3a3040');
    r(76, 26, 40, 4, '#3a3042');
    const bn = [60, 126];
    for (i = 0; i < bn.length; i++) { r(bn[i], 24, 8, 22, '#8a1a2a'); r(bn[i], 24, 8, 1, '#c4283a'); r(bn[i] + 3, 30, 2, 5, '#e8c86a'); r(bn[i] + 2, 32, 4, 1, '#e8c86a'); r(bn[i] + 2, 46, 4, 2, '#8a1a2a'); r(bn[i] + 1, 48, 2, 2, '#8a1a2a'); }
    r(0, 58, W, 26, '#3a3440'); r(0, 58, W, 2, '#54485e');
    for (y = 60; y < 84; y += 6) r(0, y, W, 1, '#2a2430');
    for (y = 60; y < 84; y += 6) for (x = (y / 6 % 2) * 8; x < W; x += 16) r(x, y, 1, 6, '#2a2430');
    for (i = 0; i < 30; i++) r(Math.floor(rnd() * W), 60 + Math.floor(rnd() * 22), 2, 1, '#4a4054');
    r(66, 62, 60, 22, '#7a1a2a'); r(66, 62, 60, 1, '#c9a24a'); r(66, 83, 60, 1, '#c9a24a'); r(66, 62, 1, 22, '#c9a24a'); r(125, 62, 1, 22, '#c9a24a');
    r(70, 66, 52, 14, '#8a2234'); for (x = 74; x < 120; x += 8) r(x, 70, 4, 4, '#c9a24a');
    const tx = [34, 54, 138, 158];
    for (i = 0; i < tx.length; i++) { r(tx[i], 48, 2, 14, '#3a2a1a'); r(tx[i] - 1, 44, 4, 5, '#ff7a1a'); r(tx[i], 41, 2, 4, '#ffd23a'); r(tx[i], 40, 1, 2, '#fff0c0'); }
    r(20, 74, 10, 3, '#4a4054'); r(24, 72, 5, 2, '#54485e'); r(160, 76, 12, 3, '#4a4054'); r(164, 74, 6, 2, '#54485e');
    r(172, 70, 1, 12, '#5a3a1a'); r(173, 70, 8, 5, '#6a1a2a');
    for (i = 0; i < 40; i++) { x = Math.floor(rnd() * W); y = Math.floor(rnd() * 80); r(x, y, 1, 1, rnd() > .5 ? '#ff7a1a' : '#ffd23a'); }
  };

  // 192x84 캔버스에 한 번만 그려 캐시
  const cache = {};
  function getBackground(id) {
    if (cache[id]) return cache[id];
    const c = document.createElement('canvas'); c.width = 192; c.height = 84;
    const x = c.getContext('2d');
    const r = (a, b, w, h, col) => { x.fillStyle = col; x.fillRect(a, b, w, h); };
    const ci = (cx, cy, rad, col) => {
      x.fillStyle = col;
      for (let j = -rad; j <= rad; j++) { const hw = Math.floor(Math.sqrt(rad * rad - j * j) + 0.5); x.fillRect(cx - hw, cy + j, hw * 2 + 1, 1); }
    };
    DEFS[id](r, ci);
    return (cache[id] = c);
  }
  global.getBackground = getBackground;
})(window);
