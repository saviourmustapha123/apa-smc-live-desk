import { assessAt, simulate } from './strategy-core.mjs';
const API = 'https://biquote.io/api';
const SYMBOLS = ['EURUSD', 'BTCUSD'];
const TIMEFRAMES = ['5m', '15m'];
const K = 3;
const ATR_PERIOD = 14;
const DISPLACEMENT_ATR = 1;
const MIN_RR = 3;
const MAX_FORWARD_BARS = 100;
const failures = [];
const reports = [];

async function fetchBars(symbol, interval) {
  const url = `${API}/${symbol}/ohlc?interval=${interval}&limit=1000`;
  const response = await fetch(url, { signal: AbortSignal.timeout(20000), headers: { 'user-agent': 'APA-SMC-proxy-backtest/1.0' } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const json = await response.json();
  const rows = Array.isArray(json) ? json : json.bars ?? json.data ?? json.candles ?? [];
  const bars = rows.map(b => {
    const raw = b.openTime ?? b.time ?? b.timestamp;
    const parsed = typeof raw === 'number' ? raw : (/^\d+(\.\d+)?$/.test(String(raw)) ? Number(raw) : Date.parse(raw));
    return { time: Math.floor(parsed > 1e12 ? parsed / 1000 : parsed), open: Number(b.open), high: Number(b.high), low: Number(b.low), close: Number(b.close), isOpen: Boolean(b.isOpen) };
  }).filter(b => !b.isOpen && Number.isFinite(b.time) && b.time > 0 && [b.open,b.high,b.low,b.close].every(Number.isFinite) && b.high >= Math.max(b.open,b.close,b.low) && b.low <= Math.min(b.open,b.close,b.high))
    .sort((a,b) => a.time-b.time);
  const unique = new Map(bars.map(b => [b.time,b]));
  return [...unique.values()];
}

for (const symbol of SYMBOLS) for (const timeframe of TIMEFRAMES) {
  try {
    const bars=await fetchBars(symbol,timeframe);
    if (bars.length<100) throw new Error(`Only ${bars.length} closed, valid bars; at least 100 required`);
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
    const wins=tested.filter(s=>s.result==='WIN').length;
    const losses=tested.filter(s=>s.result.startsWith('LOSS')).length;
    const unresolved=tested.filter(s=>s.result==='UNRESOLVED').length;
    const resolved=wins+losses;
    const netR=tested.reduce((sum,s)=>sum+(s.r??0),0);
    const report={symbol,timeframe,bars:bars.length,candidates:tested.length,wins,losses,unresolved,winRate:resolved?Math.round(wins/resolved*1000)/10:null,netR:Math.round(netR*100)/100,latestBar:new Date(bars.at(-1).time*1000).toISOString()};
    reports.push(report);
    console.log(`PASS ${symbol} ${timeframe}: ${bars.length} closed bars; ${tested.length} qualifying proxy candidates; ${wins} TP, ${losses} SL, ${unresolved} unresolved; net ${report.netR}R`);
  } catch (error) {
    failures.push(`${symbol} ${timeframe}: ${error.message}`);
    console.error(`FAIL ${symbol} ${timeframe}: ${error.message}`);
  }
}

const summaryLines=[
  '# APA · SMC proxy strategy backtest',
  '',
  `- Run time (UTC): ${new Date().toISOString()}`,
  '- Market data: Biquote public OHLC endpoint; only closed candles included.',
  `- Rules: current website proxy trigger, swing sensitivity ${K}, displacement ${DISPLACEMENT_ATR}×ATR, minimum target ratio ${MIN_RR}:1.`,
  '- Simulation: next bars only; if stop and target are touched in the same candle, count stop first; unresolved trades remain unresolved.',
  '- This is a heuristic proxy backtest, **not** validation of the complete proprietary LOWKEY FX APA strategy. It omits spread, commissions, slippage, session filters, and broker execution.',
  '',
  '| Pair | TF | Closed bars | Candidates | TP | SL | Unresolved | Resolved win rate | Net R* |',
  '|---|---:|---:|---:|---:|---:|---:|---:|---:|',
  ...reports.map(r=>`| ${r.symbol} | ${r.timeframe} | ${r.bars} | ${r.candidates} | ${r.wins} | ${r.losses} | ${r.unresolved} | ${r.winRate===null?'n/a':r.winRate+'%'} | ${r.netR} | `),
  '',
  '*Net R is the sum of resolved outcomes plus zero for unresolved candidates. These results are descriptive, not a forecast or proof of profitability.*',
  failures.length ? '\n## Data/test failures\n'+failures.map(x=>'- '+x).join('\n') : '\n## Data/test failures\n- None'
].join('\n');
console.log('\n'+summaryLines);
if (process.env.GITHUB_STEP_SUMMARY) await (await import('node:fs/promises')).appendFile(process.env.GITHUB_STEP_SUMMARY,summaryLines+'\n');
if (failures.length) process.exitCode=1;
