import { connection } from "next/server";
import { getRememberedUserFromCookies } from "@/lib/server-user";
import { getJKLevel } from "@/server/jk-progress";
import styles from "./dashboard-header.module.css";

export async function JKLevelBadge() {
  await connection();
  if (await getRememberedUserFromCookies() !== "JK") return null;
  const level = await getJKLevel();
  return <span className={styles.level}><span className="sr-only">, level </span>{level}</span>;
}
