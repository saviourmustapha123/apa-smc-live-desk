/**
 * Explicit, deterministic SMC-style detectors for research and unit testing.
 * These are documented conventions, not official LOWKEY FX APA rules.
 * All detections use closed bars only; pivot-based structure is confirmed only
 * after the required right-side candles have closed.
 */

function validBars(bars) {
  return Array.isArray(bars) && bars.every((b, i) =>
    b && [b.open, b.high, b.low, b.close].every(Number.isFinite) &&
    b.high >= Math.max(b.open, b.close, b.low) &&
    b.low <= Math.min(b.open, b.close, b.high) &&
    (i === 0 || (b.time == null || bars[i - 1].time == null || b.time > bars[i - 1].time))
  );
}

export function confirmedPivots(bars, strength = 2) {
  if (!validBars(bars) || !Number.isInteger(strength) || strength < 1) return { highs: [], lows: [] };
  const highs = [], lows = [];
  for (let i = strength; i < bars.length - strength; i++) {
    let isHigh = true, isLow = true;
    // Deterministic tie policy from the audit: left side strict, right side
    // inclusive. The earliest of equal highs/lows wins; later ties do not.
    for (let j = i - strength; j < i; j++) {
      if (bars[j].high >= bars[i].high) isHigh = false;
      if (bars[j].low <= bars[i].low) isLow = false;
    }
    for (let j = i + 1; j <= i + strength; j++) {
      if (bars[j].high > bars[i].high) isHigh = false;
      if (bars[j].low < bars[i].low) isLow = false;
    }
    if (isHigh) highs.push({ index: i, price: bars[i].high, confirmedAt: i + strength, known_at: bars[i + strength].time ?? i + strength });
    if (isLow) lows.push({ index: i, price: bars[i].low, confirmedAt: i + strength, known_at: bars[i + strength].time ?? i + strength });
  }
  return { highs, lows };
}

/** A close-confirmed break of the latest swing level known before that bar. */
export function detectStructureBreaks(bars, { strength = 2 } = {}) {
  if (!validBars(bars)) return [];
  const pivots = confirmedPivots(bars, strength);
  const events = [];
  let trend = 'UNKNOWN';
  for (let i = 0; i < bars.length; i++) {
    const knownHighs = pivots.highs.filter(p => p.confirmedAt < i);
    const knownLows = pivots.lows.filter(p => p.confirmedAt < i);
    const high = knownHighs.at(-1), low = knownLows.at(-1), bar = bars[i];
    const up = high && bar.close > high.price && (i === 0 || bars[i - 1].close <= high.price);
    const down = low && bar.close < low.price && (i === 0 || bars[i - 1].close >= low.price);
    if (up) {
      const type = trend === 'BEARISH' ? 'CHoCH' : 'BOS';
      events.push({ index: i, side: 'BULLISH', type, level: high.price, confirmedBy: 'close' });
      trend = 'BULLISH';
    } else if (down) {
      const type = trend === 'BULLISH' ? 'CHoCH' : 'BOS';
      events.push({ index: i, side: 'BEARISH', type, level: low.price, confirmedBy: 'close' });
      trend = 'BEARISH';
    }
  }
  return events;
}

/** Three-candle FVG convention: no overlap between candle 1 and candle 3. */
export function detectFairValueGaps(bars, { minGap = 0 } = {}) {
  if (!validBars(bars) || !Number.isFinite(minGap) || minGap < 0) return [];
  const gaps = [];
  for (let i = 2; i < bars.length; i++) {
    const first = bars[i - 2], middle = bars[i - 1], third = bars[i];
    if (third.low > first.high && third.low - first.high >= minGap) {
      gaps.push({ index: i, side: 'BULLISH', lower: first.high, upper: third.low, midpoint: (first.high + third.low) / 2, status: 'OPEN' });
    }
    if (third.high < first.low && first.low - third.high >= minGap) {
      gaps.push({ index: i, side: 'BEARISH', lower: third.high, upper: first.low, midpoint: (third.high + first.low) / 2, status: 'OPEN' });
    }
  }
  return gaps.map(gap => {
    let status = 'OPEN';
    for (let i = gap.index + 1; i < bars.length; i++) {
      const b = bars[i], overlaps = b.low <= gap.upper && b.high >= gap.lower;
      if (!overlaps) continue;
      const filled = gap.side === 'BULLISH' ? b.low <= gap.lower : b.high >= gap.upper;
      status = filled ? 'FILLED' : 'PARTIALLY_FILLED';
      if (filled) break;
    }
    return { ...gap, status };
  });
}

