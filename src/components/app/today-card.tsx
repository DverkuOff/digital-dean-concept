"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { CalendarClock, CalendarDays, Check, FileText, Megaphone, RefreshCcw } from "lucide-react";
import { dismissCardAction } from "@/server/actions/student";
import type { TodayCard as Card } from "@/lib/today/rules";
import { cn } from "@/lib/utils";

const ICON = { schedule: CalendarDays, retake: RefreshCcw, request: FileText, deadline: CalendarClock, news: Megaphone };
const TONE = {
  warning: "bg-warning/12 ring-warning/60 [&_.ic]:bg-warning [&_.ic]:text-warning-foreground dark:[&_.ic]:text-background",
  danger: "bg-destructive/5 ring-destructive/30 [&_.ic]:bg-destructive [&_.ic]:text-white",
  success: "bg-success/10 ring-success/40 [&_.ic]:bg-success [&_.ic]:text-white",
  info: "bg-card ring-foreground/10 [&_.ic]:bg-accent [&_.ic]:text-accent-foreground",
};

export function TodayCard({ card }: { card: Card }) {
  const [hidden, setHidden] = useState(false);
  const [pending, start] = useTransition();
  if (hidden) return null;
  const Icon = ICON[card.kind];

  return (
    <li data-testid="today-card" data-kind={card.kind} className={cn("rounded-2xl p-4 ring-1 transition-opacity", TONE[card.tone], pending && "opacity-50")}>
      <div className="flex gap-3">
        <div className="ic grid size-9 shrink-0 place-items-center rounded-xl">
          <Icon className="size-4.5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold leading-snug">{card.title}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">{card.body}</p>
          {card.extra && <p className="mt-1.5 text-sm font-medium">{card.extra}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            {card.href && (
              <Link href={card.href} className="inline-flex h-9 items-center rounded-lg bg-card px-3 text-sm font-medium ring-1 ring-foreground/15 hover:bg-muted">
                {card.cta ?? "Открыть"}
              </Link>
            )}
            <button
              type="button"
              onClick={() =>
                start(async () => {
                  setHidden(true);
                  await dismissCardAction(card.key);
                })
              }
              className="inline-flex h-9 items-center gap-1 rounded-lg px-3 text-sm font-medium text-muted-foreground hover:bg-foreground/5"
            >
              <Check className="size-4" aria-hidden /> Понял
            </button>
          </div>
        </div>
      </div>
    </li>
  );
}
