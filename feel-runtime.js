'use strict';
// =====================================================================================
// 흑월의 기사 1.67 — 타격감 · 가독성
//   적 공격 범위(enemyAttackZone): 판정과 바닥 표시가 같은 함수를 쓴다
//   같은 줄 표시 · 예고 "!" 3단계 · 히트스톱 중 맞은 적 떨림 · 날아간 적끼리 부딪힘
//   디버그 판정 오버레이(?hitbox=1 또는 F9) · SP 가득 오라 · 스킬 준비 글자
// 수치는 전부 combat-data.js 의 COMBAT_FRAME_DATA.feel 에 있다. 보스는 각자의 경고를 쓰므로 여기서 다루지 않는다.
// =====================================================================================

// ---------------------------------------------------------------- 적 공격 범위
// 범위 = 플레이어 발(중심)이 그 안에 있으면 맞는 영역. 적 기준 앞쪽 거리 back..reach, 깊이 ±depth, 높이 조건.
// zh: 'rel' 이면 |플레이어 높이 − 적 높이| < zMax, 'abs' 면 플레이어 높이 < zMax
function feelZone(e, shape, back, reach, depth, zh, zMax, extra = {}) {
  const f = e.face || 1, a = e.x + f * back, b = e.x + f * reach;
  return { shape, ex: e.x, face: f, back, reach, x0: Math.min(a, b), x1: Math.max(a, b), yC: e.y, depth, ez: e.z || 0, zh, zMax,
    progress: 1, hitIn: 0, active: false, kd: false, ...extra };
}
function zoneContains(z, t) {
  if (!z) return false;
  const dx = (t.x - z.ex) * z.face;
  if (!(dx > z.back && dx < z.reach) || !(Math.abs(t.y - z.yC) < z.depth)) return false;
  return z.zh === 'abs' ? t.z < z.zMax : Math.abs(t.z - z.ez) < z.zMax;
}
function feelHurtScale() { return typeof playerHurtScale === 'function' ? playerHurtScale() : 1; }
function feelPlayerHw() { return player?.hw || 14; }
// inReach(e, player, reach, ytol, zt) 와 같은 범위
function reachZone(e, shape, reach, ytol, zt, extra) {
  const k = feelHurtScale();
  return feelZone(e, shape, -8, reach + feelPlayerHw(), ytol * k, 'rel', zt * k, extra);
}
// 일반 적(망령 병사 등) 근접 휘두르기: game.js updEnemy 'act' 판정
function swingZone(e, extra) {
  const EH = COMBAT_FRAME_DATA.enemies.hit;
  return reachZone(e, 'rect', e.d.range + EH.reachPadPx, EH.depthPx, EH.heightPx, extra);
}
// 1스테이지 동작의 판정 하나: stage1-runtime.js runStage1Move 판정
function s1HitZone(e, clip, hit, extra) {
  const box = stage1HitBox(e.s1, clip, hit);
  if (hit.radial) return feelZone(e, 'ring', -box.back - 14, box.reach + 14, 26, 'abs', 60, extra);
  const EH = COMBAT_FRAME_DATA.enemies.hit;
  return reachZone(e, 'rect', box.reach, EH.depthPx, EH.heightPx, extra);
}
// 중갑병 잡기 판정
function s1GrabZone(e, clip, frames, extra) {
  const box = stage1HitBox(e.s1, clip, { f: frames });
  return feelZone(e, 'grab', -8, box.reach + 14, 14, 'abs', 32, extra);
}
// 화염병 투척자 발차기: molotovKick 판정
function kickZone(e, extra) { return reachZone(e, 'rect', 40, 16, 45, extra); }

// 프레임 hf(1부터)가 시작되기 전까지 지난 틱 수
function s1FrameStart(m, hf) { let acc = 0; for (let i = 0; i < hf - 1; i++) acc += m.len[i]; return acc; }
function s1FrameEnd(m, hf) { return s1FrameStart(m, hf + 1); }
// 지금부터 남은 돌진 거리: 돌진 프레임 동안 틱마다 dash[2] × 바렐 키 만큼 앞으로 (플레이어에게 34px 안으로 붙으면 멈추므로 최대치)
function s1DashLeft(m, t) {
  if (!m.dash) return 0;
  const from = s1FrameStart(m, m.dash[0]), to = s1FrameEnd(m, m.dash[1]);
  return Math.max(0, to - Math.max(t, from)) * m.dash[2] * STAGE1_ET_H;
}

