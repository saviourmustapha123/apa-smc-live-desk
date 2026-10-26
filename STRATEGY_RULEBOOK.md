# APA · SMC Live Desk — Strategy Rulebook

**Release:** 2026-10-26  
**Scope:** Rule specification for chart annotations and manual-execution signal candidates. The app is a heuristic research tool; a plotted label is not proof of institutional activity or a profitable edge.

## Core engine contract

Keep these states distinct:

1. **Detected:** a pattern/level is visible in confirmed OHLC candles.
2. **Qualified:** the pattern passes its formation, direction, invalidation, and confluence rules.
3. **Entry candidate:** price reaches a qualified point of interest and the entry trigger is confirmed.
4. **Not triggered:** a valid entry plan exists, but its entry price has not traded.
5. **Active:** the entry price has traded; only now may live TP/SL progress be shown.
6. **Closed:** TP, SL, invalidation, expiry, or another explicit terminal condition occurred.

A zone by itself is never a market-entry signal. The engine must preserve the reason for acceptance/rejection and must not invent a trade when data is stale, candles are insufficient, the market is closed, or structural risk is invalid.

## Structure and liquidity

- **Swing high/low:** use confirmed pivots only. A pivot must not be treated as known before its right-side confirmation candles have closed.
- **BOS:** a candle close beyond a confirmed relevant swing in the direction of the current structure. A wick through a level alone is not a BOS.
- **CHoCH / MSS:** a confirmed close through the relevant protected swing against the prior structural direction. Treat it as a possible transition, not a standalone entry.
- **Displacement:** directional candle/body expansion against the configured ATR threshold, ideally associated with a structural break. Do not equate every large candle with displacement that confirms a setup.
- **Buy-side / sell-side liquidity:** potential pools around confirmed highs/lows and equal highs/lows. They are inferred from price structure; the chart cannot see actual resting orders.
- **Liquidity sweep:** price trades through a relevant pool and closes back through/inside the level. A clean close beyond a level may instead be a breakout; do not automatically call it a sweep.
- **Equal highs/lows:** tolerance-based clusters, not exact-price requirements. Mark as potential liquidity, not an entry by themselves.
- **Premium / discount:** location within a defined dealing range. Context only; it does not generate a trade by itself.

## Inducement (IDM)

- Map a plausible internal pullback high/low in relation to a previously confirmed structural break and relevant external swing/liquidity.
- Keep a candidate separate from a swept/confirmed event. A wick/close sequence must actually take the mapped level; do not label every minor swing as inducement.
- Where an entry model specifically requires inducement, require the sweep/reclaim to agree with the model's direction and occur in the correct sequence relative to BOS and the point of interest.
- Inducement may coexist with QML or another entry model, but QML is not required for every inducement setup and inducement is not automatically a valid OB.
- Do not claim intent or deliberate manipulation from OHLC candles alone.

## Order Block (OB)

**Project-specific hard rule:** an OB is not qualified unless the directional impulse that defines it also leaves an associated three-candle FVG.

For a bullish OB, locate the last bearish candle (or defined opposing candle cluster) before the bullish impulse; for a bearish OB, the last bullish candle before the bearish impulse. The impulse must show the configured displacement and a close-confirmed structure break. Keep the zone tied to that originating candle and impulse.

- Draw unqualified candidates differently from qualified OBs; do not present a candidate as confirmed.
- Track fresh, tested/mitigated, invalidated, and expired states separately.
- Invalidate a bullish OB on a decisive close through its distal low; invalidate a bearish OB on a decisive close through its distal high, according to this desk's configured rule.
- If price has already mitigated the zone, do not issue a fresh first-retest pending signal from it.
- A valid OB does not have to be called an inducement. If an inducement model is present, show the relationship rather than merging the labels.

## Fair Value Gap (FVG) and inverse FVG (iFVG)

- Bullish FVG: candle 3 low is above candle 1 high; the gap is between those prices.
- Bearish FVG: candle 3 high is below candle 1 low; the gap is between those prices.
- A gap is a location/imbalance, not an entry by itself. Track whether it is open, mitigated, or invalidated.
- **iFVG:** a previously formed FVG is decisively broken and then acts in the opposite role. Do not label an ordinary FVG retest as an iFVG.
- When the project-specific OB rule is applied, the FVG must be associated with the same impulse that qualifies the OB; an unrelated gap elsewhere does not qualify it.

