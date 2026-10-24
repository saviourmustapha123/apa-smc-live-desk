import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createContext, Script } from 'node:vm';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const start = html.indexOf('function chartSignalFor(');
const end = html.indexOf('\nfunction analyse(){', start);
assert.ok(start >= 0 && end > start, 'production chart selector must exist before analyse()');
const selectorSource = html.slice(start, end) +
  '\nthis.chartSignalFor = chartSignalFor;';
const context = createContext({ MIN_REWARD_RISK: 3 });
new Script(selectorSource).runInContext(context);

const signal = (overrides = {}) => ({
  symbol: 'EURUSD', tf: '5m', side: 'BUY', time: 100,
  entry: 1.1, sl: 1.09, tp: 1.13, rr: 3,
  status: 'NOT RUNNING', ...overrides
});

test('chart selects the same pending production journal record for the exact pair and timeframe', () => {
  const pending = signal();
  assert.equal(context.chartSignalFor([pending], 'EURUSD', '5m'), pending);
});

test('chart selects the newest eligible open record for the selected pair and timeframe', () => {
  const older = signal({ time: 100 });
  const newer = signal({ time: 200, status: 'PENDING' });
  assert.equal(context.chartSignalFor([older, newer], 'EURUSD', '5m'), newer);
});

test('chart accepts an active signal and does not invent a second chart-only signal', () => {
  const active = signal({ status: 'RUNNING', triggeredAt: 123456 });
  assert.equal(context.chartSignalFor([active], 'EURUSD', '5m'), active);
  assert.equal(context.chartSignalFor([], 'EURUSD', '5m'), null);
});

test('chart excludes closed, missed, expired and invalidated records', () => {
  for (const status of ['TAKE PROFIT', 'STOP LOSS', 'MISSED', 'MISSED ENTRY', 'EXPIRED', 'INVALIDATED', 'CLOSED', 'HISTORICAL']) {
    assert.equal(context.chartSignalFor([signal({ status })], 'EURUSD', '5m'), null, status);
  }
});

test('chart excludes signals below 1:3 and records from another pair or timeframe', () => {
  assert.equal(context.chartSignalFor([signal({ rr: 2.99 })], 'EURUSD', '5m'), null);
  assert.equal(context.chartSignalFor([signal({ symbol: 'BTCUSD' })], 'EURUSD', '5m'), null);
  assert.equal(context.chartSignalFor([signal({ tf: '15m' })], 'EURUSD', '5m'), null);
});

test('analyse uses the production journal selector and no longer creates a separate recentSet proxy signal', () => {
  const analyseStart = html.indexOf('function analyse(){');
  const analyseEnd = html.indexOf('\nfunction log(set){', analyseStart);
  assert.ok(analyseStart >= 0 && analyseEnd > analyseStart, 'production analyse() block must exist');
  const source = html.slice(analyseStart, analyseEnd);
  assert.match(source, /chartSignalFor\(\[\.\.\.\(s\.log\|\|\[\]\),\.\.\.\(s\.backgroundLog\|\|\[\]\)\],s\.symbol,s\.tf\)/);
  assert.doesNotMatch(source, /let recentSet=null|structuralTarget\(side,entry,stop/);
  assert.doesNotMatch(source, /log\(set\)/);
});

test('production scanner records concrete rejection reasons for empty signal scans', () => {
  assert.match(html, /const strategyScanDiagnostics = new Map\(\)/);
  assert.match(html, /Insufficient closed candles:/);
  assert.match(html, /No directional trigger:/);
  assert.match(html, /Confluence incomplete:/);
  assert.match(html, /Structural target fails the minimum 1:3 reward-to-risk gate/);
  assert.match(html, /Current setup blocked by market\/data eligibility:/);
  assert.match(html, /No signal: '\+\(blockers\.slice\(0,2\)/);
});

test('live chart consumes background paper signals from the persistent remote journal', () => {
  assert.match(html, /paper-trade-state\/data\/background-paper-trading-state\.json/);
  assert.match(html, /async function syncBackgroundPaperTrades/);
  assert.match(html, /s\.backgroundLog=records\.filter/);
  assert.match(html, /s\.backgroundPaperSyncTimer=setInterval\(\(\)=>syncBackgroundPaperTrades\(true\),60000\)/);
});

test('background chart overlays are explicitly labelled as simulated paper signals, never live broker executions', () => {
  assert.match(html, /BACKGROUND PAPER JOURNAL/);
  assert.match(html, /chartSignal\.backgroundPaperTrade\?' · PAPER':' · LIVE JOURNAL'/);
  assert.match(html, /Background paper entries are simulated, not broker executions/);
});
