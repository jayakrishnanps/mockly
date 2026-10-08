"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createBank } from "@/app/u/[user]/bank/actions";
import { emptyBankForm, loadBankForm, saveBankForm, type BankFormDraft } from "@/lib/bank-draft";

const subscribe = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

export function BankCreateForm() {
  const hydrated = useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
  return hydrated ? <CreateForm /> : <p role="status" className="text-sm text-muted">Restoring your draft…</p>;
}

function CreateForm() {
  const router = useRouter();
  const [{ draft, storageError }, setForm] = useState(() => loadBankForm());
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const busy = useRef(false);
  const resetButton = useRef<HTMLButtonElement>(null);

  function commit(next: BankFormDraft) {
    const storageError = saveBankForm(next);
    setForm({ draft: next, storageError });
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    if (!draft.title.trim()) { setError("Enter a name for the question bank."); return; }
    busy.current = true;
    setPending(true);
    setError("");
    try {
      const snapshot = { ...draft, id: draft.id ?? crypto.randomUUID() };
      commit(snapshot);
      const result = await createBank({ id: snapshot.id, title: snapshot.title });
      if (!result.ok) { setError(result.error); return; }
      commit(emptyBankForm());
      router.push(`/u/JK/bank/${result.id}`);
      router.refresh();
    } catch {
      setError("Creation could not be confirmed. Your draft is kept; try again safely.");
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  return <form onSubmit={submit} className="border-y border-line py-5">
    <fieldset disabled={pending} aria-busy={pending}>
      <label htmlFor="bank-name" className="text-sm font-medium">Create a question bank</label>
      <div className="mt-2 flex flex-col gap-3 sm:flex-row">
        <input id="bank-name" value={draft.title} readOnly={draft.id !== null} maxLength={200} onChange={(event) => commit({ ...draft, title: event.target.value })} placeholder="Bank name" required aria-describedby={error ? "bank-create-error" : undefined} className="min-h-11 min-w-0 flex-1 rounded-md border border-line bg-white px-3 py-2.5 text-base read-only:text-muted sm:text-sm" />
        <button type="submit" className="min-h-11 rounded-md bg-accent px-5 py-3 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50">{pending ? "Creating…" : draft.id ? "Retry creation" : "Create bank"}</button>
      </div>
      {storageError && <p role="alert" className="mt-3 text-sm text-amber-900">{storageError}</p>}
      {error && <p id="bank-create-error" role="alert" className="mt-3 text-sm text-red-800">{error}</p>}
      {draft.id && !pending && <div className="mt-3 text-sm">
        <p className="leading-6 text-muted">This name is kept unchanged until creation is confirmed. Retry to finish, or open the bank if it was already created.</p>
        <div className="flex flex-wrap gap-x-5">
          <Link href={`/u/JK/bank/${draft.id}`} className="inline-flex min-h-11 items-center text-accent underline underline-offset-4">Open bank</Link>
          <button ref={resetButton} type="button" onClick={() => setConfirmReset(true)} className="min-h-11 text-muted underline underline-offset-4">Start a new draft</button>
        </div>
        {confirmReset && <div role="group" aria-labelledby="bank-reset-title" className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-4" onKeyDown={(event) => { if (event.key === "Escape") { setConfirmReset(false); resetButton.current?.focus(); } }}>
          <h3 id="bank-reset-title" className="font-semibold">Start a new bank draft?</h3>
          <p className="mt-2 leading-6">This clears the form on this device. The previous bank may already exist; it will not be deleted.</p>
          <div className="mt-3 flex flex-wrap gap-3">
            <button ref={(node) => { node?.focus(); }} type="button" onClick={() => { setConfirmReset(false); resetButton.current?.focus(); }} className="min-h-11 rounded-md border border-line bg-white px-4 py-2">Cancel</button>
            <button type="button" onClick={() => { commit(emptyBankForm()); setError(""); setConfirmReset(false); }} className="min-h-11 rounded-md bg-accent px-4 py-2 text-white">Start new draft</button>
          </div>
        </div>}
      </div>}
    </fieldset>
  </form>;
}
