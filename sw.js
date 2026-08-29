// FOC 2026 — Service Worker (auto-version)
// ⚠ La constante BUILD est mise à jour automatiquement par deploy.sh
//   (ou manuellement avec n'importe quelle valeur qui change à chaque déploiement).
// Pour forcer une MAJ : modifier cette ligne et redéployer.
const BUILD = '2026-08-29T12:06:42Z-8fef7f8';
const CACHE_NAME = 'foc2026-' + BUILD;

const CORE_FILES_TO_CACHE = [
  './index.html',
  './entry.html',
  './404.html',
  './judge.html',
  './live.html',
  './classement.html',
  './tk9delta.html',
  './speaker.html',
  './history.html',
  './errors.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

const OPTIONAL_FILES_TO_CACHE = [
  'https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap'
];

self.addEventListener('install', function(event) {
  event.waitUntil(
    (async function() {
      var cache = await caches.open(CACHE_NAME);
      await Promise.allSettled(CORE_FILES_TO_CACHE.map(function(file) {
        return cache.add(file).catch(function(e) {
          console.warn('SW cache skip:', file, e && e.message);
        });
      }));
      await Promise.allSettled(OPTIONAL_FILES_TO_CACHE.map(function(file) {
        return cache.add(file).catch(function() {});
      }));
    })()
  );
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  event.waitUntil((async function() {
    // Supprimer tous les anciens caches
    var keys = await caches.keys();
    await Promise.all(
      keys.filter(function(k) { return k !== CACHE_NAME; })
          .map(function(k) { return caches.delete(k); })
    );
    await self.clients.claim();
    // ★ NOUVEAU : notifier les clients qu'une nouvelle version est active
    //   Le client peut décider de recharger automatiquement.
    var clients = await self.clients.matchAll({ type: 'window' });
    clients.forEach(function(client){
      client.postMessage({ type: 'SW_UPDATED', build: BUILD });
    });
  })());
});

self.addEventListener('fetch', function(event) {
  if (event.request.method !== 'GET') return;

  var url = event.request.url;
  if (url.includes('firebasedatabase.app') ||
      url.includes('firebase.googleapis.com') ||
      url.includes('firebaseio.com') ||
      url.includes('gstatic.com') ||
      url.includes('api.jsonbin.io') ||
      url.includes('api.qrserver.com') ||
      url.includes('fonts.googleapis.com') ||
      url.includes('fonts.gstatic.com')) {
    return;
  }

  event.respondWith((async function() {
    try {
      var response = await fetch(event.request, { cache: 'no-store' });
      if (response && response.status === 200 &&
          (response.type === 'basic' || response.type === 'cors')) {
        var cache = await caches.open(CACHE_NAME);
        cache.put(event.request, response.clone());
      }
      if (response && response.status === 404) {
        var cached404 = await caches.match(event.request);
        if (cached404) return cached404;
      }
      return response;
    } catch (err) {
      var cached = await caches.match(event.request);
      if (cached) return cached;
      var isDocument = event.request.mode === 'navigate' ||
                       event.request.destination === 'document';
      if (isDocument) {
        var cached404page = await caches.match('./404.html');
        if (cached404page) return cached404page;
      }
      throw err;
    }
  })());
});

self.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  // ★ NOUVEAU : permet au client de demander la version active
  if (event.data && event.data.type === 'GET_BUILD') {
    event.ports[0] && event.ports[0].postMessage({ build: BUILD });
  }
});
