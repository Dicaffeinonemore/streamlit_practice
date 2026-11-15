const {fs,path,root}=require('../extract/common.cjs');
const {openBrowser}=require('../extract/browser.cjs');
async function main(){const browser=await openBrowser();try{
  await browser.evaluate(`Promise.all([BarelHurt.ready,BarelDashAttack.ready,BarelJump.ready,BarelComboFx.ready,S1_GROUP.ready])`);
  await browser.evaluate(`new Promise(resolve=>{const poll=()=>BarelRika.ready()?resolve(true):setTimeout(poll,20);poll();})`);
  await browser.evaluate(`Math.random=()=>.5;UX.saveCheckpoint=()=>{};player=newPlayer(0,'barel');startStage(0);scene='play';tick=0;camX=0;nextId=1;enemies=[];barrels=[];items=[];hazards=[];shake=0;hitStop=0;flashT=0;cv.width=960;cv.height=540;RENDER_K=1;hitboxDebug=true;updStage1=()=>{};stage1Finished=()=>false;clearInput();`);
  const states={
    street:`player.x=80;player.inv=90;tick=0;`,
    telegraphs:`player.x=300;player.inv=0;enemies=[];for(const [id,x,y]of [['axe',365,430],['club',510,448],['blade',180,415]]){const e=mkEnemy(id,x,y);e.s1=id;e.d={...STAGE1_ET[id]};e.hp=e.max=e.d.hp;enemies.push(e);beginStage1Move(e,id==='blade'?'atk1':'attack');}for(let i=0;i<12;i++)update();`,
    combo:`player=newPlayer(0,'barel');player.x=280;player.y=430;player.inv=0;tick=0;enemies=[];parts=[];impacts=[];bursts=[];texts=[];hitStop=0;shake=0;const e=mkEnemy('axe',342,430);e.s1='axe';e.d={...STAGE1_ET.axe};e.hp=e.max=e.d.hp;e.training=true;enemies.push(e);clearInput();inputDown('KeyJ');for(let i=0;i<10;i++)update();`
  };
  for(const [name,setup]of Object.entries(states)){
    const data=await browser.evaluate(`(()=>{${setup}ctx.setTransform(1,0,0,1,0,0);render();return cv.toDataURL('image/png').split(',')[1];})()`);
    fs.writeFileSync(path.join(root,'godot/evidence/phase2_source_'+name+'.png'),Buffer.from(data,'base64'));
  }
  console.log('Captured original street, telegraph and combo frames at 960x540');
}finally{await browser.close();}}
main().catch(e=>{console.error(e.stack);process.exit(1);});
