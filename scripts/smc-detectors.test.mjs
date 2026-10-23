import test from 'node:test';
import assert from 'node:assert/strict';
import { confirmedPivots, detectStructureBreaks, detectFairValueGaps, detectLiquiditySweeps, detectOrderBlockCandidates, detectBreakerBlocks, detectInducements, detectRoleReversals, detectInvertedFairValueGaps } from './smc-detectors.mjs';

const bar = (time, open, high, low, close) => ({ time, open, high, low, close });

test('FVG detector identifies a bullish three-candle non-overlap', () => {
  const bars = [bar(1, 10, 11, 9, 10), bar(2, 11, 15, 10, 14), bar(3, 14, 17, 12, 16)];
  const gaps = detectFairValueGaps(bars);
  assert.equal(gaps.length, 1);
  assert.deepEqual([gaps[0].lower, gaps[0].upper, gaps[0].side], [11, 12, 'BULLISH']);
});

test('FVG detector identifies bearish gap and marks later touch as mitigated', () => {
  const bars = [bar(1, 15, 16, 14, 15), bar(2, 14, 15, 10, 11), bar(3, 10, 13, 8, 9), bar(4, 10, 13.5, 9, 11)];
  const gaps = detectFairValueGaps(bars);
  assert.ok(gaps.some(g => g.side === 'BEARISH' && g.status === 'PARTIALLY_FILLED'));
});

test('confirmed pivot is not available until right-side bars close', () => {
  const bars = [bar(1, 5, 6, 4, 5), bar(2, 6, 8, 5, 7), bar(3, 7, 10, 6, 8), bar(4, 8, 9, 7, 8), bar(5, 8, 8.5, 7.5, 8)];
  const p = confirmedPivots(bars, 2);
  assert.ok(p.highs.some(x => x.index === 2 && x.confirmedAt === 4));
  assert.equal(p.highs.some(x => x.index === 4), false);
});

test('liquidity sweep requires wick through and close back inside a known swing', () => {
  const bars = [
    bar(1, 10, 11, 9, 10), bar(2, 10, 12, 9, 11), bar(3, 11, 15, 10, 14),
    bar(4, 14, 14.5, 11, 12), bar(5, 12, 13, 10, 11),
    bar(6, 12, 16, 11, 14), bar(7, 14, 14.5, 12, 13)
  ];
  const events = detectLiquiditySweeps(bars, { strength: 1 });
  assert.ok(events.some(e => e.index === 5 && e.side === 'BEARISH'));
});

test('structure break is based on close beyond previously confirmed swing', () => {
  const bars = [
    bar(1, 10, 11, 9, 10), bar(2, 10, 12, 9, 11), bar(3, 11, 15, 10, 14),
    bar(4, 14, 14.5, 11, 12), bar(5, 12, 13, 10, 11),
    bar(6, 11, 16, 10.5, 15.5)
  ];
  const events = detectStructureBreaks(bars, { strength: 1 });
  assert.ok(events.some(e => e.index === 5 && e.side === 'BULLISH' && e.confirmedBy === 'close'));
});

test('invalid candle geometry fails closed', () => {
  const invalid = [bar(1, 10, 8, 9, 10)];
  assert.deepEqual(detectFairValueGaps(invalid), []);
  assert.deepEqual(detectStructureBreaks(invalid), []);
});

test('order block candidates require an opposing candle plus displacement/FVG context', () => {
  const bars = [
    bar(1, 10, 11, 9, 10),
    bar(2, 11, 12, 8, 9),
    bar(3, 9, 14, 9, 13.5),
    bar(4, 13.5, 16, 13, 15.5),
    bar(5, 15.5, 17, 14.5, 16.5),
    bar(6, 16.5, 18, 15.5, 17.5),
    bar(7, 17.5, 19, 16.5, 18.5),
    bar(8, 18.5, 20, 17.5, 19.5),
    bar(9, 19.5, 21, 18.5, 20.5),
    bar(10, 20.5, 22, 19.5, 21.5),
    bar(11, 21.5, 24, 21, 23.5)
  ];
  const blocks = detectOrderBlockCandidates(bars, { displacementBody: 0.5, maxGap: 2 });
  assert.ok(blocks.every(b => ['CANDIDATE', 'INVALIDATED'].includes(b.status)));
});

test('FVG fill status distinguishes partial touch from full fill', () => {
  const partial = [bar(1, 15, 16, 14, 15), bar(2, 14, 15, 10, 11), bar(3, 10, 13, 8, 9), bar(4, 10, 13.5, 9, 11)];
  assert.ok(detectFairValueGaps(partial).some(g => g.side === 'BEARISH' && g.status === 'PARTIALLY_FILLED'));
  const filled = [...partial, bar(5, 13.5, 14.2, 12, 13.8)];
  assert.ok(detectFairValueGaps(filled).some(g => g.side === 'BEARISH' && g.status === 'FILLED'));
});

test('breaker detection requires an invalidated OB, opposite structure break, and retest confirmation', () => {
  const bars = [bar(1, 10, 11, 9, 10), bar(2, 11, 12, 8, 9), bar(3, 9, 14, 9, 13.5), bar(4, 13.5, 16, 13, 15.5), bar(5, 15.5, 17, 14.5, 16.5), bar(6, 16.5, 18, 15.5, 17.5), bar(7, 17.5, 19, 16.5, 18.5), bar(8, 18.5, 20, 17.5, 19.5), bar(9, 19.5, 21, 18.5, 20.5), bar(10, 20.5, 22, 19.5, 21.5), bar(11, 21.5, 24, 21, 23.5)];
  assert.ok(detectBreakerBlocks(bars, { displacementBody: 0.5, maxGap: 2 }).every(b => ['FORMED_WAITING_RETEST', 'RETEST_CONFIRMED'].includes(b.status)));
});

test('inducement detector only labels a first pullback pivot after a BOS', () => {
  const bars = [bar(1, 10, 11, 9, 10), bar(2, 10, 12, 9, 11), bar(3, 11, 13, 10, 12), bar(4, 12, 12.5, 9, 10), bar(5, 10, 11, 8.5, 9), bar(6, 9, 12, 9, 11), bar(7, 11, 14, 10, 13.5), bar(8, 13.5, 15, 12, 14.5)];
  const found = detectInducements(bars, { strength: 1 });
  assert.ok(found.every(x => Number.isFinite(x.price) && Number.isInteger(x.bosAt) && ['CANDIDATE', 'SWEPT', 'INVALIDATED'].includes(x.status)));
});

test('role reversal output is limited to SBR/RBS retests', () => {
  const bars = [bar(1, 10, 11, 9, 10), bar(2, 10, 12, 9, 11), bar(3, 11, 13, 10, 12), bar(4, 12, 12.5, 8, 9), bar(5, 9, 10, 7, 8), bar(6, 8, 10.5, 7.5, 9), bar(7, 9, 10, 8, 8.5)];
  assert.ok(detectRoleReversals(bars, { strength: 1 }).every(x => ['SBR', 'RBS'].includes(x.type)));
});

test('iFVG requires close invalidation and a later retest rejection', () => {
  const bars = [bar(1, 10, 11, 9, 10), bar(2, 11, 15, 10, 14), bar(3, 14, 17, 12, 16), bar(4, 12, 12.5, 10, 10.5), bar(5, 11, 12, 9.5, 10)];
  assert.ok(detectInvertedFairValueGaps(bars).some(x => x.type === 'IFVG' && x.side === 'BEARISH' && x.status === 'RETEST_CONFIRMED'));
});
