import assert from "node:assert/strict";
import { test } from "node:test";
import { buildProgressChart, PROGRESS_CHART_HEIGHT } from "../src/lib/result-progress.ts";

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
  assert.equal(chart.points[0].x, 146);
  assert.ok(Number.isFinite(chart.points[0].y));
  assert.equal(buildProgressChart([], 0, 320).points.length, 0);
});

test("full-scale progress supports different maximum scores and negative scores", () => {
  const points = [
    { ...history[0], score: -5, maxScore: 20 },
    { ...history[1], score: 15, maxScore: 20 },
    { ...history[2], score: 75, maxScore: 100 },
    { ...history[3], score: 0, maxScore: 100 },
  ];
  const chart = buildProgressChart(points, "all", 320, "full");
  assert.deepEqual(chart.points.map((point) => point.percentage), [-25, 75, 75, 0]);
  assert.equal(chart.points[1].y, chart.points[2].y);
  assert.ok(chart.ticks.some((tick) => tick.value === 0));
  assert.ok(chart.ticks.some((tick) => tick.value === 100));
  assert.ok(chart.points.every((point) => point.x >= chart.plot.left && point.x <= chart.plot.right && point.y >= chart.plot.top && point.y <= chart.plot.bottom));
});

test("detail scale makes one-percentage-point changes near 100 clearly visible", () => {
  const points = [95, 98, 99].map((score, index) => ({ ...history[index], score, maxScore: 100 }));
  const detail = buildProgressChart(points, 0, 320);
  const full = buildProgressChart(points, 0, 320, "full");

  assert.ok(PROGRESS_CHART_HEIGHT >= 320);
  assert.ok(detail.minimum >= 90 && detail.minimum < 95);
  assert.equal(detail.maximum, 100);
  assert.ok(detail.ticks.length >= 10 && detail.ticks.length <= 15);
  assert.ok(detail.points[1].y - detail.points[2].y >= 30);
  assert.ok(detail.points[1].y - detail.points[2].y > full.points[1].y - full.points[2].y);
  assert.equal(full.minimum, 0);
  assert.equal(full.maximum, 100);
});

test("constant scores keep a meaningful padded range without collapsing or exceeding 0–100", () => {
  for (const score of [0, 50, 100]) {
    const points = history.slice(0, 3).map((point) => ({ ...point, score, maxScore: 100 }));
    const chart = buildProgressChart(points, 0, 256);
    assert.ok(chart.maximum - chart.minimum >= 5);
    assert.ok(chart.minimum >= 0 && chart.maximum <= 100);
    assert.ok(chart.points.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y)));
    assert.ok(chart.points.every((point) => point.y >= chart.plot.top && point.y <= chart.plot.bottom));
  }
});

test("detail scales to the chosen attempt window while all-time retains outliers", () => {
  const points = history.map((point, index) => ({ ...point, score: index < 15 ? 20 : 95 + index % 5, maxScore: 100 }));
  const latest = buildProgressChart(points, 0, 320);
  const all = buildProgressChart(points, "all", 1000);
  assert.ok(latest.minimum > 90);
  assert.ok(all.minimum < 20 && all.maximum >= 99);
  assert.equal(all.points.length, 25);
  assert.equal(all.points[0].percentage, 20);
});

test("large all-time histories keep every point, stable attempt numbers and unclipped negative scores", () => {
  const points = Array.from({ length: 1000 }, (_, index) => ({
    id: `attempt-${index + 1}`, submittedAt: "2026-10-25T10:00:00Z", score: index === 500 ? -25 : 95 + index % 5, maxScore: 100,
  }));
  const original = structuredClone(points);
  const chart = buildProgressChart(points, "all", 32084);
  assert.equal(chart.points.length, 1000);
  assert.equal(chart.points[500].attemptNumber, 501);
  assert.equal(chart.points[500].percentage, -25);
  assert.ok(chart.minimum < -25 && chart.maximum >= 99);
  assert.ok(chart.ticks.length <= 15);
  assert.ok(chart.points.every((point) => point.x >= chart.plot.left && point.x <= chart.plot.right && point.y >= chart.plot.top && point.y <= chart.plot.bottom));
  assert.deepEqual(points, original);
});
