import assert from "node:assert/strict";
import { test } from "node:test";
import { emptyHEWeakReportDraft, loadHEWeakReportDraft, saveHEWeakReportDraft, HE_WEAK_REPORT_DRAFT_KEY } from "../src/lib/he-weak-report-draft.ts";

function memoryStorage(initial = null) {
  let value = initial;
  let writes = 0;
  return {
    storage: { getItem: (key) => { assert.equal(key, HE_WEAK_REPORT_DRAFT_KEY); return value; }, setItem: (key, next) => { assert.equal(key, HE_WEAK_REPORT_DRAFT_KEY); writes++; value = next; } },
    value: () => value, writes: () => writes,
  };
}

test("HE drafts keep Malayalam source and retry identity separate from JK reports", () => {
  const memory = memoryStorage();
  const draft = { version: 1, source: "# Mockly HE Weak v1\n## മലയാളം ക്\u200dഷ ന്\u200c", id: "e733404d-4ea2-4c01-8064-27fe023576c4" };
  assert.notEqual(HE_WEAK_REPORT_DRAFT_KEY, "mockly:weak-area-report-draft:v1:JK");
  assert.equal(saveHEWeakReportDraft(draft, () => memory.storage), null);
  assert.deepEqual(loadHEWeakReportDraft(() => memory.storage), { draft, warning: null });
  assert.equal(saveHEWeakReportDraft(emptyHEWeakReportDraft(), () => memory.storage), null);
  assert.deepEqual(loadHEWeakReportDraft(() => memory.storage).draft, emptyHEWeakReportDraft());
});

test("missing, corrupt and unsupported HE drafts never overwrite existing storage", () => {
  for (const raw of [null, "broken", "{}", JSON.stringify({ version: 2, source: "draft", id: null }),
    JSON.stringify({ version: 1, source: "draft", id: "invalid" }), JSON.stringify({ version: 1, source: " ", id: "e733404d-4ea2-4c01-8064-27fe023576c4" })]) {
    const memory = memoryStorage(raw);
    const result = loadHEWeakReportDraft(() => memory.storage);
    assert.deepEqual(result.draft, emptyHEWeakReportDraft());
    assert.equal(memory.value(), raw);
    assert.equal(memory.writes(), 0);
    assert.equal(result.warning !== null, raw !== null);
  }
});

test("HE storage denial and quota errors preserve the in-memory draft", () => {
  const unavailable = () => { throw new Error("denied"); };
  assert.ok(loadHEWeakReportDraft(unavailable).warning);
  assert.ok(saveHEWeakReportDraft(emptyHEWeakReportDraft(), unavailable));
  const full = () => ({ getItem: () => null, setItem: () => { throw new Error("quota"); } });
  assert.ok(saveHEWeakReportDraft(emptyHEWeakReportDraft(), full));
  const memory = memoryStorage();
  assert.ok(saveHEWeakReportDraft({ version: 1, source: "x".repeat(20001), id: null }, () => memory.storage));
  assert.equal(memory.writes(), 0);
});
