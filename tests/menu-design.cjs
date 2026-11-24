'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const http = require('node:http');
let playwright;
try { playwright = require('playwright'); }
catch { playwright = require(process.env.PLAYWRIGHT_MODULE || path.join(require('node:os').homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }
const { chromium } = playwright;
const root = path.resolve(__dirname, '..');
const mime = {'.html':'text/html', '.js':'text/javascript', '.json':'application/json', '.csv':'text/csv', '.webp':'image/webp', '.png':'image/png', '.css':'text/css'};
const server = http.createServer((req, res) => {
  const name = decodeURIComponent(new URL(req.url, 'http://localhost').pathname).replace(/^\/+/, '') || 'index.html';
  const file = path.resolve(root, name);
  if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  fs.readFile(file, (err, data) => { if (err) { res.writeHead(404).end(); return; } res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream'); res.end(data); });
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({headless:true, executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  try {
    const page = await browser.newPage({viewport:{width:1280,height:720}});
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await page.waitForFunction(() => document.querySelector('#btnTitleSettings').textContent.trim().length > 0);
    const out = path.join(root,'artifacts','menu-implementation');
    fs.mkdirSync(out, {recursive:true});
    // Boss Challenge is a title menu item now, directly under Continue.
    const titleIds = await page.$$eval('.title-choice', list => list.map(b => b.id));
    assert.deepEqual(titleIds, ['btnStart','btnContinue','btnBossChallenge','btnTitleSettings','btnCredits','btnExit']);
    await page.screenshot({path:path.join(out,'web-title.png')});
    await page.locator('#btnTitleSettings').click();
    await page.locator('#settings.show').waitFor();
    const wrap = await page.locator('#wrap').boundingBox();
    const settings = await page.locator('#settings .settings-panel').boundingBox();
    assert.ok(settings && settings.x > wrap.x + wrap.width * .5, 'settings panel is on the right');
    assert.equal(await page.locator('#btnBossChallenge').isVisible(), false, 'no boss challenge inside options');
    assert.ok(await page.evaluate(() => document.activeElement.id === 'menuLanguage'), 'language row is focused first');
    const rows = await page.$$eval('#settings .settings-page[data-page="main"] > .menu-row .row-label', list => list.map(r => r.dataset.menu));
    assert.deepEqual(rows, ['OPT_LANGUAGE','OPT_MUSIC','OPT_SOUND','OPT_BOSS_BGM','OPT_DISPLAY','OPT_MOBILE','OPT_CONTROLS','OPT_BACK']);
    for (const r of await page.$$('#settings .settings-page[data-page="main"] > .menu-row')) {
      const box = await r.boundingBox();
      assert.ok(box.y >= settings.y && box.y + box.height <= settings.y + settings.height + 1, 'main rows fit without scrolling');
    }
    assert.match(await page.locator('#musicVolume + output').innerText(), /^\d+%$/);
    await page.screenshot({path:path.join(out,'web-settings.png')});
    await page.keyboard.press('ArrowRight');
    assert.equal(await page.locator('#menuLanguage').inputValue(), 'ko', 'right arrow changes the language');
    assert.equal(await page.locator('[data-page="main"] [data-menu="OPT_MUSIC"]').innerText(), '음악');
    await page.keyboard.press('ArrowDown');
    assert.ok(await page.evaluate(() => document.activeElement.id === 'musicVolume'), 'down arrow moves to music');
    await page.locator('[data-go="controls"]').click();
    assert.ok(await page.locator('#bindings').isVisible(), 'controls page shows the key bindings');
    await page.screenshot({path:path.join(out,'web-controls.png')});
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#settings .settings-panel').getAttribute('data-page'), 'main', 'Esc goes back one page');
    await page.locator('#btnSettingsBack').click();
    assert.equal(await page.locator('#btnStart').innerText(), '새 게임');
    await page.locator('#btnStart').click();
    await page.locator('#btnCharacterConfirm').click();
    await page.locator('#btnGo').click();
    await page.locator('#openingSkip').click();
    await page.waitForTimeout(800);
    await page.keyboard.press('Escape');
    await page.locator('#pause.show').waitFor();
    const panel = await page.locator('#pause .pause-panel').boundingBox();
    assert.ok(panel && panel.x < wrap.x + wrap.width * .1 && panel.y >= wrap.y + wrap.height * .3, 'pause panel is lower left');
    assert.equal(await page.locator('#btnResume .row-label').innerText(), 'RESUME');
    assert.equal(await page.locator('#btnResume .row-sub').innerText(), '게임 계속하기');
    assert.ok(await page.evaluate(() => document.activeElement.id === 'btnResume'), 'resume is focused');
    await page.screenshot({path:path.join(out,'web-pause.png')});
    await page.keyboard.press('ArrowDown');
    assert.ok(await page.evaluate(() => document.activeElement.id === 'btnPauseHelp'), 'down arrow moves to controls');
    await page.locator('#btnPauseSettings').click();
    await page.locator('#settings.show').waitFor();
    await page.selectOption('#menuLanguage', 'en');
    await page.locator('#btnSettingsBack').click();
    assert.ok(await page.locator('#pause.show').isVisible(), 'settings returns to pause');
    assert.equal(await page.locator('#btnResume .row-label').innerText(), 'RESUME', 'pause rows stay bilingual');
    await page.locator('#btnResume').click();
    assert.equal(await page.locator('#pause').isVisible(), false, 'resume closes pause');
    await page.setViewportSize({width:844,height:390});
    await page.keyboard.press('Escape');
    await page.locator('#pause.show').waitFor();
    const mobilePanel = await page.locator('#pause .pause-panel').boundingBox();
    const mobileWrap = await page.locator('#wrap').boundingBox();
    assert.ok(mobilePanel.x >= mobileWrap.x && mobilePanel.y >= mobileWrap.y - 1 && mobilePanel.y + mobilePanel.height <= mobileWrap.y + mobileWrap.height + 1, 'pause fits a phone-sized viewport');
    await page.screenshot({path:path.join(out,'web-pause-phone.png')});
    await page.locator('#btnPauseSettings').click();
    await page.screenshot({path:path.join(out,'web-settings-phone.png')});
    console.log('Menu layout, language and navigation: OK');
  } finally { await browser.close(); server.close(); }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
