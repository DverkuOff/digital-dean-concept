"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  CalendarClock,
  CalendarDays,
  Check,
  FileText,
  Megaphone,
  RefreshCcw,
} from "lucide-react";
import { dismissCardAction } from "@/server/actions/student";
import type { TodayCard as Card } from "@/lib/today/rules";
import { cn } from "@/lib/utils";

const ICON = {
  schedule: CalendarDays,
  retake: RefreshCcw,
  request: FileText,
  deadline: CalendarClock,
  news: Megaphone,
};
const TONE = {
  warning:
    "bg-warning/12 ring-warning/60 [&_.ic]:bg-warning [&_.ic]:text-warning-foreground dark:[&_.ic]:text-background",
  danger:
    "bg-destructive/5 ring-destructive/30 [&_.ic]:bg-destructive [&_.ic]:text-white",
  success:
    "bg-success/10 ring-success/40 [&_.ic]:bg-success [&_.ic]:text-white",
  info: "bg-card ring-foreground/10 [&_.ic]:bg-accent [&_.ic]:text-accent-foreground",
};

export function TodayCard({
  card,
  hidden: collapsed = false,
  revealDelay,
}: {
  card: Card;
  hidden?: boolean;
  /** Карточка была спрятана под «Показать ещё»: при раскрытии проявляется с задержкой (лесенка). */
  revealDelay?: number;
}) {
  const [hidden, setHidden] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [, start] = useTransition();
  if (hidden) return null;
  const Icon = ICON[card.kind];

  return (
    <li
      data-testid="today-card"
      data-kind={card.kind}
      data-leaving={leaving || undefined}
      hidden={collapsed}
      className={cn(
        "collapse-out overflow-hidden rounded-2xl",
        revealDelay !== undefined && "reveal",
      )}
      style={revealDelay ? { transitionDelay: `${revealDelay}ms` } : undefined}
    >
      <div className={cn("rounded-2xl p-4 ring-1 ring-inset", TONE[card.tone])}>
        <div className="flex gap-3">
          <div className="ic grid size-9 shrink-0 place-items-center rounded-xl">
            <Icon className="size-4.5" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold leading-snug">{card.title}</p>
            <p className="mt-0.5 text-sm text-muted-foreground">{card.body}</p>
            {card.extra && (
              <p className="mt-1.5 text-sm font-medium">{card.extra}</p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              {card.href && (
                <Link
                  href={card.href}
                  className="press inline-flex h-9 items-center rounded-lg bg-card px-3 text-sm font-medium ring-1 ring-foreground/15 hover:bg-muted"
                >
                  {card.cta ?? "Открыть"}
                </Link>
              )}
              <button
                type="button"
                disabled={leaving}
                onClick={() => {
                  // Сначала карточка схлопывается (220 мс), потом убирается из списка — соседние подтягиваются плавно.
                  setLeaving(true);
                  setTimeout(() => setHidden(true), 230);
                  start(async () => {
                    await dismissCardAction(card.key);
                  });
                }}
                className="press inline-flex h-9 items-center gap-1 rounded-lg px-3 text-sm font-medium text-muted-foreground hover:bg-foreground/5"
              >
                <Check className="size-4" aria-hidden /> Понял
              </button>
            </div>
          </div>
        </div>
      </div>
    </li>
  );
}
