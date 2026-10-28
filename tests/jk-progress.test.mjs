import assert from "node:assert/strict";
import { test } from "node:test";
import { buildJKProgress, levelProgress, practiceXp, readJKProgressTotals } from "../src/lib/jk-progress.ts";

const rawTotals = () => ({
  totalXp: 320, completedMocks: 1, activeDays: 1, correctAnswers: 30, wrongAnswers: 0, skippedAnswers: 0,
  totalPracticeSeconds: 240, firstCompletedAt: "2026-10-28T06:00:00Z", today: 1, week: 1, month: 1, year: 1,
});

test("practice XP rewards correct answers, penalises wrong answers and scales completion by coverage", () => {
  assert.equal(practiceXp(30, 0, 0), 320);
  assert.equal(practiceXp(20, 10, 0), 120);
  assert.equal(practiceXp(15, 5, 20), 110);
  assert.equal(practiceXp(0, 30, 0), -280);
  assert.equal(practiceXp(0, 1, 29), -10);
  assert.equal(practiceXp(0, 0, 30), 0);
  assert.equal(practiceXp(0, 0, 0), 0);
  assert.equal(practiceXp(1, 0, 2), 16);
  for (const invalid of [-1, 0.5, NaN, Infinity, "3", null, undefined]) {
    assert.throws(() => practiceXp(invalid, 0, 0), /Invalid practice counts/);
    assert.throws(() => practiceXp(0, invalid, 0), /Invalid practice counts/);
    assert.throws(() => practiceXp(0, 0, invalid), /Invalid practice counts/);
  }
  assert.throws(() => practiceXp(Number.MAX_SAFE_INTEGER, 0, 0), /supported range/);
  assert.throws(() => practiceXp(0, Number.MAX_SAFE_INTEGER, 0), /supported range/);
});

test("levels have increasing costs, exact boundaries and no level-1000 cap", () => {
  assert.deepEqual(levelProgress(0), { level: 1, xpIntoLevel: 0, xpForNextLevel: 100, progressPercent: 0 });
  assert.deepEqual(levelProgress(99), { level: 1, xpIntoLevel: 99, xpForNextLevel: 100, progressPercent: 99 });
  const checkpoints = new Set([2, 3, 10, 20, 34, 35, 36, 40, 45, 50, 51, 80, 100, 101, 200, 201, 500, 501, 600, 1000, 1001]);
  let threshold = 0;
  let previousCost = 0;
  for (let level = 1; level <= 1001; level++) {
    const earlyCost = 100 + 25 * (level - 1) + Math.floor((level - 1) ** 2 / 4);
    const cost = level <= 34 ? earlyCost : level <= 50 ? earlyCost + 25 * (level - 34)
      : level <= 100 ? 2325 + 40 * (level - 50) : level <= 200 ? 4325 + 2 * (level - 100)
      : level <= 500 ? 4525 + 3 * (level - 200) : 5425 + 4 * (level - 500);
    assert.ok(cost > previousCost);
    if (checkpoints.has(level)) {
      assert.equal(levelProgress(threshold).level, level);
      assert.equal(levelProgress(threshold).xpIntoLevel, 0);
      assert.equal(levelProgress(threshold).xpForNextLevel, cost);
      assert.equal(levelProgress(threshold - 1).level, level - 1);
      const middle = levelProgress(threshold + Math.floor(cost / 2));
      assert.equal(middle.level, level);
      assert.ok(middle.progressPercent >= 49 && middle.progressPercent <= 50);
    }
    threshold += cost;
    previousCost = cost;
  }
  for (const [level, xp, cost] of [
    [35, 20553, 1264], [40, 27550, 1605], [45, 36278, 1959], [50, 46800, 2325],
    [51, 49125, 2365], [100, 212050, 4325], [101, 216375, 4327], [200, 654450, 4525],
    [201, 658975, 4528], [500, 2146500, 5425], [501, 2151925, 5429], [1000, 5358000, 7425],
  ]) assert.deepEqual(levelProgress(xp), { level, xpIntoLevel: 0, xpForNextLevel: cost, progressPercent: 0 });
  const highest = levelProgress(Number.MAX_SAFE_INTEGER);
  assert.ok(highest.level > 1000);
  assert.ok(Number.isSafeInteger(highest.xpIntoLevel));
  assert.ok(Number.isSafeInteger(highest.xpForNextLevel));
  assert.ok(highest.progressPercent >= 0 && highest.progressPercent < 100);
  for (const value of [-1, NaN, Infinity, 0.5, "0", null, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => levelProgress(value), /Invalid total XP/);
  }
});

