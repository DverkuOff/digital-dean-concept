"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { TodayCard as Card } from "@/lib/today/rules";
import { TodayCard } from "@/components/app/today-card";
import { plural } from "@/lib/dates";

const FIRST = 3;

/** Первые три карточки сразу, остальные — по кнопке: «Сегодня» не превращается в длинную ленту. */
export function TodayList({ cards }: { cards: Card[] }) {
  const [all, setAll] = useState(false);
  const rest = cards.length - FIRST;
  return (
    <>
      <ul className="space-y-2.5">
        {cards.map((c, i) => (
          <TodayCard key={c.key} card={c} hidden={!all && i >= FIRST} />
        ))}
      </ul>
      {!all && rest > 0 && (
        <button
          type="button"
          onClick={() => setAll(true)}
          className="mt-2 flex w-full items-center justify-center gap-1 rounded-xl py-2.5 text-sm font-medium text-primary hover:bg-accent"
        >
          Показать ещё {rest} {plural(rest, "событие", "события", "событий")} <ChevronDown className="size-4" aria-hidden />
        </button>
      )}
    </>
  );
}
