'use strict';
// 전투 프레임 데이터 (60fps 틱). 밸런스 조정은 이 파일의 숫자만 바꾼다.
// 측정·검증: FRAME_DATA_SUITE=1 node tests/regression.cjs → node tools/report_frame_data.cjs
//
// hitstun  = 이 공격에 맞은 일반 적이 'hurt' 상태로 묶이는 틱 수 (보스·넉다운 공격에는 쓰지 않음)
// 기준     = 다음 타가 실제로 들어오기까지 걸리는 틱 + 여유. 여유는 선입력 없이 조금 늦게 눌러도
//            (각 타의 회수가 끝나기 전까지) 이어지도록 잡는다. 측정값은 docs/barel-frame-data.md.
const COMBAT_FRAME_DATA = {
  version: 1,
  barel: {
    c1:  { name: '일섬',   hitstun: 22 },   // 1타 → 2타 실측 16틱 + 여유 6
    c2:  { name: '역일섬', hitstun: 28 },   // 2타 → 3타 실측 22틱 + 여유 6 (기존 18틱에서는 3타 전에 풀림)
    c3:  { name: '참격',   hitstun: null }, // 넉다운 공격: 'down' 상태로 처리
    air: { name: '공중 베기', hitstun: null },
  },
  // 이 표에 없는 공격(스킬·비에사·투사체 등)에 맞았을 때의 기본 피격 경직. 기존 값과 같다.
  enemies: {
    default: { hurt: 18 },
    grunt:   { hurt: 18 },
    rogue:   { hurt: 18 },
    brute:   { hurt: 18 },
    archer:  { hurt: 18 },
  },
};
// 일반 적이 이번 타격으로 묶일 틱 수. 보스는 기존 규칙(10틱)을 그대로 쓴다.
function enemyHitstun(e, attackId) {
  const table = COMBAT_FRAME_DATA.enemies, base = (table[e?.type] || table.default).hurt;
  const move = attackId && COMBAT_FRAME_DATA.barel[attackId];
  return Number.isFinite(move?.hitstun) ? Math.max(base, move.hitstun) : base;
}
globalThis.COMBAT_FRAME_DATA = COMBAT_FRAME_DATA;
globalThis.enemyHitstun = enemyHitstun;
