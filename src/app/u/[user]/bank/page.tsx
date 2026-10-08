import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getRememberedUserFromCookies } from "@/lib/server-user";
import { bankStore } from "@/server/banks";
import { BankCreateForm } from "@/components/bank-create-form";
import { EmptyState } from "@/components/empty-state";

export const metadata = { title: "Question bank" };

export default async function BanksPage({ params, searchParams }: PageProps<"/u/[user]/bank">) {
  const { user } = await params;
  if (user !== "JK") notFound();
  const selected = await getRememberedUserFromCookies();
  if (selected !== "JK") redirect(selected ? `/u/${selected}` : "/");
  const query = await searchParams;
  const requestedPage = Number(query.page);
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 && requestedPage <= 1000000 ? requestedPage : 1;
  const banks = await bankStore.list(page);

  return <>
    <div className="mb-7">
      <h1 className="text-3xl font-semibold tracking-tight">Question bank</h1>
      <p className="mt-2 max-w-xl text-sm leading-6 text-muted">Keep your questions together, then make mocks for JK, HE, or both.</p>
    </div>
    <BankCreateForm />
    <section className="mt-8" aria-label="Saved question banks">
      {banks.items.length === 0 ? <EmptyState title="No question banks here yet.">Create a bank, then paste your questions in the usual format.</EmptyState> :
        <ul className="divide-y divide-line border-y border-line bg-white">
          {banks.items.map((bank) => <li key={bank.id}>
            <Link href={`/u/JK/bank/${bank.id}`} className="flex min-h-20 items-center justify-between gap-4 px-4 py-5 hover:bg-accent-soft/50 sm:px-6">
              <div className="min-w-0"><h2 className="break-words text-lg font-semibold">{bank.title}</h2><p className="mt-1 text-sm text-muted">{bank.questionCount} {bank.questionCount === 1 ? "question" : "questions"}</p></div>
              <span aria-hidden="true" className="text-accent">→</span>
            </Link>
          </li>)}
        </ul>}
      <nav aria-label="Question bank pages" className="mt-4 flex justify-between gap-4 text-sm text-accent">
        {page > 1 ? <Link className="inline-flex min-h-11 items-center" href={`/u/JK/bank?page=${page - 1}`}>← Previous</Link> : <span />}
        {banks.hasNext && <Link className="inline-flex min-h-11 items-center" href={`/u/JK/bank?page=${page + 1}`}>Next →</Link>}
      </nav>
    </section>
  </>;
}
