'use strict';
// 모바일 전체화면 + 스크롤 방지.
// Streamlit 배포 페이지에서는 게임이 iframe 안에 있어, 조작 키 밖을 잘못 끌면
// 바깥 페이지가 스크롤된다. 게임 문서 안의 터치 이동을 막고, 지원되는 브라우저
// (Android Chrome, iPad Safari 등)에서는 진짜 전체화면으로 전환한다.
// Streamlit 컴포넌트 iframe은 allow="fullscreen" 이라 iframe 안에서도 요청할 수 있다.
const MOBILE_FULLSCREEN = (() => {
  const root = document.documentElement;
  const supported = !!(document.fullscreenEnabled || document.webkitFullscreenEnabled) &&
    !!(root.requestFullscreen || root.webkitRequestFullscreen);
  const coarse = matchMedia('(pointer: coarse)');
  const active = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
  const mobile = () => coarse.matches || document.body.classList.contains('touch');

  async function enter() {
    if (!supported || active()) return;
    try {
      if (root.requestFullscreen) await root.requestFullscreen({ navigationUI: 'hide' });
      else root.webkitRequestFullscreen();
    } catch { return; }
    // Android: 가로 고정. 지원하지 않는 브라우저는 조용히 무시한다.
    try { await screen.orientation?.lock?.('landscape'); } catch {}
  }
  function exit() {
    if (!active()) return;
    try { screen.orientation?.unlock?.(); } catch {}
    (document.exitFullscreen || document.webkitExitFullscreen)?.call(document)?.catch?.(() => {});
  }
  const toggle = () => (active() ? exit() : enter());

  function sync() {
    const on = active(), show = supported && mobile();
    document.body.classList.toggle('is-fullscreen', on);
    for (const button of document.querySelectorAll('.fs-toggle')) {
      button.hidden = !show;
      if (typeof TitleMenu !== 'undefined') button.textContent = TitleMenu.text(on ? 'FULL_OFF' : 'FULL_ON');
      button.setAttribute('aria-pressed', String(on));
    }
  }

  // 모바일에서 새 게임 / 이어하기 / 보스챌린지를 누르면 자동으로 전체화면에 들어간다.
  document.addEventListener('click', e => {
    const t = e.target instanceof Element ? e.target : null;
    if (t?.closest('.fs-toggle')) { toggle(); return; }
    if (mobile() && t?.closest('#btnStart, #btnContinue, #btnBossChallenge')) enter();
  }, true);

  // 터치 이동은 실제로 스크롤 가능한 패널(설정창 등)과 슬라이더에서만 허용한다.
  function scrollable(node) {
    for (let el = node instanceof Element ? node : node?.parentElement; el && el !== document.body; el = el.parentElement) {
      if (el.matches('input, textarea, select')) return true;
      const s = getComputedStyle(el);
      if ((/(auto|scroll)/.test(s.overflowY) && el.scrollHeight > el.clientHeight + 1) ||
          (/(auto|scroll)/.test(s.overflowX) && el.scrollWidth > el.clientWidth + 1)) return true;
    }
    return false;
  }
  document.addEventListener('touchmove', e => {
    if (e.touches.length > 1 || !scrollable(e.target)) e.preventDefault();
  }, { passive: false });
  document.addEventListener('gesturestart', e => e.preventDefault()); // iOS 핀치 확대

  for (const type of ['fullscreenchange', 'webkitfullscreenchange', 'bmk-language-change']) document.addEventListener(type, sync);
  coarse.addEventListener?.('change', sync);
  addEventListener('DOMContentLoaded', sync);
  sync();
  return { supported, active, enter, exit, toggle, sync };
})();
