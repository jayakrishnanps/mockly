import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { EmptyState } from "@/components/empty-state";
import { ClearHistory } from "@/components/clear-history";
import { attemptStore } from "@/server/attempts";
import { isUser } from "@/lib/users";
import { gradeFromPercentage } from "@/lib/grades";

export const metadata = { title: "History" };
const dateFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata",
});

export default async function HistoryPage({ params }: PageProps<"/u/[user]/history">) {
  const { user } = await params;
  if (!isUser(user)) notFound();

  await connection();
  const [history, active] = await Promise.all([attemptStore.getUserHistory(user), attemptStore.getActiveAttempts(user)]);

  return (
    <>
      <div className="mb-6 sm:mb-8">
        <h1 className="page-title text-3xl">History</h1>
        {history.length > 0 && <ClearHistory user={user} />}
      </div>
      
      {active.length > 0 && <section className="mb-8 space-y-3" aria-label="In progress">
        <h2 className="text-lg font-semibold">In progress</h2>
        {active.map((attempt) => <Link key={attempt.id} href={`/exam/${attempt.id}`} className="flex min-h-16 items-center justify-between gap-4 rounded-xl border border-line bg-accent-soft px-4 py-4 text-sm"><span className="min-w-0 break-words font-medium">{attempt.mockTitle}</span><span className="shrink-0 font-medium text-accent">Resume →</span></Link>)}
      </section>}
      {history.length === 0 ? (
        <EmptyState title="No history yet.">
          Once you complete mock tests, your practice history will appear here.
        </EmptyState>
      ) : (
        <ul className="divide-y divide-line rounded-xl border border-line bg-white" aria-label="Completed attempts">
          {history.map((record) => {
            const scorePercent = Number(record.marksCorrect) > 0 && record.totalQuestions > 0 
              ? (Number(record.score) / (record.totalQuestions * Number(record.marksCorrect))) * 100 
              : 0;
            const grade = gradeFromPercentage(scorePercent);
            
            return (
              <li key={record.id} className="min-w-0">
                <Link href={`/result/${record.id}`} className="group grid grid-cols-[minmax(0,1fr)_4.25rem] items-start gap-3 rounded-xl px-4 py-5 hover:bg-accent-soft/50 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-6 sm:px-6 sm:py-6">
                  <div className="min-w-0 flex-1">
                    <h2 className="break-words text-base font-semibold leading-6 tracking-tight group-hover:text-accent sm:text-lg">{record.mockTitle}</h2>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs leading-5 tabular-nums text-muted sm:gap-x-4">
                      <time dateTime={new Date(record.submittedAt!).toISOString()}>
                        {dateFormatter.format(new Date(record.submittedAt!))}
                      </time>
                      <span>{Math.floor((record.timeTakenSeconds || 0) / 60)}m {(record.timeTakenSeconds || 0) % 60}s</span>
                      <span>{record.totalQuestions} questions</span>
                      <span>{scorePercent.toFixed(1)}% score</span>
                      <span>{((record.correctCount ?? 0) + (record.wrongCount ?? 0)) ? ((record.correctCount ?? 0) / ((record.correctCount ?? 0) + (record.wrongCount ?? 0)) * 100).toFixed(1) : "0"}% accuracy</span>
                    </div>
                  </div>
                  <div className="flex min-w-0 flex-col gap-3 border-l border-line pl-3 text-right tabular-nums sm:flex-row sm:items-baseline sm:gap-6 sm:pl-5">
                    <div>
                      <div className="break-words text-lg font-semibold leading-6 tracking-tight sm:text-xl">{record.score}</div>
                      <div className="text-xs text-muted">Score</div>
                    </div>
                    <div>
                      <div className={`text-xl font-semibold ${grade === 'S' || grade.startsWith('A') ? 'text-green-800' : grade.startsWith('B') ? 'text-blue-800' : grade.startsWith('C') ? 'text-yellow-800' : 'text-red-800'}`}>
                        {grade}
                      </div>
                      <div className="text-xs text-muted">Grade</div>
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
