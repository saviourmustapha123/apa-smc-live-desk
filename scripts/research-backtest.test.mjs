import test from 'node:test';
import assert from 'node:assert/strict';
import { runResearchBacktest } from './research-backtest.mjs';

const bars = (...rows) => rows.map((r, i) => ({ time: i + 1, open: r[0], high: r[1], low: r[2], close: r[3] }));
const costs = { totalCostR: 0.05 };

test('enters on the next bar open and records a target outcome after costs', () => {
  const result = runResearchBacktest({
    bars: bars([100,101,99,100],[100,104,99,103],[103,113,102,112]),
    signals: [{ id:'a', signalIndex:0, side:'LONG', stop:97, target:109 }],
    costs
  });
  assert.equal(result.closedTrades, 1);
  assert.equal(result.trades[0].entry, 100);
  assert.equal(result.trades[0].exitReason, 'TARGET');
  assert.equal(result.trades[0].grossR, 3);
  assert.equal(result.trades[0].netR, 2.95);
});

test('conservatively counts stop when stop and target touch in the same candle', () => {
  const result = runResearchBacktest({
    bars: bars([100,101,99,100],[100,110,96,104]),
    signals: [{ signalIndex:0, side:'LONG', stop:97, target:109 }],
    costs
  });
  assert.equal(result.trades[0].exitReason, 'STOP_AND_TARGET_SAME_BAR_STOP_FIRST');
  assert.equal(result.trades[0].netR, -1.05);
});

test('rejects setups below 1:3 based on the next-open fill price', () => {
  const result = runResearchBacktest({
    bars: bars([100,101,99,100],[102,105,101,104],[104,106,103,105]),
    signals: [{ signalIndex:0, side:'LONG', stop:99, target:110 }],
    costs
  });
  assert.equal(result.rejectedSignals, 1);
  assert.match(result.trades[0].reason, /below minimum/);
});

test('requires explicit transaction-cost assumption', () => {
  assert.throws(() => runResearchBacktest({
    bars: bars([100,101,99,100],[100,104,99,103]),
    signals: [], costs: {}
  }), /explicit costs/);
});

test('does not count trades still open at the end of available data as closed', () => {
  const result = runResearchBacktest({
    bars: bars([100,101,99,100],[100,102,99,101],[101,102,98,100]),
    signals: [{ signalIndex:0, side:'LONG', stop:97, target:109 }],
    costs
  });
  assert.equal(result.closedTrades, 0);
  assert.equal(result.unresolvedAtDataEnd, 1);
  assert.equal(result.expectancyR, null);
});

test('blocks malformed OHLC and enforces the 1:3 floor', () => {
  assert.throws(() => runResearchBacktest({
    bars: [{ time:1, open:10, high:9, low:8, close:10 }, { time:2, open:10, high:11, low:9, close:10 }],
    signals: [], costs
  }), /valid/);
  assert.throws(() => runResearchBacktest({
    bars: bars([100,101,99,100],[100,101,99,100]),
    signals: [], costs, minimumRiskReward: 2
  }), /at least 3/);
});
