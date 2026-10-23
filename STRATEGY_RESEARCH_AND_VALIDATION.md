# APA · SMC Live Desk — Research and Validation Register

Last updated: 2026-10-23

## Objective

Build a local-first, phone-friendly analysis desk that computes context across timeframes automatically. It must not require a trader to manually scroll through every chart to understand the larger market. It remains a decision-support tool, not a promise of certainty or a broker execution system.

## Current implementation status

### Committed in the live desk

- Automatic top-down context panel for Monthly, Weekly, Daily, 4H, 1H, 15M and 5M.
- Independent timeframe candle requests, with IndexedDB cache fallback if a request fails.
- Calendar aggregation of daily bars into monthly and weekly bars.
- Simple, explicitly heuristic market-structure summaries.
- Approximate OHLCV volume-by-price POC and last-bar relative-volume context.
- One-click context refresh and five-minute automatic refresh cadence.
- JavaScript syntax checked after commit.

### Not yet proven

- Live deployment and browser rendering have not been independently verified from this environment.
- The configured data provider has not been verified end-to-end for freshness, correct symbol definitions, spread, historical depth, volume semantics or rate limits.
- Multi-timeframe summaries are context indicators, not the completed APA or SMC engines.
- The current POC display is an approximation based on candle typical price and whole-candle volume. It is not a true volume-at-price profile and must not be described as one.
- A 12-month historical test has not yet been completed. A history request is not proof that a full year was returned.
- No strategy profitability or win-rate claim has been established.

## Public research sources

1. **LOWKEY FX official APA overview** — https://lowkeyfx.com/apa-strategy  
   The public overview describes low-risk/high-reward intent, raw price action, distinguishing false from meaningful structure, and dual-timeframe analysis. The public summary is not enough to reproduce all proprietary entry, invalidation and management rules exactly. We must not invent missing rules and label them as official APA.

2. **LOWKEY FX official YouTube channel** — https://www.youtube.com/@lowkeyfxstrategy  
   Primary source to catalogue publicly accessible lessons and demonstrations. Videos should be analysed for explicit, repeatable rules, not merely promotional claims or winning screenshots.

3. **Open-source SMC indicator (MIT)** — https://github.com/quantumalgo-official/smart-money-concepts-indicator  
   Public reference implementation for structure, order blocks, FVGs and liquidity. Its code may be studied and reused only within its license terms, with required attribution and license preservation. Its existence does not validate profitability.

4. **SMC Pine Suite toolkit** — https://github.com/btankutt/smc-pine-suite  
   Public reference for configurable structure, order blocks, ATR-scaled FVG filters, liquidity and confirmed-bar gating. Verify the current license and each file's terms before copying or adapting code.

5. **TradingView Volume Profile guide** — https://www.tradingview.com/support/solutions/43000502040-volume-profile-indicators-basic-concepts/  
   Defines POC, value area, VAH/VAL, and notes that forex and some CFD volume may be tick volume. A genuine profile needs a defensible allocation of volume across price levels; assigning all candle volume to its typical price is only a proxy.

6. **TradingView backtesting and forward-testing guide** — https://www.tradingview.com/support/solutions/43000562362-what-are-strategies-backtesting-and-forward-testing/  
   Distinguishes historical simulation from forward testing. The desk needs both, with recorded assumptions and trade lists.

7. **TradingView look-ahead bias warning** — https://www.tradingview.com/support/solutions/43000614705-strategy-produces-unrealistically-good-results-by-peeking-into-the-future/  
   Signals must use only information available at the decision time. Pivots that require right-side candles cannot be treated as known before those candles close.

## Research policy

- Prioritize primary materials from LOWKEY FX for APA, official platform/data documentation, open-source code with clear licenses, and independently reproducible examples.
- Use YouTube, TikTok, Instagram, Telegram and other social sources as discovery sources, not as automatic proof. Capture the exact public URL, creator, publication date where available, rule stated, example timestamp, and whether an independent test supports it.
- Do not access private groups, paid course material, or restricted content without authorized access. Do not bypass paywalls or copy code where the license forbids derivative use.
- Separate a source's claim from verified evidence. A stated 90%/95% accuracy or a screenshot of a winning trade is not validation.
- Treat concepts such as BOS, CHoCH, inducement, OB, breaker, FVG/iFVG, SBR/RBS, QML, head-and-shoulders, liquidity sweep, premium/discount and volume confluence as distinct detectors with explicit definitions, not interchangeable labels.
- Keep APA and SMC as separate engines. The confluence layer should report agreement, disagreement and missing data without silently merging the definitions.

## Volume and auction-analysis roadmap

