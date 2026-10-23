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
  assert.deepEqual(result, {result:'WIN',r:3});
});

test('simulator records a stop loss when stop is reached', () => {
  const bars = [
    bar(1, 100, 101, 99, 100),
    bar(2, 100, 104, 94, 96),
  ];
  const result = simulate(bars, {index:0,side:'BUY',entry:100,sl:95,tp:115,rr:3});
  assert.deepEqual(result, {result:'LOSS',r:-1});
});

test('simulator conservatively assumes stop first when both levels are touched in one candle', () => {
  const bars = [
    bar(1, 100, 101, 99, 100),
    bar(2, 100, 116, 94, 105),
  ];
  const result = simulate(bars, {index:0,side:'BUY',entry:100,sl:95,tp:115,rr:3});
  assert.deepEqual(result, {result:'LOSS (both levels touched; stop-first assumption)',r:-1});
});

test('simulator leaves a trade unresolved when neither level is reached', () => {
  const bars = [
    bar(1, 100, 101, 99, 100),
    bar(2, 100, 110, 96, 105),
  ];
  const result = simulate(bars, {index:0,side:'BUY',entry:100,sl:95,tp:115,rr:3});
  assert.deepEqual(result, {result:'UNRESOLVED',r:null});
});
