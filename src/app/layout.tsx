import type { Metadata, Viewport } from "next";
import "@fontsource-variable/golos-text";
import "./globals.css";
import { ConceptBanner } from "@/components/app/concept-banner";

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
  themeColor: "#3b4fc4",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ru" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <ConceptBanner />
        {children}
      </body>
    </html>
  );
}
