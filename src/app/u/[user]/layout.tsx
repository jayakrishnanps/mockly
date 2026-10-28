import { notFound } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard-header";
import { isUser } from "@/lib/users";
import { connection } from "next/server";
import { getRememberedUserFromCookies } from "@/lib/server-user";
import { getJKLevel } from "@/server/jk-progress";

export default async function UserLayout({ children, params }: LayoutProps<"/u/[user]">) {
  const { user } = await params;
  if (!isUser(user)) notFound();
  let jkLevel: number | undefined;
  if (user === "JK") {
    await connection();
    if (await getRememberedUserFromCookies() === "JK") jkLevel = await getJKLevel();
  }

  return (
    <>
      <DashboardHeader user={user} jkLevel={jkLevel} />
      <main className="mx-auto w-full min-w-0 max-w-5xl flex-1 px-4 pt-7 pb-12 sm:px-8 sm:pt-10 sm:pb-16">
        {children}
      </main>
    </>
  );
}
