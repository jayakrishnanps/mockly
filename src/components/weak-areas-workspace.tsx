"use client";

import { useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { deleteWeakAreaReport, saveWeakAreaReport } from "@/app/u/[user]/weak-areas/actions";
import { parseWeakAreaReport, type SavedWeakAreaReport, type WeakArea, type WeakAreaFocus } from "@/lib/weak-area-report";
import { emptyWeakAreaReportDraft, loadWeakAreaReportDraft, saveWeakAreaReportDraft, type WeakAreaReportDraft } from "@/lib/weak-area-report-draft";
import styles from "./weak-areas-workspace.module.css";

type MockChoice = { id: string; title: string };
type AreaRow = { area: WeakArea; report: SavedWeakAreaReport; index: number };
const subscribe = () => () => {};
const priorities = { High: 0, Medium: 1, Low: 2 };
const priorityDots = { High: 3, Medium: 2, Low: 1 };
const focuses: WeakAreaFocus[] = ["Accuracy", "Speed", "Both"];
const subjects = ["All", "Math", "Reasoning", "GK", "English", "Other"] as const;
const dateFormatter = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
const reportDateFormatter = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });

export function WeakAreasWorkspace(props: { reports: SavedWeakAreaReport[]; mocks: MockChoice[] }) {
  const hydrated = useSyncExternalStore(subscribe, () => true, () => false);
  return hydrated ? <Workspace {...props} /> : <p role="status" className="text-sm text-muted">Loading reports…</p>;
}

