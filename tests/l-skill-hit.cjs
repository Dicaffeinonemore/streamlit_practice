// $env:L_SKILL_HIT_SUITE='1'; node tests/regression.cjs
const assert=require('node:assert/strict');
module.exports=async({evaluate,errors})=>{
  await evaluate('requestAnimationFrame=()=>0;AUDIO.enable(false);beginGame();showScreen(null);true');
  const result=await evaluate(`(${trial.toString()})()`);
  assert.deepEqual(errors,[]);
  assert.equal(result.trials.length,result.enemyTypes*2);
  console.log('PASS L projectile hits every enemy/boss in both directions; render loop keeps advancing after contact; wave audio and combo hitstun remain separate');
};
function trial(){
  const check=(ok,msg)=>{if(!ok)throw Error(msg);},results=[];
  for(const type of Object.keys(ET))for(const face of [-1,1]){
    clearInput();practice=false;selectedCharacterId='barel';player=newPlayer(0,'barel');startStage(0);
    scene='play';showScreen(null);stage={...stage,waves:[]};camX=0;camLock=false;waveIdx=0;
    arena=null;barrels=[];items=[];parts=[];texts=[];hazards=[];impacts=[];bursts=[];ghosts=[];bolts=[];
    hitStop=shake=flashT=slowT=clearT=0;tick=0;last=0;acc=0;
    Object.assign(player,{x:400,y:420,face,inv:99999});
    const e=mkEnemy(type,player.x+face*110,player.y);
    Object.assign(e,{hp:10000,max:10000,grMax:10000,nextKd:-Infinity,atkCd:99999});enemies=[e];
    const native=AUDIO.sfx,sounds=[];let firstHit=null;
    try{
      AUDIO.sfx=(name)=>sounds.push(name);
      inputDown('KeyL');
      for(let frame=1;frame<=150;frame++){
        loop(frame*MS+.01);
        if(e.hp<10000&&firstHit===null)firstHit=tick;
      }
    }finally{AUDIO.sfx=native;inputUp('KeyL');}
    check(firstHit!==null,'L must damage '+type+'/'+face);
    check(tick>firstHit+60&&player.st==='free','Loop must keep running after L hit '+type+'/'+face);
    check(sounds.filter(s=>s==='barelWave').length>=2,'Launch and contact retain wave audio');
    check(!hazards.some(h=>h.type==='pwave'),'Projectile expires');
    // Basic combo ID must still control hitstun after the sound argument is restored.
    e.st='chase';e.inv=0;damageEnemy(e,1,false,0,false,'c1');
    if(!e.boss)check(e.hurtT===enemyHitstun(e,'c1'),'Combo hitstun remains keyed by c1');
    Object.assign(player,{st:'special',spX:e.x,spY:e.y});e.st='chase';e.inv=0;
    const specialSounds=[];
    try{
      AUDIO.sfx=name=>specialSounds.push(name);
      specialHit(false,0);e.inv=0;specialHit(true,4);
    }finally{AUDIO.sfx=native;}
    check(specialSounds.includes('barelCombo')&&specialSounds.includes('barelFinalHit'),
      'Separate sound argument preserves special combo and finisher');
    check(!specialSounds.includes('swordHit'),'Special does not fall back to the default sword sample');
    results.push({type,face,firstHit,tick});
  }
  return {enemyTypes:Object.keys(ET).length,trials:results};
}
