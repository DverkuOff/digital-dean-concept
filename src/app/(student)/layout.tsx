import Link from "next/link";
import { Bell } from "lucide-react";
import { requireStudent } from "@/server/session";
import { countMyUnread } from "@/server/dal/notifications";
import { Logo } from "@/components/app/logo";
import { BottomNav, TopNav } from "@/components/app/nav";

// Проверка сессии и роли в layout: студенческий раздел недоступен без входа и методисту (404).
export default async function StudentLayout({ children }: LayoutProps<"/">) {
  const me = await requireStudent();
  const unread = await countMyUnread();

  return (
    <>
      <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between gap-3 px-4">
          <Link href="/today" aria-label="На главную">
            <Logo />
          </Link>
          <TopNav />
          <div className="flex items-center gap-1">
            <Link
              href="/notifications"
              className="relative grid size-10 place-items-center rounded-full hover:bg-muted"
              aria-label={unread ? `Уведомления: ${unread} новых` : "Уведомления"}
              data-testid="bell"
            >
              <Bell className="size-5" aria-hidden />
              {unread > 0 && (
                <span className="absolute right-1.5 top-1.5 grid min-w-4.5 place-items-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-4.5 text-white">
                  {unread}
                </span>
              )}
            </Link>
            <Link
              href="/profile"
              className="hidden size-9 place-items-center rounded-full bg-accent text-sm font-semibold text-accent-foreground md:grid"
              aria-label="Профиль"
            >
              {me.firstName[0]}
              {me.lastName[0]}
            </Link>
          </div>
        </div>
      </header>
      <main className="pb-tabbar mx-auto w-full max-w-4xl flex-1 px-4 pt-5 md:pb-12">{children}</main>
      <BottomNav />
    </>
  );
}
