# APA · SMC Live Desk — Engineering operating record

Last reviewed: 2026-10-24  
Repository: https://github.com/saviourmustapha123/apa-smc-live-desk  
Live site: https://saviourmustapha123.github.io/apa-smc-live-desk/

## Purpose

This is the engineering control record for the project. Every meaningful change should be traceable to a requirement, code change, test result, deployment result, and any remaining limitation. Passing CI is not the same as proving that every live screen works correctly or that a strategy is profitable.

## Automated controls already present

- `.github/workflows/background-health-check.yml`: scheduled every 15 minutes. Checks the deployed page, source syntax, selected market feeds and safety markers. On push or manual run it also runs the core, SMC detector, discovery, research backtest, timeframe regression tests and proxy backtest.
- `.github/workflows/strategy-validation.yml`: scheduled daily at 02:17 UTC and manually runnable. Runs strategy core tests and a rolling historical proxy backtest.
- `scripts/engineering-audit.mjs`: source-level architecture and safety audit. It is designed to catch important regressions and missing controls, not to duplicate the market-data availability check.

These GitHub Actions jobs run in the cloud while the phone is offline, subject to GitHub Actions availability, schedule delays and usage limits. They are scheduled jobs, not an always-on market scanner.

## Current trading logic status

- The current signal engine is explicitly **PROVISIONAL-HEURISTIC**. Do not describe it as a complete or independently validated implementation of the proprietary APA framework.
- The candidate gate requires a minimum 1:3 reward-to-risk ratio. This is a screening condition, not evidence that a candidate is likely to win.
- The app is a signal-monitoring/research tool. It must not place brokerage orders.
- A candidate that has not triggered is not an active trade and must not accrue TP/SL progress or be counted as a win/loss.
- A setup that expires or invalidates before entry belongs in the missed/invalidated lifecycle, not the losing-trade tally.
- Historical backtest figures are provisional proxy results. Spread, commissions, slippage, latency, financing, feed quality and overlapping-signal portfolio effects may not be fully modelled.
- Do not force a daily signal quota. Quality gates take precedence over a requested count.

## Engineering change ledger

Append a dated entry for each material change. Include the commit, reason, checks performed, outcome and known limitations. Do not mark live behaviour verified from source inspection alone.

### 2026-10-24 — Signal lifecycle and provisional status updates

- Commit: `43abcec70f7e8a7ab62540d838f08019a6767d5f`
- Changes: made the provisional heuristic status explicit; removed the misleading RULE-VERIFIED wording; separated missed signals in the monitor/performance views; removed the artificial daily admission caps; adjusted regression expectations and cache version.
- CI follow-up reported: Pages deployment and background health-check workflows passed for that revision.
- Not yet established by those workflow results: end-to-end visual confirmation that all monitor panes are correct on a real phone/browser; a full proprietary APA implementation; profitability; continuous cloud market scanning.


### 2026-10-24 — Research simulator gap-handling correction

- Commits: `be8ab0a8f8f857c00158072b7b095ed9d72e87d7` (simulator) and `7642f97244865e3eca546ff2bb18baf44d6c983b` (regression tests).
- Defect found during engineering review: the research backtest inspected candle high/low and classified a candle touching both stop and target as a stop-first loss before checking whether the candle opened beyond the stop. This could understate losses on a gap through the stop.
- Correction: opening gaps are now processed before intrabar high/low checks; stop gaps use the opening price and favorable target gaps are recorded as `TARGET_AT_OPEN` at the target price.
- Added regression tests for adverse stop gaps and favorable target gaps.
- Verification: GitHub Actions triggered for these commits; final workflow result is pending at the time of this entry. Do not mark the correction fully verified until the test workflow passes.

### 2026-10-24 — Pending-entry gap classification and production lifecycle tests

- Production fix commit: `549da2c3df99bf8d6e76612b494d79bc06e98e3e`.
- Test harness commits: `a2f27265d1a22ce887365ca40693a2476087e85f`, `c3fbab045677e93b1ec81072ec46638d7d3fb32c`, and `f45cffbbe61f827adccdafac32b9fdc6ecc24f3c`; engineering audit now requires the lifecycle test file in `7581998f751bd6af1a5ffaa09bb51e76d7c85b1e`.
- Defect: a pending signal could be treated as triggered when a candle opened beyond its stop or target, then its later high/low retraced across entry. That could create a false loss or win despite no valid entry sequence.
- Correction: resolve pending opening gaps first. A gap through the structural stop is classified as invalidated; a gap through the target before entry is classified as expired/missed. Only then is the candle range checked for an entry touch.
- Added six regression tests that execute the production `resolveSignalOutcomes` function extracted from `index.html`: long/short stop gaps, long/short target gaps, a valid entry trigger, and no TP/SL progress while untriggered.
- Verification: GitHub Actions background health check passed at commit `f45cffbbe61f827adccdafac32b9fdc6ecc24f3c`; engineering audit reported 18/18 controls and the lifecycle suite passed 6/6 tests. The market-feed check still reports three warnings from market-session/region restrictions, not code-test failures.
- Deployment of this exact revision was still running at the time of this ledger update; verify the Pages workflow before describing it as live.
- Limitation: these deterministic lifecycle tests cover the identified gap/trigger cases but are not a complete real-browser UI acceptance test or proof of strategy profitability.

