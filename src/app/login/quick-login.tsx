"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

// Демо-персонажи. Копии (2, 3) с тем же сюжетом и независимыми данными: эксперты не мешают друг другу.
const PERSONAS = [
  { login: "orlov", title: "Максим Орлов", text: "Долг по макроэкономике, перенос пары, заявку вернули с причиной" },
  { login: "sokolova", title: "Анна Соколова", text: "Отличница без долгов: рейтинг, пороги, готовая справка" },
  { login: "metodist", title: "Методист учебного офиса", text: "Очередь заявок: взять в работу, вернуть с причиной, готово" },
];
const COPIES = ["", "2", "3"];
export const DEMO_PASSWORD_PUBLIC = "demo2026"; // публичный пароль демо-аккаунтов, не секрет

export function QuickLogin() {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function enter(username: string) {
    setBusy(username);
    setError(null);
    const { error } = await authClient.signIn.username({ username, password: DEMO_PASSWORD_PUBLIC });
    if (error) {
      setBusy(null);
      setError(error.status === 429 ? "Слишком много попыток входа. Подождите минуту." : "Не получилось войти. Попробуйте ещё раз.");
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <section aria-labelledby="demo-title" className="space-y-2.5" data-testid="quick-login">
      <h2 id="demo-title" className="text-sm font-medium">
        Войти как демо-персонаж
      </h2>
      {PERSONAS.map((p) => (
        <div key={p.login} className="rounded-xl bg-card p-3.5 ring-1 ring-foreground/10">
          <p className="font-medium leading-snug">{p.title}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">{p.text}</p>
          <div className="mt-3 grid grid-cols-[1fr_auto_auto] gap-2">
            {COPIES.map((c) => {
              const username = p.login + c;
              return (
                <Button
                  key={username}
                  type="button"
                  size={c ? "default" : "default"}
                  variant={c ? "outline" : "default"}
                  disabled={busy !== null}
                  onClick={() => enter(username)}
                  aria-label={c ? `Войти как ${p.title}, копия ${c}` : `Войти как ${p.title}`}
                  data-login={username}
                >
                  {busy === username && <Loader2 className="animate-spin" aria-hidden />}
                  {c ? `копия ${c}` : "Войти"}
                </Button>
              );
            })}
          </div>
        </div>
      ))}
      {error && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        Сюжет уже прошёл кто-то до вас (заявка переподана, карточка скрыта)? Возьмите копию: данные те же, но свои.
      </p>
    </section>
  );
}
