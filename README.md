# APA · SMC Live Desk

**Live site:** https://saviourmustapha123.github.io/apa-smc-live-desk/

A mobile-friendly, single-page market-analysis desk for EUR/USD and BTC/USD. It uses the public Biquote market-data API and TradingView Lightweight Charts.

## What it currently does

- Requests public quotes and OHLC candles for EUR/USD and BTC/USD.
- Displays provisional market-structure and Smart Money Concepts (SMC) annotations, including QML candidates, order-block candidates, liquidity sweeps, inducement proxies, BOS/CHoCH proxies, FVG, and SBR/RBS retests.
- Rejects candidate targets below a 1:3 reward-to-risk ratio.
- Tracks candidate outcomes locally in the browser while the page is open.
- Caches candles in IndexedDB and settings/journal in local browser storage.


## QQQUSDT market-data providers

QQQUSDT is an ETF-linked perpetual contract, not QQQ ETF shares. The chart now supports two venue-specific public market-data adapters:

- **Bybit linear perpetual (default alternate):** public V5 ticker and kline endpoints, including 1m, 5m, 15m, 1h, 4h, 8h, 12h and daily candles.
- **Binance USDⓈ-M Futures:** public futures ticker and kline endpoints, with the existing optional proxy setting available for networks where direct access is permitted but browser access needs a relay.

Choose the provider in **Settings → QQQUSDT market-data venue**, then use **Test feed**. The app stores QQQUSDT candles in separate provider-specific local caches so candles from different exchanges are not merged. Prices, wicks, volume, spreads and signal outcomes can differ by venue; inspect signals against the same venue you intend to use. Public endpoint availability still depends on network and regional access. If both providers fail, the app should report the feed failure rather than imply that live data is running.

## Important limits

- The rule engine is a transparent **heuristic proxy**. It is not a verified reproduction of the full LOWKEY FX A.P.A. method, and a chart label is not proof of institutional activity.
- Signals and journal entries are local to the browser/device. There is currently no public signal feed, account system, or broker connection.
- No orders are executed. Do not treat a candidate as a trade instruction without independent review.
- Forex feeds may be stale or closed outside market hours. Always check quote freshness and data quality.
- Browser storage is not encrypted. Do not put passwords, broker credentials, API secrets, or private personal information in the app.

## Background automation

GitHub Actions runs `scripts/background-health-check.mjs` and `scripts/proxy-backtest.mjs` on a 15-minute schedule, and can also be started manually.

The checks cover:
- GitHub Pages reachability and expected app content.
- Biquote quote endpoints and OHLC data shape for EUR/USD and BTC/USD.
- Inline JavaScript syntax, the 1:3 minimum-ratio guard, API allowlisting, CSP presence, and dynamic-content escaping.
- A rolling historical proxy backtest over up to 1,000 closed bars for each of EUR/USD and BTC/USD on 5m and 15m intervals.

The backtest uses only closed candles and only future bars to resolve each candidate. If a single future candle touches both stop and target, it assumes the stop was hit first. It does not include spread, commission, slippage, or broker execution, and it is **not** a profitability guarantee or a validation of the full proprietary APA strategy. Reports are written to the GitHub Actions run summary.

To inspect or run the checks:
1. Open the repository's **Actions** tab.
2. Select **APA SMC background health check**.
3. Open a completed run to read the health-check and backtest summaries, or choose **Run workflow** to start a manual run.

## Security

See [SECURITY.md](SECURITY.md). Keep the repository public while using GitHub Pages on the current free setup; making the repository private may unpublish the site. Review GitHub account email privacy, enable two-factor authentication or a passkey, and never commit secrets.


## Strategy rule registry

The revised, source-aware rule baseline is documented in [`docs/STRATEGY_RULE_REGISTRY_REVISION_2.md`](docs/STRATEGY_RULE_REGISTRY_REVISION_2.md). It records the latest inducement, order-block, breaker-block and QML corrections; the other SMC/APA/Alchemist variables; required detector states; and the distinction between rule definitions, implementation verification and performance validation. This is a specification baseline, not evidence that all rules have been implemented or that the strategy is profitable.
