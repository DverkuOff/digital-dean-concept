"use client";

import { RotateCcw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function StaffError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div role="alert" className="mx-auto mt-10 flex max-w-sm flex-col items-center text-center">
      <div className="mb-3 grid size-12 place-items-center rounded-full bg-destructive/10 text-destructive">
        <TriangleAlert className="size-6" aria-hidden />
      </div>
      <h1 className="text-lg font-semibold">Очередь не загрузилась</h1>
      <p className="mt-1 text-sm text-muted-foreground">Заявки не потерялись — попробуйте ещё раз.</p>
      <Button className="mt-5" onClick={reset}>
        <RotateCcw aria-hidden /> Повторить
      </Button>
    </div>
  );
}
