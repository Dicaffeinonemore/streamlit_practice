const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
module.exports=async({evaluate,call,root,out})=>{
 const results=[];
 for(const kind of ['challenge','characterSelect']){
  const result=await evaluate(`(async()=>{
   UX.record(0,100,'S',30);BarelIdle.setMode('aseprite10');openBossChallenge();
   if(${JSON.stringify(kind)}==='characterSelect')document.querySelector('#challengeList button').click();
   if(scene!==${JSON.stringify(kind)})throw Error('Boss selection navigation');
   if(scene==='characterSelect'&&characterSelectBossStage!==0)throw Error('Boss stage selection lost');
   const canvas=$(scene==='challenge'?'barelChallengePreview':'barelSelectPreview'),c=canvas.getContext('2d');
   const native=c.drawImage,seen={},sources=[];let prev=-1,wraps=0;
   c.drawImage=function(image,...args){
    if(image.src?.includes('barel-idle-dot-10.png')){const index=Math.floor(args[0]/448);seen[index]=true;if(prev===9&&index===0)wraps++;prev=index;}
    sources.push(image===BAREL_ATLAS?'legacy':image.src);return native.call(this,image,...args);
   };
   const start=performance.now();last=start;acc=0;
   try{await new Promise((resolve,reject)=>{function sample(now){try{loop(now);if(now-start<1500)idleNativeRAF(sample);else resolve();}catch(error){reject(error);}}idleNativeRAF(sample);});}
   finally{c.drawImage=native;}
   const data=c.getImageData(0,0,canvas.width,canvas.height).data;let minX=canvas.width,minY=canvas.height,maxX=-1,maxY=-1;
   for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++)if(data[(y*canvas.width+x)*4+3]){minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}
   if(minX<1||minY<1||maxX>=canvas.width-1||maxY>=canvas.height-1)throw Error('Preview crop');
   const locked=[...document.querySelectorAll('#challengeList button')].map(b=>b.disabled);
   if(locked[0]||locked.slice(1).some(v=>!v))throw Error('Boss unlock policy changed');
   BarelIdle.setMode('legacy');let legacy=false;c.drawImage=function(image,...args){legacy=image===BAREL_ATLAS;return native.call(this,image,...args);};
   try{drawBarelIdlePreview(canvas,tick*MS);}finally{c.drawImage=native;BarelIdle.setMode('aseprite10');}
   drawBarelIdlePreview(canvas,tick*MS);
   return {kind:${JSON.stringify(kind)},frames:Object.keys(seen).map(Number),wraps,bounds:[minX,minY,maxX,maxY],canvasSize:[canvas.width,canvas.height],legacy,locked,sourceCorrect:sources.every(s=>s.includes('barel-idle-dot-10.png'))};
  })()`);
  assert.equal(result.frames.length,10);assert(result.wraps>=1);assert(result.legacy);assert(result.sourceCorrect);
  const shot=await call('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,`boss-${kind}.png`),Buffer.from(shot.data,'base64'));results.push(result);
 }
 return results;
};
