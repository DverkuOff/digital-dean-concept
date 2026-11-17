import { LogOut } from "lucide-react";
import { requireStaff } from "@/server/session";
import { signOutAction } from "@/server/actions/auth";
import { Logo } from "@/components/app/logo";
import { Button } from "@/components/ui/button";

// Роль проверяется на сервере: студент получает 404, без сессии — редирект на вход.
export default async function StaffLayout({ children }: LayoutProps<"/staff">) {
  const staff = await requireStaff();
  return (
    <>
      <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between gap-3 px-4">
          <Logo />
          <div className="flex items-center gap-2">
            <span className="hidden text-sm text-muted-foreground sm:inline">{staff.name} · учебный офис</span>
            <form action={signOutAction}>
              <Button variant="ghost" size="icon" aria-label="Выйти">
                <LogOut aria-hidden />
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 pb-12 pt-5">{children}</main>
    </>
  );
}
