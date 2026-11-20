/* ============================================================
   Toddler Trials Pro — Service Worker (v5)
   Rules:
   1. Never touch non-GET requests.
   2. Never touch cross-origin requests (Google Drive / OAuth APIs).
      Their data must ALWAYS be live. The old worker cached them
      forever, keyed by URL only, so caregiver entries never showed up.
   3. App shell (HTML, manifest, this file): network-first with a short
      timeout, falling back to cache so the app still works offline.
      This also lets new deployments reach installed users.
   4. Static assets (icons, screenshots): cache-first, refreshed quietly.
   ============================================================ */
var CACHE = 'ttp-v5';
var SHELL_TIMEOUT_MS = 3500;

self.addEventListener('install', function (e) {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      return fetch('./', { cache: 'no-store' })
        .then(function (r) { if (r && r.ok) return c.put('./', r); })
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

function putInCache(req, res) {
  if (res && res.status === 200) {
    var copy = res.clone();
    caches.open(CACHE).then(function (c) { c.put(req, copy); });
  }
  return res;
}

function networkFirst(req, isNav) {
  return new Promise(function (resolve) {
    var settled = false;
    var timer = setTimeout(function () {
      // Slow network: serve the cached copy if we have one, else keep waiting.
      caches.match(req, { ignoreSearch: isNav }).then(function (c) {
        if (c && !settled) { settled = true; resolve(c); }
      });
    }, SHELL_TIMEOUT_MS);
    fetch(req).then(function (res) {
      clearTimeout(timer);
      if (settled) { putInCache(req, res); return; }
      settled = true;
      resolve(putInCache(req, res));
    }).catch(function () {
      clearTimeout(timer);
      if (settled) return;
      caches.match(req, { ignoreSearch: isNav }).then(function (c) {
        settled = true;
        resolve(c || caches.match('./') || new Response('Offline', { status: 503 }));
      });
    });
  });
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;                       // rule 1
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;        // rule 2

  var path = url.pathname;
  var isShell = req.mode === 'navigate' ||
    /\.html?$/.test(path) || /\/$/.test(path) ||
    /manifest\.webmanifest$/.test(path) || /sw\.js$/.test(path);

  if (isShell) {                                          // rule 3
    e.respondWith(networkFirst(req, req.mode === 'navigate'));
    return;
  }

  e.respondWith(                                          // rule 4
    caches.match(req).then(function (cached) {
      var net = fetch(req).then(function (res) { return putInCache(req, res); })
                          .catch(function () { return cached; });
      return cached || net;
    })
  );
});
