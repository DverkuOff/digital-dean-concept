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
  // Имя показываем, только когда заявку реально взяли: у поданной заново «ведёт» вводило бы в заблуждение.
  const taken = assigneeName && (status === "in_progress" || status === "ready" || status === "done");

  return (
    <section className="mt-5 divide-y rounded-2xl bg-card ring-1 ring-foreground/10" aria-label="Кто ведёт и сколько ждать" data-testid="transparency">
      <Row icon={UserRound} label="Кто ведёт">
        {status === "returned" ? (
          <>
            Сейчас заявка у вас: исправьте и подайте снова
            {assigneeName && (
              <span className="block text-muted-foreground">
                Вопросы по возврату — методисту: <b className="font-medium text-foreground">{assigneeName}</b>
              </span>
            )}
          </>
        ) : taken ? (
          <>
            <b>{assigneeName}</b>, методист учебного офиса МЭО
          </>
        ) : (
          "Пока никто: заявка в общей очереди учебного офиса МЭО"
        )}
      </Row>
      <Row icon={Clock} label="Обычный срок">
        Обычно готовят за {days}, по регламенту — {def.eta}
        {active && (
          <span className={cn("block", late ? "font-medium text-warning-foreground" : "text-muted-foreground")}>
            {late ? `Дольше обычного: ждали к ${formatDayMonth(due)}` : `Примерно к ${formatDayMonth(due)}`}
          </span>
        )}
      </Row>
      {queue && (
        <Row icon={ListOrdered} label="Место в очереди">
          <span data-testid="queue-position" data-position={queue.position} data-total={queue.total}>
            {queue.position === 1
              ? "Вы первые: методист возьмёт её следующей"
              : `Перед вами ${queue.position - 1} ${plural(queue.position - 1, "заявка", "заявки", "заявок")}`}
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
