// Phase 13: runs the exported Windows build twice (write, then read) through phase13/export_probe.gd (attached by game.gd).
// The real user:// saves of "Black Moon Knight" are moved aside first and put back afterwards.
//   node godot/phase13/tools/verify_windows.cjs
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const godot = path.resolve(__dirname, '../..');
const exe = path.join(godot, 'build/windows/BlackMoonKnight.exe');
const out = path.join(godot, 'evidence/phase13/windows');
const userDir = path.join(process.env.APPDATA, 'Godot/app_userdata/Black Moon Knight');
const backup = fs.mkdtempSync(path.join(os.tmpdir(), 'bmk-phase13-saves-'));
const saveFiles = name => /^(bmk_|boss_bgm)/.test(name);

fs.mkdirSync(out, { recursive: true });
let failures = 0;
const moved = [];
try {
  if (!fs.existsSync(exe)) throw Error('Export first: ' + exe);
  if (fs.existsSync(userDir)) for (const name of fs.readdirSync(userDir).filter(saveFiles)) {
    fs.renameSync(path.join(userDir, name), path.join(backup, name));
    moved.push(name);
  }
  for (const mode of ['write', 'read']) {
    const run = spawnSync(exe, ['--', '--export-probe=' + mode, '--out=' + out], { timeout: 120000, windowsHide: false });
    const report = path.join(out, `probe_${mode}.json`);
    if (!fs.existsSync(report)) { console.error(`${mode}: no report (exit ${run.status})`); failures++; continue; }
    const r = JSON.parse(fs.readFileSync(report, 'utf8'));
    console.log(`${mode}: exit ${run.status}, ${r.checks.length} checks, ${r.failures} failures`);
    for (const c of r.checks.filter(c => !c.ok)) console.log('  FAIL ' + c.label);
    failures += r.failures + (run.status === 0 ? 0 : 1);
  }
} catch (e) { console.error(e.message); failures++; }
finally {
  if (fs.existsSync(userDir)) for (const name of fs.readdirSync(userDir).filter(saveFiles)) fs.rmSync(path.join(userDir, name));
  for (const name of moved) fs.renameSync(path.join(backup, name), path.join(userDir, name));
  fs.rmSync(backup, { recursive: true, force: true });
  console.log(`restored ${moved.length} save file(s)`);
}
process.exitCode = failures ? 1 : 0;
