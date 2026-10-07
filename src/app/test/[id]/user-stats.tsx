import type { User } from "@/lib/users";

type Stats = {
  totalAttempts: number;
  bestScore: number;
  latestScore: number;
  avgScore: number;
  bestAccuracy: number;
  avgTime: number;
};

export function UserStats({ stats, testId, user }: { stats: Stats | null; testId: string; user: User }) {
  if (!stats) return <p className="mt-8 text-sm text-muted">No completed attempts yet.</p>;

  return (
    <section className="mt-7 border-b border-line pb-6">
      <h2 className="text-lg font-semibold tracking-tight">Your performance</h2>
      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-5 tabular-nums sm:grid-cols-3">
        <div>
          <dt className="text-xs text-muted">Attempts</dt>
          <dd className="mt-1 text-sm font-semibold">{stats.totalAttempts}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Best score</dt>
          <dd className="mt-1 text-sm font-semibold text-accent">{stats.bestScore.toFixed(2)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Latest score</dt>
          <dd className="mt-1 text-sm font-semibold">{stats.latestScore.toFixed(2)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Average score</dt>
          <dd className="mt-1 text-sm font-semibold">{stats.avgScore.toFixed(2)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Best accuracy</dt>
          <dd className="mt-1 text-sm font-semibold">{stats.bestAccuracy.toFixed(1)}%</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Average time</dt>
          <dd className="mt-1 text-sm font-semibold">
            {Math.floor(stats.avgTime / 60)}m {stats.avgTime % 60}s
          </dd>
        </div>
      </dl>
      <div className="mt-4">
        <a href={`/test/${testId}/export?user=${user}`} download className="inline-flex min-h-11 items-center rounded-lg py-2 text-sm font-medium text-accent underline decoration-accent/30 underline-offset-4 hover:decoration-accent">
          Download all attempts (.txt)
        </a>
        <p className="text-xs leading-5 text-muted">All {stats.totalAttempts} completed {stats.totalAttempts === 1 ? "attempt" : "attempts"} on this mock, including questions, answers and time spent.</p>
      </div>
    </section>
  );
}

