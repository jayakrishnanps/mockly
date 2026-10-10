import { notFound, redirect } from "next/navigation";
import { getRememberedUserFromCookies } from "@/lib/server-user";
import { bankStore } from "@/server/banks";
import { BankCreateForm } from "@/components/bank-create-form";
import { BankList } from "@/components/bank-list";
import { EmptyState } from "@/components/empty-state";
import { mockCreatedDate } from "@/lib/mock-filter";

export const metadata = { title: "Question bank" };

const dateFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata",
});

export default async function BanksPage({ params }: PageProps<"/u/[user]/bank">) {
  const { user } = await params;
  if (user !== "JK") notFound();
  const selected = await getRememberedUserFromCookies();
  if (selected !== "JK") redirect(selected ? `/u/${selected}` : "/");
  const banks = await bankStore.list();

  return <>
    <div className="mb-7">
      <h1 className="text-3xl font-semibold tracking-tight">Question bank</h1>
      <p className="mt-2 max-w-xl text-sm leading-6 text-muted">Keep your questions together, then make mocks for JK, HE, or both.</p>
    </div>
    <BankCreateForm />
    <section className="mt-8" aria-label="Saved question banks">
      {banks.length === 0 ? <EmptyState title="No question banks here yet.">Create a bank, then paste your questions in the usual format.</EmptyState> :
        <BankList banks={banks.map((bank) => ({
          ...bank,
          createdAt: new Date(bank.createdAt).toISOString(),
          createdDate: mockCreatedDate(bank.createdAt),
          createdLabel: dateFormatter.format(new Date(bank.createdAt)),
        }))} />}
    </section>
  </>;
}
