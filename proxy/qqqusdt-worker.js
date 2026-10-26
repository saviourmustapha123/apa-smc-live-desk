const BINANCE_UPSTREAM = "https://fapi.binance.com";
const BYBIT_UPSTREAM = "https://api.bybit.com";
const BINANCE_INTERVALS = new Set(["1m","3m","5m","15m","30m","1h","2h","4h","6h","8h","12h","1d","3d","1w","1M"]);
const BYBIT_INTERVALS = new Set(["1","3","5","15","30","60","120","240","360","480","720","D","W","M"]);
const BYBIT_TO_BINANCE = { "1":"1m","3":"3m","5":"5m","15":"15m","30":"30m","60":"1h","120":"2h","240":"4h","360":"6h","480":"8h","720":"12h","D":"1d","W":"1w","M":"1M" };
const BINANCE_TO_BYBIT = Object.fromEntries(Object.entries(BYBIT_TO_BINANCE).map(([b, n]) => [n, b]));
const INTERVAL_MS = { "1m":60000,"3m":180000,"5m":300000,"15m":900000,"30m":1800000,"1h":3600000,"2h":7200000,"4h":14400000,"6h":21600000,"8h":28800000,"12h":43200000,"1d":86400000,"3d":259200000,"1w":604800000 };

function corsHeaders(extra = {}) {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    ...extra
  };
}
function response(body, status = 200, headers = {}) {
  return new Response(body, { status, headers: corsHeaders(headers) });
}
function validIntegerParam(url, key, min, max) {
  if (!url.searchParams.has(key)) return true;
  const n = Number(url.searchParams.get(key));
  return Number.isSafeInteger(n) && n >= min && n <= max;
}
async function fetchJson(url) {
  const res = await fetch(url, { method: "GET", headers: { "Accept": "application/json" }, redirect: "follow" });
  const body = await res.text();
  if (!res.ok) throw new Error("HTTP " + res.status + " from " + new URL(url).hostname);
  let data;
  try { data = JSON.parse(body); } catch { throw new Error("Non-JSON response from " + new URL(url).hostname); }
  return { data, contentType: res.headers.get("content-type") || "application/json" };
}
function binanceKlineUrl(incoming) {
  const interval = incoming.searchParams.get("interval") || "1m";
  const limit = incoming.searchParams.get("limit") || "500";
  const q = new URLSearchParams({ symbol: "QQQUSDT", interval, limit });
  if (incoming.searchParams.has("startTime")) q.set("startTime", incoming.searchParams.get("startTime"));
  if (incoming.searchParams.has("endTime")) q.set("endTime", incoming.searchParams.get("endTime"));
  return BINANCE_UPSTREAM + "/fapi/v1/klines?" + q;
}
function bybitKlineUrl(incoming) {
  const interval = incoming.searchParams.get("interval") || "1";
  const limit = incoming.searchParams.get("limit") || "200";
  const q = new URLSearchParams({ category: "linear", symbol: "QQQUSDT", interval, limit });
  if (incoming.searchParams.has("start")) q.set("start", incoming.searchParams.get("start"));
  if (incoming.searchParams.has("end")) q.set("end", incoming.searchParams.get("end"));
  return BYBIT_UPSTREAM + "/v5/market/kline?" + q;
}
async function bybitCompatibleFallback(path, incoming) {
  if (path === "/v5/market/tickers") {
    const { data } = await fetchJson(BINANCE_UPSTREAM + "/fapi/v1/ticker/price?symbol=QQQUSDT");
    if (data.symbol !== "QQQUSDT" || !(Number(data.price) > 0)) throw new Error("Invalid Binance ticker");
    return { retCode: 0, retMsg: "OK", result: { category: "linear", list: [{ symbol: "QQQUSDT", lastPrice: String(data.price), bid1Price: String(data.price), ask1Price: String(data.price) }] }, time: Date.now() };
  }
  const interval = incoming.searchParams.get("interval") || "1";
  const binanceInterval = BYBIT_TO_BINANCE[interval];
  if (!binanceInterval) throw new Error("No Binance fallback mapping for Bybit interval " + interval);
  const q = new URLSearchParams({ symbol: "QQQUSDT", interval: binanceInterval, limit: incoming.searchParams.get("limit") || "500" });
  if (incoming.searchParams.has("start")) q.set("startTime", incoming.searchParams.get("start"));
  if (incoming.searchParams.has("end")) q.set("endTime", incoming.searchParams.get("end"));
  const { data } = await fetchJson(BINANCE_UPSTREAM + "/fapi/v1/klines?" + q);
  if (!Array.isArray(data)) throw new Error("Invalid Binance klines");
  const rows = data.map(r => [r[0], r[1], r[2], r[3], r[4], r[5], r[7] || "0"]);
  return { retCode: 0, retMsg: "OK", result: { category: "linear", symbol: "QQQUSDT", list: rows }, time: Date.now() };
}
async function binanceCompatibleFallback(path, incoming) {
  if (path === "/fapi/v1/ticker/price") {
    const { data } = await fetchJson(BYBIT_UPSTREAM + "/v5/market/tickers?category=linear&symbol=QQQUSDT");
    const ticker = data.result?.list?.[0];
    if (Number(data.retCode) !== 0 || ticker?.symbol !== "QQQUSDT" || !(Number(ticker.lastPrice) > 0)) throw new Error("Invalid Bybit ticker");
    return { symbol: "QQQUSDT", price: String(ticker.lastPrice), time: Date.now() };
  }
  const interval = incoming.searchParams.get("interval") || "1m";
  const bybitInterval = BINANCE_TO_BYBIT[interval];
  if (!bybitInterval) throw new Error("No Bybit fallback mapping for Binance interval " + interval);
  const q = new URLSearchParams({ category: "linear", symbol: "QQQUSDT", interval: bybitInterval, limit: incoming.searchParams.get("limit") || "500" });
  if (incoming.searchParams.has("startTime")) q.set("start", incoming.searchParams.get("startTime"));
  if (incoming.searchParams.has("endTime")) q.set("end", incoming.searchParams.get("endTime"));
  const { data } = await fetchJson(BYBIT_UPSTREAM + "/v5/market/kline?" + q);
  const rows = data.result?.list;
  if (Number(data.retCode) !== 0 || !Array.isArray(rows)) throw new Error("Invalid Bybit klines");
  const span = INTERVAL_MS[interval] || 3600000;
  return rows.map(r => [Number(r[0]),r[1],r[2],r[3],r[4],r[5],Number(r[0])+span-1,r[6]||"0",0,"0","0","0"]);
}

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") return response(null, 204);
    if (request.method !== "GET") return response("Method not allowed", 405);
    const incoming = new URL(request.url);
    const path = incoming.pathname;
    const isBybit = path === "/v5/market/tickers" || path === "/v5/market/kline";
    const isBinance = path === "/fapi/v1/ticker/price" || path === "/fapi/v1/klines";
    if (!isBybit && !isBinance) return response("Endpoint not allowed", 404);
    if (incoming.searchParams.get("symbol") !== "QQQUSDT") return response("Only QQQUSDT is enabled on this public data proxy", 400);

    if (isBinance) {
      if (path.endsWith("/klines")) {
        const interval = incoming.searchParams.get("interval") || "1m";
        const limit = Number(incoming.searchParams.get("limit") || "500");
        if (!BINANCE_INTERVALS.has(interval)) return response("Unsupported Binance candle interval", 400);
        if (!Number.isInteger(limit) || limit < 1 || limit > 1000) return response("limit must be an integer from 1 to 1000", 400);
        for (const key of ["startTime","endTime"]) if (!validIntegerParam(incoming,key,0,Number.MAX_SAFE_INTEGER)) return response(key + " must be a non-negative millisecond timestamp",400);
        if ([...incoming.searchParams.keys()].some(k => !["symbol","interval","limit","startTime","endTime"].includes(k))) return response("Unsupported query parameter",400);
      } else if ([...incoming.searchParams.keys()].some(k => k !== "symbol")) return response("Unsupported query parameter",400);
    }
    if (isBybit) {
      if (incoming.searchParams.get("category") !== "linear") return response("Only Bybit linear category is enabled",400);
      if (path.endsWith("/kline")) {
        const interval = incoming.searchParams.get("interval") || "1";
        const limit = Number(incoming.searchParams.get("limit") || "200");
        if (!BYBIT_INTERVALS.has(interval)) return response("Unsupported Bybit candle interval",400);
        if (!Number.isInteger(limit) || limit < 1 || limit > 1000) return response("limit must be an integer from 1 to 1000",400);
        for (const key of ["start","end"]) if (!validIntegerParam(incoming,key,0,Number.MAX_SAFE_INTEGER)) return response(key + " must be a non-negative millisecond timestamp",400);
        if ([...incoming.searchParams.keys()].some(k => !["category","symbol","interval","limit","start","end"].includes(k))) return response("Unsupported query parameter",400);
      } else if ([...incoming.searchParams.keys()].some(k => !["category","symbol"].includes(k))) return response("Unsupported query parameter",400);
    }

    try {
      const { data, contentType } = await fetchJson(new URL(path + incoming.search, isBybit ? BYBIT_UPSTREAM : BINANCE_UPSTREAM).toString());
      if (isBybit && Number(data.retCode) !== 0) throw new Error("Bybit API: " + (data.retMsg || data.retCode));
      if (isBinance && path.endsWith("/klines") && !Array.isArray(data)) throw new Error("Invalid Binance klines response");
      return response(JSON.stringify(data), 200, { "Content-Type": contentType });
    } catch (primaryError) {
      try {
        const fallback = isBybit ? await bybitCompatibleFallback(path,incoming) : await binanceCompatibleFallback(path,incoming);
        return response(JSON.stringify(fallback),200,{"Content-Type":"application/json","X-APA-Data-Source":isBybit?"Binance-fallback":"Bybit-fallback"});
      } catch (fallbackError) {
        return response(JSON.stringify({
          code: "UPSTREAM_UNAVAILABLE",
          message: "Neither configured public exchange route could return valid QQQUSDT data. No synthetic prices were generated.",
          primary: String(primaryError?.message || primaryError).slice(0,160),
          fallback: String(fallbackError?.message || fallbackError).slice(0,160)
        }),502,{"Content-Type":"application/json"});
      }
    }
  }
};
