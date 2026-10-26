import { assessAt, simulate } from './strategy-core.mjs';
const API = 'https://biquote.io/api';
const BYBIT_HOSTS = [process.env.QQQ_PROXY_URL || 'https://apa-smc-qqqusdt-proxy.saviourmustapha123.workers.dev', 'https://api.bybit.com', 'https://api.bytick.com'];
const SYMBOLS = ['EURUSD', 'BTCUSD', 'QQQUSDT'];
const TIMEFRAMES = ['1m', '5m', '15m', '1h', '4h', '8h', '12h', '1d'];
const TIMEFRAME_SECONDS = { '1m':60, '5m':300, '15m':900, '1h':3600, '4h':14400, '8h':28800, '12h':43200, '1d':86400 };
const BYBIT_INTERVAL = { '1m':'1', '5m':'5', '15m':'15', '1h':'60', '4h':'240', '8h':'480', '12h':'720', '1d':'D' };
const K = 3;
const ATR_PERIOD = 14;
const DISPLACEMENT_ATR = 1;
const MIN_RR = 3;
const MAX_FORWARD_BARS = 100;
// Transparent cost stress test in units of initial risk (R). These are assumptions, not measured historical spreads.
const COST_SCENARIOS_R = [0, 0.05, 0.10, 0.20];
const failures = [];
const reports = [];

