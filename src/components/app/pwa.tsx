"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { CloudOff, RefreshCw } from "lucide-react";
import { formatTime, plural } from "@/lib/dates";

const OFFLINE_PAGES = ["/today", "/schedule", "/schedule?view=week", "/grades"];

/**
 * Регистрирует сервис-воркер, сообщает ему ключ пользователя (кэш раздельный)
 * и показывает плашку, если страница открыта без сети или из кэша.
 * Спека: docs/specs/pwa.md.
 */
function subscribeOnline(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

export function PwaClient({ userKey, renderedAt }: { userKey: string; renderedAt: string }) {
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const first = setTimeout(() => setNow(Date.now()), 0);
    const t = setInterval(() => setNow(Date.now()), 30_000);

    if ("serviceWorker" in navigator) {
      const onMsg = (e: MessageEvent) => {
        if (e.data?.type === "warmed") document.documentElement.dataset.offlineReady = "1";
      };
      navigator.serviceWorker.addEventListener("message", onMsg);
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then(() => navigator.serviceWorker.ready)
        .then((reg) => reg.active?.postMessage({ type: "user", key: userKey, warm: OFFLINE_PAGES }))
        .catch(() => {});
      return () => {
        navigator.serviceWorker.removeEventListener("message", onMsg);
        clearTimeout(first);
        clearInterval(t);
      };
    }
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [userKey]);

  if (now === null) return null;
  const rendered = new Date(renderedAt);
  const ageMin = Math.max(0, Math.floor((now - rendered.getTime()) / 60_000));
  const fromCache = ageMin >= 2; // свежая страница с сервера моложе 2 минут
  if (online && !fromCache) return null;

  return (
    <div role="status" data-testid="offline-banner" className="mx-auto mt-3 flex max-w-4xl items-center gap-2 px-4">
      <div className="flex w-full items-center gap-2 rounded-xl bg-info/15 px-3 py-2 text-sm text-info-foreground ring-1 ring-info/40">
        <CloudOff className="size-4 shrink-0" aria-hidden />
        <span className="flex-1">
          {online ? "Не удалось обновить" : "Нет сети"} · данные на {formatTime(rendered)}, обновлено{" "}
          {ageMin === 0 ? "только что" : `${ageMin} ${plural(ageMin, "минуту", "минуты", "минут")} назад`}
        </span>
        {online && (
          <button type="button" onClick={() => location.reload()} className="grid size-8 place-items-center rounded-lg hover:bg-info/20" aria-label="Обновить">
            <RefreshCw className="size-4" aria-hidden />
          </button>
        )}
      </div>
    </div>
  );
}

/** Перед выходом стираем персональный кэш на устройстве. */
export async function purgeOfflineCache() {
  try {
    if ("caches" in window) {
      for (const k of await caches.keys()) if (k.startsWith("orientir-pages-") || k === "orientir-meta") await caches.delete(k);
    }
    navigator.serviceWorker?.controller?.postMessage({ type: "logout" });
  } catch {}
}
