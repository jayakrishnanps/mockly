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
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-5 py-5 sm:px-8 sm:py-6">
        <Brand />
        <span className="text-xs font-medium text-muted">Personal practice</span>
      </header>

      <main className="mx-auto grid w-full max-w-5xl flex-1 content-center gap-9 px-5 py-10 sm:px-8 sm:py-16 md:grid-cols-[1fr_1.05fr] md:items-center md:gap-16">
        <div>
          <p className="text-sm font-medium text-accent">Your practice space</p>
          <h1 className="mt-3 text-[2.5rem] leading-tight font-semibold tracking-tight sm:text-5xl">
            Who are you?
          </h1>
          <p className="mt-4 max-w-sm text-base leading-7 text-muted">
            Choose your name to open your mocks and past attempts.
          </p>
        </div>
        <div>
          <div className="space-y-3.5">
            {USERS.map((user) => (
              <Link
                key={user}
                href={`/u/${user}`}
                onClick={() => rememberUser(user)}
                aria-label={`Continue as ${user}`}
                className="group flex min-h-28 items-center justify-between gap-4 rounded-2xl border border-line bg-white px-5 py-5 shadow-[0_2px_6px_rgb(32_43_37/0.03)] transition-colors hover:border-accent hover:bg-accent-soft sm:min-h-32 sm:px-6"
              >
                <span className="flex min-w-0 items-center gap-4">
                  <span className="flex size-14 shrink-0 items-center justify-center rounded-xl border border-line bg-background text-xl font-semibold tracking-tight sm:size-16 sm:text-2xl">{user}</span>
                  <span className="text-sm font-medium sm:text-base">Continue as {user}</span>
                </span>
                <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-full border border-line text-lg text-muted group-hover:border-accent/30 group-hover:text-accent">→</span>
              </Link>
            ))}
          </div>

          <p className="mt-4 px-1 text-xs leading-6 text-muted">
            Your choice stays on this device. You can switch any time.
          </p>
        </div>
      </main>

      <footer className="mx-auto w-full max-w-5xl px-5 py-5 text-xs text-muted sm:px-8 sm:py-6">
        Mocks, answer reviews and practice history.
      </footer>
    </div>
  );
}
