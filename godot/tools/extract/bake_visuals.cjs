const {packFrames}=require('./rle.cjs');
async function bakeVisuals(browser) {
  const animations=[];const recipes=[];
  await browser.evaluate('S1_GROUP.ready');
  const species=await browser.evaluate('Object.keys(STAGE1_ENEMY_ART)');
  for(const id of species) {
    const clips=await browser.evaluate(`Object.keys(STAGE1_ENEMY_ART['${id}'].clips)`);
    for(const clip of clips) {
      const samples=await browser.evaluate(`(()=>{const art=STAGE1_ENEMY_ART['${id}'],club='${id}'==='club'&&'${clip}'==='attack',anchors=[[190,338],[192,338],[180,338],[235,338],[240,338],[215,332],[190,332],[230,332],[225,332],[240,332]],lens=S1_MOVES['${id}']?.['${clip}']?.len;return art.clips['${clip}'].map((n,i)=>{const f=club?{atlas:[i%5*411,Math.floor(i/5)*382,i%5===4?412:411,i<5?382:383],anchor:anchors[i]}:art.frames[n],src=club?S1_IMG[S1_CLUB_ATTACK]:S1_ENEMY_IMG['${id}'],[x,y,w,h]=f.atlas,c=cleanStage1Frame('${id}'+(club?':attack':'')+'normal',src,x,y,w,h);return {w,h,pivot:f.anchor,scale:club?.38:art.scale*('${id}'==='heavy'&&'${clip}'==='spin'?1.6:1),duration_ms:lens?lens[i]*MS:null,rgba:__b64(c.getContext('2d').getImageData(0,0,w,h).data)};});})()`);
      animations.push({id:'stage1_presented_'+id+'_'+clip,frames:await packFrames('stage1_presented_'+id+'_'+clip,samples.map(f=>({...f,rgba:Buffer.from(f.rgba,'base64')}))),metadata:{source:'stage1-runtime.js drawStage1Soldier / cleanStage1Frame',species:id,clip,preferred:true,club_attack_override:id==='club'&&clip==='attack'}});
    }
  }
  const sprites=await browser.evaluate('Object.keys(SPRITES)');
  for(const id of sprites) {
    const count=await browser.evaluate(`Object.keys(${id==='player'?'HERO_FRAMES':'{0:0,1:1}'}).length`);
    const samples=await browser.evaluate(`Array.from({length:${count}},(_,i)=>{const L=MO.spriteShaded(${JSON.stringify(id)},i);return {w:L.w,h:L.h,pivot:[SPRITES[${JSON.stringify(id)}].ax||L.w/2,SPRITES[${JSON.stringify(id)}].gy||L.h],rgba:__b64(L.d)};})`);
    const frames=await packFrames('procedural_sprite_'+id,samples.map(f=>({...f,scale:2,rgba:Buffer.from(f.rgba,'base64')})));
    animations.push({id:'procedural_sprite_'+id,frames,metadata:{source:'sprites.js / MO.spriteShaded',coverage:'all HERO_FRAMES for player; canonical 0/1 for other sprite bodies; posed motion separately'}});
  }
  // Pose functions are sampled at every original simulation tick, not tweened.
  const sequences=[...Array.from({length:3},(_,i)=>({id:'hero_combo_'+i,actor:'player',ticks:[21,19,41][i],pose:`heroAtk(${i},t)`,options:'{}'})),{id:'hero_special',actor:'player',ticks:126,pose:'heroSpecial(t)',options:'{}'}];
  const patterns={boss1:{slam:160,sweep:130,rage:150,hook:150,meat:120},boss2:{staff:130,teleport:120,orbs:160,ravens:160,feather:140,soul:180},boss3:{slash3:210,cleave:150,charge:150,whirl:180,pillars:200},boss4:{slash3:210,slam:160,frost:190,orbs:160},boss5:{slash3:210,cleave:150,charge:150,whirl:180,pillars:200,eclipse:220}};
  for(const[actor,moves]of Object.entries(patterns))for(const[move,ticks]of Object.entries(moves))for(const phase of [false,true])sequences.push({id:`${actor}_${move}_${phase?'p2':'p1'}`,actor,ticks,pose:`bossPoseAt('${actor}','${move}',t,${phase})`,options:'{}'});
  for(const seq of sequences)for(const face of [1,-1]) {
    const samples=await browser.evaluate(`Array.from({length:${seq.ticks}},(_,i)=>{const t=i*MS,F=figure('${seq.actor}',${face},${seq.pose},${seq.options}),L=F.P.L;return {w:L.w,h:L.h,pivot:[F.ax,F.ay],rgba:btoa(Array.from(L.d,b=>String.fromCharCode(b)).join(''))};})`);
    const id='procedural_pose_'+seq.id+'_'+(face===1?'right':'left');
    animations.push({id,frames:await packFrames(id,samples.map(f=>({...f,scale:2,duration_ms:1000/60,rgba:Buffer.from(f.rgba,'base64')}))),metadata:{source:'motion.js + game.js figure()',pose_expression:seq.pose,face,tick_ms:1000/60,range:[0,seq.ticks-1],coverage:'bounded canonical source pose; continuous parameterized effect geometry remains native work'}});
    recipes.push({id,...seq,face});
  }
  for(let stage=1;stage<=5;stage++) {
    const samples=await browser.evaluate(`Array.from({length:60},(_,i)=>{const c=getBackdrop('stage${stage}',i*MS),g=c.getContext('2d');return {w:c.width,h:c.height,pivot:[0,BG_HORIZON],rgba:__b64(g.getImageData(0,0,c.width,c.height).data)};})`);
    animations.push({id:'procedural_backdrop_stage_'+stage,frames:await packFrames('procedural_backdrop_stage_'+stage,samples.map(f=>({...f,scale:4,duration_ms:1000/60,rgba:Buffer.from(f.rgba,'base64')}))),metadata:{source:'backgrounds.js getBackdrop',coverage:'first 60 canonical ticks; sky/fog parameters continue dynamically in source'}});
    const floor=await browser.evaluate(`(()=>{const c=floorImage('stage${stage}');return {w:c.width,h:c.height,pivot:[0,0],rgba:__b64(c.getContext('2d').getImageData(0,0,c.width,c.height).data)};})()`);
    animations.push({id:'procedural_floor_stage_'+stage,frames:await packFrames('procedural_floor_stage_'+stage,[{...floor,scale:2,rgba:Buffer.from(floor.rgba,'base64')}]),metadata:{source:'game.js floorImage',world_y:332}});
  }
  // Ground/source pixel effects remain parameterized at runtime. Bake canonical samples
  // for every public effect function so native implementations have reference fixtures.
  const effectExpressions={sparkBurst:'sparkBurst(L,96,110,t,5)',aura:"aura(L,96,110,t,'#ffffff','#ff3355')",warn:'warn(L,96,80,t,110)',shockwave:'shockwave(L,96,t,1,110)',orb:"orb(L,96,90,1,0,t,['#ffffff','#ff6688','#aa1133'])",teleportRing:'teleportRing(L,96,110,i/60)',goldWave:'goldWave(L,96,110,1)',pillar:'pillar(L,96,t,i/60,110)',moon:'moon(L,96,90,45,i/60,false)',slashLine:'slashLine(L,20,90,160,40,i/60)',impactFx:'impactFx(L,96,90,t,1,1,5)',crescent:"crescent(L,96,90,45,120,-60,['#ffffff','#ff4466'])"};
  for(const[id,expression]of Object.entries(effectExpressions)) {
    try {
      const samples=await browser.evaluate(`Array.from({length:60},(_,i)=>{const t=i*MS,L=new MO.Layer(192,160);${expression};return {w:L.w,h:L.h,pivot:[96,110],rgba:btoa(Array.from(L.d,b=>String.fromCharCode(b)).join(''))};})`);
      animations.push({id:'procedural_fx_'+id.toLowerCase(),frames:await packFrames('procedural_fx_'+id.toLowerCase(),samples.map(f=>({...f,scale:2,duration_ms:1000/60,rgba:Buffer.from(f.rgba,'base64')}))),metadata:{source:'motion.js',expression,parameterized:true,coverage:'canonical reference, not a replacement for variable geometry'}});
    } catch(e){throw Error(`FX bake ${id}: ${e.message}`);}
  }
  return {animations,recipes};
}
module.exports={bakeVisuals};
