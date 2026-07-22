/* EasyAnkiCards — service worker (v6.5.1).
 *
 * ESTRATÉGIA: "rede primeiro, cache como reserva" para os arquivos do
 * app. Antes era o contrário (cache primeiro), o que fazia versões novas
 * só aparecerem depois de fechar e reabrir o aplicativo várias vezes.
 * Agora, havendo internet, o usuário SEMPRE recebe a versão mais recente;
 * sem internet, o app continua funcionando com a cópia guardada.
 *
 * As bibliotecas externas (sql.js/JSZip) seguem "cache primeiro", pois
 * têm versão fixa na URL e são pesadas.
 */
const CACHE = "easyankicards-v7.8.1";
const SHELL = [
  "./", "index.html", "app.js", "parser.js", "anki.js", "i18n.js",
  "manifest.webmanifest", "icon-192.png", "icon-512.png",
  "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/sql-wasm.js",
  "https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/sql-wasm.wasm"
];

/* NÃO assume o controle sozinho: fica "esperando" e a página avisa o
 * usuário que há atualização. Ele decide a hora de aplicar (evita
 * recarregar a tela no meio de uma edição). */
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
});

/* A página pede a troca quando o usuário clica em "Atualizar agora". */
self.addEventListener("message", (e) => {
  if (e.data === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) =>
    Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
  ).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const externo = !req.url.startsWith(self.location.origin);

  if (externo) {                    // bibliotecas de CDN: cache primeiro
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((resp) => {
      const cp = resp.clone();
      caches.open(CACHE).then((c) => c.put(req, cp));
      return resp;
    })));
    return;
  }

  // arquivos do app: rede primeiro (atualiza sozinho), cache como reserva
  e.respondWith(
    fetch(req).then((resp) => {
      const cp = resp.clone();
      caches.open(CACHE).then((c) => c.put(req, cp));
      return resp;
    }).catch(() => caches.match(req, { ignoreSearch: true })
      .then((hit) => hit || caches.match("index.html")))
  );
});
