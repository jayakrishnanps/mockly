import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";

export async function createLocalDatabase() {
  const client = new PGlite();
  try {
    const baseline = await readFile(new URL("../../src/db/migrations/0000_damp_vindicator.sql", import.meta.url), "utf8");
    const start = baseline.indexOf('CREATE TABLE "tests"');
    const end = baseline.indexOf('CREATE INDEX "attempts_person_idx"');
    assert.ok(start >= 0 && end > start);
    await client.exec(baseline.slice(start, end));
    for (const migration of ["0001_preserve_mock_history.sql", "0002_question_banks.sql", "0003_link_bank_mocks.sql", "0004_forest_plants.sql", "0005_weak_area_reports.sql", "0006_weak_report_lifecycle.sql"]) {
      await client.exec(await readFile(new URL(`../../src/db/migrations/${migration}`, import.meta.url), "utf8"));
    }
    return { database: drizzle(client), close: () => client.close() };
  } catch (error) {
    await client.close();
    throw error;
  }
}
