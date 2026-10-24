import test from 'node:test';
import assert from 'node:assert/strict';
import { createProductionScannerReplay } from './production-scanner-replay.mjs';

const NOW = Date.parse('2026-10-24T12:00:00Z');
function candles(count, { interval = 300, lastTime = Math.floor(NOW / 1000) - interval, openLast = false } = {}) {
  return Array.from({ length: count }, (_, i) => {
    const time = lastTime - (count - 1 - i) * interval;
    const center = 100 + Math.sin(i / 4) * 0.3;
    return { time, open: center, high: center + 0.2, low: center - 0.2, close: center + Math.sin(i) * 0.05, ...(openLast && i === count - 1 ? { isOpen: true } : {}) };
  });
}

test('replays the actual production scanner source, not the proxy strategy', () => {
  const engine = createProductionScannerReplay({ now: NOW });
  const result = engine.scan('BTCUSD', '5m', candles(120));
  assert.ok(result.diagnostic, 'production diagnostic should be emitted');
  assert.equal(result.diagnostic.candles, 120);
  assert.equal(result.diagnostic.eligible, true);
  for (const signal of result.signals) {
    assert.ok(signal.rr >= 3, 'every emitted signal must meet minimum 1:3 RR');
    assert.ok(['BUY', 'SELL'].includes(signal.side));
    assert.ok(Number.isFinite(signal.entry) && Number.isFinite(signal.sl) && Number.isFinite(signal.tp));
  }
});

test('excludes open candles and reports insufficient closed history', () => {
  const engine = createProductionScannerReplay({ now: NOW });
  const result = engine.scan('BTCUSD', '5m', candles(35, { openLast: true }));
  assert.equal(result.diagnostic.candles, 34);
  assert.equal(result.signals.length, 0);
  assert.match(result.diagnostic.latestRejection, /Insufficient closed candles/);
});

test('blocks stale market data instead of treating stale setups as live', () => {
  const engine = createProductionScannerReplay({ now: NOW });
  const staleLast = Math.floor(NOW / 1000) - 7200;
  const result = engine.scan('BTCUSD', '5m', candles(120, { lastTime: staleLast }));
  assert.equal(result.diagnostic.eligible, false);
  assert.match(result.diagnostic.eligibilityReason, /stale/);
  assert.equal(result.signals.filter(s => s.status === 'NOT RUNNING').length, 0);
});

test('repeated replay of identical candles is deterministic', () => {
  const bars = candles(180);
  const first = createProductionScannerReplay({ now: NOW }).scan('BTCUSD', '5m', bars);
  const second = createProductionScannerReplay({ now: NOW }).scan('BTCUSD', '5m', bars);
  assert.equal(JSON.stringify(first.signals), JSON.stringify(second.signals));
  assert.equal(first.diagnostic.latestRejection, second.diagnostic.latestRejection);
});

test('closed-market eligibility is enforced for EURUSD on Saturday', () => {
  const engine = createProductionScannerReplay({ now: NOW });
  const result = engine.scan('EURUSD', '5m', candles(120));
  assert.equal(result.diagnostic.eligible, false);
  assert.match(result.diagnostic.eligibilityReason, /market session closed/);
  assert.equal(result.signals.filter(s => s.status === 'NOT RUNNING').length, 0);
});
