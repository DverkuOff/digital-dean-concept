"use client";

import { useActionState, useState } from "react";
import { changeStatusAction, type StaffState } from "@/server/actions/staff";
import { COMMENT_REQUIRED, STAFF_ACTION_LABEL, type RequestStatus } from "@/lib/requests/catalog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Props = { requestId: string; transitions: RequestStatus[]; fields: { name: string; label: string }[] };

export function StaffActions({ requestId, transitions, fields }: Props) {
  const [state, action, pending] = useActionState<StaffState, FormData>(changeStatusAction, {});
  const [mode, setMode] = useState<RequestStatus | null>(null);
  const positive = transitions.filter((t) => !COMMENT_REQUIRED.includes(t));
  const negative = transitions.filter((t) => COMMENT_REQUIRED.includes(t));

  return (
    <div>
      {!mode && (
        <form action={action} className="flex flex-wrap gap-2">
          <input type="hidden" name="requestId" value={requestId} />
          {positive.map((t) => (
            <Button key={t} type="submit" name="to" value={t} disabled={pending}>
              {STAFF_ACTION_LABEL[t]}
            </Button>
          ))}
          {negative.map((t) => (
            <Button key={t} type="button" variant={t === "rejected" ? "ghost" : "outline"} onClick={() => setMode(t)}>
              {STAFF_ACTION_LABEL[t]}
            </Button>
          ))}
        </form>
      )}
      {mode && (
        <form action={action} className="space-y-3 rounded-xl bg-muted/50 p-3">
          <input type="hidden" name="requestId" value={requestId} />
          <input type="hidden" name="to" value={mode} />
          {mode === "returned" && fields.length > 0 && (
            <div className="space-y-1.5">
              <Label htmlFor={`rf-${requestId}`}>Какое поле исправить</Label>
              <select id={`rf-${requestId}`} name="returnField" className="h-11 w-full rounded-lg border border-input bg-card px-3 text-base">
                <option value="">Без конкретного поля</option>
                {fields.map((f) => (
                  <option key={f.name} value={f.name}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor={`c-${requestId}`}>{mode === "returned" ? "Причина возврата" : "Причина отказа"} (студент увидит её)</Label>
            <Textarea id={`c-${requestId}`} name="comment" required rows={3} className="bg-card text-base" />
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={pending}>
              {STAFF_ACTION_LABEL[mode]}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setMode(null)}>
              Отмена
            </Button>
          </div>
        </form>
      )}
      {state.error && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {state.error}
        </p>
      )}
    </div>
  );
}
