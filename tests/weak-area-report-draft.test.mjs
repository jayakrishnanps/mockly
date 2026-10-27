import assert from "node:assert/strict";
import { test } from "node:test";
import { emptyWeakAreaReportDraft, loadWeakAreaReportDraft, saveWeakAreaReportDraft, WEAK_AREA_REPORT_DRAFT_KEY } from "../src/lib/weak-area-report-draft.ts";

function memoryStorage(initial = null) {
  let value = initial;
  let writes = 0;
  return {
    storage: { getItem: () => value, setItem: (key, next) => { assert.equal(key, WEAK_AREA_REPORT_DRAFT_KEY); writes++; value = next; } },
    value: () => value,
    writes: () => writes,
  };
}

test("weak-area drafts preserve report text and retry IDs through refresh", () => {
  const memory = memoryStorage();
  const draft = { version: 1, source: "# Mockly Weak Areas v1\nMock: example", id: "e733404d-4ea2-4c01-8064-27fe023576c4" };
  assert.equal(saveWeakAreaReportDraft(draft, () => memory.storage), null);
  assert.deepEqual(loadWeakAreaReportDraft(() => memory.storage), { draft, warning: null });
  saveWeakAreaReportDraft(emptyWeakAreaReportDraft(), () => memory.storage);
  assert.deepEqual(loadWeakAreaReportDraft(() => memory.storage).draft, emptyWeakAreaReportDraft());
});

test("loading missing or corrupted weak-area drafts never writes over storage", () => {
  for (const raw of [null, "broken", "{}", JSON.stringify({ version: 1, source: "draft", id: "invalid" })]) {
    const memory = memoryStorage(raw);
    const result = loadWeakAreaReportDraft(() => memory.storage);
    assert.deepEqual(result.draft, emptyWeakAreaReportDraft());
    assert.equal(memory.value(), raw);
    assert.equal(memory.writes(), 0);
    assert.equal(result.warning !== null, raw !== null);
  }
});

test("weak-area draft reads and quota failures are reported without throwing", () => {
  const unavailable = () => { throw new Error("denied"); };
  assert.ok(loadWeakAreaReportDraft(unavailable).warning);
  assert.ok(saveWeakAreaReportDraft(emptyWeakAreaReportDraft(), unavailable));
  const full = () => ({ getItem: () => null, setItem: () => { throw new Error("quota"); } });
  assert.ok(saveWeakAreaReportDraft(emptyWeakAreaReportDraft(), full));
});

test("a retry ID without report text cannot freeze an empty draft", () => {
  for (const source of ["", "   \n"]) {
    const raw = JSON.stringify({ version: 1, source, id: "e733404d-4ea2-4c01-8064-27fe023576c4" });
    const memory = memoryStorage(raw);
    const restored = loadWeakAreaReportDraft(() => memory.storage);
    assert.deepEqual(restored.draft, emptyWeakAreaReportDraft());
    assert.ok(restored.warning);
    assert.equal(memory.value(), raw);
    assert.equal(memory.writes(), 0);
  }
});
