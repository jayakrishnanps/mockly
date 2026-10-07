import { getRememberedUserFromCookies } from "@/lib/server-user";
import { attemptStore } from "@/server/attempts";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Brand } from "@/components/brand";
import { DeleteMock } from "@/components/delete-mock";
import { QuestionPreview } from "@/components/question-preview";
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
      <div className="mx-auto flex min-h-20 max-w-5xl items-center justify-between gap-4 px-5 sm:px-8">
        <Brand />
        <Link href="/" className="rounded-sm py-2 text-sm text-muted hover:text-accent">← Back to mocks</Link>
      </div>
    </header>
    <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-10 sm:px-8 sm:py-14">
      <p className="eyebrow">MOCK DETAILS</p>
      
      <div className="mt-3 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <h1 className="break-words text-3xl font-semibold tracking-tight sm:text-4xl">{mock.title}</h1>
        <StartButton testId={mock.id} user={assigned ? user : null} activeAttemptId={active.find((attempt) => attempt.testId === id)?.id} />
      </div>
      
      {mock.details && <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-7 text-muted">{mock.details}</p>}
      <dl className="mt-7 grid grid-cols-2 gap-5 rounded-2xl border border-line bg-white p-5 sm:grid-cols-3 sm:p-7">
        {[
          ["Assigned to", mock.forUsers.join(" & ")],
          ["Questions", String(mock.questions.length)],
          ["Duration", `${mock.durationMinutes} minutes`],
          ["Correct answer", `+${Number(mock.marksCorrect)}`],
          ["Wrong answer", Number(mock.marksWrong) === 0 ? "0" : `−${Number(mock.marksWrong)}`],
          ["Created", dateFormatter.format(new Date(mock.createdAt))],
        ].map(([label, value]) => <div key={label}>
          <dt className="text-xs text-muted">{label}</dt><dd className="mt-2 text-sm font-semibold">{value}</dd>
        </div>)}
      </dl>

      {assigned && <UserStats stats={stats} />}

      <div className="mb-6 mt-10 flex flex-wrap items-start justify-between gap-4">
        <div><h2 className="text-xl font-semibold tracking-tight">Questions</h2><p className="mt-2 text-sm text-muted">Management preview · correct answers are visible.</p></div>
        <Link href={`/studio?test=${mock.id}`} className="rounded-lg border border-line bg-white px-4 py-2.5 text-sm font-medium hover:border-accent hover:text-accent">Add questions</Link>
      </div>
      <ol aria-label="Saved questions" className="space-y-5">
        {mock.questions.map((question) => <li key={question.id}>
          <article aria-label={`Question ${question.position}`} className="min-w-0 rounded-2xl border border-line bg-white p-5 sm:p-7">
            <h3 className="mb-5 text-sm font-semibold">Question {question.position}</h3>
            <QuestionPreview question={question} number={question.position} />
          </article>
        </li>)}
      </ol>
      {!mock.questions.length && <p className="py-6 text-sm text-muted">No questions saved yet.</p>}
      <DeleteMock id={mock.id} forUsers={mock.forUsers} />
    </main>
  </>;
}