test("progress totals validate storage values and keep zero-attempt accuracy unassessed", () => {
  const totals = readJKProgressTotals(rawTotals());
  assert.equal(totals.counts.allTime, 1);
  assert.equal(totals.activeDays, 1);
  assert.equal(buildJKProgress(totals, [], new Date("2026-10-28T12:00:00Z")).accuracyPercent, 100);
  for (const invalid of [null, [], {}, { ...rawTotals(), totalXp: "320" }, { ...rawTotals(), completedMocks: -1 },
    { ...rawTotals(), correctAnswers: 1.5 }, { ...rawTotals(), wrongAnswers: NaN },
    { ...rawTotals(), today: Infinity }, { ...rawTotals(), activeDays: -1 }, { ...rawTotals(), activeDays: "1" },
    { ...rawTotals(), firstCompletedAt: "invalid" }]) {
    assert.throws(() => readJKProgressTotals(invalid), /Invalid/);
  }
  const zero = readJKProgressTotals({ totalXp: 0, completedMocks: 0, activeDays: 0, correctAnswers: 0, wrongAnswers: 0, skippedAnswers: 0,
    totalPracticeSeconds: 0, firstCompletedAt: null, today: 0, week: 0, month: 0, year: 0 });
  const empty = buildJKProgress(zero, [], new Date("2026-10-28T12:00:00Z"));
  assert.equal(empty.level, 1);
  assert.equal(empty.answeredQuestions, 0);
  assert.equal(empty.accuracyPercent, null);
  assert.equal(empty.currentStreak, 0);
  assert.equal(empty.longestStreak, 0);
  assert.equal(empty.activeDays, 0);
});

test("activity uses India dates, preserves all-time streaks and limits the visible calendar", () => {
  const totals = readJKProgressTotals(rawTotals());
  const days = ["2025-01-01", "2025-01-02", "2025-01-03", "2025-01-04", "2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29"]
    .map((date) => ({ date, count: 1, xp: 35 })).reverse();
  const beforeMidnight = buildJKProgress(totals, days, new Date("2026-10-28T18:29:59Z"));
  assert.equal(beforeMidnight.activity.length, 371);
  assert.equal(beforeMidnight.activity.at(-1).date, "2026-10-28");
  assert.equal(beforeMidnight.currentStreak, 3);
  assert.equal(beforeMidnight.longestStreak, 4);
  assert.equal(beforeMidnight.activity.find((day) => day.date === "2026-10-25").count, 0);
  assert.equal(beforeMidnight.activity.some((day) => day.date === "2026-10-29"), false);
  assert.equal(days[0].date, "2026-10-29");
  const afterMidnight = buildJKProgress(totals, days, new Date("2026-10-28T18:30:00Z"));
  assert.equal(afterMidnight.activity.at(-1).date, "2026-10-29");
  assert.equal(afterMidnight.currentStreak, 4);
  assert.equal(buildJKProgress(totals, days.slice(2), new Date("2026-10-28T12:00:00Z")).currentStreak, 2);
  assert.equal(buildJKProgress(totals, days.slice(3), new Date("2026-10-28T12:00:00Z")).currentStreak, 0);
  assert.throws(() => buildJKProgress(totals, [], new Date("invalid")), /Invalid/);
});

test("malformed activity cannot enter the calendar or streak calculations", () => {
  const totals = readJKProgressTotals(rawTotals());
  const day = { date: "2026-10-28", count: 1, xp: 35 };
  for (const value of [null, {}, [null], [{ ...day, date: "2026-02-30" }], [{ ...day, date: "28-10-2026" }],
    [{ ...day, count: 0 }], [{ ...day, count: -1 }], [{ ...day, xp: "35" }], [{ ...day, xp: NaN }],
    [{ ...day, xp: Infinity }], [{ ...day, xp: 0.5 }], [day, day]]) {
    assert.throws(() => buildJKProgress(totals, value, new Date("2026-10-28T12:00:00Z")), /Invalid practice activity/);
  }
  const negative = buildJKProgress(totals, [{ ...day, xp: -280 }], new Date("2026-10-28T12:00:00Z"));
  assert.equal(negative.activity.at(-1).xp, -280);
});
