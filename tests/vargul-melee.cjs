// $env:VARGUL_MELEE_SUITE='1'; node tests/regression.cjs
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
module.exports=async({evaluate,call,errors,root})=>{
  const out=path.join(root,'artifacts/vargul-melee-effects');fs.mkdirSync(out,{recursive:true});
  await evaluate('requestAnimationFrame=()=>0;AUDIO.enable(false);beginGame();showScreen(null);VARGUL_READY');
  const result=await evaluate(`(${trial.toString()})()`);
  for(const p2 of [false,true])for(const move of ['combo','dash','sweep']){
    await evaluate(`meleeShot(${p2},'${move}')`);
    const shot=await call('Page.captureScreenshot',{format:'png'});
    fs.writeFileSync(path.join(out,`p${p2?2:1}-${move}.png`),Buffer.from(shot.data,'base64'));
  }
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(result,null,2));
  console.log('PASS Vargul supplied melee art / per-frame alpha collision / mirrored sweeps / swept dash / depth / recovery ('+result.samples+' contacts)');
};
function trial(){
  const check=(v,m)=>{if(!v)throw Error(m);};let samples=0,transparent=0,solid=0;
  function setup(p2,move){
    clearInput();player=newPlayer();startStage(3);scene='play';showScreen(null);camLock=true;camX=lockAt=0;
    arena=null;hazards=[];barrels=[];items=[];parts=[];texts=[];ghosts=[];bolts=[];impacts=[];bursts=[];
    hitStop=shake=flashT=slowT=0;waveIdx=stage.waves.length;
    const e=mkEnemy('boss4',340,420);e.p2shown=p2;enemies=[e];startPat(e,move);return e;
  }
  for(const kind of ['slash','thrust'])check(VARGUL_MELEE_FRAMES[kind].length===8,'eight isolated source frames '+kind);
  for(const p2 of [false,true])for(const move of ['combo','dash','sweep']){
    const e=setup(p2,move);
    for(const t of e.vargul.timeline){
      e.vargul.current=t;
      if(!t.attack)continue;
      const fx=vargulMeleeEffectData(e,t),[bx,bh,w,h]=fx.box,f=fx.frame;
      check(!!f,'visible art for every active tick');
      const rgba=f.image.getContext('2d').getImageData(0,0,f.width,f.height).data;
      for(const face of [-1,1])for(const swept of [false,true]){
        e.face=face;const oldX=e.x-(swept?7*face:0),left=Math.min(e.x,oldX)+(face>0?bx:-(bx+w));
        const right=Math.max(e.x,oldX)+(face>0?bx:-(bx+w)),dir=face*(fx.reverse?-1:1);
        for(const offset of [-15,0,w*.25,w*.5,w*.9,w+15])for(const z of [0,bh+h-2,bh+h+1]){
          player.x=left+offset;player.y=e.y;player.z=z;
          let expected=false;
          for(let y=0;y<f.height&&!expected;y++){
            const y0=e.z+bh+h-(y+1)*h/f.height,y1=e.z+bh+h-y*h/f.height;
            if(player.z>y1||player.z+90<y0)continue;
            for(let x=0;x<f.width&&!expected;x++)if(rgba[(y*f.width+x)*4+3]){
              const u=dir>0?x/f.width:1-(x+1)/f.width,v=u+1/f.width;
              expected=player.x+12>=left+u*w&&player.x-12<=right+v*w;
            }
          }
          const actual=vargulMeleeHit(e,t,oldX);check(actual===expected,move+' mask mismatch '+t.local+' '+offset+' '+z);
          samples++;if(actual)solid++;else transparent++;
          player.y=e.y+fx.depth+1;check(!vargulMeleeHit(e,t,oldX),'outside depth');
        }
      }
    }
    e.st='chase';check(!vargulComboEffectData(e),'clears on recovery/interrupt');
  }
  window.meleeShot=(p2,move)=>{
    const e=setup(p2,move),a=e.vargul,active=a.timeline.filter(t=>t.attack);
    a.current=active[Math.floor(active.length*.4)];a.cursor=a.timeline.indexOf(a.current)+1;
    player.x=175;player.y=420;player.z=0;tick=22;render();
  };
  check(solid>0&&transparent>0,'both damage and empty-space samples');
  return {samples,solid,transparent};
}