// 지금 이 적이 노리는 공격 범위. 없으면 null.
//   progress: 예고 경과 비율(0~1, 1이 되는 틱에 판정이 시작된다), hitIn: 판정까지 남은 틱, active: 판정 프레임,
//   activeAge: 판정이 시작된 뒤 지난 틱, kd: 넉다운 기술, warn: 머리 위 "!" 를 띄우는 동작
function enemyAttackZone(e) {
  if (!e || e.boss || e.st === 'dead' || e.balcony || (e.st !== 'wind' && e.st !== 'act')) return null;
  const late = FEEL.readability.alertLateTicks;
  if (e.s1 && e.mv && typeof S1_MOVES !== 'undefined') {
    const m = S1_MOVES[e.s1]?.[e.mv.clip]; if (!m) return null;
    const t = e.mv.t, fn = e.mv.f + 1;
    const targets = (m.hits || []).map((h, i) => ({ hit: h, i, from: h.f[0], to: h.f[1] }));
    if (m.grab) targets.push({ grab: m.grab, from: m.grab[0], to: m.grab[1] });
    targets.sort((a, b) => a.from - b.from);
    const cur = targets.find(x => fn <= x.to);
    if (!cur) return null;
    const start = s1FrameStart(m, cur.from), active = fn >= cur.from;
    const extra = { progress: active ? 1 : clamp(t / (start + 1), 0, 1), hitIn: active ? 0 : start + 1 - t, active, activeAge: active ? t - start : -1,
      kd: !!cur.hit?.kd, warn: m.warnTo > 0, late };
    const z = cur.grab ? s1GrabZone(e, e.mv.clip, cur.grab, extra) : s1HitZone(e, e.mv.clip, cur.hit, extra);
    const dash = active ? 0 : s1DashLeft(m, t);
    if (dash > 0) { z.reach += dash; const a = e.x + z.face * z.back, b = e.x + z.face * z.reach; z.x0 = Math.min(a, b); z.x1 = Math.max(a, b); }
    // 같은 동작의 다음 판정(중갑병 회전 2타처럼 바로 이어지는 것)도 테두리로 같이 보여 준다
    z.more = targets.filter(x => x.from > cur.from && x.hit).map(x => s1HitZone(e, e.mv.clip, x.hit, { kd: !!x.hit.kd }));
    return z;
  }
  if (e.s1 === 'hound' && e.dv) {                   // 물기 다이빙: 1~2칸 예고, 3~5칸 도약. 판정은 입 위치(매 틱) 기준이라 범위는 도약 전체의 합
    const dv = e.dv, art = STAGE1_ENEMY_ART.hound, pre = S1_ANIM.dive[0] + S1_ANIM.dive[1];
    // runHoundDive 와 같은 순서: 도약 k번째 틱에 몸이 k × leap/air 앞으로 간 뒤, 그 칸의 입 위치 −22 ~ +14 를 검사한다
    const air = S1_ANIM.dive.slice(2, 5).reduce((a, b) => a + b, 0);
    let back = Infinity, reach = -Infinity;
    for (let k = 1; k <= air; k++) {
      const mouth = (art?.frames[art.clips.dive[animIndex(S1_ANIM.dive, pre + k - 1)]]?.hand || [30, 20])[0], off = k * HOUND.leap / air;
      back = Math.min(back, off + mouth - 22); reach = Math.max(reach, off + mouth + 14);
    }
    const x0 = dv.x0 ?? e.x, f = dv.dir;
    const active = dv.t > pre;
    const z = feelZone({ x: x0, y: e.y, z: 0, face: f }, 'line', back, reach, COMBAT_FRAME_DATA.enemies.hit.depthPx * HOUND.depthMul, 'abs', 999,
      { progress: active ? 1 : clamp(dv.t / (pre + 1), 0, 1), hitIn: active ? 0 : pre + 1 - dv.t, active, activeAge: active ? dv.t - pre : -1,
        kd: false, warn: true, land: x0 + f * HOUND.leap, late });
    return z;
  }
  if (e.molotov && e.pat === 'kick') {
    const w = MOLOTOV.kickWind, active = e.st === 'act';
    return kickZone(e, { progress: active ? 1 : clamp(e.t / w, 0, 1), hitIn: active ? 0 : w - e.t, active, activeAge: active ? e.t : -1, warn: true, late });
  }
  if (e.pat === 'swing' && !e.s1 && !e.d.ranged) {
    const w = e.d.wind, active = e.st === 'act';
    return swingZone(e, { progress: active ? 1 : clamp(e.t / w, 0, 1), hitIn: active ? 0 : w - e.t, active, activeAge: active ? e.t : -1,
      kd: !!e.d.kd, warn: true, late });
  }
  return null;
}
// 예고 "!" 정보: { start(예고 시작 뒤 틱), hitIn(판정까지 남은 틱), kd } — 예고 중(판정 전)인 일반 적만
function enemyAlert(e) {
  if (!e || e.boss || e.st === 'dead') return null;
  const z = enemyAttackZone(e);
  if (z) return z.warn && !z.active ? { hitIn: z.hitIn, kd: z.kd, start: e.mv ? e.mv.t : e.dv ? e.dv.t : e.t } : null;
  if (e.st !== 'wind') return null;
  if (e.molotov && e.pat === 'throw') return { hitIn: MOLOTOV.wind - e.t, kd: false, start: e.t };
  if (e.pat === 'shoot') return { hitIn: e.d.wind - e.t, kd: false, start: e.t };
  return { hitIn: 99, kd: false, start: e.t };
}

