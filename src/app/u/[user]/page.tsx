import { and, arrayContains, desc, isNull } from "drizzle-orm";
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
    .where(and(arrayContains(tests.forUsers, [user]), isNull(tests.deletedAt)))
    .orderBy(desc(tests.createdAt), desc(tests.id));

  return (
    <>
      <div className="mb-7">
        <h1 className="text-3xl font-semibold tracking-tight">Your mocks</h1>
        <p className="mt-2 text-sm leading-6 text-muted">Choose a mock to start or continue an attempt.</p>
      </div>

      {mocks.length === 0 ? (
        <EmptyState title="No mocks assigned yet.">
          Mocks assigned to {user} will appear here.
        </EmptyState>
      ) : (
        <ul className="divide-y divide-line border-y border-line bg-white" aria-label="Assigned mocks">
          {mocks.map((mock) => (
            <li key={mock.id} className="min-w-0">
              <Link href={`/test/${mock.id}`} className="group flex items-center gap-4 px-4 py-5 transition-colors hover:bg-accent-soft/50 sm:px-6 sm:py-6">
                <div className="min-w-0 flex-1">
                  <h2 className="break-words text-lg font-semibold tracking-tight group-hover:text-accent">{mock.title}</h2>
                  {mock.details && <p className="mt-1 line-clamp-2 break-words text-sm leading-6 text-muted">{mock.details}</p>}
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                    <span className="font-medium tabular-nums text-foreground">{mock.durationMinutes} minutes</span>
                    <span>Created <time dateTime={new Date(mock.createdAt).toISOString()}>{dateFormatter.format(new Date(mock.createdAt))}</time></span>
                  </div>
                </div>
                <span aria-hidden="true" className="shrink-0 text-lg text-accent">→</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
