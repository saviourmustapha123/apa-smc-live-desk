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


test('replay exposes the production pending-order-block detector separately from retrospective candidates', () => {
  const engine = createProductionScannerReplay({ now: NOW });
  const bars = candles(120);
  assert.equal(typeof engine.pending, 'function');
  assert.equal(engine.pending('BTCUSD', '5m', bars), null, 'ordinary oscillating candles should not fabricate a pending OB setup');
});

test('admits a fresh continuation OB without inducement', () => {
  const engine = createProductionScannerReplay({ now: NOW });
  const bars = candles(60, { lastTime: Math.floor(NOW / 1000) - 9 * 300 });
  const trend = [[100.1,100.6,99.9,100.4],[100.4,100.8,100.2,100.7],[100.7,100.9,100.4,100.8],[100.8,100.8,100.2,100.3],[100.3,100.6,100.0,100.2],[100.2,101.0,100.1,100.8],[100.8,101.2,100.6,101.0],[101.0,101.3,100.8,101.2],[101.2,101.1,100.6,100.8],[100.8,100.9,100.4,100.7],[100.7,101.4,100.6,101.2],[101.2,101.6,101.0,101.4],[101.4,101.7,101.2,101.6],[101.6,101.5,101.0,101.2],[101.2,101.4,100.9,101.1]];
  trend.forEach((c,i)=>{const j=bars.length-trend.length+i;bars[j]={time:bars[j].time,open:c[0],high:c[1],low:c[2],close:c[3]};});
  const push = (open, high, low, close) => bars.push({ time: bars.at(-1).time + 300, open, high, low, close });
  push(100.2,100.4,99.3,99.6); push(99.6,100.1,99.5,100.0);
  push(100.5,103.7,101.2,103.4); push(103.0,103.2,102.6,102.8);
  push(102.8,103.0,102.4,102.6); push(102.6,102.8,102.2,102.4);
  push(102.4,102.7,102.1,102.5); push(102.5,102.6,102.2,102.4);
  const signal = engine.pending('BTCUSD','5m',bars);
  assert.ok(signal);
  assert.equal(signal.side,'BUY');
  assert.ok(signal.rr >= 3);
  assert.match(signal.setupType,/continuation/);
  assert.ok(signal.reason.some(reason=>reason.includes('Inducement not present')));

  // Once the entry zone has actually been touched, the same setup must not be
  // re-issued as a fresh pending limit idea after the fact.
  const retest = {
    time: bars.at(-1).time + 300,
    open: signal.entry + 0.1,
    high: signal.entry + 0.2,
    low: signal.entry - 0.2,
    close: signal.entry + 0.05
  };
  assert.equal(
    engine.pending('BTCUSD', '5m', [...bars, retest]),
    null,
    'a mitigated OB must not be backdated as a new pending entry'
  );
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

test('production target-level guard rejects opposing swings already crossed after formation', () => {
  const engine = createProductionScannerReplay({ now: NOW });
  const bars = [
    { time: 1, open: 100, high: 105, low: 95, close: 100 },
    { time: 2, open: 100, high: 106, low: 96, close: 102 },
    { time: 3, open: 102, high: 104, low: 94, close: 100 }
  ];
  assert.equal(engine.targetLevelUnreached('BUY', 105, bars, 0), false);
  assert.equal(engine.targetLevelUnreached('BUY', 107, bars, 0), true);
  assert.equal(engine.targetLevelUnreached('SELL', 95, bars, 0), false);
  assert.equal(engine.targetLevelUnreached('SELL', 90, bars, 0), true);
});


test('the replay VM exposes the same explicit minimum reward-risk configuration used by production', () => {
  const engine = createProductionScannerReplay({ now: NOW });
  const result = engine.scan('BTCUSD', '5m', candles(120));
  assert.ok(result.diagnostic);
  for (const signal of result.signals) assert.ok(signal.rr >= 3);
});


test('admits a fresh bearish continuation OB without inducement after bearish BOS', () => {
  const engine = createProductionScannerReplay({ now: NOW });
  const source = candles(60, { lastTime: Math.floor(NOW / 1000) - 9 * 300 });
  const trend = [[100.1,100.6,99.9,100.4],[100.4,100.8,100.2,100.7],[100.7,100.9,100.4,100.8],[100.8,100.8,100.2,100.3],[100.3,100.6,100.0,100.2],[100.2,101.0,100.1,100.8],[100.8,101.2,100.6,101.0],[101.0,101.3,100.8,101.2],[101.2,101.1,100.6,100.8],[100.8,100.9,100.4,100.7],[100.7,101.4,100.6,101.2],[101.2,101.6,101.0,101.4],[101.4,101.7,101.2,101.6],[101.6,101.5,101.0,101.2],[101.2,101.4,100.9,101.1]];
  trend.forEach((c,i)=>{const j=source.length-trend.length+i;source[j]={time:source[j].time,open:c[0],high:c[1],low:c[2],close:c[3]};});
  const push = (open, high, low, close) => source.push({ time: source.at(-1).time + 300, open, high, low, close });
  push(100.2,100.4,99.3,99.6); push(99.6,100.1,99.5,100.0);
  push(100.5,103.7,101.2,103.4); push(103.0,103.2,102.6,102.8);
  push(102.8,103.0,102.4,102.6); push(102.6,102.8,102.2,102.4);
  push(102.4,102.7,102.1,102.5); push(102.5,102.6,102.2,102.4);
  const bars = source.map(c => ({time:c.time,open:200-c.open,high:200-c.low,low:200-c.high,close:200-c.close}));
  const signal = engine.pending('BTCUSD','5m',bars);
  assert.ok(signal);
  assert.equal(signal.side,'SELL');
  assert.ok(signal.rr >= 3);
  assert.match(signal.setupType,/continuation/);
  assert.ok(signal.reason.some(reason=>reason.includes('Inducement not present')));
});


test('bullish continuation retest requires BOS, a fresh high, then first OB mitigation', () => {
  const engine = createProductionScannerReplay({ now: NOW });
  const bars = candles(60, { lastTime: Math.floor(NOW / 1000) - 8 * 300 });
  const trend = [[100.1,100.6,99.9,100.4],[100.4,100.8,100.2,100.7],[100.7,100.9,100.4,100.8],[100.8,100.8,100.2,100.3],[100.3,100.6,100.0,100.2],[100.2,101.0,100.1,100.8],[100.8,101.2,100.6,101.0],[101.0,101.3,100.8,101.2],[101.2,101.1,100.6,100.8],[100.8,100.9,100.4,100.7],[100.7,101.4,100.6,101.2],[101.2,101.6,101.0,101.4],[101.4,101.7,101.2,101.6],[101.6,101.5,101.0,101.2],[101.2,101.4,100.9,101.1]];
  trend.forEach((c,i)=>{const j=bars.length-trend.length+i;bars[j]={time:bars[j].time,open:c[0],high:c[1],low:c[2],close:c[3]};});
  const push = (open, high, low, close) => bars.push({time:bars.at(-1).time+300,open,high,low,close});
  push(100.2,100.4,99.3,99.6); push(99.6,100.1,99.5,100.0);
  push(100.5,103.7,101.2,103.4);
  push(103.4,104.4,103.1,104.1);
  push(104.0,104.2,103.0,103.4); push(103.4,103.8,102.6,103.0);
  push(103.0,103.3,100.2,100.6);
  const result = engine.blockRetest(bars);
  assert.ok(result, 'qualifying first retest should be recognised');
  assert.equal(result.side, 'BUY');
  assert.match(result.type, /ORDER BLOCK RETEST/);
});

test('bearish continuation retest requires BOS, a fresh low, then first OB mitigation', () => {
  const engine = createProductionScannerReplay({ now: NOW });
  const source = candles(60, { lastTime: Math.floor(NOW / 1000) - 8 * 300 });
  const trend = [[100.1,100.6,99.9,100.4],[100.4,100.8,100.2,100.7],[100.7,100.9,100.4,100.8],[100.8,100.8,100.2,100.3],[100.3,100.6,100.0,100.2],[100.2,101.0,100.1,100.8],[100.8,101.2,100.6,101.0],[101.0,101.3,100.8,101.2],[101.2,101.1,100.6,100.8],[100.8,100.9,100.4,100.7],[100.7,101.4,100.6,101.2],[101.2,101.6,101.0,101.4],[101.4,101.7,101.2,101.6],[101.6,101.5,101.0,101.2],[101.2,101.4,100.9,101.1]];
  trend.forEach((c,i)=>{const j=source.length-trend.length+i;source[j]={time:source[j].time,open:c[0],high:c[1],low:c[2],close:c[3]};});
  const push = (open, high, low, close) => source.push({time:source.at(-1).time+300,open,high,low,close});
  push(100.2,100.4,99.3,99.6); push(99.6,100.1,99.5,100.0);
  push(100.5,103.7,101.2,103.4); push(103.4,104.4,103.1,104.1);
  push(104.0,104.2,103.0,103.4); push(103.4,103.8,102.6,103.0);
  push(103.0,103.3,100.2,100.6);
  const bars = source.map(c=>({time:c.time,open:200-c.open,high:200-c.low,low:200-c.high,close:200-c.close}));
  const result = engine.blockRetest(bars);
  assert.ok(result, 'qualifying bearish first retest should be recognised');
  assert.equal(result.side, 'SELL');
  assert.match(result.type, /ORDER BLOCK RETEST/);
});
