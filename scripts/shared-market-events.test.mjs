import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyStructureBreak, validateOrderBlockCandidate, assessZoneInteraction } from './shared-market-events.mjs';

test('one shared bullish break is classified as continuation when prior trend is bullish', () => {
  const r = classifyStructureBreak({ priorTrend: 'bullish', brokenLevel: 100, previousClose: 99, close: 101, direction: 'bullish' });
  assert.equal(r.status, 'continuation-break');
  assert.equal(r.event, 'structure-break');
});

test('counter-trend close break stays a transition until confirmation is supplied', () => {
  const r = classifyStructureBreak({ priorTrend: 'bullish', brokenLevel: 100, previousClose: 101, close: 99, direction: 'bearish' });
  assert.equal(r.status, 'transition');
  assert.equal(r.event, 'potential-character-change');
});

test('counter-trend break can be marked confirmed without creating a second event', () => {
  const r = classifyStructureBreak({ priorTrend: 'bearish', brokenLevel: 100, previousClose: 99, close: 101, direction: 'bullish', opposingStructureConfirmed: true });
  assert.equal(r.status, 'confirmed-reversal-break');
  assert.equal(r.event, 'potential-character-change');
});

test('wick-only or non-crossing close does not create a structure event', () => {
  const r = classifyStructureBreak({ priorTrend: 'bearish', brokenLevel: 100, previousClose: 99, close: 99.5, direction: 'bullish' });
  assert.equal(r.status, 'no-break');
});

test('order-block candidate requires preceding zone, direction, displacement and structure break', () => {
  const r = validateOrderBlockCandidate({
    zone: { low: 95, high: 98, time: 1 },
    impulse: { open: 97, close: 102, high: 103, low: 96, time: 2, atr: 3 },
    brokenLevel: 100, direction: 'bullish', minimumBodyToAtr: 1,
  });
  assert.equal(r.valid, true);
  assert.equal(r.status, 'candidate-order-block');
});

test('opposite-colour candle alone is not an order block', () => {
  const r = validateOrderBlockCandidate({
    zone: { low: 95, high: 98, time: 1 },
    impulse: { open: 97, close: 99, high: 100, low: 96, time: 2, atr: 3 },
    brokenLevel: 100, direction: 'bullish', minimumBodyToAtr: 1,
  });
  assert.equal(r.valid, false);
});

test('touching a valid zone is not automatically actionable', () => {
  const r = assessZoneInteraction({ zone: { low: 95, high: 98 }, candle: { low: 97, high: 99 } });
  assert.equal(r.touched, true);
  assert.equal(r.actionable, false);
  assert.equal(r.status, 'zone-touched-needs-confirmation');
});

test('invalid data fails closed', () => {
  assert.equal(classifyStructureBreak({}).status, 'insufficient-data');
  assert.equal(assessZoneInteraction({ zone: { low: 100, high: 90 }, candle: { low: 92, high: 95 } }).touched, false);
});
