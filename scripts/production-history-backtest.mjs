import { mkdir, writeFile } from 'node:fs/promises';
import { createProductionScannerReplay } from './production-scanner-replay.mjs';
import { executeSignal } from './trade-entry-replay.mjs';

const OUT = new URL('../artifacts/production-history-backtest.md', import.meta.url);
const TIMEFRAMES = ['1m', '5m', '15m', '1h'];
const SYMBOLS = ['EURUSD', 'BTCUSD', 'QQQUSDT'];
const MIN_RR = 3;
const MAX_FORWARD_BARS = 100;
const INTERVAL_SECONDS = { '1m': 60, '5m': 300, '15m': 900, '1h': 3600 };
const report = [];
const failures = [];
const warnings = [];
let exactCoverage = 0;
let proxyCoverage = 0;
const iso = seconds => new Date(seconds * 1000).toISOString();
const num = x => x == null || x === '' ? NaN : Number(x);
function validOHLC(b) {
  return Number.isFinite(b.time) && [b.open,b.high,b.low,b.close].every(v => Number.isFinite(v) && v > 0) &&
    b.high >= Math.max(b.open,b.close,b.low) && b.low <= Math.min(b.open,b.close,b.high) && b.high >= b.low;
}
const log = line => { report.push(line); console.log(line); };

