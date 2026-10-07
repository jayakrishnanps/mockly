import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { defaultMetadata, validateMetadata, validateSaveInput, isUuid } from "../src/lib/mock-validation.ts";

const metadata = () => ({ ...defaultMetadata(), title: "  SSC practice  ", forUsers: ["JK"] });
const question = () => ({ id: randomUUID(), questionText: "**Simplify** $\\frac{3}{4}$", options: ["1", "2", "3", "4"], correctIndex: 2 });

test("metadata defaults, empty details and the positive deduction map to the schema", () => {
  assert.deepEqual(validateMetadata(metadata()), { errors: {}, value: {
    title: "SSC practice", details: null, forUsers: ["JK"], durationMinutes: 60, marksCorrect: "2.00", marksWrong: "0.50",
  } });
});

test("shared assignment is canonical and custom marking supports zero deduction", () => {
  const { value } = validateMetadata({ ...metadata(), details: " Practice set ", forUsers: ["HE", "JK"], durationMinutes: "45", marksCorrect: "3.25", marksWrong: "0" });
  assert.deepEqual(value, { title: "SSC practice", details: "Practice set", forUsers: ["JK", "HE"], durationMinutes: 45, marksCorrect: "3.25", marksWrong: "0.00" });
});

for (const [field, values] of Object.entries({
  title: [" ", null, "x".repeat(201)],
  details: [null, "x".repeat(10001)],
  forUsers: [[], ["other"], ["JK", "JK"], "JK"],
  durationMinutes: ["0", "-1", "1.5", "Infinity", "2147483648", 60, ""],
  marksCorrect: ["0", "-2", "1000", "2.001", "NaN", 2, ""],
  marksWrong: ["-0.5", "1000", "0.001", "Infinity", null, ""],
})) test(`${field} rejects invalid server-submitted values locally`, () => {
  for (const value of values) {
    const result = validateMetadata({ ...metadata(), [field]: value });
    assert.equal(result.value, null);
    assert.ok(result.errors[field]);
  }
});

test("server validation permits only explicit, valid question fields", () => {
  const q = question();
  const id = randomUUID();
  const result = validateSaveInput({ mode: "create", testId: id.toUpperCase(), metadata: metadata(), questions: [{ ...q, raw: "do not save", errors: ["do not save"], position: 99, testId: "untrusted" }] });
  assert.equal(result.value.testId, id);
  assert.deepEqual(result.value.questions, [q]);
});

test("server validation rejects tampered and incomplete question data", () => {
  const q = question();
  for (const questions of [[], [q, q], [null], [{ ...q, id: "bad" }], [{ ...q, questionText: " " }], [{ ...q, options: ["1", "2", "3"] }], [{ ...q, options: ["1", " ", "3", "4"] }], [{ ...q, correctIndex: -1 }], [{ ...q, correctIndex: 4 }], [{ ...q, correctIndex: 0.5 }]]) {
    assert.equal(validateSaveInput({ mode: "append", testId: randomUUID(), questions }).value, null);
  }
});

test("append skips metadata; invalid route/request identities are rejected", () => {
  assert.ok(validateSaveInput({ mode: "append", testId: randomUUID(), questions: [question()] }).value);
  for (const input of [null, {}, { mode: "delete" }, { mode: "append", testId: "abc" }]) assert.equal(validateSaveInput(input).value, null);
  assert.equal(isUuid("../../../etc"), false);
});