function Workspace({ reports, mocks }: { reports: SavedWeakAreaReport[]; mocks: MockChoice[] }) {
  const router = useRouter();
  const id = useId();
  const [{ draft, warning }, setDraftState] = useState(() => loadWeakAreaReportDraft());
  const [importOpen, setImportOpen] = useState(() => reports.length === 0 || !!draft.source);
  const [previewRequested, setPreviewRequested] = useState(() => draft.id !== null);
  const [sourceId, setSourceId] = useState("");
  const [reportId, setReportId] = useState("");
  const [subject, setSubject] = useState<string>("All");
  const [focus, setFocus] = useState<WeakAreaFocus | "All">("All");
  const [pending, setPending] = useState<"save" | "delete" | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const busy = useRef(false);
  const resetButton = useRef<HTMLButtonElement>(null);
  const deleteButton = useRef<HTMLButtonElement>(null);

  const orderedReports = useMemo(() => [...reports].sort((a, b) => Date.parse(b.importedAt) - Date.parse(a.importedAt) || b.id.localeCompare(a.id)), [reports]);
  const latestByMock = useMemo(() => {
    const latest = new Map<string, SavedWeakAreaReport>();
    for (const report of orderedReports) if (!latest.has(report.sourceTestId)) latest.set(report.sourceTestId, report);
    return latest;
  }, [orderedReports]);
  const sourceReports = sourceId ? orderedReports.filter((report) => report.sourceTestId === sourceId) : [];
  const selectedReport = sourceId ? sourceReports.find((report) => report.id === reportId) ?? sourceReports[0] : undefined;
  const selectedReports = selectedReport ? [selectedReport] : sourceId ? [] : [...latestByMock.values()];
  const rows: AreaRow[] = selectedReports.flatMap((report) => report.areas.map((area, index) => ({ area, report, index })));
  const subjectRows = rows.filter(({ area }) => subject === "All" || area.subject === subject);
  const visibleRows = subjectRows.filter(({ area }) => focus === "All" || area.focus === focus)
    .sort((a, b) => priorities[a.area.priority] - priorities[b.area.priority] || Date.parse(b.report.importedAt) - Date.parse(a.report.importedAt) || a.index - b.index);
  const counts = focuses.map((item) => ({ focus: item, count: subjectRows.filter(({ area }) => area.focus === item).length }));
  const parsed = useMemo(() => previewRequested ? parseWeakAreaReport(draft.source) : null, [draft.source, previewRequested]);
  const previewMock = parsed?.ok ? mocks.find((mock) => mock.id === parsed.value.sourceTestId) : undefined;
  const savedDraftReport = draft.id ? reports.find((report) => report.id === draft.id) : undefined;
  const previewTitle = previewMock?.title ?? savedDraftReport?.sourceTitle;
  const sourceUnavailable = parsed?.ok && !previewMock && !draft.id;

  function commitDraft(next: WeakAreaReportDraft) {
    const nextWarning = saveWeakAreaReportDraft(next);
    setDraftState({ draft: next, warning: nextWarning });
  }

  function resetDraft() {
    commitDraft(emptyWeakAreaReportDraft());
    setPreviewRequested(false);
    setConfirmReset(false);
    setError("");
  }

  async function saveReport() {
    if (busy.current || !parsed?.ok || sourceUnavailable) return;
    busy.current = true;
    setPending("save");
    setError("");
    setNotice("");
    const snapshot = { ...draft, id: draft.id ?? crypto.randomUUID() };
    commitDraft(snapshot);
    try {
      const result = await saveWeakAreaReport({ id: snapshot.id, ...parsed.value });
      if (!result.ok) { setError(result.error); return; }
      commitDraft(emptyWeakAreaReportDraft());
      setPreviewRequested(false);
      setImportOpen(false);
      setSourceId(parsed.value.sourceTestId);
      setReportId(result.id);
      setSubject("All");
      setFocus("All");
      setNotice("Report saved.");
      router.refresh();
    } catch {
      setError("Save could not be confirmed. Your report is kept; retry safely.");
    } finally {
      busy.current = false;
      setPending(null);
    }
  }

  async function removeReport() {
    if (busy.current || !selectedReport) return;
    busy.current = true;
    setPending("delete");
    setError("");
    setNotice("");
    try {
      const result = await deleteWeakAreaReport(selectedReport.id);
      if (!result.ok) { setError(result.error); return; }
      setConfirmDelete(false);
      setReportId("");
      if (sourceReports.length === 1) setSourceId("");
      setNotice("Report deleted.");
      router.refresh();
    } catch {
      setError("The report could not be deleted. Please retry.");
    } finally {
      busy.current = false;
      setPending(null);
    }
  }

  return <div className={styles.workspace}>
    <div className={styles.importBar}>
      <span className={styles.caption}>{latestByMock.size} {latestByMock.size === 1 ? "mock" : "mocks"}</span>
      <button type="button" className={styles.primary} aria-expanded={importOpen} aria-controls={`${id}-import`} onClick={() => setImportOpen(!importOpen)}>Import report <span aria-hidden="true">{importOpen ? "−" : "+"}</span></button>
    </div>

    {importOpen && <section id={`${id}-import`} className={styles.importPanel} aria-labelledby={`${id}-import-title`}>
      <h2 id={`${id}-import-title`}>Paste your report</h2>
      <label htmlFor={`${id}-source`} className="sr-only">Formatted weak-area report</label>
      <textarea id={`${id}-source`} rows={7} maxLength={20000} value={draft.source} readOnly={draft.id !== null} disabled={pending !== null} placeholder="Paste the formatted report here" aria-describedby={parsed && !parsed.ok ? `${id}-parse-error` : undefined} onChange={(event) => {
        commitDraft({ version: 1, source: event.target.value, id: null });
        setPreviewRequested(false);
        setError("");
      }} />
      {warning && <p role="alert" className={styles.feedback}>{warning}</p>}
      {parsed && !parsed.ok && <p id={`${id}-parse-error`} role="alert" className={styles.feedback}>{parsed.error}</p>}
      {sourceUnavailable && <p role="alert" className={styles.feedback}>This mock is no longer available to JK. Your report is kept.</p>}
      <div className={styles.actions}>
        <button type="button" disabled={pending !== null || !draft.source.trim()} className={styles.control} onClick={() => { setPreviewRequested(true); setError(""); }}>Preview report</button>
        {(draft.source || draft.id) && <button ref={resetButton} type="button" disabled={pending !== null} className={styles.quiet} onClick={() => setConfirmReset(true)}>Start new report</button>}
      </div>
      {confirmReset && <div role="group" aria-labelledby={`${id}-reset-title`} className={styles.confirm} onKeyDown={(event) => { if (event.key === "Escape") { setConfirmReset(false); resetButton.current?.focus(); } }}>
        <h3 id={`${id}-reset-title`}>Clear this draft?</h3>
        {draft.id && <p>The previous save may already exist. Retry it to confirm.</p>}
        <div className={styles.actions}>
          <button ref={(node) => { node?.focus(); }} type="button" disabled={pending !== null} className={styles.control} onClick={() => { setConfirmReset(false); resetButton.current?.focus(); }}>Keep draft</button>
          <button type="button" disabled={pending !== null} className={styles.primary} onClick={resetDraft}>Clear draft</button>
        </div>
      </div>}
      {parsed?.ok && <div className={styles.preview}>
        <div className={styles.previewHeading}><h3>{previewTitle ?? "Report preview"}</h3><span>{parsed.value.areas.length} areas</span></div>
        {parsed.value.areas.length === 0 ? <p className={styles.caption}>No areas listed.</p> : <ul className={styles.previewList}>
          {parsed.value.areas.map((area, index) => <li key={`${area.subject}-${index}`}><span>{area.area}</span><span className={styles.caption}>{area.focus} · {area.priority}</span></li>)}
        </ul>}
        <button type="button" className={styles.primary} disabled={pending !== null || !!sourceUnavailable} onClick={() => void saveReport()}>{pending === "save" ? "Saving…" : draft.id ? "Retry save" : "Save report"}</button>
      </div>}
    </section>}

    {error && <p role="alert" className={styles.feedback}>{error}</p>}
    <p role="status" aria-live="polite" className={styles.notice}>{notice}</p>

    {reports.length === 0 ? <section className={styles.empty}><span aria-hidden="true">↗</span><h2>No reports yet.</h2><p>Copy the report prompt below a mock’s TXT download.</p></section> : <>
      <div className={styles.filters}>
        <label><span>Mock</span><select value={sourceId} onChange={(event) => { setSourceId(event.target.value); setReportId(""); setConfirmDelete(false); }}>
          <option value="">All mocks</option>
          {[...latestByMock.values()].map((report) => <option key={report.sourceTestId} value={report.sourceTestId}>{report.sourceTitle}</option>)}
        </select></label>
        <label><span>Subject</span><select value={subject} onChange={(event) => setSubject(event.target.value)}>{subjects.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
        {sourceReports.length > 1 && <label><span>Report</span><select value={selectedReport?.id ?? ""} onChange={(event) => { setReportId(event.target.value); setConfirmDelete(false); }}>
          {sourceReports.map((report, index) => <option key={report.id} value={report.id}>{index === 0 ? "Latest · " : ""}{reportDateFormatter.format(new Date(report.importedAt))}</option>)}
        </select></label>}
      </div>

      <section className={styles.summary} aria-label="Reported focus areas">
        <FocusRing counts={counts} total={subjectRows.length} />
        <div className={styles.focusList}>
          {counts.map((item) => <button key={item.focus} type="button" className={styles.focusFilter} aria-pressed={focus === item.focus} onClick={() => setFocus(focus === item.focus ? "All" : item.focus)}>
            <span className={`${styles.dot} ${styles[item.focus]}`} aria-hidden="true" /><span>{item.focus}</span><strong>{item.count}</strong>
          </button>)}
        </div>
      </section>

      {selectedReport && <div className={styles.reportBar}>
        <time dateTime={selectedReport.importedAt}>{reportDateFormatter.format(new Date(selectedReport.importedAt))} IST</time>
        <button ref={deleteButton} type="button" disabled={pending !== null} className={styles.quiet} onClick={() => setConfirmDelete(true)}>Delete report</button>
      </div>}
      {confirmDelete && selectedReport && <div role="group" aria-labelledby={`${id}-delete-title`} className={styles.confirm} onKeyDown={(event) => { if (event.key === "Escape" && !pending) { setConfirmDelete(false); deleteButton.current?.focus(); } }}>
        <h3 id={`${id}-delete-title`}>Delete this report?</h3>
        <div className={styles.actions}><button ref={(node) => { node?.focus(); }} type="button" disabled={pending !== null} className={styles.control} onClick={() => { setConfirmDelete(false); deleteButton.current?.focus(); }}>Cancel</button><button type="button" disabled={pending !== null} className={styles.primary} onClick={() => void removeReport()}>{pending === "delete" ? "Deleting…" : "Delete report"}</button></div>
      </div>}

      {visibleRows.length === 0 ? <section className={styles.empty}><h2>{rows.length === 0 ? "No areas listed." : "No matching areas."}</h2></section> : <ul className={styles.cards} aria-label="Reported weak areas">
        {visibleRows.map(({ area, report, index }) => <li key={`${report.id}-${index}`} className={styles.card}>
          <div className={styles.cardTop}><span>{area.subject}</span><span className={styles.focusLabel}><span aria-hidden="true" className={`${styles.dot} ${styles[area.focus]}`} />{area.focus}</span></div>
          <h3>{area.area}</h3>
          <div className={styles.priority} aria-label={`${area.priority} priority`}><span aria-hidden="true" className={styles.priorityMeter}>{[0, 1, 2].map((dot) => <i key={dot} className={dot < priorityDots[area.priority] ? styles.filled : undefined} />)}</span><span>{area.priority} priority</span></div>
          {!sourceId && <div className={styles.source}><span>{report.sourceTitle}</span><time dateTime={report.importedAt}>{dateFormatter.format(new Date(report.importedAt))}</time></div>}
        </li>)}
      </ul>}
    </>}
  </div>;
}

function FocusRing({ counts, total }: { counts: { focus: WeakAreaFocus; count: number }[]; total: number }) {
  const circumference = 2 * Math.PI * 48;
  return <div className={styles.ring}>
    <svg viewBox="0 0 128 128" role="img" aria-label={`${total} reported areas`}>
      <circle cx="64" cy="64" r="48" fill="none" stroke="#000" strokeWidth="1" />
      {counts.map((item, index) => {
        const length = total ? item.count / total * circumference : 0;
        const precedingCount = counts.slice(0, index).reduce((sum, entry) => sum + entry.count, 0);
        const start = total ? precedingCount / total * circumference : 0;
        return <circle key={item.focus} className={styles[item.focus]} cx="64" cy="64" r="48" fill="none" stroke="currentColor" strokeWidth="10" strokeDasharray={`${length} ${circumference - length}`} strokeDashoffset={-start} transform="rotate(-90 64 64)" />;
      })}
    </svg>
    <div aria-hidden="true"><strong>{total}</strong><span>Areas</span></div>
  </div>;
}
