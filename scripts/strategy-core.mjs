export function pivots(bars, k=3) {
  const highs = [], lows = [];
  if (!Array.isArray(bars) || !Number.isInteger(k) || k < 1) return {highs,lows};
  for (let i=k; i<bars.length-k; i++) {
    let high=true, low=true;
    // Deterministic ties: earliest equal pivot wins (strict left, inclusive right).
    for (let j=i-k; j<i; j++) {
      if (bars[j].high >= bars[i].high) high=false;
      if (bars[j].low <= bars[i].low) low=false;
    }
    for (let j=i+1; j<=i+k; j++) {
      if (bars[j].high > bars[i].high) high=false;
      if (bars[j].low < bars[i].low) low=false;
    }
    if (high) highs.push({i,p:bars[i].high,known_at:bars[i+k].time ?? i+k});
    if (low) lows.push({i,p:bars[i].low,known_at:bars[i+k].time ?? i+k});
  }
  return {highs,lows};
}

export function atr(bars, n=14) {
  if (bars.length<n+1) return null;
  const values=[];
  for (let i=bars.length-n; i<bars.length; i++) {
    const x=bars[i], p=bars[i-1];
    values.push(Math.max(x.high-x.low,Math.abs(x.high-p.close),Math.abs(x.low-p.close)));
  }
  return values.reduce((a,b)=>a+b,0)/values.length;
}

export function qualifiesRiskReward(rr, minimum=3) {
  return Number.isFinite(rr) && rr >= minimum;
}

export function assessAt(bars, {k=3, atrPeriod=14, displacementAtr=1, minRR=3}={}) {
  const {highs,lows}=pivots(bars,k);
  const sh=highs.at(-1), sl=lows.at(-1);
  if (!sh || !sl || bars.length < Math.max(atrPeriod+1, 2)) return null;
  const x=bars.at(-1), prev=bars.at(-2), average=atr(bars,atrPeriod) || Math.max(x.high-x.low,1e-8);
  const bull=x.close>x.open, bear=x.close<x.open, displacement=Math.abs(x.close-x.open)>=average*displacementAtr;
  const sweepHigh=x.high>sh.p && x.close<sh.p;
  const sweepLow=x.low<sl.p && x.close>sl.p;
  const bearBreak=prev.close>=sl.p && x.close<sl.p;
  const bullBreak=prev.close<=sh.p && x.close>sh.p;
  let side=null;
  if ((sweepHigh&&bear&&displacement)||(sweepHigh&&bearBreak)||(bearBreak&&bear&&displacement)) side='SELL';
  else if ((sweepLow&&bull&&displacement)||(sweepLow&&bullBreak)||(bullBreak&&bull&&displacement)) side='BUY';
  if (!side) return null;
  const entry=x.close;
  const stop=side==='SELL'?Math.max(x.high,sh.p):Math.min(x.low,sl.p);
  const risk=Math.abs(entry-stop);
  if (!(risk>0)) return null;
  const confirmedPivots=pivots(bars,k);
  const confirmBefore=bars.length-1-k;
  const targets=side==='BUY'
    ? confirmedPivots.highs.filter(p=>p.i<=confirmBefore&&p.p>entry).map(p=>p.p)
    : confirmedPivots.lows.filter(p=>p.i<=confirmBefore&&p.p<entry).map(p=>p.p);
  if (!targets.length) return null;
  const target=side==='BUY'?Math.min(...targets):Math.max(...targets);
  const rr=Math.abs(target-entry)/risk;
  if (!qualifiesRiskReward(rr,minRR)) return null;
  return {index:bars.length-1,time:x.time,side,entry,sl:stop,tp:target,rr};
}

export function simulate(bars, signal, maxForwardBars=100, minRR=3) {
  if (!Array.isArray(bars) || !signal || !Number.isInteger(signal.index) ||
      signal.index < 0 || !['BUY','SELL'].includes(signal.side) ||
      !Number.isFinite(signal.sl) || !Number.isFinite(signal.tp) ||
      !Number.isInteger(maxForwardBars) || maxForwardBars < 1 ||
      !Number.isFinite(minRR) || minRR < 3) {
    return {result:'INVALID INPUT',r:null,entry:null,rr:null};
  }
  const first=bars[signal.index+1];
  if (!first) return {result:'UNRESOLVED',r:null,entry:null,rr:null};
  // Setup is known after signal candle close; execution is next candle open.
  const entry=first.open;
  const risk=signal.side==='BUY'?entry-signal.sl:signal.sl-entry;
  const reward=signal.side==='BUY'?signal.tp-entry:entry-signal.tp;
  const rr=risk>0&&reward>0?reward/risk:null;
  if (!(Number.isFinite(rr)&&rr>=minRR)) return {result:'SKIPPED (next-open entry fails 1:3 gate)',r:0,entry,rr};
  const end=Math.min(bars.length,signal.index+1+maxForwardBars);
  for (let i=signal.index+1;i<end;i++) {
    const b=bars[i];
    const gapStop=signal.side==='BUY'?b.open<=signal.sl:b.open>=signal.sl;
    const gapTarget=signal.side==='BUY'?b.open>=signal.tp:b.open<=signal.tp;
    // Gaps are handled at the open before inspecting the later candle range.
    if (gapStop) return {result:'LOSS (gap through stop)',r:-(Math.abs(entry-b.open)/risk),entry,rr};
    if (gapTarget) return {result:'WIN (target crossed at open)',r:rr,entry,rr};
    const stop=signal.side==='BUY'?b.low<=signal.sl:b.high>=signal.sl;
    const target=signal.side==='BUY'?b.high>=signal.tp:b.low<=signal.tp;
    if (stop&&target) return {result:'LOSS (both levels touched; stop-first assumption)',r:-1,entry,rr};
    if (stop) return {result:'LOSS',r:-1,entry,rr};
    if (target) return {result:'WIN',r:rr,entry,rr};
  }
  return {result:'UNRESOLVED',r:null,entry,rr};
}
