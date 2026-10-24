import test from 'node:test';
import assert from 'node:assert/strict';
import { pivots, atr, qualifiesRiskReward, simulate } from './strategy-core.mjs';

function bar(time, open, high, low, close) {
  return {time, open, high, low, close};
}

test('pivot detector finds a confirmed swing high and low', () => {
  const bars = [
    bar(1, 5, 6, 4, 5),
    bar(2, 6, 8, 5, 7),
    bar(3, 7, 10, 6, 8),
    bar(4, 8, 15, 7, 9),
    bar(5, 9, 11, 5, 7),
    bar(6, 7, 9, 2, 4),
    bar(7, 4, 7, 3, 5),
    bar(8, 5, 6, 4, 5),
  ];
  const found = pivots(bars, 2);
  assert.ok(found.highs.some(p => p.i === 3 && p.p === 15));
  assert.ok(found.lows.some(p => p.i === 5 && p.p === 2));
});

test('pivot detector does not mark unconfirmed right-edge candles', () => {
  const bars = [
    bar(1, 5, 6, 4, 5),
    bar(2, 6, 7, 5, 6),
    bar(3, 6, 8, 5, 7),
    bar(4, 7, 9, 6, 8),
    bar(5, 8, 10, 7, 9),
    bar(6, 9, 20, 8, 19),
  ];
  const found = pivots(bars, 2);
  assert.equal(found.highs.some(p => p.i === 5), false);
});

test('ATR returns null without enough bars and a finite value with sufficient bars', () => {
  const short = Array.from({length: 10}, (_, i) => bar(i+1, 10, 11, 9, 10));
  assert.equal(atr(short, 14), null);
  const enough = Array.from({length: 16}, (_, i) => bar(i+1, 10, 12, 9, 11));
  assert.equal(atr(enough, 14), 3);
});

test('minimum reward/risk gate rejects values below 3 and accepts 3 or higher', () => {
  assert.equal(qualifiesRiskReward(2.99), false);
  assert.equal(qualifiesRiskReward(3), true);
  assert.equal(qualifiesRiskReward(4.25), true);
  assert.equal(qualifiesRiskReward(Number.NaN), false);
  assert.equal(qualifiesRiskReward(Infinity), false);
});

test('simulator records a target win when target is reached first', () => {
  const bars = [
    bar(1, 100, 101, 99, 100),
    bar(2, 100, 116, 99, 114),
  ];
  const result = simulate(bars, {index:0,side:'BUY',entry:100,sl:95,tp:115,rr:3});
  assert.equal(result.result, 'WIN');
  assert.equal(result.r, 3);
  assert.equal(result.entry, 100);
  assert.equal(result.rr, 3);
});

test('simulator records a stop loss when stop is reached', () => {
  const bars = [
    bar(1, 100, 101, 99, 100),
    bar(2, 100, 104, 94, 96),
  ];
  const result = simulate(bars, {index:0,side:'BUY',entry:100,sl:95,tp:115,rr:3});
  assert.equal(result.result, 'LOSS');
  assert.equal(result.r, -1);
  assert.equal(result.entry, 100);
});

test('simulator conservatively assumes stop first when both levels are touched in one candle', () => {
  const bars = [
    bar(1, 100, 101, 99, 100),
    bar(2, 100, 116, 94, 105),
  ];
  const result = simulate(bars, {index:0,side:'BUY',entry:100,sl:95,tp:115,rr:3});
  assert.equal(result.result, 'LOSS (both levels touched; stop-first assumption)');
  assert.equal(result.r, -1);
});

test('simulator leaves a trade unresolved when neither level is reached', () => {
  const bars = [
    bar(1, 100, 101, 99, 100),
    bar(2, 100, 110, 96, 105),
  ];
  const result = simulate(bars, {index:0,side:'BUY',entry:100,sl:95,tp:115,rr:3});
  assert.equal(result.result, 'UNRESOLVED');
  assert.equal(result.r, null);
});

test('simulator uses next candle open and skips a gap that breaks the 1:3 gate', () => {
  const bars = [bar(1, 100, 101, 99, 100), bar(2, 103, 104, 102, 103)];
  const result = simulate(bars, {index:0,side:'BUY',entry:100,sl:95,tp:115,rr:3});
  assert.equal(result.result, 'SKIPPED (next-open entry fails 1:3 gate)');
  assert.equal(result.entry, 103);
  assert.ok(result.rr < 3);
});

test('simulator skips an entry if the next open is already beyond its stop', () => {
  const bars = [bar(1, 100, 101, 99, 100), bar(2, 90, 96, 89, 92)];
  const result = simulate(bars, {index:0,side:'BUY',entry:100,sl:95,tp:115,rr:3});
  assert.equal(result.result, 'SKIPPED (next-open entry fails 1:3 gate)');
});

test('equal swing highs use deterministic earliest-pivot tie handling', () => {
  const bars = [
    bar(1, 5, 6, 4, 5),
    bar(2, 6, 10, 5, 8),
    bar(3, 7, 10, 6, 8),
    bar(4, 8, 9, 7, 8),
    bar(5, 8, 8, 7.5, 8),
    bar(6, 8, 8, 7.5, 8)
  ];
  const found = pivots(bars, 1);
  assert.equal(found.highs.filter(p => p.p === 10).length, 1);
  assert.equal(found.highs.find(p => p.p === 10).i, 1);
  assert.equal(found.highs.find(p => p.p === 10).known_at, 3);
});

test('simulator does not inspect candles beyond maxForwardBars', () => {
  const bars = [
    bar(1, 100, 101, 99, 100),
    bar(2, 100, 110, 96, 105),
    bar(3, 105, 116, 100, 114)
  ];
  const result = simulate(bars, {index:0,side:'BUY',sl:95,tp:115}, 1);
  assert.equal(result.result, 'UNRESOLVED');
});

test('simulator processes a gap through the stop before the later candle range', () => {
  const bars = [
    bar(1, 100, 101, 99, 100),
    bar(2, 100, 101, 99, 100),
    bar(3, 94, 116, 90, 110)
  ];
  const result = simulate(bars, {index:0,side:'BUY',sl:95,tp:115}, 2);
  assert.equal(result.result, 'LOSS (gap through stop)');
  assert.equal(result.r, -1.2);
});

test('simulator rejects invalid inputs and minimum reward-to-risk below 3', () => {
  assert.equal(simulate([], {index:0,side:'BUY',sl:95,tp:115}).result, 'UNRESOLVED');
  assert.equal(simulate([bar(1,100,101,99,100)], {index:0,side:'BUY',sl:95,tp:115}, 100, 2).result, 'INVALID INPUT');
});

