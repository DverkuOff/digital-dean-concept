import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CircleCheck, ChevronLeft, MessageSquareWarning, PartyPopper } from "lucide-react";
import { getMyRequest, queuePositionOf } from "@/server/dal/requests";
import { resubmitRequestAction } from "@/server/actions/requests";
import { StatusBadge } from "@/components/app/status-badge";
import { RequestForm } from "@/components/app/request-form";
import { RequestTimeline } from "@/components/app/request-timeline";
import { RequestTransparency } from "@/components/app/request-transparency";
import { displayFieldValue, getRequestType, STATUS_META } from "@/lib/requests/catalog";

export const metadata: Metadata = { title: "Заявка" };

export default async function RequestPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  const { id } = await params;
  const { created } = await searchParams;
  // Владелец проверяется в DAL: чужая заявка → null → 404.
  const r = await getMyRequest(id);
  if (!r) notFound();
  const def = getRequestType(r.type);
  const queue = await queuePositionOf(r);

  return (
    <>
      <Link href="/requests" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" aria-hidden /> Мои заявки
      </Link>

      {created && (
        <p role="status" className="mb-4 flex items-center gap-2 rounded-xl bg-success/15 px-4 py-3 text-sm font-medium text-success-foreground">
          <PartyPopper className="size-4" aria-hidden /> Заявка подана. Статус будет меняться здесь, а в шапке появится уведомление.
        </p>
      )}

      <div className="mb-1 flex items-start justify-between gap-3">
        <h1 className="text-[22px] font-semibold leading-tight tracking-tight">{def?.title ?? r.type}</h1>
        <StatusBadge status={r.status} className="mt-1" />
      </div>
      <p className="text-sm text-muted-foreground">
        № {r.number} · {STATUS_META[r.status].hint}
      </p>

      {def && !["done", "rejected"].includes(r.status) && (
        <RequestTransparency def={def} status={r.status} createdAt={r.createdAt} assigneeName={r.assigneeName} queue={queue} />
      )}

      {r.status === "returned" && def && (
        <section className="mt-5 rounded-2xl bg-warning/10 p-4 ring-1 ring-warning/60" aria-labelledby="ret">
          <h2 id="ret" className="flex items-center gap-2 font-semibold text-warning-foreground">
            <MessageSquareWarning className="size-5" aria-hidden /> Методист вернул заявку
          </h2>
          <p className="mt-1 text-sm" data-testid="return-reason">{r.returnReason}</p>
          <div className="mt-4 rounded-xl bg-card p-4">
            <RequestForm
              def={def}
              action={resubmitRequestAction}
              initial={r.payload}
              requestId={r.id}
              highlight={r.returnField}
              submitLabel="Исправить и подать снова"
            />
          </div>
        </section>
      )}

      {(r.status === "ready" || r.status === "rejected") && r.staffComment && (
        <section
          className={
            r.status === "ready"
              ? "mt-5 flex gap-3 rounded-2xl bg-success/10 p-4 ring-1 ring-success/40"
              : "mt-5 flex gap-3 rounded-2xl bg-destructive/5 p-4 ring-1 ring-destructive/30"
          }
        >
          <CircleCheck className="mt-0.5 size-5 shrink-0" aria-hidden />
          <p className="text-sm">{r.staffComment}</p>
        </section>
      )}

      <section className="mt-6">
        <h2 className="mb-3 text-[15px] font-semibold">История</h2>
        <RequestTimeline events={r.events} status={r.status} />
      </section>

      {r.status !== "returned" && def && (
        <section className="mt-6">
          <h2 className="mb-2 text-[15px] font-semibold">Данные заявки</h2>
          <dl className="divide-y rounded-xl bg-card text-sm ring-1 ring-foreground/10">
            {def.fields
              .filter((f) => r.payload[f.name])
              .map((f) => (
                <div key={f.name} className="flex justify-between gap-4 px-4 py-2.5">
                  <dt className="text-muted-foreground">{f.label}</dt>
                  <dd className="text-right font-medium">{displayFieldValue(f, r.payload[f.name])}</dd>
                </div>
              ))}
          </dl>
        </section>
      )}
    </>
  );
}
