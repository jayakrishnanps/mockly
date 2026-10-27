"use client";

import { useId, useState } from "react";
import { FOREST_CAPACITY, FOREST_PERIODS, visiblePlantCount, type ForestCounts, type ForestPeriod } from "@/lib/forest";
import styles from "./forest-garden.module.css";

const countFormatter = new Intl.NumberFormat("en-IN");

const gardenSlots = Array.from({ length: FOREST_CAPACITY }, (_, index) => {
  const row = Math.floor(index / 5);
  const column = index % 5;
  return {
    index,
    row,
    column,
    distance: Math.abs(row - 2) + Math.abs(column - 2),
    x: 400 + (column - row) * 61,
    y: 154 + (row + column) * 35,
  };
}).sort((left, right) => left.distance - right.distance || left.row - right.row || left.column - right.column);

export function ForestGarden({ counts }: { counts: ForestCounts }) {
  const id = useId();
  const [period, setPeriod] = useState<ForestPeriod>("today");
  const count = counts[period];
  const visible = visiblePlantCount(count);
  const plants = gardenSlots.slice(0, visible).sort((left, right) => left.y - right.y || left.x - right.x);
  const plantIds = [`${id}-flowers`, `${id}-oak`, `${id}-shrub`, `${id}-pine`];

  return (
    <section aria-label="Your forest" className={styles.panel}>
      <div className={styles.controls}>
        <label htmlFor={`${id}-period`}>View</label>
        <select id={`${id}-period`} value={period} onChange={(event) => {
          const selected = FOREST_PERIODS.find((option) => option.value === event.target.value);
          if (selected) setPeriod(selected.value);
        }}>
          {FOREST_PERIODS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </div>

      <div className={styles.scene}>
        <svg viewBox="0 0 800 595" role="img" aria-labelledby={`${id}-title ${id}-description`} className={styles.garden}>
          <title id={`${id}-title`}>Your planted garden</title>
          <desc id={`${id}-description`}>{count} {count === 1 ? "plant" : "plants"} in this period. {visible} shown in the garden.</desc>
          <defs>
            <linearGradient id={`${id}-ground`} x1="235" y1="140" x2="525" y2="465" gradientUnits="userSpaceOnUse">
              <stop stopColor="#a8bb86" /><stop offset="1" stopColor="#77996b" />
            </linearGradient>
            <linearGradient id={`${id}-leaves`} x1="-30" y1="-90" x2="25" y2="-25" gradientUnits="userSpaceOnUse">
              <stop stopColor="#719269" /><stop offset="1" stopColor="#3d654c" />
            </linearGradient>
            <g id={`${id}-bloom`}>
              {[0, 72, 144, 216, 288].map((angle) => <ellipse key={angle} cx="0" cy="-5.5" rx="3.5" ry="6" fill="#fff4d7" transform={`rotate(${angle})`} />)}
              <circle r="3.5" fill="#cda861" /><circle cx="-0.8" cy="-1" r="1.2" fill="#e6ca83" />
            </g>
            <g id={`${id}-pink-bloom`}>
              {[0, 72, 144, 216, 288].map((angle) => <ellipse key={angle} cx="0" cy="-4" rx="3" ry="4.5" fill="#e7c3bc" transform={`rotate(${angle})`} />)}
              <circle r="2.3" fill="#c99e78" />
            </g>
            <g id={`${id}-flowers`}>
              <path d="M0 0c-10-20-11-34-10-61M0 0c7-23 14-36 20-53M0 0c-2-24 3-45 7-74" stroke="#537449" strokeWidth="3" strokeLinecap="round" />
              <path d="M-3-19c-17 0-22-10-22-20 14 1 21 8 22 20ZM5-23c17-1 23-10 24-20-15 2-22 9-24 20ZM-6-41c-13-2-17-10-16-18 11 3 16 9 16 18Z" fill="#719957" />
              <use href={`#${id}-bloom`} transform="translate(-10 -61) scale(1.1)" />
              <use href={`#${id}-bloom`} transform="translate(7 -74) scale(1.15)" />
              <use href={`#${id}-bloom`} transform="translate(20 -53)" />
              <use href={`#${id}-pink-bloom`} transform="translate(-18 -35) scale(.8)" />
            </g>
            <g id={`${id}-oak`}>
              <path d="M-5 0h10L3-52h-7Z" fill="#927a55" />
              <path d="m0-35-14-14m15 4 13-13" stroke="#927a55" strokeWidth="3" strokeLinecap="round" />
              <path d="M-30-46c-12-12-8-29 5-35-1-19 22-32 37-18 20-3 34 13 29 30 15 15 6 36-11 38-13 11-30 7-38-3-12 5-23 1-22-12Z" fill={`url(#${id}-leaves)`} />
              <path d="M-19-69c-3-12 4-21 15-20m11 5c9-2 17 3 20 10" stroke="#96ae7a" strokeWidth="5" strokeLinecap="round" opacity=".5" />
            </g>
            <g id={`${id}-shrub`}>
              <path d="M-8 0v-22M7 0v-24" stroke="#6d7550" strokeWidth="4" />
              <path d="M-31-14c-15-13-10-33 4-37 0-17 22-25 34-15 20-6 35 5 34 20 15 16 5 33-12 34-14 9-23 5-31-1-12 7-22 6-29-1Z" fill="#668363" />
              <use href={`#${id}-pink-bloom`} transform="translate(-20 -39) scale(1.2)" />
              <use href={`#${id}-pink-bloom`} transform="translate(0 -51) scale(1.5)" />
              <use href={`#${id}-pink-bloom`} transform="translate(21 -36) scale(1.4)" />
              <use href={`#${id}-pink-bloom`} transform="translate(-1 -27) scale(1.2)" />
              <use href={`#${id}-pink-bloom`} transform="translate(-29 -24) scale(.75)" />
            </g>
            <g id={`${id}-pine`}>
              <path d="M-4 0h8v-24h-8Z" fill="#927a55" />
              <path d="M0-96c-8 16-18 26-26 32l13 1c-9 14-20 25-30 32l18 1c-6 9-12 16-19 21 29 12 59 12 88 0-8-6-14-12-20-21l19-1c-10-7-21-18-30-32l13-1C18-70 8-80 0-96Z" fill="#4a7458" />
              <path d="M0-96c-7 17-13 27-19 34l10-1C-15-49-21-39-29-31l12 1c-3 8-9 16-16 23 10 3 21 5 33 5v-94Z" fill="#648765" />
              <path d="m-21-51 13-8m-20 32 18-8" stroke="#91aa7b" strokeWidth="3" strokeLinecap="round" opacity=".5" />
            </g>
          </defs>

          <ellipse cx="400" cy="512" rx="293" ry="49" fill="#344a30" opacity=".06" />
          <path d="m70 300 330 195v58L70 358Z" fill="#b6ad81" />
          <path d="m730 300-330 195v58l330-195Z" fill="#c9bf97" />
          <path d="m70 300 330 195v18L70 318Z" fill="#6d8c5f" />
          <path d="m730 300-330 195v18l330-195Z" fill="#63845a" />
          <path d="m400 105 330 195-330 195L70 300Z" fill={`url(#${id}-ground)`} />
          <path d="m400 105 330 195-330 195L70 300Z" stroke="#a6b88a" strokeWidth="2" />
          {[1, 2, 3, 4].map((step) => <g key={step} stroke="#c4d1aa" strokeWidth="1" opacity=".24">
            <path d={`M${400 + step * 66} ${105 + step * 39} ${70 + step * 66} ${300 + step * 39}`} />
            <path d={`M${400 - step * 66} ${105 + step * 39} ${730 - step * 66} ${300 + step * 39}`} />
          </g>)}
          {gardenSlots.map((slot) => <ellipse key={slot.index} cx={slot.x} cy={slot.y} rx="21" ry="8" fill="#6a8b5e" opacity=".16" />)}
          {plants.map((slot) => <g key={slot.index} transform={`translate(${slot.x} ${slot.y})`}>
            <ellipse cy="2" rx="29" ry="10" fill="#385f43" opacity=".18" />
            <use href={`#${plantIds[(slot.row * 3 + slot.column) % plantIds.length]}`} />
          </g>)}
          <path d="m91 334 10 6m-3 13 7 4m581-16 10-6m-15 26 10-6M377 520l10 5m31 2 9-5" stroke="#e1d8b5" strokeWidth="4" strokeLinecap="round" opacity=".65" />
        </svg>
      </div>

      <output aria-live="polite" aria-atomic="true" className={styles.total}>
        <span className={styles.count}>{countFormatter.format(count)}</span>
        <span className={styles.caption}>Plants</span>
      </output>
    </section>
  );
}
