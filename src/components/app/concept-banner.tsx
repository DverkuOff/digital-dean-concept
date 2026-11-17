import { FlaskConical } from "lucide-react";

/** Обязательная плашка брифа: на каждой странице видно, что это концепт. */
export function ConceptBanner() {
  return (
    <div
      role="note"
      data-testid="concept-banner"
      className="border-b border-warning/40 bg-warning/15 px-4 py-1.5 text-center text-[12px] leading-snug text-warning-foreground"
    >
      <FlaskConical className="mr-1 inline size-3.5 -translate-y-px" aria-hidden />
      Концепт для конкурса MGIMO×AI CHALLENGE, не официальный сервис, данные вымышлены
    </div>
  );
}