## Breaker Block

A breaker is not just an OB that price crossed.

1. Start with an FVG-backed, qualified OB.
2. Price invalidates that OB.
3. The relevant liquidity/failed-zone context is present.
4. Price produces a confirmed structural break/displacement in the opposite direction.
5. Price returns to the failed zone and rejects it from the opposite side.

Only then draw and label a breaker. Preserve the original zone bounds and mark the failure, opposite shift, and retest so it is visually distinguishable from a live OB.

## QML (Quasimodo)

- QML is a dedicated reversal model, not a generic label for every head-and-shoulders-like shape.
- Require the relevant prior trend, alternating swing sequence, sweep/overshoot of the key swing, structural break of the intervening/protected leg, and return/rejection at the defined QML level.
- Distinguish **pattern/shift identified** from **retest confirmed**. Invalidation beyond the model's defining extreme cancels the setup.
- QML may occur with inducement; neither should be fabricated when absent. Do not require QML for ordinary continuation or other valid entry models.
- Do not add a separate generic Head-and-Shoulders signal.

## SBR / RBS, rejection, engulfing, trendlines

- **SBR:** support breaks by close, then price returns from below and rejects the former support as resistance.
- **RBS:** resistance breaks by close, then price returns from above and rejects the former resistance as support.
- **Rejection:** wick/close behaviour at a meaningful pre-identified zone; a candle shape away from a relevant zone is not sufficient.
- **Engulfing:** body-engulfing pattern should be directionally defined and contextualised at a POI; not an independent entry by itself.
- **Trendlines:** connect confirmed swing points only; break/retest must be assessed with structure and candle closes, not merely a visual line touch.

## Entry, risk and signal lifecycle

A valid signal candidate should be backed by a named entry model and the relevant confirmed sequence (structure/displacement, POI retest, and liquidity or model-specific confirmation). Different models may have different prerequisites; do not impose QML or inducement on every model, and do not let a single label override contradictory structure.

- Minimum reward-to-risk: **1:3**. Calculate entry, stop beyond structural invalidation, and target at a still-valid opposing structural level. Reject if the target cannot deliver at least 3R.
- Pending entries must remain **Not triggered** until price actually trades through the planned entry. Do not show TP/SL percentage progress before entry.
- After entry, evaluate stop and target chronologically using candle data; if both occur in one candle and tick order is unavailable, do not pretend the sequence is known.
- Expire stale pending setups and invalidate them when the structural premise fails. Do not resurrect a setup after its stop/target was passed before admission.
- Scan automatically across supported execution timeframes, deduplicate signals, retain explicit diagnostics, and never force a daily quota. No signal is preferable to a fabricated signal.

## Required validation before calling the desk live-ready

- Check feed health, candle timestamps, closed-candle filtering, and market-session handling for EUR/USD versus 24/7 instruments.
- Verify every overlay's source candle/time and price bounds against the same OHLC series shown.
- Replay historical sequences without look-ahead, including failed setups and cases where a zone is never retested.
- Report signal count, entry-trigger count, TP/SL/invalidation/expiry counts, R results, drawdown, and sample size. Do not claim profitability without reproducible out-of-sample results.


## Continuation order blocks and trend shifts

Continuation OBs do not require inducement. In an established uptrend, after a confirmed higher high/BOS, the last opposing candle before a qualifying bullish impulse may form a bullish continuation OB. In a downtrend, after a confirmed lower low/BOS, the last opposing candle before a qualifying bearish impulse may form a bearish continuation OB. A first pullback can mitigate a fresh OB for the next move. Mitigation is not invalidation: a decisive close through the distal boundary invalidates the block. The first confirmed structural break against the prior trend may be a CHoCH/trend shift; later breaks aligned with the new direction are continuation BOS events. Do not require QML or inducement for every block. Never emit an entry as newly pending after its entry has already traded.
