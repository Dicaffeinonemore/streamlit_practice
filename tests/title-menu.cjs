const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

module.exports = async ({ evaluate, call, errors, root }) => {
  const output = path.join(root, 'artifacts', 'lunatic-title');
  fs.mkdirSync(output, { recursive: true });
  await evaluate("Promise.all([TitleMenu.ready, $('namedTitleImage').decode(), $('titleSelection').decode()])");
  const key = async (name, keyCode) => {
    for (const type of ['keyDown', 'keyUp'])
      await call('Input.dispatchKeyEvent', { type, key: name, code: name, windowsVirtualKeyCode: keyCode });
  };
  for (const [width, height] of [[1672, 941], [844, 390], [390, 844]]) {
    await call('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
    const centers = await evaluate(`(() => {
      const image = $('namedTitleImage').getBoundingClientRect();
      return Array.from(document.querySelectorAll('.title-choice'), b => {
        const r = b.getBoundingClientRect();
        return Math.round((r.top + r.height / 2 - image.top) / image.height * 941);
      });
    })()`);
    assert.deepEqual(centers, [394, 460, 521, 582, 642, 703]);
    const shot = await call('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(output, 'web-' + width + '.png'), Buffer.from(shot.data, 'base64'));
  }
  assert.equal(await evaluate("$('btnContinue').disabled"), true);
  // Continue is disabled, so the first step lands on Boss Challenge, the next on Options.
  await key('ArrowDown', 40);
  assert.equal(await evaluate('document.activeElement.id'), 'btnBossChallenge');
  await key('ArrowDown', 40);
  await key('Enter', 13);
  assert.equal(await evaluate('scene'), 'settings');
  await evaluate("$('menuLanguage').value = 'ko'; $('menuLanguage').onchange(); $('btnSettingsBack').click()");
  assert.equal(await evaluate("$('btnStart').textContent"), '새 게임');
  await evaluate("$('btnCredits').click()");
  assert.equal(await evaluate("$('titleInfoHeading').textContent"), '제작진');
  await key('Escape', 27);
  await evaluate("$('btnExit').click()");
  assert.equal(await evaluate("$('titleInfoBody').textContent"), '이제 이 탭을 닫아도 됩니다.');
  await evaluate("$('btnInfoBack').click(); beginGame(); toTitle()");
  assert.equal(await evaluate("$('btnContinue').disabled"), false);
  await evaluate("$('btnContinue').click()");
  assert.ok(['play', 'intro'].includes(await evaluate('scene')));
  assert.deepEqual(errors, []);
  console.log('PASS title positions at three sizes, Boss Challenge item, keyboard, language, credits, exit and saved Continue');
};
