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
    for (let j = i - strength; j <= i + strength; j++) {
      if (j === i) continue;
      if (bars[j].high >= bars[i].high) isHigh = false;
      if (bars[j].low <= bars[i].low) isLow = false;
    }
    if (isHigh) highs.push({ index: i, price: bars[i].high, confirmedAt: i + strength });
    if (isLow) lows.push({ index: i, price: bars[i].low, confirmedAt: i + strength });
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
    const future = bars.slice(gap.index + 1);
    const touched = future.some(b => b.low <= gap.upper && b.high >= gap.lower);
    return { ...gap, status: touched ? 'MITIGATED' : 'OPEN' };
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
export function detectOrderBlockCandidates(bars, { displacementBody = 1, maxGap = 1 } = {}) {
  if (!validBars(bars) || !Number.isFinite(displacementBody) || displacementBody < 0 || !Number.isInteger(maxGap) || maxGap < 0) return [];
  const gaps = detectFairValueGaps(bars);
  const blocks = [];
  for (const gap of gaps) {
    const impulseIndex = gap.index - 1;
    const impulse = bars[impulseIndex];
    const body = Math.abs(impulse.close - impulse.open);
    const averageRange = bars.slice(Math.max(0, impulseIndex - 13), impulseIndex).map(b => b.high - b.low);
    const meanRange = averageRange.length ? averageRange.reduce((a, b) => a + b, 0) / averageRange.length : 0;
    if (!(meanRange > 0 && body >= meanRange * displacementBody)) continue;
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
    const invalidated = later.some(b => gap.side === 'BULLISH' ? b.close < lower : b.close > upper);
    blocks.push({ index: origin, impulseIndex, fvgIndex: gap.index, side: gap.side, lower, upper, status: invalidated ? 'INVALIDATED' : 'CANDIDATE' });
  }
  return blocks;
}
