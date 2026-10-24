import { mkdir, writeFile } from 'node:fs/promises';
import { createProductionScannerReplay } from './production-scanner-replay.mjs';

const OUT = new URL('../artifacts/production-history-backtest.md', import.meta.url);
const TIMEFRAMES = ['5m', '15m', '1h'];
const SYMBOLS = ['EURUSD', 'BTCUSD', 'QQQUSDT'];
const MIN_RR = 3;
const MAX_FORWARD_BARS = 100;
const INTERVAL_SECONDS = { '5m': 300, '15m': 900, '1h': 3600 };
const report = [];
const failures = [];
const warnings = [];
const iso = seconds => new Date(seconds * 1000).toISOString();
const num = x => Number(x);
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
  return Number.isFinite(time) && [bar.open, bar.high, bar.low, bar.close].every(Number.isFinite) ? bar : null;
}
function normalizeYahoo(json) {
  const result = json.chart?.result?.[0];
  if (!result) throw new Error(json.chart?.error?.description || 'Yahoo returned no chart result');
  const q = result.indicators?.quote?.[0];
  return (result.timestamp || []).map((time, i) => ({
    time,
    open: num(q?.open?.[i]), high: num(q?.high?.[i]), low: num(q?.low?.[i]), close: num(q?.close?.[i])
  })).filter(b => Number.isFinite(b.time) && [b.open,b.high,b.low,b.close].every(Number.isFinite));
}
function normalizeBinance(rows) {
  return rows.map(r => ({ time: Math.floor(num(r[0]) / 1000), open: num(r[1]), high: num(r[2]), low: num(r[3]), close: num(r[4]), volume: num(r[5]) }))
    .filter(b => Number.isFinite(b.time) && [b.open,b.high,b.low,b.close].every(Number.isFinite));
}
function normalizeBybit(rows) {
  return rows.map(r => ({ time: Math.floor(num(r[0]) / 1000), open: num(r[1]), high: num(r[2]), low: num(r[3]), close: num(r[4]), volume: num(r[5]) }))
    .filter(b => Number.isFinite(b.time) && [b.open,b.high,b.low,b.close].every(Number.isFinite)).sort((a,b)=>a.time-b.time);
}
function normalizeGate(rows) {
  // Gate futures candle shape: [timestamp, volume, close, high, low, open, ...]
  return rows.map(r => ({ time: num(r[0]), open: num(r[5]), high: num(r[3]), low: num(r[4]), close: num(r[2]), volume: num(r[1]) }))
    .filter(b => Number.isFinite(b.time) && [b.open,b.high,b.low,b.close].every(Number.isFinite)).sort((a,b)=>a.time-b.time);
}
async function fetchBars(symbol, tf) {
  const errors = [];
  if (symbol === 'EURUSD' || symbol === 'BTCUSD') {
    try {
      const json = await getJson('https://biquote.io/api/' + symbol + '/ohlc?interval=' + tf + '&limit=1000');
      const rows = Array.isArray(json) ? json : json.bars || json.data || json.candles || [];
      const bars = rows.map(normalizeBiquoteRow).filter(Boolean).sort((a,b)=>a.time-b.time);
      if (bars.length >= 100) return { bars, provider: 'Biquote ' + symbol, exact: true };
      errors.push('Biquote returned only ' + bars.length + ' valid bars');
    } catch (e) { errors.push('Biquote: ' + e.message); }
    const yahooSymbol = symbol === 'EURUSD' ? 'EURUSD=X' : 'BTC-USD';
    try {
      const range = tf === '1h' ? '730d' : '60d';
      const json = await getJson('https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(yahooSymbol) + '?range=' + range + '&interval=' + tf);
      const bars = normalizeYahoo(json).sort((a,b)=>a.time-b.time);
      if (bars.length >= 100) return { bars, provider: 'Yahoo chart ' + yahooSymbol + ' fallback', exact: true };
      errors.push('Yahoo returned only ' + bars.length + ' valid bars');
    } catch (e) { errors.push('Yahoo: ' + e.message); }
    // BTCUSDT is a different venue/symbol from BTCUSD; do not silently treat it as identical.
    if (symbol === 'BTCUSD') {
      try {
        const rows = await getJson('https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=' + tf + '&limit=1000');
        const bars = normalizeBinance(rows);
        if (bars.length >= 100) return { bars, provider: 'Binance BTCUSDT proxy for BTCUSD (symbol differs)', exact: false };
        errors.push('Binance BTCUSDT returned only ' + bars.length + ' bars');
      } catch (e) { errors.push('Binance BTCUSDT fallback: ' + e.message); }
    }
  } else {
    const providers = [
      ['Binance USD-M', async () => normalizeBinance(await getJson('https://fapi.binance.com/fapi/v1/klines?symbol=QQQUSDT&interval=' + tf + '&limit=1000'))],
      ['Bybit', async () => { const j = await getJson('https://api.bybit.com/v5/market/kline?category=linear&symbol=QQQUSDT&interval=' + ({'5m':'5','15m':'15','1h':'60'}[tf]) + '&limit=1000'); if (Number(j.retCode)!==0) throw new Error(j.retMsg || 'retCode ' + j.retCode); return normalizeBybit(j.result?.list || []); }],
      ['Bytick', async () => { const j = await getJson('https://api.bytick.com/v5/market/kline?category=linear&symbol=QQQUSDT&interval=' + ({'5m':'5','15m':'15','1h':'60'}[tf]) + '&limit=1000'); if (Number(j.retCode)!==0) throw new Error(j.retMsg || 'retCode ' + j.retCode); return normalizeBybit(j.result?.list || []); }],
      ['Gate USDT futures', async () => normalizeGate(await getJson('https://api.gateio.ws/api/v4/futures/usdt/candlesticks?contract=QQQ_USDT&interval=' + tf + '&limit=1000'))]
    ];
    for (const [provider, fetcher] of providers) {
      try {
        const bars = (await fetcher()).sort((a,b)=>a.time-b.time);
        if (bars.length >= 100) return { bars, provider, exact: true };
        errors.push(provider + ' returned only ' + bars.length + ' valid bars');
      } catch (e) { errors.push(provider + ': ' + e.message); }
    }
  }
  throw new Error(errors.join('; '));
}

function executeSignal(signal, bars, index) {
  const riskAtPlannedEntry = signal.side === 'BUY' ? signal.entry - signal.sl : signal.sl - signal.entry;
  const plannedReward = signal.side === 'BUY' ? signal.tp - signal.entry : signal.entry - signal.tp;
  if (!(riskAtPlannedEntry > 0 && plannedReward > 0 && plannedReward / riskAtPlannedEntry >= MIN_RR)) return { outcome: 'REJECTED INVALID LEVELS/RR', r: null, triggered: false };
  let triggeredAt = -1;
  for (let i = index + 1; i < Math.min(bars.length, index + 1 + MAX_FORWARD_BARS); i++) {
    const b = bars[i];
    const entryTouched = b.low <= signal.entry && b.high >= signal.entry;
    const stopTouched = signal.side === 'BUY' ? b.low <= signal.sl : b.high >= signal.sl;
    const targetTouched = signal.side === 'BUY' ? b.high >= signal.tp : b.low <= signal.tp;
    if (stopTouched && !entryTouched) return { outcome: 'INVALIDATED BEFORE ENTRY', r: null, triggered: false, exitTime: b.time };
    if (targetTouched && !entryTouched) return { outcome: 'MISSED ENTRY (target reached first)', r: null, triggered: false, exitTime: b.time };
    if (entryTouched) { triggeredAt = i; break; }
  }
  if (triggeredAt < 0) {
    const horizon = Math.min(bars.length, index + 1 + MAX_FORWARD_BARS);
    if (horizon >= bars.length) return { outcome: 'UNRESOLVED (data ended)', r: null, triggered: false };
    return { outcome: 'MISSED ENTRY / NOT FILLED', r: null, triggered: false };
  }
  const entry = signal.entry;
  const risk = signal.side === 'BUY' ? entry - signal.sl : signal.sl - entry;
  const rr = Math.abs(signal.tp - entry) / risk;
  for (let i = triggeredAt; i < Math.min(bars.length, triggeredAt + MAX_FORWARD_BARS); i++) {
    const b = bars[i];
    const stop = signal.side === 'BUY' ? b.low <= signal.sl : b.high >= signal.sl;
    const target = signal.side === 'BUY' ? b.high >= signal.tp : b.low <= signal.tp;
    if (stop && target) return { outcome: 'LOSS (same-candle ambiguity; stop-first)', r: -1, triggered: true, entry, entryTime: bars[triggeredAt].time, exitTime: b.time };
    if (stop) {
      const exit = signal.side === 'BUY' && b.open < signal.sl ? b.open : signal.side === 'SELL' && b.open > signal.sl ? b.open : signal.sl;
      return { outcome: 'LOSS', r: ((exit-entry) * (signal.side === 'BUY' ? 1 : -1)) / risk, triggered: true, entry, entryTime: bars[triggeredAt].time, exitTime: b.time };
    }
    if (target) return { outcome: 'WIN', r: rr, triggered: true, entry, entryTime: bars[triggeredAt].time, exitTime: b.time };
  }
  return { outcome: 'UNRESOLVED (forward window)', r: null, triggered: true, entry, entryTime: bars[triggeredAt].time };
}

function runBacktest(symbol, tf, bars, provider, exact) {
  const engine = createProductionScannerReplay({ now: Date.now() });
  const { signals, diagnostic } = engine.scan(symbol, tf, bars);
  const byTime = new Map(bars.map((b,i)=>[b.time,i]));
  const unique = new Map();
  for (const signal of signals) {
    if (!Number.isFinite(signal.time) || !byTime.has(signal.time)) continue;
    const key = [signal.time,signal.side,signal.entry,signal.sl,signal.tp,signal.setupType].join('|');
    if (!unique.has(key)) unique.set(key, signal);
  }
  const candidates = [...unique.values()].sort((a,b)=>a.time-b.time);
  const outcomes = candidates.map(signal => ({ signal, ...executeSignal(signal, bars, byTime.get(signal.time)) }));
  const executed = outcomes.filter(x=>x.triggered);
  const resolved = executed.filter(x=>Number.isFinite(x.r));
  const wins = resolved.filter(x=>x.r>0).length;
  const losses = resolved.filter(x=>x.r<0).length;
  const grossR = resolved.reduce((sum,x)=>sum+x.r,0);
  const days = bars.length > 1 ? (bars.at(-1).time - bars[0].time) / 86400 : 0;
  return { symbol, tf, bars: bars.length, days, provider, exact, diagnostic, candidates: outcomes.length, executed: executed.length, wins, losses, unresolved: executed.length-resolved.length, missed: outcomes.filter(x=>!x.triggered&&/MISSED/.test(x.outcome)).length, invalidated: outcomes.filter(x=>!x.triggered&&/INVALIDATED/.test(x.outcome)).length, grossR, winRate: resolved.length ? wins/resolved.length*100 : null, outcomes };
}

log('# APA SMC Live Desk — production-scanner historical replay');
log('');
log('- Generated: ' + new Date().toISOString());
log('- Engine: actual production scanOpportunityHistory source extracted from index.html, not the simplified proxy strategy.');
log('- Entry model: signal is evaluated after its candle closes; a limit/entry level must be touched on a later candle. Stops/targets are checked only after fill. If both are touched in one candle, stop-first is assumed.');
log('- Minimum RR: 1:3. Maximum forward evaluation: ' + MAX_FORWARD_BARS + ' candles. No commission/spread/slippage is included; gross R only.');
log('- This is historical candle replay, not live brokerage execution or proof of future profitability.');
log('');
log('| Pair | TF | Provider | Exact symbol data? | Bars | Days | Candidates | Filled | Wins | Losses | Unresolved | Missed | Invalidated | Win rate | Gross R |');
log('|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|');

for (const symbol of SYMBOLS) {
  for (const tf of TIMEFRAMES) {
    try {
      const data = await fetchBars(symbol, tf);
      const nowSeconds = Math.floor(Date.now() / 1000);
      const bars = data.bars.filter(b => Number.isFinite(b.time) && [b.open,b.high,b.low,b.close].every(Number.isFinite) && b.time + INTERVAL_SECONDS[tf] <= nowSeconds)
        .sort((a,b)=>a.time-b.time);
      const result = runBacktest(symbol, tf, bars, data.provider, data.exact);
      const rate = result.winRate == null ? 'n/a' : result.winRate.toFixed(1) + '%';
      log('| ' + symbol + ' | ' + tf + ' | ' + data.provider + ' | ' + (data.exact ? 'yes' : 'NO, proxy') + ' | ' + result.bars + ' | ' + result.days.toFixed(1) + ' | ' + result.candidates + ' | ' + result.executed + ' | ' + result.wins + ' | ' + result.losses + ' | ' + result.unresolved + ' | ' + result.missed + ' | ' + result.invalidated + ' | ' + rate + ' | ' + result.grossR.toFixed(2) + 'R |');
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
log('- Data failures: ' + failures.length);
log('- Warnings: ' + warnings.length);
for (const x of warnings) log('- WARNING: ' + x);
for (const x of failures) log('- FAILURE: ' + x);
await mkdir(new URL('../artifacts/', import.meta.url), { recursive: true });
await writeFile(OUT, report.join('\n') + '\n', 'utf8');
console.log('Wrote artifacts/production-history-backtest.md');
if (failures.length) process.exitCode = 1;
