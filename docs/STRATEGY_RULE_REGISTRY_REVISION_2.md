# APA + Alchemist / SMC Strategy Rule Registry — Revision 2
Date: 2026-10-26
Status: specification and audit baseline; not yet a validated live strategy.

## Strategy-family architecture
- Family A: LOWKEY FX Advanced Price Action (APA) + Alchemist Concepts. Treat these as one connected family, not separate competing strategies. Preserve each setup's own rules and provenance; merge duplicate observations of the same market event so one event is not counted twice.
- Family B: Smart Money Concepts (SMC), based on the uploaded SMC ebook and Toofan SMC Entry Models. Keep SMC definitions distinct where they differ from APA/Alchemist.
- A market event can satisfy more than one family. Record the event once, attach multiple evidence tags, and do not create duplicate trades solely because two detectors saw it.
- Never promote an unverified detector from a chart label into a trade trigger. Until trigger, timeframe, entry, stop, target, invalidation, expiry, and session rules are explicit and tested, label it PROVISIONAL.

## New corrections: mandatory interpretation
### Inducement (IDM)
1. Identify the current structural leg and the relevant protected swing/point of interest first.
2. Identify the minor swing or pullback that could draw early entries and whose liquidity is positioned before the meaningful target/POI. A nearby pivot or any sweep alone is not enough to label inducement.
3. Track the inducement level as a distinct event from the POI/order block. Mark whether it is untouched, swept/taken, invalidated by a close-through, or still unconfirmed.
4. Evaluate what happens after the inducement is taken: structure response, displacement, valid FVG/OB, and higher-timeframe context. A sweep alone is not an entry.
5. An OB associated with an inducement setup must not automatically be treated as respected/valid. The inducement may be designed to draw price through an apparent early block; wait for the actual model's required sequence and confirmation.
6. Inducement is context-dependent; it is not required in every market leg or every valid setup.

### Order block (OB)
1. Do not classify a candle as an OB merely because it is the last opposite-colour candle.
2. Under the user's mandatory SMC-book rule, a qualifying OB must be associated with liquidity taken from the previous candle or structure and a valid imbalance/FVG, alongside the model's required displacement/structure context.
3. Record the exact originating candle/cluster, boundaries, direction, creation time, confirmation time, associated FVG, liquidity event, structural break, freshness/mitigation state, and invalidation.
4. Separate a candidate candle from a qualified OB. No qualifying FVG means it fails the user's required OB rule.
5. Do not assume every OB is respected. A zone can be untouched, tapped/mitigated, invalidated, or failed.
6. If the block is an inducement trap or is invalidated, do not treat it as a valid entry zone merely because its geometry resembles an OB.

### Breaker block
1. A breaker must originate from a previously identifiable OB.
2. Price must first pass through that OB without respecting it, invalidating/failing the original OB.
3. Price must then return to the failed zone and respect it from the opposite side/for the opposite directional use.
4. Until both the failure-through and the opposite-side return/reaction are observed, do not label it a confirmed breaker. Do not paint a normal OB as a breaker.
5. Store the source OB ID and the timestamps of failure and retest so the chart can prove the sequence.

### QML (Quasimodo)
1. QML is an optional reversal-confirmation area, not a universal condition and not a mandatory setup in every market.
2. Detect only when the full required swing geometry and the strategy-specific protected-level/neckline relationships are present; a generic five-pivot shape alone is only a candidate.
3. QML may coexist with inducement, liquidity sweeps, OB/FVG, SBR/RBS, trendlines, or structure shifts. Those events remain separately evaluated; do not force all setups into QML.
4. Require context and the model's confirmation trigger before a QML candidate becomes a signal. Record invalidation and whether the pattern is complete.
5. Do not treat head-and-shoulders as a substitute for QML. The user requested removing H&S as a separate strategy variable.

## Other variable audit: definitions and required state
### Market structure: swings, HH/HL/LH/LL
- Confirm swings only after the right-side confirmation candles close; store 'known_at' separately from the pivot candle time to prevent look-ahead.
- Handle equal highs/lows consistently; do not require strict inequality on both sides in a way that erases tied pivots.
- Keep internal and external/swing structure separate. Every level must have timeframe, pivot time, confirmation time, and status.

### BOS / CHoCH / MSS / false BOS
- BOS: a qualifying close through a relevant confirmed swing in the existing trend direction, under the selected structure scale.
- CHoCH/MSS: a qualifying break against the prior structural direction; it signals a possible shift, not guaranteed reversal.
- Do not count wick-only pokes as confirmed breaks unless the source model explicitly says so.
- Track protected swing, break candle, close criterion, displacement/context, and whether a later reclaim makes the break false.
- An IDM/inducement requirement applies only where the selected SMC model requires it; do not silently apply or omit it across all strategies.

### Liquidity: BSL/SSL, EQH/EQL, swing and session liquidity
- BSL is above relevant highs; SSL is below relevant lows. Distinguish a liquidity pool from a sweep and from a confirmed structural break.
- EQH/EQL need a documented tolerance and relevant swing context, not arbitrary proximity.
- Session highs/lows and previous day/week/month highs/lows are separate liquidity references with session/timezone provenance.
- A sweep requires a defined breach and return/rejection condition for the selected model. A clean close and continuation through a level is not automatically a sweep.
- Mark consumed/taken pools and do not repeatedly treat them as fresh liquidity.

