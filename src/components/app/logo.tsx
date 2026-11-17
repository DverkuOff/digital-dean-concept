// Собственный знак «Ориентир»: стрелка компаса в скруглённом квадрате. Не повторяет символику вузов.
export function LogoMark({ className = "size-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect width="32" height="32" rx="9" className="fill-primary" />
      <path d="M16 5.5 20.2 16 16 26.5 11.8 16Z" fill="white" opacity="0.35" />
      <path d="M16 5.5 20.2 16H11.8Z" fill="white" />
      <circle cx="16" cy="16" r="1.8" className="fill-primary" stroke="white" strokeWidth="1.2" />
    </svg>
  );
}

export function Logo() {
  return (
    <span className="flex items-center gap-2">
      <LogoMark className="size-8" />
      <span className="leading-none">
        <span className="block text-[15px] font-semibold tracking-tight">Ориентир</span>
        <span className="block text-[11px] text-muted-foreground">цифровой деканат · концепт</span>
      </span>
    </span>
  );
}
