import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateLowKeyShift } from './book-rule-detectors.mjs';

const candles = close => [{ time: 100, open: 101, high: 102, low: 98, close }];

test('LowKey shift uses a close through the significant level, not wick-only data', () => {
  const result = evaluateLowKeyShift({
    priorTrend: 'bullish', shiftLevel: 99, reclaimLevel: 105,
    closedCandles: candles(100),
  });
  assert.equal(result.status, 'no-shift');
});

test('LowKey close-through without new structure is classified as transition', () => {
  const result = evaluateLowKeyShift({
    priorTrend: 'bullish', shiftLevel: 99, reclaimLevel: 105,
    closedCandles: candles(98), newOpposingStructureConfirmed: false,
  });
  assert.equal(result.status, 'transition');
  assert.equal(result.direction, 'bearish');
});

test('LowKey close-through becomes a confirmed shift only when structure confirmation is supplied', () => {
  const result = evaluateLowKeyShift({
    priorTrend: 'bearish', shiftLevel: 101, reclaimLevel: 95,
    closedCandles: candles(102), newOpposingStructureConfirmed: true,
  });
  assert.equal(result.status, 'confirmed-shift');
  assert.equal(result.direction, 'bullish');
});

test('LowKey reclaim takes precedence when the prior extreme is reclaimed', () => {
  const result = evaluateLowKeyShift({
    priorTrend: 'bullish', shiftLevel: 99, reclaimLevel: 105,
    closedCandles: candles(106),
  });
  assert.equal(result.status, 'reclaimed');
  assert.equal(result.direction, 'bullish');
});

test('invalid or unconfirmed input is not promoted into a signal', () => {
  assert.equal(evaluateLowKeyShift({ priorTrend: 'sideways', shiftLevel: 99, reclaimLevel: 105, closedCandles: candles(98) }).status, 'insufficient-data');
  assert.equal(evaluateLowKeyShift({ priorTrend: 'bullish', shiftLevel: 99, reclaimLevel: 105, closedCandles: [{ time: 100, close: NaN }] }).status, 'insufficient-data');
});