/** Sweep + reclaim of a previously confirmed swing; wick alone is insufficient. */
export function detectLiquiditySweeps(bars, { strength = 2 } = {}) {
  if (!validBars(bars)) return [];
  const pivots = confirmedPivots(bars, strength);
  const events = [];
  for (let i = 0; i < bars.length; i++) {
    const bar = bars[i];
    const priorHigh = pivots.highs.filter(p => p.confirmedAt < i).at(-1);
    const priorLow = pivots.lows.filter(p => p.confirmedAt < i).at(-1);
    if (priorHigh && bar.high > priorHigh.price && bar.close < priorHigh.price) {
      events.push({ index: i, side: 'BEARISH', sweptLevel: priorHigh.price, rule: 'high exceeds confirmed swing; close reclaims below' });
    }
    if (priorLow && bar.low < priorLow.price && bar.close > priorLow.price) {
      events.push({ index: i, side: 'BULLISH', sweptLevel: priorLow.price, rule: 'low exceeds confirmed swing; close reclaims above' });
    }
  }
  return events;
}

/**
 * Conservative order-block candidate convention:
 * opposing candle immediately before a displacement candle that forms an FVG.
 * Candidate is invalidated only by a later close beyond the far edge.
 * This is not a claim that the zone represents institutional orders.
 */
export function detectOrderBlockCandidates(bars, { displacementBody = 1, maxGap = 1, strength = 2 } = {}) {
  if (!validBars(bars) || !Number.isFinite(displacementBody) || displacementBody < 0 || !Number.isInteger(maxGap) || maxGap < 0 || !Number.isInteger(strength) || strength < 1) return [];
  const gaps = detectFairValueGaps(bars);
  const blocks = [];
  for (const gap of gaps) {
    const impulseIndex = gap.index - 1;
    const impulse = bars[impulseIndex];
    const body = Math.abs(impulse.close - impulse.open);
    const averageRange = bars.slice(Math.max(0, impulseIndex - 13), impulseIndex).map(b => b.high - b.low);
    const meanRange = averageRange.length ? averageRange.reduce((a, b) => a + b, 0) / averageRange.length : 0;
    if (!(meanRange > 0 && body >= meanRange * displacementBody)) continue;
    const previous = bars[impulseIndex - 1];
    if (!previous || impulseIndex < 1) continue;
    const prior = confirmedPivots(bars.slice(0, impulseIndex), strength);
    const swing = gap.side === 'BULLISH' ? prior.highs.at(-1) : prior.lows.at(-1);
    const brokeStructure = swing && (gap.side === 'BULLISH' ? impulse.close > swing.price && previous.close <= swing.price : impulse.close < swing.price && previous.close >= swing.price);
    if (!brokeStructure) continue;
    const start = Math.max(0, impulseIndex - maxGap - 1);
    let origin = -1;
    for (let j = impulseIndex - 1; j >= start; j--) {
      if (gap.side === 'BULLISH' ? bars[j].close < bars[j].open : bars[j].close > bars[j].open) { origin = j; break; }
    }
    if (origin < 0) continue;
    const candle = bars[origin];
    const lower = Math.min(candle.open, candle.close, candle.low);
    const upper = Math.max(candle.open, candle.close, candle.high);
    const later = bars.slice(gap.index + 1);
    const invalidatedOffset = later.findIndex(b => gap.side === 'BULLISH' ? b.close < lower : b.close > upper);
    const invalidated = invalidatedOffset >= 0;
    blocks.push({ index: origin, impulseIndex, fvgIndex: gap.index, side: gap.side, lower, upper, status: invalidated ? 'INVALIDATED' : 'CANDIDATE', invalidatedAt: invalidated ? gap.index + 1 + invalidatedOffset : null });
  }
  return blocks;
}


/**
 * Breaker block convention: an OB fails by close through its far edge,
 * an opposite-direction structure break occurs, and price retests/rejects the old zone.
 */
export function detectBreakerBlocks(bars, options = {}) {
  if (!validBars(bars)) return [];
  const blocks = detectOrderBlockCandidates(bars, options);
  const structure = detectStructureBreaks(bars, options);
  const out = [];
  for (const ob of blocks.filter(x => x.status === 'INVALIDATED' && Number.isInteger(x.invalidatedAt))) {
    const side = ob.side === 'BULLISH' ? 'BEARISH' : 'BULLISH';
    const broken = structure.find(e => e.index >= ob.invalidatedAt && e.side === side);
    if (!broken) continue;
    let retestAt = null;
    for (let i = broken.index + 1; i < bars.length; i++) {
      const b = bars[i], touches = b.low <= ob.upper && b.high >= ob.lower;
      const rejects = side === 'BEARISH' ? b.close < ob.lower : b.close > ob.upper;
      if (touches && rejects) { retestAt = i; break; }
    }
    out.push({ ...ob, side, type: 'BREAKER', structureBreakAt: broken.index, retestAt, status: retestAt == null ? 'FORMED_WAITING_RETEST' : 'RETEST_CONFIRMED' });
  }
  return out;
}

