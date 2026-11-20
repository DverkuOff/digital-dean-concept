import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, FilePlus2, Inbox } from "lucide-react";
import { listMyRequests, type MyRequest } from "@/server/dal/requests";
import { PageHeader, SectionTitle } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { StatusBadge } from "@/components/app/status-badge";
import { RequestIcon } from "@/components/app/request-icon";
import { Button } from "@/components/ui/button";
import { getRequestType, STATUS_META, TIMELINE_STEPS } from "@/lib/requests/catalog";
import { formatDayMonth } from "@/lib/dates";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Заявки" };

export default async function RequestsPage() {
  const list = await listMyRequests();
  const active = list.filter((r) => !["done", "rejected"].includes(r.status));
  const closed = list.filter((r) => ["done", "rejected"].includes(r.status));

  return (
    <>
      <PageHeader
        title="Заявки и справки"
        description="Подача онлайн, статус как у посылки"
        action={
          <Button asChild>
            <Link href="/requests/new">
              <FilePlus2 aria-hidden /> Новая
            </Link>
          </Button>
        }
      />
      {list.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="Заявок пока нет"
          text="Закажите справку или подайте заявление — статус будет виден здесь."
          action={
            <Button asChild>
              <Link href="/requests/new">Выбрать заявку</Link>
            </Button>
          }
        />
      ) : (
        <>
          <SectionTitle>Активные</SectionTitle>
          {active.length ? (
            <ul className="space-y-2">{active.map((r) => <RequestRow key={r.id} r={r} />)}</ul>
          ) : (
            <p className="rounded-xl border border-dashed px-4 py-3 text-sm text-muted-foreground">Активных заявок нет</p>
          )}
          {closed.length > 0 && (
            <>
              <SectionTitle>Завершённые</SectionTitle>
              <ul className="space-y-2">{closed.map((r) => <RequestRow key={r.id} r={r} />)}</ul>
            </>
          )}
        </>
      )}
    </>
  );
}

function RequestRow({ r }: { r: MyRequest }) {
  const def = getRequestType(r.type);
  const step = TIMELINE_STEPS.indexOf(r.status === "returned" ? "submitted" : r.status);
  return (
    <li>
      <Link
        href={`/requests/${r.id}`}
        data-testid="request-row"
        className={cn(
          "flex gap-3 rounded-xl bg-card p-3.5 ring-1 ring-foreground/10 hover:bg-muted/40",
          r.status === "returned" && "ring-warning/70",
          r.status === "ready" && "ring-success/50",
        )}
      >
        <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground">
          <RequestIcon icon={def?.icon ?? "file"} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1">
            <p className="font-medium leading-snug">{def?.title ?? r.type}</p>
            <StatusBadge status={r.status} />
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            № {r.number} · обновлена {formatDayMonth(r.updatedAt)}
          </p>
          {r.status !== "rejected" && (
            <div className="mt-2 flex gap-1" aria-hidden>
              {TIMELINE_STEPS.map((s, i) => (
                <span key={s} className={cn("h-1.5 flex-1 rounded-full bg-muted", i <= step && "bg-primary", r.status === "returned" && i === 0 && "bg-warning")} />
              ))}
            </div>
          )}
          {r.status === "returned" && <p className="mt-1.5 text-sm font-medium text-warning-foreground">{STATUS_META.returned.hint}</p>}
        </div>
        <ChevronRight className="mt-2 size-4 shrink-0 text-muted-foreground" aria-hidden />
      </Link>
    </li>
  );
}
