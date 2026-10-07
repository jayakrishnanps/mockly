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
      <div className="mb-7">
        <h1 className="text-3xl font-semibold tracking-tight">History</h1>
        <p className="mt-2 text-sm leading-6 text-muted">Your completed attempts and answer reviews.</p>
        {history.length > 0 && <ClearHistory user={user} />}
      </div>
      
      {active.length > 0 && <section className="mb-8 space-y-3" aria-label="In progress">
        <h2 className="text-lg font-semibold">In progress</h2>
        {active.map((attempt) => <Link key={attempt.id} href={`/exam/${attempt.id}`} className="flex min-h-14 items-center justify-between gap-4 border-l-2 border-accent bg-accent-soft px-4 py-3 text-sm"><span className="min-w-0 break-words font-medium">{attempt.mockTitle}</span><span className="shrink-0 font-medium text-accent">Resume →</span></Link>)}
      </section>}
      {history.length === 0 ? (
        <EmptyState title="No history yet.">
          Once you complete mock tests, your practice history will appear here.
        </EmptyState>
      ) : (
        <ul className="divide-y divide-line border-y border-line bg-white" aria-label="Completed attempts">
          {history.map((record) => {
            const scorePercent = Number(record.marksCorrect) > 0 && record.totalQuestions > 0 
              ? (Number(record.score) / (record.totalQuestions * Number(record.marksCorrect))) * 100 
              : 0;
            const grade = gradeFromPercentage(scorePercent);
            
            return (
              <li key={record.id} className="min-w-0">
                <Link href={`/result/${record.id}`} className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 px-4 py-5 transition-colors hover:bg-accent-soft/50 sm:items-center sm:gap-6 sm:px-6">
                  <div className="min-w-0 flex-1">
                    <h2 className="break-words text-lg font-semibold tracking-tight">{record.mockTitle}</h2>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs tabular-nums text-muted">
                      <time dateTime={new Date(record.submittedAt!).toISOString()}>
                        {dateFormatter.format(new Date(record.submittedAt!))}
                      </time>
                      <span>{Math.floor((record.timeTakenSeconds || 0) / 60)}m {(record.timeTakenSeconds || 0) % 60}s</span>
                      <span>{record.totalQuestions} questions</span>
                      <span>{scorePercent.toFixed(1)}% score</span>
                      <span>{((record.correctCount ?? 0) + (record.wrongCount ?? 0)) ? ((record.correctCount ?? 0) / ((record.correctCount ?? 0) + (record.wrongCount ?? 0)) * 100).toFixed(1) : "0"}% accuracy</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-3 text-right tabular-nums sm:flex-row sm:items-baseline sm:gap-6">
                    <div>
                      <div className="text-xl font-semibold">{record.score}</div>
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
