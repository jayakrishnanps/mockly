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
    <div className="mb-8 sm:mb-10">
      <h1 className="page-title text-4xl sm:text-5xl">Question bank</h1>
    </div>
    <BankCreateForm />
    <section className="mt-10 sm:mt-12" aria-label="Saved question banks">
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
