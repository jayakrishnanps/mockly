import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { ForestGarden } from "@/components/forest-garden";
import { getRememberedUserFromCookies } from "@/lib/server-user";
import { forestStore } from "@/server/forest";

export const metadata = { title: "Forest" };

export default async function ForestPage({ params }: PageProps<"/u/[user]/forest">) {
  const { user } = await params;
  if (user !== "HE") notFound();
  await connection();
  const selected = await getRememberedUserFromCookies();
  if (selected !== "HE") redirect(selected ? `/u/${selected}` : "/");
  const counts = await forestStore.getHECounts();

  return <>
    <div data-page-heading className="mb-6 sm:mb-8">
      <h1 className="page-title text-3xl">Forest</h1>
      <p className="mt-2 text-sm text-muted">1 test = 1 plant</p>
    </div>
    <ForestGarden counts={counts} />
  </>;
}
