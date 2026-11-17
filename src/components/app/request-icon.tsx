import { CalendarX2, FileText, Languages, MessagesSquare, RefreshCcw, Shield } from "lucide-react";
import type { RequestTypeDef } from "@/lib/requests/catalog";

const ICONS = { file: FileText, shield: Shield, calendar: CalendarX2, languages: Languages, refresh: RefreshCcw, messages: MessagesSquare };

export function RequestIcon({ icon, className = "size-5" }: { icon: RequestTypeDef["icon"]; className?: string }) {
  const Icon = ICONS[icon] ?? FileText;
  return <Icon className={className} aria-hidden />;
}
