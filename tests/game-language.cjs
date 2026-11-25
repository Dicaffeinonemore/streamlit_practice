const { strict: assert } = require('node:assert');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');

async function verify() {
  const csv = '\uFEFFkeys,en,ko\r\nPROMPT,"Press ""%s"", %s","%s, %s 누르기"\r\nNAME,Name,이름\r\n';
  const context = { fetch: async () => new Response(csv) };
  const code = readFileSync(join(__dirname, '..', 'game-language.js'), 'utf8');
  const catalog = vm.runInNewContext(code + '\nGameLanguage', context);
  await catalog.ready;
  assert.equal(catalog.text('en', 'PROMPT', 'X', 'Y'), 'Press "X", Y');
  assert.equal(catalog.localize('en', '%s, %s 누르기', 'X', 'Y'), 'Press "X", Y');
  assert.equal(catalog.localize('ko', '이름'), '이름');
  assert.equal(catalog.localize('en', '123'), '123');
  assert.equal(catalog.text('en', 'unknown'), '');
}

verify().catch(error => { console.error(error); process.exitCode = 1; });
