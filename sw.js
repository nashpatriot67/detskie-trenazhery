/* Offline practice for the four trainer entry points.
 * Only the 41 reviewed coach clips are precached. Legacy word audio stays on
 * demand. The local builder owns VERSION and CORE; partial ranges are not saved.
 */
'use strict';

const VERSION = 'stage1-5d6ee6177258';
const ROOT = new URL('./', self.location.href);
const CACHE_PREFIX = 'trainers:' + ROOT.pathname + ':core:';
const CACHE_NAME = CACHE_PREFIX + VERSION;
const CORE = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "pwa.js?v=pwa2",
  "icons/trainers-180.png",
  "icons/trainers-192.png",
  "icons/trainers-512.png",
  "icons/trainers-maskable-512.png",
  "icons/kubiki-180.png",
  "icons/kubiki-192.png",
  "icons/kubiki-512.png",
  "icons/kubiki-maskable-512.png",
  "icons/bricks-180.png",
  "icons/bricks-192.png",
  "icons/bricks-512.png",
  "icons/bricks-maskable-512.png",
  "icons/slovograd-180.png",
  "icons/slovograd-192.png",
  "icons/slovograd-512.png",
  "icons/slovograd-maskable-512.png",
  "icons/life-180.png",
  "icons/life-192.png",
  "icons/life-512.png",
  "icons/life-maskable-512.png",
  "kubiki/",
  "kubiki/index.html",
  "kubiki/manifest.webmanifest",
  "kubiki/offline.html",
  "kubiki/style.css?v=s1-b6e26f0668b2",
  "place-value.css?v=s1-da51709fa9bd",
  "place-value-activities.css?v=s1-e1e9e551c71f",
  "concepts.css?v=s1-d91965c0780c",
  "learning-journey.css?v=s1-c6c457dcb3be",
  "math-check.css?v=s1-aa1b2170257c",
  "active-breaks.css?v=s1-7de1e74797c3",
  "practice-hub.css?v=s1-7912d72021dd",
  "workspace-layout.css?v=s1-706102dc108a",
  "math-workspace.css?v=s1-eae95a6b8f24",
  "math-range.js?v=s1-d28d7a297b9a",
  "learning-progress.js?v=s1-5e68799babe3",
  "concepts.js?v=s1-a0125a7fbfbf",
  "learning-journey.js?v=s1-20263410a758",
  "study-clock.js?v=s1-34b8003284d5",
  "coach-plan.js?v=s1-76215d01f7a0",
  "coach-audio-manifest.js?v=s1-fd84bc6928ec",
  "audio-coach.js?v=s1-3f127b9878a2",
  "active-breaks.js?v=s1-15a0108c4ce2",
  "practice-hub.js?v=s1-be469c8141b5",
  "kubiki/course.js?v=s1-c13d0497e759",
  "math-journey.js?v=s1-668852334db1",
  "kubiki/engine.js?v=s1-18fc3d8be232",
  "kubiki/voice-manifest.js?v=s1-ce17c4f55cbb",
  "kubiki/recorded-voice.js?v=s1-cd5f60cad10d",
  "place-value.js?v=s1-8e9b59c8d08e",
  "place-value-motion.js?v=s1-1831f7944f9b",
  "place-value-activities.js?v=s1-d39d1f1c88f4",
  "math-check.js?v=s1-57e1e48685ea",
  "offline-bundle.js?v=s1-1c9edd500fd7",
  "workspace-layout.js?v=s1-b1f0506d1347",
  "math-workspace.js?v=s1-f4d4f092d16b",
  "kubiki/app.js?v=s1-6a73582b7fa3",
  "audio/coach/count-one.mp3?v=s1-daf6b5b95297",
  "audio/coach/count-three.mp3?v=s1-b53a44b7d6b6",
  "audio/coach/count-two.mp3?v=s1-1aae3662629f",
  "audio/coach/cross-left.mp3?v=s1-c54ddcade6db",
  "audio/coach/cross-rest.mp3?v=s1-f4984c8683ec",
  "audio/coach/cross-right.mp3?v=s1-cc5be94397fe",
  "audio/coach/hands-close.mp3?v=s1-aa793fc67966",
  "audio/coach/hands-open.mp3?v=s1-5abf531b8f50",
  "audio/coach/heel-down.mp3?v=s1-4c258510a111",
  "audio/coach/heel-up.mp3?v=s1-9a7dc17f3617",
  "audio/coach/look-far.mp3?v=s1-f7404c806320",
  "audio/coach/look-relax.mp3?v=s1-93bd44715783",
  "audio/coach/posture-open.mp3?v=s1-0676bff1f705",
  "audio/coach/posture-rest.mp3?v=s1-60f4c29c2a42",
  "audio/coach/prepare-cross.mp3?v=s1-61f4fee1db1c",
  "audio/coach/prepare-general.mp3?v=s1-ab1751db0454",
  "audio/coach/prepare-hands.mp3?v=s1-9a8ba24e4db8",
  "audio/coach/prepare-heel.mp3?v=s1-e19c86d76e2a",
  "audio/coach/prepare-look.mp3?v=s1-d6994311e189",
  "audio/coach/prepare-posture.mp3?v=s1-6a6eab5d2ebd",
  "audio/coach/prepare-shoulders.mp3?v=s1-3372de89cdc9",
  "audio/coach/prepare-side.mp3?v=s1-40efc7bba671",
  "audio/coach/prepare-squat.mp3?v=s1-392acfb339dc",
  "audio/coach/prepare-stars.mp3?v=s1-21b088df9429",
  "audio/coach/prepare-walk.mp3?v=s1-de598f3a343d",
  "audio/coach/prepare-wall.mp3?v=s1-a38d9c95e7f8",
  "audio/coach/reach-down.mp3?v=s1-2554074cc726",
  "audio/coach/reach-up.mp3?v=s1-3d46bd0641a6",
  "audio/coach/rest.mp3?v=s1-28dcaa5ce186",
  "audio/coach/shoulder-down.mp3?v=s1-b6329d831acb",
  "audio/coach/shoulder-up.mp3?v=s1-be696bc750a2",
  "audio/coach/side-back.mp3?v=s1-b97e3c952975",
  "audio/coach/side-out.mp3?v=s1-528294c9d096",
  "audio/coach/squat-down.mp3?v=s1-08b3849e0d13",
  "audio/coach/squat-up.mp3?v=s1-7a00093c0bf0",
  "audio/coach/star-down.mp3?v=s1-acda0d7fdf0e",
  "audio/coach/star-left.mp3?v=s1-85dd43eb9b11",
  "audio/coach/star-right.mp3?v=s1-3b157f04a9cc",
  "audio/coach/walk-step.mp3?v=s1-349f9f98b0a3",
  "audio/coach/wall-bend.mp3?v=s1-50dc12fc4ee8",
  "audio/coach/wall-push.mp3?v=s1-3dd5e9d80a04",
  "audio/coach/credits.txt?v=s1-bab9d0a08cdb",
  "audio/coach/license.txt?v=s1-1349a4b61484",
  "bricks/",
  "bricks/index.html",
  "bricks/manifest.webmanifest",
  "bricks/offline.html",
  "bricks/style.css?v=s1-4fa6abdcbb72",
  "bricks/bricks.css?v=s1-465fa53a5f12",
  "bricks/course.js?v=s1-3159849bc65c",
  "bricks/engine.js?v=s1-de16802683f0",
  "bricks/voice-manifest.js?v=s1-247916d9cd8c",
  "bricks/recorded-voice.js?v=s1-cd5f60cad10d",
  "bricks/app.js?v=s1-7622ac09142e",
  "slovograd/",
  "slovograd/index.html",
  "slovograd/manifest.webmanifest",
  "slovograd/offline.html",
  "slovograd/style.css?v=s1-98f226d174a6",
  "slovograd/lessons.css?v=s1-76fa78ee4e54",
  "slovograd/words.js?v=s1-e8c9aaefe784",
  "slovograd/sentences.js?v=s1-c6736c612a85",
  "slovograd/creative.js?v=s1-8c71d0de8764",
  "slovograd/illustrations.js?v=s1-e56a7b081a26",
  "slovograd/core.js?v=s1-4195576fdc0b",
  "slovograd/voice-manifest.js?v=s1-ff68124600ea",
  "slovograd/recorded-voice.js?v=s1-c4d577a898d6",
  "slovograd/voice.js?v=s1-9c8fec03c080",
  "slovograd/lessons.js?v=s1-83190b3e0a89",
  "russian-journey.js?v=s1-c959c2f907fc",
  "russian-check.js?v=s1-bdca01924780",
  "slovograd/app.js?v=s1-7b3f32a6b595",
  "life/",
  "life/index.html",
  "life/manifest.webmanifest",
  "life/offline.html",
  "object-art.css?v=s1-df2fc071683b",
  "life-quests.css?v=s1-a6ff21647fb6",
  "life/style.css?v=s1-8f3fe3b87246",
  "room-game.css?v=s1-c94708e52449",
  "room-tidy-game.css?v=s1-be5e04cd16fb",
  "life-quest-data.js?v=s1-c6a083bea7a8",
  "life-school-schedule.js?v=s1-23b2185e80b6",
  "school-packing-flow.js?v=s1-99a0f56d0ab6",
  "object-art.js?v=s1-32c0dd606655",
  "life-quests.js?v=s1-305516048b66",
  "room-progress.js?v=s1-418ff2054b2f",
  "room-tidy-data.js?v=s1-4f0f9e23eddf",
  "room-tidy-logic.js?v=s1-dab1dc1de37b",
  "room-adventure.js?v=s1-cfc692217a78",
  "room-actor.js?v=s1-cbbb5c3fe81d",
  "room-props.js?v=s1-15eda60b1cf7",
  "room-toy-art.js?v=s1-8b82eeb7d27c",
  "room-input.js?v=s1-cdee466b019e",
  "room-pool-art.js?v=s1-d7a04a596756",
  "room-game.js?v=s1-827be40aaf89",
  "room-tidy-scene.js?v=s1-347a8b7597e0",
  "room-tidy-layout.js?v=s1-4fa3ffb02643",
  "room-tidy-artwork.js?v=s1-b3ea07c3a715",
  "room-tidy-motion.js?v=s1-20a2371ab47e",
  "room-tidy-game.js?v=s1-0a93e57f138c",
  "life/app.js?v=s1-a40f74fc3182",
  "otkryt-bez-interneta.html"
];
const CORE_URLS = CORE.map(path => new URL(path, ROOT).href);
const CORE_KEYS = Object.create(null);
CORE_URLS.forEach(url => { CORE_KEYS[new URL(url).pathname] = url; });
const owns = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

