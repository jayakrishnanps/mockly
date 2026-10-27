"use client";

import { useId, useRef, useState } from "react";
import { buildHEWeakReportPrompt } from "@/lib/he-weak-report";

export function HEWeakReportPrompt({ testId, title }: { testId: string; title: string }) {
  const id = useId();
  const text = useRef<HTMLTextAreaElement>(null);
  const [manualCopy, setManualCopy] = useState(false);
  const [message, setMessage] = useState("");
  const prompt = buildHEWeakReportPrompt(testId, title);

  async function copy() {
    try {
      await navigator.clipboard.writeText(prompt);
      setManualCopy(false);
      setMessage("Copied");
    } catch {
      setManualCopy(true);
      setMessage("Select and copy the prompt below.");
      requestAnimationFrame(() => { text.current?.focus(); text.current?.select(); });
    }
  }

  return <div className="mt-5 border-t border-line pt-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h3 className="text-sm font-semibold">Practice notes</h3>
        <p className="mt-1 text-xs leading-5 text-muted">Use after the TXT analysis. JK can save the Malayalam notes for HE.</p>
      </div>
      <button type="button" onClick={copy} className="min-h-11 rounded-xl border border-line bg-white px-4 py-2 text-sm font-medium text-accent hover:bg-accent-soft">Copy notes prompt</button>
    </div>
    <p role="status" className="mt-2 text-xs text-muted empty:hidden">{message}</p>
    {manualCopy && <div>
      <label htmlFor={id} className="sr-only">HE practice notes prompt</label>
      <textarea id={id} ref={text} readOnly value={prompt} rows={10} className="mt-2 w-full rounded-xl border border-line bg-white p-3 text-base leading-6 sm:text-sm" />
    </div>}
  </div>;
}
