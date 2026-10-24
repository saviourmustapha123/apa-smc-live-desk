import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createProductionScannerReplay } from './production-scanner-replay.mjs';
import { applyCandlesToTrade, summarizePaperTrades } from './paper-trade-lifecycle.mjs';

const STATE_URL = new URL('../data/background-paper-trading-state.json', import.meta.url);
const REPORT_URL = new URL('../artifacts/background-paper-trading-report.md', import.meta.url);
const SYMBOLS = ['EURUSD', 'BTCUSD', 'QQQUSDT'];
const TIMEFRAMES = ['5m', '15m', '1h'];
const SECONDS = { '5m': 300, '15m': 900, '1h': 3600 };
const MAX_FORWARD_BARS = 100;
const nowMs = Date.now();
const nowSeconds = Math.floor(nowMs / 1000);
const iso = value => Number.isFinite(value) ? new Date(value * 1000).toISOString() : 'n/a';
const num = value => value == null || value === '' ? NaN : Number(value);
const report = [];
const feedFailures = [];
const newSignals = [];
const state = await loadState();

function log(line) {
  report.push(line);
  console.log(line);
}
function validOHLC(bar) {
  return Number.isFinite(bar.time) &&
    [bar.open, bar.high, bar.low, bar.close].every(value => Number.isFinite(value) && value > 0) &&
    bar.high >= Math.max(bar.open, bar.close, bar.low) &&
    bar.low <= Math.min(bar.open, bar.close, bar.high);
}
async function loadState() {
  try {
    const parsed = JSON.parse(await readFile(STATE_URL, 'utf8'));
    return {
      version: 1,
      updatedAt: parsed.updatedAt || null,
      lastScannedBarTime: parsed.lastScannedBarTime || {},
      feedStatus: parsed.feedStatus || {},
      trades: Array.isArray(parsed.trades) ? parsed.trades : []
    };
  } catch {
    return { version: 1, updatedAt: null, lastScannedBarTime: {}, feedStatus: {}, trades: [] };
  }
}
async function getJson(url) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(10000),
    headers: { 'user-agent': 'APA-SMC-background-paper-trader/1.0' }
  });
  if (!response.ok) throw new Error('HTTP ' + response.status);
  return response.json();
}
function normalizeYahoo(json) {
  const result = json.chart?.result?.[0];
  if (!result) throw new Error(json.chart?.error?.description || 'Yahoo returned no chart result');
  const quote = result.indicators?.quote?.[0];
  return (result.timestamp || []).map((time, i) => ({
    time,
    open: num(quote?.open?.[i]),
    high: num(quote?.high?.[i]),
    low: num(quote?.low?.[i]),
    close: num(quote?.close?.[i])
  })).filter(validOHLC).sort((a, b) => a.time - b.time);
}
function normalizeBiquote(rows) {
  return rows.map(row => {
    const rawTime = row.openTime ?? row.time ?? row.timestamp ?? row.date;
    const parsed = typeof rawTime === 'number'
      ? rawTime
      : (/^\\d+(\\.\\d+)?$/.test(String(rawTime)) ? Number(rawTime) : Date.parse(rawTime));
    const time = Math.floor(parsed > 1e12 ? parsed / 1000 : parsed);
    return { time, open: num(row.open), high: num(row.high), low: num(row.low), close: num(row.close) };
  }).filter(validOHLC).sort((a, b) => a.time - b.time);
}
function normalizeBinance(rows) {
  return rows.map(row => ({
    time: Math.floor(num(row[0]) / 1000),
    open: num(row[1]), high: num(row[2]), low: num(row[3]), close: num(row[4])
  })).filter(validOHLC).sort((a, b) => a.time - b.time);
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
  const interval = SECONDS[tf];
  const range = tf === '5m' ? '14d' : '60d';
  const errors = [];

  if (symbol === 'EURUSD' || symbol === 'BTCUSD') {
    try {
      const json = await getJson('https://biquote.io/api/' + symbol + '/ohlc?interval=' + tf + '&limit=1000');
      const rows = Array.isArray(json) ? json : json.bars || json.data || json.candles || [];
      const bars = normalizeBiquote(rows);
      if (bars.length >= 100) return { bars: bars.slice(-1000), provider: 'Biquote ' + symbol, exact: true };
      errors.push('Biquote returned ' + bars.length + ' valid candles');
    } catch (error) { errors.push('Biquote: ' + error.message); }

    const yahooSymbol = symbol === 'EURUSD' ? 'EURUSD=X' : 'BTC-USD';
    const json = await getJson('https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(yahooSymbol) + '?range=' + range + '&interval=' + tf);
    const bars = normalizeYahoo(json).filter(bar => bar.time + interval <= nowSeconds);
    if (bars.length < 100) throw new Error(errors.concat('Yahoo returned ' + bars.length + ' closed valid candles').join('; '));
    return {
      bars: bars.slice(-1000),
      provider: symbol === 'EURUSD' ? 'Yahoo EURUSD=X FX pair' : 'Yahoo BTC-USD spot pair (venue may differ from app feed)',
      exact: symbol === 'EURUSD'
    };
  }

  const proxyBase = configuredQqqProxy();
  const providers = [
    ...(proxyBase ? [['Configured Cloudflare Worker', proxyBase + '/fapi/v1/klines?symbol=QQQUSDT&interval=' + tf + '&limit=1000']] : []),
    ['Binance USD-M', 'https://fapi.binance.com/fapi/v1/klines?symbol=QQQUSDT&interval=' + tf + '&limit=1000'],
    ['Binance API alternate', 'https://api.binance.com/fapi/v1/klines?symbol=QQQUSDT&interval=' + tf + '&limit=1000'],
    ['Binance GCP alternate', 'https://api-gcp.binance.com/fapi/v1/klines?symbol=QQQUSDT&interval=' + tf + '&limit=1000']
  ];
  for (const [provider, url] of providers) {
    try {
      const bars = normalizeBinance(await getJson(url)).filter(bar => bar.time + interval <= nowSeconds);
      if (bars.length >= 100) return { bars: bars.slice(-1000), provider, exact: true };
      errors.push(provider + ' returned ' + bars.length + ' closed valid candles');
    } catch (error) { errors.push(provider + ': ' + error.message); }
  }
  throw new Error(errors.join('; '));
}
function terminal(status) {
  return ['SUCCESSFUL', 'UNSUCCESSFUL', 'MISSED ENTRY', 'INVALIDATED', 'EXPIRED', 'UNRESOLVED'].includes(status);
}
function activeFor(symbol, tf) {
  return state.trades.find(trade =>
    trade.symbol === symbol && trade.tf === tf && ['NOT RUNNING', 'ACTIVE'].includes(trade.status)
  );
}
function validSignal(signal) {
  if (!signal || signal.status !== 'NOT RUNNING' || !Number.isFinite(signal.rr) || signal.rr < 3) return false;
  const risk = signal.side === 'BUY' ? signal.entry - signal.sl : signal.sl - signal.entry;
  const reward = signal.side === 'BUY' ? signal.tp - signal.entry : signal.entry - signal.tp;
  return Number.isFinite(risk) && Number.isFinite(reward) && risk > 0 && reward / risk >= 3;
}
function newTradeId(signal) {
  return [signal.symbol, signal.tf, signal.time, signal.side, signal.entry, signal.sl, signal.tp].join('|');
}
function makeTrade(signal, provider, exact) {
  return {
    id: newTradeId(signal),
    symbol: signal.symbol,
    tf: signal.tf,
    side: signal.side,
    signalTime: signal.time,
    createdAt: new Date(nowMs).toISOString(),
    entry: signal.entry,
    sl: signal.sl,
    tp: signal.tp,
    rr: signal.rr,
    setupType: signal.setupType || 'SMC setup',
    reasons: signal.reason || [],
    provider,
    exactSymbolData: exact,
    status: 'NOT RUNNING',
    outcome: 'PENDING ENTRY',
    entryTime: null,
    exitTime: null,
    resultR: null,
    lastProcessedBarTime: signal.time,
    barsObserved: 0,
    engine: 'Production scanner source; paper-trade simulation only'
  };
}
function renderTrade(trade) {
  return '- ' + trade.symbol + ' ' + trade.tf + ' ' + trade.side +
    ' | signal ' + iso(trade.signalTime) +
    ' | entry ' + trade.entry + ' / SL ' + trade.sl + ' / TP ' + trade.tp +
    ' | planned ' + Number(trade.rr).toFixed(2) + 'R' +
    ' | **' + trade.status + '**: ' + trade.outcome +
    (trade.entryTime ? ' | filled ' + iso(trade.entryTime) : '') +
    (trade.exitTime ? ' | exit ' + iso(trade.exitTime) : '') +
    (Number.isFinite(trade.resultR) ? ' | result ' + trade.resultR.toFixed(2) + 'R' : '');
}

log('# APA SMC Live Desk — background paper-trading run');
log('');
log('- Run time: ' + new Date(nowMs).toISOString());
log('- Mode: paper simulation only. No broker orders were sent and no real-money trades were executed.');
log('- Signal engine: production scanner functions extracted from index.html.');
log('- Execution rules: minimum 1:3 RR; pending entries must be touched after the signal candle; missed and invalidated setups are not losses; same-candle stop/target ambiguity is resolved stop-first.');
log('- Transaction costs are not included. QQQUSDT is scanned only with a QQQUSDT futures candle feed; the QQQ ETF proxy is not used for live paper signals.');
log('');

for (const symbol of SYMBOLS) {
  for (const tf of TIMEFRAMES) {
    const key = symbol + '|' + tf;
    try {
      const data = await fetchBars(symbol, tf);
      const interval = SECONDS[tf];
      const bars = data.bars.filter(bar => validOHLC(bar) && bar.time + interval <= nowSeconds).sort((a, b) => a.time - b.time);
      if (bars.length < 100) throw new Error('Only ' + bars.length + ' closed candles remain after filtering');
      const latest = bars.at(-1);
      const closedAt = latest.time + interval;
      const ageSeconds = nowSeconds - closedAt;
      const fresh = ageSeconds >= 0 && ageSeconds <= interval * 2;
      state.feedStatus[key] = {
        status: fresh ? 'FRESH' : 'STALE',
        provider: data.provider,
        exactSymbolData: data.exact,
        bars: bars.length,
        latestClosedCandle: latest.time,
        latestClose: latest.close,
        ageSeconds,
        checkedAt: new Date(nowMs).toISOString()
      };

      const existing = activeFor(symbol, tf);
      let closedTradeThisRun = false;
      if (existing) {
        if (existing.lastProcessedBarTime != null && existing.lastProcessedBarTime < bars[0].time) {
          existing.status = 'UNRESOLVED';
          existing.outcome = 'DATA GAP: CANDLES NEEDED TO RECONSTRUCT OUTCOME ARE NO LONGER AVAILABLE';
          existing.exitTime = latest.time;
          existing.resultR = null;
          existing.lastProcessedBarTime = latest.time;
          closedTradeThisRun = true;
        } else {
          const updated = applyCandlesToTrade(existing, bars, { maxForwardBars: MAX_FORWARD_BARS });
          Object.assign(existing, updated);
          closedTradeThisRun = terminal(existing.status);
        }
      }

      const lastScanned = state.lastScannedBarTime[key];
      let candidateCount = 0;
      if (latest.time > (lastScanned ?? -Infinity)) {
        if (fresh && !activeFor(symbol, tf) && !closedTradeThisRun) {
          const engine = createProductionScannerReplay({ now: nowMs });
          const result = engine.scan(symbol, tf, bars);
          const candidates = result.signals
            .filter(signal => signal.time === latest.time && validSignal(signal))
            .sort((a, b) => Number(a.rr) - Number(b.rr));
          candidateCount = candidates.length;
          if (candidates.length) {
            const signal = candidates[0];
            const trade = makeTrade(signal, data.provider, data.exact);
            if (!state.trades.some(item => item.id === trade.id)) {
              state.trades.push(trade);
              newSignals.push(trade);
            }
          }
        }
        state.lastScannedBarTime[key] = latest.time;
      }

      log('## ' + symbol + ' · ' + tf);
      log('- Feed: ' + state.feedStatus[key].status + ' · ' + data.provider + ' · ' + bars.length + ' closed candles · latest ' + iso(latest.time) + ' · close ' + latest.close);
      log('- New scanner candidates at latest close: ' + candidateCount);
      const current = activeFor(symbol, tf);
      if (current) log('- Open paper setup: ' + current.status + ' · ' + current.side + ' · entry ' + current.entry + ' · SL ' + current.sl + ' · TP ' + current.tp);
      else log('- Open paper setup: none');
      log('');
    } catch (error) {
      state.feedStatus[key] = { status: 'UNAVAILABLE', error: error.message, checkedAt: new Date(nowMs).toISOString() };
      feedFailures.push(key + ': ' + error.message);
      log('## ' + symbol + ' · ' + tf);
      log('- **FEED UNAVAILABLE:** ' + error.message);
      log('- No signal was fabricated for this pair/timeframe.');
      log('');
    }
  }
}

state.updatedAt = new Date(nowMs).toISOString();
const keepOpen = state.trades.filter(trade => ['NOT RUNNING', 'ACTIVE'].includes(trade.status));
const keepClosed = state.trades.filter(trade => terminal(trade.status)).slice(-500);
state.trades = [...keepClosed, ...keepOpen].sort((a, b) => a.signalTime - b.signalTime);
const summary = summarizePaperTrades(state.trades);
log('## Persistent paper-trade ledger summary');
log('- Total retained records: ' + summary.total);
log('- Untriggered: ' + summary.pending);
log('- Active: ' + summary.active);
log('- Successful: ' + summary.wins);
log('- Unsuccessful: ' + summary.losses);
log('- Missed entry: ' + summary.missed);
log('- Invalidated: ' + summary.invalidated);
log('- Expired unfilled: ' + summary.expired);
log('- Unresolved: ' + summary.unresolved);
log('- Resolved win rate: ' + (summary.winRate == null ? 'n/a' : summary.winRate.toFixed(1) + '% (n=' + summary.resolved + ')'));
log('- Net R before costs: ' + summary.netR.toFixed(2) + 'R');
log('- Profit factor before costs: ' + (summary.profitFactor === Infinity ? '∞' : summary.profitFactor == null ? 'n/a' : summary.profitFactor.toFixed(2)));
log('- Expectancy before costs: ' + (summary.expectancyR == null ? 'n/a' : summary.expectancyR.toFixed(2) + 'R'));
log('');
log('## New paper signals this run');
if (!newSignals.length) log('- None. This is a valid outcome; no signal is manufactured to meet a daily quota.');
for (const trade of newSignals) log(renderTrade(trade));
log('');
log('## Latest 20 paper-trade outcomes');
for (const trade of state.trades.slice(-20).reverse()) log(renderTrade(trade));
log('');
log('## Feed warnings');
if (!feedFailures.length) log('- No pair/timeframe feed failures this run.');
for (const failure of feedFailures) log('- ' + failure);
log('');
log('This journal contains simulated signal fills only. It is not an MT5 trade history and does not send live orders.');

await mkdir(new URL('../data/', import.meta.url), { recursive: true });
await mkdir(new URL('../artifacts/', import.meta.url), { recursive: true });
await writeFile(STATE_URL, JSON.stringify(state, null, 2) + '\n', 'utf8');
await writeFile(REPORT_URL, report.join('\n') + '\n', 'utf8');
await writeFile('/tmp/apa-smc-paper-trading-summary.md', report.join('\n') + '\n', 'utf8');
console.log('Wrote data/background-paper-trading-state.json and artifacts/background-paper-trading-report.md');
if (feedFailures.length === SYMBOLS.length * TIMEFRAMES.length) process.exitCode = 1;
