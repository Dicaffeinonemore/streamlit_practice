(function(root){
  'use strict';
  let animation=null,error=null;
  const ready=Promise.resolve().then(()=>root.AsepriteAnimation.loadMetadata('assets/aseprite/barel-knockdown-getup-design-10/barel-knockdown-getup-design-10.animation.json'))
    .then(asset=>{
      if(asset.metadata.animationId!=='down'||asset.frames.length!==10)throw Error('Barel down: invalid ten-frame clip');
      for(const f of asset.frames){f.image=asset.image;f.renderScale=asset.metadata.renderScale;}
      animation=asset;return true;
    }).catch(reason=>{error=String(reason);console.warn('Barel down uses legacy:',error);return false;});
  root.BarelDown={ready,
    status(){return {loaded:!!animation,error};},
    frameFor(actor){
      if(!animation||actor.st!=='down'||actor.characterId==='viesa')return null;
      let end=0,index=9;
      const ticks=animation.metadata.tickDurations;
      for(let i=0;i<ticks.length;i++){end+=ticks[i];if(actor.t<end){index=i;break;}}
      // Airborne knockdowns keep the falling pose until the existing physics lands.
      if(actor.z>0&&index>2)index=2;
      return animation.frames[index];
    }
  };
})(globalThis);
