// 실측 결과(artifacts/frame-data/results.json)로 docs/barel-frame-data.md 를 만든다.
//   1) FRAME_DATA_SUITE=1 node tests/regression.cjs   (PowerShell: $env:FRAME_DATA_SUITE='1'; node tests/regression.cjs)
//   2) node tools/report_frame_data.cjs
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const src = path.join(root, 'artifacts/frame-data/results.json');
if (!fs.existsSync(src)) { console.error('먼저 FRAME_DATA_SUITE=1 node tests/regression.cjs 를 실행하세요.'); process.exit(1); }
const r = JSON.parse(fs.readFileSync(src, 'utf8'));
const ENEMY = { grunt: '망령 병사', rogue: '흑창병', brute: '흑철 중기사' };
const row = cells => '| ' + cells.join(' | ') + ' |';
const out = [];

out.push('# 바렐 3연타 — 프레임 데이터', '');
out.push('> 이 문서는 `node tools/report_frame_data.cjs` 가 실측 결과로 자동 생성한다. 직접 고치지 말고 `combat-data.js` 를 고친 뒤 다시 측정한다.', '');
out.push('단위: 60fps 틱. 틱 번호는 공격 시작 뒤 몇 번째 갱신인지(1부터). 히트스톱 동안은 적의 경직도 함께 멈추므로 간격에서 뺐다.', '');

out.push('## 공격 표 (game.js 의 실제 규칙으로 계산)', '');
out.push(row(['공격', '총(ms)', '예비/휘두름/회수(ms)', '판정 틱', '다음 타 연결 틱', '끝 틱', '피해', '히트스톱', '피격 경직']));
out.push(row(Array(9).fill('---')));
for (const [id, a] of Object.entries(r.table)) {
  out.push(row([`${a.name} (${id})`, a.totalMs, `${a.windMs} / ${a.actMs} / ${a.recMs}`, `${a.firstHitTick}–${a.lastHitTick}`,
    id === 'c3' ? '-' : a.linkTick, a.endTick, a.damage, a.hitstop, a.knockdown ? '넉다운' : a.hitstun]));
}
out.push('');
out.push('- 판정 틱: 휘두름 35% 지점부터 휘두름 끝 + 30ms까지 (`t >= wind + act*0.35 && t < wind + act + 30`).');
out.push('- 다음 타 연결 틱: 선입력이 있으면 이 틱에 다음 타가 시작된다 (`wind + act + rec*0.45`). 끝 틱 전까지 누르면 이어진다.');
out.push('- 피격 경직: `combat-data.js` 의 `COMBAT_FRAME_DATA.barel[id].hitstun`. 표에 없는 공격은 적 기본값 18틱.', '');

out.push('## 연결 검사 (실제 게임 루프에서 측정)', '');
out.push('여유 = 피격 경직 − 실제 간격. 0 이상이면 적이 풀리기 전에 다음 타가 들어간다.', '');
out.push(row(['적', '입력', '1타→2타 간격', '경직', '여유', '2타→3타 간격', '경직', '여유', '결과']));
out.push(row(Array(9).fill('---')));
for (const c of r.chains) {
  const [a, b] = c.links, ok = c.hits.length === 3 && c.links.every(l => l.margin >= 0);
  out.push(row([ENEMY[c.enemy] || c.enemy, c.input === 'fast' ? '가장 빠르게' : '가장 늦게', a.gap, a.hurt, a.margin, b.gap, b.hurt, b.margin, ok ? '연결됨' : '**끊김**']));
}
out.push('');
out.push('- 가장 빠르게: 매 틱 공격 키를 눌러 선입력으로 연결. 가장 늦게: 각 타의 회수가 끝나기 바로 전 틱에 누름.');
out.push('- 회수가 끝난 뒤 누르면(연결 허용 420ms 안) 다음 타는 나가지만 콤보가 아니라 새로 때리는 것이므로 끊길 수 있다. 의도한 실력 차이다.');
out.push('- 기존 값(모든 공격 18틱)에서는 2타→3타 간격 22틱이 경직 18틱보다 길어 세 적 모두 3타 전에 4틱 일찍 풀렸다.', '');

out.push('## 바뀌지 않은 것', '');
for (const u of r.untouched) out.push(`- ${u.case}: 피격 경직 ${u.measured}틱 (기존 ${u.expected}틱)`);
out.push('- 보스의 피격(10틱)·그로기·슈퍼아머, 플레이어 피격, 비에사의 모든 공격, 스킬, 마법은 그대로다.', '');

fs.writeFileSync(path.join(root, 'docs/barel-frame-data.md'), out.join('\n'));
console.log('docs/barel-frame-data.md 작성 완료');
