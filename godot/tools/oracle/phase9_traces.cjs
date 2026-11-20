// Phase 9 oracle: Stage 5 (generic soldiers, abyss arena, the Black Moon Sovereign) in the original browser game.
// Events: {frame,key} tap, {frame,key,down:true} hold, {frame,key,up:true} release.
// Commands: {frame,job} starts a Sovereign job; {frame,damage,kd?} hits enemies[0]; {frame,fist:[i,damage,kd]} hits a fist;
// {frame,atkCd} / {frame,set} change enemies[0]. spec.stage selects STAGES[i] (arena scenarios cover stages 3-5).
const {fs,path,root,canonical}=require('../extract/common.cjs');
const {openBrowser}=require('../extract/browser.cjs');
const scenarios=[];
const tap=(frame,key)=>({frame,key});
const add=(id,steps,extra={})=>scenarios.push({id,steps,stage:4,character:'barel',enemies:[],events:[],commands:[],player:{},...extra});
const boss=(extra={})=>({kind:'boss5',x:440,y:430,ready:true,...extra});
add('legacy_pack_stage5',600,{enemies:[{kind:'grunt',x:520,y:420},{kind:'archer',x:180,y:440},{kind:'brute',x:560,y:470},{kind:'rogue',x:620,y:400}]});
const p1=['direct','slam','hammer','grab','clap','wave','wall','whirl','backhand','beam'];
for(const job of p1)add('sov_'+job,300,{enemies:[boss()],commands:[{frame:0,job}]});
for(const job of [...p1,'meteor'])add('sov_p2_'+job,320,{enemies:[boss({phase:2})],commands:[{frame:0,job}]});
add('sov_p2_ultimate',900,{enemies:[boss({phase:2})],commands:[{frame:0,job:'ultimate'}]});
add('sov_ultimate_dodge',900,{player:{x:200,y:470},enemies:[boss({phase:2,x:520})],commands:[{frame:0,job:'ultimate'}],
  events:[{frame:30,key:'ArrowUp',down:true},{frame:70,key:'ArrowUp',up:true}]});
add('grab_escape',220,{enemies:[boss()],commands:[{frame:0,job:'grab'}],events:Array.from({length:12},(_,i)=>tap(40+i*3,'KeyJ'))});
add('grab_fail',220,{enemies:[boss()],commands:[{frame:0,job:'grab'}]});
add('grab_fail_p2',220,{enemies:[boss({phase:2})],commands:[{frame:0,job:'grab'}]});
add('sov_ai_phase1',1500,{player:{inv:10000},enemies:[boss({x:540})]});
add('sov_ai_phase1_hits',1500,{enemies:[boss({x:540})]});
add('sov_ai_phase2',1500,{player:{inv:10000},enemies:[boss({x:540,phase:2})]});
add('sov_ai_ultimate',1200,{player:{inv:10000},enemies:[boss({x:540,phase:2,hpRatio:.35})]});
add('sov_ai_viesa',900,{character:'viesa',enemies:[boss({x:560})],events:[60,130,200,270,340,410,480,550,620].map(f=>tap(f,'KeyJ'))});
add('fists_barel',480,{player:{sp:100,mg:1,inv:10000},enemies:[boss({atkCd:100000})],
  events:[20,28,36,90,98,106].map(f=>tap(f,'KeyJ')).concat([tap(150,'KeyU'),tap(210,'KeyL'),tap(270,'KeyI'),tap(330,'KeyK'),tap(420,'KeyJ')])});
add('fists_barel_back',300,{player:{x:520,inv:10000},enemies:[boss({atkCd:100000})],events:[20,28,36,90,98,106,160,168,176].map(f=>tap(f,'KeyJ'))});
add('fists_viesa',480,{character:'viesa',player:{sp:100,inv:10000},enemies:[boss({x:560,atkCd:100000})],
  events:[30,42,54,66,78,90,102,114].map(f=>tap(f,'KeyJ')).concat([tap(180,'KeyO'),tap(280,'KeyK')])});
