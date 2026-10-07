import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isUuid } from "@/lib/mock-validation";
import { mockStore } from "@/server/mocks";
import { Brand } from "@/components/brand";
import { StudioWorkspace } from "@/components/studio-workspace";
import "katex/dist/katex.min.css";
import "./studio.css";

export const metadata: Metadata = { title: "Studio" };

export default async function StudioPage({ searchParams }: PageProps<"/studio">) {
  const query = await searchParams;
  let target = null;
  if (query.test !== undefined) {
    if (!isUuid(query.test)) notFound();
    const mock = await mockStore.get(query.test.toLowerCase());
    if (!mock) notFound();
    target = { id: mock.id, title: mock.title, forUsers: mock.forUsers };
  }
  return (
    <>
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex min-h-18 max-w-5xl items-center justify-between gap-3 px-4 sm:px-8">
          <Brand />
          <Link href="/" className="inline-flex min-h-11 items-center rounded-sm py-2 text-sm text-muted hover:text-accent">← Mocks</Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-7 sm:px-8 sm:py-10">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Studio</h1>
          <p className="mt-2 text-sm leading-6 text-muted">{target ? "Add questions to this mock." : "Prepare a mock and review the questions before saving."}</p>
        </div>
        <StudioWorkspace target={target} />
      </main>
    </>
  );
}