### FVG / imbalance / inverse FVG
- Standard FVG geometry must use three closed candles and the precise wick-gap relationship; retain direction and boundaries.
- Track unfilled, partial fill, filled, and invalidated states. A filled FVG cannot be advertised as fresh.
- iFVG is a separate stateful role reversal: the original gap must fail/break through and subsequently be used from the opposite side under the chosen definition. Do not label every FVG an iFVG.
- FVG confluence is a qualification rule for the user's OB definition; an isolated FVG is not automatically an OB.

### Displacement and momentum
- Measure displacement against a configurable, instrument/timeframe-aware baseline (e.g. ATR/body/range), with close location and structure context.
- One large candle alone is not sufficient proof of a valid setup; record the rule and threshold used.
- Keep momentum leg and corrective leg distinct.

### Order flow (OF), POI/AOI, premium/discount/equilibrium
- Distinguish order-flow leg from a single OB; the SMC ebook describes an order block as a refined form of order flow.
- Track freshness/softening of order flow/POI. If the source model treats the first touch as consumption, do not reuse the zone as fresh after it is touched.
- Premium/discount must be measured from an explicitly selected dealing range and timeframe. Store range high/low and midpoint; do not calculate from arbitrary latest pivots without recording that choice.
- Higher-timeframe POIs and opposing trouble areas (FTAs) must be visible to lower-timeframe entries.

### SBR/RBS (support-resistance flip)
- SBR: support is decisively broken, then price retests from below and resistance behavior is confirmed.
- RBS: resistance is decisively broken, then price retests from above and support behavior is confirmed.
- Require a completed break then a later retest/reaction; do not label a simple touch or a break candle itself as a flip.

### Trendlines
- Build from confirmed swing points; store anchors, slope, timeframe, touch count, and break/retest state.
- A line drawn through two pivots is only a candidate trendline. It is not itself a trade trigger without the strategy's defined touch/break/confirmation sequence.

### Session/time-cycle and Alchemist variables
- Preserve Alchemist's H1 POI + M1–M5 entry structure, liquidity/TS/TL/QT context, shifts/IDM/key OCL/SBR, and 90-minute-cycle concepts as strategy-specific features where source definitions support them.
- Session liquidity must use explicit session boundaries and timezone. Do not hard-code claims that a given session must reverse or continue; treat those as hypotheses to test.
- APA liquidity consumption is multi-timeframe and sequential: higher-timeframe liquidity/shift context leads to progressively lower-timeframe shifts/consumption; do not collapse this into a single recent-candle signal.
- Preserve FTA (higher-timeframe trouble area) checks and distinguish a target from an opposing zone that can block the trade.

### Entry models, risk and trade lifecycle
- Keep market-close retest entries separate from untouched pending-limit entries; they have different fill/expiry/invalidation rules.
- A pending signal has no running P/L and cannot be counted as an active trade before its entry is actually touched/filled.
- Enforce minimum 1:3 reward-to-risk before publishing a candidate, using actual entry, invalidation stop and a realistic target after opposing liquidity/FTAs.
- Resolve outcomes from subsequent closed 1-minute candles, not periodic quote snapshots. If stop and target are both touched in the same candle and order is unknown, conservatively resolve stop first.
- Include spread, commission and slippage when possible; report before-cost and after-cost performance separately.
- Avoid look-ahead/repainting. Every annotation and signal must have a 'known_at' time and be reproducible from candles available at that point.

## Required detector output schema
Each detector should return: 'concept', 'family', 'direction', 'timeframe', 'status' (candidate/confirmed/taken/mitigated/invalidated/expired), 'zone_low', 'zone_high', 'origin_time', 'known_at', 'source_event_ids', 'confirmation_event_ids', 'invalidation_rule', 'reason', and 'confidence/provisional_flag'.
Each trade candidate should additionally return: entry type, entry, stop, target(s), RR, expiry, setup-family tags, risk model, and explicit failed-filter reasons.

## Confirmation status
- **Definition-level confirmation from the user's supplied rules/books:** inducement is not equivalent to OB; user's OB rule requires liquidity-taking context plus FVG/imbalance; breaker requires failed OB then opposite-side retest; QML is optional and can coexist with inducement; H&S is not a separate variable; APA+Alchemist are one family, SMC the other.
- **Still needs implementation and fixture-based verification:** all detectors above, exact QML swing geometry, full APA/Alchemist setup sequences, iFVG role reversal, session boundaries, and multi-timeframe state transitions.
- **Still needs outcome validation:** real historical data quality, no-look-ahead replay, realistic execution costs, walk-forward/holdout results, and per-market/per-timeframe expectancy. No profitability claim is made.

## References
- User-supplied '627844629-E-book-Smart-Money-SMC.pdf' / '627844629-E-book-Smart-Money-SMC(1).pdf'
- User-supplied '930067889-Advanced-Price-Action-Lowkey-forex-trader.pdf'
- User-supplied '994417437-Alchemist-Concepts-in-Forex-Trading-Msnr-Overview.pdf'
- User-supplied 'APA SMC Live Desk Audit and Execution Framework.pdf'
- Public cross-checks: SMC terminology varies by educator; see https://openfno.com/docs/strategies/smart-money-concepts/ and https://ribqa.com/glossary. User's supplied model rules take precedence over generic definitions.
