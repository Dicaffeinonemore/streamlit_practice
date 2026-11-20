const {fs,path,root,canonical}=require('../extract/common.cjs');
const {openBrowser}=require('../extract/browser.cjs');
const scenarios=[];
const add=(id,steps,kind,extra={})=>scenarios.push({id,steps,kind,events:[],commands:[],...extra});
for(const kind of ['axe','blade','club','heavy','molotov','hound'])add('enemy_'+kind,550,kind);
add('heavy_grab',240,'heavy',{move:'grab'});
add('heavy_escape',160,'heavy',{grab:'heavy',events:[{frame:3,key:'KeyJ'},{frame:4,key:'KeyA'},{frame:5,key:'KeyD'},{frame:6,key:'KeyW'}]});
add('hound_bite',150,'hound',{grab:'bite'});
add('hound_escape',100,'hound',{grab:'bite',events:[{frame:3,key:'KeyJ'},{frame:4,key:'KeyA'}]});
add('heavy_armor',120,'heavy',{commands:[0,10,20,30].map(frame=>({frame,damage:5}))});
for(const move of ['chop','thrust','tackle','sweep','hook','dchop','punch','charge','hook2'])add('gorath_'+move,300,'boss1',{move,phase:move==='dchop'||move==='punch'||move==='charge'||move==='hook2'?2:1});
add('gorath_hook_escape',250,'boss1',{move:'hook',events:[{frame:70,key:'KeyJ'},{frame:71,key:'KeyA'},{frame:72,key:'KeyD'},{frame:73,key:'KeyW'}]});
add('gorath_transform',250,'boss1',{commands:[{frame:0,damage:1000}]});
add('gorath_ultimate_thresholds',1000,'boss1',{phase:2,commands:[{frame:0,damage:1000},{frame:650,damage:1000}]});
add('gorath_death',320,'boss1',{phase:2,spent:true,commands:[{frame:0,damage:1000}]});
add('gorath_intro',570,'boss1',{intro:true});
add('five_sections',2600,'',{progression:true});
for(const item of ['potion','big','power','scroll','crystal','coin','coinBag','gold'])add('pickup_'+item,60,'',{item});
add('barrel_drop',100,'',{barrel:true,commands:[{frame:0,barrel:true},{frame:10,barrel:true}]});
add('enemy_item_drop',120,'axe',{commands:[{frame:0,damage:1000}]});
add('molotov_redwave',400,'molotov',{safe:true,events:[{frame:120,key:'KeyL'}]});
const fields=['x','y','z','vx','vz','face','hp','st','t','inv','flash','walk','wait','atkCd','recT','hurtT','chainN','hitLow','redFlash','getup','pat','invuln','alpha','grabCd','kickCd','diveCd','ang','rad','balcony','molotov','throws','throwAt','laneY','bite','armorHits','armorT','gr','grT','nextKd'];
async function main(){const b=await openBrowser();try{
 await b.evaluate(`Promise.all([S1_GROUP.ready,g2Early.ready,g2Late.ready,BarelHurt.ready,BarelJump.ready,BarelDashAttack.ready])`);
 await b.evaluate(`globalThis.__stageUpdate=updStage1;globalThis.__stageFinished=stage1Finished`);
 const traces=[];
 for(const spec of scenarios){const trace=await b.evaluate(`(()=>{
  const spec=${JSON.stringify(spec)},fields=${JSON.stringify(fields)};Math.random=()=>.5;${require('./audio_log.cjs').hook}UX.saveCheckpoint=()=>{};
  player=newPlayer(0,'barel');startStage(0);tick=0;nextId=1;scene='play';hitStop=0;shake=0;flashT=0;slowT=0;clearT=0;enemies=[];barrels=[];items=[];hazards=[];resetGorath2();clearInput();
  stat.ticks=stat.damage=stat.deaths=stat.kills=0;chain.n=chain.t=chain.max=0;Object.assign(player,{x:350,y:430,inv:0});
  updStage1=spec.progression?__stageUpdate:()=>{};stage1Finished=spec.progression?__stageFinished:()=>false;
  let e=null;
  if(spec.intro){enterSection(4);gorath2BeginIntro();e=enemies[0];}
  else if(spec.progression){enterSection(0);barrels=[];}
  else if(spec.kind){e=mkEnemy(spec.kind,260,430);enemies.push(e);if(spec.kind==='boss1'){g2Data(e);if(spec.phase===2)g2StartPhase2(e,e.g2);if(spec.spent)e.g2.ult=[true,true];if(spec.move)g2StartMove(e,e.g2,spec.move);}
   else{e.s1=spec.kind;e.d={...STAGE1_ET[spec.kind]};e.hp=e.max=e.d.hp;e.wait=20;e.atkCd=40;
    if(spec.kind==='heavy')e.grabCd=60;if(spec.kind==='molotov'){e.molotov=true;e.atkCd=50;e.kickCd=0;e.laneY=e.y;}
    if(spec.kind==='hound'){e.diveCd=80;e.ang=(e.id*2.39)%(Math.PI*2);e.rad=270;}
    if(spec.move)beginStage1Move(e,spec.move);if(spec.grab)spec.grab==='bite'?beginHoundBite(e):beginStage1Grab(e);}}
  if(spec.safe)player.inv=10000;if(spec.item){player.hp=40;dropItem(spec.item,350,430);}if(spec.barrel)barrels.push({x:400,y:430,z:0,hw:16,hp:2,flash:0,dead:false,t:0});
  const clean=o=>Object.fromEntries(fields.map(k=>[k,o[k]??null]));
  const snapshot=()=>({tick,mode:scene,hitStop,shake,flashT,stat:{...stat},chain:{...chain},
   player:{x:player.x,y:player.y,z:player.z,vx:player.vx,vz:player.vz,hp:player.hp,lives:player.lives,st:player.st,t:player.t,inv:player.inv,flash:player.flash,score:player.score,sp:player.sp,mg:player.mg,buff:player.buff,grab:player.grab?{kind:player.grab.gorath2?'gorath':player.grab.bite?'bite':'heavy',presses:player.grab.presses,t:player.grab.t??0,hold:player.grab.hold??0,squeezes:player.grab.squeezes??0}:null},
   section:spec.progression?{idx:S1.idx,event:S1.ev,locked:camLock,cam:camX,fade:S1.fade?.t??-1,wall:S1.wall?.t??-1,broken:!!S1.wall?.broke,gate:S1.gate?.t??-1}:null,
   enemies:enemies.map(e=>({...clean(e),species:e.s1||e.type,mv:e.mv?{clip:e.mv.clip,t:e.mv.t,f:e.mv.f}:null,dive:e.dv?{t:e.dv.t,f:e.dv.f,dir:e.dv.dir,x0:e.dv.x0}:null,
    g2:e.g2?{phase:e.g2.phase,st:e.g2.st,clip:e.g2.clip,fi:e.g2.fi,age:e.g2.age,walkT:e.g2.walkT,tail:e.g2.tail,breath:e.g2.breath,guard:e.g2.guard,pendingT:e.g2.pendingT,ult:e.g2.ult.slice(),act:e.g2.act?{kind:e.g2.act.kind,id:e.g2.act.id??'',t:e.g2.act.t,f:e.g2.act.f??1,ph:e.g2.act.ph??'cast',pulls:e.g2.act.pulls??0,step:e.g2.act.step??-1}:null,hook:e.g2.hook?{x:e.g2.hook.x??0,y:e.g2.hook.y??0,h:e.g2.hook.h??0,st:e.g2.hook.st??'out',u:e.g2.hook.u??0,ult:!!e.g2.hook.ult,hidden:!!e.g2.hook.hidden}:null,meats:e.g2.meats.map(m=>({...m,frame:g2MeatFrame(m)}))}:null})),
   pose:enemies.map(e=>{if(e.g2)return {clip:e.g2.clip,index:e.g2.fi};const[clip,index]=stage1SoldierFrame(e);return {clip,index};}),
   barrels:barrels.map(b=>({x:b.x,y:b.y,hp:b.hp,flash:b.flash})),
   items:items.map(i=>({type:i.type,x:i.x,y:i.y,z:i.z,vx:i.vx,vz:i.vz,t:i.t,life:i.life})),hazards:hazards.filter(z=>['fire','firemark','molotov'].includes(z.type)).map(z=>({type:z.type,x:z.x,y:z.y,h:z.h??0,age:z.age,dead:!!z.dead}))});
  const frames=[];__audioLog.length=0;for(let frame=0;frame<spec.steps;frame++){
   for(const event of spec.events)if(frame===event.frame){inputDown(event.key);inputUp(event.key);}
   for(const command of spec.commands)if(frame===command.frame){if(command.barrel)damageBarrel(barrels[0]);else damageEnemy(e,command.damage,false,0,false,'c1');}
   if(spec.progression){player.inv=10000;if(S1.lock&&frame%90===0)for(const o of enemies){o.st='dead';o.t=0;o.hp=0;o.mv=null;o.dv=null;}if(!camLock&&!S1.fade)player.x=Math.min(player.x+6,stage.len-50);}
   const processed=update();if(processed)for(const k in pressed){pressed[k]-=MS;if(pressed[k]<=0)delete pressed[k];}
   frames.push({...snapshot(),audio:__audioLog.splice(0)});if(spec.progression&&S1.idx===4&&scene==='bossintro')break;
  }return {spec,frames};})()`);traces.push(trace);console.log(spec.id+': '+trace.frames.length);}
 fs.writeFileSync(path.join(root,'godot/phase3/fixtures/traces.json'),JSON.stringify(canonical({traces}))+'\n');
 console.log('PHASE 3 ORACLE: '+traces.reduce((n,t)=>n+t.frames.length,0)+' source steps');
}finally{await b.close();}}main().catch(e=>{console.error(e.stack);process.exit(1);});
