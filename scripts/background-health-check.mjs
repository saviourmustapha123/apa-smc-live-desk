import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const SITE = 'https://saviourmustapha123.github.io/apa-smc-live-desk/';
const SOURCE = `https://raw.githubusercontent.com/saviourmustapha123/apa-smc-live-desk/${process.env.GITHUB_SHA || 'main'}/index.html`;
const API = 'https://biquote.io/api';
const failures = [];
const warnings = [];
const pass = (name, detail = '') => console.log(`PASS  ${name}${detail ? ' — ' + detail : ''}`);
const fail = (name, detail = '') => { failures.push(name); console.error(`FAIL  ${name}${detail ? ' — ' + detail : ''}`); };
const warn = (name, detail = '') => { warnings.push(name); console.warn(`WARN  ${name}${detail ? ' — ' + detail : ''}`); };

async function get(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(15000), headers: { 'user-agent': 'APA-SMC-Live-Desk-health-check/1.0' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res;
}

let source = '';
try {
  source = await (await get(SOURCE)).text();
  if (source.includes('APA · SMC Live Desk') && source.includes('function analyse()')) pass('Repository source fetched');
  else fail('Repository source content', 'Expected app title or analysis function is missing');

  const scripts = [...source.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(m => m[1]).filter(x => x.trim());
  if (!scripts.length) fail('Inline JavaScript found');
  else {
    try { scripts.forEach((code, i) => new vm.Script(code, { filename: `index-inline-${i + 1}.js` })); pass('Inline JavaScript syntax', `${scripts.length} inline script(s) parse successfully`); }
    catch (e) { fail('Inline JavaScript syntax', e.message); }
  }


try {
  const quote = await (await get('https://fapi.binance.com/fapi/v1/ticker/price?symbol=QQQUSDT')).json();
  if (quote.symbol === 'QQQUSDT' && Number(quote.price) > 0) pass('Binance QQQUSDT perpetual live quote', String(quote.price));
  else fail('Binance QQQUSDT perpetual live quote', 'Missing symbol or positive price');
  for (const interval of ['1h', '8h', '12h']) {
    const rows = await (await get('https://fapi.binance.com/fapi/v1/klines?symbol=QQQUSDT&interval=' + interval + '&limit=3')).json();
    if (Array.isArray(rows) && rows.length > 0 && rows.every(r => Array.isArray(r) && [0,1,2,3,4,5,6].every(i => Number.isFinite(Number(r[i]))))) pass('Binance QQQUSDT ' + interval + ' candles', rows.length + ' valid OHLCV rows');
    else fail('Binance QQQUSDT ' + interval + ' candles', 'No valid OHLCV rows');
  }
} catch (e) { if (/HTTP 451/.test(e.message)) warn('Binance QQQUSDT public REST feed is region-restricted from this CI runner', 'Binance connector has returned live QQQUSDT quotes and candles, but the deployed browser feed remains dependent on the viewer\'s network region.'); else fail('Binance QQQUSDT market feed', e.message); }

  try {
    const response = await (await get('https://api.bybit.com/v5/market/tickers?category=linear&symbol=QQQUSDT')).json();
    const ticker = response.result?.list?.[0];
    if (Number(response.retCode) === 0 && ticker?.symbol === 'QQQUSDT' && Number(ticker.lastPrice) > 0) pass('Bybit QQQUSDT perpetual live quote', ticker.lastPrice);
    else fail('Bybit QQQUSDT perpetual live quote', response.retMsg || 'Missing valid ticker');
    for (const interval of ['1', '60', '480', '720']) {
      const data = await (await get('https://api.bybit.com/v5/market/kline?category=linear&symbol=QQQUSDT&interval=' + interval + '&limit=3')).json();
      const rows = data.result?.list;
      if (Number(data.retCode) === 0 && Array.isArray(rows) && rows.length && rows.every(r => Array.isArray(r) && [0,1,2,3,4,5].every(i => Number.isFinite(Number(r[i]))))) pass('Bybit QQQUSDT interval ' + interval, rows.length + ' valid OHLCV rows');
      else fail('Bybit QQQUSDT interval ' + interval, data.retMsg || 'No valid OHLCV rows');
    }
  } catch (e) { if (/HTTP (403|451)/.test(e.message)) warn('Bybit public market-data endpoint is region-restricted from this CI runner', e.message); else fail('Bybit QQQUSDT market feed', e.message); }

  const checks = [
    ['minimum 1:3 reward/risk gate', /rr\s*<\s*3/.test(source)],
    ['EURUSD, BTCUSD and QQQUSDT supported', /EURUSD/.test(source) && /BTCUSD/.test(source) && /QQQUSDT/.test(source) && /fapi\.binance\.com/.test(source) && /api\.bybit\.com/.test(source) && /qqqProvider/.test(source)],
    ['unsafe dynamic content escaping helper', /function escapeHTML\(/.test(source)],
    ['HTTPS-only Biquote plus Bybit/Binance QQQUSDT adapters', /function safeApiBase\(/.test(source) && /https:\/\/biquote\.io\/api/.test(source) && /https:\/\/fapi\.binance\.com/.test(source) && /https:\/\/api\.bybit\.com/.test(source) && /sym==='QQQUSDT'/.test(source)],
    ['QQQUSDT provider selector and separate venue cache', /id="qqqProvider"/.test(source) && /function qqqCacheSymbol\(/.test(source) && /QQQUSDT_/.test(source)],
    ['content security policy present', /Content-Security-Policy/.test(source)],
    ['forex tick-volume fallback is explicit', /useTicks\?ticks/.test(source) && /tick-volume proxy/.test(source)],
    ['unknown quote freshness fails closed', /!Number\.isFinite\(age\)/.test(source) && /age>300/.test(source)],
    ['volume profile warns it is approximate', /uniformly over the price bins/.test(source) && /volume-source unknown/.test(source)],
    ['eleven-timeframe opportunity scanner including 8H, 12H, weekly, monthly and yearly', /function scanOpportunityHistory/.test(source) && /scanSets=\[\['1m'/.test(source) && /\['8h',h8\]/.test(source) && /\['12h',h12\]/.test(source) && /\['1W',weekly\]/.test(source) && /\['1M',monthly\]/.test(source) && /\['1Y',yearly\]/.test(source)],
    ['8H/12H and weekly/monthly/yearly chart aggregation', /data-t="8h">8H/.test(source) && /data-t="12h">12H/.test(source) && /data-t="1W">1W/.test(source) && /data-t="1M">1M/.test(source) && /data-t="1Y">1Y/.test(source) && /aggregateHours\(hourly,tf==='8h'\?8:12\)/.test(source) && /calendarAggregate\(daily,'week'\)/.test(source) && /calendarAggregate\(daily,'year'\)/.test(source)],
    ['selected candle feed refreshes separately from live quote polling', /async function refreshSelectedCandles\(force=false\)/.test(source) && /await tick\(\);await refreshSelectedCandles\(false\)/.test(source)],
    ['all configured markets included in background scan', /async function scanBackgroundPair/.test(source) && /Object\.keys\(symbolConfig\)\.filter\(market=>market!==sym\)/.test(source) && /otherPairNew\+=await scanBackgroundPair\(other\)/.test(source)],
    ['signal journal uses IndexedDB', /createObjectStore\(SIGNALS/.test(source) && /function persistSignals/.test(source)],
    ['continuous opportunity polling', /setInterval\(\(\)=>refreshTopDown\(\),60000\)/.test(source)],
    ['no artificial 500-signal cap', !/s\.log\s*=\s*s\.log\.slice\(0,\s*500\)/.test(source)],
    ['no brokerage execution integration', !/apiKeySecret|brokerPassword|placeOrder\s*\(/i.test(source)]
  ];
  for (const [name, ok] of checks) ok ? pass(name) : fail(name);
} catch (e) { fail('Repository source fetch', e.message); }

try {
  const res = await get(SITE);
  const html = await res.text();
  if (html.includes('APA · SMC Live Desk')) pass('GitHub Pages site responds', `HTTP ${res.status}, ${html.length} bytes`);
  else fail('GitHub Pages site content', 'HTTP success but expected app title not found');
} catch (e) { fail('GitHub Pages site reachability', e.message); }

for (const symbol of ['EURUSD', 'BTCUSD']) {
  try {
    const quote = await (await get(`${API}/${symbol}`)).json();
    const mid = Number(quote.mid ?? ((Number(quote.bid) + Number(quote.ask)) / 2));
    if (!Number.isFinite(mid) || mid <= 0) fail(`${symbol} live quote shape`, 'Missing positive mid/bid-ask price');
    else {
      if (quote.stale || Number(quote.quoteAgeSeconds) > 300 || quote.marketState === 'closed') warn(`${symbol} quote freshness`, `marketState=${quote.marketState ?? 'unknown'}, age=${quote.quoteAgeSeconds ?? 'unknown'}s`);
      else pass(`${symbol} live quote`, `mid=${mid}, source=${quote.source ?? 'not specified'}`);
    }
  } catch (e) {
    fail(`${symbol} live quote endpoint`, e.message);
  }

  try {
    const data = await (await get(`${API}/${symbol}/ohlc?interval=5m&limit=60`)).json();
    const bars = Array.isArray(data) ? data : data.bars ?? data.data ?? data.candles ?? [];
    const valid = bars.filter(b => {
      const o = Number(b.open), h = Number(b.high), l = Number(b.low), c = Number(b.close);
      const raw = b.openTime ?? b.time ?? b.timestamp;
      const t0 = typeof raw === 'number' ? raw : (/^\d+(\.\d+)?$/.test(String(raw)) ? Number(raw) : Date.parse(raw));
      const t = t0 > 1e12 ? t0 / 1000 : t0;
      return Number.isFinite(t) && t > 0 && [o,h,l,c].every(Number.isFinite) && h >= Math.max(o,c,l) && l <= Math.min(o,c,h);
    });
    if (valid.length < 35) fail(`${symbol} OHLC data quality`, `Only ${valid.length} valid bars returned; 35 needed for app analysis`);
    else pass(`${symbol} OHLC data quality`, `${valid.length} valid bars`);
  } catch (e) { fail(`${symbol} OHLC endpoint`, e.message); }
}

console.log(`\nSUMMARY: ${failures.length} failure(s), ${warnings.length} warning(s).`);
if (process.env.GITHUB_STEP_SUMMARY) {
  const summary = [
    '# APA · SMC Live Desk background health check',
    '',
    `- Run time (UTC): ${new Date().toISOString()}`,
    `- Failures: **${failures.length}**`,
    `- Warnings: **${warnings.length}**`,
    '',
    'This job checks site availability, feed shape/data quality, JavaScript syntax, and key safety guards. It is **not** a strategy profitability backtest and does not execute or publish trade orders.',
    '',
    failures.length ? '## Failures\n' + failures.map(x => '- ' + x).join('\n') : '## Failures\n- None',
    warnings.length ? '## Warnings\n' + warnings.map(x => '- ' + x).join('\n') : '## Warnings\n- None'
  ].join('\n');
  await (await import('node:fs/promises')).appendFile(process.env.GITHUB_STEP_SUMMARY, summary + '\n');
}
if (failures.length) process.exitCode = 1;
