import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Script, runInNewContext } from 'node:vm';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');

test('the complete inline browser application JavaScript parses without syntax errors', () => {
  const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)]
    .map(match => match[1].trim())
    .filter(Boolean);
  assert.ok(scripts.length > 0, 'expected an inline application script');
  assert.doesNotThrow(() => new Script(scripts[scripts.length - 1]), 'inline application script must be valid JavaScript');
});


test('both automatic signal scanners include the one-minute scalp timeframe', () => {
  assert.match(html, /signalSets=sets\.filter\(\(\[tf\]\)=>\['1m','5m','15m','1h','4h','8h','12h','1d'\]\.includes\(tf\)\)/);
  assert.match(html, /signalSets=scanSets\.filter\(\(\[tf\]\)=>\['1m','5m','15m','1h','4h','8h','12h','1d'\]\.includes\(tf\)\)/);
});

test('live signal cards visibly disclose provisional strategy status', () => {
  assert.match(html, /PROVISIONAL STRATEGY/);
  assert.match(html, /exact owner rules still require confirmation/);
});

test('candidate labels do not claim strategy verification while the live engine remains heuristic', () => {
  assert.match(html, /verificationState:'PROVISIONAL-HEURISTIC'/);
  assert.doesNotMatch(html, /verificationState:'RULE-VERIFIED'/);
});

test('signal admission avoids arbitrary daily quotas while retaining one open candidate per timeframe', () => {
  assert.doesNotMatch(html, /openCount>=2\|\|dailySignalAdmission\(candidate,additions\)/);
  assert.match(html, /if\(seen\.has\(key\)\|\|openTf\.has\(tf\)\)continue/);
});

test('chart exposes monthly and yearly timeframe controls', () => {
  assert.match(html, /data-t="1M">1M/);
  assert.match(html, /data-t="1Y">1Y/);
  assert.match(html, /'1W':604800/);
  assert.match(html, /'1Y':31536000/);
});

test('weekly candle refresh uses the same Monday UTC bucket as weekly aggregation', () => {
  assert.match(html, /if\(tf==='1W'\)\{const day=\(d\.getUTCDay\(\)\+6\)%7;return Date\.UTC\(d\.getUTCFullYear\(\),d\.getUTCMonth\(\),d\.getUTCDate\(\)-day\)\/1000\}/);
  assert.match(html, /calendarAggregate\(daily,'week'\)/);
});

test('yearly candles are bucketed by calendar year, not fixed 365-day offsets', () => {
  assert.match(html, /if\(tf==='1Y'\)return Date\.UTC\(d\.getUTCFullYear\(\),0,1\)\/1000/);
  assert.match(html, /calendarAggregate\(daily,'year'\)/);
  assert.match(html, /minimumBars=s\.tf==='1Y'\?10:s\.tf==='1M'\?20:35/);
});

test('monthly and yearly contexts are included in the top-down and background scan sets', () => {
  assert.match(html, /summarizeTf\('Yearly',yearly\)/);
  assert.match(html, /\['1M',monthly\],\['1Y',yearly\]/);
  assert.match(html, /\['1M',monthly\],\['1Y',yearly\]/);
  assert.match(html, /across 11 timeframes/);
});

test('selected chart candles are refreshed from the OHLC endpoint separately from quote polling', () => {
  assert.match(html, /async function refreshSelectedCandles\(force=false\)/);
  assert.match(html, /await tick\(\);await monitorBackgroundQuotes\(\);await refreshSelectedCandles\(false\)/);
  assert.match(html, /Candle refresh failed · retaining cached bars/);
});

test('higher-timeframe history backfill is bounded and persisted to the daily candle store', () => {
  assert.match(html, /rounds<16/);
  assert.match(html, /await dbPut\(daily,sym,'1d'\)/);
  assert.match(html, /fetchBarsRaw\(sym,'1d',1000,fromTime,toTime\)/);
});

test('analysis declares marker collection before adding OB markers, preventing startup temporal-dead-zone crash', () => {
  const analysisStart = html.indexOf('function analyse(){');
  const analysisEnd = html.indexOf('function log(', analysisStart);
  assert.ok(analysisStart >= 0 && analysisEnd > analysisStart, 'analyse function boundaries must exist');
  const body = html.slice(analysisStart, analysisEnd);
  const declaration = body.indexOf('let marks=[]');
  const firstPush = body.indexOf('marks.push(');
  assert.ok(declaration >= 0 && firstPush > declaration, 'marks must be declared before the first marks.push');
});

