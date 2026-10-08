import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getRememberedUserFromCookies } from "@/lib/server-user";
import { isUuid } from "@/lib/mock-validation";
import { bankStore } from "@/server/banks";
import { BankWorkspace } from "@/components/bank-workspace";
import { BankMockForm } from "@/components/bank-mock-form";
import { BankDeleteButton } from "@/components/bank-delete-button";
import { QuestionPreview } from "@/components/question-preview";
import "katex/dist/katex.min.css";
import "@/app/studio/studio.css";

export const metadata = { title: "Question bank" };

export default async function BankPage({ params, searchParams }: PageProps<"/u/[user]/bank/[bankId]">) {
  const { user, bankId } = await params;
  if (user !== "JK" || !isUuid(bankId)) notFound();
  const selected = await getRememberedUserFromCookies();
  if (selected !== "JK") redirect(selected ? `/u/${selected}` : "/");
  const query = await searchParams;
  const requestedPage = Number(query.page);
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 && requestedPage <= 1000000 ? requestedPage : 1;
  const bank = await bankStore.get(bankId.toLowerCase(), page);
  if (!bank) notFound();

  return <>
    <Link href="/u/JK/bank" className="inline-flex min-h-11 items-center text-sm text-accent">← Question bank</Link>
    <div className="mb-7 mt-2 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0"><h1 className="break-words text-2xl font-semibold tracking-tight sm:text-3xl">{bank.title}</h1><p className="mt-2 text-sm text-muted">{bank.questionCount} saved {bank.questionCount === 1 ? "question" : "questions"}</p></div>
    </div>
    <details className="mb-8 border-y border-line bg-white px-4 sm:px-6">
      <summary className="cursor-pointer py-5 text-base font-semibold text-accent">Create a mock from this bank</summary>
      <div className="pb-6"><BankMockForm bankId={bank.id} title={bank.title} questionCount={bank.questionCount} /></div>
    </details>
    <BankWorkspace bankId={bank.id} />
    <section className="mt-10" aria-labelledby="saved-bank-questions">
      <h2 id="saved-bank-questions" className="text-xl font-semibold tracking-tight">Saved questions</h2>
      <p className="mt-2 text-sm text-muted">Questions here stay in the bank when you delete a mock.</p>
      {bank.questions.length === 0 ? <p className="py-6 text-sm text-muted">No saved questions on this page.</p> :
        <ol className="mt-4 divide-y divide-line border-y border-line bg-white">
          {bank.questions.map((question) => <li key={question.id} className="min-w-0 px-4 py-5 sm:p-6">
            <h3 className="mb-3 text-xs font-semibold text-muted">Question {question.position}</h3>
            <QuestionPreview question={question} number={question.position} />
          </li>)}
        </ol>}
      <nav aria-label="Saved question pages" className="mt-4 flex justify-between gap-4 text-sm text-accent">
        {page > 1 ? <Link className="inline-flex min-h-11 items-center" href={`/u/JK/bank/${bank.id}?page=${page - 1}`}>← Previous</Link> : <span />}
        {bank.hasNext && <Link className="inline-flex min-h-11 items-center" href={`/u/JK/bank/${bank.id}?page=${page + 1}`}>Next →</Link>}
      </nav>
    </section>
    <BankDeleteButton bankId={bank.id} />
  </>;
}
