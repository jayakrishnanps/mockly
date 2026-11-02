"use client";

import { useId, useRef, useState } from "react";
import { PRACTICE_QUESTION_PROMPT } from "@/lib/practice-question-prompt";

export function PracticeQuestionPrompt() {
  const id = useId();
  const text = useRef<HTMLTextAreaElement>(null);
  const [manualCopy, setManualCopy] = useState(false);
  const [message, setMessage] = useState("");

  async function copy() {
    try {
      await navigator.clipboard.writeText(PRACTICE_QUESTION_PROMPT);
      setManualCopy(false);
      setMessage("Copied");
    } catch {
      setManualCopy(true);
      setMessage("Select and copy the prompt below.");
      requestAnimationFrame(() => { text.current?.focus(); text.current?.select(); });
    }
  }

  return <section aria-labelledby={`${id}-title`} className="rounded-xl border border-line bg-accent-soft/30 p-4 sm:p-5">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0 max-w-xl">
        <h2 id={`${id}-title`} className="text-sm font-semibold">Create practice questions</h2>
        <p className="mt-1 text-sm leading-6 text-muted">Use in the chat where you studied or reviewed weak areas to get 50 practice questions.</p>
      </div>
      <button type="button" onClick={copy} className="min-h-11 w-full shrink-0 rounded-lg border border-line bg-white px-4 py-2.5 text-sm font-medium text-accent hover:border-accent hover:bg-accent-soft sm:w-auto">Copy practice prompt</button>
    </div>
    <p role="status" className="mt-3 text-xs leading-5 text-accent empty:hidden">{message}</p>
    {manualCopy && <div className="mt-4">
      <label htmlFor={`${id}-text`} className="sr-only">Practice question prompt</label>
      <textarea id={`${id}-text`} ref={text} readOnly value={PRACTICE_QUESTION_PROMPT} rows={14} className="block w-full rounded-lg border border-line bg-white p-3 text-base leading-7 sm:p-4 sm:text-sm" />
    </div>}
  </section>;
}
