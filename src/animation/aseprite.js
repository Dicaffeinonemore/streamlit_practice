(function (root) {
  'use strict';
  const positive = n => Number.isFinite(n) && n > 0;
  function parse(data, { anchor, metadata } = {}) {
    const entries = Array.isArray(data.frames) ? data.frames : Object.entries(data.frames || {}).map(([filename, f]) => ({ ...f, filename }));
    if (!entries.length) throw new Error('Aseprite: no frames');
    const frames = entries.map((f, index) => {
      const r = f.frame, size = f.sourceSize, offset = f.spriteSourceSize || { x: 0, y: 0 };
      if (f.rotated) throw new Error('Aseprite: rotated frames are unsupported');
      if (!r || ![r.x, r.y].every(n => Number.isFinite(n) && n >= 0) || !positive(r.w) || !positive(r.h) || !positive(f.duration) || !size || !positive(size.w) || !positive(size.h)) throw new Error('Aseprite: invalid frame ' + index);
      const origin = anchor || metadata?.anchor || [size.w / 2, size.h];
      const renderOffset = metadata?.frameOffsets?.[index] || [0, 0];
      if (![origin, renderOffset].every(v => Array.isArray(v) && v.length === 2 && v.every(Number.isFinite))) throw new Error('Aseprite: invalid anchor/offset');
      return { index, filename: f.filename, atlas: [r.x, r.y, r.w, r.h],
        anchor: [origin[0] - offset.x - renderOffset[0], origin[1] - offset.y - renderOffset[1]],
        baseAnchor: [...origin], renderOffset: [...renderOffset], duration: f.duration,
        sourceSize: { ...size }, spriteSourceSize: { ...offset }, trimmed: !!f.trimmed };
    });
    const clips = Object.create(null);
    const tags = data.meta?.frameTags || [];
    for (const tag of (tags.length ? tags : [{ name: 'default', from: 0, to: frames.length - 1, direction: 'forward' }])) {
      if (!tag.name || clips[tag.name] || !Number.isInteger(tag.from) || !Number.isInteger(tag.to) || tag.from < 0 || tag.to < tag.from || tag.to >= frames.length) throw new Error('Aseprite: invalid tag');
      let order = Array.from({ length: tag.to - tag.from + 1 }, (_, i) => tag.from + i);
      const direction = tag.direction || 'forward';
      if (!['forward', 'reverse', 'pingpong', 'pingpong_reverse'].includes(direction)) throw new Error('Aseprite: unknown tag direction');
      if (direction === 'reverse' || direction === 'pingpong_reverse') order.reverse();
      if (direction.startsWith('pingpong')) order = order.concat(order.slice(1, -1).reverse());
      const sequence = order.map(i => frames[i]);
      clips[tag.name] = { id: tag.name, frames: sequence, duration: sequence.reduce((sum, f) => sum + f.duration, 0), tag: { ...tag }, loop: false, gameReady: false };
    }
    if (metadata) {
      const clip = clips[metadata.clip], combat = metadata.combat;
      const validLink = combat && (metadata.terminalAttack === true
        ? combat.comboLinkMs === null
        : Number.isFinite(combat.comboLinkMs) && combat.activeEndMs <= combat.comboLinkMs && combat.comboLinkMs < combat.durationMs);
      const looping = metadata.animationType === 'loop' && metadata.loop === true;
      const noncombat = looping || (metadata.animationType === 'oneshot' && metadata.loop === false);
      const validTiming = noncombat
        ? combat == null && positive(metadata.durationMs) && clip?.duration === metadata.durationMs
        : combat && [combat.durationMs, combat.activeStartMs, combat.activeEndMs].every(Number.isFinite) && validLink &&
          clip?.duration === combat.durationMs && 0 <= combat.activeStartMs && combat.activeStartMs < combat.activeEndMs && combat.activeEndMs <= combat.durationMs;
      if (metadata.schemaVersion !== 1 || !Array.isArray(metadata.anchor) || metadata.anchor.length !== 2 || !metadata.anchor.every(Number.isFinite) ||
          !clip || !Array.isArray(metadata.frameOffsets) || metadata.frameOffsets.length !== frames.length ||
          !metadata.frameOffsets.every(v => Array.isArray(v) && v.length === 2 && v.every(Number.isFinite)) ||
          !Array.isArray(metadata.expectedDurationsMs) || metadata.expectedDurationsMs.length !== frames.length ||
          frames.some((f, i) => f.duration !== metadata.expectedDurationsMs[i]) ||
          !validTiming) {
        throw new Error('Aseprite: metadata/timing mismatch');
      }
      if (looping) clip.loop = true;
    }
    return { frames, clips, tags, image: data.meta?.image, meta: data.meta, metadata };
  }
  // Returns the existing runtime's {atlas:[x,y,w,h], anchor:[ax,ay]} shape.
  function frameAt(clip, elapsedMs, loop = false) {
    if (!clip || !Number.isFinite(elapsedMs)) return null;
    let time = loop ? ((elapsedMs % clip.duration) + clip.duration) % clip.duration : Math.max(0, elapsedMs);
    for (const frame of clip.frames) {
      if (time < frame.duration) return frame;
      time -= frame.duration;
    }
    return clip.frames[clip.frames.length - 1];
  }
  function frameAtProgress(clip, progress = 0, loop = false) {
    return frameAt(clip, progress * clip.duration, loop);
  }
  // Pure rendering sample. The caller owns game time, hitSet, hitstop and cancellation.
  function sampleAttack(animation, elapsedMs) {
    if (!Number.isFinite(elapsedMs) || elapsedMs < 0) throw new Error('Aseprite: invalid attack time');
    const m = animation.metadata, clip = animation.clips[m.clip], c = m.combat;
    return { frame: frameAt(clip, elapsedMs), elapsedMs,
      active: elapsedMs >= c.activeStartMs && elapsedMs < c.activeEndMs,
      canLink: Number.isFinite(c.comboLinkMs) && elapsedMs >= c.comboLinkMs && elapsedMs < c.durationMs,
      ended: elapsedMs >= c.durationMs };
  }
  function sampleActor(animation, actor, tickMs) {
    // Current Barel combo0 contract; never accumulate an independent render clock.
    if (actor.st !== 'atk' || actor.atk !== 'c1' || actor.combo !== 0) return null;
    if (!positive(tickMs)) throw new Error('Aseprite: invalid game tick duration');
    return sampleAttack(animation, actor.t * tickMs);
  }
  class AnimationPlayer {
    constructor(clips) { this.clips = clips; this.clip = null; this.elapsed = 0; this.ended = false; }
    play(id, { loop = false } = {}) {
      if (!this.clips[id]) return false;
      this.clip = this.clips[id]; this.elapsed = 0; this.loop = loop; this.ended = false; return true;
    }
    advance(ms) {
      if (!this.clip || this.ended || !Number.isFinite(ms) || ms <= 0) return;
      this.elapsed = this.loop ? (this.elapsed + ms) % this.clip.duration : Math.min(this.clip.duration, this.elapsed + ms);
      this.ended = !this.loop && this.elapsed >= this.clip.duration;
    }
    seek(index) {
      if (!this.clip) return;
      index = Math.max(0, Math.min(this.clip.frames.length - 1, Math.trunc(index)));
      this.elapsed = this.clip.frames.slice(0, index).reduce((sum, f) => sum + f.duration, 0); this.ended = false;
    }
    get frame() { return frameAt(this.clip, this.elapsed, this.loop); }
    get index() { return this.clip ? this.clip.frames.indexOf(this.frame) : 0; }
  }
  function draw(ctx, image, frame, { x = 0, y = 0, scale = 1, face = 1, alpha = 1 } = {}) {
    if (!frame) return;
    const [sx, sy, w, h] = frame.atlas, [ax, ay] = frame.anchor;
    ctx.save();
    try {
      ctx.translate(x, y); ctx.scale(face < 0 ? -scale : scale, scale);
      ctx.globalAlpha *= alpha; ctx.imageSmoothingEnabled = false;
      ctx.drawImage(image, sx, sy, w, h, -ax, -ay, w, h);
    } finally { ctx.restore(); }
  }
  async function load(jsonUrl, options) {
    const url = new URL(jsonUrl, root.location.href);
    const response = await fetch(url);
    if (!response.ok) throw new Error('Aseprite JSON: HTTP ' + response.status);
    const animation = parse(await response.json(), options);
    if (!animation.image) throw new Error('Aseprite: missing meta.image');
    const image = await new Promise((resolve, reject) => {
      const img = new Image(); img.onload = () => resolve(img); img.onerror = () => reject(new Error('Aseprite image failed to load'));
      img.src = new URL(animation.image, url).href;
    });
    return { ...animation, image };
  }
  async function loadMetadata(metadataUrl) {
    const url = new URL(metadataUrl, root.location.href);
    const response = await fetch(url);
    if (!response.ok) throw new Error('Aseprite metadata: HTTP ' + response.status);
    const metadata = await response.json();
    return load(new URL(metadata.sprite, url).href, { metadata });
  }
  root.AsepriteAnimation = { parse, frameAt, frameAtProgress, sampleAttack, sampleActor, AnimationPlayer, draw, load, loadMetadata };
  if (typeof module !== 'undefined') module.exports = root.AsepriteAnimation;
})(typeof globalThis !== 'undefined' ? globalThis : window);