1. Confirm what volume the feed actually supplies for each instrument.
2. Implement relative volume and volume-spike tests only when the source's volume semantics are known.
3. Build a price-bin profile from lower-timeframe OHLCV bars where available, with an explicit approximation label where true trade-at-price data is unavailable.
4. Calculate POC and 70% value area using a documented, deterministic algorithm; expose VAH/VAL and profile period.
5. Consider session profiles, anchored profiles, high/low-volume nodes and volume-weighted confirmation only after data quality is established.
6. Do not label candle direction as actual buyer-initiated or seller-initiated order flow unless the data source supplies aggressor-side trades.

## Validation gates before calling a strategy complete

- Written rule specification for every detector, with source and version.
- Unit tests for each detector, including positive, negative, boundary and invalid-data cases.
- Confirmed-candle and no-lookahead tests.
- At least 12 months of usable history per instrument/timeframe where the provider supplies it; report missing periods and candle counts.
- Chronological backtest with realistic spread, commission, slippage, entry delay, gap-through-stop and ambiguous same-candle stop/target handling.
- Out-of-sample and walk-forward results, plus expectancy, win rate, profit factor, drawdown, losing streak, number of trades and R distribution.
- Forward/paper testing with every mismatch recorded.
- A failed gate must remain visibly failed. Do not promote a heuristic to a verified signal because the chart drawing looks convincing.

## Next engineering steps

1. Test the top-down panel in Android Chrome and verify that all timeframe requests return correctly.
2. Add robust data-freshness, source-volume and coverage indicators.
3. Separate pure SMC detection, APA detection, confluence scoring, risk sizing and lifecycle simulation into testable modules.
4. Add a historical replay/backtest harness that processes candles in chronological order.
5. Add test fixtures and expected outputs for annotated chart examples.
6. Replace approximate volume-profile mapping with lower-timeframe price-bin allocation, and show a clear warning when only tick volume or insufficient bars are available.
7. Do not enable any automated order execution; this project remains analysis and manual review only.


## Additional public research leads reviewed (2026-10-23)

8. **Quasimodo (QML) pattern description on TradingView** — https://www.tradingview.com/script/HuBqQBr5-QM-Signal-TradingFinder-Quasimodo-Pattern-Head-and-Shoulders/  
   Describes the sequence of a head extending beyond a prior swing, a break of the intervening structure, and a return toward the left-shoulder area. Entry and stop conventions vary by author. Implement the chosen sequence explicitly and compare against annotated examples rather than treating all five-pivot shapes as equivalent.

9. **Open-source Quasimodo indicator** — https://www.tradingview.com/script/SQRSlcup/  
   Public source reference for pattern geometry. Review TradingView House Rules and license conditions before reusing any code; public visibility alone does not grant unrestricted redistribution.

10. **Alchemist SNR / role-reversal research lead** — https://in.tradingview.com/script/ANCSINu0-Wonra-Alchemist-SNR-Engine/  
    Public indicator description discusses support/resistance role reversal, QML and higher-timeframe storyline. Treat it as one author's implementation, not a universal definition of APA or SMC.

11. **Alchemist strategy overview / lesson summary** — https://glasp.co/youtube/uV5EaTertic  
    A public summary of a video describes session ranges, liquidity runs and higher-timeframe points of interest. Verify the original video and exact timestamps before adopting a rule.

12. **Inducement concept and failure cases** — https://therighttrader.com/learn/smart-money-concepts/inducement  
    Provides a useful distinction between a minor swing before a larger liquidity pool and an actual confirmed sweep/reclaim. It also discusses the failure case where price continues through the minor swing. These remain interpretations of price, not evidence of a specific institution's intent.

## Current chart colour contract

