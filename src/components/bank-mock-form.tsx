"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useSyncExternalStore } from "react";
import { createBankMock } from "@/app/u/[user]/bank/actions";
import { MockInformation } from "@/components/mock-information";
import { emptyBankMock, loadBankMock, saveBankMock, type BankMockDraft } from "@/lib/bank-draft";
import { validateMetadata, type MetadataErrors } from "@/lib/mock-validation";
import { validateBankMock } from "@/lib/bank-validation";

type Props = { bankId: string; title: string; questionCount: number };
const subscribe = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

export function BankMockForm(props: Props) {
  const hydrated = useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
  if (props.questionCount === 0) return <p className="text-sm leading-6 text-muted">Save some questions to this bank before creating a mock.</p>;
  return hydrated ? <MockForm key={props.bankId} {...props} /> : <p role="status" className="py-5 text-sm text-muted">Restoring mock information…</p>;
}

function MockForm({ bankId, title, questionCount }: Props) {
  const router = useRouter();
  const [{ draft, storageError }, setForm] = useState(() => loadBankMock(bankId, title, questionCount));
  const [fields, setFields] = useState<MetadataErrors>({});
  const [error, setError] = useState("");
  const [countError, setCountError] = useState("");
  const [savedId, setSavedId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const busy = useRef(false);
  const resetButton = useRef<HTMLButtonElement>(null);

  function commit(next: BankMockDraft) {
    const storageError = saveBankMock(bankId, next);
    setForm({ draft: next, storageError });
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    setError("");
    setSavedId(null);
    const checked = validateMetadata(draft.metadata);
    setFields(checked.errors);
    const questionLimit = Number(draft.questionLimit);
    const validCount = /^\d+$/.test(draft.questionLimit) && Number.isSafeInteger(questionLimit) && questionLimit >= 1 && questionLimit <= questionCount;
    setCountError(validCount ? "" : `Choose between 1 and ${questionCount} questions.`);
    if (!checked.value || !validCount) { setError("Check the mock information above."); return; }
    busy.current = true;
    setPending(true);
    try {
      const snapshot = { ...draft, testId: draft.testId ?? crypto.randomUUID() };
      const validation = validateBankMock({ bankId, testId: snapshot.testId, metadata: snapshot.metadata, questionLimit });
      if (!validation.value) { setError(validation.error); return; }
      commit(snapshot);
      const result = await createBankMock({ bankId, testId: snapshot.testId, metadata: snapshot.metadata, questionLimit });
      if (!result.ok) { setError(result.error); return; }
      setSavedId(result.id);
      commit(emptyBankMock(title, questionCount));
      router.refresh();
    } catch {
      setError("Creation could not be confirmed. Your form is kept; retrying will not create a second mock.");
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  return <form onSubmit={submit} className="min-w-0">
    <fieldset disabled={pending} aria-busy={pending} className="min-w-0 space-y-6">
      <p className="text-sm leading-6 text-muted">Create a mock for JK, HE, or both. New attempts draw a random selection from this bank’s current question pool ({questionCount} questions now), including questions added later. Attempts already started keep their saved questions.</p>
      <fieldset disabled={draft.testId !== null} className="min-w-0 space-y-6">
      <MockInformation value={draft.metadata} errors={fields} onChange={(metadata) => { commit({ ...draft, metadata }); setFields({}); }} />
      <div>
        <label htmlFor="bank-question-limit" className="text-sm font-medium">Questions per attempt</label>
        <input id="bank-question-limit" type="number" min={1} max={questionCount} step={1} value={draft.questionLimit} onChange={(event) => { commit({ ...draft, questionLimit: event.target.value }); setCountError(""); }} aria-invalid={!!countError} aria-describedby={countError ? "bank-limit-error bank-limit-help" : "bank-limit-help"} className="mt-2 block min-h-11 w-full rounded-md border border-line bg-white px-3 py-2.5 text-base sm:max-w-48 sm:text-sm" />
        <p id="bank-limit-help" className="mt-2 text-xs leading-5 text-muted">Up to {questionCount} questions. This count is fixed for every attempt; the questions are randomly selected each time.</p>
        {countError && <p id="bank-limit-error" className="mt-2 text-sm text-red-800">{countError}</p>}
      </div>
      </fieldset>
      {storageError && <p role="alert" className="text-sm text-amber-900">{storageError}</p>}
      {error && <p role="alert" className="text-sm text-red-800">{error}</p>}
      {savedId && <p role="status" className="border-l-2 border-accent bg-accent-soft p-4 text-sm">Mock created. <Link href={`/test/${savedId}`} className="font-medium text-accent underline underline-offset-4">Open mock</Link></p>}
      {draft.testId && !pending && <div className="text-sm">
        <p className="leading-6 text-muted">This request is kept unchanged until creation is confirmed. Retry safely, or open the mock if it was already created.</p>
        <div className="flex flex-wrap gap-x-5">
          <Link href={`/test/${draft.testId}`} className="inline-flex min-h-11 items-center text-accent underline underline-offset-4">Open mock</Link>
          <button ref={resetButton} type="button" onClick={() => setConfirmReset(true)} className="min-h-11 text-muted underline underline-offset-4">Start a new draft</button>
        </div>
        {confirmReset && <div role="group" aria-labelledby="bank-mock-reset-title" className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-4" onKeyDown={(event) => { if (event.key === "Escape") { setConfirmReset(false); resetButton.current?.focus(); } }}>
          <h3 id="bank-mock-reset-title" className="font-semibold">Start a new mock draft?</h3>
          <p className="mt-2 leading-6">This clears the form on this device. The previous mock may already exist; it will not be deleted.</p>
          <div className="mt-3 flex flex-wrap gap-3">
            <button ref={(node) => { node?.focus(); }} type="button" onClick={() => { setConfirmReset(false); resetButton.current?.focus(); }} className="min-h-11 rounded-md border border-line bg-white px-4 py-2">Cancel</button>
            <button type="button" onClick={() => { commit(emptyBankMock(title, questionCount)); setError(""); setFields({}); setCountError(""); setConfirmReset(false); }} className="min-h-11 rounded-md bg-accent px-4 py-2 text-white">Start new draft</button>
          </div>
        </div>}
      </div>}
      <button type="submit" className="min-h-11 w-full rounded-md bg-accent px-5 py-3 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50 sm:w-auto">{pending ? "Creating mock…" : draft.testId ? "Retry creation" : "Create mock"}</button>
    </fieldset>
  </form>;
}
