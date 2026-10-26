import { getRememberedUserFromCookies } from "@/lib/server-user";
import { attemptStore } from "@/server/attempts";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Brand } from "@/components/brand";
import { DeleteMock } from "@/components/delete-mock";
import { QuestionContent } from "@/components/question-content";
import { isUuid } from "@/lib/mock-validation";
import { mockStore } from "@/server/mocks";
import { StartButton } from "./start-button";
import { UserStats } from "./user-stats";
import "katex/dist/katex.min.css";
import "@/app/studio/studio.css";

export const metadata = { title: "Mock details" };
const dateFormatter = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });

export default async function MockPage({ params }: PageProps<"/test/[id]">) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  await connection();
  const mock = await mockStore.get(id.toLowerCase());
  if (!mock) notFound();
  const user = await getRememberedUserFromCookies();
  const assigned = user && mock.forUsers.includes(user);
  const [stats, active] = assigned ? await Promise.all([attemptStore.getMockStats(id, user), attemptStore.getActiveAttempts(user)]) : [null, []];
  const addQuestionsHref = mock.sourceBankId
    ? user === "JK" ? `/u/JK/bank/${mock.sourceBankId}` : null
    : `/studio?test=${mock.id}`;
  const previewDescription = mock.sourceBankId
    ? "New attempts draw from the question bank’s current pool, including questions added later. Attempts already started keep their saved questions. Preview shows the first 25 current bank questions."
    : mock.questionLimit === null
      ? "Preview the questions before you begin."
      : "Each new attempt draws a random selection from this mock’s saved questions. Preview shows the first 25.";
  const previewQuestions = mock.sourceBankId || mock.questionLimit !== null ? mock.questions.slice(0, 25) : mock.questions;

  return <>
    <header className="border-b border-line bg-white">
      <div className="mx-auto flex min-h-18 max-w-5xl items-center justify-between gap-3 px-4 sm:px-8">
        <Brand user={user} />
        <Link href={user ? `/u/${user}` : "/"} className="inline-flex min-h-11 shrink-0 items-center rounded-lg px-2 py-2 text-sm font-medium text-muted hover:bg-white/60 hover:text-accent">← Mocks</Link>
      </div>
    </header>
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-8 sm:py-10">
      <section className={user === "JK" ? "border-y border-line bg-white py-6 sm:py-8" : "rounded-xl border border-line bg-white p-5 sm:p-7"}>
        <div className="flex flex-col items-stretch justify-between gap-5 sm:flex-row sm:items-start sm:gap-8">
          <h1 className="min-w-0 flex-1 break-words text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">{mock.title}</h1>
          <StartButton testId={mock.id} user={assigned ? user : null} activeAttemptId={active.find((attempt) => attempt.testId === id)?.id} />
        </div>

        {mock.details && <p className="mt-4 max-w-3xl whitespace-pre-wrap break-words text-sm leading-7 text-muted">{mock.details}</p>}
        <dl className="mt-6 grid grid-cols-2 gap-x-5 gap-y-5 border-t border-line pt-5 sm:grid-cols-3 sm:gap-y-6 sm:pt-6">
          {[
            ["Assigned to", mock.forUsers.join(" & ")],
            [mock.questionLimit === null ? "Questions" : "Questions per attempt", mock.questionLimit === null ? String(mock.questionCount) : `${Math.min(mock.questionLimit, mock.questionCount)} of ${mock.questionCount}`],
            ["Duration", `${mock.durationMinutes} minutes`],
            ["Correct answer", `+${Number(mock.marksCorrect)}`],
            ["Wrong answer", Number(mock.marksWrong) === 0 ? "0" : `−${Number(mock.marksWrong)}`],
            ["Created", dateFormatter.format(new Date(mock.createdAt))],
          ].map(([label, value]) => <div key={label} className="min-w-0">
            <dt className="text-xs leading-5 text-muted">{label}</dt><dd className="mt-1 break-words text-sm font-semibold tabular-nums">{value}</dd>
          </div>)}
        </dl>
      </section>

      {assigned && <UserStats stats={stats} testId={mock.id} user={user} />}

      <div className="mb-4 mt-8 flex flex-col items-start justify-between gap-4 sm:mt-10 sm:flex-row">
        <div className="min-w-0 max-w-2xl"><h2 className="text-lg font-semibold tracking-tight">{mock.sourceBankId ? "Question bank preview" : "Questions"}</h2><p className="mt-1 text-sm leading-6 text-muted">{previewDescription}</p></div>
        {addQuestionsHref && <Link href={addQuestionsHref} className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg border border-line bg-white px-4 py-2.5 text-sm font-medium hover:border-accent hover:text-accent">Add questions</Link>}
      </div>
      <ol aria-label={mock.sourceBankId ? "Current bank questions" : "Saved questions"} className="divide-y divide-line rounded-xl border border-line bg-white">
        {previewQuestions.map((question) => <li key={question.id}>
          <article aria-label={`Question ${question.position}`} className="min-w-0 px-4 py-5 sm:px-6 sm:py-6">
            <h3 className="mb-3 text-xs font-semibold text-muted">Question {question.position}</h3>
            <QuestionContent text={question.questionText} />
          </article>
        </li>)}
      </ol>
      {mock.questionCount === 0 && <p className="py-6 text-sm text-muted">No questions saved yet.</p>}
      {assigned && <DeleteMock id={mock.id} user={user} />}
    </main>
  </>;
}
