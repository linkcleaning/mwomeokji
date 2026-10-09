/* 오늘 뭐먹지? - 서비스 워커 (index.html과 같은 폴더에 두세요) */
const CACHE = 'mwomeokji-v9';
const APP_SHELL = ['./', './index.html', './bap.m4a'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  // 오디오 부분 요청(Range)은 브라우저에 맡김 (아이폰 재생 오류 방지)
  if (req.headers.has('range')) return;
  const url = new URL(req.url);

  // 페이지 이동: 네트워크 우선, 실패 시 캐시 (최신 버전 우선 반영)
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(res => { caches.open(CACHE).then(c => c.put('./index.html', res.clone())); return res; })
        .catch(() => caches.match('./index.html').then(r => r || caches.match('./')))
    );
    return;
  }

  // 지도 링크 등 외부 이동은 건드리지 않음 / CDN(Tailwind, Lucide, 폰트)은 캐시 후 백그라운드 갱신
  const cacheable = url.origin === location.origin ||
    /(cdn\.tailwindcss\.com|unpkg\.com|cdn\.jsdelivr\.net|fonts\.googleapis\.com|fonts\.gstatic\.com)$/.test(url.hostname);
  if (!cacheable) return;

  event.respondWith(
    caches.match(req).then(cached => {
      const network = fetch(req).then(res => {
        if (res && (res.ok || res.type === 'opaque')) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
