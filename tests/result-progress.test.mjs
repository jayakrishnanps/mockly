import assert from "node:assert/strict";
import { test } from "node:test";
import { buildProgressChart, buildTimeProgressChart, formatProgressTime, PROGRESS_CHART_HEIGHT } from "../src/lib/result-progress.ts";

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

test("time overlay follows the same attempt window and x coordinates without changing score values", () => {
  const timedHistory = history.map((point, index) => ({ ...point, timeTakenSeconds: 600 - index * 10 }));
  const original = structuredClone(timedHistory);
  for (const range of [0, 1, 2, "all"]) {
    const score = buildProgressChart(timedHistory, range, 932);
    const overlay = buildProgressChart(timedHistory, range, 932, "detail", true);
    const time = buildTimeProgressChart(overlay, "detail");
    assert.deepEqual(time.points.map((point) => [point.id, point.x]), overlay.points.map((point) => [point.id, point.x]));
    assert.deepEqual(overlay.points.map((point) => [point.id, point.percentage, point.y]), score.points.map((point) => [point.id, point.percentage, point.y]));
    assert.deepEqual(overlay.ticks, score.ticks);
    assert.equal(score.plot.right - overlay.plot.right, 48);
    assert.ok(time.points.every((point) => point.y >= overlay.plot.top && point.y <= overlay.plot.bottom));
  }
  assert.deepEqual(timedHistory, original);
});

test("time detail fits the selected range and full scale starts at zero", () => {
  const timedHistory = history.map((point, index) => ({ ...point, timeTakenSeconds: index < 15 ? 3600 : 600 + index % 5 * 10 }));
  const latest = buildProgressChart(timedHistory, 0, 420, "detail", true);
  const detail = buildTimeProgressChart(latest, "detail");
  const full = buildTimeProgressChart(latest, "full");
  const all = buildTimeProgressChart(buildProgressChart(timedHistory, "all", 932, "detail", true), "detail");
  assert.ok(detail.minimum > 500 && detail.minimum < 600);
  assert.ok(detail.maximum >= 640 && detail.maximum < 720);
  assert.equal(full.minimum, 0);
  assert.ok(full.maximum >= 640);
  assert.ok(all.maximum >= 3600);
  assert.ok(detail.points[0].y - detail.points[4].y > full.points[0].y - full.points[4].y);
  assert.ok(detail.ticks.length <= 8);
  assert.ok(detail.ticks.every((tick) => Number.isSafeInteger(tick.value) && tick.value >= 0 && Number.isFinite(tick.y)));
});

test("missing or invalid time leaves gaps instead of joining unrelated points or inventing zeroes", () => {
  const timedHistory = [0, null, 50, 80, undefined, -1, 1.5, NaN, Infinity, 100].map((seconds, index) => ({ ...history[index], timeTakenSeconds: seconds }));
  const chart = buildProgressChart(timedHistory, 0, 420, "detail", true);
  const time = buildTimeProgressChart(chart, "detail");
  assert.deepEqual(time.points.map((point) => point.seconds), [0, null, 50, 80, null, null, null, null, null, 100]);
  assert.equal(time.points[0].y, chart.plot.bottom);
  assert.equal((time.path.match(/M/g) ?? []).length, 3);
  assert.equal((time.path.match(/L/g) ?? []).length, 1);
  assert.doesNotMatch(time.path, /NaN|Infinity|null|undefined/);
});

test("empty, single and constant time series retain a valid time axis", () => {
  for (const scale of ["detail", "full"]) {
    const empty = buildTimeProgressChart(buildProgressChart([], 0, 420, scale, true), scale);
    assert.equal(empty.path, "");
    assert.equal(empty.points.length, 0);
    assert.ok(empty.maximum > empty.minimum);
    const missing = buildTimeProgressChart(buildProgressChart(history.slice(0, 1), 0, 420, scale, true), scale);
    assert.equal(missing.path, "");
    assert.equal(missing.points[0].y, null);
    for (const seconds of [0, 1, 600, 3600]) {
      for (const count of [1, 3]) {
        const chart = buildProgressChart(history.slice(0, count).map((point) => ({ ...point, timeTakenSeconds: seconds })), 0, 420, scale, true);
        const time = buildTimeProgressChart(chart, scale);
        assert.ok(time.maximum - time.minimum >= 60);
        assert.ok(time.minimum >= 0);
        assert.ok(time.points.every((point) => Number.isFinite(point.y) && point.y >= chart.plot.top && point.y <= chart.plot.bottom));
        if (count === 1) assert.equal(time.points[0].x, (chart.plot.left + chart.plot.right) / 2);
      }
    }
  }
});

test("long time histories retain every stored time and chronological attempt alignment", () => {
  const timedHistory = Array.from({ length: 1000 }, (_, index) => ({ ...history[0], id: `timed-${index}`, timeTakenSeconds: index % 20 === 0 ? null : index * 10 }));
  const chart = buildProgressChart(timedHistory, "all", 32132, "detail", true);
  const time = buildTimeProgressChart(chart, "detail");
  assert.equal(time.points.length, 1000);
  assert.equal(time.points[500].id, chart.points[500].id);
  assert.equal(time.points[999].seconds, 9990);
  assert.ok(time.ticks.length <= 8);
  assert.ok(time.points.every((point) => point.y === null || point.y >= chart.plot.top && point.y <= chart.plot.bottom));
  assert.doesNotMatch(time.path, /NaN|Infinity|null|undefined/);
});

test("time labels distinguish valid zero and missing data and show minutes plus seconds", () => {
  assert.equal(formatProgressTime(0), "0s");
  assert.equal(formatProgressTime(59), "59s");
  assert.equal(formatProgressTime(60), "1m 00s");
  assert.equal(formatProgressTime(125), "2m 05s");
  assert.equal(formatProgressTime(3605), "60m 05s");
  for (const seconds of [null, undefined, NaN, Infinity, -1, 1.5]) assert.equal(formatProgressTime(seconds), "—");
});
