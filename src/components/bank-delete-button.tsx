"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { deleteBank } from "@/app/u/[user]/bank/actions";

const focusCancel = (node: HTMLButtonElement | null) => { node?.focus(); };

export function BankDeleteButton({ bankId }: { bankId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const busy = useRef(false);
  const trigger = useRef<HTMLButtonElement>(null);

  function cancel() {
    if (busy.current) return;
    setConfirming(false);
    trigger.current?.focus();
  }

  async function remove() {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError("");
    try {
      const result = await deleteBank(bankId);
      if (!result.ok) { setError(result.error); return; }
      router.replace("/u/JK/bank");
      router.refresh();
    } catch {
      setError("Deletion could not be confirmed. Try again; repeating this action is safe.");
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  return <section className="mt-12 border-t border-line pt-6">
    <button ref={trigger} type="button" onClick={() => setConfirming(true)} className="min-h-11 rounded-sm text-sm text-muted hover:text-red-800">Delete question bank</button>
    {confirming && <div role="group" aria-labelledby="bank-delete-title" onKeyDown={(event) => { if (event.key === "Escape") cancel(); }} className="mt-3 rounded-md border border-red-200 bg-red-50 p-4 sm:p-5">
      <h2 id="bank-delete-title" className="font-semibold text-red-950">Delete this question bank?</h2>
      <p className="mt-2 text-sm leading-6 text-red-950">This permanently deletes the bank, its questions, and every mock linked to it, including all attempts and history for both JK and HE. This cannot be undone. Older mocks without a bank link are not included.</p>
      <div className="mt-4 flex flex-wrap gap-3">
        <button ref={focusCancel} type="button" disabled={pending} onClick={cancel} className="min-h-11 rounded-md border border-line bg-white px-4 py-2 text-sm disabled:opacity-50">Cancel</button>
        <button type="button" disabled={pending} onClick={remove} className="min-h-11 rounded-md bg-red-800 px-4 py-2 text-sm font-medium text-white hover:bg-red-900 disabled:opacity-50">{pending ? "Deleting…" : "Yes, delete bank"}</button>
      </div>
      {error && <p role="alert" className="mt-3 text-sm text-red-800">{error}</p>}
    </div>}
  </section>;
}
