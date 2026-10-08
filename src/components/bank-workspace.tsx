"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { appendBankQuestions } from "@/app/u/[user]/bank/actions";
import { FormattingPrompt } from "@/components/formatting-prompt";
import { QuestionPreview } from "@/components/question-preview";
import { loadBankQuestions, retryBankBatch, saveBankQuestions, type BankQuestionDraft } from "@/lib/bank-draft";
import { parseQuestions } from "@/lib/parser";
import { appendParsedBatch, emptyStudioDraft, prepareDraftSave, type DraftProblem } from "@/lib/studio-draft";

const subscribe = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;
const quietButton = "min-h-11 shrink-0 rounded-md border border-line px-3 py-2 text-sm font-medium hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-40";
const focusCancel = (node: HTMLButtonElement | null) => { node?.focus(); };
const example = String.raw`Q1. Simplify: $\frac{3}{4} + \frac{1}{4}$
(A) $1$
(B) $\frac{1}{2}$
(C) $2$
(D) $\frac{3}{8}$
Ans: A`;

export function BankWorkspace({ bankId }: { bankId: string }) {
  const hydrated = useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
  return hydrated ? <BankEditor key={bankId} bankId={bankId} /> : <p role="status" className="py-5 text-sm text-muted">Restoring your question draft…</p>;
}