self.addEventListener('install', event => {
  // Reload bypasses an older browser HTTP-cache entry. addAll is atomic: a
  // failed request leaves this worker uninstalled instead of a partial course.
  event.waitUntil(caches.open(CACHE_NAME).then(cache =>
    cache.addAll(CORE_URLS.map(url => new Request(url, { cache: 'reload' })))
  ));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(names => Promise.all(names
    .filter(name => name.indexOf(CACHE_PREFIX) === 0 && name !== CACHE_NAME)
    .map(name => caches.delete(name))
  )).then(() => self.clients.claim()));
  // No forced skipWaiting and no client reload: an open answer is left intact.
});

function saved(key) {
  return caches.open(CACHE_NAME).then(cache => cache.match(key)).catch(() => null);
}

function store(key, response) {
  // A cache quota or private-mode restriction must not prevent online practice.
  return caches.open(CACHE_NAME).then(cache => cache.put(key, response.clone())).catch(() => {});
}

function offlinePage() {
  return new Response('<!doctype html><html lang="ru"><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>Тренажёры — нет подключения</title><main style="max-width:34em;margin:12vh auto;padding:24px;font:18px/1.6 sans-serif">' +
    '<h1>Нет подключения к интернету</h1><p>Эта страница ещё не сохранена. ' +
    'Вернись к тренажёрам или открой её, когда появится интернет.</p>' +
    '<a href="' + ROOT.href + '">Открыть тренажёры</a></main></html>',
    { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

function networkFirst(request, key) {
  return fetch(request).then(response => {
    if (response.ok && response.status === 200) {
      return store(key, response).then(() => response);
    }
    // During a temporary hosting error the last complete teaching file remains
    // useful; never store an error document in place of a script or lesson.
    return saved(key).then(cached => cached || response);
  }).catch(error => saved(key).then(cached => {
    if (cached) return cached;
    if (request.mode === 'navigate') return offlinePage();
    throw error;
  }));
}

// Audio elements (especially Safari) request byte ranges even offline. Serve a
// slice of the complete, versioned coach resource without caching a 206 response.
async function coachResponse(request, key) {
  let response = await saved(key);
  if (!response) {
    response = await fetch(new Request(key, { cache: 'reload' }));
    if (!response.ok || response.status !== 200) return response;
    await store(key, response);
  }
  const range = request.headers.get('range');
  if (!range) return response;
  const bytes = await response.arrayBuffer(), length = bytes.byteLength;
  const match = /^bytes=(\d*)-(\d*)$/.exec(range);
  let start, end;
  if (match && (match[1] || match[2])) {
    if (!match[1]) { const suffix = Number(match[2]); start = Math.max(0, length - suffix); end = length - 1; if (!suffix) start = length; }
    else { start = Number(match[1]); end = match[2] ? Math.min(Number(match[2]), length - 1) : length - 1; }
  }
  const headers = new Headers(response.headers);
  headers.set('Accept-Ranges', 'bytes');
  headers.delete('Content-Encoding');
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start >= length || end < start) {
    headers.set('Content-Range', 'bytes */' + length);
    headers.set('Content-Length', '0');
    return new Response(null, { status: 416, headers });
  }
  headers.set('Content-Type', 'audio/mpeg');
  headers.set('Content-Range', 'bytes ' + start + '-' + end + '/' + length);
  headers.set('Content-Length', String(end - start + 1));
  return new Response(bytes.slice(start, end + 1), { status: 206, headers });
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  let url;
  try { url = new URL(request.url); } catch (_) { return; }
  if (url.origin !== ROOT.origin || url.pathname.indexOf(ROOT.pathname) !== 0) return;
  if (/\/audio\/coach\/[a-z0-9-]+\.mp3$/.test(url.pathname) && owns(CORE_KEYS, url.pathname)) {
    event.respondWith(coachResponse(request, CORE_KEYS[url.pathname]));
    return;
  }
  if (request.headers.get('range') || url.pathname.indexOf('/audio/') !== -1 || /\.mp3$/i.test(url.pathname)) return;
  if (owns(CORE_KEYS, url.pathname)) {
    // Stable keys prevent tracking/cache-busting queries from growing storage.
    event.respondWith(networkFirst(request, CORE_KEYS[url.pathname]));
  } else if (request.mode === 'navigate') {
    // Unknown pages keep their normal online/404 behaviour. Offline they show
    // a small explanation rather than the HTML of a different trainer.
    event.respondWith(fetch(request).catch(() => offlinePage()));
  }
});
