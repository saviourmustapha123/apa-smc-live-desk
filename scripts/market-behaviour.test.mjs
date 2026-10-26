import test from 'node:test';
import assert from 'node:assert/strict';
import { candleFeatures, classifyMarketState } from './market-behaviour.mjs';

function barsFromCloses(closes, width = 1) {
  return closes.map((close, i) => ({
    time: i, open: close - width * 0.2, high: close + width * 0.5,
    low: close - width * 0.5, close
  }));
}

test('market state fails closed for insufficient and malformed data', () => {
  assert.equal(classifyMarketState([]).state, 'INSUFFICIENT_DATA');
  const invalid = barsFromCloses(Array.from({length:30},(_,i)=>100+i));
  invalid[29].low = invalid[29].high + 2;
  assert.equal(classifyMarketState(invalid).state, 'INVALID_DATA');
});

test('candle features detect bullish body, wick ratios and ATR expansion', () => {
  const f = candleFeatures({open:100, high:105, low:99, close:104}, [
    {open:100, high:101, low:99, close:100},
    {open:100, high:101, low:99, close:100}
  ]);
  assert.equal(f.direction, 'BULLISH');
  assert.ok(f.bodyToRange > 0.5);
  assert.ok(f.rangeToAtr > 1);
});

test('steady directional candles are not automatically classified as a reversal', () => {
  const closes = Array.from({length:25},(_,i)=>100+i*1.5);
  const result = classifyMarketState(barsFromCloses(closes, 0.8));
  assert.ok(['UPTREND','BULLISH_BREAKOUT_EXPANSION','EXPANSION','RANGE'].includes(result.state));
  assert.ok(!result.state.includes('REVERSAL'));
  assert.match(result.warning, /Not a trade recommendation/);
});

test('a sudden closing breakout requires prior-range break and displacement evidence', () => {
  const closes = Array.from({length:29},(_,i)=>100 + Math.sin(i)*0.25);
  closes.push(104);
  const bars = closes.map((close,i)=> i===29
    ? {time:i,open:100.2,high:104.2,low:100,close}
    : {time:i,open:close-0.05,high:close+0.1,low:close-0.1,close});
  const result = classifyMarketState(bars);
  assert.ok(['BULLISH_BREAKOUT_EXPANSION','EXPANSION'].includes(result.state));
  assert.ok(result.reasons.some(x=>/expansion|extreme/i.test(x)));
});

test('market-state output uses the latest supplied candle and does not mutate input', () => {
  const bars = barsFromCloses(Array.from({length:30},(_,i)=>100+Math.sin(i)));
  const before = JSON.stringify(bars);
  const result = classifyMarketState(bars);
  assert.equal(result.asOf, 29);
  assert.equal(JSON.stringify(bars), before);
});
