// Phase 5: Viesa source data, preserved at the IEEE-754 bit level like Phase 3.
const {fs,path,root,canonical,read,hash}=require('../extract/common.cjs');
const {openBrowser}=require('../extract/browser.cjs');
const out=path.join(root,'godot/phase5/fixtures');
async function main(){fs.mkdirSync(out,{recursive:true});const b=await openBrowser();try{
  await b.evaluate(`Promise.all([S1_GROUP.ready,g2Early.ready,g2Late.ready,BarelHurt.ready,BarelJump.ready,BarelDashAttack.ready])`);
  const source=await b.evaluate(`(()=>{
    const art={scale:VIESA_ART.scale,worldHeight:VIESA_ART.worldHeight,clips:{}};
    for(const[name,frames]of Object.entries(VIESA_ART.clips))art.clips[name]=frames.map(f=>({tip:f.tip||null,additive:!!f.additive}));
    const p=newPlayer(0,'viesa');
    return JSON.parse(JSON.stringify({VIESA:art,VIESA_SKILLS,SKILL_KEYS,
      SKILLS:Object.fromEntries(Object.entries(SKILLS).map(([id,s])=>[id,{cd:s.cd,dur:s.dur}])),
      MAGIC,VW,GTOP,GBOT,SP_MAX,LINK_MS,BUF_MS,
      PLAYER:{w:p.w,hw:p.hw,hp:p.hp,max:p.max},
      CHARACTERS:Object.fromEntries(Object.entries(CHARACTER_ROSTER).map(([id,c])=>[id,{name:c.name,job:c.job,description:c.description||'',available:!!c.available}]))}));
  })()`);
  fs.writeFileSync(path.join(out,'source_data.json'),JSON.stringify(canonical(source),null,2)+'\n');
  const numbers=[];function walk(v,p=[]){if(typeof v==='number'&&!Number.isInteger(v)){const x=Buffer.alloc(8);x.writeDoubleLE(v);numbers.push({path:p,bits:x.toString('hex')});}else if(v&&typeof v==='object')for(const[k,c]of Object.entries(v))walk(c,[...p,Array.isArray(v)?Number(k):k]);}walk(source);
  fs.writeFileSync(path.join(out,'source_numbers.json'),JSON.stringify(numbers)+'\n');
  fs.writeFileSync(path.join(out,'sources.json'),JSON.stringify(Object.fromEntries(['game.js','viesa-runtime.js','viesa-art.js','viesa-ui.js','stage1-runtime.js'].map(f=>[f,hash(read(f))])),null,2)+'\n');
  console.log('Phase 5 data: '+Object.keys(source.VIESA.clips).length+' Viesa clips, HP '+source.PLAYER.hp);
}finally{await b.close();}}main().catch(e=>{console.error(e.stack);process.exit(1);});
