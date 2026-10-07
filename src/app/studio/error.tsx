"use client";

import Link from "next/link";

export default function StudioError({ retry }: { retry: () => void }) {
  return <main className="mx-auto max-w-xl px-5 py-12">
    <h1 className="text-xl font-semibold">Studio could not be loaded.</h1>
    <p className="mt-3 text-sm leading-6 text-muted">Your browser draft has been kept. Please check your connection and try again.</p>
    <div className="mt-6 flex flex-wrap gap-4">
      <button type="button" onClick={retry} className="min-h-11 rounded-lg bg-accent px-4 text-sm font-medium text-white">Try again</button>
      <Link href="/" className="rounded-lg px-4 py-3 text-sm text-accent">Back to mocks</Link>
    </div>
  </main>;
}