/**
 * Inducement proxy: first confirmed countertrend pivot after a BOS.
 * A later wick through with close back inside marks SWEPT. Intent cannot be inferred from OHLC.
 */
export function detectInducements(bars, { strength = 2 } = {}) {
  if (!validBars(bars)) return [];
  const pivots = confirmedPivots(bars, strength), events = detectStructureBreaks(bars, { strength }), out = [];
  for (const event of events.filter(e => e.type === 'BOS')) {
    const candidates = event.side === 'BULLISH' ? pivots.lows : pivots.highs;
    const pivot = candidates.find(p => p.index > event.index && p.confirmedAt < bars.length);
    if (!pivot) continue;
    const opposingBreak = events.find(e => e.index > event.index && e.side !== event.side);
    if (opposingBreak && opposingBreak.index < pivot.confirmedAt) continue;
    let status = 'CANDIDATE', sweptAt = null, invalidatedAt = null;
    for (let i = pivot.confirmedAt + 1; i < bars.length; i++) {
      const b = bars[i];
      const swept = event.side === 'BULLISH' ? b.low < pivot.price && b.close > pivot.price : b.high > pivot.price && b.close < pivot.price;
      const broken = event.side === 'BULLISH' ? b.close < pivot.price : b.close > pivot.price;
      if (swept) { status = 'SWEPT'; sweptAt = i; break; }
      if (broken) { status = 'INVALIDATED'; invalidatedAt = i; break; }
    }
    out.push({ side: event.side, bosAt: event.index, index: pivot.index, confirmedAt: pivot.confirmedAt, price: pivot.price, status, sweptAt, invalidatedAt });
  }
  return out;
}

/** Support-break/retest = SBR; resistance-break/retest = RBS. These are role reversals, not breaker blocks. */
export function detectRoleReversals(bars, { strength = 2 } = {}) {
  if (!validBars(bars)) return [];
  const pivots = confirmedPivots(bars, strength), out = [];
  for (const p of pivots.lows) {
    let brokenAt = -1;
    for (let i = p.confirmedAt + 1; i < bars.length; i++) if (bars[i].close < p.price) { brokenAt = i; break; }
    if (brokenAt < 0) continue;
    for (let i = brokenAt + 1; i < bars.length; i++) {
      if (bars[i].high >= p.price && bars[i].close < p.price) { out.push({ type: 'SBR', side: 'BEARISH', level: p.price, pivotAt: p.index, brokenAt, retestAt: i }); break; }
    }
  }
  for (const p of pivots.highs) {
    let brokenAt = -1;
    for (let i = p.confirmedAt + 1; i < bars.length; i++) if (bars[i].close > p.price) { brokenAt = i; break; }
    if (brokenAt < 0) continue;
    for (let i = brokenAt + 1; i < bars.length; i++) {
      if (bars[i].low <= p.price && bars[i].close > p.price) { out.push({ type: 'RBS', side: 'BULLISH', level: p.price, pivotAt: p.index, brokenAt, retestAt: i }); break; }
    }
  }
  return out.sort((a, b) => a.retestAt - b.retestAt);
}

/** iFVG proxy: close through the far edge, then retest and rejection in the flipped direction. */
export function detectInvertedFairValueGaps(bars, options = {}) {
  if (!validBars(bars)) return [];
  const gaps = detectFairValueGaps(bars, options), out = [];
  for (const gap of gaps) {
    let flippedAt = -1;
    for (let i = gap.index + 1; i < bars.length; i++) {
      if (gap.side === 'BULLISH' ? bars[i].close < gap.lower : bars[i].close > gap.upper) { flippedAt = i; break; }
    }
    if (flippedAt < 0) continue;
    const side = gap.side === 'BULLISH' ? 'BEARISH' : 'BULLISH';
    let retestAt = null;
    for (let i = flippedAt + 1; i < bars.length; i++) {
      const b = bars[i], touches = b.low <= gap.upper && b.high >= gap.lower;
      const rejects = side === 'BEARISH' ? b.close < gap.lower : b.close > gap.upper;
      if (touches && rejects) { retestAt = i; break; }
    }
    out.push({ ...gap, type: 'IFVG', side, flippedAt, retestAt, status: retestAt == null ? 'FLIPPED_WAITING_RETEST' : 'RETEST_CONFIRMED' });
  }
  return out;
}
