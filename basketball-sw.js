const CACHE_PREFIX = 'courtcall-';
const CACHE_VERSION = 'v52';
const CACHE = `${CACHE_PREFIX}${CACHE_VERSION}`;
const RUNTIME_CACHE = `${CACHE_PREFIX}runtime-${CACHE_VERSION}`;
const NAVIGATION_TIMEOUT_MS = 4000;
const RUNTIME_MAX_ENTRIES = 48;
const SHELL = [
  './',
  './courtcall-design-system.css',
  './courtcall-core-game.css',
  './courtcall-team-history.css',
  './courtcall-motion-foundation.css',
  './courtcall-cinematic.css?v=20260814b',
  './courtcall-global-visual-system.css?v=20260814b',
  './courtcall-tournaments.css',
  './courtcall-supporting-product.css?v=20260822',
  './courtcall-auth.css?v=20260822',
  './basketball-supa.js',
  './courtcall-core.js',
  './courtcall-communities.js?v=20260821',
  './courtcall-notifications.js',
  './courtcall-cloud-state.js',
  './courtcall-supporting-product.js?v=20260822',
  './courtcall-auth.js?v=20260822',
  './courtcall-motion-foundation.js',
  './courtcall-cinematic.js?v=20260814b',
  './courtcall-global-visual-system.js?v=20260814b',
  './basketball.manifest.json',
  './icons/basketball-3d.webp',
  './assets/cinematic/courtcall-master.webp',
  './assets/cinematic/courtcall-master-mobile.webp',
  './assets/cinematic/01-empty-court-poster.webp',
  './assets/cinematic/01-empty-court-mobile.webp',
  './assets/cinematic/02-tip-off-poster.webp',
  './assets/cinematic/02-tip-off-mobile.webp',
  './assets/cinematic/03-the-run-poster.webp',
  './assets/cinematic/03-the-run-mobile.webp',
  './assets/cinematic/04-clutch-moment-poster.webp',
  './assets/cinematic/04-clutch-moment-mobile.webp',
  './assets/cinematic/05-victory-poster.webp',
  './assets/cinematic/05-victory-mobile.webp',
];

function isHtmlResponse(response) {
  return (response.headers.get('content-type') || '').toLowerCase().includes('text/html');
}

async function precacheShell() {
  const cache = await caches.open(CACHE);
  try {
    await Promise.all(SHELL.map(async asset => {
      const response = await fetch(asset, { cache: 'reload' });
      if (!response.ok || (asset !== './' && isHtmlResponse(response))) {
        throw new Error(`Invalid app-shell response for ${asset}`);
      }
      await cache.put(asset, response);
    }));
  } catch (error) {
    await caches.delete(CACHE);
    throw error;
  }
}

self.addEventListener('install', event => {
  event.waitUntil(precacheShell());
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE && key !== RUNTIME_CACHE).map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

async function fetchWithTimeout(request, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(request, { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function navigationResponse(request) {
  const cache = await caches.open(CACHE);
  try {
    return await fetchWithTimeout(request, NAVIGATION_TIMEOUT_MS);
  } catch {
    return (await cache.match('./'))
      || new Response('CourtCall is unavailable offline until its first successful load.', {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      });
  }
}

function isUsefulRuntimeAsset(request) {
  return ['script', 'style', 'image', 'font', 'manifest'].includes(request.destination);
}

function isCacheableRuntimeResponse(response) {
  return response.ok && response.type === 'basic' && !isHtmlResponse(response);
}

async function putRuntimeResponse(request, response) {
  const cache = await caches.open(RUNTIME_CACHE);
  // Refresh insertion order so trimming approximates least-recently-updated eviction.
  await cache.delete(request);
  await cache.put(request, response);
  const keys = await cache.keys();
  const overflow = keys.length - RUNTIME_MAX_ENTRIES;
  if (overflow > 0) {
    await Promise.all(keys.slice(0, overflow).map(key => cache.delete(key)));
  }
}

async function staleWhileRevalidate(request, event) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);
  const network = fetch(request).then(async response => {
    if (isCacheableRuntimeResponse(response)) {
      try {
        await putRuntimeResponse(request, response.clone());
      } catch {
        // A cache write failure must never prevent the live response from loading.
      }
    }
    return response;
  }).catch(() => null);
  if (cached) {
    event.waitUntil(network);
    return cached;
  }
  return (await network) || new Response('', { status: 504, statusText: 'Offline' });
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || request.headers.has('range')) return;
  const url = new URL(request.url);

  if (url.origin === self.location.origin) {
    if (request.mode === 'navigate') {
      event.respondWith(navigationResponse(request));
    } else if (isUsefulRuntimeAsset(request)) {
      event.respondWith(staleWhileRevalidate(request, event));
    }
    return;
  }
});
