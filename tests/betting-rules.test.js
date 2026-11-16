// AI-assisted tests (Claude Code, Opus 5.5) for api/_lib/betting.js.
// Each test targets a boundary or error case named in the HW9 plan.
import { test } from "node:test";
import assert from "node:assert/strict";
import { checkStake, grade, profitOn, summarize, MAX_STAKE } from "../api/_lib/betting.js";

// ---- checkStake: min $1, max $500, can't exceed bankroll, rounds to cents ----

test("checkStake accepts exactly $1 (the minimum is inclusive)", () => {
  assert.deepEqual(checkStake(1, 1000), { stake: 1 });
});

test("checkStake rejects 99 cents as below the minimum", () => {
  assert.deepEqual(checkStake(0.99, 1000), { error: "Minimum stake is $1." });
});

test("checkStake accepts exactly the $500 max but rejects $500.01", () => {
  assert.equal(MAX_STAKE, 500);
  assert.deepEqual(checkStake(500, 1000), { stake: 500 });
  assert.deepEqual(checkStake(500.01, 1000), { error: "Max stake is $500. Lou has limits." });
});

test("checkStake lets you bet your whole bankroll but not a cent more", () => {
  assert.deepEqual(checkStake(250, 250), { stake: 250 });
  assert.deepEqual(checkStake(250.01, 250), { error: "You don't have that much." });
});

test("checkStake treats text, empty and missing stakes as below the minimum", () => {
  for (const bad of ["abc", "", undefined, null, -5]) {
    assert.deepEqual(checkStake(bad, 1000), { error: "Minimum stake is $1." }, `input ${JSON.stringify(bad)}`);
  }
});

test("checkStake rounds to cents and reads the bankroll as a number", () => {
  assert.deepEqual(checkStake("12.345", "100.00"), { stake: 12.35 });
});

test("checkStake reports the max-stake error before the bankroll error", () => {
  assert.deepEqual(checkStake(600, 10), { error: "Max stake is $500. Lou has limits." });
});

// ---- profitOn: American odds ----

test("profitOn at -200 risks $100 to win $50", () => {
  assert.equal(profitOn(100, -200), 50);
});

test("profitOn at -100 (even money) wins exactly the stake", () => {
  assert.equal(profitOn(40, -100), 40);
});

// ---- grade: Kalshi result -> pick result ----

test("grade pays stake plus profit on a win, rounded to cents", () => {
  // $10 at -110: profit 9.0909... -> payout 19.09
  assert.deepEqual(grade({ stake: "10", price: -110 }, "yes"), { status: "won", payout: 19.09 });
});

test("grade pays nothing on a loss", () => {
  assert.deepEqual(grade({ stake: 50, price: 150 }, "no"), { status: "lost", payout: 0 });
});

test("grade refunds the stake on a void market", () => {
  assert.deepEqual(grade({ stake: "25.50", price: 150 }, "void"), { status: "push", payout: 25.5 });
});

test("grade returns null while the market is still open", () => {
  assert.equal(grade({ stake: 50, price: 150 }, null), null);
});

// ---- summarize: record and ROI ----

test("summarize counts each status and leaves pending picks out of profit and ROI", () => {
  const picks = [
    { status: "won", stake: "100", payout: "250" },  // +150
    { status: "lost", stake: "50", payout: "0" },    // -50
    { status: "push", stake: "20", payout: "20" },   // 0
    { status: "pending", stake: "999", payout: "0" },
  ];
  assert.deepEqual(summarize(picks), { won: 1, lost: 1, push: 1, pending: 1, profit: 100, roi: 58.82 });
});

test("summarize of no picks has zero ROI instead of dividing by zero", () => {
  assert.deepEqual(summarize([]), { won: 0, lost: 0, push: 0, pending: 0, profit: 0, roi: 0 });
});
