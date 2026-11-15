const {fs,path,root}=require('../extract/common.cjs');
const {openBrowser}=require('../extract/browser.cjs');
async function main(){const b=await openBrowser();try{
 await b.evaluate(`Promise.all([S1_GROUP.ready,g2Early.ready,g2Late.ready,BarelHurt.ready,BarelJump.ready,BarelDashAttack.ready])`);
 await b.evaluate(`new Promise(resolve=>{const poll=()=>BarelRika.ready()?resolve(true):setTimeout(poll,20);poll();})`);
 await b.evaluate(`Math.random=()=>.5;UX.saveCheckpoint=()=>{};player=newPlayer(0,'barel');startStage(0);scene='play';tick=0;nextId=1;hitStop=0;shake=0;flashT=0;slowT=0;clearInput();enterSection(4);cv.width=960;cv.height=540;RENDER_K=1;`);
 const states={intro:`for(let i=0;i<445;i++)update();`,transform:`for(let i=0;i<120;i++)update();damageEnemy(enemies[0],1000,false,2,false,'c3');for(let i=0;i<58;i++)update();`,ultimate:`for(let i=0;i<90;i++)update();player.inv=10000;const e=enemies[0];g2Cancel(e,e.g2);g2StartUlt(e,e.g2);for(let i=0;i<125;i++)update();`,meat_landing:`for(let i=0;i<60;i++)update();`};
 for(const[name,setup]of Object.entries(states)){
  const png=await b.evaluate(`(()=>{${setup}const inv=player.inv;player.inv=0;ctx.setTransform(1,0,0,1,0,0);render();player.inv=inv;return cv.toDataURL('image/png').split(',')[1];})()`);
  fs.writeFileSync(path.join(root,'godot/evidence/phase3_source_'+name+'.png'),Buffer.from(png,'base64'));
 }
 console.log('Captured original Gorath intro, transformation, ultimate and meat landing');
}finally{await b.close();}}main().catch(e=>{console.error(e.stack);process.exit(1);});
