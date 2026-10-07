import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { getRememberedUserFromCookies } from "@/lib/server-user";
import { AttemptError } from "@/server/attempt-store";
import { isUuid } from "@/lib/mock-validation";
import { attemptStore } from "@/server/attempts";
import { gradeFromPercentage } from "@/lib/grades";
import { calculatePercentile } from "@/lib/scoring";
import { Brand } from "@/components/brand";
import { OPTION_LABELS } from "@/lib/parser";
import { QuestionContent } from "@/components/question-content";
import "katex/dist/katex.min.css";
import "@/app/studio/studio.css";

export const metadata = { title: "Result" };
const dateFormatter = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "numeric", timeZone: "Asia/Kolkata" });

export default async function ResultPage({ params }: PageProps<"/result/[attemptId]">) {
  const { attemptId } = await params;
  if (!isUuid(attemptId)) notFound();
  
  await connection();
  const user = await getRememberedUserFromCookies();
  if (!user) redirect("/");
  let data;
  try {
    data = await attemptStore.getResult(attemptId, user);
  } catch (error) {
    if (error instanceof AttemptError && (error.code === "not-found" || error.code === "forbidden")) notFound();
    throw error;
  }
  if (!data) redirect(`/exam/${attemptId}`);

  const { attempt, mock, questions, allScores } = data;
  const scorePercent = Number(mock.marksCorrect) > 0 && questions.length > 0 
    ? (Number(attempt.score) / (questions.length * Number(mock.marksCorrect))) * 100 
    : 0;
  const grade = gradeFromPercentage(scorePercent);
  const percentile = calculatePercentile(Number(attempt.score), allScores);
  const answers = attempt.answers;

  const attempted = (attempt.correctCount || 0) + (attempt.wrongCount || 0);
  const accuracy = attempted > 0 ? ((attempt.correctCount || 0) / attempted) * 100 : 0;
  
  const m = Math.floor((attempt.timeTakenSeconds || 0) / 60);
  const s = (attempt.timeTakenSeconds || 0) % 60;

  return <>
    <header className="border-b border-line bg-white">
      <div className="mx-auto flex min-h-16 max-w-5xl items-center justify-between gap-3 px-4 sm:px-8">
        <Brand />
        <Link href={`/u/${attempt.takenBy}/history`} className="flex min-h-11 items-center rounded-sm py-2 text-sm text-muted hover:text-accent">← History</Link>
      </div>
    </header>
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-7 sm:px-8 sm:py-10">
      <div>
        <p className="text-sm text-muted">Mock result</p>
        <h1 className="mt-2 break-words text-2xl font-semibold tracking-tight sm:text-3xl">{mock.title}</h1>
        <p className="mt-2 text-sm leading-6 text-muted">Completed by {attempt.takenBy} on {dateFormatter.format(new Date(attempt.submittedAt!))}</p>
      </div>

      <section aria-label="Result summary" className="mt-7 border-y border-line bg-white sm:mt-8">
        <div className="grid sm:grid-cols-[1fr_2fr]">
          <div className="border-b border-line px-4 py-6 sm:border-r sm:border-b-0 sm:p-6">
            <h2 className="text-sm font-medium text-muted">Your score</h2>
            <div className="mt-2 flex flex-wrap items-baseline gap-2 tabular-nums">
              <span className="text-5xl font-semibold tracking-tight text-accent">{attempt.score}</span>
              <span className="text-lg text-muted">/ {questions.length * Number(mock.marksCorrect)}</span>
            </div>
            <p className="mt-2 text-sm text-muted">{scorePercent.toFixed(1)}%</p>
          </div>
          <div className="grid grid-cols-2 gap-x-5 gap-y-6 px-4 py-5 sm:p-6 lg:grid-cols-3">
            <div>
              <h2 className="text-xs font-medium text-muted">Grade</h2>
              <div className="mt-1.5 text-2xl font-semibold tracking-tight">{grade}</div>
              <p className="mt-1 text-xs leading-5 text-muted">Based on percentage</p>
            </div>
            <div>
              <h2 className="text-xs font-medium text-muted">Time taken</h2>
              <div className="mt-1.5 text-2xl font-semibold tracking-tight tabular-nums">{m}m {s}s</div>
              <p className="mt-1 text-xs leading-5 text-muted">Out of {mock.durationMinutes}m</p>
            </div>
            <div className="col-span-2 border-t border-line pt-4 lg:col-span-1 lg:border-t-0 lg:pt-0">
              <h2 className="text-xs font-medium text-muted">Mockly attempt percentile</h2>
              <div className="mt-1.5 text-2xl font-semibold tracking-tight tabular-nums">
                {percentile !== null ? `${percentile.toFixed(1)}%` : "—"}
              </div>
              <p className="mt-1 text-xs leading-5 text-muted">{percentile !== null ? "Other attempts on this mock scoring strictly lower; ties excluded" : "Not enough attempts"}</p>
            </div>
          </div>
        </div>

      <dl className="grid grid-cols-2 gap-x-5 gap-y-5 border-t border-line px-4 py-5 tabular-nums sm:grid-cols-3 sm:p-6">
        <div><dt className="text-xs text-muted">Attempted</dt><dd className="mt-2 text-sm font-semibold">{attempted} / {questions.length}</dd></div>
        <div><dt className="text-xs text-muted">Correct</dt><dd className="mt-2 text-sm font-semibold text-green-700">{attempt.correctCount}</dd></div>
        <div><dt className="text-xs text-muted">Wrong</dt><dd className="mt-2 text-sm font-semibold text-red-600">{attempt.wrongCount}</dd></div>
        <div><dt className="text-xs text-muted">Accuracy</dt><dd className="mt-2 text-sm font-semibold">{accuracy.toFixed(1)}%</dd></div>
        <div><dt className="text-xs text-muted">Skipped</dt><dd className="mt-2 text-sm font-semibold">{attempt.skippedCount}</dd></div>
        <div><dt className="text-xs text-muted">Recorded time / attempted question</dt><dd className="mt-2 text-sm font-semibold">{attempted ? `${(answers.reduce((sum, answer) => sum + answer.timeSpentMs, 0) / attempted / 1000).toFixed(1)}s` : "—"}</dd></div>
      </dl>
      </section>

      <h2 className="mt-10 text-xl font-semibold tracking-tight">Review answers</h2>
      <ol aria-label="Questions review" className="mt-4 divide-y divide-line border-y border-line bg-white">
        {questions.map((question) => {
          const ans = answers.find(a => a.questionId === question.id);
          const isCorrect = ans?.selectedIndex === question.correctIndex;
          const isSkipped = ans?.selectedIndex === null || ans?.selectedIndex === undefined;
          
          let statusBadge;
          if (isSkipped) statusBadge = <span className="text-xs font-medium text-muted">Skipped</span>;
          else if (isCorrect) statusBadge = <span className="text-xs font-medium text-accent">Correct (+{mock.marksCorrect})</span>;
          else statusBadge = <span className="text-xs font-medium text-red-700">Wrong (−{mock.marksWrong})</span>;

          return (
            <li key={question.id} className="min-w-0 px-4 py-6 sm:p-6">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                <h3 className="text-sm font-semibold">Question {question.position}</h3>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  {ans?.markedForReview && <span className="text-xs font-medium text-muted">Marked for review</span>}
                  <span className="text-xs tabular-nums text-muted">{Math.round((ans?.timeSpentMs || 0) / 1000)}s</span>
                  {statusBadge}
                </div>
              </div>
              <QuestionContent text={question.questionText} />
              
              <ol className="mt-4 space-y-2">
                {question.options.map((option, index) => {
                  const correct = index === question.correctIndex;
                  const selected = index === ans?.selectedIndex;
                  let borderClass = "border-line";
                  let bgClass = "";
                  
                  if (correct) {
                    borderClass = "border-accent/40";
                    bgClass = "bg-accent-soft";
                  } else if (selected && !correct) {
                    borderClass = "border-red-400";
                    bgClass = "bg-red-50";
                  }

                  return (
                    <li key={index} className={`min-w-0 rounded-md border px-3 py-2.5 sm:px-4 ${borderClass} ${bgClass}`}>
                      <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-xs font-medium">
                        <span>{OPTION_LABELS[index]}</span>
                        <div className="flex flex-wrap gap-x-3 gap-y-1">
                          {selected && <span className={correct ? "text-accent" : "text-red-700"}>Your answer</span>}
                          {correct && <span className="text-accent">Correct answer</span>}
                        </div>
                      </div>
                      <QuestionContent text={option} />
                    </li>
                  );
                })}
              </ol>
            </li>
          );
        })}
      </ol>
    </main>
  </>;
}
