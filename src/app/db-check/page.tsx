import { notFound } from "next/navigation";
import { tests } from "@/db/schema";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function DbCheckPage() {
  if (process.env.NODE_ENV === "production") notFound();
  const { db } = await import("@/db");
  const result = await db.select({ count: sql<number>`count(*)` }).from(tests);
  const count = result[0]?.count ?? 0;

  return (
    <main style={{ padding: "2rem", fontFamily: "monospace" }}>
      <h1>DB Connection Check</h1>
      <p>
        Tests table row count: <strong>{String(count)}</strong>
      </p>
      <p style={{ color: "green" }}>✓ Connected to Neon successfully</p>
    </main>
  );
}
