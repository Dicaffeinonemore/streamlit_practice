// Execute the real browser FSM, never a second JavaScript combat implementation.
const {fs,path,root,read,hash,canonical}=require('../extract/common.cjs');
const {openBrowser}=require('../extract/browser.cjs');
const out=path.join(root,'godot/phase2/fixtures');fs.mkdirSync(out,{recursive:true});
const event=(frame,key,down=true)=>({frame,key,down});
const tap=(frame,key)=>[event(frame,key),event(frame+1,key,false)];
const scenarios=[];
const add=(id,frames,extra={})=>scenarios.push({id,frames,events:[],enemies:[],...extra});
add('diagonal_movement_jump',100,{events:[event(0,'KeyD'),event(0,'KeyW'),...tap(10,'Space'),event(30,'KeyD',false),event(30,'KeyW',false)]});
add('holding_attack_does_not_auto_combo',110,{events:[event(0,'KeyJ'),event(100,'KeyJ',false)]});
add('buffered_three_hit_combo',160,{events:[...tap(0,'KeyJ'),...tap(11,'KeyJ'),...tap(30,'KeyJ')],enemies:[{kind:'axe',x:265,y:430,hp:500,training:true}]});
add('combo_link_after_recovery',130,{events:[...tap(0,'KeyJ'),...tap(35,'KeyJ'),...tap(70,'KeyJ')]});
add('combo_expired_link',120,{events:[...tap(0,'KeyJ'),...tap(80,'KeyJ')]});
add('air_attack',100,{events:[...tap(0,'Space'),...tap(8,'KeyJ')],enemies:[{kind:'blade',x:275,y:430,hp:500,training:true}]});
add('dash',60,{events:tap(0,'ShiftLeft')});
add('dash_attack',100,{events:[...tap(0,'ShiftLeft'),...tap(8,'KeyJ')],enemies:[{kind:'axe',x:330,y:430,hp:500,training:true}]});
add('double_tap_dash',60,{events:[...tap(0,'KeyD'),...tap(10,'KeyD')]});
add('dash_attack_cancel',110,{events:[...tap(0,'ShiftLeft'),...tap(8,'KeyJ'),...tap(40,'Space')]});
for(const [name,key]of Object.entries({thrust:'KeyU',slam:'KeyH',whirl:'KeyO',leap:'KeyP',redwave:'KeyL'}))add('skill_'+name,150,{events:tap(0,key),enemies:[{kind:'club',x:290,y:430,hp:1000,training:true}]});
add('aim_skill_before_movement',70,{player:{face:1},events:[event(0,'KeyA'),...tap(0,'KeyU'),event(2,'KeyA',false)]});
add('special',250,{player:{sp:100},events:tap(0,'KeyK'),enemies:[{kind:'axe',x:350,y:430,hp:1000,training:true}]});
add('magic',150,{player:{mg:3},events:tap(0,'KeyI'),enemies:[{kind:'club',x:400,y:450,hp:1000,training:true}]});
for(const [name,id,kd,kind]of [['light','c1',false,0],['mid','air',false,2],['heavy','skill',false,1],['finisher','magic',true,2]])add('grade_'+name,100,{enemies:[{kind:'axe',x:270,y:430,hp:1000}],commands:[{frame:0,op:'damage_enemy',index:0,damage:10,kd,kind,attack:id}]});
add('seven_hit_cap',150,{enemies:[{kind:'axe',x:270,y:430,hp:1000}],commands:Array.from({length:7},(_,i)=>({frame:i*8,op:'damage_enemy',index:0,damage:1,kd:false,kind:0,attack:'c1'}))});
add('hurt_high',70,{commands:[{frame:0,op:'hurt_player',damage:8,dir:-1,kd:false,height:82}]});
add('hurt_low',70,{commands:[{frame:0,op:'hurt_player',damage:8,dir:1,kd:false,height:45}]});
add('knockdown',130,{commands:[{frame:0,op:'hurt_player',damage:12,dir:1,kd:true}]});
add('death_respawn',150,{commands:[{frame:0,op:'hurt_player',damage:120,dir:1,kd:true}]});
for(const kind of ['axe','blade','club'])add('enemy_'+kind,400,{enemies:[{kind,x:300,y:430}]});
add('three_enemy_separation',350,{enemies:[{kind:'axe',x:300,y:430},{kind:'club',x:310,y:432},{kind:'blade',x:350,y:440}]});
add('club_armor_window',100,{enemies:[{kind:'club',x:350,y:430}],commands:[{frame:0,op:'enemy_move',index:0,clip:'attack'},{frame:25,op:'damage_enemy',index:0,damage:10,kd:false,kind:0,attack:'c1'}]});
add('enemy_collision',120,{enemies:[{kind:'axe',x:270,y:430,hp:1000},{kind:'blade',x:294,y:430,hp:1000}],commands:[{frame:0,op:'damage_enemy',index:0,damage:10,kd:true,kind:2,attack:'magic'}]});
add('hitstop_preserves_buffer',100,{events:[...tap(0,'KeyJ'),...tap(11,'KeyJ')],enemies:[{kind:'axe',x:260,y:430,hp:500,training:true}]});
add('depth_miss',65,{events:tap(0,'KeyJ'),enemies:[{kind:'axe',x:260,y:454,hp:500,training:true}]});
add('facing_miss',65,{player:{face:-1},events:tap(0,'KeyJ'),enemies:[{kind:'axe',x:260,y:430,hp:500,training:true}]});

