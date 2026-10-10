import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { config } from "dotenv";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { inArray } from "drizzle-orm";
import * as schema from "../src/db/schema.ts";
import { createBankStore } from "../src/server/bank-store.ts";

test("bank search receives metadata for every saved bank beyond the first page", { skip: process.env.MOCKLY_INTEGRATION_TESTS !== "1" }, async (t) => {
  config({ path: ".env.local", quiet: true });
  assert.ok(process.env.DATABASE_URL);
  const url = new URL(process.env.DATABASE_URL);
  url.searchParams.set("sslmode", "verify-full");
  const pool = new Pool({ connectionString: url.toString(), ssl: { rejectUnauthorized: true } });
  const database = drizzle(pool);
  const store = createBankStore(database);
  const banks = Array.from({ length: 26 }, (_, index) => ({
    id: randomUUID(), title: `[Bank list verification] ${randomUUID()} ${index}`,
  }));
  const bankIds = banks.map((bank) => bank.id);
  t.after(async () => {
    try {
      await database.delete(schema.questionBanks).where(inArray(schema.questionBanks.id, bankIds));
    } finally { await pool.end(); }
  });

  await database.insert(schema.questionBanks).values(banks);
  await database.insert(schema.bankQuestions).values({
    id: randomUUID(), bankId: banks[0].id, position: 1,
    questionText: "Question bodies must stay out of bank search metadata.",
    options: ["A", "B", "C", "D"], correctIndex: 0,
  });

  const listed = await store.list();
  const saved = new Map(listed.map((bank) => [bank.id, bank]));
  for (const [index, bank] of banks.entries()) {
    const item = saved.get(bank.id);
    assert.ok(item, "Every saved bank must be available to the search, including banks beyond page one.");
    assert.equal(item.title, bank.title);
    assert.equal(item.questionCount, index === 0 ? 1 : 0);
    assert.ok(Number.isFinite(Date.parse(item.createdAt)));
    assert.deepEqual(Object.keys(item).sort(), ["createdAt", "id", "questionCount", "title"]);
  }
});
