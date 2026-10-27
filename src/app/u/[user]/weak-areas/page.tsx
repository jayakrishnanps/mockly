import { and, arrayContains, asc, desc, isNull } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { WeakAreasWorkspace } from "@/components/weak-areas-workspace";
import { db } from "@/db";
import { tests } from "@/db/schema";
import { getRememberedUserFromCookies } from "@/lib/server-user";
import { weakAreaReportStore } from "@/server/weak-area-reports";

export const metadata = { title: "Weak areas" };

export default async function WeakAreasPage({ params }: PageProps<"/u/[user]/weak-areas">) {
  const { user } = await params;
  if (user !== "JK") notFound();
  await connection();
  const selected = await getRememberedUserFromCookies();
  if (selected !== "JK") redirect(selected ? `/u/${selected}` : "/");
  const [reports, mocks] = await Promise.all([
    weakAreaReportStore.list(),
    db.select({ id: tests.id, title: tests.title }).from(tests)
      .where(and(arrayContains(tests.forUsers, ["JK"]), isNull(tests.deletedAt)))
      .orderBy(desc(tests.createdAt), asc(tests.id)),
  ]);

  return <>
    <div data-page-heading className="mb-8 sm:mb-10">
      <h1 className="page-title text-4xl sm:text-5xl">Weak areas</h1>
    </div>
    <WeakAreasWorkspace reports={reports} mocks={mocks} />
  </>;
}
