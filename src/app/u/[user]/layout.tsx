import { notFound } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard-header";
import { isUser } from "@/lib/users";

export default async function UserLayout({ children, params }: LayoutProps<"/u/[user]">) {
  const { user } = await params;
  if (!isUser(user)) notFound();

  return (
    <>
      <DashboardHeader user={user} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-10 sm:px-8 sm:py-14">
        {children}
      </main>
    </>
  );
}
