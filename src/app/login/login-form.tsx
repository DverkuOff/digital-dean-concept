"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [invalid, setInvalid] = useState({ username: false, password: false });

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    // Пустую форму не отправляем: иначе сервер ответит «неверный пароль», а попытка уйдёт в лимит входа.
    const username = String(fd.get("username") ?? "").trim();
    const password = String(fd.get("password") ?? "");
    const missing = { username: !username, password: !password };
    setInvalid(missing);
    if (missing.username || missing.password) {
      setError(missing.username && missing.password ? "Введите логин и пароль" : missing.username ? "Введите логин" : "Введите пароль");
      (e.currentTarget.elements.namedItem(missing.username ? "username" : "password") as HTMLInputElement | null)?.focus();
      return;
    }
    setPending(true);
    setError(null);
    const { error } = await authClient.signIn.username({
      username: username.toLowerCase(),
      password,
    });
    if (error) {
      setPending(false);
      setError(
        error.status === 429
          ? "Слишком много попыток. Подождите минуту и попробуйте снова."
          : "Неверный логин или пароль",
      );
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div className="space-y-1.5">
        <Label htmlFor="username">Логин</Label>
        <Input id="username" name="username" autoComplete="username" autoCapitalize="none" required placeholder="например, sokolova" aria-invalid={invalid.username || undefined} aria-describedby={error ? "login-error" : undefined} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">Пароль</Label>
        <Input id="password" name="password" type="password" autoComplete="current-password" required aria-invalid={invalid.password || undefined} aria-describedby={error ? "login-error" : undefined} />
      </div>
      {error && (
        <p id="login-error" role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending && <Loader2 className="animate-spin" />}
        Войти
      </Button>
    </form>
  );
}
