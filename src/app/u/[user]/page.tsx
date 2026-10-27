import { and, arrayContains, desc, isNull } from "drizzle-orm";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import Link from "next/link";
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
      <div className={user === "JK" ? "mb-8 sm:mb-10" : "he-mocks-intro mb-7"}>
        <div className={user === "HE" ? "he-intro-copy" : undefined}>
          <h1 className={user === "JK" ? "page-title text-4xl sm:text-5xl" : "page-title text-3xl"}>Your mocks</h1>
          {user === "HE" && <>
            <p className="he-intro-note">One question at a time.</p>
            <div className="he-intro-links">
              <span>{mocks.length} {mocks.length === 1 ? "mock" : "mocks"} available</span>
              <Link href="/u/HE/history">View history <span aria-hidden="true">↗</span></Link>
            </div>
          </>}
        </div>
      </div>

      {mocks.length === 0 ? (
        <EmptyState title="No mocks assigned yet.">
          Mocks assigned to {user} will appear here.
        </EmptyState>
      ) : (
        <MockList user={user} searchable={user === "JK"} mocks={mocks.map((mock) => ({
          ...mock,
          createdAt: new Date(mock.createdAt).toISOString(),
          createdDate: mockCreatedDate(mock.createdAt),
          createdLabel: dateFormatter.format(new Date(mock.createdAt)),
        }))} />
      )}
    </>
  );
}
