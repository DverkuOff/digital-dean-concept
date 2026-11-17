import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ShieldCheck } from "lucide-react";
import { getMyCalendarStatus } from "@/server/dal/calendar";
import { PageHeader } from "@/components/app/page-header";
import { CalendarLink } from "./calendar-link";
import { formatDateTime } from "@/lib/dates";

export const metadata: Metadata = { title: "Расписание в календаре" };

export default async function CalendarPage() {
  const status = await getMyCalendarStatus();
  return (
    <>
      <Link href="/schedule" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" aria-hidden /> Расписание
      </Link>
      <PageHeader
        title="Расписание в календаре телефона"
        description="Подпишитесь один раз — пары появятся в Google, Apple или Яндекс Календаре, а переносы и отмены будут обновляться сами."
      />
      <CalendarLink issuedAt={status ? formatDateTime(status.createdAt) : null} lastUsedAt={status?.lastUsedAt ? formatDateTime(status.lastUsedAt) : null} />
      <div className="mt-5 flex gap-3 rounded-2xl bg-secondary/60 p-4 text-sm text-secondary-foreground">
        <ShieldCheck className="mt-0.5 size-5 shrink-0" aria-hidden />
        <p>
          Ссылка личная и работает без входа, поэтому никому её не пересылайте. Мы храним только её отпечаток, а не саму
          ссылку: если потеряли или переслали по ошибке — перевыпустите, и старая сразу перестанет работать.
        </p>
      </div>
      <ol className="mt-5 list-decimal space-y-1.5 pl-5 text-sm text-muted-foreground">
        <li>iPhone: нажмите «Открыть в календаре» и подтвердите подписку.</li>
        <li>Android и Google Календарь: «Скопировать», затем в календаре на компьютере «Другие календари → Добавить по URL».</li>
        <li>Календарь обновляет подписку сам, обычно раз в час.</li>
      </ol>
    </>
  );
}
