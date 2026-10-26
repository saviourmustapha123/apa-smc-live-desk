# Live Strategy Rulebook: Validation, Entry Logic and Physical Chart Mapping

Updated: 2026-10-26

## Status and boundaries

This is the operational rulebook for the live browser scanner. The rules below are deterministic interpretations used by this project, not a claim that all SMC schools use identical definitions or that the proprietary LOWKEY FX APA method has been reproduced in full. A detector is evidence about price action, not proof of institutional intent or profitability.

The scanner remains decision support for manual execution. Do not force a daily signal quota. If the full sequence is absent, the correct output is WAIT / NO QUALIFIED SETUP.

## Signal state machine

1. Detected — a structure, zone, or event exists; no entry is implied.
2. Confirmed — the required closed-bar sequence is complete and no invalidation has occurred.
3. Eligible / untriggered — entry, structural stop, and target are calculated; planned R:R is at least 1:3; price has not reached the entry.
4. Active — only after price reaches the defined entry according to the trigger rule. TP/SL progress and running R must remain blank before this stage.
5. Closed / invalidated / expired — lifecycle outcome is recorded once; a refresh must not reopen or duplicate the same setup.

A setup is keyed by instrument, timeframe, direction, setup/trigger candle time and structural zone. Repeated scans must update the existing setup, not create a new signal for the same event.

## Detector rules and contributions

| Variable | Formation / confirmation rule | Invalidation or rejection | Contribution to an entry |
|---|---|---|---|
| Swing highs/lows | A pivot must be more extreme than the configured bars on both sides. It becomes known only after the right-side bars close. Equal pivots use a deterministic tie policy. | Reject pivots not yet confirmed; never use future candles. | Provides levels used by BOS/CHoCH, liquidity, QML, stops and structural targets. |
| BOS | A closed candle closes beyond a previously confirmed swing in the prevailing direction. | Wick-only breach is not a BOS under this project's close-confirmed convention. | Establishes continuation structure and anchors the next sequence. |
| CHoCH / MSS | A close-confirmed break against the previously established structure. The app labels the first opposing break as CHoCH under its declared convention. | If the break is only a wick or the relevant swing was not known beforehand, do not confirm it. | Evidence of a possible shift; not an entry alone. |
| Buy-side / sell-side liquidity | Mark visible swing highs/lows and equal-high/equal-low clusters as candidate pools. A sweep requires trading beyond the known level and closing back across it. | A close beyond and acceptance outside the level is breakout evidence, not a reclaimed sweep. | Can provide the liquidity event before a structural shift or retest. OHLC candles do not reveal the full order book. |
| Inducement (IDM) | Identify the first confirmed countertrend pullback pivot after the relevant BOS. It stays a candidate until price sweeps through it and closes back across it. If a nearby equal-level pool exists, the sweep must clear its outer edge and reclaim the included levels. | A close through the IDM level without reclaim invalidates that candidate. The sweep must belong to the same BOS and trade direction. | Required before an order-block mitigation entry in this project's APA entry model; unrelated sweeps elsewhere do not substitute for it. |
| Order block (OB) | Last opposing candle near a displacement impulse that closes through a previously confirmed swing. For the project's trade-grade OB path, require a three-candle FVG, fresh zone, matching direction, and BOS-linked IDM/liquidity sweep before the first mitigation. The origin search is consistent across live OB paths. | Reject a zone invalidated by a close through its far edge, already mitigated before the intended first retest, mismatched with the BOS, or lacking the required trade-grade sequence. | Defines a planned pullback entry zone; an opposing candle alone is not enough. |
| Breaker block | Start with an identifiable OB. Price must close through its far edge (the OB fails), then establish an opposite-direction close-confirmed structure break, and later retest/reject the old zone from the opposite side. | A broken OB without the later opposite structural break and opposite-side retest is only a failed OB, not a confirmed breaker. A normal OB zone must never be labelled a breaker. | Can define a reversal/retest point after the failed block changes role. |
| FVG | Three-candle non-overlap: bullish when candle 3 low is above candle 1 high; bearish when candle 3 high is below candle 1 low. Track open, partial mitigation and full fill separately. | Do not call a simple touch a full fill. A fully filled/invalidated gap cannot be presented as fresh. | Location/confluence for retracement; never a standalone entry. |
| iFVG | A valid FVG must first be closed through its far edge, then retested and rejected in the inverse direction. | A touch or a gap without a close-through is not an iFVG. | Adds a role-flip retest only after failure and confirmation. |
| QML | Bearish: prior uptrend; left-shoulder high A; intervening low B; higher head C that sweeps above A; a later candle closes below B; then price returns to A and rejects. Bullish is the mirror: prior downtrend, lower head, close above intervening high, then return to the left-shoulder low. | No head sweep, no close-confirmed break of B, no return to A, or a close through the head means no confirmed QML entry. | The QML level is A (left shoulder), not B (the intervening leg), not the head, and not a projected head-and-shoulders neckline. |
| SBR / RBS | SBR: confirmed support is broken by close, then retested from below and rejected as resistance. RBS: resistance is broken by close, then retested from above and respected as support. | Touching a level without a prior close-break is not a role reversal. Keep separate from breaker blocks. | Level-based retest confluence, not automatically a trade. |
| Rejection / engulfing | Evaluate candle body and close relative to the zone and prior candle. | A candle shape without a valid location, preceding structure and close confirmation is not enough. | Can be the final trigger only after the parent setup is valid. |
| Trendlines | Connect at least two confirmed swing highs or lows of the same type; keep the anchors and timeframe explicit. | Do not anchor to unconfirmed pivots or redraw history to fit the latest price. | Context only unless a separately documented close-break/retest rule validates it. |
| Premium / discount | Split a defined confirmed dealing range at its midpoint; document which swing high and low define that range. | Do not calculate from unrelated latest highs/lows or use it as a trigger by itself. | Contextual location filter; should not override a contradictory structural sequence. |
| Displacement | Closed-candle body compared with ATR/range baseline, with direction matching the break. | Small, opposite-direction or unclosed candles do not confirm displacement. | Confirms impulse quality; a multiplier is configurable and must be tested. |

