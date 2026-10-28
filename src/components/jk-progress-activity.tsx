"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import type { JKProgress } from "@/lib/jk-progress";
import styles from "./jk-progress-panel.module.css";

const dayFormatter = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const monthFormatter = new Intl.DateTimeFormat("en-IN", { month: "short", timeZone: "UTC" });

export function JKProgressActivity({ days }: { days: JKProgress["activity"] }) {
  const [selected, setSelected] = useState(Math.max(0, days.length - 1));
  const id = useId();
  const scroll = useRef<HTMLDivElement>(null);
  const buttons = useRef(new Map<number, HTMLButtonElement>());
  const maximum = Math.max(1, ...days.map((day) => day.count));
  const active = days[selected];

  useEffect(() => {
    if (scroll.current) scroll.current.scrollLeft = scroll.current.scrollWidth;
  }, []);

  function move(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const offsets: Record<string, number | undefined> = { ArrowLeft: -7, ArrowRight: 7, ArrowUp: -1, ArrowDown: 1 };
    const offset = offsets[event.key];
    if (offset === undefined && event.key !== "Home" && event.key !== "End") return;
    event.preventDefault();
    const next = event.key === "Home" ? 0 : event.key === "End" ? days.length - 1 : Math.max(0, Math.min(days.length - 1, index + (offset ?? 0)));
    setSelected(next);
    buttons.current.get(next)?.focus({ preventScroll: true });
    buttons.current.get(next)?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }

  return <>
    <p id={`${id}-keys`} className="sr-only">Choose a day to see its completed mocks and XP. Use arrow keys to move between days.</p>
    <div className={styles.activityScroll} ref={scroll}>
      <div className={styles.calendar}>
        <div className={styles.months} aria-hidden="true">
          {days.map((day, index) => (index === 0 || day.date.endsWith("-01") && index > 14) && <span key={day.date} style={{ gridColumn: Math.floor(index / 7) + 1 }}>{monthFormatter.format(new Date(`${day.date}T12:00:00Z`))}</span>)}
        </div>
        <div className={styles.days} role="group" aria-label="Daily practice" aria-describedby={`${id}-keys`}>
          {days.map((day, index) => {
            const intensity = day.count === 0 ? 0 : Math.max(1, Math.ceil(day.count / maximum * 4));
            return <button key={day.date} type="button" ref={(node) => { if (node) buttons.current.set(index, node); else buttons.current.delete(index); }} className={styles.day} data-intensity={intensity} aria-label={`${dayFormatter.format(new Date(`${day.date}T12:00:00Z`))}: ${day.count} completed mocks, ${day.xp} XP`} aria-pressed={selected === index} tabIndex={selected === index ? 0 : -1} onClick={() => setSelected(index)} onFocus={() => setSelected(index)} onKeyDown={(event) => move(event, index)}><span /></button>;
          })}
        </div>
      </div>
    </div>
    <div className={styles.activityFooter}>
      <div className={styles.dayDetails}>
        <button type="button" className={styles.changeDay} aria-label="Previous day" disabled={selected === 0} onClick={() => setSelected((value) => Math.max(0, value - 1))}>←</button>
        <div className={styles.selectedDay} role="status" aria-live="polite" aria-atomic="true">
          {active ? <><time dateTime={active.date}>{dayFormatter.format(new Date(`${active.date}T12:00:00Z`))}</time><span>{active.count} {active.count === 1 ? "mock" : "mocks"} · {active.xp} XP</span></> : <span>No activity yet.</span>}
        </div>
        <button type="button" className={styles.changeDay} aria-label="Next day" disabled={selected >= days.length - 1} onClick={() => setSelected((value) => Math.min(days.length - 1, value + 1))}>→</button>
      </div>
      <div className={styles.legend} aria-hidden="true"><span>Less</span>{[0, 1, 2, 3, 4].map((value) => <i key={value} className={styles.day} data-intensity={value}><span /></i>)}<span>More</span></div>
    </div>
  </>;
}
