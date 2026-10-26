'use strict';
// =====================================================================================
// 흑월의 기사 — 전투 프레임 데이터 (바렐 · 일반 적)
// 게임 코드는 이 숫자를 읽기만 한다. 밸런스 조정은 이 파일에서만 한다.
//
// 단위: …Ms = 밀리초(게임은 60fps, 1틱 = 16.7ms) / …Ticks = 60fps 틱 / …Px = 월드 픽셀
// 측정·검증: FRAME_DATA_SUITE=1 node tests/regression.cjs  →  node tools/report_frame_data.cjs
//           (PowerShell: $env:FRAME_DATA_SUITE='1'; node tests/regression.cjs)
// 결과 표: docs/barel-frame-data.md
//
// 주의: 바렐 3연타·공중 베기·대시는 Aseprite 스프라이트(sprite 항목)의 장별 길이와 맞물려 있다.
//       windMs/actMs/recMs 를 바꾸면 Aseprite 의 프레임 길이도 같이 바꿔야 하며,
//       테스트가 두 값이 어긋나면 알려 준다.
// 보스(고라스~소버린)와 비에사는 각자의 *-data.js / *-runtime.js 를 따른다.
// =====================================================================================
const COMBAT_FRAME_DATA = {
  version: 2,

  // 입력: 버튼을 미리 눌러 둔 것을 기억하는 시간, 한 타가 끝난 뒤 다음 타로 이어 줄 시간 (비에사도 같이 씀)
  input: { bufferMs: 220, linkMs: 420 },

  barel: {
    // ------------------------------------------------------------- 지상 3연타
    // 판정: 휘두름의 activeStartRatio 지점부터 휘두름 끝 + activeTailMs 까지
    // 캔슬: 선입력이 있으면 회수의 cancelRatio 지점에서 다음 타 시작
    combo: {
      activeStartRatio: 0.35,
      activeTailMs: 30,
      cancelRatio: 0.45,
      moves: {
        c1: { name: '일섬',   windMs: 90,  actMs: 110, recMs: 150, damage: 10, reachPx: 80, knockdown: false, stepPx: 8,  hitstopTicks: 3, fx: 0,
              hitstunTicks: 22,   // 1타 → 2타 실측 16틱 + 여유 6
              sprite: 'assets/aseprite/barel-combo0-dot-10/barel-combo0-dot-10.animation.json' },
        c2: { name: '역일섬', windMs: 70,  actMs: 100, recMs: 140, damage: 11, reachPx: 82, knockdown: false, stepPx: 8,  hitstopTicks: 3, fx: 1,
              hitstunTicks: 28,   // 2타 → 3타 실측 22틱 + 여유 6 (18틱이면 3타 전에 풀림)
              sprite: 'assets/aseprite/barel-combo1-dot-10/barel-combo1-dot-10.animation.json' },
        c3: { name: '참격',   windMs: 200, actMs: 140, recMs: 340, damage: 16, reachPx: 98, knockdown: true,  stepPx: 16, hitstopTicks: 7, fx: 2,
              hitstunTicks: null, // 넉다운: 적은 'down' 상태가 된다
              waveRatio: 0.6,     // 휘두름의 60% 지점에서 푸른 검기 발사
              smashRatio: 0.85,   // 85% 지점에서 대검이 땅에 박힘
              sprite: 'assets/aseprite/barel-combo2-dot-10/barel-combo2-dot-10.animation.json' },
      },
    },

    // ------------------------------------------------------------- 공중 베기 (착지할 때까지 판정 유지)
    air: { name: '공중 베기', damage: 14, reachPx: 64, knockdown: true, hitstopTicks: 5, fx: 2, forwardPxPerTick: 2.6, hitstunTicks: null,
           sprite: 'assets/aseprite/barel-air-attack-10/barel-air-attack-10.animation.json' },

    // ------------------------------------------------------------- 대시
    dash: { distPx: 80, durMs: 190, moveMs: 150, attackCancelMs: 110, invulnerableTicks: 15, cooldownTicks: 31,
            sprite: 'assets/aseprite/barel-dash-10/barel-dash-10.animation.json' },

    // ------------------------------------------------------------- 스킬 (각자 쿨타임)
    // behindPx: 등 뒤로 닿는 거리. 스킬 판정 깊이는 38px, 높이 85px 로 공통이다.
    skillEndInvulnerableTicks: 10,      // 스킬이 끝난 뒤 잠깐 무적
    skills: {
      thrust:  { name: '돌진 베기', key: 'U', cooldownMs: 4600, durMs: 700,
                 travelMs: [180, 360], invulnerableWhileTravel: true, strikeFromMs: 240,
                 damage: 28, reachPx: 68, behindPx: 8, knockdown: false, fx: 1 },
      slam:    { name: '내려찍기', key: 'H', cooldownMs: 6000, durMs: 820,
                 strikeMs: 330, damage: 24, reachPx: 130, behindPx: 10, knockdown: true, fx: 2 },
      whirl:   { name: '회전 베기', key: 'O', cooldownMs: 7000, durMs: 760,
                 invulnerableMs: [100, 540], strikeMs: [200, 330, 460],
                 damage: 16, reachPx: 110, behindPx: 110, knockdown: false, fx: 1 },
      leap:    { name: '점프 강하', key: 'P', cooldownMs: 8000, durMs: 960,
                 travelMs: [120, 560], heightPx: 88, strikeMs: 560,
                 damage: 26, reachPx: 76, behindPx: 38, knockdown: true, fx: 2 },
      redwave: { name: '붉은 파동', key: 'L', cooldownMs: 6500, durMs: 720,
                 fireMs: 300, damage: 24 },
    },
  },

  // ------------------------------------------------------------- 일반 적
  // windTicks = 공격 예고, activeTicks = 판정 유지, recoveryTicks = 공격 후 경직 (반격 시간)
  // hurtTicks = 표에 없는 공격에 맞았을 때의 피격 경직 / knockdown = 공격이 플레이어를 넘어뜨림
  // armorWhileWind = 예고 동작 중 넉다운이 아닌 공격에 경직되지 않음
  enemies: {
    hit: { reachPadPx: 8, depthPx: 20, heightPx: 55, activeGraceTicks: 2 },   // 근접 공격 판정 공통값
    grunt:  { name: '망령 병사',   hp: 40,  speed: 1.2, damage: 8,  rangePx: 56,  windTicks: 28, activeTicks: 10, recoveryTicks: 30, knockbackPx: 3, hurtTicks: 18 },
    rogue:  { name: '흑창병',     hp: 28,  speed: 2.0, damage: 6,  rangePx: 78,  windTicks: 18, activeTicks: 8,  recoveryTicks: 22, knockbackPx: 2, hurtTicks: 18 },
    brute:  { name: '흑철 중기사', hp: 100, speed: 0.9, damage: 16, rangePx: 68,  windTicks: 44, activeTicks: 12, recoveryTicks: 44, knockbackPx: 6, hurtTicks: 18,
              knockdown: true, armorWhileWind: true },
    archer: { name: '망령 궁수',   hp: 30,  speed: 1.5, damage: 7,  rangePx: 260, windTicks: 42, activeTicks: 6,  recoveryTicks: 46, knockbackPx: 3, hurtTicks: 18,
              ranged: true },
    default: { hurtTicks: 18 },
  },
};

