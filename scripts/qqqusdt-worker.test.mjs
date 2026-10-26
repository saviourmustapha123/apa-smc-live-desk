import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createContext, Script } from 'node:vm';

const source = await readFile(new URL('../proxy/qqqusdt-worker.js', import.meta.url), 'utf8');
function makeWorker(fetchImpl) {
  const context = createContext({ fetch: fetchImpl, URL, URLSearchParams, Request, Response, console });
  new Script(source.replace('export default {', 'const worker = {') + '\nthis.worker = worker;').runInContext(context);
  return context.worker;
}
const jsonResponse = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
const binanceKline = ['1790000000000','100','102','99','101','12','1790000059999','1212','4','5','500','0'];
const bybitKline = ['1790000000000','100','102','99','101','12','1212'];

test('Bybit ticker request falls back to actual Binance ticker data and preserves Bybit response shape', async () => {
  const calls = [];
  const worker = makeWorker(async url => {
    calls.push(String(url));
    if (String(url).includes('api.bybit.com')) throw new Error('simulated Bybit network block');
    return jsonResponse({ symbol: 'QQQUSDT', price: '123.45' });
  });
  const response = await worker.fetch(new Request('https://worker.test/v5/market/tickers?category=linear&symbol=QQQUSDT'));
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.retCode, 0);
  assert.equal(body.result.list[0].lastPrice, '123.45');
  assert.match(response.headers.get('x-apa-data-source'), /Binance-fallback/);
  assert.equal(calls.length, 3, 'primary Bybit, alternate Bytick, then Binance fallback are attempted in order');
  assert.match(calls[1], /api\.bytick\.com/);
});

test('Bybit candle request maps 60-minute interval to Binance 1h and returns real OHLC rows', async () => {
  let fallbackUrl = '';
  const worker = makeWorker(async url => {
    const u = new URL(String(url));
    if (u.hostname === 'api.bybit.com') throw new Error('simulated Bybit network block');
    fallbackUrl = u.toString();
    return jsonResponse([binanceKline]);
  });
  const response = await worker.fetch(new Request('https://worker.test/v5/market/kline?category=linear&symbol=QQQUSDT&interval=60&limit=1'));
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(new URL(fallbackUrl).searchParams.get('interval'), '1h');
  assert.equal(body.result.list[0][0], binanceKline[0]);
  assert.equal(body.result.list[0][4], '101');
});

test('Binance ticker request falls back to actual Bybit ticker data and preserves Binance response shape', async () => {
  const worker = makeWorker(async url => {
    const u = new URL(String(url));
    if (u.hostname === 'fapi.binance.com') throw new Error('simulated Binance network block');
    return jsonResponse({ retCode: 0, result: { list: [{ symbol: 'QQQUSDT', lastPrice: '222.10' }] } });
  });
  const response = await worker.fetch(new Request('https://worker.test/fapi/v1/ticker/price?symbol=QQQUSDT'));
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.symbol, 'QQQUSDT');
  assert.equal(body.price, '222.10');
  assert.match(response.headers.get('x-apa-data-source'), /Bybit-fallback/);
});

test('Binance candle request maps 1h to Bybit 60 and returns Binance-shaped OHLC rows', async () => {
  let fallbackUrl = '';
  const worker = makeWorker(async url => {
    const u = new URL(String(url));
    if (u.hostname === 'fapi.binance.com') throw new Error('simulated Binance network block');
    fallbackUrl = u.toString();
    return jsonResponse({ retCode: 0, result: { list: [bybitKline] } });
  });
  const response = await worker.fetch(new Request('https://worker.test/fapi/v1/klines?symbol=QQQUSDT&interval=1h&limit=1'));
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(new URL(fallbackUrl).searchParams.get('interval'), '60');
  assert.equal(body[0][0], Number(bybitKline[0]));
  assert.equal(body[0][4], '101');
  assert.equal(body[0][6], Number(bybitKline[0]) + 3600000 - 1);
});

test('worker rejects other symbols and does not proxy them to either exchange', async () => {
  let called = false;
  const worker = makeWorker(async () => { called = true; throw new Error('should not be called'); });
  const response = await worker.fetch(new Request('https://worker.test/v5/market/tickers?category=linear&symbol=BTCUSDT'));
  assert.equal(response.status, 400);
  assert.equal(called, false);
});

test('worker provides CORS headers for browser fetches', async () => {
  const worker = makeWorker(async () => jsonResponse({ symbol: 'QQQUSDT', price: '100' }));
  const response = await worker.fetch(new Request('https://worker.test/fapi/v1/ticker/price?symbol=QQQUSDT'));
  assert.equal(response.headers.get('access-control-allow-origin'), '*');
});
