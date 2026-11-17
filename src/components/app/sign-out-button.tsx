"use client";

import { useTransition } from "react";
import { Loader2, LogOut } from "lucide-react";
import { signOutAction } from "@/server/actions/auth";
import { purgeOfflineCache } from "@/components/app/pwa";
import { Button } from "@/components/ui/button";

/** Выход: сначала стираем офлайн-кэш персональных страниц, потом завершаем сессию на сервере. */
export function SignOutButton({ compact = false }: { compact?: boolean }) {
  const [pending, start] = useTransition();
  const onClick = () =>
    start(async () => {
      await purgeOfflineCache();
      await signOutAction();
    });
  if (compact) {
    return (
      <Button variant="ghost" size="icon" aria-label="Выйти" onClick={onClick} disabled={pending}>
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : <LogOut aria-hidden />}
      </Button>
    );
  }
  return (
    <Button variant="outline" size="lg" className="w-full" onClick={onClick} disabled={pending}>
      {pending ? <Loader2 className="animate-spin" aria-hidden /> : <LogOut aria-hidden />} Выйти
    </Button>
  );
}
