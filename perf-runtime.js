'use strict';
// Bounded scenery caches: source images stay unmodified; combat coordinates stay fixed.
const GameAssets = (() => {
  const images = new Map(), tiles = new Map(), sprites = new Map(), frames = new Map();
  const pixels = new Map(), ids = new WeakMap();
  let nextId = 0;
  function prime(im) {
    if (pixels.has(im) || im.naturalWidth * im.naturalHeight <= 4 * 1024 * 1024) return;
    const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(im, 0, 0);
    // Force materialization during the loading screen, then retain the CPU raster.
    g.getImageData(0, 0, c.width, c.height);
    pixels.set(im, c);
  }
  let revision = 0;
  const groups = new Map();
  let loading = false, generation = 0, stageIndex = -1, stageReady = Promise.resolve();
  function group(stage, sources, prepare = () => {}) {
    const list = sources.map(() => new Image());
    const decoders = list.map(im => im.decode.bind(im));
    let promise;
    const load = () => {
      if (!promise) {
        list.forEach((im, i) => { im.decoding = 'async'; im.src = sources[i]; });
        promise = Promise.all(decoders.map(decode => decode())).then(prepare);
        promise.catch(() => {});
      }
      return promise;
    };
    list.forEach(im => { im.decode = () => load(); });
    if (!groups.has(stage)) groups.set(stage, []);
    groups.get(stage).push(load);
    load.images = list;
    return { images: list, ready: { then: (yes, no) => load().then(yes, no), catch: no => load().catch(no) } };
  }
  function prepareStage(index) {
    if (stageIndex === index && (loading || (FLOOR_IMAGES[index]?.naturalWidth &&
      ['field'+(index+1),'boss'+(index+1),'phase'+(index+1)].filter(key=>Object.hasOwn(RELEASE_IMAGES,key)).every(key=>RELEASE_IMAGES[key].naturalWidth)))) return stageReady;
    stageIndex = index;
    const retained = new Set([NAMED_ATLAS, ...(groups.get(index) || []).flatMap(load => load.images)]);
    for (const im of pixels.keys()) if (!retained.has(im)) { const old=pixels.get(im); old.width=old.height=0; pixels.delete(im); }
    const token = ++generation; loading = true;
    const jobs = (groups.get(index) || []).map(load => load().then(() => {
      if (token === generation) for (const im of load.images) prime(im);
    }));
    jobs.push(NAMED_ATLAS.decode().then(() => { if(token === generation) prime(NAMED_ATLAS); }));
    const floor = FLOOR_IMAGES[index], art = FLOOR_ART[index], n = index + 1;
    jobs.push(floor.decode().then(() => {
      const [x, y, w, h] = art.crop, height = Math.ceil(OY + VH - FL_TOP) + 1;
      tile(floor, x, y, w, h, w / h * height, height);
    }));
    for (const key of ['field' + n, 'boss' + n, 'phase' + n]) if (Object.hasOwn(RELEASE_IMAGES, key)) {
      const im = RELEASE_IMAGES[key];
      jobs.push(im.decode().then(() => {
        const scale = Math.max(W / im.naturalWidth, (HORIZON + 4) / im.naturalHeight);
        tile(im, 0, 0, im.naturalWidth, im.naturalHeight, im.naturalWidth * scale, im.naturalHeight * scale);
      }));
    }
    document.getElementById('assetLoading').hidden = false;
    stageReady = Promise.allSettled(jobs).then(() => {
      if (token !== generation) return;
      loading = false; revision++;
      document.getElementById('assetLoading').hidden = true;
      dispatchEvent(new Event('bmk-assets-ready'));
    });
    return stageReady;
  }
  function image(src) {
    let im = images.get(src);
    if (im) { images.delete(src); images.set(src, im); return im; }
    im = new Image(); im.decoding = 'async';
    im.addEventListener('load', () => { revision++; });
    im.src = src; images.set(src, im);
    if (images.size > 8) images.delete(images.keys().next().value);
    return im;
  }
  function lazy(sources) {
    const result = Array.isArray(sources) ? new Array(sources.length) : {};
    for (const [key, src] of Object.entries(sources)) {
      let override;
      Object.defineProperty(result, key, {
        enumerable: true, get: () => override === undefined ? image(src) : override,
        set: value => { override = value; }
      });
    }
    return result;
  }
  function tile(im, sx, sy, sw, sh, width, height, smoothing = false, pool = tiles, limit = 8) {
    if (!(im?.naturalWidth || im?.width)) return null;
    const w = Math.ceil(width), h = Math.ceil(height);
    if (!ids.has(im)) ids.set(im, ++nextId);
    const key = [ids.get(im), sx, sy, sw, sh, w, h, smoothing].join('|');
    let canvas = pool.get(key);
    if (canvas) { pool.delete(key); pool.set(key, canvas); return canvas; }
    canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
    // Crop/resize on a CPU canvas so the first tiny sprite does not upload its
    // entire multi-megapixel atlas to the GPU in the middle of a fight.
    const c = canvas.getContext('2d', { willReadFrequently: true }); c.imageSmoothingEnabled = smoothing;
    c.imageSmoothingQuality = 'high';
    const source = pixels.get(im);
    c.drawImage(source || im, sx, sy, sw, sh, 0, 0, w, h);
    c.getImageData(0, 0, 1, 1);
    pool.set(key, canvas);
    pool.bytes = (pool.bytes || 0) + w * h * 4;
    while (pool.size > 1 && (pool.size > limit || pool.bytes > 24 * 1024 * 1024)) {
      const first = pool.keys().next().value, old = pool.get(first);
      pool.bytes -= old.width * old.height * 4; pool.delete(first); old.width = old.height = 0;
    }
    return canvas;
  }
  return { lazy, tile, group, prepareStage, get loading() { return loading; }, get stageReady() { return stageReady; },
    sprite: (im, x, y, w, h, dw, dh) => tile(im, x, y, w, h, dw, dh, true, sprites, 48),
    frame: (im, x, y, w, h) => tile(im, x, y, w, h, w, h, false, frames, 96),
    get revision() { return revision; },
    get cacheSize() { return { images: images.size, tiles: tiles.size, sprites: sprites.size, frames: frames.size,
      bytes: (tiles.bytes || 0) + (sprites.bytes || 0) + (frames.bytes || 0),
      sourceBytes: [...pixels.values()].reduce((n, canvas) => n + canvas.width * canvas.height * 4, 0) }; } };
})();

