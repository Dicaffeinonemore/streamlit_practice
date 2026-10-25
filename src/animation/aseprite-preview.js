(async function () {
  'use strict';
  const status = document.getElementById('status');
  try {
    const $ = id => document.getElementById(id), A = AsepriteAnimation;
    const animation = await A.loadMetadata('assets/aseprite/tests/black-knight-basic-attack-350ms.animation.json');
    const m = animation.metadata, combat = m.combat, clip = animation.clips[m.clip];
    const canvas = $('preview'), ctx = canvas.getContext('2d');
    // Preview transport supplies external attack time; rendering never advances a player.
    // The game will use sampleActor(asset, player, MS), not this transport.
    const transport = { baseMs: 0, epoch: performance.now(), speed: 1, paused: false, loop: false };
    let face = 1;
    function timeAt(now) {
      const raw = transport.baseMs + (transport.paused ? 0 : Math.max(0, now - transport.epoch) * transport.speed);
      return transport.loop && !transport.paused ? raw % combat.durationMs : Math.min(combat.durationMs, raw);
    }
    function capture(now = performance.now()) { transport.baseMs = timeAt(now); transport.epoch = now; }
    function setPaused(value) {
      capture(); transport.paused = value; $('pause').textContent = value ? '계속 재생' : '일시정지';
    }
    $('play').disabled = $('pause').disabled = false;
    $('play').onclick = () => {
      transport.baseMs = 0; transport.epoch = performance.now(); transport.paused = false; $('pause').textContent = '일시정지';
    };
    $('pause').onclick = () => setPaused(!transport.paused);
    $('flip').onclick = () => { face *= -1; };
    $('speed').onchange = () => { capture(); transport.speed = Number($('speed').value); };
    $('loop').onchange = () => { capture(); transport.loop = $('loop').checked; };
    $('time').oninput = () => { setPaused(true); transport.baseMs = Number($('time').value); };
    document.addEventListener('visibilitychange', () => { if (document.hidden) setPaused(true); });
    $('time').max = combat.durationMs;
    $('hitBand').style.left = combat.activeStartMs / combat.durationMs * 100 + '%';
    $('hitBand').style.width = (combat.activeEndMs - combat.activeStartMs) / combat.durationMs * 100 + '%';
    $('linkMark').style.left = combat.comboLinkMs / combat.durationMs * 100 + '%';
    let start = 0;
    const rows = clip.frames.map((f, i) => {
      const tr = document.createElement('tr');
      for (const value of [i + 1, `${start}–${start + f.duration} (${f.duration})`, f.baseAnchor.join(', '), f.renderOffset.join(', '), `${m.groundAnalysis.bottomPixelY[i]} / ${m.groundAnalysis.soleCentroidX[i]}`]) {
        const td = document.createElement('td'); td.textContent = value; tr.append(td);
      }
      start += f.duration; $('frames').append(tr); return tr;
    });
    const smoothstep = u => { u = Math.max(0, Math.min(1, u)); return u * u * (3 - 2 * u); };
    function renderAt(elapsedMs) {
      const sample = A.sampleAttack(animation, elapsedMs), frame = sample.frame;
      const movement = m.movementReference;
      const worldDx = $('movement').checked ? movement.stepWorld * smoothstep((elapsedMs - movement.windMs) / movement.actMs) : 0;
      const scale = 1.8, x = 370 + face * worldDx * scale / movement.spriteScale, y = 340;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = '#71677e'; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(800, y); ctx.stroke();
      const drawn = $('offsets').checked ? frame : { ...frame, anchor: frame.anchor.map((v, i) => v + frame.renderOffset[i]) };
      A.draw(ctx, animation.image, drawn, { x, y, scale, face });
      ctx.strokeStyle = sample.active ? '#ff945e' : '#ffe294';
      ctx.beginPath(); ctx.moveTo(x - 9, y); ctx.lineTo(x + 9, y); ctx.moveTo(x, y - 10); ctx.lineTo(x, y + 10); ctx.stroke();
      const soleX = x + face * (m.groundAnalysis.soleCentroidX[frame.index] - frame.baseAnchor[0] + ($('offsets').checked ? frame.renderOffset[0] : 0)) * scale;
      ctx.fillStyle = '#8ee6cd'; ctx.fillRect(soleX - 2, y - 5, 4, 4);
      $('time').value = elapsedMs;
      rows.forEach((row, i) => row.classList.toggle('current', i === frame.index));
      status.classList.toggle('active', sample.active);
      status.textContent = `태그: ${clip.id} · ${elapsedMs.toFixed(1)} / ${clip.duration} ms · ${transport.paused ? '일시정지' : sample.ended ? '완료' : '재생 중'}\n프레임 ${frame.index + 1}/6 · ${frame.duration} ms · 기준점 [${frame.baseAnchor}] · 오프셋 [${frame.renderOffset}]\n공격 판정: ${sample.active ? '활성' : '비활성'} [${combat.activeStartMs}, ${combat.activeEndMs}) ms · 다음 콤보: ${sample.canLink ? '연결 가능' : '대기/종료'} (${combat.comboLinkMs} ms부터)\n월드 전진 참조: ${worldDx.toFixed(2)} / ${movement.stepWorld} · 표시 기준점 (${x.toFixed(1)}, ${y})`;
      return sample;
    }
    window.asepritePreview = { animation, transport, timeAt, renderAt };
    function render(now) { renderAt(timeAt(now)); requestAnimationFrame(render); }
    requestAnimationFrame(render);
  } catch (error) {
    status.textContent = error.message + '\n350ms 테스트 리소스와 메타데이터를 확인하세요.';
    window.asepritePreviewError = error.message;
  }
})();