// ---------------------------------------------------------------- 바닥 그리기 (캐릭터보다 먼저, 그림자와 같은 층)
function feelShadowR(e) {
  if (e.s1) return e.s1 === 'heavy' ? 22 : e.s1 === 'hound' ? 18 : 15;
  return SPRITES[e.d?.sprite]?.sh || 15;
}
function feelEllipse(x, y, rx, ry) { ctx.beginPath(); ctx.ellipse(x, y, Math.max(1, rx), Math.max(1, ry), 0, 0, Math.PI * 2); }
let laneFlash = null;                              // { t, set } — 공격 키를 누른 순간 같은 줄의 적
let readyMarks = [];                               // 스킬 준비 글자 [{ code, t }]
function feelLaneEnemy(e, depth) {
  return !e.boss && e.st !== 'dead' && e.st !== 'down' && !e.balcony && e.st !== 'enter' && Math.abs(player.y - e.y) <= depth;
}
// 바렐 · 비에사가 공격 키를 누른 순간 (startAtk)
function markAttackLane() {
  if (!player || !enemies) return;
  laneFlash = { t: FEEL.lane.attackFlashTicks, set: new Set(enemies.filter(e => feelLaneEnemy(e, FEEL.lane.playerDepthPx))) };
}
function drawDangerZone(z) {
  const Zc = FEEL.zone, x0 = z.x0 - camX, x1 = z.x1 - camX, y0 = z.yC - z.depth, h = z.depth * 2, w = x1 - x0;
  const flash = z.active && z.activeAge <= Zc.activeFlashTicks;
  if (z.active && !flash) return;
  ctx.save();
  if (!z.active) for (const m of z.more || []) {     // 이어지는 판정: 테두리만
    ctx.lineWidth = m.kd ? Zc.kdLineWidth : Zc.lineWidth; ctx.strokeStyle = m.kd ? Zc.kdStroke : Zc.stroke;
    ctx.setLineDash([4, 3]); ctx.strokeRect(m.x0 - camX, m.yC - m.depth, m.x1 - m.x0, m.depth * 2); ctx.setLineDash([]);
  }
  ctx.lineWidth = z.kd ? Zc.kdLineWidth : Zc.lineWidth;
  ctx.strokeStyle = z.kd ? Zc.kdStroke : Zc.stroke;
  ctx.fillStyle = flash ? Zc.activeFill : z.kd ? Zc.kdFill : Zc.fill;
  if (flash) ctx.fillRect(x0, y0, w, h);
  else if (z.shape === 'ring') {                    // 회전: 적 몸에서 양쪽으로 차오른다
    const cx = z.ex - camX, l = (cx - x0) * z.progress, r = (x1 - cx) * z.progress;
    ctx.fillRect(cx - l, y0, l + r, h);
  } else {                                         // 적 쪽 끝에서 앞으로 차오른다
    const fw = w * z.progress;
    ctx.fillRect(z.face > 0 ? x0 : x1 - fw, y0, fw, h);
  }
  ctx.strokeRect(x0, y0, w, h);
  if (z.shape === 'ring') { feelEllipse(z.ex - camX, z.yC, Math.min(z.ex - z.x0, z.x1 - z.ex) * .55, z.depth * .55); ctx.stroke(); }
  if (z.land != null) { feelEllipse(z.land - camX, z.yC, 20, z.depth); ctx.stroke(); }
  ctx.restore();
}
function drawFeelGround() {
  if (!stage || !player || !enemies) return;
  const p = player, EH = COMBAT_FRAME_DATA.enemies.hit, L = FEEL.lane;
  // SP 가득: 발밑 푸른 오라가 천천히 돈다
  if (p.sp >= SP_MAX && p.st !== 'dead') {
    ctx.save();
    const rx = 30, ry = 9, sx = p.x - camX;
    ctx.fillStyle = 'rgba(90,170,255,.14)'; feelEllipse(sx, p.y, rx, ry); ctx.fill();
    ctx.strokeStyle = 'rgba(140,205,255,.85)'; ctx.lineWidth = 1.4; ctx.setLineDash([7, 5]); ctx.lineDashOffset = -tick * .35;
    feelEllipse(sx, p.y, rx, ry); ctx.stroke();
    ctx.setLineDash([3, 9]); ctx.lineDashOffset = tick * .5; ctx.strokeStyle = 'rgba(220,240,255,.7)';
    feelEllipse(sx, p.y, rx - 6, ry - 2); ctx.stroke();
    ctx.restore();
  }
  if (UX.options.dangerZones) for (const e of enemies) { const z = enemyAttackZone(e); if (z) drawDangerZone(z); }
  // 같은 줄: 쫓아오거나 예고 중인 적의 그림자 테두리
  let windLane = false;
  ctx.save(); ctx.lineWidth = 1;
  for (const e of enemies) {
    if (!feelLaneEnemy(e, EH.depthPx) || (e.st !== 'chase' && e.st !== 'wind')) continue;
    if (e.st === 'wind') windLane = true;
    const r = feelShadowR(e) * SC * (1 - Math.min(e.z, 150) / 300);
    ctx.strokeStyle = L.stroke; feelEllipse(e.x - camX, e.y, r, 6 * SC * 0.7); ctx.stroke();
  }
  if (laneFlash) for (const e of laneFlash.set) {      // 공격 키: 같은 줄의 적 그림자가 0.2초 하얗게
    if (e.st === 'dead') continue;
    const r = feelShadowR(e) * SC * (1 - Math.min(e.z, 150) / 300), a = laneFlash.t / L.attackFlashTicks;
    ctx.fillStyle = `rgba(255,255,255,${(.45 * a).toFixed(3)})`; ctx.strokeStyle = `rgba(255,255,255,${(.9 * a).toFixed(3)})`;
    feelEllipse(e.x - camX, e.y, r + 2, 6 * SC * 0.7 + 1); ctx.fill(); ctx.stroke();
  }
  if (windLane && p.st !== 'dead') {               // 예고 중인 적과 같은 줄: 플레이어 그림자가 붉게 맥동 → 위아래로 비키면 된다
    const a = .35 + .3 * Math.sin(tick * .35), r = (SPRITES.player?.sh || 16) * SC * (1 - Math.min(p.z, 150) / 300);
    ctx.fillStyle = L.playerPulse + (a * .5).toFixed(3) + ')'; ctx.strokeStyle = L.playerPulse + Math.min(1, a + .35).toFixed(3) + ')'; ctx.lineWidth = 1.5;
    feelEllipse(p.x - camX, p.y, r + 2, 6 * SC * 0.7 + 1); ctx.fill(); ctx.stroke();
  }
  ctx.restore();
}

