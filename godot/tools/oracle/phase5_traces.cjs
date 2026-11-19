// Phase 5 oracle: runs the original browser game with Viesa and records every step.
// Events: {frame,key} taps a key; {frame,key,down:true} holds it; {frame,key,up:true} releases it.
const {fs,path,root,canonical}=require('../extract/common.cjs');
const {openBrowser}=require('../extract/browser.cjs');
const scenarios=[];
const passive=(kind,x,y=430,extra={})=>({kind,x,y,wait:100000,atkCd:100000,...extra});
const tap=(frame,key)=>({frame,key});
const hold=(frame,key)=>({frame,key,down:true});
const release=(frame,key)=>({frame,key,up:true});
const add=(id,steps,extra={})=>scenarios.push({id,steps,enemies:[],events:[],commands:[],player:{},...extra});
add('walk_jump',170,{events:[hold(0,'KeyD'),release(30,'KeyD'),tap(35,'Space'),hold(40,'KeyS'),release(50,'KeyS'),hold(85,'KeyA'),tap(90,'Space'),release(125,'KeyA')]});
add('shot_single',80,{enemies:[passive('axe',520)],events:[tap(2,'KeyJ')]});
add('shot_chain',140,{enemies:[passive('axe',520)],events:[2,8,14,20,26,40,60].map(f=>tap(f,'KeyJ'))});
add('shot_depth_aim',80,{enemies:[passive('axe',520,470)],events:[tap(2,'KeyJ')]});
add('shot_out_of_range',80,{enemies:[passive('axe',600)],events:[tap(2,'KeyJ')]});
add('air_shot',170,{enemies:[passive('axe',540)],events:[tap(2,'Space'),...[10,16,22,28,34].map(f=>tap(f,'KeyJ'))]});
add('melee_combo',120,{enemies:[passive('axe',395)],events:[tap(2,'KeyH'),tap(10,'KeyH'),tap(18,'KeyH')]});
add('melee_link',140,{enemies:[passive('club',395)],events:[tap(2,'KeyH'),tap(36,'KeyH'),tap(70,'KeyJ')]});
add('rapid_lane',150,{enemies:[passive('axe',500),passive('blade',500,470)],events:[tap(2,'KeyU'),hold(20,'KeyS'),release(70,'KeyS')]});
add('snipe_tap',120,{enemies:[passive('axe',600),passive('heavy',700)],events:[tap(2,'KeyL')]});
add('snipe_hold',260,{enemies:[passive('axe',600)],events:[hold(2,'KeyL'),release(180,'KeyL')]});
add('ground_backflip',110,{enemies:[passive('axe',450),passive('blade',520)],events:[tap(2,'KeyO')]});
add('air_backflip_hover',210,{enemies:[passive('axe',620)],events:[tap(2,'Space'),tap(12,'KeyP'),tap(60,'KeyJ')]});
add('air_backflip_timeout',170,{events:[tap(2,'Space'),tap(12,'KeyP')]});
add('dash_shot',80,{enemies:[passive('axe',560)],events:[tap(2,'ShiftLeft'),tap(10,'KeyJ')]});
add('double_tap_dash',60,{events:[tap(2,'KeyD'),tap(6,'KeyD')]});
add('ultimate',230,{player:{sp:100},enemies:[passive('axe',450),passive('blade',520,470),passive('club',380,400)],events:[tap(2,'KeyK')]});
add('ultimate_empty',150,{player:{sp:100},events:[tap(2,'KeyK')]});
add('cast_bolt',80,{player:{mg:1},enemies:[passive('axe',450)],events:[tap(2,'KeyI')]});
add('axe_attacks',400,{enemies:[{kind:'axe',x:390,y:430}]});
add('heavy_grab',240,{enemies:[{kind:'heavy',x:380,y:430,move:'grab'}]});
add('hound_bite',150,{enemies:[{kind:'hound',x:380,y:430,grab:'bite'}]});
add('barrel_shot',80,{barrel:true,events:[tap(2,'KeyJ'),tap(30,'KeyJ')]});
add('skill_cooldowns',220,{enemies:[passive('axe',560)],events:[tap(2,'KeyU'),tap(100,'KeyU'),tap(120,'KeyO'),tap(170,'KeyO')]});
add('hurt_during_rapid',120,{events:[tap(2,'KeyU')],commands:[{frame:30,hurt:{dmg:10,dir:-1,kd:false}}]});
add('air_knockdown',120,{events:[tap(2,'Space')],commands:[{frame:12,hurt:{dmg:10,dir:-1,kd:false}}]});
add('death_respawn',150,{commands:[{frame:5,hurt:{dmg:200,dir:1,kd:true}}]});
add('pickup_potion',30,{player:{hp:40},item:'potion'});
const fields=['x','y','z','vx','vz','face','hp','st','t','inv','flash','walk','wait','atkCd','hurtT','chainN','getup','grabCd','nextKd'];
const pfields=['x','y','z','vx','vz','face','hp','max','lives','st','t','inv','flash','sp','mg','buff','score','combo','comboT','buf','skill','walk','walkTime','dashCd','dashGrace','castFired','atk','x0','w','hw','viesaClip','viesaFired','viesaShotQueued','viesaHoverGrace','viesaAirPUsed','viesaLanding','jumpTime'];
async function main(){const b=await openBrowser();try{
 await b.evaluate(`Promise.all([S1_GROUP.ready,g2Early.ready,g2Late.ready,BarelHurt.ready,BarelJump.ready,BarelDashAttack.ready])`);
 await b.evaluate(`globalThis.__viesaFrame=viesaFrame;globalThis.viesaFrame=function(name,index=0){globalThis.__lastPose={clip:name,index:Math.min((VIESA_ART.clips[name]||[]).length-1,Math.max(0,Math.floor(index)))};return __viesaFrame(name,index);}`);
 const traces=[];
 for(const spec of scenarios){const trace=await b.evaluate(`(()=>{
  const spec=${JSON.stringify(spec)},fields=${JSON.stringify(fields)},pfields=${JSON.stringify(pfields)};Math.random=()=>.5;UX.saveCheckpoint=()=>{};
  selectedCharacterId='viesa';player=newPlayer(0,'viesa');startStage(0);tick=0;nextId=1;scene='play';hitStop=0;shake=0;flashT=0;slowT=0;clearT=0;enemies=[];barrels=[];items=[];hazards=[];resetGorath2();resetViesaEffects();clearInput();
  stat.ticks=stat.damage=stat.deaths=stat.kills=0;chain.n=chain.t=chain.max=0;Object.assign(player,{x:350,y:430,inv:0},spec.player);
  updStage1=()=>{};stage1Finished=()=>false;
  for(const o of spec.enemies){const e=mkEnemy(o.kind,o.x,o.y);enemies.push(e);e.s1=o.kind;e.d={...STAGE1_ET[o.kind]};e.hp=e.max=e.d.hp;e.wait=20;e.atkCd=40;
   if(o.kind==='heavy')e.grabCd=60;if(o.kind==='molotov'){e.molotov=true;e.atkCd=50;e.kickCd=0;e.laneY=e.y;}
   if(o.kind==='hound'){e.diveCd=80;e.ang=(e.id*2.39)%(Math.PI*2);e.rad=270;}
   if(o.wait!==undefined)e.wait=o.wait;if(o.atkCd!==undefined)e.atkCd=o.atkCd;
   if(o.move)beginStage1Move(e,o.move);if(o.grab)o.grab==='bite'?beginHoundBite(e):beginStage1Grab(e);}
  if(spec.item)dropItem(spec.item,350,430);if(spec.barrel)barrels.push({kind:'barrel',x:450,y:430,z:0,hw:16,hp:2,flash:0,dead:false,t:0});
  const pick=(o,keys)=>Object.fromEntries(keys.map(k=>[k,o[k]??null]));
  const snapshot=()=>{
   const a=player.viesaAction;globalThis.__lastPose=null;viesaPose();
   return {tick,mode:scene,hitStop,shake,flashT,stat:{...stat},chain:{...chain},
   player:{...pick(player,pfields),grab:player.grab?{kind:player.grab.bite?'bite':'heavy',presses:player.grab.presses,t:player.grab.t??0}:null,
    skillCd:{...player.skillCd},
    action:a?{phase:a.phase,id:a.id,held:a.held,shots:a.shots,x0:a.x0,face:a.face,high:a.high,h0:a.h0,released:a.released,clock:a.clock??null,arrows:a.arrows??null,finalFired:!!a.finalFired,landed:!!a.landed}:null,
    pose:__lastPose},
   enemies:enemies.map(e=>({...pick(e,fields),species:e.s1||e.type})),
   barrels:barrels.map(o=>({x:o.x,y:o.y,hp:o.hp,flash:o.flash})),
   items:items.map(i=>({type:i.type,x:i.x,y:i.y,z:i.z,t:i.t,life:i.life})),
   arrows:hazards.filter(z=>z.type==='viesa_arrow').map(z=>({x:z.x,y:z.y,h:z.h,dir:z.dir,age:z.age,speed:z.speed,vh:z.vh,range:z.range,travel:z.travel,depth:z.depth,aimY:z.aimY,startY:z.startY,damage:z.damage,snipe:z.snipe,rapid:z.rapid,paidSpecial:z.paidSpecial,fading:!!z.fading,fadeAge:z.fadeAge,dead:!!z.dead,hits:z.hits.size})),
   ult:viesaUltObjects.map(z=>({kind:z.kind,x:z.x,y:z.y,h:z.h,sx:z.sx,sy:z.sy,sh:z.sh,tx:z.tx,ty:z.ty,th:z.th,face:z.face,age:z.age,life:z.life,variant:z.variant,impact:z.impact,damage:z.damage})),
   effects:viesaEffects.map(f=>({name:f.name,x:f.x,y:f.y,h:f.h,age:f.age,life:f.life,width:f.width,height:f.height,face:f.face}))};};
  const frames=[];for(let frame=0;frame<spec.steps;frame++){
   for(const event of spec.events)if(frame===event.frame){if(!event.up)inputDown(event.key);if(!event.down)inputUp(event.key);}
   for(const command of spec.commands)if(frame===command.frame&&command.hurt)hurtPlayer(command.hurt.dmg,command.hurt.dir,command.hurt.kd);
   const processed=update();if(processed)for(const k in pressed){pressed[k]-=MS;if(pressed[k]<=0)delete pressed[k];}
   frames.push(snapshot());
  }return {spec,frames};})()`);traces.push(trace);console.log(spec.id+': '+trace.frames.length);}
 fs.writeFileSync(path.join(root,'godot/phase5/fixtures/traces.json'),JSON.stringify(canonical({traces}))+'\n');
 console.log('PHASE 5 ORACLE: '+traces.length+' scenarios, '+traces.reduce((n,t)=>n+t.frames.length,0)+' source steps');
}finally{await b.close();}}main().catch(e=>{console.error(e.stack);process.exit(1);});
