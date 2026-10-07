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
      <div className="mx-auto flex min-h-20 max-w-5xl items-center justify-between gap-4 px-5 sm:px-8">
        <Brand />
        <Link href={`/u/${attempt.takenBy}/history`} className="rounded-sm py-2 text-sm text-muted hover:text-accent">← Back to history</Link>
      </div>
    </header>
    <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-10 sm:px-8 sm:py-14">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="eyebrow">MOCK RESULT</p>
          <h1 className="mt-3 break-words text-3xl font-semibold tracking-tight sm:text-4xl">{mock.title}</h1>
          <p className="mt-2 text-sm text-muted">Completed by {attempt.takenBy} on {dateFormatter.format(new Date(attempt.submittedAt!))}</p>
        </div>
        <a href={`/result/${attemptId}/export`} download={`${mock.title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}_result.txt`} className="rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-accent/90">
          Download .txt
        </a>
      </div>

      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-line bg-white p-6">
          <h2 className="text-xs font-semibold text-muted">SCORE</h2>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold tracking-tight text-foreground">{attempt.score}</span>
            <span className="text-sm font-medium text-muted">/ {questions.length * Number(mock.marksCorrect)}</span>
          </div>
          <p className="mt-1 text-xs text-muted">{scorePercent.toFixed(1)}%</p>
        </div>
        <div className="rounded-2xl border border-line bg-white p-6">
          <h2 className="text-xs font-semibold text-muted">GRADE</h2>
          <div className="mt-2 text-3xl font-bold tracking-tight text-foreground">{grade}</div>
          <p className="mt-1 text-xs text-muted">Based on percentage</p>
        </div>
        <div className="rounded-2xl border border-line bg-white p-6">
          <h2 className="text-xs font-semibold text-muted">MOCKLY ATTEMPT PERCENTILE</h2>
          <div className="mt-2 text-3xl font-bold tracking-tight text-foreground">
            {percentile !== null ? `${percentile.toFixed(1)}%` : "—"}
          </div>
          <p className="mt-1 text-xs text-muted">{percentile !== null ? "Other attempts on this mock scoring strictly lower; ties excluded" : "Not enough attempts"}</p>
        </div>
        <div className="rounded-2xl border border-line bg-white p-6">
          <h2 className="text-xs font-semibold text-muted">TIME TAKEN</h2>
          <div className="mt-2 text-3xl font-bold tracking-tight text-foreground">{m}m {s}s</div>
          <p className="mt-1 text-xs text-muted">Out of {mock.durationMinutes}m</p>
        </div>
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-5 rounded-2xl border border-line bg-white p-5 sm:grid-cols-4 sm:p-7">
        <div><dt className="text-xs text-muted">Attempted</dt><dd className="mt-2 text-sm font-semibold">{attempted} / {questions.length}</dd></div>
        <div><dt className="text-xs text-muted">Correct</dt><dd className="mt-2 text-sm font-semibold text-green-700">{attempt.correctCount}</dd></div>
        <div><dt className="text-xs text-muted">Wrong</dt><dd className="mt-2 text-sm font-semibold text-red-600">{attempt.wrongCount}</dd></div>
        <div><dt className="text-xs text-muted">Accuracy</dt><dd className="mt-2 text-sm font-semibold">{accuracy.toFixed(1)}%</dd></div>
        <div><dt className="text-xs text-muted">Skipped</dt><dd className="mt-2 text-sm font-semibold">{attempt.skippedCount}</dd></div>
        <div><dt className="text-xs text-muted">Recorded time / attempted question</dt><dd className="mt-2 text-sm font-semibold">{attempted ? `${(answers.reduce((sum, answer) => sum + answer.timeSpentMs, 0) / attempted / 1000).toFixed(1)}s` : "—"}</dd></div>
      </dl>

      <h2 className="mt-12 text-xl font-semibold tracking-tight">Review answers</h2>
      <ol aria-label="Questions review" className="mt-6 space-y-6">
        {questions.map((question) => {
          const ans = answers.find(a => a.questionId === question.id);
          const isCorrect = ans?.selectedIndex === question.correctIndex;
          const isSkipped = ans?.selectedIndex === null || ans?.selectedIndex === undefined;
          
          let statusBadge;
          if (isSkipped) statusBadge = <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">Skipped</span>;
          else if (isCorrect) statusBadge = <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-800">Correct (+{mock.marksCorrect})</span>;
          else statusBadge = <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-800">Wrong (−{mock.marksWrong})</span>;

          return (
            <li key={question.id} className="min-w-0 rounded-2xl border border-line bg-white p-5 sm:p-7">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-sm font-semibold">Question {question.position}</h3>
                <div className="flex flex-wrap items-center gap-2">
                  {ans?.markedForReview && <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-medium text-purple-800">Marked for review</span>}
                  <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-muted">{Math.round((ans?.timeSpentMs || 0) / 1000)}s</span>
                  {statusBadge}
                </div>
              </div>
              <QuestionContent text={question.questionText} />
              
              <ol className="mt-5 grid gap-3 sm:grid-cols-2">
                {question.options.map((option, index) => {
                  const correct = index === question.correctIndex;
                  const selected = index === ans?.selectedIndex;
                  let borderClass = "border-line";
                  let bgClass = "";
                  
                  if (correct) {
                    borderClass = "border-green-500 ring-1 ring-green-500";
                    bgClass = "bg-green-50";
                  } else if (selected && !correct) {
                    borderClass = "border-red-400";
                    bgClass = "bg-red-50";
                  }

                  return (
                    <li key={index} className={`min-w-0 rounded-xl border p-4 ${borderClass} ${bgClass}`}>
                      <div className="mb-2 flex items-center justify-between gap-2 text-xs font-semibold">
                        <span>{OPTION_LABELS[index]}</span>
                        <div className="flex gap-2">
                          {selected && <span className={correct ? "text-green-700" : "text-red-700"}>Your answer</span>}
                          {correct && <span className="text-green-700">Correct answer</span>}
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
