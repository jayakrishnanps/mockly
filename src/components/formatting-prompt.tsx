"use client";

import { useRef, useState } from "react";
import { FORMATTING_PROMPT } from "@/lib/formatting-prompt";

export function FormattingPrompt() {
  const [message, setMessage] = useState("");
  const [expanded, setExpanded] = useState(false);
  const text = useRef<HTMLTextAreaElement>(null);
  async function copy() {
    try {
      await navigator.clipboard.writeText(FORMATTING_PROMPT);
      setMessage("Instructions copied. Use them to format your questions, then paste the result below.");
    } catch {
      setExpanded(true);
      setMessage("Copy was unavailable. Select the prompt below and copy it manually.");
      requestAnimationFrame(() => { text.current?.focus(); text.current?.select(); });
    }
  }
  return <section aria-labelledby="formatting-prompt-title" className="rounded-xl border border-line bg-accent-soft/30 p-4 sm:p-5">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0 max-w-xl">
        <h2 id="formatting-prompt-title" className="text-sm font-semibold">Need to format your questions?</h2>
        <p className="mt-1 text-sm leading-6 text-muted">Copy the instructions for options, answer keys and maths, then paste your formatted questions below.</p>
      </div>
      <button type="button" onClick={copy} className="min-h-11 w-full shrink-0 rounded-lg border border-line bg-white px-4 py-2.5 text-sm font-medium text-accent hover:border-accent hover:bg-accent-soft sm:w-auto">Copy instructions</button>
    </div>
    <p role="status" className="mt-3 text-xs leading-5 text-accent empty:hidden">{message}</p>
    <button type="button" aria-expanded={expanded} aria-controls="formatting-prompt-text" onClick={() => setExpanded(!expanded)} className="mt-1 min-h-11 rounded-md text-sm text-muted underline underline-offset-4 hover:text-accent">{expanded ? "Hide instructions" : "Read instructions"}</button>
    <div id="formatting-prompt-text" hidden={!expanded} className="mt-4">
      <label htmlFor="question-formatting-instructions" className="sr-only">Question formatting instructions</label>
      <textarea id="question-formatting-instructions" ref={text} readOnly value={FORMATTING_PROMPT} rows={14} className="block w-full rounded-lg border border-line bg-white p-3 text-base leading-7 sm:p-4 sm:text-sm" />
    </div>
  </section>;
}
