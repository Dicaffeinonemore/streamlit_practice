// Phase 8 oracle: Stage 4 (legacy wave stage, generic soldiers, Vargul) in the original browser game.
// Events: {frame,key} tap, {frame,key,down:true} hold, {frame,key,up:true} release.
// Commands: {frame,damage,kd?} hits enemies[0]; {frame,pat} starts a pattern; {frame,atkCd} sets its attack cooldown.
const {fs,path,root,canonical}=require('../extract/common.cjs');
const {openBrowser}=require('../extract/browser.cjs');
const scenarios=[];
const tap=(frame,key)=>({frame,key});
const add=(id,steps,extra={})=>scenarios.push({id,steps,character:'barel',enemies:[],events:[],commands:[],player:{},...extra});
const passive=(kind,x,y=430,extra={})=>({kind,x,y,wait:100000,atkCd:100000,...extra});
add('legacy_pack_stage4',600,{enemies:[{kind:'grunt',x:520,y:420},{kind:'archer',x:180,y:440},{kind:'brute',x:560,y:470},{kind:'archer',x:620,y:400}]});
const p1=['combo','cross','dash','orb','sweep','sword','taunt'],p2=['combo','cross','dash','orb','sweep','sword','ultimate'];
for(const pat of p1)add('vargul_'+pat,360,{enemies:[{kind:'boss4',x:440,y:430}],commands:[{frame:0,pat}]});
for(const pat of p2)add('vargul_p2_'+pat,pat==='ultimate'?420:360,{enemies:[{kind:'boss4',x:440,y:430,phase:2}],commands:[{frame:0,pat}]});
add('vargul_back_sweep',240,{enemies:[{kind:'boss4',x:300,y:430,atkCd:0}],player:{x:340}});
add('vargul_ai_phase1',1200,{enemies:[{kind:'boss4',x:520,y:430}]});
add('vargul_ai_phase2',1200,{enemies:[{kind:'boss4',x:520,y:430,phase:2}]});
add('vargul_ai_ultimate',600,{enemies:[{kind:'boss4',x:520,y:430,phase:2,hpRatio:.35}]});
add('vargul_ai_viesa',900,{character:'viesa',enemies:[{kind:'boss4',x:540,y:430}],events:[60,130,200,270,340,410,480].map(f=>tap(f,'KeyJ'))});
add('orbs_barel',420,{player:{sp:100,mg:1},enemies:[{kind:'boss4',x:520,y:430,atkCd:100000}],commands:[{frame:0,pat:'orb'}],
  events:[60,68,76,140,148,156].map(f=>tap(f,'KeyJ')).concat([tap(200,'KeyU'),tap(260,'KeyL'),tap(320,'KeyI'),tap(380,'KeyK')])});
add('orbs_viesa',420,{character:'viesa',player:{sp:100},enemies:[{kind:'boss4',x:560,y:430,atkCd:100000}],commands:[{frame:0,pat:'orb'}],
  events:[50,62,74,86,98,110,122,134].map(f=>tap(f,'KeyJ')).concat([tap(200,'KeyO'),tap(300,'KeyK')])});