- BUY setup and its entry visual: green (#35d39a).
- SELL setup and its entry visual: red/pink (#ff657a).
- Take-profit zone remains green; stop/risk zone remains red/pink.
- Other annotations use distinct semantic colours: head-and-shoulders magenta, QML cyan, SBR orange, RBS yellow, inducement lime, FVG teal, iFVG purple, breaker blocks indigo, BOS blue, CHoCH pink, rejection orange, engulfing pink, and separate trendline colours.
- A colour identifies a visual category only. It does not indicate a setup's quality or validation status.

## Risk/reward eligibility rule

The candidate generator and journal must enforce a hard minimum reward-to-risk of 1:3. A setup with a structurally calculated target below 3R is rejected rather than displayed as an eligible signal. This is a selection filter, not evidence that a 3R target will be reached. Backtests must report the resulting trade frequency, win rate, expectancy and drawdown, including the effects of costs and missed entries.


## Engineering progress update (2026-10-23, automated validation added)

### Added to the repository
- `scripts/strategy-core.mjs` isolates the historical proxy's pivot, ATR, minimum reward/risk, signal-candidate and outcome-simulation functions so they can be tested independently.
- `scripts/strategy-core.test.mjs` includes eight unit tests for confirmed swing pivots, right-edge/no-confirmation behaviour, ATR input sufficiency, the 1:3 threshold, target wins, stop losses, same-candle ambiguity and unresolved outcomes.
- `scripts/background-health-check.mjs` checks the published page, source JavaScript syntax, selected security/risk safeguards, quote response shape and 5-minute OHLC candle quality.
- `scripts/proxy-backtest.mjs` runs the current heuristic proxy on EURUSD and BTCUSD at 5M and 15M, using up to 1,000 returned bars per combination.
- `.github/workflows/background-health-check.yml` now runs on pushes to `main`, can be started manually, and is scheduled every 15 minutes.

### What these additions do not establish
- Unit tests of the proxy are not validation of the browser application's full signal engine or the proprietary LOWKEY FX APA method.
- Up to 1,000 five-minute bars covers only a few days, not 12 months. The new backtest does **not** satisfy the 12-month validation gate.
- The proxy backtest does not yet model spread, commission, slippage, delayed entries, gap-through-stop, out-of-sample selection, walk-forward optimization or broker execution.
- The background workflow has been triggered by a repository push. Its first completed result must be reviewed before reporting live data or test success.
- No automatic signal publication or broker order execution has been enabled. Signal publication remains a separate, unimplemented feature; the desk is for manual analysis and review.
- Direct browser testing on Android Chrome and full visual verification of chart overlays remain outstanding.

### Next gates
1. Review the first completed GitHub Actions run and fix any failing health, data or unit checks.
2. Verify actual data source, timestamp freshness, instrument definitions, candle continuity and available history for every supported timeframe.
3. Add annotated positive, negative and boundary fixtures for the browser's actual detectors; avoid tests that merely repeat the expected result in a duplicate implementation.
4. Separate APA and SMC rules into documented engines only where the APA source rules can be established. Do not invent proprietary rules.
5. Extend chronological replay to sufficient history, add execution-cost assumptions and out-of-sample metrics, then begin forward paper tracking.
6. Validate the deployed chart and all bounded annotations on Android Chrome before describing them as visually verified.

## Engineering progress update (2026-10-23, data semantics and backtest safeguards)

### Fixed in this pass
- Forex candle normalization now prefers a positive tick-volume field over a zero-valued generic volume field. Volume source semantics are carried on normalized bars when available.
- The approximate price-bin profile no longer assigns each candle's entire volume to a single typical-price bin. It spreads volume uniformly across bins crossed by the candle's high-low range, reports an approximate POC and 70% value area, and returns an unavailable message when no usable volume exists. This remains an OHLC-range approximation, not actual traded volume-at-price.
- Quote freshness now fails closed if neither a usable age nor a parseable timestamp is available. Quotes older than five minutes, marked stale, or reported closed do not update the synthetic live candle. The header also shows spread when both bid and ask are available.
- The proxy backtest now models entry at the next candle open rather than assuming entry at the signal candle close. It skips entries when the next open invalidates the stop or no longer permits at least 3R, conservatively treats same-candle stop/target ambiguity as a stop, and marks gap-through-stop losses at the next open.
- Backtest output now includes history span, an explicit one-year coverage gate, skipped entries, expectancy, profit factor, event-sequence drawdown, losing streak and large timestamp gaps. These are gross proxy statistics; the script explicitly states that it does not model historical spread, commissions, slippage, latency, financing or a portfolio with overlapping positions.
- The 15-minute scheduled workflow now runs lightweight health checks only. Unit tests and the proxy backtest still run on pushes and manual workflow dispatch, reducing unnecessary repeated historical API calls.

### Validation still required
- CI passing does not prove the chart has been visually verified on Android Chrome. This still needs a real-device check for 1M/monthly aggregation, chart alignment, overlay clipping, touch controls and provider/library failures.
- The data provider's historical depth, symbol definitions, spread history, market sessions and volume source need independently verified records. The one-year gate must be passed by returned timestamps and coverage, not by request success.
- The proxy engine remains a simplified heuristic and does not implement the complete APA/SMC detector catalogue. No strategy profitability or signal accuracy claim is established.
- The app's browser journal and settings are local browser storage, not encrypted-at-rest storage. Do not save secrets or broker credentials in the public website or its local journal.
- No automated order placement or signal publication has been enabled. Candidate signals remain provisional/manual-review only.

- A separate `.github/workflows/strategy-validation.yml` now runs the ten unit tests and rolling proxy backtest daily at 02:17 UTC, with manual dispatch available. The 15-minute workflow remains a lightweight feed/site health check. The current provider response still supplies only about 1–2 days for the tested intraday intervals, so the one-year gate remains failed.
- The live journal now records the observed quote as the stop exit price when price gaps through a running stop, rather than falsely assuming every stop fills exactly at its stop level. Weekly top-down aggregation preserves open-candle state so an unfinished week is excluded from closed-bar context. Browser zoom is no longer disabled by the viewport declaration.
