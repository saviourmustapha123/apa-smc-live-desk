# Uploaded-book strategy learning and validation

## Purpose

This repository must convert the uploaded books into traceable, testable strategy rules. It must not treat a concept label or chart annotation as proof that a complete entry method exists.

## Source documents in scope

- `930067889-Advanced-Price-Action-Lowkey-forex-trader.pdf` — LowKey Advanced Price Action.
- `994417437-Alchemist-Concepts-in-Forex-Trading-Msnr-Overview.pdf` — Alchemist MSNR overview.

The source-grounded rule registry is `scripts/book-strategy-registry.mjs`. Each rule has a stable ID, source reference, extraction evidence level, required conditions, and independent implementation, test, and historical-validation statuses.

## Required learning-to-production pipeline

1. **Extract:** record the book's wording and diagram evidence, including page/section and any ambiguity.
2. **Formalize:** convert only source-supported rules into deterministic predicates. Preserve source terminology; do not silently substitute generic SMC definitions.
3. **Resolve ambiguity:** if a diagram is needed to define a swing sequence, price tolerance, session timezone, or calculation, mark the rule blocked pending explicit transcription rather than guessing.
4. **Implement:** write a detector/module for the formalized rule and connect it to the production scanner through an explicit strategy adapter.
5. **Unit test:** create positive, negative, boundary, and no-lookahead candle fixtures for every detector.
6. **Parity test:** verify the chart annotation, scanner result, signal explanation, and journal refer to the same detected event.
7. **Replay:** use closed candles and only information known at the decision time; model later entry touches, stop/target ordering, gaps, expiry, and costs.
8. **Evaluate:** report exact-market versus proxy coverage, trade count, win rate, expectancy, profit factor, drawdown, total R, and performance by setup/timeframe/session. Do not call a strategy validated based on a tiny sample.
9. **Promote:** a rule may be marked implemented only after its tests pass; mark it historically validated only after adequate, cost-aware out-of-sample evidence. Never promote statuses from code presence alone.

## Mandatory system constraints

- Minimum planned reward-to-risk is 1:3. Calculate it from entry, stop, and target prices; do not trust a displayed RR field by itself.
- Do not emit a trade when stop/target are missing, risk is zero, or calculated RR is below 3.
- Do not use future candles to confirm a signal before those candles close.
- Pending, active, missed, invalidated, successful, and unsuccessful states remain distinct.
- Do not fabricate signals to satisfy a daily count target.
- Paper testing and research replay must never submit broker orders.
- Keep a human-readable reason trail for each signal: source rule IDs, observed evidence, timeframe, decision candle, entry, stop, target, RR, and any missing confirmations.

## Current status of this foundation

The first implementation adds a machine-readable registry and a deterministic minimum-RR gate, plus tests and a pull-request CI step. This is the foundation for the learning pipeline, **not proof that these book methods have been fully implemented in the production scanner**. Registry rules deliberately start as `not-verified`, `not-tested`, and `not-tested` for implementation, unit tests, and historical validation. Those statuses must be updated only as each rule passes the gates above.
