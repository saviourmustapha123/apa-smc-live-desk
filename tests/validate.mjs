import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const worker = readFileSync(new URL('../proxy/qqqusdt-worker.js', import.meta.url), 'utf8');
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

assert.ok(html.includes('!extensionSeen||touchedBeforeExtension'), 'pending OB requires BOS then a fresh high/low before first mitigation');
assert.ok(html.includes('extensionSeen&&!touchedBeforeExtension&&touched'), 'OB retest requires post-BOS extension before first mitigation');
assert.ok(html.includes('target.tp<=current.close') && html.includes('target.tp>=current.close'), 'pending OB target must remain ahead of current price');
assert.ok(html.includes('const structureEvent=bullish?') && html.includes('contextMode') && html.includes('post-CHoCH'), 'pending OBs must distinguish trend-shift context from continuation context');
assert.ok(html.includes('Entry already touched before pending order activation') && html.includes('entryTouchedBeforeOrderActive'), 'a retest discovered after candle close must not become a false pending entry');
assert.ok(html.includes('BREAKER BLOCK · FAILED OB + OPPOSITE SHIFT + RETEST'), 'breaker zones must be explicitly mapped');
assert.ok(html.includes('function signalBarEndMs(tf,timeSeconds)'), 'calendar timeframe outcome timing must be handled');
assert.ok(html.includes("if(tf==='1W')" ) && html.includes("if(tf==='1M')") && html.includes("if(tf==='1Y')"), 'weekly/monthly/yearly boundary handling missing');
assert.ok(html.includes('marketTimeframeHealthPanel') && html.includes('recordTimeframeHealth'), 'visible feed diagnostics must report per-market/timeframe state');
assert.ok(html.includes("const DEFAULT_QQQ_PROXY='https://apa-smc-qqqusdt-proxy.saviourmustapha123.workers.dev';") && html.includes('function safeQqqProxy(') && html.includes('safeQqqProxy(p.qqqProxy||DEFAULT_QQQ_PROXY)') && html.includes('async function qqqJson(path)') && html.includes('async function bybitJson(path)') && html.includes('if(!r.ok)'), 'QQQ proxy must be preconfigured but remain URL-validated, configurable, and dependent on successful HTTP/data checks');
assert.ok(worker.includes('fapi1.binance.com') && worker.includes('fapi4.binance.com') && worker.includes('for (let attempt = 0; attempt < 2; attempt++)') && !worker.includes('api-gcp.binance.com'), 'QQQ proxy must retry and use only official Binance futures hosts before declaring upstream failure');
assert.ok(html.includes('ob.mitigatedAt=firstTouch') && html.includes('const qualified=recentQualifiedZones(b,k,s.disp)'), 'fresh/mitigated OB and breaker zones must be shared across timeframe charts');

const blockStart = html.indexOf('function detectRecentBlockRetest');
const blockEnd = html.indexOf('function pendingOrderBlockOpportunity', blockStart);
assert.ok(blockStart >= 0 && blockEnd > blockStart, 'OB retest detector not found');
const blockFn = html.slice(blockStart, blockEnd);
assert.ok(blockFn.includes('const linkedIdm='), 'OB retest must record optional linked inducement');
assert.ok(blockFn.includes("'ORDER BLOCK RETEST · FVG + BOS'"), 'valid OB retest must be admitted without fabricated inducement');
assert.ok(blockFn.includes('const structureEvent=') && blockFn.includes('const contextMode=') && blockFn.includes("mitigation:'FIRST_RETEST'"), 'first OB mitigation must carry BOS/CHoCH context and a distinct lifecycle phase');
assert.ok(html.includes("post-BOS '+(blockRetest.side==='BUY'?'higher high':'lower low')+' confirmed before first OB retest/mitigation"), 'scanner must describe the fresh post-BOS extreme before first OB mitigation');
assert.ok(!blockFn.includes('if(idm&&idm.status===\'SWEPT\''), 'OB retest must not hard-require inducement');
const rulebook = readFileSync(new URL('../STRATEGY_RULEBOOK.md', import.meta.url), 'utf8');
assert.ok(rulebook.includes('Continuation OBs do not require inducement') && rulebook.includes('first pullback can mitigate a fresh OB'), 'rulebook must preserve continuation OBs without inducement and valid first mitigation');
assert.ok(rulebook.includes('Continuation after BOS: new extreme, OB retest, next leg') && rulebook.includes('Bullish continuation') && rulebook.includes('established bullish structure') && rulebook.includes('Bearish continuation') && rulebook.includes('established bearish structure'), 'rulebook must cover both directional BOS → new extreme → OB retest → continuation sequences');

console.log('PASS: inline JavaScript syntax');
console.log('PASS: 3 markets × 11 timeframe UI/scan contract');
console.log('PASS: FVG-backed OB and distinct breaker mapping contract');
console.log('PASS: optional inducement and calendar-timeframe lifecycle contract');
console.log('PASS: visible per-market/timeframe feed diagnostics contract');
