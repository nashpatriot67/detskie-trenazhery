/* Offline written practice for the four trainer entry points.
 * Audio is deliberately not downloaded or cached here: it stays on demand.
 * Update this core list and VERSION when application entry points change.
 */
'use strict';

const VERSION = 'stage1-08cb8dae8709';
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
  "kubiki/",
  "kubiki/index.html",
  "kubiki/manifest.webmanifest",
  "kubiki/offline.html",
  "kubiki/style.css?v=s1-b6e26f0668b2",
  "place-value.css?v=s1-6ab4b3290d60",
  "place-value-activities.css?v=s1-e1e9e551c71f",
  "math-range.js?v=s1-d28d7a297b9a",
  "learning-progress.js?v=s1-b6ebfd2bf2d3",
  "kubiki/course.js?v=s1-c13d0497e759",
  "kubiki/engine.js?v=s1-18fc3d8be232",
  "kubiki/voice-manifest.js?v=s1-ce17c4f55cbb",
  "kubiki/recorded-voice.js?v=s1-cd5f60cad10d",
  "place-value.js?v=s1-8e9b59c8d08e",
  "place-value-motion.js?v=s1-07576297e173",
  "place-value-activities.js?v=s1-b302ff223496",
  "offline-bundle.js?v=s1-2021a0866611",
  "kubiki/app.js?v=s1-b3c3e0600a04",
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
  "bricks/app.js?v=s1-b81f22ff9c0b",
  "slovograd/",
  "slovograd/index.html",
  "slovograd/manifest.webmanifest",
  "slovograd/offline.html",
  "slovograd/style.css?v=s1-aff916e7d01d",
  "slovograd/lessons.css?v=s1-cf8dfdddcf6f",
  "slovograd/words.js?v=s1-e8c9aaefe784",
  "slovograd/sentences.js?v=s1-c6736c612a85",
  "slovograd/creative.js?v=s1-8c71d0de8764",
  "slovograd/illustrations.js?v=s1-e56a7b081a26",
  "slovograd/core.js?v=s1-4195576fdc0b",
  "slovograd/voice-manifest.js?v=s1-ff68124600ea",
  "slovograd/recorded-voice.js?v=s1-cd5f60cad10d",
  "slovograd/voice.js?v=s1-3010a8c6bfdf",
  "slovograd/lessons.js?v=s1-83190b3e0a89",
  "slovograd/app.js?v=s1-fb00cb08fb6f",
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

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || request.headers.get('range')) return;
  let url;
  try { url = new URL(request.url); } catch (_) { return; }
  if (url.origin !== ROOT.origin || url.pathname.indexOf(ROOT.pathname) !== 0) return;
  if (url.pathname.indexOf('/audio/') !== -1 || /\.mp3$/i.test(url.pathname)) return;
  if (owns(CORE_KEYS, url.pathname)) {
    // Stable keys prevent tracking/cache-busting queries from growing storage.
    event.respondWith(networkFirst(request, CORE_KEYS[url.pathname]));
  } else if (request.mode === 'navigate') {
    // Unknown pages keep their normal online/404 behaviour. Offline they show
    // a small explanation rather than the HTML of a different trainer.
    event.respondWith(fetch(request).catch(() => offlinePage()));
  }
});
