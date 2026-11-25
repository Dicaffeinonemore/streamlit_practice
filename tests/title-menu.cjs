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
  assert.deepEqual(await evaluate("Array.from(document.querySelectorAll('.title-choice'), b => b.textContent)"),
    ['New Game', 'Continue', 'Boss Challenge', 'Options', 'Credits', 'Exit']);
  await key('ArrowDown', 40);
  await key('Enter', 13);
  assert.equal(await evaluate('scene'), 'challenge');
  assert.equal(await evaluate("document.querySelectorAll('#challengeList button:disabled').length"), 5);
  await key('Escape', 27);
  await key('ArrowDown', 40);
  await key('ArrowDown', 40);
  await key('Enter', 13);
  assert.equal(await evaluate('scene'), 'settings');
  assert.equal(await evaluate("$('musicVolume').getAttribute('aria-label')"), 'Music volume');
  assert.match(await evaluate("$('settingsKeyboard').getAttribute('aria-label')"), /^Keyboard layout: /);
  assert.match(await evaluate("$('recordSummary').textContent"), /first record/);
  await evaluate("$('menuLanguage').value = 'ko'; $('menuLanguage').onchange()");
  assert.equal(await evaluate("document.documentElement.lang"), 'ko');
  assert.equal(await evaluate("$('musicVolume').getAttribute('aria-label')"), '음악 음량');
  assert.match(await evaluate("$('presetDesc').textContent"), /방향키/);
  assert.equal(await evaluate("UX.menuLanguage()"), 'ko');
  await evaluate("$('btnSettingsBack').click()");
  assert.equal(await evaluate("$('btnStart').textContent"), '새 게임');
  await evaluate("UX.record(0, 500, 'A', 60); $('btnBossChallenge').click()");
  assert.equal(await evaluate("document.querySelectorAll('#challengeList button:enabled').length"), 1);
  await evaluate("$('challengeList').firstElementChild.click()");
  assert.equal(await evaluate('scene'), 'characterSelect');
  await evaluate("$('characterViesa').click(); $('btnCharacterConfirm').click()");
  assert.equal(await evaluate("bossChallenge && player.characterId === 'viesa'"), true);
  await evaluate("toTitle()");
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
  console.log('PASS six title choices at three sizes, keyboard, localized settings, locked and unlocked challenges, credits, exit and saved Continue');
};
