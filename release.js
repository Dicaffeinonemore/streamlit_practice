'use strict';
// Presentation only: original world coordinates, collisions and save schema stay intact.
const releaseBG = { key: '', previous: '', blend: 1, tick: -1 };
const BOSS_COLORS = ['#e45b64', '#b67aeb', '#edc367', '#79d8ef', '#d269df'];
function releaseBackdropKey() {
  const n = stage ? stageIdx + 1 : 1;
  const boss = typeof enemies !== 'undefined' && enemies.find(e => e.boss);
  if (boss && boss.p2shown && [2, 4, 5].includes(n)) return 'phase' + n;
  if (boss) return 'boss' + n;
  if (n === 3 && player && player.x > stage.waves.at(-1).at - 350) return 'approach3';
  return 'field' + n;
}
function drawReleaseBackdrop(theme, scroll) {
  const key = releaseBackdropKey(), im = RELEASE_IMAGES[key];
  if (!im || !im.complete || !im.naturalWidth) return false;
  if (releaseBG.key !== key) {
    releaseBG.previous = releaseBG.key; releaseBG.key = key; releaseBG.blend = releaseBG.previous ? 0 : 1;
  }
  if (releaseBG.tick !== tick) { releaseBG.tick = tick; releaseBG.blend = Math.min(1, releaseBG.blend + (UX.options.lowFx ? 1 : .025)); }
  const paint = image => {
    const height = HORIZON + 4, scale = Math.max(W / image.naturalWidth, height / image.naturalHeight);
    const dw = image.naturalWidth * scale, dh = image.naturalHeight * scale;
    ctx.imageSmoothingEnabled = false;
    const offset = stage ? scroll : 0, first = Math.floor(offset / dw);
    for (let n = first; n * dw - offset < W; n++) {
      const left = Math.round(n * dw - offset), right = Math.round((n + 1) * dw - offset);
      ctx.save();
      ctx.translate(n % 2 ? right : left, height - dh);
      if (n % 2) ctx.scale(-1, 1);
      ctx.drawImage(image, 0, 0, right - left, dh);
      ctx.restore();
    }
  };
  const previous = RELEASE_IMAGES[releaseBG.previous];
  ctx.save();
  if (releaseBG.blend < 1 && previous?.naturalWidth) paint(previous);
  ctx.globalAlpha = releaseBG.blend; paint(im); ctx.restore();
  return true;
}
function drawBossBar(boss) {
  const x = 120, y = 442, w = 720;
  const frozen = scene === 'pause' || scene === 'settings';
  const now = tick;
  if (!boss.hud) boss.hud = { value: boss.hp, lag: boss.hp, lastHP: boss.hp, hold: 0, tick: now };
  const h = boss.hud;
  if (h.lastHP !== boss.hp) { h.hold = 28; h.lastHP = boss.hp; }
  if (!frozen && h.tick !== now) {
    h.tick = now; h.value += (boss.hp - h.value) * .22;
    if (h.hold > 0) h.hold--; else h.lag = Math.max(boss.hp, h.lag - boss.max * .008);
  }
  ctx.save();
  ctx.globalAlpha = boss.st === 'dead' ? clamp(1 - boss.t / 60, 0, 1) : boss.st === 'intro' ? clamp(introT / 600, 0, 1) : 1;
  const color = boss.p2shown ? '#ecd5ff' : BOSS_COLORS[stageIdx];
  panel(x, y, w, 38);
  krText(boss.d.name, W / 2, y + 14, color, 13, 'center');
  pxText(boss.p2shown ? 'II' : 'I', x + 10, y + 14, color, 10);
  lifeBar(x + 10, y + 21, w - 20, 10, clamp(h.value / boss.max, 0, 1), clamp(h.lag / boss.max, 0, 1), [color, BOSS_COLORS[stageIdx]]);
  const r = boss.st === 'stun' ? 1 - boss.t / GROGGY_TICKS : boss.gr / boss.grMax;
  ctx.fillStyle = '#cfab70'; rect(x + 10, y + 34, (w - 20) * clamp(r, 0, 1), 2);
  if (boss.st === 'reviving') krText(boss.t<155?'쓰러진 모르그라 · 어둠이 모입니다':'모르그라 부활 · 두 번째 전투', W / 2, y - 8, '#d8bfff', 13, 'center');
  else if (boss.phaseT > 0) krText('각성 · 잠시 후 공격이 재개됩니다', W / 2, y - 8, color, 13, 'center');
  else if (boss.st === 'pat') krText((boss.type==='boss2'?morgraMoves[boss.morgraMove]?.name:null)||boss.d.pats[boss.pat] || '', W / 2, y - 8, color, 13, 'center');
  ctx.restore();
}
let openingTime = 0;
const OPENING_LINES = ['붉은 월식이 다섯 왕국을 삼켰다.', '무너진 왕좌 너머, 검은 성채가 깨어난다.', '잿더미에서 한 기사가 일어섰다.', '다섯 군주가 밤의 문을 지킨다.', '대검을 들어, 끝나지 않는 밤을 가르라.', '흑월의 기사'];
function startOpening() {
  clearInput(); openingTime = 0; scene = 'opening'; showScreen(null); AUDIO.silence();
  $('openingSkip').hidden = false;
}
function finishOpening() {
  if (scene !== 'opening') return;
  $('openingSkip').hidden = true; clearInput(); beginGame();
}
function drawOpening() {
  const n = Math.min(5, Math.floor(openingTime / 3000)), t = (openingTime % 3000) / 3000;
  ctx.fillStyle = '#060409'; ctx.fillRect(0, 0, W, H);
  const im = RELEASE_IMAGES['opening' + n];
  ctx.save(); ctx.globalAlpha = Math.min(1, t * 6, (1 - t) * 6);
  if (im?.naturalWidth) {
    const zoom = UX.options.shake ? 1 + t * .035 : 1;
    const scale = Math.max(W / im.naturalWidth, H / im.naturalHeight) * zoom;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(im, (W - im.naturalWidth * scale) / 2, (H - im.naturalHeight * scale) / 2, im.naturalWidth * scale, im.naturalHeight * scale);
  }
  ctx.fillStyle = '#060409bb'; ctx.fillRect(0, H - 104, W, 104);
  krText(OPENING_LINES[n], W / 2, H - 64, '#f0dce0', n === 5 ? 32 : 20, 'center'); ctx.restore();
}
document.getElementById('openingSkip').onclick = finishOpening;
for (const [id, key] of [['btnStart', 'newgame'], ['btnContinue', 'continue'], ['btnTitleSettings', 'settings']]) {
  const b = document.getElementById(id); b.classList.add('art-button'); b.style.setProperty('background-image', `url("${RELEASE_ART[key]}")`, 'important');
}

