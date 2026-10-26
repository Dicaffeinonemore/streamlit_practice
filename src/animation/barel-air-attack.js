(function(root){
  'use strict';
  const config=root.BAREL_AIR_ATTACK_CONFIG||{};
  let mode=new URLSearchParams(root.location?.search||'').get('barelAirAttack')||config.mode||'aseprite10';
  if(!['legacy','aseprite10'].includes(mode))mode='aseprite10';
  let animation=null,error=null;
  const url=config.metadataUrl||'assets/aseprite/barel-air-attack-10/barel-air-attack-10.animation.json';
  function validate(asset){
    const m=asset.metadata,clip=asset.clips[m.clip],c=m.combatReference;
    if(m.character!=='barel'||m.animationId!=='air'||m.animationType!=='oneshot'||m.loop!==false||m.combat!=null||
       m.clip!=='air'||m.durationMs!==400||clip.duration!==400||asset.frames.length!==10||clip.frames.length!==10||
       clip.tag.direction!=='forward'||clip.frames.some(f=>f.duration!==40)||
       m.clock?.source!=='player.t * MS'||m.clock?.mapping!=='remaining-flight'||m.clock?.termination!=='landing-or-interrupt'||
       m.clock?.legacyVisualDurationMs!==400||m.clock?.hitPoseFloor!==5||
       c?.damage!==14||c.reach!==64||c.knockdown!==true||c.hitStopTicks!==5||c.effectiveHitStopTicks!==6||c.forwardPerTick!==2.6||
       c.active!=='every-air-attack-step'||c.gravityPerTick!==.55||c.maxFlightTicks!==36||
       !Number.isFinite(m.renderScale)||m.renderScale<=0||m.anchor.some(n=>n<0||n>448)||
       m.alignment?.referenceLegacyHeight!==142||!Number.isFinite(m.alignment?.newBodyHeight)||m.alignment.newBodyHeight<=0||
       Math.abs(m.renderScale*m.alignment.newBodyHeight-142)>1e-9||
       !asset.image.complete||!asset.image.naturalWidth||asset.meta.size?.w!==asset.image.naturalWidth||asset.meta.size?.h!==asset.image.naturalHeight){
      throw Error('Barel air attack: metadata/timing/image mismatch');
    }
    for(const f of clip.frames){
      const [x,y,w,h]=f.atlas,o=f.spriteSourceSize;
      if(![x,y,w,h].every(Number.isInteger)||x+w>asset.image.naturalWidth||y+h>asset.image.naturalHeight||
         f.sourceSize.w!==448||f.sourceSize.h!==448||f.anchor.some(n=>n<0||n>448)||o.x<0||o.y<0||
         o.x+w>448||o.y+h>448)throw Error('Barel air attack: frame bounds');
      f.image=asset.image;f.renderScale=m.renderScale;
    }
    return asset;
  }
  const ready=Promise.resolve().then(()=>{
    if(!root.AsepriteAnimation)throw Error('Aseprite adapter unavailable');
    return root.AsepriteAnimation.loadMetadata(url);
  }).then(asset=>{animation=validate(asset);return true;}).catch(reason=>{
    animation=null;error=String(reason.message||reason);console.warn('Barel air attack uses legacy:',error);return false;
  });
  // Read the same discrete ballistic equation as the existing gravity update.
  // No retained start time, elapsed accumulator, actor writes or physics hooks.
  function remainingTicks(actor){
    for(let n=1;n<=120;n++)if(actor.z+n*actor.vz-.55*n*(n-1)/2<=1e-8)return n;
    return 120;
  }
  root.BarelAirAttack={
    ready,
    setMode(value){if(!['legacy','aseprite10'].includes(value))throw Error('Unknown Barel air attack mode');mode=value;},
    status(){return {requested:mode,effective:mode==='aseprite10'&&animation?'aseprite10':'legacy',loaded:!!animation,error};},
    frameFor(actor,tickMs){
      if(mode!=='aseprite10'||!animation||actor.st!=='atk'||actor.atk!=='air'||
         actor.characterId&&actor.characterId!=='barel'||!Number.isFinite(tickMs)||tickMs<=0||
         !Number.isFinite(actor.t)||actor.t<0||!Number.isFinite(actor.z)||actor.z<=0||!Number.isFinite(actor.vz))return null;
      const elapsed=actor.t*tickMs;
      const available=(actor.t+remainingTicks(actor)-1)*tickMs;
      let visualMs=available>0?400*elapsed/available:400;
      if(actor.hitSet?.size>0)visualMs=Math.max(200,visualMs);
      return root.AsepriteAnimation.frameAt(animation.clips.air,visualMs);
    }
  };
})(typeof globalThis!=='undefined'?globalThis:window);
