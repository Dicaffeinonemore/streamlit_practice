// Phase 12 oracle: runs the original tutorial demonstration (demo-runtime.js) through the real
// page and records every demo step: the scripted key presses, DEMO state, the player, the dummy
// and the audio requests. Scenarios:
//   title_<char>   toTutorial('characterSelect') from the title (no stage yet), every step once.
//   pause_viesa    toTutorial('pause') during Stage 3 with Viesa, two steps, then back to pause:
//                  records the live run before the demo and after it is restored.
const {fs,path,root,canonical}=require('../extract/common.cjs');
const {openBrowser}=require('../extract/browser.cjs');
const pcommon=['x','y','z','vx','vz','face','hp','max','st','t','inv','flash','sp','mg','combo','comboT','buf','skill','walk','dashCd','dashGrace','atk','running','castFired'];
const pbarel=['spHits','spFin','skillDest'];
const pviesa=['viesaClip','viesaFired','viesaShotQueued','viesaHoverGrace','viesaAirPUsed','viesaLanding','jumpTime'];
const efields=['x','y','z','vx','vz','face','hp','max','st','t','inv','flash','walk','hr','type'];
async function main(){const b=await openBrowser();try{
 await b.evaluate(`Promise.all([S1_GROUP.ready,g2Early.ready,g2Late.ready,BarelHurt.ready,BarelJump.ready,BarelDashAttack.ready])`);
 const steps=await b.evaluate(`(()=>Object.fromEntries(Object.entries(DEMO_STEPS).map(([c,list])=>[c,list.map(s=>({title:s.title,keys:s.keys,dummy:s.dummy,desc:s.desc,script:s.script,setup:s.setup?(/SP_MAX/.test(String(s.setup))?{sp:100}:{mg:1}):null}))])))()`);
 const meta=await b.evaluate(`({maxMs:DEMO_MAX_MS,vw:VW,gtop:GTOP,gbot:GBOT,bufMs:BUF_MS,openingLines:OPENING_LINES,presets:Object.fromEntries(Object.entries(UX.presets).map(([k,v])=>[k,v.name]))})`);
 const runner=`(spec)=>{
  const pcommon=${JSON.stringify(pcommon)},pbarel=${JSON.stringify(pbarel)},pviesa=${JSON.stringify(pviesa)},efields=${JSON.stringify(efields)};
  const pick=(o,keys)=>Object.fromEntries(keys.map(k=>[k,o[k]??null]));
  const snapshot=()=>{const p=player,a=p.viesaAction;
   return {tick,camX,hitStop,shake,flashT,chain:{n:chain.n,t:chain.t},
    demo:{i:DEMO.i,t:DEMO.t,after:DEMO.after,end:DEMO.end,lit:[...DEMO.lit].sort(),paused:DEMO.paused,bar:Math.min(100,DEMO.t/Math.max(DEMO.end+1300,DEMO.t+DEMO.after+1)*100),
     events:DEMO.events.map(e=>[e.code,e.at,e.up,e.down,e.released])},
    player:{...pick(p,pcommon),...pick(p,p.characterId==='viesa'?pviesa:pbarel),characterId:p.characterId,skillCd:{...p.skillCd},
     action:a?{phase:a.phase,id:a.id,held:a.held,shots:a.shots,released:a.released,charge:a.charge??null,landed:!!a.landed}:null},
    enemies:enemies.map(e=>({...pick(e,efields),training:!!e.training})),
    pwaves:hazards.filter(z=>z.type==='pwave').map(z=>({x:z.x,y:z.y,h:z.h,age:z.age,dead:!!z.dead})),
    arrows:hazards.filter(z=>z.type==='viesa_arrow').map(z=>({x:z.x,y:z.y,h:z.h,age:z.age,travel:z.travel,damage:z.damage,dead:!!z.dead})),
    ult:viesaUltObjects.length};};
  const live=()=>({stageIdx,stage:!!stage,camX,camLock,lockAt,tick,scene,practice,player:player?{characterId:player.characterId,x:player.x,y:player.y,hp:player.hp,sp:player.sp,mg:player.mg,score:player.score}:null,enemies:enemies.map(e=>[e.type,e.x,e.y,e.hp,e.st]),stat:{...stat},chain:{...chain},barrels:barrels.length});
  Math.random=()=>.5;${require('./audio_log.cjs').hook}UX.saveCheckpoint=()=>{};
  let before=null;
  if(spec.from==='pause'){
   selectedCharacterId=spec.char;player=newPlayer(0,spec.char);startStage(spec.stage);scene='play';bannerT=0;tick=0;nextId=1;
   camX=spec.camX;lockAt=camX;player.x=camX+200;player.hp=61;player.sp=37;player.score=4321;
   enemies=[mkEnemy('rogue',camX+420,440)];stat.ticks=500;stat.damage=12;chain.n=3;chain.t=900;chain.max=5;
   pauseGame();before=live();
  } else { selectedCharacterId=spec.char;tick=0;nextId=1;before=live(); }
  toTutorial(spec.from);__audioLog.length=0;
  const start=snapshot(),frames=[];let seen=new Set([DEMO.i]);
  for(let frame=0;frame<30000;frame++){
   const processed=update();if(processed)for(const k in pressed){pressed[k]-=MS;if(pressed[k]<=0)delete pressed[k];}
   frames.push({...snapshot(),audio:__audioLog.splice(0)});
   seen.add(DEMO.i);
   if(spec.steps===undefined?(seen.size===DEMO.steps.length&&DEMO.i===0):DEMO.i>=spec.steps)break;
  }
  if(spec.from==='pause'){scene='pause';showScreen('pause');}else toTitle();
  return {spec,start,frames,live:{before,after:live(),demoOn:DEMO.on,savedCleared:DEMO.saved===null}};
 }`;
 const scenarios=[{id:'title_barel',from:'characterSelect',char:'barel'},{id:'title_viesa',from:'characterSelect',char:'viesa'},{id:'pause_viesa',from:'pause',char:'viesa',stage:2,camX:640,steps:2}];
 const traces=[];
 for(const spec of scenarios){const trace=await b.evaluate(`(${runner})(${JSON.stringify(spec)})`);traces.push(trace);console.log(spec.id+': '+trace.frames.length+' steps');}
 fs.writeFileSync(path.join(root,'godot/phase12/fixtures/traces.json'),JSON.stringify(canonical({meta,steps,traces}))+'\n');
 console.log('PHASE 12 ORACLE: '+traces.length+' scenarios, '+traces.reduce((n,t)=>n+t.frames.length,0)+' source steps');
}finally{await b.close();}}main().catch(e=>{console.error(e.stack);process.exit(1);});
