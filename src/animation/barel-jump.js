(function(root){
  'use strict';
  const config=root.BAREL_JUMP_CONFIG||{};
  let mode=new URLSearchParams(root.location?.search||'').get('barelJump')||config.mode||'aseprite10';
  if(!['legacy','aseprite10'].includes(mode))mode='aseprite10';
  let animation=null,error=null,owner=null,wasAirborne=false,wasElevated=false,landingT=null;
  let currentPhase=null,phaseTicks=0,dust=[];
  const url=config.metadataUrl||'assets/aseprite/barel-jump-revised-10/barel-jump-revised-10.animation.json';
  const ready=Promise.resolve().then(()=>root.AsepriteAnimation.loadMetadata(url)).then(asset=>{
    const m=asset.metadata;
    if(m.animationId!=='jump'||asset.frames.length!==10||m.physicsReference.initialVz!==9.6||
       m.physicsReference.gravityPerTick!==.55||m.selection.landingVisualTicks!==6||
       !Number.isFinite(m.renderScale)||m.renderScale<=0)throw Error('Barel jump: invalid replacement asset');
    for(const frame of asset.frames){
      const [x,y,w,h]=frame.atlas;
      if(x+w>asset.image.naturalWidth||y+h>asset.image.naturalHeight)throw Error('Barel jump: atlas bounds');
      frame.image=asset.image;frame.renderScale=m.renderScale;
    }
    animation=asset;return true;
  }).catch(reason=>{animation=null;error=String(reason.message||reason);console.warn('Barel jump uses legacy:',error);return false;});
  function phaseFor(actor){
    if(actor.z===0&&actor.vz>0)return 'prejump';
    if(actor.vz>4)return 'riseFast';
    if(actor.vz>1)return 'riseSlow';
    if(actor.vz>=-2)return 'apex';
    return 'fall';
  }
  function landingTick(actor){return owner===actor&&landingT!==null?actor.t-landingT:null;}
  function sourceFrame(actor,allowLanding=true){
    if(actor.st!=='free'||actor.characterId&&actor.characterId!=='barel')return null;
    if(actor.z>0||actor.vz>0){
      const phase=phaseFor(actor),elapsed=owner===actor&&phase===currentPhase?phaseTicks:0;
      if(phase==='prejump')return 1;
      if(phase==='riseFast')return elapsed<4?2:3;
      if(phase==='riseSlow')return 4;
      if(phase==='apex')return elapsed<5?5:6;
      return actor.vz < -5?8:7;
    }
    const elapsed=landingTick(actor);
    if(allowLanding&&elapsed!==null&&elapsed>=0&&elapsed<6)return elapsed<4?9:10;
    return null;
  }
  root.BarelJump={ready,
    reset(){owner=null;wasAirborne=wasElevated=false;landingT=null;currentPhase=null;phaseTicks=0;dust=[];},
    // Observe completed steps. Rendering never writes the actor or advances time.
    observe(actor){
      if(owner!==actor){this.reset();owner=actor;}
      dust=dust.filter(fx=>++fx.age<8);
      if(actor.characterId&&actor.characterId!=='barel')return;
      const ordinary=actor.st==='free'||actor.st==='atk'&&actor.atk==='air';
      if(!ordinary){wasAirborne=wasElevated=false;landingT=null;currentPhase=null;phaseTicks=0;return;}
      const airborne=actor.z>0||actor.vz>0,elevated=actor.z>0;
      if(airborne){
        const phase=phaseFor(actor);
        phaseTicks=phase===currentPhase?phaseTicks+1:0;currentPhase=phase;landingT=null;
        if(elevated&&!wasElevated)dust.push({x:actor.x,y:actor.y+2,face:actor.face,age:0});
      }else{
        currentPhase=null;phaseTicks=0;
        if(wasAirborne){landingT=actor.t;dust.push({x:actor.x,y:actor.y+2,face:actor.face,age:0});}
        else if(landingT!==null&&(actor.t<landingT||actor.t-landingT>=6))landingT=null;
      }
      wasAirborne=airborne;wasElevated=elevated;
    },
    sourceFrame,
    dustFor(actor){return owner===actor?dust:[];},
    setMode(value){if(!['legacy','aseprite10'].includes(value))throw Error('Unknown Barel jump mode');mode=value;},
    status(){return {requested:mode,effective:mode==='aseprite10'&&animation?'aseprite10':'legacy',loaded:!!animation,error};},
    frameFor(actor,tickMs,allowLanding=true){
      if(mode!=='aseprite10'||!animation||!Number.isFinite(tickMs)||tickMs<=0)return null;
      const frame=sourceFrame(actor,allowLanding);
      return frame===null?null:animation.frames[frame-1];
    }
  };
})(globalThis);
