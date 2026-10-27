"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { clearHEWeakReports, deleteHEWeakReport } from "@/app/u/[user]/weak-areas/he-actions";
import { QuestionContent } from "@/components/question-content";
import type { SavedHEWeakReport } from "@/lib/he-weak-report";
import styles from "./he-weak-posts.module.css";

type Confirmation = { type: "all" } | { type: "one"; id: string; title: string };
const dateFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata",
});

export function HEWeakPosts({ reports }: { reports: SavedHEWeakReport[] }) {
  const router = useRouter();
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const cancelButton = useRef<HTMLButtonElement>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const busy = useRef(false);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (confirmation && !dialog.current?.open) {
      dialog.current?.showModal();
      cancelButton.current?.focus();
    } else if (!confirmation && dialog.current?.open) {
      dialog.current.close();
    }
  }, [confirmation]);

  function ask(next: Confirmation, button: HTMLButtonElement) {
    if (busy.current) return;
    trigger.current = button;
    setError("");
    setConfirmation(next);
  }

  function cancel() {
    if (!busy.current) setConfirmation(null);
  }

  async function remove() {
    if (!confirmation || busy.current) return;
    busy.current = true;
    setPending(true);
    setError("");
    setNotice("");
    try {
      const result = confirmation.type === "all"
        ? await clearHEWeakReports()
        : await deleteHEWeakReport(confirmation.id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setNotice(confirmation.type === "all" ? "All notes cleared." : "Note deleted.");
      setConfirmation(null);
      router.refresh();
    } catch {
      setError("The change could not be confirmed. Please try again.");
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  return <div className={styles.workspace}>
    <div className={styles.toolbar}>
      <span className={styles.count}>{reports.length} {reports.length === 1 ? "note" : "notes"}</span>
      {reports.length > 0 && <button
        type="button"
        className={styles.clear}
        disabled={pending}
        onClick={(event) => ask({ type: "all" }, event.currentTarget)}
      >Clear all</button>}
    </div>
    <p role="status" className={styles.notice}>{notice}</p>

    {reports.length === 0 ? <section className={styles.empty}>
      <span aria-hidden="true" className={styles.emptySprig} />
      <h2>No notes yet.</h2>
      <p>Your practice notes will appear here.</p>
    </section> : <ol className={styles.posts} aria-label="Practice notes">
      {reports.map((report) => <li key={report.id}>
        <article className={styles.post} aria-labelledby={`${id}-${report.id}`}>
          <div className={styles.meta}>
            <div><span>{report.sourceTitle}</span><time dateTime={report.importedAt}>{dateFormatter.format(new Date(report.importedAt))}</time></div>
            <button
              type="button"
              className={styles.remove}
              disabled={pending}
              aria-label={`Delete note: ${report.title}`}
              title="Delete note"
              onClick={(event) => ask({ type: "one", id: report.id, title: report.title }, event.currentTarget)}
            ><svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v5m4-5v5" /></svg></button>
          </div>
          <div lang="ml" className={styles.malayalam}>
            <h2 id={`${id}-${report.id}`} className={styles.title}>{report.title}</h2>
            <div className={styles.explanation}><QuestionContent text={report.explanation} /></div>
            <section className={styles.practice} aria-labelledby={`${id}-${report.id}-practice`}>
              <h3 id={`${id}-${report.id}-practice`}>പരിശീലിക്കാം</h3>
              <QuestionContent text={report.practice} />
            </section>
          </div>
        </article>
      </li>)}
    </ol>}

    <dialog
      ref={dialog}
      className={styles.dialog}
      aria-labelledby={`${id}-confirm-title`}
      aria-describedby={`${id}-confirm-description`}
      aria-busy={pending}
      onCancel={(event) => { event.preventDefault(); cancel(); }}
      onClose={() => { setConfirmation(null); trigger.current?.focus(); }}
      onClick={(event) => { if (event.target === event.currentTarget) cancel(); }}
    >
      <div className={styles.dialogContent}>
        <h2 id={`${id}-confirm-title`}>{confirmation?.type === "all" ? "Clear all notes?" : "Delete this note?"}</h2>
        <p id={`${id}-confirm-description`}>This cannot be undone.</p>
        {confirmation?.type === "one" && <p lang="ml" className={`${styles.malayalam} ${styles.dialogNote}`}>{confirmation.title}</p>}
        {error && <p role="alert" className={styles.error}>{error}</p>}
        <div className={styles.dialogActions}>
          <button ref={cancelButton} type="button" className={styles.cancel} disabled={pending} onClick={cancel}>Keep notes</button>
          <button type="button" className={styles.confirm} disabled={pending} onClick={() => void remove()}>{pending ? "Deleting…" : confirmation?.type === "all" ? "Clear all" : "Delete note"}</button>
        </div>
      </div>
    </dialog>
  </div>;
}
