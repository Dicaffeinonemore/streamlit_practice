'use strict';
// =====================================================================
//  도트 스프라이트 — 흑월의 기사 (다크 판타지 화풍)
//  build(L, f) 에서 도트 키트(Mk)로 파트별 모양을 그리면 5단계 음영이 자동으로 입혀진다.
//  w,h = 원본 픽셀 크기 / ax = 몸 중심 x / gy = 발바닥 y / sh = 그림자 반폭
//  모두 오른쪽을 바라보는 방향으로 그려져 있고, 게임에서 좌우 반전한다.
//  흑기사와 보스는 무기와 앞팔이 없는 몸통만 그린다 (팔·무기·어깨 덮개는 motion.js 가 포즈에 맞춰 덧그림)
//  ※ motion.js 를 먼저 불러와야 한다 (Mk, RAMP 사용)
// =====================================================================
(function (global) {
  const SPRITES = {};
  const { Mk, RAMP, RAMPX, ik2 } = global.MO;
  const HORN = ['#100c0a', '#221a14', '#3a2e24', '#5a4836', '#8a7458'];   // 검게 그을린 뿔

  // ===== 주인공 : 흑월의 기사 (52x58) — 뿔 투구, 흑철 판금, 해진 핏빛 망토, 넓게 벌린 자세 =====
  // 프레임: 0~3 대기 · 4~9 걷기 · 10~11 피격 · 12 자세 · 13 베기 · 14 대시 · 15 웅크림 · 16 공중 · 18 무릎 꿇음
  // bob = 몸이 내려간 정도, lx = 몸이 앞으로 나간 정도, ff/bf = 앞/뒷발 위치, cape = 망토 흔들림, head = 머리 이동
  const HF = (function () {
    const S = 6, F = {};
    function foot(u) { u = u - Math.floor(u); if (u < 0.5) return [S - 4 * S * u, 0]; const w = (u - 0.5) * 2; return [-S + 2 * S * w, 4 * Math.sin(Math.PI * w)]; }
    [[0, 0], [0, 1], [1, 2], [1, 1]].forEach((a, i) => { F[i] = { bob: a[0], lx: 0, ff: [0, 0], bf: [0, 0], cape: a[1] * 0.8, head: [0, 0] }; });
    const wb = [1, 1, 0, 1, 1, 0];
    for (let i = 0; i < 6; i++) {
      const u = i / 6, sw = Math.sin(u * 6.283);
      F[4 + i] = { bob: wb[i], lx: 1, ff: foot(u), bf: foot(u + 0.5), cape: -1.4 + sw * 1.1, head: [0, 0] };
    }
    F[10] = { bob: 1, lx: -3, ff: [3, 1.5], bf: [-4, 0], cape: 2.5, head: [-2, -1] };
    F[11] = { bob: 3, lx: -2, ff: [1, 0], bf: [-5, 0], cape: 1.5, head: [-1, 0] };
    F[12] = { bob: 2, lx: 0, ff: [2, 0], bf: [-2, 0], cape: -1, head: [0, 0] };
    F[13] = { bob: 4, lx: 2, ff: [5, 0], bf: [-5, 0], cape: -2.5, head: [1, 1] };
    F[14] = { bob: 3, lx: 4, ff: [6, 2], bf: [-7, 1], cape: -9, head: [1, 0], stream: 1 };
    F[15] = { bob: 7, lx: -2, ff: [2, 0], bf: [-3, 0], cape: 0.5, head: [-1, 1] };
    F[16] = { bob: 0, lx: 1, ff: [1, 6], bf: [-3, 4], cape: 2, head: [0, 0] };
    F[18] = { bob: 11, lx: -3, ff: [3, 0], bf: [-8, 0], cape: 1, head: [-2, 1] };
    F[17] = F[13];
    return F;
  })();
  SPRITES.player = { w: 52, h: 58, ax: 26, gy: 56, sh: 13, build(L, f) {
    const F = HF[f] || HF[0], m = new Mk(52, 58), Y = 2;
    const bob = F.bob, lx = F.lx, hip = 36 + bob, s = F.cape;
    const cape = m.part(RAMP.crimson, 2), bpl = m.part(RAMP.bsteelD, 2), bleg = m.part(RAMP.bsteelD, 2), fleg = m.part(RAMP.bsteel, 2),
      knee = m.part(RAMP.bsteel, 3, false), loin = m.part(RAMP.crimson, 2), body = m.part(RAMP.bsteel, 2), fauld = m.part(RAMP.bsteel, 2),
      belt = m.part(RAMP.bsteelD, 1), gorg = m.part(RAMP.bsteelD, 2), hornB = m.part(HORN, 2), helm = m.part(RAMP.bsteel, 2),
      vis = m.part(RAMP.bsteel, 3), hornF = m.part(HORN, 3);
    // 해진 망토 (등 뒤로 땅까지 늘어지고 끝이 찢겨 있다)
    m.tx = lx * 0.6; m.ty = bob + Y;
    if (F.stream) m.poly(cape, [[30, 17], [22, 17], [14, 19], [7, 21], [1, 24], [4, 27], [0, 31], [6, 31], [3, 36], [10, 34], [9, 39], [16, 33], [22, 30], [28, 27]]);
    else m.poly(cape, [[30, 17], [21, 17], [16, 22], [13 + s, 30], [9 + s * 1.6, 38], [5 + s * 2.2, 45], [2 + s * 2.6, 52], [6 + s * 2.5, 50], [7 + s * 2.5, 55],
      [11 + s * 2.2, 51], [13 + s * 2, 55], [16 + s * 1.7, 50], [18 + s * 1.5, 54], [21 + s * 1.1, 48], [24 + s * 0.6, 52], [25, 44], [27, 32]]);
    // 뒤 어깨 덮개
    m.tx = lx; m.ty = bob + Y;
    m.poly(bpl, [[17, 17], [18.5, 11.5], [21, 16.5]]); m.ell(bpl, 20, 19.5, 5, 4);
    // 다리 (IK 로 무릎 위치를 구한다) + 마름모 무릎 보호대 + 뾰족한 철 장화
    m.tx = lx * 0.5; m.ty = 0;
    const leg = (part, hx, fx, fy) => {
      const g = ik2(hx, hip, fx, fy, 10.4, 10.4), kx = g.k[0], ky = g.k[1];
      m.cap(part, hx, hip, kx, ky, 3.2); m.cap(part, kx, ky, g.f[0], g.f[1], 2.6);
      m.poly(knee, [[kx + 1.2, ky - 3], [kx + 3.8, ky], [kx + 1.2, ky + 3], [kx - 1.4, ky]]);
      m.poly(part, [[g.f[0] - 3, g.f[1] - 2], [g.f[0] + 2.5, g.f[1] - 2], [g.f[0] + 6, g.f[1] + 0.6], [g.f[0] + 6, g.f[1] + 1.8], [g.f[0] - 3, g.f[1] + 1.8]]);
    };
    leg(bleg, 23, 19 + F.bf[0], 54 - F.bf[1]); leg(fleg, 29, 33 + F.ff[0], 54 - F.ff[1]);
    // 몸통: 흉갑 · 허리 판금 · 다리 사이 붉은 천
    m.tx = lx; m.ty = bob + Y;
    m.poly(loin, [[23, 34], [30, 34], [31.5 + s * 0.3, 44], [29, 41], [27.5 + s * 0.3, 46], [25.5, 41], [22.5 + s * 0.3, 44]]);
    m.poly(body, [[19, 19], [32, 19], [35, 23], [34, 29], [31, 34], [21, 34], [18, 29], [17, 23]]);
    m.poly(fauld, [[20, 32], [32, 32], [34.5, 38], [17.5, 38]]);
    m.rect(belt, 19, 31, 14, 2); m.rect(gorg, 23, 15, 8, 5);
    // 머리: 뿔 달린 투구
    m.tx = lx + F.head[0]; m.ty = bob + Y + F.head[1];
    m.poly(hornB, [[24, 8], [22, 5], [20.5, 1], [21, -1.5], [22.8, 2], [25, 5]]);
    m.ell(helm, 28, 10.5, 6, 6.5);
    m.poly(vis, [[29, 6.5], [34.5, 8.5], [35.2, 12], [34.2, 16.5], [29, 17], [27, 14]]);
    m.poly(hornF, [[31, 6.5], [33.5, 4], [35, 0.5], [35.2, -1.8], [36.2, 1.2], [35, 5], [32.5, 8]]);
    m.shadeInto(L);
    // 디테일
    const hx = lx + F.head[0], hy = bob + Y + F.head[1];
    const Ph = (x, y, c) => L.put(Math.round(x + hx), Math.round(y + hy), c);
    const Pu = (x, y, c) => L.put(Math.round(x + lx), Math.round(y + bob + Y), c);
    for (let x = 30; x <= 35; x++) Ph(x, 11, '#050507');                         // 붉게 빛나는 눈 틈
    Ph(31, 11, '#c8101e'); Ph(32, 11, '#ff3a4a'); Ph(33, 11, '#ff8a90'); Ph(34, 11, '#c8101e');
    for (let y = 5; y <= 9; y++) Ph(28, y, '#8c8e9c');                           // 투구 능선의 은빛
    Ph(33, 14, '#050507'); Ph(33, 16, '#050507'); Ph(34, 15, '#050507');          // 숨구멍
    for (let x = 20; x <= 32; x++) { Pu(x, 26, '#0a0a0d'); Pu(x, 30, '#0a0a0d'); } // 흉갑 판 이음매
    for (let y = 20; y <= 29; y++) Pu(26, y, '#2a2a32');
    Pu(21, 21, '#8c8e9c'); Pu(22, 21, '#55565f'); Pu(20, 23, '#55565f');
    for (let x = 19; x <= 34; x++) { Pu(x, 34, '#0a0a0d'); Pu(x, 36, '#0a0a0d'); } // 허리 판금 줄
    Pu(25, 31, '#8c8e9c'); Pu(26, 31, '#c8ccd8'); Pu(27, 31, '#8c8e9c');           // 은 버클
    Pu(19, 22, '#55565f'); Pu(33, 22, '#55565f');
    if (!F.stream) {                                                            // 망토 찢긴 결
      for (let k = 0; k < 3; k++) for (let y = 24; y < 50; y++) {
        const x = 18 - k * 4 + s * (y - 22) / 22 * (1 + k * 0.7) - (y - 24) * 0.15 * k;
        L.put(Math.round(x + lx * 0.6), Math.round(y + bob + Y), '#2c0810');
      }
    }
  } };
  // 흑기사 어깨 보호대 (가시 두 개, 팔 위에 덧그림) 15x13
  SPRITES.pauld = { w: 15, h: 13, build(L) {
    const m = new Mk(15, 13), sp = m.part(RAMP.bsteel, 2), b = m.part(RAMP.bsteelD, 2), a = m.part(RAMP.bsteel, 2), c = m.part(RAMP.bsteel, 3);
    m.poly(sp, [[4, 4.5], [5.5, 0], [7.5, 4.5]]); m.poly(sp, [[8, 4.5], [10.5, 0.5], [11, 5]]);
    m.ell(b, 7.5, 9, 6.6, 3.6); m.ell(a, 7.5, 6.8, 6.4, 4); m.ell(c, 7.5, 5.6, 4.6, 2.6);
    m.shadeInto(L);
    for (let x = 2; x <= 13; x++) L.put(x, 9, '#0a0a0d');
    L.put(5, 4, '#c8ccd8'); L.put(6, 4, '#8c8e9c'); L.put(4, 5, '#8c8e9c');
  } };
  global.heroEye = f => { const F = HF[f] || HF[0]; return [F.lx + F.head[0] + 32, F.bob + 2 + F.head[1] + 11]; };

  // ===== 망령 병사 (40x48): 녹슨 철모 아래 해골, 이 빠진 검과 둥근 방패 =====
  SPRITES.infantry = { w: 40, h: 48, ax: 21, gy: 47, sh: 11, build(L, f) {
    const m = new Mk(40, 48), b = f;
    const rag = m.part(RAMP.rag, 2), rim = m.part(RAMP.rust, 2), wood = m.part(RAMPX.wood, 1), bleg = m.part(RAMP.bsteelD, 1), fleg = m.part(RAMP.bsteelD, 2),
      body = m.part(RAMP.rust, 2), tab = m.part(RAMP.rag, 2), head = m.part(RAMPX.bone, 2), helm = m.part(RAMP.rust, 3), arm = m.part(RAMP.bsteelD, 2), blade = m.part(RAMP.bsteel, 3);
    m.poly(rag, [[22, 16 + b], [14, 17 + b], [11, 26 + b], [9, 38], [12, 36], [13, 42], [16, 37], [18, 41], [20, 34]]);
    m.ell(rim, 11, 27 + b, 7, 7.5); m.ell(wood, 11, 27 + b, 5.6, 6);
    m.cap(bleg, 17, 33, 15, 44, 2.6); m.cap(fleg, 23, 33, 25, 44, 2.8);
    m.poly(bleg, [[12, 43], [18, 43], [19, 47], [11, 47]]); m.poly(fleg, [[22, 43], [28, 43], [30, 47], [21, 47]]);
    m.poly(body, [[15, 17 + b], [27, 17 + b], [29, 22 + b], [28, 33 + b], [16, 33 + b], [14, 22 + b]]);
    m.poly(tab, [[18, 30 + b], [25, 30 + b], [26, 39], [23, 37], [21, 40], [18, 37]]);
    m.ell(head, 22, 11 + b, 4.6, 4.8);
    m.poly(helm, [[14, 8 + b], [30, 8 + b], [27, 5 + b], [22, 2.5 + b], [17, 5 + b]]); m.rect(helm, 16, 7 + b, 12, 2);
    m.cap(arm, 26, 20 + b, 30, 26 + b, 2.2);
    m.poly(blade, [[29.5, 25 + b], [31.5, 24 + b], [37, 7 + b], [35.5, 6.5 + b]]);
    m.shadeInto(L);
    L.put(23, 11 + b, '#ff3a2a'); L.put(25, 11 + b, '#ff3a2a'); L.put(23, 10 + b, '#7a1010');
    for (let x = 21; x <= 25; x++) L.put(x, 14 + b, x % 2 ? '#2a2218' : '#ddd3ba');
    for (let x = 28; x <= 33; x++) L.put(x, 25 + b - (x - 28) * 0.2, '#45301e');
    L.put(34, 13 + b, '#14141a'); L.put(35, 10 + b, '#14141a'); L.put(11, 27 + b, '#9a7a58'); L.put(10, 26 + b, '#c8b090');
    L.put(18, 22 + b, '#6a4a30'); L.put(24, 27 + b, '#6a4a30');
  } };

  // ===== 흑창병 (56x48): 두건을 쓴 창병, 검은 쇠 창날과 붉은 술 =====
  SPRITES.spearman = { w: 56, h: 48, ax: 21, gy: 47, sh: 11, build(L, f) {
    const m = new Mk(56, 48), b = f, sp = f ? 1 : 0;
    const cloak = m.part(RAMP.rag, 2), bleg = m.part(RAMP.leather, 1), fleg = m.part(RAMP.leather, 2), body = m.part(RAMP.leather, 2),
      vest = m.part(RAMP.bsteelD, 2), hood = m.part(RAMP.rag, 3), arm = m.part(RAMP.rag, 2);
    m.poly(cloak, [[20, 16 + b], [12, 18 + b], [9, 30 + b], [8, 40], [11, 38], [12, 44], [15, 39], [18, 43], [20, 34]]);
    m.cap(bleg, 17, 32, 15, 44, 2.5); m.cap(fleg, 23, 32, 26, 44, 2.7);
    m.poly(bleg, [[12, 43], [18, 43], [19, 47], [11, 47]]); m.poly(fleg, [[23, 43], [29, 43], [31, 47], [22, 47]]);
    m.poly(body, [[15, 17 + b], [27, 17 + b], [28, 32 + b], [15, 32 + b]]);
    m.poly(vest, [[16, 19 + b], [26, 19 + b], [26, 29 + b], [16, 29 + b]]);
    m.poly(hood, [[14, 13 + b], [17, 4 + b], [23, 2 + b], [28, 6 + b], [29, 14 + b], [25, 18 + b], [16, 18 + b]]);
    m.cap(arm, 24, 20 + b, 30, 25 + b, 2.2); m.cap(arm, 16, 21 + b, 12, 26 + b, 2);
    m.shadeInto(L);
    for (let x = 22; x <= 28; x++) for (let y = 8; y <= 13; y++) L.put(x, y + b, '#07070a');   // 두건 속 그림자
    L.put(25, 10 + b, '#ff3a2a'); L.put(27, 10 + b, '#ff3a2a');
    for (let x = 4 + sp; x <= 44 + sp; x++) { L.put(x, 25 + b, '#3a2618'); L.put(x, 26 + b, '#1e140c'); }   // 창 자루
    for (let i = 0; i < 10; i++) { const hw = Math.max(0, 3 - i * 0.3); for (let v = -hw; v <= hw; v++) L.put(44 + sp + i, 25.5 + b + v, Math.abs(v) >= hw - 0.5 ? '#c8ccd8' : '#22222a'); }
    L.put(54 + sp, 25 + b, '#ffffff');
    for (let y = 27; y <= 31; y++) { L.put(41 + sp, y + b, '#a01a24'); L.put(42 + sp, y + b, '#c8283a'); L.put(43 + sp, y + b + 1, '#6a0a14'); }
  } };

  // ===== 흑철 중기사 (44x50): 뿔 투구와 판금, 붉은 문장의 방패, 철퇴 =====
  SPRITES.knight = { w: 44, h: 50, ax: 23, gy: 49, sh: 12, build(L, f) {
    const m = new Mk(44, 50), b = f;
    const cape = m.part(RAMP.crimson, 1), mace = m.part(RAMPX.iron, 2), bleg = m.part(RAMP.bsteelD, 1), fleg = m.part(RAMP.bsteel, 2),
      body = m.part(RAMP.bsteel, 2), helm = m.part(RAMP.bsteel, 2), horn = m.part(HORN, 2), shield = m.part(RAMP.bsteelD, 2), boss = m.part(RAMP.bsteel, 3);
    m.poly(cape, [[22, 17 + b], [14, 18 + b], [10, 30 + b], [8, 44], [12, 41], [14, 46], [17, 41], [20, 45], [22, 36]]);
    m.cap(mace, 10, 30 + b, 9, 12 + b, 1.2); m.ell(mace, 9, 10 + b, 3.6, 3.6);
    m.cap(bleg, 19, 34, 17, 46, 3); m.cap(fleg, 26, 34, 28, 46, 3.2);
    m.poly(bleg, [[13, 45], [20, 45], [21, 49], [12, 49]]); m.poly(fleg, [[25, 45], [32, 45], [34, 49], [24, 49]]);
    m.poly(body, [[15, 18 + b], [30, 18 + b], [32, 24 + b], [31, 36 + b], [16, 36 + b], [13, 24 + b]]);
    m.ell(helm, 23, 11 + b, 6.4, 6.8);
    m.poly(horn, [[18, 7 + b], [15, 3 + b], [14, 0], [17, 2 + b], [20, 5 + b]]); m.poly(horn, [[27, 6 + b], [30, 2 + b], [32, 0], [31, 4 + b], [28, 8 + b]]);
    m.poly(shield, [[25, 20 + b], [38, 20 + b], [38, 30 + b], [32, 40 + b], [25, 31 + b]]);
    m.ell(boss, 31.5, 26 + b, 2.6, 2.6);
    m.shadeInto(L);
    for (let x = 22; x <= 29; x++) L.put(x, 11 + b, '#050507'); L.put(25, 11 + b, '#ff3a2a'); L.put(26, 11 + b, '#ff8a80');
    for (let y = 22; y <= 36; y++) L.put(31.5, y + b, '#86262c');                                       // 방패의 붉은 문장
    for (let x = 27; x <= 36; x++) L.put(x, 26 + b, '#86262c');
    for (let x = 16; x <= 30; x++) L.put(x, 30 + b, '#0a0a0d');
    [[6, 8], [12, 8], [9, 5], [9, 14]].forEach(q => L.put(q[0], q[1] + b, '#8c8e9c'));                  // 철퇴 가시
  } };

  // ===== 망령 궁수 (44x48): 두건, 화살통, 긴 활. 프레임 1 = 시위를 당긴 모습 =====
  SPRITES.archer = { w: 44, h: 48, ax: 20, gy: 47, sh: 11, build(L, f) {
    const m = new Mk(44, 48), draw = f === 1;
    const cloak = m.part(RAMP.ghost, 2), quiver = m.part(RAMP.leather, 2), bleg = m.part(RAMP.leather, 1), fleg = m.part(RAMP.leather, 2),
      body = m.part(RAMP.leather, 2), vest = m.part(RAMP.ghost, 3), hood = m.part(RAMP.ghost, 3), arm = m.part(RAMP.ghost, 2);
    m.poly(cloak, [[19, 15], [11, 18], [8, 30], [7, 42], [10, 40], [11, 45], [14, 40], [17, 44], [19, 34]]);
    m.poly(quiver, [[9, 12], [13, 10], [17, 26], [13, 28]]);
    m.cap(bleg, 17, 32, 14, 44, 2.4); m.cap(fleg, 22, 32, 26, 44, 2.6);
    m.poly(bleg, [[11, 43], [17, 43], [18, 47], [10, 47]]); m.poly(fleg, [[23, 43], [29, 43], [31, 47], [22, 47]]);
    m.poly(body, [[14, 17], [25, 17], [26, 32], [14, 32]]);
    m.poly(vest, [[15, 20], [24, 20], [25, 30], [15, 30]]);
    m.poly(hood, [[13, 13], [16, 4], [22, 2], [27, 6], [27, 14], [24, 18], [15, 18]]);
    if (draw) { m.cap(arm, 23, 20, 34, 23, 2); m.cap(arm, 16, 21, 24, 24, 2); }                    // 앞팔은 활을 밀고 뒷팔은 시위를 당긴다
    else { m.cap(arm, 23, 20, 30, 27, 2); m.cap(arm, 16, 21, 14, 28, 2); }
    m.shadeInto(L);
    for (let x = 20; x <= 26; x++) for (let y = 7; y <= 12; y++) L.put(x, y, '#05070a');
    L.put(23, 9, '#7ad8ff'); L.put(25, 9, '#7ad8ff');
    [[10, 9], [12, 8], [14, 9]].forEach(q => { L.put(q[0], q[1], '#c8283a'); L.put(q[0], q[1] - 1, '#e8e0d0'); });   // 화살 깃
    const bx = draw ? 35 : 31, bulge = draw ? 5 : 3;                                                 // 활
    for (let y = 6; y <= 40; y++) {
      const u = (y - 23) / 17, x = bx + bulge * (1 - u * u);
      L.put(x, y, '#3a2618'); L.put(x + 1, y, '#6a4a30');
    }
    L.put(bx, 6, '#c8ccd8'); L.put(bx, 40, '#c8ccd8');
    if (draw) {                                                                                      // 당겨진 시위와 화살
      for (let y = 6; y <= 40; y++) { const k = Math.abs(y - 23) / 17; L.put(Math.round(bx - 11 * (1 - k)), y, '#d8d0c0'); }
      for (let x = 24; x <= 41; x++) L.put(x, 23, '#5a3a24');
      L.put(42, 23, '#c8ccd8'); L.put(43, 23, '#ffffff'); L.put(42, 22, '#c8ccd8'); L.put(42, 24, '#c8ccd8');
      L.put(24, 22, '#c8283a'); L.put(25, 22, '#c8283a');
    } else for (let y = 6; y <= 40; y++) L.put(bx - 1, y, '#a8a090');
  } };

  // ===== 보스 1 : 도살자 고라스 (68x74) — 잿빛 피부의 처형인, 흑철 투구와 해진 망토 =====
  SPRITES.boss1 = { w: 68, h: 74, ax: 34, gy: 71, sh: 20, build(L, f) {
    const m = new Mk(68, 74), b = f;
    const rag = m.part(RAMP.rag, 1), barm = m.part(RAMP.ash, 1), bpl = m.part(RAMP.bsteel, 1), blg = m.part(RAMP.leather, 1), flg = m.part(RAMP.leather, 2),
      bbt = m.part(RAMP.bsteelD, 2), fbt = m.part(RAMP.bsteelD, 2), tor = m.part(RAMP.ash, 2), apr = m.part(RAMP.leather, 2),
      blt = m.part(RAMP.leather, 1), gd = m.part(RAMP.gold, 2, false), sk = m.part(RAMPX.bone, 2), nk = m.part(RAMP.ash, 1),
      hm = m.part(RAMP.bsteel, 2), jw = m.part(RAMP.bsteelD, 2), hn = m.part(RAMPX.bone, 2);
    m.poly(rag, [[16, 22 + b], [8, 26 + b], [4, 40 + b], [2, 62], [6, 58], [8, 68], [12, 60], [15, 66], [17, 54], [16, 40]]);   // 해진 망토
    m.cap(barm, 13, 31 + b, 8.5, 39 + b, 4.6); m.cap(barm, 8.5, 39 + b, 8, 48 + b, 4.2); m.ell(barm, 8, 50 + b, 3.6, 3.6);   // 뒤팔
    m.ell(bpl, 12, 24 + b, 7, 5); m.poly(bpl, [[7, 21 + b], [11, 15 + b], [13, 22 + b]]);
    m.cap(blg, 26, 50, 25, 58, 5.6); m.cap(blg, 25, 58, 24, 66, 5.2);                    // 다리
    m.cap(flg, 42, 50, 43, 58, 6); m.cap(flg, 43, 58, 44, 66, 5.6);
    m.poly(bbt, [[16, 63], [31, 63], [33, 68], [34, 71], [14, 71]]);
    m.poly(fbt, [[37, 63], [52, 63], [55, 68], [57, 71], [35, 71]]);
    m.poly(tor, [[17, 24 + b], [49, 22 + b], [56, 28 + b], [54, 40 + b], [48, 50 + b], [22, 51 + b], [15, 42 + b], [12, 30 + b]]);   // 몸통
    m.poly(apr, [[21, 42 + b], [47, 42 + b], [50, 60 + b], [34, 67 + b], [19, 60 + b]]);
    m.rect(blt, 15, 43 + b, 40, 4); m.rect(gd, 30, 43 + b, 9, 4);
    m.ell(sk, 20, 51 + b, 3.2, 3.2); m.ell(sk, 48, 51 + b, 3.2, 3.2);
    m.rect(nk, 27, 20 + b, 13, 6);
    m.ell(hm, 33, 13 + b, 9.6, 10.4);                                                   // 투구와 뿔
    m.poly(jw, [[24, 18 + b], [42, 18 + b], [40, 25 + b], [33, 27 + b], [26, 25 + b]]);
    m.poly(hn, [[24, 9 + b], [18, 5 + b], [15, 0 + b], [21, 5 + b], [26, 6 + b]]);
    m.poly(hn, [[42, 9 + b], [48, 5 + b], [51, 0 + b], [45, 5 + b], [40, 6 + b]]);
    m.shadeInto(L);
    const P = (x, y, c) => L.put(x, y + b, c);
    for (let x = 26; x <= 40; x++) P(x, 13, '#07070c');
    for (let x = 30; x <= 36; x++) P(x, 13, '#ff5a2a'); P(32, 13, '#ffd23a'); P(33, 13, '#ffd23a');
    for (let y = 19; y <= 24; y++) P(30, y, '#14141d'); P(35, 21, '#14141d'); P(35, 23, '#14141d');
    for (let y = 28; y <= 43; y++) P(34, y, '#4a3c3a');
    for (let x = 24; x <= 30; x++) P(x, 34, '#4a3c3a'); for (let x = 38; x <= 44; x++) P(x, 34, '#4a3c3a');
    for (let x = 24; x <= 30; x++) P(x, 40, '#4a3c3a'); for (let x = 38; x <= 44; x++) P(x, 40, '#4a3c3a');
    P(19, 50, '#0d0b14'); P(21, 50, '#0d0b14'); P(47, 50, '#0d0b14'); P(49, 50, '#0d0b14');
    P(32, 28, '#8a1a1a'); P(36, 31, '#8a1a1a'); P(23, 46, '#8a1a1a');                    // 핏자국
    for (let y = 50; y <= 62; y++) P(36 + (y % 3), y, '#8a1a1a'); P(26, 57, '#8a1a1a'); P(27, 57, '#8a1a1a'); P(40, 60, '#8a1a1a');
    for (let x = 17; x <= 33; x += 4) L.put(x, 64, '#7a7a8e'); for (let x = 39; x <= 53; x += 4) L.put(x, 64, '#7a7a8e');
    L.rect(4, 43 + b, 9, 3, '#34344a'); L.rect(4, 43 + b, 9, 1, '#7a7a8e');
  } };
  SPRITES.pauld1 = { w: 18, h: 14, build(L) {
    const m = new Mk(18, 14), a = m.part(RAMP.bsteel, 2), b = m.part(RAMP.bsteel, 2), sp = m.part(RAMP.bsteelD, 2);
    m.poly(sp, [[9, 0], [12, 4], [6, 4]]); m.poly(sp, [[3, 3], [6, 6], [2, 7]]); m.poly(sp, [[15, 3], [16, 7], [12, 6]]);
    m.ell(b, 9, 10, 8, 3.6); m.ell(a, 9, 7, 8, 5.2);
    m.shadeInto(L);
    L.rect(2, 7, 14, 1, '#55565f'); L.put(5, 9, '#8c8e9c'); L.put(12, 9, '#8c8e9c'); L.put(5, 4, '#c6cdf0'); L.put(6, 4, '#9aa0dc'); L.put(4, 5, '#9aa0dc');
  } };

  // ===== 보스 2 : 까마귀 마녀 모르그라 (60x74) — 깊은 보랏빛 로브와 깃털 망토 =====
  SPRITES.boss2 = { w: 60, h: 74, ax: 28, gy: 70, sh: 16, build(L, f) {
    const m = new Mk(60, 74), b = f;
    const barm = m.part(RAMP.purpleD, 1), rob = m.part(RAMP.purpleD, 2), pan = m.part(RAMP.purpleD, 3), fe = m.part(RAMP.feather, 2),
      hd = m.part(RAMP.purpleD, 2), vd = m.part(RAMP.feather, 0, false), bk = m.part(RAMPX.bone, 3), gd = m.part(RAMP.gold, 2, false);
    m.cap(barm, 15, 31 + b, 10.5, 41 + b, 3.6); m.ell(barm, 9.5, 44 + b, 2.8, 2.8);
    m.poly(rob, [[21, 28 + b], [39, 28 + b], [44, 44 + b], [52, 67 + b], [8, 67 + b], [16, 44 + b]]);
    for (let i = 0; i < 12; i++) m.rect(rob, 8 + i * 3.7, 66 + b, 3, 2 + (i % 2) * 2);
    m.poly(pan, [[26, 30 + b], [34, 30 + b], [36, 67 + b], [24, 67 + b]]);
    m.poly(fe, [[10, 21 + b], [46, 19 + b], [49, 28 + b], [8, 28 + b]]);                // 깃털 망토
    for (let k = 0; k < 8; k++) m.poly(fe, [[9 + k * 5, 27 + b], [14.5 + k * 5, 27 + b], [11.5 + k * 5, 35 + b + (k % 3) * 2]]);
    m.poly(hd, [[19, 10 + b], [24, 3 + b], [32, 1 + b], [39, 6 + b], [41, 16 + b], [40, 28 + b], [20, 28 + b], [17, 18 + b]]);   // 두건
    m.poly(hd, [[24, 3 + b], [28, 0 + b], [31, 2 + b]]);
    m.ell(vd, 31, 16 + b, 6.4, 7.4);
    m.poly(bk, [[27, 12 + b], [39, 15 + b], [47, 21 + b], [39, 19 + b], [36, 21 + b], [27, 20 + b]]);   // 부리 가면
    m.rect(gd, 19, 46 + b, 22, 2);
    m.shadeInto(L);
    const P = (x, y, c) => L.put(x, y + b, c);
    P(29, 13, '#7dff7a'); P(30, 13, '#eaffea'); P(29, 14, '#2a6a3a'); P(28, 13, '#2a6a3a');
    P(33, 16, '#14141d'); P(34, 16, '#14141d');
    for (let x = 28; x <= 42; x++) P(x, 20, '#6a6250');
    L.rect(28, 52 + b, 5, 5, '#2a6a3a'); L.rect(29, 53 + b, 3, 3, '#7dff7a'); L.put(29, 53 + b, '#eaffea');
    for (let y = 38; y <= 64; y += 9) for (let x = 26; x <= 34; x++) P(x, y, '#c9a24a');
    for (let k = 0; k < 4; k++) for (let y = 36; y < 66; y++) P(13 + k * 10 + Math.round(Math.sin(y * 0.4 + k)), y, '#2a1640');
    L.rect(3, 40 + b, 2, 2, '#7dff7a'); L.rect(6, 36 + b, 2, 2, '#7dff7a'); L.rect(2, 46 + b, 2, 2, '#2a6a3a');
  } };
  SPRITES.mant2 = { w: 16, h: 12, build(L) {
    const m = new Mk(16, 12), a = m.part(RAMP.feather, 2);
    m.ell(a, 8, 4, 7.4, 3.6);
    for (let k = 0; k < 6; k++) m.poly(a, [[1.5 + k * 2.4, 5], [4.4 + k * 2.4, 5], [3 + k * 2.4, 10 + (k % 2) * 1.5]]);
    m.shadeInto(L); L.put(5, 2, '#7a7a9e'); L.put(6, 1, '#52527a');
  } };

  // ===== 보스 3 : 황금왕 오렐리온 (68x76) — 빛이 바랜 금 갑옷의 타락한 왕 =====
  SPRITES.boss3 = { w: 68, h: 76, ax: 34, gy: 72, sh: 19, build(L, f) {
    const m = new Mk(68, 76), b = f;
    const cap = m.part(RAMP.crimson, 2), barm = m.part(RAMP.tgold, 1), bpl = m.part(RAMP.tgold, 1), blg = m.part(RAMP.tgold, 1), flg = m.part(RAMP.tgold, 2),
      bbt = m.part(RAMP.tgold, 0), fbt = m.part(RAMP.tgold, 1), tor = m.part(RAMP.tgold, 2), tas = m.part(RAMP.tgold, 2), tab = m.part(RAMP.crimson, 2),
      blt = m.part(RAMP.crimson, 2), nk = m.part(RAMP.tgold, 1), hm = m.part(RAMP.tgold, 3), vz = m.part(RAMP.tgold, 2), cr = m.part(RAMP.tgold, 3);
    m.poly(cap, [[20, 24 + b], [12, 26 + b], [6, 40 + b], [2, 56 + b], [1, 69 + b], [9, 66 + b], [13, 70 + b], [19, 65 + b], [24, 62 + b], [24, 34 + b]]);   // 붉은 망토
    m.cap(barm, 13, 32 + b, 9.5, 42 + b, 4.2); m.ell(barm, 9, 45 + b, 3.8, 3.8);
    m.ell(bpl, 12, 27 + b, 7, 5.4); m.poly(bpl, [[7, 23 + b], [11, 17 + b], [13, 24 + b]]);
    m.cap(blg, 28, 52, 27, 59, 5.6); m.cap(blg, 27, 59, 26, 67, 5.1);
    m.cap(flg, 41, 52, 42, 59, 5.8); m.cap(flg, 42, 59, 43, 67, 5.3);
    m.poly(bbt, [[20, 66], [33, 66], [35, 70], [35, 72], [19, 72]]);
    m.poly(fbt, [[36, 66], [50, 66], [53, 70], [53, 72], [35, 72]]);
    m.poly(tor, [[19, 26 + b], [48, 26 + b], [52, 34 + b], [48, 48 + b], [44, 56 + b], [24, 56 + b], [19, 48 + b], [15, 34 + b]]);
    m.poly(tas, [[20, 50 + b], [47, 50 + b], [50, 62 + b], [34, 66 + b], [17, 62 + b]]);
    m.poly(tab, [[29, 52 + b], [39, 52 + b], [40, 64 + b], [34, 68 + b], [28, 64 + b]]);
    m.rect(blt, 19, 47 + b, 29, 3); m.rect(nk, 27, 22 + b, 13, 6);
    m.ell(hm, 34, 16 + b, 9.6, 9.6);
    m.poly(vz, [[26, 17 + b], [42, 17 + b], [41, 26 + b], [34, 28 + b], [27, 26 + b]]);
    for (let k = 0; k < 5; k++) m.poly(cr, [[24 + k * 4.4, 9 + b], [28.6 + k * 4.4, 9 + b], [26.3 + k * 4.4, 3 + b + (k % 2 ? 1 : 0)]]);   // 왕관
    m.shadeInto(L);
    const P = (x, y, c) => L.put(x, y + b, c);
    for (let x = 27; x <= 42; x++) P(x, 16, '#1a0a0a'); for (let x = 29; x <= 40; x++) P(x, 16, '#ffd23a'); P(34, 16, '#ffffff'); P(35, 16, '#ffffff');
    for (let y = 17; y <= 26; y++) P(34, y, '#3e2e0c'); P(31, 22, '#3e2e0c'); P(31, 24, '#3e2e0c'); P(37, 22, '#3e2e0c'); P(37, 24, '#3e2e0c');
    P(26, 8, '#ff4a6a'); P(31, 8, '#6aa8ff'); P(36, 8, '#ff4a6a'); P(41, 8, '#6aa8ff');
    L.rect(30, 31 + b, 7, 7, '#5e0f1a'); L.rect(31, 32 + b, 5, 5, '#9a1c2c'); L.rect(32, 33 + b, 2, 2, '#ff7a8a');
    L.rect(31, 47 + b, 7, 3, '#3a6ac0'); L.rect(32, 47 + b, 4, 1, '#9acaff');
    for (let k = 0; k < 4; k++) for (let y = 28; y < 46; y++) { if (k === 0 && y > 32 && y < 40) continue; P(22 + k * 7, y, '#3e2e0c'); }
    for (let x = 22; x <= 45; x++) P(x, 44, '#3e2e0c');
    P(26, 60, '#e0c870'); P(41, 60, '#e0c870');
    [26, 31, 36, 41].forEach((cx, k) => {                                               // 왕관 불꽃
      const up = (k + f) % 2;
      L.put(cx, 0 + b + up, '#ffd23a');
      L.rect(cx - 1, 1 + b + up, 3, 1, '#ffd23a'); L.put(cx, 1 + b + up, '#ffffff');
      L.rect(cx - 1, 2 + b + up, 3, 1, '#ff7a1a'); L.put(cx, 2 + b + up, '#ffd23a');
    });
  } };
  SPRITES.pauld3 = { w: 20, h: 16, build(L) {
    const m = new Mk(20, 16), a = m.part(RAMP.tgold, 2), b = m.part(RAMP.tgold, 2), sp = m.part(RAMP.tgold, 3);
    m.poly(sp, [[10, 0], [14, 5], [6, 5]]); m.poly(sp, [[3, 4], [7, 7], [2, 9]]); m.poly(sp, [[17, 4], [18, 9], [13, 7]]);
    m.ell(b, 10, 12, 9, 3.8); m.ell(a, 10, 8.5, 9, 6);
    m.shadeInto(L);
    L.rect(2, 9, 16, 1, '#d0b050'); L.rect(8, 10, 4, 3, '#9a1c2c'); L.put(9, 11, '#ff7a8a'); L.put(5, 5, '#e0c870'); L.put(6, 5, '#d0b050'); L.put(4, 6, '#d0b050');
  } };

  // ===== 보스 4 : 망령 기사단장 바르굴 (68x76) — 녹슨 판금의 해골 기사, 푸른 혼불 눈, 부러진 뿔 =====
  SPRITES.boss4 = { w: 68, h: 76, ax: 34, gy: 72, sh: 19, build(L, f) {
    const m = new Mk(68, 76), b = f;
    const cape = m.part(RAMP.ghost, 2), barm = m.part(RAMP.rust, 1), bpl = m.part(RAMP.rust, 1), blg = m.part(RAMP.bsteelD, 1), flg = m.part(RAMP.bsteelD, 2),
      bbt = m.part(RAMP.rust, 0), fbt = m.part(RAMP.rust, 1), tor = m.part(RAMP.rust, 2), tas = m.part(RAMP.rust, 2), tab = m.part(RAMP.ghost, 2),
      blt = m.part(RAMP.rag, 2), nk = m.part(RAMPX.bone, 1), hm = m.part(RAMP.bsteel, 2), skull = m.part(RAMPX.bone, 2), horn = m.part(RAMPX.bone, 3);
    m.poly(cape, [[22, 22 + b], [12, 24 + b], [6, 36 + b], [2, 50 + b], [0, 66], [5, 62], [7, 72], [11, 64], [15, 70], [18, 60], [22, 66], [24, 52], [24, 34]]);
    m.cap(barm, 14, 31 + b, 10, 41 + b, 4.2); m.ell(barm, 9.5, 44 + b, 3.8, 3.8);
    m.ell(bpl, 13, 26 + b, 7, 5.4); m.poly(bpl, [[8, 22 + b], [11, 15 + b], [14, 23 + b]]);
    m.cap(blg, 28, 52, 27, 59, 5.4); m.cap(blg, 27, 59, 26, 67, 4.8);
    m.cap(flg, 41, 52, 42, 59, 5.6); m.cap(flg, 42, 59, 43, 67, 5);
    m.poly(bbt, [[19, 66], [33, 66], [35, 70], [35, 72], [18, 72]]);
    m.poly(fbt, [[36, 66], [50, 66], [54, 70], [54, 72], [35, 72]]);
    m.poly(tor, [[19, 25 + b], [48, 25 + b], [52, 33 + b], [48, 47 + b], [44, 55 + b], [24, 55 + b], [19, 47 + b], [15, 33 + b]]);
    m.poly(tas, [[20, 49 + b], [47, 49 + b], [50, 61 + b], [34, 65 + b], [17, 61 + b]]);
    m.poly(tab, [[29, 51 + b], [39, 51 + b], [41, 64 + b], [37, 61 + b], [34, 67 + b], [31, 61 + b], [27, 64 + b]]);
    m.rect(blt, 19, 46 + b, 29, 3); m.rect(nk, 28, 21 + b, 11, 6);
    m.ell(hm, 34, 15 + b, 9.4, 9.4);
    m.poly(skull, [[28, 13 + b], [41, 13 + b], [40, 24 + b], [34, 26 + b], [29, 24 + b]]);
    m.poly(horn, [[28, 9 + b], [23, 5 + b], [20, 0], [24, 2 + b], [30, 6 + b]]);          // 왼쪽 큰 뿔
    m.poly(horn, [[40, 8 + b], [44, 5 + b], [46, 7 + b], [42, 11 + b]]);                     // 부러진 오른쪽 뿔
    m.shadeInto(L);
    const P = (x, y, c) => L.put(x, y + b, c);
    for (const ex of [31, 37]) {                                                          // 푸른 혼불 눈
      P(ex - 1, 17, '#05070a'); P(ex, 17, '#05070a'); P(ex + 1, 17, '#05070a'); P(ex, 16, '#05070a');
      P(ex, 17, '#7ad8ff'); P(ex, 16 - f, '#eaf8ff'); P(ex, 15 - f, '#7ad8ff');
    }
    for (let x = 30; x <= 38; x++) P(x, 22, x % 2 ? '#3a3228' : '#ddd3ba');               // 이빨
    for (let k = 0; k < 4; k++) for (let x = 25 + k; x <= 42 - k; x++) P(x, 30 + k * 4, '#c8c0b0');   // 갈비뼈 모양 흉갑
    for (let y = 29; y <= 45; y++) P(34, y, '#2a1a10');
    [[22, 36], [45, 40], [26, 58], [44, 57], [31, 27]].forEach(q => P(q[0], q[1], '#9a7a58'));   // 녹 얼룩
    for (let k = 0; k < 5; k++) L.put(3 + k * 4, 70 - ((k + f) % 2) * 2, '#56708a');          // 망토 끝에서 흩어지는 혼불
  } };
  SPRITES.pauld4 = { w: 20, h: 16, build(L) {
    const m = new Mk(20, 16), a = m.part(RAMP.rust, 2), b = m.part(RAMP.rust, 2), sp = m.part(RAMPX.bone, 3), sk = m.part(RAMPX.bone, 2);
    m.poly(sp, [[10, 0], [13, 5], [7, 5]]); m.poly(sp, [[3, 3], [7, 7], [2, 9]]); m.poly(sp, [[17, 3], [18, 9], [13, 7]]);
    m.ell(b, 10, 12, 9, 3.8); m.ell(a, 10, 8.5, 9, 6); m.ell(sk, 10, 9, 3.2, 3);
    m.shadeInto(L);
    L.put(9, 9, '#05070a'); L.put(11, 9, '#05070a'); L.put(9, 9, '#7ad8ff'); L.rect(2, 12, 16, 1, '#2a1a10');
  } };

  // ===== 보스 5 : 마왕 모르데카이 (84x88) — 용암이 흐르는 흑요석 갑옷, 거대한 뿔, 불타는 눈 =====
  SPRITES.boss5 = { w: 84, h: 88, ax: 42, gy: 86, sh: 24, build(L, f) {
    const m = new Mk(84, 88), b = f;
    const cape = m.part(RAMP.crimson, 1), barm = m.part(RAMP.obsid, 1), bpl = m.part(RAMP.obsid, 1), blg = m.part(RAMP.obsid, 1), flg = m.part(RAMP.obsid, 2),
      bbt = m.part(RAMP.obsid, 0), fbt = m.part(RAMP.obsid, 1), tor = m.part(RAMP.obsid, 2), tas = m.part(RAMP.obsid, 2), tab = m.part(RAMP.crimson, 2),
      blt = m.part(RAMP.rag, 1), nk = m.part(RAMP.obsid, 1), hornB = m.part(HORN, 2), hm = m.part(RAMP.obsid, 2), face = m.part(RAMP.obsid, 3), hornF = m.part(HORN, 3);
    m.poly(cape, [[26, 28 + b], [14, 30 + b], [7, 46 + b], [3, 64 + b], [1, 84], [7, 80], [9, 87], [14, 80], [19, 86], [22, 76], [27, 82], [29, 64], [30, 40]]);
    m.cap(barm, 17, 38 + b, 12, 51 + b, 5.2); m.ell(barm, 11, 55 + b, 4.6, 4.6);
    m.ell(bpl, 16, 32 + b, 8.4, 6.4); m.poly(bpl, [[10, 28 + b], [12, 18 + b], [16, 28 + b]]); m.poly(bpl, [[17, 27 + b], [21, 19 + b], [22, 29 + b]]);
    m.cap(blg, 34, 64, 33, 73, 6.6); m.cap(blg, 33, 73, 32, 81, 6);
    m.cap(flg, 50, 64, 51, 73, 7); m.cap(flg, 51, 73, 52, 81, 6.4);
    m.poly(bbt, [[23, 80], [40, 80], [42, 85], [42, 87], [22, 87]]);
    m.poly(fbt, [[44, 80], [60, 80], [65, 85], [65, 87], [43, 87]]);
    m.poly(tor, [[23, 30 + b], [58, 30 + b], [63, 40 + b], [58, 57 + b], [53, 66 + b], [29, 66 + b], [23, 57 + b], [18, 40 + b]]);
    m.poly(tas, [[24, 59 + b], [57, 59 + b], [61, 73 + b], [41, 78 + b], [21, 73 + b]]);
    m.poly(tab, [[35, 62 + b], [47, 62 + b], [49, 77 + b], [44, 74 + b], [41, 81 + b], [38, 74 + b], [33, 77 + b]]);
    m.rect(blt, 23, 56 + b, 35, 4); m.rect(nk, 33, 25 + b, 15, 7);
    m.poly(hornB, [[35, 12 + b], [29, 8 + b], [24, 3 + b], [23, 0], [28, 2 + b], [33, 6 + b], [38, 9 + b]]);
    m.ell(hm, 41, 18 + b, 11, 11);
    m.poly(face, [[33, 17 + b], [50, 17 + b], [49, 29 + b], [41, 32 + b], [34, 29 + b]]);
    m.poly(hornF, [[46, 10 + b], [52, 6 + b], [57, 1 + b], [58, 0], [57, 5 + b], [53, 10 + b], [48, 13 + b]]);
    for (let k = 0; k < 3; k++) m.poly(face, [[36 + k * 4, 9 + b], [39 + k * 4, 9 + b], [37.5 + k * 4, 3 + b + (k === 1 ? -2 : 0)]]);   // 가시 왕관
    m.shadeInto(L);
    const P = (x, y, c) => L.put(x, y + b, c);
    for (let x = 35; x <= 48; x++) P(x, 21, '#08060a');                                    // 불타는 눈
    for (let x = 37; x <= 46; x++) P(x, 21, x === 41 || x === 42 ? '#fff0a0' : '#ff7a1a');
    P(41, 20, '#ffd23a'); P(42, 20, '#ffd23a');
    const lava = [[26, 36, 32, 44], [52, 34, 58, 42], [30, 50, 36, 58], [48, 48, 54, 55], [34, 66, 31, 74], [50, 66, 53, 74]];   // 갑옷 틈의 용암
    lava.forEach(q => { for (let k = 0; k <= 8; k++) { const x = q[0] + (q[2] - q[0]) * k / 8, y = q[1] + (q[3] - q[1]) * k / 8; L.put(x, y + b, k % 3 ? '#ff5a1a' : '#ffb02a'); } });
    L.disc(41, 44 + b, 4, '#4a0808'); L.disc(41, 44 + b, 3, '#ff5a1a'); L.disc(41, 44 + b, 1, '#fff0a0');   // 가슴의 불씨
    for (let x = 24; x <= 57; x++) P(x, 62, '#08060a');
    for (let k = 0; k < 6; k++) L.put(4 + k * 4, 84 - ((k + f) % 2) * 3, k % 2 ? '#ff5a1a' : '#86262c');   // 망토 끝 불티
  } };
  SPRITES.pauld5 = { w: 24, h: 18, build(L) {
    const m = new Mk(24, 18), a = m.part(RAMP.obsid, 2), b = m.part(RAMP.obsid, 2), sp = m.part(HORN, 3);
    m.poly(sp, [[12, 0], [15, 6], [9, 6]]); m.poly(sp, [[4, 3], [9, 8], [2, 10]]); m.poly(sp, [[20, 3], [22, 10], [15, 8]]);
    m.ell(b, 12, 13.5, 11, 4.2); m.ell(a, 12, 9.5, 11, 7);
    m.shadeInto(L);
    for (let x = 2; x <= 21; x++) L.put(x, 13, x % 3 ? '#ff5a1a' : '#ffb02a');
  } };

  // ===== 까마귀 (마녀의 소환수) =====
  SPRITES.raven = { w: 12, h: 8, ax: 6, gy: 7, sh: 3, fn(r, f) {
    const BK = '#1a1a24', B2 = '#34344a';
    r(3, 3, 6, 3, BK); r(8, 2, 3, 2, BK); r(11, 3, 1, 1, '#d8d0b8'); r(9, 2, 1, 1, '#ff5a2a'); r(0, 4, 3, 1, B2);
    if (f) { r(2, 0, 4, 3, BK); r(1, 1, 2, 2, B2); } else { r(2, 6, 4, 2, BK); r(1, 6, 2, 2, B2); }
  } };

  global.SPRITES = SPRITES;
  global.HERO_FRAMES = HF;
})(window);
