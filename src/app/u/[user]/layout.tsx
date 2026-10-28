import { notFound } from "next/navigation";
import { Suspense } from "react";
import { DashboardHeader } from "@/components/dashboard-header";
import { JKLevelBadge } from "@/components/jk-level-badge";
import { isUser } from "@/lib/users";
import styles from "@/components/dashboard-header.module.css";

export default async function UserLayout({ children, params }: LayoutProps<"/u/[user]">) {
  const { user } = await params;
  if (!isUser(user)) notFound();

  return (
    <>
      <DashboardHeader user={user} jkLevelBadge={user === "JK" ? (
        <Suspense fallback={<span className={styles.level} aria-hidden="true" />}>
          <JKLevelBadge />
        </Suspense>
      ) : undefined} />
      <main className="mx-auto w-full min-w-0 max-w-5xl flex-1 px-4 pt-7 pb-12 sm:px-8 sm:pt-10 sm:pb-16">
        {children}
      </main>
    </>
  );
}
