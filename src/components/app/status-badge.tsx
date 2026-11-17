import { STATUS_META, type RequestStatus } from "@/lib/requests/catalog";
import { cn } from "@/lib/utils";

const TONE: Record<string, string> = {
  info: "bg-info/15 text-info-foreground",
  progress: "bg-accent text-accent-foreground",
  warning: "bg-warning/25 text-warning-foreground",
  success: "bg-success/15 text-success-foreground",
  muted: "bg-muted text-muted-foreground",
  danger: "bg-destructive/10 text-destructive",
};

export function StatusBadge({ status, className }: { status: RequestStatus; className?: string }) {
  const meta = STATUS_META[status];
  return (
    <span
      data-testid="status-badge"
      className={cn("inline-flex h-6 shrink-0 items-center rounded-full px-2.5 text-xs font-medium", TONE[meta.tone], className)}
    >
      {meta.label}
    </span>
  );
}
