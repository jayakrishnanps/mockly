import type { User } from "@/lib/users";
import { WeakAreaReportPrompt } from "@/components/weak-area-report-prompt";

type Stats = {
  totalAttempts: number;
  bestScore: number;
  latestScore: number;
  avgScore: number;
  bestAccuracy: number;
  avgTime: number;
  scoreIsPercent?: boolean;
};

export function UserStats({ stats, testId, user, mockTitle }: { stats: Stats | null; testId: string; user: User; mockTitle: string }) {
  if (!stats) return <p className="mt-5 rounded-xl border border-line bg-white px-5 py-5 text-sm text-muted sm:px-7">No completed attempts yet.</p>;

  return (
    <section data-performance-summary className="mt-5 rounded-xl border border-line bg-white p-5 sm:p-7">
      <h2 className="text-lg font-semibold tracking-tight">Your performance</h2>
      <dl className="mt-5 grid grid-cols-2 gap-x-5 gap-y-5 tabular-nums sm:grid-cols-3 sm:gap-y-6">
        <div>
          <dt className="text-xs text-muted">Attempts</dt>
          <dd className="mt-1.5 text-lg font-semibold">{stats.totalAttempts}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Best score</dt>
          <dd className="mt-1.5 text-lg font-semibold text-accent">{stats.bestScore.toFixed(2)}{stats.scoreIsPercent ? "%" : ""}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Latest score</dt>
          <dd className="mt-1.5 text-lg font-semibold">{stats.latestScore.toFixed(2)}{stats.scoreIsPercent ? "%" : ""}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Average score</dt>
          <dd className="mt-1.5 text-lg font-semibold">{stats.avgScore.toFixed(2)}{stats.scoreIsPercent ? "%" : ""}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Best accuracy</dt>
          <dd className="mt-1.5 text-lg font-semibold">{stats.bestAccuracy.toFixed(1)}%</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Average time</dt>
          <dd className="mt-1.5 text-lg font-semibold">
            {Math.floor(stats.avgTime / 60)}m {stats.avgTime % 60}s
          </dd>
        </div>
      </dl>
      {stats.scoreIsPercent && <p className="mt-3 text-xs leading-5 text-muted">Scores are shown as percentages because attempts can use different numbers of questions.</p>}
      <div className="mt-5 border-t border-line pt-4">
        <a href={`/test/${testId}/export?user=${user}`} download className="inline-flex min-h-11 items-center rounded-lg py-2 text-sm font-medium text-accent underline decoration-accent/30 underline-offset-4 hover:decoration-accent">
          Download all attempts (.txt)
        </a>
        <p className="mt-1 max-w-xl text-xs leading-5 text-muted">Summaries for all {stats.totalAttempts} completed {stats.totalAttempts === 1 ? "attempt" : "attempts"}, with focused question histories from the latest 10.</p>
      </div>
      {user === "JK" && <WeakAreaReportPrompt testId={testId} title={mockTitle} />}
    </section>
  );
}

