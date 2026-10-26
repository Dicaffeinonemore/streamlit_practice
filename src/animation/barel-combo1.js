(function (root) {
  'use strict';
  const config = root.BAREL_COMBO1_CONFIG || {};
  const requested = new URLSearchParams(root.location?.search || '').get('barelCombo1');
  let mode = requested || config.mode || 'aseprite10';
  if (!['legacy', 'aseprite10'].includes(mode)) mode = 'aseprite10';
  let animation = null, error = null;
  const metadataUrl = config.metadataUrl || 'assets/aseprite/barel-combo1-dot-10/barel-combo1-dot-10.animation.json';
  function validate(asset) {
    const m = asset.metadata, clip = asset.clips[m.clip], c = m.combat;
    if (m.character !== 'barel' || m.attackId !== 'combo1' || m.clip !== 'basic-attack-2' ||
        asset.frames.length !== 10 || clip.frames.length !== 10 || clip.tag.direction !== 'forward' ||
        JSON.stringify(clip.frames.map(f => f.duration)) !== '[70,35,35,30,30,20,20,20,25,25]' ||
        c.durationMs !== 310 || c.activeStartMs !== 105 || c.activeEndMs !== 200 || c.comboLinkMs !== 233 ||
        !Number.isFinite(m.renderScale) || m.renderScale <= 0 ||
        m.anchor.some(n => n < 0 || n > 384) ||
        m.alignment?.referenceLegacyHeight !== 142 || !Number.isFinite(m.alignment?.newNeutralHeight) ||
        m.alignment.newNeutralHeight <= 0 || Math.abs(m.renderScale * m.alignment.newNeutralHeight - 142) > 1e-9 ||
        !asset.image.complete || !asset.image.naturalWidth ||
        asset.meta.size?.w !== asset.image.naturalWidth || asset.meta.size?.h !== asset.image.naturalHeight) {
      throw Error('Barel combo1: metadata/timing/image mismatch');
    }
    for (const f of clip.frames) {
      const [x,y,w,h] = f.atlas, offset = f.spriteSourceSize;
      if (![x,y,w,h].every(Number.isInteger) || x+w > asset.image.naturalWidth || y+h > asset.image.naturalHeight ||
          f.sourceSize.w !== 384 || f.sourceSize.h !== 384 || f.anchor.some(n => n < 0 || n > 384) || offset.x < 0 || offset.y < 0 ||
          offset.x+w > f.sourceSize.w || offset.y+h > f.sourceSize.h) throw Error('Barel combo1: frame bounds');
      f.image = asset.image; f.renderScale = m.renderScale;
    }
    return asset;
  }
  const ready = Promise.resolve().then(() => {
    if (!root.AsepriteAnimation) throw Error('Aseprite adapter unavailable');
    return root.AsepriteAnimation.loadMetadata(metadataUrl);
  }).then(asset => { animation = validate(asset); return true; }).catch(reason => {
    animation = null; error = String(reason.message || reason);
    console.warn('Barel combo1 uses legacy:', error);
    return false;
  });
  root.BarelCombo1 = {
    ready,
    setMode(value) {
      if (!['legacy','aseprite10'].includes(value)) throw Error('Unknown Barel combo1 mode');
      mode = value;
    },
    status() { return { requested: mode, effective: mode === 'aseprite10' && animation ? 'aseprite10' : 'legacy', loaded: !!animation, error }; },
    frameFor(actor, tickMs) {
      if (mode !== 'aseprite10' || !animation || actor.st !== 'atk' || actor.atk !== 'c2' || actor.combo !== 1 ||
          actor.characterId && actor.characterId !== 'barel' || !Number.isFinite(tickMs) || tickMs <= 0 ||
          !Number.isFinite(actor.t) || actor.t < 0) return null;
      return root.AsepriteAnimation.frameAt(animation.clips[animation.metadata.clip], actor.t * tickMs);
    }
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
