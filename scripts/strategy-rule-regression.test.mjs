import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const start = html.indexOf('function detectRecentBlockRetest(');
const end = html.indexOf('\nfunction pendingOrderBlockOpportunity(', start);
assert.ok(start >= 0 && end > start, 'production block detector must exist');
const detector = html.slice(start, end);

test('ordinary order-block retest requires the original zone to remain valid and untouched', () => {
  assert.match(detector, /invalidAt<0&&!previousTouch&&touched/);
  assert.match(detector, /type:'ORDER BLOCK RETEST · IDM \+ LIQUIDITY SWEPT'/);
});

test('breaker block requires original OB invalidation, movement fully away, opposite structure break, and return rejection', () => {
  assert.match(detector, /if\(invalidAt>=0&&touched\)/);
  assert.match(detector, /fullyAway=flipped==='SELL'\?candleAfterBreach\.high<zone\.low:candleAfterBreach\.low>zone\.high/);
  assert.match(detector, /if\(swing&&\(flipped==='SELL'\?/);
  assert.match(detector, /returnedFromFarSide/);
  assert.match(detector, /const reject=flipped==='SELL'\?current\.close<zone\.low&&current\.close<current\.open:current\.close>zone\.high&&current\.close>current\.open/);
  assert.match(detector, /if\(movedAway&&oppositeBreak&&returnedFromFarSide&&reject\)events\.push/);
});

test('breaker and ordinary order block remain separately labelled', () => {
  assert.match(detector, /type:'BREAKER BLOCK RETEST'/);
  assert.match(detector, /type:'ORDER BLOCK RETEST · IDM \+ LIQUIDITY SWEPT'/);
});

test('production scanner enforces the minimum reward-to-risk gate and rejects malformed risk levels', () => {
  assert.match(html, /MIN_REWARD_RISK\s*=\s*3/);
  assert.match(html, /Structural target fails the minimum 1:3 reward-to-risk gate/);
  assert.match(html, /Invalid entry or stop: structural risk direction is not valid/);
});

test('pending signals are not treated as active broker executions', () => {
  assert.match(html, /function tradeStateLabel\(/);
  assert.match(html, /return 'NOT TRIGGERED'/);
  assert.match(html, /Background paper entries are simulated, not broker executions/);
});

test('QQQ ETF fallback uses Yahoo-supported intraday history windows', async () => {
  const { readFile } = await import('node:fs/promises');
  const source = await readFile(new URL('./production-history-backtest.mjs', import.meta.url), 'utf8');
  assert.match(source, /const range = tf === '1m' \? '7d' : tf === '5m' \? '14d' : '60d'/);
});

test('production scanner permits a displaced same-direction BOS entry only after directional liquidity sweep', async () => {
  const { readFile } = await import('node:fs/promises');
  const source = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(source, /const sameDirectionBreak=side==='BUY'\?upBreak:downBreak;/);
  assert.match(source, /const breakoutEntry=sameDirectionBreak&&recentStructuralDisplacement&&recentDirectionalSweep;/);
  assert.match(source, /const validatedSequence=\(hasEntryZone&&recentStructuralDisplacement&&hasLiquidityConfluence\)\|\|breakoutEntry;/);
  assert.match(source, /target\.rr<MIN_REWARD_RISK/);
});
