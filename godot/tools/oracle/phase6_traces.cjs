// Phase 6 oracle: Stage 2 (legacy wave stage, generic soldiers, Morgra) in the original browser game.
// Events: {frame,key} tap, {frame,key,down:true} hold, {frame,key,up:true} release.
// Commands: {frame,damage,kd?} hits enemies[0]; {frame,pat} starts a Morgra pattern; {frame,hurt:{dmg,dir,kd}}.
const {fs,path,root,canonical}=require('../extract/common.cjs');
const {openBrowser}=require('../extract/browser.cjs');
const scenarios=[];
const tap=(frame,key)=>({frame,key});
const add=(id,steps,extra={})=>scenarios.push({id,steps,character:'barel',enemies:[],events:[],commands:[],player:{},...extra});
const passive=(kind,x,y=430,extra={})=>({kind,x,y,wait:100000,atkCd:100000,...extra});
for(const kind of ['grunt','rogue','brute','archer'])add('legacy_'+kind,520,{enemies:[{kind,x:kind==='archer'?600:520,y:430}]});
add('legacy_pack',600,{enemies:[{kind:'grunt',x:520,y:420},{kind:'rogue',x:180,y:440},{kind:'brute',x:560,y:470},{kind:'archer',x:620,y:400}]});
add('viesa_vs_rogue',500,{character:'viesa',enemies:[{kind:'rogue',x:520,y:430}]});
add('viesa_vs_archer',500,{character:'viesa',enemies:[{kind:'archer',x:600,y:430}],events:[40,90,140,190].map(f=>tap(f,'KeyJ'))});
add('barel_combo_grunt',160,{enemies:[passive('grunt',395)],events:[2,10,18,40,48,56,90].map(f=>tap(f,'KeyJ'))});
add('barel_vs_brute_wind',220,{enemies:[{kind:'brute',x:400,y:430,wait:0,atkCd:0}],events:[30,38,46,80,88].map(f=>tap(f,'KeyJ'))});
add('barel_skills_rogue',220,{player:{sp:100},enemies:[passive('rogue',420),passive('grunt',470,450)],events:[tap(2,'KeyU'),tap(70,'KeyK')]});
const p1=['staff_swing','magic_bolt','teleport','cackle','summon','curtain'];
const p2=['aerial_slash','crow_rush','moon','p2_bolt','p2_summon','p2_curtain','p2_teleport'];
for(const pat of p1)add('morgra_'+pat,300,{enemies:[{kind:'boss2',x:440,y:430}],commands:[{frame:0,pat}]});
for(const pat of p2)add('morgra_'+pat,pat==='moon'?420:300,{enemies:[{kind:'boss2',x:440,y:430,phase:2}],commands:[{frame:0,pat}]});
add('morgra_ai_phase1',1200,{enemies:[{kind:'boss2',x:500,y:430}]});
add('morgra_ai_phase2',1200,{enemies:[{kind:'boss2',x:500,y:430,phase:2}]});
add('morgra_ai_viesa',900,{character:'viesa',enemies:[{kind:'boss2',x:520,y:430}],events:[60,130,200,270,340,410].map(f=>tap(f,'KeyJ'))});
add('morgra_revival',340,{player:{inv:10000},enemies:[{kind:'boss2',x:440,y:430}],commands:[{frame:0,damage:1000}]});
add('morgra_groggy',420,{player:{inv:10000},enemies:[{kind:'boss2',x:440,y:430}],commands:[0,8,16,24,32,40].map(frame=>({frame,damage:25}))});
add('morgra_knockdown',220,{player:{inv:10000},enemies:[{kind:'boss2',x:440,y:430}],commands:[{frame:0,damage:220}]});
add('morgra_stun_hits',420,{player:{inv:10000},enemies:[{kind:'boss2',x:440,y:430}],commands:[{frame:0,damage:130},{frame:20,damage:30},{frame:40,damage:30,kd:true}]});
add('morgra_death',240,{player:{inv:10000},clearReady:true,enemies:[{kind:'boss2',x:440,y:430,phase:2}],commands:[{frame:0,damage:3000}]});
add('crows_barel',260,{enemies:[{kind:'boss2',x:470,y:430}],commands:[{frame:0,pat:'summon'}],events:[60,68,76,84,92,100,108,116,124].map(f=>tap(f,'KeyJ'))});
add('crows_viesa',260,{character:'viesa',enemies:[{kind:'boss2',x:560,y:430}],commands:[{frame:0,pat:'summon'}],events:[50,62,74,86,98,110,122].map(f=>tap(f,'KeyJ'))});
add('morgra_intro',170,{intro:true});
add('stage2_banner',200,{banner:true});
add('stage2_progression',3200,{progression:true});
const efields=['x','y','z','vx','vz','face','hp','max','st','t','inv','flash','walk','wait','atkCd','recT','hurtT','chainN','pat','pt','last','invuln','alpha','gr','grMax','grT','nextKd','p2shown','morgraMove','morgraLane','morgraHit','moonUsed','morgraCooldown','phaseT','remove','form','type'];
const hfields=['type','kind','fx','x','y','h','age','dead','dir','delay','life','hit','diving','vx','vy','face','damageScale','damage'];
const pfields=['x','y','z','vx','vz','face','hp','max','lives','st','t','inv','flash','sp','mg','buff','score','combo','comboT','buf','skill','atk','hurtKind','hurtDuration','viesaClip'];
async function main(){const b=await openBrowser();try{
 await b.evaluate(`Promise.all([S1_GROUP.ready,g2Early.ready,g2Late.ready,BarelHurt.ready,BarelJump.ready,BarelDashAttack.ready])`);
 const traces=[];
 for(const spec of scenarios){const trace=await b.evaluate(`(()=>{
  const spec=${JSON.stringify(spec)},efields=${JSON.stringify(efields)},hfields=${JSON.stringify(hfields)},pfields=${JSON.stringify(pfields)};
  Math.random=()=>.5;UX.saveCheckpoint=()=>{};UX.record=()=>{};practice=false;bossChallenge=false;
  selectedCharacterId=spec.character;player=newPlayer(0,spec.character);startStage(1);tick=0;nextId=1;
  if(!spec.banner)scene='play';hitStop=0;shake=0;flashT=0;slowT=0;clearInput();
  stat.ticks=stat.damage=stat.deaths=stat.kills=0;chain.n=chain.t=chain.max=0;
  if(!spec.progression&&!spec.banner){barrels=[];Object.assign(player,{x:350,y:430,inv:0});waveIdx=STAGES[1].waves.length;camLock=true;lockAt=0;}
  if(spec.clearReady)camLock=false;
  Object.assign(player,spec.player);
  if(spec.intro){camLock=false;spawnWave(STAGES[1].waves.at(-1));}
  for(const o of spec.enemies){const e=mkEnemy(o.kind,o.x,o.y);enemies.push(e);
   if(o.wait!==undefined)e.wait=o.wait;if(o.atkCd!==undefined)e.atkCd=o.atkCd;
   if(o.phase===2){e.p2shown=true;e.hp=e.max=MORGRA_REVIVE.hp;e.grMax=MORGRA_REVIVE.groggy;e.nextKd=e.max*.75;}}
  const pick=(o,keys)=>Object.fromEntries(keys.map(k=>[k,o[k]===undefined?null:o[k]]));
  const snapshot=()=>({tick,mode:scene,hitStop,shake,flashT,slowT,camX,camLock,waveIdx,clearT,introT:scene==='bossintro'?introT:null,bannerT,
   stat:{...stat},chain:{...chain},player:pick(player,pfields),
   enemies:enemies.map(e=>({...pick(e,efields),marks:Object.keys(e.marks||{}).sort().join(',')})),
   hazards:hazards.map(z=>pick(z,hfields)),
   barrels:barrels.map(o=>({x:o.x,y:o.y,hp:o.hp,flash:o.flash})),
   items:items.map(i=>({type:i.type,x:i.x,y:i.y,z:i.z,t:i.t,life:i.life}))});
  const frames=[];for(let frame=0;frame<spec.steps;frame++){
   for(const event of spec.events)if(frame===event.frame){if(!event.up)inputDown(event.key);if(!event.down)inputUp(event.key);}
   for(const c of spec.commands)if(frame===c.frame){
    if(c.pat)startPat(enemies[0],c.pat);
    if(c.damage)damageEnemy(enemies[0],c.damage,!!c.kd,0,false,'c1');
    if(c.hurt)hurtPlayer(c.hurt.dmg,c.hurt.dir,c.hurt.kd);}
   if(spec.progression){player.inv=10000;if(camLock&&frame%90===0)for(const o of enemies){if(o.boss)continue;o.st='dead';o.t=0;o.hp=0;}if(!camLock&&scene==='play')player.x=Math.min(player.x+6,stage.len-50);}
   const processed=update();if(processed)for(const k in pressed){pressed[k]-=MS;if(pressed[k]<=0)delete pressed[k];}
   frames.push(snapshot());if(spec.progression&&scene==='play'&&enemies.some(e=>e.boss)&&frame>60&&frames.at(-2)?.mode==='bossintro')break;
  }return {spec,frames};})()`);traces.push(trace);console.log(spec.id+': '+trace.frames.length);}
 fs.writeFileSync(path.join(root,'godot/phase6/fixtures/traces.json'),JSON.stringify(canonical({traces}))+'\n');
 console.log('PHASE 6 ORACLE: '+traces.length+' scenarios, '+traces.reduce((n,t)=>n+t.frames.length,0)+' source steps');
}finally{await b.close();}}main().catch(e=>{console.error(e.stack);process.exit(1);});
