import type { Metadata } from "next";
import Link from "next/link";
import { ChevronDown, Inbox } from "lucide-react";
import { listQueue, queueCounts } from "@/server/dal/staff";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { StatusBadge } from "@/components/app/status-badge";
import { RequestIcon } from "@/components/app/request-icon";
import { StaffActions } from "./staff-actions";
import { getRequestType, STAFF_TRANSITIONS, STATUS_META, type RequestStatus } from "@/lib/requests/catalog";
import { formatDateTime } from "@/lib/dates";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Очередь заявок" };

const FILTERS: { key: "active" | "all" | RequestStatus; label: string }[] = [
  { key: "active", label: "Активные" },
  { key: "submitted", label: "Новые" },
  { key: "in_progress", label: "В работе" },
  { key: "returned", label: "У студента" },
  { key: "ready", label: "Готовы" },
  { key: "all", label: "Все" },
];

export default async function StaffQueuePage({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  const { f } = await searchParams;
  const filter = FILTERS.find((x) => x.key === f)?.key ?? "active";
  const [rows, counts] = await Promise.all([listQueue(filter), queueCounts()]);

  return (
    <>
      <PageHeader title="Очередь заявок" description={`Новых: ${counts.submitted ?? 0} · в работе: ${counts.in_progress ?? 0} · готовы к выдаче: ${counts.ready ?? 0}`} />
      <nav className="-mx-4 mb-4 flex gap-1.5 overflow-x-auto px-4 pb-1" aria-label="Фильтр по статусу">
        {FILTERS.map((x) => (
          <Link
            key={x.key}
            href={x.key === "active" ? "/staff" : `/staff?f=${x.key}`}
            aria-current={filter === x.key ? "page" : undefined}
            className={cn(
              "shrink-0 rounded-full px-3 py-1.5 text-sm font-medium ring-1 ring-foreground/10",
              filter === x.key ? "bg-primary text-primary-foreground ring-primary" : "bg-card",
            )}
          >
            {x.label}
            {x.key !== "active" && x.key !== "all" && counts[x.key] ? ` · ${counts[x.key]}` : ""}
          </Link>
        ))}
      </nav>

      {rows.length === 0 ? (
        <EmptyState icon={Inbox} title="Очередь пуста" text="Новых заявок нет — можно выдохнуть." />
      ) : (
        <ul className="space-y-2" data-testid="queue">
          {rows.map((r) => {
            const def = getRequestType(r.type);
            const can = STAFF_TRANSITIONS[r.status];
            return (
              <li key={r.id} id={`r-${r.id}`} data-testid="queue-item" data-request-id={r.id}>
                <details className="group rounded-xl bg-card ring-1 ring-foreground/10 open:ring-primary/40" open={r.status === "submitted" && rows.length <= 3}>
                  <summary className="flex cursor-pointer list-none gap-3 p-3.5">
                    <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground">
                      <RequestIcon icon={def?.icon ?? "file"} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium leading-snug">{def?.title ?? r.type}</p>
                        <StatusBadge status={r.status} />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {r.studentName} · {r.groupCode}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        № {r.number} · подана {formatDateTime(r.createdAt)}
                        {r.assigneeName ? ` · ведёт ${r.assigneeName}` : ""}
                      </p>
                    </div>
                    <ChevronDown className="mt-2.5 size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
                  </summary>
                  <div className="border-t px-3.5 pb-4 pt-3">
                    <dl className="mb-3 space-y-1 text-sm">
                      {def?.fields
                        .filter((fd) => r.payload[fd.name])
                        .map((fd) => (
                          <div key={fd.name} className="flex gap-2">
                            <dt className="shrink-0 text-muted-foreground">{fd.label}:</dt>
                            <dd className="font-medium">{r.payload[fd.name]}</dd>
                          </div>
                        ))}
                    </dl>
                    {r.status === "returned" && r.returnReason && (
                      <p className="mb-3 rounded-lg bg-warning/15 px-3 py-2 text-sm">Ждём исправления от студента: {r.returnReason}</p>
                    )}
                    {can.length > 0 ? (
                      <StaffActions
                        requestId={r.id}
                        transitions={can}
                        fields={(def?.fields ?? []).map((x) => ({ name: x.name, label: x.label }))}
                      />
                    ) : (
                      <p className="text-sm text-muted-foreground">{STATUS_META[r.status].hint}</p>
                    )}
                  </div>
                </details>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
