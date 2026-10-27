"use client";

import { useId, useRef, useState } from "react";
import { buildWeakAreaReportPrompt } from "@/lib/weak-area-report";

export function WeakAreaReportPrompt({ testId, title }: { testId: string; title: string }) {
  const id = useId();
  const text = useRef<HTMLTextAreaElement>(null);
  const [manualCopy, setManualCopy] = useState(false);
  const [message, setMessage] = useState("");
  const prompt = buildWeakAreaReportPrompt(testId, title);

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
        <h3 className="text-sm font-semibold">Save your weak areas</h3>
        <p className="mt-1 text-xs leading-5 text-muted">Use after the TXT analysis, then paste the report in Weak areas.</p>
      </div>
      <button type="button" onClick={copy} className="min-h-11 rounded-md border border-line bg-white px-4 py-2 text-sm font-medium hover:bg-black hover:text-white">Copy report prompt</button>
    </div>
    <p role="status" className="mt-2 text-xs text-muted empty:hidden">{message}</p>
    {manualCopy && <div id={id}>
      <label htmlFor={`${id}-text`} className="sr-only">Weak area report prompt</label>
      <textarea id={`${id}-text`} ref={text} readOnly value={prompt} rows={10} className="mt-2 w-full rounded-md border border-line bg-white p-3 text-base leading-6 sm:text-sm" />
    </div>}
  </div>;
}
