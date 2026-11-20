"use client";

import { useActionState, useEffect, useRef } from "react";
import { MessageCircleQuestion } from "lucide-react";
import type { MessageState } from "@/server/actions/messages";
import { Textarea } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/app/submit-button";
import { formatDateTime } from "@/lib/dates";
import { cn } from "@/lib/utils";

export type ThreadMessage = { id: string; author: string; authorName: string; text: string; createdAt: string };

type Props = {
  requestId: string;
  messages: ThreadMessage[];
  action: (prev: MessageState, fd: FormData) => Promise<MessageState>;
  viewer: "student" | "staff";
};

/** Переписка внутри заявки: вопрос студента и ответ учебного офиса. */
export function RequestThread({ requestId, messages, action, viewer }: Props) {
  const [state, formAction] = useActionState(action, {});
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <div data-testid="thread">
      {messages.length > 0 ? (
        <ol className="mb-3 space-y-2">
          {messages.map((m) => {
            const mine = m.author === viewer;
            return (
              <li key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")} data-testid="message" data-author={m.author}>
                <div className={cn("max-w-[85%] rounded-2xl px-3.5 py-2 text-sm", mine ? "bg-primary text-primary-foreground" : "bg-muted")}>
                  <p className={cn("text-xs", mine ? "opacity-80" : "text-muted-foreground")}>
                    {m.author === "staff" ? `${m.authorName}, учебный офис` : m.authorName} · {formatDateTime(new Date(m.createdAt))}
                  </p>
                  <p className="mt-0.5 whitespace-pre-line [overflow-wrap:anywhere]">{m.text}</p>
                </div>
              </li>
            );
          })}
        </ol>
      ) : (
        viewer === "student" && (
          <p className="mb-3 flex gap-2 text-sm text-muted-foreground">
            <MessageCircleQuestion className="mt-0.5 size-4 shrink-0" aria-hidden />
            Не понятно, что приложить или когда забрать? Спросите здесь — ответ придёт уведомлением.
          </p>
        )
      )}
      <form ref={formRef} action={formAction} className="space-y-2">
        <input type="hidden" name="requestId" value={requestId} />
        <Textarea
          name="text"
          rows={2}
          maxLength={1000}
          required
          placeholder={viewer === "student" ? "Ваш вопрос учебному офису" : "Ответ студенту"}
          aria-label={viewer === "student" ? "Вопрос учебному офису" : "Ответ студенту"}
          className="bg-card text-base"
        />
        {state.error && (
          <p role="alert" className="text-sm text-destructive">
            {state.error}
          </p>
        )}
        <SubmitButton size="sm">{viewer === "student" ? "Отправить вопрос" : "Ответить"}</SubmitButton>
      </form>
    </div>
  );
}
