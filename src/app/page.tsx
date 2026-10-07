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
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-7 sm:px-10">
        <Brand />
        <span className="rounded-full border border-line bg-white px-3 py-1.5 text-[11px] font-medium text-muted">Personal practice</span>
      </header>

      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-6 py-16 sm:py-24">
        <p className="eyebrow">SSC MOCK TESTS</p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">
          Who are you?
        </h1>
        <p className="mt-4 text-base leading-7 text-muted">
          Choose your practice space. Pick up where you left off.
        </p>

        <div className="mt-10 grid grid-cols-2 gap-4 sm:gap-5">
          {USERS.map((user, index) => (
            <Link
              key={user}
              href={`/u/${user}`}
              onClick={() => rememberUser(user)}
              aria-label={`Continue as ${user}`}
              className="surface interactive-card group rounded-2xl border border-line bg-white p-5 hover:border-accent sm:p-8"
            >
              <span
                className={`flex size-12 items-center justify-center rounded-xl text-sm font-semibold ${index === 0 ? "bg-accent-soft text-accent" : "bg-[#f1eadf] text-[#776044]"}`}
                aria-hidden="true"
              >
                {user}
              </span>
              <span className="mt-8 block text-3xl font-semibold tracking-tight">
                {user}
              </span>
              <span className="mt-3 flex items-center justify-between text-sm text-muted group-hover:text-accent">
                Continue <span aria-hidden="true" className="flex size-8 items-center justify-center rounded-full bg-background group-hover:bg-accent-soft">↗</span>
              </span>
            </Link>
          ))}
        </div>

        <p className="mt-7 text-center text-xs leading-6 text-muted">
          Remembered on this device. Switch any time.
        </p>
      </main>

      <footer className="px-6 py-7 text-center text-xs tracking-wide text-muted">
        Practise. Review. Improve.
      </footer>
    </div>
  );
}
