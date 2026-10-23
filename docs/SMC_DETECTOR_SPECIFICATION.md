# SMC Detector Specification and Source Audit

Updated: 2026-10-23

## Purpose and status

This document records explicit, reproducible **SMC-style conventions** implemented in `scripts/smc-detectors.mjs` for unit testing and future integration. They are not universal definitions, do not prove institutional order flow, and are **not the proprietary LOWKEY FX APA method**. The new module is not yet connected to the live browser signal generator. The live desk must continue to label its current signals provisional until the integration and end-to-end tests are complete.

## Primary and reputable research references

1. **LOWKEY FX, official APA overview**: https://lowkeyfx.com/apa-strategy  
   Primary source for what LOWKEY FX publicly says about APA: raw price action, fake versus meaningful structure and dual-timeframe analysis. It does not disclose enough mechanical rules to reproduce the full method. We must not fabricate the missing rules.

2. **TradingView Support, Gaps**: https://www.tradingview.com/support/solutions/43000675999-gaps/  
   A platform's technical explanation of gap detection and mitigation. Classic exchange gaps are not identical to the three-candle FVG convention commonly used in ICT/SMC; the app should name the exact convention it uses.

3. **TradingView Support, chart-pattern validation**: https://www.tradingview.com/support/solutions/43000759289-how-to-read-chart-patterns/  
   Explains that patterns alone do not predict outcomes and need context and confirmation. It is useful for avoiding claims that a detected shape is automatically a trade.

4. **QuantStart, building a backtester**: https://www.quantstart.com/articles/Should-You-Build-Your-Own-Backtester/  
   Details look-ahead bias, market-regime change, transaction costs and unrealistic fills. Use these as mandatory backtest design checks.

5. **QuantStart, backtesting biases**: https://www.quantstart.com/articles/Successful-Backtesting-of-Algorithmic-Trading-Strategies-Part-I/  
   Discusses optimisation bias, look-ahead bias and overfitting. Results should be chronological and include out-of-sample validation.

6. **TradingView public open-source SMC indicator example**: https://www.tradingview.com/script/YmAeBTG0-Simple-ICT-Order-Blocks-and-Fair-Value-Gaps-by-Gowtham-Kannakaje/  
   A community implementation can be used to compare conventions, not as proof of effectiveness. Verify the actual source license and reuse rules before copying code. Public visibility is not permission to copy.

## Explicit detector conventions in the research module

### Data validation
Every candle must have finite OHLC values, coherent high/low geometry, and increasing timestamps when timestamps are supplied. Invalid data returns no detections rather than guessing.

### Swing highs and lows
A pivot with strength `k` must be more extreme than the `k` bars on each side. It is not considered known until the right-side bars have closed. This delay is intentional and prevents the current signal from pretending it knew a pivot before confirmation.

### BOS and CHoCH
A structural break requires a candle **close** beyond the latest swing level that was already confirmed before the break candle. The first break establishes a directional state and is labelled BOS by this convention; a break opposite the established state is labelled CHoCH; a break in the same direction is BOS. This is a testable baseline, not a universal definition. Internal versus swing structure and protected highs/lows are not yet separated.

### Liquidity sweep
The candle's wick must exceed a previously confirmed swing high/low and the same candle must close back inside the level. A wick through the level without reclaim is not labelled a sweep. Equal highs/lows and session liquidity pools are not yet modelled.

### Fair Value Gap
A bullish FVG is defined as current candle low greater than the high two bars earlier; bearish is current candle high less than the low two bars earlier. The gap is reported as mitigated if any later candle overlaps its price range. This baseline does not yet distinguish partial fill, full fill, displacement qualification or close-through invalidation.

### Order-block candidate
A candidate requires a three-candle FVG, a preceding impulse body meeting a configurable average-range threshold, and an opposing candle near the impulse. It is explicitly a **candidate**, not proof of institutional orders. Zone selection, BOS relationship, premium/discount, mitigation policy and breaker conversion require further refinement and annotated examples.

### Not implemented in this module yet
- Equal highs/lows and session-specific liquidity pools.
- Internal versus swing structure, protected highs/lows and configurable BOS/CHoCH definitions.
- Full/partial FVG mitigation, inverse FVG and invalidation conventions.
- Breaker blocks, mitigation blocks, inducement, QML, SBR/RBS, trendlines and premium/discount.
- Multi-timeframe confluence rules.
- Full APA logic and exact entry/management rules.

## Required next steps before integration

1. Review every detector against manually annotated examples from reputable primary material and the user's authorised APA notes.
2. Add positive, negative, edge, invalid-data and no-look-ahead tests per detector.
3. Integrate the module into the live app only after parity tests against the intended rules. Keep the existing live scanner visibly marked provisional until then.
4. Backtest in chronological order with next-bar execution, spread, fees, slippage, entry delay, gaps, and conservative handling when SL and TP occur in the same candle.
5. Require at least 12 months of usable data per pair/timeframe where available, disclose missing bars, and report out-of-sample expectancy, win rate, profit factor, drawdown, trade count and R distribution. Do not claim profitability from unit tests.
6. Keep the 1:3 minimum R:R as an eligibility filter, not a success guarantee. No maximum R:R cap is added.
7. Do not enable automatic order execution.

## Test command

```sh
node --test scripts/smc-detectors.test.mjs
```
