"use client";

import { useState, useTransition } from "react";
import { CalendarPlus, Check, Copy, Loader2, RefreshCcw } from "lucide-react";
import { issueCalendarTokenAction } from "@/server/actions/calendar";
import { Button } from "@/components/ui/button";

export function CalendarLink({ issuedAt, lastUsedAt }: { issuedAt: string | null; lastUsedAt: string | null }) {
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();

  const issue = () =>
    start(async () => {
      const res = await issueCalendarTokenAction();
      if (res.error) setError(res.error);
      else {
        setToken(res.token ?? null);
        setCopied(false);
      }
    });

  const url = token ? `${window.location.origin}/api/calendar/${token}.ics` : null;
  const webcal = url?.replace(/^https?:/, "webcal:");

  return (
    <section className="rounded-2xl bg-card p-4 ring-1 ring-foreground/10" aria-label="Личная ссылка на календарь">
      {url ? (
        <>
          <p className="text-sm font-medium">Ваша личная ссылка</p>
          <p className="mt-1 text-xs text-muted-foreground">Скопируйте сейчас: потом её не будет видно, только перевыпуск.</p>
          <code data-testid="calendar-url" className="mt-2 block break-all rounded-lg bg-muted px-3 py-2 text-xs">
            {url}
          </code>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <Button asChild size="lg">
              <a href={webcal}>
                <CalendarPlus aria-hidden /> Открыть в календаре
              </a>
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(url);
                  setCopied(true);
                } catch {}
              }}
            >
              {copied ? <Check aria-hidden /> : <Copy aria-hidden />} {copied ? "Скопировано" : "Скопировать"}
            </Button>
          </div>
        </>
      ) : issuedAt ? (
        <>
          <p className="text-sm font-medium">Ссылка выпущена {issuedAt}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {lastUsedAt ? `Календарь последний раз забирал расписание ${lastUsedAt}.` : "Календарь её ещё не открывал."} Нужна
            ссылка заново? Перевыпустите — старая перестанет работать.
          </p>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Ссылки ещё нет. Получите её — это займёт секунду.</p>
      )}
      <Button className="mt-3 w-full" size="lg" variant={url ? "ghost" : "default"} onClick={issue} disabled={pending}>
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : issuedAt || url ? <RefreshCcw aria-hidden /> : <CalendarPlus aria-hidden />}
        {issuedAt || url ? "Перевыпустить ссылку" : "Получить ссылку"}
      </Button>
      {error && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
