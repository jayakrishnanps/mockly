"use client";

import Link from "next/link";
import { useState } from "react";
import { EmptyState } from "@/components/empty-state";
import { matchesMockFilter } from "@/lib/mock-filter";

type MockListItem = {
  id: string;
  title: string;
  details: string | null;
  durationMinutes: number;
  createdAt: string;
  createdDate: string;
  createdLabel: string;
};

export function MockList({ mocks, searchable }: { mocks: MockListItem[]; searchable: boolean }) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const filtered = searchable ? mocks.filter((mock) => matchesMockFilter(mock, title, date)) : mocks;
  const hasFilters = !!title || !!date;

  return <>
    {searchable && <div role="search" aria-label="Find a mock" className="mb-5">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3 sm:grid-cols-[minmax(0,1fr)_12rem_auto]">
        <div className="col-span-2 min-w-0 sm:col-span-1">
          <label htmlFor="mock-search" className="block text-xs font-medium text-muted">Search by title</label>
          <input id="mock-search" type="search" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Mock name" className="mt-2 min-h-11 w-full min-w-0 rounded-md border border-line bg-white px-3 py-2.5 text-base sm:text-sm" />
        </div>
        <div className="min-w-0">
          <label htmlFor="mock-created-date" className="block text-xs font-medium text-muted">Created on (IST)</label>
          <input id="mock-created-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} className="mt-2 min-h-11 w-full min-w-0 rounded-md border border-line bg-white px-3 py-2.5 text-base sm:text-sm" />
        </div>
        <button type="button" disabled={!hasFilters} onClick={() => { setTitle(""); setDate(""); }} className="min-h-11 rounded-md px-3 py-2.5 text-sm text-accent hover:bg-accent-soft disabled:opacity-40">Clear</button>
      </div>
      <p role="status" aria-live="polite" aria-atomic="true" className="mt-3 text-xs text-muted">{hasFilters ? `${filtered.length} of ${mocks.length}` : mocks.length} {mocks.length === 1 ? "mock" : "mocks"}</p>
    </div>}
    {filtered.length === 0 ? <EmptyState title="No matching mocks.">Try another title or creation date, or clear the filters.</EmptyState> :
      <ul className="divide-y divide-line border-y border-line bg-white" aria-label="Assigned mocks">
        {filtered.map((mock) => (
          <li key={mock.id} className="min-w-0">
            <Link href={`/test/${mock.id}`} className="group flex items-center gap-4 px-4 py-5 transition-colors hover:bg-accent-soft/50 sm:px-6 sm:py-6">
              <div className="min-w-0 flex-1">
                <h2 className="break-words text-lg font-semibold tracking-tight group-hover:text-accent">{mock.title}</h2>
                {mock.details && <p className="mt-1 line-clamp-2 break-words text-sm leading-6 text-muted">{mock.details}</p>}
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                  <span className="font-medium tabular-nums text-foreground">{mock.durationMinutes} minutes</span>
                  <span>Created <time dateTime={mock.createdAt}>{mock.createdLabel}</time></span>
                </div>
              </div>
              <span aria-hidden="true" className="shrink-0 text-lg text-accent">→</span>
            </Link>
          </li>
        ))}
      </ul>}
  </>;
}
