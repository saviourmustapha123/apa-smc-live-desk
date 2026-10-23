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
    const expectedSeconds=timeframe==='5m'?300:900;
    const largeGaps=bars.slice(1).filter((b,i)=>b.time-bars[i].time>expectedSeconds*2).length;
    const report={symbol,timeframe,bars:bars.length,candidates:tested.length,wins,losses,skipped,unresolved,winRate:resolved?Math.round(wins/resolved*1000)/10:null,netR:Math.round(netR*100)/100,expectancyR:resolved?Math.round(netR/resolved*1000)/1000:null,profitFactor:grossLossR?Math.round(grossWinsR/grossLossR*100)/100:grossWinsR?'infinite':'n/a',maxDrawdownR:Math.round(maxDrawdown*100)/100,maxLosingStreak:maxLossStreak,historyDays:Math.round(spanDays),oneYearCoverage:spanDays>=365,largeGaps,firstBar:new Date(bars[0].time*1000).toISOString(),latestBar:new Date(bars.at(-1).time*1000).toISOString()};
    reports.push(report);
    console.log(`${report.oneYearCoverage?'PASS':'WARN'} ${symbol} ${timeframe}: ${bars.length} closed bars over ${report.historyDays} days; ${tested.length} candidate events (${skipped} skipped at next open); ${wins} TP, ${losses} SL, ${unresolved} unresolved; win rate ${report.winRate===null?'n/a':report.winRate+'%'}; gross net ${report.netR}R; coverage ${report.oneYearCoverage?'at least 1 year':'LESS THAN 1 YEAR — validation gate NOT passed'}`);
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
  '- Execution: enter at the next candle open; skip the entry if the open invalidates the stop or leaves less than 3R; same-candle stop/target ambiguity is a stop-first loss; gap-through-stop losses use the next open.',
  '- Gross proxy only, **not** validation of the complete proprietary LOWKEY FX APA strategy. Historical spread, commissions, slippage, latency, financing and a non-overlapping portfolio simulation are not modelled.',
  `- One-year history gate: ${reports.length===SYMBOLS.length*TIMEFRAMES.length&&reports.every(r=>r.oneYearCoverage)?'PASSED for all requested pair/timeframe combinations':'NOT PASSED for one or more pair/timeframe combinations; do not interpret the metrics as a full historical backtest.'}`,
  '',
  '| Pair | TF | Closed bars | History days | 1-year coverage | Candidates | Skipped | TP | SL | Unresolved | Win rate* | Expectancy R* | Profit factor* | Max DD R* | Max losing streak | Large gaps | Net R* |',
  '|---|---:|---:|---:|---:|---:|---:|---:|---:|',
  ...reports.map(r=>`| ${r.symbol} | ${r.timeframe} | ${r.bars} | ${r.historyDays} | ${r.oneYearCoverage?'yes':'NO'} | ${r.candidates} | ${r.skipped} | ${r.wins} | ${r.losses} | ${r.unresolved} | ${r.winRate===null?'n/a':r.winRate+'%'} | ${r.expectancyR===null?'n/a':r.expectancyR} | ${r.profitFactor} | ${r.maxDrawdownR} | ${r.maxLosingStreak} | ${r.largeGaps} | ${r.netR} | `),
  '',
  '*Metrics are gross and descriptive only. Win rate and expectancy use resolved outcomes; skipped and unresolved events are not treated as wins or losses. Max drawdown is computed over this event sequence, not a tradable portfolio. Zero candidates means no qualifying events were found in this limited sample; it does not establish that the strategy never signals.*',
  reports.some(r=>!r.oneYearCoverage||r.candidates===0) ? '\n## Validation warnings\n'+reports.filter(r=>!r.oneYearCoverage||r.candidates===0).map(r=>'- '+r.symbol+' '+r.timeframe+': '+(!r.oneYearCoverage?'history coverage below 365 days':'no candidate events in the available sample')).join('\n') : '\n## Validation warnings\n- None',
  failures.length ? '\n## Data/test failures\n'+failures.map(x=>'- '+x).join('\n') : '\n## Data/test failures\n- None'
].join('\n');
console.log('\n'+summaryLines);
if (process.env.GITHUB_STEP_SUMMARY) await (await import('node:fs/promises')).appendFile(process.env.GITHUB_STEP_SUMMARY,summaryLines+'\n');
if (failures.length) process.exitCode=1;