// ---------------------------------------------------------------- 머리 위 "!" (일반 적)
// 예고 시작: 노란 "!" 가 1.4배 → 1배 (4틱). 판정 8틱 전부터 빨간 "!" 가 빠르게 깜빡. 넉다운 기술은 "!!"
function drawEnemyAlert(e, sx, top) {
  const al = enemyAlert(e);
  if (!al || al.start < 1) return;
  const R = FEEL.readability, txt = al.kd ? '!!' : '!';
  if (al.hitIn <= R.alertLateTicks) {
    if (Math.floor(tick / 2) % 2 === 0) outlineText(txt, sx, top - 28, '#ff3d3d', 'bold 26px sans-serif');
    return;
  }
  const k = lerp(R.alertPopScale, 1, clamp(al.start / R.alertPopTicks, 0, 1));
  outlineText(txt, sx, top - 28, '#ffd23f', `bold ${Math.round(26 * k)}px sans-serif`);
}
// 흰색 몸 깜빡임: 판정 직전(8틱)에만 2틱 간격
function enemyLateBlink(e) {
  const al = enemyAlert(e);
  return !!al && al.hitIn <= FEEL.readability.alertLateTicks && Math.floor(tick / 2) % 2 === 1;
}

// ---------------------------------------------------------------- 히트스톱 중 마지막으로 맞은 적 떨림 (그리기 오프셋만)
function hitJitter(e) {
  if (hitStop <= 0 || !lastHit || lastHit.e !== e) return 0;
  const px = lastHit.rank >= 2 ? FEEL.hitJitterPx.heavy : FEEL.hitJitterPx.normal;
  return (hitStop % 2 ? 1 : -1) * px;
}
function drawEnemyFeel(e) {
  const j = hitJitter(e);
  if (!j) { drawEnemy(e); return; }
  ctx.save(); ctx.translate(j, 0); drawEnemy(e); ctx.restore();
}

