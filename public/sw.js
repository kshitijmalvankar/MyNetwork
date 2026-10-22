// MyNetwork service worker.
//
// Caches only build files that never change (scripts, styles and fonts under
// /_next/static, which have content hashes in their names) and the app icons,
// so an installed app opens quickly. Pages, API responses and user data are
// never cached. When a page can't load offline, the cached /offline page is shown.

const CACHE = "static-v1";
const OFFLINE_URL = "/offline";
const MAX_ENTRIES = 300;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.add(new Request(OFFLINE_URL, { cache: "reload", credentials: "omit" })))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

const isStatic = (url) => url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/");

/** Drops the oldest build files once there are too many; files from old deploys go first. */
async function trim(cache) {
  const keys = (await cache.keys()).filter((key) => new URL(key.url).pathname !== OFFLINE_URL);
  await Promise.all(keys.slice(0, Math.max(0, keys.length - MAX_ENTRIES)).map((key) => cache.delete(key)));
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok && response.type === "basic") {
    await cache.put(request, response.clone());
    await trim(cache);
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(async () => (await caches.match(OFFLINE_URL)) ?? Response.error()));
    return;
  }
  if (isStatic(url)) event.respondWith(cacheFirst(request));
});
