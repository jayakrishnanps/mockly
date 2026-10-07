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
  return <section aria-labelledby="formatting-prompt-title" className="rounded-2xl border border-accent/20 bg-accent-soft/40 p-5 sm:p-7">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="max-w-xl">
        <p className="eyebrow">BEFORE YOU PASTE</p>
        <h2 id="formatting-prompt-title" className="mt-2 text-lg font-semibold tracking-tight">Get your questions ready</h2>
        <p className="mt-2 text-sm leading-6 text-muted">Copy the formatting instructions for your question set. They cover options, answer keys and mathematical notation. Paste the formatted questions below when ready.</p>
      </div>
      <button type="button" onClick={copy} className="min-h-11 shrink-0 rounded-lg border border-accent/30 bg-white px-4 py-2.5 text-sm font-medium text-accent hover:bg-accent-soft">Copy instructions</button>
    </div>
    <p role="status" className="mt-3 text-xs leading-5 text-accent">{message}</p>
    <button type="button" aria-expanded={expanded} aria-controls="formatting-prompt-text" onClick={() => setExpanded(!expanded)} className="mt-2 min-h-9 rounded-sm text-xs font-medium text-muted underline underline-offset-4">{expanded ? "Hide instructions" : "Read instructions"}</button>
    <div id="formatting-prompt-text" hidden={!expanded} className="mt-4">
      <label htmlFor="question-formatting-instructions" className="sr-only">Question formatting instructions</label>
      <textarea id="question-formatting-instructions" ref={text} readOnly value={FORMATTING_PROMPT} rows={14} className="w-full rounded-xl border border-line bg-white p-4 text-sm leading-6" />
    </div>
  </section>;
}
