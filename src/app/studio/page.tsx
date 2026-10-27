import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { isUuid } from "@/lib/mock-validation";
import { getRememberedUserFromCookies } from "@/lib/server-user";
import { mockStore } from "@/server/mocks";
import { Brand } from "@/components/brand";
import { StudioWorkspace } from "@/components/studio-workspace";

export const metadata: Metadata = { title: "Studio" };

export default async function StudioPage({ searchParams }: PageProps<"/studio">) {
  const query = await searchParams;
  const user = await getRememberedUserFromCookies();
  let target = null;
  if (query.test !== undefined) {
    if (!isUuid(query.test)) notFound();
    const mock = await mockStore.get(query.test.toLowerCase());
    if (!mock) notFound();
    if (mock.sourceBankId) {
      redirect(user === "JK" ? `/u/JK/bank/${mock.sourceBankId}` : `/test/${mock.id}`);
    }
    target = { id: mock.id, title: mock.title, forUsers: mock.forUsers };
  }
  return (
    <>
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex min-h-18 max-w-5xl items-center justify-between gap-3 px-4 sm:px-8">
          <Brand user={user} />
          <Link href={user ? `/u/${user}` : "/"} className="inline-flex min-h-11 shrink-0 items-center rounded-lg border border-line bg-white px-3 py-2 text-sm font-medium text-muted hover:border-accent hover:text-accent">← Mocks</Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-7 sm:px-8 sm:py-10">
        <div className={user === "JK" ? "mb-8 border-b border-line pb-6 sm:mb-10 sm:pb-8" : "mb-7"}>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Studio</h1>
          <p className="mt-2 text-sm leading-6 text-muted">{target ? "Add questions to this mock." : "Prepare a mock and review the questions before saving."}</p>
        </div>
        <div className={user === "JK" ? "border border-line bg-white p-4 sm:p-8" : "rounded-xl border border-line bg-white p-4 sm:p-7"}>
          <StudioWorkspace target={target} />
        </div>
      </main>
    </>
  );
}
