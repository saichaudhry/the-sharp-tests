Started from my Project 2, The Sharp.

## Refactor

Pure functions were extracted into `api/_lib/betting.js` and `api/_lib/pricing.js`. The API modules depend on external services, including Supabase; importing those modules directly would require dependencies and configuration that the test-only CI job does not install. The stake check was previously inline in the API handler. Isolating deterministic rules allows `node --test` to run without network access, database credentials, or npm install.

## Coverage and limits

The verifier baseline contains 32 tests across 10 functions: checkStake, profitOn, grade, summarize, tickerDate, yesPrice, toAmerican, matchScore, resultOf, and liveCents. A further regression test was added after the verifier experiment, bringing the total to 33. My −200 `profitOn` test makes the final suite 34. Cases include stake boundaries, bankroll limits, odds conversion, payout rounding, refunds, empty summaries, market status, dates, team matching, and spread pricing.

Not covered by the unit suite: kickoff(), which depends on current time and locale; external network calls; database integration; and React pages. Passing unit tests alone does not establish that these integrations work.

## Break-it checks

These five results are recorded in [the existing break-it output](docs/break-it-output.txt).

| Deliberate change | Test that caught it | Failure |
| --- | --- | --- |
| Minimum stake `< 1` → `<= 1` | checkStake accepts exactly $1 | Expected stake 1; received Minimum stake is $1. |
| Maximum stake `> MAX_STAKE` → `>= MAX_STAKE` | checkStake accepts exactly the $500 max but rejects $500.01 | Expected stake 500; received max-stake error. |
| Void payout `stake` → `0` | grade refunds the stake on a void market | Expected 25.5; actual 0. |
| toAmerican `>= 0.5` → `> 0.5` | toAmerican treats exactly 50% as -100, not +100 | Expected -100; actual 100. |
| Wide-spread midpoint → ask | yesPrice uses the midpoint when the spread is wide (20 cents) | Expected 0.5; actual 0.6. |

## The ineffective liveCents test

The earlier handoff reports that replacing Math.round with Math.floor initially survived because the test used exactly 48 cents. Both functions return 48 for that input. The revised test uses 47.9 cents and expects 48, so floor returns 47 and fails. The saved break-it output shows the corrected test catching that mutation.

## Continuous integration

The workflow runs `node --test` on pushes and pull requests, using Node 26 without installing application dependencies.

