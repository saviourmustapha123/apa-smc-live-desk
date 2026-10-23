# APA · SMC Live Desk

**Live site:** https://saviourmustapha123.github.io/apa-smc-live-desk/

A mobile-friendly, single-page market-analysis desk for EUR/USD and BTC/USD. It uses the public Biquote market-data API and TradingView Lightweight Charts.

## What it currently does

- Requests public quotes and OHLC candles for EUR/USD and BTC/USD.
- Displays provisional market-structure and Smart Money Concepts (SMC) annotations, including QML candidates, order-block candidates, liquidity sweeps, inducement proxies, BOS/CHoCH proxies, FVG, and SBR/RBS retests.
- Rejects candidate targets below a 1:3 reward-to-risk ratio.
- Tracks candidate outcomes locally in the browser while the page is open.
- Caches candles in IndexedDB and settings/journal in local browser storage.

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
