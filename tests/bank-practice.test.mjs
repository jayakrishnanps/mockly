import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { parseBankPractice } from "../src/server/bank-practice.ts";

test("bank practice keeps unresolved wrongs ahead of skips until two later correct encounters", () => {
  const wrongId = randomUUID();
  const skippedId = randomUUID();
  const masteredId = randomUUID();
  const practice = parseBankPractice([
    { question_id: wrongId, practice_count: "5", last_practised_at: "2026-10-17 10:00:00+00", latest_outcome: "correct", unresolved_wrong: true },
    { question_id: skippedId, practice_count: "3", last_practised_at: "2026-10-17 09:00:00+00", latest_outcome: "skipped", unresolved_wrong: false },
    { question_id: masteredId, practice_count: "8", last_practised_at: "2026-10-17 08:00:00+00", latest_outcome: "correct", unresolved_wrong: false },
  ]);
  assert.deepEqual(practice.get(wrongId.toLowerCase()), {
    count: 5, lastPractisedAt: Date.parse("2026-10-17 10:00:00+00"), review: "wrong",
  });
  assert.equal(practice.get(skippedId.toLowerCase()).review, "skipped");
  assert.equal(practice.get(masteredId.toLowerCase()).review, null);
});

test("bank practice rejects malformed, duplicate and unsafe history rows", () => {
  const id = randomUUID();
  const row = { question_id: id, practice_count: "1", last_practised_at: "2026-10-17 10:00:00+00", latest_outcome: "wrong", unresolved_wrong: true };
  assert.throws(() => parseBankPractice([{ ...row, practice_count: "9007199254740992" }]), /history could not be read/);
  assert.throws(() => parseBankPractice([{ ...row, latest_outcome: "maybe" }]), /history could not be read/);
  assert.throws(() => parseBankPractice([row, row]), /history could not be read/);
});
