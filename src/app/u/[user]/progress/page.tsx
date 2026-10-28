import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { JKProgressPanel } from "@/components/jk-progress-panel";
import { getRememberedUserFromCookies } from "@/lib/server-user";
import { getJKProgress } from "@/server/jk-progress";

export const metadata = { title: "Your progress" };

export default async function ProgressPage({ params }: PageProps<"/u/[user]/progress">) {
  const { user } = await params;
  if (user !== "JK") notFound();
  await connection();
  const remembered = await getRememberedUserFromCookies();
  if (remembered !== "JK") redirect(remembered ? `/u/${remembered}` : "/");

  return <JKProgressPanel progress={await getJKProgress()} />;
}
