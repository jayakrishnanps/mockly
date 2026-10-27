"use client";

import { useId, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { saveHEWeakReport } from "@/app/u/[user]/weak-areas/he-actions";
import { QuestionContent } from "@/components/question-content";
import { parseHEWeakReport, MAX_HE_WEAK_REPORT_LENGTH } from "@/lib/he-weak-report";
import { emptyHEWeakReportDraft, loadHEWeakReportDraft, saveHEWeakReportDraft, type HEWeakReportDraft } from "@/lib/he-weak-report-draft";
import styles from "./weak-areas-workspace.module.css";

const subscribe = () => () => {};
type MockChoice = { id: string; title: string };

export function HEWeakImport({ mocks }: { mocks: MockChoice[] }) {
  const hydrated = useSyncExternalStore(subscribe, () => true, () => false);
  return hydrated ? <ImportForm mocks={mocks} /> : <p role="status">Loading draft…</p>;
}

function ImportForm({ mocks }: { mocks: MockChoice[] }) {
  const id = useId();
  const router = useRouter();
  const [{ draft, warning }, setDraftState] = useState(() => loadHEWeakReportDraft());
  const [preview, setPreview] = useState(() => draft.id !== null);
  const [pending, setPending] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const busy = useRef(false);
  const resetButton = useRef<HTMLButtonElement>(null);
  const parsed = preview ? parseHEWeakReport(draft.source) : null;
  const mock = parsed?.ok ? mocks.find((item) => item.id === parsed.value.sourceTestId) : undefined;

  function commitDraft(next: HEWeakReportDraft) {
    setDraftState({ draft: next, warning: saveHEWeakReportDraft(next) });
  }

  async function save() {
    if (busy.current || !parsed?.ok) return;
    busy.current = true;
    setPending(true);
    setError("");
    setNotice("");
    const snapshot = { ...draft, id: draft.id ?? crypto.randomUUID() };
    commitDraft(snapshot);
    try {
      const result = await saveHEWeakReport({ id: snapshot.id, ...parsed.value });
      if (!result.ok) { setError(result.error); return; }
      commitDraft(emptyHEWeakReportDraft());
      setPreview(false);
      setNotice("Saved for HE.");
      router.refresh();
    } catch {
      setError("Save could not be confirmed. Your draft is kept; retry safely.");
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  return <section className={styles.importPanel} aria-labelledby={`${id}-title`}>
    <h2 id={`${id}-title`}>Notes for HE</h2>
    <label htmlFor={`${id}-source`} className="sr-only">HE Markdown notes</label>
    <textarea id={`${id}-source`} rows={7} maxLength={MAX_HE_WEAK_REPORT_LENGTH} value={draft.source} readOnly={draft.id !== null} disabled={pending} placeholder="Paste HE's formatted Malayalam notes" aria-describedby={parsed && !parsed.ok ? `${id}-error` : undefined} onChange={(event) => {
      commitDraft({ version: 1, source: event.target.value, id: null });
      setPreview(false);
      setError("");
      setNotice("");
    }} />
    {warning && <p role="alert" className={styles.feedback}>{warning}</p>}
    {parsed && !parsed.ok && <p role="alert" id={`${id}-error`} className={styles.feedback}>{parsed.error}</p>}
    {error && <p role="alert" className={styles.feedback}>{error}</p>}
    <p role="status" className={styles.notice}>{notice}</p>
    <div className={styles.actions}>
      <button type="button" className={styles.control} disabled={pending || !draft.source.trim()} onClick={() => { setPreview(true); setError(""); }}>Preview notes</button>
      {draft.source && <button type="button" className={styles.quiet} ref={resetButton} disabled={pending} onClick={() => setConfirmReset(true)}>Start new notes</button>}
    </div>
    {confirmReset && <div role="group" aria-labelledby={`${id}-reset`} className={styles.confirm} onKeyDown={(event) => { if (event.key === "Escape") { setConfirmReset(false); resetButton.current?.focus(); } }}>
      <h3 id={`${id}-reset`}>Clear this draft?</h3>
      {draft.id && <p>The previous save may already exist. Retry it to confirm.</p>}
      <div className={styles.actions}>
        <button type="button" ref={(node) => { node?.focus(); }} className={styles.control} disabled={pending} onClick={() => { setConfirmReset(false); resetButton.current?.focus(); }}>Keep draft</button>
        <button type="button" className={styles.primary} disabled={pending} onClick={() => { commitDraft(emptyHEWeakReportDraft()); setPreview(false); setConfirmReset(false); setError(""); }}>Clear draft</button>
      </div>
    </div>}
    {parsed?.ok && <div className={styles.preview}>
      <div className={styles.previewHeading}><h3>{mock?.title ?? "HE notes preview"}</h3><span>For HE</span></div>
      {!mock && <p className={styles.feedback}>This mock is no longer assigned to HE. Your draft is kept.</p>}
      <div lang="ml" className="he-malayalam-content">
        <h3 className="mb-3 text-xl font-semibold">{parsed.value.title}</h3>
        <QuestionContent text={parsed.value.explanation} />
        <div className="mt-4 border-t border-line pt-4"><QuestionContent text={parsed.value.practice} /></div>
      </div>
      <button type="button" className={`${styles.primary} mt-5`} disabled={pending || (!mock && !draft.id)} onClick={() => void save()}>{pending ? "Saving…" : draft.id ? "Retry save" : "Save for HE"}</button>
    </div>}
  </section>;
}
