// $env:CHARACTER_SELECT_SUITE='1'; node tests/regression.cjs
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
module.exports=async({evaluate,call,errors,root})=>{
  const out=path.join(root,'artifacts/character-select');fs.mkdirSync(out,{recursive:true});
  await evaluate('requestAnimationFrame=()=>0;AUDIO.enable(false);BAREL_ATLAS.decode()');
  const result=await evaluate(`(()=>{
    const check=(v,m)=>{if(!v)throw Error(m);};
    toTitle();const saves=JSON.stringify({...localStorage});$('btnStart').click();
    check(scene==='characterSelect'&&$('characterSelect').classList.contains('show'),'New game opens selector');
    check(selectedCharacterId==='barel'&&!$('btnCharacterConfirm').disabled,'Barel is playable by default');
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
    toTitle();openCharacterSelect();drawCharacterPreview();
    const canvas=$('barelSelectPreview'),data=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
    check(data.some((n,i)=>i%4===3&&n>0),'Real player preview is drawn');
    // Opening a menu must not create or overwrite a checkpoint.
    const checkpoint=UX.checkpoint();openCharacterSelect();check(JSON.stringify(UX.checkpoint())===JSON.stringify(checkpoint),'Menu preserves checkpoint');
    return {flow:true,archerPlayable:true,preview:true,checkpointPreserved:true};
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
    await evaluate('openCharacterSelect();drawCharacterPreview()');
    // Resolve layout after resizing before measuring and capturing.
    const bounds=await evaluate(`(()=>{const r=id=>{const b=$(id).getBoundingClientRect();return {left:b.left,right:b.right,top:b.top,bottom:b.bottom};};return {screen:r('characterSelect'),left:r('characterBarel'),right:r('characterViesa'),confirm:r('btnCharacterConfirm'),status:r('characterSelectionStatus')};})()`);
    assert(bounds.left.right<bounds.right.left,'Two slots remain side by side');
    for(const id of ['left','right','confirm','status']){const b=bounds[id];assert(b.left>=0&&b.right<=width+1&&b.top>=0&&b.bottom<=height+1,'Fits viewport: '+id+' '+width);}
    result.layouts.push({width,height,bounds});
    assert(await evaluate(`(()=>{const im=$('viesaSelectPortrait').getBoundingClientRect(),name=$('characterViesa').querySelector('.character-name').getBoundingClientRect();return im.bottom<=name.top;})()`),'Full-body portrait stays above the character name');
    const shot=await call('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,`select-${width}.png`),Buffer.from(shot.data,'base64'));
  }
  await evaluate(`selectCharacter('viesa')`);
  const shot=await call('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,'viesa-selected.png'),Buffer.from(shot.data,'base64'));
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({...result,errors},null,2));
  console.log('PASS two playable character choices, keyboard, original opening, preview and four viewport layouts');
};
