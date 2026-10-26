(function(root){
  'use strict';
  let animation=null,error=null;
  const sequences={hurt_high:{frames:[2,3,4,5,6,12],ticks:[3,5,5,5,6,6]},
                   hurt_low:{frames:[7,8,9,10,11,12],ticks:[3,5,5,6,6,5]}};
  const ready=Promise.resolve().then(()=>root.AsepriteAnimation.loadMetadata('assets/aseprite/barel-hurt-12/barel-hurt-12.animation.json'))
    .then(asset=>{
      if(asset.frames.length!==12||asset.metadata.animationId!=='hurt')throw Error('Barel hurt: invalid twelve-frame asset');
      for(const f of asset.frames){f.image=asset.image;f.renderScale=asset.metadata.renderScale;}
      Object.assign(sequences,asset.metadata.sequences);
      animation=asset;return true;
    }).catch(reason=>{error=String(reason);console.error(error);return false;});
  function sequenceIndex(actor){
    const ends=actor.hurtFrameEnds;
    if(!ends)return 0;
    const i=ends.findIndex(end=>actor.t<end);
    return i<0?5:i;
  }
  root.BarelHurt={ready,
    status(){return {loaded:!!animation,error};},
    begin(actor,worldHeight,totalTicks=17){
      actor.hurtKind=worldHeight-actor.z>=90*.55?'hurt_high':'hurt_low';
      actor.hurtDuration=Math.max(7,Math.round(totalTicks));
      const sequence=sequences[actor.hurtKind],weights=sequence.ticks.slice(0,5);
      const weight=weights.reduce((a,b)=>a+b,0),prefix=actor.hurtDuration-6;
      let end=0;
      actor.hurtFrameEnds=weights.map(ticks=>(end+=ticks/weight*prefix));
      actor.hurtFrameEnds.push(actor.hurtDuration);
      actor.hurtImpactHeight=actor.hurtKind==='hurt_high'?82:45;
    },
    sequenceIndex,
    canKnockback(actor){return sequenceIndex(actor)<3;},
    sourceFrame(actor){return sequences[actor.hurtKind||'hurt_high'].frames[sequenceIndex(actor)];},
    bodyHeight(actor){
      if(actor.st!=='hurt'||actor.hurtKind!=='hurt_low'||!actor.hurtFrameEnds)return 90;
      return this.sourceFrame(actor)<=10?(animation?.metadata.lowHurtboxHeight??84.919114):90;
    },
    frameFor(actor){
      if(!animation||actor.st!=='hurt'||actor.characterId==='viesa')return null;
      return animation.frames[this.sourceFrame(actor)-1];
    }
  };
})(globalThis);
