import { createProductionScannerReplay } from './production-scanner-replay.mjs';

const BYBIT = 'https://api.bybit.com/v5/market/kline';
const BIQUOTE = 'https://biquote.io/api';
const LIMIT = 1000;
const symbols = [
  { appSymbol: 'BTCUSD', marketSymbol: 'BTCUSD', source: 'biquote', sourceNote: 'App-configured Biquote BTCUSD feed' },
  { appSymbol: 'EURUSD', marketSymbol: 'EURUSD', source: 'biquote', sourceNote: 'App-configured Biquote EURUSD feed' },
  { appSymbol: 'QQQUSDT', marketSymbol: 'QQQUSDT', source: 'bybit', sourceNote: 'Bybit QQQUSDT linear perpetual feed' }
];
const now = Date.now();
const nowSeconds = Math.floor(now / 1000);
const duration = { '5m': 300 };
const toBars = rows => rows.slice().reverse().map(row => {
  const time = Math.floor(Number(row[0]) / 1000);
  const closeTime = time + 300;
  return { time, open: Number(row[1]), high: Number(row[2]), low: Number(row[3]), close: Number(row[4]), volume: Number(row[5]), closeTime, ...(closeTime >= nowSeconds ? { isOpen: true } : {}) };
});
async function fetchBars(item) {
  if (item.source === 'biquote') {
    const url = BIQUOTE + '/' + encodeURIComponent(item.marketSymbol) + '/ohlc?interval=5m&limit=' + LIMIT;
    const response = await fetch(url, { signal: AbortSignal.timeout(20000), headers: { 'user-agent': 'APA-SMC-Historical-Replay/1.0' } });
    if (!response.ok) throw new Error(item.marketSymbol + ' Biquote candles HTTP ' + response.status);
    const payload = await response.json();
    const rows = Array.isArray(payload) ? payload : payload?.bars || payload?.data || payload?.candles || payload?.ohlc || [];
    const bars = rows.map(row => {
      const raw = row.openTime ?? row.time ?? row.timestamp ?? row.date;
      const parsed = typeof raw === 'number' ? raw : (/^\d+(\.\d+)?$/.test(String(raw)) ? Number(raw) : Date.parse(raw));
      const time = Math.floor(parsed > 1e12 ? parsed / 1000 : parsed);
      return { time, open: Number(row.open), high: Number(row.high), low: Number(row.low), close: Number(row.close), volume: Number(row.volume ?? row.tickVolume ?? 0), closeTime: time + 300, isOpen: time + 300 >= nowSeconds };
    }).filter(b => Number.isFinite(b.time) && b.time > 0 && [b.open,b.high,b.low,b.close].every(Number.isFinite) && b.high >= Math.max(b.open,b.close,b.low) && b.low <= Math.min(b.open,b.close,b.high)).sort((a,b) => a.time-b.time);
    if (bars.length < 100) throw new Error(item.marketSymbol + ' returned only ' + bars.length + ' valid Biquote candles');
    return bars;
  }
  const url = BYBIT + '?category=linear&symbol=' + encodeURIComponent(item.marketSymbol) + '&interval=5&limit=' + LIMIT;
  const response = await fetch(url, { signal: AbortSignal.timeout(20000), headers: { 'user-agent': 'APA-SMC-Historical-Replay/1.0' } });
  if (!response.ok) throw new Error(item.marketSymbol + ' candles HTTP ' + response.status);
  const payload = await response.json();
  const rows = payload?.result?.list;
  if (payload?.retCode !== 0 || !Array.isArray(rows) || rows.length < 100) throw new Error(item.marketSymbol + ' returned insufficient Bybit candle history');
  return toBars(rows);
}
const engine = createProductionScannerReplay({ now });
const summary = { generatedAt: new Date(now).toISOString(), timeframe: '5m', rrMinimum: 3, source: 'App-configured Biquote candles for BTCUSD/EURUSD; Bybit public klines for QQQUSDT', markets: [], feedErrors: [] };
for (const item of symbols) {
  try {
  const bars = await fetchBars(item);
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
  } catch (error) {
    summary.feedErrors.push({ appSymbol: item.appSymbol, source: item.source, error: String(error?.message || error) });
  }
}
console.log('APA_SMC_HISTORICAL_REPLAY_RESULT');
console.log(JSON.stringify(summary, null, 2));
