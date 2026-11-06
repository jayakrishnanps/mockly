"use client";

import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { clearWeakAreaReports, deleteWeakAreaReport, saveWeakAreaReport } from "@/app/u/[user]/weak-areas/actions";
import { parseWeakAreaReport, type SavedWeakAreaReport, type WeakArea, type WeakAreaFocus } from "@/lib/weak-area-report";
import { emptyWeakAreaReportDraft, loadWeakAreaReportDraft, saveWeakAreaReportDraft, type WeakAreaReportDraft } from "@/lib/weak-area-report-draft";
import { summarizeWeakAreaReports, weakAreaKey as areaKey } from "@/lib/weak-area-report-summary";
import styles from "./weak-areas-workspace.module.css";
import { HEWeakImport } from "@/components/he-weak-import";

type MockChoice = { id: string; title: string };
type AreaRow = { area: WeakArea; report: SavedWeakAreaReport; index: number };
const subscribe = () => () => {};
const priorities = { High: 0, Medium: 1, Low: 2 };
const focuses: WeakAreaFocus[] = ["Accuracy", "Speed", "Both"];
const dateFormatter = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
const reportDateFormatter = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });

export function WeakAreasWorkspace(props: { reports: SavedWeakAreaReport[]; mocks: MockChoice[]; heMocks: MockChoice[] }) {
  const hydrated = useSyncExternalStore(subscribe, () => true, () => false);
  return hydrated ? <Workspace {...props} /> : <p role="status" className="text-sm text-muted">Loading reports…</p>;
}

