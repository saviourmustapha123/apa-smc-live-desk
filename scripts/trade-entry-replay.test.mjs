import test from 'node:test';
import assert from 'node:assert/strict';
import { executeSignal } from './trade-entry-replay.mjs';

const signal = (overrides = {}) => ({ side: 'BUY', entry: 100, sl: 95, tp: 115, rr: 3, ...overrides });
const bar = (time, open, high, low, close) => ({ time, open, high, low, close });
const signalBar = bar(60, 102, 104, 101, 103);

test('1-minute replay waits until a later candle to trigger a pending entry', () => {
  const bars = [
    signalBar,
    bar(120, 101, 102, 99, 100),
    bar(180, 102, 116, 101, 114)
  ];
  const result = executeSignal(signal(), bars, 0);
  assert.equal(result.outcome, 'WIN');
  assert.equal(result.triggered, true);
  assert.equal(result.entryTime, 120);
  assert.equal(result.exitTime, 180);
  assert.equal(result.r, 3);
});

test('an entry already crossed on the signal candle is marked missed, not filled retrospectively', () => {
  const bars = [bar(60, 102, 104, 99, 103), bar(120, 101, 116, 99, 114)];
  const result = executeSignal(signal(), bars, 0);
  assert.match(result.outcome, /MISSED ENTRY.*entry already touched on signal candle/);
  assert.equal(result.triggered, false);
  assert.equal(result.r, null);
});

test('a pending order invalidated by the stop before entry is not counted as a trade', () => {
  const bars = [signalBar, bar(120, 94, 101, 93, 96), bar(180, 100, 102, 99, 101)];
  const result = executeSignal(signal(), bars, 0);
  assert.equal(result.outcome, 'INVALIDATED BEFORE ENTRY');
  assert.equal(result.triggered, false);
  assert.equal(result.r, null);
});

test('a triggered order that later hits its stop records a loss at the stop level', () => {
  const bars = [signalBar, bar(120, 101, 102, 99, 100), bar(180, 100, 101, 94, 96)];
  const result = executeSignal(signal(), bars, 0);
  assert.equal(result.outcome, 'LOSS');
  assert.equal(result.triggered, true);
  assert.equal(result.entryTime, 120);
  assert.equal(result.r, -1);
});

test('when stop and target are both touched in one candle, replay conservatively records stop first', () => {
  const bars = [signalBar, bar(120, 100, 116, 94, 105)];
  const result = executeSignal(signal(), bars, 0);
  assert.equal(result.outcome, 'LOSS (same-candle ambiguity; stop-first)');
  assert.equal(result.r, -1);
});

test('the entry replay rejects any setup below the required 1:3 reward-risk ratio', () => {
  const result = executeSignal(signal({ tp: 114.9 }), [signalBar, bar(120, 101, 102, 99, 100)], 0);
  assert.equal(result.outcome, 'REJECTED INVALID LEVELS/RR');
  assert.equal(result.triggered, false);
});

test('short entries use the same later-candle trigger and TP outcome rules', () => {
  const short = signal({ side: 'SELL', entry: 100, sl: 105, tp: 85 });
  const bars = [bar(60, 98, 99, 96, 97), bar(120, 99, 101, 98, 100), bar(180, 99, 100, 84, 86)];
  const result = executeSignal(short, bars, 0);
  assert.equal(result.outcome, 'WIN');
  assert.equal(result.entryTime, 120);
  assert.equal(result.exitTime, 180);
  assert.equal(result.r, 3);
});
