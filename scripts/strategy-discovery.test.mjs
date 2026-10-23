import test from 'node:test';
import assert from 'node:assert/strict';
import { generateHypotheses, researchGate } from './strategy-discovery.mjs';

test('generator proposes reproducible candidates without claiming success', () => {
  const first = generateHypotheses();
  const second = generateHypotheses();
  assert.ok(first.length > 0);
  assert.deepEqual(first.map(x => x.id), second.map(x => x.id));
  assert.ok(first.every(x => x.validationStatus === 'NOT_TESTED'));
  assert.ok(first.every(x => x.performance === null));
  assert.ok(first.every(x => x.specification.minimumRiskReward >= 3));
});

test('generator obeys candidate limit and refuses reward/risk below 3', () => {
  assert.equal(generateHypotheses({ maxCandidates: 2 }).length, 2);
  assert.throws(() => generateHypotheses({ minRiskReward: 2 }), RangeError);
});

test('candidate IDs are unique within a generated registry', () => {
  const candidates = generateHypotheses({ maxCandidates: 100 });
  assert.equal(new Set(candidates.map(x => x.id)).size, candidates.length);
});

test('research gate blocks missing or incomplete evidence', () => {
  const result = researchGate({});
  assert.equal(result.eligible, false);
  assert.ok(result.reasons.length >= 8);
});

test('research gate only passes when every evidence requirement is satisfied', () => {
  const result = researchGate({
    dataAudit: 'PASS', lookAheadAudit: 'PASS', costModel: 'PASS',
    outOfSampleTrades: 150, outOfSampleExpectancyR: 0.15,
    outOfSampleProfitFactor: 1.2, maxDrawdownR: 8,
    walkForward: 'PASS', untouchedHoldout: 'PASS',
    paperForwardTest: 'PASS', multipleTestingCorrection: 'PASS'
  });
  assert.equal(result.eligible, true);
});
