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

  return <>
    <header className="border-b border-line bg-white">
      <div className="mx-auto flex min-h-18 max-w-5xl items-center justify-between gap-3 px-4 sm:px-8">
        <Brand />
        <Link href="/" className="inline-flex min-h-11 shrink-0 items-center rounded-sm py-2 text-sm text-muted hover:text-accent">← Mocks</Link>
      </div>
    </header>
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-7 sm:px-8 sm:py-10">
      
      <div className="flex flex-col items-stretch justify-between gap-5 sm:flex-row sm:items-start sm:gap-8">
        <h1 className="min-w-0 flex-1 break-words text-2xl font-semibold tracking-tight sm:text-3xl">{mock.title}</h1>
        <StartButton testId={mock.id} user={assigned ? user : null} activeAttemptId={active.find((attempt) => attempt.testId === id)?.id} />
      </div>
      
      {mock.details && <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-7 text-muted">{mock.details}</p>}
      <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-5 border-y border-line py-5 sm:grid-cols-3 sm:py-6">
        {[
          ["Assigned to", mock.forUsers.join(" & ")],
          ["Questions", String(mock.questions.length)],
          ["Duration", `${mock.durationMinutes} minutes`],
          ["Correct answer", `+${Number(mock.marksCorrect)}`],
          ["Wrong answer", Number(mock.marksWrong) === 0 ? "0" : `−${Number(mock.marksWrong)}`],
          ["Created", dateFormatter.format(new Date(mock.createdAt))],
        ].map(([label, value]) => <div key={label}>
          <dt className="text-xs text-muted">{label}</dt><dd className="mt-1 text-sm font-semibold tabular-nums">{value}</dd>
        </div>)}
      </dl>

      {assigned && <UserStats stats={stats} testId={mock.id} user={user} />}

      <div className="mb-4 mt-9 flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-lg font-semibold tracking-tight">Questions</h2><p className="mt-1 text-sm text-muted">Preview the questions before you begin.</p></div>
        <Link href={`/studio?test=${mock.id}`} className="inline-flex min-h-11 items-center rounded-md border border-line px-4 py-2.5 text-sm font-medium transition-colors hover:border-accent hover:text-accent">Add questions</Link>
      </div>
      <ol aria-label="Saved questions" className="divide-y divide-line border-y border-line bg-white">
        {mock.questions.map((question) => <li key={question.id}>
          <article aria-label={`Question ${question.position}`} className="min-w-0 px-4 py-5 sm:px-6 sm:py-6">
            <h3 className="mb-3 text-xs font-semibold text-muted">Question {question.position}</h3>
            <QuestionContent text={question.questionText} />
          </article>
        </li>)}
      </ol>
      {!mock.questions.length && <p className="py-6 text-sm text-muted">No questions saved yet.</p>}
      <DeleteMock id={mock.id} forUsers={mock.forUsers} />
    </main>
  </>;
}
