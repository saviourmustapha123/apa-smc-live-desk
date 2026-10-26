import test from 'node:test';
import assert from 'node:assert/strict';
import { BOOK_RULES, BOOK_SOURCES, STRATEGY_GATES, passesCandidateGate } from './book-strategy-registry.mjs';

test('registry is grounded in the two uploaded PDFs', () => {
  assert.equal(BOOK_SOURCES.lowkey.file, '930067889-Advanced-Price-Action-Lowkey-forex-trader.pdf');
  assert.equal(BOOK_SOURCES.alchemist.file, '994417437-Alchemist-Concepts-in-Forex-Trading-Msnr-Overview.pdf');
  assert.ok(BOOK_RULES.some(rule => rule.source === 'lowkey'));
  assert.ok(BOOK_RULES.some(rule => rule.source === 'alchemist'));
});

test('every rule has traceability, a clear extraction status and no false implementation claim', () => {
  for (const rule of BOOK_RULES) {
    assert.ok(rule.id && rule.concept && rule.evidence, 'rule metadata is required');
    assert.ok(Array.isArray(rule.requirements) && rule.requirements.length > 0, rule.id);
    assert.equal(rule.implementationStatus, 'not-verified', rule.id);
    assert.equal(rule.testStatus, 'not-tested', rule.id);
    assert.equal(rule.historicalStatus, 'not-tested', rule.id);
  }
});

test('book-derived candidate gate enforces minimum 1:3 RR using actual prices', () => {
  assert.equal(STRATEGY_GATES.minimumRewardRisk, 3);
  assert.equal(passesCandidateGate({ entry: 100, sl: 99, tp: 103, rr: 3 }), true);
  assert.equal(passesCandidateGate({ entry: 100, sl: 99, tp: 102.99, rr: 3 }), false);
  assert.equal(passesCandidateGate({ entry: 100, sl: 99, tp: 104, rr: 2.5 }), true, 'actual 4R prices override stale displayed RR');
  assert.equal(passesCandidateGate({ entry: 100, sl: 99, tp: 102, rr: 99 }), false, 'actual 2R prices override inflated displayed RR');
  assert.equal(passesCandidateGate({ entry: 100, sl: 101, tp: 103, direction: 'buy' }), false, 'long stop must be below entry');
  assert.equal(passesCandidateGate({ entry: 100, sl: 99, tp: 97, direction: 'buy' }), false, 'long target must be above entry');
  assert.equal(passesCandidateGate({ entry: 100, sl: 101, tp: 97, direction: 'sell' }), true);
  assert.equal(passesCandidateGate({ entry: 100, sl: 100, tp: 105 }), false);
  assert.equal(passesCandidateGate({ entry: 100, sl: 99 }), false);
});

test('rule registry keeps visually ambiguous rules unimplemented until their diagrams are formalized', () => {
  for (const id of ['AL-OCL-001', 'AL-QML-001', 'AL-CLASSIC-A-001', 'AL-CLASSIC-V-001']) {
    const item = BOOK_RULES.find(rule => rule.id === id);
    assert.ok(item);
    assert.match(item.notes, /diagram|formula|geometry/i);
    assert.equal(item.implementationStatus, 'not-verified');
  }
});
