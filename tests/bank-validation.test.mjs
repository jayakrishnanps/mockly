import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { validateBankTitle, validateBankAppend, validateBankMock } from "../src/lib/bank-validation.ts";
import { defaultMetadata } from "../src/lib/mock-validation.ts";

const question = () => ({ id: randomUUID(), questionText: "Simplify $\\frac{3}{4}$", options: ["1", "2", "3", "4"], correctIndex: 2 });
const mock = () => ({
  bankId: randomUUID(), testId: randomUUID(), questionLimit: "30",
  metadata: { ...defaultMetadata(), title: "Practice", forUsers: ["HE"] },
});

test("bank creation trims titles and normalizes retry IDs", () => {
  const id = randomUUID();
  assert.deepEqual(validateBankTitle({ id: id.toUpperCase(), title: "  Arithmetic  ", owner: "HE" }), { value: { id, title: "Arithmetic" } });
  for (const input of [null, {}, { id: "invalid", title: "Arithmetic" }, { id, title: " " }, { id, title: "a".repeat(201) }]) {
    assert.equal(validateBankTitle(input).value, null);
  }
});

test("bank imports reuse question validation without a total question cap", () => {
  const bankId = randomUUID();
  const questions = Array.from({ length: 501 }, question);
  const checked = validateBankAppend({ bankId: bankId.toUpperCase(), questions });
  assert.deepEqual(checked.value, { bankId, questions });
  for (const invalid of [[], [null], [{ ...question(), options: ["1"] }], [{ ...question(), correctIndex: 4 }]]) {
    assert.equal(validateBankAppend({ bankId, questions: invalid }).value, null);
  }
  assert.equal(validateBankAppend({ bankId, questions: [questions[0], questions[0]] }).value, null);
});

test("bank mocks validate metadata, assignment, question limits and storage score bounds", () => {
  const input = mock();
  const checked = validateBankMock(input);
  assert.equal(checked.value.questionLimit, 30);
  assert.deepEqual(checked.value.metadata.forUsers, ["HE"]);
  assert.equal(validateBankMock({ ...input, questionLimit: 45 }).value.questionLimit, 45);
  for (const limit of [0, -1, 1.5, NaN, Infinity, null, undefined, "", " ", "1e2", "2.5", "2147483648", [], true, 5000]) {
    assert.equal(validateBankMock({ ...input, questionLimit: limit }).value, null, `Invalid limit: ${String(limit)}`);
  }
  const invalidMetadata = validateBankMock({ ...input, metadata: { ...input.metadata, forUsers: [] } });
  assert.equal(invalidMetadata.value, null);
  assert.ok(invalidMetadata.fields.forUsers);
  assert.equal(validateBankMock({ ...input, bankId: "invalid" }).value, null);
  assert.equal(validateBankMock({ ...input, testId: "invalid" }).value, null);
});
