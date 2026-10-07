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
    <div className="mt-8 rounded-2xl border border-line bg-gray-50 p-5 sm:p-7">
      <h2 className="text-sm font-semibold tracking-tight">Your Performance</h2>
      <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div>
          <dt className="text-xs text-muted">Attempts</dt>
          <dd className="mt-1 text-sm font-semibold">{stats.totalAttempts}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Best Score</dt>
          <dd className="mt-1 text-sm font-semibold text-green-700">{stats.bestScore.toFixed(2)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Latest Score</dt>
          <dd className="mt-1 text-sm font-semibold">{stats.latestScore.toFixed(2)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Average Score</dt>
          <dd className="mt-1 text-sm font-semibold">{stats.avgScore.toFixed(2)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Best Accuracy</dt>
          <dd className="mt-1 text-sm font-semibold">{stats.bestAccuracy.toFixed(1)}%</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Average Time</dt>
          <dd className="mt-1 text-sm font-semibold">
            {Math.floor(stats.avgTime / 60)}m {stats.avgTime % 60}s
          </dd>
        </div>
      </dl>
      <div className="mt-5 border-t border-line pt-3">
        <a href={`/test/${testId}/export?user=${user}`} download className="inline-flex min-h-11 items-center rounded-lg py-2 text-sm font-medium text-accent underline decoration-accent/30 underline-offset-4 hover:decoration-accent">
          Download all attempts (.txt)
        </a>
        <p className="text-xs leading-5 text-muted">All {stats.totalAttempts} completed {stats.totalAttempts === 1 ? "attempt" : "attempts"} on this mock, including questions, answers and time spent.</p>
      </div>
    </div>
  );
}

