"use client";

import { useActionState } from "react";
import type { FieldDef, RequestTypeDef } from "@/lib/requests/catalog";
import type { FormState } from "@/server/actions/requests";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/app/submit-button";
import { cn } from "@/lib/utils";
import { formatFormDate } from "@/lib/requests/validate";

type Props = {
  def: RequestTypeDef;
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  initial?: Record<string, string>;
  requestId?: string;
  highlight?: string | null;
  submitLabel: string;
};

export function RequestForm({ def, action, initial = {}, requestId, highlight, submitLabel }: Props) {
  const [state, formAction] = useActionState(action, {});
  const values = { ...initial, ...(state.values ?? {}) };

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <input type="hidden" name="type" value={def.key} />
      {requestId && <input type="hidden" name="requestId" value={requestId} />}
      {def.fields.map((f) => (
        <Field key={f.name} f={f} value={values[f.name]} error={state.fieldErrors?.[f.name]} highlight={highlight === f.name} />
      ))}
      {state.error && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}
      {state.ok && (
        <p role="status" className="rounded-lg bg-success/15 px-3 py-2 text-sm text-success-foreground">
          Заявка подана повторно
        </p>
      )}
      <SubmitButton size="lg" className="w-full">
        {submitLabel}
      </SubmitButton>
    </form>
  );
}

function Field({ f, value, error, highlight }: { f: FieldDef; value?: string; error?: string; highlight: boolean }) {
  const id = `f-${f.name}`;
  const common = {
    id,
    name: f.name,
    defaultValue: value ?? (f.kind === "number" ? String(f.min) : ""),
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? `${id}-err` : undefined,
  };
  return (
    <div className={cn("space-y-1.5", highlight && "-mx-3 rounded-xl bg-warning/15 p-3 ring-1 ring-warning/60")}>
      <Label htmlFor={id}>
        {f.label}
        {f.required && <span className="text-destructive"> *</span>}
      </Label>
      {highlight && <p className="text-xs font-medium text-warning-foreground">Методист просит исправить это поле</p>}
      {f.kind === "textarea" ? (
        <Textarea {...common} rows={3} placeholder={f.placeholder} maxLength={f.maxLength} className="bg-card text-base" />
      ) : f.kind === "select" ? (
        <select
          {...common}
          className="h-11 w-full rounded-lg border border-input bg-card px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive"
        >
          {!f.required && <option value="">—</option>}
          {f.required && !value && <option value="">Выберите…</option>}
          {f.options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      ) : f.kind === "number" ? (
        <Input {...common} type="number" inputMode="numeric" min={f.min} max={f.max} />
      ) : f.kind === "date" ? (
        // Свой ввод вместо type=date: у type=date формат зависит от языка браузера (mm/dd/yyyy в английском Chrome).
        <Input
          {...common}
          defaultValue={value ? formatFormDate(value) : ""}
          inputMode="numeric"
          placeholder="дд.мм.гггг"
          maxLength={10}
          autoComplete="off"
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, "").slice(0, 8);
            const parts = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean);
            e.target.value = parts.join(".");
          }}
        />
      ) : (
        <Input {...common} placeholder={f.placeholder} maxLength={f.maxLength} />
      )}
      {error && (
        <p id={`${id}-err`} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