### 2026-10-24 — Preserve active trade lifecycle across refresh

- Production fix: `ff0b772002fd2f1b862930ad0fb316d79a300f12`; follow-up correction: `e69d548e22f79c060c7875323f43682f770ee128`.
- Regression coverage added in `6584e902314de0d4836b58405789af353287a53b` and refined in `e0bf75fe376eee0d3b77b9dbf5c91c3b094fd940`.
- Defect: lifecycle resolution initialized every signal as not entered on each refresh. If a previously active signal's retained candle window no longer contained the original entry touch, the resolver could replay old bars or revert an active trade to pending.
- Correction: restore entered state from persisted `triggeredAt` / `RUNNING`, and skip bars that ended before the stored trigger time using the selected timeframe duration.
- Added tests that verify active state survives reload/history truncation and old pre-entry target touches are not replayed as outcomes.
- Verification at `e69d548e22f79c060c7875323f43682f770ee128`: background health check passed, engineering audit passed 18/18 controls, and all eight production lifecycle regression tests passed. The Pages deployment for this exact revision was still in progress at the time of this update.
- A test run exposed a follow-up defect during implementation: the trigger timestamp was declared constant while the resolver may set it on a new entry. Changed it to a mutable binding; the complete background check then passed.
- Limitation: tests verify deterministic lifecycle behavior, not the full rendered UI on every phone/browser or strategy profitability.

### 2026-10-24 — Active trade persistence and outcome category separation

- Production lifecycle changes: `ff0b772002fd2f1b862930ad0fb316d79a300f12` and `e69d548e22f79c060c7875323f43682f770ee128`.
- Regression coverage: `6584e902314de0d4836b58405789af353287a53b`, `e0bf75fe376eee0d3b77b9dbf5c91c3b094fd940`.
- Performance classification fixes: `da7b15209da220c891b203195f23e2e0c6b2bc55`, `6d2db6787162045b2ac1a9b2ace6f5d4c9dcb3e9`; regression assertions: `80b9109322d9ed7337e851f9f8a22f871d024113`, `32dab2d5f31788a10f872a6903e2dde92dbb2130`.
- Active-trade defect: the resolver reset its in-memory entry state on every refresh, which could replay pre-entry candles or revert a persisted running trade to pending when the retained history no longer contained the original entry touch. The resolver now restores entry state from persisted trigger metadata and avoids replaying candles that ended before that trigger.
- Classification defect: invalidated setups were counted as missed trades. They now have a dedicated **Invalidated** performance filter and are excluded from the **Missed** count in both performance history and the signal desk. They are not counted as wins or losses.
- Verification at `32dab2d5f31788a10f872a6903e2dde92dbb2130`: background health check passed; engineering audit passed 18/18 controls; timeframe regression tests and all eight production lifecycle tests passed; strategy core, SMC detector, discovery and research backtest tests passed. The Pages deployment for this revision was still in progress at the time of this record.
- During testing, a constant/mutable timestamp binding defect was found and corrected before the successful run.
- Limitations remain: CI is not a full browser-on-phone acceptance test, and the strategy engine remains provisional. No profitability claim is implied.

### 2026-10-24 — Release cache refresh and final regression verification

- App release marker bumped to `2026.10.24.20` in `e4d8cdf3ff5cb3bf0962982464b440b8c524dbc3`.
- Service worker shell cache bumped to `apa-smc-shell-2026-10-24-17` in `90abe50d54fe7b1c57084cb708c692948959fcd3`, so installed/offline shells can receive the changed app.
- Updated the release-marker regression assertion in `57012d8b25a3be6eb4130c5d47a5893377374c16`. The previous run correctly caught the stale hard-coded `.19` assertion; the test expectation is now aligned with `.20`.
- Latest background health check at `57012d8b25a3be6eb4130c5d47a5893377374c16`: success. Engineering audit passed 18/18 controls; app timeframe tests, signal lifecycle tests, strategy core, SMC detector, strategy discovery, research backtest and rolling proxy backtest all passed.
- Pages deployment for the app/cache revision `90abe50d54fe7b1c57084cb708c692948959fcd3` completed successfully. The latest commit only updates tests; its Pages workflow is running separately.
- Remaining limitation: public feed warnings can occur due market-session/region/provider restrictions. Passing tests do not prove strategy profitability or full manual mobile UI acceptance.

### 2026-10-24 — Lifecycle persistence and missed-signal presentation

