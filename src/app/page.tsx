"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Brand } from "@/components/brand";
import { getRememberedUser, navigateAsUser, USERS } from "@/lib/users";
import styles from "./page.module.css";

export default function Home() {
  useEffect(() => {
    const user = getRememberedUser();
    if (user) navigateAsUser(user);
  }, []);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Brand />
      </header>

      <main className={styles.main}>
        <h1 data-static-label className={styles.heading}>
          Who are you?
        </h1>
        <div className={styles.choices}>
          {USERS.map((user) => (
            <Link
              key={user}
              href={`/u/${user}`}
              prefetch={false}
              onClick={(event) => { event.preventDefault(); navigateAsUser(user); }}
              aria-label={`Continue as ${user}`}
              data-picker-user={user}
              className={`${styles.card} ${user === "JK" ? styles.jk : styles.he}`}
            >
              <span aria-hidden="true" className={styles.initials}>
                {user}
              </span>
              <span className={styles.footer}>
                <span>Continue as {user}</span>
                <span aria-hidden="true" className={styles.arrow}>↗</span>
              </span>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
