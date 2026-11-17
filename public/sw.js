/* Сервис-воркер «Ориентира». Спека: docs/specs/pwa.md.
 *
 * Что кэшируем:
 *  - статику Next.js (/_next/static, хеши в именах) — cache-first;
 *  - три персональные страницы (Сегодня, Расписание, Учёба) — network-first,
 *    в отдельном кэше на каждого пользователя: orientir-pages-<ключ>.
 * Безопасность:
 *  - ключ пользователя присылает страница после входа; кэши других ключей удаляются;
 *  - при выходе и при редиректе на /login (сессия кончилась) все персональные кэши удаляются;
 *  - API, Server Actions (POST), RSC-запросы и остальные страницы не кэшируются.
 */
const VERSION = "v1";
const STATIC = `orientir-static-${VERSION}`;
const META = "orientir-meta";
const PAGES_PREFIX = "orientir-pages-";
const OFFLINE_URL = "/offline.html";
const OFFLINE_PATHS = ["/today", "/schedule", "/grades"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(STATIC).then((c) => c.addAll([OFFLINE_URL, "/icons/icon-192.png"])));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) {
        if (key.startsWith("orientir-static-") && key !== STATIC) await caches.delete(key);
      }
      await self.clients.claim();
    })(),
  );
});

async function getUserKey() {
  const res = await (await caches.open(META)).match("/__user");
  return res ? res.text() : null;
}

async function setUserKey(key) {
  const meta = await caches.open(META);
  const prev = await meta.match("/__user");
  if (prev && (await prev.text()) !== key) await meta.delete("/__warmed");
  await meta.put("/__user", new Response(key));
  // Кэш другого пользователя на этом устройстве удаляем сразу.
  for (const name of await caches.keys()) {
    if (name.startsWith(PAGES_PREFIX) && name !== PAGES_PREFIX + key) await caches.delete(name);
  }
}

async function purgePersonal() {
  for (const name of await caches.keys()) {
    if (name.startsWith(PAGES_PREFIX)) await caches.delete(name);
  }
  await caches.delete(META);
}

function isOfflinePage(url) {
  return OFFLINE_PATHS.includes(url.pathname);
}

/** Сохраняем страницу и её скрипты/стили, чтобы она открылась и ожила без сети. */
async function storePage(key, request, response) {
  const html = await response.clone().text();
  const pages = await caches.open(PAGES_PREFIX + key);
  await pages.put(request, new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "x-orientir-cached-at": new Date().toISOString() } }));
  const assets = [...new Set(html.match(/\/_next\/static\/[^"'\s)]+/g) || [])];
  const stat = await caches.open(STATIC);
  await Promise.all(
    assets.map(async (a) => {
      if (await stat.match(a)) return;
      try {
        const r = await fetch(a);
        if (r.ok) await stat.put(a, r);
      } catch {}
    }),
  );
}

async function warm(key, urls) {
  // Не чаще раза в 5 минут: каждая перезагрузка страницы не должна дёргать сервер.
  const meta = await caches.open(META);
  const last = await meta.match("/__warmed");
  if (last && Date.now() - Number(await last.text()) < 5 * 60 * 1000) return;
  await meta.put("/__warmed", new Response(String(Date.now())));
  for (const u of urls) {
    try {
      const req = new Request(u, { credentials: "same-origin" });
      const res = await fetch(req);
      if (res.ok && !res.redirected) await storePage(key, req, res);
      else if (res.redirected) return purgePersonal();
    } catch {}
  }
}

self.addEventListener("message", (event) => {
  const msg = event.data || {};
  if (msg.type === "user" && typeof msg.key === "string") {
    event.waitUntil(
      (async () => {
        await setUserKey(msg.key);
        await warm(msg.key, (msg.warm || []).filter((u) => isOfflinePage(new URL(u, self.location.origin))));
        if (event.source) event.source.postMessage({ type: "warmed" });
      })(),
    );
  } else if (msg.type === "logout") {
    event.waitUntil(
      purgePersonal().then(() => event.source && event.source.postMessage({ type: "purged" })),
    );
  }
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;
  if (req.headers.get("RSC") || req.headers.get("Next-Router-Prefetch")) return;

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.open(STATIC).then(async (c) => {
        const hit = await c.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) c.put(req, res.clone());
        return res;
      }),
    );
    return;
  }

  if (req.mode !== "navigate") return;

  event.respondWith(
    (async () => {
      const key = await getUserKey();
      try {
        const res = await fetch(req);
        if (res.redirected && new URL(res.url).pathname === "/login") {
          await purgePersonal(); // сессия кончилась — персональный кэш больше не нужен
        } else if (key && isOfflinePage(url) && res.ok) {
          event.waitUntil(storePage(key, req, res.clone()));
        }
        return res;
      } catch {
        if (key && isOfflinePage(url)) {
          const hit = await (await caches.open(PAGES_PREFIX + key)).match(req);
          if (hit) return hit;
        }
        return (await caches.match(OFFLINE_URL)) || Response.error();
      }
    })(),
  );
});
