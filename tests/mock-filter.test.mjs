import assert from "node:assert/strict";
import { test } from "node:test";
import { matchesMockFilter, mockCreatedDate } from "../src/lib/mock-filter.ts";

test("creation-date filtering follows the displayed India date across midnight", () => {
  assert.equal(mockCreatedDate("2026-10-08T18:29:59Z"), "2026-10-08");
  assert.equal(mockCreatedDate("2026-10-08T18:30:00Z"), "2026-10-09");
  assert.equal(mockCreatedDate("2026-12-31T20:00:00Z"), "2027-01-01");
});

test("title and date filters combine, with case-insensitive literal title matching", () => {
  const mock = { title: "English 100% Practice", createdDate: "2026-10-09" };
  assert.equal(matchesMockFilter(mock, "", ""), true);
  assert.equal(matchesMockFilter(mock, "  ENGLISH  ", ""), true);
  assert.equal(matchesMockFilter(mock, "%", ""), true);
  assert.equal(matchesMockFilter(mock, "", "2026-10-09"), true);
  assert.equal(matchesMockFilter(mock, "English", "2026-10-09"), true);
  assert.equal(matchesMockFilter(mock, "English", "2026-10-08"), false);
  assert.equal(matchesMockFilter(mock, "maths", "2026-10-09"), false);
});
