(function(root){
  'use strict';
  const config=root.BAREL_JUMP_CONFIG||{};
  let mode=new URLSearchParams(root.location?.search||'').get('barelJump')||config.mode||'aseprite10';
  if(!['legacy','aseprite10'].includes(mode))mode='aseprite10';
  let animation=null,error=null,owner=null,wasAirborne=false,landingT=null;
  const durations=[17,33,83,84,66,50,134,133,34,50];
  const url=config.metadataUrl||'assets/aseprite/barel-jump-10/barel-jump-10.animation.json';
  function validate(asset){
    const m=asset.metadata,clip=asset.clips[m.clip];
    if(m.character!=='barel'||m.animationId!=='jump'||m.animationType!=='oneshot'||m.loop!==false||m.combat!=null||
       m.clip!=='jump'||m.durationMs!==684||clip.duration!==684||asset.frames.length!==10||clip.frames.length!==10||
       clip.tag.direction!=='forward'||JSON.stringify(clip.frames.map(f=>f.duration))!==JSON.stringify(durations)||
       m.clock?.airSource!=='player.jumpTime * MS'||m.clock?.airDurationMs!==600||
       m.clock?.landingSource!=='(player.t - landingT) * MS'||m.clock?.landingDurationMs!==84||
       m.physicsReference?.initialVz!==9.6||m.physicsReference?.gravityPerTick!==.55||m.physicsReference?.airTicks!==36||
       !Number.isFinite(m.renderScale)||m.renderScale<=0||m.anchor.some(n=>n<0||n>384)||
       m.alignment?.referenceLegacyHeight!==142||!Number.isFinite(m.alignment?.newBodyHeight)||m.alignment.newBodyHeight<=0||
       Math.abs(m.renderScale*m.alignment.newBodyHeight-142)>1e-9||
       !asset.image.complete||!asset.image.naturalWidth||asset.meta.size?.w!==asset.image.naturalWidth||asset.meta.size?.h!==asset.image.naturalHeight){
      throw Error('Barel jump: metadata/timing/image mismatch');
    }
    for(const f of clip.frames){
      const [x,y,w,h]=f.atlas,o=f.spriteSourceSize;
      if(![x,y,w,h].every(Number.isInteger)||x+w>asset.image.naturalWidth||y+h>asset.image.naturalHeight||
         f.sourceSize.w!==384||f.sourceSize.h!==384||f.anchor.some(n=>n<0||n>384)||o.x<0||o.y<0||
         o.x+w>384||o.y+h>384)throw Error('Barel jump: frame bounds');
      f.image=asset.image;f.renderScale=m.renderScale;
    }
    return asset;
  }
  const ready=Promise.resolve().then(()=>{
    if(!root.AsepriteAnimation)throw Error('Aseprite adapter unavailable');
    return root.AsepriteAnimation.loadMetadata(url);
  }).then(asset=>{animation=validate(asset);return true;}).catch(reason=>{
    animation=null;error=String(reason.message||reason);console.warn('Barel jump uses legacy:',error);return false;
  });
  root.BarelJump={
    ready,
    reset(){owner=null;wasAirborne=false;landingT=null;},
    // Observe an already-completed simulation step. Never modify the actor.
    observe(actor){
      if(owner!==actor){owner=actor;wasAirborne=false;landingT=null;}
      if(actor.st!=='free'||actor.characterId&&actor.characterId!=='barel'){
        wasAirborne=false;landingT=null;return;
      }
      const airborne=actor.z>0||actor.vz>0;
      if(airborne)landingT=null;
      else if(wasAirborne)landingT=actor.t;
      else if(landingT!==null&&(actor.t<landingT||actor.t-landingT>=6))landingT=null;
      wasAirborne=airborne;
    },
    setMode(value){if(!['legacy','aseprite10'].includes(value))throw Error('Unknown Barel jump mode');mode=value;},
    status(){return {requested:mode,effective:mode==='aseprite10'&&animation?'aseprite10':'legacy',loaded:!!animation,error};},
    frameFor(actor,tickMs,allowLanding=true){
      if(mode!=='aseprite10'||!animation||actor.st!=='free'||actor.characterId&&actor.characterId!=='barel'||
         !Number.isFinite(tickMs)||tickMs<=0)return null;
      if(actor.z>0||actor.vz>0){
        const elapsed=actor.jumpTime*tickMs;
        if(!Number.isFinite(elapsed)||elapsed<0)return null;
        return root.AsepriteAnimation.frameAt(animation.clips.jump,Math.min(599.999999,elapsed));
      }
      if(allowLanding&&owner===actor&&landingT!==null){
        const elapsed=(actor.t-landingT)*tickMs;
        if(Number.isFinite(elapsed)&&elapsed>=0&&elapsed<84)
          return root.AsepriteAnimation.frameAt(animation.clips.jump,600+elapsed);
      }
      return null;
    }
  };
})(typeof globalThis!=='undefined'?globalThis:window);