// 일반 적이 이번 타격으로 묶일 틱 수. 보스는 기존 규칙(10틱)을 그대로 쓴다.
function enemyHitstun(e, attackId) {
  const table = COMBAT_FRAME_DATA.enemies, base = (table[e?.type] || table.default).hurtTicks;
  const b = COMBAT_FRAME_DATA.barel, move = attackId && (b.combo.moves[attackId] || (attackId === 'air' ? b.air : null));
  return Number.isFinite(move?.hitstunTicks) ? Math.max(base, move.hitstunTicks) : base;
}
// 게임 코드가 쓰던 짧은 이름(ET 의 hp/spd/dmg/range/wind/act/rec/kb)으로 바꿔 준다.
function enemyCombatStats(type) {
  const d = COMBAT_FRAME_DATA.enemies[type];
  const s = { hp: d.hp, spd: d.speed, dmg: d.damage, range: d.rangePx, wind: d.windTicks, act: d.activeTicks, rec: d.recoveryTicks, kb: d.knockbackPx };
  if (d.knockdown) s.kd = true;
  if (d.ranged) s.ranged = true;
  return s;
}
// 스프라이트 장별 길이(ms)를 받아, 각 장이 예고/판정/회수 중 어디에 속하는지 돌려준다 (문서·검사용).
function comboFramePhases(attackId, durationsMs) {
  const c = COMBAT_FRAME_DATA.barel.combo, m = c.moves[attackId];
  const activeStart = m.windMs + m.actMs * c.activeStartRatio, activeEnd = m.windMs + m.actMs + c.activeTailMs;
  let at = 0;
  return durationsMs.map((ms, i) => {
    const from = at, to = at + ms; at = to;
    const phase = to <= activeStart ? 'windup' : from >= activeEnd ? 'recovery' : 'active';
    return { frame: i + 1, fromMs: from, toMs: to, phase };
  });
}
globalThis.COMBAT_FRAME_DATA = COMBAT_FRAME_DATA;
globalThis.enemyHitstun = enemyHitstun;
globalThis.enemyCombatStats = enemyCombatStats;
globalThis.comboFramePhases = comboFramePhases;
