"use client";

import Link from "next/link";
import { useId, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@/lib/users";
import { startAttempt } from "@/app/exam/actions";

type StartButtonProps = {
  testId: string;
  user: User | null;
  activeAttemptId?: string;
  questionSelection?: { available: number; defaultCount: number };
  durationMinutes?: number;
};

export function StartButton({ testId, user, activeAttemptId, questionSelection, durationMinutes }: StartButtonProps) {
  const router = useRouter();
  const countId = useId();
  const busy = useRef(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [questionCount, setQuestionCount] = useState(String(questionSelection ? Math.min(questionSelection.defaultCount, questionSelection.available) : ""));
  if (!user) return <Link href="/" className="inline-flex min-h-11 items-center text-sm text-accent">Choose an assigned user to start</Link>;
  if (activeAttemptId) return <Link href={`/exam/${activeAttemptId}`} className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-md bg-accent px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent/90">Resume mock as {user}</Link>;

  async function handleStart(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    const count = questionSelection ? Number(questionCount) : undefined;
    if (questionSelection && (count === undefined || !Number.isSafeInteger(count) || count < 1 || count > questionSelection.available)) {
      setError(`Choose a whole number of questions from 1 to ${questionSelection.available}.`);
      return;
    }
    busy.current = true;
    setLoading(true);
    setError(null);
    try {
      const result = await startAttempt(testId, user, count);
      if (result.ok) router.push(`/exam/${result.attemptId}`);
      else setError(result.error);
    } catch {
      setError("Could not connect. Please try again.");
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }
  return <form onSubmit={handleStart} className="shrink-0 sm:max-w-xs">
    {questionSelection && <div className="mb-4">
      <div className="flex items-center justify-between gap-4">
        <label htmlFor={countId} className="text-sm font-medium">Questions this time</label>
        <input
          id={countId}
          type="number"
          inputMode="numeric"
          min={1}
          max={questionSelection.available}
          step={1}
          required
          disabled={loading}
          value={questionCount}
          onChange={(event) => { setQuestionCount(event.target.value); setError(null); }}
          aria-describedby={`${countId}-hint${error ? ` ${countId}-error` : ""}`}
          aria-invalid={error ? true : undefined}
          className="min-h-11 w-24 rounded-md border border-line bg-white px-3 py-2 text-base tabular-nums disabled:opacity-50"
        />
      </div>
      <p id={`${countId}-hint`} className="mt-2 text-xs leading-5 text-muted">
        Randomly selected from {questionSelection.available} questions.
        {durationMinutes !== undefined && ` Time limit stays ${durationMinutes} minutes.`}
      </p>
    </div>}
    <button type="submit" disabled={loading} className="min-h-12 w-full rounded-md bg-accent px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent/90 disabled:opacity-50">{loading ? "Starting…" : `Start mock as ${user}`}</button>
    {error && <p id={`${countId}-error`} role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
  </form>;
}
