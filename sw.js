/* Service worker do PGO Digital: o app abre mesmo sem internet (os lançamentos ficam na fila do aparelho) */
const VERSAO = 'pgo-v8';
const ARQUIVOS = ['./', 'index.html', 'styles.css', 'config.js', 'app.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png'];
const CDNS = ['cdn.jsdelivr.net', 'unpkg.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(VERSAO).then((c) => c.addAll(ARQUIVOS.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('pgo-') && k !== VERSAO).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
function comTempo(p, ms) { return new Promise((ok, falha) => { const t = setTimeout(() => falha(new Error('timeout')), ms); p.then((r) => { clearTimeout(t); ok(r); }, (e) => { clearTimeout(t); falha(e); }); }); }
self.addEventListener('fetch', (e) => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (CDNS.includes(url.hostname)) {
    e.respondWith(caches.open(VERSAO).then(async (c) => { const hit = await c.match(req); if (hit) return hit; const r = await fetch(req); if (r.ok || r.type === 'opaque') c.put(req, r.clone()); return r; }));
    return;
  }
  // arquivos do app e o config.js do App de Compras: busca a versão nova; sem internet, usa a guardada
  if (url.origin === self.location.origin || url.pathname.endsWith('/APP-compras/config.js')) {
    e.respondWith((async () => {
      const c = await caches.open(VERSAO);
      try { const r = await comTempo(fetch(req.url, { cache: 'no-cache', credentials: url.origin === self.location.origin ? 'same-origin' : 'omit', mode: url.origin === self.location.origin ? 'same-origin' : 'no-cors' }), 5000); if (r.ok || r.type === 'opaque') c.put(req, r.clone()); return r; }
      catch (_) { return (await c.match(req, { ignoreSearch: true })) || (req.mode === 'navigate' ? c.match('index.html') : Response.error()); }
    })());
  }
});
