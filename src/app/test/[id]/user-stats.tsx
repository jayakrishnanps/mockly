type Stats = {
  totalAttempts: number;
  bestScore: number;
  latestScore: number;
  avgScore: number;
  bestAccuracy: number;
  avgTime: number;
};

export function UserStats({ stats }: { stats: Stats | null }) {
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
    </div>
  );
}
