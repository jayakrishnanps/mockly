import { and, arrayContains, desc, isNull } from "drizzle-orm";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { EmptyState } from "@/components/empty-state";
import { MockList } from "@/components/mock-list";
import { mockCreatedDate } from "@/lib/mock-filter";
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
        <MockList searchable={user === "JK"} mocks={mocks.map((mock) => ({
          ...mock,
          createdAt: new Date(mock.createdAt).toISOString(),
          createdDate: mockCreatedDate(mock.createdAt),
          createdLabel: dateFormatter.format(new Date(mock.createdAt)),
        }))} />
      )}
    </>
  );
}
