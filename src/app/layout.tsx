import type { Metadata, Viewport } from "next";
import "@fontsource-variable/golos-text";
import "./globals.css";
import { ConceptBanner } from "@/components/app/concept-banner";
import { THEME_INIT_SCRIPT } from "@/components/app/theme";

export const metadata: Metadata = {
  title: { default: "Ориентир — цифровой деканат (концепт)", template: "%s · Ориентир" },
  description: "Концепт личного кабинета студента для конкурса MGIMO×AI CHALLENGE. Не официальный сервис, данные вымышлены.",
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: "Ориентир", statusBarStyle: "default" },
  icons: { apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#3b4fc4" },
    { media: "(prefers-color-scheme: dark)", color: "#1a1d2e" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: класс темы ставит скрипт до гидратации.
    <html lang="ru" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col">
        <ConceptBanner />
        {children}
      </body>
    </html>
  );
}
