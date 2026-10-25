(function(root){
  'use strict';
  const config=root.BAREL_DASH_CONFIG||{};
  // Use the supplied artwork by default, as explicitly requested.
  let mode=new URLSearchParams(root.location?.search||'').get('barelDash')||config.mode||'aseprite10';
  if(!['legacy','aseprite10'].includes(mode))mode='aseprite10';
  let animation=null,error=null;
  const url=config.metadataUrl||'assets/aseprite/barel-dash-10/barel-dash-10.animation.json';
  function validate(asset){
    const m=asset.metadata,clip=asset.clips[m.clip];
    if(m.character!=='barel'||m.animationId!=='dash'||m.animationType!=='oneshot'||m.loop!==false||m.combat!=null||
       m.clip!=='dash'||m.durationMs!==190||clip.duration!==190||asset.frames.length!==10||clip.frames.length!==10||
       clip.tag.direction!=='forward'||clip.frames.some(f=>f.duration!==19)||
       m.clock?.source!=='player.t * MS'||m.clock?.legacyDurationMs!==190||
       !Number.isFinite(m.renderScale)||m.renderScale<=0||m.anchor.some(n=>n<0||n>384)||
       m.alignment?.referenceLegacyHeight!==142||!Number.isFinite(m.alignment?.newBodyHeight)||m.alignment.newBodyHeight<=0||
       Math.abs(m.renderScale*m.alignment.newBodyHeight-142)>1e-9||
       !asset.image.complete||!asset.image.naturalWidth||asset.meta.size?.w!==asset.image.naturalWidth||asset.meta.size?.h!==asset.image.naturalHeight){
      throw Error('Barel dash: metadata/timing/image mismatch');
    }
    for(const f of clip.frames){
      const [x,y,w,h]=f.atlas,o=f.spriteSourceSize;
      if(![x,y,w,h].every(Number.isInteger)||x+w>asset.image.naturalWidth||y+h>asset.image.naturalHeight||
         f.sourceSize.w!==384||f.sourceSize.h!==384||f.anchor.some(n=>n<0||n>384)||o.x<0||o.y<0||
         o.x+w>384||o.y+h>384)throw Error('Barel dash: frame bounds');
      f.image=asset.image;f.renderScale=m.renderScale;
    }
    return asset;
  }
  const ready=Promise.resolve().then(()=>{
    if(!root.AsepriteAnimation)throw Error('Aseprite adapter unavailable');
    return root.AsepriteAnimation.loadMetadata(url);
  }).then(asset=>{animation=validate(asset);root.BarelDashFx?.prepare(asset.image);return true;}).catch(reason=>{
    animation=null;error=String(reason.message||reason);console.warn('Barel dash uses legacy:',error);return false;
  });
  root.BarelDash={
    ready,
    hasBakedEffects(){return mode==='aseprite10'&&!!animation;},
    setMode(value){if(!['legacy','aseprite10'].includes(value))throw Error('Unknown Barel dash mode');mode=value;},
    status(){return {requested:mode,effective:mode==='aseprite10'&&animation?'aseprite10':'legacy',loaded:!!animation,error};},
    frameFor(actor,tickMs,durationMs){
      const elapsedMs=actor.t*tickMs;
      if(mode!=='aseprite10'||!animation||actor.st!=='dash'||durationMs!==190||!Number.isFinite(tickMs)||tickMs<=0||
         actor.characterId&&actor.characterId!=='barel'||!Number.isFinite(elapsedMs)||elapsedMs<0)return null;
      return root.AsepriteAnimation.frameAt(animation.clips.dash,elapsedMs,false);
    }
  };
})(typeof globalThis!=='undefined'?globalThis:window);

// Visual snapshots only. World positions and frame references remain fixed.
(function(root){
  'use strict';
  const interval=1000/30,lifeMs=150,maxCount=4;
  const tints=new WeakMap();
  let snapshots=[],lastCapture=0,owner=null;
  function tint(image){
    if(tints.has(image))return tints.get(image);
    const variants=['#9E1A1F','#38090D'].map(color=>{
      const c=document.createElement('canvas');c.width=image.naturalWidth;c.height=image.naturalHeight;
      const p=c.getContext('2d');p.drawImage(image,0,0);
      p.globalCompositeOperation='source-atop';p.globalAlpha=.48;p.fillStyle=color;p.fillRect(0,0,c.width,c.height);
      p.globalAlpha=.2;p.fillStyle='#120607';p.fillRect(0,0,c.width,c.height);
      return c;
    });
    tints.set(image,variants);return variants;
  }
  root.BarelDashFx={
    prepare(image){tint(image);},
    clear(){snapshots=[];lastCapture=0;owner=null;},
    start(actor){
      if(actor.characterId&&actor.characterId!=='barel')return;
      if(owner&&owner!==actor)snapshots=[];
      owner=actor;lastCapture=0;
      for(const g of snapshots)g.life=Math.min(g.life,g.age+50);
    },
    capture(actor,tickMs){
      if(actor.st!=='dash'||actor.characterId&&actor.characterId!=='barel')return;
      const elapsed=actor.t*tickMs;
      if(owner!==actor)this.start(actor);
      if(elapsed+1e-7<lastCapture+interval)return;
      const frame=barelPlayerFrame(),image=frame?.image||BAREL_ATLAS;
      if(!frame||!image.complete||!image.naturalWidth)return;
      lastCapture=elapsed;
      // Prepare once per loaded atlas; no per-frame canvas/image allocation.
      tint(image);
      snapshots.push({x:actor.x,y:actor.y,z:actor.z,face:actor.face,frame,image,age:0,life:lifeMs});
      if(snapshots.length>maxCount)snapshots.shift();
    },
    update(actor,ms){
      if(owner!==actor){this.clear();return;}
      for(const g of snapshots){
        g.age+=ms;
        if(actor.st!=='dash')g.life=Math.min(g.life,g.age+50);
      }
      snapshots=snapshots.filter(g=>g.age<g.life);
    },
    draw(){
      for(const g of snapshots){
        const u=g.age/g.life,image=tint(g.image)[u<.5?0:1];
        AsepriteAnimation.draw(ctx,image,g.frame,{x:g.x-camX,y:g.y-g.z,face:g.face,
          scale:BAREL_PLAYER_SCALE*(g.frame.renderScale||1),alpha:.18*(1-u)*(UX.options.lowFx?.55:1)});
      }
    },
    status(){return snapshots.map(g=>({x:g.x,y:g.y,z:g.z,face:g.face,index:g.frame.index,
      age:g.age,life:g.life,alpha:.18*(1-g.age/g.life)}));}
  };
})(typeof globalThis!=='undefined'?globalThis:window);
