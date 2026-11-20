import type { Metadata } from "next";
import Link from "next/link";
import { Bell, ChevronRight, ShieldCheck } from "lucide-react";
import { requireStudent, requireUser } from "@/server/session";
import { PageHeader } from "@/components/app/page-header";
import { SignOutButton } from "@/components/app/sign-out-button";
import { ThemeSwitcher } from "@/components/app/theme";

export const metadata: Metadata = { title: "Профиль" };

export default async function ProfilePage() {
  const me = await requireStudent();
  const user = await requireUser();
  const rows: [string, string][] = [
    ["Факультет", me.faculty],
    ["Направление", me.program],
    ["Курс", `${me.course} курс`],
    ["Группа", me.groupCode],
    ["Форма обучения", `очная, ${me.fundingType}`],
    ["Зачётная книжка", me.recordBook],
    ["Логин", user.username ?? "—"],
  ];

  return (
    <>
      <PageHeader title="Профиль" />
      <section className="rounded-2xl bg-card p-5 ring-1 ring-foreground/10">
        <div className="flex items-center gap-4">
          <div className="grid size-14 shrink-0 place-items-center rounded-full bg-primary text-lg font-semibold text-primary-foreground">
            {me.firstName[0]}
            {me.lastName[0]}
          </div>
          <div className="min-w-0">
            <p className="text-lg font-semibold leading-tight" data-testid="profile-name">
              {me.lastName} {me.firstName} {me.middleName}
            </p>
            <p className="text-sm text-muted-foreground">Студент · {me.groupCode}</p>
          </div>
        </div>
        <dl className="mt-5 divide-y text-sm">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 py-2.5">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="text-right font-medium">{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      <Link
        href="/notifications"
        className="press-soft mt-4 flex items-center gap-3 rounded-2xl bg-card p-4 ring-1 ring-foreground/10 hover:bg-muted/50"
      >
        <Bell className="size-5 text-primary" aria-hidden />
        <span className="flex-1 font-medium">Уведомления и новости деканата</span>
        <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
      </Link>

      <section className="mt-4 rounded-2xl bg-card p-4 ring-1 ring-foreground/10" aria-labelledby="theme-title">
        <h2 id="theme-title" className="mb-2 text-sm font-medium">
          Оформление
        </h2>
        <ThemeSwitcher />
      </section>

      <details className="mt-4 rounded-2xl bg-secondary/60 p-4 text-sm text-secondary-foreground">
        <summary className="-my-2 flex min-h-10 cursor-pointer items-center gap-2 font-medium">
          <ShieldCheck className="size-5 shrink-0" aria-hidden /> Как защищены мои данные
        </summary>
        <p className="mt-2">
          Вы видите только свои данные: сервер проверяет владельца при каждом запросе, чужую заявку не открыть даже по
          прямой ссылке. Пароль хранится только в виде хеша (argon2id). Все данные в концепте вымышлены.
        </p>
      </details>

      <div className="mt-6">
        <SignOutButton />
      </div>
    </>
  );
}
