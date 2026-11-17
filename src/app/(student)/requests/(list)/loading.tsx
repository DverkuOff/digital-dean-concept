import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Загрузка">
      <Skeleton className="mb-2 h-7 w-48" />
      <Skeleton className="mb-6 h-4 w-64" />
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="mb-2 h-20 w-full rounded-xl" />
      ))}
    </div>
  );
}
