"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { loadMockComparison } from "@/app/result/[attemptId]/comparison-actions";
import { pairLatestAttempts, type ComparisonAttempt, type MockComparison } from "@/lib/mock-comparison";
import { buildProgressChart, buildTimeProgressChart, formatProgressTime, PROGRESS_CHART_HEIGHT, PROGRESS_WINDOW_SIZE, type ProgressScale } from "@/lib/result-progress";
import type { User } from "@/lib/users";
import styles from "./shared-mock-comparison.module.css";

type LoadState = { status: "idle" } | { status: "loading" } | { status: "error"; message: string } | { status: "ready"; data: MockComparison };
type PlotPoint = ComparisonAttempt & { x: number; y: number; timeY: number | null; percentage: number };
const PEOPLE = ["JK", "HE"] as const;
const dateFormatter = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
const axisFormatter = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 1 });

function pathFor(points: PlotPoint[], metric: "y" | "timeY") {
  let path = "";
  let connected = false;
  for (const point of points) {
    const y = point[metric];
    if (y === null) { connected = false; continue; }
    path += `${connected ? "L" : "M"}${point.x},${y} `;
    connected = true;
  }
  return path.trim();
}

export function SharedMockComparison({ attemptId, user }: { attemptId: string; user: User }) {
  const id = useId();
  const [expanded, setExpanded] = useState(false);
  const [state, setState] = useState<LoadState>({ status: "idle" });
  const busy = useRef(false);
  const other = user === "JK" ? "HE" : "JK";

  async function load() {
    if (busy.current) return;
    busy.current = true;
    setState({ status: "loading" });
    try {
      const result = await loadMockComparison(attemptId);
      setState(result.ok ? { status: "ready", data: result.data } : { status: "error", message: result.error });
    } catch {
      setState({ status: "error", message: "Comparison could not be loaded. Please try again." });
    } finally {
      busy.current = false;
    }
  }

  function toggle() {
    if (busy.current) return;
    setExpanded(!expanded);
    if (!expanded && state.status === "idle") void load();
  }

  return <section className={styles.section} aria-label="Shared mock comparison">
    <div className={styles.triggerRow}>
      <button type="button" className={styles.trigger} disabled={state.status === "loading"} aria-expanded={expanded} aria-controls={`${id}-content`} onClick={toggle}>
        Compare with {other}<span aria-hidden="true">{expanded ? "−" : "+"}</span>
      </button>
    </div>
    <div id={`${id}-content`} hidden={!expanded}>
      {state.status === "loading" && <p className={styles.message} role="status">Loading comparison…</p>}
      {state.status === "error" && <div className={styles.message}><p role="alert">{state.message}</p><button type="button" className={styles.control} onClick={() => void load()}>Try again</button></div>}
      {state.status === "ready" && <ComparisonChart data={state.data} />}
    </div>
  </section>;
}