async function getJson(url) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(15000),
    headers: { 'user-agent': 'APA-SMC-production-history-backtest/1.0' }
  });
  if (!response.ok) throw new Error('HTTP ' + response.status);
  return response.json();
}
function normalizeBiquoteRow(row) {
  const raw = row.openTime ?? row.time ?? row.timestamp ?? row.date;
  const parsed = typeof raw === 'number' ? raw : (/^\d+(\.\d+)?$/.test(String(raw)) ? Number(raw) : Date.parse(raw));
  const time = Math.floor(parsed > 1e12 ? parsed / 1000 : parsed);
  const bar = { time, open: num(row.open), high: num(row.high), low: num(row.low), close: num(row.close) };
  return validOHLC(bar) ? bar : null;
}
function normalizeYahoo(json) {
  const result = json.chart?.result?.[0];
  if (!result) throw new Error(json.chart?.error?.description || 'Yahoo returned no chart result');
  const q = result.indicators?.quote?.[0];
  return (result.timestamp || []).map((time, i) => ({
    time,
    open: num(q?.open?.[i]), high: num(q?.high?.[i]), low: num(q?.low?.[i]), close: num(q?.close?.[i])
  })).filter(validOHLC);
}
function normalizeBinance(rows) {
  return rows.map(r => ({ time: Math.floor(num(r[0]) / 1000), open: num(r[1]), high: num(r[2]), low: num(r[3]), close: num(r[4]), volume: num(r[5]) }))
    .filter(validOHLC);
}
function normalizeBybit(rows) {
  return rows.map(r => ({ time: Math.floor(num(r[0]) / 1000), open: num(r[1]), high: num(r[2]), low: num(r[3]), close: num(r[4]), volume: num(r[5]) }))
    .filter(validOHLC).sort((a,b)=>a.time-b.time);
}
function normalizeGate(rows) {
  // Gate futures candle shape: [timestamp, volume, close, high, low, open, ...]
  return rows.map(r => ({ time: num(r[0]), open: num(r[5]), high: num(r[3]), low: num(r[4]), close: num(r[2]), volume: num(r[1]) }))
    .filter(b => Number.isFinite(b.time) && [b.open,b.high,b.low,b.close].every(Number.isFinite)).sort((a,b)=>a.time-b.time);
}
function configuredQqqProxy() {
  try {
    const url = new URL(String(process.env.QQQ_PROXY_URL || ''));
    if (url.protocol !== 'https:' || !url.hostname.endsWith('.workers.dev') ||
        url.username || url.password || url.search || url.hash) return '';
    return url.origin + url.pathname.replace(/\/$/, '');
  } catch { return ''; }
}
async function fetchBars(symbol, tf) {
  const errors = [];
  let best = null;
  if (symbol === 'EURUSD' || symbol === 'BTCUSD') {
    const consider = (bars, provider, exact) => {
      if (bars.length >= 100 && (!best || bars.length > best.bars.length)) best = { bars, provider, exact };
    };
    try {
      const json = await getJson('https://biquote.io/api/' + symbol + '/ohlc?interval=' + tf + '&limit=1000');
      const rows = Array.isArray(json) ? json : json.bars || json.data || json.candles || [];
      consider(rows.map(normalizeBiquoteRow).filter(Boolean).sort((a,b)=>a.time-b.time), 'Biquote ' + symbol, true);
      if (!best) errors.push('Biquote returned fewer than 100 valid bars');
    } catch (e) { errors.push('Biquote: ' + e.message); }
    const yahooSymbol = symbol === 'EURUSD' ? 'EURUSD=X' : 'BTC-USD';
    try {
      // Keep requests bounded, but prefer a deeper history than the first provider that responds.
      const range = tf === '1m' ? '7d' : tf === '5m' ? '14d' : '60d';
      const json = await getJson('https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(yahooSymbol) + '?range=' + range + '&interval=' + tf);
      consider(normalizeYahoo(json).sort((a,b)=>a.time-b.time), 'Yahoo chart ' + yahooSymbol + ' fallback', symbol === 'EURUSD');
    } catch (e) { errors.push('Yahoo: ' + e.message); }
    if (symbol === 'BTCUSD') {
      try {
        const rows = await getJson('https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=' + tf + '&limit=1000');
        consider(normalizeBinance(rows), 'Binance BTCUSDT proxy for BTCUSD (symbol differs)', false);
      } catch (e) { errors.push('Binance BTCUSDT fallback: ' + e.message); }
    }
    if (best) return best;
  } else {
    const proxyBase = configuredQqqProxy();
    const providers = [
      ...(proxyBase ? [['Configured Cloudflare Worker', async () => normalizeBinance(await getJson(proxyBase + '/fapi/v1/klines?symbol=QQQUSDT&interval=' + tf + '&limit=1000'))]] : []),
      ['Binance USD-M', async () => normalizeBinance(await getJson('https://fapi.binance.com/fapi/v1/klines?symbol=QQQUSDT&interval=' + tf + '&limit=1000'))],
      ['Binance API alternate', async () => normalizeBinance(await getJson('https://api.binance.com/fapi/v1/klines?symbol=QQQUSDT&interval=' + tf + '&limit=1000'))],
      ['Binance GCP alternate', async () => normalizeBinance(await getJson('https://api-gcp.binance.com/fapi/v1/klines?symbol=QQQUSDT&interval=' + tf + '&limit=1000'))],
      ['Bybit', async () => { const j = await getJson('https://api.bybit.com/v5/market/kline?category=linear&symbol=QQQUSDT&interval=' + ({'1m':'1','5m':'5','15m':'15','1h':'60'}[tf]) + '&limit=1000'); if (Number(j.retCode)!==0) throw new Error(j.retMsg || 'retCode ' + j.retCode); return normalizeBybit(j.result?.list || []); }],
      ['Bytick', async () => { const j = await getJson('https://api.bytick.com/v5/market/kline?category=linear&symbol=QQQUSDT&interval=' + ({'5m':'5','15m':'15','1h':'60'}[tf]) + '&limit=1000'); if (Number(j.retCode)!==0) throw new Error(j.retMsg || 'retCode ' + j.retCode); return normalizeBybit(j.result?.list || []); }],
      ['Gate USDT futures', async () => normalizeGate(await getJson('https://api.gateio.ws/api/v4/futures/usdt/candlesticks?contract=QQQ_USDT&interval=' + tf + '&limit=1000'))]
    ];
    for (const [provider, fetcher] of providers) {
      try {
        const bars = (await fetcher()).sort((a,b)=>a.time-b.time);
        if (bars.length >= 100) { best = { bars, provider, exact: true }; break; }
        errors.push(provider + ' returned only ' + bars.length + ' valid bars');
      } catch (e) { errors.push(provider + ': ' + e.message); }
    }
    if (best) return best;
    // Public runner IPs can be geo-blocked by futures exchanges. QQQ ETF is an
    // underlying-market proxy only; never label it as exact QQQUSDT contract data.
    try {
      const range = tf === '1m' ? '7d' : (tf === '5m' ? '14d' : '60d');
      const json = await getJson('https://query1.finance.yahoo.com/v8/finance/chart/QQQ?range=' + range + '&interval=' + tf);
      const bars = normalizeYahoo(json).sort((a,b)=>a.time-b.time);
      if (bars.length >= 100) return { bars, provider: 'Yahoo QQQ ETF proxy for QQQUSDT (not exact contract)', exact: false };
      errors.push('Yahoo QQQ ETF proxy returned only ' + bars.length + ' valid bars');
    } catch (e) { errors.push('Yahoo QQQ ETF proxy: ' + e.message); }
  }
  throw new Error(errors.join('; '));
}

function runBacktest(symbol, tf, bars, provider, exact) {
  const byTime = new Map(bars.map((b,i)=>[b.time,i]));
  const unique = new Map();
  const engine = createProductionScannerReplay({ now: (bars.at(-1)?.time || 0) * 1000 + INTERVAL_SECONDS[tf] * 1000 });
  // Replay the actual pending-OB detector at each historical candle close.
  // Do not treat retrospectively discovered HISTORICAL retests as orders that
  // existed before price touched their entry zones.
  // Replay the most recent 500 candle closes per timeframe to keep the repeated
  // production detector bounded; forward outcome evaluation still uses the full history.
  const firstIndex = Math.max(34, bars.length - 500);
  for (let i = firstIndex; i < bars.length - 1; i++) {
    const history = bars.slice(Math.max(0, i + 1 - 1000), i + 1);
    const signal = engine.pending(symbol, tf, history);
    if (!signal || signal.time !== bars[i].time) continue;
    const key = [signal.orderBlock?.originTime, signal.side, signal.entry, signal.sl].join('|');
    if (!unique.has(key)) unique.set(key, signal);
  }
  const candidates = [...unique.values()].sort((a,b)=>a.time-b.time || (Number(a.rr)||0)-(Number(b.rr)||0));
  const outcomes = [];
  let nextAvailableIndex = 0;
  for (const signal of candidates) {
    const index = byTime.get(signal.time);
    if (index == null || index < nextAvailableIndex) continue;
    const result = executeSignal(signal, bars, index);
    outcomes.push({ signal, ...result });
    // One pending/active trade at a time per symbol/timeframe.
    const endTime = result.exitTime ?? (result.entryTime && result.outcome.startsWith('UNRESOLVED') ? bars.at(-1).time : null);
    if (endTime != null && byTime.has(endTime)) nextAvailableIndex = byTime.get(endTime) + 1;
    else if (result.triggered || result.outcome.startsWith('UNRESOLVED')) nextAvailableIndex = bars.length;
  }
  const executed = outcomes.filter(x=>x.triggered);
  const resolved = executed.filter(x=>Number.isFinite(x.r));
  const wins = resolved.filter(x=>x.r>0).length;
  const losses = resolved.filter(x=>x.r<0).length;
  const grossWinR = resolved.filter(x=>x.r>0).reduce((sum,x)=>sum+x.r,0);
  const grossLossR = -resolved.filter(x=>x.r<0).reduce((sum,x)=>sum+x.r,0);
  const netR = grossWinR - grossLossR;
  let running = 0, peak = 0, maxDrawdown = 0;
  for (const x of resolved) { running += x.r; peak = Math.max(peak,running); maxDrawdown = Math.max(maxDrawdown,peak-running); }
  const days = bars.length > 1 ? (bars.at(-1).time - bars[0].time) / 86400 : 0;
  return { symbol, tf, bars: bars.length, days, provider, exact, diagnostic: null, candidates: candidates.length, evaluated: outcomes.length, executed: executed.length, wins, losses, unresolved: executed.length-resolved.length, missed: outcomes.filter(x=>!x.triggered&&/MISSED/.test(x.outcome)).length, invalidated: outcomes.filter(x=>!x.triggered&&/INVALIDATED/.test(x.outcome)).length, netR, grossWinR, grossLossR, profitFactor: grossLossR ? grossWinR/grossLossR : grossWinR ? Infinity : null, expectancyR: resolved.length ? netR/resolved.length : null, maxDrawdownR: maxDrawdown, winRate: resolved.length ? wins/resolved.length*100 : null, outcomes };
}
log('# APA SMC Live Desk — production-scanner historical replay');
log('');
log('- Generated: ' + new Date().toISOString());
log('- Engine: production pendingOrderBlockOpportunity extracted from index.html, replayed at each historical candle close. This run validates fresh FVG-backed pending order-block setups; it does not claim to validate every QML/FVG/inducement signal family.');
log('- Entry model: signal is evaluated after its candle closes; a limit/entry level must be touched on a later candle. Stops/targets are checked only after fill. If both are touched in one candle, stop-first is assumed. Only one pending or active trade is allowed per pair/timeframe at a time.');
log('- Minimum RR: 1:3. Maximum forward evaluation: ' + MAX_FORWARD_BARS + ' candles. No commission, spread, funding or slippage is included; R results are before costs.');
log('- Net R is the sum of resolved simulated wins and losses before transaction costs. Spread, commission, funding and slippage are excluded. This is historical candle replay, not live brokerage execution or proof of future profitability. Results with missing or proxy symbol feeds are not complete.');
log('');
log('| Pair | TF | Provider | Exact symbol data? | Bars | Days | Candidates | Evaluated | Filled | Wins | Losses | Unresolved | Missed | Invalidated | Win rate | Net R | PF | Expectancy R | Max DD R |');
log('|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|');

for (const symbol of SYMBOLS) {
  for (const tf of TIMEFRAMES) {
    try {
      const data = await fetchBars(symbol, tf);
      const nowSeconds = Math.floor(Date.now() / 1000);
      const bars = data.bars.filter(b => validOHLC(b) && b.time + INTERVAL_SECONDS[tf] <= nowSeconds)
        .sort((a,b)=>a.time-b.time);
      const result = runBacktest(symbol, tf, bars, data.provider, data.exact);
      log('- Last closed candle: ' + iso(bars.at(-1).time) + '; close ' + bars.at(-1).close);
      if (data.exact) exactCoverage++; else proxyCoverage++;
      const rate = result.winRate == null ? 'n/a' : result.winRate.toFixed(1) + '% (n=' + (result.wins + result.losses) + ')';
      log('| ' + symbol + ' | ' + tf + ' | ' + data.provider + ' | ' + (data.exact ? 'yes' : 'NO, proxy') + ' | ' + result.bars + ' | ' + result.days.toFixed(1) + ' | ' + result.candidates + ' | ' + result.evaluated + ' | ' + result.executed + ' | ' + result.wins + ' | ' + result.losses + ' | ' + result.unresolved + ' | ' + result.missed + ' | ' + result.invalidated + ' | ' + rate + ' | ' + result.netR.toFixed(2) + 'R | ' + (result.profitFactor === Infinity ? '∞' : result.profitFactor == null ? 'n/a' : result.profitFactor.toFixed(2)) + ' | ' + (result.expectancyR == null ? 'n/a' : result.expectancyR.toFixed(2) + 'R') + ' | ' + result.maxDrawdownR.toFixed(2) + 'R |');
      if (!data.exact) warnings.push(symbol + ' ' + tf + ' uses a symbol/venue proxy');
      if (result.days < 30) warnings.push(symbol + ' ' + tf + ' has less than 30 days of history');
      log('');
      log('### ' + symbol + ' ' + tf + ' trade outcomes');
      if (!result.outcomes.length) log('- No qualifying production-scanner candidates in this sample.');
      for (const x of result.outcomes) {
        const s = x.signal;
        log('- ' + iso(s.time) + ' ' + s.side + ' entry ' + s.entry + ', SL ' + s.sl + ', TP ' + s.tp + ', planned ' + Number(s.rr).toFixed(2) + 'R → ' + x.outcome + (Number.isFinite(x.r) ? ' (' + x.r.toFixed(2) + 'R)' : '') + (x.entryTime ? '; filled ' + iso(x.entryTime) : '') + (x.exitTime ? '; resolved ' + iso(x.exitTime) : ''));
      }
      log('');
    } catch (e) {
      const message = symbol + ' ' + tf + ': ' + e.message;
      failures.push(message);
      log('| ' + symbol + ' | ' + tf + ' | unavailable | no | 0 | 0 | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a |');
      log('');
      log('**DATA FAILURE:** ' + message);
      log('');
    }
  }
}
log('## Validation summary');
log('- Exact pair/timeframe data coverage: ' + exactCoverage + '/' + (SYMBOLS.length * TIMEFRAMES.length));
log('- Proxy pair/timeframe coverage: ' + proxyCoverage + '/' + (SYMBOLS.length * TIMEFRAMES.length) + ' (not valid as exact-contract proof)');
log('- Data failures: ' + failures.length);
log('- Warnings: ' + warnings.length);
for (const x of warnings) log('- WARNING: ' + x);
for (const x of failures) log('- FAILURE: ' + x);
await mkdir(new URL('../artifacts/', import.meta.url), { recursive: true });
await writeFile(OUT, report.join('\n') + '\n', 'utf8');
console.log('Wrote artifacts/production-history-backtest.md');
if (failures.length || proxyCoverage > 0) process.exitCode = 1;
