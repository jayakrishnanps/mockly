"use client";

import Link from "next/link";
import { useState } from "react";
import { EmptyState } from "@/components/empty-state";
import { matchesMockFilter } from "@/lib/mock-filter";
import type { User } from "@/lib/users";

type MockListItem = {
  id: string;
  title: string;
  details: string | null;
  durationMinutes: number;
  createdAt: string;
  createdDate: string;
  createdLabel: string;
};

export function MockList({ mocks, searchable, user }: { mocks: MockListItem[]; searchable: boolean; user: User }) {
  const isJK = user === "JK";
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const filtered = searchable ? mocks.filter((mock) => matchesMockFilter(mock, title, date)) : mocks;
  const hasFilters = !!title || !!date;

  return <>
    {searchable && <div role="search" aria-label="Find a mock" className={isJK ? "mb-8 border-b border-black bg-white pb-6 sm:mb-10" : "mb-5 rounded-xl border border-line bg-white p-4 sm:p-5"}>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3 sm:grid-cols-[minmax(0,1fr)_12rem_auto]">
        <div className="col-span-2 min-w-0 sm:col-span-1">
          <label htmlFor="mock-search" className="block text-xs font-medium text-muted">Search by title</label>
          <input id="mock-search" type="search" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Mock name" className="mt-2 min-h-11 w-full min-w-0 rounded-lg border border-line bg-white px-3 py-2.5 text-base sm:text-sm" />
        </div>
        <div className="min-w-0">
          <label htmlFor="mock-created-date" className="block text-xs font-medium text-muted">Created on (IST)</label>
          <input id="mock-created-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} className="mt-2 min-h-11 w-full min-w-0 rounded-lg border border-line bg-white px-3 py-2.5 text-base sm:text-sm" />
        </div>
        <button type="button" disabled={!hasFilters} onClick={() => { setTitle(""); setDate(""); }} className="min-h-11 rounded-lg px-3 py-2.5 text-sm font-medium text-accent hover:bg-accent-soft disabled:opacity-40">Clear</button>
      </div>
      <p role="status" aria-live="polite" aria-atomic="true" className="mt-3 text-xs text-muted">{hasFilters ? `${filtered.length} of ${mocks.length}` : mocks.length} {mocks.length === 1 ? "mock" : "mocks"}</p>
    </div>}
    {filtered.length === 0 ? <EmptyState title="No matching mocks.">Try another title or creation date, or clear the filters.</EmptyState> :
      <ul className={isJK ? "divide-y divide-black border-y border-black bg-white" : "divide-y divide-line rounded-xl border border-line bg-white"} aria-label="Assigned mocks">
        {filtered.map((mock) => (
          <li key={mock.id} className="min-w-0">
            <Link href={`/test/${mock.id}`} className={isJK ? "group flex min-h-28 items-center gap-4 py-6 sm:gap-6 sm:py-8" : "group flex items-center gap-3 rounded-xl px-4 py-5 hover:bg-accent-soft/50 sm:gap-5 sm:px-6 sm:py-6"}>
              <div className="min-w-0 flex-1">
                <h2 className={isJK ? "break-words text-lg font-semibold leading-7 tracking-tight underline-offset-4 group-hover:underline sm:text-xl" : "break-words text-base font-semibold leading-6 tracking-tight group-hover:text-accent sm:text-lg"}>{mock.title}</h2>
                {mock.details && <p className="mt-1 line-clamp-2 break-words text-sm leading-6 text-muted">{mock.details}</p>}
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted">
                  <span className="font-medium tabular-nums text-foreground">{mock.durationMinutes} minutes</span>
                  <span>Created <time dateTime={mock.createdAt}>{mock.createdLabel}</time></span>
                </div>
              </div>
              <span aria-hidden="true" className={isJK ? "flex size-10 shrink-0 items-center justify-center rounded-md border border-black bg-white text-lg text-black transition-colors group-hover:bg-black group-hover:text-white" : "flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent"}>→</span>
            </Link>
          </li>
        ))}
      </ul>}
  </>;
}
