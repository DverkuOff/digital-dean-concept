import { Clock, ListOrdered, UserRound } from "lucide-react";
import type { RequestStatus, RequestTypeDef } from "@/lib/requests/catalog";
import { addBusinessDays, formatDayMonth, plural } from "@/lib/dates";
import { cn } from "@/lib/utils";

type Props = {
  def: RequestTypeDef;
  status: RequestStatus;
  createdAt: Date;
  assigneeName: string | null;
  queue: { position: number; total: number } | null;
  now?: Date;
};

/** «Кто ведёт, сколько обычно ждать, где я в очереди» — то, чего нет в ЛК с одними статусами. */
export function RequestTransparency({ def, status, createdAt, assigneeName, queue, now = new Date() }: Props) {
  const active = status === "submitted" || status === "in_progress";
  const due = addBusinessDays(createdAt, def.typicalDays);
  const late = active && now > due;
  const days = `${def.typicalDays} ${plural(def.typicalDays, "рабочий день", "рабочих дня", "рабочих дней")}`;

  return (
    <section className="mt-5 divide-y rounded-2xl bg-card ring-1 ring-foreground/10" aria-label="Кто ведёт и сколько ждать" data-testid="transparency">
      <Row icon={UserRound} label="Кто ведёт">
        {assigneeName ? (
          <>
            <b>{assigneeName}</b> · методист учебного офиса МЭО
          </>
        ) : (
          "Общая очередь учебного офиса МЭО — методист возьмёт заявку в ближайшее время"
        )}
      </Row>
      <Row icon={Clock} label="Обычный срок">
        Обычно готовят за {days}
        {active && (
          <span className={cn("block", late ? "font-medium text-warning-foreground" : "text-muted-foreground")}>
            {late ? `Дольше обычного: ориентир был ${formatDayMonth(due)}` : `Ориентир: до ${formatDayMonth(due)}`}
          </span>
        )}
      </Row>
      {queue && (
        <Row icon={ListOrdered} label="Место в очереди">
          <span data-testid="queue-position">
            {queue.position}-я из {queue.total} {plural(queue.total, "новой заявки", "новых заявок", "новых заявок")}
          </span>
        </Row>
      )}
    </section>
  );
}

function Row({ icon: Icon, label, children }: { icon: typeof Clock; label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 px-4 py-3 text-sm">
      <Icon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="leading-snug">{children}</p>
      </div>
    </div>
  );
}