async function fetchBars(symbol, interval) {
  // Prefer native 4h candles where available. Only build 8h/12h from valid
  // 4h source bars; avoid the earlier 1h->4h double-aggregation path.
  const aggregateHours = interval === '8h' ? 2 : interval === '12h' ? 3 : 1;
  const sourceInterval = aggregateHours > 1 ? '4h' : interval;
  const sourceSeconds = TIMEFRAME_SECONDS[sourceInterval];
  let rows;
  let normalise;
  if (symbol === 'QQQUSDT') {
    let lastError;
    for (const host of BYBIT_HOSTS) {
      try {
        const url = host + '/v5/market/kline?category=linear&symbol=QQQUSDT&interval=' + BYBIT_INTERVAL[sourceInterval] + '&limit=1000';
        const response = await fetch(url, { signal: AbortSignal.timeout(12000), headers: { 'user-agent': 'APA-SMC-proxy-backtest/1.0' } });
        if (!response.ok) throw new Error('HTTP ' + response.status);
        const json = await response.json();
        if (Number(json.retCode) !== 0) throw new Error(json.retMsg || json.retCode);
        rows = json.result && json.result.list || [];
        if (!rows.length) throw new Error('No OHLC rows');
        lastError = null;
        break;
      } catch (error) { lastError = error; }
    }
    if (lastError) {
      // Retry an alternate exact-contract provider before falling back to the
      // underlying QQQ ETF. The report must retain the proxy disclaimer.
      try {
        const response = await fetch('https://fapi.binance.com/fapi/v1/klines?symbol=QQQUSDT&interval=' + sourceInterval + '&limit=1000', { signal: AbortSignal.timeout(12000), headers: { 'user-agent': 'APA-SMC-proxy-backtest/1.0' } });
        if (!response.ok) throw new Error('Binance futures HTTP ' + response.status);
        const data = await response.json();
        if (!Array.isArray(data) || !data.length) throw new Error('Binance futures returned no OHLC rows');
        rows = data;
        normalise = b => ({ time: Number(b[0]) / 1000, open: Number(b[1]), high: Number(b[2]), low: Number(b[3]), close: Number(b[4]) });
        lastError = null;
      } catch (error) { lastError = error; }
    }
    if (lastError) {
      try {
        const yahooInterval = sourceInterval === '4h' ? '1h' : sourceInterval;
        const range = yahooInterval === '1m' ? '7d' : yahooInterval === '5m' ? '14d' : '60d';
        const response = await fetch('https://query1.finance.yahoo.com/v8/finance/chart/QQQ?range=' + range + '&interval=' + yahooInterval, { signal: AbortSignal.timeout(15000), headers: { 'user-agent': 'APA-SMC-proxy-backtest/1.0' } });
        if (!response.ok) throw new Error('Yahoo QQQ ETF HTTP ' + response.status);
        const json = await response.json(), result = json.chart?.result?.[0];
        if (!result || !Array.isArray(result.timestamp)) throw new Error(json.chart?.error?.description || 'Yahoo returned no chart rows');
        const q = result.indicators?.quote?.[0], yahooSeconds = yahooInterval === '1h' ? 3600 : sourceSeconds;
        rows = result.timestamp.map((time,i) => ({ time, open: Number(q?.open?.[i]), high: Number(q?.high?.[i]), low: Number(q?.low?.[i]), close: Number(q?.close?.[i]), isOpen: time + yahooSeconds > Math.floor(Date.now()/1000) }));
        if (interval === '8h' || interval === '12h') {
          const groups = new Map();
          for (const bar of rows) { const bucket = Math.floor(bar.time / 14400) * 14400; if (!groups.has(bucket)) groups.set(bucket, []); groups.get(bucket).push(bar); }
          rows = [...groups.entries()].filter(([,group]) => group.length === 4 && group.every((bar,i) => i === 0 || bar.time - group[i-1].time === 3600))
            .map(([time,group]) => ({ time, open: group[0].open, high: Math.max(...group.map(b=>b.high)), low: Math.min(...group.map(b=>b.low)), close: group[group.length-1].close, isOpen: time + 14400 > Math.floor(Date.now()/1000) }));
        }
        normalise = b => b;
        lastError = null;
      } catch (error) { lastError = error; }
    }
    if (lastError) throw new Error('QQQUSDT exchange providers and Yahoo ETF fallback unavailable: ' + lastError.message);
    if (!normalise) normalise = b => ({ time: Number(b[0]) / 1000, open: Number(b[1]), high: Number(b[2]), low: Number(b[3]), close: Number(b[4]) });
  } else {
    const url = API + '/' + symbol + '/ohlc?interval=' + sourceInterval + '&limit=1000';
    const response = await fetch(url, { signal: AbortSignal.timeout(20000), headers: { 'user-agent': 'APA-SMC-proxy-backtest/1.0' } });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const json = await response.json();
    rows = Array.isArray(json) ? json : json.bars || json.data || json.candles || [];
    normalise = b => {
      const raw = b.openTime || b.time || b.timestamp;
      const parsed = typeof raw === 'number' ? raw : (/^\\d+(\\.\\d+)?$/.test(String(raw)) ? Number(raw) : Date.parse(raw));
      return { time: Math.floor(parsed > 1e12 ? parsed / 1000 : parsed), open: Number(b.open), high: Number(b.high), low: Number(b.low), close: Number(b.close), isOpen: Boolean(b.isOpen) };
    };
  }
  const now = Math.floor(Date.now() / 1000);
  let bars = rows.map(normalise).map(b => Object.assign({}, b, { isOpen: Boolean(b.isOpen) || b.time + sourceSeconds > now }))
    .filter(b => !b.isOpen && Number.isFinite(b.time) && b.time > 0 && [b.open,b.high,b.low,b.close].every(Number.isFinite) && b.high >= Math.max(b.open,b.close,b.low) && b.low <= Math.min(b.open,b.close,b.high))
    .sort((a,b) => a.time-b.time);
  const unique = new Map(bars.map(b => [b.time,b]));
  bars = [...unique.values()];
  if (aggregateHours > 1) {
    const width = TIMEFRAME_SECONDS[interval];
    const groups = new Map();
    for (const bar of bars) {
      const bucket = Math.floor(bar.time / width) * width;
      if (!groups.has(bucket)) groups.set(bucket, []);
      groups.get(bucket).push(bar);
    }
    bars = [...groups.entries()].filter(([,group]) => group.length === aggregateHours && group.every((bar,i) => i === 0 || bar.time - group[i-1].time === sourceSeconds))
      .map(([time,group]) => ({ time, open: group[0].open, high: Math.max(...group.map(b=>b.high)), low: Math.min(...group.map(b=>b.low)), close: group[group.length-1].close, isOpen: time + width > now }));
  }
  return bars;
}

