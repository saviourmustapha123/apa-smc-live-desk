import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');

test('chart exposes monthly and yearly timeframe controls', () => {
  assert.match(html, /data-t="1M">1M/);
  assert.match(html, /data-t="1Y">1Y/);
  assert.match(html, /'1W':604800/);
  assert.match(html, /'1Y':31536000/);
});

test('weekly candle refresh uses the same Monday UTC bucket as weekly aggregation', () => {
  assert.match(html, /if\(tf==='1W'\)\{const day=\(d\.getUTCDay\(\)\+6\)%7;return Date\.UTC\(d\.getUTCFullYear\(\),d\.getUTCMonth\(\),d\.getUTCDate\(\)-day\)\/1000\}/);
  assert.match(html, /calendarAggregate\(daily,'week'\)/);
});

test('yearly candles are bucketed by calendar year, not fixed 365-day offsets', () => {
  assert.match(html, /if\(tf==='1Y'\)return Date\.UTC\(d\.getUTCFullYear\(\),0,1\)\/1000/);
  assert.match(html, /calendarAggregate\(daily,'year'\)/);
  assert.match(html, /minimumBars=s\.tf==='1Y'\?10:s\.tf==='1M'\?20:35/);
});

test('monthly and yearly contexts are included in the top-down and background scan sets', () => {
  assert.match(html, /summarizeTf\('Yearly',yearly\)/);
  assert.match(html, /\['1M',monthly\],\['1Y',yearly\]/);
  assert.match(html, /\['1M',monthly\],\['1Y',yearly\]/);
  assert.match(html, /across 9 timeframes/);
});

test('selected chart candles are refreshed from the OHLC endpoint separately from quote polling', () => {
  assert.match(html, /async function refreshSelectedCandles\(force=false\)/);
  assert.match(html, /await tick\(\);await refreshSelectedCandles\(false\)/);
  assert.match(html, /Candle refresh failed · retaining cached bars/);
});

test('higher-timeframe history backfill is bounded and persisted to the daily candle store', () => {
  assert.match(html, /rounds<16/);
  assert.match(html, /await dbPut\(daily,sym,'1d'\)/);
  assert.match(html, /fetchBarsRaw\(sym,'1d',1000,fromTime,toTime\)/);
});
