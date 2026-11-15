const {fs,path,root,canonical,read,hash}=require('../extract/common.cjs');
const {openBrowser}=require('../extract/browser.cjs');
const out=path.join(root,'godot/phase3/fixtures');
async function main(){fs.mkdirSync(out,{recursive:true});const b=await openBrowser();try{
  await b.evaluate(`Promise.all([S1_GROUP.ready,g2Early.ready,g2Late.ready,BarelHurt.ready,BarelJump.ready,BarelDashAttack.ready])`);
  const source=await b.evaluate(`JSON.parse(JSON.stringify({G2,G2_BASE,G2_PICK,G2_MOVES,G2_INTRO,G2_TRANSFORM,G2_MEAT,G2A,GORATH_GRAB,GORATH_ESCAPE_KEYS,GROGGY_TICKS,STAGE1_SECTIONS,STAGE1_BG,STAGE1_ET,STAGE1_ENEMY_ART,S1_MOVES,S1_ANIM,HOUND,HEAVY_GRAB,MOLOTOV,FIRE,SCORE_ITEMS,ET_BOSS:ET.boss1,ITEM_ART}))`);
  fs.writeFileSync(path.join(out,'source_data.json'),JSON.stringify(canonical(source),null,2)+'\n');
  const numbers=[];function walk(v,p=[]){if(typeof v==='number'&&!Number.isInteger(v)){const x=Buffer.alloc(8);x.writeDoubleLE(v);numbers.push({path:p,bits:x.toString('hex')});}else if(v&&typeof v==='object')for(const[k,c]of Object.entries(v))walk(c,[...p,Array.isArray(v)?Number(k):k]);}walk(source);
  fs.writeFileSync(path.join(out,'source_numbers.json'),JSON.stringify(numbers)+'\n');
  fs.writeFileSync(path.join(out,'sources.json'),JSON.stringify(Object.fromEntries(['game.js','stage1-runtime.js','gorath-remake-runtime.js','gorath-remake-art.js','gorath-runtime.js'].map(f=>[f,hash(read(f))])),null,2)+'\n');
  console.log('Phase 3 data: 5 sections, 6 species, '+Object.keys(source.G2_MOVES).length+' Gorath moves; intro '+source.G2_INTRO.total+' ticks');
}finally{await b.close();}}main().catch(e=>{console.error(e.stack);process.exit(1);});
