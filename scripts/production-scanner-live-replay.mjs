import { createProductionScannerReplay } from './production-scanner-replay.mjs';

const BASE = 'https://fapi.binance.com/fapi/v1/klines';
const LIMIT = 1500;
const symbols = [
  { appSymbol: 'BTCUSD', marketSymbol: 'BTCUSDT', sourceNote: 'BTCUSDT perpetual proxy; not the app BTCUSD feed' },
  { appSymbol: 'QQQUSDT', marketSymbol: 'QQQUSDT', sourceNote: 'QQQUSDT perpetual; Binance public feed' }
];
const now = Date.now();
const nowSeconds = Math.floor(now / 1000);
const duration = { '5m': 300 };
const toBars = rows => rows.map(row => ({
  time: Math.floor(Number(row[0]) / 1000),
  open: Number(row[1]), high: Number(row[2]), low: Number(row[3]), close: Number(row[4]),
  volume: Number(row[5]), closeTime: Math.floor(Number(row[6]) / 1000),
  ...(Number(row[6]) >= now ? { isOpen: true } : {})
}));
async function fetchBars(symbol) {
  const url = BASE + '?symbol=' + encodeURIComponent(symbol) + '&interval=5m&limit=' + LIMIT;
  const response = await fetch(url, { signal: AbortSignal.timeout(20000), headers: { 'user-agent': 'APA-SMC-Historical-Replay/1.0' } });
  if (!response.ok) throw new Error(symbol + ' candles HTTP ' + response.status);
  const rows = await response.json();
  if (!Array.isArray(rows) || rows.length < 100) throw new Error(symbol + ' returned insufficient candle history');
  return toBars(rows);
}
const engine = createProductionScannerReplay({ now });
const summary = { generatedAt: new Date(now).toISOString(), timeframe: '5m', rrMinimum: 3, source: 'Binance USD-M futures public klines', markets: [] };
for (const item of symbols) {
  const bars = await fetchBars(item.marketSymbol);
  const scanned = engine.scan(item.appSymbol, '5m', bars);
  const candidates = scanned.signals.filter(signal => Number(signal.rr) >= 3 && Number(signal.time) < nowSeconds - duration['5m']);
  const outcomes = engine.resolveOutcomes(item.appSymbol, '5m', bars, candidates);
  const counts = { candidates: outcomes.length, takeProfit: 0, stopLoss: 0, expired: 0, missedEntry: 0, running: 0, pending: 0, other: 0 };
  for (const trade of outcomes) {
    const status = String(trade.status || trade.outcome || '').toUpperCase();
    if (status.includes('TAKE PROFIT') || status === 'SUCCESS') counts.takeProfit++;
    else if (status.includes('STOP LOSS') || status === 'LOSS') counts.stopLoss++;
    else if (status.includes('EXPIRED')) counts.expired++;
    else if (status.includes('MISSED')) counts.missedEntry++;
    else if (status.includes('RUNNING') || status === 'OPEN') counts.running++;
    else if (status.includes('PENDING')) counts.pending++;
    else counts.other++;
  }
  const closed = counts.takeProfit + counts.stopLoss + counts.expired + counts.missedEntry;
  const resolvedWinsLosses = counts.takeProfit + counts.stopLoss;
  const totalR = outcomes.reduce((sum, trade) => {
    const r = Number(trade.r);
    return Number.isFinite(r) && (String(trade.status).toUpperCase().includes('TAKE PROFIT') || String(trade.status).toUpperCase().includes('STOP LOSS')) ? sum + r : sum;
  }, 0);
  summary.markets.push({
    appSymbol: item.appSymbol, marketSymbol: item.marketSymbol, sourceNote: item.sourceNote,
    candles: bars.length, firstCandle: new Date(bars[0].time * 1000).toISOString(),
    lastClosedCandle: new Date(Math.max(...bars.filter(b => !b.isOpen).map(b => b.time)) * 1000).toISOString(),
    scannerDiagnostic: scanned.diagnostic, counts,
    closedTradeWinRatePct: resolvedWinsLosses ? Number((counts.takeProfit / resolvedWinsLosses * 100).toFixed(2)) : null,
    closedWinLossTrades: resolvedWinsLosses, closedOther: counts.expired + counts.missedEntry,
    closedRTotal: Number(totalR.toFixed(3)),
    latestOutcomes: outcomes.slice().sort((a,b) => Number(b.time)-Number(a.time)).slice(0,15).map(t => ({
      time: new Date(Number(t.time) * 1000).toISOString(), side: t.side, entry: t.entry, sl: t.sl, tp: t.tp,
      rr: t.rr, status: t.status, outcome: t.outcome, r: t.r
    }))
  });
}
console.log('APA_SMC_HISTORICAL_REPLAY_RESULT');
console.log(JSON.stringify(summary, null, 2));
