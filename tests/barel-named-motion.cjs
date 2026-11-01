const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
class Image { constructor(){this.complete=true;this.naturalWidth=3200;} }
const context=vm.createContext({Image});
for(const file of ['src/animation/barel-named-motion-data.js','src/animation/barel-named-motion.js'])
  vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
const data=context.BAREL_NAMED_MOTION_DATA, motion=context.BarelNamedMotion;
const manifest=new Set(JSON.parse(fs.readFileSync(path.join(root,'data/runtime-assets.json'))));
for(const [name,clip] of Object.entries(data)){
  assert.ok(fs.existsSync(path.join(root,clip.path)),name);
  assert.ok(manifest.has(clip.path),name+' absent from component manifest');
}
function frame(actor,ms){return motion.frameFor({...actor,t:ms},1);}
function check(actor,ms,name,index){
  const f=frame(actor,ms);assert.ok(f,`${name} at ${ms}`);
  assert.equal(f.image.src,data[name].path);
  assert.equal(f.atlas[0],index%data[name].columns*640);
  assert.equal(f.atlas[1],Math.floor(index/data[name].columns)*640);
}
check({st:'skill',skill:'whirl'},0,'whirl',0);
check({st:'skill',skill:'whirl'},759,'whirl',7);
check({st:'skill',skill:'leap'},560,'leap',6);
check({st:'down',z:0},20,'getup',0);
check({st:'down',z:0},55,'getup',5);
assert.equal(frame({st:'down',z:1},30),null);
for(let i=0;i<4;i++){
  check({st:'special'},620+i*160,`special${i+1}`,0);
  check({st:'special'},620+i*160+159,`special${i+1}`,9);
}
check({st:'special'},1260,'special5',0);
check({st:'special'},1580,'special5',6);
check({st:'special'},2099,'special5',9);
assert.equal(frame({st:'special',characterId:'viesa'},700),null);
assert.equal(frame({st:'special'},619),null);
console.log('PASS named Barel skills, getup, five ultimate hits, asset manifest');
