"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

type Item = { key: string; href: string; label: React.ReactNode; name?: string };

/**
 * Переключатель-ссылки с подложкой («День / Неделя / Месяц», «Мне / Новости»).
 * Подложка переезжает сразу по нажатию, не дожидаясь ответа сервера: локальное состояние,
 * которое выравнивается по `active`, когда страница пришла (в том числе после «Назад»).
 */
export function SegmentedTabs({ items, active, label }: { items: Item[]; active: string; label: string }) {
  const [shown, setShown] = useState(active);
  const [prev, setPrev] = useState(active);
  if (prev !== active) {
    setPrev(active);
    setShown(active);
  }
  const idx = Math.max(0, items.findIndex((i) => i.key === shown));
  const n = items.length;

  return (
    <div className="relative mb-4 grid rounded-xl bg-muted p-1 text-sm font-medium" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }} role="tablist" aria-label={label}>
      <span
        aria-hidden
        className="absolute inset-y-1 left-1 rounded-lg bg-card shadow-sm ring-1 ring-foreground/10 transition-transform duration-250 ease-(--ease-in-out) dark:bg-foreground/15"
        style={{ width: `calc((100% - 0.5rem) / ${n})`, transform: `translateX(${idx * 100}%)` }}
      />
      {items.map((it) => {
        const on = it.key === shown;
        return (
          <Link
            key={it.key}
            role="tab"
            aria-selected={on}
            aria-label={it.name}
            href={it.href}
            onClick={(e) => {
              // Новая вкладка / окно — не двигаем подложку.
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
              setShown(it.key);
            }}
            className={cn("press relative flex min-h-10 items-center justify-center rounded-lg px-1 py-2 text-center transition-colors", on ? "text-foreground" : "text-muted-foreground hover:text-foreground")}
          >
            {it.label}
          </Link>
        );
      })}
    </div>
  );
}
