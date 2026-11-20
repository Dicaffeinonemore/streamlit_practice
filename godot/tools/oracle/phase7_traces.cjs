// Phase 7 oracle: Stage 3 (legacy wave stage, generic soldiers, Aurelion) in the original browser game.
// Events: {frame,key} tap, {frame,key,down:true} hold, {frame,key,up:true} release.
// Commands: {frame,damage,kd?} hits enemies[0]; {frame,pat} starts a pattern; {frame,atkCd} sets its attack cooldown.
const {fs,path,root,canonical}=require('../extract/common.cjs');
const {openBrowser}=require('../extract/browser.cjs');
const scenarios=[];
const tap=(frame,key)=>({frame,key});
const add=(id,steps,extra={})=>scenarios.push({id,steps,character:'barel',enemies:[],events:[],commands:[],player:{},...extra});
const passive=(kind,x,y=430,extra={})=>({kind,x,y,wait:100000,atkCd:100000,...extra});
add('legacy_pack_stage3',600,{enemies:[{kind:'grunt',x:520,y:420},{kind:'rogue',x:180,y:440},{kind:'brute',x:560,y:470},{kind:'archer',x:620,y:400}]});
add('viesa_vs_brute_stage3',400,{character:'viesa',enemies:[{kind:'brute',x:520,y:430}],events:[40,80,120,160].map(f=>tap(f,'KeyJ'))});
const moves=['combo','sword_wave','cleave','charge','judgment','guard','whirl','taunt'];
for(const pat of moves)add('aurelion_'+pat,320,{enemies:[{kind:'boss3',x:440,y:430}],commands:[{frame:0,pat}]});
for(const pat of ['combo','sword_wave','cleave','charge','judgment','whirl'])add('aurelion_p2_'+pat,320,{enemies:[{kind:'boss3',x:440,y:430,phase:2}],commands:[{frame:0,pat}]});
add('aurelion_charge_far',320,{enemies:[{kind:'boss3',x:620,y:430}],commands:[{frame:0,pat:'charge'}]});
add('aurelion_ai_phase1',1200,{enemies:[{kind:'boss3',x:520,y:430}]});
add('aurelion_ai_phase2',1200,{enemies:[{kind:'boss3',x:520,y:430,phase:2}]});
add('aurelion_ai_viesa',900,{character:'viesa',enemies:[{kind:'boss3',x:540,y:430}],events:[60,130,200,270,340,410,480].map(f=>tap(f,'KeyJ'))});
add('aurelion_ai_barel_fight',900,{enemies:[{kind:'boss3',x:430,y:430}],events:[30,38,46,120,128,136,240,248,256,360,368,376].map(f=>tap(f,'KeyJ')).concat([tap(500,'KeyU'),tap(600,'KeyH')])});
add('guard_parry',200,{enemies:[{kind:'boss3',x:400,y:430}],commands:[{frame:0,pat:'guard'}],events:[10,40].map(f=>tap(f,'KeyJ'))});
add('guard_break',200,{player:{sp:0},enemies:[{kind:'boss3',x:400,y:430}],commands:[{frame:0,pat:'guard'},{frame:12,damage:20,kd:true}]});
add('guard_timeout',200,{player:{inv:10000},enemies:[{kind:'boss3',x:440,y:430}],commands:[{frame:0,pat:'guard'}]});
add('pressure_guard',300,{player:{inv:10000},enemies:[{kind:'boss3',x:440,y:430,atkCd:100000}],commands:[{frame:5,damage:10},{frame:15,damage:10},{frame:25,damage:10},{frame:40,atkCd:0}]});
add('reactive_guard',200,{enemies:[{kind:'boss3',x:410,y:430,atkCd:100000}],events:[tap(5,'KeyJ')]});
add('aurelion_knockdown_adds',260,{player:{inv:10000},enemies:[{kind:'boss3',x:440,y:430}],commands:[{frame:0,damage:460}]});
add('aurelion_knockdown_hp',260,{player:{inv:10000},enemies:[{kind:'boss3',x:440,y:430}],commands:[{frame:0,damage:150},{frame:1,set:{gr:0}},{frame:2,damage:150},{frame:3,set:{gr:0}},{frame:19,set:{gr:-100}},{frame:20,damage:160}]});
add('aurelion_phase2',420,{player:{inv:10000},enemies:[{kind:'boss3',x:440,y:430}],commands:[{frame:0,damage:3000}]});
add('aurelion_groggy',420,{player:{inv:10000},enemies:[{kind:'boss3',x:440,y:430}],commands:[0,8,16,24,32,40].map(frame=>({frame,damage:30}))});
add('aurelion_death',260,{player:{inv:10000},clearReady:true,enemies:[{kind:'boss3',x:440,y:430,phase:2}],commands:[{frame:0,damage:5000}]});
add('aurelion_intro',190,{intro:true});
add('stage3_banner',200,{banner:true});
add('stage3_progression',3600,{progression:true});
const efields=['x','y','z','vx','vz','face','hp','max','st','t','inv','flash','walk','wait','atkCd','recT','hurtT','chainN','pat','pt','last','invuln','alpha','gr','grMax','grT','nextKd','p2shown','morgraMove','morgraLane','morgraHit','moonUsed','morgraCooldown','phaseT','remove','form','type','hw','hheavy'];
const hfields=['type','kind','fx','x','y','h','age','dead','dir','delay','life','hit','visual','face','damageScale','damage','castToken'];
const pfields=['x','y','z','vx','vz','face','hp','max','lives','st','t','inv','flash','sp','mg','buff','score','combo','comboT','buf','skill','atk','hurtKind','hurtDuration','viesaClip'];
async function main(){const b=await openBrowser();try{
 await b.evaluate(`Promise.all([S1_GROUP.ready,g2Early.ready,g2Late.ready,BarelHurt.ready,BarelJump.ready,BarelDashAttack.ready])`);
 const traces=[];
 for(const spec of scenarios){const trace=await b.evaluate(`(()=>{
  const spec=${JSON.stringify(spec)},efields=${JSON.stringify(efields)},hfields=${JSON.stringify(hfields)},pfields=${JSON.stringify(pfields)};
  Math.random=()=>.5;${require('./audio_log.cjs').hook}UX.saveCheckpoint=()=>{};UX.record=()=>{};practice=false;bossChallenge=false;
  selectedCharacterId=spec.character;player=newPlayer(0,spec.character);startStage(2);tick=0;nextId=1;
  if(!spec.banner)scene='play';hitStop=0;shake=0;flashT=0;slowT=0;clearInput();
  stat.ticks=stat.damage=stat.deaths=stat.kills=0;chain.n=chain.t=chain.max=0;
  if(!spec.progression&&!spec.banner){barrels=[];Object.assign(player,{x:350,y:430,inv:0});waveIdx=STAGES[2].waves.length;camLock=true;lockAt=0;}
  if(spec.clearReady)camLock=false;
  Object.assign(player,spec.player);
  if(spec.intro){camLock=false;spawnWave(STAGES[2].waves.at(-1));}
  for(const o of spec.enemies){const e=mkEnemy(o.kind,o.x,o.y);enemies.push(e);
   if(o.wait!==undefined)e.wait=o.wait;if(o.atkCd!==undefined)e.atkCd=o.atkCd;
   if(o.phase===2){e.p2shown=true;e.hp=e.max=AURELION_P2_HP;e.nextKd=e.max*.75;aurelionData(e).halo=true;}}
  const pick=(o,keys)=>Object.fromEntries(keys.map(k=>[k,o[k]===undefined?null:o[k]]));
  const snapshot=()=>({tick,mode:scene,hitStop,shake,flashT,slowT,camX,camLock,waveIdx,clearT,introT:scene==='bossintro'?introT:null,bannerT,
   stat:{...stat},chain:{...chain},player:pick(player,pfields),
   enemies:enemies.map(e=>{const a=e.aurelion;return {...pick(e,efields),marks:Object.keys(e.marks||{}).sort().join(','),
    aurelion:a?{move:a.move??null,guard:a.guard??null,cursor:a.cursor??null,processed:a.processed??null,token:a.token??null,pressure:a.pressure,forceGuard:a.forceGuard,lastMove:a.lastMove,repeats:a.repeats,halo:a.halo,
     tauntPending:!!a.tauntPending,locomotion:a.locomotion??null,locomotionTicks:a.locomotionTicks??null,turnTicks:a.turnTicks??null,transitionAge:a.transitionAge??null,whirlLanded:!!a.whirlLanded,
     cooldowns:Object.entries(a.cooldowns).filter(([,v])=>v>0).map(([k,v])=>k+':'+v).sort().join(','),current:a.current?{index:a.current.index,source:a.current.source,instance:a.current.instance}:null,
     timeline:a.timeline?a.timeline.length:null,marks:(a.marks||[]).map(m=>[m.x,m.y])}:null};}),
   hazards:hazards.map(z=>pick(z,hfields)),
   barrels:barrels.map(o=>({x:o.x,y:o.y,hp:o.hp,flash:o.flash})),
   items:items.map(i=>({type:i.type,x:i.x,y:i.y,z:i.z,t:i.t,life:i.life}))});
  const frames=[];__audioLog.length=0;for(let frame=0;frame<spec.steps;frame++){
   for(const event of spec.events)if(frame===event.frame){if(!event.up)inputDown(event.key);if(!event.down)inputUp(event.key);}
   for(const c of spec.commands)if(frame===c.frame){
    if(c.pat)startPat(enemies[0],c.pat);
    if(c.damage)damageEnemy(enemies[0],c.damage,!!c.kd,0,false,'c1');
    if(c.atkCd!==undefined)enemies[0].atkCd=c.atkCd;
    if(c.set)Object.assign(enemies[0],c.set);
    if(c.hurt)hurtPlayer(c.hurt.dmg,c.hurt.dir,c.hurt.kd);}
   if(spec.progression){player.inv=10000;if(camLock&&frame%90===0)for(const o of enemies){if(o.boss)continue;o.st='dead';o.t=0;o.hp=0;}if(!camLock&&scene==='play')player.x=Math.min(player.x+6,stage.len-50);}
   const processed=update();if(processed)for(const k in pressed){pressed[k]-=MS;if(pressed[k]<=0)delete pressed[k];}
   frames.push({...snapshot(),audio:__audioLog.splice(0)});if(spec.progression&&scene==='play'&&enemies.some(e=>e.boss)&&frame>60&&frames.at(-2)?.mode==='bossintro')break;
  }return {spec,frames};})()`);traces.push(trace);console.log(spec.id+': '+trace.frames.length);}
 fs.writeFileSync(path.join(root,'godot/phase7/fixtures/traces.json'),JSON.stringify(canonical({traces}))+'\n');
 console.log('PHASE 7 ORACLE: '+traces.length+' scenarios, '+traces.reduce((n,t)=>n+t.frames.length,0)+' source steps');
}finally{await b.close();}}main().catch(e=>{console.error(e.stack);process.exit(1);});
