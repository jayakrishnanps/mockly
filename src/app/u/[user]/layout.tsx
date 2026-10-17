import { notFound } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard-header";
import { isUser } from "@/lib/users";

export default async function UserLayout({ children, params }: LayoutProps<"/u/[user]">) {
  const { user } = await params;
  if (!isUser(user)) notFound();

  return (
    <>
      <DashboardHeader user={user} />
      <main className="mx-auto w-full min-w-0 max-w-5xl flex-1 px-4 pt-7 pb-12 sm:px-8 sm:pt-10 sm:pb-16">
        {children}
      </main>
    </>
  );
}