for (const symbol of SYMBOLS) for (const timeframe of TIMEFRAMES) {
  try {
    const bars=await fetchBars(symbol,timeframe);
    const minimumBars = ['8h','12h','1d'].includes(timeframe) ? 40 : 100;
    if (bars.length<minimumBars) throw new Error(`Only ${bars.length} closed, valid bars; at least ${minimumBars} required`);
    const candidates=[];
    for (let end=40;end<=bars.length;end++) {
      const prefix=bars.slice(0,end);
      const signal=assessAt(prefix,{k:K,atrPeriod:ATR_PERIOD,displacementAtr:DISPLACEMENT_ATR,minRR:MIN_RR});
      if (signal) candidates.push({...signal, symbol, timeframe});
    }
    const unique=[];
    let lastTime=0;
    for (const c of candidates) if (c.time!==lastTime) { unique.push(c); lastTime=c.time; }
    const tested=unique.map(s=>({...s,...simulate(bars,s,MAX_FORWARD_BARS)}));
    const wins=tested.filter(s=>s.result.startsWith('WIN')).length;
    const losses=tested.filter(s=>s.result.startsWith('LOSS')).length;
    const skipped=tested.filter(s=>s.result.startsWith('SKIPPED')).length;
    const unresolved=tested.filter(s=>s.result==='UNRESOLVED').length;
    const resolved=wins+losses;
    const netR=tested.reduce((sum,s)=>sum+(s.r??0),0);
    const grossWinsR=tested.reduce((sum,s)=>sum+(s.r>0?s.r:0),0);
    const grossLossR=Math.abs(tested.reduce((sum,s)=>sum+(s.r<0?s.r:0),0));
    let equity=0,peak=0,maxDrawdown=0,lossStreak=0,maxLossStreak=0;
    for(const trade of tested){if(trade.result.startsWith('SKIPPED')||trade.result==='UNRESOLVED')continue;equity+=trade.r??0;peak=Math.max(peak,equity);maxDrawdown=Math.max(maxDrawdown,peak-equity);if((trade.r??0)<0){lossStreak++;maxLossStreak=Math.max(maxLossStreak,lossStreak)}else lossStreak=0}
    const spanDays=Math.max(0,(bars.at(-1).time-bars[0].time)/86400);
    const expectedSeconds=TIMEFRAME_SECONDS[timeframe];
    const largeGaps=bars.slice(1).filter((b,i)=>b.time-bars[i].time>expectedSeconds*2).length;
    const report={symbol,timeframe,bars:bars.length,candidates:tested.length,wins,losses,skipped,unresolved,winRate:resolved?Math.round(wins/resolved*1000)/10:null,netR:Math.round(netR*100)/100,netR05:Math.round((netR-COST_SCENARIOS_R[1]*resolved)*100)/100,netR10:Math.round((netR-COST_SCENARIOS_R[2]*resolved)*100)/100,netR20:Math.round((netR-COST_SCENARIOS_R[3]*resolved)*100)/100,expectancyR:resolved?Math.round(netR/resolved*1000)/1000:null,profitFactor:grossLossR?Math.round(grossWinsR/grossLossR*100)/100:grossWinsR?'infinite':'n/a',maxDrawdownR:Math.round(maxDrawdown*100)/100,maxLosingStreak:maxLossStreak,historyDays:Math.round(spanDays),oneYearCoverage:spanDays>=365,largeGaps,firstBar:new Date(bars[0].time*1000).toISOString(),latestBar:new Date(bars.at(-1).time*1000).toISOString()};
    reports.push(report);
    console.log(`${report.oneYearCoverage?'PASS':'WARN'} ${symbol} ${timeframe}: ${bars.length} closed bars over ${report.historyDays} days; ${tested.length} candidate events (${skipped} skipped at next open); ${wins} TP, ${losses} SL, ${unresolved} unresolved; win rate ${report.winRate===null?'n/a':report.winRate+'%'}; gross ${report.netR}R; net after assumed costs: ${report.netR05}R at 0.05R/trade, ${report.netR10}R at 0.10R/trade, ${report.netR20}R at 0.20R/trade; coverage ${report.oneYearCoverage?'at least 1 year':'LESS THAN 1 YEAR — validation gate NOT passed'}`);
  } catch (error) {
    failures.push(`${symbol} ${timeframe}: ${error.message}`);
    console.error(`FAIL ${symbol} ${timeframe}: ${error.message}`);
  }
}

