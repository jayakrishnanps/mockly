import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { getRememberedUserFromCookies } from "@/lib/server-user";
import { AttemptError } from "@/server/attempt-store";
import { isUuid } from "@/lib/mock-validation";
import { attemptStore } from "@/server/attempts";
import { gradeFromPercentage } from "@/lib/grades";
import { averageAnsweredTime, calculatePercentile } from "@/lib/scoring";
import { buildAnswerReview } from "@/lib/result-review";
import { Brand } from "@/components/brand";
import { OPTION_LABELS } from "@/lib/parser";
import { QuestionContent } from "@/components/question-content";
import { ResultProgress } from "@/components/result-progress";
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
  const isJK = user === "JK";
  const scoreHistory = await attemptStore.getMockScoreHistory(attempt.testId, user);
  const scorePercent = Number(mock.marksCorrect) > 0 && questions.length > 0 
    ? (Number(attempt.score) / (questions.length * Number(mock.marksCorrect))) * 100 
    : 0;
  const grade = gradeFromPercentage(scorePercent);
  const percentile = calculatePercentile(Number(attempt.score), allScores);
  const answers = attempt.answers;
  const answerReview = buildAnswerReview(questions, answers);

  const attempted = (attempt.correctCount || 0) + (attempt.wrongCount || 0);
  const averageAnswerTimeMs = averageAnsweredTime(answers);
  const accuracy = attempted > 0 ? ((attempt.correctCount || 0) / attempted) * 100 : 0;
  
  const m = Math.floor((attempt.timeTakenSeconds || 0) / 60);
  const s = (attempt.timeTakenSeconds || 0) % 60;

  return <>
    <header className="border-b border-line bg-white">
      <div className="mx-auto flex min-h-16 max-w-5xl items-center justify-between gap-3 px-4 sm:px-8">
        <Brand user={user} />
        <Link href={`/u/${attempt.takenBy}/history`} className="flex min-h-11 shrink-0 items-center rounded-lg px-2 py-2 text-sm font-medium text-muted hover:bg-white/60 hover:text-accent">← History</Link>
      </div>
    </header>
    <main className={`mx-auto w-full max-w-5xl flex-1 px-4 sm:px-8 ${isJK ? "py-8 sm:py-12" : "py-6 sm:py-10"}`}>
      <div data-result-heading>
        <p className="text-sm text-muted">Mock result</p>
        <h1 className={`mt-2 break-words font-semibold leading-tight ${isJK ? "text-3xl tracking-[-0.04em] sm:text-5xl" : "text-2xl tracking-tight sm:text-3xl"}`}>{mock.title}</h1>
        <p className="mt-2 text-sm leading-6 text-muted">Completed by {attempt.takenBy} on {dateFormatter.format(new Date(attempt.submittedAt!))}</p>
      </div>

      <section data-result-feedback aria-label="Result summary" className={`border border-line bg-white ${isJK ? "mt-8 overflow-hidden rounded-md" : "mt-6 rounded-xl sm:mt-8"}`}>
        <div className="grid sm:grid-cols-[1fr_2fr]">
          <div className={`he-score-panel min-w-0 border-b border-line px-5 py-6 sm:border-r sm:border-b-0 sm:p-7 ${isJK ? "bg-black text-white" : ""}`}>
            <h2 className={`text-sm font-medium ${isJK ? "text-white" : "text-muted"}`}>Your score</h2>
            <div className="mt-2 flex flex-wrap items-baseline gap-2 tabular-nums">
              <span className={`break-all font-semibold tracking-tight ${isJK ? "text-5xl text-white sm:text-6xl" : "text-4xl text-accent sm:text-5xl"}`}>{attempt.score}</span>
              <span className={`text-lg ${isJK ? "text-white" : "text-muted"}`}>/ {questions.length * Number(mock.marksCorrect)}</span>
            </div>
            <p className={`mt-2 text-sm ${isJK ? "text-white" : "text-muted"}`}>{scorePercent.toFixed(1)}%</p>
          </div>
          <div className="grid min-w-0 grid-cols-2 gap-x-4 gap-y-6 px-5 py-5 sm:p-7 lg:grid-cols-3">
            <div>
              <h2 className="text-xs font-medium text-muted">Grade</h2>
              <div className="mt-1.5 text-2xl font-semibold tracking-tight">{grade}</div>
              <p className="mt-1 text-xs leading-5 text-muted">Based on percentage</p>
            </div>
            <div>
              <h2 className="text-xs font-medium text-muted">Time taken</h2>
              <div className="mt-1.5 text-xl font-semibold tracking-tight tabular-nums sm:text-2xl">{m}m {s}s</div>
              <p className="mt-1 text-xs leading-5 text-muted">Out of {mock.durationMinutes}m</p>
            </div>
            <div className="col-span-2 border-t border-line pt-4 lg:col-span-1 lg:border-t-0 lg:pt-0">
              <h2 className="text-xs font-medium text-muted">Mockly attempt percentile</h2>
              <div className="mt-1.5 text-2xl font-semibold tracking-tight tabular-nums">
                {percentile !== null ? `${percentile.toFixed(1)}%` : "—"}
              </div>
              <p className="mt-1 text-xs leading-5 text-muted">{mock.questionLimit !== null ? "Not compared across random question sets" : percentile !== null ? "Other attempts on this mock scoring strictly lower; ties excluded" : "Not enough attempts"}</p>
            </div>
          </div>
        </div>

      <dl className="grid grid-cols-2 gap-x-5 gap-y-5 border-t border-line px-5 py-5 tabular-nums sm:grid-cols-3 sm:p-7">
        <div><dt className="text-xs text-muted">Attempted</dt><dd className="mt-2 text-sm font-semibold">{attempted} / {questions.length}</dd></div>
        <div><dt className="text-xs text-muted">Correct</dt><dd className={`mt-2 text-sm font-semibold ${isJK ? "text-green-900" : "text-green-700"}`}>{attempt.correctCount}</dd></div>
        <div><dt className="text-xs text-muted">Wrong</dt><dd className={`mt-2 text-sm font-semibold ${isJK ? "text-red-900" : "text-red-600"}`}>{attempt.wrongCount}</dd></div>
        <div><dt className="text-xs text-muted">Accuracy</dt><dd className="mt-2 text-sm font-semibold">{accuracy.toFixed(1)}%</dd></div>
        <div><dt className="text-xs text-muted">Skipped</dt><dd className="mt-2 text-sm font-semibold">{attempt.skippedCount}</dd></div>
        <div><dt className="text-xs text-muted">Recorded time / attempted question</dt><dd className="mt-2 text-sm font-semibold">{attempted ? `${(averageAnswerTimeMs / 1000).toFixed(1)}s` : "—"}</dd></div>
      </dl>
      </section>

      <ResultProgress history={scoreHistory} currentAttemptId={attempt.id} allowTime={user === "JK"} />

      <h2 data-review-heading className="mt-8 text-xl font-semibold tracking-tight sm:mt-10">Review answers</h2>
      <ol data-result-feedback aria-label="Questions review" className={`mt-4 ${isJK ? "space-y-6" : "space-y-4"}`}>
        {answerReview.map(({ question, answer: ans, status }) => {
          let statusBadge;
          if (status === "skipped") statusBadge = <span className={`rounded-md px-2 py-1 text-xs font-medium text-muted ${isJK ? "border border-black bg-white" : "bg-background"}`}>Skipped</span>;
          else if (status === "correct") statusBadge = <span className={`rounded-md px-2 py-1 text-xs font-medium ${isJK ? "border border-green-900 bg-white text-green-900" : "bg-green-50 text-green-800"}`}>Correct (+{mock.marksCorrect})</span>;
          else statusBadge = <span className={`rounded-md px-2 py-1 text-xs font-medium ${isJK ? "border border-red-900 bg-white text-red-900" : "bg-red-50 text-red-700"}`}>Wrong (−{mock.marksWrong})</span>;

          return (
            <li key={question.id} className={`min-w-0 border border-line bg-white p-5 sm:p-7 ${isJK ? "rounded-md" : "rounded-xl"}`}>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                <h3 className="text-sm font-semibold">Question {question.position}</h3>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  {user === "JK" && (
                    <span className="text-xs whitespace-nowrap text-muted tabular-nums">
                      Time spent: {ans ? `${(ans.timeSpentMs / 1000).toFixed(1)}s` : "—"}
                    </span>
                  )}
                  {ans?.markedForReview && <span className="text-xs font-medium text-muted">Marked for review</span>}
                  {statusBadge}
                </div>
              </div>
              <QuestionContent text={question.questionText} />
              
              <ol className="mt-4 space-y-2">
                {question.options.map((option, index) => {
                  const correct = index === question.correctIndex;
                  const selected = index === ans?.selectedIndex;
                  const correctTextClass = isJK ? "text-green-900" : "text-green-800";
                  const wrongTextClass = isJK ? "text-red-900" : "text-red-700";
                  let borderClass = "border-line";
                  let bgClass = "";
                  
                  if (correct) {
                    borderClass = isJK ? "border-green-900" : "border-green-300";
                    bgClass = isJK ? "bg-white" : "bg-green-50";
                  } else if (selected && !correct) {
                    borderClass = isJK ? "border-red-900" : "border-red-400";
                    bgClass = isJK ? "bg-white" : "bg-red-50";
                  }

                  return (
                    <li key={index} className={`min-w-0 border px-3 py-3 sm:px-4 ${isJK ? "rounded-sm" : "rounded-lg"} ${borderClass} ${bgClass}`}>
                      <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-xs font-medium">
                        <span>{OPTION_LABELS[index]}</span>
                        <div className="flex flex-wrap gap-x-3 gap-y-1">
                          {selected && <span className={correct ? correctTextClass : wrongTextClass}>Your answer</span>}
                          {correct && <span className={correctTextClass}>Correct answer</span>}
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
