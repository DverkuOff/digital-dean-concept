"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "radix-ui";
import { CornerDownLeft, Loader2, Search, SearchX, X } from "lucide-react";
import { searchAction } from "@/server/actions/search";
import { MIN_QUERY, SECTIONS, type SearchHit } from "@/lib/search/match";
import { cn } from "@/lib/utils";

const QUICK: SearchHit[] = SECTIONS.slice(0, 6).map((s) => ({ group: "Разделы", title: s.title, href: s.href }));

/** Глобальный поиск: кнопка в шапке и Ctrl/⌘+K. Ищет только по своим данным (проверка на сервере). */
export function SearchDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [active, setActive] = useState(0);
  const [pending, start] = useTransition();
  const seq = useRef(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Запрос с задержкой; ответ на устаревший ввод отбрасываем.
  useEffect(() => {
    if (q.trim().length < MIN_QUERY) return;
    const id = ++seq.current;
    const t = setTimeout(() => {
      start(async () => {
        const res = await searchAction(q);
        if (id === seq.current) {
          setHits(res);
          setActive(0);
        }
      });
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  const short = q.trim().length < MIN_QUERY;
  const list = useMemo(() => (short ? QUICK : (hits ?? [])), [short, hits]);
  const groups = useMemo(() => {
    const m = new Map<string, { hit: SearchHit; i: number }[]>();
    list.forEach((hit, i) => m.set(hit.group, [...(m.get(hit.group) ?? []), { hit, i }]));
    return [...m.entries()];
  }, [list]);

  const go = (h: SearchHit) => {
    setOpen(false);
    setQ("");
    setHits(null);
    router.push(h.href);
  };

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) {
          setQ("");
          setHits(null);
        }
      }}
    >
      <Dialog.Trigger asChild>
        <button
          type="button"
          className="grid size-10 place-items-center rounded-full hover:bg-muted lg:flex lg:h-9 lg:w-auto lg:gap-2 lg:rounded-lg lg:px-3 lg:text-sm lg:text-muted-foreground lg:ring-1 lg:ring-foreground/10"
          aria-label="Поиск"
          data-testid="search-open"
        >
          <Search className="size-5 lg:size-4" aria-hidden />
          <span className="hidden lg:inline">Поиск</span>
          <kbd className="hidden whitespace-nowrap rounded bg-muted px-1.5 text-[11px] xl:inline">Ctrl K</kbd>
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-foreground/30 backdrop-blur-[2px]" />
        <Dialog.Content
          className="fixed inset-x-0 top-0 z-50 mx-auto flex max-h-[85dvh] w-full max-w-xl flex-col overflow-hidden rounded-b-2xl bg-card shadow-xl md:top-16 md:rounded-2xl"
          aria-describedby={undefined}
        >
          <Dialog.Title className="sr-only">Поиск по кабинету</Dialog.Title>
          <div className="flex items-center gap-2 border-b px-4">
            {pending ? <Loader2 className="size-5 shrink-0 animate-spin text-muted-foreground" aria-hidden /> : <Search className="size-5 shrink-0 text-muted-foreground" aria-hidden />}
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setActive((a) => Math.min(list.length - 1, a + 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setActive((a) => Math.max(0, a - 1));
                } else if (e.key === "Enter" && list[active]) {
                  e.preventDefault();
                  go(list[active]);
                }
              }}
              placeholder="Раздел, дисциплина, заявка, новость…"
              className="h-14 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
              aria-label="Что найти"
              role="combobox"
              aria-expanded="true"
              aria-controls="search-results"
              aria-activedescendant={list[active] ? `sr-${active}` : undefined}
              maxLength={60}
            />
            <Dialog.Close className="grid size-9 place-items-center rounded-lg hover:bg-muted" aria-label="Закрыть поиск">
              <X className="size-4" aria-hidden />
            </Dialog.Close>
          </div>
          <div id="search-results" role="listbox" className="overflow-y-auto p-2" data-testid="search-results">
            {!short && hits && hits.length === 0 && !pending && (
              <div className="flex flex-col items-center px-6 py-10 text-center text-sm text-muted-foreground" data-testid="search-empty">
                <SearchX className="mb-2 size-6" aria-hidden />
                Ничего не нашли. Попробуйте название предмета, справки или номер заявки.
              </div>
            )}
            {groups.map(([group, items]) => (
              <div key={group} className="mb-1">
                <p className="px-3 pb-1 pt-2 text-xs font-medium text-muted-foreground">{short ? "Быстрый переход" : group}</p>
                {items.map(({ hit, i }) => (
                  <button
                    key={`${hit.href}-${i}`}
                    id={`sr-${i}`}
                    role="option"
                    aria-selected={i === active}
                    type="button"
                    onMouseEnter={() => setActive(i)}
                    onClick={() => go(hit)}
                    className={cn("flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left", i === active && "bg-accent text-accent-foreground")}
                    data-testid="search-hit"
                    data-group={hit.group}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{hit.title}</span>
                      {hit.subtitle && <span className="block truncate text-xs text-muted-foreground">{hit.subtitle}</span>}
                    </span>
                    {i === active && <CornerDownLeft className="size-4 shrink-0 opacity-60" aria-hidden />}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
