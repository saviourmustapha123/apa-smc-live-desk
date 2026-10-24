# Changelog

## 2026-10-24 — v0.4.1 (QQQUSDT provider recovery)

- Added Bybit V5 public market-data support for QQQUSDT as an alternative to the existing Binance USDⓈ-M Futures adapter.
- Added a Settings selector so the user can choose a venue and test its quote/candle endpoints.
- Added separate IndexedDB candle namespaces per QQQUSDT venue to prevent mixing bars from different exchanges.
- Updated the chart label to identify the selected venue and clarify that QQQUSDT is an ETF-linked perpetual, not QQQ ETF shares.
- Extended the background health check to probe Bybit QQQUSDT quotes and 1m/1h/8h/12h candles, while treating region restrictions from CI as a warning.
- This is a provider-recovery improvement, not proof of a working feed in every browser/network. Run Settings → Test feed on the live site and inspect the latest Actions run before relying on it.

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

- Repository file updates: committed, including regression tests for deterministic equal-pivot ties, forward-horizon boundaries, gap-through-stop precedence, and invalid minimum-RR input.
- The repository's push-triggered GitHub Actions workflow runs the strategy-core, SMC detector, discovery, research-backtest, and app refresh test suites. The result of the latest run has not yet been independently confirmed here.
- Browser smoke test and real-feed self-test: not run in this environment.
- Backtest validation: NOT VALIDATED. No profitability claim is made.