function BankEditor({ bankId }: { bankId: string }) {
  const router = useRouter();
  const [{ draft, storageError }, setWorkspace] = useState(() => loadBankQuestions(bankId));
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);
  const [saving, setSaving] = useState(false);
  const [visibleQuestions, setVisibleQuestions] = useState(20);
  const clearButton = useRef<HTMLButtonElement>(null);
  const busy = useRef(false);

  function commit(next: BankQuestionDraft) {
    const storageError = saveBankQuestions(bankId, next);
    setWorkspace({ draft: next, storageError });
  }

  function importQuestions(source: string, problemId?: string) {
    if (!source.trim()) return;
    const result = parseQuestions(source);
    commit({ ...appendParsedBatch(draft, result, () => crypto.randomUUID(), problemId), pendingQuestionIds: null });
    setNotice(`${result.valid.length} question(s) added to the draft. ${result.invalid.length} block(s) need attention.`);
    setError("");
  }

  function cancelClear() {
    setConfirmClear(false);
    clearButton.current?.focus();
  }

  function clearDraft() {
    commit({ ...emptyStudioDraft(draft.context), input: draft.input, pendingQuestionIds: null });
    cancelClear();
    setNotice("Draft questions and unresolved blocks cleared. The paste box and saved bank questions were kept.");
  }

  async function saveQuestions() {
    if (busy.current || !draft.questions.length) return;
    busy.current = true;
    setSaving(true);
    setError("");
    let saved = 0;
    try {
      let remaining: BankQuestionDraft = { ...prepareDraftSave(draft, () => crypto.randomUUID()), pendingQuestionIds: draft.pendingQuestionIds };
      commit(remaining);
      while (remaining.questions.length) {
        const batch = retryBankBatch(remaining);
        if (!batch.length) {
          setError("The next question is too large to save in one request. Remove it from this draft and shorten its source before importing again. Other unsaved questions are kept.");
          return;
        }
        remaining = { ...remaining, pendingQuestionIds: batch.map((question) => question.id) };
        commit(remaining);
        setNotice(`Saving questions… ${saved} confirmed so far.`);
        const response = await appendBankQuestions({ bankId, questions: batch });
        if (!response.ok) {
          if (!response.uncertain) commit({ ...remaining, pendingQuestionIds: null });
          setError(response.error);
          return;
        }
        const confirmed = new Set(batch.map((question) => question.id));
        remaining = { ...remaining, pendingQuestionIds: null, questions: remaining.questions.filter((question) => !confirmed.has(question.id)) };
        commit(remaining);
        saved += batch.length;
      }
      setNotice(`${saved} question(s) saved to the bank. Any unfinished paste and unresolved blocks are kept here.`);
    } catch {
      setError("The last save could not be confirmed. Unsaved questions are kept; retry safely without adding duplicates.");
    } finally {
      busy.current = false;
      setSaving(false);
      if (saved > 0) router.refresh();
    }
  }

  return <fieldset disabled={saving} aria-busy={saving} className="min-w-0 space-y-7">
    <div className="border-y border-line py-3 text-xs leading-5 text-muted">
      <p>Question draft for this bank · saved on this device as you work</p>
      {storageError && <p role="alert" className="mt-2 text-amber-900">{storageError}</p>}
    </div>
    <FormattingPrompt />
    <section aria-labelledby="bank-paste-title" className="min-w-0">
      <h2 id="bank-paste-title" className="text-lg font-semibold">Add questions</h2>
      <p id="bank-paste-help" className="mt-2 text-sm leading-6 text-muted">Paste questions using Q1., four A–D options, and an Ans: line. Use $...$ for inline maths and $$...$$ for equations.</p>
      <label htmlFor="bank-question-input" className="sr-only">Questions to import</label>
      <textarea id="bank-question-input" disabled={!!draft.pendingQuestionIds} value={draft.input} onChange={(event) => commit({ ...draft, input: event.target.value })} rows={10} spellCheck={false} placeholder={example} aria-describedby="bank-paste-help" className="mt-4 block w-full resize-y rounded-md border border-line bg-white p-3 font-mono text-base leading-7 disabled:opacity-60 sm:p-4 sm:text-sm" />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs leading-5 text-muted">Add as many batches as you need. Review before saving.</p>
        <button type="button" disabled={!draft.input.trim() || !!draft.pendingQuestionIds} onClick={() => importQuestions(draft.input)} className="min-h-11 w-full rounded-md bg-accent px-5 py-3 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-40 sm:w-auto">Check questions</button>
      </div>
    </section>
    <section aria-label="Save question draft" className="border-l-2 border-accent bg-accent-soft/60 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-semibold">{draft.questions.length} valid question(s) ready</h2>
          <p className="mt-2 text-sm leading-6 text-muted">{draft.problems.length} unresolved block(s). Saved questions stay in the bank when a mock is deleted.</p>
        </div>
        <button type="button" disabled={!draft.questions.length || saving} onClick={saveQuestions} className="min-h-11 w-full rounded-md bg-accent px-5 py-3 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-40 sm:w-auto">{saving ? "Saving…" : draft.pendingQuestionIds ? "Retry save" : "Save to bank"}</button>
      </div>
      <p role="status" className="mt-3 text-sm leading-6 text-muted empty:hidden">{notice}</p>
      {draft.pendingQuestionIds && !saving && <p className="mt-3 text-sm leading-6 text-muted">A batch is waiting for confirmation. Retry its save before editing this draft; the same questions will not be added twice.</p>}
      {error && <p role="alert" className="mt-3 text-sm leading-6 text-red-800">{error}</p>}
    </section>

    {draft.problems.length > 0 && <section aria-labelledby="bank-problems-title" className="space-y-4">
      <h2 id="bank-problems-title" className="text-lg font-semibold">Needs attention ({draft.problems.length})</h2>
      {draft.problems.map((problem) => <ProblemBlock key={problem.id} problem={problem} disabled={!!draft.pendingQuestionIds}
        onEdit={(editedSource) => commit({ ...draft, problems: draft.problems.map((item) => item.id === problem.id ? { ...item, editedSource } : item) })}
        onRepair={(source) => importQuestions(source, problem.id)}
        onDiscard={() => commit({ ...draft, problems: draft.problems.filter((item) => item.id !== problem.id) })} />)}
    </section>}

    <section aria-labelledby="bank-draft-title">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 id="bank-draft-title" className="text-lg font-semibold">Question draft ({draft.questions.length})</h2>
        <button ref={clearButton} type="button" disabled={!!draft.pendingQuestionIds || (!draft.questions.length && !draft.problems.length)} onClick={() => setConfirmClear(true)} className={quietButton}>Clear draft</button>
      </div>
      {confirmClear && !draft.pendingQuestionIds && <div role="group" aria-labelledby="bank-clear-title" className="mb-5 rounded-md border border-amber-200 bg-amber-50 p-4" onKeyDown={(event) => { if (event.key === "Escape") cancelClear(); }}>
        <h3 id="bank-clear-title" className="text-sm font-semibold text-amber-950">Clear this browser draft?</h3>
        <p className="mt-2 text-sm leading-6 text-amber-950">This removes the draft questions and unresolved blocks permanently. The paste box and questions already saved in the bank are kept.</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button ref={focusCancel} type="button" onClick={cancelClear} className={`${quietButton} bg-white`}>Cancel</button>
          <button type="button" onClick={clearDraft} className="min-h-11 rounded-md bg-red-800 px-4 py-2 text-sm font-medium text-white hover:bg-red-900">Yes, clear draft</button>
        </div>
      </div>}
      {draft.questions.length === 0 ? <p className="border-y border-line py-6 text-sm text-muted">No draft questions yet. Paste a batch above to get started.</p> : <>
        <ol className="divide-y divide-line border-y border-line" aria-label="Draft questions">
          {draft.questions.slice(0, visibleQuestions).map((question, index) => <li key={question.id} className="min-w-0 py-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold">Question {index + 1}</h3>
              <button type="button" disabled={!!draft.pendingQuestionIds} aria-label={`Remove draft question ${index + 1}`} onClick={() => commit({ ...draft, questions: draft.questions.filter((item) => item.id !== question.id) })} className={quietButton}>Remove</button>
            </div>
            <QuestionPreview question={question} number={index + 1} />
            <details className="mt-3 text-sm text-muted">
              <summary className="min-h-11 w-fit cursor-pointer py-3">Original source</summary>
              <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-md border border-line bg-white p-3 text-xs leading-6">{question.raw}</pre>
            </details>
          </li>)}
        </ol>
        {visibleQuestions < draft.questions.length && <button type="button" onClick={() => setVisibleQuestions((count) => count + 20)} className={`${quietButton} mt-4`}>Show more questions ({draft.questions.length - visibleQuestions} remaining)</button>}
      </>}
    </section>
  </fieldset>;
}

