/* Sevu Service Worker — Offline-first with mutation queue + Background Sync */

const APP_VERSION = "sevu-v4";
const STATIC_CACHE = `${APP_VERSION}-static`;
const DYNAMIC_CACHE = `${APP_VERSION}-dynamic`;
const API_CACHE = `${APP_VERSION}-api`;
const DB_NAME = "sevu-offline-queue";
const DB_STORE = "mutations";
const SYNC_TAG = "sevu-mutation-sync";

const PRECACHE_URLS = ["/", "/app/dashboard", "/app/login", "/offline.html"];

/* ─── IndexedDB helpers (queue storage) ────────────────────────────────────── */

function openQueueDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(DB_STORE)) {
        db.createObjectStore(DB_STORE, { keyPath: "id", autoIncrement: true });
      }
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

async function enqueueRequest(entry) {
  const db = await openQueueDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, "readwrite");
    tx.objectStore(DB_STORE).add(entry);
    tx.oncomplete = resolve;
    tx.onerror = (e) => reject(e.target.error);
  });
}

async function getAllQueued() {
  const db = await openQueueDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, "readonly");
    const req = tx.objectStore(DB_STORE).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

async function deleteQueued(id) {
  const db = await openQueueDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, "readwrite");
    tx.objectStore(DB_STORE).delete(id);
    tx.oncomplete = resolve;
    tx.onerror = (e) => reject(e.target.error);
  });
}

async function getQueueCount() {
  const db = await openQueueDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, "readonly");
    const req = tx.objectStore(DB_STORE).count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

/* ─── Broadcast helpers ─────────────────────────────────────────────────────── */

async function broadcastToClients(msg) {
  const clients = await self.clients.matchAll({ type: "window" });
  clients.forEach((c) => c.postMessage(msg));
}

/* ─── Install ──────────────────────────────────────────────────────────────── */
self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) =>
      cache.addAll(PRECACHE_URLS).catch(() => {})
    )
  );
});

/* ─── Activate ─────────────────────────────────────────────────────────────── */
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (k) =>
                k !== STATIC_CACHE && k !== DYNAMIC_CACHE && k !== API_CACHE
            )
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

/* ─── Fetch ─────────────────────────────────────────────────────────────────── */
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (
    url.protocol === "chrome-extension:" ||
    url.protocol === "ws:" ||
    url.protocol === "wss:"
  )
    return;

  /* ── 1. GET /api/* — Stale-while-revalidate with API cache ── */
  if (url.pathname.startsWith("/api/") && request.method === "GET") {
    event.respondWith(
      caches.open(API_CACHE).then((cache) =>
        cache.match(request).then((cached) => {
          const networkFetch = fetch(request)
            .then((response) => {
              if (response.ok) {
                cache.put(request, response.clone());
              }
              return response;
            })
            .catch(() => null);

          return cached
            ? (networkFetch.catch(() => {}), cached)
            : networkFetch.then(
                (r) =>
                  r ||
                  new Response(
                    JSON.stringify({
                      error: "You are offline. Showing cached data.",
                    }),
                    {
                      status: 503,
                      headers: { "Content-Type": "application/json" },
                    }
                  )
              );
        })
      )
    );
    return;
  }

  /* ── 2. Mutating /api/* (POST/PUT/PATCH/DELETE) — Pass through directly ── */
  /* NOTE: Do NOT intercept these — let the browser send them straight to the
     network. Intercepting and re-fetching inside the SW breaks the Replit
     dev-proxy chain and silently drops the request (falls to offline queue
     even when online). The optimistic-update + React Query invalidation in
     the app already handles the UX. */
  if (
    url.pathname.startsWith("/api/") &&
    ["POST", "PUT", "PATCH", "DELETE"].includes(request.method)
  ) {
    return; /* no event.respondWith → browser handles normally */
  }

  /* ── 3. Static assets (JS/CSS/fonts/images) — Cache first ── */
  if (url.pathname.match(/\.(js|css|woff2?|png|jpg|jpeg|svg|ico|webp)$/)) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok) {
              const clone = response.clone();
              caches
                .open(DYNAMIC_CACHE)
                .then((cache) => cache.put(request, clone));
            }
            return response;
          })
      )
    );
    return;
  }

  /* ── 4. Navigation (HTML) — Network first, fallback to cache ── */
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches
            .open(DYNAMIC_CACHE)
            .then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() =>
          caches
            .match(request)
            .then(
              (cached) =>
                cached || caches.match("/") || caches.match("/offline.html")
            )
        )
    );
    return;
  }

  /* ── 5. Everything else — Stale while revalidate ── */
  event.respondWith(
    caches.match(request).then((cached) => {
      const networkFetch = fetch(request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches
            .open(DYNAMIC_CACHE)
            .then((cache) => cache.put(request, clone));
        }
        return response;
      });
      return cached || networkFetch;
    })
  );
});

/* ─── Background Sync — Replay queued mutations ────────────────────────────── */
self.addEventListener("sync", (event) => {
  if (event.tag === SYNC_TAG) {
    event.waitUntil(processMutationQueue());
  }
});

async function processMutationQueue() {
  const entries = await getAllQueued();
  if (!entries.length) return;

  await broadcastToClients({ type: "SYNC_START", count: entries.length });

  let success = 0;
  let failed = 0;

  for (const entry of entries) {
    try {
      const response = await fetch(entry.url, {
        method: entry.method,
        headers: entry.headers,
        body: entry.body || undefined,
      });
      if (response.ok || response.status < 500) {
        /* 2xx/4xx — either success or a permanent client error — remove from queue */
        await deleteQueued(entry.id);
        success++;
      } else {
        /* 5xx server error — keep in queue, retry later */
        failed++;
      }
    } catch {
      failed++;
    }
  }

  const remaining = await getQueueCount();
  await broadcastToClients({
    type: "SYNC_COMPLETE",
    success,
    failed,
    remaining,
  });

  /* Bust API cache so the app re-fetches fresh data */
  const apiCache = await caches.open(API_CACHE);
  const apiKeys = await apiCache.keys();
  await Promise.all(apiKeys.map((k) => apiCache.delete(k)));
}

/* ─── Message: force skip waiting OR manual sync trigger ─────────────────── */
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
  if (event.data?.type === "TRIGGER_SYNC") {
    processMutationQueue().catch(() => {});
  }
  if (event.data?.type === "GET_QUEUE_COUNT") {
    getQueueCount().then((count) =>
      event.source?.postMessage({ type: "QUEUE_COUNT", count })
    );
  }
});
