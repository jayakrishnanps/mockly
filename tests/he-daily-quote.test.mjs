import assert from "node:assert/strict";
import { test } from "node:test";
import { HE_QUOTES } from "../src/lib/he-quotes.ts";
import { heDailyQuote } from "../src/lib/he-daily-quote.ts";

const DAY_MS = 86400000;
const firstDay = Date.parse("2026-10-27T18:30:00Z");

test("HE's quote collection contains all 150 distinct Malayalam entries", () => {
  assert.equal(HE_QUOTES.length, 150);
  assert.equal(new Set(HE_QUOTES).size, 150);
  for (const quote of HE_QUOTES) {
    assert.ok(/[\u0d00-\u0d7f]/.test(quote));
    assert.equal(quote, quote.trim());
    assert.ok(!/[\r\n]/.test(quote));
    assert.ok(!(quote.startsWith('"') && quote.endsWith('"')));
  }
});

test("daily quotes use every entry once before repeating the same 150-day cycle", () => {
  const cycle = Array.from({ length: 150 }, (_, index) => heDailyQuote(new Date(firstDay + index * DAY_MS)));
  assert.deepEqual(cycle, [...HE_QUOTES]);
  assert.equal(new Set(cycle).size, 150);
  for (let index = 0; index < 150; index++) {
    assert.equal(heDailyQuote(new Date(firstDay + (index + 150) * DAY_MS)), cycle[index]);
    assert.equal(heDailyQuote(new Date(firstDay + (index - 150) * DAY_MS)), cycle[index]);
  }
});

test("quote changes at India midnight and stays identical within the same day", () => {
  assert.equal(heDailyQuote(new Date("2026-10-27T18:29:59.999Z")), HE_QUOTES[149]);
  assert.equal(heDailyQuote(new Date("2026-10-27T18:30:00Z")), HE_QUOTES[0]);
  assert.equal(heDailyQuote(new Date("2026-10-28T07:00:00Z")), HE_QUOTES[0]);
  assert.equal(heDailyQuote(new Date("2026-10-28T18:29:59.999Z")), HE_QUOTES[0]);
  assert.equal(heDailyQuote(new Date("2026-10-28T18:30:00Z")), HE_QUOTES[1]);
  assert.throws(() => heDailyQuote(new Date("invalid")), /Invalid quote date/);
});
