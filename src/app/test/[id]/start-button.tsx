"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@/lib/users";
import { startAttempt } from "@/app/exam/actions";

export function StartButton({ testId, user, activeAttemptId }: { testId: string; user: User | null; activeAttemptId?: string }) {
  const router = useRouter();
  const busy = useRef(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!user) return <Link href="/" className="inline-flex min-h-11 items-center text-sm text-accent">Choose an assigned user to start</Link>;
  if (activeAttemptId) return <Link href={`/exam/${activeAttemptId}`} className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-md bg-accent px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent/90">Resume mock as {user}</Link>;

  async function handleStart() {
    if (busy.current) return;
    busy.current = true;
    setLoading(true);
    setError(null);
    try {
      const result = await startAttempt(testId, user);
      if (result.ok) router.push(`/exam/${result.attemptId}`);
      else setError(result.error);
    } catch {
      setError("Could not connect. Please try again.");
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }
  return <div className="shrink-0 sm:max-w-xs">
    <button onClick={handleStart} disabled={loading} className="min-h-12 w-full rounded-md bg-accent px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent/90 disabled:opacity-50">{loading ? "Starting…" : `Start mock as ${user}`}</button>
    {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
  </div>;
}
