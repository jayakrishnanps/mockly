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
        <div className="mx-auto flex min-h-20 max-w-5xl items-center justify-between gap-4 px-5 sm:px-8">
          <Brand />
          <Link href="/" className="rounded-sm py-2 text-sm text-muted hover:text-accent">← Back to mocks</Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-10 sm:px-8 sm:py-14">
        <div className="mb-9">
          <p className="eyebrow">A SPACE TO CREATE</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Studio</h1>
          <p className="mt-3 text-sm leading-6 text-muted">{target ? "Build the next batch for your mock." : "Set up a mock, check your questions, and save when ready."}</p>
        </div>
        <StudioWorkspace target={target} />
      </main>
    </>
  );
}
