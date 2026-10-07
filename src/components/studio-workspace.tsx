"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { saveMock, type SaveResult } from "@/app/studio/actions";
import { MockInformation } from "@/components/mock-information";
import { FormattingPrompt } from "@/components/formatting-prompt";
import { validateMetadata, type MetadataErrors } from "@/lib/mock-validation";
import { getRememberedUser } from "@/lib/users";
import { EmptyState } from "@/components/empty-state";
import { QuestionPreview } from "@/components/question-preview";
import { parseQuestions } from "@/lib/parser";
import {
  appendParsedBatch, emptyStudioDraft, loadStudioDraft, saveStudioDraft,
  prepareDraftSave, clearSavedDraft, studioStorageKey,
  type DraftProblem, type StudioDraft, type StudioContext,
} from "@/lib/studio-draft";

const subscribe = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;
const quietButton = "min-h-11 shrink-0 cursor-pointer rounded-md border border-line px-3 py-2 text-sm font-medium hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-40";
const focusConfirmation = (node: HTMLButtonElement | null) => { node?.focus(); };

const example = String.raw`Q1. Simplify: $\frac{\frac{3}{4}}{\frac{5}{6}}$
(A) $\frac{9}{10}$
(B) $\frac{5}{8}$
(C) $\frac{3}{2}$
(D) $1$
Ans: A`;

type TargetMock = { id: string; title: string; forUsers: string[] };

export function StudioWorkspace({ target = null }: { target?: TargetMock | null }) {
  // Mount the editor only after hydration, so storage never produces an SSR
  // mismatch or gets overwritten by an initial empty server-side state.
  const hydrated = useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
  const context: StudioContext = target ? { kind: "append", testId: target.id } : { kind: "new" };
  return hydrated ? <StudioEditor key={studioStorageKey(context)} context={context} target={target} /> : <p role="status" className="py-12 text-sm text-muted">Restoring your browser draft…</p>;
}

