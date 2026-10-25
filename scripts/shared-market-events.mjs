/**
 * Shared, strategy-neutral market-event primitives.
 *
 * This module normalizes observable market facts; it does not make a trade
 * decision and does not replace APA, SMC, or Alchemist confirmation rules.
 * Callers must supply already-confirmed swing levels and closed candles.
 */

const finite = value => Number.isFinite(Number(value));

/**
 * Classify a confirmed close through a known swing.
 * MSS/CHoCH/BOS are labels applied by strategy adapters, not three separate
 * price-break detectors. Strategy-specific definitions remain configurable.
 */
export function classifyStructureBreak({
  priorTrend,
  brokenLevel,
  previousClose,
  close,
  direction,
  opposingStructureConfirmed = false,
}) {
  if (!['bullish', 'bearish', 'range', 'unknown'].includes(priorTrend) ||
      !finite(brokenLevel) || !finite(previousClose) || !finite(close) ||
      !['bullish', 'bearish'].includes(direction)) {
    return { status: 'insufficient-data', event: null, reason: 'A known swing level, two closed-candle closes, direction, and prior trend are required.' };
  }

  const level = Number(brokenLevel);
  const prev = Number(previousClose);
  const now = Number(close);
  const crossed = direction === 'bullish' ? prev <= level && now > level : prev >= level && now < level;
  if (!crossed) {
    return { status: 'no-break', event: null, level, reason: 'No close-confirmed cross through the supplied swing level.' };
  }

  const againstTrend = (priorTrend === 'bearish' && direction === 'bullish') ||
    (priorTrend === 'bullish' && direction === 'bearish');
  const status = againstTrend
    ? (opposingStructureConfirmed ? 'confirmed-reversal-break' : 'transition')
    : 'continuation-break';

  return {
    status,
    event: againstTrend ? 'potential-character-change' : 'structure-break',
    direction,
    level,
    close: now,
    priorTrend,
    opposingStructureConfirmed: Boolean(opposingStructureConfirmed),
    reason: againstTrend
      ? (opposingStructureConfirmed ? 'Counter-trend break with supplied opposing-structure confirmation.' : 'Counter-trend break detected; do not treat as a confirmed reversal yet.')
      : 'Close-confirmed break classified against the supplied prior trend.',
  };
}

/**
 * Validate a candidate order-block zone using explicit evidence supplied by
 * a detector. This avoids calling every opposite-colour candle an OB.
 * The zone must precede a displacement candle that closes through a known
 * structure level; later invalidation is evaluated separately.
 */
export function validateOrderBlockCandidate({
  zone,
  impulse,
  brokenLevel,
  direction,
  minimumBodyToAtr = 1,
}) {
  if (!zone || !impulse || !finite(zone.low) || !finite(zone.high) ||
      !finite(impulse.open) || !finite(impulse.close) ||
      !finite(impulse.high) || !finite(impulse.low) || !finite(brokenLevel) ||
      !finite(minimumBodyToAtr) || Number(minimumBodyToAtr) < 0 ||
      !['bullish', 'bearish'].includes(direction)) {
    return { valid: false, status: 'insufficient-data', reason: 'Valid zone, impulse candle, broken level, direction, and threshold are required.' };
  }
  const low = Number(zone.low), high = Number(zone.high);
  if (low > high) return { valid: false, status: 'invalid-zone', reason: 'Zone low must not exceed zone high.' };

  const open = Number(impulse.open), close = Number(impulse.close);
  const body = Math.abs(close - open);
  const atr = Number(impulse.atr);
  if (!(atr > 0)) return { valid: false, status: 'insufficient-data', reason: 'A positive ATR value is required to validate displacement.' };

  const bullish = direction === 'bullish';
  const directional = bullish ? close > open : close < open;
  const breaksStructure = bullish ? close > Number(brokenLevel) : close < Number(brokenLevel);
  const displaced = body >= atr * Number(minimumBodyToAtr);
  const zoneBeforeImpulse = finite(zone.time) && finite(impulse.time) && Number(zone.time) < Number(impulse.time);
  const valid = directional && breaksStructure && displaced && zoneBeforeImpulse;

  return {
    valid,
    status: valid ? 'candidate-order-block' : 'rejected',
    zone: { low, high, time: Number(zone.time) },
    impulseTime: Number(impulse.time),
    direction,
    evidence: { directional, breaksStructure, displaced, zoneBeforeImpulse, body, atr, bodyToAtr: body / atr },
    reason: valid
      ? 'Preceding zone is supported by a directional displacement candle closing through structure.'
      : 'Candidate failed one or more explicit order-block formation checks.',
  };
}

/**
 * Represent a revisit to a zone as a touch, not as an automatic entry.
 * The strategy adapter must still apply sweep/inducement, confirmation,
 * invalidation, target, and risk gates.
 */
export function assessZoneInteraction({ zone, candle }) {
  if (!zone || !candle || !finite(zone.low) || !finite(zone.high) ||
      !finite(candle.low) || !finite(candle.high) || Number(zone.low) > Number(zone.high)) {
    return { status: 'insufficient-data', touched: false, actionable: false };
  }
  const touched = Number(candle.low) <= Number(zone.high) && Number(candle.high) >= Number(zone.low);
  return {
    status: touched ? 'zone-touched-needs-confirmation' : 'zone-not-touched',
    touched,
    actionable: false,
    reason: touched
      ? 'Price entered the zone; this is only a candidate interaction, not an entry signal.'
      : 'Price has not intersected the zone.',
  };
}
