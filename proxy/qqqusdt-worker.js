const BINANCE_UPSTREAM = "https://fapi.binance.com";
const BYBIT_UPSTREAM = "https://api.bybit.com";
const BINANCE_INTERVALS = new Set(["1m","3m","5m","15m","30m","1h","2h","4h","6h","8h","12h","1d","3d","1w","1M"]);
const BYBIT_INTERVALS = new Set(["1","3","5","15","30","60","120","240","360","480","720","D","W","M"]);

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

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") return response(null, 204);
    if (request.method !== "GET") return response("Method not allowed", 405);
    const incoming = new URL(request.url);
    const path = incoming.pathname;
    const isBybit = path === "/v5/market/tickers" || path === "/v5/market/kline";
    const isBinance = path === "/fapi/v1/ticker/price" || path === "/fapi/v1/klines";
    if (!isBybit && !isBinance) return response("Endpoint not allowed", 404);

    if (incoming.searchParams.get("symbol") !== "QQQUSDT") {
      return response("Only QQQUSDT is enabled on this public data proxy", 400);
    }

    if (isBinance) {
      if (path.endsWith("/klines")) {
        const interval = incoming.searchParams.get("interval") || "1m";
        const limit = Number(incoming.searchParams.get("limit") || "500");
        if (!BINANCE_INTERVALS.has(interval)) return response("Unsupported Binance candle interval", 400);
        if (!Number.isInteger(limit) || limit < 1 || limit > 1000) return response("limit must be an integer from 1 to 1000", 400);
        for (const key of ["startTime", "endTime"]) if (!validIntegerParam(incoming, key, 0, Number.MAX_SAFE_INTEGER)) return response(key + " must be a non-negative millisecond timestamp", 400);
        if ([...incoming.searchParams.keys()].some(k => !["symbol","interval","limit","startTime","endTime"].includes(k))) return response("Unsupported query parameter", 400);
      } else if ([...incoming.searchParams.keys()].some(k => k !== "symbol")) return response("Unsupported query parameter", 400);
    }

    if (isBybit) {
      if (incoming.searchParams.get("category") !== "linear") return response("Only Bybit linear category is enabled", 400);
      if (path.endsWith("/kline")) {
        const interval = incoming.searchParams.get("interval") || "1";
        const limit = Number(incoming.searchParams.get("limit") || "200");
        if (!BYBIT_INTERVALS.has(interval)) return response("Unsupported Bybit candle interval", 400);
        if (!Number.isInteger(limit) || limit < 1 || limit > 1000) return response("limit must be an integer from 1 to 1000", 400);
        for (const key of ["start","end"]) if (!validIntegerParam(incoming, key, 0, Number.MAX_SAFE_INTEGER)) return response(key + " must be a non-negative millisecond timestamp", 400);
        if ([...incoming.searchParams.keys()].some(k => !["category","symbol","interval","limit","start","end"].includes(k))) return response("Unsupported query parameter", 400);
      } else if ([...incoming.searchParams.keys()].some(k => !["category","symbol"].includes(k))) return response("Unsupported query parameter", 400);
    }

    const upstream = isBybit ? BYBIT_UPSTREAM : BINANCE_UPSTREAM;
    const upstreamUrl = new URL(path + incoming.search, upstream);
    try {
      const upstreamResponse = await fetch(upstreamUrl.toString(), {
        method: "GET",
        headers: { "Accept": "application/json" },
        redirect: "error"
      });
      const body = await upstreamResponse.text();
      return response(body, upstreamResponse.status, {
        "Content-Type": upstreamResponse.headers.get("content-type") || "application/json"
      });
    } catch {
      return response(JSON.stringify({
        code: "UPSTREAM_UNAVAILABLE",
        message: "The proxy could not reach the configured public exchange. This does not represent live market data."
      }), 502, { "Content-Type": "application/json" });
    }
  }
};
