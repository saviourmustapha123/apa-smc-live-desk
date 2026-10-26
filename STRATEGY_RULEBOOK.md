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

### Continuation sequence: BOS → new high/low → first OB mitigation

For a continuation setup, the scanner must distinguish the structural break from the later extension and the later return to the originating OB. The qualifying sequence is:

1. A close-confirmed BOS in the direction of the established trend, with the displacement and same-impulse FVG required by the OB rule. A first break against the prior trend may be a CHoCH/trend shift; subsequent aligned breaks can qualify as continuation BOS.
2. Price extends beyond the BOS impulse extreme to establish a fresh high for bullish continuation or a fresh low for bearish continuation.
3. Only after that extension, price returns to the still-unmitigated originating OB. The first valid touch/mitigation is recorded as such, with a directional rejection/confirmation before a retest entry can qualify.
4. If price touches the OB before the required extension, the sequence is not a fresh-high/low-before-mitigation continuation setup. If the zone was touched earlier, do not relabel a later touch as the first mitigation.
5. A pending untouched-OB plan may remain pending only while the zone is unmitigated, uninvalidated, the target remains ahead of price, and the required post-BOS extension has already occurred. After first mitigation, evaluate the retest/trigger lifecycle rather than emitting the same untouched pending setup again.

Apply the sequence symmetrically to bullish and bearish structure. A pullback may contain inducement, but inducement is not mandatory unless a specific inducement entry model is being evaluated. QML is separate and optional. The first break after a trend shift must not be mislabeled as continuation BOS without subsequent aligned structure evidence.

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


### Continuation after BOS: new extreme, OB retest, next leg

For both bullish and bearish continuation, the order of events matters:

- **Bullish continuation:** established bullish structure → candle closes above the confirmed swing high (BOS, creating the new high) with qualifying displacement and an associated FVG → identify the last opposing candle as the candidate bullish OB → price extends or establishes the new high, then pulls back to the still-valid OB → the first retest/mitigation may set up the next bullish leg if the zone holds and the entry candle confirms.
- **Bearish continuation:** established bearish structure → candle closes below the confirmed swing low (BOS, creating the new low) with qualifying displacement and an associated FVG → identify the last opposing candle as the candidate bearish OB → price extends or establishes the new low, then rallies back to the still-valid OB → the first retest/mitigation may set up the next bearish leg if the zone holds and the entry candle confirms.
- **Do not confuse “unmitigated” with “must stay untouched forever.”** Before first touch, the zone can be displayed as a fresh pending OB. On first touch, record the mitigation time and stop describing that same zone as unmitigated. It can still be a valid retest setup if it has not been invalidated and the required directional confirmation occurs.
- **Do not wait for inducement or QML by default.** They are optional contextual confirmations, not universal prerequisites for the continuation sequence. If they are present, record them only when their actual structure and direction match.
- **Do not backdate the retest.** If the scanner learns of the retest only after the candle closes, it must not create a pending limit order as if it had existed before that touch. Classify the event as a retest/confirmation candidate, then apply the normal trigger, SL/TP, RR and chronological outcome rules.

### Continuation OB lifecycle: formation, fresh pending, first retest

Treat these as distinct states and never collapse them into one signal:

1. **BOS and formation:** Confirm the relevant swing using a candle close. In an established bullish structure, an upward BOS can qualify a bullish continuation OB; in an established bearish structure, a downward BOS can qualify a bearish continuation OB. The qualifying displacement must leave the associated three-candle FVG, and the OB is the last opposing candle/defined opposing cluster immediately preceding that displacement.
2. **New/fresh OB:** Record the originating candle, zone bounds, formation time, direction, broken swing, and associated FVG. A fresh OB can exist without inducement. A new high in an uptrend or new low in a downtrend is structural context, not proof that every nearby candle is an OB.
3. **Pending before retest:** A midpoint/limit idea may be shown as **Not triggered** only while price remains on the correct side of the fresh zone and has not already traded through the planned entry. Its TP/SL progress remains blank. If price reaches the entry before the scanner admits the signal, do not backdate it as a valid pending trade.
4. **First retest/mitigation:** The first return into the zone changes its state from fresh to touched/mitigated. This is not itself invalidation and does not automatically prove a trade entry. Entry requires the configured entry model's actual trigger and must be evaluated in chronological candle order. If the setup is first detected only after the zone has already been touched, report a retest-confirmation candidate or reject it as a late pending entry; never pretend the entry was pending beforehand.
5. **After the retest:** If the zone holds and structure continues in the original direction, it may support continuation context, but do not repeatedly issue the same OB as a new first-retest signal. A later distinct OB requires its own qualifying displacement/FVG and origin candle.
6. **Failure:** A decisive close through the OB distal boundary invalidates the original OB under this desk's rule. A breaker label additionally requires the failed OB, opposite structural displacement/break, and a subsequent retest/rejection from the opposite side.
7. **Trend change:** The first confirmed break against the established trend is a potential CHoCH/MSS; a later break aligned with the new direction is continuation BOS. Do not classify the same break as both a continuation BOS and a trend shift merely because it made a new high/low.
