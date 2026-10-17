"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { Brand } from "@/components/brand";
import { forgetUser, rememberUser, type User } from "@/lib/users";

export function DashboardHeader({ user }: { user: User }) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    rememberUser(user);
  }, [user]);

  function switchUser() {
    forgetUser();
    router.replace("/");
  }

  const links = [
    { href: `/u/${user}`, label: "Mocks" },
    { href: `/u/${user}/history`, label: "History" },
    ...(user === "JK" ? [{ href: "/u/JK/bank", label: "Question bank" }] : []),
  ];

  return (
    <header className="border-b border-line bg-white">
      <div className="mx-auto max-w-5xl px-4 sm:px-8">
        <div className="flex min-h-18 flex-wrap items-center justify-between gap-x-2 gap-y-1 py-2 sm:py-3">
          <Brand user={user} />
          <div className="flex items-center gap-2 sm:gap-4">
            <Link
              href="/studio"
              aria-label="Open Studio"
              title="Studio"
              className="flex size-11 items-center justify-center rounded-xl border border-line bg-white text-2xl text-accent transition-colors hover:border-accent/40 hover:bg-accent-soft"
            >
              <span aria-hidden="true">+</span>
            </Link>
            <div className="flex items-center gap-2 sm:gap-3">
              <span className="rounded-full border border-accent/20 bg-white px-2.5 py-1 text-xs font-semibold text-accent" aria-label={`Current user: ${user}`}>
                {user}
              </span>
              <button type="button" onClick={switchUser} className="min-h-11 rounded-md px-1 text-xs font-medium text-muted transition-colors hover:text-foreground">
                Switch user
              </button>
            </div>
          </div>
        </div>
        <nav className="-mb-px flex gap-5 overflow-x-auto sm:gap-7" aria-label="Dashboard">
          {links.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              aria-current={pathname === href || (label === "Question bank" && pathname.startsWith(`${href}/`)) ? "page" : undefined}
              className={`min-h-11 shrink-0 border-b-2 px-1 py-3 text-sm font-medium whitespace-nowrap transition-colors ${pathname === href || (label === "Question bank" && pathname.startsWith(`${href}/`)) ? "border-accent text-accent" : "border-transparent text-muted hover:text-foreground"}`}
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