// ---------------------------------------------------------------- 날아간 적이 다른 적과 부딪힘
function enemyCollide(e) {
  const C = FEEL.collide;
  if (e.boss || !e.bumpSet || e.st === 'grabbing' || e.dv || !(e.st === 'hurt' || (e.st === 'down' && e.z > 0)) || Math.abs(e.vx) < C.minSpeed) return;
  for (const o of enemies) {
    if (o === e || e.bumpSet.has(o) || o.boss || o.st === 'dead' || o.st === 'down' || o.st === 'grabbing' || o.dv || o.balcony || o.invuln ||
        o.st === 'enter' || o.phaseT > 0) continue;
    if (Math.abs(e.x - o.x) >= C.dx || Math.abs(e.y - o.y) >= C.dy) continue;
    e.bumpSet.add(o);
    const dir = Math.sign(e.vx) || 1, keep = e.bumpSet;
    damageEnemy(o, Math.max(1, Math.round((e.bumpDmg || 1) * C.dmgMul)), false, 1, false, 'bump');
    e.bumpSet = keep;
    if (o.st === 'hurt') { o.vx = dir * o.d.kb * C.kbMul; o.hdir = dir; }
    impact((e.x + o.x) / 2, o.y, 40, 1, dir); sfx('hit');
  }
}

// ---------------------------------------------------------------- SP 가득 · 스킬 준비 신호 (updPlayer)
function feelPlayerSignals() {
  const p = player; if (!p) return;
  if (p.sp >= SP_MAX) {
    if (!p.spFull) { p.spFull = true; sfx('spready'); p.flash = Math.max(p.flash || 0, FEEL.signals.spFullFlashTicks); }
  } else p.spFull = false;
  for (const m of readyMarks) m.t--;
  readyMarks = readyMarks.filter(m => m.t > 0);
  if (laneFlash && --laneFlash.t <= 0) laneFlash = null;
}
function markSkillReady(id) {
  const code = Object.keys(SKILL_KEYS).find(k => SKILL_KEYS[k] === id);
  if (!code) return;
  readyMarks = readyMarks.filter(m => m.code !== code);
  readyMarks.push({ code, t: FEEL.signals.skillReadyTicks });
}
function drawFeelTop() {
  if (!player || !readyMarks.length || player.st === 'dead') return;
  const p = player, n = FEEL.signals.skillReadyTicks;
  readyMarks.forEach((m, i) => {
    const u = 1 - m.t / n, key = UX.keyName(UX.options.bindings[m.code] || m.code);
    ctx.save(); ctx.globalAlpha = clamp(m.t / 8, 0, 1) * clamp(u * 6, 0, 1);
    outlineText(key, p.x - camX + (i - (readyMarks.length - 1) / 2) * 16, p.y - p.z - 112 - u * 10, '#a8dcff', 'bold 13px sans-serif');
    ctx.restore();
  });
}

