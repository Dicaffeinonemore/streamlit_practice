(function(root){
  'use strict';
  let animation=null,error=null;
  const ready=Promise.resolve().then(()=>root.AsepriteAnimation.loadMetadata('assets/aseprite/barel-dash-attack-10/barel-dash-attack-10.animation.json'))
    .then(asset=>{
      if(asset.frames.length!==10||asset.metadata.animationId!=='dash_attack')throw Error('Barel dash attack: invalid asset');
      for(const f of asset.frames){f.image=asset.image;f.renderScale=asset.metadata.renderScale;}
      animation=asset;return true;
    }).catch(reason=>{error=String(reason);console.error(error);return false;});
  root.BarelDashAttack={ready,
    status(){return {loaded:!!animation,error};},
    get data(){return animation?.metadata;},
    frameFor(actor,tickMs){
      if(!animation||actor.st!=='dash_attack')return null;
      const ends=root.COMBAT_FRAME_DATA.barel.dashAttack.frameEndTicks;   // combat-data.js 와 같은 표
      const index=ends.findIndex(end=>actor.t<end);
      return animation.frames[index<0?9:index];
    }
  };
})(globalThis);
