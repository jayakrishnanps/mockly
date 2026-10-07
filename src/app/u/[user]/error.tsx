"use client";

export default function DashboardError({ retry }: { retry: () => void }) {
  return (
    <div role="alert" className="rounded-2xl border border-line bg-white px-6 py-16 text-center">
      <h1 className="text-xl font-semibold">Couldn’t load this page.</h1>
      <p className="mt-3 text-sm text-muted">Please try again in a moment.</p>
      <button type="button" onClick={retry} className="mt-6 cursor-pointer rounded-lg border border-line px-4 py-2 text-sm font-medium hover:border-accent hover:text-accent">
        Try again
      </button>
    </div>
  );
}