async function main(){const browser=await openBrowser();try{
  await browser.evaluate(`Promise.all([BarelHurt.ready,BarelDashAttack.ready,BarelJump.ready,S1_GROUP.ready])`);
  await browser.evaluate(`new Promise(resolve=>{const poll=()=>BarelRika.ready()?resolve(true):setTimeout(poll,20);poll();})`);
  const data=await browser.evaluate(`JSON.parse(JSON.stringify({combat:COMBAT_FRAME_DATA,stage_enemies:STAGE1_ET,stage_moves:S1_MOVES,stage_anim:S1_ANIM,stage_art:STAGE1_ENEMY_ART,stage_sections:STAGE1_SECTIONS,background:STAGE1_BG.street,special:SPECIAL,magic:MAGIC,dash_attack:BarelDashAttack.data,hurt_sequences:{high:[3,5,5,5,6],low:[3,5,5,6,6]},low_hurtbox_height:84.919114}))`);
  fs.writeFileSync(path.join(out,'source_data.json'),JSON.stringify(canonical(data),null,2)+'\n');
  const numbers=[];
  function captureNumbers(value,keys=[]){
    if(typeof value==='number'&&!Number.isInteger(value)){const bytes=Buffer.alloc(8);bytes.writeDoubleLE(value);numbers.push({path:keys,bits:bytes.toString('hex')});}
    else if(value&&typeof value==='object')for(const [key,child]of Object.entries(value))captureNumbers(child,[...keys,Array.isArray(value)?Number(key):key]);
  }
  captureNumbers(data);
  fs.writeFileSync(path.join(out,'source_numbers.json'),JSON.stringify(numbers)+'\n');
  await browser.evaluate(`globalThis.__sourceUpdStage1=updStage1;globalThis.__sourceStage1Finished=stage1Finished`);
  const traces=[];
  for(const scenario of scenarios){const trace=await browser.evaluate(`(()=>{
    const s=${JSON.stringify(scenario)};
    Math.random=()=>.5;
    UX.saveCheckpoint=()=>{};dropFrom=()=>{};dropFromBarrel=()=>{};
    player=newPlayer(0,'barel');startStage(0);scene='play';introBoss=null;introT=0;tick=0;
    Object.assign(player,{x:200,y:430,inv:0},s.player||{});nextId=1;enemies=[];barrels=[];items=[];
    camX=0;camLock=true;lockAt=0;waveIdx=0;clearT=0;hitStop=0;shake=0;flashT=0;slowT=0;
    stat.ticks=stat.damage=stat.deaths=stat.kills=0;chain.n=chain.t=chain.max=0;lastHit=null;clearInput();
    S1.on=true;S1.idx=0;S1.sec=STAGE1_SECTIONS[0];S1.fade=null;S1.lock=null;
    updStage1=()=>{};stage1Finished=()=>false;
    for(const spec of s.enemies){const e=mkEnemy(spec.kind,spec.x,spec.y);e.s1=spec.kind;e.d={...STAGE1_ET[spec.kind]};e.hp=e.max=spec.hp||e.d.hp;e.wait=20;e.atkCd=40;if(spec.training)e.training=true;enemies.push(e);}
    const keys=['x','y','z','vx','vz','face','hp','lives','st','t','atk','combo','comboT','buf','x0','inv','flash','buff','score','walk','walkTime','sp','dashCd','dashGrace','mg','castFired','skill','skillDest','hurtKind','hurtDuration','spX','spY','spX0','spY0','spHits','spFin','spDash','dashAttackHit','dashFlash'];
    const enemyKeys=['id','s1','x','y','z','vx','vz','face','hp','st','t','inv','flash','wait','atkCd','walk','recT','hurtT','chainN','hitLow','redFlash','getup','pat','remove'];
    const snapshot=()=>({tick,hitStop,shake,flashT,chain:{...chain},stat:{...stat},pressed:{...pressed},player:Object.fromEntries(keys.map(k=>[k,player[k]??null])),skillCd:{...player.skillCd},enemies:enemies.map(e=>({...Object.fromEntries(enemyKeys.map(k=>[k,e[k]??null])),mv:e.mv?{clip:e.mv.clip,t:e.mv.t,f:e.mv.f,hit:e.mv.hit}:null})),hazards:hazards.filter(z=>z.type==='pwave').map(z=>({x:z.x,y:z.y,h:z.h,age:z.age,travel:z.travel,damage:z.damage,dead:!!z.dead})),pose:{player:(()=>{const f=BarelRika.frameFor(player,MS,tick*MS);return {clip:f.clip,index:f.index};})(),enemies:enemies.map(e=>{const [clip,index]=stage1SoldierFrame(e);return {clip,index};})}});
    const frames=[];for(let frame=0;frame<s.frames;frame++){
      for(const ev of s.events)if(ev.frame===frame)ev.down?inputDown(ev.key):inputUp(ev.key);
      for(const c of s.commands||[])if(c.frame===frame){if(c.op==='damage_enemy')damageEnemy(enemies[c.index],c.damage,c.kd,c.kind,false,c.attack);else if(c.op==='hurt_player')hurtPlayer(c.damage,c.dir,c.kd,null,c.height?{hitHeight:c.height}:null);else if(c.op==='enemy_move')beginStage1Move(enemies[c.index],c.clip);}
      const processed=update();if(processed)for(const k in pressed){pressed[k]-=MS;if(pressed[k]<=0)delete pressed[k];}
      frames.push(snapshot());
    }return {scenario:s,frames};})()`);traces.push(trace);console.log('Oracle: '+scenario.id+' '+trace.frames.length+' frames');}
  const tables=await browser.evaluate(`({grades:Object.fromEntries(FEEL.tierOrder.map(name=>[name,FEEL.tiers[name]])),attacks:Object.fromEntries(Object.entries(BAREL_COMBAT.combo.moves).map(([id,m])=>[id,{wind:m.windMs,active:m.actMs,recovery:m.recMs,damage:m.damage,reach:m.reachPx,hurt:enemyHitstun({type:'axe'},id)}])),zones:['axe','blade','club'].flatMap(id=>Object.entries(S1_MOVES[id]).flatMap(([clip,m])=>(m.hits||[]).map(h=>({id,clip,hit:h,box:stage1HitBox(id,clip,h)}))))})`);
  const sources=Object.fromEntries(['game.js','combat-data.js','stage1-runtime.js','feel-runtime.js','src/animation/barel-hurt.js','src/animation/barel-dash-attack.js'].map(f=>[f,hash(read(f))]));
  await require('./core_extras.cjs')(browser,out);
  fs.writeFileSync(path.join(out,'traces.json'),JSON.stringify(canonical({schema:1,browser:browser.version.product,sources,tables,traces}))+'\n');
  console.log(`ORACLE: ${traces.length} scenarios, ${traces.reduce((n,t)=>n+t.frames.length,0)} source steps`);
}finally{await browser.close();}}
main().catch(e=>{console.error(e.stack);process.exit(1);});
