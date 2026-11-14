/* Offline written practice for the four trainer entry points.
 * Audio is deliberately not downloaded or cached here: it stays on demand.
 * Update this core list and VERSION when application entry points change.
 */
'use strict';

const VERSION = 'v4';
const ROOT = new URL('./', self.location.href);
const CACHE_PREFIX = 'trainers:' + ROOT.pathname + ':core:';
const CACHE_NAME = CACHE_PREFIX + VERSION;
const CORE = [
  './',
  'index.html',
  'manifest.webmanifest',
  'pwa.js?v=pwa2',
  'icons/trainers-180.png',
  'icons/trainers-192.png',
  'icons/trainers-512.png',
  'icons/trainers-maskable-512.png',
  'kubiki/',
  'kubiki/index.html',
  'kubiki/manifest.webmanifest',
  'kubiki/style.css?v=resume1',
  'kubiki/course.js?v=pwa1',
  'kubiki/engine.js?v=pwa1',
  'kubiki/voice-manifest.js?v=pwa1',
  'kubiki/recorded-voice.js?v=pwa1',
  'kubiki/app.js?v=resume1',
  'icons/kubiki-180.png',
  'icons/kubiki-192.png',
  'icons/kubiki-512.png',
  'icons/kubiki-maskable-512.png',
  'bricks/',
  'bricks/index.html',
  'bricks/manifest.webmanifest',
  'bricks/style.css?v=resume1',
  'bricks/bricks.css?v=pwa1',
  'bricks/course.js?v=pwa1',
  'bricks/engine.js?v=pwa1',
  'bricks/voice-manifest.js?v=pwa1',
  'bricks/recorded-voice.js?v=pwa1',
  'bricks/app.js?v=resume1',
  'icons/bricks-180.png',
  'icons/bricks-192.png',
  'icons/bricks-512.png',
  'icons/bricks-maskable-512.png',
  'slovograd/',
  'slovograd/index.html',
  'slovograd/manifest.webmanifest',
  'slovograd/style.css?v=resume1',
  'slovograd/lessons.css?v=pwa1',
  'slovograd/words.js?v=pwa1',
  'slovograd/sentences.js?v=pwa1',
  'slovograd/creative.js?v=pwa1',
  'slovograd/illustrations.js?v=pwa1',
  'slovograd/core.js?v=pwa1',
  'slovograd/voice-manifest.js?v=pwa1',
  'slovograd/recorded-voice.js?v=pwa1',
  'slovograd/voice.js?v=pwa1',
  'slovograd/lessons.js?v=pwa1',
  'slovograd/app.js?v=resume1',
  'icons/slovograd-180.png',
  'icons/slovograd-192.png',
  'icons/slovograd-512.png',
  'icons/slovograd-maskable-512.png'
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