add('fist_break_rise',700,{player:{inv:10000},enemies:[boss({atkCd:100000})],commands:[{frame:5,fist:[0,200,false]}]});
add('fist_break_both',400,{player:{inv:10000},enemies:[boss({atkCd:100000})],commands:[{frame:5,fist:[0,200,false]},{frame:6,fist:[1,200,true]}]});
add('wall_block',220,{player:{inv:10000},enemies:[boss({atkCd:100000})],commands:[{frame:0,job:'wall'}],events:[30,38,46,80,88,96,150,158,166].map(f=>tap(f,'KeyJ'))});
add('pressure_backhand',300,{player:{inv:10000},enemies:[boss({atkCd:100000})],commands:[{frame:5,damage:10},{frame:15,damage:10},{frame:25,damage:10},{frame:40,atkCd:0}]});
add('sov_transition',320,{player:{inv:10000},enemies:[boss()],commands:[{frame:0,damage:3000}]});
add('sov_transition_jobs',320,{player:{inv:10000},enemies:[boss()],commands:[{frame:0,job:'slam'},{frame:30,damage:3000}]});
add('sov_groggy',420,{player:{inv:10000},enemies:[boss()],commands:[0,8,16,24,32,40].map(frame=>({frame,damage:30}))});
add('sov_knockdown_hp',260,{player:{inv:10000},enemies:[boss()],commands:[{frame:0,damage:150},{frame:1,set:{gr:0}},{frame:2,damage:150},{frame:3,set:{gr:0}},{frame:19,set:{gr:-100}},{frame:20,damage:220}]});
add('sov_death',240,{player:{inv:10000},clearReady:true,enemies:[boss({phase:2})],commands:[{frame:0,job:'clap'},{frame:10,damage:6000}]});
add('sov_intro',230,{intro:true});
add('stage5_banner',200,{banner:true});
add('stage5_progression',4600,{progression:true});
for(const [stage,id] of [[2,'fire'],[3,'frost'],[4,'abyss']])add('arena_'+id,820,{stage,arena:true,player:{y:425},events:[{frame:400,key:'ArrowDown',down:true},{frame:430,key:'ArrowDown',up:true}]});
const efields=['x','y','z','vx','vz','face','hp','max','st','t','inv','flash','walk','wait','atkCd','recT','hurtT','chainN','pat','pt','last','invuln','alpha','gr','grMax','grT','nextKd','p2shown','phaseT','remove','form','type','hw','hheavy'];
const hfields=['type','kind','x','y','h','age','dead','dir','delay','life','hit','boom','width','depth','arena','damage'];
const pfields=['x','y','z','vx','vz','face','hp','max','lives','st','t','inv','flash','sp','mg','buff','score','combo','comboT','buf','skill','atk','hurtKind','hurtDuration','viesaClip'];
async function main(){const b=await openBrowser();try{
 await b.evaluate(`Promise.all([S1_GROUP.ready,g2Early.ready,g2Late.ready,BarelHurt.ready,BarelJump.ready,BarelDashAttack.ready])`);
 const traces=[];
 for(const spec of scenarios){const trace=await b.evaluate(`(()=>{
  const spec=${JSON.stringify(spec)},efields=${JSON.stringify(efields)},hfields=${JSON.stringify(hfields)},pfields=${JSON.stringify(pfields)};
  Math.random=()=>.5;${require('./audio_log.cjs').hook}UX.saveCheckpoint=()=>{};UX.record=()=>{};practice=false;bossChallenge=false;
  selectedCharacterId=spec.character;player=newPlayer(0,spec.character);vargulRemains=[];sovereignRemains=[];startStage(spec.stage);tick=0;nextId=1;
  if(!spec.banner)scene='play';hitStop=0;shake=0;flashT=0;slowT=0;clearInput();
  stat.ticks=stat.damage=stat.deaths=stat.kills=0;chain.n=chain.t=chain.max=0;
  if(!spec.progression&&!spec.banner){barrels=[];Object.assign(player,{x:350,y:430,inv:0});waveIdx=STAGES[spec.stage].waves.length;camLock=true;lockAt=0;}
  if(spec.clearReady)camLock=false;
  Object.assign(player,spec.player);
  if(spec.intro){camLock=false;spawnWave(STAGES[spec.stage].waves.at(-1));}
  if(spec.arena){const w=STAGES[spec.stage].waves.find(q=>q.arena);spawnWave(w);for(const e of enemies){e.wait=100000;e.atkCd=100000;}}
  for(const o of spec.enemies){const e=mkEnemy(o.kind,o.x,o.y);enemies.push(e);
   if(o.wait!==undefined)e.wait=o.wait;if(o.atkCd!==undefined)e.atkCd=o.atkCd;
   if(o.phase===2){e.p2shown=true;e.hp=e.max=SOVEREIGN_RULES.hp[1];e.nextKd=e.max*.75;}
   if(o.hpRatio)e.hp=e.max*o.hpRatio;
   if(o.ready){const s=sovData(e);for(const f of s.fists){const [x,y,h]=sovHome(e,f,s);Object.assign(f,{x,y,h,st:'home'});
     if(o.phase===2)f.hp=f.max=SOVEREIGN_RULES.fistHp[1];}}}
  const pick=(o,keys)=>Object.fromEntries(keys.map(k=>[k,o[k]===undefined?null:o[k]]));
  const sov=e=>{const s=e.sov;if(!s)return null;const n=v=>v===undefined?null:v;
   return {now:s.now,pressure:s.pressure,pressureT:s.pressureT,forceBackhand:s.forceBackhand,lastMove:s.lastMove,repeats:s.repeats,lastDangerEnd:s.lastDangerEnd,dangerWas:s.dangerWas,
    pending:s.pending?[s.pending.id,s.pending.until]:null,grounded:s.grounded,downAt:s.downAt,transAge:s.transAge,ultimateUsed:!!s.ultimateUsed,dead:!!s.dead,remains:!!s.remains,
    cooldowns:Object.entries(s.cooldowns).filter(([,v])=>v>0).map(([k,v])=>k+':'+v).sort().join(','),
    body:s.body?{clip:s.body.clip,from:s.body.from,to:s.body.to,ticks:s.body.ticks,t:s.body.t,bound:s.body.bound,drawing:s.body.drawing,idle:s.body.idle,job:s.jobs.indexOf(s.body.job)}:null,
    jobs:s.jobs.map(j=>({id:j.id,t:j.t,st:j.st,stage:j.stage,danger:j.danger,dangerDone:j.dangerDone,warn:j.warn,done:j.done,p2:j.p2,hits:[...j.hits].sort().join(','),
     fists:j.fists.map(f=>f.i).join(','),helper:j.helper?j.helper.i:null,lane:n(j.lane),dir:n(j.dir),travel:n(j.travel),k:n(j.k),side:n(j.side),cx:n(j.cx),tx:n(j.tx),start:n(j.start),
     mark:j.mark?[j.mark.x,j.mark.y,j.mark.blink]:null,marks:j.marks?j.marks.length:null,remaining:n(j.remaining),spawned:n(j.spawned),elapsedMs:n(j.elapsedMs),lastY:n(j.lastY),
     hands:j.hands?j.hands.map(h=>[h.x,h.y,h.dir,h.ageMs,h.fired,h.hit]):null})),
    marks:s.marks.map(m=>[m.x,m.y,m.rx,m.ry,m.blink,!!m.done,n(m.k)]),waves:s.waves.map(w=>[w.x,w.dir,w.age,w.hit]),
    fx:s.fx.map(f=>[f.id,f.x,f.y,f.h,f.w,f.hgt,f.life,f.age,!!f.ground]),
    fists:s.fists.map(f=>({x:f.x,y:f.y,h:f.h,face:f.face,st:f.st,hp:f.hp,max:f.max,pose:f.pose,angle:f.angle,glow:f.glow,trail:f.trail,timer:f.timer,wake:f.wake,flash:f.flash,vh:f.vh,broken:f.broken,
     job:f.job?s.jobs.indexOf(f.job):null}))};};
  const snapshot=()=>({tick,mode:scene,hitStop,shake,flashT,slowT,camX,camLock,waveIdx,clearT,introT:scene==='bossintro'?introT:null,bannerT,
   stat:{...stat},chain:{...chain},player:{...pick(player,pfields),grab:player.grab?.sovereign?[player.grab.presses,player.grab.hold]:null},
   remains:sovereignRemains.map(r=>[r.x,r.y,r.face,...r.fists.flatMap(f=>[f.x,f.y,f.face])]),
   arena:arena?[arena.kind,arena.time,arena.next,arena.cycle]:null,
   enemies:enemies.map(e=>({...pick(e,efields),sov:sov(e)})),
   hazards:hazards.map(z=>pick(z,hfields)),
   barrels:barrels.map(o=>({x:o.x,y:o.y,hp:o.hp,flash:o.flash})),
   items:items.map(i=>({type:i.type,x:i.x,y:i.y,z:i.z,t:i.t,life:i.life}))});
  const frames=[];__audioLog.length=0;for(let frame=0;frame<spec.steps;frame++){
   for(const event of spec.events)if(frame===event.frame){if(!event.up)inputDown(event.key);if(!event.down)inputUp(event.key);}
   for(const c of spec.commands)if(frame===c.frame){
    const e=enemies[enemies.length-1];
    if(c.job)sovStartJob(e,sovData(e),c.job);
    if(c.damage)damageEnemy(e,c.damage,!!c.kd,0,false,'c1');
    if(c.fist)sovDamageFist(e,e.sov.fists[c.fist[0]],c.fist[1],c.fist[2]);
    if(c.atkCd!==undefined)e.atkCd=c.atkCd;
    if(c.set)Object.assign(e,c.set);}
   if(spec.progression){player.inv=10000;if(camLock&&frame%90===0)for(const o of enemies){if(o.boss)continue;o.st='dead';o.t=0;o.hp=0;}if(!camLock&&scene==='play')player.x=Math.min(player.x+6,stage.len-50);}
   const processed=update();if(processed)for(const k in pressed){pressed[k]-=MS;if(pressed[k]<=0)delete pressed[k];}
   frames.push({...snapshot(),audio:__audioLog.splice(0)});if(spec.progression&&scene==='play'&&enemies.some(e=>e.boss)&&frame>60&&frames.at(-2)?.mode==='bossintro')break;
  }return {spec,frames};})()`);traces.push(trace);console.log(spec.id+': '+trace.frames.length);}
 fs.writeFileSync(path.join(root,'godot/phase9/fixtures/traces.json'),JSON.stringify(canonical({traces}))+'\n');
 console.log('PHASE 9 ORACLE: '+traces.length+' scenarios, '+traces.reduce((n,t)=>n+t.frames.length,0)+' source steps');
}finally{await b.close();}}main().catch(e=>{console.error(e.stack);process.exit(1);});
