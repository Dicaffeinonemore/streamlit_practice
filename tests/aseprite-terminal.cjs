const assert=require('node:assert/strict'),fs=require('node:fs');
const A=require('../src/animation/aseprite.js');
const read=name=>JSON.parse(fs.readFileSync(name,'utf8'));
const metadata=read('assets/aseprite/barel-combo2-10/barel-combo2-10.animation.json');
const data=read('assets/aseprite/exports/barel-combo2-10/barel-combo2-10.json');
const asset=A.parse(data,{metadata});
for(const t of [0,248.999,249,284,319,369.999,370,679.999,680,999]){
  const sample=A.sampleAttack(asset,t);
  assert.equal(sample.canLink,false,'Terminal attack cannot link to a fourth hit');
  assert.equal(sample.active,t>=249&&t<370);
  assert.equal(sample.ended,t>=680);
}
for(const t of [249,284,319])assert.equal(A.sampleAttack(asset,t).frame.index,5,'Ground hit and both events use F6');
assert.throws(()=>A.parse(data,{metadata:{...metadata,terminalAttack:false}}));
assert.throws(()=>A.parse(data,{metadata:{...metadata,combat:{...metadata.combat,comboLinkMs:493}}}));
for(const combo of [0,1]){
  const m=read(`assets/aseprite/barel-combo${combo}-10/barel-combo${combo}-10.animation.json`);
  const d=read(`assets/aseprite/exports/barel-combo${combo}-10/barel-combo${combo}-10.json`);
  const a=A.parse(d,{metadata:m});
  assert(!A.sampleAttack(a,m.combat.comboLinkMs-.001).canLink);
  assert(A.sampleAttack(a,m.combat.comboLinkMs).canLink);
  assert.throws(()=>A.parse(d,{metadata:{...m,combat:{...m.combat,comboLinkMs:null}}}));
}
console.log('PASS terminal null link, exact hit/end/event frame boundaries, previous two link contracts remain strict');
