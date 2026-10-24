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
  assert.match(html, /await tick\(\);await refreshSelectedCandles\(false\)/);
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

test('historical opportunity scan uses monthly/yearly minimum history instead of a fixed 35-bar floor', () => {
  assert.match(html, /for\(let i=minimum-1;i<b\.length;i\+\+\)/);
  assert.match(html, /const scanStart=Math\.max\(minimumBars-1,b\.length-120\)/);
  assert.match(html, /minimumBars=s\.tf==='1Y'\?10:s\.tf==='1M'\?20:35/);
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

test('live chart only labels order blocks after displacement, FVG and close-confirmed structure break', () => {
  assert.match(html, /function recentQualifiedZones\(/);
  assert.match(html, /impulse\.low>b\[i-2\]\.high/);
  assert.match(html, /impulse\.high<b\[i-2\]\.low/);
  assert.match(html, /close-confirmed structure break/);
  assert.match(html, /qualifiedZones=recentQualifiedZones/);
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
  assert.match(html, /const x1=chartXForTime\(z\.start\),mappedX2=chartXForTime\(z\.end\)/);
  assert.match(html, /s\.globalMarks=allMarks\.sort/);
  assert.match(html, /const marksToDraw=\(s\.globalMarks\|\|\[\]\)\.filter\(mark=>mode!==\x27clean\x27\|\|mark\.sourceTf===s\.tf\|\|htf\.has\(mark\.sourceTf\)\)/);
  assert.ok(html.includes("tag.textContent='['+mark.sourceTf.toUpperCase()+'] '+mark.text"));
  assert.match(html, /t\.symbol===s\.symbol&&String\(t\.status\|\|\x27\x27\)\.toUpperCase\(\)!==\x27HISTORICAL\x27/);
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
  assert.match(html, /value="clean" selected>Clean/);
  assert.match(html, /value="balanced">Balanced/);
  assert.match(html, /value="full">Full map/);
  assert.match(html, /const zoneLimit=mode==='clean'\?2:mode==='balanced'\?6:24/);
  assert.match(html, /const tradeLimit=mode==='clean'\?4:mode==='balanced'\?12:40/);
});

test('daily target tracker counts actual 1:3+ candidates without manufacturing signals', () => {
  assert.match(html, /dailyTarget:6/);
  assert.match(html, /function renderDailyTarget\(\)/);
  assert.match(html, /Only detected setups count; the scanner will not fabricate trades/);
  assert.match(html, /renderSignalMonitor\(\);renderSetupBoard\(\);renderDailyTarget\(\)/);
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
  assert.match(html, /await tick\(\);await refreshSelectedCandles\(false\);await refreshTopDown\(false\)/);
  assert.match(html, /Date\.now\(\)-s\.lastOtherPairScan>=300000/);
});

test('signal monitor displays completed R results, not only open-trade R values', () => {
  assert.match(html, /const rNow=Number\.isFinite\(t\.rNow\)\?t\.rNow\.toFixed\(2\)\+'R':'—'/);
  assert.match(html, /const outcome=t\.outcome\|\|\(t\.status==='TAKE PROFIT'\?'SUCCESS':t\.status==='STOP LOSS'\?'LOSS'/);
});


function runOutcomeResolver(signal, bars) {
  const start = html.indexOf('function resolveSignalOutcomes(symbol,tf,bars)');
  const end = html.indexOf('async function scanBackgroundPair(symbol)', start);
  assert.ok(start >= 0 && end > start, 'resolver source should be present');
  const context = {
    s: { log: [{ symbol: 'QQQUSDT', tf: '5m', side: 'BUY', entry: 100, sl: 95, tp: 115, rr: 3, time: 100, status: 'HISTORICAL', ...signal }] },
    save() {},
    persistSignals() {},
    renderLog() {},
    Date
  };
  const resolver = runInNewContext(html.slice(start, end) + '\\nresolveSignalOutcomes', context);
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

test('historical signal is marked missed when target trades beyond entry without filling entry', () => {
  const result = runOutcomeResolver({}, [
    { time: 100, open: 100, high: 101, low: 99, close: 100 },
    { time: 200, open: 116, high: 118, low: 116, close: 117 }
  ]);
  assert.equal(result.status, 'MISSED ENTRY');
  assert.equal(result.outcome, 'MISSED ENTRY');
});
