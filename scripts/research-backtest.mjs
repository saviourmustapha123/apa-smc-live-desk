/**
 * Chronological OHLC trade simulator for research experiments.
 *
 * Signals are known only at signalIndex close and enter at the next candle open.
 * If stop and target are both touched inside one candle, stop wins (conservative).
 * Costs must be explicitly supplied as total cost in units of initial risk (R).
 * This is a simulator, not a complete strategy evaluator or profitability claim.
 */

function validBars(bars) {
  return Array.isArray(bars) && bars.length >= 2 && bars.every((bar, i) =>
    bar && [bar.open, bar.high, bar.low, bar.close].every(Number.isFinite) &&
    bar.high >= Math.max(bar.open, bar.close, bar.low) &&
    bar.low <= Math.min(bar.open, bar.close, bar.high) &&
    (i === 0 || (bar.time == null || bars[i - 1].time == null || bar.time > bars[i - 1].time))
  );
}

export function runResearchBacktest({ bars, signals, costs, minimumRiskReward = 3 }) {
  if (!validBars(bars)) throw new TypeError('At least two valid, chronological OHLC bars are required.');
  if (!Array.isArray(signals)) throw new TypeError('signals must be an array.');
  if (!costs || !Number.isFinite(costs.totalCostR) || costs.totalCostR < 0) {
    throw new TypeError('Provide explicit costs.totalCostR >= 0; costs are never silently assumed.');
  }
  if (!Number.isFinite(minimumRiskReward) || minimumRiskReward < 3) {
    throw new RangeError('Minimum reward/risk must be at least 3.');
  }

  const ordered = [...signals].sort((a, b) => a.signalIndex - b.signalIndex);
  const trades = [];
  let busyUntil = -1;
  for (const signal of ordered) {
    if (!signal || !Number.isInteger(signal.signalIndex) ||
        signal.signalIndex < 0 || signal.signalIndex >= bars.length - 1 ||
        !['LONG', 'SHORT'].includes(signal.side) ||
        !Number.isFinite(signal.stop) || !Number.isFinite(signal.target)) {
      trades.push({ signalId: signal?.id ?? null, status: 'REJECTED', reason: 'Malformed signal or no next candle available.' });
      continue;
    }
    if (signal.signalIndex < busyUntil) {
      trades.push({ signalId: signal.id ?? null, status: 'REJECTED', reason: 'Overlapping trade blocked by single-position research policy.' });
      continue;
    }

    const entryIndex = signal.signalIndex + 1;
    const entry = bars[entryIndex].open;
    const risk = signal.side === 'LONG' ? entry - signal.stop : signal.stop - entry;
    const reward = signal.side === 'LONG' ? signal.target - entry : entry - signal.target;
    const rr = risk > 0 ? reward / risk : -Infinity;
    if (!(risk > 0 && reward > 0 && rr >= minimumRiskReward)) {
      trades.push({ signalId: signal.id ?? null, status: 'REJECTED', reason: 'Invalid structural levels or achievable reward/risk below minimum.', entry, risk, reward, rr });
      continue;
    }

    let exitIndex = -1, exitPrice = null, exitReason = null, grossR = null;
    for (let i = entryIndex; i < bars.length; i++) {
      const bar = bars[i];
      // Resolve opening gaps before using the candle's later high/low. Otherwise
      // a gap through the stop can be incorrectly reported as a normal -1R loss.
      if (signal.side === 'LONG' && bar.open <= signal.stop || signal.side === 'SHORT' && bar.open >= signal.stop) {
        exitIndex = i; exitPrice = bar.open; exitReason = 'GAP_THROUGH_STOP';
        grossR = signal.side === 'LONG' ? (exitPrice - entry) / risk : (entry - exitPrice) / risk; break;
      }
      if (signal.side === 'LONG' && bar.open >= signal.target || signal.side === 'SHORT' && bar.open <= signal.target) {
        exitIndex = i; exitPrice = signal.target; exitReason = 'TARGET_AT_OPEN';
        grossR = rr; break;
      }
      const stopHit = signal.side === 'LONG' ? bar.low <= signal.stop : bar.high >= signal.stop;
      const targetHit = signal.side === 'LONG' ? bar.high >= signal.target : bar.low <= signal.target;
      if (stopHit && targetHit) {
        exitIndex = i; exitPrice = signal.stop; exitReason = 'STOP_AND_TARGET_SAME_BAR_STOP_FIRST'; grossR = -1; break;
      }
      if (stopHit) { exitIndex = i; exitPrice = signal.stop; exitReason = 'STOP'; grossR = -1; break; }
      if (targetHit) { exitIndex = i; exitPrice = signal.target; exitReason = 'TARGET'; grossR = rr; break; }
    }
    if (exitIndex < 0) {
      trades.push({ signalId: signal.id ?? null, status: 'OPEN_AT_DATA_END', signalIndex: signal.signalIndex, entryIndex, entry, stop: signal.stop, target: signal.target, rr });
      busyUntil = bars.length;
      continue;
    }
    const netR = grossR - costs.totalCostR;
    trades.push({
      signalId: signal.id ?? null, status: 'CLOSED', side: signal.side,
      signalIndex: signal.signalIndex, entryIndex, exitIndex, entry,
      stop: signal.stop, target: signal.target, exitPrice, exitReason,
      initialRisk: risk, plannedRewardRisk: rr, grossR, costR: costs.totalCostR, netR
    });
    busyUntil = exitIndex;
  }

  const closed = trades.filter(t => t.status === 'CLOSED');
  const wins = closed.filter(t => t.netR > 0);
  const losses = closed.filter(t => t.netR < 0);
  const grossProfit = wins.reduce((sum, t) => sum + t.netR, 0);
  const grossLoss = -losses.reduce((sum, t) => sum + t.netR, 0);
  let equity = 0, peak = 0, maxDrawdownR = 0;
  for (const trade of closed) {
    equity += trade.netR;
    peak = Math.max(peak, equity);
    maxDrawdownR = Math.max(maxDrawdownR, peak - equity);
  }
  return {
    schemaVersion: 1,
    method: 'next-open entry; chronological OHLC; stop-first ambiguous bars; explicit costs',
    barsTested: bars.length,
    signalsSubmitted: signals.length,
    closedTrades: closed.length,
    rejectedSignals: trades.filter(t => t.status === 'REJECTED').length,
    unresolvedAtDataEnd: trades.filter(t => t.status === 'OPEN_AT_DATA_END').length,
    winRate: closed.length ? wins.length / closed.length : null,
    expectancyR: closed.length ? closed.reduce((sum, t) => sum + t.netR, 0) / closed.length : null,
    profitFactor: grossLoss > 0 ? grossProfit / grossLoss : (grossProfit > 0 ? null : null),
    maxDrawdownR,
    netR: closed.reduce((sum, t) => sum + t.netR, 0),
    costsAssumption: { totalCostR: costs.totalCostR },
    trades
  };
}
