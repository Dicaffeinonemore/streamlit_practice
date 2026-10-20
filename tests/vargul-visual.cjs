// $env:VARGUL_VISUAL_SUITE='1'; node tests/regression.cjs
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
module.exports=async({evaluate,call,errors,root})=>{
  const out=path.join(root,'artifacts/vargul-1.36/visual-fix');fs.mkdirSync(out,{recursive:true});
  await evaluate('requestAnimationFrame=()=>0;AUDIO.enable(false);beginGame();showScreen(null);VARGUL_READY');
  const result=await evaluate(`(${trial.toString()})()`);
  const measurements=JSON.parse(fs.readFileSync(path.join(out,'measurements.json'),'utf8'));
  const max={before:0,after:0};
  for(const [clip,areas] of Object.entries(measurements.areas)){
    if(!['combo','dash','sword','cross','orb','sweep','taunt','ultimate'].some(id=>clip.includes(({combo:'combo',sword:'sword',orb:'orb'})[id]||id))&&clip!=='p2_cast'&&clip!=='p2_cast_b')continue;
    const base=measurements.baseline[clip.startsWith('p2_')||clip==='ultimate'?1:0];
    areas.forEach((area,i)=>{const ratio=Math.sqrt(area/base);max.before=Math.max(max.before,ratio);max.after=Math.max(max.after,ratio*measurements.scales[clip][i]);});
  }
  assert.ok(max.before>2&&max.after<=1.00001,'Oversized actor coverage removed');result.coverageRatio=max;
  for(const p2 of [false,true])for(const hit of ['combo1','combo2','combo3']){
    await evaluate(`visualShot(${p2},'combo','${hit}')`);
    const shot=await call('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,`p${p2?2:1}-${hit}.png`),Buffer.from(shot.data,'base64'));
  }
  for(const p2 of [false,true]){
    await evaluate(`visualShot(${p2},'cross',null)`);
    const shot=await call('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,`p${p2?2:1}-cast.png`),Buffer.from(shot.data,'base64'));
  }
  assert.deepEqual(errors,[],'No console errors / browser exceptions');result.consoleErrors=errors;
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(result,null,2));
  console.log('PASS Vargul visual scale / phase-mask alignment / active and preview combo effects / mirrored hit bounds');
};
function trial(){
  const check=(c,m)=>{if(!c)throw Error(m);},result={drawings:0,active:[],previews:0};
  function setup(p2){
    clearInput();player=newPlayer();startStage(3);scene='play';showScreen(null);camLock=true;camX=lockAt=0;
    waveIdx=stage.waves.length;arena=null;barrels=[];hazards=[];parts=[];texts=[];items=[];impacts=[];bursts=[];ghosts=[];bolts=[];
    hitStop=shake=flashT=slowT=0;player.x=240;player.y=420;player.inv=999999;
    const e=mkEnemy('boss4',370,420);e.p2shown=p2;if(p2)e.hp=e.max=2500;enemies=[e];return e;
  }
  const nativePaint=paintVargul;
  let draws=[];
  paintVargul=function(frame,x,y,face,alpha,k=VARGUL_ART.scale,add=false){draws.push({frame,k,add});return nativePaint(frame,x,y,face,alpha,k,add);};
  try{
    for(const p2 of [false,true])for(const [id,def] of Object.entries(VARGUL_TIMELINES[p2?1:0])){
      const e=setup(p2);startPat(e,id);
      for(let i=0;i<def.timeline.length;i++){
        e.vargul.current=def.timeline[i];e.vargul.cursor=i+1;
        const pose=vargulPose(e),k=vargulVisualScale(pose);check(k>0&&k<=VARGUL_ART.scale,'Never enlarge an imported frame');
        draws=[];drawVargul(e);result.drawings++;
        if(!pose.hidden){check(draws[0]?.k===k,'Body uses calibrated scale');const mask=draws.find(v=>v.add);if(mask)check(mask.k===k,'Tattoo mask matches actor');}
        const fx=vargulComboEffectData(e);
        if(def.timeline[i].attack?.id.startsWith('combo')){
          check(fx?.active&&fx.depth===def.timeline[i].attack.depth,'Each active tick has real-depth FX');
          check(JSON.stringify(fx.box)===JSON.stringify(vargulAttackBox(e,def.timeline[i])),'FX uses actual blade box');
          for(const face of [-1,1]){
            e.face=face;const [x,h,w,hh]=fx.box;
            player.x=e.x+(face>0?x+w/2:-x-w/2);player.y=e.y;player.z=e.z+h+hh/2;
            check(vargulBoxHit(e,fx.box,fx.depth),'FX center is within actual hitbox both directions');
          }
          if(def.timeline[i].first)result.active.push({phase:p2?2:1,hit:fx.id,box:fx.box,depth:fx.depth});
        }else if(fx){check(!fx.active&&def.timeline[i].phase==='S','Preview only in startup');result.previews++;}
      }
      e.st='chase';check(!vargulComboEffectData(e),'No lingering attack range during chase');
    }
  }finally{paintVargul=nativePaint;}
  window.visualShot=(p2,id,hit)=>{
    const e=setup(p2);startPat(e,id);const a=e.vargul;
    const at=hit?a.timeline.findIndex(t=>t.attack?.id===hit):a.timeline.findIndex(t=>t.label==='concentrate');
    a.current=a.timeline[Math.max(0,at)];a.cursor=Math.max(0,at)+1;tick=22;player.inv=0;render();
  };
  return result;
}