function Workspace({ reports, mocks, heMocks }: { reports: SavedWeakAreaReport[]; mocks: MockChoice[]; heMocks: MockChoice[] }) {
  const router = useRouter();
  const id = useId();
  const [{ draft, warning }, setDraftState] = useState(() => loadWeakAreaReportDraft());
  const [importOpen, setImportOpen] = useState(() => reports.length === 0 || !!draft.source);
  const [heOpen, setHEOpen] = useState(false);
  const [previewRequested, setPreviewRequested] = useState(() => draft.id !== null);
  const [sourceId, setSourceId] = useState("");
  const [reportId, setReportId] = useState("");
  const [focus, setFocus] = useState<WeakAreaFocus | "All">("All");
  const [pending, setPending] = useState<"save" | "delete" | "clear" | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearError, setClearError] = useState("");
  const busy = useRef(false);
  const clearDialog = useRef<HTMLDialogElement>(null);
  const clearButton = useRef<HTMLButtonElement>(null);
  const importButton = useRef<HTMLButtonElement>(null);
  const keepAreasButton = useRef<HTMLButtonElement>(null);
  const resetButton = useRef<HTMLButtonElement>(null);
  const deleteButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (confirmClear && !clearDialog.current?.open) {
      clearDialog.current?.showModal();
      keepAreasButton.current?.focus();
    } else if (!confirmClear && clearDialog.current?.open) {
      clearDialog.current.close();
    }
  }, [confirmClear]);

  const { orderedReports, latestByMock, reportCounts, activeMockCount } = useMemo(
    () => summarizeWeakAreaReports(reports, new Set<string>()),
    [reports],
  );
  const sourceReports = sourceId ? orderedReports.filter((report) => report.sourceTestId === sourceId) : [];
  const selectedReport = sourceId ? sourceReports.find((report) => report.id === reportId) ?? sourceReports[0] : undefined;
  const selectedReports = selectedReport ? [selectedReport] : sourceId ? [] : [...latestByMock.values()];
  const rows: AreaRow[] = selectedReports.flatMap((report) => report.areas.map((area, index) => ({ area, report, index })));
  const visibleRows = rows.filter(({ area }) => focus === "All" || area.focus === focus)
    .sort((a, b) => priorities[a.area.priority] - priorities[b.area.priority] || Date.parse(b.report.importedAt) - Date.parse(a.report.importedAt) || a.index - b.index);
  const counts = focuses.map((item) => ({ focus: item, count: rows.filter(({ area }) => area.focus === item).length }));
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

  async function clearReports() {
    if (!confirmClear || busy.current) return;
    busy.current = true;
    setPending("clear");
    setClearError("");
    setError("");
    setNotice("");
    try {
      const result = await clearWeakAreaReports();
      if (!result.ok) { setClearError(result.error); return; }
      setConfirmClear(false);
      setConfirmDelete(false);
      setSourceId("");
      setReportId("");
      setFocus("All");
      setNotice("All weak areas cleared.");
      router.refresh();
    } catch {
      setClearError("Clearing could not be confirmed. Please retry.");
    } finally {
      busy.current = false;
      setPending(null);
    }
  }

  function cancelClear() {
    if (!busy.current) setConfirmClear(false);
  }

  return <div className={styles.workspace}>
    <div className={styles.importBar}>
      <span data-static-label className={styles.caption}>{activeMockCount} active {activeMockCount === 1 ? "mock" : "mocks"}</span>
      <div className={styles.actions}>
        {reports.length > 0 && <button ref={clearButton} type="button" className={styles.control} disabled={pending !== null} onClick={() => { setClearError(""); setConfirmClear(true); }}>Clear all</button>}
        <button type="button" className={styles.control} aria-expanded={heOpen} aria-controls={`${id}-he-import`} onClick={() => setHEOpen(!heOpen)}>HE</button>
        <button ref={importButton} type="button" className={styles.primary} aria-expanded={importOpen} aria-controls={`${id}-import`} onClick={() => setImportOpen(!importOpen)}>Import report <span aria-hidden="true">{importOpen ? "−" : "+"}</span></button>
      </div>
    </div>

    <div id={`${id}-he-import`} hidden={!heOpen}><HEWeakImport mocks={heMocks} /></div>

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
          {parsed.value.areas.map((area, index) => <li key={`${area.subject}-${index}`}>
            <span>{area.area}</span><span className={styles.caption}>{area.focus} · {area.priority}</span>
          </li>)}
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
        {selectedReport && <label><span>Assessment</span><select value={selectedReport.id} onChange={(event) => { setReportId(event.target.value); setConfirmDelete(false); }}>
          {sourceReports.map((report, index) => <option key={report.id} value={report.id}>{index === 0 ? "Latest · " : ""}{reportDateFormatter.format(new Date(report.importedAt))}</option>)}
        </select></label>}
      </div>

      <div className={styles.scopeBar}>
        <h2 data-static-label>{selectedReport ? selectedReport.id === sourceReports[0]?.id ? "Latest assessment" : "Earlier assessment" : "Latest reports"}</h2>
        <span>{selectedReport ? `${sourceReports.length} saved ${sourceReports.length === 1 ? "report" : "reports"}` : `${activeMockCount} active ${activeMockCount === 1 ? "mock" : "mocks"}`}</span>
      </div>

      <section className={styles.summary} aria-label="Reported focus areas">
        <FocusRing counts={counts} total={rows.length} active={focus === "All"} onSelect={() => setFocus("All")} />
        <div className={styles.focusList}>
          {counts.map((item) => <button key={item.focus} type="button" className={styles.focusFilter} aria-pressed={focus === item.focus} onClick={() => setFocus(focus === item.focus ? "All" : item.focus)}>
            <strong>{item.count}</strong><span className={styles.focusName}><span className={`${styles.dot} ${styles[item.focus]}`} aria-hidden="true" />{item.focus}</span>
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

      {visibleRows.length === 0 ? <section className={styles.empty}><h2>{rows.length === 0 ? "No areas listed." : "No matching areas."}</h2></section> : <ul className={styles.points} aria-label="Reported weak areas">
        {visibleRows.map(({ area, report }) => <li key={areaKey(report.id, area)} className={styles.point}>
          <div className={styles.pointHeading}>
            <span aria-hidden="true" className={styles.pointMarker} />
            <h3 data-static-label>{area.area}</h3>
          </div>
          <div className={styles.pointMeta}>
            <span>{area.subject}</span>
            <span className={styles.focusLabel}><span aria-hidden="true" className={`${styles.dot} ${styles[area.focus]}`} />{area.focus}</span>
            <span>{area.priority} priority</span>
          </div>
          {!sourceId && <div className={styles.source}>
            <span>{report.sourceTitle}</span>
            <div className={styles.sourceMeta}>
              <time dateTime={report.importedAt}>{dateFormatter.format(new Date(report.importedAt))}</time>
              {(reportCounts.get(report.sourceTestId) ?? 0) > 1 && <button type="button" onClick={() => { setSourceId(report.sourceTestId); setReportId(""); setConfirmDelete(false); }}>{reportCounts.get(report.sourceTestId)} reports <span aria-hidden="true">↗</span></button>}
            </div>
          </div>}
        </li>)}
      </ul>}
    </>}
    <dialog
      ref={clearDialog}
      className={styles.dialog}
      aria-labelledby={`${id}-clear-title`}
      aria-describedby={`${id}-clear-description`}
      aria-busy={pending === "clear"}
      onCancel={(event) => { event.preventDefault(); cancelClear(); }}
      onClose={() => { setConfirmClear(false); (clearButton.current ?? importButton.current)?.focus(); }}
      onClick={(event) => { if (event.target === event.currentTarget) cancelClear(); }}
    >
      <div className={styles.dialogContent}>
        <h2 id={`${id}-clear-title`}>Clear all weak areas?</h2>
        <p id={`${id}-clear-description`}>This deletes all of JK’s saved weak points and reports, including earlier assessments. This cannot be undone.</p>
        {clearError && <p role="alert" className={styles.feedback}>{clearError}</p>}
        <div className={styles.actions}>
          <button ref={keepAreasButton} type="button" className={styles.control} disabled={pending === "clear"} onClick={cancelClear}>Keep areas</button>
          <button type="button" className={styles.primary} disabled={pending === "clear"} onClick={() => void clearReports()}>{pending === "clear" ? "Clearing…" : "Clear all"}</button>
        </div>
      </div>
    </dialog>
  </div>;
}

function FocusRing({ counts, total, active, onSelect }: {
  counts: { focus: WeakAreaFocus; count: number }[];
  total: number;
  active: boolean;
  onSelect: () => void;
}) {
  const circumference = 2 * Math.PI * 48;
  return <button type="button" className={styles.ring} aria-label={`Show all reported weak areas (${total})`} aria-pressed={active} onClick={onSelect}>
    <svg viewBox="0 0 128 128" aria-hidden="true" focusable="false">
      <circle cx="64" cy="64" r="48" fill="none" stroke="#000" strokeWidth="1" />
      {counts.map((item, index) => {
        const length = total ? item.count / total * circumference : 0;
        const precedingCount = counts.slice(0, index).reduce((sum, entry) => sum + entry.count, 0);
        const start = total ? precedingCount / total * circumference : 0;
        return <circle key={item.focus} className={styles[item.focus]} cx="64" cy="64" r="48" fill="none" stroke="currentColor" strokeWidth="10" strokeDasharray={`${length} ${circumference - length}`} strokeDashoffset={-start} transform="rotate(-90 64 64)" />;
      })}
    </svg>
    <span aria-hidden="true"><strong>{total}</strong><span>Areas</span></span>
  </button>;
}
