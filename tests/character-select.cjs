// $env:CHARACTER_SELECT_SUITE='1'; node tests/regression.cjs
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
module.exports=async({evaluate,call,errors,root})=>{
  const out=path.join(root,'artifacts/character-select');fs.mkdirSync(out,{recursive:true});
  await evaluate("AUDIO.enable(false);Promise.all([TitleMenu.ready, ...Array.from(document.querySelectorAll('#characterCards img'), image => image.decode())])");
  const result=await evaluate(`(()=>{
    const check=(v,m)=>{if(!v)throw Error(m);};
    toTitle();const saves=JSON.stringify({...localStorage});$('btnStart').click();
    check(scene==='characterSelect'&&$('characterSelect').classList.contains('show'),'New game opens selector');
    check(selectedCharacterId==='barel'&&!$('btnCharacterConfirm').disabled,'Barel is playable by default');
    check(document.querySelectorAll('#characterSelect .character-card').length===4,'The two supplied locked slots are shown');
    $('characterViesa').click();
    check(scene==='characterSelect'&&selectedCharacterId==='viesa'&&!$('btnCharacterConfirm').disabled,'Viesa is now playable');
    confirmCharacter();check(scene==='tutorial','Viesa selection leads to tutorial');$('btnHelpBack').click();
    selectCharacter('barel');$('btnCharacterConfirm').click();
    check(scene==='tutorial'&&helpFrom==='characterSelect'&&!$('btnHelpBack').hidden,'Selection leads to tutorial');
    $('btnHelpBack').click();check(scene==='characterSelect','Tutorial can return to selection');
    onKeyOnce('Escape');check(scene==='title','Escape returns to title');
    onKeyOnce('Enter');check(scene==='characterSelect','Title Enter opens selector');
    selectCharacter('viesa');onKeyOnce('Enter');check(scene==='tutorial','Enter confirms the archer');$('btnHelpBack').click();
    selectCharacter('barel');onKeyOnce('Enter');check(scene==='tutorial','Enter confirms playable hero');
    onKeyOnce('Enter');check(scene==='opening','Confirmed hero follows existing opening');
    onKeyOnce('Escape');check(scene==='intro'&&player.hp===100&&player.lives===3,'Barel starts normally');
    toTitle();openCharacterSelect();
    const locked=document.querySelector('#characterSelect .is-locked');
    locked.click();
    check($('btnCharacterConfirm').disabled&&locked.getAttribute('aria-pressed')==='true','Locked slots are inspectable but cannot start');
    locked.click();
    check(scene==='characterSelect'&&$('characterSelectionStatus').textContent,'Confirming a locked slot explains why it cannot start');
    // Opening a menu must not create or overwrite a checkpoint.
    const checkpoint=UX.checkpoint();openCharacterSelect();check(JSON.stringify(UX.checkpoint())===JSON.stringify(checkpoint),'Menu preserves checkpoint');
    return {flow:true,archerPlayable:true,lockedSlots:true,checkpointPreserved:true};
  })()`);
  // Actual focused-button arrow events use the selector handler, not combat input.
  await call('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39});
  await call('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39});
  assert.equal(await evaluate('selectedCharacterId'),'viesa');
  await call('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowLeft',code:'ArrowLeft',windowsVirtualKeyCode:37});
  await call('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowLeft',code:'ArrowLeft',windowsVirtualKeyCode:37});
  assert.equal(await evaluate('selectedCharacterId'),'barel');
  await call('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
  await call('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
  assert.equal(await evaluate('scene'),'tutorial','Enter confirms a focused character card');
  await evaluate('openCharacterSelect()');
  result.layouts=[];
  for(const [width,height] of [[1280,720],[960,540],[844,390],[390,844]]){
    await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
    await evaluate("openCharacterSelect();document.fonts.ready");
    await evaluate("new Promise(resolve => setTimeout(resolve, 950))");
    // Resolve layout after resizing before measuring and capturing.
    const bounds=await evaluate(`(()=>{const r=node=>{const b=node.getBoundingClientRect();return {left:b.left,right:b.right,top:b.top,bottom:b.bottom,width:b.width};};return {cards:characterCards.map(r),confirm:r($('btnCharacterConfirm'))};})()`);
    assert(bounds.cards[0].width > bounds.cards[1].width * 2.9,'Selected hero card expands');
    for (const b of [...bounds.cards, bounds.confirm]) {
      assert(b.left>=0&&b.right<=width+1&&b.top>=0&&b.bottom<=height+1,'Fits viewport: '+width);
    }
    result.layouts.push({width,height,bounds});
    const shot=await call('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,`select-${width}.png`),Buffer.from(shot.data,'base64'));
  }
  await evaluate(`$('menuLanguage').value = 'ko'; $('menuLanguage').onchange(); selectCharacter('viesa');new Promise(resolve => setTimeout(resolve, 950))`);
  assert.equal(await evaluate("$('btnCharacterConfirm').textContent"), '비에사로 여정 시작');
  const shot=await call('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,'viesa-selected.png'),Buffer.from(shot.data,'base64'));
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({...result,errors},null,2));
  console.log('PASS playable and locked cards, keyboard, original opening, portrait assets and four viewport layouts');
};
