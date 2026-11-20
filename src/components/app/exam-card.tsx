import Link from "next/link";
import { CalendarClock, ChevronRight, MapPin, RefreshCcw } from "lucide-react";
import { formatTime } from "@/lib/dates";
import { cn } from "@/lib/utils";

export type ExamView = { id: string; at: Date; name: string; room: string | null; retake: boolean; label: string };

const KIND_LABEL: Record<string, string> = { main: "Экзамен", retake1: "Пересдача 1", retake2: "Пересдача 2", commission: "Комиссия" };
export const examLabel = (kind: string) => KIND_LABEL[kind] ?? "Экзамен";

/** Экзамен или пересдача в дне и неделе расписания — выше пар. */
export function ExamCard({ e }: { e: ExamView }) {
  const Icon = e.retake ? RefreshCcw : CalendarClock;
  return (
    <article
      data-testid="exam-card"
      data-kind={e.retake ? "retake" : "exam"}
      className={cn(
        "flex gap-3 rounded-xl p-3.5 ring-1",
        e.retake ? "bg-destructive/10 ring-destructive/40 dark:bg-destructive/15" : "bg-primary/10 ring-primary/40 dark:bg-primary/15",
      )}
    >
      <div className="w-12 shrink-0 text-right tabular-nums">
        <p className="text-[15px] font-semibold">{formatTime(e.at)}</p>
      </div>
      <div className={cn("w-0.5 shrink-0 rounded-full", e.retake ? "bg-destructive" : "bg-primary")} />
      <div className="min-w-0 flex-1">
        <p className={cn("flex items-center gap-1.5 text-xs font-semibold", e.retake ? "text-destructive" : "text-primary")}>
          <Icon className="size-3.5" aria-hidden /> {e.label}
        </p>
        <p className="font-semibold leading-snug">{e.name}</p>
        {e.room && (
          <p className="mt-0.5 flex items-center gap-1 text-sm text-muted-foreground">
            <MapPin className="size-3.5 shrink-0" aria-hidden /> {e.room}
          </p>
        )}
        {e.retake && (
          <Link href="/rating" className="press -mx-1 mt-1 inline-flex min-h-10 items-center gap-1 rounded-lg px-1 text-sm font-medium text-primary hover:underline">
            План пересдачи <ChevronRight className="size-4" aria-hidden />
          </Link>
        )}
      </div>
    </article>
  );
}
