# Changelog

## 2026-10-23 — v0.4.0 (audit-driven patch)

- Added an explicit app/detector version marker in the UI.
- Corrected swing-pivot tie handling to match the audit's deterministic rule: the earlier of equal highs/lows can qualify; a later equal pivot does not replace it.
- Added `known_at` to confirmed pivot records, pointing to the right-side confirmation candle. This makes the confirmation time available to analysis consumers and supports look-ahead audits.
- Preserved the minimum planned reward-to-risk gate of 1:3 and the existing daily six-signal target display. The app must not manufacture setups to satisfy a daily count.

## Still outstanding from the framework

This is a first corrective patch, not completion of the entire 14-page framework. The following still require implementation and verification in ordered milestones:

1. UTC/feed normalization, closed-candle enforcement across every strategy path, duplicate/gap detection, and provider self-test.
2. Audit every detector for `known_at` propagation and no-look-ahead use; add fixtures for structure, sweeps, FVG/iFVG, OB/breaker, premium/discount, QML, SBR/RBS, and inducement.
3. One shared candle-based outcome resolver for live monitoring and replay, including gap handling, stop-first same-bar ambiguity, timeout, costs in R, and recompute-from-candles.
4. Cost-aware event-driven backtest, bootstrap confidence intervals, at least four walk-forward folds, untouched holdout, parameter-robustness grid, trial log, and promotion gate.
5. Full risk sizing with instrument/broker contract metadata; exports/imports; dependency integrity, provider error classification, mobile/accessibility checks.

## Verification status

- Repository file update: committed.
- Browser smoke test and real-feed self-test: not run in this environment.
- Backtest validation: NOT VALIDATED. No profitability claim is made.
