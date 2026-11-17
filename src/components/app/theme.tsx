"use client";

import { useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

export type ThemeChoice = "light" | "dark" | "system";
const KEY = "orientir-theme";

/**
 * Скрипт в <head>: ставит класс до первой отрисовки, без вспышки светлой темы.
 * Выбор хранится в localStorage — это настройка устройства, а не персональные данные.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("${KEY}")||"system";var d=t==="dark"||(t==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d);}catch(e){}})();`;

function apply(choice: ThemeChoice) {
  const dark = choice === "dark" || (choice === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

const listeners = new Set<() => void>();
function subscribe(cb: () => void) {
  listeners.add(cb);
  const mq = matchMedia("(prefers-color-scheme: dark)");
  const onSystem = () => {
    if (read() === "system") apply("system");
  };
  mq.addEventListener("change", onSystem);
  return () => {
    listeners.delete(cb);
    mq.removeEventListener("change", onSystem);
  };
}
function read(): ThemeChoice {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

const OPTIONS: { value: ThemeChoice; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Светлая", icon: Sun },
  { value: "dark", label: "Тёмная", icon: Moon },
  { value: "system", label: "Как в системе", icon: Monitor },
];

export function ThemeSwitcher() {
  const choice = useSyncExternalStore(subscribe, read, () => "system" as ThemeChoice);
  const set = (v: ThemeChoice) => {
    try {
      localStorage.setItem(KEY, v);
    } catch {}
    apply(v);
    listeners.forEach((l) => l());
  };
  return (
    <div role="radiogroup" aria-label="Оформление" className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1" data-testid="theme-switcher">
      {OPTIONS.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={choice === value}
          onClick={() => set(value)}
          className={cn(
            "flex flex-col items-center gap-0.5 rounded-lg py-2 text-xs font-medium text-muted-foreground",
            choice === value && "bg-card text-foreground shadow-sm",
          )}
        >
          <Icon className="size-4" aria-hidden />
          {label}
        </button>
      ))}
    </div>
  );
}
