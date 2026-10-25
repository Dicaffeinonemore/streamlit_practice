(function (root) {
  'use strict';
  const config = root.BAREL_COMBO0_CONFIG || {};
  const requested = new URLSearchParams(root.location?.search || '').get('barelCombo0');
  let mode = requested || config.mode || 'aseprite10';
  if (!['legacy', 'aseprite10'].includes(mode)) mode = 'aseprite10';
  let animation = null, error = null;
  const metadataUrl = config.metadataUrl || 'assets/aseprite/barel-combo0-dot-10/barel-combo0-dot-10.animation.json';
  function validate(asset) {
    const m = asset.metadata, clip = asset.clips[m.clip], c = m.combat;
    if (m.character !== 'barel' || m.attackId !== 'combo0' || clip.frames.length !== 10 ||
        clip.tag.direction !== 'forward' ||
        JSON.stringify(clip.frames.map(f => f.duration)) !== '[40,30,35,25,25,30,45,25,40,55]' ||
        c.durationMs !== 350 || c.activeStartMs !== 128.5 || c.activeEndMs !== 230 || c.comboLinkMs !== 267.5 ||
        !Number.isFinite(m.renderScale) || m.renderScale <= 0 ||
        !asset.image.complete || !asset.image.naturalWidth) throw Error('Barel combo0: invalid ten-frame asset');
    for (const f of clip.frames) {
      const [x,y,w,h] = f.atlas;
      if (x+w > asset.image.naturalWidth || y+h > asset.image.naturalHeight) throw Error('Barel combo0: atlas bounds');
      f.image = asset.image; f.renderScale = m.renderScale;
    }
    return asset;
  }
  const ready = Promise.resolve().then(() => {
    if (!root.AsepriteAnimation) throw Error('Aseprite adapter unavailable');
    return root.AsepriteAnimation.loadMetadata(metadataUrl);
  }).then(asset => { animation = validate(asset); return true; }).catch(reason => {
    animation = null; error = String(reason.message || reason);
    console.warn('Barel combo0 uses legacy:', error);
    return false;
  });
  root.BarelCombo0 = {
    ready,
    setMode(value) {
      if (!['legacy','aseprite10'].includes(value)) throw Error('Unknown Barel combo0 mode');
      mode = value;
    },
    status() { return { requested: mode, effective: mode === 'aseprite10' && animation ? 'aseprite10' : 'legacy', loaded: !!animation, error }; },
    frameFor(actor, tickMs) {
      if (mode !== 'aseprite10' || !animation) return null;
      return root.AsepriteAnimation.sampleActor(animation, actor, tickMs)?.frame || null;
    }
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
