// FOC 2026 — Service Worker v3
// Cache tous les fichiers pour mode hors-ligne

const CACHE_NAME = 'foc2026-v14';
const CORE_FILES_TO_CACHE = [
  './index.html',
  './entry.html',
  './404.html',
  './judge.html',
  './live.html',
  './classement.html',
  './tk9delta.html',
  './speaker.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

const OPTIONAL_FILES_TO_CACHE = [
  'https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/9.23.0/firebase-database-compat.js',
  'https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap'
];

self.addEventListener('install', function(event) {
  event.waitUntil(
    (async function() {
      var cache = await caches.open(CACHE_NAME);
      var allFiles = CORE_FILES_TO_CACHE.concat(OPTIONAL_FILES_TO_CACHE);
      var results = await Promise.allSettled(allFiles.map(function(file) {
        return cache.add(file);
      }));

      results.forEach(function(result, idx) {
        if (result.status !== 'fulfilled') {
          console.warn('SW cache manquant:', allFiles[idx], result.reason);
        }
      });
    })()
  );
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE_NAME; })
            .map(function(k) { return caches.delete(k); })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function(event) {
  if (event.request.method !== 'GET') return;

  // Firebase Realtime Database — toujours en ligne
  if (event.request.url.includes('firebasedatabase.app') ||
      event.request.url.includes('firebase.googleapis.com')) {
    return;
  }

  var isDocument = event.request.mode === 'navigate' || event.request.destination === 'document';

  event.respondWith((async function(){
    try {
      var response = await fetch(event.request, { cache: 'no-store' });
      if (response && response.status === 200 && (response.type === 'basic' || response.type === 'cors')) {
        var cache = await caches.open(CACHE_NAME);
        cache.put(event.request, response.clone());
      }
      return response;
    } catch (err) {
      var cached = await caches.match(event.request);
      if (cached) return cached;
      if (isDocument) {
        return (await caches.match('./index.html')) || (await caches.match('./entry.html')) || (await caches.match('./404.html'));
      }
      throw err;
    }
  })());
});

self.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
