"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { buildProgressChart, buildTimeProgressChart, formatProgressTime, PROGRESS_CHART_HEIGHT, PROGRESS_WINDOW_SIZE, type ProgressScale, type ScoreHistoryPoint } from "@/lib/result-progress";
import styles from "./result-progress.module.css";

const dateFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata",
});
const axisFormatter = new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 });

export function ResultProgress({ history, currentAttemptId, allowTime = false }: { history: ScoreHistoryPoint[]; currentAttemptId: string; allowTime?: boolean }) {
  const chartId = useId();
  const container = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(320);
  const [range, setRange] = useState<number | "all">(0);
  const [scale, setScale] = useState<ProgressScale>("detail");
  const [activeId, setActiveId] = useState(currentAttemptId);
  const [timeVisible, setTimeVisible] = useState(false);
  const timeEnabled = allowTime && timeVisible;

  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(160, Math.floor(entry.contentRect.width))));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const chartWidth = Math.max(width, timeEnabled ? 420 : 0, range === "all" ? (history.length - 1) * 32 + (timeEnabled ? 132 : 84) : 0);
  const chart = useMemo(() => buildProgressChart(history, range, chartWidth, scale, timeEnabled), [history, range, chartWidth, scale, timeEnabled]);
  const timeChart = useMemo(() => timeEnabled ? buildTimeProgressChart(chart, scale) : null, [chart, scale, timeEnabled]);
  const currentIndex = history.findIndex((point) => point.id === currentAttemptId);
  const viewedPoint = chart.points.find((point) => point.id === currentAttemptId);
  const currentVisible = viewedPoint !== undefined;
  const activePoint = chart.points.find((point) => point.id === activeId)
    ?? chart.points.find((point) => point.id === currentAttemptId)
    ?? chart.points[chart.points.length - 1];
  const pages = Math.ceil(history.length / PROGRESS_WINDOW_SIZE);
  const line = useMemo(() => chart.points.map((point) => `${point.x},${point.y}`).join(" "), [chart.points]);
  const firstPoint = chart.points[0];
  const lastPoint = chart.points[chart.points.length - 1];
  const area = firstPoint && lastPoint ? `${firstPoint.x},${chart.plot.bottom} ${line} ${lastPoint.x},${chart.plot.bottom}` : "";
  const scrollTargetX = chart.points.find((point) => point.id === currentAttemptId)?.x ?? chart.points[chart.points.length - 1]?.x ?? 0;

  useEffect(() => {
    container.current?.scrollTo({ left: chartWidth > width ? Math.max(0, scrollTargetX - width / 2) : 0 });
  }, [chartWidth, range, scrollTargetX, width]);

  if (!activePoint) return null;

  return (
    <section data-result-chart aria-labelledby={`${chartId}-heading`} className={`${styles.panel} mt-6 min-w-0 border border-line bg-white p-4 sm:mt-8 sm:p-6 ${allowTime ? "rounded-md" : "rounded-xl"}`}>
      {allowTime ? (
        <div className={`${styles.heading} mb-4 flex flex-wrap items-center justify-between gap-3`}>
          <h2 id={`${chartId}-heading`} className="text-xl font-semibold tracking-tight text-foreground">{timeEnabled ? "Score & time" : "Score progress"}</h2>
          <button
            type="button"
            aria-pressed={timeEnabled}
            aria-label="Show total completion time"
            onClick={() => setTimeVisible((visible) => !visible)}
            className={`inline-flex min-h-11 items-center gap-2 rounded-md border bg-white px-3 text-sm font-medium ${timeEnabled ? "border-[color:var(--chart-time)] text-[color:var(--chart-time)] focus-visible:outline-[color:var(--chart-time)]" : "border-line text-foreground hover:bg-accent-soft"}`}
          >
            <span aria-hidden="true" className="w-4 border-t-2 border-dashed border-current" />
            Time
            <span aria-hidden="true" className={`h-2 w-2 rounded-full ${timeEnabled ? "bg-[var(--chart-time)]" : "border border-current"}`} />
          </button>
        </div>
      ) : <h2 id={`${chartId}-heading`} className="sr-only">Score progress</h2>}
      <div className={`${styles.toolbar} flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4`}>
        <div className="flex flex-wrap items-center gap-3 sm:gap-5">
          <span className="text-xs tabular-nums text-muted">{chart.start + 1}–{chart.end} / {history.length}</span>
          <div role="group" aria-label="Y-axis scale" className={`${styles.scaleControl} inline-flex gap-1 rounded-lg bg-background p-1`}>
            {(["detail", "full"] as const).map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={scale === value}
                onClick={() => setScale(value)}
                className={`min-h-11 rounded-md px-3 text-xs font-medium ${scale === value ? "bg-white text-accent shadow-sm" : "text-muted hover:text-foreground"}`}
              >{value === "detail" ? "Detail" : "Full scale"}</button>
            ))}
          </div>
        </div>
        <div className={`${styles.rangeControls} flex flex-wrap items-center gap-2`}>
          {!currentVisible && currentIndex >= 0 && (
            <button
              type="button"
              onClick={() => {
                setRange(Math.floor((history.length - 1 - currentIndex) / PROGRESS_WINDOW_SIZE));
                setActiveId(currentAttemptId);
              }}
              className="min-h-11 rounded-lg px-3 text-xs font-medium text-accent hover:bg-accent-soft"
            >Show this result</button>
          )}
          <label htmlFor={`${chartId}-range`} className="sr-only">Attempts shown in graph</label>
          <select
            id={`${chartId}-range`}
            value={range}
            onChange={(event) => {
              setRange(event.target.value === "all" ? "all" : Number(event.target.value));
              setActiveId(currentAttemptId);
            }}
            className="min-h-11 max-w-full rounded-lg border border-line bg-white px-3 text-sm text-foreground"
          >
            {Array.from({ length: pages }, (_, page) => {
              const end = history.length - page * PROGRESS_WINDOW_SIZE;
              return <option key={page} value={page}>{page === 0 ? "Latest 10" : `Attempts ${Math.max(1, end - PROGRESS_WINDOW_SIZE + 1)}–${end}`}</option>;
            })}
            <option value="all">All time</option>
          </select>
        </div>
      </div>

      {timeEnabled && (
        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted" aria-hidden="true">
          <span className="inline-flex items-center gap-2"><span className="w-4 border-t-2 border-[color:var(--chart-score)]" />Score · left axis</span>
          <span className="inline-flex items-center gap-2 text-[color:var(--chart-time)]"><span className="w-4 border-t-2 border-dashed border-current" />Time · right axis</span>
        </div>
      )}
      <div className={`${styles.plot} relative min-w-0 ${timeEnabled ? "mt-2" : "mt-5"}`}>
        <div className={`${styles.axis} pointer-events-none absolute top-0 left-0 z-10 bg-white`} aria-hidden="true">
          <svg width={44} height={PROGRESS_CHART_HEIGHT} className="block">
            {chart.ticks.map((tick) => <text key={tick.value} x={38} y={tick.y + 4} textAnchor="end" fill="var(--muted)" fontSize={11}>{axisFormatter.format(tick.value)}%</text>)}
          </svg>
        </div>
        <div ref={container} className="min-w-0 overflow-x-auto overscroll-x-contain">
          <svg width={chartWidth} height={PROGRESS_CHART_HEIGHT} role="group" aria-label={`Score percentage by completed attempt, ${scale === "detail" ? "fitted" : "full"} scale from ${chart.minimum} to ${chart.maximum} percent${timeChart ? `; blue dashed line shows total completion time, right axis from ${formatProgressTime(timeChart.minimum)} at the top to ${formatProgressTime(timeChart.maximum)} at the bottom; faster attempts appear higher` : ""}`} className="block">
            <defs>
              <linearGradient id={`${chartId}-fill`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="var(--chart-score)" stopOpacity={0.12} />
                <stop offset="100%" stopColor="var(--chart-score)" stopOpacity={0.01} />
              </linearGradient>
            </defs>
            {chart.ticks.map((tick) => (
              <g key={tick.value} aria-hidden="true">
                <line x1={chart.plot.left} x2={chart.plot.right} y1={tick.y} y2={tick.y} stroke="var(--line)" strokeOpacity={0.6} strokeDasharray={tick.value === 0 ? undefined : "2 5"} />
              </g>
            ))}
            {chart.points.length > 1 && <polygon points={area} fill={`url(#${chartId}-fill)`} aria-hidden="true" />}
            <line x1={activePoint.x} x2={activePoint.x} y1={chart.plot.top} y2={chart.plot.bottom} stroke="var(--chart-score)" strokeOpacity={0.25} strokeDasharray="4 4" aria-hidden="true" />
            {chart.points.length > 1 && <polyline points={line} fill="none" stroke="var(--chart-score)" strokeWidth={2.25} strokeLinejoin="round" strokeLinecap="round" aria-hidden="true" />}
            {timeChart && <path d={timeChart.path} fill="none" stroke="var(--chart-time)" strokeWidth={2.25} strokeDasharray="6 4" strokeLinejoin="round" strokeLinecap="round" aria-hidden="true" />}
            {chart.points.map((point, index) => {
              const current = point.id === currentAttemptId;
              const active = point.id === activePoint.id;
              const timePoint = timeChart?.points[index];
              const label = `Attempt ${point.attemptNumber}, ${dateFormatter.format(new Date(point.submittedAt))}, ${point.score} out of ${point.maxScore}, ${point.percentage.toFixed(1)} percent${timeChart ? `, total completion time ${timePoint?.seconds === null ? "unavailable" : formatProgressTime(timePoint?.seconds)}` : ""}${current ? ", result being viewed" : ""}`;
              return (
                <g
                  key={point.id}
                  role="button"
                  tabIndex={0}
                  aria-label={label}
                  aria-pressed={point.id === activePoint.id}
                  onFocus={() => setActiveId(point.id)}
                  onMouseEnter={() => setActiveId(point.id)}
                  onClick={() => setActiveId(point.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setActiveId(point.id);
                    }
                  }}
                  className={`${styles.point} cursor-pointer`}
                >
                  <title>{label}</title>
                  <rect x={point.x - 12} y={Math.min(point.y, timePoint?.y ?? point.y) - 22} width={24} height={Math.abs(point.y - (timePoint?.y ?? point.y)) + 44} fill="transparent" />
                  <circle className={styles.focusRing} cx={point.x} cy={point.y} r={14} fill="none" stroke="var(--foreground)" strokeWidth={2} aria-hidden="true" pointerEvents="none" />
                  {timePoint?.y !== null && timePoint?.y !== undefined && <>
                    {(current || active) && <circle cx={point.x} cy={timePoint.y} r={current ? 10 : 8} fill="white" stroke="var(--chart-time)" strokeWidth={1.5} />}
                    <circle cx={point.x} cy={timePoint.y} r={current || active ? 5 : 3.5} fill={current || active ? "var(--chart-time)" : "white"} stroke="var(--chart-time)" strokeWidth={1.75} />
                  </>}
                  {(current || active) && <circle cx={point.x} cy={point.y} r={current ? 10 : 8} fill="var(--chart-score-soft)" stroke="var(--chart-score)" strokeWidth={1.5} />}
                  <circle cx={point.x} cy={point.y} r={current || active ? 5 : 3.5} fill={current || active ? "var(--chart-score)" : "white"} stroke="var(--chart-score)" strokeWidth={1.75} />
                  {(chart.points.length <= 10 || current || index === 0 || index === chart.points.length - 1) && <text x={point.x} y={PROGRESS_CHART_HEIGHT - 12} textAnchor="middle" fill={current ? "var(--chart-score-strong)" : "var(--muted)"} fontSize={11}>{point.attemptNumber}</text>}
                </g>
              );
            })}
            {viewedPoint && <g aria-hidden="true" pointerEvents="none" transform={`translate(${Math.max(chart.plot.left, Math.min(viewedPoint.x - 29, chart.plot.right - 58))}, ${Math.max(4, viewedPoint.y - 36)})`}>
              <rect width={58} height={22} rx={6} fill="var(--chart-score-strong)" />
              <text x={29} y={15} textAnchor="middle" fill="white" fontSize={11} fontWeight={600}>{viewedPoint.percentage.toFixed(1)}%</text>
            </g>}
          </svg>
        </div>
        {timeChart && (
          <div className={`${styles.axis} pointer-events-none absolute top-0 right-0 z-10 bg-white`} aria-hidden="true">
            <svg width={60} height={PROGRESS_CHART_HEIGHT} className="block">
              {timeChart.ticks.map((tick) => <text key={tick.value} x={8} y={tick.y + 4} fill="var(--chart-time)" fontSize={11}>{formatProgressTime(tick.value)}</text>)}
            </svg>
          </div>
        )}
      </div>
      <output aria-live="polite" className={`${styles.readout} mt-3 flex min-h-6 flex-wrap items-center gap-x-3 gap-y-2 border-t border-line pt-4 text-xs tabular-nums text-muted`}>
        <span className={`${styles.attemptNumber} font-medium text-foreground`}>#{activePoint.attemptNumber}</span>
        <span className={`${styles.score} text-sm font-semibold text-[color:var(--chart-score-strong)]`}>{activePoint.percentage.toFixed(1)}%</span>
        <span>{activePoint.score} / {activePoint.maxScore}</span>
        {timeEnabled && <span className="font-medium text-[color:var(--chart-time)]">Time {formatProgressTime(activePoint.timeTakenSeconds)}</span>}
        <time dateTime={activePoint.submittedAt}>{dateFormatter.format(new Date(activePoint.submittedAt))}</time>
      </output>
    </section>
  );
}
