(function(root){
  'use strict';
  const config=root.BAREL_IDLE_CONFIG||{};
  let mode=new URLSearchParams(root.location?.search||'').get('barelIdle')||config.mode||'aseprite10';
  if(!['legacy','aseprite10'].includes(mode))mode='aseprite10';
  let animation=null,error=null;
  const url=config.metadataUrl||'assets/aseprite/barel-idle-stationary-10/barel-idle-stationary-10.animation.json';
  function validate(asset){
    const m=asset.metadata,clip=asset.clips[m.clip];
    if(m.character!=='barel'||m.animationId!=='idle'||m.animationType!=='loop'||m.loop!==true||m.combat!=null||
       m.clip!=='idle'||m.durationMs!==1300||clip.duration!==1300||asset.frames.length!==10||clip.frames.length!==10||
       clip.tag.direction!=='forward'||clip.frames.some(f=>f.duration!==130)||
       m.clock?.source!=='tick * MS'||m.clock?.legacyPeriodMs!==1300||m.clock?.resetOnIdleEntry!==false||
       m.previewBounds!==undefined&&(!Array.isArray(m.previewBounds)||m.previewBounds.length!==4||
         !m.previewBounds.every(n=>Number.isFinite(n)&&Math.abs(n)<=448)||m.previewBounds[0]>=m.previewBounds[2]||m.previewBounds[1]>=m.previewBounds[3])||
       !Number.isFinite(m.renderScale)||m.renderScale<=0||m.anchor.some(n=>n<0||n>448)||
       m.alignment?.referenceLegacyHeight!==142||!Number.isFinite(m.alignment?.newBodyHeight)||m.alignment.newBodyHeight<=0||
       Math.abs(m.renderScale*m.alignment.newBodyHeight-142)>1e-9||
       !asset.image.complete||!asset.image.naturalWidth||asset.meta.size?.w!==asset.image.naturalWidth||asset.meta.size?.h!==asset.image.naturalHeight){
      throw Error('Barel idle: metadata/timing/image mismatch');
    }
    for(const f of clip.frames){
      const [x,y,w,h]=f.atlas,o=f.spriteSourceSize;
      if(![x,y,w,h].every(Number.isInteger)||x+w>asset.image.naturalWidth||y+h>asset.image.naturalHeight||
         f.sourceSize.w!==448||f.sourceSize.h!==448||f.anchor.some(n=>n<0||n>448)||o.x<0||o.y<0||
         o.x+w>448||o.y+h>448)throw Error('Barel idle: frame bounds');
      f.image=asset.image;f.renderScale=m.renderScale;
    }
    return asset;
  }
  const ready=Promise.resolve().then(()=>{
    if(!root.AsepriteAnimation)throw Error('Aseprite adapter unavailable');
    return root.AsepriteAnimation.loadMetadata(url);
  }).then(asset=>{animation=validate(asset);return true;}).catch(reason=>{
    animation=null;error=String(reason.message||reason);console.warn('Barel idle uses legacy:',error);return false;
  });
  root.BarelIdle={
    ready,
    setMode(value){if(!['legacy','aseprite10'].includes(value))throw Error('Unknown Barel idle mode');mode=value;},
    status(){return {requested:mode,effective:mode==='aseprite10'&&animation?'aseprite10':'legacy',loaded:!!animation,error};},
    preview(elapsedMs){
      const b=animation?.metadata.previewBounds;
      if(mode!=='aseprite10'||!animation||!Number.isFinite(elapsedMs)||elapsedMs<0||
         !Array.isArray(b)||b.length!==4||!b.every(Number.isFinite)||b[0]>=b[2]||b[1]>=b[3])return null;
      return {image:animation.image,frame:root.AsepriteAnimation.frameAt(animation.clips.idle,elapsedMs,true),bounds:b};
    },
    frameFor(actor,elapsedMs){
      if(mode!=='aseprite10'||!animation||actor.st!=='free'||actor.walk||actor.z!==0||
         actor.characterId&&actor.characterId!=='barel'||!Number.isFinite(elapsedMs)||elapsedMs<0)return null;
      return root.AsepriteAnimation.frameAt(animation.clips.idle,elapsedMs,true);
    }
  };
})(typeof globalThis!=='undefined'?globalThis:window);