add('orbs_resummon',900,{player:{inv:10000},enemies:[{kind:'boss4',x:520,y:430}],commands:[{frame:0,pat:'orb'},{frame:80,orbDamage:100},{frame:81,orbDamage:100}]});
add('pressure_sweep',300,{player:{inv:10000},enemies:[{kind:'boss4',x:440,y:430,atkCd:100000}],commands:[{frame:5,damage:10},{frame:15,damage:10},{frame:25,damage:10},{frame:40,atkCd:0}]});
add('vargul_transition',420,{player:{inv:10000},enemies:[{kind:'boss4',x:440,y:430}],commands:[{frame:0,damage:3000}]});
add('vargul_groggy',420,{player:{inv:10000},enemies:[{kind:'boss4',x:440,y:430}],commands:[0,8,16,24,32,40].map(frame=>({frame,damage:30}))});
add('vargul_knockdown_hp',260,{player:{inv:10000},enemies:[{kind:'boss4',x:440,y:430}],commands:[{frame:0,damage:150},{frame:1,set:{gr:0}},{frame:2,damage:150},{frame:3,set:{gr:0}},{frame:19,set:{gr:-100}},{frame:20,damage:220}]});
add('vargul_death',300,{player:{inv:10000},clearReady:true,enemies:[{kind:'boss4',x:440,y:430,phase:2}],commands:[{frame:0,damage:6000}]});
add('vargul_intro',220,{intro:true});
add('stage4_banner',200,{banner:true});
add('stage4_progression',3800,{progression:true});
const efields=['x','y','z','vx','vz','face','hp','max','st','t','inv','flash','walk','wait','atkCd','recT','hurtT','chainN','pat','pt','last','invuln','alpha','gr','grMax','grT','nextKd','p2shown','morgraMove','morgraLane','morgraHit','moonUsed','morgraCooldown','phaseT','remove','form','type','hw','hheavy'];
const hfields=['type','kind','fx','x','y','h','age','dead','dir','delay','life','hit','visual','face','damageScale','damage','castToken','wait','active','boom','hp','inv','flash','vx','vy','vh','ai','shotCooldown','shotPending','index','casterIndex','stage','impactAge','wavesEmitted','waveRadius','waveTicks','pulse','width','height','bornElapsed'];
const pfields=['x','y','z','vx','vz','face','hp','max','lives','st','t','inv','flash','sp','mg','buff','score','combo','comboT','buf','skill','atk','hurtKind','hurtDuration','viesaClip'];
async function main(){const b=await openBrowser();try{
 await b.evaluate(`Promise.all([S1_GROUP.ready,g2Early.ready,g2Late.ready,BarelHurt.ready,BarelJump.ready,BarelDashAttack.ready,VARGUL_MELEE_READY])`);
 const traces=[];
 for(const spec of scenarios){const trace=await b.evaluate(`(()=>{
  const spec=${JSON.stringify(spec)},efields=${JSON.stringify(efields)},hfields=${JSON.stringify(hfields)},pfields=${JSON.stringify(pfields)};
  Math.random=()=>.5;UX.saveCheckpoint=()=>{};UX.record=()=>{};practice=false;bossChallenge=false;
  selectedCharacterId=spec.character;player=newPlayer(0,spec.character);vargulRemains=[];startStage(3);tick=0;nextId=1;
  if(!spec.banner)scene='play';hitStop=0;shake=0;flashT=0;slowT=0;clearInput();
  stat.ticks=stat.damage=stat.deaths=stat.kills=0;chain.n=chain.t=chain.max=0;
  if(!spec.progression&&!spec.banner){barrels=[];Object.assign(player,{x:350,y:430,inv:0});waveIdx=STAGES[3].waves.length;camLock=true;lockAt=0;}
  if(spec.clearReady)camLock=false;
  Object.assign(player,spec.player);
  if(spec.intro){camLock=false;spawnWave(STAGES[3].waves.at(-1));}
  for(const o of spec.enemies){const e=mkEnemy(o.kind,o.x,o.y);enemies.push(e);
   if(o.wait!==undefined)e.wait=o.wait;if(o.atkCd!==undefined)e.atkCd=o.atkCd;
   if(o.phase===2){e.p2shown=true;e.hp=e.max=VARGUL_RULES.hp[1];e.nextKd=e.max*.75;}
   if(o.hpRatio)e.hp=e.max*o.hpRatio;}
  const pick=(o,keys)=>Object.fromEntries(keys.map(k=>[k,o[k]===undefined?null:o[k]]));
  const snapshot=()=>({tick,mode:scene,hitStop,shake,flashT,slowT,camX,camLock,waveIdx,clearT,introT:scene==='bossintro'?introT:null,bannerT,
   stat:{...stat},chain:{...chain},player:pick(player,pfields),
   remains:vargulRemains.map(r=>[r.x,r.y,r.face]),
   enemies:enemies.map(e=>{const v=e.vargul;return {...pick(e,efields),marks:Object.keys(e.marks||{}).sort().join(','),
    vargul:v?{move:v.move??null,cursor:v.cursor??null,processed:v.processed??null,token:v.token,pressure:v.pressure,forceSweep:v.forceSweep,repeats:v.repeats,lastMove:v.lastMove,
     cooldowns:Object.entries(v.cooldowns).filter(([,n])=>n>0).map(([k,n])=>k+':'+n).sort().join(','),current:v.current?{clip:v.current.clip,drawing:v.current.drawing,label:v.current.label??null,local:v.current.local??null,phase:v.current.phase??null}:null,
     timeline:v.timeline?v.timeline.length:null,travel:v.travel??null,lockedY:v.lockedY??null,ultimateUsed:!!v.ultimateUsed,hadOrbs:!!v.hadOrbs,transitionAge:v.transitionAge??null,phaseBanner:v.phaseBanner??null,
     locomotion:v.locomotion??null,locomotionTicks:v.locomotionTicks??null,sweepFace:v.sweepFace??null,hitIds:v.hitIds?[...v.hitIds].sort().join(','):'',introBreak:!!v.introBreak,remains:!!v.remains}:null};}),
   hazards:hazards.map(z=>pick(z,hfields)),
   barrels:barrels.map(o=>({x:o.x,y:o.y,hp:o.hp,flash:o.flash})),
   items:items.map(i=>({type:i.type,x:i.x,y:i.y,z:i.z,t:i.t,life:i.life}))});
  const frames=[];for(let frame=0;frame<spec.steps;frame++){
   for(const event of spec.events)if(frame===event.frame){if(!event.up)inputDown(event.key);if(!event.down)inputUp(event.key);}
   for(const c of spec.commands)if(frame===c.frame){
    if(c.pat)startPat(enemies[0],c.pat);
    if(c.damage)damageEnemy(enemies[0],c.damage,!!c.kd,0,false,'c1');
    if(c.atkCd!==undefined)enemies[0].atkCd=c.atkCd;
    if(c.set)Object.assign(enemies[0],c.set);
    if(c.orbDamage){const z=hazards.find(h=>h.type==='vargul'&&h.kind==='orb'&&!h.dead&&h.inv<=0);if(z){z.hp=Math.max(0,z.hp-c.orbDamage);if(z.hp<=0)vargulBreakOrb(z,true);}}
    if(c.hurt)hurtPlayer(c.hurt.dmg,c.hurt.dir,c.hurt.kd);}
   if(spec.progression){player.inv=10000;if(camLock&&frame%90===0)for(const o of enemies){if(o.boss)continue;o.st='dead';o.t=0;o.hp=0;}if(!camLock&&scene==='play')player.x=Math.min(player.x+6,stage.len-50);}
   const processed=update();if(processed)for(const k in pressed){pressed[k]-=MS;if(pressed[k]<=0)delete pressed[k];}
   frames.push(snapshot());if(spec.progression&&scene==='play'&&enemies.some(e=>e.boss)&&frame>60&&frames.at(-2)?.mode==='bossintro')break;
  }return {spec,frames};})()`);traces.push(trace);console.log(spec.id+': '+trace.frames.length);}
 fs.writeFileSync(path.join(root,'godot/phase8/fixtures/traces.json'),JSON.stringify(canonical({traces}))+'\n');
 console.log('PHASE 8 ORACLE: '+traces.length+' scenarios, '+traces.reduce((n,t)=>n+t.frames.length,0)+' source steps');
}finally{await b.close();}}main().catch(e=>{console.error(e.stack);process.exit(1);});
