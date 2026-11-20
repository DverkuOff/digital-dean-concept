"use client";

import { useActionState, useState } from "react";
import { NotebookPen, StickyNote } from "lucide-react";
import { saveLessonNoteAction, type NoteState } from "@/server/actions/notes";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/app/submit-button";

/** Своя заметка к паре: видна только автору. */
export function LessonNote({ lessonId, note, label }: { lessonId: string; note: string | null; label: string }) {
  const [editing, setEditing] = useState(false);
  const [state, action] = useActionState<NoteState, FormData>(async (prev, fd) => {
    const res = await saveLessonNoteAction(prev, fd);
    if (res.ok) setEditing(false);
    return res;
  }, {});
  const current = state.ok ? state.text || null : note;

  if (editing) {
    return (
      <form action={action} className="mt-2 space-y-2" data-testid="note-form">
        <input type="hidden" name="lessonId" value={lessonId} />
        <Textarea
          name="text"
          defaultValue={state.text ?? current ?? ""}
          rows={2}
          maxLength={500}
          autoFocus
          placeholder="Например: принести эссе, прочитать главу 3"
          aria-label={`Заметка к паре: ${label}`}
          className="bg-card text-base"
        />
        {state.error && (
          <p role="alert" className="text-sm text-destructive">
            {state.error}
          </p>
        )}
        <div className="flex gap-2">
          <SubmitButton size="sm">Сохранить</SubmitButton>
          <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
            Отмена
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">Видна только вам. Чтобы удалить, очистите текст и сохраните.</p>
      </form>
    );
  }

  return current ? (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="mt-2 flex w-full items-start gap-1.5 rounded-lg bg-warning/15 px-2.5 py-1.5 text-left text-sm text-foreground ring-1 ring-warning/40"
      data-testid="lesson-note"
      aria-label={`Изменить заметку: ${current}`}
    >
      <StickyNote className="mt-0.5 size-3.5 shrink-0 text-warning-foreground" aria-hidden />
      <span className="min-w-0 whitespace-pre-line [overflow-wrap:anywhere]">{current}</span>
    </button>
  ) : (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="press -mx-1.5 mt-1 inline-flex min-h-8 items-center gap-1 rounded-md px-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
      data-testid="add-note"
    >
      <NotebookPen className="size-3.5" aria-hidden /> Заметка
    </button>
  );
}
