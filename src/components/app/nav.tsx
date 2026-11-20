"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, FileText, GraduationCap, House, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

export const NAV = [
  { href: "/today", label: "Сегодня", icon: House, match: ["/today"] },
  { href: "/schedule", label: "Расписание", icon: CalendarDays, match: ["/schedule"] },
  { href: "/grades", label: "Учёба", icon: GraduationCap, match: ["/grades", "/rating"] },
  { href: "/requests", label: "Заявки", icon: FileText, match: ["/requests"] },
  { href: "/profile", label: "Профиль", icon: UserRound, match: ["/profile", "/notifications"] },
];

function useActive() {
  const pathname = usePathname();
  return (match: string[]) => match.some((m) => pathname === m || pathname.startsWith(m + "/"));
}

/** Нижний таббар на телефоне. */
export function BottomNav() {
  const isActive = useActive();
  return (
    <nav
      aria-label="Основная навигация"
      className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 backdrop-blur md:hidden"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {NAV.map(({ href, label, icon: Icon, match }) => {
          const active = isActive(match);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "press flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-muted-foreground",
                  active && "text-primary",
                )}
              >
                <Icon className={cn("size-5", active && "stroke-[2.4]")} aria-hidden />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Горизонтальная навигация в шапке на широком экране. */
export function TopNav() {
  const isActive = useActive();
  return (
    <nav aria-label="Основная навигация" className="hidden md:block">
      <ul className="flex gap-1">
        {NAV.map(({ href, label, match }) => {
          const active = isActive(match);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "press rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground",
                  active && "bg-accent text-accent-foreground",
                )}
              >
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
