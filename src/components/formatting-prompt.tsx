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
  return <section aria-labelledby="formatting-prompt-title" className="border-l-2 border-accent/40 pl-4 sm:pl-5">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="max-w-xl">
        <h2 id="formatting-prompt-title" className="text-sm font-semibold">Need to format your questions?</h2>
        <p className="mt-1 text-sm leading-6 text-muted">Copy the instructions for options, answer keys and maths, then paste your formatted questions below.</p>
      </div>
      <button type="button" onClick={copy} className="min-h-11 shrink-0 rounded-md border border-line bg-white px-4 py-2.5 text-sm font-medium text-accent hover:border-accent hover:bg-accent-soft">Copy instructions</button>
    </div>
    <p role="status" className="text-xs leading-5 text-accent empty:hidden">{message}</p>
    <button type="button" aria-expanded={expanded} aria-controls="formatting-prompt-text" onClick={() => setExpanded(!expanded)} className="min-h-11 rounded-sm text-sm text-muted underline underline-offset-4">{expanded ? "Hide instructions" : "Read instructions"}</button>
    <div id="formatting-prompt-text" hidden={!expanded} className="mt-4">
      <label htmlFor="question-formatting-instructions" className="sr-only">Question formatting instructions</label>
      <textarea id="question-formatting-instructions" ref={text} readOnly value={FORMATTING_PROMPT} rows={14} className="w-full rounded-md border border-line bg-white p-3 text-base leading-7 sm:p-4 sm:text-sm" />
    </div>
  </section>;
}
