import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext, Script } from 'node:vm';

// These tests execute the lifecycle function extracted from the production HTML,
// not a parallel test-only implementation. If the function moves or disappears,
// the suite fails and requires the integration to be reviewed.
const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const start = html.indexOf('function resolveSignalOutcomes(');
const end = html.indexOf('\nfunction signalDayStamp(', start);
assert.ok(start >= 0 && end > start, 'production signal lifecycle function must exist');
const lifecycleSource = html.slice(start, end) + '\nthis.resolveSignalOutcomes = resolveSignalOutcomes;';
const context = {
  s: { log: [] },
  save() {},
  persistSignals() { return Promise.resolve(); },
  renderLog() {},
  realizedSignalR() { return 0; }
};
new Script(lifecycleSource).runInContext(runInNewContext(context));

function evaluate({ side = 'BUY', bar, status = 'PENDING' }) {
  const signal = {
    symbol: 'BTCUSD', tf: '5m', side, time: 100,
    entry: 100, sl: side === 'BUY' ? 95 : 105,
    tp: side === 'BUY' ? 115 : 85,
    status, outcome: 'PENDING', movePct: null, rNow: null
  };
  context.s.log = [signal];
  const candle = { time: 200, isOpen: false, ...bar };
  context.resolveSignalOutcomes('BTCUSD', '5m', [candle]);
  return signal;
}

test('pending long opening gap through stop is invalidated before a later entry touch', () => {
  const signal = evaluate({ side: 'BUY', bar: { open: 94, high: 102, low: 93, close: 101 } });
  assert.equal(signal.status, 'INVALIDATED');
  assert.equal(signal.outcome, 'INVALIDATED');
  assert.equal(signal.triggeredAt, null);
  assert.equal(signal.movePct, null);
  assert.equal(signal.rNow, 0);
});

test('pending long opening gap through target is missed, not recorded as a win after retrace', () => {
  const signal = evaluate({ side: 'BUY', bar: { open: 116, high: 118, low: 99, close: 112 } });
  assert.equal(signal.status, 'EXPIRED');
  assert.equal(signal.outcome, 'EXPIRED');
  assert.equal(signal.triggeredAt, null);
  assert.equal(signal.movePct, null);
});

test('pending short opening gap through stop is invalidated before a later entry touch', () => {
  const signal = evaluate({ side: 'SELL', bar: { open: 106, high: 107, low: 98, close: 99 } });
  assert.equal(signal.status, 'INVALIDATED');
  assert.equal(signal.outcome, 'INVALIDATED');
  assert.equal(signal.triggeredAt, null);
});

test('pending short opening gap through target is missed, not recorded as a win after retrace', () => {
  const signal = evaluate({ side: 'SELL', bar: { open: 84, high: 101, low: 82, close: 98 } });
  assert.equal(signal.status, 'EXPIRED');
  assert.equal(signal.outcome, 'EXPIRED');
  assert.equal(signal.triggeredAt, null);
});

test('a normal entry touch transitions a pending setup to active and then calculates progress', () => {
  const signal = evaluate({ side: 'BUY', bar: { open: 98, high: 105, low: 97, close: 103 } });
  assert.equal(signal.status, 'RUNNING');
  assert.equal(signal.outcome, 'OPEN');
  assert.equal(signal.triggeredAt, 200000);
  assert.equal(signal.movePct, 0.2);
  assert.equal(signal.rNow, 0.6);
});

test('an untouched setup never accrues TP/SL progress or trade R', () => {
  const signal = evaluate({ side: 'BUY', bar: { open: 97, high: 99, low: 96, close: 98 } });
  assert.equal(signal.status, 'PENDING');
  assert.equal(signal.outcome, 'PENDING');
  assert.equal(signal.movePct, null);
  assert.equal(signal.rNow, null);
});
