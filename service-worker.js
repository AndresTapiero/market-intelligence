// Cache strategy: Network-first con fallback a cache
// Esto asegura que siempre se busque la ultima version del reporte (que se
// regenera mensualmente), y solo se sirve el cache cuando no hay red.
// IMPORTANTE: sube este numero cada vez que la lista de abajo cambie —
// un CACHE_NAME distinto fuerza a borrar el cache viejo en 'activate'.
const CACHE_NAME = 'market-intel-cache-v2';
const urlsToCache = [
  './latest-report.html',
  './manifest.json',
  // CSS
  './css/tokens.css',
  './css/base.css',
  './css/layout.css',
  './css/components.css',
  './css/features.css',
  // Tabs
  './tabs/resumen.html',
  './tabs/activos.html',
  './tabs/transacciones.html',
  './tabs/analisis.html',
  // JS (new classic scripts)
  './js/data.js',
  './js/cash.js',
  './js/portfolio-ui.js',
  './js/sell-modal.js',
  './js/sell-history.js',
  './js/tab-loader.js',
  './js/ui-utils.js',
  // JS (existing modules)
  './js/app.js',
  './js/auth-service.js',
  './js/config.js',
  './js/portfolio-service.js',
  './js/portfolio-history-service.js',
  './js/transaction-service.js',
  './js/ui-manager.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(urlsToCache).catch(err => {
        console.log('Cache addAll error (algunos recursos pueden no estar disponibles):', err);
        return Promise.resolve();
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) return caches.delete(cacheName);
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  if (!request.url.startsWith('http')) return;

  event.respondWith(
    fetch(request)
      .then(response => {
        if (response.status === 200 && response.type !== 'error') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(request, responseToCache).catch(err => {
              console.log('Cache put error:', err);
            });
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(request).then(cached => {
          if (cached) return cached;
          if (request.mode === 'navigate') return caches.match('./latest-report.html');
          return new Response('Offline - recurso no disponible', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: new Headers({ 'Content-Type': 'text/plain' })
          });
        });
      })
  );
});
