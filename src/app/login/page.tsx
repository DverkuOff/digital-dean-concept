import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/server/session";
import { LogoMark } from "@/components/app/logo";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Вход" };

export default async function LoginPage() {
  const s = await getSession();
  if (s) redirect(s.user.role === "staff" ? "/staff" : "/today");

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-10">
      <div className="mb-8 flex flex-col items-center text-center">
        <LogoMark className="mb-4 size-14" />
        <h1 className="text-2xl font-semibold tracking-tight">Ориентир</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Расписание, оценки, рейтинг и заявки в деканат — в одном месте
        </p>
      </div>
      <LoginForm />
      <section className="mt-8 rounded-xl border border-dashed bg-card p-4 text-sm" aria-label="Тестовые аккаунты">
        <p className="mb-2 font-medium">Тестовые аккаунты для жюри</p>
        <ul className="space-y-1 text-muted-foreground">
          <li><code className="text-foreground">sokolova</code> — студентка без долгов</li>
          <li><code className="text-foreground">orlov</code> — студент с долгом и переносом пары</li>
          <li><code className="text-foreground">metodist</code> — методист учебного офиса</li>
        </ul>
        <p className="mt-2 text-muted-foreground">
          Пароль у всех: <code className="text-foreground">demo2026</code>
        </p>
      </section>
    </main>
  );
}
