"use client";

import Link from "next/link";

export default function AttemptError({ retry }: { retry: () => void }) {
  return <main className="mx-auto max-w-xl p-8">
    <h1 className="text-xl font-semibold">Could not load this attempt</h1>
    <p className="mt-3 text-sm text-muted">Your saved data has been kept. Try again when the connection is available.</p>
    <div className="mt-6 flex gap-5">
      <button onClick={retry} className="rounded-lg bg-accent px-4 py-2 text-sm text-white">Try again</button>
      <Link href="/" className="py-2 text-sm text-accent">Back to mocks</Link>
    </div>
  </main>;
}
