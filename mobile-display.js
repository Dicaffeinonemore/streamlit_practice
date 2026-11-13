'use strict';
// Approved profile from black-moon-mobile-layout.json (iPhone 12/13 mini).
// CSS display geometry only: the combat world remains 960 x 540.
const MOBILE_DISPLAY = (() => {
  const profile = {
    width: 812, height: 375,
    insets: { top: 0, right: 50, bottom: 21, left: 50 },
    layout: { alpha: .55, scale: 1, items: {
      stick: { dx: 0, dy: -0.004264327115892126, k: 1, hide: false },
      KeyJ: { dx: 0, dy: 0, k: 1, hide: false },
      Space: { dx: 0, dy: 0, k: 1, hide: false },
      ShiftLeft: { dx: 0, dy: 0, k: 1, hide: false },
      KeyI: { dx: 0, dy: 0, k: 1, hide: false },
      KeyK: { dx: 0, dy: 0, k: 1, hide: false },
      KeyU: { dx: 0, dy: 0, k: 1, hide: false },
      KeyH: { dx: 0, dy: 0, k: 1, hide: false },
      KeyO: { dx: 0, dy: 0, k: 1, hide: false },
      KeyP: { dx: 0, dy: 0, k: 1, hide: false },
      KeyL: { dx: 0, dy: 0, k: 1, hide: false }
    } }
  };
  const lab = new URLSearchParams(location.search).get('mobile_lab') === '1';
  function matches() {
    // Safari does not expose the iPhone model: match its logical screen class.
    // The lab manages its own insets and must remain independently adjustable.
    if (lab || !/iPhone/i.test(navigator.userAgent)) return false;
    const sides = [screen.width, screen.height].sort((a,b)=>a-b);
    return Math.abs(sides[0]-profile.height)<=1 && Math.abs(sides[1]-profile.width)<=1;
  }
  function apply() {
    // A 16:9 embedded game can be landscape while the phone itself is portrait.
    let landscape = innerWidth > innerHeight;
    if (window.top !== window) {
      try { landscape = window.top.innerWidth > window.top.innerHeight; }
      catch { landscape = screen.orientation?.type?.startsWith('landscape') ?? Math.abs(window.orientation || 0) === 90; }
    }
    const active = matches() && landscape;
    document.documentElement.classList.toggle('mini-landscape', active);
    for (const [side,value] of Object.entries(profile.insets)) {
      const key='--game-safe-'+side;
      if(active)document.documentElement.style.setProperty(key,`max(env(safe-area-inset-${side}), ${value}px)`);
      else document.documentElement.style.removeProperty(key);
    }
  }
  apply();addEventListener('resize',apply);addEventListener('pageshow',apply);
  return { profile, matches };
})();
