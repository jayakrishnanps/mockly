"use client";

import { useId, useRef, useState, useTransition, type FormEvent } from "react";
import { updateMockQuestionCount } from "./actions";

export function QuestionCountEditor({ testId, count, available }: {
  testId: string;
  count: number;
  available: number;
}) {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const busy = useRef(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function open() {
    setError("");
    form.current?.reset();
    dialog.current?.showModal();
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    const requested = Number(new FormData(event.currentTarget).get("count"));
    setError("");
    busy.current = true;
    startTransition(async () => {
      try {
        const result = await updateMockQuestionCount(testId, requested);
        if (result.ok) dialog.current?.close();
        else setError(result.error);
      } catch {
        setError("Could not save the question count. Please try again.");
      } finally {
        busy.current = false;
      }
    });
  }

  return <>
    <div className="flex flex-wrap items-center gap-x-3">
      <span>{count} of {available}</span>
      <button type="button" aria-label="Edit question count" onClick={open} className="inline-flex min-h-11 items-center rounded-sm px-2 text-xs font-medium underline underline-offset-4 hover:bg-accent-soft">Edit</button>
    </div>
    <dialog
      ref={dialog}
      aria-labelledby={`${id}-title`}
      aria-busy={pending}
      onCancel={(event) => { if (busy.current || pending) event.preventDefault(); }}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%_-_2rem)] max-w-sm overflow-y-auto rounded-lg border border-line bg-white p-0 text-foreground backdrop:bg-black/40"
    >
      <form ref={form} onSubmit={save} className="p-5 sm:p-6">
        <h2 id={`${id}-title`} className="text-lg font-semibold tracking-tight">Edit question count</h2>
        <p id={`${id}-help`} className="mt-2 text-sm font-normal leading-6 text-muted">Choose 1 to {available} questions for new attempts.</p>
        <label htmlFor={`${id}-count`} className="mt-4 block text-sm font-medium">Questions per attempt</label>
        <input id={`${id}-count`} name="count" type="number" inputMode="numeric" min={1} max={available} step={1} defaultValue={count} required disabled={pending} aria-describedby={`${id}-help`} aria-invalid={!!error} className="mt-2 min-h-11 w-full rounded-md border border-line px-3 py-2 text-base font-normal" />
        {error && <p role="alert" className="mt-3 text-sm font-normal leading-6">{error}</p>}
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button type="button" disabled={pending} onClick={() => dialog.current?.close()} className="min-h-11 rounded-md border border-line px-4 py-2 text-sm font-medium hover:bg-accent-soft disabled:opacity-50">Cancel</button>
          <button type="submit" disabled={pending} className="min-h-11 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50">{pending ? "Saving…" : "Save"}</button>
        </div>
      </form>
    </dialog>
  </>;
}
