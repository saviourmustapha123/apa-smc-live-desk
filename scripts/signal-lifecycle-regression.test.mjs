import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createContext, Script } from 'node:vm';

// These tests execute the lifecycle function extracted from the production HTML,
// not a parallel test-only implementation. If the function moves or disappears,
// the suite fails and requires the integration to be reviewed.
const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const start = html.indexOf('function resolveSignalOutcomes(');
const end = html.indexOf('\nfunction signalDayStamp(', start);
assert.ok(start >= 0 && end > start, 'production signal lifecycle function must exist');
const admissionStart = html.indexOf('function dailySignalAdmission(');
const admissionEnd = html.indexOf('\nasync function scanBackgroundPair(', admissionStart);
assert.ok(admissionStart >= 0 && admissionEnd > admissionStart, 'production signal admission guards must exist');
const lifecycleSource = html.slice(start, end) + '\n' +
  html.slice(admissionStart, admissionEnd) + '\n' +
  'this.resolveSignalOutcomes = resolveSignalOutcomes; this.dailySignalAdmission = dailySignalAdmission; this.candidateAlreadyPastLevels = candidateAlreadyPastLevels;';
const context = {
  s: { log: [] },
  save() {},
  persistSignals() { return Promise.resolve(); },
  renderLog() {},
  realizedSignalR() { return 0; }
};
const vmContext = createContext(context);
new Script(lifecycleSource).runInContext(vmContext);

function evaluate({ side = 'BUY', bar, status = 'PENDING' }) {
  const signal = {
    symbol: 'BTCUSD', tf: '5m', side, time: 100,
    entry: 100, sl: side === 'BUY' ? 95 : 105,
    tp: side === 'BUY' ? 115 : 85,
    status, outcome: 'PENDING', movePct: null, rNow: null
  };
  context.s.log = [signal];
  const candle = { time: 200, isOpen: false, ...bar };
  vmContext.resolveSignalOutcomes('BTCUSD', '5m', [candle]);
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
  assert.equal(signal.movePct, 20);
  assert.equal(signal.rNow, 0.6);
});

test('an untouched setup never accrues TP/SL progress or trade R', () => {
  const signal = evaluate({ side: 'BUY', bar: { open: 97, high: 99, low: 96, close: 98 } });
  assert.equal(signal.status, 'PENDING');
  assert.equal(signal.outcome, 'PENDING');
  assert.equal(signal.movePct, null);
  assert.equal(signal.rNow, null);
});


test('a persisted active trade stays active after reload even when retained candles no longer touch entry', () => {
  const signal = evaluate({ status: 'RUNNING', bar: { time: 300, open: 103, high: 110, low: 101, close: 108 } });
  signal.triggeredAt = 350000;
  context.s.log = [signal];
  vmContext.resolveSignalOutcomes('BTCUSD', '5m', [{ time: 300, isOpen: false, open: 103, high: 110, low: 101, close: 108 }]);
  assert.equal(signal.status, 'RUNNING');
  assert.equal(signal.outcome, 'OPEN');
  assert.equal(signal.triggeredAt, 350000);
  assert.equal(signal.rNow, 1.6);
});

test('a persisted trigger skips candles fully before entry time instead of replaying earlier outcomes', () => {
  const signal = {
    symbol: 'BTCUSD', tf: '5m', side: 'BUY', time: 100, entry: 100, sl: 95, tp: 115,
    status: 'RUNNING', outcome: 'OPEN', triggeredAt: 700000, movePct: null, rNow: null
  };
  context.s.log = [signal];
  vmContext.resolveSignalOutcomes('BTCUSD', '5m', [
    { time: 200, isOpen: false, open: 100, high: 116, low: 99, close: 114 },
    { time: 600, isOpen: false, open: 112, high: 114, low: 110, close: 113 },
    { time: 900, isOpen: false, open: 113, high: 114, low: 112, close: 113 }
  ]);
  assert.equal(signal.status, 'RUNNING');
  assert.equal(signal.outcome, 'OPEN');
  assert.equal(signal.triggeredAt, 700000);
});


test('duplicate signal admission is blocked across persisted and queued signals', () => {
  const candidate = { symbol: 'BTCUSD', tf: '5m', side: 'BUY', time: 123, entry: 100, sl: 95, tp: 115 };
  context.s.log = [{ ...candidate }];
  assert.equal(vmContext.dailySignalAdmission(candidate, []), 'duplicate candidate');
  context.s.log = [];
  assert.equal(vmContext.dailySignalAdmission(candidate, [{ ...candidate }]), 'duplicate candidate');
});

test('a genuinely new signal is not rejected by duplicate guard', () => {
  context.s.log = [{ symbol: 'BTCUSD', tf: '5m', side: 'BUY', time: 123 }];
  assert.equal(vmContext.dailySignalAdmission({ symbol: 'BTCUSD', tf: '15m', side: 'BUY', time: 123 }, []), '');
});

test('stale long candidate beyond stop or target is rejected before admission', () => {
  const candidate = { side: 'BUY', entry: 100, sl: 95, tp: 115 };
  assert.equal(vmContext.candidateAlreadyPastLevels(candidate, [{ isOpen: false, close: 94 }]), true);
  assert.equal(vmContext.candidateAlreadyPastLevels(candidate, [{ isOpen: false, close: 116 }]), true);
  assert.equal(vmContext.candidateAlreadyPastLevels(candidate, [{ isOpen: false, close: 105 }]), false);
});

test('stale short candidate beyond stop or target is rejected before admission', () => {
  const candidate = { side: 'SELL', entry: 100, sl: 105, tp: 85 };
  assert.equal(vmContext.candidateAlreadyPastLevels(candidate, [{ isOpen: false, close: 106 }]), true);
  assert.equal(vmContext.candidateAlreadyPastLevels(candidate, [{ isOpen: false, close: 84 }]), true);
  assert.equal(vmContext.candidateAlreadyPastLevels(candidate, [{ isOpen: false, close: 95 }]), false);
});
