const MIN_RR = 3;
const MAX_FORWARD_BARS = 100;

/**
 * Candle-by-candle order lifecycle replay shared by the production history
 * backtest and deterministic entry/exit regression tests.
 * A signal becomes available only after its signal candle closes.
 */
export function executeSignal(signal, bars, index) {
  const riskAtPlannedEntry = signal.side === 'BUY' ? signal.entry - signal.sl : signal.sl - signal.entry;
  const plannedReward = signal.side === 'BUY' ? signal.tp - signal.entry : signal.entry - signal.tp;
  if (!(riskAtPlannedEntry > 0 && plannedReward > 0 && plannedReward / riskAtPlannedEntry >= MIN_RR)) return { outcome: 'REJECTED INVALID LEVELS/RR', r: null, triggered: false };
  const signalBar = bars[index];
  let triggeredAt = -1;
  let entry = signal.entry;
  let risk = riskAtPlannedEntry;
  let rr = plannedReward / riskAtPlannedEntry;
  if (signal.entryType === 'MARKET_CLOSE') {
    // The signal is only known after its candle closes. Replay a market-style
    // candidate at the next candle open; never mark its own close as a missed limit fill.
    const fillBar = bars[index + 1];
    if (!fillBar) return { outcome: 'UNRESOLVED (no post-signal candle)', r: null, triggered: false };
    const stopGapAtOpen = signal.side === 'BUY' ? fillBar.open <= signal.sl : fillBar.open >= signal.sl;
    const targetGapAtOpen = signal.side === 'BUY' ? fillBar.open >= signal.tp : fillBar.open <= signal.tp;
    if (stopGapAtOpen) return { outcome: 'INVALIDATED BEFORE ENTRY', r: null, triggered: false, exitTime: fillBar.time };
    if (targetGapAtOpen) return { outcome: 'MISSED ENTRY (target reached before market fill)', r: null, triggered: false, exitTime: fillBar.time };
    entry = fillBar.open;
    risk = signal.side === 'BUY' ? entry - signal.sl : signal.sl - entry;
    const reward = signal.side === 'BUY' ? signal.tp - entry : entry - signal.tp;
    rr = risk > 0 ? reward / risk : NaN;
    if (!(Number.isFinite(rr) && rr >= MIN_RR)) {
      return { outcome: 'REJECTED GAP REDUCED RR', r: null, triggered: false, exitTime: fillBar.time, entry };
    }
    triggeredAt = index + 1;
  } else {
    const targetTouchedBeforeOrderWasActive = signal.side === 'BUY'
      ? signalBar.high >= signal.tp
      : signalBar.low <= signal.tp;
    const entryTouchedBeforeOrderWasActive = signalBar.low <= signal.entry && signalBar.high >= signal.entry;
    if (targetTouchedBeforeOrderWasActive || entryTouchedBeforeOrderWasActive) {
      const reason = targetTouchedBeforeOrderWasActive
        ? 'target already touched on signal candle'
        : 'entry already touched on signal candle';
      return { outcome: 'MISSED ENTRY (' + reason + ')', r: null, triggered: false, exitTime: signalBar.time };
    }
  }
  for (let i = triggeredAt >= 0 ? bars.length : index + 1; i < Math.min(bars.length, index + 1 + MAX_FORWARD_BARS); i++) {
    const b = bars[i];
    // A gap already beyond the stop invalidates an unfilled pending order before
    // considering any later intrabar touch of the entry level.
    const stopGapAtOpen = signal.side === 'BUY' ? b.open <= signal.sl : b.open >= signal.sl;
    if (stopGapAtOpen) return { outcome: 'INVALIDATED BEFORE ENTRY', r: null, triggered: false, exitTime: b.time };
    const entryTouched = b.low <= signal.entry && b.high >= signal.entry;
    const stopTouched = signal.side === 'BUY' ? b.low <= signal.sl : b.high >= signal.sl;
    const targetTouched = signal.side === 'BUY' ? b.high >= signal.tp : b.low <= signal.tp;
    if (entryTouched && targetTouched && !stopTouched) return { outcome: 'MISSED / AMBIGUOUS ENTRY-TP ORDER IN SAME CANDLE', r: null, triggered: false, exitTime: b.time };
    if (stopTouched && !entryTouched) return { outcome: 'INVALIDATED BEFORE ENTRY', r: null, triggered: false, exitTime: b.time };
    if (targetTouched && !entryTouched) return { outcome: 'MISSED ENTRY (target reached first)', r: null, triggered: false, exitTime: b.time };
    if (entryTouched) { triggeredAt = i; break; }
  }
  if (triggeredAt < 0) {
    const horizon = Math.min(bars.length, index + 1 + MAX_FORWARD_BARS);
    if (horizon >= bars.length) return { outcome: 'UNRESOLVED (data ended)', r: null, triggered: false };
    return { outcome: 'MISSED ENTRY / NOT FILLED', r: null, triggered: false };
  }
  for (let i = triggeredAt; i < Math.min(bars.length, triggeredAt + MAX_FORWARD_BARS); i++) {
    const b = bars[i];
    const stop = signal.side === 'BUY' ? b.low <= signal.sl : b.high >= signal.sl;
    const target = signal.side === 'BUY' ? b.high >= signal.tp : b.low <= signal.tp;
    if (stop && target) return { outcome: 'LOSS (same-candle ambiguity; stop-first)', r: -1, triggered: true, entry, entryTime: bars[triggeredAt].time, exitTime: b.time };
    if (stop) {
      const exit = signal.side === 'BUY' && b.open < signal.sl ? b.open : signal.side === 'SELL' && b.open > signal.sl ? b.open : signal.sl;
      return { outcome: 'LOSS', r: ((exit-entry) * (signal.side === 'BUY' ? 1 : -1)) / risk, triggered: true, entry, entryTime: bars[triggeredAt].time, exitTime: b.time };
    }
    if (target) return { outcome: 'WIN', r: rr, triggered: true, entry, entryTime: bars[triggeredAt].time, exitTime: b.time };
  }
  return { outcome: 'UNRESOLVED (forward window)', r: null, triggered: true, entry, entryTime: bars[triggeredAt].time };
}
