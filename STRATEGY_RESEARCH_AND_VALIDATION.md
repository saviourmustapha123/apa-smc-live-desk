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
