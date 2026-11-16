Started from my Project 2, The Sharp.

## Refactor

Pure functions were extracted into `api/_lib/betting.js` and `api/_lib/pricing.js`. The API modules depend on external services, including Supabase; importing those modules directly would require dependencies and configuration that the test-only CI job does not install. The stake check was previously inline in the API handler. Isolating deterministic rules allows `node --test` to run without network access, database credentials, or npm install.

## Coverage and limits

The verifier baseline contains 32 tests across 10 functions: checkStake, profitOn, grade, summarize, tickerDate, yesPrice, toAmerican, matchScore, resultOf, and liveCents. A further regression test was added after the verifier experiment, bringing the final total to 33. Cases include stake boundaries, bankroll limits, odds conversion, payout rounding, refunds, empty summaries, market status, dates, team matching, and spread pricing.

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

## Application check

`npx vercel dev` started successfully at http://localhost:3000 and the homepage returned HTTP 200. `npm run build` also passed. The initial in-app browser failed to attach, and native Chrome control timed out. On a later retry, Chrome access worked, but the page remained blank after reload. Therefore placing a pick, opening a game, and inspecting My Picks were not verified in this session; these manual checks remain outstanding.

## AI use and authorship

The earlier handoff attributes the refactor, additional tests, break-it runs, and CI setup to Claude Code with Opus 5.5. The first profitOn test was written by Codex in this chat, not handwritten by the student. It does not satisfy a requirement for a test written without AI. Codex also operated the two fresh verifier sessions, reviewed the diffs, added the 5.1-cent regression, and drafted this document and the prompt-log update. The verifier exports identify Opus 5.5 and Sonnet 5.5. This document is an assisted draft and does not satisfy an instruction to write the reflection independently.
