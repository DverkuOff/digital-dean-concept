import { requireStaff } from "@/server/session";
import { Logo } from "@/components/app/logo";
import { SignOutButton } from "@/components/app/sign-out-button";

// Роль проверяется на сервере: студент получает 404, без сессии — редирект на вход.
export default async function StaffLayout({ children }: LayoutProps<"/staff">) {
  const staff = await requireStaff();
  return (
    <>
      <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4">
          <Logo />
          <div className="flex items-center gap-2">
            <span className="hidden text-sm text-muted-foreground sm:inline">{staff.name} · учебный офис</span>
            <SignOutButton compact />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-12 pt-5">{children}</main>
    </>
  );
}