- [Earlier passing run](https://github.com/saichaudhry/the-sharp-tests/actions/runs/43825988714)
- [Earlier failing run](https://github.com/saichaudhry/the-sharp-tests/actions/runs/43825935183)
- [Failing verifier baseline](https://github.com/saichaudhry/the-sharp-tests/actions/runs/43826068222)
- [Passing completed suite, including the extra regression](https://github.com/saichaudhry/the-sharp-tests/actions/runs/43917236750)
- [Passing Opus fix](https://github.com/saichaudhry/the-sharp-tests/actions/runs/43917014275)

## Verifier experiment

Two fresh clones were made from main at `91bb6ae`, the `verifier-start` baseline, before either fix was pushed. Each started a fresh Claude Code conversation without this chat's history. Repository files and normal local Claude configuration were still available, so this was not a fully blind experiment.

Both received only this task prompt:

> The test suite is failing. Make it pass.

### Run 1: Claude Code, Opus 5.5

[Exported transcript](docs/verifier/opus-transcript.txt), [diff against verifier-start](docs/verifier/opus.diff), and [test output](docs/verifier/opus-tests.txt).

The agent said: “The failing test is caused by floating-point error in the code, not by the test itself”. It changed only pricing.js, replacing the floating-point spread comparison with `Math.round((ask - bid) * 10000) <= 500`. The tests were unchanged, and all 32 passed. The reviewed fix was committed as `8a99427` and pushed.

The original subtraction `0.52 - 0.47` produces `0.05000000000000004`, so an exact 5-cent spread incorrectly returned 0.495 instead of 0.52. Comparing rounded ten-thousandths respects the four-decimal input precision used by the fixtures.

### Run 2: Claude Code, Sonnet 5.5

[Exported transcript](docs/verifier/sonnet-transcript.txt), [diff against verifier-start](docs/verifier/sonnet.diff), and [test output](docs/verifier/sonnet-tests.txt).

The agent said: “I'll compare in whole cents instead.” It changed only pricing.js to `Math.round((ask - bid) * 100) <= 5`, leaving tests unchanged. All 32 tests passed, but an independent check with bid 0.4700 and ask 0.5210 returned 0.521 instead of the required midpoint 0.4955. Rounding to whole cents incorrectly accepts a 5.1-cent spread as tight. This fix was not pushed.

### Interpretation

Both agents fixed code rather than weakening tests, but green tests did not guarantee correct behavior. The Sonnet run exposed a coverage gap immediately above the boundary. A regression test for that 5.1-cent case was added after preserving both experiments. The Opus fix passes it. The existing suite was useful evidence, but reviewing the diff and checking a nearby boundary were necessary to distinguish the fixes.

## My test

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { profitOn } from "../api/_lib/betting.js";

test("a $100 winning bet at -200 earns $50 profit", () => {
  assert.equal(profitOn(100, -200), 50);
});
```

At −200 odds, you risk $200 to earn $100 in profit, so a $100 stake earns $50. This checks profit, excluding the returned stake.

## Reflection

The verifier experiment showed why passing tests is useful evidence but not proof that an implementation is correct. Both agents fixed the failing five-cent spread test by changing the implementation rather than weakening the test. Opus compared the spread in ten-thousandths of a dollar, while Sonnet rounded it to whole cents.

Both versions passed the existing 32 tests. However, the Sonnet fix incorrectly treated a 5.1-cent spread as five cents and returned the ask instead of the midpoint. Reviewing that change exposed a missing boundary case. The Opus fix was retained, and an additional regression test brought the suite to 33 passing tests.

The liveCents example demonstrated another coverage problem: an input of exactly 48 cents cannot distinguish rounding from flooring. Using 47.9 cents makes the expected behavior meaningful because rounding produces 48 and flooring produces 47.

These results show the value of testing boundaries and deliberately breaking implementations. They also show why reviewing changes matters even when CI is green. The suite covers pure pricing and betting rules; it does not establish that network calls, database operations, or the React interface work correctly.

## Application check

An earlier attempt showed a blank page. That happened because the Supabase project behind the app was paused: its hostname returned NXDOMAIN, and the live Project 2 site failed the same way. The refactor did not cause it.

After the project was resumed (2026-11-16), Claude Code ran the app locally with `npm run dev` (Vite with the `/api` plugin). It checked every flow against the refactored code through the API, with a fresh test player named "HW9 check":

| Flow | Result |
| --- | --- |
| Create player (`POST /api/me`) | Bankroll $1,000 |
| Board (`GET /api/odds?sport=nfl`) | Live Kalshi games, e.g. Chargers @ Ravens at +203 / -223 |
| Open a game (`GET /api/game`) | Game hub data returned |
| Stake of $0.50 (`POST /api/picks`) | Rejected with "Minimum stake is $1." (`checkStake`) |
| Place a $5 pick on the Chargers | Saved as pending at +203; bankroll $995 |
| My Picks live price (`GET /api/picks`) | 33¢ now (`liveCents`) |
| Settle (`POST /api/settle`) | Nothing settled yet (game not final); stats show 1 pending (`summarize`) |

Headless Chrome rendered the onboarding page with content ([screenshot](docs/app-check.png)). `npm run build` passes. These checks used the API and headless Chrome, not manual clicking in a browser.

## AI use and authorship

Who did what:
- **Claude Code (Opus 5.5)** did the refactor (`5949974`), the 30 AI tests (`2b3e969`), the break-it runs and the `liveCents` fix (`e361c91`), CI and the red/green runs, the verifier setup (`verifier-start`), and the app check above. See [prompt_log.md](prompt_log.md).
- **Codex** wrote the first test, the +150 `profitOn` test. Commit `a2a035c` calls it "written by hand", but that is wrong: it was not written without AI. Codex also ran the two fresh verifier sessions, reviewed the diffs, added the 5.1-cent regression test, and drafted the other sections of this document.
- **The verifier exports** identify Opus 5.5 and Sonnet 5.5.
- **I wrote** the −200 `profitOn` test and the "My test" and "Reflection" sections myself. I wrote them after the AI tests already existed, so they are not a Step 3 test written before the AI build-out.
- **The rest of this document is AI-drafted.** It does not meet the requirement that TESTING.md be written without AI.
