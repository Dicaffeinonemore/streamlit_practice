// $env:VARGUL_STAGE3='1'; node tests/regression.cjs
// Accelerated 60Hz simulation uses the real update()/input/AI/collision paths.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
module.exports=async({evaluate,call,errors,root})=>{
  const out=path.join(root,'artifacts/vargul-1.36/stage3');fs.mkdirSync(out,{recursive:true});
  await evaluate(`window.trialRAF=requestAnimationFrame.bind(window);requestAnimationFrame=()=>0;AUDIO.enable(false);beginGame();showScreen(null);Promise.all([VARGUL_READY,AURELION_READY])`);
  await evaluate(`(${installTrial.toString()})()`);
  const result={version:'1.36',date:'2026-10-20',method:'Production JS in isolated Chrome; update() at 60Hz, accelerated except RAF benchmark'};
  for(const section of ['audit','dodge','counter','kill','distribution']){
    if(!await evaluate(`typeof VargulTrial.${section}==='function'`))continue;
    console.log('Stage3 '+section);
    result[section]=await evaluate(`VargulTrial.${section}()`);
    fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(result,null,2));
  }
  if(process.env.VARGUL_STAGE3_BENCH==='1'){
    console.log('Stage3 60-second benchmark: two crosses + five sword marks + two orbs');
    result.performance=await evaluate('VargulTrial.benchmark()');
    fs.writeFileSync(path.join(out,'performance.json'),JSON.stringify(result.performance,null,2));
    const shot=await call('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,'stress.png'),Buffer.from(shot.data,'base64'));
  }
  if(!result.performance&&fs.existsSync(path.join(out,'performance.json')))result.performance=JSON.parse(fs.readFileSync(path.join(out,'performance.json'),'utf8'));
  result.consoleErrors=errors;assert.deepEqual(errors,[],'No browser console errors');
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(result,null,2));console.log('PASS Stage3 measurements saved: '+out);
};
function installTrial(){
  const T=window.VargulTrial={};
  const require=(c,m)=>{if(!c)throw Error(m);};
  let boss,frames=0,freezeAfterMove=true;
  function seed(value){let state=value>>>0;Math.random=()=>{state^=state<<13;state^=state>>>17;state^=state<<5;return(state>>>0)/4294967296;};}
  function setup(p2=false,{type='boss4',px=300,py=420,bx=400,by=420,ai=false}={}){
    clearInput();practice=false;player=newPlayer();startStage(type==='boss3'?2:3);scene='play';showScreen(null);camX=lockAt=0;camLock=true;
    waveIdx=stage.waves.length;arena=null;barrels=[];items=[];hazards=[];texts=[];parts=[];impacts=[];bursts=[];ghosts=[];bolts=[];vargulRemains=[];
    player.x=px;player.y=py;player.inv=0;player.hp=player.max=1000000;player.buff=0;player.sp=0;
    boss=mkEnemy(type,bx,by);boss.p2shown=p2;if(p2)boss.hp=boss.max=type==='boss3'?2200:2500;
    boss.face=px<bx?-1:1;boss.atkCd=0;enemies=[boss];freezeAfterMove=!ai;frames=0;
    hitStop=shake=flashT=slowT=clearT=0;chain.n=chain.t=chain.max=0;vargulRepeat=null;vargulDebug=false;seed(13603);
    return boss;
  }
  // Held movement, deliberately without the double-tap dash gesture. Jump/J go
  // through the same buffered input handler as physical keys.
  function steer(x=0,y=0){for(const [k,v] of [['ArrowLeft',x<0],['ArrowRight',x>0],['ArrowUp',y<0],['ArrowDown',y>0]])keys[k]=v;}
  function tap(code){inputUp(code);inputDown(code);inputUp(code);}
  function step(){
    if(freezeAfterMove&&boss.st==='chase')boss.training=true;
    update();frames++;return boss;
  }
  function run(n,control=()=>{}){for(let i=0;i<n;i++){control(i);step();}}
  function health(){return 1000000-player.hp;}
  function next(){return boss.vargul?.timeline?.[boss.vargul.cursor];}
  function single(id,p2,options){setup(p2,options);startPat(boss,id);return boss;}
  function pending(kind){return vargulHazards(boss,kind);}
  T.audit=()=>{
    const exceptions=[],unexpected=[];
    for(let p=0;p<2;p++)for(const move of Object.values(VARGUL_TIMELINES[p])){
      const seen=new Set();for(const t of move.timeline){
        if(!t.attack||t.attack.body)continue;
        const side=t.attack.id.includes('back')?'back':'front',x=VARGUL_MEASUREMENTS[t.clip][t.drawing-1].tip[0],key=t.attack.id+':'+t.drawing;
        if(seen.has(key))continue;seen.add(key);
        if(side==='front'&&x<0||side==='back'&&x>0)(move.id==='sweep'?exceptions:unexpected).push({phase:p+1,move:move.id,attack:t.attack.id,drawing:t.drawing,x});
      }
    }
    require(!unexpected.length,'Unexpected front/back attack geometry');
    const combo=VARGUL_TIMELINES[1].combo;
    require(combo.total===79&&combo.timeline.filter(t=>t.phase==='R').length===22,'P2 combo total / recovery');
    require(combo.timeline.filter(t=>t.attack?.id==='combo3').length===7,'Third hit seven ticks');
    require(combo.timeline.filter(t=>t.drawing===12).every(t=>t.phase==='S'&&!t.attack),'Drawing12 startup only');
    const damage=[];
    for(const where of ['center','outer']){
      setup(true,{px:where==='center'?300:380});spawnVargul(boss,'ultimate',300,420,0,{stage:'impact',impactAge:0});step();
      damage.push({where,damage:health()});
    }
    require(damage[0].damage===30&&damage[1].damage===13,'Ultimate damage30/13');
    setup();enemies=[];spawnWave(stage.waves.at(-1));boss=enemies.find(isVargul);boss.st='chase';scene='play';
    const initial=enemies.map(e=>e.type);boss.hp=boss.nextKd+1;damageEnemy(boss,2,false,0,true);
    require(enemies.length===2&&initial.filter(t=>t==='archer').length===1,'Original wave archer only');
    const otherAdds=[];
    for(const type of ['boss3','boss5']){
      setup(false,{type});boss.hp=boss.nextKd+1;damageEnemy(boss,2,false,0,true);otherAdds.push({type,adds:enemies.filter(e=>e!==boss).map(e=>e.type)});
      require(enemies.length===3,'Other boss threshold adds preserved');
    }
    return {exceptions,unexpected,combo:{total:79,recovery:22,drawing12Ticks:combo.timeline.filter(t=>t.drawing===12).length,
      third:combo.stages.filter(s=>s.label==='third_raise'||s.label==='third_hit')},damage,initialWave:initial,otherAdds};
  };
  function crossTrial(p2,method){
    setup(p2,{px:320,py:420});vargulEvent(boss,{type:'cross_mark'});
    const z=pending('cross')[0],wait=z.wait;let escaped=null;
    for(let t=0;t<wait+20;t++){
      steer(method!=='z'?1:0,method!=='x'?-1:0);step();
      const [left,right]=vargulCrossHorizontalBounds();
      const outside=!((player.x>=left&&player.x<=right&&Math.abs(player.y-z.y)<=16)||Math.abs(player.x-z.x)<=VARGUL_RULES.cross.column);
      if(outside&&escaped===null&&health()===0)escaped=t+1;
    }
    return {phase:p2?2:1,method,wait,escapedAfter:escaped,margin:escaped===null?null:wait-escaped,damage:health(),position:[player.x,player.y]};
  }
  function swordTrial(p2,moving,delay=null){
    single('sword',p2,{px:190});let firstMark=null;
    run(180,()=>{if(firstMark===null&&pending('sword').length)firstMark=frames;
      steer(moving&&(delay===null||firstMark!==null&&frames-firstMark>=delay)?1:0,0);});
    return {phase:p2?2:1,moving,delay,damage:health(),marks:boss.vargul.stats.events.filter(v=>v.type==='sword_mark').length,
      hits:boss.vargul.stats.hits,final:[player.x,player.y]};
  }
  function dashTrial(p2,delay=12,distance=270){
    single('dash',p2,{px:450-distance,bx:450});const passes=[];let warning=null,target=420;
    for(let t=0;t<240;t++){
      const n=next();
      if(n?.white&&n.first){warning={start:frames,origin:player.y,dir:player.y>420?-1:1,label:n.label};target=clamp(player.y+warning.dir*65,GTOP+10,GBOT-10);passes.push(warning);}
      steer(0,warning&&frames-warning.start>=delay&&Math.abs(player.y-target)>1?Math.sign(target-player.y):0);step();
    }
    return {phase:p2?2:1,delay,distance,damage:health(),passes,hits:boss.vargul.stats.hits,position:[player.x,player.y]};
  }
  function ultExit(delay){
    single('ultimate',true,{px:260});let locked=null,exit=null;
    for(let t=0;t<155;t++){
      const n=next();if(n?.label==='fixed_warning'&&n.first)locked={x:player.x,y:player.y,frame:frames};
      steer(locked&&frames-locked.frame>=delay?1:0,0);step();
      if(locked&&exit===null&&Math.abs(player.x-locked.x)>VARGUL_RULES.ultimate.rx)exit=frames-locked.frame;
    }
    return {delay,exitAfter:exit,margin:exit===null?null:30-exit,damage:health()};
  }
  function ultJump(offset){
    setup(true,{px:380});const impactFrame=60,height=[];let firstHit=null;
    for(let t=0;t<70;t++){
      steer();if(t===impactFrame+offset)tap('Space');
      if(t===impactFrame)spawnVargul(boss,'ultimate',300,420,0,{stage:'impact',impactAge:0});
      step();if(t>=impactFrame&&t<impactFrame+8){height.push(player.z);if(health()>0&&firstHit===null)firstHit=t-impactFrame;}
    }
    return {offset,damage:health(),heights:height,firstHit,aboveTicks:height.filter(h=>h>10.224).length};
  }
  function fullUltJump(offset){
    single('ultimate',true,{px:260});let fixed=null,jumped=false;const heights=[],activeElapsed=[];
    for(let t=0;t<180;t++){
      const n=next();if(n?.label==='fixed_warning'&&n.first)fixed=player.x;
      if(!jumped&&boss.vargul.cursor===141+offset){tap('Space');jumped=true;}
      steer(fixed!==null&&player.x<fixed+80?1:0,0);
      const stopped=hitStop>0;step();
      const z=pending('ultimate')[0];
      if(!stopped&&z?.stage==='impact'&&Math.floor(z.age/MS+1e-6)-z.impactAge<8){heights.push(player.z);activeElapsed.push(boss.vargul.processed-141);}
    }
    return {offset,damage:health(),heights,activeElapsed,aboveTicks:heights.filter(h=>h>10.224).length};
  }
  function orbTrial(p2,delay=0,lifetime=false){
    setup(p2,{px:320});vargulEvent(boss,{type:'orbs'});let warning=null,shots=0,target=355,lastOrb=null;
    const nativeSpawn=spawnVargul;spawnVargul=function(e,kind,...args){if(e===boss&&kind==='shard')shots++;return nativeSpawn(e,kind,...args);};
    const end=lifetime?610:(p2?75+17:100+20)+55;
    try{for(let t=0;t<end;t++){
      const orb=pending('orb').find(z=>z.flash>0);
      if(orb&&orb!==lastOrb){warning=frames;target=player.y<420?485:355;lastOrb=orb;}
      if(!orb)lastOrb=null;
      steer(0,warning!==null&&frames-warning>=delay&&Math.abs(player.y-target)>1?Math.sign(target-player.y):0);step();
    }}finally{spawnVargul=nativeSpawn;}
    return {phase:p2?2:1,delay,lifetime,warningAt:warning,flash:p2?17:20,shots,damage:health(),hits:boss.vargul.stats.hits};
  }
  function sweepTrial(p2,jumpAt,distance=70){
    single('sweep',p2,{px:400-distance});let maxHeight=0;
    for(let t=0;t<75;t++){steer();if(t===jumpAt)tap('Space');step();maxHeight=Math.max(maxHeight,player.z);}
    return {phase:p2?2:1,jumpAt,distance,damage:health(),maxHeight,hits:boss.vargul.stats.hits};
  }
  T.dodge=()=>{
    const cross=[false,true].flatMap(p=>['diagonal','x','z'].map(m=>crossTrial(p,m)));
    const sword=[false,true].flatMap(p=>[false,true].map(m=>swordTrial(p,m)));
    const swordDelays=[false,true].map(p=>({phase:p?2:1,runs:Array.from({length:51},(_,i)=>swordTrial(p,true,i))}));
    const combo=[false,true].map(p=>({phase:p?2:1,runs:Array.from({length:26},(_,delay)=>{
      single('combo',p,{px:330});run(130,()=>steer(0,frames>=delay&&player.y<460?1:0));return {delay,damage:health()};
    })}));
    const dash=[false,true].map(p=>dashTrial(p));
    const dashDistances=[false,true].flatMap(p=>[100,150,220,270].flatMap(distance=>[0,12].map(delay=>dashTrial(p,delay,distance))));
    const dashDelays=[false,true].map(p=>({phase:p?2:1,runs:Array.from({length:71},(_,i)=>dashTrial(p,i))}));
    const ultimateExit=Array.from({length:13},(_,i)=>ultExit(i));
    const jump=Array.from({length:57},(_,i)=>fullUltJump(i-45));
    const jumpRegion=Array.from({length:57},(_,i)=>ultJump(i-45));
    const orb=[false,true].flatMap(p=>[false,true].flatMap(l=>[0,12].map(d=>orbTrial(p,d,l))));
    const orbDelays=[false,true].map(p=>({phase:p?2:1,runs:Array.from({length:61},(_,i)=>orbTrial(p,i))}));
    const sweep=[false,true].map(p=>({phase:p?2:1,ground:sweepTrial(p,-1),jump:Array.from({length:25},(_,i)=>sweepTrial(p,i))}));
    const sweepRange=[70,79,81,92].map(d=>sweepTrial(true,-1,d));
    single('cross',true,{px:320});let markEscapes=[],seen=new Set(),moving=null;
    run(160,()=>{
      for(const z of pending('cross'))if(!seen.has(z)){seen.add(z);moving={z,start:frames};}
      if(moving){
        const z=moving.z,outside=Math.abs(player.x-z.x)>18.4032&&Math.abs(player.y-z.y)>16;
        if(outside){markEscapes.push({escapeAfter:frames-moving.start,wait:z.wait,margin:z.wait-(frames-moving.start)});moving=null;steer();}
        else steer(1,-1);
      }else steer();
    });
    const doubleCross={damage:health(),marks:seen.size,escapes:markEscapes};
    return {cross,doubleCross,sword,swordDelays,combo,dash,dashDistances,dashDelays,ultimateExit,jump,jumpRegion,orb,orbDelays,sweep,sweepRange};
  };
  function dodgeController(id){
    let targetY=null,warningStart=null,seenMarks=new Set(),crossTarget=null,ultLocked=null,jumped=false;
    return ()=>{
      const n=next();let mx=0,my=0;
      if(id==='combo'||id==='sweep'){
        targetY=460;my=player.y<targetY?1:0;
      }else if(id==='dash'){
        if(n?.white&&n.first){warningStart=frames;targetY=player.y>420?420:485;}
        if(warningStart!==null&&frames-warningStart>=12&&Math.abs(player.y-targetY)>1)my=Math.sign(targetY-player.y);
        // Preserve Stage3's counter route, including horizontal clearance
        // during the turn/return warning, for comparable post-dodge positions.
        if(n&&['turn','return_warning'].includes(n.label))mx=Math.sign(player.x-boss.x)||1;
      }else if(id==='cross'){
        for(const z of pending('cross'))if(!seenMarks.has(z)){
          seenMarks.add(z);crossTarget={x:z.x+25,y:Math.min(GBOT-6,z.y+19)};
        }
        if(crossTarget){mx=player.x<crossTarget.x?1:0;my=player.y<crossTarget.y?1:0;}
      }else if(id==='sword')mx=1;
      else if(id==='ultimate'){
        if(n?.label==='fixed_warning'&&n.first)ultLocked={x:player.x,y:player.y};
        if(ultLocked&&player.x<ultLocked.x+65)mx=1;
        if(boss.vargul.cursor===133&&!jumped){tap('Space');jumped=true;}
      }
      steer(mx,my);
    };
  }
  function counterTrial(id,p2,{approachStartup=false,interrupt=false,startDelay=0}={}){
    const distance=({combo:70,sweep:70,dash:220,sword:150,cross:150,orb:180,taunt:270,ultimate:180})[id];
    const e=single(id,p2,{px:400-distance});const def=VARGUL_TIMELINES[p2?1:0][id],dodge=dodgeController(id);
    let snapshot=null,startFrame=null,firstHit=null,attackFrame=null,missedR=false,firstR=null,eligible=false,hitDamage=0,damageAtEntry=null;
    const rLength=def.timeline.filter(t=>t.phase==='R').length;
    for(let t=0;t<700;t++){
      const n=next(),floorBusy=pending('sword').length>0;
      if(n?.phase==='R'&&firstR===null)firstR=frames;
      const pendingLanding=n?.events?.some(ev=>ev.type==='ultimate_land');
      eligible=!pendingLanding&&(interrupt||((n?.phase==='R'||approachStartup)&&!(id==='sword'&&floorBusy)));
      // The sword row deliberately waits until ALL placed swords finish.
      const afterLastSword=id==='sword'&&e.vargul.run.events.filter(v=>v.type==='sword_mark').length===(p2?5:3)&&!floorBusy;
      if(snapshot===null&&(eligible||afterLastSword)){
        const Rleft=n?.phase==='R'?def.timeline.slice(e.vargul.cursor).findIndex(v=>v.phase!=='R'):0;
        const remaining=n?.phase==='R'?(Rleft<0?def.timeline.length-e.vargul.cursor:Rleft):0;
        snapshot={player:[player.x,player.y,player.z],boss:[e.x,e.y,e.z],distance:Math.abs(e.x-player.x),lane:Math.abs(e.y-player.y),
          reach:ATK.c1.reach+e.hw,Rremaining:remaining,at:frames,phase:n?.phase||e.st};
        snapshot.formula=Math.ceil(Math.max(Math.max(0,snapshot.distance-snapshot.reach)/3.1,snapshot.lane/2.325))+8;
        startFrame=frames;damageAtEntry=health();missedR=!remaining&&!interrupt&&!approachStartup;
      }
      if(interrupt&&frames<startDelay)steer();
      else if(snapshot){
        const dx=e.x-player.x,dy=e.y-player.y;
        // Common first-slash hurt box is depth24; move only as far as needed.
        player.face=dx>=0?1:-1;
        if(player.st==='free'&&player.z===0&&canHit(e)&&inReach(player,e,ATK.c1.reach,24,55)){
          steer();tap('KeyJ');if(attackFrame===null)attackFrame=frames;
        }else steer(Math.abs(dx)>=ATK.c1.reach+e.hw?Math.sign(dx):0,Math.abs(dy)>=23?Math.sign(dy):0);
      }else if(approachStartup){steer(Math.sign(e.x-player.x),0);}else dodge();
      const hp=e.hp;step();
      if(e.hp<hp){firstHit=frames;hitDamage=hp-e.hp;break;}
      if(snapshot&&frames-startFrame>Math.max(150,snapshot.Rremaining+20))break;
      if(id!=='sword'&&e.st==='chase'&&snapshot===null)break;
    }
    const inR=firstHit!==null&&firstR!==null&&firstHit-1<firstR+rLength&&!missedR;
    return {id,phase:p2?2:1,approachStartup,interrupt,startDelay,marksPlaced:e.vargul.run.events.filter(v=>v.type==='sword_mark').length,distanceAtStart:distance,snapshot,R:rLength,firstR,
      firstHit,elapsedToHit:firstHit===null||startFrame===null?null:firstHit-startFrame,attackFrame,hitDamage,
      damageDuringDodge:damageAtEntry??health(),totalReceived:health(),inR,result:interrupt&&firstHit!==null?'예고 중 끊기':approachStartup&&inR?'시동 중 접근':inR?'가능':'불가'};
  }
  T.counter=()=>{
    const rows=[];
    for(const p2 of [false,true])for(const id of Object.keys(VARGUL_TIMELINES[p2?1:0]))rows.push(counterTrial(id,p2));
    const alternatives=[false,true].flatMap(p=>[counterTrial('sword',p,{interrupt:true}),counterTrial('orb',p,{approachStartup:true})]);
    const interruptDelays=Array.from({length:7},(_,startDelay)=>counterTrial('sword',true,{interrupt:true,startDelay}));
    return {rows,alternatives,interruptDelays};
  };
  T.kill=({types=['boss3','boss4'],passives=[true,false]}={})=>{
    const rows=[],nativeChase=bossChase,nativeReact=reactAurelionAttack;
    for(const passive of passives)for(const type of types){
      setup(false,{type,px:320,bx:400,ai:!passive});freezeAfterMove=false;seed(1360303);
      const e=boss;let hits=0,swings=0,transition=0,stopSlots=0,downSlots=0,stunSlots=0,adds=0,previousEnemies=1;
      const nativeDamage=damageEnemy,nativeAtk=startAtk;
      damageEnemy=function(target,...args){const hp=target.hp,p2=target.p2shown;nativeDamage(target,...args);if(target===e&&(target.hp<hp||!p2&&target.p2shown))hits++;};
      startAtk=function(...args){swings++;return nativeAtk(...args);};
      if(passive){bossChase=function(target){if(target===e)return;return nativeChase(target);};reactAurelionAttack=()=>{};}
      try{
        while(e.st!=='dead'&&frames<108000){
          const dx=e.x-player.x,dy=e.y-player.y;
          player.face=dx>=0?1:-1;
          steer(Math.abs(dx)>58?Math.sign(dx):Math.abs(dx)<35?-Math.sign(dx):0,Math.abs(dy)>6?Math.sign(dy):0);
          if(frames%6===0)tap('KeyJ');
          if(e.phaseT>0)transition++;if(hitStop>0)stopSlots++;if(e.st==='down')downSlots++;if(e.st==='stun')stunSlots++;
          step();if(enemies.length>previousEnemies)adds+=enemies.length-previousEnemies;previousEnemies=enemies.length;
          // No drops / pickups influence this fixed-input comparison.
          items=[];
        }
        require(e.st==='dead','Kill benchmark finished '+type+' passive='+passive);
        rows.push({type,passive,hp:type==='boss3'?[1800,2200]:[2000,2500],hits,swings,frames,seconds:frames/60,
          transitionTicks:transition,transitionSeconds:transition/60,hitStopSlots:stopSlots,downSlots,stunSlots,adds,playerDamage:health(),buff:player.buff});
      }finally{damageEnemy=nativeDamage;startAtk=nativeAtk;bossChase=nativeChase;reactAurelionAttack=nativeReact;}
    }
    return rows;
  };
  T.stage4=()=>{
    const counters=[counterTrial('dash',true),...[false,true].flatMap(p=>['sword','orb'].map(id=>counterTrial(id,p)))];
    const dash=[100,150,220,270].map(distance=>{
      const runs=Array.from({length:61},(_,delay)=>dashTrial(true,delay,distance));
      const safe=runs.filter(v=>v.damage===0).map(v=>v.delay);
      let contiguous=-1;while(runs[contiguous+1]?.damage===0)contiguous++;
      require(runs[12].damage===0,'Return dash12-tick response at distance '+distance);
      return {distance,required:runs[12],safeDelays:safe,limit:contiguous,runs};
    });
    const cross=[];
    for(const p2 of [false,true])for(const method of ['x','z','diagonal']){
      single('cross',p2,{px:320});const seen=new Set(),marks=[],hits=[];let moving=null;
      const nativeHurt=vargulHurt;
      vargulHurt=function(e,attack,source){const hp=player.hp,hit=nativeHurt(e,attack,source);if(source?.kind==='cross'&&hit)hits.push({frame:frames,mark:source.bornElapsed,damage:hp-player.hp});return hit;};
      try{run(190,()=>{
        for(const z of pending('cross'))if(!seen.has(z)){
          seen.add(z);const row={placedAt:frames,center:[z.x,z.y],wait:z.wait,escapeAfter:null,margin:null};marks.push(row);moving={z,row,start:frames};
        }
        if(moving){
          const {z,row,start}=moving,outside=Math.abs(player.x-z.x)>VARGUL_RULES.cross.column&&Math.abs(player.y-z.y)>VARGUL_RULES.cross.depth;
          if(outside&&row.escapeAfter===null&&health()===0){row.escapeAfter=frames-start;row.margin=z.wait-row.escapeAfter;}
          if(method==='diagonal'&&row.escapeAfter!==null)steer();
          else steer(method!=='z'?1:0,method!=='x'?-1:0);
        }else steer();
      });}finally{vargulHurt=nativeHurt;}
      require(marks.length===(p2?2:1),'Real cross placement count');
      require(method==='diagonal'?health()===0&&marks.every(z=>z.escapeAfter!==null):health()>0,'Cross axis/diagonal outcome');
      cross.push({phase:p2?2:1,method,damage:health(),marks,hits});
    }
    const contracts=[],timings=[];
    require(counters.filter(v=>v.id==='dash'||v.id==='orb').every(v=>v.inR&&v.damageDuringDodge===0),'Dash/orb counter within R');
    for(const p2 of [false,true])for(const id of ['dash','sword','orb','cross']){
      single(id,p2,{px:170,bx:450});player.inv=999999;
      const trace=[];let firstR=null,lastSwordActive=null,locks=[];
      const nativeLog=vargulLogEvent;
      vargulLogEvent=function(e,type){if(type==='dash_lock')locks.push({label:next()?.label,local:next()?.local,playerY:player.y});return nativeLog(e,type);};
      try{while(boss.st==='pat'&&frames<600){
        const n=next();
        // Change row AFTER the return lock to prove it never tracks again.
        if(id==='dash'&&n?.label==='return_warning'&&n.local>=8)player.y=350;
        if(n?.phase==='R'&&firstR===null)firstR=boss.vargul.processed+1;
        step();
        const active=pending('sword').some(z=>z.boom&&z.age/MS<z.wait+z.active);
        if(active)lastSwordActive=boss.vargul.processed;
        trace.push({elapsed:boss.vargul.processed,label:boss.vargul.current?.label,phase:boss.vargul.current?.phase,drawing:boss.vargul.current?.drawing,
          armor:vargulArmored(boss),y:boss.y,lockedY:boss.vargul.lockedY,activeSwords:active});
      }}finally{vargulLogEvent=nativeLog;}
      const run=structuredClone(boss.vargul.stats.runs[0]);
      timings.push({phase:p2?2:1,id,total:frames,firstR,lastSwordActive,locks,run,trace});
      if(id==='sword'){
        require(firstR===lastSwordActive+1,'Sword R follows final active tick');
        const hold=trace.filter(t=>t.label==='hold_swords');
        require(hold.every(t=>!t.armor&&t.phase==='S'&&t.drawing===(p2?12:11)),'Unarmored final concentration drawing');
        // Normal damage interrupts the hold; all already placed swords survive.
        single('sword',p2,{px:170});
        while(next()?.label!=='hold_swords')step();
        const count=pending('sword').length;damageEnemy(boss,1,false,0,true);
        require(boss.st==='hurt'&&!boss.pat&&pending('sword').length===count,'Hold interruption preserves placed marks');
        runUntilDead();contracts.push({phase:p2?2:1,holdInterrupt:true,placed:count,remaining:pending('sword').length});
      }
      if(id==='dash'&&p2){
        const warning=trace.filter(t=>t.label==='return_warning');
        require(warning.length===18&&locks.filter(z=>z.label==='return_warning').length===1,'Return warning18 and one lock');
        require(locks.find(z=>z.label==='return_warning').local===7,'Return locks on eighth tick');
        require(warning.slice(8).every(t=>t.lockedY===420),'No tracking after return lock');
      }
    }
    function runUntilDead(){for(let i=0;i<120;i++){steer();step();}require(pending('sword').length===0,'Placed swords expire after interrupt');}
    // The visible horizontal span follows the camera, including off-center marks.
    const camera=[];
    for(const offset of [0,1000])for(const side of [20,620]){
      setup(false,{px:offset+side});camX=offset;vargulEvent(boss,{type:'cross_mark'});const z=pending('cross')[0];z.x=offset+100;
      run(63,()=>steer());camera.push({camX:offset,playerX:offset+side,damage:health(),bounds:vargulCrossHorizontalBounds()});
      require(health()>0,'Cross covers current viewport edge');
    }
    return {counters,dash,cross,timings,contracts,camera};
  };
  T.distribution=()=>{
    const output=[];
    for(const p2 of [false,true]){
      setup(p2,{px:260,bx:400,ai:true});seed(p2?136032:136031);
      const e=boss,started={near:{},mid:{},far:{}},weighted={near:{},mid:{},far:{}},eligibleExpected={near:{},mid:{},far:{}},
        intents={near:{},mid:{},far:{}},violations=[],history=[];
      const nativeStart=startPat,nativePick=pickVargulPattern;let maxGap=0,lastStart=0,maxCursorIdle=0,cursorIdle=0,lastSignature='',ultimateAt=null;
      const band=dx=>dx<81.792?'near':dx<204.48?'mid':'far',inc=(obj,key,n=1)=>obj[key]=(obj[key]||0)+n;
      pickVargulPattern=function(target,dx,dy){
        const a=vargulData(target),b=band(dx),menu=Object.entries(VARGUL_RULES.weights[p2?1:0][b]).filter(([id])=>
          !a.cooldowns[id]&&!(a.lastMove===id&&a.repeats>=2)&&!(['cross','sword'].includes(id)&&vargulFloorBusy(target))&&!(id==='orb'&&vargulHazards(target,'orb').length));
        if(p2&&a.ultimateUsed&&!a.cooldowns.ultimate&&!(a.lastMove==='ultimate'&&a.repeats>=2))menu.push(['ultimate',15]);
        const random=Math.random,draws=[];Math.random=()=>{const v=random();draws.push(v);return v;};let selected;
        try{selected=nativePick(target,dx,dy);}finally{Math.random=random;}
        if(draws.length&&menu.length){
          const total=menu.reduce((s,[,w])=>s+w,0);let roll=draws[0]*total,raw=menu.at(-1)[0];
          for(const [id,w] of menu)inc(eligibleExpected[b],id,w/total);
          // Recompute just the raw selected intent from the recorded random draw.
          roll=draws[0]*total;for(const [id,w] of menu)if((roll-=w)<0){raw=id;break;}
          inc(weighted[b],raw);inc(intents[b],selected?'attack':raw==='approach'||raw==='back_off'?'movement':'alignment_rejected');
        }else inc(intents[b],selected?'priority':'no_available');
        return selected;
      };
      startPat=function(target,id){
        if(target===e){
          const b=band(Math.abs(player.x-e.x));inc(started[b],id);
          if(history.length>=2&&history.at(-1).id===id&&history.at(-2).id===id)violations.push({type:'three_in_row',frame:frames,id});
          if(['sword','cross'].includes(id)&&vargulFloorBusy(e))violations.push({type:'floor_cast_overlap',frame:frames,id});
          if(id==='ultimate'&&ultimateAt===null)ultimateAt={frame:frames,hp:e.hp,max:e.max};
          maxGap=Math.max(maxGap,frames-lastStart);lastStart=frames;
          history.push({frame:frames,id,band:b,distance:Math.abs(player.x-e.x),hp:e.hp});
        }
        return nativeStart(target,id);
      };
      const start=performance.now();
      try{
        for(let frame=0;frame<36000;frame++){
          if(p2&&frame===18000)e.hp=e.max*.35;
          const wanted=[65,150,285][Math.floor(frame/1200)%3];
          let side=player.x<e.x?-1:1;if(e.x+side*wanted<24||e.x+side*wanted>VW-24)side*=-1;
          const tx=clamp(e.x+side*wanted,24,VW-24),ty=e.y+Math.sin(frame/240)*10;
          steer(Math.abs(player.x-tx)>4?Math.sign(tx-player.x):0,Math.abs(player.y-ty)>3?Math.sign(ty-player.y):0);step();
          const floor=new Set(pending().filter(z=>['sword','cross'].includes(z.kind)).map(z=>z.castToken));
          if(floor.size>1)violations.push({type:'floor_lifecycle_overlap',frame});
          const signature=[e.st,e.t,e.vargul?.cursor,e.x.toFixed(2),e.y.toFixed(2)].join(':');
          cursorIdle=signature===lastSignature?cursorIdle+1:0;maxCursorIdle=Math.max(maxCursorIdle,cursorIdle);lastSignature=signature;
        }
      }finally{startPat=nativeStart;pickVargulPattern=nativePick;}
      maxGap=Math.max(maxGap,frames-lastStart);
      output.push({phase:p2?2:1,frames:36000,seconds:600,simulationCpuMs:performance.now()-start,seed:p2?136032:136031,
        started,weighted,eligibleExpected,intents,history,violations,ultimateAt,maxGap,maxCursorIdle,playerDamage:health(),
        noStall:maxGap<1800&&maxCursorIdle<300,actualUpdateSlots:stat.ticks,baseWeights:VARGUL_RULES.weights[p2?1:0]});
    }
    return output;
  };
  T.benchmark=()=>new Promise(resolve=>{
    setup(true,{px:320,bx:460});boss.training=true;player.inv=999999;
    const e=boss,samples=[],cpu=[],start=performance.now();let previous=start,minCross=Infinity,minSword=Infinity,minOrb=Infinity,maxHazards=0;
    function fill(){
      while(pending('cross').length<2)spawnVargul(e,'cross',250+pending('cross').length*120,410,0,{wait:51,active:18});
      while(pending('sword').length<5)spawnVargul(e,'sword',200+pending('sword').length*45,390,0,{wait:38,active:6});
      if(!pending('orb').length)vargulEvent(e,{type:'orbs'});
    }
    function sample(now){
      samples.push(now-previous);previous=now;const before=performance.now();fill();player.inv=999999;
      update();fill(); // Also replace expirations before the rendered frame.
      minCross=Math.min(minCross,pending('cross').length);minSword=Math.min(minSword,pending('sword').length);minOrb=Math.min(minOrb,pending('orb').length);
      render();cpu.push(performance.now()-before);maxHazards=Math.max(maxHazards,hazards.length);
      if(now-start<60000)trialRAF(sample);else{
        const a=cpu.slice().sort((x,y)=>x-y),b=samples.slice().sort((x,y)=>x-y);
        resolve({seconds:(now-start)/1000,frames:samples.length,fps:samples.length/((now-start)/1000),
          meanFrameMs:samples.reduce((s,v)=>s+v,0)/samples.length,p95FrameMs:b[Math.floor(b.length*.95)],
          meanCpuMs:cpu.reduce((s,v)=>s+v,0)/cpu.length,p95CpuMs:a[Math.floor(a.length*.95)],maxCpuMs:a.at(-1),
          minCross,minSword,minOrb,maxHazards,forcedStressOnly:true,countPoint:'after update, before render'});
      }
    }
    trialRAF(sample);
  });
}
module.exports.installTrial=installTrial;
