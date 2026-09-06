// Service worker de Gallo POS — solo cachea la "cáscara" visual (el HTML/CSS/JS de la
// app y los íconos) para que abra al instante y hasta sin internet se vea. Las llamadas
// a /api/* y la conexión en vivo (WebSocket) SIEMPRE van directo al servidor, nunca se
// cachean, porque los datos de ventas tienen que estar siempre frescos.

const CACHE_NAME = "gallo-pos-shell-v1";
const SHELL_FILES = ["/", "/manifest.json", "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Nunca cachear la API ni nada que no sea GET — siempre a la red.
  if (url.pathname.startsWith("/api/") || event.request.method !== "GET") {
    return;
  }

  // Las mesas del cliente (/mesa/xxx) tampoco se cachean: cada una sirve el mismo
  // index.html pero el contenido depende de la mesa, mejor siempre fresco.
  if (url.pathname.startsWith("/mesa/")) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networkFetch = fetch(event.request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || networkFetch;
    })
  );
});
