const assert=require('node:assert/strict');
module.exports=async({evaluate,errors})=>{
  for(const name of ['BarelIdle','BarelWalk','BarelComboFx','BarelAirAttack'])
    assert.equal(await evaluate(`${name}.ready`),true,`${name} loaded`);
  const result=await evaluate(`(()=>{
    AUDIO.enable(false);beginGame();showScreen(null);
    selectedCharacterId='barel';player=newPlayer(0,'barel');startStage(0);scene='play';
    player.x=300;player.y=420;player.z=0;player.st='free';player.walk=false;
    const idle=[0,130,650,1299,2600].map(t=>BarelIdle.frameFor(player,t).index);
    const previews=[0,650,1300].map(t=>BarelIdle.preview(t).frame.index);
    const footCanvas=document.createElement('canvas');footCanvas.width=160;footCanvas.height=71;
    const footCtx=footCanvas.getContext('2d');
    const feet=Array.from({length:10},(_,i)=>{
      const f=BarelIdle.frameFor(player,i*130);footCtx.clearRect(0,0,160,71);
      footCtx.drawImage(f.image,f.atlas[0]+120,f.atlas[1]+377,160,71,0,0,160,71);
      return Array.from(footCtx.getImageData(0,0,160,71).data).join(',');
    });
    player.walk=true;
    const walks=Array.from({length:10},(_,i)=>{player.walkTime=i*90;const f=barelPlayerFrame();return {index:f.index,src:f.image.src};});
    player.walk=false;player.st='atk';player.atk='air';player.z=100;player.vz=0;
    const frames=[0,40,80,120,160,200,240].map(t=>{player.t=t/MS;return BarelComboFx.frameFor(player,MS)?.index??null;});
    let draws=0;const old=ctx.drawImage;ctx.drawImage=function(...args){draws++;return old.apply(this,args)};
    const rendered=[1,-1].map(face=>{player.face=face;player.t=2;return BarelComboFx.draw(player,MS)});
    ctx.drawImage=old;
    player.z=0;const landed=BarelComboFx.frameFor(player,MS);
    player.st='free';player.walk=false;player.z=0;const x=player.x,y=player.y;
    for(let i=0;i<120;i++)update();
    return {idle,previews,feetFixed:feet.every(f=>f===feet[0]),walks,frames,rendered,draws,landed,position:[player.x-x,player.y-y]};
  })()`);
  assert.deepEqual(result.idle,[0,1,5,9,0]);
  assert.deepEqual(result.previews,[0,5,0]);
  assert.equal(result.feetFixed,true);
  assert.deepEqual(result.walks.map(x=>x.index),[0,1,2,3,4,5,6,7,8,9]);
  assert(result.walks.every(x=>x.src.includes('barel-walk-revised-10.png')));
  assert.deepEqual(result.frames,[0,1,2,3,4,5,null]);
  assert.deepEqual(result.rendered,[true,true]);assert.equal(result.draws,2);
  assert.equal(result.landed,null);assert.deepEqual(result.position,[0,0]);
  assert.deepEqual(errors,[]);
  console.log('PASS revised Barel: idle loop, ten walk frames, airborne attack FX in both directions');
};
