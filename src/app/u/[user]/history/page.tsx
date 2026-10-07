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
      <div className="mb-9">
        <p className="eyebrow">LOOKING BACK</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">History</h1>
        <p className="mt-3 text-sm leading-6 text-muted">A dedicated place for your past attempts.</p>
        {history.length > 0 && <ClearHistory user={user} />}
      </div>
      
      {active.length > 0 && <section className="mb-8 space-y-3" aria-label="In progress">
        <h2 className="text-lg font-semibold">In progress</h2>
        {active.map((attempt) => <Link key={attempt.id} href={`/exam/${attempt.id}`} className="block rounded-xl border border-line bg-white p-4 text-sm">{attempt.mockTitle} <span className="text-accent">· Resume</span></Link>)}
      </section>}
      {history.length === 0 ? (
        <EmptyState title="No history yet.">
          Once you complete mock tests, your practice history will appear here.
        </EmptyState>
      ) : (
        <ul className="space-y-4" aria-label="Completed attempts">
          {history.map((record) => {
            const scorePercent = Number(record.marksCorrect) > 0 && record.totalQuestions > 0 
              ? (Number(record.score) / (record.totalQuestions * Number(record.marksCorrect))) * 100 
              : 0;
            const grade = gradeFromPercentage(scorePercent);
            
            return (
              <li key={record.id} className="min-w-0">
                <Link href={`/result/${record.id}`} className="flex flex-col gap-4 rounded-2xl border border-line bg-white p-5 transition-colors hover:border-accent/50 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-lg font-semibold tracking-tight">{record.mockTitle}</h2>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted">
                      <time dateTime={new Date(record.submittedAt!).toISOString()}>
                        {dateFormatter.format(new Date(record.submittedAt!))}
                      </time>
                      <span className="hidden h-1 w-1 rounded-full bg-line sm:block" aria-hidden="true" />
                      <span>{Math.floor((record.timeTakenSeconds || 0) / 60)}m {(record.timeTakenSeconds || 0) % 60}s</span>
                      <span className="hidden h-1 w-1 rounded-full bg-line sm:block" aria-hidden="true" />
                      <span>{record.totalQuestions} questions</span>
                      <span>{scorePercent.toFixed(1)}% score</span>
                      <span>{((record.correctCount ?? 0) + (record.wrongCount ?? 0)) ? ((record.correctCount ?? 0) / ((record.correctCount ?? 0) + (record.wrongCount ?? 0)) * 100).toFixed(1) : "0"}% accuracy</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-6 sm:text-right">
                    <div>
                      <div className="text-sm font-bold">{record.score}</div>
                      <div className="text-[10px] uppercase tracking-wider text-muted">Score</div>
                    </div>
                    <div>
                      <div className={`flex min-h-10 min-w-10 px-3 items-center justify-center rounded-lg text-sm font-bold ${grade === 'S' || grade.startsWith('A') ? 'bg-green-100 text-green-800' : grade.startsWith('B') ? 'bg-blue-100 text-blue-800' : grade.startsWith('C') ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>
                        {grade}
                      </div>
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