function ComparisonChart({ data }: { data: MockComparison }) {
  const container = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(320);
  const [range, setRange] = useState<number | "all">(0);
  const [scale, setScale] = useState<ProgressScale>("detail");
  const [showTime, setShowTime] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const paired = useMemo(() => pairLatestAttempts(data), [data]);
  const count = paired.JK.length;
  const pages = Math.ceil(count / PROGRESS_WINDOW_SIZE);
  const page = range === "all" ? 0 : Math.min(range, Math.max(0, pages - 1));
  const end = range === "all" ? count : count - page * PROGRESS_WINDOW_SIZE;
  const start = range === "all" ? 0 : Math.max(0, end - PROGRESS_WINDOW_SIZE);
  const visibleCount = end - start;
  const chartWidth = Math.max(width, showTime ? 420 : 280, range === "all" ? (visibleCount - 1) * 36 + (showTime ? 132 : 84) : 0);

  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(160, Math.floor(entry.contentRect.width))));
    observer.observe(element);
    return () => observer.disconnect();
  }, [count]);

  const graph = useMemo(() => {
    const visible = { JK: paired.JK.slice(start, end), HE: paired.HE.slice(start, end) };
    const combined = [...visible.JK, ...visible.HE];
    const score = buildProgressChart(combined, "all", chartWidth, scale, showTime);
    const time = showTime ? buildTimeProgressChart(score, scale) : null;
    const series = { JK: [] as PlotPoint[], HE: [] as PlotPoint[] };
    for (const [personIndex, person] of PEOPLE.entries()) {
      series[person] = visible[person].map((point, index) => {
        const offset = personIndex * visibleCount + index;
        const x = visibleCount === 1 ? (score.plot.left + score.plot.right) / 2 : score.plot.left + index / Math.max(1, visibleCount - 1) * (score.plot.right - score.plot.left);
        return { ...point, x, y: score.points[offset].y, timeY: time?.points[offset].y ?? null, percentage: point.score / point.maxScore * 100 };
      });
    }
    return { score, time, series };
  }, [paired, start, end, chartWidth, scale, showTime, visibleCount]);

  useEffect(() => {
    container.current?.scrollTo({ left: chartWidth > width ? chartWidth - width : 0 });
  }, [chartWidth, width, range]);

  if (count === 0) return <p className={styles.message}>Both people need a completed attempt.</p>;

  const selected = activeIndex === null ? visibleCount - 1 : Math.min(activeIndex, visibleCount - 1);

  return <div className={styles.panel}>
    <div className={styles.header}>
      <h2>Score comparison</h2>
      <div className={styles.legend} aria-label="People compared">
        {PEOPLE.map((person) => <span key={person} className={styles[person]}><i aria-hidden="true" />{person}</span>)}
      </div>
    </div>
    <div className={styles.toolbar}>
      <div className={styles.scale} role="group" aria-label="Comparison Y-axis scale">
        {(["detail", "full"] as const).map((value) => <button key={value} type="button" aria-pressed={scale === value} onClick={() => setScale(value)}>{value === "detail" ? "Detail" : "Full scale"}</button>)}
      </div>
      <button type="button" className={styles.control} aria-pressed={showTime} onClick={() => setShowTime(!showTime)}><span className={styles.dash} aria-hidden="true" />Time</button>
      <label className={styles.range}>
        <span className="sr-only">Comparison attempts shown</span>
        <select value={range} onChange={(event) => { setRange(event.target.value === "all" ? "all" : Number(event.target.value)); setActiveIndex(null); }}>
          {Array.from({ length: pages }, (_, index) => <option key={index} value={index}>{index === 0 ? "Latest 10" : `Earlier ${index * 10 + 1}–${Math.min((index + 1) * 10, count)}`}</option>)}
          <option value="all">All time</option>
        </select>
      </label>
    </div>
    <div className={styles.axisLabels}><span>Score (%)</span>{showTime && <span>Time</span>}</div>
    <div className={styles.plot}>
      <div className={styles.leftAxis} aria-hidden="true"><svg width="44" height={PROGRESS_CHART_HEIGHT}>{graph.score.ticks.map((tick) => <text key={tick.value} x="38" y={tick.y + 4} textAnchor="end">{axisFormatter.format(tick.value)}%</text>)}</svg></div>
      <div ref={container} className={styles.scroll}>
        <svg width={chartWidth} height={PROGRESS_CHART_HEIGHT} role="group" aria-label={`JK and HE score percentages across ${visibleCount} matched recent attempts${showTime ? "; dashed lines show completion time, with faster times higher on the right axis" : ""}`}>
          {graph.score.ticks.map((tick) => <line key={tick.value} x1={graph.score.plot.left} x2={graph.score.plot.right} y1={tick.y} y2={tick.y} stroke="var(--line)" strokeOpacity=".5" strokeDasharray="2 5" aria-hidden="true" />)}
          {PEOPLE.map((person) => <g key={person} className={styles[person]}>
            {visibleCount > 1 && <path d={pathFor(graph.series[person], "y")} fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinejoin="round" strokeLinecap="round" aria-hidden="true" />}
            {showTime && <path d={pathFor(graph.series[person], "timeY")} fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="6 4" strokeLinejoin="round" strokeLinecap="round" aria-hidden="true" />}
            {graph.series[person].map((point, index) => <g key={point.id} className={styles.point} tabIndex={0} role="button" aria-pressed={index === selected} aria-label={`${person}, attempt ${point.attemptNumber}, ${point.percentage.toFixed(1)} percent${showTime ? `, ${formatProgressTime(point.timeTakenSeconds)}` : ""}`} onFocus={() => setActiveIndex(index)} onMouseEnter={() => setActiveIndex(index)} onClick={() => setActiveIndex(index)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setActiveIndex(index); } }}>
              <rect x={point.x - 12} y={graph.score.plot.top - 12} width="24" height={graph.score.plot.bottom - graph.score.plot.top + 24} fill="transparent" />
              <circle className={styles.focusRing} cx={point.x} cy={point.y} r="13" fill="none" stroke="var(--foreground)" strokeWidth="2" aria-hidden="true" pointerEvents="none" />
              {index === selected && <circle cx={point.x} cy={point.y} r="9" fill="var(--comparison-surface)" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" />}
              <circle cx={point.x} cy={point.y} r={index === selected ? 4.5 : 3.5} fill={index === selected ? "currentColor" : "var(--comparison-surface)"} stroke="currentColor" strokeWidth="1.75" aria-hidden="true" />
              {point.timeY !== null && <circle cx={point.x} cy={point.timeY} r={index === selected ? 4.5 : 3} fill="var(--comparison-surface)" stroke="currentColor" strokeWidth="1.75" aria-hidden="true" />}
            </g>)}
          </g>)}
          {graph.series.JK.map((point, index) => (visibleCount <= 10 || index === 0 || index === visibleCount - 1 || index === selected) && <text key={point.id} x={point.x} y={PROGRESS_CHART_HEIGHT - 12} textAnchor="middle" fill="var(--muted)" fontSize="11">{start + index + 1}</text>)}
        </svg>
      </div>
      {graph.time && <div className={styles.rightAxis} aria-hidden="true"><svg width="64" height={PROGRESS_CHART_HEIGHT}>{graph.time.ticks.map((tick) => <text key={tick.value} x="8" y={tick.y + 4}>{formatProgressTime(tick.value)}</text>)}</svg></div>}
    </div>
    <output className={styles.readout} aria-live="polite">
      {PEOPLE.map((person) => {
        const point = graph.series[person][selected];
        return <div key={person}><span className={`${styles.person} ${styles[person]}`}>{person} <span>#{point.attemptNumber}</span></span><strong>{point.percentage.toFixed(1)}%</strong><span>{point.score} / {point.maxScore}</span>{showTime && <span>{formatProgressTime(point.timeTakenSeconds)}</span>}<time dateTime={point.submittedAt}>{dateFormatter.format(new Date(point.submittedAt))}</time></div>;
      })}
    </output>
  </div>;
}
