"use client";

import Link from "next/link";

export default function MockError({ retry }: { retry: () => void }) {
  return <main className="mx-auto max-w-3xl px-5 py-16">
    <h1 className="text-2xl font-semibold">This mock could not be loaded.</h1>
    <p className="mt-3 text-sm leading-6 text-muted">Please check your connection and try again.</p>
    <div className="mt-5 flex gap-5 text-sm text-accent"><button type="button" onClick={retry} className="cursor-pointer underline">Try again</button><Link href="/" className="underline">Back to mocks</Link></div>
  </main>;
}
