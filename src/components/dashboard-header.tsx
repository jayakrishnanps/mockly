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
  ];

  return (
    <header className="border-b border-line bg-white">
      <div className="mx-auto max-w-5xl px-4 sm:px-8">
        <div className="flex min-h-18 flex-wrap items-center justify-between gap-x-2 gap-y-1 py-2">
          <Brand />
          <div className="flex items-center gap-1 sm:gap-4">
            <Link
              href="/studio"
              aria-label="Open Studio"
              title="Studio"
              className="flex size-11 items-center justify-center rounded-md text-2xl text-accent transition-colors hover:bg-accent-soft"
            >
              <span aria-hidden="true">+</span>
            </Link>
            <div className="flex items-center gap-2 border-l border-line pl-3">
              <span className="text-xs font-semibold text-accent" aria-label={`Current user: ${user}`}>
                {user}
              </span>
              <button type="button" onClick={switchUser} className="min-h-11 rounded-sm text-xs text-muted hover:text-foreground">
                Switch user
              </button>
            </div>
          </div>
        </div>
        <nav className="-mb-px flex gap-6" aria-label="Dashboard">
          {links.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              aria-current={pathname === href ? "page" : undefined}
              className={`min-h-11 border-b-2 px-1 py-3 text-sm font-medium transition-colors ${pathname === href ? "border-accent text-accent" : "border-transparent text-muted hover:text-foreground"}`}
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
