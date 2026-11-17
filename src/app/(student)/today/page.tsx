import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CalendarCheck2, Coffee, Compass, Megaphone } from "lucide-react";
import { requireStudent } from "@/server/session";
import { getTodayCards } from "@/server/dal/today";
import { getMyLessons } from "@/server/dal/schedule";
import { getMyGrades, toResults } from "@/server/dal/grades";
import { listNews } from "@/server/dal/notifications";
import { SectionTitle } from "@/components/app/page-header";
import { LessonCard } from "@/components/app/lesson-card";
import { EmptyState } from "@/components/app/empty-state";
import { TodayCard } from "@/components/app/today-card";
import { calcRating, evaluateThresholds } from "@/lib/rating/calc";
import { RATING_CONFIG } from "@/lib/rating/config";
import { addDays, formatDayMonth, formatScore, formatWeekday, startOfMskDay } from "@/lib/dates";

export const metadata: Metadata = { title: "Сегодня" };

function greeting(now: Date) {
  const h = Number(new Intl.DateTimeFormat("ru-RU", { timeZone: "Europe/Moscow", hour: "numeric", hour12: false }).format(now));
  if (h < 5) return "Доброй ночи";
  if (h < 12) return "Доброе утро";
  if (h < 18) return "Добрый день";
  return "Добрый вечер";
}

export default async function TodayPage() {
  const now = new Date();
  const me = await requireStudent();
  const today = startOfMskDay(now);
  const [cards, lessons2d, grades, news] = await Promise.all([
    getTodayCards(now),
    getMyLessons(today, addDays(today, 8)),
    getMyGrades(),
    listNews(),
  ]);

  // Пары: оставшиеся сегодня, иначе ближайший учебный день.
  const left = lessons2d.filter((l) => l.endsAt > now && l.startsAt < addDays(today, 1));
  const next = left.length ? null : lessons2d.find((l) => l.startsAt >= addDays(today, 1));
  const nextDayLessons = next ? lessons2d.filter((l) => startOfMskDay(l.startsAt).getTime() === startOfMskDay(next.startsAt).getTime()) : [];

  const rating = calcRating(toResults(grades), RATING_CONFIG);
  const thresholds = evaluateThresholds(rating, RATING_CONFIG);
  const nextGoal = thresholds.find((t) => !t.reached);

  return (
    <>
      <div className="mb-5">
        <p className="text-sm text-muted-foreground first-letter:uppercase">
          {formatWeekday(now)}, {formatDayMonth(now)}
        </p>
        <h1 className="text-[22px] font-semibold leading-tight tracking-tight">
          {greeting(now)}, {me.firstName}
        </h1>
      </div>

      <section aria-label="Что важно сегодня">
        {cards.length ? (
          <ul className="space-y-2.5">
            {cards.map((c) => (
              <TodayCard key={c.key} card={c} />
            ))}
          </ul>
        ) : (
          <EmptyState icon={Coffee} title="Всё спокойно" text="Переносов, срочных дедлайнов и новостей по заявкам нет. Деканат напишет сюда первым." />
        )}
      </section>

      <SectionTitle action={<Link href="/schedule" className="text-sm font-medium text-primary">Вся неделя</Link>}>
        {left.length ? "Пары сегодня" : next ? `Ближайшие пары: ${formatWeekday(next.startsAt)}` : "Пары"}
      </SectionTitle>
      {left.length || nextDayLessons.length ? (
        <div className="space-y-2">
          {(left.length ? left : nextDayLessons).map((l) => (
            <LessonCard key={l.id} l={l} now={now} />
          ))}
        </div>
      ) : (
        <EmptyState icon={CalendarCheck2} title="Пар на неделе больше нет" />
      )}

      <Link
        href="/rating"
        className="mt-7 flex items-center gap-4 rounded-2xl bg-primary p-4 text-primary-foreground shadow-sm hover:bg-primary/90"
        data-testid="rating-teaser"
      >
        <div className="grid size-14 shrink-0 place-items-center rounded-xl bg-white/15 text-xl font-semibold tabular-nums">{formatScore(rating.rating)}</div>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 font-semibold">
            <Compass className="size-4" aria-hidden /> Мой рейтинг
          </p>
          <p className="text-sm opacity-90">
            {rating.hasDebt
              ? "Долг блокирует стипендию — посмотрите, что даст пересдача"
              : nextGoal
                ? `До порога «${nextGoal.label}» — ${formatScore(nextGoal.gap)} б.`
                : "Все пороги пройдены"}
          </p>
        </div>
        <ArrowRight className="size-5 shrink-0" aria-hidden />
      </Link>

      {news.length > 0 && (
        <>
          <SectionTitle action={<Link href="/notifications?tab=news" className="text-sm font-medium text-primary">Все новости</Link>}>Деканат сообщает</SectionTitle>
          <ul className="space-y-2">
            {news.slice(0, 2).map((n) => (
              <li key={n.id} className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Megaphone className="size-3.5" aria-hidden /> {formatDayMonth(n.publishedAt)}
                </p>
                <p className="mt-1 font-medium leading-snug">{n.title}</p>
                <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{n.body}</p>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
