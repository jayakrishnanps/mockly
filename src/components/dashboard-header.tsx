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
      <div className="mx-auto max-w-5xl px-5 sm:px-8">
        <div className="flex min-h-20 flex-wrap items-center justify-between gap-3 py-4">
          <Brand />
          <div className="flex items-center gap-2 sm:gap-4">
            <Link
              href="/studio"
              aria-label="Open Studio"
              title="Studio"
              className="flex size-11 items-center justify-center rounded-xl border border-line text-xl text-accent transition-colors hover:border-accent hover:bg-accent-soft"
            >
              <span aria-hidden="true">+</span>
            </Link>
            <div className="flex items-center gap-2 rounded-full border border-line py-1 pl-1 pr-3">
              <span className="flex size-8 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent" aria-label={`Current user: ${user}`}>
                {user}
              </span>
              <button type="button" onClick={switchUser} className="min-h-9 rounded-sm text-xs font-medium text-muted hover:text-foreground">
                Switch user
              </button>
            </div>
          </div>
        </div>
        <nav className="flex gap-2 pb-3" aria-label="Dashboard">
          {links.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              aria-current={pathname === href ? "page" : undefined}
              className={`min-h-11 rounded-lg px-5 py-3 text-sm font-medium transition-colors ${pathname === href ? "bg-accent-soft text-accent" : "text-muted hover:bg-background hover:text-foreground"}`}
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
