export function applyCandlesToTrade(trade, bars, { maxForwardBars = 100 } = {}) {
  const next = { ...trade };
  const ordered = [...bars].sort((a, b) => a.time - b.time);
  const lastProcessed = Number.isFinite(next.lastProcessedBarTime)
    ? next.lastProcessedBarTime
    : next.signalTime;

  for (const bar of ordered) {
    if (bar.time <= lastProcessed) continue;
    if (!['NOT RUNNING', 'ACTIVE'].includes(next.status)) break;

    const entryTouched = bar.low <= next.entry && bar.high >= next.entry;
    const stopTouched = next.side === 'BUY' ? bar.low <= next.sl : bar.high >= next.sl;
    const targetTouched = next.side === 'BUY' ? bar.high >= next.tp : bar.low <= next.tp;

    if (next.status === 'NOT RUNNING') {
      if (entryTouched && targetTouched && !stopTouched) {
        next.status = 'MISSED ENTRY';
        next.outcome = 'AMBIGUOUS ENTRY/TP ORDER IN SAME CANDLE';
        next.exitTime = bar.time;
        next.resultR = null;
      } else if (stopTouched && !entryTouched) {
        next.status = 'INVALIDATED';
        next.outcome = 'STOP/INVALIDATION REACHED BEFORE ENTRY';
        next.exitTime = bar.time;
        next.resultR = null;
      } else if (targetTouched && !entryTouched) {
        next.status = 'MISSED ENTRY';
        next.outcome = 'TARGET REACHED BEFORE ENTRY';
        next.exitTime = bar.time;
        next.resultR = null;
      } else if (entryTouched) {
        next.status = 'ACTIVE';
        next.outcome = 'RUNNING';
        next.entryTime = bar.time;
        if (stopTouched && targetTouched) {
          next.status = 'UNSUCCESSFUL';
          next.outcome = 'LOSS (SAME-CANDLE AMBIGUITY; STOP-FIRST)';
          next.exitTime = bar.time;
          next.resultR = -1;
        } else if (stopTouched) {
          next.status = 'UNSUCCESSFUL';
          next.outcome = 'LOSS';
          next.exitTime = bar.time;
          next.resultR = -1;
        }
      }
    } else {
      if (stopTouched && targetTouched) {
        next.status = 'UNSUCCESSFUL';
        next.outcome = 'LOSS (SAME-CANDLE AMBIGUITY; STOP-FIRST)';
        next.exitTime = bar.time;
        next.resultR = -1;
      } else if (stopTouched) {
        const risk = Math.abs(next.entry - next.sl);
        const exit = next.side === 'BUY' && bar.open < next.sl
          ? bar.open
          : next.side === 'SELL' && bar.open > next.sl
            ? bar.open
            : next.sl;
        next.status = 'UNSUCCESSFUL';
        next.outcome = 'LOSS';
        next.exitTime = bar.time;
        next.resultR = risk > 0
          ? ((exit - next.entry) * (next.side === 'BUY' ? 1 : -1)) / risk
          : -1;
      } else if (targetTouched) {
        next.status = 'SUCCESSFUL';
        next.outcome = 'WIN';
        next.exitTime = bar.time;
        const risk = Math.abs(next.entry - next.sl);
        next.resultR = risk > 0 ? Math.abs(next.tp - next.entry) / risk : null;
      }
    }

    next.lastProcessedBarTime = bar.time;
    next.barsObserved = (next.barsObserved || 0) + 1;
    if (['SUCCESSFUL', 'UNSUCCESSFUL', 'MISSED ENTRY', 'INVALIDATED'].includes(next.status)) break;

    if (next.barsObserved >= maxForwardBars) {
      if (next.status === 'NOT RUNNING') {
        next.status = 'EXPIRED';
        next.outcome = 'EXPIRED UNFILLED';
      } else if (next.status === 'ACTIVE') {
        next.status = 'UNRESOLVED';
        next.outcome = 'UNRESOLVED AFTER FORWARD WINDOW';
      }
      next.exitTime = bar.time;
      next.resultR = null;
      break;
    }
  }

  return next;
}

export function summarizePaperTrades(trades) {
  const resolved = trades.filter(t =>
    ['SUCCESSFUL', 'UNSUCCESSFUL'].includes(t.status) && Number.isFinite(t.resultR)
  );
  const wins = resolved.filter(t => t.resultR > 0);
  const losses = resolved.filter(t => t.resultR < 0);
  const netR = resolved.reduce((sum, t) => sum + t.resultR, 0);
  const grossWins = wins.reduce((sum, t) => sum + t.resultR, 0);
  const grossLosses = -losses.reduce((sum, t) => sum + t.resultR, 0);
  return {
    total: trades.length,
    pending: trades.filter(t => t.status === 'NOT RUNNING').length,
    active: trades.filter(t => t.status === 'ACTIVE').length,
    wins: wins.length,
    losses: losses.length,
    missed: trades.filter(t => t.status === 'MISSED ENTRY').length,
    invalidated: trades.filter(t => t.status === 'INVALIDATED').length,
    expired: trades.filter(t => t.status === 'EXPIRED').length,
    unresolved: trades.filter(t => t.status === 'UNRESOLVED').length,
    resolved: resolved.length,
    winRate: resolved.length ? wins.length / resolved.length * 100 : null,
    netR,
    profitFactor: grossLosses ? grossWins / grossLosses : grossWins ? Infinity : null,
    expectancyR: resolved.length ? netR / resolved.length : null
  };
}
