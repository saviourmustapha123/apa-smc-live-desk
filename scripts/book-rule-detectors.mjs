/**
 * Deterministic, source-grounded primitives from the uploaded LowKey APA book.
 *
 * These helpers consume already-confirmed levels and closed candles. They do
 * not infer swing levels themselves, so callers cannot accidentally mistake
 * an unconfirmed pivot for a known level. They are not yet the whole APA
 * strategy and must not be treated as a standalone trade-entry generator.
 */
function validCandle(candle) {
  return candle && Number.isFinite(Number(candle.close)) &&
    Number.isFinite(Number(candle.time));
}

/**
 * Evaluate a close through a pre-identified shift point.
 *
 * @param {object} input
 * @param {'bullish'|'bearish'} input.priorTrend Trend before the possible shift.
 * @param {number} input.shiftLevel Significant prior-trend invalidation level.
 * @param {number} input.reclaimLevel Prior extreme that can reclaim dominance.
 * @param {object[]} input.closedCandles Closed candles in chronological order.
 * @param {boolean} [input.newOpposingStructureConfirmed=false] Whether a new
 *   opposing structure has been confirmed using separately validated logic.
 *
 * A wick-only breach is deliberately not enough. For a bullish prior trend,
 * a close below the shift level is a bearish shift candidate; for a bearish
 * prior trend, a close above it is a bullish shift candidate. A reclaim close
 * through the reclaim level takes precedence as a return of prior dominance.
 */
export function evaluateLowKeyShift(input) {
  const { priorTrend, shiftLevel, reclaimLevel, closedCandles } = input || {};
  if (!['bullish', 'bearish'].includes(priorTrend) ||
      !Number.isFinite(Number(shiftLevel)) ||
      !Number.isFinite(Number(reclaimLevel)) ||
      !Array.isArray(closedCandles) || !closedCandles.length ||
      !closedCandles.every(validCandle)) {
    return { status: 'insufficient-data', reason: 'A prior trend, confirmed levels, and closed candles are required.' };
  }
  const candles = [...closedCandles].sort((a, b) => Number(a.time) - Number(b.time));
  const last = candles.at(-1);
  const close = Number(last.close);
  const shift = priorTrend === 'bullish' ? close < Number(shiftLevel) : close > Number(shiftLevel);
  const reclaimed = priorTrend === 'bullish' ? close > Number(reclaimLevel) : close < Number(reclaimLevel);

  if (reclaimed) {
    return {
      status: 'reclaimed',
      direction: priorTrend,
      decisionTime: Number(last.time),
      close,
      level: Number(reclaimLevel),
      reason: 'The last closed candle reclaimed the prior extreme; prior-trend dominance may be returning.',
    };
  }
  if (!shift) {
    return {
      status: 'no-shift',
      direction: null,
      decisionTime: Number(last.time),
      close,
      level: Number(shiftLevel),
      reason: 'The last close did not cross the source-defined shift point; a wick-only breach is not enough.',
    };
  }
  const direction = priorTrend === 'bullish' ? 'bearish' : 'bullish';
  if (!input.newOpposingStructureConfirmed) {
    return {
      status: 'transition',
      direction,
      decisionTime: Number(last.time),
      close,
      level: Number(shiftLevel),
      reason: 'The shift point was breached by a close, but new opposing structure is not confirmed.',
    };
  }
  return {
    status: 'confirmed-shift',
    direction,
    decisionTime: Number(last.time),
    close,
    level: Number(shiftLevel),
    reason: 'The shift point was breached by a close and opposing structure confirmation was supplied.',
  };
}
