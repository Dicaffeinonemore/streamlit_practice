(function(root){
  'use strict';
  const clips = {};
  // Remade sheets (barel-remake-config.js) replace or add clips by name.
  for(const [name, data] of Object.entries({ ...(root.BAREL_NAMED_MOTION_DATA || {}), ...(root.BAREL_REMAKE_NAMED || {}) })) {
    const image = new Image(); image.src = data.path;
    clips[name] = { ...data, image };
  }
  const pick = (name,index) => {
    const clip = clips[name];
    if(!clip || !clip.image.complete || !clip.image.naturalWidth) return null;
    index = Math.max(0,Math.min(clip.frames-1,Math.floor(index)));
    return { image:clip.image, atlas:[(index%clip.columns)*640,Math.floor(index/clip.columns)*640,640,640], anchor:[320,580], renderScale:clip.scale };
  };
  root.BarelNamedMotion = {
    clips,
    frameFor(actor,tickMs) {
      if(!actor || actor.characterId === 'viesa')return null;
      const t = actor.t*tickMs;
      if(actor.st === 'skill' && actor.skill === 'whirl') return pick('whirl',t/760*8);
      if(actor.st === 'skill' && actor.skill === 'leap') {
        return pick('leap',t<560 ? t/560*6 : 6+(t-560)/400*4);
      }
      // Only the remade art has these sheets; without them pick() returns null and the atlas clip plays.
      if(actor.st === 'skill' && actor.skill === 'slam') return pick('slam',t/820*10);
      if(actor.st === 'skill' && actor.skill === 'redwave') return pick('redwave',t/720*10);
      if(actor.st === 'skill' && actor.skill === 'thrust') return pick('thrust',t/700*10);
      if(actor.st === 'cast') return pick('cast',t/640*10);
      if(actor.st === 'dead') return pick('death',t/1000*10);
      if(actor.st === 'special' && t < 620) return pick('special0',t/620*10);
      // Keep the original fall and prone animation; the supplied six frames
      // start with the lying pose and describe the subsequent recovery.
      if(actor.st === 'down' && actor.z <= 0 && actor.t >= 20)
        return pick('getup',(actor.t-20)/36*6);
      if(actor.st === 'special' && t >= 620 && t < 1260) {
        const elapsed=t-620, hit=Math.min(3,Math.floor(elapsed/160));
        return pick('special'+(hit+1),(elapsed-hit*160)/160*10);
      }
      if(actor.st === 'special' && t >= 1260) {
        return pick('special5',t<1580 ? (t-1260)/320*6 : 6+(t-1580)/520*4);
      }
      return null;
    },
    // Stage-clear pose, on the scene clock like the atlas 'victory' loop.
    victoryFrame(elapsedMs) {
      return Number.isFinite(elapsedMs) && elapsedMs >= 0 ? pick('victory',(elapsedMs%1500)/1500*10) : null;
    }
  };
})(globalThis);
