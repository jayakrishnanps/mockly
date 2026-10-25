import assert from "node:assert/strict";
import { test } from "node:test";
import { buildProgressChart } from "../src/lib/result-progress.ts";

const history = Array.from({ length: 25 }, (_, index) => ({
  id: `attempt-${index + 1}`, submittedAt: "2026-10-25T10:00:00Z", score: index + 1, maxScore: 25,
}));

test("progress defaults to the latest ten and preserves original attempt numbers in earlier windows", () => {
  const latest = buildProgressChart(history, 0, 320);
  assert.deepEqual([latest.start, latest.end], [15, 25]);
  assert.deepEqual(latest.points.map((point) => point.attemptNumber), [16, 17, 18, 19, 20, 21, 22, 23, 24, 25]);
  assert.deepEqual(buildProgressChart(history, 1, 320).points.map((point) => point.attemptNumber), [6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
  const oldest = buildProgressChart(history, 2, 320);
  assert.deepEqual(oldest.points.map((point) => point.attemptNumber), [1, 2, 3, 4, 5]);
  assert.deepEqual(buildProgressChart(history, 999, 320), oldest);
});

test("all-time progress retains every attempt and can locate an older viewed result", () => {
  const chart = buildProgressChart(history, "all", 900);
  assert.equal(chart.points.length, 25);
  assert.equal(chart.points.find((point) => point.id === "attempt-3").attemptNumber, 3);
  assert.deepEqual(history.map((point) => point.id), Array.from({ length: 25 }, (_, index) => `attempt-${index + 1}`));
  const page = Math.floor((history.length - 1 - 2) / 10);
  assert.equal(buildProgressChart(history, page, 320).points.some((point) => point.id === "attempt-3"), true);
});

test("a first attempt is a single centered point, with no fabricated growth or invalid coordinates", () => {
  const chart = buildProgressChart(history.slice(0, 1), 0, 256);
  assert.equal(chart.points.length, 1);
  assert.equal(chart.points[0].x, 140);
  assert.ok(Number.isFinite(chart.points[0].y));
  assert.equal(buildProgressChart([], 0, 320).points.length, 0);
});

test("progress supports different maximum scores, negative scores and a stable zero-to-100 baseline", () => {
  const points = [
    { ...history[0], score: -5, maxScore: 20 },
    { ...history[1], score: 15, maxScore: 20 },
    { ...history[2], score: 75, maxScore: 100 },
    { ...history[3], score: 0, maxScore: 100 },
  ];
  const chart = buildProgressChart(points, "all", 320);
  assert.deepEqual(chart.points.map((point) => point.percentage), [-25, 75, 75, 0]);
  assert.equal(chart.points[1].y, chart.points[2].y);
  assert.ok(chart.ticks.some((tick) => tick.value === 0));
  assert.ok(chart.ticks.some((tick) => tick.value === 100));
  assert.ok(chart.points.every((point) => point.x >= 44 && point.x <= 300 && point.y >= 24 && point.y <= 188));
});
