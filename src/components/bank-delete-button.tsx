"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteBank } from "@/app/u/[user]/bank/actions";

export function BankDeleteButton({ bankId, bankTitle, variant = "page", onDeleted }: {
  bankId: string;
  bankTitle?: string;
  variant?: "page" | "list";
  onDeleted?: () => void;
}) {
  const router = useRouter();
  const id = useId();
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const busy = useRef(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const cancelButton = useRef<HTMLButtonElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (confirming && !dialog.current?.open) {
      dialog.current?.showModal();
      cancelButton.current?.focus();
    } else if (!confirming && dialog.current?.open) {
      dialog.current.close();
    }
  }, [confirming]);

  function cancel() {
    if (busy.current || pending) return;
    setConfirming(false);
  }

  async function remove() {
    if (!confirming || busy.current) return;
    busy.current = true;
    setError("");
    try {
      const result = await deleteBank(bankId);
      if (!result.ok) { setError(result.error); return; }
      setConfirming(false);
      if (variant === "list") onDeleted?.();
      else router.replace("/u/JK/bank");
    } catch {
      setError("Deletion could not be confirmed. Try again; repeating this action is safe.");
    } finally {
      busy.current = false;
    }
  }

  return <div className={variant === "list" ? "shrink-0" : "mt-12 border-t border-line pt-6"}>
    <button
      ref={trigger}
      type="button"
      disabled={pending}
      aria-label={bankTitle ? `Delete question bank: ${bankTitle}` : "Delete question bank"}
      title="Delete question bank"
      onClick={() => { setError(""); setConfirming(true); }}
      className={variant === "list"
        ? "flex size-11 items-center justify-center rounded-md border border-line bg-white text-muted hover:bg-black hover:text-white disabled:opacity-50"
        : "min-h-11 rounded-sm text-sm text-muted hover:text-black"}
    >{variant === "list" ? <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v5m4-5v5" /></svg> : "Delete question bank"}</button>
    <dialog
      ref={dialog}
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-description`}
      aria-busy={pending}
      onCancel={(event) => { event.preventDefault(); cancel(); }}
      onClose={() => { setConfirming(false); trigger.current?.focus(); }}
      onClick={(event) => { if (event.target === event.currentTarget) cancel(); }}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%_-_2rem)] max-w-lg overflow-y-auto rounded-xl border border-line bg-white p-0 text-foreground backdrop:bg-black/40"
    ><div className="p-5 sm:p-6">
      <h2 id={`${id}-title`} className="text-lg font-semibold tracking-tight">Delete this question bank?</h2>
      {bankTitle && <p className="mt-2 break-words text-sm font-medium">{bankTitle}</p>}
      <p id={`${id}-description`} className="mt-3 text-sm leading-6 text-muted">This permanently deletes the bank, its questions, and every mock linked to it, including all attempts and history for both JK and HE, plus JK&apos;s Weak area reports and HE&apos;s practice notes. This cannot be undone. Older mocks without a bank link are not included.</p>
      <div className="mt-4 flex flex-wrap gap-3">
        <button ref={cancelButton} type="button" disabled={pending} onClick={cancel} className="min-h-11 rounded-md border border-line bg-white px-4 py-2 text-sm hover:bg-accent-soft disabled:opacity-50">Cancel</button>
        <button type="button" disabled={pending} onClick={() => startTransition(remove)} className="min-h-11 rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-black/80 disabled:opacity-50">{pending ? "Deleting…" : "Yes, delete bank"}</button>
      </div>
      {error && <p role="alert" className="mt-3 border-l-2 border-black pl-3 text-sm leading-6">{error}</p>}
    </div></dialog>
  </div>;
}
