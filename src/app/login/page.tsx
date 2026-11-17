import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/server/session";
import { LogoMark } from "@/components/app/logo";
import { LoginForm } from "./login-form";
import { QuickLogin } from "./quick-login";

export const metadata: Metadata = { title: "Вход" };

export default async function LoginPage() {
  // Без БД страница входа всё равно открывается (находка аудита М7): ошибку покажет сам вход.
  let s: Awaited<ReturnType<typeof getSession>> = null;
  try {
    s = await getSession();
  } catch {
    s = null;
  }
  if (s) redirect(s.user.role === "staff" ? "/staff" : "/today");

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-8">
      <div className="mb-6 flex flex-col items-center text-center">
        <LogoMark className="mb-4 size-14" />
        <h1 className="text-2xl font-semibold tracking-tight">Ориентир</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Расписание, оценки, рейтинг и заявки в деканат — в одном месте
        </p>
      </div>
      <QuickLogin />
      <details className="mt-6 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        <summary className="cursor-pointer text-sm font-medium">Войти по логину и паролю</summary>
        <div className="mt-4">
          <LoginForm />
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          Логины: <code>orlov</code>, <code>sokolova</code>, <code>metodist</code> и их копии <code>orlov2</code>,{" "}
          <code>orlov3</code>… Пароль у всех: <code>demo2026</code>
        </p>
      </details>
    </main>
  );
}
