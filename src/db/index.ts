import "server-only";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";
import * as relations from "./relations";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required. Configure it in the server environment.");

let databaseUrl: URL;
try {
  databaseUrl = new URL(connectionString);
  if (!["postgres:", "postgresql:"].includes(databaseUrl.protocol)) throw new Error();
} catch {
  // URL parsing errors may contain the input; never expose the connection string.
  throw new Error("DATABASE_URL must be a valid PostgreSQL connection URL.");
}
// Preserve verified TLS explicitly instead of relying on pg's changing aliases.
if (!databaseUrl.searchParams.has("uselibpqcompat") && ["prefer", "require", "verify-ca"].includes(databaseUrl.searchParams.get("sslmode") ?? "")) {
  databaseUrl.searchParams.set("sslmode", "verify-full");
}
const pool = new Pool({
  connectionString: databaseUrl.toString(),
  ssl: { rejectUnauthorized: true },
});

export const db = drizzle(pool, { schema: { ...schema, ...relations } });
