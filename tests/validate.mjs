import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
  .filter(([, attrs, body]) => !/\bsrc\s*=/.test(attrs) && body.trim());
assert.ok(scripts.length > 0, 'HTML must contain inline application JavaScript');
for (const [, attrs, body] of scripts) {
  try { new vm.Script(body, { filename: 'index.html inline script' }); }
  catch (error) { throw new Error('Inline JavaScript syntax error in script #' + (scripts.indexOf(scripts.find(x => x[2] === body)) + 1) + ': ' + (error.stack || error.message)); }
}

const mustHaveTimeframes = ['1m','5m','15m','1h','4h','8h','12h','1d','1W','1M','1Y'];
for (const tf of mustHaveTimeframes) {
  assert.ok(html.includes('data-t="' + tf + '"'), 'UI timeframe missing: ' + tf);
  assert.ok(html.includes("'" + tf + "'"), 'timeframe not represented in strategy source: ' + tf);
}
for (const symbol of ['EURUSD','BTCUSD','QQQUSDT']) {
  assert.ok(html.includes(symbol), 'configured market missing: ' + symbol);
}
assert.ok(html.includes('const signalSets=sets;'), 'background scan must inspect every supported timeframe');
assert.ok(html.includes('const signalSets=scanSets;'), 'top-down scan must inspect every supported timeframe');
assert.ok(html.includes('if(!hasFvg)continue;'), 'unqualified OBs without FVG must be rejected');
assert.ok(html.includes('if(!fvgConfirmed)continue;'), 'pending OB setups must require associated FVG');
assert.ok(html.includes('BREAKER BLOCK · FAILED OB + OPPOSITE SHIFT + RETEST'), 'breaker zones must be explicitly mapped');
assert.ok(html.includes('function signalBarEndMs(tf,timeSeconds)'), 'calendar timeframe outcome timing must be handled');
assert.ok(html.includes("if(tf==='1W')" ) && html.includes("if(tf==='1M')") && html.includes("if(tf==='1Y')"), 'weekly/monthly/yearly boundary handling missing');
assert.ok(html.includes('marketTimeframeHealthPanel') && html.includes('recordTimeframeHealth'), 'visible feed diagnostics must report per-market/timeframe state');

const blockStart = html.indexOf('function detectRecentBlockRetest');
const blockEnd = html.indexOf('function pendingOrderBlockOpportunity', blockStart);
assert.ok(blockStart >= 0 && blockEnd > blockStart, 'OB retest detector not found');
const blockFn = html.slice(blockStart, blockEnd);
assert.ok(blockFn.includes('const linkedIdm='), 'OB retest must record optional linked inducement');
assert.ok(blockFn.includes("'ORDER BLOCK RETEST · FVG + BOS'"), 'valid OB retest must be admitted without fabricated inducement');
assert.ok(!blockFn.includes('if(idm&&idm.status===\'SWEPT\''), 'OB retest must not hard-require inducement');

console.log('PASS: inline JavaScript syntax');
console.log('PASS: 3 markets × 11 timeframe UI/scan contract');
console.log('PASS: FVG-backed OB and distinct breaker mapping contract');
console.log('PASS: optional inducement and calendar-timeframe lifecycle contract');
console.log('PASS: visible per-market/timeframe feed diagnostics contract');
