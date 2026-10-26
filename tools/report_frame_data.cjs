// combat-data.js + 스프라이트 메타데이터 + 실측 결과로 docs/barel-frame-data.md 를 만든다.
//   1) FRAME_DATA_SUITE=1 node tests/regression.cjs   (PowerShell: $env:FRAME_DATA_SUITE='1'; node tests/regression.cjs)
//   2) node tools/report_frame_data.cjs
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
const src = path.join(root, 'artifacts/frame-data/results.json');
if (!fs.existsSync(src)) { console.error('먼저 FRAME_DATA_SUITE=1 node tests/regression.cjs 를 실행하세요.'); process.exit(1); }
const r = JSON.parse(fs.readFileSync(src, 'utf8'));
const C = {}; C.globalThis = C; vm.createContext(C);
vm.runInContext(fs.readFileSync(path.join(root, 'combat-data.js'), 'utf8'), C);
const D = C.COMBAT_FRAME_DATA, B = D.barel;
const meta = rel => { const d = JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8')); return d.metadata || d; };
const TICK = 1000 / 60, tk = ms => Math.round(ms / TICK * 10) / 10;
const row = cells => '| ' + cells.join(' | ') + ' |';
const head = cols => [row(cols), row(cols.map(() => '---'))];
const PH = { windup: '예고', active: '**판정**', recovery: '회수' };
const out = [];

out.push('# 바렐 · 일반 적 — 전투 프레임 데이터', '');
out.push('> `node tools/report_frame_data.cjs` 가 `combat-data.js`, 스프라이트 메타데이터, 실측 결과로 자동 생성한다. 직접 고치지 말고 `combat-data.js` 를 고친 뒤 다시 측정한다.', '');
out.push('단위: 60fps 틱(1틱 = 16.7ms). 히트스톱 동안은 적의 경직도 함께 멈추므로 간격에서 뺐다.', '');

out.push('## 바렐 3연타', '');
out.push(...head(['공격', '총(ms)', '예고/휘두름/회수(ms)', '판정 틱', '다음 타 연결 틱', '끝 틱', '피해', '사거리', '히트스톱', '피격 경직']));
for (const [id, a] of Object.entries(r.table)) {
  const m = B.combo.moves[id];
  out.push(row([`${a.name} (${id})`, a.totalMs, `${a.windMs} / ${a.actMs} / ${a.recMs}`, `${a.firstHitTick}–${a.lastHitTick}`,
    id === 'c3' ? '-' : a.linkTick, a.endTick, a.damage, m.reachPx, a.hitstop, a.knockdown ? '넉다운' : a.hitstun]));
}
out.push('');
out.push(`- 판정: 휘두름의 ${B.combo.activeStartRatio * 100}% 지점부터 휘두름 끝 + ${B.combo.activeTailMs}ms까지. 선입력이 있으면 회수의 ${B.combo.cancelRatio * 100}% 지점에서 다음 타가 시작된다.`);
out.push(`- 회수가 끝난 뒤에도 ${D.input.linkMs}ms 안에 누르면 다음 타가 나가지만, 그때는 콤보가 아니라 새로 때리는 것이라 끊길 수 있다.`, '');

out.push('### 스프라이트 장별 구간', '');
out.push('각 장이 화면에 나오는 시간과, 그 시간이 예고·판정·회수 중 어디에 속하는지. **판정** 장이 손맛을 결정하는 포즈다.', '');
for (const [id, m] of Object.entries(B.combo.moves)) {
  const phases = C.comboFramePhases(id, meta(m.sprite).expectedDurationsMs);
  out.push(`**${m.name} (${id})** — \`${m.sprite}\``, '');
  out.push(...head(['장', ...phases.map(p => p.frame)]));
  out.push(row(['시간(ms)', ...phases.map(p => `${p.fromMs}–${p.toMs}`)]));
  out.push(row(['구간', ...phases.map(p => PH[p.phase])]), '');
}

out.push('### 연결 검사 (실제 게임 루프에서 측정)', '');
out.push('여유 = 피격 경직 − 실제 간격. 0 이상이면 적이 풀리기 전에 다음 타가 들어간다.', '');
const ENEMY = Object.fromEntries(['grunt', 'rogue', 'brute', 'archer'].map(t => [t, D.enemies[t].name]));
out.push(...head(['적', '입력', '1타→2타 간격', '경직', '여유', '2타→3타 간격', '경직', '여유', '결과']));
for (const c of r.chains) {
  const [a, b] = c.links, ok = c.hits.length === 3 && c.links.every(l => l.margin >= 0);
  out.push(row([ENEMY[c.enemy] || c.enemy, c.input === 'fast' ? '가장 빠르게' : '가장 늦게', a.gap, a.hurt, a.margin, b.gap, b.hurt, b.margin, ok ? '연결됨' : '**끊김**']));
}
out.push('');
out.push('- 가장 빠르게: 매 틱 공격 키를 눌러 선입력으로 연결. 가장 늦게: 각 타의 회수가 끝나기 바로 전 틱에 누름.');
out.push('- v1.41 까지는 모든 공격의 경직이 18틱이라 2타→3타(22틱)에서 세 적 모두 4틱 먼저 풀렸다.', '');

out.push('## 공중 베기 · 대시', '');
const A = B.air, DS = B.dash;
out.push(`- ${A.name}: 피해 ${A.damage}, 사거리 ${A.reachPx}px, ${A.knockdown ? '넉다운' : '경직'}, 히트스톱 ${A.hitstopTicks}틱, 틱마다 ${A.forwardPxPerTick}px 전진. 착지할 때까지 판정 유지.`);
out.push(`- 대시: ${DS.distPx}px 를 ${DS.moveMs}ms 동안 이동, 전체 ${DS.durMs}ms. 무적 ${DS.invulnerableTicks}틱, 쿨타임 ${DS.cooldownTicks}틱. ${DS.attackCancelMs}ms 부터 공격으로 캔슬.`, '');

out.push('## 바렐 스킬', '');
out.push(...head(['스킬', '키', '쿨타임', '길이', '타격 시점(ms)', '피해', '앞/뒤 사거리', '결과', '무적']));
for (const [id, s] of Object.entries(B.skills)) {
  const at = s.strikeMs != null ? [].concat(s.strikeMs).join(' / ') : s.strikeFromMs != null ? `${s.strikeFromMs}부터 돌진 끝까지` : `${s.fireMs} (파동 발사)`;
  const inv = s.invulnerableMs ? `${s.invulnerableMs[0]}–${s.invulnerableMs[1]}ms` : s.travelMs && (s.invulnerableWhileTravel || id === 'leap') ? `이동 중 ${s.travelMs[0]}–${s.travelMs[1]}ms` : '-';
  out.push(row([`${s.name} (${id})`, s.key, `${s.cooldownMs / 1000}초`, `${s.durMs}ms (${tk(s.durMs)}틱)`, at, s.damage + ([].concat(s.strikeMs || []).length > 1 ? ` × ${s.strikeMs.length}` : ''),
    s.reachPx ? `${s.reachPx} / ${s.behindPx}px` : '투사체', s.knockdown ? '넉다운' : id === 'redwave' ? '관통 파동' : '경직(18틱)', inv]));
}
out.push('', `- 스킬이 끝나면 ${B.skillEndInvulnerableTicks}틱 무적. 스킬 판정 깊이 38px, 높이 85px.`, '');

out.push('## 일반 적', '');
out.push('반격 시간 = 공격 후 경직. 예고를 보고 피한 뒤 이 시간 안에 때리면 된다.', '');
out.push(...head(['적', '체력', '속도', '피해', '사거리', '예고', '판정', '공격 후 경직', '피격 경직', '특징']));
for (const t of ['grunt', 'rogue', 'brute', 'archer']) {
  const e = D.enemies[t], tag = [e.knockdown && '넉다운 공격', e.armorWhileWind && '예고 중 슈퍼아머', e.ranged && '화살(줄 바꾸기·점프로 회피)'].filter(Boolean).join(', ') || '-';
  out.push(row([e.name, e.hp, e.speed, e.damage, `${e.rangePx}px`, `${e.windTicks}틱`, `${e.activeTicks}틱`, `${e.recoveryTicks}틱`, `${e.hurtTicks}틱`, tag]));
}
out.push('', `- 근접 판정: 사거리 + ${D.enemies.hit.reachPadPx}px, 깊이 ±${D.enemies.hit.depthPx}px, 높이 ${D.enemies.hit.heightPx}px. 판정은 예고가 끝난 뒤 '판정' 틱 + ${D.enemies.hit.activeGraceTicks}틱 동안 유지.`);
out.push('- 피격 경직은 바렐 3연타에 맞으면 위 표의 공격별 값(일섬 22·역일섬 28), 그 밖의 공격은 이 표의 값.', '');

out.push('## 바뀌지 않은 것', '');
for (const u of r.untouched) out.push(`- ${u.case}: 피격 경직 ${u.measured}틱 (기존 ${u.expected}틱)`);
out.push('- 보스(고라스~소버린)와 비에사는 각자의 데이터·런타임 파일을 따른다.', '');

fs.writeFileSync(path.join(root, 'docs/barel-frame-data.md'), out.join('\n'));
console.log('docs/barel-frame-data.md 작성 완료');
