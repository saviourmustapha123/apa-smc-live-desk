/**
 * Source-grounded strategy registry for the uploaded study books.
 *
 * This is a rule-learning ledger, not a claim that every rule is already
 * implemented in the live scanner. A rule must pass source extraction,
 * deterministic definition, detector implementation, fixture tests and
 * historical validation before its status can be promoted.
 */
export const BOOK_SOURCES = Object.freeze({
  lowkey: {
    id: 'lowkey-advanced-price-action',
    title: 'Advanced Price Action — LowKey Forex Trader',
    file: '930067889-Advanced-Price-Action-Lowkey-forex-trader.pdf',
    sourceType: 'uploaded-pdf',
  },
  alchemist: {
    id: 'alchemist-msnr-overview',
    title: 'Alchemist Concepts in Forex Trading — MSNR Overview',
    file: '994417437-Alchemist-Concepts-in-Forex-Trading-Msnr-Overview.pdf',
    sourceType: 'uploaded-pdf',
  },
});

const rule = (id, source, concept, evidence, requirements, notes = '') => ({
  id, source, concept, evidence, requirements, notes,
  implementationStatus: 'not-verified',
  testStatus: 'not-tested',
  historicalStatus: 'not-tested',
});

export const BOOK_RULES = Object.freeze([
  rule('LK-SHIFT-001', 'lowkey', 'Shift point',
    'explicit-text', ['Identify the significant level whose close-through invalidates the prior trend', 'Use candle close, not wick-only breach'],
    'LowKey PDF pp. 40–42. Directional wording should be checked against the book examples before coding.'),
  rule('LK-RECLAIM-001', 'lowkey', 'Reclaim point',
    'explicit-text', ['Track the prior extreme identified by the source', 'Require a confirming close back beyond the reclaim level after a shift-point breach'],
    'LowKey PDF pp. 42–43. Do not merge reclaim with ordinary CHoCH without a distinct test.'),
  rule('LK-TRANSITION-001', 'lowkey', 'Transition versus confirmed shift',
    'explicit-text', ['Represent transition as uncertain/incomplete structure', 'Do not promote transition to confirmed shift without the source-defined new structure'],
    'LowKey PDF pp. 43–44.'),
  rule('LK-SHIFT-TYPES-001', 'lowkey', 'Shift formation types',
    'explicit-text', ['Distinguish inside-formation shift', 'Distinguish outside-formation shift', 'Distinguish combined inside and outside formation'],
    'LowKey PDF p. 45; exact geometric predicates must be extracted from the illustrated examples before implementation.'),
  rule('LK-FTA-001', 'lowkey', 'First Trouble Area (FTA) validation',
    'explicit-text', ['Detect a shift on the selected trading timeframe', 'Inspect its FTA timeframe for shift versus transition', 'Retain caution when the higher timeframe is only transitioning'],
    'LowKey PDF p. 72 describes H1 formation checked against H4. Do not hard-code H1/H4 as the only permitted pair without configuration.'),
  rule('LK-LIQENG-001', 'lowkey', 'Liquidity engineering confirmation',
    'explicit-text', ['Mark liquidity on the constant timeframe', 'Wait for price to tap liquidity on situational timeframe 1', 'Check further liquidity engineering on situational timeframe 2', 'Require a reaction/confirmation before entry'],
    'LowKey PDF pp. 74–79 describes daily/weekly context, H4 then H1 as an example.'),
  rule('AL-OCL-001', 'alchemist', 'Open Close Level (OCL)',
    'text-plus-diagram', ['Record the OCL level/zone from the relevant higher-timeframe candle structure', 'Check the lower-timeframe order-block relationship'],
    'The PDF calls OCL a fixed-period moving-average-like/hidden-base concept; exact calculation and parameters require diagram-by-diagram extraction. Not safe to invent a formula.'),
  rule('AL-CLASSIC-A-001', 'alchemist', 'Classic A resistance setup',
    'text-plus-diagram', ['Identify the source-defined highest swing point', 'Inspect lower-timeframe order-block support/resistance context', 'Record whether a liquidity sweep is present'],
    'A sweep is described as strengthening the pattern, not as an unconditional guarantee. Exact swing geometry needs fixture examples.'),
  rule('AL-CLASSIC-V-001', 'alchemist', 'Classic V support setup',
    'text-plus-diagram', ['Identify the source-defined lowest swing point', 'Inspect lower-timeframe order-block support/resistance context', 'Record whether a liquidity sweep is present'],
    'Exact pattern geometry needs fixture examples.'),
  rule('AL-SBR-001', 'alchemist', 'Support Becomes Resistance (SBR)',
    'text-plus-diagram', ['Detect a support level that breaks', 'Track the retest/reversal that makes the level resistance', 'Keep the breaker-block relationship explicit'],
    'The PDF describes SBR as support breakout followed by reversal.'),
  rule('AL-RBS-001', 'alchemist', 'Resistance Becomes Support (RBS)',
    'text-plus-diagram', ['Detect resistance break', 'Require evidence the broken resistance is acting as support'],
    'Do not label a simple resistance touch as RBS.'),
  rule('AL-QML-001', 'alchemist', 'Quasimodo (QML)',
    'text-plus-diagram', ['Represent the ordered swing sequence and neckline/level required by the source diagram', 'Confirm the reversal condition before creating a setup'],
    'The text identifies QML as a reversal pattern but the exact swing sequence must be transcribed from its diagrams before implementation.'),
  rule('AL-ENGULF-OB-001', 'alchemist', 'Engulfing order block',
    'text-plus-diagram', ['Detect the engulfing condition', 'Identify the associated order-block zone', 'Record whether liquidity was swept before the setup'],
    'The source links engulfing OB and liquidity sweep; avoid treating every ordinary engulfing candle as this setup.'),
  rule('AL-TRENDLINE-001', 'alchemist', 'Key trendline',
    'explicit-text', ['Require at least two prior tests of the trendline', 'Treat the third test as the candidate interaction', 'Check the source-defined key point alignment'],
    'The PDF explicitly describes two tests before a third-test entry. Trendline fitting and tolerance still require deterministic specification.'),
  rule('AL-HTF-LTF-001', 'alchemist', 'Higher-timeframe POI with lower-timeframe entry',
    'explicit-text-plus-diagram', ['Identify H1 point of interest', 'Wait for M1–M5 market-structure/entry confirmation', 'Track liquidity, trendline, OCL or QT context when applicable'],
    'The PDF presents H1 POI and M1–M5 entry as a repeated setup framework. Each optional confirmation must be separately configured and reported.'),
  rule('AL-QT-001', 'alchemist', 'Quarterly Theory / 90-minute cycle',
    'text-plus-diagram', ['Represent the source-described accumulation/manipulation/distribution/continuation-or-reversal phases', 'Map session/cycle timestamps with an explicit timezone', 'Do not infer a setup from time alone'],
    'The PDF includes daily session quarters and 90-minute microcycles. Session timezone and daylight-saving handling must be explicit.'),
  rule('AL-SMT-001', 'alchemist', 'SMT divergence',
    'text-plus-diagram', ['Require two comparable instruments/series', 'Compare corresponding highs/lows over a defined window', 'Record divergence direction and comparison symbols'],
    'The PDF describes divergence between two related items. Instrument pairing and swing-matching tolerance remain configurable and must not be guessed.'),
]);

export const STRATEGY_GATES = Object.freeze({
  minimumRewardRisk: 3,
  requireClosedCandles: true,
  requireNoLookahead: true,
  requireEntryConfirmation: true,
  requireStopAndTarget: true,
  requireSourceTraceability: true,
});

export function passesCandidateGate(candidate, gates = STRATEGY_GATES) {
  if (!candidate || !Number.isFinite(Number(candidate.entry)) ||
      !Number.isFinite(Number(candidate.stopLoss ?? candidate.sl)) ||
      !Number.isFinite(Number(candidate.takeProfit ?? candidate.tp))) return false;
  const entry = Number(candidate.entry);
  const stop = Number(candidate.stopLoss ?? candidate.sl);
  const target = Number(candidate.takeProfit ?? candidate.tp);
  const risk = Math.abs(entry - stop);
  const reward = Math.abs(target - entry);
  if (!(risk > 0) || !(reward > 0)) return false;
  const calculatedRR = reward / risk;
  const declaredRR = Number(candidate.rr);
  if (Number.isFinite(declaredRR) && declaredRR + 1e-9 < gates.minimumRewardRisk) return false;
  return calculatedRR + 1e-9 >= gates.minimumRewardRisk;
}