## QML physical chart mapping

- Draw a thin horizontal/rectangular zone centred on the left-shoulder price A; label it BEARISH QML · WAITING FOR RETEST or BULLISH QML · WAITING FOR RETEST.
- Mark the four confirmed pivots LEFT SHOULDER, LEG, HEAD, and BREAK SWING.
- Draw a separate BOS/CHoCH marker on the actual closed candle that broke the leg level B.
- Extend the QML zone to the right only while waiting for the return. Once the retest confirms or the pattern invalidates, stop presenting it as a live pending zone.
- Mark the retest candle only after it touches the shoulder zone and closes back in the intended direction.
- Stop/invalidation is beyond the head with a volatility-aware buffer. Target must be structural and the actual planned entry must still support at least 1:3 R:R.
- Do not draw a giant box around the entire pattern as though the whole structure were the entry zone. The pattern legs are lines/markers; the QML entry is a narrow price zone.

## Order-block and breaker physical chart mapping

- OB: draw the originating candle's high/low rectangle and extend it right while fresh. Distinguish OB CANDIDATE, WAITING FOR IDM SWEEP, FIRST RETEST, MITIGATED, and INVALIDATED.
- Breaker: use a distinct indigo outline/fill and the same old OB bounds. Do not label it until the old OB failed by close, the opposite structure break occurred, and the later retest/rejection was observed.
- IDM: draw the pullback pivot level as a separate thin lime line/zone and mark the actual sweep candle. If nearby equal highs/lows are included in the liquidity pool, annotate the outer level(s) that must be cleared.
- FVG/iFVG: draw only the actual gap boundaries. Use separate colours for original FVG and flipped iFVG; label partial mitigation, full fill, and close-through flip distinctly.
- BOS/CHoCH: draw the broken swing level from its origin to the confirming candle, with a marker on the closed candle that made the break.
- SBR/RBS: draw a level-based retest band around the original support/resistance price. Use separate labels/colours from breaker blocks.
- Chart zones are a visual explanation of the same objects consumed by the scanner, not independent decorations. If the live scanner rejects the setup, the chart must not portray the pattern as a validated entry.

## Entry validation order

1. Validate instrument, session, candle timestamps, OHLC geometry and data freshness.
2. Confirm swings and higher-timeframe context using only candles available at decision time.
3. Identify the relevant liquidity pool and classify the sweep or breakout correctly.
4. Confirm BOS/CHoCH and displacement on closed candles.
5. For the OB model, confirm the linked IDM and relevant nearby equal-level liquidity were swept before the first fresh OB mitigation. For QML, confirm head sweep → close through the leg → shoulder retest.
6. Confirm the actual zone retest and directional rejection/trigger.
7. Compute entry, structural invalidation stop and structural target. Reject if risk is zero/negative, target is invalid, or actual planned R:R is below 1:3.
8. Create a deduplicated untriggered setup. Do not show P/L progress until entry is actually triggered.
9. Replay outcomes with next-bar/zone-touch execution, spread, fees, slippage, gaps and conservative stop-first handling when TP and SL occur in one candle.
10. Report wins, losses, unresolved/expired setups, expectancy in R, profit factor, drawdown and trade count. Unit tests and source audits are not profitability evidence.

## Sources used for comparison

- LOWKEY FX, official APA overview: https://lowkeyfx.com/apa-strategy
- Capital.com, Quasimodo pattern sequence: https://capital.com/en-int/learn/trading-strategies/quasimodo-pattern
- MQL5, rule-based Quasimodo implementation using confirmed pivots, structural break and shoulder retest: https://www.mql5.com/en/articles/23141
- OpenFNO, SMC chart mapping conventions: https://openfno.com/docs/strategies/smart-money-concepts/
- CMC Markets, FVG educational material: https://cmcmarkets.com/learn/fair-value-gap/

These sources use differing conventions. The code and tests must name the convention being applied, and the backtest—not the label—must determine whether a rule contributes useful performance.
