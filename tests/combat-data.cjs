// node tests/combat-data.cjs
// combat-data.js 의 타이밍이 바렐 Aseprite 스프라이트의 장별 길이·전투 기록과 맞는지 검사한다 (브라우저 불필요).
// windMs/actMs/recMs 를 바꾸고 스프라이트를 다시 내보내지 않으면 여기서 실패한다.
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert/strict');
const root = path.join(__dirname, '..');
function loadCombatData() {
  const ctx = {}; ctx.globalThis = ctx; vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(root, 'combat-data.js'), 'utf8'), ctx, { filename: 'combat-data.js' });
  return ctx;
}
const meta = rel => { const d = JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8')); return d.metadata || d; };
const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-6, `${msg}: 데이터 ${a} ≠ 스프라이트 ${b}`);

const C = loadCombatData(), D = C.COMBAT_FRAME_DATA, rules = D.barel.combo;
const report = [];
for (const [id, m] of Object.entries(rules.moves)) {
  const s = meta(m.sprite), c = s.combat, sum = s.expectedDurationsMs.reduce((a, b) => a + b, 0);
  const hitAt = m.windMs + m.actMs;
  near(hitAt + m.recMs, c.durationMs, `${id} 전체 길이`);
  near(sum, c.durationMs, `${id} 스프라이트 장별 길이 합`);
  near(m.windMs + m.actMs * rules.activeStartRatio, c.activeStartMs, `${id} 판정 시작`);
  near(hitAt + rules.activeTailMs, c.activeEndMs, `${id} 판정 끝`);
  if (c.comboLinkMs == null) assert.equal(id, 'c3', `${id}: 마지막 타만 다음 타 연결이 없음`);
  else near(hitAt + m.recMs * rules.cancelRatio, c.comboLinkMs, `${id} 다음 타 연결`);
  if (m.waveRatio != null) near(m.windMs + m.actMs * m.waveRatio, c.waveMs, `${id} 검기 발사`);
  if (m.smashRatio != null) near(m.windMs + m.actMs * m.smashRatio, c.groundSmashMs, `${id} 땅 박힘`);
  const phases = C.comboFramePhases(id, s.expectedDurationsMs);
  assert.ok(phases.some(p => p.phase === 'active'), `${id}: 판정이 걸리는 장이 있어야 함`);
  report.push(`${id} ${phases.map(p => p.phase[0]).join('')}`);
}
const air = meta(D.barel.air.sprite).combatReference, A = D.barel.air;
assert.equal(A.damage, air.damage, 'air 피해'); assert.equal(A.reachPx, air.reach, 'air 사거리');
assert.equal(A.knockdown, air.knockdown, 'air 넉다운'); assert.equal(A.hitstopTicks, air.hitStopTicks, 'air 히트스톱');
near(A.forwardPxPerTick, air.forwardPerTick, 'air 전진 속도');
near(D.barel.dash.durMs, meta(D.barel.dash.sprite).durationMs, 'dash 길이');

// ---- 1.42 대시 찌르기: 장별 끝 틱 ↔ 스프라이트 장별 길이, 판정 장 = 5~6번
const DA = D.barel.dashAttack, daMeta = meta(DA.sprite);
const ends = DA.frameEndTicks, perFrame = ends.map((e, i) => e - (ends[i - 1] || 0));
assert.equal(ends.length, daMeta.expectedDurationsMs.length, '대시 찌르기 장 수');
perFrame.forEach((ticks, i) => near(ticks * 1000 / 60, daMeta.expectedDurationsMs[i], `대시 찌르기 ${i + 1}번 장 길이`));
assert.equal(JSON.stringify(DA.strikeTicks), JSON.stringify([ends[3], ends[5]]), '대시 찌르기 판정 = 5~6번 장');
assert.equal(DA.cancelTick, ends[6], '대시 찌르기 캔슬 = 8번 장부터');
assert.equal(DA.skillCancelOnHitTick, ends[5], '맞혔을 때 스킬 캔슬 = 6번 장 끝');
near(DA.move.reduce((s, m) => s + (m.toTick - m.fromTick) * m.bodyRatioPerTick, 0), 0.92, '대시 찌르기 전진 합계(몸 키 배수)');
assert.ok(daMeta.hitbox && daMeta.bodyHeight > 0, '대시 찌르기 판정 박스·몸 키는 스프라이트에 있어야 함');
assert.equal(Math.round(C.COMBAT_FRAME_DATA.barel.combo.moves.c1.damage * DA.damageRatioOfC1), 14, '대시 찌르기 피해 14');

// ---- 1.49 피격 / 1.51 넉다운 / 1.50 점프: 모션 파일에 적힌 물리 기준과 데이터가 같은지
const P = D.player, M = D.barel.motions;
const hurt = meta(M.hurt), down = meta(M.knockdown), jump = meta(M.jump);
assert.equal(P.hurt.defaultHitstunTicks, hurt.defaultHitstunTicks, '피격 기본 경직');
for (const [k, s] of Object.entries(hurt.sequences)) assert.equal(s.frames.length, 6, `피격 ${k} 6장`);
assert.ok(P.hurt.defaultHitstunTicks > hurt.recoveryTicks, '피격 경직이 마지막 복귀 장(6틱)보다 길어야 함');
const pr = down.physicsReference;
assert.equal(P.knockdown.getupAfterTicks, pr.recoveryAfterTick, '기상 시점');
assert.equal(down.tickDurations.reduce((a, b) => a + b, 0), P.knockdown.getupAfterTicks + 1, '넉다운 10장 틱 합계 = 기상 틱 + 1');
assert.equal(P.knockdown.launchVz, pr.initialVz, '넉다운 띄우기 속도');
assert.equal(P.knockdown.knockbackPx, pr.knockback, '넉다운 넉백');
assert.equal(P.knockdown.knockbackDecay, pr.friction, '넉다운 감쇠');
assert.equal(P.knockdown.getupInvulnerableTicks, pr.getupInvulnerability, '기상 무적');
assert.equal(P.jump.initialVz, jump.physicsReference.initialVz, '점프 초기 속도');
assert.equal(P.jump.gravityPerTick, jump.physicsReference.gravityPerTick, '점프 중력');

// 일반 적 수치가 빠짐없이 숫자인지
for (const t of ['grunt', 'rogue', 'brute', 'archer']) {
  const s = C.enemyCombatStats(t);
  for (const k of ['hp', 'spd', 'dmg', 'range', 'wind', 'act', 'rec', 'kb']) assert.ok(Number.isFinite(s[k]) && s[k] > 0, `${t}.${k}`);
  assert.ok(Number.isInteger(D.enemies[t].hurtTicks), `${t}.hurtTicks`);
}
// 스킬 타이밍이 스킬 길이 안에 있는지
for (const [id, s] of Object.entries(D.barel.skills)) {
  const times = [s.strikeFromMs, s.strikeMs, s.fireMs, ...(s.travelMs || []), ...(s.invulnerableMs || [])].flat().filter(v => v != null);
  for (const v of times) assert.ok(v >= 0 && v <= s.durMs, `${id}: ${v}ms 가 스킬 길이 ${s.durMs}ms 밖`);
}
console.log(`PASS combat-data.js ↔ Aseprite: 3연타·공중 베기·대시·대시 찌르기 타이밍, 피격·넉다운·점프 물리 기준 일치 (장별 w/a/r: ${report.join(', ')}); 적 4종·스킬 5종 값 확인`);
