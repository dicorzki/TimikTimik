/**
 * RunPlan — Service Worker
 * ============================================================
 * Strategy:
 * - Shell (HTML/CSS/JS/fonts) → Cache First
 * - Supabase API calls → Network First (always fresh)
 * - races_data.json → Stale While Revalidate
 * ============================================================
 */

const CACHE_NAME = 'runplan-v2';
const STATIC_SHELL = [
  '/',
  '/index.html',
  '/auth.html',
  '/generator.html',
  '/kalender.html',
  '/style.css',
  '/supabase_config.js',
  '/integration_patch.js',
  '/manifest.json',
  'https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800;900&family=Inter:wght@300;400;500;600&display=swap',
];

// ── INSTALL — cache shell ──────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // Gunakan individual fetch agar satu file gagal tidak block semuanya
      return Promise.allSettled(
        STATIC_SHELL.map(url =>
          cache.add(url).catch(err => console.warn(`SW: skip cache ${url}`, err))
        )
      );
    }).then(() => self.skipWaiting())
  );
});

// ── ACTIVATE — hapus cache lama ────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── FETCH — routing strategy ───────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. Supabase API → Network First, no cache
  if (url.hostname.includes('supabase.co')) {
    event.respondWith(
      fetch(request).catch(() =>
        new Response(JSON.stringify({ error: 'offline' }), {
          headers: { 'Content-Type': 'application/json' }
        })
      )
    );
    return;
  }

  // 2. races_data.json → Stale While Revalidate
  if (url.pathname.endsWith('races_data.json')) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // 3. Google Fonts → Cache First (fonts tidak berubah)
  if (url.hostname.includes('fonts.gstatic.com') || url.hostname.includes('fonts.googleapis.com')) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // 4. CDN (Supabase JS, Cloudflare) → Cache First
  if (url.hostname.includes('cdn.jsdelivr.net') || url.hostname.includes('cloudflareinsights.com')) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // 5. Navigasi (HTML) → Network First with fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          // Clone dan simpan versi terbaru ke cache
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // 6. Semua lainnya → Cache First
  event.respondWith(cacheFirst(request));
});

// ── HELPERS ────────────────────────────────────────────────
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    return new Response('Offline', { status: 503 });
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request).then(response => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  }).catch(() => null);

  return cached || fetchPromise || new Response('[]', {
    headers: { 'Content-Type': 'application/json' }
  });
}

// ── BACKGROUND SYNC (opsional — untuk sesi offline) ────────
self.addEventListener('sync', event => {
  if (event.tag === 'sync-session-logs') {
    // Data offline sync — dihandle di client via IndexedDB queue
    // untuk saat ini cukup trigger ulang dari client
    event.waitUntil(Promise.resolve());
  }
});

// ── PUSH NOTIFICATION (placeholder untuk notif reminder lari) ─
self.addEventListener('push', event => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title || 'RunPlan', {
      body: data.body || 'Waktunya lari! 🏃',
      icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🏃</text></svg>",
      badge: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🏃</text></svg>",
      tag: 'runplan-reminder',
      data: { url: data.url || '/index.html' }
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data?.url || '/index.html')
  );
});
