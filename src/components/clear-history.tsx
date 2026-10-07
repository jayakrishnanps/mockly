"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { clearHistory } from "@/app/u/[user]/history/actions";
import type { User } from "@/lib/users";

const focusCancel = (node: HTMLButtonElement | null) => { node?.focus(); };

export function ClearHistory({ user }: { user: User }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const busy = useRef(false);
  const trigger = useRef<HTMLButtonElement>(null);

  function cancel() {
    if (busy.current) return;
    setConfirming(false);
    setError("");
    trigger.current?.focus();
  }

  async function remove() {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError("");
    try {
      const result = await clearHistory(user);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setConfirming(false);
      router.refresh();
    } catch {
      setError("History could not be cleared. Please try again.");
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  return (
    <div className="mt-4">
      <button ref={trigger} type="button" disabled={pending} onClick={() => setConfirming(true)} className="min-h-11 rounded-sm py-2 text-sm text-muted hover:text-red-800 disabled:opacity-50">Clear history</button>
      {confirming && (
        <div role="group" aria-labelledby="clear-history-title" onKeyDown={(event) => { if (event.key === "Escape") cancel(); }} className="mt-2 rounded-xl border border-red-200 bg-red-50 p-5">
          <h2 id="clear-history-title" className="font-semibold text-red-950">Clear {user}’s completed history?</h2>
          <p className="mt-2 text-sm leading-6 text-red-950">This permanently deletes your completed attempts and results. Your mock library, unfinished attempts, and the other person’s history stay unchanged.</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button ref={focusCancel} type="button" disabled={pending} onClick={cancel} className="min-h-11 rounded-lg border border-line bg-white px-4 py-2 text-sm disabled:opacity-50">Cancel</button>
            <button type="button" disabled={pending} onClick={remove} className="min-h-11 rounded-lg bg-red-800 px-4 py-2 text-sm font-medium text-white hover:bg-red-900 disabled:opacity-50">{pending ? "Clearing…" : "Yes, clear history"}</button>
          </div>
          {error && <p role="alert" className="mt-3 text-sm text-red-800">{error}</p>}
        </div>
      )}
    </div>
  );
}
