"use client";

import { useEffect, useId, useRef, useState } from "react";
import { buildProgressChart, PROGRESS_CHART_HEIGHT, PROGRESS_WINDOW_SIZE, type ScoreHistoryPoint } from "@/lib/result-progress";

const dateFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata",
});

export function ResultProgress({ history, currentAttemptId }: { history: ScoreHistoryPoint[]; currentAttemptId: string }) {
  const chartId = useId();
  const container = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(320);
  const [range, setRange] = useState<number | "all">(0);
  const [activeId, setActiveId] = useState(currentAttemptId);

  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(160, Math.floor(entry.contentRect.width))));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const chartWidth = range === "all" ? Math.max(width, (history.length - 1) * 32 + 64) : width;
  const chart = buildProgressChart(history, range, chartWidth);
  const currentIndex = history.findIndex((point) => point.id === currentAttemptId);
  const currentVisible = chart.points.some((point) => point.id === currentAttemptId);
  const activePoint = chart.points.find((point) => point.id === activeId)
    ?? chart.points.find((point) => point.id === currentAttemptId)
    ?? chart.points[chart.points.length - 1];
  const pages = Math.ceil(history.length / PROGRESS_WINDOW_SIZE);
  const line = chart.points.map((point) => `${point.x},${point.y}`).join(" ");
  const scrollTargetX = chart.points.find((point) => point.id === currentAttemptId)?.x ?? chart.points[chart.points.length - 1]?.x ?? 0;

  useEffect(() => {
    container.current?.scrollTo({ left: range === "all" ? Math.max(0, scrollTargetX - width / 2) : 0 });
  }, [range, scrollTargetX, width]);

  if (!activePoint) return null;

  return (
    <section aria-labelledby={`${chartId}-heading`} className="mt-6 min-w-0 rounded-xl border border-line bg-white p-4 sm:mt-8 sm:p-6">
      <h2 id={`${chartId}-heading`} className="sr-only">Score progress</h2>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs tabular-nums text-muted">{chart.start + 1}–{chart.end} / {history.length}</span>
        <div className="flex flex-wrap items-center gap-2">
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

      <div ref={container} className="mt-3 min-w-0 overflow-x-auto overscroll-x-contain">
        <svg width={chartWidth} height={PROGRESS_CHART_HEIGHT} role="group" aria-label="Score percentage by completed attempt" className="block">
          {chart.ticks.map((tick) => (
            <g key={tick.value} aria-hidden="true">
              <line x1={44} x2={chartWidth - 20} y1={tick.y} y2={tick.y} stroke="var(--line)" strokeDasharray={tick.value === 0 ? undefined : "3 5"} />
              <text x={35} y={tick.y + 4} textAnchor="end" fill="var(--muted)" fontSize={10}>{tick.value}%</text>
            </g>
          ))}
          {chart.points.length > 1 && <polyline points={line} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" aria-hidden="true" />}
          {chart.points.map((point, index) => {
            const current = point.id === currentAttemptId;
            const label = `Attempt ${point.attemptNumber}, ${dateFormatter.format(new Date(point.submittedAt))}, ${point.score} out of ${point.maxScore}, ${point.percentage.toFixed(1)} percent${current ? ", result being viewed" : ""}`;
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
                className="cursor-pointer rounded-sm"
              >
                <title>{label}</title>
                <rect x={point.x - 12} y={point.y - 22} width={24} height={44} fill="transparent" />
                {current && <circle cx={point.x} cy={point.y} r={10} fill="var(--accent-soft)" stroke="var(--accent)" strokeWidth={1.5} />}
                <circle cx={point.x} cy={point.y} r={current ? 5 : 4} fill={current ? "var(--accent)" : "white"} stroke="var(--accent)" strokeWidth={2} />
                {current && <text x={point.x} y={Math.max(13, point.y - 17)} textAnchor={index === 0 ? "start" : index === chart.points.length - 1 ? "end" : "middle"} fill="var(--accent-strong)" fontSize={11} fontWeight={600}>{point.percentage.toFixed(1)}%</text>}
                {(chart.points.length <= 10 || current || index === 0 || index === chart.points.length - 1) && <text x={point.x} y={211} textAnchor="middle" fill={current ? "var(--accent-strong)" : "var(--muted)"} fontSize={10}>{point.attemptNumber}</text>}
              </g>
            );
          })}
        </svg>
      </div>
      <output aria-live="polite" className="mt-1 flex min-h-6 flex-wrap items-center gap-x-3 gap-y-1 text-xs tabular-nums text-muted">
        <span>#{activePoint.attemptNumber}</span>
        <span className="font-semibold text-accent">{activePoint.percentage.toFixed(1)}%</span>
        <span>{activePoint.score} / {activePoint.maxScore}</span>
        <time dateTime={activePoint.submittedAt}>{dateFormatter.format(new Date(activePoint.submittedAt))}</time>
      </output>
    </section>
  );
}
