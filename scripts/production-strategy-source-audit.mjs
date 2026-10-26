import { readFile } from 'node:fs/promises';

const app = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const failures = [];
const checks = [];
const pass = (name, detail) => checks.push({ name, ok: true, detail });
const fail = (name, detail) => { checks.push({ name, ok: false, detail }); failures.push(name); };

const start = app.indexOf('function scanOpportunityHistory(');
const next = app.indexOf('\nfunction ', start + 20);
if (start < 0 || next < 0) {
  fail('Production scanner can be isolated', 'Could not locate scanOpportunityHistory boundaries in index.html');
} else {
  const scanner = app.slice(start, next);
  pass('Production scanner can be isolated', 'Audits the current scanOpportunityHistory source; does not execute it or claim a backtest');

  const requireScanner = (name, pattern, detail) =>
    pattern.test(scanner) ? pass(name, detail) : fail(name, detail);

  requireScanner('Closed candles only', /filter\(x\s*=>\s*!x\.isOpen\)/,
    'Scanner filters open candles before historical analysis');
  requireScanner('Market/session/data eligibility guard', /signalEligibilityReason\(symbol,tf,b\)/,
    'Scanner consults freshness, connection and market-session eligibility');
  requireScanner('Buy-side and sell-side liquidity sweeps', /shSweep[\s\S]*slSweep/,
    'Both sweep directions are represented in production scanner logic');
  requireScanner('BOS/CHoCH structure breaks', /upBreak[\s\S]*downBreak[\s\S]*CHoCH/,
    'Close-confirmed swing breaks and trend-context labels are represented');
  requireScanner('FVG and IFVG retests', /fvgRetest[\s\S]*ifvgRetest[\s\S]*IFVG/,
    'Gap zones are treated as retest locations rather than standalone entries');
  requireScanner('SBR/RBS role reversal', /SBR[\s\S]*RBS/,
    'Support/resistance role reversal conditions are represented');
  requireScanner('Pattern and order-block retest checks', /detectPatternRetest\([\s\S]*detectRecentBlockRetest\(/,
    'Pattern and recent block retest helpers are invoked');
  requireScanner('Inducement sweep is directionally constrained', /latestInducementProxy[\s\S]*inducementSweep[\s\S]*eventIndex===hist\.length-1/,
    'Inducement proxy must be swept on the current candle and align with direction');
  requireScanner('Structure, displacement, POI and liquidity sequence gate', /validatedSequence=hasEntryZone&&recentStructuralDisplacement&&hasLiquidityConfluence[\s\S]*if\(!validatedSequence\)[\s\S]*continue;/,
    'A candidate must pass the explicit confluence sequence and record a rejection reason when it fails');
    requireScanner('Hard minimum 1:3 structural target gate', /structuralTarget\(side,entry,stop,hh,ll,hist\)[\s\S]*target\.rr<MIN_REWARD_RISK/,
    'Rejects missing targets and targets below 3R');
  requireScanner('Pending order-block setup path', /pendingOrderBlockOpportunity\(symbol,tf,b\)/,
    'Can represent a pending setup before entry is triggered');

  requireScanner('QML requires confirmed four-pivot structure', /function detectQmlStructure\([\s\S]*?z\[2\]\.p>z\[0\]\.p[\s\S]*?z\[3\]\.p<z\[1\]\.p[\s\S]*?prior\[j\]\.close<z\[1\]\.p/,
    'Bearish QML requires head sweep and a close-confirmed break of the protected leg before the shoulder retest');
  requireScanner('QML entry level maps to left shoulder', /const level=z\[0\]\.p[\s\S]*?status:rejected\?'RETEST_CONFIRMED':'WAITING_RETEST'/,
    'QML is armed only after the structural shift and waits for a return to the left-shoulder level');
  requireScanner('QML physical chart zone is drawn', /kind:'qml'[\s\S]*?QML shoulder level/,
    'The live chart maps the QML shoulder zone, shift marker and confirmed retest');
  requireScanner('Separate head-and-shoulders signal removed', !/Head-and-shoulders neckline retest|Inverse head-and-shoulders|bearishHs|bullishHs/.test(scanner) && !/Head-and-shoulders neckline retest|Inverse head-and-shoulders|bearishHs|bullishHs/.test(app),
    'QML is validated by its own structural sequence, not by a separate generic head-and-shoulders label');
  requireScanner('Order-block retest requires an FVG-backed displacement', /const hasFvg=i>=2&&\(bullish\?impulse\.low>b\[i-2\]\.high:impulse\.high<b\[i-2\]\.low\);[\s\S]*?if\(!hasFvg\)continue;/,
    'Trade-grade order-block retests require displacement, close-confirmed structure break, a three-candle FVG and a first fresh retest');
  requireScanner('Fresh order-block first retest is enforced', /let invalidAt=-1,previousTouch=false;[\s\S]*?if\(invalidAt<0&&!previousTouch&&touched/,
    'An already mitigated zone cannot be reused as a fresh order-block entry');
}

const proxy = await readFile(new URL('./proxy-backtest.mjs', import.meta.url), 'utf8');
if (/not\*{0,2}\s*validation of the complete proprietary LOWKEY FX APA strategy/i.test(proxy) &&
    /gross proxy only/i.test(proxy)) {
  pass('Proxy backtest is not misrepresented as full production validation',
    'Current historical backtest explicitly labels its strategy and cost limitations');
} else {
  fail('Proxy backtest is not misrepresented as full production validation',
    'Keep proxy results distinct from validation of the full production scanner');
}

const workflow = await readFile(new URL('../.github/workflows/background-health-check.yml', import.meta.url), 'utf8');
if (/schedule:[\s\S]*cron:\s*["']\*\/5 \* \* \* \*["']/.test(workflow)) {
  pass('Background schedule is accurately bounded', 'GitHub Actions is scheduled every 5 minutes, not a persistent 24/7 process');
} else {
  fail('Background schedule is accurately bounded', 'Review the declared schedule and avoid claiming persistent runtime');
}

console.log('APA · SMC production strategy source audit');
console.log('Scope: static source-coverage audit only. It is not a candle replay, browser integration test, or profitability proof.');
for (const c of checks) console.log((c.ok ? 'PASS' : 'FAIL') + '  ' + c.name + ' — ' + c.detail);
console.log('\nResult: ' + (checks.length - failures.length) + '/' + checks.length + ' checks passed; ' + failures.length + ' failed.');

if (process.env.GITHUB_STEP_SUMMARY) {
  const { appendFile } = await import('node:fs/promises');
  const summary = [
    '# Production strategy source audit',
    '',
    '> Static source-coverage audit only. This does not execute the production scanner against historical candles and does not validate profitability.',
    '',
    '| Status | Check | Detail |',
    '|---|---|---|',
    ...checks.map(c => '| ' + (c.ok ? 'PASS' : 'FAIL') + ' | ' + c.name.replaceAll('|', '\\|') + ' | ' + c.detail.replaceAll('|', '\\|') + ' |'),
    '',
    '**Result:** ' + (checks.length - failures.length) + '/' + checks.length + ' checks passed; ' + failures.length + ' failed.'
  ].join('\n');
  await appendFile(process.env.GITHUB_STEP_SUMMARY, summary + '\n');
}
if (failures.length) process.exitCode = 1;
