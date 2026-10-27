import { and, arrayContains, asc, desc, isNull } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { WeakAreasWorkspace } from "@/components/weak-areas-workspace";
import { db } from "@/db";
import { tests } from "@/db/schema";
import { getRememberedUserFromCookies } from "@/lib/server-user";
import { weakAreaReportStore } from "@/server/weak-area-reports";
import { heWeakReportStore } from "@/server/he-weak-reports";
import { HEWeakPosts } from "@/components/he-weak-posts";
import { isUser } from "@/lib/users";

export const metadata = { title: "Weak areas" };

export default async function WeakAreasPage({ params }: PageProps<"/u/[user]/weak-areas">) {
  const { user } = await params;
  if (!isUser(user)) notFound();
  await connection();
  const selected = await getRememberedUserFromCookies();
  if (selected !== user) redirect(selected ? `/u/${selected}` : "/");
  if (user === "HE") {
    const reports = await heWeakReportStore.list();
    return <>
      <div data-page-heading className="mb-6 sm:mb-8"><h1 className="page-title text-3xl">Weak areas</h1></div>
      <HEWeakPosts reports={reports} />
    </>;
  }
  const [reports, mocks, heMocks] = await Promise.all([
    weakAreaReportStore.list(),
    db.select({ id: tests.id, title: tests.title }).from(tests)
      .where(and(arrayContains(tests.forUsers, ["JK"]), isNull(tests.deletedAt)))
      .orderBy(desc(tests.createdAt), asc(tests.id)),
    db.select({ id: tests.id, title: tests.title }).from(tests)
      .where(and(arrayContains(tests.forUsers, ["HE"]), isNull(tests.deletedAt)))
      .orderBy(desc(tests.createdAt), asc(tests.id)),
  ]);

  return <>
    <div data-page-heading className="mb-8 sm:mb-10">
      <h1 className="page-title text-4xl sm:text-5xl">Weak areas</h1>
    </div>
    <WeakAreasWorkspace reports={reports} mocks={mocks} heMocks={heMocks} />
  </>;
}
