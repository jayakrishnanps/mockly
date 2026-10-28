import assert from "node:assert/strict";
import { test } from "node:test";
import { summarizeWeakAreaReports, weakAreaKey } from "../src/lib/weak-area-report-summary.ts";

const area = { subject: "Math", area: "Subtracting decimals", focus: "Both", priority: "High" };
const report = (id, sourceTestId, importedAt, areas = [area]) => ({ id, sourceTestId, importedAt, areas, sourceTitle: sourceTestId });

test("empty latest reports suppress earlier areas and do not count as active mocks", () => {
  const older = report("a", "mock-a", "2026-10-27T10:00:00Z");
  const cleared = report("b", "mock-a", "2026-10-28T10:00:00Z", []);
  const anotherCleared = report("c", "mock-b", "2026-10-28T11:00:00Z", []);
  const summary = summarizeWeakAreaReports([older, cleared, anotherCleared], new Set());

  assert.equal(summary.activeMockCount, 0);
  assert.equal(summary.latestByMock.size, 2);
  assert.equal(summary.latestByMock.get("mock-a"), cleared);
  assert.deepEqual(summary.latestByMock.get("mock-a").areas, []);
  assert.equal(summary.reportCounts.get("mock-a"), 2);
  assert.ok(summary.orderedReports.includes(older));
});

test("active count includes each mock once and ignores historical areas", () => {
  const reports = [
    report("a", "mock-a", "2026-10-27T10:00:00Z"),
    report("b", "mock-a", "2026-10-28T10:00:00Z", [area, { ...area, area: "Adding decimals" }]),
    report("c", "mock-b", "2026-10-28T11:00:00Z"),
    report("d", "mock-c", "2026-10-28T12:00:00Z", []),
  ];
  const summary = summarizeWeakAreaReports(reports, new Set());

  assert.equal(summary.activeMockCount, 2);
  assert.equal(summary.reportCounts.get("mock-a"), 2);
});

test("checking off the last area immediately removes its mock from the active count", () => {
  const saved = report("a", "mock-a", "2026-10-28T10:00:00Z");
  const completed = new Set([weakAreaKey(saved.id, area)]);
  const summary = summarizeWeakAreaReports([saved], completed);

  assert.equal(summary.activeMockCount, 0);
  assert.equal(summary.latestByMock.get("mock-a"), saved);
  assert.deepEqual(saved.areas, [area]);
});

test("completing an earlier assessment does not hide the latest assessment's area", () => {
  const earlier = report("a", "mock-a", "2026-10-27T10:00:00Z");
  const latest = report("b", "mock-a", "2026-10-28T10:00:00Z");
  const summary = summarizeWeakAreaReports([earlier, latest], new Set([weakAreaKey(earlier.id, area)]));

  assert.equal(summary.activeMockCount, 1);
  assert.equal(summary.latestByMock.get("mock-a"), latest);
});

test("report sorting is deterministic without mutating the provided report order", () => {
  const first = report("a", "mock-a", "2026-10-28T10:00:00Z");
  const second = report("b", "mock-a", "2026-10-28T10:00:00Z", []);
  const reports = [first, second];
  const summary = summarizeWeakAreaReports(reports, new Set());

  assert.equal(summary.latestByMock.get("mock-a"), second);
  assert.equal(summary.activeMockCount, 0);
  assert.deepEqual(reports, [first, second]);
  assert.equal(summarizeWeakAreaReports([], new Set()).activeMockCount, 0);
});
