// $env:DEATH_FADE_SUITE='1'; node tests/regression.cjs
const assert=require('node:assert/strict');
module.exports=async({evaluate,errors})=>{
  await evaluate('requestAnimationFrame=()=>0;AUDIO.enable(false);Promise.all([VIESA_READY,AURELION_READY,BAREL_ATLAS.decode()])');
  const result=await evaluate(`(()=>{
    const measure=draw=>{
      ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,ctx.canvas.width,ctx.canvas.height);ctx.restore();
      draw();const pixels=ctx.getImageData(0,0,ctx.canvas.width,ctx.canvas.height).data;
      let alpha=0;for(let i=3;i<pixels.length;i+=4)alpha+=pixels[i];return alpha;
    };
    camX=0;tick=0;aurelionDebug=false;ctx.setTransform(RENDER_K,0,0,RENDER_K,0,0);
    const result={};
    for(const id of ['viesa','barel']){
      player=newPlayer(0,id);Object.assign(player,{x:450,y:420,z:0,st:'dead',buff:100,inv:0,flash:0});
      result[id]=[65,82,100].map(t=>{player.t=t;return measure(()=>drawPlayer());});
      player.st='free';player.t=0;result[id+'Respawn']=measure(()=>drawPlayer());
    }
    const e=mkEnemy('boss3',450,420);Object.assign(e,{st:'dead',p2shown:true,flash:0});
    const end=aurelionMoves.death.total_frames;
    result.aurelion=[end,end+25,end+50].map(t=>{e.t=t;return measure(()=>drawAurelion(e));});
    e.st='chase';result.aurelionAlive=measure(()=>drawAurelion(e));
    e.st='dead';e.t=end+49;updEnemy(e);result.aurelionRemoved=e.remove;
    return result;
  })()`);
  for(const id of ['viesa','barel','aurelion']){
    const [start,middle,end]=result[id];
    assert(start>0&&middle>0&&middle<start,'Progressive body and shadow fade: '+id);
    assert.equal(end,0,'No body, shadow or power aura remains: '+id);
  }
  assert(result.viesaRespawn>0&&result.barelRespawn>0&&result.aurelionAlive>0,'Living characters stay visible');
  assert(result.aurelionRemoved,'Boss removal timing preserved');assert.deepEqual(errors,[]);
  console.log('PASS Viesa/Barel/Aurelion progressive death transparency, shadow cleanup, living visibility and boss removal');
};
