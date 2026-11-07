/* ============================================================
   Toddler Trials Pro — Service Worker
   Real standalone file (not embedded in the HTML) so it's served
   with a JavaScript MIME type, which modern browsers require for
   service worker registration to succeed.
   ============================================================ */
var CACHE = 'ttp-v4';
var APP_SHELL = './';

self.addEventListener('install', function (e) {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      return fetch(APP_SHELL)
        .then(function (r) { if (r && r.ok) c.put(APP_SHELL, r); })
        .catch(function () {});
    })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (k) { return k !== CACHE; })
            .map(function (k) { return caches.delete(k); })
      );
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  e.respondWith(
    caches.match(e.request).then(function (cached) {
      if (cached) return cached;
      return fetch(e.request).then(function (r) {
        if (r && r.status === 200 && e.request.method === 'GET') {
          var clone = r.clone();
          caches.open(CACHE).then(function (c) { c.put(e.request, clone); });
        }
        return r;
      }).catch(function () { return cached || new Response('Offline', { status: 503 }); });
    })
  );
});
