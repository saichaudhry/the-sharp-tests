import { test } from "node:test";
import assert from "node:assert/strict";
import { profitOn } from "../api/_lib/betting.js";

test("a $100 winning bet at +150 earns $150 profit", () => {
  assert.equal(profitOn(100, 150), 150);
});
