/**
 * Research-only market behaviour features.
 * Uses completed OHLC bars only; it does not create trade signals or change live execution.
 * All thresholds are explicit heuristics to be evaluated out-of-sample, not claims of edge.
 */
const finite = n => Number.isFinite(n);
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

export function candleFeatures(bar, previousBars = []) {
  if (!bar || ![bar.open, bar.high, bar.low, bar.close].every(finite) ||
      bar.high < Math.max(bar.open, bar.close, bar.low) ||
      bar.low > Math.min(bar.open, bar.close, bar.high) || bar.high <= bar.low) return null;
  const range = bar.high - bar.low;
  const body = Math.abs(bar.close - bar.open);
  const upperWick = bar.high - Math.max(bar.open, bar.close);
  const lowerWick = Math.min(bar.open, bar.close) - bar.low;
  const tr = previousBars.slice(-14).map((p, i, arr) => {
    const prevClose = i ? arr[i - 1].close : p.close;
    return Math.max(p.high - p.low, Math.abs(p.high - prevClose), Math.abs(p.low - prevClose));
  }).filter(finite);
  const atr = tr.length ? tr.reduce((a,b)=>a+b,0)/tr.length : range;
  return {
    direction: bar.close > bar.open ? 'BULLISH' : bar.close < bar.open ? 'BEARISH' : 'NEUTRAL',
    range, body, bodyToRange: body / range,
    upperWickRatio: upperWick / range, lowerWickRatio: lowerWick / range,
    closePosition: (bar.close - bar.low) / range,
    atr, rangeToAtr: atr > 0 ? range / atr : 0,
    displacement: atr > 0 && body / atr >= 1.2 && body / range >= 0.6,
    suddenExpansion: atr > 0 && range / atr >= 1.8
  };
}

export function classifyMarketState(bars) {
  if (!Array.isArray(bars) || bars.length < 25) {
    return { state: 'INSUFFICIENT_DATA', confidence: 'LOW', reasons: ['Need at least 25 completed candles'] };
  }
  const valid = bars.every(b => b && [b.open,b.high,b.low,b.close].every(finite) &&
    b.high >= Math.max(b.open,b.close,b.low) && b.low <= Math.min(b.open,b.close,b.high));
  if (!valid) return { state: 'INVALID_DATA', confidence: 'LOW', reasons: ['Invalid OHLC candle geometry'] };

  const w = bars.slice(-20), latest = w[w.length-1], prior = w.slice(0,-1);
  const ranges = w.map(b=>b.high-b.low);
  const avgRange = ranges.slice(0,-1).reduce((a,b)=>a+b,0)/(ranges.length-1);
  const f = candleFeatures(latest, w.slice(0,-1));
  const hi = Math.max(...prior.map(b=>b.high)), lo = Math.min(...prior.map(b=>b.low));
  const net = latest.close - w[0].close;
  const gross = w.slice(1).reduce((s,b,i)=>s+Math.abs(b.close-w[i].close),0);
  const efficiency = gross ? Math.abs(net)/gross : 0;
  const closes = w.map(b=>b.close);
  const drift = closes[closes.length-1]-closes[0];
  const driftPct = Math.abs(drift)/(avgRange||1);
  const brokeUp = latest.close > hi, brokeDown = latest.close < lo;
  const expansion = f.rangeToAtr >= 1.8;
  const compressed = avgRange > 0 && ranges.slice(-5).reduce((a,b)=>a+b,0)/5 < avgRange*0.65;
  const reasons = [];
  let state = 'RANGE';
  if ((brokeUp || brokeDown) && expansion && f.displacement) {
    state = brokeUp ? 'BULLISH_BREAKOUT_EXPANSION' : 'BEARISH_BREAKOUT_EXPANSION';
    reasons.push('Close beyond prior 19-bar extreme', 'Range expansion and directional displacement');
  } else if (expansion && f.displacement) {
    state = 'EXPANSION';
    reasons.push('Large candle relative to ATR with strong body');
  } else if (compressed) {
    state = 'COMPRESSION';
    reasons.push('Recent ranges contracted versus baseline');
  } else if (efficiency >= 0.62 && driftPct >= 2.2) {
    state = drift > 0 ? 'UPTREND' : 'DOWNTREND';
    reasons.push('Directional movement dominates recent back-and-forth');
  } else {
    reasons.push('No sufficiently strong trend or confirmed expansion; treat as balance/uncertain');
  }
  if (f.upperWickRatio >= 0.45) reasons.push('Large upper wick: rejection risk, not proof of reversal');
  if (f.lowerWickRatio >= 0.45) reasons.push('Large lower wick: rejection risk, not proof of reversal');
  if (latest.close > hi || latest.close < lo) reasons.push('Breakout is only confirmed on candle close');
  const confidence = state === 'RANGE' || state === 'COMPRESSION' ? 'LOW_TO_MODERATE' :
    (efficiency >= 0.75 && expansion ? 'MODERATE' : 'LOW_TO_MODERATE');
  return {
    state, confidence, reasons, asOf: latest.time ?? null,
    metrics: {
      bars: w.length, efficiency: clamp(efficiency,0,1),
      averageRange: avgRange, latestRangeToAverage: avgRange ? f.range/avgRange : 0,
      bodyToRange: f.bodyToRange, upperWickRatio: f.upperWickRatio,
      lowerWickRatio: f.lowerWickRatio, closePosition: f.closePosition,
      rangeToAtr: f.rangeToAtr, displacement: f.displacement,
      suddenExpansion: f.suddenExpansion
    },
    warning: 'Descriptive market-state estimate only. Not a trade recommendation; validate thresholds out of sample.'
  };
}
