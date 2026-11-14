// $env:CONTROLS_DEMO_SUITE='1'; node tests/regression.cjs
// 키 배치 프리셋 3종(오락실 / WASD / 사용자 설정), 키보드 그림, 조작 안내 시범 플레이를 확인한다.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
module.exports=async({evaluate,call,errors,root,base,ready})=>{
  const out=path.join(root,'artifacts/controls-demo');fs.mkdirSync(out,{recursive:true});
  const shot=async name=>{const r=await call('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,name+'.png'),Buffer.from(r.data,'base64'));};
  const key=async code=>{await call('Input.dispatchKeyEvent',{type:'keyDown',code,key:code});};
  const keyUp=async code=>{await call('Input.dispatchKeyEvent',{type:'keyUp',code,key:code});};
  await evaluate('requestAnimationFrame=()=>0;AUDIO.enable(false);localStorage.clear();Promise.all([BAREL_ATLAS.decode(),VIESA_READY])');

  const presets=await evaluate(`(()=>{
    const check=(v,m)=>{if(!v)throw Error(m);};
    check(UX.options.keyPreset==='arcade','Arcade preset is the default');
    check(UX.mapKey('KeyZ')==='KeyJ'&&UX.mapKey('KeyX')==='Space'&&UX.mapKey('KeyC')==='KeyK'&&UX.mapKey('ArrowLeft')==='KeyA','Arcade: arrows + Z X C');
    check(UX.mapKey('KeyA')==='KeyI'&&UX.mapKey('KeyS')==='KeyU'&&UX.mapKey('KeyD')==='KeyH','Arcade: A S D');
    check(UX.mapKey('KeyV')===''&&UX.mapKey('KeyJ')===''&&UX.mapKey('ControlLeft')==='','Arcade has no hidden aliases');
    UX.setPreset('wasd');
    check(UX.mapKey('KeyW')==='KeyW'&&UX.mapKey('KeyJ')==='KeyJ'&&UX.mapKey('KeyK')==='Space'&&UX.mapKey('KeyL')==='KeyI'&&UX.mapKey('Space')==='KeyK','WASD + J K L');
    check(UX.mapKey('ArrowLeft')==='KeyA'&&UX.mapKey('KeyZ')==='KeyJ'&&UX.mapKey('ControlLeft')==='Space','WASD keeps arrow/Z/Ctrl aliases');
    openSettings('title');
    check(document.querySelectorAll('#settingsKeyboard .kb-key').length===49,'Settings keyboard drawn');
    check([...document.querySelectorAll('#bindings button')].every(b=>b.disabled),'Preset keys are read-only');
    check(document.querySelector('[data-preset="wasd"]').classList.contains('on'),'Active preset tab');
    const jKey=document.querySelector('#settingsKeyboard [data-code="KeyJ"]');
    check(jKey.classList.contains('kb-attack')&&jKey.textContent.includes('공격'),'Keyboard labels J as attack');
    document.querySelector('[data-preset="custom"]').click();
    check(UX.options.keyPreset==='custom'&&UX.options.bindings.KeyK==='Space','Custom starts from the current layout');
    check([...document.querySelectorAll('#bindings button')].every(b=>!b.disabled)&&!$('customTools').hidden,'Custom keys are editable');
    document.querySelectorAll('#bindings button')[5].click();                       // 공격
    document.querySelector('#settingsKeyboard [data-code="KeyF"]').click();           // 키보드 그림에서 고르기
    check(UX.options.bindings.KeyJ==='KeyF'&&UX.mapKey('KeyF')==='KeyJ','Keyboard click assigns a key');
    check(UX.mapKey('KeyZ')==='KeyJ','Unused Z stays an attack alias in custom');
    document.querySelectorAll('#bindings button')[4].click();                         // 점프 → ←
    document.querySelector('#settingsKeyboard [data-code="ArrowLeft"]').click();
    check(UX.options.bindings.Space==='ArrowLeft'&&UX.mapKey('ArrowLeft')==='Space','Arrow keys can be bound; alias yields');
    const saved=JSON.parse(localStorage.getItem('bmk_settings'));
    check(saved.keyPreset==='custom'&&saved.customBindings.KeyJ==='KeyF','Custom layout saved');
    document.querySelector('[data-preset="arcade"]').click();
    check(UX.mapKey('KeyZ')==='KeyJ'&&UX.options.customBindings.KeyJ==='KeyF','Switching presets keeps the custom layout');
    document.querySelector('[data-preset="custom"]').click();
    check(UX.options.bindings.KeyJ==='KeyF','Custom layout comes back');
    return true;
  })()`);
  assert.equal(presets,true);await evaluate("document.querySelector('.keys-title').scrollIntoView()");await shot('settings-custom');
  await evaluate(`document.querySelector('[data-preset="arcade"]').click();document.querySelector('.keys-title').scrollIntoView()`);await shot('settings-arcade');
  await evaluate(`document.querySelector('[data-preset="wasd"]').click();document.querySelector('.keys-title').scrollIntoView()`);await shot('settings-wasd');
  console.log('PASS Arcade / WASD / custom presets, keyboard picture and saved custom layout');

  // 실제 키보드: 오락실 배치에서 Z 공격, 방향키 이동
  await evaluate(`document.querySelector('[data-preset="arcade"]').click();closeSettings();toTitle();player=newPlayer();startStage(0);scene='play';showScreen(null);hitStop=0;clearInput()`);
  await key('KeyZ');assert.equal(await evaluate('updPlayer();player.st'),'atk','Arcade Z attacks');await keyUp('KeyZ');
  await evaluate('clearInput();player.st="free";player.t=0;player.atk=null');
  await key('ArrowRight');const x0=await evaluate('player.x');await evaluate('for(let i=0;i<10;i++)updPlayer()');
  assert(await evaluate('player.x')>x0,'Arcade arrow moves');await keyUp('ArrowRight');
  console.log('PASS Physical keys follow the arcade preset');

  // 시범 플레이: 모든 동작이 실제로 나온다
  const states=await evaluate(`(()=>{
    toTitle();openCharacterSelect();selectCharacter('barel');confirmCharacter();
    if(scene!=='tutorial'||!DEMO.on)throw Error('Demo starts with the tutorial');
    const seen=DEMO.steps.map(()=>new Set());let guard=0;
    const run=()=>{update();for(const k in pressed){pressed[k]-=MS;if(pressed[k]<=0)delete pressed[k];}seen[DEMO.i].add(player.st+(player.st==='skill'?':'+player.skill:''));};
    while(DEMO.i<DEMO.steps.length-1&&guard++<20000)run();
    while(DEMO.i===DEMO.steps.length-1&&guard++<20000)run();
    return seen.map(s=>[...s].join(','));
  })()`);
  const want=['walk|free','free','atk','dash','atk','skill:thrust','skill:slam','skill:whirl','skill:leap','skill:redwave','special','cast'];
  states.forEach((s,i)=>assert(new RegExp(want[i]).test(s),`Demo step ${i+1} shows ${want[i]} (saw ${s})`));
  assert.equal(await evaluate('DEMO.i'),0,'Demo loops back to the first move');
  for(const i of [2,10]){await evaluate(`demoStep(${i});for(let n=0;n<${i===10?60:28};n++){update();for(const k in pressed){pressed[k]-=MS;if(pressed[k]<=0)delete pressed[k];}}render();demoPresent()`);
    await call('Emulation.setDeviceMetricsOverride',{width:1280,height:720,deviceScaleFactor:1,mobile:false});await shot('demo-barel-'+(i+1));}
  console.log('PASS Barel demo plays all '+states.length+' moves: '+states.map((s,i)=>(i+1)+':'+s).join(' | '));

  const viesa=await evaluate(`(()=>{
    $('btnHelpBack').click();selectCharacter('viesa');confirmCharacter();
    const seen=new Set();let guard=0;
    while(DEMO.i<DEMO.steps.length-1&&guard++<20000){update();for(const k in pressed){pressed[k]-=MS;if(pressed[k]<=0)delete pressed[k];}seen.add(player.st);}
    return {char:DEMO.char,steps:DEMO.steps.length,seen:[...seen]};
  })()`);
  assert.equal(viesa.char,'viesa');assert(viesa.seen.includes('skill')||viesa.seen.length>3,'Viesa demo acts: '+viesa.seen);
  console.log('PASS Viesa demo: '+viesa.seen.join(','));

  // 일시정지 중 조작 안내: 진행 중인 판이 그대로 돌아온다
  const restored=await evaluate(`(()=>{
    $('btnHelpBack').click();selectCharacter('barel');confirmCharacter();$('btnGo').click();finishOpening();
    scene='play';player.x=333;player.hp=55;enemies.push(mkEnemy('grunt',500,420));const p=player,e=enemies.length,cam=camX;
    pauseGame();$('btnPauseHelp').click();
    if(!DEMO.on||player===p)throw Error('Demo uses its own hero');
    for(let n=0;n<200;n++)update();
    $('btnHelpBack').click();
    return scene==='pause'&&!DEMO.on&&player===p&&p.x===333&&p.hp===55&&enemies.length===e&&camX===cam;
  })()`);
  assert.equal(restored,true,'Pause → help → back restores the run');
  console.log('PASS Help from pause keeps the current run');
  for(const [w,h] of [[390,844],[844,390],[2560,1440]]){
    await call('Emulation.setDeviceMetricsOverride',{width:w,height:h,deviceScaleFactor:1,mobile:false});
    await evaluate(`toTitle();openCharacterSelect();confirmCharacter();for(let n=0;n<40;n++)update();render();demoPresent()`);await shot('demo-'+w);
  }
  await call('Emulation.setDeviceMetricsOverride',{width:1280,height:720,deviceScaleFactor:1,mobile:false});
  // 이전 저장(프리셋 없음): 그 키 그대로 사용자 설정이 된다. 보조 키·실제 키보드 입력까지 확인
  await evaluate(`localStorage.setItem('bmk_settings',JSON.stringify({music:.5,bindings:{KeyA:'KeyA',KeyD:'KeyD',KeyW:'KeyW',KeyS:'KeyS',Space:'Space',KeyJ:'KeyL',ShiftLeft:'ShiftLeft',KeyK:'KeyK',KeyI:'KeyI',KeyU:'KeyU',KeyH:'KeyH',KeyO:'KeyO',KeyP:'KeyP'}}))`);
  await ready(base+'/embedded.html');await evaluate('requestAnimationFrame=()=>0;AUDIO.enable(false)');
  assert.equal(await evaluate("UX.options.keyPreset==='custom'&&UX.options.bindings.KeyJ==='KeyL'&&UX.options.bindings.KeyL==='KeyB'&&UX.mapKey('KeyZ')==='KeyJ'&&UX.mapKey('ArrowUp')==='KeyW'"),true,'Legacy save becomes custom');
  await evaluate('player=newPlayer();startStage(0);scene="play";showScreen(null);hitStop=0;clearInput()');
  await key('KeyL');assert.equal(await evaluate('updPlayer();player.st'),'atk','Legacy remapped key attacks');await keyUp('KeyL');
  console.log('PASS Old saves keep their keys as the custom layout');
  assert.deepEqual(errors,[]);
};