function StudioEditor({ context, target }: { context: StudioContext; target: TargetMock | null }) {
  const [{ draft, storageError }, setWorkspace] = useState(() => loadStudioDraft(undefined, context));
  const [notice, setNotice] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);
  const clearButton = useRef<HTMLButtonElement>(null);
  const savingRef = useRef(false);
  const [saving, setSaving] = useState(false);
  const [fields, setFields] = useState<MetadataErrors>({});
  const [result, setResult] = useState<SaveResult | null>(null);

  function commit(next: StudioDraft) {
    const error = saveStudioDraft(next);
    setWorkspace({ draft: next, storageError: error });
  }

  function importQuestions(source: string, problemId?: string) {
    if (!source.trim()) return;
    const result = parseQuestions(source);
    commit(appendParsedBatch(draft, result, () => crypto.randomUUID(), problemId));
    setNotice(`${result.valid.length} question${result.valid.length === 1 ? "" : "s"} added. ${result.invalid.length} block${result.invalid.length === 1 ? " needs" : "s need"} attention.`);
  }

  function clearDraft() {
    commit({ ...emptyStudioDraft(context), metadata: draft.metadata, input: draft.input });
    setConfirmClear(false);
    setNotice("Draft cleared. Text in the paste box was kept.");
  }

  async function submitDraft() {
    if (savingRef.current) return;
    setResult(null);
    if (context.kind === "new") {
      const checked = validateMetadata(draft.metadata);
      setFields(checked.errors);
      if (!checked.value) {
        setResult({ ok: false, error: "Check the mock information above." });
        document.getElementById("mock-info-title")?.scrollIntoView({ block: "center" });
        return;
      }
    }
    if (!draft.questions.length) {
      setResult({ ok: false, error: "Add at least one valid question before saving." });
      return;
    }
    savingRef.current = true;
    setSaving(true);
    try {
      const snapshot = prepareDraftSave(draft, () => crypto.randomUUID());
      commit(snapshot);
      const response = await saveMock({
        mode: context.kind === "new" ? "create" : "append",
        testId: context.kind === "append" ? context.testId : snapshot.submissionId,
        metadata: snapshot.metadata,
        questions: snapshot.questions.map(({ id, questionText, options, correctIndex }) => ({ id, questionText, options, correctIndex })),
      });
      setResult(response);
      if (response.ok) {
        commit(clearSavedDraft(snapshot));
        setNotice("Saved to Neon. Unparsed text and unresolved blocks, if any, were kept.");
      } else setFields(response.fields ?? {});
    } catch {
      setResult({ ok: false, error: "The save could not be confirmed. Your entire draft has been kept. Retry safely when the connection is back." });
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  function cancelClear() {
    setConfirmClear(false);
    clearButton.current?.focus();
  }

  const counts = draft.lastBatch ?? { parsed: 0, valid: 0, problems: 0 };

  return (
    <fieldset disabled={saving} aria-busy={saving} className="min-w-0 space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-y border-line py-3 text-xs leading-5 text-muted">
        <p>Browser draft · shared by JK and HE on this device</p>
        <p role="status">{storageError ? "Changes may not be saved" : "Saved locally as you work"}</p>
      </div>
      {storageError && <p role="alert" className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">{storageError}</p>}

      {target ? (
        <section className="border-b border-line pb-6">
          <p className="text-sm text-muted">Adding questions to</p>
          <h2 className="mt-2 break-words text-xl font-semibold">{target.title}</h2>
          <p className="mt-2 text-sm leading-6 text-muted">New questions will follow its saved questions. This draft is separate from your new-mock draft.</p>
          <div className="mt-2 flex flex-wrap gap-x-5 text-sm text-accent">
            <Link href={`/test/${target.id}`} className="inline-flex min-h-11 items-center underline underline-offset-4">View mock</Link>
            <Link href="/studio" className="inline-flex min-h-11 items-center underline underline-offset-4">New-mock draft</Link>
          </div>
        </section>
      ) : <MockInformation value={draft.metadata} errors={fields} onChange={(metadata) => { commit({ ...draft, metadata }); setFields({}); }} />}

      {result?.ok && (
        <section role="status" className="border-l-2 border-accent bg-accent-soft p-4 sm:p-5">
          <h2 className="text-lg font-semibold">{target ? "Questions added." : "Mock saved."}</h2>
          <p className="mt-2 text-sm leading-6">Your saved questions are now available in the mock. Any unresolved blocks and unparsed text remain here.</p>
          <div className="mt-2 flex flex-wrap gap-x-5 text-sm font-medium text-accent">
            <Link href={`/test/${result.id}`} className="inline-flex min-h-11 items-center underline underline-offset-4">Open saved mock</Link>
            <Link href={`/u/${getRememberedUser() ?? result.forUsers[0] ?? "JK"}`} className="inline-flex min-h-11 items-center underline underline-offset-4">Back to dashboard</Link>
          </div>
        </section>
      )}

      <FormattingPrompt />
      <section aria-labelledby="paste-title" className="min-w-0">
        <div className="mb-4">
          <h2 id="paste-title" className="text-lg font-semibold tracking-tight">Paste your questions</h2>
          <p id="paste-help" className="mt-2 text-sm leading-6 text-muted">
            Start each question with Q1., Q2., and so on. Use A–D options and one answer line. Question numbers can repeat or skip.
          </p>
        </div>
        <label htmlFor="question-input" className="sr-only">Question text to import</label>
        <textarea
          id="question-input"
          aria-describedby="paste-help"
          value={draft.input}
          onChange={(event) => commit({ ...draft, input: event.target.value })}
          spellCheck={false}
          rows={12}
          placeholder={example}
          className="block w-full resize-y rounded-md border border-line bg-white p-3 font-mono text-base leading-7 placeholder:text-muted/65 sm:p-4 sm:text-sm"
        />
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
          <p className="max-w-lg text-xs leading-5 text-muted">
            Use $...$ for inline math or $$...$$ for equations. Plain 3/4 stays plain text. Only valid questions join the draft.
          </p>
          <button type="button" onClick={() => importQuestions(draft.input)} disabled={!draft.input.trim()} className="min-h-11 w-full shrink-0 cursor-pointer rounded-md bg-accent px-5 py-3 text-sm font-medium text-white hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto">
            Add questions
          </button>
        </div>
        <details className="mt-3 text-sm text-muted">
          <summary className="min-h-11 w-fit cursor-pointer rounded-sm py-3 font-medium">Format guide &amp; example</summary>
          <p className="mt-3 leading-6">Options: (A), A) or A. · Answers: Ans: A, Answer: A or Correct: A. Lowercase letters also work. Question and option text can span multiple lines.</p>
          <pre className="mt-3 overflow-x-auto rounded-md border border-line bg-white p-4 text-xs leading-6">{example}</pre>
          <p className="mt-3 leading-6">Use question, option and answer markers at the start of their own lines. Keep explanations before the answer. Unrenderable math is shown in red for review.</p>
        </details>
      </section>

      <section aria-label="Import counts">
        <p className="mb-3 text-sm font-medium">Latest check</p>
        <dl className="grid grid-cols-2 gap-x-5 gap-y-4 border-y border-line py-4 sm:grid-cols-4">
          {[
            { label: "Parsed questions", value: counts.parsed },
            { label: "Valid", value: counts.valid },
            { label: "Problems", value: counts.problems },
            { label: "Draft total", value: draft.questions.length },
          ].map(({ label, value }) => (
            <div key={label}>
              <dt className="text-xs text-muted">{label}</dt>
              <dd className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">{value}</dd>
            </div>
          ))}
        </dl>
        <p role="status" className="mt-3 text-sm leading-6 text-muted empty:hidden">{notice}</p>
      </section>

      <section aria-label="Save draft" className="border-l-2 border-accent bg-accent-soft/60 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-semibold">{draft.questions.length} valid question{draft.questions.length === 1 ? "" : "s"} ready</h2>
            <p className="mt-2 text-sm leading-6 text-muted">{draft.problems.length ? `${draft.problems.length} unresolved block(s) will stay in this browser for repair.` : "Review the preview below before saving."}</p>
          </div>
          <button type="button" onClick={submitDraft} disabled={saving || !draft.questions.length} className="min-h-11 w-full shrink-0 cursor-pointer rounded-md bg-accent px-5 py-3 text-sm font-medium text-white hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto">
            {saving ? "Saving…" : target ? "Save added questions" : "Save mock"}
          </button>
        </div>
        {saving && <p role="status" className="mt-3 text-sm text-muted">Saving. Keep this page open.</p>}
        {result && !result.ok && <div role="alert" className="mt-4 text-sm leading-6 text-red-800">
          <p>{result.error}</p>
          {result.existingId && <Link href={`/test/${result.existingId}`} className="mt-2 inline-block underline">Review the existing mock</Link>}
        </div>}
      </section>

      {draft.problems.length > 0 && (
        <section aria-labelledby="problems-title" className="space-y-4">
          <div>
            <h2 id="problems-title" className="text-xl font-semibold tracking-tight">Needs attention <span className="text-muted">({draft.problems.length})</span></h2>
            <p className="mt-2 text-sm leading-6 text-muted">These blocks are kept separately and are not in your draft. Repair a block, then recheck it.</p>
          </div>
          {draft.problems.map((problem) => (
            <ProblemCard
              key={problem.id}
              problem={problem}
              onEdit={(editedSource) => commit({
                ...draft,
                problems: draft.problems.map((item) => item.id === problem.id ? { ...item, editedSource } : item),
              })}
              onRepair={(source) => importQuestions(source, problem.id)}
              onDiscard={() => {
                commit({ ...draft, problems: draft.problems.filter((item) => item.id !== problem.id) });
                setNotice("Unresolved block removed.");
              }}
            />
          ))}
        </section>
      )}

      <section aria-labelledby="draft-title" className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 id="draft-title" className="text-xl font-semibold tracking-tight">Question draft <span className="text-muted">({draft.questions.length})</span></h2>
            <p className="mt-2 text-sm leading-6 text-muted">Check the wording, maths and correct answers before saving your mock.</p>
          </div>
          <button ref={clearButton} type="button" onClick={() => setConfirmClear(true)} disabled={!draft.questions.length && !draft.problems.length} className={quietButton}>Clear draft</button>
        </div>
        {confirmClear && (
          <div role="group" aria-labelledby="clear-confirm-title" className="rounded-md border border-amber-200 bg-amber-50 p-4 sm:p-5" onKeyDown={(event) => {
            if (event.key === "Escape") cancelClear();
          }}>
            <h3 id="clear-confirm-title" className="text-sm font-semibold text-amber-950">Clear this browser draft?</h3>
            <p className="mt-2 text-sm leading-6 text-amber-950">This removes {draft.questions.length} draft question(s) and {draft.problems.length} unresolved block(s). It cannot be undone. Text in the paste box will be kept.</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <button ref={focusConfirmation} type="button" onClick={cancelClear} className={`${quietButton} bg-white`}>Cancel</button>
              <button type="button" onClick={clearDraft} className="min-h-11 cursor-pointer rounded-md bg-red-800 px-3 py-2 text-sm font-medium text-white hover:bg-red-900">Yes, clear draft</button>
            </div>
          </div>
        )}
        {!draft.questions.length ? (
          <EmptyState title="No draft questions yet.">Paste a batch above to review the questions and answers here.</EmptyState>
        ) : (
          <ol className="divide-y divide-line border-y border-line" aria-label="Draft questions">
            {draft.questions.map((question, index) => (
              <li key={question.id}>
                <article aria-label={`Draft question ${index + 1}`} className="min-w-0 py-6 sm:py-8">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="text-sm font-semibold">Question {index + 1}</h3>
                      {question.sourceNumber !== null && <span className="text-xs text-muted">Source Q{question.sourceNumber}</span>}
                    </div>
                    <button type="button" aria-label={`Remove question ${index + 1}`} className={quietButton} onClick={() => {
                      commit({ ...draft, questions: draft.questions.filter((item) => item.id !== question.id) });
                      setNotice(`Question ${index + 1} removed.`);
                    }}>Remove</button>
                  </div>
                  <QuestionPreview question={question} number={index + 1} />
                  <details className="mt-3 text-sm text-muted">
                    <summary className="min-h-11 w-fit cursor-pointer rounded-sm py-3">Original source</summary>
                    <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words rounded-md border border-line bg-white p-4 text-xs leading-6">{question.raw}</pre>
                  </details>
                </article>
              </li>
            ))}
          </ol>
        )}
      </section>
    </fieldset>
  );
}

function ProblemCard({ problem, onEdit, onRepair, onDiscard }: {
  problem: DraftProblem;
  onEdit: (source: string) => void;
  onRepair: (source: string) => void;
  onDiscard: () => void;
}) {
  const editedSource = problem.editedSource ?? problem.raw;
  const label = problem.sourceNumber ? `Source Q${problem.sourceNumber}` : "Unnumbered block";
  return (
    <article aria-label={`Problem: ${label}`} className="rounded-md border border-amber-200 bg-amber-50/50 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-amber-950">{label}</h3>
        <button type="button" onClick={onDiscard} className={quietButton} aria-label={`Discard problem ${label}`}>Discard block</button>
      </div>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm leading-6 text-amber-950">
        {problem.errors.map((error, index) => <li key={index}>{error.line ? `Line ${error.line}: ` : ""}{error.message}</li>)}
      </ul>
      <details className="mt-3 text-sm text-muted">
        <summary className="min-h-11 w-fit cursor-pointer rounded-sm py-3">Original pasted block</summary>
        <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words rounded-md bg-white p-4 text-xs leading-6">{problem.raw}</pre>
      </details>
      <label htmlFor={`repair-${problem.id}`} className="mt-4 block text-xs font-medium">Repair this block</label>
      <textarea id={`repair-${problem.id}`} value={editedSource} onChange={(event) => onEdit(event.target.value)} rows={7} spellCheck={false} className="mt-2 block w-full resize-y rounded-md border border-amber-200 bg-white p-3 font-mono text-base leading-7 sm:text-sm" />
      <p className="mt-2 text-xs text-muted">Edits are kept in this browser. Recheck to validate them and add any valid questions.</p>
      <button type="button" onClick={() => onRepair(editedSource)} disabled={!editedSource.trim()} className={`${quietButton} mt-4 bg-white`}>Recheck block</button>
    </article>
  );
}
