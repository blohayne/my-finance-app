// sw.js — Service Worker do MyFinanceApp
//
// ATENÇÃO AO PUBLICAR UMA NOVA VERSÃO:
// troque o valor de CACHE_VERSION abaixo (ex: 'v1' -> 'v2') a cada deploy.
// É essa mudança que faz o navegador perceber que o sw.js é diferente do
// que já estava instalado no celular do usuário e disparar o fluxo de
// atualização (banner "Nova versão disponível" no app).
const CACHE_VERSION = 'v1';
const CACHE_NAME = `myfinance-cache-${CACHE_VERSION}`;

const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './storage.js',
  './manifest.json',
  './icon-512.png',
];

// Instala a nova versão e já guarda os arquivos no cache, mas ainda não
// assume o controle da página (fica "esperando" — self.skipWaiting() só
// é chamado quando o usuário confirma a atualização no app.js).
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

// Quando essa versão assume o controle, apaga caches de versões antigas.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// Mensagem enviada pelo app.js quando o usuário toca em "Atualizar" no
// banner — força essa versão (que estava "esperando") a assumir agora.
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
});

// Estratégia network-first: sempre tenta buscar a versão mais nova na
// rede primeiro (assim o app raramente fica "preso" no cache enquanto
// online); só usa o cache como fallback se estiver offline.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});