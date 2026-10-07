import { arrayContains, desc } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { EmptyState } from "@/components/empty-state";
import { db } from "@/db";
import { tests } from "@/db/schema";
import { isUser } from "@/lib/users";

const dateFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Asia/Kolkata",
});

export default async function MocksPage({ params }: PageProps<"/u/[user]">) {
  const { user } = await params;
  // Layouts and pages can render in parallel; validate before querying too.
  if (!isUser(user)) notFound();

  await connection();
  const mocks = await db
    .select({
      id: tests.id,
      title: tests.title,
      details: tests.details,
      durationMinutes: tests.durationMinutes,
      createdAt: tests.createdAt,
    })
    .from(tests)
    .where(arrayContains(tests.forUsers, [user]))
    .orderBy(desc(tests.createdAt), desc(tests.id));

  return (
    <>
      <div className="mb-9">
        <p className="eyebrow">{user}’S PRACTICE SPACE</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Your mocks</h1>
        <p className="mt-3 text-sm leading-6 text-muted">A little more prepared, one mock at a time.</p>
      </div>

      {mocks.length === 0 ? (
        <EmptyState title="No mocks assigned yet.">
          Mocks assigned to {user} will appear here.
        </EmptyState>
      ) : (
        <ul className="grid gap-5 sm:grid-cols-2" aria-label="Assigned mocks">
          {mocks.map((mock) => (
            <li key={mock.id} className="min-w-0">
              <Link href={`/test/${mock.id}`} className="flex h-full flex-col rounded-2xl border border-line bg-white p-6 transition-colors hover:border-accent/50">
                <div className="mb-5 flex items-center justify-between gap-3">
                  <span className="eyebrow">MOCK TEST</span>
                  <span className="shrink-0 rounded-full bg-accent-soft px-3 py-1 text-xs font-medium text-accent">
                    {mock.durationMinutes} min
                  </span>
                </div>
                <h2 className="break-words text-lg font-semibold tracking-tight">{mock.title}</h2>
                {mock.details && <p className="mt-2 line-clamp-3 break-words text-sm leading-6 text-muted">{mock.details}</p>}
                <div className="mt-auto pt-6 text-xs text-muted">
                  Created <time dateTime={new Date(mock.createdAt).toISOString()}>{dateFormatter.format(new Date(mock.createdAt))}</time>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
