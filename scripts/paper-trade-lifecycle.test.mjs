import test from 'node:test';
import assert from 'node:assert/strict';
import { applyCandlesToTrade, summarizePaperTrades } from './paper-trade-lifecycle.mjs';

function pending(overrides = {}) {
  return {
    id: 'EURUSD|5m|100|BUY',
    symbol: 'EURUSD', tf: '5m', side: 'BUY',
    entry: 100, sl: 98, tp: 106, rr: 3,
    signalTime: 0, lastProcessedBarTime: 0, barsObserved: 0,
    status: 'NOT RUNNING', outcome: 'PENDING',
    ...overrides
  };
}
const candle = (time, low, high, open = 100, close = 100) => ({ time, low, high, open, close });

test('pending paper trade fills then records a target win at planned R', () => {
  let trade = applyCandlesToTrade(pending(), [candle(1, 99, 101), candle(2, 100, 106)]);
  assert.equal(trade.status, 'SUCCESSFUL');
  assert.equal(trade.outcome, 'WIN');
  assert.equal(trade.resultR, 3);
  assert.equal(trade.entryTime, 1);
  assert.equal(trade.exitTime, 2);
});

test('target reached before entry is missed, not a win or loss', () => {
  const trade = applyCandlesToTrade(pending(), [candle(1, 104, 107, 105, 106)]);
  assert.equal(trade.status, 'MISSED ENTRY');
  assert.equal(trade.resultR, null);
});

test('stop reached before entry invalidates the setup without counting a loss', () => {
  const trade = applyCandlesToTrade(pending(), [candle(1, 97, 99, 98, 98)]);
  assert.equal(trade.status, 'INVALIDATED');
  assert.equal(trade.resultR, null);
});

test('entry and target touched in the same OHLC candle is not falsely counted as a win', () => {
  const trade = applyCandlesToTrade(pending(), [candle(1, 99, 106, 105, 100)]);
  assert.equal(trade.status, 'MISSED ENTRY');
  assert.match(trade.outcome, /AMBIGUOUS/);
  assert.equal(trade.resultR, null);
});

test('stop and target both touched after fill resolves conservatively as a loss', () => {
  const trade = applyCandlesToTrade(pending(), [candle(1, 99, 101), candle(2, 97, 106)]);
  assert.equal(trade.status, 'UNSUCCESSFUL');
  assert.equal(trade.resultR, -1);
});

test('pending setup expires without being counted as a loss', () => {
  const trade = applyCandlesToTrade(pending(), [candle(1, 102, 104), candle(2, 102, 104)], { maxForwardBars: 2 });
  assert.equal(trade.status, 'EXPIRED');
  assert.equal(trade.resultR, null);
});

test('summary keeps missed, invalidated, and unresolved setups out of win-rate denominator', () => {
  const trades = [
    pending({ status: 'SUCCESSFUL', resultR: 3 }),
    pending({ status: 'UNSUCCESSFUL', resultR: -1 }),
    pending({ status: 'MISSED ENTRY', resultR: null }),
    pending({ status: 'INVALIDATED', resultR: null }),
    pending({ status: 'UNRESOLVED', resultR: null })
  ];
  const summary = summarizePaperTrades(trades);
  assert.equal(summary.resolved, 2);
  assert.equal(summary.winRate, 50);
  assert.equal(summary.netR, 2);
  assert.equal(summary.missed, 1);
  assert.equal(summary.invalidated, 1);
  assert.equal(summary.unresolved, 1);
});

test('pending order is marked missed if target was already touched on its signal candle', () => {
  const trade = applyCandlesToTrade(pending({ signalTime: 1, lastProcessedBarTime: 1 }), [
    candle(1, 99, 107, 100, 104),
    candle(2, 99, 101)
  ]);
  assert.equal(trade.status, 'MISSED ENTRY');
  assert.match(trade.outcome, /signal candle/i);
  assert.equal(trade.resultR, null);
});
