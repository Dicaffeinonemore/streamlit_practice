// $env:VARGUL_STAGE4='1'; node tests/regression.cjs
// Reuse Stage3's real update/input controllers; only the requested cases run.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
module.exports=async({evaluate,call,errors,root})=>{
  const out=path.join(root,'artifacts/vargul-1.36/stage4');fs.mkdirSync(out,{recursive:true});
  const baseline=JSON.parse(fs.readFileSync(path.join(root,'artifacts/vargul-1.36/stage3/art-baseline.json'),'utf8'));
  for(const [name,entry] of Object.entries(baseline))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,name))).digest('hex'),entry.sha256,name+' frozen');
  const stage3=JSON.parse(fs.readFileSync(path.join(root,'artifacts/vargul-1.36/stage3/results.json'),'utf8'));
  await evaluate(`window.trialRAF=requestAnimationFrame.bind(window);requestAnimationFrame=()=>0;AUDIO.enable(false);beginGame();showScreen(null);Promise.all([VARGUL_READY,AURELION_READY])`);
  await evaluate(`(${require('./vargul-stage3.cjs').installTrial.toString()})()`);
  const result={version:'1.36',stage:4,date:'2026-10-20',artUnchanged:true,aurelionStage3:stage3.kill.find(v=>v.type==='boss3'&&!v.passive)};
  console.log('Stage4 targeted counters, dodge limits, timelines and interruption contracts');
  result.targeted=await evaluate('VargulTrial.stage4()');
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(result,null,2));
  console.log('Stage4 Vargul kill, actual AI, seed1360303 and unchanged Stage3 input');
  result.kill=await evaluate("VargulTrial.kill({types:['boss4'],passives:[false]})");
  result.killRepeat=await evaluate("VargulTrial.kill({types:['boss4'],passives:[false]})");
  assert.deepEqual(result.kill,result.killRepeat,'Vargul fixed-input reproducibility');
  await evaluate(`(()=>{clearInput();player=newPlayer();startStage(3);scene='play';showScreen(null);camX=lockAt=0;camLock=true;waveIdx=stage.waves.length;arena=null;barrels=[];hazards=[];items=[];enemies=[mkEnemy('boss4',410,430)];const e=enemies[0];e.p2shown=true;e.hp=e.max=2500;player.x=220;player.y=398;player.inv=999999;startPat(e,'cross');for(let i=0;i<68;i++){hitStop=0;update();}shake=flashT=0;render();})()`);
  const shot=await call('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,'cross-full-width.png'),Buffer.from(shot.data,'base64'));
  result.consoleErrors=errors;assert.deepEqual(errors,[],'No browser console errors');
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(result,null,2));
  console.log('PASS Stage4 requested measurements: '+out);
};
