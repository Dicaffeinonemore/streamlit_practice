// Phase 5: original browser renders of Viesa states for side-by-side review with evidence/phase5_viesa_*.png.
const {fs,path,root}=require('../extract/common.cjs');
const {openBrowser}=require('../extract/browser.cjs');
async function main(){const b=await openBrowser();try{
 await b.evaluate(`Promise.all([S1_GROUP.ready,g2Early.ready,g2Late.ready,BarelHurt.ready,BarelJump.ready,BarelDashAttack.ready,VIESA_READY])`);
 const base=`Math.random=()=>.5;UX.saveCheckpoint=()=>{};selectedCharacterId='viesa';player=newPlayer(0,'viesa');startStage(0);scene='play';tick=0;nextId=1;hitStop=0;shake=0;flashT=0;slowT=0;
  updStage1=()=>{};stage1Finished=()=>false;enemies=[];barrels=[];items=[];hazards=[];resetViesaEffects();clearInput();cv.width=960;cv.height=540;RENDER_K=1;
  Object.assign(player,{x:200,y:430,inv:0});
  const foe=(k,x,y=430)=>{const e=mkEnemy(k,x,y);e.s1=k;e.d={...STAGE1_ET[k]};e.hp=e.max=e.d.hp;e.wait=100000;e.atkCd=100000;enemies.push(e);return e;};`;
 const states={
  shot:`foe('axe',350);inputDown('KeyJ');inputUp('KeyJ');for(let i=0;i<14;i++)update();`,
  snipe:`foe('axe',350);inputDown('KeyL');for(let i=0;i<36;i++)update();`,
  hover:`foe('axe',520);inputDown('Space');inputUp('Space');for(let i=0;i<10;i++)update();inputDown('KeyP');inputUp('KeyP');for(let i=0;i<54;i++)update();`,
  ultimate:`foe('axe',350);foe('club',380,460);player.sp=100;inputDown('KeyK');inputUp('KeyK');for(let i=0;i<60;i++)update();`
 };
 for(const[name,setup]of Object.entries(states)){
  const png=await b.evaluate(`(()=>{${base}${setup}ctx.setTransform(1,0,0,1,0,0);render();return cv.toDataURL('image/png').split(',')[1];})()`);
  fs.writeFileSync(path.join(root,'godot/evidence/phase5_source_'+name+'.png'),Buffer.from(png,'base64'));
 }
 console.log('Captured original Viesa shot, snipe, hover and ultimate');
}finally{await b.close();}}main().catch(e=>{console.error(e.stack);process.exit(1);});