function ProblemBlock({ problem, disabled, onEdit, onRepair, onDiscard }: {
  problem: DraftProblem;
  disabled: boolean;
  onEdit: (source: string) => void;
  onRepair: (source: string) => void;
  onDiscard: () => void;
}) {
  const source = problem.editedSource ?? problem.raw;
  const label = problem.sourceNumber ? `Source Q${problem.sourceNumber}` : "Unnumbered block";
  return <fieldset disabled={disabled} className="min-w-0 rounded-md border border-amber-200 bg-amber-50/50 p-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h3 className="text-sm font-semibold text-amber-950">{label}</h3>
      <button type="button" onClick={onDiscard} className={quietButton}>Discard block</button>
    </div>
    <ul className="mt-3 list-disc space-y-1 pl-5 text-sm leading-6 text-amber-950">
      {problem.errors.map((error, index) => <li key={index}>{error.line ? `Line ${error.line}: ` : ""}{error.message}</li>)}
    </ul>
    <details className="mt-3 text-sm text-muted">
      <summary className="min-h-11 w-fit cursor-pointer py-3">Original pasted block</summary>
      <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-md bg-white p-3 text-xs leading-6">{problem.raw}</pre>
    </details>
    <label htmlFor={`bank-repair-${problem.id}`} className="mt-3 block text-sm font-medium">Repair this block</label>
    <textarea id={`bank-repair-${problem.id}`} value={source} onChange={(event) => onEdit(event.target.value)} rows={7} spellCheck={false} className="mt-2 block w-full resize-y rounded-md border border-amber-200 bg-white p-3 font-mono text-base leading-7 sm:text-sm" />
    <button type="button" onClick={() => onRepair(source)} disabled={!source.trim()} className={`${quietButton} mt-3 bg-white`}>Recheck block</button>
  </fieldset>;
}
