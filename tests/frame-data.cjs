// $env:FRAME_DATA_SUITE='1'; node tests/regression.cjs
// 바렐 3연타를 실제 게임 루프로 돌려, 각 타가 일반 적의 피격 경직 안에 들어가는지 틱 단위로 잰다.
// 결과는 artifacts/frame-data/results.json → node tools/report_frame_data.cjs 로 문서화한다.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
module.exports=async({evaluate,errors,root})=>{
  await evaluate('requestAnimationFrame=()=>0;AUDIO.enable(false);beginGame();showScreen(null);true');
  const result=await evaluate(`(${trial.toString()})()`);
  const out=path.join(root,'artifacts/frame-data');fs.mkdirSync(out,{recursive:true});
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({...result,errors},null,2)+'\n');
  assert.deepEqual(errors,[]);
  for(const r of result.chains){
    assert.equal(r.hits.length,3,`${r.enemy}/${r.input}: 3타가 모두 맞아야 함`);
    for(const g of r.links)assert.ok(g.margin>=0,`${r.enemy}/${r.input}: ${g.from}→${g.to} 사이에 경직이 풀림 (${JSON.stringify(g)})`);
  }
  for(const r of result.untouched)assert.equal(r.measured,r.expected,`${r.case}: 표에 없는 공격의 경직은 기존 값 유지`);
  const fast=result.chains.filter(r=>r.input==='fast').flatMap(r=>r.links.map(g=>g.margin));
  console.log(`PASS Barel 3-hit chain stays in hitstun on ${[...new Set(result.chains.map(r=>r.enemy))].join(', ')} (fast-input margins ${[...new Set(fast)].join('/')} ticks, late input included); other attacks keep 18-tick hurt`);
};
function trial(){
  const ceil=v=>Math.ceil(v-1e-9);
  // 게임 코드의 실제 규칙으로 각 타의 틱 표를 만든다 (game.js 'atk' 상태와 같은 식)
  const table={};
  for(const id of ['c1','c2','c3']){
    const A=ATK[id],hitAt=A.wind+A.act;
    table[id]={name:A.name,windMs:A.wind,actMs:A.act,recMs:A.rec,totalMs:hitAt+A.rec,
      firstHitTick:ceil((A.wind+A.act*.35)/MS),lastHitTick:ceil((hitAt+30)/MS)-1,
      linkTick:ceil((hitAt+A.rec*.45)/MS),endTick:ceil((hitAt+A.rec)/MS),
      damage:A.dmg,hitstop:Math.max(A.stop,A.kd?6:3),knockdown:!!A.kd,hitstun:A.kd?null:enemyHitstun({type:'grunt'},id)};
  }
  function setup(type){
    clearInput();practice=false;player=newPlayer();startStage(0);scene='play';showScreen(null);
    camX=lockAt=600;camLock=true;waveIdx=STAGES[0].waves.length;
    arena=null;barrels=[];items=[];parts=[];texts=[];hazards=[];impacts=[];bursts=[];ghosts=[];bolts=[];
    hitStop=shake=flashT=slowT=0;
    player.x=camX+200;player.y=420;player.face=1;player.inv=99999;
    const e=mkEnemy(type,player.x+60,420);e.atkCd=99999;e.face=-1;e.hp=e.max=9999;enemies=[e];return e;
  }
  // input: fast = 매 틱 선입력(가장 빠른 연결), late = 각 타의 회수가 끝나기 직전에 누름(가장 늦은 연결)
  function chain(type,input){
    const e=setup(type),hits=[],links=[];let n=0,prevHp=e.hp,freedAt=null,prevSt=e.st;
    for(let i=0;i<200&&hits.length<3;i++){
      if(input==='fast')pressed.KeyJ=BUF_MS;
      else if(player.st==='atk'&&hits.length&&player.atk===['c1','c2'][hits.length-1]){
        const A=ATK[player.atk];if(player.t+1===ceil((A.wind+A.act+A.rec)/MS)-1)pressed.KeyJ=MS;
      }else if(!hits.length&&player.st==='free')pressed.KeyJ=MS;
      const stopped=hitStop>0;update();if(stopped)continue;n++;
      if(prevSt==='hurt'&&e.st!=='hurt'&&e.hp===prevHp&&freedAt===null)freedAt=n;   // 맞아서 바뀐 상태는 풀린 것이 아님
      if(e.hp<prevHp){
        if(hits.length){const last=hits[hits.length-1];
          links.push({from:last.atk,to:player.atk,gap:n-last.n,hurt:last.hurtT,margin:freedAt===null?last.hurtT-(n-last.n):-(n-freedAt)});}
        hits.push({atk:player.atk,n,st:e.st,hurtT:e.st==='hurt'?e.hurtT:null});freedAt=null;
      }
      prevHp=e.hp;prevSt=e.st;
    }
    return {enemy:type,input,hits,links};
  }
  const chains=[];
  for(const type of ['grunt','rogue','brute'])for(const input of ['fast','late'])chains.push(chain(type,input));
  // 표에 없는 공격(비에사·스킬 등)은 기존 18틱 그대로인지
  const untouched=[];
  for(const [name,args] of [['id 없는 공격',[undefined]],['스킬/투사체',[null]]]){
    const e=setup('grunt');damageEnemy(e,1,false,0,false,...args);untouched.push({case:name,measured:e.hurtT,expected:18});
  }
  return {table,chains,untouched,data:COMBAT_FRAME_DATA};
}
