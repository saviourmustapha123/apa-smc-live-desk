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