// ---------------------------------------------------------------- 디버그 판정 오버레이 (?hitbox=1 또는 F9)
let hitboxDebug = new URLSearchParams(location.search).get('hitbox') === '1';
function toggleHitboxDebug() { hitboxDebug = !hitboxDebug; }
function playerAttackBox() {
  const p = player; if (!p) return null;
  if (p.st === 'atk' && typeof ATK !== 'undefined' && ATK[p.atk]) return { back: -8, reach: ATK[p.atk].reach, depth: 24, label: p.atk };
  if (p.st === 'dash_attack' && globalThis.BarelDashAttack?.data?.hitbox) { const b = BarelDashAttack.data.hitbox; return { back: b.front, reach: b.reach, depth: b.depth, label: 'dash' }; }
  if (p.st === 'skill' && p.skill && BAREL_COMBAT.skills[p.skill]?.reachPx) { const s = BAREL_COMBAT.skills[p.skill]; return { back: -s.behindPx, reach: s.reachPx, depth: 38, label: p.skill }; }
  return null;
}
function drawHitboxDebug() {
  if (!hitboxDebug || !stage || !player) return;
  const p = player, EH = COMBAT_FRAME_DATA.enemies.hit;
  ctx.save(); ctx.lineWidth = 1; ctx.setLineDash([]);
  ctx.strokeStyle = 'rgba(255,255,0,.6)';              // 깊이 ±depthPx 줄
  for (const dy of [-EH.depthPx, EH.depthPx]) { ctx.beginPath(); ctx.moveTo(p.x - camX - 140, p.y + dy); ctx.lineTo(p.x - camX + 140, p.y + dy); ctx.stroke(); }
  const box = playerAttackBox();
  if (box) {                                         // 플레이어 공격: 적 중심이 이 안(+적 반폭)이면 맞는다
    const a = p.x + p.face * box.back, b = p.x + p.face * box.reach;
    ctx.strokeStyle = '#3dff7a'; ctx.strokeRect(Math.min(a, b) - camX, p.y - box.depth, Math.abs(b - a), box.depth * 2);
  }
  for (const e of enemies) {
    if (e.st === 'dead') continue;
    const h = (e.d.h || 96) * (e.d.s || 1);
    ctx.strokeStyle = '#4fc3ff'; ctx.strokeRect(e.x - (e.hw || 14) - camX, e.y - e.z - h, (e.hw || 14) * 2, h);   // 피격 박스
    const z = enemyAttackZone(e);
    if (z) { ctx.strokeStyle = z.active ? '#ffffff' : '#ff4fd8'; ctx.strokeRect(z.x0 - camX, z.yC - z.depth, z.x1 - z.x0, z.depth * 2); }
  }
  ctx.fillStyle = '#ffffff'; ctx.fillRect(p.x - camX - 1, p.y - 1, 3, 3);   // 플레이어 발 (판정 기준점)
  ctx.restore();
}
function drawHitboxDebugText() {
  if (!hitboxDebug || !stage || !player) return;
  const e = lastHit?.e, lines = [`hitStop ${hitStop}`, `tier ${lastHit?.tier || '-'}`,
    e ? `last: ${e.s1 || e.type} st=${e.st} hurtT=${e.hurtT ?? '-'} chainN=${e.chainN || 0}` : 'last: -'];
  ctx.save(); ctx.font = '11px monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(6, 6, 250, lines.length * 13 + 6);
  ctx.fillStyle = '#d8ffd8'; lines.forEach((l, i) => ctx.fillText(l, 10, 9 + i * 13));
  ctx.restore();
}
