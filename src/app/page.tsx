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
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-8">
        <Brand />
        <span className="text-xs text-muted">Personal practice</span>
      </header>

      <main className="mx-auto grid w-full max-w-5xl flex-1 content-center gap-8 px-5 py-12 sm:px-8 sm:py-20 md:grid-cols-2 md:items-center md:gap-16">
        <div>
          <p className="text-sm font-medium text-accent">SSC practice</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
            Who are you?
          </h1>
          <p className="mt-4 max-w-xs text-base leading-7 text-muted">
            Choose your name to open your mocks and past attempts.
          </p>
        </div>
        <div>
          <div className="space-y-3">
            {USERS.map((user) => (
              <Link
                key={user}
                href={`/u/${user}`}
                onClick={() => rememberUser(user)}
                aria-label={`Continue as ${user}`}
                className="group flex min-h-28 items-center justify-between gap-6 rounded-xl border border-line px-4 py-6 transition-colors hover:border-accent hover:bg-accent-soft sm:px-5"
              >
                <span className="text-3xl font-semibold tracking-tight">
                  {user}
                </span>
                <span className="flex items-center gap-5 text-sm text-muted group-hover:text-accent">
                  Continue <span aria-hidden="true">→</span>
                </span>
              </Link>
            ))}
          </div>

          <p className="mt-4 px-4 text-xs leading-6 text-muted sm:px-5">
            Remembered on this device. Switch any time.
          </p>
        </div>
      </main>

      <footer className="mx-auto w-full max-w-5xl px-5 py-5 text-xs text-muted sm:px-8">
        Mock tests · Answer reviews · Practice history
      </footer>
    </div>
  );
}
