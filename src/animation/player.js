(function (root) {
  'use strict';
  class AnimationPlayer {
    constructor(clips, { preview = false, onFrame = () => {}, onComplete = () => {} } = {}) {
      this.clips = clips; this.preview = preview;
      this.onFrame = onFrame; this.onComplete = onComplete;
      this.clip = null; this.index = 0; this.elapsed = 0; this.ended = false;
    }
    play(id) {
      const clip = this.clips[id];
      if (!clip || !clip.frames.length || (!this.preview && !clip.gameReady)) return false;
      if (!(Number.isFinite(clip.fps) && clip.fps > 0)) throw new Error('Invalid animation FPS: ' + id);
      this.clip = clip; this.index = 0; this.elapsed = 0; this.ended = false;
      this.onFrame(0, clip); return true;
    }
    seek(index) {
      if (!this.clip) return;
      this.index = Math.max(0, Math.min(this.clip.frames.length - 1, Math.trunc(index)));
      this.elapsed = 0; this.ended = false; // Scrubbing must never inflict damage.
    }
    advance(ms) {
      if (!this.clip || this.ended || !Number.isFinite(ms) || ms <= 0) return;
      this.elapsed += ms;
      const clip = this.clip, duration = 1000 / clip.fps;
      while (this.elapsed + 1e-8 >= duration) {
        this.elapsed = Math.max(0, this.elapsed - duration);
        if (this.index + 1 === clip.frames.length) {
          if (clip.loop) this.index = 0;
          else { this.ended = true; this.elapsed = 0; this.onComplete(clip); break; }
        } else this.index++;
        this.onFrame(this.index, clip);
        if (this.clip !== clip) break; // Callback may change state.
      }
    }
    get frame() { return this.clip?.frames[this.index] || null; }
  }
  root.ReferenceAnimation = { AnimationPlayer };
  if (typeof module !== 'undefined') module.exports = root.ReferenceAnimation;
})(typeof globalThis !== 'undefined' ? globalThis : window);
