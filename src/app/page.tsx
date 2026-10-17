"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Brand } from "@/components/brand";
import { getRememberedUser, rememberUser, USERS } from "@/lib/users";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const user = getRememberedUser();
    if (user) router.replace(`/u/${user}`);
  }, [router]);

  return (
    <div className="flex min-h-svh flex-col">
      <header className="mx-auto w-full max-w-5xl px-5 py-5 sm:px-8 sm:py-6">
        <Brand />
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-5 pt-8 pb-16 sm:px-8 sm:pt-12 sm:pb-28">
        <h1 className="text-[2.5rem] leading-tight font-semibold tracking-tight sm:text-5xl">
          Who are you?
        </h1>
        <div className="mt-8 grid gap-4 sm:mt-10 sm:grid-cols-2 sm:gap-5">
          {USERS.map((user) => (
            <Link
              key={user}
              href={`/u/${user}`}
              onClick={() => rememberUser(user)}
              aria-label={`Continue as ${user}`}
              data-picker-user={user}
              className="identity-card flex min-h-36 items-center gap-6 rounded-2xl border px-6 py-7 sm:min-h-56 sm:flex-col sm:items-stretch sm:justify-between sm:gap-10 sm:p-7"
            >
              <span aria-hidden="true" className="identity-initials shrink-0 text-4xl leading-none sm:text-6xl">
                {user}
              </span>
              <span className="flex flex-1 items-center justify-between gap-4 sm:flex-none">
                <span className="text-sm font-medium sm:text-base">Continue as {user}</span>
                <span aria-hidden="true" className="identity-arrow flex size-9 shrink-0 items-center justify-center rounded-full border text-xl">→</span>
              </span>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
