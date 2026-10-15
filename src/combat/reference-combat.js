(function (root) {
  'use strict';
  // Production gate: review candidates cannot accidentally enter live combat.
  // Balance and active frames come from data/skills, never from sprite labels.
  class ReferenceCombatant {
    constructor({ animations, skills, hp, x = 0, y = 0, onHit = () => {} }) {
      if (!(Number.isFinite(hp) && hp > 0)) throw new Error('HP balance must be configured');
      this.animations = animations; this.skills = skills; this.hp = hp;
      this.x = x; this.y = y; this.face = 1; this.state = 'idle'; this.skill = null;
      this.time = 0; this.cooldowns = new Map(); this.hitsByTarget = new Map(); this.targets = [];
      this.onHit = onHit; this.finished = false; this.blocked = null;
      this.player = new root.ReferenceAnimation.AnimationPlayer(animations, {
        onFrame: () => this.checkHits(),
        onComplete: clip => {
          if (clip.id === 'death') { this.finished = true; return; }
          this.skill = null; this.state = 'idle';
          if (!this.player.play('idle')) this.blocked = '대기 모션 미검수';
        },
      });
      if (!this.player.play('idle')) this.blocked = '대기 모션 미검수';
    }
    useSkill(id, targets = []) {
      if (this.hp <= 0 || this.skill || this.state === 'hurt') return false;
      const s = this.skills[id], clip = this.animations[s?.animation];
      if (!s?.enabled || !clip?.gameReady || !clip.frames.length || clip.loop) return false;
      const b = s.balance;
      if (!b || !Number.isFinite(b.damage) || b.damage < 0 || !Number.isFinite(b.cooldownMs) || b.cooldownMs < 0) return false;
      if (!s.activeFrames.length || !s.activeFrames.every(f => Number.isInteger(f) && f >= 0 && f < clip.frames.length)) return false;
      if (!s.hitboxes.length || !s.hitboxes.every(h => [h.x,h.y,h.w,h.h].every(Number.isFinite) && h.w > 0 && h.h > 0)) return false;
      if ((this.cooldowns.get(id) || 0) > this.time) return false;
      this.skill = s; this.targets = targets; this.hitsByTarget.clear(); this.state = 'attack';
      this.cooldowns.set(id, this.time + b.cooldownMs);
      this.player.play(s.animation); return true;
    }
    checkHits() {
      const s = this.skill;
      if (!s || !s.activeFrames.includes(this.player.index)) return;
      for (const target of this.targets) {
        // One hit per configured strike. Adjacent active frames share a strike;
        // disjoint windows support multi-slash skills without frame-rate damage.
        const groups = s.activeFrames.slice().sort((a,b) => a-b);
        let group = 0;
        for (let i = 1; i < groups.length && groups[i] <= this.player.index; i++) if (groups[i] > groups[i-1]+1) group++;
        let hitGroups = this.hitsByTarget?.get(target);
        if (hitGroups?.has(group) || target.hp <= 0) continue;
        const collides = s.hitboxes.some(h => {
          const left = this.x + (this.face > 0 ? h.x : -h.x-h.w), top = this.y + h.y;
          return left < target.x + target.w && left + h.w > target.x && top < target.y + target.h && top + h.h > target.y;
        });
        if (!collides) continue;
        if (!this.hitsByTarget) this.hitsByTarget = new Map();
        if (!hitGroups) { hitGroups = new Set(); this.hitsByTarget.set(target, hitGroups); }
        hitGroups.add(group);
        if (typeof target.damage === 'function') target.damage(s.balance.damage);
        else target.hp = Math.max(0, target.hp - s.balance.damage);
        this.onHit({ skill: s.id, frame: this.player.index, target, damage: s.balance.damage });
      }
    }
    update(ms, targets = this.targets) {
      if (!Number.isFinite(ms) || ms < 0) return;
      this.time += ms; this.targets = targets; this.player.advance(ms); this.checkHits();
    }
    move(dx, dy) {
      if (this.hp <= 0 || this.state === 'hurt' || this.skill?.lockMovement) return false;
      this.x += dx; this.y += dy;
      if (dx) this.face = dx < 0 ? -1 : 1;
      if (!this.skill) {
        const next = dx || dy ? 'walk' : 'idle';
        if (this.player.clip?.id !== next && !this.player.play(next)) this.blocked = next + ' 모션 미검수';
        this.state = next;
      }
      return true;
    }
    get phase() {
      if (!this.skill) return this.state;
      const f = this.player.index, active = this.skill.activeFrames;
      if (f < Math.min(...active)) return 'windup';
      return f <= Math.max(...active) ? 'active' : 'recovery';
    }
    damage(amount) {
      if (this.hp <= 0 || !Number.isFinite(amount) || amount <= 0) return;
      this.hp = Math.max(0, this.hp - amount); this.skill = null;
      this.hitsByTarget = new Map(); this.state = this.hp ? 'hurt' : 'death';
      if (!this.player.play(this.state)) {
        this.player.clip = null;
        this.blocked = this.state + ' 모션이 없거나 미검수 상태';
      }
    }
  }
  root.ReferenceCombat = { ReferenceCombatant };
  if (typeof module !== 'undefined') module.exports = root.ReferenceCombat;
})(typeof globalThis !== 'undefined' ? globalThis : window);
