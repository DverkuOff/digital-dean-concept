import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Clock, Info } from "lucide-react";
import { getRequestType, REQUEST_TYPES } from "@/lib/requests/catalog";
import { createRequestAction } from "@/server/actions/requests";
import { getMyGrades } from "@/server/dal/grades";
import { PageHeader } from "@/components/app/page-header";
import { RequestForm } from "@/components/app/request-form";
import { RequestIcon } from "@/components/app/request-icon";

export const metadata: Metadata = { title: "Новая заявка" };

type SP = Promise<{ type?: string; discipline?: string }>;

export default async function NewRequestPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const def = sp.type ? getRequestType(sp.type) : undefined;

  if (!def) {
    return (
      <>
        <PageHeader title="Новая заявка" description="Что нужно от учебного офиса?" />
        <ul className="grid gap-2 sm:grid-cols-2">
          {REQUEST_TYPES.map((t) => (
            <li key={t.key}>
              <Link
                href={`/requests/new?type=${t.key}`}
                className="press-soft flex h-full gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10 hover:bg-muted/40"
              >
                <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground">
                  <RequestIcon icon={t.icon} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium leading-snug">{t.title}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{t.description}</p>
                  <p className="mt-1.5 inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="size-3" aria-hidden /> {t.eta}
                  </p>
                </div>
                <ChevronRight className="mt-2 size-4 shrink-0 text-muted-foreground" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </>
    );
  }

  // Предзаполнение: дисциплина из ссылки (режим пересдачи) или первый долг студента.
  const initial: Record<string, string> = {};
  if (def.fields.some((f) => f.name === "discipline")) {
    const debts = (await getMyGrades()).filter((g) => g.status === "debt");
    const fromLink = typeof sp.discipline === "string" ? sp.discipline.slice(0, 200) : "";
    initial.discipline = fromLink || debts[0]?.name || "";
  }

  return (
    <>
      <Link href="/requests/new" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" aria-hidden /> Все заявки
      </Link>
      <PageHeader title={def.title} description={def.description} />
      <p className="mb-4 inline-flex items-center gap-1.5 rounded-lg bg-secondary px-3 py-1.5 text-sm text-secondary-foreground">
        <Clock className="size-4" aria-hidden /> Срок: {def.eta}
      </p>
      {def.note && (
        <p className="mb-4 flex gap-2 rounded-xl bg-muted p-3 text-sm text-muted-foreground">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden /> {def.note}
        </p>
      )}
      <div className="rounded-2xl bg-card p-4 ring-1 ring-foreground/10">
        <RequestForm def={def} action={createRequestAction} initial={initial} submitLabel="Подать заявку" />
      </div>
    </>
  );
}
