(function(root){
 'use strict';
 const config=root.BAREL_GRABBED_CONFIG||{};
 let mode=new URLSearchParams(root.location?.search||'').get('barelGrabbed')||config.mode||'aseprite10';
 if(!['legacy','aseprite10'].includes(mode))mode='aseprite10';
 let animation=null,error=null;
 const url=config.metadataUrl||'assets/aseprite/barel-grabbed-10/barel-grabbed-10.animation.json';
 function validate(asset){
  const m=asset.metadata,clip=asset.clips[m.clip];
  if(m.character!=='barel'||m.animationId!=='grabbed'||m.animationType!=='loop'||m.loop!==true||m.combat!=null||
     m.clip!=='grabbed'||m.durationMs!==650||clip.duration!==650||asset.frames.length!==10||clip.frames.length!==10||
     clip.tag.direction!=='forward'||clip.frames.some(f=>f.duration!==65)||m.loopFromFrame!==2||m.loopDurationMs!==520||
     m.clock?.source!=='player.t * MS'||m.clock?.legacyPeriodMs!==650||
     !Number.isFinite(m.renderScale)||m.renderScale<=0||m.anchor.some(n=>n<0||n>448)||
     m.alignment?.referenceLegacyHeight!==142||!Number.isFinite(m.alignment?.newBodyHeight)||m.alignment.newBodyHeight<=0||
     Math.abs(m.renderScale*m.alignment.newBodyHeight-142)>1e-9||
     !asset.image.complete||!asset.image.naturalWidth||asset.meta.size?.w!==asset.image.naturalWidth||asset.meta.size?.h!==asset.image.naturalHeight)
   throw Error('Barel grabbed: metadata/timing/image mismatch');
  for(const f of clip.frames){
   const [x,y,w,h]=f.atlas,o=f.spriteSourceSize;
   if(![x,y,w,h].every(Number.isInteger)||x+w>asset.image.naturalWidth||y+h>asset.image.naturalHeight||
      f.sourceSize.w!==448||f.sourceSize.h!==448||f.anchor.some(n=>n<0||n>448)||o.x<0||o.y<0||o.x+w>448||o.y+h>448)
    throw Error('Barel grabbed: frame bounds');
   f.image=asset.image;f.renderScale=m.renderScale;
  }
  return asset;
 }
 const ready=Promise.resolve().then(()=>{
  if(!root.AsepriteAnimation)throw Error('Aseprite adapter unavailable');
  return root.AsepriteAnimation.loadMetadata(url);
 }).then(asset=>{animation=validate(asset);return true;}).catch(reason=>{
  animation=null;error=String(reason.message||reason);console.warn('Barel grabbed uses legacy:',error);return false;
 });
 root.BarelGrabbed={
  ready,
  setMode(value){if(!['legacy','aseprite10'].includes(value))throw Error('Unknown Barel grabbed mode');mode=value;},
  status(){return {requested:mode,effective:mode==='aseprite10'&&animation?'aseprite10':'legacy',loaded:!!animation,error};},
  frameFor(actor,tickMs){
   const g=actor.grab;
   if(mode!=='aseprite10'||!animation||actor.st!=='grabbed'||actor.characterId&&actor.characterId!=='barel'||
      !g?.owner||!(g.sovereign?g.job:g.hook)||!Number.isFinite(actor.t)||actor.t<0||!Number.isFinite(tickMs)||tickMs<=0)return null;
   const elapsed=actor.t*tickMs;
   const time=elapsed<650?elapsed:130+(elapsed-650)%520;
   return root.AsepriteAnimation.frameAt(animation.clips.grabbed,time);
  }
 };
})(typeof globalThis!=='undefined'?globalThis:window);
