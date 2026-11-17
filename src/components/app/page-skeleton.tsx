import { Skeleton } from "@/components/ui/skeleton";

/** Скелетон экрана: заголовок + карточки. Высоты близки к настоящим, чтобы не прыгала вёрстка. */
export function PageSkeleton({ cards = 4, hero = false }: { cards?: number; hero?: boolean }) {
  return (
    <div aria-busy="true" aria-label="Загрузка">
      <span className="sr-only">Загрузка…</span>
      <Skeleton className="mb-2 h-4 w-32" />
      <Skeleton className="mb-6 h-7 w-56" />
      {hero && <Skeleton className="mb-4 h-44 w-full rounded-2xl" />}
      <div className="space-y-2.5">
        {Array.from({ length: cards }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}
