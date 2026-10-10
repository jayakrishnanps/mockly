"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { EmptyState } from "@/components/empty-state";
import { BANK_PAGE_SIZE } from "@/lib/bank-validation";
import { matchesMockFilter } from "@/lib/mock-filter";

type BankListItem = {
  id: string;
  title: string;
  questionCount: number;
  createdAt: string;
  createdDate: string;
  createdLabel: string;
};

export function BankList({ banks }: { banks: BankListItem[] }) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [page, setPage] = useState(1);
  const filtered = useMemo(() => banks.filter((bank) => matchesMockFilter(bank, title, date)), [banks, title, date]);
  const hasFilters = !!title || !!date;
  const pageCount = Math.max(1, Math.ceil(filtered.length / BANK_PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visibleBanks = filtered.slice((currentPage - 1) * BANK_PAGE_SIZE, currentPage * BANK_PAGE_SIZE);

  return <>
    <div role="search" aria-label="Find a question bank" className="mb-5">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3 sm:grid-cols-[minmax(0,1fr)_12rem_auto]">
        <div className="col-span-2 min-w-0 sm:col-span-1">
          <label htmlFor="bank-search" className="block text-xs font-medium text-muted">Search by title</label>
          <input id="bank-search" type="search" value={title} onChange={(event) => { setTitle(event.target.value); setPage(1); }} placeholder="Bank name" className="mt-2 min-h-11 w-full min-w-0 rounded-md border border-line bg-white px-3 py-2.5 text-base sm:text-sm" />
        </div>
        <div className="min-w-0">
          <label htmlFor="bank-created-date" className="block text-xs font-medium text-muted">Created on (IST)</label>
          <input id="bank-created-date" type="date" value={date} onChange={(event) => { setDate(event.target.value); setPage(1); }} className="mt-2 min-h-11 w-full min-w-0 rounded-md border border-line bg-white px-3 py-2.5 text-base sm:text-sm" />
        </div>
        <button type="button" disabled={!hasFilters} onClick={() => { setTitle(""); setDate(""); setPage(1); }} className="min-h-11 rounded-md px-3 py-2.5 text-sm text-accent hover:bg-accent-soft disabled:opacity-40">Clear</button>
      </div>
      <p role="status" aria-live="polite" aria-atomic="true" className="mt-3 text-xs text-muted">{hasFilters ? `${filtered.length} of ${banks.length}` : banks.length} {banks.length === 1 ? "question bank" : "question banks"}</p>
    </div>
    {filtered.length === 0 ? <EmptyState title="No matching question banks.">Try another title or creation date, or clear the filters.</EmptyState> :
      <ul className="divide-y divide-line border-y border-line bg-white">
        {visibleBanks.map((bank) => <li key={bank.id} className="min-w-0">
          <Link href={`/u/JK/bank/${bank.id}`} className="group flex min-h-20 items-center justify-between gap-4 px-4 py-5 transition-colors hover:bg-accent-soft/50 sm:px-6">
            <div className="min-w-0">
              <h2 className="break-words text-lg font-semibold tracking-tight group-hover:text-accent">{bank.title}</h2>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                <span>{bank.questionCount} {bank.questionCount === 1 ? "question" : "questions"}</span>
                <span>Created <time dateTime={bank.createdAt}>{bank.createdLabel}</time></span>
              </div>
            </div>
            <span aria-hidden="true" className="shrink-0 text-accent">→</span>
          </Link>
        </li>)}
      </ul>}
    {pageCount > 1 && <nav aria-label="Question bank pages" className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
      <button type="button" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)} className="min-h-11 rounded-md px-3 py-2.5 text-accent hover:bg-accent-soft disabled:opacity-40">← Previous</button>
      <p role="status" aria-live="polite" aria-atomic="true" className="text-xs tabular-nums text-muted">Page {currentPage} of {pageCount}</p>
      <button type="button" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)} className="min-h-11 rounded-md px-3 py-2.5 text-accent hover:bg-accent-soft disabled:opacity-40">Next →</button>
    </nav>}
  </>;
}