// A fixed-size rolling window avoids accumulating telemetry during long sessions.
const GamePerf = (() => {
  const samples = [], capacity = 180;
  let previous = 0, nextRefresh = 0, draws = 0, panel;
  function record(t, updateMs, renderMs) {
    draws++;
    if (previous) {
      if (samples.length === capacity) samples.shift();
      samples.push({ frame: t - previous, update: updateMs, render: renderMs });
    }
    previous = t;
    if (UX.options.perf && t >= nextRefresh) {
      nextRefresh = t + 500;
      panel ||= document.getElementById('performanceStats');
      const s = snapshot();
      panel.textContent = ['pause','settings','tutorial','clear','over','ending'].includes(scene)
        ? `대기 중 · 화면 갱신 중지 · ${cv.width}×${cv.height}`
        : `${s.fps} FPS · 프레임 p95 ${s.p95}ms · 연산 ${s.update}ms · 그리기 ${s.render}ms · ${cv.width}×${cv.height}`;
    }
  }
  function snapshot() {
    const mean = key => samples.length ? samples.reduce((s, v) => s + v[key], 0) / samples.length : 0;
    const sorted = samples.map(s => s.frame).sort((a, b) => a - b);
    return { fps: Math.round(1000 / (mean('frame') || 1000)), p95: +(sorted[Math.floor(sorted.length * .95)] || 0).toFixed(1),
      update: +mean('update').toFixed(2), render: +mean('render').toFixed(2),
      samples: samples.length, draws, stage: stageIdx + 1, scene, scale: RENDER_K,
      cache: GameAssets.cacheSize };
  }
  return { record, snapshot, reset() { samples.length = 0; previous = 0; } };
})();
globalThis.BMK_PERF = GamePerf;
