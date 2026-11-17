import Link from "next/link";
import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";

// Одинаковый ответ на «нет такой страницы» и «нет доступа»: не раскрываем, что запись существует.
export default function NotFound() {
  return (
    <main className="mx-auto flex max-w-sm flex-1 flex-col items-center justify-center px-4 py-16 text-center">
      <div className="mb-3 grid size-12 place-items-center rounded-full bg-accent text-accent-foreground">
        <SearchX className="size-6" aria-hidden />
      </div>
      <h1 className="text-lg font-semibold">Страница не найдена</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Такой страницы нет или у вас нет к ней доступа. Проверьте адрес или вернитесь на главную.
      </p>
      <Button asChild className="mt-5">
        <Link href="/">На главную</Link>
      </Button>
    </main>
  );
}
