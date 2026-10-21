const assert = require('node:assert/strict');
module.exports = async ({ evaluate, errors }) => {
  await evaluate("openBossChallenge(); new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))");
  assert.deepEqual(errors, [], 'Boss menu renders before a game starts');
  const result = await evaluate(`(() => {
    const check = (ok, message) => { if (!ok) throw Error(message); };
    localStorage.removeItem('bmk_records');
    openBossChallenge();
    check(document.querySelectorAll('#challengeList button:disabled').length === 5, 'Fresh save locks all bosses');
    beginBossChallenge(0); check(scene === 'challenge', 'Locked entry rejected');
    for (let i = 0; i < 5; i++) UX.record(i, 1000, 'A', 100);
    UX.saveCheckpoint({stage:2, score:1234, hp:67, lives:2, sp:50, mg:1, buff:0});
    const before = [localStorage.getItem('bmk_records'), localStorage.getItem('bmk_checkpoint')];
    openBossChallenge();
    check(document.querySelectorAll('#challengeList button:disabled').length === 0, 'Old records unlock bosses');
    for (let i = 0; i < 5; i++) {
      beginBossChallenge(i);
      check(scene === 'bossintro' && enemies.length === 1 && enemies[0].type === STAGES[i].boss, 'Correct boss spawned');
      check(waveIdx === stage.waves.length && camLock && camX > 0, 'Approach skipped');
      check(player.hp === 100 && player.sp === 100 && player.mg === 3, 'Fresh resources');
      pauseGame(); resumeGame(); check(scene === 'bossintro', 'Intro resumes');
      player.hp = 20; retryStage(); check(player.hp === 100 && bossChallenge, 'Challenge retry');
      finishStage(); check(scene === 'challengeResult', 'Dedicated result including final boss');
      check(localStorage.getItem('bmk_records') === before[0] && localStorage.getItem('bmk_checkpoint') === before[1], 'Campaign save preserved');
    }
    toTitle(); continueGame();
    check(!bossChallenge && stageIdx === 2 && player.hp === 67 && player.score === 1234, 'Campaign continues unchanged');
    return true;
  })()`);
  assert.equal(result, true);
  assert.deepEqual(errors, []);
  console.log('PASS Boss challenge unlocks, five arenas, retry, results and campaign save isolation');
};