test('chart drawing isolates analysis exceptions instead of aborting candle display', () => {
  assert.match(html, /try\{analyse\(\)\}catch\(e\)\{console\.error\('Strategy analysis failed without stopping the chart'/);
  assert.match(html, /Candles remain visible/);
});

test('production scanner retains monthly/yearly minimum history and chart does not promote historical proxy candidates', () => {
  assert.match(html, /function scanOpportunityHistory\(symbol,tf,bars\)[\s\S]*?minimum=tf==='1Y'\?10:tf==='1M'\?20:35/);
  assert.match(html, /minimumBars=s\.tf==='1Y'\?10:s\.tf==='1M'\?20:35/);
  const start = html.indexOf('function analyse(){');
  const end = html.indexOf('\nfunction log(set){', start);
  assert.ok(start >= 0 && end > start);
  const analyseSource = html.slice(start, end);
  assert.match(analyseSource, /chartSignalFor\(\[\.\.\.\(s\.log\|\|\[\]\),\.\.\.\(s\.backgroundLog\|\|\[\]\)\],s\.symbol,s\.tf\)/);
  assert.doesNotMatch(analyseSource, /let recentSet=null/);
});

test('chart exposes 8H and 12H timeframe controls', () => {
  assert.match(html, /data-t="8h">8H/);
  assert.match(html, /data-t="12h">12H/);
  assert.match(html, /'8h':28800/);
  assert.match(html, /'12h':43200/);
});

test('8H and 12H candles are aggregated from hourly OHLC with UTC epoch-aligned buckets', () => {
  assert.match(html, /function aggregateHours\(arr,hours\)/);
  assert.match(html, /Math\.floor\(b\.time\/span\)\*span/);
  assert.match(html, /aggregateHours\(hourly,tf==='8h'\?8:12\)/);
  assert.match(html, /if\(x\.time\+span>now\)x\.isOpen=true/);
});

test('8H and 12H are included in top-down context and opportunity scanning', () => {
  assert.match(html, /summarizeTf\('12H',h12\),summarizeTf\('8H',h8\)/);
  assert.match(html, /\['8h',h8\],\['12h',h12\]/);
  assert.match(html, /across 11 timeframes/);
});

test('concurrent 8H/12H requests share a short-lived hourly cache and pending fetch', () => {
  assert.match(html, /const hourlyHistoryCache=new Map\(\),hourlyHistoryPending=new Map\(\)/);
  assert.match(html, /if\(hourlyHistoryPending\.has\(sym\)\)return hourlyHistoryPending\.get\(sym\)/);
  assert.match(html, /Date\.now\(\)-cached\.at<30000/);
});

test('weekly/monthly/yearly views reuse sufficiently deep daily history during refresh bursts', () => {
  assert.match(html, /const dailyHistoryCache=new Map\(\)/);
  assert.match(html, /cachedDaily&&Date\.now\(\)-cachedDaily\.at<30000&&cachedDaily\.bars\.length&&cachedDaily\.bars\[0\]\.time<=target/);
  assert.match(html, /reused in-memory daily history cache/);
  assert.match(html, /dailyHistoryCache\.set\(sym,\{at:Date\.now\(\),bars:daily\}\)/);
});

test('live chart loaders that await data are declared async', () => {
  assert.match(html, /async function getBars\(sym,tf,lim,from,to\)\{/);
  assert.match(html, /async function switchSymbol\(sym\)\{/);
});

test('QQQUSDT supports Bybit and Binance venue-specific quotes, candles, and cache isolation', () => {
  assert.match(html, /QQQUSDT:\{label:'QQQUSDT · ETF perpetual'/);
  assert.match(html, /https:\/\/fapi\.binance\.com/);
  assert.match(html, /https:\/\/api\.bybit\.com/);
  assert.match(html, /v5\/market\/kline\?'\+q/);
  assert.match(html, /v5\/market\/tickers\?category=linear&symbol=QQQUSDT/);
  assert.match(html, /id="qqqProvider"/);
  assert.match(html, /function qqqCacheSymbol\(/);
  assert.match(html, /qqqUrl\('\/fapi\/v1\/klines\?'\+q\)/);
  assert.match(html, /qqqUrl\('\/fapi\/v1\/ticker\/price\?symbol=QQQUSDT'\)/);
  assert.match(html, /connect-src 'self' https:\/\/biquote\.io https:\/\/fapi\.binance\.com https:\/\/api\.bybit\.com/);
  assert.match(html, /if\(sym==='QQQUSDT'\)/);
  assert.match(html, /if\(sym==='QQQUSDT'\)return fetchBarsRaw\(sym,tf/);
});
test('QQQUSDT risk sizing uses linear contract units instead of labelling the quantity as BTC', () => {
  assert.match(html, /QQQUSDT contract units \(linear USDT-margined estimate\)/);
});

test('order block qualification requires displacement and a close-confirmed structure break, not a mandatory FVG', () => {
  assert.match(html, /function recentQualifiedZones\(/);
  assert.match(html, /const bullish=impulse\.close>impulse\.open&&high&&prev\.close<=high\.p&&impulse\.close>high\.p/);
  assert.match(html, /const bearish=impulse\.close<impulse\.open&&low&&prev\.close>=low\.p&&impulse\.close<low\.p/);
  assert.match(html, /No qualified OB \(needs displacement \+ close-confirmed structure break\)/);
  assert.match(html, /qualifiedZones=recentQualifiedZones/);
});

test('pending order-block setup is created only after its linked IDM/liquidity sweep and FVG', () => {
  assert.match(html, /function pendingOrderBlockOpportunity\(symbol,tf,bars\)/);
  assert.match(html, /const latestIdm=latestInducementProxy\(b,k\)/);
  assert.match(html, /const fvgConfirmed=i>=2&&\(bullish\?impulse\.low>b\[i-2\]\.high:impulse\.high<b\[i-2\]\.low\)/);
  assert.match(html, /latestIdm\.status!=='SWEPT'[\s\S]*?latestIdm\.bosTime!==impulse\.time/);
  assert.match(html, /fresh and unmitigated/);
  assert.match(html, /Pending midpoint retest entry/);
  assert.match(html, /status:'NOT RUNNING',outcome:'PENDING'/);
  assert.match(html, /const pending=pendingOrderBlockOpportunity\(symbol,tf,b\)/);
});

test('structural targets select the nearest confirmed opposing swing that satisfies the minimum 3R', () => {
  assert.match(html, /Choose the nearest confirmed opposing swing that actually permits 3R/);
  assert.match(html, /\.filter\(p=>Number\.isFinite\(p\.rr\)&&p\.rr>=(?:3|MIN_REWARD_RISK)\)/);
  assert.match(html, /return \{tp:candidates\[0\]\.tp,rr:candidates\[0\]\.rr,targetSwingIndex:candidates\[0\]\.index\}/);
});

test('live chart distinguishes breaker blocks from order blocks and requires a retest', () => {
  assert.match(html, /oppositeBreak<0\)continue/);
  assert.match(html, /retestIndex:j,retestTime:bar\.time/);
  assert.match(html, /Breaker block/);
  assert.match(html, /text:breaker\.side\+' BREAKER'/);
});

test('live inducement proxy is tied to a post-BOS pullback and exposes status', () => {
  assert.match(html, /function latestInducementProxy\(/);
  assert.match(html, /Possible bullish IDM/);
  assert.match(html, /IDM '\+im\.status/);
});

test('QQQUSDT long history target is clamped to its documented listing date', () => {
  assert.match(html, /Date\.UTC\(2026,4,7\)/);
  assert.match(html, /s\.qqqProvider==='bybit'\?Date\.UTC\(2026,4,7\):Date\.UTC\(2026,3,6\)/);
});

test('background scan iterates over every configured market except the active one', () => {
  assert.match(html, /Object\.keys\(symbolConfig\)\.filter\(market=>market!==sym\)/);
  assert.match(html, /otherPairNew\+=await scanBackgroundPair\(other\)/);
  assert.match(html, /QQQUSDT:\{label:'QQQUSDT · ETF perpetual'/);
});

test('QQQUSDT chart clearly identifies the instrument as a perpetual rather than ETF shares', () => {
  assert.match(html, /ETF-linked perpetual, not QQQ ETF shares/);
  assert.match(html, /qqqVenueLabel\(\)/);
});


test('all-timeframe SMC zones are rebuilt into one symbol-wide overlay and mapped by timestamps', () => {
  assert.match(html, /rebuildUnifiedAnnotations\(scanSets\)/);
  assert.match(html, /function rebuildUnifiedAnnotations\(scanSets\)/);
  assert.ok(html.includes("label:'['+tf.toUpperCase()+'] '+z.label"));
  assert.match(html, /const allZones=\[\.\.\.\(s\.globalZones\|\|\[\]\)\.filter\(z=>z\.sourceTf!==s\.tf\),\.\.\.\(s\.zoneDefs\|\|\[\]\)\.map\(z=>\(\{\.\.\.z,sourceTf:s\.tf\}\)\)\]/);
  assert.match(html, /const mappedX1=chartXForTime\(z\.start\),mappedX2=chartXForTime\(z\.end\)/);
  assert.match(html, /s\.globalMarks=allMarks\.sort/);
  assert.match(html, /const marksToDraw=\(s\.globalMarks\|\|\[\]\)\.filter\(mark=>mode!==\x27clean\x27\|\|mark\.sourceTf===s\.tf\|\|htf\.has\(mark\.sourceTf\)\)/);
  assert.ok(html.includes("tag.textContent='['+mark.sourceTf.toUpperCase()+'] '+mark.text"));
  assert.match(html, /const activeTrades=s\.log\.filter\(t=>validTrade\(t\)&&!terminalStates\.has/);
  assert.match(html, /const visibleTrades=\[\.\.\.activeTrades\.sort/);
  assert.match(html, /const completedTrades=mode==='clean'\?\[\]:s\.log\.filter/);
});

test('QQQUSDT supports a configurable Cloudflare Workers proxy for region-restricted Binance data', () => {
  assert.match(html, /function safeQqqProxy\(value\)/);
  assert.match(html, /function qqqUrl\(path\)/);
  assert.match(html, /id="qqqProxy"/);
  assert.ok(html.includes("qqqUrl('/fapi/v1/klines?'+q)"));
  assert.ok(html.includes("qqqUrl('/fapi/v1/ticker/price?symbol=QQQUSDT')"));
  assert.match(html, /HTTP 451 · Binance has region-restricted this public API request/);
});

test('chart overlay offers clean, balanced, and full density with per-timeframe zone caps', () => {
  assert.match(html, /id="overlayDensity"/);
  assert.match(html, /value="clean">Clean/);
  assert.match(html, /value="balanced" selected>Balanced/);
  assert.match(html, /value="full">Full map/);
  assert.match(html, /const zoneLimit=mode==='clean'\?2:mode==='balanced'\?10:40/);
  assert.match(html, /const tradeLimit=mode==='clean'\?4:mode==='balanced'\?12:40/);
});

test('signal-heavy panels are consolidated into tabs and the duplicate setup board is collapsed by default', () => {
  assert.match(html, /class="signal-workspace" data-view="today"/);
  assert.match(html, /data-signal-tab="today"/);
  assert.match(html, /data-signal-tab="active"/);
  assert.match(html, /data-signal-tab="performance"/);
  assert.match(html, /<details class="panel signal-discovery"/);
  assert.doesNotMatch(html, /<details class="panel signal-discovery"[^>]* open/);
  assert.match(html, /function events\(\)[\s\S]*data-signal-tab[\s\S]*workspace\.dataset\.view=view/);
});

test('daily target tracker counts actual 1:3+ candidates without manufacturing signals', () => {
  assert.match(html, /dailyTarget:6/);
  assert.match(html, /function renderDailyTarget\(\)/);
  assert.match(html, /Only detected setups count; the scanner will not fabricate trades/);
  assert.match(html, /renderSignalMonitor\(\);renderSetupBoard\(\);renderDailyTarget\(\)/);
});

test('pending limit signals trigger on the correct directional entry crossing and on first quote observation', () => {
  assert.match(html, /t\.side==='BUY'\?p<=t\.entry:p>=t\.entry/);
  assert.match(html, /t\.side==='BUY'\?\(prior>t\.entry&&p<=t\.entry\):\(prior<t\.entry&&p>=t\.entry\)/);
  assert.match(html, /t\.status='RUNNING';t\.triggeredAt=t\.triggeredAt\|\|now/);
});

test('signal monitor exposes entry, stop, target, planned R:R, and setup trigger', () => {
  assert.match(html, /<th>Entry<\/th><th>Stop loss<\/th><th>Take profit<\/th><th>Planned R:R<\/th><th>Setup trigger<\/th>/);
  assert.match(html, /priceFor\(t\.entry,t\.symbol\)/);
  assert.match(html, /priceFor\(t\.sl,t\.symbol\)/);
  assert.match(html, /priceFor\(t\.tp,t\.symbol\)/);
  assert.match(html, /Number\(t\.rr\|\|0\)\.toFixed\(2\)/);
  assert.match(html, /t\.reason\|\|t\.scanEngine\|\|'Provisional structural trigger'/);
});

test('closed forex markets request the last known quote instead of forcing a stale-data 404',()=>{assert.ok(html.includes('async function fetchQuote(sym)'));assert.ok(html.includes('else q=await fetchQuote(s.symbol)'));assert.ok(!html.includes('allowStale=false'));assert.ok(html.includes("endpoint('/latest?symbols='+encodeURIComponent(sym))"));assert.ok(html.includes('historical candles loaded; refresh continues'));assert.ok(html.includes('async function bybitJson(path)'));assert.ok(html.includes('https://api.bytick.com'));assert.ok(html.includes('if(!fresh.length)throw Error(\'Provider returned zero valid candles\')'))});


test('signal monitor resolves historical setups from future candles and persists the result', () => {
  assert.match(html, /function resolveSignalOutcomes\(symbol,tf,bars\)/);
  assert.match(html, /t\.status=finalStatus;t\.outcome=finalStatus==='TAKE PROFIT'\?'SUCCESS':finalStatus==='STOP LOSS'\?'LOSS'/);
  assert.match(html, /if\(stopTouched\)\{finalStatus='STOP LOSS'/);
  assert.match(html, /if\(targetTouched\)\{finalStatus='TAKE PROFIT'/);
  assert.match(html, /persistSignals\(changed\)/);
});

test('historical outcome resolution runs for selected and background market scans', () => {
  assert.match(html, /resolvedSelected\+=resolveSignalOutcomes\(sym,tf,bars\)\.length/);
  assert.match(html, /resolved\+=resolveSignalOutcomes\(symbol,tf,bars\)\.length/);
});

test('live opportunity scanner is scheduled with the normal quote and candle refresh cycle', () => {
  assert.match(html, /await tick\(\);await monitorBackgroundQuotes\(\);await refreshSelectedCandles\(false\);await refreshTopDown\(false\)/);
  assert.match(html, /Date\.now\(\)-s\.lastOtherPairScan>=300000/);
});

test('invalidated setups are separate from missed trades in performance', () => {
  assert.ok(html.includes("const missedPerformance=all.filter(t=>['EXPIRED','MISSED ENTRY','MISSED'].includes(String(t.status||'').toUpperCase()));"));
  assert.ok(html.includes("const missed=all.filter(t=>['EXPIRED','MISSED ENTRY','MISSED'].includes(String(t.status||'').toUpperCase()));"));
  assert.ok(html.includes("const invalidatedPerformance=all.filter(t=>String(t.status||'').toUpperCase()==='INVALIDATED');"));
  assert.ok(html.includes("invalidated:'performanceInvalidatedCount'"));
  assert.match(html, /const activeCount=all\.filter\(active\)\.length,other=all\.filter\(t=>\['EXPIRED','INVALIDATED','CLOSED'\]\.includes\(t\.status\)\)\.length/);
});

test('signal monitor displays completed R results, not only open-trade R values', () => {
  assert.match(html, /const rNow=Number\.isFinite\(t\.rNow\)\?t\.rNow\.toFixed\(2\)\+'R':'—'/);
  assert.match(html, /const outcome=t\.outcome\|\|\(t\.status==='TAKE PROFIT'\?'SUCCESS':t\.status==='STOP LOSS'\?'LOSS'/);
});


function runOutcomeResolver(signal, bars) {
  const start = html.indexOf('function realizedSignalR(t){');
  const end = html.indexOf('async function scanBackgroundPair(symbol,freshOnly=s.signalFreshMode)', start);
  assert.ok(start >= 0 && end > start, 'realized-R helper and outcome resolver source should be present');
  const context = {
    s: { log: [{ symbol: 'QQQUSDT', tf: '5m', side: 'BUY', entry: 100, sl: 95, tp: 115, rr: 3, time: 100, status: 'HISTORICAL', ...signal }] },
    save() {},
    persistSignals() {},
    renderLog() {},
    Date
  };
  const resolver = runInNewContext(html.slice(start, end) + '\nresolveSignalOutcomes', context);
  resolver('QQQUSDT', '5m', bars);
  return context.s.log[0];
}

test('historical signal becomes a win when target is reached after entry', () => {
  const result = runOutcomeResolver({}, [
    { time: 100, open: 100, high: 101, low: 99, close: 100 },
    { time: 200, open: 100, high: 110, low: 99, close: 108 },
    { time: 300, open: 108, high: 116, low: 105, close: 114 }
  ]);
  assert.equal(result.status, 'TAKE PROFIT');
  assert.equal(result.outcome, 'SUCCESS');
  assert.equal(result.rNow, 3);
});

test('historical signal becomes a loss when stop is reached, including same-candle TP/SL ambiguity', () => {
  const result = runOutcomeResolver({}, [
    { time: 100, open: 100, high: 101, low: 99, close: 100 },
    { time: 200, open: 100, high: 116, low: 94, close: 105 }
  ]);
  assert.equal(result.status, 'STOP LOSS');
  assert.equal(result.outcome, 'LOSS');
  assert.equal(result.rNow, -1);
});

test('historical signal stays explicitly unresolved when price never reaches entry or either outcome', () => {
  const result = runOutcomeResolver({}, [
    { time: 100, open: 100, high: 101, low: 99, close: 100 },
    { time: 200, open: 103, high: 110, low: 101, close: 108 }
  ]);
  assert.equal(result.status, 'HISTORICAL');
  assert.equal(result.outcome, 'UNRESOLVED');
  assert.equal(result.rNow, null);
});

test('historical signal expires without P&L when target passes before entry fills', () => {
  const result = runOutcomeResolver({}, [
    { time: 100, open: 100, high: 101, low: 99, close: 100 },
    { time: 200, open: 116, high: 118, low: 116, close: 117 }
  ]);
  assert.equal(result.status, 'EXPIRED');
  assert.equal(result.outcome, 'EXPIRED');
  assert.equal(result.exitPrice, null);
  assert.equal(result.rNow, null);
});

test('historical signal records a worse-than-planned R when the market gaps through the stop', () => {
  const result = runOutcomeResolver({}, [
    { time: 100, open: 100, high: 101, low: 99, close: 100 },
    { time: 200, open: 100, high: 102, low: 99, close: 101 },
    { time: 300, open: 92, high: 101, low: 91, close: 96 }
  ]);
  assert.equal(result.status, 'STOP LOSS');
  assert.equal(result.exitPrice, 92);
  assert.equal(result.rNow, -1.6);
});


test('signal generation includes multiple setup families rather than only sweep and break candles', () => {
  const start = html.indexOf('function scanOpportunityHistory(symbol,tf,bars){');
  const end = html.indexOf('function resolveSignalOutcomes', start);
  assert.ok(start >= 0 && end > start, 'signal scanner should be present');
  const scanner = html.slice(start, end);
  assert.match(scanner, /Buy-side liquidity sweep and reclaim/);
  assert.match(scanner, /Sell-side liquidity sweep and reclaim/);
  assert.match(scanner, /bullStructureEvent/);
  assert.match(scanner, /bearStructureEvent/);
  assert.match(scanner, /Recent FVG retest with directional close/);
  assert.match(scanner, /SBR level break and retest/);
  assert.match(scanner, /RBS level break and retest/);
  assert.match(scanner, /target\.rr<(?:3|MIN_REWARD_RISK)/);
});

test('BOS and CHoCH are classified from the preceding swing trend, not treated as interchangeable labels', () => {
  assert.match(html, /const bullStructureEvent=upBreak\?\(trendBear\?'CHoCH':'BOS'\):null/);
  assert.match(html, /const bearStructureEvent=downBreak\?\(trendBull\?'CHoCH':'BOS'\):null/);
});

test('multi-trigger signal reasons are retained as structured explanations', () => {
  assert.match(html, /const uniqueReasons=\[\.\.\.new Set\(reasons\)\]/);
  assert.match(html, /reason:uniqueReasons/);
  assert.match(html, /APA-SMC strict sequence heuristic; unvalidated/);
});


test('order blocks and breaker blocks use separate, causally ordered detection rules in the signal scanner', () => {
  assert.match(html, /function detectRecentBlockRetest\(bars,k,dispMult\)/);
  assert.match(html, /type:'ORDER BLOCK RETEST · IDM \+ LIQUIDITY SWEPT'/);
  assert.match(html, /type:'BREAKER BLOCK RETEST'/);
  assert.match(html, /const reject=flipped==='SELL'\?current\.close<zone\.low&&current\.close<current\.open:current\.close>zone\.high&&current\.close>current\.open/);
  assert.match(html, /const blockRetest=detectRecentBlockRetest\(hist,\+s\.k,s\.disp\)/);
});

test('equal highs/lows and premium/discount contribute context without acting as standalone entries', () => {
  assert.match(html, /EQL \/ sell-side liquidity confluence/);
  assert.match(html, /EQH \/ buy-side liquidity confluence/);
  assert.match(html, /Discount-half context/);
  assert.match(html, /Premium-half context/);
});


test('QML requires a head sweep, close-confirmed leg break, and left-shoulder retest', () => {
  assert.match(html, /function detectQmlStructure\(bars,k\)/);
  assert.match(html, /const level=z\[0\]\.p/);
  assert.match(html, /const sweptHead=z\[2\]\.p>z\[0\]\.p,brokenLeg=z\[3\]\.p<z\[1\]\.p/);
  assert.match(html, /prior\[j\]\.close<z\[1\]\.p/);
  assert.match(html, /status:rejected\?'RETEST_CONFIRMED':'WAITING_RETEST'/);
  assert.match(html, /function detectPatternRetest\(bars,k\)/);
  assert.match(html, /QML shoulder retest/);
  assert.doesNotMatch(html, /Head-and-shoulders neckline retest|Inverse head-and-shoulders neckline retest/);
  assert.match(html, /const patternRetest=detectPatternRetest\(hist,\+s\.k\)/);
});


test('confirmed block and pattern retests are allowed through the final direction gate', () => {
  assert.match(html, /patternRetest\?\.side==='BUY'\|\|blockRetest\?\.side==='BUY'/);
  assert.match(html, /patternRetest\?\.side==='SELL'\|\|blockRetest\?\.side==='SELL'/);
});


test('daily signal pane keeps today\'s signals plus older non-terminal pending and running trades', () => {
  assert.match(html, /class="signal-workspace" data-view="today"/);
  assert.match(html, /data-signal-tab="today"/);
  assert.match(html, /data-signal-view="today"/);
  assert.match(html, /Today’s signals/);
  assert.match(html, /const daily=allActiveSignals\(\)/);
  assert.match(html, /Market closure alone does not expire it/);
});

test('full signal performance reports history-wide win rate, realised R, active count and every signal', () => {
  assert.match(html, /Full signal performance/);
  assert.match(html, /id="perfWinRate"/);
  assert.match(html, /id="perfNetR"/);
  assert.match(html, /id="perfActive"/);
  assert.match(html, /id="performanceHistory"/);
  assert.match(html, /const netR=all\.reduce/);
});

test('realized R uses the actual recorded exit price, including adverse stop slippage', () => {
  const start = html.indexOf('function realizedSignalR(t){');
  const end = html.indexOf('function resolveSignalOutcomes', start);
  assert.ok(start >= 0 && end > start, 'realized R helper must exist before outcome resolution');
  const helper = html.slice(start, end);
  const result = runInNewContext(helper + `
    ({
      longGapLoss: realizedSignalR({side:'BUY',entry:100,sl:95,exitPrice:93,status:'STOP LOSS'}),
      shortGapLoss: realizedSignalR({side:'SELL',entry:100,sl:105,exitPrice:108,status:'STOP LOSS'}),
      targetFallback: realizedSignalR({side:'BUY',entry:100,sl:95,rr:3,status:'TAKE PROFIT'}),
      pending: realizedSignalR({side:'BUY',entry:100,sl:95,status:'PENDING'})
    })
  `);
  assert.equal(result.longGapLoss, -1.4);
  assert.equal(result.shortGapLoss, -1.6);
  assert.equal(result.targetFallback, 3);
  assert.equal(result.pending, null);
  assert.match(html, /const netR=all\.reduce\(\(sum,t\)=>sum\+\(\['TAKE PROFIT','STOP LOSS'\]\.includes\(t\.status\)\?\(realizedSignalR\(t\)\|\|0\):0\),0\)/);
});

test('historical outcome resolution accounts for stop gaps at the candle open', () => {
  assert.match(html, /const gapStop=t\.side==='BUY'\?bar\.open<=sl:bar\.open>=sl/);
  assert.match(html, /if\(gapStop\)\{finalStatus='STOP LOSS';exitPrice=bar\.open/);
  assert.match(html, /t\.rNow=realizedSignalR\(t\);t\.lastActivityAt=closedAt/);
});

test('active signals on background markets are monitored with their own fresh quotes', () => {
  assert.match(html, /function monitorTrades\(p,symbol=s\.symbol\)/);
  assert.match(html, /async function monitorBackgroundQuotes\(\)/);
  assert.match(html, /const markets=\[\.\.\.new Set\(s\.log\.filter\(t=>!terminal\.has\(String\(t\.status\|\|''\)\.toUpperCase\(\)\)&&t\.symbol!==s\.symbol\)\.map\(t=>t\.symbol\)\)\]/);
  assert.match(html, /monitorTrades\(p,symbol\)/);
  assert.match(html, /Background signal monitor skipped stale\/unverified quote/);
  assert.match(html, /await tick\(\);await monitorBackgroundQuotes\(\);await refreshSelectedCandles\(false\)/);
});

test('last activity timestamp changes on state transitions, while quote refresh has its own timestamp', () => {
  assert.match(html, /if\(t\.status!==previousStatus\)\{t\.lastActivityAt=now;changed=true/);
  assert.match(html, /if\(t\.lastObservedPrice!==p\)\{[\s\S]*?t\.lastPriceUpdateAt=now;[\s\S]*?persistSignals\(changedSignals\)/);
});

test('a live pending signal is not marked historical merely because a later candle closes', () => {
  assert.match(html, /A valid setup stays pending until entry is touched/);
  assert.match(html, /t\.status=t\.status==='NOT RUNNING'\?'NOT RUNNING':'PENDING';t\.outcome='PENDING'/);
});




test('signal desk and Today table use a consistent qualifying signal pool with a distinct missed pane', () => {
  assert.match(html, /function allActiveSignals\(\).*?Number\(t\.rr\)>=(?:3|MIN_REWARD_RISK)/);
  assert.match(html, /const daily=allActiveSignals\(\)/);
  for (const label of ['data-verified-filter="untriggered"','data-verified-filter="active"','data-verified-filter="closed"','data-verified-filter="missed"','id="verifiedMissedCount"','id="verifiedSignalList"']) assert.ok(html.includes(label));
  assert.match(html, /const tpPct=running&&hasPrice/);
  assert.match(html, /const slPct=running&&hasPrice/);
  assert.match(html, /const progressMarkup=running\?/);
  assert.match(html, /Entry was not triggered before expiry or invalidation/);
});

test('performance separates successful, unsuccessful, and missed-entry signals', () => {
  for (const label of ['data-performance-filter="successful"','data-performance-filter="unsuccessful"','data-performance-filter="missed"','id="performanceSuccessCount"','id="performanceLossCount"','id="performanceMissedCount"']) assert.ok(html.includes(label));
});


test('fresh live signals are blocked when offline, during FX closure, or when the latest candle is stale', () => {
  assert.match(html, /function fxSessionOpenAt\(/);
  assert.match(html, /function marketSessionOpen\(/);
  assert.match(html, /function signalEligibilityReason\(/);
  assert.match(html, /navigator\.onLine===false/);
  assert.match(html, /latest closed candle is stale/);
  assert.match(html, /if\(ageBars===0&&!liveEligible\)\{rejectLatest\(/);
  assert.match(html, /if\(latest&&liveEligible&&!found\.some/);
});

test('offline and reconnect events clearly pause fresh signals and resume automatic refresh', () => {
  assert.match(html, /window\.addEventListener\('offline'/);
  assert.match(html, /cached candles only\. New live signals are paused/);
  assert.match(html, /window\.addEventListener\('online'/);
  assert.match(html, /marketHealthBySymbol\.delete\(s\.symbol\)/);
  assert.match(html, /refreshTopDown\(true\)/);
});

test('untriggered EURUSD setups remain pending across weekly market closure', () => {
  assert.match(html, /function expirePendingSignalsForClosedSessions\(\)/);
  assert.match(html, /Session closure is not setup invalidation/);
  assert.match(html, /return 0;/);
  assert.doesNotMatch(html, /Forex weekly session closed before entry was triggered/);
  assert.match(html, /expirePendingSignalsForClosedSessions\(\);await tick\(\);s\.timer=setInterval/);
});
test('live setup generation fails closed while offline or when a market session is closed', () => {
  assert.match(html, /if\(typeof navigator!=='undefined'&&navigator\.onLine===false\)return 'offline: cached data only'/);
  assert.match(html, /if\(!marketSessionOpen\(symbol,new Date\(now\)\)\)return 'market session closed'/);
  assert.match(html, /if\(ageBars===0&&!liveEligible\)\{rejectLatest\(/);
});

test('signal candidates expose scalp, intraday, swing, or position horizon with a rough ATR target window', () => {
  assert.match(html, /function signalHorizonForTf\(tf\)/);
  assert.match(html, /return short\?'SCALP':intraday\?'INTRADAY':extended\?'SWING':'POSITION'/);
  assert.match(html, /function estimateTargetHorizon\(tf,bars,entry,tp\)/);
  assert.match(html, /rough ATR estimate, not a promise/);
  assert.match(html, /const timing=estimateTargetHorizon\(tf,hist,entry,target\.tp\)/);
  assert.match(html, /const timing=estimateTargetHorizon\(tf,b,entry,target\.tp\)/);
});
test('qualified order blocks are clearly labelled and prioritised in the chart overlay', () => {
  assert.match(html, /BULLISH DEMAND':'BEARISH SUPPLY'\)\+' ORDER BLOCK · DISPLACEMENT \+ BOS'/);
  assert.match(html, /text:obBullish\?'BULLISH OB':'BEARISH OB'/);
  assert.match(html, /const priority=\{'order-block':0/);
  assert.match(html, /kind:'order-block'/);
});
test('BTCUSD and QQQUSDT perpetual use 24/7 market-session logic while EURUSD follows forex hours', () => {
  assert.match(html, /function marketSessionOpen\(sym,now=new Date\(\)\)\{return sym==='EURUSD'\?fxSessionOpenAt\(now\):true\}/);
  assert.match(html, /BTCUSD:\{label:'BTC\/USD',type:'crypto'/);
  assert.match(html, /QQQUSDT:\{label:'QQQUSDT · ETF perpetual'/);
  assert.match(html, /else if\(String\(providerState\)\.toLowerCase\(\)==='closed'\)/);
});

test('signal scan analyses up to 2,000 retained closed candles per timeframe instead of truncating at 1,000', () => {
  assert.match(html, /Analyse the full retained candle history supplied by the timeframe loader, not only the last 1,000 bars/);
  assert.match(html, /const b=\(bars\|\|\[\]\)\.filter\(x=>!x\.isOpen\)\.slice\(-2000\),minimum=tf==='1Y'\?10:tf==='1M'\?20:35/);
});
test('trade horizon maps minute scalps separately from hourly intraday and higher-timeframe swing setups', () => {
  assert.match(html, /const short=\['1m','5m'\]\.includes\(tf\),intraday=\['15m','30m','1h'\]\.includes\(tf\),extended=\['4h','8h','12h','1d'\]\.includes\(tf\)/);
});


test('live admission rejects setups whose latest confirmed close already crossed stop or target', () => {
  assert.match(html, /Do not publish a pending limit setup if the latest confirmed candle has/);
  assert.match(html, /function candidateAlreadyPastLevels\(candidate,bars\)/);
  assert.match(html, /return candidate\.side==='BUY'\?\(mark<=sl\|\|mark>=tp\):\(mark>=sl\|\|mark<=tp\)/);
  assert.match(html, /if\(candidate\.status!=='RUNNING'&&candidateAlreadyPastLevels\(candidate,bars\)\)continue/);
});

test('signal admission has no artificial daily quota and scans eight execution timeframes', () => {
  assert.match(html, /function signalDayStamp\(t\)/);
  assert.doesNotMatch(html, /daily limit of [0-9]+ new candidates reached/);
  assert.doesNotMatch(html, /daily limit of [0-9]+ candidates for/);
  assert.match(html, /function candidateAlreadyPastLevels\(candidate,bars\)/);
  assert.match(html, /Automatic scan · '\+market\+' · 8 execution timeframes checked/);
  assert.match(html, /setInterval\(\(\)=>runAutomaticPairScan\(\),20000\)/);
  assert.match(html, /name="app-release" content="2026\.10\.24\.21"/);
  assert.match(html, /t\.verificationState='PROVISIONAL-HEURISTIC'/);
});

test('daily candidate display counts by identification time rather than historical candle time', () => {
  assert.match(html, /function signalDayStamp\(t\)/);
  assert.match(html, /const d=new Date\(Number\(t\.identifiedAt\)\|\|Number\(t\.time\)\*1000\)/);
  assert.match(html, /const today=s\.log\.filter\(t=>\{if\(!Number\.isFinite\(Number\(t\.time\)\)\|\|Number\(t\.rr\)<(?:3|MIN_REWARD_RISK)\)return false/);
});

test('untriggered setups expire only after a documented timeframe-specific entry window', () => {
  assert.match(html, /Pending entries need a finite, timeframe-specific validity window/);
  assert.match(html, /const maxPendingBars=\{'5m':18,'15m':16,'1h':24,'4h':18,'8h':12,'12h':10,'1d':7\}\[tf\]\|\|24/);
  assert.match(html, /Entry window expired after '\+maxPendingBars\+' closed '\+tf\+' candles without an entry fill/);
  assert.match(html, /t\.closedReason\|\|t\.reason\|\|t\.scanEngine/);
});

test('signal scanner remains async and has no artificial daily admission cap', () => {
  assert.match(html, /function signalDayStamp\(t\)/);
  assert.match(html, /async function scanBackgroundPair\(symbol,freshOnly=s\.signalFreshMode\)/);
  assert.doesNotMatch(html, /daily limit of [0-9]+ new candidates reached/);
  assert.match(html, /Pending entries need a finite, timeframe-specific validity window/);
});

test('expired untriggered setups are counted in missed performance, not unsuccessful trades', () => {
  assert.ok(html.includes("const missedPerformance=all.filter(t=>['EXPIRED','MISSED ENTRY','MISSED'].includes(String(t.status||'').toUpperCase()))"));
  assert.ok(html.includes("unsuccessful=all.filter(t=>t.status==='STOP LOSS')"));
  assert.ok(html.includes("const invalidatedPerformance=all.filter(t=>String(t.status||'').toUpperCase()==='INVALIDATED'"));
});

test('expired pending setups are visibly labelled missed and never presented as losing trades', () => {
  assert.ok(html.includes("const outcome=String(t.status||'').toUpperCase()==='EXPIRED'?'MISSED · ENTRY NOT TRIGGERED'"));
  assert.ok(html.includes("const missedPerformance=all.filter(t=>['EXPIRED','MISSED ENTRY','MISSED'].includes(String(t.status||'').toUpperCase()))"));
});

test('expired and invalidated pending signals have explicit non-loss labels', () => {
  assert.ok(html.includes("if(st==='EXPIRED'||st==='MISSED ENTRY'||st==='MISSED')return 'MISSED · ENTRY NOT TRIGGERED'"));
  assert.ok(html.includes("if(st==='INVALIDATED')return 'INVALIDATED BEFORE ENTRY'"));
  assert.ok(html.includes("if(['TAKE PROFIT','STOP LOSS','CLOSED'].includes(st))return 'CLOSED · '+st"));
});
