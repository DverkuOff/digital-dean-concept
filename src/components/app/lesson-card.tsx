import { ArrowRight, Ban, DoorOpen, MapPin, UserRound } from "lucide-react";
import type { LessonView } from "@/server/dal/schedule";
import { formatDayMonth, formatShortWeekday, formatTime, mskDateKey } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { LessonNote } from "@/components/app/lesson-note";

const TYPE_LABEL = { lecture: "Лекция", seminar: "Семинар", language: "Язык" } as const;

export function LessonCard({ l, now = new Date() }: { l: LessonView; now?: Date }) {
  const isPast = l.endsAt.getTime() < now.getTime();
  const isNow = l.startsAt.getTime() <= now.getTime() && !isPast;
  const changed = l.status !== "normal";
  const moved = l.status === "moved";
  const cancelled = l.status === "cancelled";
  const otherDay = moved && l.originalStartsAt && mskDateKey(l.originalStartsAt) !== mskDateKey(l.startsAt);

  return (
    <article
      data-testid="lesson"
      data-lesson-id={l.id}
      data-status={l.status}
      className={cn(
        "relative flex gap-3 rounded-xl bg-card p-3.5 ring-1 ring-foreground/10",
        changed && !cancelled && "bg-warning/10 ring-warning/60",
        cancelled && "bg-destructive/5 ring-destructive/30",
        isPast && !changed && "opacity-60",
      )}
    >
      <div className="w-12 shrink-0 text-right tabular-nums">
        <p className={cn("text-[15px] font-semibold", cancelled && "line-through")}>{formatTime(l.startsAt)}</p>
        <p className="text-xs text-muted-foreground">{formatTime(l.endsAt)}</p>
      </div>
      <div className={cn("w-0.5 shrink-0 rounded-full bg-primary/30", isNow && "bg-primary", changed && "bg-warning", cancelled && "bg-destructive")} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">{TYPE_LABEL[l.type]}</span>
          {isNow && <span className="rounded-full bg-primary px-2 text-[11px] font-medium text-primary-foreground">идёт сейчас</span>}
          {moved && <ChangeTag>Перенос</ChangeTag>}
          {l.status === "room_changed" && <ChangeTag>Другая аудитория</ChangeTag>}
          {cancelled && (
            <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 text-[11px] font-semibold text-destructive">
              <Ban className="size-3" aria-hidden /> Отменено
            </span>
          )}
        </div>
        <h3 className={cn("mt-0.5 font-semibold leading-snug", cancelled && "text-muted-foreground line-through")}>{l.discipline}</h3>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <MapPin className="size-3.5" aria-hidden />
            {l.status === "room_changed" && l.originalRoom && <s className="mr-1">{l.originalRoom}</s>}
            <span className={cn(l.status === "room_changed" && "font-semibold text-foreground")}>{l.room}</span>
          </span>
          <span className="inline-flex items-center gap-1">
            <UserRound className="size-3.5" aria-hidden />
            {l.teacher}
          </span>
        </p>
        {moved && l.originalStartsAt && (
          <p className="mt-2 flex flex-wrap items-center gap-1.5 text-sm font-medium text-warning-foreground">
            <span className="line-through opacity-70">
              {otherDay ? `${formatShortWeekday(l.originalStartsAt)}, ${formatDayMonth(l.originalStartsAt)} ` : ""}
              {formatTime(l.originalStartsAt)}
            </span>
            <ArrowRight className="size-3.5" aria-hidden />
            <span>
              {otherDay ? `${formatShortWeekday(l.startsAt)}, ${formatDayMonth(l.startsAt)} ` : ""}
              {formatTime(l.startsAt)}
            </span>
          </p>
        )}
        {l.changeNote && (
          <p className="mt-1 flex items-start gap-1 text-[13px] text-muted-foreground">
            <DoorOpen className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            {l.changeNote}
          </p>
        )}
        <LessonNote lessonId={l.id} note={l.note} label={l.discipline} />
      </div>
    </article>
  );
}

function ChangeTag({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-warning px-2 text-[11px] font-semibold text-warning-foreground dark:text-background">{children}</span>;
}
