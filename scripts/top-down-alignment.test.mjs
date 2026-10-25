import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const start = html.indexOf('function evaluateTopDownAlignment(');
const end = html.indexOf('function summarizeTf(tf,bars){', start);
assert.ok(start >= 0 && end > start, 'production top-down gate must exist in index.html');
const gateSource = html.slice(start, end);
const context = {
  Date,
  summarizeTf: (_tf, bars) => ({
    score: bars.at(-1)?.testScore ?? 0,
    bias: bars.at(-1)?.testScore === 1 ? 'Bullish structure' : bars.at(-1)?.testScore === -1 ? 'Bearish structure' : 'Range / unclear',
  }),
};
vm.createContext(context);
vm.runInContext(gateSource, context);
const evaluate = context.evaluateTopDownAlignment;
const now = Date.now();
const durations = { '1m':60, '5m':300, '15m':900, '1h':3600, '4h':14400, '8h':28800, '12h':43200, '1d':86400, '1W':604800, '1M':2678400, '1Y':31622400 };
function barsFor(tf, score = 1, ageFactor = 0.5) {
  return Array.from({ length: 25 }, (_, i) => ({
    time: Math.floor(now / 1000 - durations[tf] * ageFactor - (24 - i) * durations[tf]),
    isOpen: false,
    testScore: score,
  }));
}
function aligned(tf, score = 1) {
  const hierarchy = { '1m':['5m','15m','1h','4h'], '5m':['15m','1h','4h'], '15m':['1h','4h','1d'], '1h':['4h','1d','1W'], '4h':['1d','1W','1M'], '8h':['1d','1W','1M'], '12h':['1d','1W','1M'], '1d':['1W','1M','1Y'] };
  return Object.fromEntries(hierarchy[tf].map(h => [h, barsFor(h, score)]));
}

test('1-minute candidate requires aligned 5m, 15m, 1h and 4h structure', () => {
  assert.equal(evaluate('1m', 'BUY', aligned('1m'), now).allowed, true);
  const opposing = aligned('1m'); opposing['1h'] = barsFor('1h', -1);
  assert.equal(evaluate('1m', 'BUY', opposing, now).allowed, false);
});

test('unknown/ranging higher timeframe blocks candidate rather than being treated as alignment', () => {
  const bars = aligned('5m'); bars['1h'] = barsFor('1h', 0);
  const result = evaluate('5m', 'BUY', bars, now);
  assert.equal(result.allowed, false);
  assert.match(result.reason, /unclear or ranging/);
});

test('missing or stale higher timeframe data blocks candidate', () => {
  const missing = aligned('1m'); delete missing['4h'];
  assert.equal(evaluate('1m', 'BUY', missing, now).allowed, false);
  const stale = aligned('1m'); stale['4h'] = barsFor('4h', 1, 5);
  assert.match(evaluate('1m', 'BUY', stale, now).reason, /stale/);
});

test('bearish candidate requires bearish alignment and rejects unknown direction', () => {
  assert.equal(evaluate('15m', 'SELL', aligned('15m', -1), now).allowed, true);
  assert.equal(evaluate('15m', 'SIDEWAYS', aligned('15m'), now).allowed, false);
});

test('production admission loop invokes the top-down gate before admitting a signal', () => {
  const refreshStart = html.indexOf('async function refreshTopDown(');
  const refreshEnd = html.indexOf('\nasync function ', refreshStart + 30);
  assert.ok(refreshStart >= 0 && refreshEnd > refreshStart, 'refreshTopDown production function must exist');
  const refresh = html.slice(refreshStart, refreshEnd);
  const gateCall = refresh.indexOf('evaluateTopDownAlignment(tf,candidate.side,barsByTf)');
  const admitted = refresh.indexOf('seen.add(key);openTf.add(tf);openCount++');
  assert.ok(gateCall >= 0, 'production candidate loop must call the top-down gate');
  assert.ok(admitted > gateCall, 'candidate must pass gate before being admitted');
  assert.match(refresh, /if\(!alignment\.allowed\)[\s\S]*continue;/,
    'failed alignment must skip candidate admission');
  assert.match(refresh, /candidate\.topDownAlignment=/,
    'admitted candidate must retain its alignment audit trail');
});

test('the top-down gate does not replace the independent minimum 1:3 risk-reward gate', () => {
  const refreshStart = html.indexOf('async function refreshTopDown(');
  const refreshEnd = html.indexOf('\nasync function ', refreshStart + 30);
  const refresh = html.slice(refreshStart, refreshEnd);
  assert.match(html, /MIN_REWARD_RISK\s*=\s*3|MIN_REWARD_RISK\s*>=?\s*3/,
    'application must retain its 3R minimum');
  assert.match(refresh, /Number\(t\.rr\)>=MIN_REWARD_RISK/,
    'existing open-signal policy must continue enforcing minimum reward/risk');
});