- Production lifecycle correction: `index.html` now reconstructs an already-triggered trade from persisted `triggeredAt`/RUNNING state and skips candles fully before the trigger. This prevents reload or limited candle history from replaying a pre-entry target/stop as if it happened after entry.
- Production signal admission guards now have regression coverage for duplicate candidates in both persisted and queued signals, plus stale long/short entries whose latest closed price has already crossed stop or target.
- Performance presentation: expired pending setups remain in the Missed category and are explicitly labelled `MISSED · ENTRY NOT TRIGGERED`; pre-entry invalidations are labelled `INVALIDATED BEFORE ENTRY`. They are not counted as stop-loss trades. The missed and unsuccessful categories remain separate.
- Release marker: `2026.10.24.21`; service-worker shell cache bumped to `apa-smc-shell-2026-10-24-18`.
- Regression suites now execute the production lifecycle/admission functions and assert the UI category labels. GitHub Actions run `40120880672` passed: engineering audit, strategy core, SMC detectors, strategy discovery, research backtest, timeframe/candle tests, production lifecycle tests, and rolling proxy backtest.
- Pages deployment for the same source revision was still running when this record was prepared; confirm its result before claiming the revision is live.
- Known limitation: source-level tests and GitHub Actions do not replace a real-device browser acceptance test. The strategy remains provisional and not profitability-validated.

## Open work, in priority order

1. Verify the live UI on the deployed site: Untriggered, Active and Missed must be separate, and performance must separate successful, unsuccessful and missed signals. Confirm that pending signals show no TP/SL progress.
2. Add lifecycle regression tests for entry-triggered transitions, expiry, invalidation, TP/SL resolution, duplicate prevention, and ambiguous same-candle TP/SL outcomes.
3. Expand deterministic historical validation and no-lookahead checks. Record dataset coverage, data gaps, assumptions, and sample size.
4. Keep the strategy lab hidden from normal signal panes and show research findings only in a separate report. Experimental candidates must not silently become live signals.
5. Design a free-first cloud scan prototype using GitHub Actions for scheduled runs. Explain the limitations before claiming continuous scanning: GitHub Actions is not a 24/7 worker and GitHub Pages stops executing app JavaScript when the browser is closed.
6. Consider a persistent database and notifications only if a genuinely free and sustainable option is confirmed. No paid hosting is to be added without explicit approval.

## Definition of done for a feature

- Requirement and intended behaviour are written down.
- Code change is committed with a clear message.
- Relevant automated tests pass.
- Deployment workflow succeeds where deployment is affected.
- Live behaviour is checked separately when possible.
- Any failed check or unverified area remains visible in this record; it is not silently described as complete.

### 2026-10-27 — Default QQQUSDT proxy wiring and health-check follow-up

- Root cause found during the live-feed audit: the deployed Cloudflare Worker returned a valid QQQUSDT ticker when tested directly, but the app's `DEFAULT_QQQ_PROXY` was empty. Unless a user manually entered the Worker URL in Settings, the app attempted direct exchange requests first and could remain blocked by browser CORS or regional restrictions.
- Change: the app now defaults to `https://apa-smc-qqqusdt-proxy.saviourmustapha123.workers.dev`. Existing saved blank proxy values also fall back to this default. The provider remains configurable and HTTP/data checks still determine whether the feed is usable.
- Regression coverage: added assertions that the app uses the deployed Worker by default and that saved blank settings fall back to it. Updated the source-contract test to validate the intended configured default rather than the previous empty-default assumption.
- Deployment status: Pages and Worker deployments had succeeded for the preceding revision. The user supplied a valid JSON ticker response (`QQQUSDT`, price `715.06`), confirming that exact ticker endpoint responded successfully at that time.
- Outstanding verification: a GitHub Actions health run at 01:33 UTC still received HTTP 502 from both proxy ticker paths. That run preceded the user's later successful ticker response and does not yet prove the current app can load candles through the Worker. Recheck the newest post-change health run and production scanner report before calling the feed integration verified.
- Strategy status remains provisional. Passing detector/lifecycle tests and a successful ticker response do not establish profitability or full reproduction of proprietary APA rules.

### 2026-10-27 — QQQUSDT route and deployment follow-up

- Set Binance USDⓈ-M as the default QQQUSDT venue because the user confirmed the Binance-format ticker endpoint returned a valid quote. Existing saved default-Bybit settings migrate to Binance; Bybit remains selectable as an alternate.
- Updated health checks to test the app's default Binance route first. The CI runner is receiving HTTP 451 from Binance and HTTP 403 from Bybit; the Cloudflare Worker reports upstream HTTP 403 from both providers when invoked from that runner. These are location-dependent blocks, not proof that the user's Nigeria-region browser is blocked. Health output now reports this as an explicit warning rather than a false global failure, while still requiring target-region ticker and candle verification before claiming the feed is healthy.
- Updated the Worker to retry its official exchange-host rotation once after transient errors and removed invalid spot API hosts from the Binance futures fallback list. Cloudflare deployment succeeded with Worker version `ba2ce679-80dc-410c-baa8-4bb9748d7377`.
- Bumped app release metadata and offline shell version so installed app clients can detect and fetch the updated app.
- Regression tests are being rerun after each change. The strategy remains provisional; the latest simulated paper ledger showed 0 wins from 12 resolved outcomes (-12R before costs), so it is not appropriate to describe the current signals as profitable or live-validated. The historical replay is a narrow FVG-backed pending-OB test, not validation of every strategy family.
