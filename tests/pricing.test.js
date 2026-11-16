// AI-assisted tests (Claude Code, Opus 5.5) for api/_lib/pricing.js.
// Market shapes mirror Kalshi's API: prices are dollar strings like "0.5400".
import { test } from "node:test";
import assert from "node:assert/strict";
import { liveCents, matchScore, resultOf, tickerDate, toAmerican, yesPrice } from "../api/_lib/pricing.js";

// ---- tickerDate: "KXNFLGAME-26OCT05ATLNO" -> "20261005" ----

test("tickerDate reads the date out of an event ticker", () => {
  assert.equal(tickerDate("KXNFLGAME-26OCT05ATLNO"), "20261005");
});

test("tickerDate handles January (month index 0) and December", () => {
  assert.equal(tickerDate("KXNBAGAME-27JAN02BOSNYK"), "20270102");
  assert.equal(tickerDate("KXNBAGAME-26DEC25LALGSW"), "20261225");
});

test("tickerDate returns null for a ticker with no date part or a bad month", () => {
  assert.equal(tickerDate("KXNFLGAME"), null);
  assert.equal(tickerDate("KXNFLGAME-26XYZ05ATLNO"), null);
});

// ---- yesPrice: ask when spread is tight, midpoint when wide, last price as fallback ----

test("yesPrice pays the ask when the spread is tight (2 cents)", () => {
  assert.equal(yesPrice({ yes_bid_dollars: "0.5200", yes_ask_dollars: "0.5400" }), 0.54);
});

test("yesPrice still pays the ask when the spread is exactly 5 cents (the rule is <= 5¢)", () => {
  assert.equal(yesPrice({ yes_bid_dollars: "0.4700", yes_ask_dollars: "0.5200" }), 0.52);
});

test("yesPrice uses the midpoint when the spread is wide (20 cents)", () => {
  assert.equal(yesPrice({ yes_bid_dollars: "0.4000", yes_ask_dollars: "0.6000" }), 0.5);
});

test("yesPrice falls back to the last trade when one side of the book is empty", () => {
  assert.equal(yesPrice({ yes_bid_dollars: "0.0000", yes_ask_dollars: "0.6000", last_price_dollars: "0.5700" }), 0.57);
});

test("yesPrice returns null when there is no bid, ask or last trade", () => {
  assert.equal(yesPrice({}), null);
});

// ---- toAmerican: probability -> American odds ----

test("toAmerican turns a favorite into negative odds and an underdog into positive", () => {
  assert.equal(toAmerican(0.54), -117);
  assert.equal(toAmerican(0.4), 150);
});

test("toAmerican treats exactly 50% as -100, not +100", () => {
  assert.equal(toAmerican(0.5), -100);
});

// ---- matchScore: Kalshi side vs ESPN team ----

const JETS = { abbr: "NYJ", name: "New York Jets", short: "Jets", location: "New York" };

test("matchScore gives 5 for a matching abbreviation plus name prefix", () => {
  assert.equal(matchScore({ abbr: "NYJ", name: "New York J" }, JETS), 5);
});

test("matchScore gives only a weak 1 for a location-only match", () => {
  assert.equal(matchScore({ abbr: "NYG", name: "New York G" }, JETS), 1);
});

test("matchScore gives 0 for a different team", () => {
  assert.equal(matchScore({ abbr: "ATL", name: "Atlanta" }, JETS), 0);
});

// ---- resultOf: settled market -> 'yes' | 'no' | 'void' | null ----

test("resultOf returns null until the market is finalized or settled", () => {
  assert.equal(resultOf(null), null);
  assert.equal(resultOf({ status: "active", result: "yes" }), null);
});

test("resultOf passes through yes/no and calls anything else void", () => {
  assert.equal(resultOf({ status: "finalized", result: "yes" }), "yes");
  assert.equal(resultOf({ status: "settled", result: "no" }), "no");
  assert.equal(resultOf({ status: "settled", result: "" }), "void");
});

// ---- liveCents ----

// Fixed after break-it: the old version used an ask of exactly 48¢, so Math.floor
// and Math.round gave the same answer and a round->floor bug slipped through.
// 47.9¢ must round UP to 48.
test("liveCents rounds the current price to the nearest cent, or null with no market", () => {
  assert.equal(liveCents({ yes_bid_dollars: "0.4700", yes_ask_dollars: "0.4790" }), 48);
  assert.equal(liveCents(null), null);
});
