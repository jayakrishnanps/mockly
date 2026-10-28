"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { Brand } from "@/components/brand";
import { forgetUser, rememberUser, type User } from "@/lib/users";
import styles from "./dashboard-header.module.css";

export function DashboardHeader({ user, jkLevel = 1 }: { user: User; jkLevel?: number }) {
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
    ...(user === "JK"
      ? [{ href: "/u/JK/bank", label: "Bank" }, { href: "/u/JK/weak-areas", label: "Weak" }]
      : [{ href: "/u/HE/forest", label: "Forest" }, { href: "/u/HE/weak-areas", label: "Weak" }]),
  ];

  return (
    <header data-dashboard-header className="border-b border-line bg-white">
      <div className="mx-auto max-w-5xl px-4 sm:px-8">
        <div className={user === "JK" ? "flex min-h-20 flex-wrap items-center justify-between gap-x-2 gap-y-3 py-4 sm:py-5" : "flex min-h-18 flex-wrap items-center justify-between gap-x-2 gap-y-1 py-2 sm:py-3"}>
          <Brand user={user} />
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="flex items-center gap-2 sm:gap-3">
              {user === "JK" ? <Link href="/u/JK/progress" className={styles.profileLink} aria-label={`JK progress, level ${jkLevel}`} aria-current={pathname === "/u/JK/progress" ? "page" : undefined}>
                <span>JK</span><span className={styles.level} aria-hidden="true">{jkLevel}</span>
              </Link> : <span className="identity-initials border-r border-accent/20 pr-3 text-lg leading-none text-accent sm:pr-4" aria-label="Current user: HE">HE</span>}
              <button type="button" onClick={switchUser} className="min-h-11 rounded-md px-1 text-xs font-medium text-muted transition-colors hover:text-foreground">
                Switch user
              </button>
            </div>
          </div>
        </div>
        <nav className={user === "JK" ? "flex gap-1 overflow-x-auto pb-3 sm:gap-2" : "-mb-px flex gap-5 overflow-x-auto sm:gap-7"} aria-label="Dashboard">
          {links.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              aria-current={pathname === href || (href === "/u/JK/bank" && pathname.startsWith(`${href}/`)) ? "page" : undefined}
              className={user === "JK"
                ? `min-h-11 shrink-0 rounded-md border px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors ${pathname === href || (href === "/u/JK/bank" && pathname.startsWith(`${href}/`)) ? "border-black bg-black text-white" : "border-transparent bg-white text-black hover:border-black"}`
                : `min-h-11 shrink-0 border-b-2 px-1 py-3 text-sm font-medium whitespace-nowrap transition-colors ${pathname === href || (href === "/u/JK/bank" && pathname.startsWith(`${href}/`)) ? "border-accent text-accent" : "border-transparent text-muted hover:text-foreground"}`}
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
