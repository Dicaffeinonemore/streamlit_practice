'use strict';
// Native Image objects, with deferred sources. Shared art stays resident; stage
// art is decoded only while its stage is active. No gameplay time passes loading.
const GAME_ASSETS = (() => {
  const records = [], active = new Set(['common', 'title']);
  const srcProperty = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
  let generation = 0, currentStage = null;
  const api = {loading: true, error: null};
  const panel = document.createElement('div');
  panel.id = 'assetLoading';
  panel.setAttribute('role', 'status');
  panel.style.cssText = 'position:fixed;inset:0;z-index:1000;background:#0b0b14ee;color:white;display:grid;place-content:center;text-align:center;font:16px sans-serif';
  document.body.append(panel);
  function status(message, retry = false) {
    panel.replaceChildren(document.createTextNode(message));
    panel.hidden = false;
    panel.style.display = 'grid';
    if (retry) {
      const button = document.createElement('button');
      button.textContent = '다시 불러오기';
      button.onclick = () => api.enterStage(currentStage);
      panel.append(button);
    }
  }
  status('게임 준비 중…');
  function load(r) {
    if (!r.url) return Promise.resolve();
    if (r.pending) return r.pending;
    r.pending = new Promise((resolve, reject) => {
      const timer = setTimeout(() => finish(new Error('Image loading timed out')), 30000);
      const ok = () => finish();
      const fail = () => finish(new Error('Image could not be loaded'));
      function finish(error) {
        clearTimeout(timer);
        r.image.removeEventListener('load', ok);
        r.image.removeEventListener('error', fail);
        r.cancel = null;
        if (error) { r.pending = null; reject(error); }
        else resolve();
      }
      r.image.addEventListener('load', ok);
      r.image.addEventListener('error', fail);
      r.cancel = () => finish(new Error('Stage changed'));
      srcProperty.set.call(r.image, r.url);
    });
    // A stage can leave before its load completes; failures remain retryable.
    r.pending.catch(() => {});
    return r.pending;
  }
  api.image = (group = 'common') => {
    const image = new Image(), r = {image, group, url: '', pending: null};
    records.push(r);
    Object.defineProperty(image, 'src', {
      get: () => r.url,
      set: value => {
        r.url = value;
        r.group = globalThis.GAME_ASSET_GROUPS?.[value] || group;
      }
    });
    // Existing boss READY promises must not force future-stage downloads.
    image.decode = () => Promise.resolve();
    return image;
  };
  api.enterStage = async stage => {
    currentStage = stage;
    const token = ++generation;
    api.loading = true; api.error = null;
    status(stage === null || stage === 'opening' ? '게임 준비 중…' : `${stage + 1} 스테이지 준비 중…`);
    active.clear(); active.add('common');
    active.add(stage === null ? 'title' : stage === 'opening' ? 'opening' : `stage${stage}`);
    // The title's idle scene uses the first stage's field and floor.
    if (stage === null || stage === 0) active.add('first-scene');
    for (const r of records) if (!active.has(r.group)) {
      r.cancel?.();
      r.image.removeAttribute('src');
      r.pending = null;
    }
    try {
      // Sequential decoding avoids a large transient memory spike on iOS.
      for (const r of records) {
        if (token !== generation) return;
        if (active.has(r.group)) await load(r);
      }
      if (token !== generation) return;
      api.loading = false;
      panel.hidden = true; panel.style.display = 'none';
    } catch (error) {
      if (token !== generation) return;
      api.error = error.message;
      status('이미지를 불러오지 못했습니다. 연결을 확인해 주세요.', true);
    }
  };
  api.stats = () => ({
    active: [...active], loading: api.loading, error: api.error,
    images: records.filter(r => r.image.naturalWidth).map(r => ({
      group: r.group, bytes: r.image.naturalWidth * r.image.naturalHeight * 4
    }))
  });
  return api;
})();
globalThis.GAME_ASSETS = GAME_ASSETS;
