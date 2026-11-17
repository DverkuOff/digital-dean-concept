import { Check, Circle, CornerUpLeft, X } from "lucide-react";
import { STATUS_META, TIMELINE_STEPS, type RequestStatus } from "@/lib/requests/catalog";
import { formatDateTime } from "@/lib/dates";
import { cn } from "@/lib/utils";

type Ev = { id: string; status: RequestStatus; comment: string | null; actor: string; createdAt: Date };

/** Таймлайн «как у посылки»: прошедшие события + оставшиеся шаги серым. */
export function RequestTimeline({ events, status }: { events: Ev[]; status: RequestStatus }) {
  const reached = new Set(events.map((e) => e.status));
  const future = status === "rejected" ? [] : TIMELINE_STEPS.filter((s) => !reached.has(s) || (status === "returned" && s !== "submitted"));
  const pending = status === "returned" ? TIMELINE_STEPS.slice(1) : future;

  return (
    <ol className="relative ml-3 border-l-2 border-muted pl-6" data-testid="timeline">
      {events.map((e) => (
        <li key={e.id} className="relative mb-5">
          <span
            className={cn(
              "absolute -left-[35px] top-0 grid size-6 place-items-center rounded-full ring-4 ring-background",
              e.status === "returned" ? "bg-warning text-warning-foreground dark:text-background" : e.status === "rejected" ? "bg-destructive text-white" : "bg-primary text-primary-foreground",
            )}
          >
            {e.status === "returned" ? <CornerUpLeft className="size-3.5" /> : e.status === "rejected" ? <X className="size-3.5" /> : <Check className="size-3.5" />}
          </span>
          <p className="font-medium leading-tight">{STATUS_META[e.status].label}</p>
          <p className="text-xs text-muted-foreground">
            {formatDateTime(e.createdAt)} · {e.actor === "staff" ? "учебный офис" : "вы"}
          </p>
          {e.comment && <p className="mt-1 rounded-lg bg-muted/60 px-3 py-2 text-sm">{e.comment}</p>}
        </li>
      ))}
      {pending.map((s) => (
        <li key={s} className="relative mb-5 text-muted-foreground">
          <span className="absolute -left-[35px] top-0 grid size-6 place-items-center rounded-full bg-muted ring-4 ring-background">
            <Circle className="size-2.5" />
          </span>
          <p className="leading-tight">{STATUS_META[s].label}</p>
        </li>
      ))}
    </ol>
  );
}