const summaryLines=[
  '# APA · SMC proxy strategy backtest',
  '',
  `- Run time (UTC): ${new Date().toISOString()}`,
  '- Market data: Biquote public OHLC for EURUSD/BTCUSD and Bybit linear perpetual OHLC for QQQUSDT; only closed candles included.',
  `- Rules: current website proxy trigger, swing sensitivity ${K}, displacement ${DISPLACEMENT_ATR}×ATR, minimum target ratio ${MIN_RR}:1.`,
  '- Execution: enter at the next candle open; skip the entry if the open invalidates the stop or leaves less than 3R; same-candle stop/target ambiguity is a stop-first loss; gap-through-stop losses use the next open.',
  '- Gross proxy only, **not** validation of the complete proprietary LOWKEY FX APA strategy. Cost sensitivity subtracts explicit illustrative assumptions of 0.05R, 0.10R and 0.20R per resolved trade; these are not measured historical spread, commission, slippage, latency or financing. A true net backtest requires venue-specific historical cost data.',
  `- Coverage: ${reports.length}/${SYMBOLS.length*TIMEFRAMES.length} pair/timeframe combinations returned valid data. One-year gate: ${reports.length===SYMBOLS.length*TIMEFRAMES.length&&reports.every(r=>r.oneYearCoverage)?'PASSED for all combinations':'NOT PASSED for one or more combinations; do not interpret metrics as a full historical backtest.'}`, 
  '- Scope warning: quick proxy entry/exit model only; it does not replay the production scanOpportunityHistory implementation or every deployed SMC confluence, live-chat admission rule, and pair-specific session guard.',
  '',
  '| Pair | TF | Closed bars | History days | 1-year coverage | Candidates | Skipped | TP | SL | Unresolved | Win rate* | Expectancy R* | Profit factor* | Max DD R* | Max losing streak | Large gaps | Gross R* | Net @0.05R cost* | Net @0.10R cost* | Net @0.20R cost* |',
  '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|',
  ...reports.map(r=>`| ${r.symbol} | ${r.timeframe} | ${r.bars} | ${r.historyDays} | ${r.oneYearCoverage?'yes':'NO'} | ${r.candidates} | ${r.skipped} | ${r.wins} | ${r.losses} | ${r.unresolved} | ${r.winRate===null?'n/a':r.winRate+'%'} | ${r.expectancyR===null?'n/a':r.expectancyR} | ${r.profitFactor} | ${r.maxDrawdownR} | ${r.maxLosingStreak} | ${r.largeGaps} | ${r.netR} | ${r.netR05} | ${r.netR10} | ${r.netR20} | `),
  '',
  '*Metrics are gross and descriptive only. Win rate and expectancy use resolved outcomes; skipped and unresolved events are not treated as wins or losses. Max drawdown is computed over this event sequence, not a tradable portfolio. Zero candidates means no qualifying events were found in this limited sample; it does not establish that the strategy never signals.*',
  reports.some(r=>!r.oneYearCoverage||r.candidates===0) ? '\n## Validation warnings\n'+reports.filter(r=>!r.oneYearCoverage||r.candidates===0).map(r=>'- '+r.symbol+' '+r.timeframe+': '+(!r.oneYearCoverage?'history coverage below 365 days':'no candidate events in the available sample')).join('\n') : '\n## Validation warnings\n- None',
  failures.length ? '\n## Data/test failures\n'+failures.map(x=>'- '+x).join('\n') : '\n## Data/test failures\n- None'
].join('\n');
console.log('\n'+summaryLines);
if (process.env.GITHUB_STEP_SUMMARY) await (await import('node:fs/promises')).appendFile(process.env.GITHUB_STEP_SUMMARY,summaryLines+'\n');
if (failures.length) process.exitCode=1;
