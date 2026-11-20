import type { Metadata } from "next";
import Link from "next/link";
import { BellOff, CalendarClock, CalendarDays, CheckCheck, FileText, GraduationCap, Megaphone, RefreshCcw } from "lucide-react";
import { listMyNotifications, listNews } from "@/server/dal/notifications";
import { markAllReadAction } from "@/server/actions/student";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { SubmitButton } from "@/components/app/submit-button";
import { formatDateTime, formatDayMonth, relativeDay } from "@/lib/dates";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Уведомления" };

const KIND = {
  schedule: { icon: CalendarDays, label: "Расписание" },
  deadline: { icon: CalendarClock, label: "Дедлайн" },
  request: { icon: FileText, label: "Заявка" },
  retake: { icon: RefreshCcw, label: "Пересдача" },
  grade: { icon: GraduationCap, label: "Оценки" },
} as const;

type SP = Promise<{ tab?: string }>;

export default async function NotificationsPage({ searchParams }: { searchParams: SP }) {
  const { tab } = await searchParams;
  const isNews = tab === "news";
  const [mine, news] = await Promise.all([listMyNotifications(), listNews()]);
  const unread = mine.filter((n) => !n.readAt).length;
  const now = new Date();

  return (
    <>
      <PageHeader
        title="Уведомления"
        action={
          !isNews && unread > 0 ? (
            <form action={markAllReadAction}>
              <SubmitButton variant="outline" size="sm">
                <CheckCheck aria-hidden /> Прочитать все
              </SubmitButton>
            </form>
          ) : undefined
        }
      />
      <div className="relative mb-4 grid grid-cols-2 rounded-xl bg-muted p-1 text-sm font-medium" role="tablist">
        <span
          aria-hidden
          className="absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-lg bg-card shadow-sm ring-1 ring-foreground/10 transition-transform duration-250 ease-(--ease-in-out) dark:bg-foreground/15"
          style={{ transform: isNews ? "translateX(100%)" : "none" }}
        />
        <Link role="tab" aria-selected={!isNews} href="/notifications" className={cn("press relative rounded-lg py-2 text-center transition-colors", !isNews ? "text-foreground" : "text-muted-foreground hover:text-foreground")}>
          Мне {unread > 0 && <span className="ml-1 rounded-full bg-destructive px-1.5 text-[11px] text-white">{unread}</span>}
        </Link>
        <Link role="tab" aria-selected={isNews} href="/notifications?tab=news" className={cn("press relative rounded-lg py-2 text-center transition-colors", isNews ? "text-foreground" : "text-muted-foreground hover:text-foreground")}>
          Новости деканата
        </Link>
      </div>

      {isNews ? (
        news.length ? (
          <ul className="space-y-2">
            {news.map((n) => (
              <li key={n.id} className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Megaphone className="size-3.5" aria-hidden /> Деканат · {formatDayMonth(n.publishedAt)}
                  {n.important && <span className="rounded-full bg-destructive/10 px-2 font-medium text-destructive">важно</span>}
                </div>
                <p className="mt-1 font-semibold leading-snug">{n.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{n.body}</p>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={Megaphone} title="Новостей пока нет" text="Здесь появятся объявления деканата вместо десятка чатов." />
        )
      ) : mine.length ? (
        <ul className="space-y-2" data-testid="notifications">
          {mine.map((n) => {
            const K = KIND[n.kind];
            const body = (
              <>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <K.icon className="size-3.5" aria-hidden /> {K.label} · {formatDateTime(n.createdAt)}
                  {!n.readAt && <span className="size-2 rounded-full bg-primary" aria-label="не прочитано" />}
                </div>
                <p className="mt-1 font-semibold leading-snug">{n.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{n.body}</p>
                {n.dueAt && (
                  <p className={cn("mt-2 inline-flex rounded-lg px-2 py-1 text-xs font-medium", n.dueAt > now ? "bg-warning/20 text-warning-foreground" : "bg-muted text-muted-foreground")}>
                    {n.dueAt > now ? `Срок ${relativeDay(n.dueAt, now)}, ${formatDayMonth(n.dueAt)}` : "Срок прошёл"}
                  </p>
                )}
              </>
            );
            const cls = cn("block rounded-xl bg-card p-4 ring-1 ring-foreground/10", !n.readAt && "bg-accent/40 ring-primary/30");
            return (
              <li key={n.id}>
                {n.link ? (
                  <Link href={n.link} className={cn(cls, "press-soft hover:bg-muted/40")}>
                    {body}
                  </Link>
                ) : (
                  <div className={cls}>{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState icon={BellOff} title="Уведомлений нет" text="Когда изменится расписание или статус заявки, мы напишем сюда." />
      )}
    </>
  );
}
